#!/usr/bin/env bash
# Déploiement de TerangaMeet sans casser les onglets ouverts.
#
# `pnpm build` vide apps/frontend/dist avant d'y écrire : pendant et après le
# build, un navigateur ouvert sur l'ancienne version réclame des fichiers
# (Home-xxxx.js…) qui n'existent plus, et affiche une page blanche.
#
# Ici le frontend est construit à part, puis publié en deux temps :
#   1. les nouveaux fichiers sont AJOUTÉS à dist/ — les anciens restent ;
#   2. index.html est remplacé en dernier, d'un bloc (mv atomique).
# Un onglet ancien trouve donc toujours ses fichiers, et un nouveau visiteur
# ne voit jamais un index.html pointant vers des fichiers pas encore copiés.
# Les fichiers de plus de 7 jours qui ne font pas partie du build courant sont
# supprimés : aucune session ne dure aussi longtemps (jeton LiveKit : 6 h).
#
# Avant tout build, le code est vérifié : types, tests unitaires et tests
# d'intégration (sur la base terangemeetv2_test, jamais la production), lint du
# frontend. Un échec arrête le déploiement : la version en service ne change pas.
#
# Usage : deploy/deploy.sh            (vérifications + build + publication + redémarrage)
#         deploy/deploy.sh --no-restart
#         deploy/deploy.sh --skip-checks   (urgence uniquement : sans vérifications)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONT="$ROOT/apps/frontend"
DIST="$FRONT/dist"
SERVICE="terangameetv2-backend"
HEALTH_URL="http://127.0.0.1:4000/readyz"
KEEP_DAYS=7

restart=true
checks=true
for arg in "$@"; do
  case "$arg" in
    --no-restart) restart=false ;;
    --skip-checks) checks=false ;;
    *) echo "Option inconnue : $arg" >&2; exit 2 ;;
  esac
done

# Un seul déploiement à la fois : deux builds simultanés se marcheraient dessus.
exec 9>/tmp/terangameetv2-deploy.lock
flock -n 9 || { echo "Un déploiement est déjà en cours." >&2; exit 1; }

stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }

if $checks; then
  step "Vérifications : types du backend et de ses tests"
  pnpm --filter @terangameet/backend run typecheck
  step "Vérifications : tests unitaires"
  pnpm --filter @terangameet/backend run test
  if [[ -f "$ROOT/apps/backend/.env.test" ]]; then
    step "Vérifications : tests d'intégration (base terangemeetv2_test)"
    pnpm --filter @terangameet/backend run test:integration
  else
    echo "Tests d'intégration ignorés : apps/backend/.env.test absent." >&2
  fi
else
  echo "ATTENTION : vérifications sautées (--skip-checks)." >&2
fi

step "Frontend : génération des styles et vérification des types"
(cd "$FRONT" && pnpm exec panda codegen && pnpm exec tsc -b)
if $checks; then
  step "Vérifications : lint du frontend"
  (cd "$FRONT" && pnpm exec eslint src --max-warnings=0)
fi

step "Frontend : build dans un répertoire temporaire"
(cd "$FRONT" && pnpm exec vite build --outDir "$stage" --emptyOutDir)

step "Backend : build"
pnpm --filter @terangameet/backend run build

# Avant la publication et le redémarrage : le nouveau code peut lire des tables
# que seule la migration crée. `migrate deploy` n'applique que les migrations
# en attente, jamais de reset — contrairement à `migrate dev`, à ne jamais
# lancer sur la production.
step "Base de données : migrations en attente"
# Seule DATABASE_URL est lue : sourcer le fichier entier échouerait, des valeurs
# non quotées (OIDC_RP_SCOPES=openid email profile) y étant lisibles par
# systemd mais pas par le shell.
database_url="$(sed -n 's/^DATABASE_URL=//p' "$ROOT/apps/backend/.env.production" | sed 's/^"\(.*\)"$/\1/')"
(cd "$ROOT/apps/backend" && DATABASE_URL="$database_url" pnpm exec prisma migrate deploy)

step "Publication du frontend (anciens fichiers conservés)"
mkdir -p "$DIST"
# Lisible par le compte système du service (terangameet) : le répertoire
# temporaire de build est privé (700), ses droits ne doivent pas être recopiés.
chmod 755 "$DIST"
rsync -a --chmod=D755,F644 --exclude index.html "$stage"/ "$DIST"/
install -m 644 "$stage/index.html" "$DIST/.index.html.new"
mv -f "$DIST/.index.html.new" "$DIST/index.html"

step "Nettoyage des fichiers de plus de ${KEEP_DAYS} jours absents du build courant"
(cd "$DIST" && find . -type f -mtime +"$KEEP_DAYS" ! -name index.html -print) |
  while read -r f; do
    [[ -e "$stage/$f" ]] || { rm -f "$DIST/$f"; echo "supprimé : $f"; }
  done

if $restart; then
  step "Redémarrage de $SERVICE"
  sudo systemctl restart "$SERVICE"
  for _ in $(seq 1 30); do
    if curl -fs -o /dev/null "$HEALTH_URL"; then
      echo "Service opérationnel."
      exit 0
    fi
    sleep 1
  done
  echo "ÉCHEC : $SERVICE ne répond pas sur $HEALTH_URL après 30 s." >&2
  sudo systemctl status "$SERVICE" --no-pager -n 20 >&2 || true
  exit 1
fi
