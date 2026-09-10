# Noelle's Meadow

Le code du jeu est a la racine du projet. Les dossiers `Noelle/` et `spamton/` contiennent les assets de leurs personnages ; `Noelle/` contient aussi les textures de talkbox.

Petit jeu multijoueur statique pour GitHub Pages. Les quatre images d'une direction sont utilisees comme animation : la frame `1` est l'idle, puis les frames `1` a `4` bouclent pendant le mouvement.

## Lancer le jeu

Ouvrir `index.html` dans un navigateur ou publier le dossier avec GitHub Pages. Pour jouer ensemble, ouvrir la meme URL dans deux navigateurs et saisir le meme nom de salon. Le premier joueur ouvre le salon et les suivants le rejoignent.

Le joystick fonctionne au doigt sur mobile. Les touches `WASD` et les fleches sont aussi disponibles sur ordinateur.

La presence utilise PeerJS/WebRTC depuis un CDN, sans serveur applicatif a maintenir. Le jeu repasse automatiquement en mode solo si le service PeerJS ou le salon ne sont pas disponibles.