# Refonte de « Mon espace » — TODO

_Établi le 21 août 2026, à partir de la maquette fournie._

## Principe directeur

Chaque bloc affiché doit être adossé à une donnée réellement disponible. Un compte à
rebours vers une réunion que le système ne sait pas planifier, ou un camembert de
répartition par catégorie alors qu'aucune catégorie n'existe, produirait une interface
qui ment. La maquette est donc découpée en lots selon ce qu'il faut construire **sous**
l'écran, pas seulement dessus.

Rappel de l'existant exploitable : `MeetingSession` (une occurrence de réunion, alimentée
par les webhooks LiveKit `room_started`/`room_finished`), `MeetingParticipant` (une ligne
par participant et par session, avec première entrée et dernière sortie), `Recording`
(désormais rattaché à sa session), `Room`, `User`.

---

## Lot 0 — Fait

- [x] Boutons **Créer une réunion** (menu instantanée / pour plus tard) et **Rejoindre une
      réunion** directement dans Mon espace, par réutilisation des composants de l'accueil
      (`CreateMeetingMenu`, `JoinMeetingDialog`) — comportement identique partout.

---

## Lot 1 — Présentation, sur données déjà disponibles

Aucun changement backend. C'est le gros de l'écart visuel avec la maquette.

- [ ] **Barre supérieure** : sortir le logo de la barre latérale, ajouter à droite
      l'avatar à initiales (`PN`), le nom complet et le libellé de rôle
      (`user.is_admin` → « Administrateur »).
- [ ] **Barre latérale par sections** (`RÉUNIONS`, `ENREGISTREMENTS`, `PARAMÈTRES`) avec
      libellés en majuscules, au lieu de la liste plate actuelle.
- [ ] **Lignes de réunion** au format maquette : pastille de date (`AOÛT 20 MAR.`), plage
      horaire, titre, sous-titre (participants · salle · « Vous êtes organisateur »),
      pastille de durée, bouton d'action, menu contextuel.
- [ ] **Bouton « Rejoindre »** sur une session **en cours** (`is_active`) — la salle est
      connue, le lien est déjà constructible.
- [ ] **Lecteur inline** pour un enregistrement : `/recordings/:id/media/` diffuse déjà le
      flux, il n'y a qu'à le brancher sur un `<video>` en modale plutôt que de renvoyer
      vers la page de téléchargement.
- [ ] **Page « Paramètres du compte »** dans Mon espace, reprenant le dialogue de réglages
      existant (langue, fuseau).
- [ ] **Entrée « Centre d'aide »** vers la fonctionnalité de support déjà présente.

---

## Lot 2 — Petits ajouts backend

Faisables sans nouveau modèle de données ; tout se dérive de l'existant.

- [ ] **Cartes mensuelles avec tendance.** La maquette affiche « 24 sessions ce mois,
      +5 vs juillet » et « 47 min, -6 min vs juillet ». Le tableau de bord actuel donne
      des cumuls depuis toujours, sans comparaison. Ajouter la fenêtre mensuelle et le
      calcul d'écart — la fonction `pct()` de `routes/admin.ts` fait déjà exactement cela.
- [ ] **« Partagés avec moi ».** Enregistrements de sessions suivies mais lancées par
      quelqu'un d'autre. **La donnée existe déjà** : le champ `is_owner` est renvoyé par
      `/me/recordings/`. C'est un simple filtre — le gain le plus rapide de la liste.
- [ ] **« Mes enregistrements ».** Symétrique du précédent (`?owner=me`).
- [ ] **« Minutes par jour ».** Histogramme sur 7 jours, dérivable par agrégation des
      durées de `MeetingParticipant`. ⚠️ La **ligne d'objectif** (« Objectif 600 min ») ne
      correspond à rien : soit on la retire, soit on introduit un objectif configurable.
- [ ] **Recherche globale (⌘K).** Endpoint `GET /me/search?q=` couvrant titres de sessions
      et enregistrements accessibles. Périmètre volontairement restreint au visible.
- [ ] **« Participants ».** Pas d'annuaire dans le produit, mais on peut lister les
      personnes rencontrées en réunion (agrégat de `MeetingParticipant`). ⚠️ À valider :
      exposer à chacun la liste des gens qu'il a croisés est une décision RGPD, pas une
      décision technique.
- [ ] **Durée des enregistrements** (« 4 h 12 de contenu », « 1 h 12 » par ligne).
      Aujourd'hui non stockée. Deux options : reprendre la durée de la session liée
      (approximation immédiate, gratuite), ou lire la durée réelle renvoyée par l'egress
      à la finalisation (exact, nécessite de traiter le webhook `egress_ended`).

---

## Lot 3 — Nouvelles fonctionnalités (nouveau modèle de données)

C'est ici que se trouve l'essentiel du coût. Rien de tout cela n'existe aujourd'hui.

- [ ] **Planification de réunions.** Le socle de plusieurs blocs de la maquette :
      l'onglet « À venir », l'entrée « Programmer une réunion », la carte « PROCHAINE
      RÉUNION » avec compte à rebours, et l'icône calendrier de la barre supérieure.
      Demande un modèle `ScheduledMeeting` (titre, début, fin, salle, organisateur,
      invités), les invitations associées, et l'export ICS pour que ça vive dans les
      agendas des utilisateurs. **À traiter en premier si l'on veut ressembler à la
      maquette** : quatre blocs en dépendent.
- [ ] **Statut d'invitation** (« Invitation acceptée » dans la maquette) — dépend du point
      précédent.
- [ ] **Réunions récurrentes** — règle de récurrence, encore au-dessus.
- [ ] **Vignettes vidéo** des enregistrements. Aucune n'est produite aujourd'hui. Soit une
      capture par l'egress LiveKit, soit une extraction `ffmpeg` à la finalisation, puis
      stockage dans le bucket.
- [ ] **Corbeille.** `Recording` n'a pas de suppression douce (le modèle `File` a déjà
      `deletedAt`/`hardDeletedAt` : s'en inspirer), et il faudra articuler cela avec la
      purge automatique existante.
- [ ] **Catégorisation des réunions.** Le camembert « Réunions internes / Enseignement &
      ateliers / Partenaires externes » suppose un champ que personne ne saisit
      actuellement. Décider **qui** le renseigne et **quand** (à la création de la salle ?
      par l'organisateur en fin de séance ?) avant de dessiner le graphique.
- [ ] **Notifications** (la cloche et son badge) — modèle de notification, marquage lu/non
      lu, et surtout : quels évènements méritent d'en produire une.

---

## Lot 4 — À écarter ou à trancher

- [ ] **« VOTRE PLAN — Entreprise / Gérer l'abonnement ».** Il n'y a pas de facturation, et
      pour un déploiement universitaire interne ce bloc n'a pas d'objet. **Recommandation :
      le retirer de la maquette.**
- [ ] **« Intégrations ».** Aucune brique existante. À ne construire que si un besoin réel
      est identifié (agenda ? ENT ? Moodle ?).
- [ ] **Trois pages d'analytique distinctes** (« Tableaux de bord », « Statistiques
      détaillées », « Rapports d'utilisation »). Côté utilisateur, le volume de données
      personnelles ne justifie probablement pas trois écrans. **Recommandation : une seule
      page**, et garder la profondeur pour la console d'administration, qui l'a déjà.

---

## Ordre d'exécution proposé

1. **Lot 1** en entier : c'est ce qui rapproche le plus vite l'écran de la maquette, sans
   aucun risque backend.
2. **Lot 2**, en commençant par « Partagés avec moi » et « Mes enregistrements » (données
   déjà présentes), puis les cartes mensuelles.
3. **Décider** des points de tranche du Lot 4 avant d'aller plus loin — cela retire des
   éléments de la maquette et donc du travail.
4. **Planification** (Lot 3), qui débloque à elle seule quatre blocs.
5. Le reste du Lot 3 selon les usages constatés.

## Avertissement sur la maquette

Les chiffres qu'elle affiche (24 sessions, 18 h 40 cumulées, 12 enregistrements, quatre
réunions à venir) sont illustratifs. Sur un compte réel, la plupart des panneaux seront
vides ou très peu remplis au démarrage. Prévoir des **états vides soignés** fait partie du
travail, pas des finitions : c'est ce que la majorité des utilisateurs verra en premier.
