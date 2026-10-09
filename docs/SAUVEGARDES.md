# Sauvegardes de TerangaMeet

_Mis en place le 9 octobre 2026 (v2.1.4). Copie hors serveur : Bacula, à brancher._

## Ce qui est sauvegardé

| Élément | Contenu | Taille |
|---|---|---|
| **Base `terangemeetv2`** | Comptes, salles et liens, participants prévus, co-organisateurs, historique des séances et présences, agenda, notes, accès aux enregistrements, comptes Google reliés (jetons chiffrés) | ~180 Ko compressé |
| **Configuration** | `apps/backend/.env.production`, `.secrets.generated` (dont `GOOGLE_TOKEN_KEY`, sans laquelle les jetons Google enregistrés sont illisibles), vhost nginx, services systemd, `/opt/meet/{livekit-server.yaml,egress.yaml,compose.yaml,env.d/}` | ~8 Ko |

**Non sauvegardé, volontairement :**
- **Enregistrements vidéo** (bucket `terangameetv2-recordings`, MinIO `10.149.2.209`, ~4,5 Go) : décision du 9 octobre 2026. Ils sont de toute façon purgés après la période de rétention.
- **Redis** : uniquement les sessions de connexion ; une perte oblige seulement à se reconnecter.
- **Le code** : sur GitHub (`babandiaye/terangameet`), chaque version taguée.
- **Le certificat TLS `*.unchk.sn`** : détenu par la DITSI.
- **La base de l'ancien Meet** (`meet`) : hors périmètre.

## Où, quand, combien de temps

- **Chaque nuit à 02:00** (± 5 min), par le timer systemd `terangameetv2-backup.timer`. Une exécution manquée (serveur éteint) est rattrapée au démarrage.
- **Dossier** : `/var/backups/terangameetv2/<AAAA-MM-JJTHHMMZ>/`, accès **root seul** (700/600) — il contient des données personnelles et tous les secrets de la plateforme :
  - `terangemeetv2.dump` — `pg_dump -Fc` (compressé, restaurable table par table)
  - `config.tar.gz` — la configuration
  - `manifest.json` — date, version déployée, tailles, nombre de lignes des tables principales
  - `SHA256SUMS` — empreintes
- **Conservation locale : 14 jours.** La conservation longue revient à Bacula.
- **Script** : `deploy/backup/terangameetv2-backup.sh` (versionné), exécuté depuis sa copie root `/usr/local/sbin/terangameetv2-backup`.

## Vérification automatique

Chaque sauvegarde est **restaurée dans une base temporaire** (`terangemeetv2_restorecheck`, supprimée aussitôt) et les tables principales y sont comptées. Si la restauration échoue ou qu'il manque des lignes, la sauvegarde est déclarée en échec.

Le résultat est visible dans **Admin → État des services → Sauvegarde de la base** :
- vert : dernière sauvegarde vérifiée de moins de 26 h ;
- rouge : dernière exécution en échec, ou aucune réussite depuis plus de 26 h ;
- gris : aucune exécution encore.

Détail d'une exécution : `journalctl -u terangameetv2-backup`. État brut : `/var/lib/terangameetv2/backup-status.json`.

Lancer une sauvegarde à la main : `sudo systemctl start terangameetv2-backup`.

## Brancher Bacula

- **FileSet** : `/var/backups/terangameetv2` (le File Daemon tourne en root et peut lire le dossier).
- **Horaire** : après **02:30**, pour prendre la sauvegarde de la nuit.
- **Chiffrement** : activer le chiffrement PKI du File Daemon (ou du volume) — les fichiers locaux ne sont pas chiffrés, ils contiennent des secrets.
- **Rétention suggérée** : 7 quotidiennes, 4 hebdomadaires, 6 mensuelles.

## Restaurer

Choisir la sauvegarde, puis vérifier son intégrité :

```bash
sudo -i
cd /var/backups/terangameetv2/2026-10-10T0200Z   # par exemple
sha256sum -c SHA256SUMS
cat manifest.json
```

### Toute la base (sinistre, ou retour arrière complet)

⚠️ Remplace toutes les données actuelles. Arrêter l'application d'abord.

```bash
systemctl stop terangameetv2-backend
docker exec meet-postgresql-1 psql -U meetv2 -d postgres -c "DROP DATABASE terangemeetv2"
docker exec meet-postgresql-1 psql -U meetv2 -d postgres -c "CREATE DATABASE terangemeetv2 OWNER meetv2"
docker exec -i meet-postgresql-1 pg_restore -U meetv2 -d terangemeetv2 --no-owner --no-privileges --exit-on-error < terangemeetv2.dump
systemctl start terangameetv2-backend
```

Puis vérifier dans Admin → État des services et sur le tableau de bord. La version
du code doit correspondre à celle du `manifest.json` (`app_version`) ou être plus
récente : les migrations Prisma ne s'appliquent qu'en avançant
(`deploy/deploy.sh`).

### Une seule table, ou des lignes supprimées par erreur

Restaurer à côté, dans une base temporaire, puis recopier ce qu'il faut :

```bash
docker exec meet-postgresql-1 psql -U meetv2 -d postgres -c "CREATE DATABASE terangemeetv2_recup"
docker exec -i meet-postgresql-1 pg_restore -U meetv2 -d terangemeetv2_recup --no-owner --no-privileges < terangemeetv2.dump
# … comparer / copier les lignes voulues avec psql …
docker exec meet-postgresql-1 psql -U meetv2 -d postgres -c "DROP DATABASE terangemeetv2_recup"
```

### La configuration

```bash
tar -tzf config.tar.gz                 # lister
tar -xzf config.tar.gz -C /tmp/recup   # extraire à côté, puis comparer avant de remplacer
```

### Remonter le serveur à neuf

1. Docker et le compose de `/opt/meet` (depuis `config.tar.gz`), conteneurs `meet-*` démarrés.
2. Node 22, pnpm ; `git clone` de `babandiaye/terangameet` dans `/opt/terangameetv2`, `git checkout` de la version du manifeste.
3. `config.tar.gz` extrait à la racine (`tar -xzf config.tar.gz -C /`) : `.env.production`, nginx, systemd.
4. Base restaurée comme ci-dessus, puis `deploy/deploy.sh`.
5. `systemctl enable --now terangameetv2-backend terangameetv2-backup.timer`, `nginx -t && systemctl reload nginx`.

## Points de sécurité relevés (9 octobre 2026)

- Clé privée `/etc/nginx/ssl/star_unchk.sn.key` : était lisible par tous (644), passée en **600**.
- Postgres partagé (`meet-postgresql-1`) : authentification **`trust`** en local et sur 127.0.0.1 — tout compte de ce serveur peut se connecter sans mot de passe, sous n'importe quel rôle. À durcir (`scram-sha-256`) avec la DITSI, l'ancien Meet utilisant le même serveur.
- Certificat `*.unchk.sn` : expire le **19 décembre 2026**.
