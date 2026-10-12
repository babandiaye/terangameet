# Supervision et exploitation de TerangaMeet

_Mis en place le 12 octobre 2026 (v2.2.0)._

## Alertes par email

Toutes les 5 minutes, `terangameetv2-monitor.timer` lance
`/usr/local/sbin/terangameetv2-monitor check`, qui vérifie :

| Vérification | Échec si |
|---|---|
| Service | `http://127.0.0.1:4000/readyz` ne répond pas 200 (processus, base ou Redis) |
| Site public | `https://terangameet.unchk.sn/readyz` injoignable (nginx, TLS, réseau) |
| Sauvegarde | dernière sauvegarde en échec, ou plus vieille que 26 h |
| Disques | `/` ou `/var/backups` remplis à 90 % ou plus |
| Certificat TLS | expiration dans moins de 30 jours |

Un email part **au passage en échec** et **au retour à la normale**, pas à
chaque vérification. État courant : `/var/lib/terangameetv2/monitor-state.json`.

En plus, deux unités envoient un email dès qu'elles échouent
(`OnFailure=terangameetv2-alert@%n.service`) :

- `terangameetv2-backend` : après 5 échecs de démarrage en 5 minutes ;
- `terangameetv2-backup` : à chaque sauvegarde en échec.

**Destinataires** : `ALERT_EMAILS` (liste séparée par des virgules) dans
`apps/backend/.env.production`, sinon `ADMIN_EMAILS`. Envoi par le SMTP de la
plateforme.

```bash
sudo terangameetv2-monitor check     # vérifier à la main (affiche OK/KO)
sudo terangameetv2-monitor test      # envoyer un email de test
journalctl -u terangameetv2-monitor  # historique
```

Le script est versionné dans `deploy/monitoring/` ; après modification :

```bash
sudo install -o root -m 755 deploy/monitoring/terangameetv2-monitor /usr/local/sbin/
sudo install -o root -m 644 deploy/monitoring/*.service deploy/monitoring/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

### Sonde externe (DITSI)

Une panne du serveur entier empêche ce script de prévenir qui que ce soit. La
supervision de la DITSI (Zabbix, Uptime Kuma…) doit sonder
`https://terangameet.unchk.sn/readyz` : 200 et `{"status":"ok"}` = tout va bien,
503 = base ou Redis injoignable.

## Points de santé

- `GET /healthz` : le processus répond (vivacité).
- `GET /readyz` : le processus joint aussi PostgreSQL et Redis (délai 3 s). Utilisé
  par `deploy/deploy.sh` et la supervision.
- **Admin → État des services** : vue détaillée (LiveKit, Egress, MinIO, SMTP,
  webhook, sauvegarde).

## Service durci

`terangameetv2-backend` tourne sous le compte système **`terangameet`** (sans
shell, sans droit d'écriture sur le code), avec le durcissement systemd de
`deploy/terangameetv2-backend.service` (`ProtectSystem=strict`, `ProtectHome`,
filtrage des appels système…). Score `systemd-analyze security` : **1,5 (OK)**,
contre 9,0 auparavant (compte humain sudoer).

- `.env.production` reste en 600 : systemd le lit (root) avant de changer
  d'utilisateur.
- Le binaire Node du service est une copie appartenant à root :
  `/usr/local/lib/terangameet/node/bin/node`. `/usr/bin/node` pointe en effet vers
  la version nvm de `/home/pabn`, modifiable par un compte humain.
  **Après une mise à jour de Node** :
  ```bash
  sudo install -o root -m 755 "$(readlink -f /usr/bin/node)" /usr/local/lib/terangameet/node/bin/node
  sudo systemctl restart terangameetv2-backend
  ```
- `deploy/deploy.sh` publie le frontend en 755/644 pour que ce compte le lise.

Après modification de l'unité : `sudo install -o root -m 644
deploy/terangameetv2-backend.service /etc/systemd/system/ && sudo systemctl
daemon-reload && sudo systemctl restart terangameetv2-backend`.

## Rattrapage LiveKit

Toutes les 10 minutes, le backend compare la base avec LiveKit (verrou Redis,
une seule instance à la fois) :

- enregistrement « en cours » ou « en cours d'arrêt » dont l'egress est terminé
  ou inconnu de LiveKit → état final ;
- séance « en cours » dont la salle n'existe plus sur LiveKit → fermée à
  l'heure du dernier départ connu.

Si LiveKit est injoignable, rien n'est modifié. Journal : `[reconcile]`.

## Déploiement

`deploy/deploy.sh` vérifie avant tout build — un échec arrête le déploiement et
la version en service ne change pas :

1. types du backend et de ses tests ;
2. tests unitaires ;
3. tests d'intégration sur la base **`terangemeetv2_test`** (rôle `meetv2_test`,
   Redis n° 15, `apps/backend/.env.test`) ;
4. lint du frontend.

Il attend ensuite `/readyz`. Un seul déploiement à la fois (verrou). En urgence
seulement : `deploy/deploy.sh --skip-checks`.

La même chaîne tourne dans GitHub Actions (`.github/workflows/ci.yml`) à chaque
push sur `DEV` et `main`, plus un audit des dépendances
(`pnpm audit --prod --audit-level high`).
