# Noelle's Meadow

Le code du jeu est a la racine du projet. Le dossier `Characters/` contient tous les assets de personnages, avec un sous-dossier par skin (`Noelle/`, `Noelle/Alt/`, `Spamton/`, `Temmie/`, `Asgore/`, `Rouxls/`, `Villageois/`, etc.) ; `Noelle/` contient aussi les textures de talkbox.

Petit jeu multijoueur statique pour GitHub Pages. Les quatre images d'une direction sont utilisees comme animation : la frame `1` est l'idle, puis les frames `1` a `4` bouclent pendant le mouvement.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur ou publier le dossier avec GitHub Pages. Pour jouer ensemble, ouvrir la meme URL dans deux navigateurs et saisir le meme nom de salon. Le premier joueur ouvre le salon et les suivants le rejoignent.

Le joystick fonctionne au doigt sur mobile. Les touches `WASD` et les fleches sont aussi disponibles sur ordinateur.

## Serveur de signalisation

Le projet est hébergé sur GitHub Pages et n’a pas de backend applicatif. La partie multijoueur passe donc par le broker PeerJS standard, exactement comme dans la version historique du projet, sans serveur supplémentaire à maintenir sur GitHub.

Le jeu utilise par défaut le broker public PeerJS `peerjs-server.onrender.com`, qui reste disponible pour GitHub Pages. Le host historique `0.peerjs.com` est aujourd’hui trop souvent rate-limité avec des réponses `429`, ce qui casse la visiobilité multijoueur ; les paramètres d’URL restent optionnels pour override le host si besoin.

## Tileset de la carte

Les tuiles de `Tilesets/Grass/` (`grass_XXXX.png`) et `Tilesets/Road/` (`roadXXXX.png`) utilisent quatre bits dans l'ordre haut, droite, bas, gauche. Un bit a la valeur `1` lorsque la tuile voisine est du meme type. Des variantes facultatives peuvent utiliser un suffixe numerique (`grass_XXXX_1.png`, `grass_XXXX_2.png`, etc.) ; elles sont chargees automatiquement et choisies de maniere stable quand elles existent. La carte genere actuellement une route sinueuse en utilisant ces masques pour choisir automatiquement les bordures.

La presence utilise PeerJS/WebRTC depuis un CDN, sans serveur applicatif a maintenir. Le jeu repasse automatiquement en mode solo si le service PeerJS ou le salon ne sont pas disponibles.

## Entrer dans une maison

En marchant sur la hitbox en bas-centre d'une maison, une transition en fondu noir amene vers une petite piece interieure (sol en tuiles `Tilesets/floor.png`, entourage noir). On ne peut pas traverser les murs de la piece. La case du bas qui depasse est le pas de porte : y marcher declenche le fondu de sortie et replace le joueur devant la maison. Chaque maison est une zone a part : seuls les joueurs entres dans la meme maison s'y voient entre eux ; ils redeviennent visibles aux autres joueurs de la prairie en ressortant. Necessite l'image `Tilesets/floor.png` (une tuile de sol simple, sans masque de bordure).

## Oeuf de recompense

L'icone Pipis en haut de l'ecran ouvre l'oeuf au centre. Chaque oeuf peut recevoir jusqu'a 12 frappes, avec un palier tous les 3 clics et un shard affiche a chaque palier. Chaque frappe a 20 % de chance de casser l'oeuf avant la fin ; la rarete obtenue depend du palier atteint : commune, non commun, rare ou legendaire. Le douzieme coup casse toujours l'oeuf s'il a tenu jusque-la.