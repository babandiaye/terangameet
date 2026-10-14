# TerangaMeet v2

[![CI](https://github.com/babandiaye/terangameet/actions/workflows/ci.yml/badge.svg)](https://github.com/babandiaye/terangameet/actions/workflows/ci.yml)

Visioconférence de l'Université Numérique Cheikh Hamidou Kane (UN-CHK), réécrite en
**Node.js + React** dans un monorepo **pnpm** unique (sans conteneurs), sur la base du
projet [Meet](https://github.com/suitenumerique/meet) de La Suite Numérique.

- **Frontend** : le frontend React/Vite de Meet (même design), rebrandé « Teranga Meet », en français uniquement.
- **Backend** : API Express + TypeScript + Prisma (PostgreSQL), réécriture du backend
  Django d'origine — auth OIDC (Keycloak), salles, tokens LiveKit, lobby,
  modération, enregistrement, fichiers, sous-titres, webhooks.
- **Média** : serveur LiveKit existant (non modifié), atteint via `livekit-server-sdk`.

Version actuelle : **2.2.2** — en service sur https://terangameet.unchk.sn.

## Fonctionnalités propres à l'UN-CHK

En plus du périmètre de Meet :

- **Agenda** (Mon espace, activé par un administrateur) : planifier une
  réunion à une date — titre, horaires, salle, type d'accès, invités,
  co-animateurs —, aussi depuis le menu « Créer une réunion ». Chaque invité
  reçoit une invitation d'agenda (.ics, organisateur « Nom via TerangaMeet »)
  que Gmail ajoute à son Google Agenda avec le lien (Oui / Non / Peut-être) ;
  le créateur la reçoit déjà acceptée. Le mail est signé du nom de la
  personne qui invite et « Répondre » lui écrit directement. Une modification n'écrit à tous que si
  la date ou l'heure change ; l'annulation retire l'événement des agendas.
  Au-delà de 20 invités, l'envoi se poursuit en arrière-plan ; une création
  rejouée (clé d'idempotence) ne crée pas de doublon.
- **Google Agenda relié** (optionnel) : chaque utilisateur peut relier son
  Google Agenda ; ses réunions y sont créées directement, Google envoie les
  invitations et les réponses remontent dans TerangaMeet. Nécessite un client
  OAuth « Interne » (variables `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`).
- **Salles de réunion** (Mon espace) : les salles qu'on organise, avec titre,
  type d'accès et **participants prévus** (on tape un nom, la plateforme
  suggère ses membres comme Google Agenda, un clic ajoute ; une adresse d'une
  personne pas encore inscrite est acceptée). Co-organisateurs permanents,
  invitation groupée par email. Les invités d'une réunion programmée rejoignent
  la liste ; une réunion ne retire que ceux qu'elle y a ajoutés. Les
  administrateurs éditent toutes les salles et sont seuls à pouvoir en
  supprimer.
- **Nom de réunion** : à la création, un titre facultatif (« Commission des
  marchés – ouverture des plis ») ; le lien reste un code aléatoire
  (`ryf-lqxd-dtu`). Le titre s'affiche en bas à gauche de la barre de réunion
  avec l'heure, dans le panneau Informations, dans les invitations et
  l'historique. Le propriétaire peut le renommer en cours de réunion ; tous les
  participants voient le changement immédiatement.
- **Modération** : co-animateurs promus pour la durée de la séance, fin de la
  réunion pour tout le monde, restriction micro / caméra / partage d'écran.
- **Enregistrements** : stockés dans le bucket MinIO privé
  `terangameetv2-recordings`, lus sur place ou téléchargés via le backend.
  Visibles par : la personne qui l'a lancé, les présents à la séance, le
  propriétaire et les co-organisateurs de la salle (tous, même absents), les
  participants prévus (ceux faits depuis leur ajout ; une personne retirée
  garde ceux de sa période d'inscription) et les administrateurs ; jamais les
  invités sans compte. Purge automatique
  configurable (1 mois à 1 an) — **désactivée en production pour le moment**
  (`PURGE_RECORDINGS_ENABLED=false`) ; la durée choisie est gardée en base.
- **Invitations par email** (SMTP) depuis la fenêtre de partage, réservées à
  l'organisateur et aux co-organisateurs ; 500 destinataires par jour et par
  compte (`INVITE_DAILY_RECIPIENT_QUOTA`, administrateurs exemptés).
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
├── .github/workflows/ci.yml   # CI : types, tests, lint, build, audit
├── apps/
│   ├── frontend/   # React + Vite (design Meet), proxy /api → backend en dev
│   └── backend/    # Express + TS + Prisma ; sert aussi le SPA en production
│       ├── src/                # routes/, services/, lib/ (règles pures testées)
│       ├── prisma/             # schéma et migrations
│       └── test/integration/   # tests des routes (base *_test dédiée)
├── deploy/
│   ├── deploy.sh           # déploiement en production (voir ci-dessous)
│   ├── backup/             # sauvegarde nocturne (script + timer systemd)
│   ├── monitoring/         # supervision et alertes email (script + timer)
│   ├── errors/             # pages 502 / 504 servies par nginx
│   ├── nginx/              # modèle du vhost
│   └── terangameetv2-backend.service   # unité systemd durcie
├── docs/                 # exploitation, sécurité, design system, analyses
├── pnpm-workspace.yaml   # nodeLinker: hoisted, overrides de sécurité
└── package.json          # scripts dev/build/start, pnpm figé (packageManager)
```

Le frontend appelle son **propre origine** (`/api/v1.0/...`) ; en dev, Vite proxifie
`/api`, `/oidc`, `/media` vers le backend (port 4000). En production, le backend sert
le SPA construit et l'API sur le même origine (`SERVE_FRONTEND=true`).

## Prérequis

- Node.js 22 (`.nvmrc`), pnpm 11 (`packageManager`)
- PostgreSQL 16 et Redis accessibles (ici réutilisés depuis les conteneurs
  `meet-*`, partagés avec l'ancien Meet)
- Un serveur LiveKit avec Egress (enregistrements) et un stockage S3 (MinIO)
- Un serveur SMTP (invitations, alertes)

## Configuration

Trois fichiers, jamais commités (`.gitignore`) :

| Fichier | Usage | Lu par |
|---|---|---|
| `apps/backend/.env.production` | production (600) | systemd (`EnvironmentFile`) — seul, dotenv n'est pas chargé en production |
| `apps/backend/.env` | développement — **jamais les secrets de production** | dotenv, hors production |
| `apps/backend/.env.test` | tests d'intégration (base `*_test`, Redis ≥ 10) | `test/integration/env.ts` |

```bash
cp apps/backend/.env.example apps/backend/.env   # puis ajuster
```

Variables clés (liste complète et valeurs par défaut : `src/config/env.ts`, qui
refuse de démarrer en production avec des secrets faibles) :

- **Base** : `DATABASE_URL`, `REDIS_URL`, `SESSION_SECRET`, `APP_BASE_URL`,
  `TRUST_PROXY`.
- **SENID (OIDC)** : `KEYCLOAK_HOST`, `REALM_NAME`, `OIDC_RP_CLIENT_ID`,
  `OIDC_RP_CLIENT_SECRET` ; `ADMIN_EMAILS` (administrateurs d'office).
- **LiveKit et stockage** : `LIVEKIT_API_KEY/SECRET/URL/WS_URL`,
  `AWS_S3_ENDPOINT_URL`, `AWS_RECORDING_BUCKET_NAME`.
- **Emails** : `SMTP_HOST/PORT/USER/PASSWORD/FROM`,
  `INVITE_DAILY_RECIPIENT_QUOTA` (500), `ALERT_EMAILS` (alertes de
  supervision, sinon `ADMIN_EMAILS`).
- **Fonctions** : `RECORDING_ENABLE`, `PURGE_RECORDINGS_ENABLED`,
  `PURGE_RECORDINGS_PERIOD`, `ALLOW_UNREGISTERED_ROOMS`,
  `RESOURCE_DEFAULT_ACCESS_LEVEL`, `FILE_UPLOAD_ENABLED`,
  `ROOM_SUBTITLE_ENABLED`, `ROOM_TELEPHONY_ENABLED`.
- **Google Agenda** (optionnel) : `GOOGLE_OAUTH_CLIENT_ID`,
  `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`.

## Installation

```bash
pnpm install --frozen-lockfile
pnpm --filter @terangameet/backend exec prisma migrate deploy
```

`prisma migrate dev` seulement sur une base de développement : il peut
proposer de vider la base. En production, les migrations sont appliquées par
`deploy/deploy.sh` (`migrate deploy`, jamais de reset).

## Développement

```bash
pnpm dev            # lance backend (:4000) + frontend (:3000) en parallèle
# ou séparément :
pnpm dev:backend
pnpm dev:frontend
```

Ouvrir http://localhost:3000. Le développement demande sa propre base et son
propre Redis dans `apps/backend/.env` : ne jamais pointer sur la production.

## Tests

```bash
pnpm --filter @terangameet/backend run typecheck         # types (code + tests)
pnpm --filter @terangameet/backend run test              # unitaires, sans base ni réseau
pnpm --filter @terangameet/backend run test:integration  # routes HTTP réelles (supertest)
```

Les tests d'intégration tournent sur une base **dédiée** décrite dans
`apps/backend/.env.test` (sur le serveur : `terangemeetv2_test`, rôle
`meetv2_test`, Redis n° 15). Ils refusent de démarrer si la base ne se termine
pas par `_test`. Ils couvrent les droits par route : entrée dans les salles et
salle d'attente, invitations et quota, réunions programmées, enregistrements,
console d'administration, CSRF. La CI GitHub (`.github/workflows/ci.yml`) lance
la même chaîne, plus un audit des dépendances.

## Production

Sur le serveur, déployer avec le script :

```bash
deploy/deploy.sh                 # vérifications, build, publication, redémarrage
deploy/deploy.sh --no-restart    # sans redémarrer le service
deploy/deploy.sh --skip-checks   # urgence uniquement : sans vérifications
```

Avant tout build, le script vérifie les types, lance les tests unitaires et
d'intégration et le lint du frontend ; un échec arrête le déploiement.

Il construit le frontend dans un répertoire temporaire puis **ajoute** les
nouveaux fichiers à `apps/frontend/dist` sans supprimer les anciens, et remplace
`index.html` en dernier. Un onglet ouvert avant la mise à jour retrouve donc ses
fichiers au lieu d'afficher une page blanche ; si un fichier manque malgré tout,
l'application se recharge d'elle-même (`vite:preloadError`, `src/main.tsx`). Les
fichiers de plus de 7 jours absents du build courant sont supprimés. Le script
redémarre ensuite `terangameetv2-backend` et attend qu'il réponde sur `/readyz`
(processus, base et Redis). Le service tourne sous le compte système
`terangameet`, durci ; supervision, alertes email et rattrapage LiveKit :
`docs/SUPERVISION.md`. Actions attendues de la DITSI : `docs/DITSI-SECURITE.md`.

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

## Supervision

Toutes les 5 minutes, une vérification (service, base, Redis, site public,
sauvegarde, disques, certificat TLS) envoie un **email d'alerte** quand un
état change ; le service et la sauvegarde préviennent aussi en cas d'échec.
Points de santé : `/healthz` (processus) et `/readyz` (base et Redis). Le
backend rattrape toutes les 10 minutes les événements LiveKit perdus
(enregistrements, séances). Détails : `docs/SUPERVISION.md`.

## Documentation

| Document | Contenu |
|---|---|
| `docs/SUPERVISION.md` | alertes, points de santé, service durci, rattrapage LiveKit, déploiement |
| `docs/SAUVEGARDES.md` | sauvegardes, Bacula, restauration |
| `docs/DITSI-SECURITE.md` | actions attendues de la DITSI (Redis, Postgres, sonde, Bacula, OAuth, certificat) |
| `docs/DESIGN-SYSTEM.md` | charte et jetons de l'interface |
| `docs/ANALYSE.md`, `docs/REFONTE-MON-ESPACE.md`, `docs/MAJ-LIVEKIT.md` | analyses et notes de conception |

## Sauvegardes

Chaque nuit à 02:00, la base et la configuration sont sauvegardées dans
`/var/backups/terangameetv2/` (14 jours) et vérifiées par une restauration de
contrôle. Détails, Bacula et procédures de restauration : `docs/SAUVEGARDES.md`.

## Contrat d'API (principaux endpoints)

Hors API : `GET /healthz` (vivacité), `GET /readyz` (base et Redis, 503 sinon).

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
- **Agenda** : `me/schedule/` (GET/POST, en-tête `Idempotency-Key` accepté),
  `me/schedule/:id/` (GET/PATCH/DELETE), `me/schedule/people/` ; Google Agenda :
  `me/google/` (GET/DELETE), `me/google/connect/`, `me/google/callback/` ;
  réglage `admin/settings/calendar/` (GET/PUT).
- **Mon espace** : `me/{dashboard,meetings,meetings/:id,recordings}/` ;
  salles organisées : `me/rooms/` (GET/POST), `me/rooms/:id/`,
  `me/rooms/:id/{people,invitees,invitees/:inviteeId,invite-all}/`.
- **Administration** (`isStaff`) : `admin/{dashboard,stats,users,users/:id,
  meetings,meetings/:id,recordings,rooms,status,purge,purge/run}/`.
- **Webhooks** : `rooms/webhooks-livekit/`.

## Versions

- **2.2.2** — invitations au nom de l'organisateur : expéditeur affiché
  « Nom via TerangaMeet » (adresse d'envoi inchangée, le domaine unchk.edu.sn
  refusant tout autre serveur), réponses dirigées vers la personne qui invite
  (Reply-To) ; vaut pour les réunions programmées, les invitations depuis une
  salle et « Inviter tous les participants ».
- **2.2.1** — adaptation à l'UNCHK et tableau de bord : mentions légales,
  conditions d'utilisation et déclaration d'accessibilité réécrites pour l'UNCHK
  (éditeur DITSI, contact support@unchk.edu.sn, données personnelles et renvoi
  vers la CDP) ; aide du partage d'écran renvoyant au support UNCHK ; graphiques
  du tableau de bord par jour, jour de la semaine, mois et année, chiffres de
  l'axe plus coupés ; README mis à jour.
- **2.2.0** — fiabilité et exploitation (lot court terme de l'audit) :
  39 tests d'intégration des routes sur une base dédiée et CI GitHub, le
  déploiement s'arrête si un test échoue ; supervision avec alertes email et
  `/readyz` ; service sous un compte système dédié et durci ; planification
  transactionnelle, idempotente, emails en arrière-plan ; rattrapage LiveKit,
  état « en cours d'arrêt » des enregistrements, salle d'attente atomique ;
  chargement initial du site réduit de moitié, écran de récupération après une
  erreur ; dépendances sans vulnérabilité élevée ni critique.
- **2.1.11** — correctifs de la contre-analyse : une réunion ne retire de la
  salle que les personnes qu'elle y a ajoutées (jamais un ajout manuel ni un
  co-organisateur) ; mails de mise à jour seulement si la date ou l'heure
  change, chaque destinataire décompté du quota ; réunion passée non
  annulable ; quota rendu en cas d'échec.
- **2.1.10** — fin des correctifs urgents de l'audit : `POST /rooms/` sur une
  salle existante applique la règle d'accès (plus de contournement de la salle
  d'attente) ; une personne retirée d'une salle ou d'une réunion, ou dont la
  réunion est annulée, perd l'entrée directe mais garde les enregistrements
  faits pendant son inscription (`room_invitee_periods`).
- **2.1.9** — correctifs de l'audit : invitations par email réservées aux
  organisateurs et quota quotidien de destinataires ; connexions SMTP
  réutilisées avec délais (fin des 504 à l'envoi) ; durée de conservation des
  enregistrements en base au lieu de Redis ; secrets de production retirés du
  `.env` de développement.
- **2.1.8** — enregistrements visibles par les absents : propriétaire et
  co-organisateurs voient tous ceux de leur salle ; les participants prévus,
  ceux réalisés depuis leur ajout (invités sans compte exclus).
- **2.1.7** — invitations agenda : l'organisateur ne voit plus « Impossible de
  charger l'événement » (organisateur de l'invitation = adresse TerangaMeet,
  créateur inscrit comme ayant accepté) ; plus de bouton « Itinéraire »
  (lien retiré du champ Lieu).
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
