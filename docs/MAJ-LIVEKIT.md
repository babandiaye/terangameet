# Mise à jour LiveKit — 1.9.11 → 1.13.5

_Effectuée le 22 août 2026._

| | Avant | Après |
|---|---|---|
| livekit-server | 1.9.11 (image du 15/01) | **1.13.5** (31/07) |
| egress | 1.12.0 | **1.14.1** (14/08) |
| politique de redémarrage `livekit` | aucune | **`always`** |

`compose.yaml` pointait sur `:latest` pour les deux : un `up -d` amenait la version du
jour, sans qu'on la choisisse. Les deux services sont désormais épinglés.

Sauvegarde du compose d'origine : `/opt/meet/compose.yaml.bak-1.9.11-20260822`

## Pourquoi ces deux versions

`v1.13.5` était la dernière du serveur. `v1.14.1` est la dernière d'egress : plus récente
que le serveur, et bâtie sur la même génération de protocole (`v1.50.x` des deux côtés).
C'est le seul critère d'appariement fiable, egress ne publiant pas de journal des versions.

## Vérifications faites avant le basculement

- **La rupture de 1.13.0 ne s'appliquait pas.** 1.12.0 a modifié l'authentification TURN
  et les permissions de relais, 1.13.0 en a supprimé la rétrocompatibilité. Notre
  `livekit-server.yaml` n'a aucune section `turn:` : le TURN embarqué n'est pas activé.
- **La configuration passait telle quelle.** 1.13.5 lancé dans un conteneur jetable, sur
  le réseau `meet_default`, avec le fichier de production monté en lecture seule :
  démarrage complet, aucun champ rejeté. C'était le vrai risque d'un saut de douze versions.
- Images pré-téléchargées, pour limiter la coupure à la recréation.
- Aucune tâche cron ni service ne déclenchait un `up -d` involontaire.

## Déroulé

```bash
cd /opt/meet && sudo docker compose up -d livekit egress
```

Seuls les deux services concernés ont été recréés ; postgres, redis et les conteneurs
`lasuite/*` n'ont pas bougé. Démarrage propre des deux, aucune erreur au journal.

## Ce qui a été appris : la salle fantôme insupprimable

Une salle traînait depuis le 29 juillet avec un participant que LiveKit croyait actif
(24 jours). Le redémarrage ne l'a pas nettoyée — LiveKit restaure l'état des salles
depuis Redis, que nous n'avions pas redémarré.

`deleteRoom()` a échoué :

```
API RoomService.DeleteRoom  status=500  error="could not find object"
```

**Cause.** L'identifiant de nœud change à chaque redémarrage. `room_node_map` associait
la salle à `ND_ZdCAcqp7ea95`, mort depuis plusieurs redémarrages ; LiveKit route la
suppression vers le nœud propriétaire, ne le trouve pas, et abandonne. L'index la listait,
l'API ne pouvait pas y toucher.

**Traitement.** Retrait des quatre entrées orphelines dans Redis, après sauvegarde :

```
HDEL rooms <room> · HDEL room_internal <room> · HDEL room_node_map <room>
DEL room_participants:<room>
```

Sans danger : elles désignaient un nœud inexistant, le nœud vivant ne les possédait pas.

**Côté base.** Aucun `room_finished` n'ayant été émis, la session a été close à la main.
`endedAt` a été fixé à la **dernière trace d'activité** (`updatedAt`, l'instant du dernier
webhook reçu), et non à l'heure courante : clore « maintenant » aurait ajouté 24 jours au
cumul de visioconférence du tableau de bord. Durée retenue : 1289 s, soit les 21 minutes
réellement observées.

**Ce cas se reproduira** au prochain redémarrage avec des salles ouvertes. Deux parades,
complémentaires et non encore faites : une tâche qui clôt les sessions sans activité
depuis N heures, et une réconciliation du tableau de bord avec `listRooms()` plutôt
qu'avec `endedAt` seul.

## Retour arrière

Les empreintes d'origine, `:latest` ne les désignant plus :

```
livekit-server  sha256:289262ffae8b827f45186331aa315d08ed275eb30f9b0add337ec57948e44ca1
egress          sha256:30b3389518c851e6c20e964bba9d5ce89d0bd09b8b0fe0d0d36c9546303c8430
```

Ces images restent locales tant qu'aucun `docker image prune` n'est passé.

```bash
sudo cp /opt/meet/compose.yaml.bak-1.9.11-20260822 /opt/meet/compose.yaml
cd /opt/meet && sudo docker compose up -d livekit egress
```

## Reste à faire

- **Une vraie réunion sur 1.13.5**, avec enregistrement, pour valider egress 1.14.1 de
  bout en bout, et un webhook reçu — visible dans **État des services**.
- **`restart: always` sur `postgresql` et `redis`**, qui n'en ont toujours aucune.
  Aujourd'hui un redémarrage de la machine laisse la plateforme à terre : `backend` et
  `egress` reviennent, mais tournent à vide. `frontend` peut rester tel quel, le SPA
  étant servi par le backend Node.
