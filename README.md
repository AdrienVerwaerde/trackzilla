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

Le backend refuse de démarrer sans ses secrets d'authentification. À générer une fois dans `backend/` :

```bash
npm run hash-password -- '<mot de passe du groupe>'                           # → AUTH_PASSWORD_HASH
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # → JWT_SECRET
```

## Contrat d'API

```
POST /auth/login                                ← { "username", "password" }
     → 200 { "token", "expiresAt" }     JWT HS256, 15 min · 401 si identifiants faux

GET  /devices                                   → [{ id, group, status, lastSeen, led }]
GET  /devices/:id/measurements?from=&to=&step=  → [{ ts, t, h }]
GET  /devices/:id/thresholds                    → { tMin, tMax, hMin, hMax, holdMinutes }
PUT  /devices/:id/thresholds                    ← même objet          🔒 Authorization: Bearer <token>
     → 400 si : t hors [-10, 50] °C · h hors [0, 100] % · tMin ≥ tMax · hMin ≥ hMax
                holdMinutes hors [0, 1440] · une borne à null n'est pas surveillée
GET  /devices/:id/events?from=&to=&limit=       → [{ eventId, device, ts, type, ...payload }]
     du plus ancien au plus récent · sans from : les `limit` derniers (200 par défaut, 1000 max)
     avec from : depuis from inclus, dédoublonner sur eventId
     type : alert | alert_cleared | status | command | command_status
POST /devices/:id/commands                      ← { "id": "c-7f3a…", "led": true }   🔒 Bearer
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

🔒 : sans jeton valide → **401**. Au-delà de la limite de débit → **429**. Les lectures (`GET`, WebSocket) restent ouvertes.

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

## Sécurité (TP5)

### Backend

**Un compte par groupe, un jeton court.** `POST /auth/login` délivre un JWT HS256 valable 15 minutes. Rien ne permet de révoquer un jeton : la durée courte est ce qui limite la vie d'un jeton volé. Le mot de passe n'est jamais stocké, ni en base ni dans `.env` : seul son hachage scrypt (`AUTH_PASSWORD_HASH`) y figure, si bien qu'un `.env` qui fuit ne donne pas l'identifiant. La comparaison se fait en temps constant, et un nom d'utilisateur faux prend autant de temps qu'un mot de passe faux : le chronométrage ne dit pas lequel était bon.

**Toute action exige le jeton.** `POST /commands` et `PUT /thresholds` répondent 401 sans `Authorization: Bearer <token>` valide. L'algorithme est imposé à la vérification (`HS256`) : accepter celui qu'annonce l'en-tête du jeton, c'est laisser passer les jetons `alg: none`. Chaque commande est journalisée avec son auteur.

**Les lectures restent ouvertes, et c'est un choix.** Le tableau de bord, l'historique et le WebSocket montrent des relevés de serre, pas de quoi piloter quoi que ce soit, et c'est ce que l'app affiche avant toute connexion. Risque résiduel : qui connaît l'URL peut lire les mesures.

**Limites de débit**, par IP et par minute : 10 commandes, 10 modifications de seuils, 5 tentatives de connexion. Une LED basculée plus de dix fois par minute, c'est un script, pas une personne ; cinq essais par minute rendent la devinette de mot de passe impraticable.

**CORS strict** : seules les origines de `CORS_ORIGINS` reçoivent les en-têtes CORS. CORS n'est appliqué que par les navigateurs : l'app native et `curl` n'envoient pas d'`Origin` et ne sont pas concernés. Ce qui protège vraiment les actions, c'est le jeton.

**Pas de démarrage à moitié sécurisé.** Si un secret manque, ou si `JWT_SECRET` fait moins de 32 caractères, le serveur refuse de démarrer plutôt que de tourner porte ouverte. Le corps des requêtes est plafonné à 10 ko et l'en-tête `X-Powered-By` est retiré.

**Vers le broker**, la connexion MQTT vérifie le certificat TLS (comportement par défaut de `mqtt.js`, jamais désactivé), avec un identifiant propre au backend, distinct de celui du boîtier.

## Choix côté app

### Ce que le cache garde, et jusqu'où

Le cache local (SQLite, `expo-sqlite`) n'est pas une copie du backend : c'est ce dont l'utilisateur a besoin quand il est coupé. Quatre tables — `measurements`, `devices`, `thresholds`, `events`.

Les mesures sont bornées à **la fenêtre la plus large que le tableau de bord sait afficher (3 h)**, et non à une durée ronde choisie à part. Garder plus serait garder ce qu'aucun écran ne peut dessiner ; garder moins ferait un trou dans la courbe en mode avion. À une mesure toutes les 5 s, cela représente environ 2 160 lignes par device : une courbe qui vaut la peine d'être ouverte en vol, et une table assez petite pour être relue d'un coup au démarrage.

Le ménage se fait au lancement de l'app et après chaque rattrapage, pas à chaque insertion : une mesure arrive toutes les 5 s, et un `DELETE` à cette fréquence coûterait bien plus que les quelques lignes qu'il récupère.

### Afficher d'abord, rafraîchir ensuite

À l'ouverture, l'écran se dessine depuis le cache avant que le réseau ne soit sollicité, puis le socket remplace ce qu'il peut. En mode avion il ne répond jamais, et l'écran est quand même là : c'est tout l'intérêt. Aucun écran blanc n'attend le réseau.

### Ne recharger que ce qui manque

Au retour du réseau, l'app ne redemande que la tranche depuis la mesure la plus récente qu'elle détient (`from` = dernier `ts` connu + 1, la borne du backend étant inclusive). Si le cache est plus vieux que la fenêtre, elle repart du début de la fenêtre : un rattrapage partiel laisserait un trou. Élargir la fenêtre du graphique est le seul cas qui redemande tout, puisque sa moitié ancienne n'a jamais été téléchargée — et le cache répond en premier, de sorte que le graphique s'élargit même hors ligne.

### La file de commandes

Chaque appui sur la LED crée une ligne en base (`id` généré par l'app, device, état voulu, statut, nombre de tentatives, date) : elle survit à la fermeture de l'app. Statuts : `pending` → `sent` → `acked`, ou `failed` après 5 tentatives réseau ou un refus du backend.

L'app **n'attend pas le réseau pour accepter l'ordre**. Le bouton prend tout de suite l'état voulu, en pointillé, marqué « en attente » puis « envoyée » ; il est confirmé à `acked` par le vrai boîtier, et revient en arrière avec un message à `failed`.

**Conflit entre deux ordres contradictoires : seul le dernier par device survit.** Quand une commande est mise en file, les `pending` du même device sont supprimées — elles ne sont jamais parties, donc rien ne s'est passé qu'il faille raconter. Rejouer les deux ferait clignoter la LED pour finir au même endroit, et le backend n'acquitte de toute façon que la dernière commande en attente : les précédentes expireraient en `failed` et afficheraient des erreurs qui n'en sont pas.

Un redémarrage remet en `pending` ce qui était `sent` : l'acquittement a pu être manqué pendant que l'app était morte. Le rejeu est sans risque puisque le backend republie jamais deux fois le même `id` — s'il avait déjà été traité, il répond 200 avec son statut réel.

Un seul vidage à la fois (un verrou) : le socket qui s'ouvre et NetInfo qui annonce le retour du réseau se déclenchent ensemble, et deux passes enverraient le même ordre deux fois. La file se vide dans l'ordre, en une passe, et s'arrête à la première erreur réseau pour reprendre après le délai.

### Réglages

L'écran s'ouvre depuis le cache (table `thresholds`), puis se met à jour quand le backend répond : il est donc consultable et modifiable hors ligne.

La validation reprend les règles du backend côté app — bornes plausibles, `tMin < tMax`, `hMin < hMax`, `holdMinutes` entre 0 et 1440 — pour que la faute de frappe soit refusée avant d'entrer en file, pas trois heures plus tard au retour du réseau. Un champ vide vaut `null` : la borne n'est pas surveillée.

Les seuils modifiés passent par **la même file que les commandes LED**, avec le même verrou, le même backoff et le même rejeu. La file porte donc un `kind` (`led` ou `thresholds`) et une charge utile JSON plutôt qu'une colonne `led`. Un `PUT` est sa propre confirmation : il passe directement à `acked` sur un 200, là où une commande LED reste `sent` jusqu'à ce que le boîtier réponde. Le conflit se règle par `kind` : enregistrer de nouveaux seuils annule les seuils en attente, sans toucher à une commande LED qui attend elle aussi.

La migration vers cette file généralisée est gardée par `PRAGMA user_version` : sans cela, le `DROP` tournerait à chaque démarrage. Une commande encore en attente est perdue à la mise à jour, ce qui coûte un appui sur un bouton.

### Notifications

Deux déclencheurs, en notifications locales (`expo-notifications`) : un événement `alert` reçu du backend, et un boîtier `offline` depuis plus de 3 minutes.

**Icônes.** Android dessine la petite icône de notification comme une silhouette d'une seule couleur : l'illustration de l'app y deviendrait un carré blanc. Les notifications portent donc une citrouille blanche (`notification-icon.png`), teintée en orange `#fe7f30` ; l'icône de l'app est l'illustration du potager (`icon.png`, 1024 × 1024 sans transparence, comme l'exige iOS), et l'icône thématique d'Android 13 reprend la citrouille. Ces icônes sont compilées dans le build : un rechargement Metro ne suffit pas, il faut réinstaller un build de développement.

**Une notification par événement, jamais par mesure.** L'app notifie sur la trame `alert`, que le backend n'envoie qu'une fois par dépassement, après `holdMinutes`. Le boîtier silencieux n'est signalé qu'une fois par période de silence (repérée par son `lastSeen`), et seulement quand le socket est ouvert : socket fermé, le statut affiché vient du cache, et le silence peut être le nôtre plutôt que celui du boîtier. Le retour à la normale n'est pas notifié ; il apparaît dans l'app et dans le Journal.

**La permission au bon moment.** Elle n'est jamais demandée au lancement, seulement quand l'utilisateur active les alertes dans Réglages, sous une phrase qui dit pourquoi. Un refus ne casse rien : l'interrupteur reste éteint et les alertes restent visibles dans l'app et dans le Journal.

**Limite assumée : pas d'alerte app fermée.** Le socket est fermé en arrière-plan, donc l'app n'apprend rien tant qu'elle n'est pas au premier plan. C'est le push distant du jour 6, envoyé par le backend, qui lèvera cette limite.

**Expo Go sur Android.** Depuis le SDK 53, le simple import d'`expo-notifications` y lève une erreur : un fichier à effet de bord enregistre un écouteur de jeton push au chargement. Le module est donc chargé à la demande, et l'interrupteur est désactivé dans Expo Go sur Android ; les notifications se testent avec le build de développement (`eas build --profile development`).

### Backoff et jitter

WebSocket **et** file partagent le même calcul : 1 s, 2 s, 4 s… plafonné à 30 s, ±30 % de hasard, compteur remis à zéro au premier succès. Le plafond évite de réveiller la radio soixante fois par minute dans un tunnel ; le hasard évite que les huit téléphones de la salle ne se reconnectent à la même seconde après un redémarrage du backend.

Quand NetInfo annonce le retour du réseau, le délai en cours est abandonné et la tentative est immédiate, pour le socket comme pour la file. En arrière-plan, rien : ni socket, ni vidage de file.

### Le Journal

Il mélange trois sources : les événements du backend (`GET /devices/:id/events`, mis en cache et dédoublonnés sur `eventId`), la file de commandes locale, et les passages en ligne / hors ligne de l'app elle-même.

Ces derniers sont enregistrés localement (table `connection_log`, 50 lignes) parce que le backend ne peut pas voir le téléphone se couper : seul le capteur a ses propres événements `status`. Seul un changement d'état est noté — une connexion qui hésite donne une ligne « Hors ligne », pas une par tentative — et la mise en arrière-plan n'en est pas un, puisque le socket y est fermé volontairement.

Les types `command` et `command_status` du backend ne sont **pas** affichés : la file locale raconte la même commande en mieux — elle connaît le nombre de tentatives, et elle existe hors ligne, quand le backend n'a encore rien vu. Les afficher tous les deux listerait chaque commande en double. Une commande partie en plusieurs fois est marquée « rejouée ».

Les événements n'arrivent jamais par le socket directement : une trame `alert`, `alert_cleared` ou `device_status` signale seulement qu'il s'est passé quelque chose, et déclenche un rattrapage REST depuis le dernier `ts` connu. Le backend reste ainsi la seule source des événements, avec son `eventId` comme clé — les trames du socket n'en ont pas, et il faudrait les dédoublonner à la main.

### Données datées et distinguées

Hors ligne, la bannière date la dernière mesure (« Hors ligne · dernières données à 14h02 ») et la carte passe de « Mesure à » à « Dernière mesure à ». Le statut du capteur ne s'affiche jamais en vert tant que le socket est fermé : ce qui vient du cache est annoncé comme « Dernier état connu », parce qu'un point vert ressorti de la veille est un mensonge. Les courbes sont atténuées quand elles viennent du cache ; l'atténuation porte sur les graphiques et non sur leurs libellés, le plancher de contraste de 4,5:1 s'appliquant au texte.

## Contribution

| Membre | Couche | Branches |
| --- | --- | --- |
| Adrien Verwaerde | App (tableau de bord, historique, cycle de vie du WebSocket, bannière réseau, cache local) | `frontend`, `frontend_graph`, `frontend_local-cache` |
| Samantha | Backend (MQTT, stockage, historique, seuils, commandes, WebSocket, journal, mode hors ligne) | `backend`, `backend_offline_mode` |

**Rotation du TP5** — chacun sécurise une couche qu'il n'a pas écrite :

| Membre | Couche sécurisée | Branches |
| --- | --- | --- |
| Adrien Verwaerde | Backend (JWT, limites de débit, CORS) et broker (identifiants, ACL, anonyme coupé) | `backend_cybersécurité` |
| Samantha | App (`expo-secure-store`, config EAS, WSS) et firmware (`setCACert`, NTP) | _à compléter_ |
