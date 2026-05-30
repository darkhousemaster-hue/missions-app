---
title: "Manuel du Gamemaster MiSSiONS"
subtitle: "Pour les opérateurs animant des parties en direct"
lang: fr
manifest: gm-fr
---

# Bienvenue, Gamemaster

Ce manuel est pour toi si tu **animes des parties en direct** :
accueillir les équipes, leur remettre leur code d’accès, valider
leurs photos et vidéos, envoyer des diffusions quand il faut
attirer l’attention de tout le monde, geler les équipes prises en
photo et terminer la partie à la fin du temps.

Il est divisé en deux parties parce que l’app prend en charge
deux types de partie distincts :

- **Partie 1, parties MiSSiONS.** Le mode classique : tu lances une
  partie à un emplacement physique, les joueurs rejoignent,
  parcourent une liste de missions photo/vidéo et tu valides leurs
  envois.
- **Partie 2, parties CityRush.** Un mode piloté par GPS où les
  joueurs marchent physiquement vers des marqueurs sur une carte,
  arrivent à chaque cible et accomplissent la tâche sur place. Le
  tableau de bord est similaire mais ajoute une carte, des signaux
  d’arrivée GPS et des missions spéciales.

Si tu n’animes qu’un des deux, tu peux sauter l’autre partie ;
elles ne se chevauchent pas et chaque partie reste dans son mode.

Tu n’as **pas** besoin du mot de passe des réglages pour ça. Tout
ce qui est dans ce manuel fonctionne sans. Si quelque chose à
l’écran nécessite un admin, le manuel le dira ; ton rôle est
d’opérer, pas de configurer.

> Les captures montrent une partie de démo avec deux équipes
> (« Team Rot » / « Team Grün » pour MiSSiONS ; « Team Blau » /
> « Team Gelb » pour CityRush). Tes vraies parties auront le même
> aspect avec tes propres noms d’équipe et missions.

::part:1:Animer des parties MiSSiONS

# L’écran d’accueil

::shot:m-01-landing

C’est ici que commence chaque session. Tu vois une tuile par
emplacement plus une tuile CityRush en bas. Touche l’emplacement
où ton groupe jouera ; l’app retient ton choix pour la fois
suivante.

Les boutons d’en-tête :

- **Version** (en haut à gauche, en petit) : quelle build de
  l’app est installée.
- **DE / EN / FR / IT / ES** (en haut à droite) : fait défiler
  la langue de l’interface GM.
- **⚙ Réglages** : ouvre la porte mot de passe. Si tu n’as pas le
  mot de passe, n’y touche pas.

# Choisir un mode et lancer une partie

::shot:m-02-game-select

Toucher un emplacement t’amène ici. La liste en bas montre les
parties déjà créées (la plus récente en premier), chacune avec son
ID, sa date de création, son statut (en attente / en cours /
terminée) et le nombre d’équipes ayant rejoint. Touche **Ouvrir**
sur l’une d’elles pour sauter dans son tableau de bord ; pratique
quand tu as quitté la page par accident.

Pour lancer une nouvelle partie :

1. Choisis un **mode** dans le menu déroulant. Le mode décide de
   la bibliothèque de missions, du jeu de règles et du minuteur
   utilisés. « MiSSiONS » est le défaut ; les admins peuvent en
   avoir ajouté d’autres (ex. ADVANCED).
2. Touche **+ Nouvelle partie**.

L’app crée la partie, choisit le bon mélange de missions pour
l’emplacement et t’affiche un bouton **Ouvrir le tableau de bord
→** plus une fenêtre QR code que tu peux montrer ou imprimer pour
que les joueurs rejoignent.

# Le tableau de bord

::shot:m-03-dashboard

Ton centre de commande pour une partie en cours. Quatre zones :

- **Barre du haut** : ID de partie, **minuteur start/pause** et
  les icônes QR / 🎬 / engrenage / langue à droite. Le bouton 🎬
  est grisé pendant la partie et s’allume à la fin, voir
  *Exporter les photos et vidéos de la partie* plus bas.
- **Pastilles d’équipe** : une par équipe ayant rejoint, avec son
  score. Une **🔔** sur une pastille signifie qu’il y a quelque
  chose en attente pour cette équipe, généralement un envoi à
  valider.
- **Zone principale** (gauche) : cartes des missions de l’équipe
  sélectionnée, ou la liste des équipes si aucune n’est
  sélectionnée.
- **Panneau de droite** : onglets Chat et Diffusion. (Les parties
  CityRush ajoutent un troisième onglet carte ici, voir Partie 2.)

Le minuteur démarre à la durée configurée (60 minutes par défaut).
Touche **▶ Démarrer** pour lancer le compte à rebours. Touche
**⏸ Pause** pour arrêter l’horloge pour tout le monde. La pause
est pour les **difficultés techniques ou les urgences uniquement**
(serveur, réseau, incident réel) ; ne l’utilise pas pour des
pauses casual. **Redémarrer** remet le minuteur à plein.

# Valider les envois d’une équipe

::shot:m-04-team-detail

Touche une pastille d’équipe pour ouvrir sa vue de détail dans la
zone principale. Chaque mission reçue devient une carte. Les
cartes avec un envoi en attente (comme « Fountain selfie » ci-
dessus) s’éclairent d’une bordure orange et affichent :

- Une **vignette** de ce que l’équipe a envoyé.
- Un bouton **Accepter** (✓) et un **Refuser** (✗).
- Le nom, la description et la tâche de la mission pour référence.

Touche **Accepter** pour attribuer les points. L’équipe reçoit un
toast 👍 et une coche verte sur sa copie de la mission.

Touche **Refuser** pour refuser. Une boîte demande la raison
(décrite ensuite).

## Agrandir une image

::shot:m-05-lightbox

Touche la vignette elle-même pour ouvrir la lightbox ; l’image
remplit l’écran pour que tu puisses vraiment juger si l’équipe a
fait la tâche. Deux contrôles flottent en haut à droite :

- **↻ Rotation** : tourne l’image de 90° dans le sens horaire par
  clic. Pratique pour les photos prises en portrait mais stockées
  en paysage, ou l’inverse. La rotation n’affecte que ce que tu
  vois, le fichier sauvegardé reste intact.
- **✕** : ferme la lightbox. Tu peux aussi toucher le fond sombre.

::shot:m-06-lightbox-rot

La même photo après un clic sur **↻ Rotation**. Continue à toucher
pour tourner davantage (180°, 270°, retour à 0°). Une fois décidé,
ferme la lightbox et utilise Accepter ou Refuser sur la carte.

Pour les vidéos, la lightbox affiche un lecteur au lieu d’une
image fixe ; pas de bouton de rotation nécessaire car la vidéo
porte ses propres métadonnées d’orientation.

## Refuser

::shot:m-07-reject-modal

Si tu touches **Refuser**, cette petite boîte s’ouvre. Tape une
courte raison ; **l’équipe voit ce texte** dans son chat joueur,
sois donc honnête et précis. Exemples qui marchent : « Trop
sombre, refaites près du lampadaire », « Mauvaise fontaine,
essayez celle devant l’église », « La moitié de l’équipe
manque ».

Appuie sur **Refuser & notifier** pour confirmer. L’équipe reçoit
un toast 👎, l’envoi est supprimé du stockage et la mission
redevient disponible.

Si un joueur a envoyé un selfie ou une photo de chat à la place de
la photo de mission, tu la verras aussi sur la carte ; refuse avec
« mauvais envoi » et l’équipe peut réessayer.

# Diffuser à tout le monde

::shot:m-08-broadcast

Bascule le panneau de droite sur **Diffusion**. Tape un message et
touche **📢 Envoyer à tous**. La fenêtre de chat de chaque équipe
reçoit le message en même temps avec un petit tag « Broadcast »
pour qu’elles sachent qu’il ne leur est pas adressé spécifiquement.

Utile pour des choses comme :

- « 5 minutes avant la fin, retournez au point de rendez-vous ! »
- « Petite averse, vous pouvez vous abriter sous un porche. »
- « Souci serveur, minuteur en pause deux minutes, désolé. »

Les retours individuels vont dans l’onglet **Chat** ; la diffusion
est pour tout le monde.

# Chat par équipe

::shot:m-09-chat

L’onglet par défaut du panneau de droite est **Chat**, lié à
l’équipe actuellement sélectionnée dans la zone principale. Tape
un message, appuie sur Entrée ou **Envoyer**, et l’équipe le voit
dans son chat joueur.

Quand une équipe t’écrit, le badge de son onglet chat s’allume
d’un point orange. Bascule sur l’équipe qui a écrit, lis le
message, réponds. Le point est par équipe ; tu peux avoir des
messages non lus d’une équipe pendant qu’un autre chat est devant
toi.

# Ce que tu ne peux pas faire sans le mot de passe

::shot:m-10-settings-gate

Voici ce que tu vois si tu touches l’engrenage **⚙** sans le mot
de passe GM. Tout ce qui est derrière cette porte est réservé aux
admins :

- Ajouter/supprimer des emplacements ou des missions
- Modifier les règles
- Changer le modèle QR ou le mot de passe GM
- Mettre l’app à jour

Si tu trouves une mission avec des infos fausses ou une règle à
changer, note-le et demande à la personne qui gère ton
installation de mettre à jour entre les sessions.

::part:2:Animer des parties CityRush

CityRush est le type de partie piloté par GPS. Au lieu de faire
des missions à un seul endroit, les joueurs marchent physiquement
entre des cibles sur une carte, arrivent à chaque cible et
accomplissent la tâche sur place. Tout ce que tu sais de MiSSiONS
s’applique encore — le tableau de bord, les pastilles d’équipe,
le chat, la diffusion, l’outil de gel, la lightbox — mais la
partie démarre différemment et il y a un onglet **carte**
supplémentaire.

# Lancer une partie CityRush

::shot:cr-01-landing

Touche la tuile **CityRush** en bas de l’écran d’accueil au lieu
d’un des emplacements réguliers. La tuile montre une icône de
coureur et un compteur des modes CityRush disponibles en dessous.

::shot:cr-02-game-select

L’écran de sélection de partie pour CityRush fonctionne comme
celui de MiSSiONS, mais le menu déroulant est le sélecteur de
**mode CityRush** (Altstadt-Tour dans cette démo) au lieu du
sélecteur mode-par-emplacement. Choisis un mode, touche
**+ Nouvelle partie** et l’app génère le QR + tableau de bord.

# Le tableau de bord CityRush

::shot:cr-03-dashboard

La disposition du tableau de bord est identique à MiSSiONS —
pastilles d’équipe en haut, cartes de mission dans la zone
principale quand tu sélectionnes une équipe, panneau
chat/diffusion/carte à droite. Les onglets Chat et Diffusion
fonctionnent exactement comme pour les parties MiSSiONS.

Les différences sont toutes dans les **cartes de mission** et
l’onglet **🗺️ carte**.

# Les missions d’une équipe CityRush

::shot:cr-04-team-detail

Chaque carte de mission CityRush ressemble à une carte MiSSiONS
avec quelques extras :

- Un **numéro de séquence** à gauche (`1`, `2`, `3`…) : les
  missions CityRush sont ordonnées et les joueurs les
  déverrouillent une à la fois. Une équipe doit arriver à la
  mission 1 avant que la mission 2 ne soit même visible.
- Un préfixe **⭐** sur les **missions spéciales** : elles ne
  suivent pas la séquence ; les joueurs peuvent les faire à tout
  moment depuis un panneau séparé.
- Un statut **❔** quand l’équipe n’est pas encore arrivée,
  remplacé par la tâche réelle et une UI Accepter/Refuser une
  fois sur place et après envoi de média ou réponse.

Acceptation, refus, lightbox et rotation fonctionnent exactement
comme en MiSSiONS, voir les captures m-04 à m-07 dans la Partie 1.

# Le panneau carte

::shot:cr-05-map

Bascule le panneau de droite sur **🗺️** pour voir la carte en
direct. Les marqueurs sont les cibles des missions, dans l’ordre
où elles sont parcourues. Les points de position d’équipe
apparaissent au fur et à mesure (à condition qu’elles aient
accordé la permission de localisation dans leur vue joueur).

Les missions spéciales n’apparaissent pas sur la carte, elles
n’ont pas de position fixe.

La carte a un **bouton plein écran** (en haut à droite) pour
l’agrandir à la zone principale entière ; touche encore pour
restaurer. Utilise le plein écran quand tu veux voir où sont
toutes les équipes en même temps.

> Les missions spéciales n’ont volontairement pas de cible GPS.
> Si tu en as configuré une sans coordonnées, elle vit dans le
> panneau ⭐ du joueur, pas sur cette carte.

# Geler une équipe prise en photo (CityRush uniquement)

::shot:cr-06-freeze

Le bouton **❄ Geler** est une mécanique PvP exclusive à CityRush
construite autour du « pris en photo ». Le flux :

1. L’équipe A repère l’équipe B quelque part sur le parcours et
   la prend en photo.
2. L’équipe A te soumet cette photo comme envoi de mission (ou
   via chat, selon ton paramétrage).
3. Tu vérifies que l’équipe B est bien sur la photo et acceptes
   l’envoi.
4. Tu ouvres le détail de l’**équipe A** (le photographe, qui est
   la geleuse) et touches **❄ Geler**. Dans la fenêtre, choisis
   **l’équipe B** comme cible et une durée (1, 3, 5 ou 10 minutes),
   puis confirme.

L’équipe actuellement sélectionnée dans la zone principale est
toujours la **geleuse** ; la fenêtre choisit ensuite quelle
**autre** équipe geler. Ne fais pas l’inverse : ouvrir le détail
de l’équipe B en premier signifierait que l’équipe B devient la
geleuse, ce qui est l’opposé de ce que tu veux.

Pendant le gel, l’équipe B voit un overlay « vous êtes gelés, le
GM vous dégèlera dans N minutes » ; leur minuteur s’arrête, elles
ne peuvent rien envoyer et ne peuvent pas valider d’arrivées aux
cibles. L’équipe A a utilisé sa seule cartouche de gel contre
l’équipe B (voir ci-dessous).

C’est le **seul** usage légitime du bouton de gel. Ne l’utilise
pas comme pause neutre, punition générique ou pour donner une
pause à une équipe.

Pourquoi CityRush seulement ? Dans les parties MiSSiONS chaque
équipe fait sa propre liste à un seul endroit, donc rien à se
prendre en photo. Les équipes CityRush partagent un parcours,
d’où l’existence de la mécanique « pris en photo ».

Rappel sur la direction de la fenêtre : tu l’ouvres depuis le
détail de la geleuse (équipe A dans l’histoire ci-dessus). La
fenêtre demande ensuite quelle autre équipe geler (équipe B).
L’équipe dont tu vois le détail n’est jamais l’équipe qui finit
gelée. Touche **Geler** pour confirmer. Les équipes dégèlent
automatiquement à expiration, ou tu peux les **Dégeler** plus tôt
avec le bouton 🔥 qui remplace le bouton de gel quand une équipe
est gelée.

Chaque équipe peut geler n’importe quel rival **une fois par
paire** : le sélecteur grise les rivaux que la geleuse a déjà
utilisés. C’est une arme à usage unique par paire, pas une
nuisance constante.

---

## Checklist de fin de partie (les deux modes)

Quand le minuteur atteint zéro (ou que tu touches **Terminer la
partie** plus tôt), l’app :

- Affiche ton message de fin à chaque joueur.
- Fige le tableau des scores / classement.
- Marque la partie comme « terminée » dans la liste du tableau.

Avant de partir :

1. Fais une capture du **Classement** dans le panneau de droite,
   pratique pour la remise des prix si tu ne fais pas confiance
   aux joueurs pour se souvenir.
2. Refuse ou accepte tous les envois en attente restants ; ne les
   laisse pas pendre.
3. Si une équipe a fait un envoi de mauvaise foi (hors sujet,
   inapproprié), touche **Refuser** avec une raison ; l’envoi est
   supprimé du stockage.

Tu peux laisser le tableau de bord ouvert et revenir plus tard ;
les parties terminées restent dans la liste sous leur emplacement
(ou sous CityRush).

---

## Exporter les photos et vidéos de la partie

Une fois la partie terminée, l’icône **🎬** en haut à droite du
tableau de bord s’allume. Clique pour ouvrir le panneau d’export :

- **📦 Télécharger ZIP (tout le média)** : envoie chaque photo et
  vidéo acceptée de chaque équipe vers ton navigateur sous
  `missions-<game-id>.zip`. À l’intérieur, chaque équipe a son
  dossier avec le selfie d’équipe et chaque envoi approuvé, nommés
  par ordre d’acceptation pour préserver la chronologie. C’est le
  livrable d’archive : donne-le au client ou stocke-le pour tes
  archives.
- **🎬 Rendre le diaporama photo** : lance un rendu côté serveur
  d’un seul diaporama MP4. Chaque équipe a une carte titre avec
  son nom, suivie de ses photos acceptées dans l’ordre (environ
  deux secondes par photo). Les vidéos ne sont **pas** dans le
  diaporama, seulement dans le zip, parce que ré-encoder les
  vidéos d’équipe en diaporama fait un rendu beaucoup plus long.
  Une barre de progression montre l’état ; quand c’est fini le
  MP4 se télécharge automatiquement.

Quelques notes pratiques :

- Le rendu tourne sur le serveur. Tu peux fermer la fenêtre une
  fois lancé ; la rouvrir plus tard reprend où ça en était si le
  rendu tourne encore.
- Une partie typique avec 30–40 photos acceptées rend en 30–60
  secondes.
- L’export couvre les médias **acceptés** uniquement. Les envois
  refusés sont déjà supprimés du stockage au moment du refus, ils
  ne peuvent pas réapparaître ici.
- Rendre à nouveau remplace le diaporama précédent. Le zip est
  regénéré à chaque téléchargement.

---

## Questions courantes

**Une équipe dit avoir envoyé une vidéo mais rien n’apparaît.**
Vérifie la vue de détail de l’équipe ; parfois un envoi vidéo
échoue silencieusement à cause d’une mauvaise connexion. Fais-la
ré-envoyer depuis la carte mission.

**Le téléphone de l’équipe dit « gelé » alors que je n’ai rien
fait.**
Un coéquipier a peut-être déclenché un gel automatique (ex. en
essayant d’envoyer deux fois de suite). Le tableau de bord montre
le gel actif et un bouton 🔥 pour dégeler.

**Une équipe a rejoint la mauvaise partie.**
Chaque partie a son propre URL/QR de rejoindre. Si tu leur as
donné le mauvais code, termine cette partie (ou ignore-la) et
fais-les rejoindre la bonne. Pas de migration ; elles repartent à
zéro.

**Une équipe CityRush ne voit pas la mission suivante.**
Elle n’est probablement pas arrivée physiquement dans le rayon de
la cible courante. Vérifie le panneau carte ; leur point devrait
être dans le cercle de la cible. S’il y est et que la mission ne
se déverrouille toujours pas, leur précision de localisation est
peut-être trop faible ; fais-les sortir à l’air libre et attendre
quelques secondes.

**Les joueurs disent ne pas voir les missions dans leur langue.**
Chaque joueur choisit sa langue sur l’écran de connexion. Si elle
est mauvaise sur son appareil, il touche le bouton 🌐 dans sa vue
joueur, pas sur le tableau GM.

**Puis-je lancer deux parties au même emplacement simultanément ?**
Oui, le tableau de bord de chacune est indépendant. Assure-toi
juste que chaque équipe rejoint le bon ID de partie.
