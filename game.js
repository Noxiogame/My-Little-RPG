const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const roomInput = document.querySelector('#room');
const connectButton = document.querySelector('#connect');
const status = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const playersElement = document.querySelector('#players');
const joystick = document.querySelector('#joystick');
const stick = document.querySelector('#stick');
const chatMessages = document.querySelector('#chat-messages');
const chatEmpty = document.querySelector('#chat-empty');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const speechBubbles = document.querySelector('#speech-bubbles');
const characterSwitch = document.querySelector('#character-switch');
const talkboxTextures = Object.fromEntries(['corner', 'side', 'interior'].map((name) => {
  const image = new Image();
  image.src = `Noelle/talkbox_ui_${name}.png`;
  image.addEventListener('load', () => requestAnimationFrame(draw));
  return [name, image];
}));

function createSprite(character, direction, frame) {
  const image = new Image();
  image.src = `${character === 'spamton' ? 'Spamton' : 'Noelle'}/${character}_${direction}${frame}.png`;
  return image;
}

const characterSprites = {
  noelle: Object.fromEntries(['down', 'left', 'right', 'up'].map((direction) => [direction, [1, 2, 3, 4].map((frame) => createSprite('noelle', direction, frame))])),
  spamton: {
    down: [1, 2, 3, 4].map((frame) => createSprite('spamton', 'down', frame)),
    left: [1, 2, 3, 4].map((frame) => createSprite('spamton', 'left', frame)),
    right: [1, 1, 1, 1].map((frame) => createSprite('spamton', 'right', frame)),
    up: [1, 2, 3, 4].map((frame) => createSprite('spamton', 'down', frame)),
  },
};

const localPlayer = { id: `player-${Math.random().toString(36).slice(2, 8)}`, x: .5, y: .55, direction: 'down', moving: false, character: 'noelle' };
const remotePlayers = new Map();
const speechElements = new Map();
const connections = new Map();
const keys = new Set();
const joystickInput = { x: 0, y: 0, active: false, pointerId: null };
let peer = null;
let hostConnection = null;
let isHost = false;
let lastTime = performance.now();
let animationTime = 0;
let viewport = { width: 0, height: 0, dpr: 1 };

function resize() {
  viewport = { width: window.innerWidth, height: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) };
  canvas.width = viewport.width * viewport.dpr;
  canvas.height = viewport.height * viewport.dpr;
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  context.imageSmoothingEnabled = false;
}

function setStatus(text, state = 'solo') {
  statusText.textContent = text;
  status.dataset.state = state;
}

function drawWorld() {
  const { width, height } = viewport;
  context.fillStyle = '#315951';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#3d685b';
  context.fillRect(0, height * .52, width, height * .48);
  context.fillStyle = 'rgba(185, 231, 177, .08)';
  for (let x = -20; x < width + 50; x += 42) {
    for (let y = height * .54; y < height; y += 35) {
      context.fillRect(x + ((y / 35) % 2) * 12, y, 2, 2);
    }
  }
  context.fillStyle = '#244840';
  context.beginPath();
  context.moveTo(0, height * .52);
  context.quadraticCurveTo(width * .2, height * .43, width * .43, height * .51);
  context.quadraticCurveTo(width * .7, height * .62, width, height * .46);
  context.lineTo(width, 0); context.lineTo(0, 0); context.fill();
  context.fillStyle = 'rgba(255, 214, 145, .25)';
  context.beginPath(); context.arc(width * .78, height * .2, 38, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#f5c884'; context.beginPath(); context.arc(width * .78, height * .2, 22, 0, Math.PI * 2); context.fill();
  context.fillStyle = 'rgba(247,241,222,.3)'; context.font = '11px DM Mono, monospace'; context.fillText('MEADOW 01', 30, height - 30);
}

function drawPlayer(player, isLocal = false) {
  const selectedSprites = characterSprites[player.character] || characterSprites.noelle;
  const imageFrames = selectedSprites[player.direction] || selectedSprites.down;
  const frame = player.moving ? Math.floor(animationTime / 120) % 4 : 0;
  const image = imageFrames[frame];
  const height = Math.max(64, Math.min(94, viewport.width * .075));
  const width = image.naturalWidth && image.naturalHeight
    ? height * image.naturalWidth / image.naturalHeight
    : height * 23 / 47;
  const x = player.x * viewport.width;
  const y = player.y * viewport.height;
  context.save();
  context.globalAlpha = isLocal ? 1 : .9;
  context.fillStyle = 'rgba(10, 26, 24, .26)';
  context.beginPath(); context.ellipse(x, y + height * .05, width * .42, height * .1, 0, 0, Math.PI * 2); context.fill();
  if (image.complete && image.naturalWidth > 0) context.drawImage(image, x - width / 2, y - height, width, height);
  if (isLocal) { context.fillStyle = '#b9e7b1'; context.beginPath(); context.arc(x, y - height * 1.08, 3, 0, Math.PI * 2); context.fill(); }
  context.restore();
  drawSpeechBubble(player, x, y - height * 1.08);
}

function drawSpeechBubble(player, anchorX, anchorY) {
  if (!player.speech || player.speechUntil <= performance.now()) return;
  const tile = 13;
  const padding = 8;
  const maxTextWidth = 150;
  context.save();
  context.font = '11px DM Mono, monospace';
  const words = player.speech.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxTextWidth && line) {
      lines.push(line); line = word;
    } else line = next;
  });
  if (line) lines.push(line);
  if (lines.length > 2) lines.splice(2, 1, `${lines[1].slice(0, 21)}...`);
  const textWidth = Math.min(maxTextWidth, Math.max(...lines.map((text) => context.measureText(text).width), 1));
  const bubbleWidth = Math.ceil(textWidth + padding * 2);
  const bubbleHeight = lines.length * 14 + padding * 2;
  const left = Math.round(anchorX - bubbleWidth / 2);
  const top = Math.round(anchorY - bubbleHeight - 12);
  const right = left + bubbleWidth;
  const bottom = top + bubbleHeight;
  const drawTile = (texture, x, y, rotation = 0) => {
    if (!texture.complete) return;
    context.save();
    if (rotation) { context.translate(x + tile / 2, y + tile / 2); context.rotate(rotation); context.translate(-tile / 2, -tile / 2); x = 0; y = 0; }
    context.drawImage(texture, x, y, tile, tile);
    context.restore();
  };
  context.fillStyle = '#19152a';
  context.fillRect(left, top, bubbleWidth, bubbleHeight);
  context.strokeStyle = '#b9e7b1';
  context.lineWidth = 1;
  context.strokeRect(left + .5, top + .5, bubbleWidth - 1, bubbleHeight - 1);
  context.fillStyle = '#19152a';
  context.fillRect(left + tile, top + tile, Math.max(1, bubbleWidth - tile * 2), Math.max(1, bubbleHeight - tile * 2));
  for (let x = left + tile; x < right - tile; x += tile) {
    for (let y = top + tile; y < bottom - tile; y += tile) drawTile(talkboxTextures.interior, x, y);
    drawTile(talkboxTextures.side, x, top, Math.PI / 2);
    drawTile(talkboxTextures.side, x, bottom - tile, -Math.PI / 2);
  }
  for (let y = top + tile; y < bottom - tile; y += tile) {
    drawTile(talkboxTextures.side, left, y);
    drawTile(talkboxTextures.side, right - tile, y, Math.PI);
  }
  drawTile(talkboxTextures.corner, left, top);
  drawTile(talkboxTextures.corner, right - tile, top, Math.PI / 2);
  drawTile(talkboxTextures.corner, left, bottom - tile, -Math.PI / 2);
  drawTile(talkboxTextures.corner, right - tile, bottom - tile, Math.PI);
  context.fillStyle = '#f7f1de';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  lines.forEach((text, index) => context.fillText(text, anchorX, top + padding + 7 + index * 14));
  context.restore();
}

function draw() {
  drawWorld();
  const players = [...remotePlayers.values(), { ...localPlayer, isLocal: true }];
  players.sort((first, second) => first.y - second.y);
  players.forEach((player) => drawPlayer(player, player.isLocal));
  syncSpeechBubbles(players);
}

function syncSpeechBubbles(players) {
  const activeIds = new Set();
  players.forEach((player) => {
    if (!player.speech || player.speechUntil <= performance.now()) return;
    activeIds.add(player.id);
    let bubble = speechElements.get(player.id);
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'speech-bubble';
      ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((position) => {
        const corner = document.createElement('span');
        corner.className = `speech-frame speech-corner speech-corner-${position}`;
        bubble.append(corner);
      });
      ['top', 'bottom', 'left', 'right'].forEach((position) => {
        const side = document.createElement('span');
        side.className = `speech-frame speech-side speech-side-${position}`;
        bubble.append(side);
      });
      const text = document.createElement('span');
      text.className = 'speech-bubble-text';
      bubble.append(text);
      speechElements.set(player.id, bubble);
      speechBubbles.append(bubble);
    }
    bubble.querySelector('.speech-bubble-text').textContent = player.speech;
    buildHorizontalEdges(bubble);
    bubble.style.left = `${player.x * viewport.width}px`;
    bubble.style.top = `${player.y * viewport.height - Math.max(64, Math.min(94, viewport.width * .075)) * 1.16 - 8}px`;
  });
  speechElements.forEach((bubble, id) => {
    if (!activeIds.has(id)) { bubble.remove(); speechElements.delete(id); }
  });
}

function buildHorizontalEdges(bubble) {
  const width = Math.max(0, bubble.clientWidth - 26);
  const tileCount = Math.ceil(width / 13);
  ['top', 'bottom'].forEach((position) => {
    const edge = bubble.querySelector(`.speech-side-${position}`);
    edge.replaceChildren();
    for (let index = 0; index < tileCount; index += 1) {
      const tile = document.createElement('span');
      tile.className = 'speech-horizontal-tile';
      edge.append(tile);
    }
  });
}

function inputVector() {
  let x = joystickInput.x;
  let y = joystickInput.y;
  if (keys.has('arrowleft') || keys.has('a')) x -= 1;
  if (keys.has('arrowright') || keys.has('d')) x += 1;
  if (keys.has('arrowup') || keys.has('w')) y -= 1;
  if (keys.has('arrowdown') || keys.has('s')) y += 1;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function update(delta) {
  const vector = inputVector();
  const moving = Math.hypot(vector.x, vector.y) > .08;
  localPlayer.moving = moving;
  if (moving) {
    localPlayer.x = Math.max(.04, Math.min(.96, localPlayer.x + vector.x * delta * .00018));
    localPlayer.y = Math.max(.17, Math.min(.92, localPlayer.y + vector.y * delta * .00018));
    if (Math.abs(vector.x) > Math.abs(vector.y)) localPlayer.direction = vector.x > 0 ? 'right' : 'left';
    else localPlayer.direction = vector.y > 0 ? 'down' : 'up';
  }
  const smoothing = 1 - Math.exp(-delta / 85);
  remotePlayers.forEach((player) => {
    player.x += (player.targetX - player.x) * smoothing;
    player.y += (player.targetY - player.y) * smoothing;
  });
}

function frame(now) {
  const delta = Math.min(now - lastTime, 50);
  lastTime = now; animationTime += delta; update(delta); draw();
  requestAnimationFrame(frame);
}

function sendState() {
  const payload = { type: 'state', player: { ...localPlayer } };
  if (isHost) broadcast(payload);
  else if (hostConnection?.open) hostConnection.send(payload);
}

function broadcast(payload, exceptId = null) {
  connections.forEach((connection, id) => { if (id !== exceptId && connection.open) connection.send(payload); });
}

function addChatMessage(message, sender, isOwn = false) {
  chatEmpty?.remove();
  const item = document.createElement('p');
  item.className = `chat-message${isOwn ? ' is-own' : ''}`;
  const author = document.createElement('strong');
  author.textContent = isOwn ? 'Toi' : sender;
  const content = document.createElement('span');
  content.textContent = message;
  item.append(author, content);
  chatMessages.append(item);
  while (chatMessages.children.length > 40) chatMessages.firstElementChild.remove();
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage(event) {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  const payload = { type: 'chat', message, sender: localPlayer.id.slice(-6), playerId: localPlayer.id };
  localPlayer.speech = message;
  localPlayer.speechUntil = performance.now() + 7000;
  addChatMessage(message, payload.sender, true);
  if (isHost) broadcast(payload);
  else if (hostConnection?.open) hostConnection.send(payload);
  chatInput.value = '';
  chatInput.focus();
}

function switchCharacter() {
  localPlayer.character = localPlayer.character === 'noelle' ? 'spamton' : 'noelle';
  characterSwitch.firstChild.textContent = localPlayer.character === 'noelle' ? 'Noelle ' : 'Spamton ';
  localPlayer.speech = '';
  localPlayer.speechUntil = 0;
  sendState();
}

function receive(connection, payload) {
  if (!payload || !payload.type) return;
  if (payload.type === 'state') {
    const previous = remotePlayers.get(payload.player.id);
    const player = {
      ...payload.player,
      x: previous?.x ?? payload.player.x,
      y: previous?.y ?? payload.player.y,
      targetX: payload.player.x,
      targetY: payload.player.y,
      peerId: connection.peer,
    };
    remotePlayers.set(payload.player.id, player);
    if (isHost) broadcast(payload, connection.peer);
    renderPlayers();
  }
  if (payload.type === 'hello' && isHost) {
    connection.send({ type: 'snapshot', players: [...remotePlayers.values(), localPlayer] });
    broadcast({ type: 'state', player: localPlayer }, connection.peer);
  }
  if (payload.type === 'chat') {
    const player = remotePlayers.get(payload.playerId);
    if (player) {
      player.speech = payload.message;
      player.speechUntil = performance.now() + 7000;
    }
    addChatMessage(payload.message, payload.sender);
    if (isHost) broadcast(payload, connection.peer);
  }
  if (payload.type === 'snapshot') payload.players.forEach((player) => {
    if (player.id !== localPlayer.id) {
      remotePlayers.set(player.id, { ...player, targetX: player.x, targetY: player.y, peerId: connection.peer });
    }
  });
}

function wireConnection(connection) {
  connections.set(connection.peer, connection);
  connection.on('data', (payload) => receive(connection, payload));
  connection.on('close', () => {
    const disconnectedPlayer = [...remotePlayers.values()].find((player) => player.peerId === connection.peer);
    if (disconnectedPlayer) remotePlayers.delete(disconnectedPlayer.id);
    connections.delete(connection.peer);
    renderPlayers();
  });
}

function createPeer(room) {
  if (!window.Peer) { setStatus('Mode solo'); return; }
  const hostId = `noelle-meadow-${room.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
  peer = new Peer(hostId);
  peer.on('open', () => { isHost = true; setStatus('Salon ouvert', 'online'); connectButton.textContent = 'Connecté'; connectButton.disabled = true; });
  peer.on('connection', (connection) => { wireConnection(connection); connection.on('open', () => connection.send({ type: 'snapshot', players: [...remotePlayers.values(), localPlayer] })); });
  peer.on('error', (error) => {
    if (error.type === 'unavailable-id') connectToHost(hostId);
    else setStatus('Mode solo');
  });
}

function connectToHost(hostId) {
  peer?.destroy(); peer = new Peer();
  peer.on('open', () => { hostConnection = peer.connect(hostId, { reliable: true }); wireConnection(hostConnection); hostConnection.on('open', () => { hostConnection.send({ type: 'hello', player: localPlayer }); setStatus('En ligne', 'online'); connectButton.textContent = 'Connecté'; connectButton.disabled = true; }); });
  peer.on('error', () => setStatus('Salon introuvable'));
}

function connectRoom() {
  const room = roomInput.value.trim() || 'prairie';
  roomInput.value = room;
  connectButton.disabled = true; setStatus('Connexion...'); createPeer(room);
}

function renderPlayers() {
  playersElement.textContent = remotePlayers.size ? `${remotePlayers.size + 1} joueur${remotePlayers.size > 0 ? 's' : ''} dans la prairie` : '';
}

function setJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const radius = rect.width / 2;
  const distanceX = event.clientX - (rect.left + radius);
  const distanceY = event.clientY - (rect.top + radius);
  const distance = Math.min(Math.hypot(distanceX, distanceY), radius - 26);
  const angle = Math.atan2(distanceY, distanceX);
  joystickInput.x = Math.cos(angle) * distance / (radius - 26);
  joystickInput.y = Math.sin(angle) * distance / (radius - 26);
  stick.style.transform = `translate(${joystickInput.x * (radius - 26)}px, ${joystickInput.y * (radius - 26)}px)`;
}

joystick.addEventListener('pointerdown', (event) => { joystickInput.active = true; joystickInput.pointerId = event.pointerId; joystick.setPointerCapture(event.pointerId); setJoystick(event); });
joystick.addEventListener('pointermove', (event) => { if (joystickInput.active && event.pointerId === joystickInput.pointerId) setJoystick(event); });
function releaseJoystick() { joystickInput.active = false; joystickInput.x = 0; joystickInput.y = 0; stick.style.transform = 'translate(0, 0)'; }
joystick.addEventListener('pointerup', releaseJoystick); joystick.addEventListener('pointercancel', releaseJoystick);
window.addEventListener('keydown', (event) => {
  if (event.target instanceof HTMLInputElement) return;
  keys.add(event.key.toLowerCase());
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('resize', resize);
connectButton.addEventListener('click', connectRoom);
roomInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') connectRoom(); });
chatForm.addEventListener('submit', sendChatMessage);
characterSwitch.addEventListener('click', switchCharacter);
setInterval(sendState, 100);
resize(); renderPlayers(); requestAnimationFrame(frame);
