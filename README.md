# Trackzilla — Projet Sentinelle

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

Dans `app/.env`, `EXPO_PUBLIC_API_URL` doit pointer vers l'**IP du portable** sur le réseau partagé, pas `localhost`.

## Contrat d'API

```
GET  /devices                                   → [{ id, group, status, lastSeen }]
GET  /devices/:id/measurements?from=&to=&step=  → [{ ts, t, h }]
GET  /devices/:id/thresholds                    → { tMin, tMax, hMin, hMax, holdMinutes }
PUT  /devices/:id/thresholds                    ← même objet
POST /devices/:id/commands                      ← { "led": true } → 202 { "sent": true }

WS   measurement    { device, ts, t, h }
     alert          { device, ts, kind, value, threshold }
     alert_cleared  { device, ts, kind }
     device_status  { device, status }
```

Tous les `ts` sont en secondes epoch, UTC.

## Contribution

| Membre | Couche | Branches |
| --- | --- | --- |
| Adrien Verwaerde | App (tableau de bord, historique, cycle de vie du WebSocket) | `frontend` |
| _à compléter_ | Backend (MQTT, stockage, historique, seuils, commandes, WebSocket) | `backend` |
