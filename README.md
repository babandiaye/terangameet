# TerangaMeet v2

Visioconférence de l'Université Numérique Cheikh Hamidou Kane (UN-CHK), réécrite en
**Node.js + React** dans un monorepo **pnpm** unique (sans conteneurs), sur la base du
projet [Meet](https://github.com/suitenumerique/meet) de La Suite Numérique.

- **Frontend** : le frontend React/Vite de Meet (même design), rebrandé « Teranga Meet », en français uniquement.
- **Backend** : API Express + TypeScript + Prisma (PostgreSQL), réécriture du backend
  Django d'origine — auth OIDC (Keycloak), salles, tokens LiveKit, lobby,
  modération, enregistrement, fichiers, sous-titres, webhooks.
- **Média** : serveur LiveKit existant (non modifié), atteint via `livekit-server-sdk`.

Version actuelle : **2.1.6** — en service sur https://terangameet.unchk.sn.

## Fonctionnalités propres à l'UN-CHK

En plus du périmètre de Meet :

- **Agenda** (Mon espace, activé par un administrateur) : planifier une
  réunion à une date — titre, horaires, salle, type d'accès, invités,
  co-animateurs —, aussi depuis le menu « Créer une réunion ». Chaque invité
  reçoit une invitation d'agenda (.ics) que Gmail ajoute à son Google Agenda
  avec le lien ; modification et annulation suivent.
- **Google Agenda relié** (optionnel) : chaque utilisateur peut relier son
  Google Agenda ; ses réunions y sont créées directement, Google envoie les
  invitations et les réponses remontent dans TerangaMeet. Nécessite un client
  OAuth « Interne » (variables `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`).
- **Salles de réunion** (Mon espace) : les salles qu'on organise, avec titre,
  type d'accès et **participants prévus** ajoutés à la Google Agenda (on tape
  un nom, la plateforme suggère ses membres, un clic ajoute ; une adresse
  d'une personne pas encore inscrite est acceptée). Co-organisateurs permanents,
  invitation groupée par email. Les administrateurs éditent toutes les salles
  et sont seuls à pouvoir en supprimer.
- **Nom de réunion** : à la création, un titre facultatif (« Commission des
  marchés – ouverture des plis ») ; le lien reste un code aléatoire
  (`ryf-lqxd-dtu`). Le titre s'affiche en bas à gauche de la barre de réunion
  avec l'heure, dans le panneau Informations, dans les invitations et
  l'historique. Le propriétaire peut le renommer en cours de réunion ; tous les
  participants voient le changement immédiatement.
- **Modération** : co-animateurs promus pour la durée de la séance, fin de la
  réunion pour tout le monde, restriction micro / caméra / partage d'écran.
- **Enregistrements** : stockés dans un bucket MinIO privé, lus sur place ou
  téléchargés via le backend (contrôle d'accès en base), purge automatique
  configurable (1 mois à 1 an).
- **Invitations par email** (SMTP) depuis la fenêtre de partage.
- **Notes privées** par participant, sauvegardées automatiquement, export `.txt`.
- **Tableau de bord analytique** en réunion (temps de parole, présence,
  messages, mains levées), export PDF — réservé aux animateurs.
- **Mon espace** (`/mon-espace`) : réunions suivies, durées, enregistrements.
- **Console d'administration** (`/admin`, comptes `isStaff`) : tableau de bord,
  utilisateurs, historique des réunions, salles, enregistrements, état des
  services (Postgres, Redis, LiveKit, Egress, MinIO, SMTP, webhooks), paramètres.

## Architecture

```
/opt/terangameetv2
├── apps/
│   ├── frontend/   # React + Vite (design Meet), proxy /api → backend en dev
│   └── backend/    # Express + TS + Prisma ; sert aussi le SPA en production
├── deploy/
│   ├── deploy.sh           # déploiement en production (voir ci-dessous)
│   ├── errors/             # pages 502 / 504 servies par nginx
│   ├── nginx/              # modèle du vhost
│   └── terangameetv2-backend.service   # unité systemd
├── docs/                 # analyse, design system, notes d'exploitation
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

Sur le serveur, déployer avec le script :

```bash
deploy/deploy.sh                 # build front + back, publication, redémarrage
deploy/deploy.sh --no-restart    # sans redémarrer le service
```

Il construit le frontend dans un répertoire temporaire puis **ajoute** les
nouveaux fichiers à `apps/frontend/dist` sans supprimer les anciens, et remplace
`index.html` en dernier. Un onglet ouvert avant la mise à jour retrouve donc ses
fichiers au lieu d'afficher une page blanche ; si un fichier manque malgré tout,
l'application se recharge d'elle-même (`vite:preloadError`, `src/main.tsx`). Les
fichiers de plus de 7 jours absents du build courant sont supprimés. Le script
redémarre ensuite `terangameetv2-backend` et attend qu'il réponde sur `/healthz`.

Ne pas utiliser `pnpm build` sur le serveur de production : il vide `dist/`
pendant que le site le sert.

Pendant le redémarrage (502) ou si le backend est trop lent (504), nginx affiche
les pages de `deploy/errors/`, aux couleurs de l'application ; la page 502 se
recharge seule dès que le service répond. Les erreurs renvoyées par l'API
elle-même ne sont pas concernées (pas de `proxy_intercept_errors`).

Le backend écoute sur `127.0.0.1:$PORT` (4000 par défaut) et sert le SPA + l'API
(`SERVE_FRONTEND=true`). nginx assure le TLS devant (modèle dans
`deploy/nginx/`), et le webhook LiveKit doit pointer vers
`/api/v1.0/rooms/webhooks-livekit/`.

Hors serveur de production, un build simple reste possible :

```bash
pnpm build
SERVE_FRONTEND=true NODE_ENV=production pnpm start
```

## Accès à une salle

| Type | Connexion SenID | Entre directement | Passe par la salle d'attente |
|---|---|---|---|
| Publique | non | tout le monde (avec son nom) | — |
| Ouverte sur validation | non | propriétaire, co-organisateurs | tous les autres, participants prévus compris |
| Personnes de confiance | **obligatoire** | les personnes connectées | — |
| Restreinte | **obligatoire** | propriétaire, co-organisateurs, participants prévus | les autres comptes connectés |

Sans compte, une salle « Personnes de confiance » ou « Restreinte » renvoie
d'abord vers SenID, puis ramène sur le lien de la réunion ; le serveur refuse
aussi la salle d'attente aux invités sans compte. Règle unique, testée :
`apps/backend/src/lib/roomAccess.ts`. Les participants
prévus sont reconnus par l'email de leur compte SenID. Un code de salle
inexistant est refusé (`ALLOW_UNREGISTERED_ROOMS=false`).

## Sauvegardes

Chaque nuit à 02:00, la base et la configuration sont sauvegardées dans
`/var/backups/terangameetv2/` (14 jours) et vérifiées par une restauration de
contrôle. Détails, Bacula et procédures de restauration : `docs/SAUVEGARDES.md`.

## Contrat d'API (principaux endpoints)

Sous `/api/v1.0/` :

- **Config et auth** : `config/`, `authenticate/`, `logout`, callback OIDC
  `/oidc/callback/`.
- **Utilisateurs** : `users/me`, `users/:id`.
- **Salles** : `rooms/` (POST — `name` = titre, `slug` = lien), `rooms/:id`
  (GET/PATCH/DELETE), `rooms/:id/{request-entry,enter,waiting-participants}/`.
- **Modération** : `rooms/:id/{toggle-hand,rename,mute-participant,
  remove-participant,update-participant,promote-participant,end}/`.
- **Enregistrement** : `rooms/:id/{start-recording,stop-recording,start-subtitle}/`,
  `recordings/`, `recordings/:id`, `recordings/:id/media/`.
- **Notes et invitations** : `rooms/:id/notes/` (GET/PUT), `rooms/:id/invite/`.
- **Agenda** : `me/schedule/` (GET/POST), `me/schedule/:id/`
  (GET/PATCH/DELETE), `me/schedule/people/` ; Google Agenda :
  `me/google/` (GET/DELETE), `me/google/connect/`, `me/google/callback/` ;
  réglage `admin/settings/calendar/` (GET/PUT).
- **Mon espace** : `me/{dashboard,meetings,meetings/:id,recordings}/` ;
  salles organisées : `me/rooms/` (GET/POST), `me/rooms/:id/`,
  `me/rooms/:id/{people,invitees,invitees/:inviteeId,invite-all}/`.
- **Administration** (`isStaff`) : `admin/{dashboard,stats,users,users/:id,
  meetings,meetings/:id,recordings,rooms,status,purge,purge/run}/`.
- **Webhooks** : `rooms/webhooks-livekit/`.

## Versions

- **2.1.6** — nouveau type d'accès « Ouverte sur validation » (sans compte,
  l'animateur ou un co-animateur valide chaque entrée) ; connexion SenID
  obligatoire pour les salles « Personnes de confiance » et « Restreinte »,
  avec redirection automatique depuis le lien.
- **2.1.5** — sauvegardes nocturnes de la base et de la configuration,
  vérifiées par restauration, visibles dans l'état des services
  (`docs/SAUVEGARDES.md`) ; sonde SMTP fiabilisée.
- **2.1.4** — interface en français uniquement (catalogues en, de, nl et
  sélecteur de langue retirés).
- **2.1.3** — maintenabilité : badges de la console enfin colorés ; code
  dédoublonné et gros fichiers découpés (serveur et interface) ; plus aucune
  couleur en dur hors des jetons de la charte ; messages d'erreur du serveur
  en français ; formats d'API alignés.
- **2.1.2** — robustesse de l'interface : erreurs visibles (listes, détails,
  modération), confirmations dans l'administration des comptes, notes qui ne
  perdent plus la dernière frappe, analytique en réunion allégée, purge sans
  fichiers orphelins, salle d'attente sans demandes fantômes.
- **2.1.1** — stabilité et sécurité : une erreur asynchrone ne fait plus
  tomber le serveur ; comptes désactivés réellement bloqués (connexion,
  session, réunions LiveKit) ; session régénérée à la connexion ; accès des
  administrateurs aux enregistrements ; diffusion vidéo sans fuite de
  connexions.
- **2.1.0** — « Planifier une réunion » remplace « date ultérieure » dans le
  menu Créer (agenda activé) ; co-animateurs ; type d'accès à la création ;
  synchronisation Google Agenda par utilisateur (prête, en attente du client
  OAuth de la DITSI).
- **2.0.2** — agenda : réunions planifiées et invitations iCalendar (Gmail /
  Google Agenda, Outlook), activable par un administrateur ; prochaines
  réunions sur le tableau de bord de Mon espace.
- **2.0.1** — onglet « Salles de réunion » de Mon espace (participants prévus
  avec suggestions, co-organisateurs, invitation groupée) ; édition de toutes
  les salles et suppression réservées aux administrateurs ; règles d'accès
  unifiées (« confiance » filtre enfin les invités, codes inexistants
  refusés) ; lien de la salle dans le détail d'une séance ; migrations
  appliquées par `deploy/deploy.sh`.
- **2.0.0** — titre de réunion distinct du lien (création, renommage en direct,
  affichage façon Google Meet) ; rechargement automatique après un déploiement ;
  script `deploy/deploy.sh` ; pages d'erreur 502 / 504 personnalisées.
- **2.0** — mise en service : réécriture Node/React, modération (co-animateur,
  fin de réunion), enregistrements lus sur place, console d'administration,
  Mon espace, notes, analytique, invitations par email.
