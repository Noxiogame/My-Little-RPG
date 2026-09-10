# Noelle's Meadow

Le code du jeu est a la racine du projet. Les dossiers `Noelle/` et `spamton/` contiennent les assets de leurs personnages ; `Noelle/` contient aussi les textures de talkbox.

Petit jeu multijoueur statique pour GitHub Pages. Les quatre images d'une direction sont utilisees comme animation : la frame `1` est l'idle, puis les frames `1` a `4` bouclent pendant le mouvement.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur ou publier le dossier avec GitHub Pages. Pour jouer ensemble, ouvrir la meme URL dans deux navigateurs et saisir le meme nom de salon. Le premier joueur ouvre le salon et les suivants le rejoignent.

Le joystick fonctionne au doigt sur mobile. Les touches `WASD` et les fleches sont aussi disponibles sur ordinateur.

## Tileset de la carte

Les tuiles de `Tilesets/Grass/` (`grass_XXXX.png`) et `Tilesets/Road/` (`roadXXXX.png`) utilisent quatre bits dans l'ordre haut, droite, bas, gauche. Un bit a la valeur `1` lorsque la tuile voisine est du meme type. Des variantes facultatives peuvent utiliser un suffixe numerique (`grass_XXXX_1.png`, `grass_XXXX_2.png`, etc.) ; elles sont chargees automatiquement et choisies de maniere stable quand elles existent. La carte genere actuellement une route sinueuse en utilisant ces masques pour choisir automatiquement les bordures.

La presence utilise PeerJS/WebRTC depuis un CDN, sans serveur applicatif a maintenir. Le jeu repasse automatiquement en mode solo si le service PeerJS ou le salon ne sont pas disponibles.

## Oeuf de recompense

L'icone Pipis en haut de l'ecran ouvre l'oeuf au centre. Chaque oeuf peut recevoir jusqu'a 12 frappes, avec un palier tous les 3 clics et un shard affiche a chaque palier. Chaque frappe a 20 % de chance de casser l'oeuf avant la fin ; la rarete obtenue depend du palier atteint : commune, inhabituelle, rare ou legendaire. Le douzieme coup casse toujours l'oeuf s'il a tenu jusque-la.