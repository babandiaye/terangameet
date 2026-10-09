#!/usr/bin/env bash
# Sauvegarde nocturne de TerangaMeet : base de données + configuration.
#
# Produit, dans /var/backups/terangameetv2/<horodatage>/ :
#   terangemeetv2.dump   pg_dump au format « custom » (compressé, restaurable
#                        table par table avec pg_restore)
#   config.tar.gz        secrets et configuration nécessaires pour remonter le
#                        serveur à l'identique (.env.production, clé des jetons
#                        Google, nginx, systemd, LiveKit/Egress)
#   manifest.json        horodatage, version déployée, tailles, comptages
#   SHA256SUMS           empreintes, pour vérifier une copie
#
# La sauvegarde est VÉRIFIÉE à chaque fois : le dump est restauré dans une base
# temporaire et les tables principales y sont comptées. Une sauvegarde qu'on n'a
# jamais restaurée ne prouve rien.
#
# Le dossier est destiné à être repris par Bacula (FileSet sur
# /var/backups/terangameetv2, après 02:30). Il contient des données personnelles
# et tous les secrets de la plateforme : accès root seul (700/600), et le
# chiffrement relève de Bacula pour la copie hors du serveur.
#
# L'état de la dernière exécution est écrit dans
# /var/lib/terangameetv2/backup-status.json (sans secret), affiché dans
# Admin → État des services.
#
# Restauration : voir docs/SAUVEGARDES.md.
set -euo pipefail
umask 077

ROOT_DIR="/var/backups/terangameetv2"
STATUS_DIR="/var/lib/terangameetv2"
STATUS_FILE="$STATUS_DIR/backup-status.json"
KEEP_DAYS=14
CONTAINER="meet-postgresql-1"
DB="terangemeetv2"
DB_USER="meetv2"
CHECK_DB="terangemeetv2_restorecheck"
APP_DIR="/opt/terangameetv2"
# Tables comptées avant le dump et après la restauration de contrôle.
CHECK_TABLES=(users rooms meeting_sessions meeting_participants recordings scheduled_meetings)

started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
stamp="$(date -u +%Y-%m-%dT%H%MZ)"
dir="$ROOT_DIR/$stamp"

psql_in() { docker exec -i "$CONTAINER" psql -U "$DB_USER" -v ON_ERROR_STOP=1 -Atq "$@"; }

json_escape() { python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'; }

write_status() { # ok(true|false) message [extra-json]
  mkdir -p "$STATUS_DIR"
  chmod 755 "$STATUS_DIR"
  local msg; msg="$(printf '%s' "$2" | json_escape)"
  local tmp; tmp="$(mktemp "$STATUS_DIR/.status.XXXXXX")"
  printf '{"ok":%s,"started_at":"%s","finished_at":"%s","message":%s%s}\n' \
    "$1" "$started_at" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$msg" "${3:+,$3}" > "$tmp"
  chmod 644 "$tmp"
  mv -f "$tmp" "$STATUS_FILE"
}

cleanup_check_db() {
  psql_in -d postgres -c "DROP DATABASE IF EXISTS $CHECK_DB" >/dev/null 2>&1 || true
}

on_error() {
  local line="$1"
  cleanup_check_db
  write_status false "Échec de la sauvegarde (ligne $line du script). Voir : journalctl -u terangameetv2-backup"
  echo "ÉCHEC de la sauvegarde à la ligne $line" >&2
}
trap 'on_error $LINENO' ERR

mkdir -p "$ROOT_DIR" "$dir"
chmod 700 "$ROOT_DIR" "$dir"

count_rows() { # database
  local sql="" t
  for t in "${CHECK_TABLES[@]}"; do sql+="SELECT '$t', count(*) FROM $t UNION ALL "; done
  psql_in -d "$1" -F= -c "${sql% UNION ALL }"
}

echo "==> Comptage avant sauvegarde"
before="$(count_rows "$DB")"

echo "==> pg_dump de $DB"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB" -Fc --no-owner --no-privileges > "$dir/terangemeetv2.dump"
test -s "$dir/terangemeetv2.dump"

echo "==> Archive de la configuration"
config_files=(
  opt/terangameetv2/apps/backend/.env.production
  opt/terangameetv2/apps/backend/.secrets.generated
  etc/nginx/sites-available/terangameetv2.conf
  etc/systemd/system/terangameetv2-backend.service
  etc/systemd/system/terangameetv2-backup.service
  etc/systemd/system/terangameetv2-backup.timer
  opt/meet/livekit-server.yaml
  opt/meet/egress.yaml
  opt/meet/compose.yaml
  opt/meet/env.d
)
present=()
for f in "${config_files[@]}"; do [[ -e "/$f" ]] && present+=("$f"); done
tar -czf "$dir/config.tar.gz" -C / "${present[@]}"

echo "==> Restauration de contrôle dans $CHECK_DB"
cleanup_check_db
psql_in -d postgres -c "CREATE DATABASE $CHECK_DB" >/dev/null
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$CHECK_DB" --no-owner --no-privileges --exit-on-error < "$dir/terangemeetv2.dump"
after="$(count_rows "$CHECK_DB")"
cleanup_check_db

# La base vit pendant la sauvegarde : les comptes restaurés doivent valoir au
# moins ceux relevés juste avant le dump (les tables ne font que grossir, la
# purge mise à part), et la base ne doit pas être vide.
counts_json=""
while IFS='=' read -r table n_before; do
  n_after="$(printf '%s\n' "$after" | awk -F= -v t="$table" '$1==t {print $2}')"
  if [[ -z "$n_after" ]]; then
    echo "Table $table absente de la restauration" >&2; false
  fi
  if (( n_after + 50 < n_before )); then
    echo "Table $table : $n_after lignes restaurées pour $n_before attendues" >&2; false
  fi
  counts_json+="\"$table\":$n_after,"
done <<< "$before"
(( $(printf '%s\n' "$after" | awk -F= '$1=="users" {print $2}') > 0 ))

echo "==> Empreintes et manifeste"
version="$(git -c safe.directory="$APP_DIR" -C "$APP_DIR" describe --tags --always 2>/dev/null || echo inconnue)"
dump_bytes="$(stat -c %s "$dir/terangemeetv2.dump")"
config_bytes="$(stat -c %s "$dir/config.tar.gz")"
cat > "$dir/manifest.json" <<EOF
{
  "created_at": "$started_at",
  "database": "$DB",
  "app_version": "$version",
  "dump_bytes": $dump_bytes,
  "config_bytes": $config_bytes,
  "restore_check": "ok",
  "row_counts": {${counts_json%,}}
}
EOF
(cd "$dir" && sha256sum terangemeetv2.dump config.tar.gz manifest.json > SHA256SUMS)
chmod 600 "$dir"/*

echo "==> Rotation : suppression des sauvegardes de plus de $KEEP_DAYS jours"
find "$ROOT_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +"$KEEP_DAYS" -print -exec rm -rf {} +

total_bytes=$(( dump_bytes + config_bytes ))
write_status true "Sauvegarde vérifiée par restauration" \
  "\"path\":\"$dir\",\"size_bytes\":$total_bytes,\"app_version\":\"$version\",\"row_counts\":{${counts_json%,}}"
echo "Sauvegarde terminée : $dir ($total_bytes octets)"
