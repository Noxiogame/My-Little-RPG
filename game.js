const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
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
const eggReward = document.querySelector('#egg-reward');
const eggModal = document.querySelector('#egg-modal');
const eggClose = document.querySelector('#egg-close');
const eggImage = document.querySelector('#egg-image');
const eggShard = document.querySelector('#egg-shard');
const eggProgress = document.querySelector('#egg-progress');
const eggResult = document.querySelector('#egg-result');
const coinAmount = document.querySelector('#coin-amount');
const TILE_SIZE = 20;
const ROOM_ID = 'prairie';
const TILE_TEXTURE_NAMES = ['0011', '0110', '0111', '1001', '1011', '1100', '1101', '1110', '1111'];
const tileTextures = { grass: {}, road: {} };

function loadTileTexture(type, mask, variation = '') {
  const image = new Image();
  const separator = type === 'grass' ? '_' : '';
  image.src = `Tilesets/${type === 'grass' ? 'Grass' : 'Road'}/${type}${separator}${mask}${variation}.png`;
  image.addEventListener('load', () => requestAnimationFrame(draw));
  return image;
}

TILE_TEXTURE_NAMES.forEach((mask) => {
  ['grass', 'road'].forEach((type) => {
    tileTextures[type][mask] = [loadTileTexture(type, mask)];
    for (let variation = 1; variation <= 8; variation += 1) {
      tileTextures[type][mask].push(loadTileTexture(type, mask, `_${variation}`));
    }
  });
});
const roadFallback = new Image();
roadFallback.src = 'Tilesets/Road/road.png';
roadFallback.addEventListener('load', () => requestAnimationFrame(draw));
const talkboxTextures = Object.fromEntries(['corner', 'side', 'interior'].map((name) => {
  const image = new Image();
  image.src = `Noelle/talkbox_ui_${name}.png`;
  image.addEventListener('load', () => requestAnimationFrame(draw));
  return [name, image];
}));

function createSprite(character, direction, frame) {
  const image = new Image();
  const skinPaths = {
    noelle: { folder: 'Noelle', prefix: 'noelle' },
    'noelle-alt': { folder: 'Noelle/Alt', prefix: 'noelle_alt' },
    spamton: { folder: 'Spamton', prefix: 'spamton' },
    temmie: { folder: 'Temmie', prefix: 'temmie' },
    asgore: { folder: 'Asgore', prefix: 'asgore' },
  };
  const skin = skinPaths[character] || skinPaths.noelle;
  const folder = skin.folder;
  const prefix = skin.prefix;
  image.src = `${folder}/${prefix}_${direction}${frame}.png`;
  return image;
}

const characterSprites = {
  noelle: Object.fromEntries(['down', 'left', 'right', 'up'].map((direction) => [direction, [1, 2, 3, 4].map((frame) => createSprite('noelle', direction, frame))])),
  'noelle-alt': Object.fromEntries(['down', 'left', 'right', 'up'].map((direction) => [direction, [1, 2, 3, 4].map((frame) => createSprite('noelle-alt', direction, frame))])),
  temmie: Object.fromEntries(['down', 'left', 'right', 'up'].map((direction) => [direction, [1, 2, 3, 4].map((frame) => createSprite('temmie', direction, frame))])),
  asgore: Object.fromEntries(['down', 'left', 'right', 'up'].map((direction) => [direction, [1, 2, 3, 4].map((frame) => createSprite('asgore', direction, frame))])),
  spamton: {
    down: [1, 2, 3, 4].map((frame) => createSprite('spamton', 'down', frame)),
    left: [1, 2, 3, 4].map((frame) => createSprite('spamton', 'left', frame)),
    right: [1, 2, 3, 4].map((frame) => createSprite('spamton', 'right', frame)),
    up: [1, 2, 3, 4].map((frame) => createSprite('spamton', 'up', frame)),
  },
};

const eggTextures = {
  stages: ['Tilesets/pipis.png', 'Tilesets/pipis_break1.png', 'Tilesets/pipis_break2.png', 'Tilesets/pipis_break3.png'],
  broken: 'Tilesets/pipis_broken.png',
  left: 'Tilesets/pipis_broken_left.png',
  right: 'Tilesets/pipis_broken_right.png',
  shards: ['Tilesets/pipis_shard1.png', 'Tilesets/pipis_shard2.png', 'Tilesets/pipis_shard3.png'],
};
const eggRarities = ['Commune', 'Inhabituelle', 'Rare', 'Légendaire'];
const eggRewards = [5, 15, 50, 200];
const eggBreakChance = .2;
const sessionStorageKey = 'noelle-meadow-session-v1';
const session = loadSession();
const eggState = { hits: 0, open: false, broken: false, cooldownUntil: session.cooldownUntil, shardTimer: null };

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(sessionStorageKey) || '{}');
    return { coins: Number.isFinite(saved.coins) ? saved.coins : 0, cooldownUntil: Number.isFinite(saved.cooldownUntil) ? saved.cooldownUntil : 0, character: ['noelle', 'noelle-alt', 'spamton', 'temmie', 'asgore'].includes(saved.character) ? saved.character : 'noelle' };
  } catch {
    return { coins: 0, cooldownUntil: 0, character: 'noelle' };
  }
}

function saveSession() {
  try {
    localStorage.setItem(sessionStorageKey, JSON.stringify({
      coins: session.coins,
      cooldownUntil: eggState.cooldownUntil,
      character: localPlayer.character,
    }));
  } catch {
    // Storage can be unavailable in private browsing; the session remains usable.
  }
}

function formatCooldown() {
  const remaining = Math.max(0, eggState.cooldownUntil - Date.now());
  const seconds = Math.ceil(remaining / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function updateRewardUi() {
  const available = eggState.cooldownUntil <= Date.now();
  eggReward.disabled = !available;
  coinAmount.textContent = session.coins;
  if (!available && !eggState.open) eggReward.title = `Prochain Pipis dans ${formatCooldown()}`;
  else eggReward.title = 'Ouvrir le Pipis';
}

function setEggStage(stage) {
  eggImage.src = eggTextures.stages[stage];
  eggImage.alt = `Oeuf, phase ${stage + 1}`;
  eggShard.hidden = true;
  eggProgress.textContent = `${eggState.hits} / 12 frappes`;
}

function openEgg() {
  if (eggState.cooldownUntil > Date.now()) {
    eggModal.hidden = false;
    eggState.open = true;
    eggResult.textContent = `Prochain Pipis dans ${formatCooldown()}`;
    eggImage.setAttribute('aria-disabled', 'true');
    eggClose.focus();
    return;
  }
  if (eggState.broken) {
    eggState.hits = 0;
    eggState.broken = false;
    setEggStage(0);
  }
  eggState.open = true;
  eggModal.hidden = false;
  eggResult.textContent = '';
  eggImage.setAttribute('aria-disabled', eggState.broken ? 'true' : 'false');
  eggClose.focus();
}

function closeEgg() {
  eggState.open = false;
  eggModal.hidden = true;
}

function showEggShard(stage) {
  eggShard.src = eggTextures.shards[stage - 1];
  eggShard.className = 'egg-shard';
  eggShard.hidden = false;
  requestAnimationFrame(() => eggShard.classList.add('is-visible'));
  clearTimeout(eggState.shardTimer);
  eggState.shardTimer = setTimeout(() => { eggShard.hidden = true; }, 900);
}

function breakEgg() {
  eggState.broken = true;
  const rarityIndex = Math.min(3, Math.floor(eggState.hits / 3));
  const reward = eggRewards[rarityIndex];
  session.coins += reward;
  eggState.cooldownUntil = Date.now() + 120000;
  saveSession();
  updateRewardUi();
  eggImage.src = eggTextures.broken;
  eggImage.alt = 'Oeuf brisé';
  eggImage.setAttribute('aria-disabled', 'true');
  eggResult.textContent = `Rareté obtenue : ${eggRarities[rarityIndex]} (+${reward} pièces)`;
  setTimeout(() => {
    if (!eggState.open) return;
    eggImage.src = eggTextures.left;
    eggImage.alt = 'Moitié gauche de l’oeuf brisé';
    eggShard.src = eggTextures.right;
    eggShard.alt = 'Moitié droite de l’oeuf brisé';
    eggShard.hidden = false;
    eggShard.className = 'egg-shard is-visible egg-half-right';
  }, 420);
}

function hitEgg() {
  if (eggState.broken || eggState.cooldownUntil > Date.now()) return;
  eggImage.classList.remove('egg-impact');
  void eggImage.offsetWidth;
  eggImage.classList.add('egg-impact');
  eggState.hits += 1;
  const stage = Math.min(3, Math.floor(eggState.hits / 3));
  setEggStage(stage);
  if (eggState.hits % 3 === 0 && stage > 0) showEggShard(stage);
  if (Math.random() < eggBreakChance || eggState.hits === 12) breakEgg();
}

const localPlayer = { id: `player-${Math.random().toString(36).slice(2, 8)}`, x: .5, y: .55, direction: 'down', moving: false, character: session.character };
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
let worldMap = [];

function createWorldMap() {
  const columns = Math.ceil(viewport.width / TILE_SIZE) + 1;
  const rows = Math.ceil(viewport.height / TILE_SIZE) + 1;
  const map = Array.from({ length: rows }, () => Array(columns).fill('grass'));
  let center = Math.floor(rows * .68);
  for (let column = 0; column < columns; column += 1) {
    center = Math.max(3, Math.min(rows - 4, center + (column % 9 === 0 ? (column % 18 === 0 ? -1 : 1) : 0)));
    for (let offset = -1; offset <= 1; offset += 1) map[center + offset][column] = 'road';
  }
  worldMap = map;
}

function tileMask(column, row, type) {
  const same = (offsetColumn, offsetRow) => worldMap[row + offsetRow]?.[column + offsetColumn] === type;
  return `${same(0, -1) ? 1 : 0}${same(1, 0) ? 1 : 0}${same(0, 1) ? 1 : 0}${same(-1, 0) ? 1 : 0}`;
}

function closestTexture(type, mask) {
  const available = TILE_TEXTURE_NAMES.reduce((best, candidate) => {
    const distance = candidate.split('').reduce((total, bit, index) => total + (bit !== mask[index] ? 1 : 0), 0);
    return distance < best.distance ? { mask: candidate, distance } : best;
  }, { mask: '1111', distance: Number.POSITIVE_INFINITY });
  return tileTextures[type][available.mask];
}

function tileRandom(column, row, type, mask) {
  let hash = (column * 374761393 + row * 668265263 + (type === 'road' ? 1442695041 : 1013904223) + Number.parseInt(mask, 2) * 2246822519) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function drawTile(type, column, row) {
  const mask = tileMask(column, row, type);
  const textures = tileTextures[type][mask] || closestTexture(type, mask);
  const availableTextures = textures.filter((image) => image.complete && image.naturalWidth > 0);
  const image = availableTextures[tileRandom(column, row, type, mask) % availableTextures.length];
  const x = column * TILE_SIZE;
  const y = row * TILE_SIZE;
  if (image) context.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
  else if (type === 'road' && roadFallback.complete && roadFallback.naturalWidth > 0) context.drawImage(roadFallback, x, y, TILE_SIZE, TILE_SIZE);
  else {
    context.fillStyle = type === 'road' ? '#6e4f86' : '#315951';
    context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
}

function resize() {
  viewport = { width: window.innerWidth, height: window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) };
  canvas.width = viewport.width * viewport.dpr;
  canvas.height = viewport.height * viewport.dpr;
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  context.imageSmoothingEnabled = false;
  createWorldMap();
}

function setStatus(text, state = 'solo') {
  statusText.textContent = text;
  status.dataset.state = state;
}

function drawWorld() {
  const { width, height } = viewport;
  context.fillStyle = '#315951'; context.fillRect(0, 0, width, height);
  worldMap.forEach((row, rowIndex) => row.forEach((type, columnIndex) => drawTile(type, columnIndex, rowIndex)));
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
  const pixelWidth = image.naturalWidth || 23;
  const pixelHeight = image.naturalHeight || 47;
  const width = pixelWidth;
  const height = pixelHeight;
  const x = player.x * viewport.width;
  const y = player.y * viewport.height;
  context.save();
  context.globalAlpha = isLocal ? 1 : .9;
  context.fillStyle = 'rgba(10, 26, 24, .26)';
  context.beginPath(); context.ellipse(x, y + height * .05, width * .42, height * .1, 0, 0, Math.PI * 2); context.fill();
  if (image.complete && image.naturalWidth > 0) context.drawImage(image, x - width / 2, y - height, width, height);
  if (isLocal) { context.fillStyle = '#b9e7b1'; context.beginPath(); context.arc(x, y - height - 5, 3, 0, Math.PI * 2); context.fill(); }
  context.restore();
  drawSpeechBubble(player, x, y - height - 5);
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
    const bubbleHeight = characterSprites[player.character]?.[player.direction]?.[0]?.naturalHeight || 47;
    bubble.style.top = `${player.y * viewport.height - bubbleHeight - 13}px`;
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
    const speed = .1 / viewport.width;
    localPlayer.x = Math.max(.04, Math.min(.96, localPlayer.x + vector.x * delta * speed));
    localPlayer.y = Math.max(.17, Math.min(.92, localPlayer.y + vector.y * delta * speed));
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
  const payload = {
    type: 'state',
    player: {
      id: localPlayer.id,
      x: localPlayer.x,
      y: localPlayer.y,
      direction: localPlayer.direction,
      moving: localPlayer.moving,
      character: localPlayer.character,
    },
  };
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
  const characters = ['noelle', 'noelle-alt', 'spamton', 'temmie', 'asgore'];
  const labels = { noelle: 'Noelle', 'noelle-alt': 'Noelle Alt', spamton: 'Spamton', temmie: 'Temmie', asgore: 'Asgore' };
  const nextIndex = (characters.indexOf(localPlayer.character) + 1) % characters.length;
  localPlayer.character = characters[nextIndex];
  characterSwitch.firstChild.textContent = `${labels[localPlayer.character]} `;
  localPlayer.speech = '';
  localPlayer.speechUntil = 0;
  saveSession();
  sendState();
}

function receive(connection, payload) {
  if (!payload || !payload.type) return;
  if (payload.type === 'leave') {
    remotePlayers.delete(payload.playerId);
    renderPlayers();
    if (isHost) broadcast(payload, connection.peer);
    return;
  }
  if (payload.type === 'state') {
    const previous = remotePlayers.get(payload.player.id);
    const player = {
      ...payload.player,
      speech: previous?.speech || '',
      speechUntil: previous?.speechUntil || 0,
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
    remotePlayers.forEach((player, playerId) => {
      if (player.peerId === connection.peer) remotePlayers.delete(playerId);
    });
    connections.delete(connection.peer);
    renderPlayers();
  });
}

let leaveSent = false;
function sendLeave() {
  if (leaveSent) return;
  leaveSent = true;
  const payload = { type: 'leave', playerId: localPlayer.id };
  if (isHost) broadcast(payload);
  else if (hostConnection?.open) hostConnection.send(payload);
}

function createPeer() {
  if (!window.Peer) { setStatus('Mode solo'); return; }
  const hostId = `noelle-meadow-${ROOM_ID}`;
  peer = new Peer(hostId);
  peer.on('open', () => { isHost = true; setStatus('Prairie partagée', 'online'); });
  peer.on('connection', (connection) => { wireConnection(connection); connection.on('open', () => connection.send({ type: 'snapshot', players: [...remotePlayers.values(), localPlayer] })); });
  peer.on('error', (error) => {
    if (error.type === 'unavailable-id') connectToHost(hostId);
    else setStatus('Mode solo');
  });
}

function connectToHost(hostId) {
  peer?.destroy(); peer = new Peer();
  peer.on('open', () => { hostConnection = peer.connect(hostId, { reliable: true }); wireConnection(hostConnection); hostConnection.on('open', () => { hostConnection.send({ type: 'hello', player: localPlayer }); setStatus('Prairie partagée', 'online'); }); });
  peer.on('error', () => setStatus('Prairie indisponible'));
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
window.addEventListener('pagehide', sendLeave);
window.addEventListener('beforeunload', sendLeave);
chatForm.addEventListener('submit', sendChatMessage);
characterSwitch.addEventListener('click', switchCharacter);
eggReward.addEventListener('click', openEgg);
eggClose.addEventListener('click', closeEgg);
eggModal.querySelector('.egg-modal-backdrop').addEventListener('click', closeEgg);
eggImage.addEventListener('click', hitEgg);
eggImage.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hitEgg(); }
});
setInterval(sendState, 100);
setInterval(updateRewardUi, 1000);
characterSwitch.firstChild.textContent = { noelle: 'Noelle ', 'noelle-alt': 'Noelle Alt ', spamton: 'Spamton ', temmie: 'Temmie ', asgore: 'Asgore ' }[localPlayer.character];
resize(); renderPlayers(); updateRewardUi(); setStatus('Connexion...'); createPeer(); requestAnimationFrame(frame);
