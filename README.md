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
```

Tous les `ts` sont en secondes epoch, UTC.

## Contribution

| Membre | Couche | Branches |
| --- | --- | --- |
| Adrien Verwaerde | App (tableau de bord, historique, cycle de vie du WebSocket) | `frontend` |
| _à compléter_ | Backend (MQTT, stockage, historique, seuils, commandes, WebSocket) | `backend` |
