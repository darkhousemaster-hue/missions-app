---
title: "Manuel des réglages MiSSiONS"
subtitle: "Pour les administrateurs avec le mot de passe GM"
lang: fr
manifest: settings-fr
---

# Bienvenue

Ce manuel couvre chaque écran derrière la porte **Réglages** de
l’app MiSSiONS. Il est organisé en trois parties :

- **Partie 1, Administration.** Ce qui n’est lié à aucun type de
  partie : la porte mot de passe, l’URL publique, la sécurité,
  les mises à jour et le modèle QR à imprimer pour l’accès des
  joueurs.
- **Partie 2, Configuration MiSSiONS.** Emplacements, modes,
  missions et les règles vues en jeu. C’est l’essentiel du
  travail quotidien.
- **Partie 3, Configuration Rail Adventure.** Un type de partie séparé
  avec ses propres modes, missions GPS-ciblées, indices et
  missions spéciales.

Rail Adventure est volontairement séparé, il partage l’enveloppe des
réglages mais a sa propre logique (cibles GPS, séquences
d’indices, missions spéciales) qui ne s’applique pas aux parties
MiSSiONS. Si tu n’en utilises qu’un des deux, tu peux sauter
l’autre partie.

Le mot de passe pour entrer dans les réglages appartient à la
personne qui a installé l’app et ne doit pas être partagé
légèrement, quiconque l’a peut changer chaque règle, mission et
le mot de passe lui-même. Le défaut après installation propre est
`admin1898` ; change-le dans l’onglet Sécurité dès que possible.

> Les captures de ce manuel ont été prises sur une base de démo
> propre avec trois emplacements (Altstadt, Stadtpark,
> Hauptbahnhof), six missions et un mode Rail Adventure avec trois
> missions. Ton installation réelle aura le même aspect avec tes
> propres données.

::part:1:Administration

# La porte mot de passe

::shot:adm-01-gate

Touche l’icône engrenage en haut à droite de l’écran d’accueil.
Tu verras la porte mot de passe ci-dessus. Tape le mot de passe
GM et appuie sur **Déverrouiller** (ou Entrée). Mauvais mot de
passe ? Le champ tremble et une erreur rouge apparaît dessous.
Appuie sur **Retour** pour revenir à l’accueil.

Chaque onglet de réglages est derrière cette porte, donc
quiconque tu ne veux pas voir avec un accès admin complet ne
devrait pas avoir le mot de passe.

# Général

::shot:adm-02-general

**URL publique.** L’adresse que les joueurs utilisent pour
atteindre ta partie. Quand tu lances `start-tunnel-windows.bat`,
le tunnel rapide Cloudflare livré avec affiche une URL comme
`https://abc-def-ghi.trycloudflare.com`. Clique sur **Détecter**
et l’app la trouve automatiquement. Tu peux aussi la coller
manuellement si tu héberges l’app autrement.

**Message de fin de partie.** Quand le minuteur d’une partie
expire, ce message s’affiche à chaque joueur. Tape-le une fois
par langue ; le bouton **🌐 Auto** remplit les langues vides à
partir de celle dans laquelle tu as commencé. Sauvegarde avant
de quitter l’onglet.

# Sécurité

::shot:adm-03-security

Change le mot de passe GM. Tape ton mot de passe actuel, puis le
nouveau deux fois. Le nouveau mot de passe prend effet
immédiatement et s’applique à chaque opérateur sur chaque
appareil, assure-toi d’avoir un moyen de le communiquer avant
de le changer.

# Mises à jour

::shot:adm-04-updates

L’app peut se mettre à jour directement depuis GitHub. Renseigne
l’**URL du dépôt GitHub** une fois (ex.
`https://github.com/toi/missions-app`) ; le champ **Version**
affiche la version installée. Appuie sur **Mettre à jour
maintenant** et l’app exécute `git pull && npm install
--production` et se redémarre. La sortie apparaît dans la zone
en dessous pour confirmer ce qui a changé.

**Attention en pleine partie**, le redémarrage coupera
brièvement la connexion de chaque joueur. Ils se reconnectent
automatiquement, mais c’est tout de même perturbant. Mets à jour
entre les sessions, pas pendant.

# Modèle QR

::shot:adm-05-template

Pour les emplacements où tu imprimes des cartes d’accès
physiques (une feuille pliée avec ton branding plus un QR code),
téléverse ici ton PNG de modèle et glisse le marqueur QR orange
là où le code doit atterrir. Choisis d’abord un format papier,
A4 par défaut. **Sauvegarder la position** persiste le marqueur,
et **Supprimer le modèle** vide le téléversement. Quand un GM
crée une nouvelle partie, le QR est rendu sur ce modèle à la
position que tu as définie.

# Statistiques

L'onglet **Statistiques** répond à la question « qu'a-t-on réellement
joué, et à quelle fréquence » : parties terminées par lieu, par mode
et par parcours Rail Adventure. Vous voyez ainsi quels contenus valent
la peine et lesquels ne sont jamais choisis.

Une partie compte lorsqu'elle a vraiment été jouée. Les parties que
vous supprimez de la liste alors qu'elles étaient inachevées sortent
des chiffres — une partie de test mal saisie ne fausse donc rien.

# Messages automatiques

Plutôt que d'écrire à chaque groupe au bon moment, vous préparez ici
des **diffusions programmées**. Chaque entrée a un moment (minutes
après le début, ou minutes avant la fin) et un texte. Quand une partie
atteint ce point, le message part tout seul vers toutes les équipes.

Rédigez le texte **dans toutes les langues que vous utilisez** :
chaque appareil reçoit la version correspondant à la langue choisie
par le joueur. Usages typiques : un rappel à mi-parcours, un « plus
que quinze minutes, rentrez » ou le point de rendez-vous final.

# Jeux de couleurs

Sous **Jeu de couleurs**, vous redessinez toute l'app joueur : fond,
cartes, boutons, accents, textes et notifications, plus votre propre
logo. Les réglages valent **par lieu** et **par parcours Rail
Adventure** — deux lieux peuvent donc être totalement différents.

Deux choses rendent cela praticable plutôt que laborieux :

- **Aperçu en direct.** Des aperçus de téléphone accompagnent les
  réglages et se mettent à jour immédiatement. Des aperçus distincts
  couvrent la liste des missions, une mission ouverte, le chat et un
  refus — vous vérifiez donc les états que les joueurs voient vraiment.
- **Montrer plutôt que chercher.** Survolez un réglage et l'aperçu
  encadre l'élément qu'il colore ; survolez l'aperçu et il vous dit
  quel réglage en est responsable. Un clic fige la mise en évidence.

Un second onglet bascule sur le **tableau de bord du Gamemaster**, qui
a son propre jeu de couleurs. Il n'affecte **que** le tableau de bord —
le reste de l'administration garde volontairement son apparence
normale, pour que les deux ne se dérèglent pas mutuellement.

> Ne changez que ce que vous voulez changer. Chaque valeur a une
> réinitialisation, et il en existe une pour l'ensemble du jeu de
> couleurs : vous pouvez toujours revenir au réglage d'origine.

::part:2:Configuration MiSSiONS

# Emplacements

::shot:m-01-locations

Un **emplacement** est un lieu physique où se déroulent les
parties. La démo a trois : Altstadt, Stadtpark et Hauptbahnhof.
Chaque emplacement a sa propre bibliothèque de missions ; quand
un GM lance une partie à « Altstadt », les joueurs reçoivent les
missions d’Altstadt plus les missions du **Pool** (missions
liées à aucun emplacement spécifique).

Utilise le bouton **+ Emplacement** (en haut de la liste) pour en
ajouter un. Clique **Modifier** sur une carte pour changer nom
ou règles. **Supprimer** retire l’emplacement et **toutes ses
missions**, confirme avec soin.

::shot:m-02-locations-add

La boîte Ajouter un emplacement :

- **Nom** : ce que le GM voit en choisissant un emplacement.
- **Min. MiSSiONS d’emplacement** : au démarrage d’une partie, le
  moteur garantit ce nombre de missions issues de cet
  emplacement (le reste vient du pool). Utile pour que les
  parties soient toujours adaptées à l’emplacement.
- **Autoriser photo / vidéo / intérieur** : si des missions de
  ces types peuvent être sélectionnées depuis cet emplacement.
  Désactiver « intérieur » est utile pour les emplacements en
  plein air où le temps est fiable.

# Modes et bibliothèque de missions

::shot:m-03-missions

La bibliothèque de missions est divisée par **mode** (la barre du
haut, MiSSiONS, ADVANCED, etc.) et par **emplacement** (le
déroulant). Une mission appartient à exactement un mode et soit à
un emplacement, soit au Pool global.

**Onglets de mode.** Chaque mode est une bibliothèque de
missions séparée liée à un jeu de règles et un minuteur. Clique
**+ Mode** pour en ajouter un. Clique ✎ pour éditer nom, règles
ou durée par défaut d’un mode. Le premier mode (« MiSSiONS »,
id 1) ne peut pas être supprimé, c’est le défaut sûr.

**Filtre d’emplacement.** « Tous » montre tout dans le mode
actuel ; choisis un emplacement pour ne voir que ses missions ;
**Pool** ne montre que les missions sans emplacement.

**Actions en lot.** Coche les cases sur les missions, puis
utilise la barre d’outils qui apparaît : **Copier vers mode…**
pour dupliquer des missions dans un autre mode, ou **Exporter**
pour télécharger un fichier JSON importable ailleurs.

**Import.** Le bouton **⬆ Importer** lit un fichier JSON du même
format qu’Exporter produit, pratique pour déplacer des missions
entre installations.

::shot:m-04-mission-add

Chaque mission a cinq champs de langue pour son nom, sa
description et sa tâche. N’essaie pas de remplir les cinq toi-
même ; écris une langue correctement, puis clique **🌐 Auto** en
haut de la section nom pour remplir le reste automatiquement.
Édite après si la traduction nécessite du polissage.

- **Emplacement** : restreint la mission à un emplacement (ou
  laisse sur Pool pour n’importe lequel).
- **Mode** : généralement présélectionné sur celui que tu
  consultais.
- **Type de média** : photo ou vidéo. Les joueurs seront
  verrouillés dans ce format à l’envoi.
- **Points** : combien de points l’équipe reçoit quand tu
  approuves son envoi. Les pénalités pour envois en retard sont
  soustraites.
- **Aussi intérieur** : à activer quand la mission peut être
  faite à l’intérieur (missions de secours pluie). Les
  emplacements avec « autoriser intérieur » désactivé sautent
  celles-ci même si elles sont dans le mode.

Les onglets **Description** et **Tâche** :

- **Description** est l’histoire/contexte montrée au-dessus du
  bouton caméra.
- **Tâche** est l’instruction explicite « fais ça », garde-la
  courte.

Clique **Sauvegarder** quand c’est fini. La mission apparaît
dans la liste immédiatement.

# Règles

::shot:m-05-rules

Un **jeu de règles** est une liste de règles montrée aux joueurs
dans la fenêtre Règles en jeu. Le **Standard** initialisé ne
peut pas être supprimé, mais tu peux en ajouter d’autres (ex.
une variante familiale) et assigner différentes règles à
différents modes.

Pour chaque ligne de règle, tu peux utiliser les placeholders
`[photo]`, `[video]`, `[indoor]` ; ils s’étendent en petites
icônes dans la vue joueur. Glisse les règles vers le haut/bas
pour réordonner ; le bouton 🌐 sur une règle l’auto-traduit ; le
bouton ⎘ copie une règle vers un autre jeu de règles. Appuie sur
**Sauvegarder** quand fini ; les modifications non sauvegardées
sont mises en évidence.

# Langues personnalisées par lieu

Au-delà des cinq langues intégrées, un lieu peut proposer **ses propres
langues** — un dialecte, ou une langue parlée par vos hôtes que l'app
ne fournit pas. Ajoutez-la au lieu, donnez-lui un nom et une **langue
de base**, et elle apparaît comme une pastille supplémentaire dans les
barres de langue de l'éditeur de missions.

Vous rédigez alors vous-même le texte des missions dans cette langue.
Les libellés de l'app (boutons, notifications) retombent sur la langue
de base, car ils ne sont pas traduits automatiquement.

# Limiter un mode à un seul lieu

Par défaut, chaque mode apparaît dans la liste déroulante de chaque
lieu. Dès que chaque lieu a ses propres modes, cela devient confus — et
choisir le mauvais mode produit une partie vide, car les missions
appartiennent à un autre lieu.

Chaque mode dispose donc du réglage **Disponible à** :

- **Tous les sites** (par défaut) — comportement inchangé.
- **Un site précis** — le mode n'apparaît plus que dans la liste de ce
  lieu.

Le mode par défaut reste sans restriction, afin que chaque lieu ait
toujours au moins un mode disponible.

::part:3:Configuration Rail Adventure

Rail Adventure est un type de partie séparé. Les joueurs marchent
physiquement vers des marqueurs sur une carte, arrivent à chaque
cible et accomplissent une tâche là. Le panneau réglages
Rail Adventure reflète la disposition MiSSiONS mais avec des champs
supplémentaires par mission pour coordonnées, séquences
d’indices et missions spéciales. Les modes et missions
configurés ici sont **uniquement** proposés quand le GM lance
une partie Rail Adventure ; ils n’apparaissent pas dans les parties
MiSSiONS et vice versa.

# Modes Rail Adventure

::shot:cr-01-modes-empty

L’onglet Rail Adventure fonctionne comme l’onglet MiSSiONS : une
rangée d’onglets de mode en haut, puis les missions du mode
actif en dessous. Clique **+ Mode** à droite de la barre de
modes pour créer un nouveau mode Rail Adventure.

::shot:cr-02-mode-add

Un mode Rail Adventure porte ses propres :

- **Nom** : ce que le GM choisit dans le menu déroulant au
  démarrage d’une partie.
- **Jeu de règles** : la même liste que MiSSiONS, mais les règles
  s’appliquent aux parties de ce mode.
- **Médias autorisés** : photo, vidéo ou les deux. Affecte
  quelles missions par type de média sont autorisées dans ce
  mode.
- **Durée par défaut (minutes)** : le minuteur de démarrage.

# Missions Rail Adventure

::shot:cr-03-mission-add

Une mission Rail Adventure a tous les champs d’une mission MiSSiONS,
plus les extras conscients de la position :

- **Coordonnées GPS + rayon** : où est la cible et à quelle
  distance (mètres) les joueurs doivent arriver pour que la
  tâche se déverrouille. Utilise un petit rayon (15–25 m) dans
  les pâtés de maisons denses ; plus grand (40–60 m) dans les
  parcs ouverts.
- **Afficher sur la carte** : si le marqueur cible est visible
  aux joueurs. Désactive pour les missions « trouve ton chemin
  avec les indices uniquement ».
- **Indices GPS** : révélés un par un pendant que l’équipe
  marche ; utile quand le marqueur est caché ou la zone est
  grande.
- **Indices de tâche** : révélés un par un après l’arrivée,
  quand les équipes bloquent sur la tâche elle-même.
- **Média requis** : photo ou vidéo ; mutuellement exclusif
  avec le champ réponse ci-dessous.
- **Chronométré** : quand une équipe touche « Démarrer », un
  compte à rebours commence. Des pénalités s’appliquent quand
  c’est dépassé ; configure l’intervalle de pénalité et les
  points juste en dessous.

## Missions à mode réponse

::shot:cr-04-mission-answer

Bascule **A une réponse** pour transformer la mission en défi
« tape le bon mot ». Le champ **Réponse(s)** accepte une liste
séparée par `|` et ignore la casse et les espaces, donc
`Eule|Owl|Hibou|Civetta` matchent tous. C’est mutuellement
exclusif avec photo/vidéo, choisis un mode par mission.

## Missions spéciales

::shot:cr-05-mission-special

Bascule **Mission spéciale** pour sortir la mission de la
séquence linéaire. Les missions spéciales :

- Apparaissent dans le panneau ⭐ du joueur, jouables à tout
  moment, dans n’importe quel ordre.
- Sautent entièrement l’étape d’arrivée GPS, même si tu mets
  des coordonnées.
- Utilisent un **Cooldown** (minutes) pour limiter les
  re-tentatives : `0` signifie que chaque équipe ne peut la
  jouer qu’une fois ; `5` signifie cinq minutes entre tentatives.
  Un refus GM efface le cooldown immédiatement.

Sauvegarde quand fini. Les joueurs qui ont déjà commencé une
partie ne verront pas les missions ajoutées en cours de partie,
pousse-les avant le lancement.

---

## Astuces pour le quotidien

- Utilise **Auto-traduire** libéralement sur les missions
  MiSSiONS et Rail Adventure, avoir les cinq langues parfaites à la
  main est une corvée que l’IA fait assez bien la plupart du
  temps.
- Les **missions Pool** (MiSSiONS uniquement) sont du
  **remplissage**, pas une sauvegarde pluie. Elles restent des
  missions extérieures, la différence étant qu’elles ne sont
  pas liées à un emplacement spécifique, donc le moteur peut les
  tirer dans n’importe quelle partie pour compléter un mode qui
  aurait sinon trop peu de missions spécifiques à l’emplacement.
  Utilise le drapeau **Aussi intérieur** sur les missions
  individuelles si tu les veux jouables par mauvais temps ;
  c’est une propriété séparée de Pool.
- Pour Rail Adventure, **teste toujours le rayon à pied**, le GPS d’un
  téléphone est rarement précis à moins de 5 mètres dans une
  zone construite, et un rayon trop serré laisse les équipes
  coincées.
- **Exporte tes missions de temps en temps** comme sauvegarde.
  Le JSON est petit, lisible et tu peux ré-importer après un
  effacement de base.
- **Ne mets pas à jour en pleine session.** Ça marche, mais tu
  perdras la face devant ceux qui jouent.

# Missions Scan (QR et image)

Une mission **Scan** se résout avec la caméra plutôt qu'au clavier.
Choisissez **QR** (un code que vous imprimez et placez) ou **Image**
(un visuel imprimé que la caméra reconnaît), puis ce que le scan
déclenche :

- **Résoudre** — le scan termine la mission.
- **Révéler** — le scan dévoile la vraie tâche, cachée jusque-là.
  Idéal pour une énigme dont le texte ne doit pas être lisible avant.
- **Fragments** — plusieurs codes vont ensemble ; la mission est
  terminée quand l'équipe les a tous collectés.

Pour le QR, l'éditeur affiche immédiatement le code imprimable :
imprimer, plastifier, placer. En secours, les joueurs peuvent aussi
saisir le code à la main si une caméra refuse de fonctionner.

> Un code provenant d'une autre partie n'est pas accepté. Si une
> équipe dit que son scan ne fait rien, vérifiez d'abord que
> l'impression correspond au parcours joué.

# Réponses de quiz : plusieurs orthographes et la casse

Une mission à réponse accepte **une liste de réponses, pas une seule**.
Tapez une orthographe, appuyez sur Entrée ou **＋ Ajouter**, et elle
devient une pastille. Chaque pastille compte comme correcte : vous
pouvez accepter « Zum grauen Fuchs », « grauer Fuchs » et « Fuchs ».

Un texte resté dans le champ sans avoir été ajouté est marqué en
**rouge** et n'est pas enregistré — validez-le avec Entrée ou ＋, ou
videz le champ.

La saisie doit correspondre **entièrement**. Un fragment ne suffit
pas ; c'est voulu, car une vérification trop indulgente laissait
autrefois passer une seule lettre correcte.

La **casse** a son propre interrupteur :

- **Désactivé** (par défaut) — « fuchs » et « Fuchs » comptent tous
  les deux.
- **Activé** — l'orthographe doit correspondre exactement ; c'est
  pourquoi vous pouvez lister séparément des variantes de casse.

Les espaces n'ont jamais d'importance, ceux du début et de la fin sont
ignorés. En revanche, les accents et la ponctuation sont comparés tels
quels : si vos hôtes risquent d'écrire « Zurich » pour « Zürich »,
ajoutez cette orthographe comme pastille distincte.

🌐 **Auto** ne traduit que la **première** réponse dans les langues
vides. Les variantes supplémentaires y sont à votre charge.
