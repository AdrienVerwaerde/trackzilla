# Potageek — Projet Sentinelle

Capteur ESP32 → broker MQTT → **backend** (Node, SQLite) → **app** (Expo).

```
backend/   Node 22.13+ · node:sqlite · MQTT → REST + WebSocket
app/       Expo (base Pocket Sensors) · tableau de bord temps réel + historique
```

## Lancement

Prérequis : Node **22.13 ou plus** (`node -v`), un `.env` copié depuis `.env.example` dans `backend/` et dans `app/`.

```bash
cd backend && npm install && npm start
cd app && npm install && npx expo start
```

En développement, `npm run dev` relance le backend à chaque modification.

Dans `app/.env`, `EXPO_PUBLIC_API_URL` doit pointer vers l'**IP du portable** sur le réseau partagé, pas `localhost`.

## Contrat d'API

```
GET  /devices                                   → [{ id, group, status, lastSeen, led }]
GET  /devices/:id/measurements?from=&to=&step=  → [{ ts, t, h }]
GET  /devices/:id/thresholds                    → { tMin, tMax, hMin, hMax, holdMinutes }
PUT  /devices/:id/thresholds                    ← même objet
     → 400 si : t hors [-10, 50] °C · h hors [0, 100] % · tMin ≥ tMax · hMin ≥ hMax
                holdMinutes hors [0, 1440] · une borne à null n'est pas surveillée
GET  /devices/:id/events?from=&to=&limit=       → [{ eventId, device, ts, type, ...payload }]
     du plus ancien au plus récent · sans from : les `limit` derniers (200 par défaut, 1000 max)
     avec from : depuis from inclus, dédoublonner sur eventId
     type : alert | alert_cleared | status | command | command_status
POST /devices/:id/commands                      ← { "id": "c-7f3a…", "led": true }
     → 202 { "id", "status": "sent" }   première fois : publié sur …/cmd
     → 200 { "id", "status" }           id déjà vu : rien n'est republié
     → 409                              id déjà vu pour un autre device ou état

WS   measurement    { device, ts, t, h }
     alert          { device, ts, kind, value, threshold }
     alert_cleared  { device, ts, kind }
     device_status  { device, status }
     device_state   { device, led }                 état réel publié par le boîtier
     command_status { id, device, status: "acked" } la dernière commande en attente est confirmée
     command_status { id, device, status: "failed", reason: "timeout" }
                    aucun état reçu du boîtier 30 s après l'envoi ; un rejeu de cet id répond 200 "failed"
```

Tous les `ts` sont en secondes epoch, UTC.

## Choix côté backend

### Commandes idempotentes

L'app choisit l'`id` de chaque commande et le backend le garde dans la table `commands`, en base : un `id` déjà vu n'est jamais republié sur MQTT, même après un redémarrage du backend. Le rejeu est donc sûr, quelle que soit la stratégie de l'app.

Une commande décrit l'état voulu (`"led": true`), jamais une bascule : rejouer deux fois le même ordre laisse la LED dans le même état.

Un `id` réutilisé pour un autre device ou un autre état répond **409** plutôt que 200 : c'est un bug de l'app, pas un rejeu, et le masquer le rendrait introuvable.

### Confirmation par le boîtier

Le backend s'abonne à `sentinelle/<groupe>/<device>/state`. À chaque état reçu, il met à jour `devices.led` et passe en `acked` la **dernière** commande en attente sur ce device, à une condition : **que la LED ait pris l'état demandé**. Le message de démarrage (LED éteinte) ne confirme donc pas une commande `led: true` en attente.

Un état **retenu** (retain), que le broker rejoue à la reconnexion du backend, met à jour la LED mais ne confirme rien : c'est le broker qui parle, pas le boîtier qui répond.

### Commandes en échec

Une commande sans état reçu après **30 s** passe en `failed`. Un boîtier en ligne répond en environ une seconde ; 30 s laisse de la marge à un broker lent sans laisser l'app afficher « en attente » indéfiniment. Seule l'horloge peut décider de l'échec : aucun message du boîtier ne dit « je n'ai rien reçu ».

Limite assumée : une commande partie pendant que le boîtier est déconnecté passe en `failed`, même si la LED finit par s'allumer à son retour. L'état réel reste visible via `device_state` et `GET /devices`.

### Seuils : le dernier arrivé au serveur gagne

`PUT /thresholds` remplace les seuils en entier, sans comparer de version. Si deux téléphones modifient les seuils hors ligne, celui dont la requête atteint le serveur en dernier l'emporte. Pour un seuil de serre modifié rarement et par une seule personne, un conflit est peu probable, et le dernier choix exprimé est le plus pertinent.

Les bornes plausibles (-10 à 50 °C, 0 à 100 % d'humidité) correspondent à une serre de tomates. Une valeur en dehors est une faute de frappe (300 pour 30,0) qui ferait sonner l'alerte en permanence ou jamais.

### Journal

`GET /devices/:id/events` renvoie les alertes, les retours à la normale, les passages online/offline et chaque commande avec son statut. Avec `from`, l'app ne recharge que ce qui manque. `from` est inclus, parce que plusieurs événements peuvent partager la même seconde : l'app dédoublonne sur `eventId`.

Un statut online/offline n'est journalisé que s'il change : le broker rejoue le dernier statut à chaque reconnexion, et ce n'est pas un événement.

## Choix côté app

### Ce que le cache garde, et jusqu'où

Le cache local (SQLite, `expo-sqlite`) n'est pas une copie du backend : c'est ce dont l'utilisateur a besoin quand il est coupé. Quatre tables — `measurements`, `devices`, `thresholds`, `events`.

Les mesures sont bornées à **la fenêtre la plus large que le tableau de bord sait afficher (3 h)**, et non à une durée ronde choisie à part. Garder plus serait garder ce qu'aucun écran ne peut dessiner ; garder moins ferait un trou dans la courbe en mode avion. À une mesure toutes les 5 s, cela représente environ 2 160 lignes par device : une courbe qui vaut la peine d'être ouverte en vol, et une table assez petite pour être relue d'un coup au démarrage.

Le ménage se fait au lancement de l'app et après chaque rattrapage, pas à chaque insertion : une mesure arrive toutes les 5 s, et un `DELETE` à cette fréquence coûterait bien plus que les quelques lignes qu'il récupère.

### Afficher d'abord, rafraîchir ensuite

À l'ouverture, l'écran se dessine depuis le cache avant que le réseau ne soit sollicité, puis le socket remplace ce qu'il peut. En mode avion il ne répond jamais, et l'écran est quand même là : c'est tout l'intérêt. Aucun écran blanc n'attend le réseau.

### Ne recharger que ce qui manque

Au retour du réseau, l'app ne redemande que la tranche depuis la mesure la plus récente qu'elle détient (`from` = dernier `ts` connu + 1, la borne du backend étant inclusive). Si le cache est plus vieux que la fenêtre, elle repart du début de la fenêtre : un rattrapage partiel laisserait un trou. Élargir la fenêtre du graphique est le seul cas qui redemande tout, puisque sa moitié ancienne n'a jamais été téléchargée — et le cache répond en premier, de sorte que le graphique s'élargit même hors ligne.

### Données datées et distinguées

Hors ligne, la bannière date la dernière mesure (« Hors ligne · dernières données à 14h02 ») et la carte passe de « Mesure à » à « Dernière mesure à ». Le statut du capteur ne s'affiche jamais en vert tant que le socket est fermé : ce qui vient du cache est annoncé comme « Dernier état connu », parce qu'un point vert ressorti de la veille est un mensonge. Les courbes sont atténuées quand elles viennent du cache ; l'atténuation porte sur les graphiques et non sur leurs libellés, le plancher de contraste de 4,5:1 s'appliquant au texte.

## Contribution

| Membre | Couche | Branches |
| --- | --- | --- |
| Adrien Verwaerde | App (tableau de bord, historique, cycle de vie du WebSocket, bannière réseau, cache local) | `frontend`, `frontend_graph`, `frontend_local-cache` |
| Samantha | Backend (MQTT, stockage, historique, seuils, commandes, WebSocket, journal, mode hors ligne) | `backend`, `backend_offline_mode` |
