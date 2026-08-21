# TerangaMeet v2

Visioconférence de l'Université Numérique Cheikh Hamidou Kane (UN-CHK), réécrite en
**Node.js + React** dans un monorepo **pnpm** unique (sans conteneurs), sur la base du
projet [Meet](https://github.com/suitenumerique/meet) de La Suite Numérique.

- **Frontend** : le frontend React/Vite de Meet (même design), rebrandé « Teranga Meet ».
- **Backend** : API Express + TypeScript + Prisma (PostgreSQL), réécriture du backend
  Django d'origine — auth OIDC (Keycloak), salles, tokens LiveKit, lobby,
  modération, enregistrement, fichiers, sous-titres, webhooks.
- **Média** : serveur LiveKit existant (non modifié), atteint via `livekit-server-sdk`.

## Architecture

```
/opt/terangameetv2
├── apps/
│   ├── frontend/   # React + Vite (design Meet), proxy /api → backend en dev
│   └── backend/    # Express + TS + Prisma ; sert aussi le SPA en production
├── pnpm-workspace.yaml   # nodeLinker: hoisted (compat frontend npm)
└── package.json          # scripts dev/build/start
```

Le frontend appelle son **propre origine** (`/api/v1.0/...`) ; en dev, Vite proxifie
`/api`, `/oidc`, `/media` vers le backend (port 4000). En production, le backend sert
le SPA construit et l'API sur le même origine (`SERVE_FRONTEND=true`).

## Prérequis

- Node.js ≥ 22, pnpm (installés en global dans `/usr/bin`)
- PostgreSQL et Redis accessibles (ici réutilisés depuis les conteneurs `meet-*`)
- Un serveur LiveKit (ex. `livekit.example.com`)

## Configuration

Copier l'exemple et ajuster :

```bash
cp apps/backend/.env.example apps/backend/.env
```

Variables clés (voir `.env.example`) : `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`,
OIDC (`KEYCLOAK_HOST`, `REALM_NAME`, `OIDC_RP_CLIENT_ID`, `OIDC_RP_CLIENT_SECRET`),
LiveKit (`LIVEKIT_API_KEY/SECRET/URL/WS_URL`), et les flags `RECORDING_ENABLE`,
`FILE_UPLOAD_ENABLED`, `ROOM_SUBTITLE_ENABLED`, `ROOM_TELEPHONY_ENABLED`.

## Installation

```bash
pnpm install
pnpm --filter @terangameet/backend exec prisma migrate deploy   # ou: prisma migrate dev
```

## Développement

```bash
pnpm dev            # lance backend (:4000) + frontend (:3000) en parallèle
# ou séparément :
pnpm dev:backend
pnpm dev:frontend
```

Ouvrir http://localhost:3000.

## Production

```bash
pnpm build                       # build frontend (dist/) puis backend (dist/)
SERVE_FRONTEND=true NODE_ENV=production pnpm start
```

Le backend écoute sur `$PORT` (4000 par défaut) et sert le SPA + l'API. Placer un
reverse-proxy TLS (nginx) devant, et faire pointer le webhook LiveKit vers
`/api/v1.0/rooms/webhooks-livekit/`.

## Contrat d'API (principaux endpoints)

`/api/v1.0/` : `config/`, `authenticate/`, `logout`, `users/me`, `users/:id`,
`rooms/` (POST), `rooms/:id` (GET/PATCH/DELETE), `rooms/:id/{request-entry,enter,
waiting-participants,toggle-hand,rename,mute-participant,remove-participant,
update-participant,start-recording,stop-recording,start-subtitle}/`,
`rooms/webhooks-livekit/`, `recordings/`, `files/`. OIDC callback : `/oidc/callback/`.
