# TerangaMeet v2 — Analyse du projet

_État au 7 juin 2026. Déployé sur `https://meet.example.com` (domaine à adapter)._

## 1. Vue d'ensemble

Réécriture fullstack **Node.js + React** du projet Meet (La Suite Numérique) pour l'UN-CHK,
en monorepo **pnpm sans conteneurs**. Un backend Express unique sert à la fois le SPA et l'API
REST, et s'appuie sur le serveur média **LiveKit** existant.

- **Frontend** : React/Vite de Meet réutilisé tel quel (même design), rebrandé « Teranga Meet ».
- **Backend** : Express + TypeScript + Prisma (PostgreSQL), réécriture du backend Django.
- **Auth** : OIDC Keycloak (realm et client applicatif dédiés, PKCE).
- **Média** : LiveKit (ex. `livekit.example.com`) via `livekit-server-sdk`.
- **Données** : Postgres + Redis (réutilisés des conteneurs `meet-*`).
- **Prod** : service systemd `terangameetv2-backend` + vhost nginx TLS (certificat wildcard).

## 2. Périmètre fonctionnel implémenté

| Domaine | État | Détail |
|---|---|---|
| Config frontend (`/config/`) | ✅ | feature flags, LiveKit, recording, telephony… |
| Auth OIDC (login/callback/logout/silent) | ✅ | sessions Redis, PKCE, upsert utilisateur |
| Utilisateurs (`/users/me`, prefs) | ✅ | sérialisation ApiUser, MAJ langue/timezone |
| Salles (créer/rejoindre, CRUD) | ✅ | tokens LiveKit, rôles OWNER/ADMIN/MEMBER |
| Niveaux d'accès public/trusted/restricted | ✅ | contrôle d'accès + token selon rôle |
| Lobby / salle d'attente | ✅ | Redis, polling, notif `participantWaiting` |
| Modération (mute/remove/rename/raise-hand/permissions) | ✅ | via RoomServiceClient |
| Webhooks LiveKit | ✅ | signature vérifiée, MAJ statut enregistrement |
| Enregistrement (start/stop, CRUD) | ⚠️ | code complet, **non testé** (S3/egress requis) |
| Fichiers (fonds d'écran, presigned S3) | ⚠️ | code complet, **non testé** (S3 requis) |
| Sous-titres (start-subtitle) | ⚠️ | déclenche la notif ; dépend d'un agent LiveKit |
| Téléphonie SIP | ❌ | non implémenté |
| API externe / applications / addons | ❌ | non implémenté |
| Gestion des partages (`resource-accesses`) | ❌ | modèle présent, endpoints non exposés |
| E-mails (invitations, lien d'enregistrement) | ❌ | non implémenté |
| Marketing (Brevo) | ❌ | volontairement écarté |

## 3. Points forts

1. **Mono-application cohérente** : un seul process Node sert SPA + API sur un même origine →
   pas de CORS, cookies/CSRF simples, déploiement et reverse-proxy triviaux.
2. **Design préservé à 100 %** : réutilisation du frontend Meet (pas de dette de re-design),
   tout en isolant le branding (logo, slides, favicons) dans `public/assets`.
3. **TypeScript de bout en bout côté backend** + Prisma (schéma typé, migrations versionnées).
4. **Contrat d'API fidèle** au frontend Meet : endpoints, payloads et formats respectés
   (vérifiés contre le code source du frontend).
5. **Sécurité de base correcte** : sessions httpOnly en Redis, CSRF double-submit, helmet,
   vérification de signature des webhooks et des tokens LiveKit, TLS + HSTS-ready.
6. **Sans conteneurs, opérable** : systemd (auto-restart, démarrage au boot), build reproductible
   (`pnpm build` → `dist/` frontend + bundle backend), vhost nginx versionné.
7. **Évolutif horizontalement par construction** : état en Redis/Postgres (pas d'état en mémoire),
   donc plusieurs instances backend possibles derrière le proxy.

## 4. Axes d'amélioration

### Sécurité
- **Secrets en clair** dans `apps/backend/.env.production` (secret OIDC, mot de passe DB, secret
  LiveKit). À déplacer vers un coffre (sops, Vault, ou `systemd` credentials) et permissions 600.
- **CSP désactivée** (`helmet` contentSecurityPolicy:false). Définir une politique adaptée à
  LiveKit/WS pour durcir contre le XSS.
- **Pas de rate-limiting** : Django avait des throttles (request-entry, creation-callback…).
  Ajouter `express-rate-limit` sur les endpoints publics (auth, request-entry, webhooks).
- **Salles non enregistrées** : quand activées, tout participant est `is_administrable=true`
  (modération ouverte). Acceptable pour des salles ouvertes mais à documenter ; en prod
  `ALLOW_UNREGISTERED_ROOMS=false`.
- **En-têtes de sécurité nginx** : réintroduire HSTS, X-Content-Type-Options, Referrer-Policy
  (présents sur l'ancien Meet, absents du nouveau vhost).

### Robustesse / exploitation
- **IP des conteneurs DB/Redis figées** (adresses du bridge docker) dans la config : se cassent
  si les conteneurs sont recréés. Solutions : publier les ports sur l'hôte, fixer des IP/alias
  réseau, ou exécuter le backend dans le réseau `meet_default`.
- **Aucun test automatisé** : ni unitaire ni e2e. Risque de régression élevé sur une API de cette
  taille. Prioriser des tests d'intégration sur auth, salles/tokens, lobby, modération.
- **Observabilité minimale** : logger maison + morgan. Ajouter logs structurés (pino), métriques
  (prom-client) et idéalement Sentry (présent dans Meet).
- **Healthcheck superficiel** (`/healthz` statique). Ajouter une vérif DB/Redis/LiveKit.
- **Gestion d'erreurs** : pas de middleware d'erreur global ; certaines erreurs async non
  capturées renverraient une 500 générique.

### Parité fonctionnelle (par rapport au Meet d'origine)
- **Enregistrement / fichiers / sous-titres** : codés mais **non validés** faute de S3 (MinIO) et
  d'agents LiveKit configurés. À tester end-to-end avant d'activer les flags.
- **Téléphonie SIP, API externe, addons, partage de salles (resource-accesses), e-mails
  d'invitation** : non implémentés. À planifier selon les besoins réels.
- **i18n backend** : les e-mails/notifications multilingues de Meet ne sont pas repris.

### Qualité du code / CI-CD
- **Pas de pipeline CI** (lint, typecheck, build, tests, déploiement). À mettre en place.
- **Pas de lint configuré côté backend** (ESLint présent côté frontend uniquement).
- **Migrations en prod** : utiliser `prisma migrate deploy` dans le process de déploiement (pas
  `migrate dev`).
- **Versionnement** : initialiser proprement le dépôt git (commits, branches, tags de version).

### Scalabilité / performance
- Le backend sert les fichiers statiques via Express ; en forte charge, déléguer le statique à
  nginx (root sur `dist/`) soulagerait Node.
- Prévoir un **pool de connexions** Prisma dimensionné et un Redis dédié (actuellement db 5 du
  Redis partagé avec Meet).

## 5. Recommandations priorisées

**Quick wins (jours)**
1. Réintroduire les en-têtes de sécurité nginx (HSTS, nosniff, Referrer-Policy).
2. Restreindre les permissions et sortir les secrets des fichiers `.env` (600 + coffre).
3. Ajouter `express-rate-limit` sur auth / request-entry / webhooks.
4. Middleware d'erreur global + healthcheck DB/Redis.
5. Stabiliser l'accès DB/Redis (ports publiés ou réseau docker partagé).

**Moyen terme (semaines)**
6. Tests d'intégration (auth, salles, lobby, modération) + CI (lint/typecheck/build/test).
7. Valider end-to-end enregistrement + fichiers (MinIO) et sous-titres (agent LiveKit).
8. Observabilité : pino + métriques + Sentry.
9. Exposer `resource-accesses` (gestion des rôles/partage de salles) + e-mails d'invitation.

**Long terme**
10. Implémenter la téléphonie SIP et l'API externe si requis par les usages.
11. Conteneuriser proprement (ou packager en service géré) pour reproductibilité et scaling.
