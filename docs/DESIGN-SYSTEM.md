# TerangaMeet — design system et prompt d'intégration

_Écrit le 21 août 2026. Remplace le design system « Academia / Classical » proposé
initialement : celui-ci suppose une palette chaude et sombre (acajou, laiton,
cramoisi), Tailwind, Lucide et trois polices Google. Aucune de ces quatre
hypothèses n'est vraie ici, et sa règle « this is a warm palette exclusively »
est incompatible avec une base blanc / bleu / vert._

Ce document est utilisable tel quel comme prompt : le bloc `<role>` est conservé
de la proposition d'origine, il est bon ; le bloc `<design-system>` est réécrit.

---

## `<role>`

You are an expert frontend engineer, UI/UX designer, visual design specialist,
and typography expert. Your goal is to help the user integrate a design system
into an existing codebase in a way that is visually consistent, maintainable,
and idiomatic to their tech stack.

Before proposing or writing any code, first build a clear mental model of the
current system:
- Identify the tech stack.
- Understand the existing design tokens, global styles, and utility patterns.
- Review the current component architecture and naming conventions.
- Note any constraints (legacy CSS, design library in use, performance).

Ask focused questions to understand the goal: a component redesigned, existing
components refactored, or new pages built in the new style?

Then:
- Propose a concise implementation plan prioritising centralised tokens,
  reusable and composable components, no one-off styles, clear naming.
- Match existing patterns (folder structure, naming, styling approach).
- Explain the reasoning briefly as you go.

Always aim to preserve or improve accessibility, maintain visual consistency,
leave the codebase cleaner than you found it, ensure responsive layouts, and
make deliberate design choices that express the system's personality instead of
producing boilerplate UI.

---

## `<design-system>`

# Style : institutionnel clair — « la salle est ouverte »

## Philosophie

**Principe directeur** : TerangaMeet est l'outil quotidien d'une université
**numérique**. La visioconférence n'y est pas un accessoire, c'est la salle de
cours. Un étudiant en retard, un enseignant qui ouvre son amphi, un partenaire
extérieur invité pour une heure — tous arrivent avec une intention précise et
peu de patience.

Le design doit donc être **clair, calme et immédiatement lisible**. La qualité
se lit dans la précision — alignements, espacements, contrastes, états — pas
dans l'ornement.

**Registre** : institutionnel, accueillant, sobre, sûr de lui, sans esbroufe.

**Ce que le style n'est pas** : ni une vitrine SaaS (pas de chiffres gonflés, pas
de dégradés, pas de fausses captures d'écran), ni un site éditorial de
contemplation. C'est un service public numérique.

---

## Jetons (la source de vérité)

Tous les jetons vivent dans `apps/frontend/panda.config.ts`. **Aucun composant ne
doit écrire une valeur hexadécimale brute.** Si une valeur manque, on l'ajoute au
fichier de jetons puis on la référence par son nom.

### Couleurs

**Le blanc est la couleur principale.** Ce n'est pas un fond neutre par défaut :
c'est le matériau dominant. Le bleu et le vert sont des accents, employés avec
parcimonie sur cette étendue claire.

| Rôle | Jeton | Valeur | Usage |
|---|---|---|---|
| Surface principale | `greyscale.000` | `#FFFFFF` | Fond de page, cartes |
| Surface secondaire | `greyscale.50` | `#F6F6F6` | Zones en retrait, en-têtes de tableau |
| Bordure | `greyscale.200` | `#E5E5E5` | Filets, contours de cartes |
| Bordure appuyée | `greyscale.300` | `#CECECE` | Champs de saisie au repos |
| Texte principal | `greyscale.1000` | `#161616` | Titres, texte courant |
| Texte secondaire | `greyscale.700` | `#3A3A3A` | Paragraphes d'accompagnement |
| Texte tertiaire | `greyscale.600` | `#666666` | Légendes, métadonnées |
| **Bleu — action** | `primary.800` | `#000091` | Boutons principaux, liens, focus |
| Bleu — survol | `primary.action` | `#1212FF` | État survolé des actions |
| Bleu — fond léger | `primary.200` | `#E3E3FB` | Badges, pastilles d'information |
| **Vert — accent** | `brand.green` | `#1E9E6A` | Surtitres, points de confiance, icônes de section |
| Vert — fond léger | `brand.green-subtle` | `#E6F6EF` | Pastilles d'icône |
| Vert — teinte de fond | `brand.green-tint` | `#F0F7F3` | Bandeau de section pleine largeur |
| Orange | `brand.orange` | `#E8870B` | Réservé : troisième catégorie, jamais un état |
| Violet | `brand.violet` | `#7C4DEE` | Réservé : quatrième catégorie |
| Danger | `danger.600` | — | Erreurs de saisie, action destructrice |

**Règles d'emploi**

1. **Hiérarchie stricte** : blanc dominant → bleu pour ce qui s'active → vert
   pour ce qui rassure et catégorise. L'orange et le violet ne servent qu'à
   distinguer des catégories côte à côte, jamais à signifier un état.
2. **Le bleu appartient à l'action.** Si un élément est bleu, il doit être
   cliquable. Réciproquement, toute action principale est bleue.
3. **Le vert n'est jamais un bouton.** Il qualifie (surtitre, icône, filet), il
   n'invite pas au clic. Cela évite la confusion avec un état « succès ».
4. **Une seule teinte de fond par écran.** Un bandeau `brand.green-tint` sert de
   respiration ; deux bandeaux teintés dans la même page annulent l'effet.
5. **Contraste** : 4,5:1 minimum pour tout texte, 3:1 pour les bordures
   porteuses de sens. Le vert `#1E9E6A` sur blanc ne passe **pas** en petit
   corps : réservé aux surtitres en gras, aux icônes et aux filets.

### Typographie

**Contrainte non négociable** : l'application embarque un système de **polices
d'accessibilité** (Lexend, Atkinson Hyperlegible, OpenDyslexic) que l'utilisateur
choisit dans ses réglages. **Aucune police d'affichage ne doit être imposée**,
sous peine de casser cette fonction pour les personnes qui en dépendent. On
travaille donc avec la pile système, et la personnalité vient de l'échelle et du
rythme, pas du dessin des lettres.

| Rôle | Taille | Graisse | Interlignage | Détail |
|---|---|---|---|---|
| Titre de page | `2.1rem` → `3.5rem` | 700 | 1.06 | `letter-spacing: -0.025em`, `text-wrap: balance` |
| Titre de section | `1.5rem` → `1.95rem` | 700 | 1.15 | `letter-spacing: -0.015em` |
| Sous-titre | `1.02rem` | 700 | 1.3 | |
| Texte courant | `0.95rem` → `1.1rem` | 400 | 1.6 | mesure max. `36rem` |
| Surtitre | `0.78rem` | 700 | 1.35 | majuscules, `letter-spacing: 0.06em`, vert |
| Légende | `0.76rem` | 600 | 1.4 | |

**Règles**

- Le resserrement des interlettres est **négatif sur les grands titres**, positif
  sur les surtitres en majuscules. C'est le principal levier de tenue.
- `text-wrap: balance` sur tout titre susceptible de tenir sur deux lignes.
- `overflow-wrap: anywhere` sur les titres d'affichage, pour éviter le
  débordement sur mobile.
- **Pas d'italique dans les titres.** L'italique n'existe que dans le texte
  courant.
- Une mesure de lecture ne dépasse jamais `36rem`.

### Formes, ombres, mouvement

- **Rayons** : `10px` pour les champs et boutons, `12px` pour les pastilles
  d'icône, `16px` pour les cartes. Jamais d'angle vif, jamais de cercle sauf
  pour un avatar.
- **Ombres** : quasi absentes. La séparation se fait par la bordure et le fond.
  Une carte au repos n'a pas d'ombre.
- **Durées** : `180ms` pour un changement de couleur, `300ms` pour un survol de
  carte. Rien au-delà.
- **Toujours** respecter `prefers-reduced-motion`.
- **Jamais** de `transition: all`, de rebond, ni d'animation d'entrée en cascade.

---

## Les trois éléments signature

Un design de ce type ne se distingue pas par l'ornement mais par des décisions
justes. Trois seulement, et rien d'autre.

### I — Le champ de code est le hero

Un visiteur non connecté ne peut accomplir qu'**une** chose : rejoindre une
réunion dont il a reçu le code. Cette action est donc placée à même la page,
pas derrière un bouton qui ouvre une boîte de dialogue. L'action est le produit.

Le champ accepte le code (`abc-defg-hij`), le code sans tirets, ou le lien
complet collé depuis une invitation, et normalise les trois.

### II — Le surtitre vert institutionnel

Chaque section majeure s'ouvre par un surtitre court, en majuscules, resserré,
en vert. Il nomme l'institution ou le contenu — jamais un slogan. C'est le seul
endroit où le vert est du texte.

### III — Le bandeau teinté comme séparateur

Une seule section par page repose sur un fond `brand.green-tint` bordé en haut
et en bas. Le bord de couleur **est** le séparateur : ailleurs, un simple filet
`greyscale.200` suffit, et parfois le blanc seul.

**Sur les chiffres romains** : ils conviennent à un contexte universitaire, mais
seulement si le contenu est réellement une séquence — un parcours d'inscription,
des étapes ordonnées. Numéroter des fonctionnalités qui n'ont pas d'ordre est un
ornement, pas une information. En cas de doute, s'en passer.

---

## Composants

### Boutons

- **Principal** : fond `primary.800`, texte blanc, rayon `10px`, hauteur `48px`,
  `padding-inline: 1.4rem`. Survol → `primary.action`. Focus → contour `2px`
  bleu avec `outline-offset: 2px`.
- **Secondaire** : fond blanc, bordure `2px` `greyscale.300`, texte
  `greyscale.1000`. Survol → bordure `greyscale.500`.
- **Tertiaire** : texte bleu souligné, `text-underline-offset: 3px`.
- Hauteur minimale **48px** partout, y compris sur mobile.

### Cartes

Fond blanc, bordure `1px` `greyscale.200`, rayon `16px`, `padding` `1.3rem` à
`1.6rem`. **L'icône se place à gauche du texte**, dans une pastille de `44px`
au fond teinté, jamais empilée au-dessus du titre : la grille « icône au-dessus
du titre sur trois colonnes égales » est le motif le plus reconnaissable des
interfaces générées.

### Champs de saisie

Hauteur `48px`, bordure `2px` `greyscale.300`, rayon `10px`, fond blanc.
Focus → bordure `primary.800`. Erreur → bordure `danger.600`, `aria-invalid`,
et message relié par `aria-describedby`. Le libellé est **toujours** visible
au-dessus ; le texte indicatif ne remplace jamais un libellé.

---

## Rythme et mise en page

- Largeur de contenu : `68rem` maximum, centrée.
- Marges latérales : `1rem` sous 640 px, `1.5rem` au-delà.
- Espacement vertical de section : `2.5rem` sur mobile, `4rem` sur grand écran.
  Pas davantage : ce n'est pas un site de contemplation.
- Grilles : une colonne sous 768 px, deux au-delà. **Les pistes de grille
  utilisent `minmax(0, 1fr)`**, jamais `1fr` seul, sinon un contenu long fait
  déborder la page.
- Le hero est aligné à gauche, sur une mesure de `44rem`. Pas de hero centré
  pleine hauteur.

---

## Accessibilité — le plancher

- Contraste 4,5:1 pour le texte, 3:1 pour les bordures signifiantes.
- Focus visible partout, jamais supprimé, apparition **immédiate** (pas de
  fondu : un utilisateur au clavier a besoin du repère tout de suite).
- Cibles tactiles de 48px minimum, espacées d'au moins 8px.
- Hiérarchie de titres respectée (`h1` → `h2` → `h3`), un seul `h1` par page.
- Éléments décoratifs en `aria-hidden="true"`.
- Chaque champ possède un libellé associé.
- `prefers-reduced-motion` respecté.

---

## Responsive

Vérifier à **320, 375, 414, 768 et 1024 px**. Non négociables :

- Aucun défilement horizontal.
- Aucun texte cliquable sur deux lignes (boutons, liens de navigation).
- Les titres d'affichage se coupent proprement (`overflow-wrap: anywhere`).
- Les grilles passent à une colonne sous 768 px.
- Les groupes champ + bouton s'empilent verticalement sous 500 px.

---

## Anti-motifs

**Ne jamais :**

1. Inventer un chiffre — utilisateurs, réunions, heures, taux de disponibilité.
   Si la donnée n'existe pas, la section n'existe pas.
2. Annoncer une fonctionnalité désactivée. Sous-titres, téléphonie et import de
   fonds d'écran sont dans le code mais éteints ; il n'y a ni tableau blanc ni
   partage de documents.
3. Redessiner une fausse fenêtre de navigateur, un faux téléphone, une fausse
   capture d'écran.
4. Écrire une valeur hexadécimale dans un composant.
5. Charger une ressource depuis un tiers — police, script, image. La souveraineté
   des données est l'argument du produit ; une police Google enverrait l'IP de
   chaque visiteur à Google.
6. Employer un dégradé sur du texte, ni un dégradé de fond sur un hero.
7. Imposer une police d'affichage : cela casse le système de polices
   d'accessibilité.
8. Utiliser le vert pour un bouton, ou le bleu pour autre chose qu'une action.
9. Empiler une icône au-dessus d'un titre dans une grille de colonnes égales.
10. Ajouter une animation qui n'apporte pas d'information.

---

## Contraintes techniques

- **CSS** : PandaCSS (`css()` depuis `@/styled-system/css`), jetons dans
  `panda.config.ts`. Pas de Tailwind.
- **Icônes** : `@remixicon/react`. Pas de Lucide, jamais d'émoji comme icône.
- **Polices** : pile système, plus le système d'accessibilité existant.
- **Composants** : `src/primitives/` pour les briques, `src/components/console/`
  pour les tableaux et cartes partagés entre les consoles, `src/features/<nom>/`
  pour le reste.
