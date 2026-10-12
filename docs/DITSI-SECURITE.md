# TerangaMeet — actions demandées à la DITSI

_Serveur `srv-terangameet`, 12 octobre 2026. Ces points touchent des services
partagés avec l'ancien Meet (conteneurs `meet-*`) ou relèvent de la DITSI ; ils
n'ont donc pas été modifiés côté TerangaMeet._

## 1. Redis sans mot de passe — priorité haute

**Constat** : `127.0.0.1:6379` répond à `PING` sans authentification. Les
sessions de connexion de TerangaMeet y sont stockées (base 5, préfixe `tmsess:`).

**Risque** : tout processus ou conteneur du serveur peut écrire une session et
se faire passer pour n'importe quel utilisateur, administrateurs compris.

**Demande** : activer `requirepass` (ou une ACL par application) sur le Redis
du compose `/opt/meet`, puis nous communiquer le mot de passe. Côté TerangaMeet
il suffira de passer `REDIS_URL=redis://:MOT_DE_PASSE@127.0.0.1:6379/5` dans
`apps/backend/.env.production` et de redémarrer le service. **L'ancien Meet doit
être reconfiguré en même temps**, sinon il perd l'accès à Redis.

## 2. PostgreSQL en `trust` — priorité haute

**Constat** : le conteneur `meet-postgresql-1` accepte les connexions locales
sans mot de passe (`trust` dans `pg_hba.conf`), pour n'importe quel rôle,
superutilisateur `meet` compris.

**Risque** : tout compte du serveur peut lire et modifier toutes les bases
(TerangaMeet et ancien Meet).

**Demande** : passer `pg_hba.conf` en `scram-sha-256` pour `127.0.0.1`, `::1` et
le réseau du bridge Docker. Les rôles `meetv2` (production) et `meetv2_test`
(tests) ont déjà un mot de passe ; vérifier que celui de l'ancien Meet est
défini avant la bascule.

## 3. Sonde de supervision externe — priorité moyenne

Sonder `https://terangameet.unchk.sn/readyz` toutes les 1 à 5 minutes depuis
la supervision de la DITSI : 200 et `{"status":"ok"}` attendus, 503 si la base
ou Redis est injoignable. Les alertes internes (voir `docs/SUPERVISION.md`) ne
couvrent pas l'arrêt complet du serveur.

## 4. Bacula — priorité moyenne

FileSet `/var/backups/terangameetv2`, planification après 02:30, chiffrement
activé (les fichiers contiennent les secrets de la plateforme). Rétention
suggérée : 7 quotidiennes, 4 hebdomadaires, 6 mensuelles. Détails :
`docs/SAUVEGARDES.md`.

## 5. Client OAuth Google — quand souhaité

Pour la synchronisation des agendas Google (phase 2) : un client OAuth
« Application Web » interne au domaine, URI de redirection
`https://terangameet.unchk.sn/api/v1.0/me/google/callback/`, portée Google
Calendar. Fournir l'ID et le secret ; l'activation se fait ensuite dans
Admin → Paramètres.

## 6. Certificat `*.unchk.sn` — avant le 19 décembre 2026

Le certificat expire le **19/12/2026**. La supervision TerangaMeet préviendra
30 jours avant. Déposer le nouveau certificat dans `/etc/nginx/ssl/`
(clé en 600) puis `nginx -t && systemctl reload nginx`.

## Pour information : déjà fait côté TerangaMeet

- Service exécuté par un compte système dédié (`terangameet`), durci
  (`systemd-analyze security` : 1,5 contre 9,0).
- Secrets de production retirés du fichier de développement ; base de test
  séparée (`terangemeetv2_test`, rôle `meetv2_test`).
- Alertes par email (service, site public, sauvegarde, disques, certificat).
- **Reste à planifier avec nous** : le renouvellement des secrets de
  production (session, LiveKit, client OIDC SENID), qui ont été lisibles par
  les comptes locaux jusqu'au 11 octobre 2026. Le secret OIDC est à régénérer
  dans Keycloak (realm SENID), la clé LiveKit dans la configuration LiveKit
  partagée.
