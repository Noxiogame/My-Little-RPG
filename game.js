const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
const roomInput = document.querySelector('#room');
const connectButton = document.querySelector('#connect');
const status = document.querySelector('#status');
const statusText = document.querySelector('#status-text');
const playersElement = document.querySelector('#players');
const joystick = document.querySelector('#joystick');
const stick = document.querySelector('#stick');

const directions = ['down', 'left', 'right', 'up'];
const sprites = Object.fromEntries(directions.map((direction) => [direction, [1, 2, 3, 4].map((frame) => {
  const image = new Image();
  image.src = `noelle_${direction}${frame}.png`;
  return image;
})]));

const localPlayer = { id: `player-${Math.random().toString(36).slice(2, 8)}`, x: .5, y: .55, direction: 'down', moving: false };
const remotePlayers = new Map();
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
  const imageFrames = sprites[player.direction] || sprites.down;
  const frame = player.moving ? Math.floor(animationTime / 120) % 4 : 0;
  const image = imageFrames[frame];
  const size = Math.max(48, Math.min(92, viewport.width * .075));
  const x = player.x * viewport.width;
  const y = player.y * viewport.height;
  context.save();
  context.globalAlpha = isLocal ? 1 : .9;
  context.fillStyle = 'rgba(10, 26, 24, .26)';
  context.beginPath(); context.ellipse(x, y + size * .34, size * .27, size * .11, 0, 0, Math.PI * 2); context.fill();
  if (image.complete) context.drawImage(image, x - size / 2, y - size / 2, size, size);
  if (isLocal) { context.fillStyle = '#b9e7b1'; context.beginPath(); context.arc(x, y - size * .58, 3, 0, Math.PI * 2); context.fill(); }
  context.restore();
}

function draw() {
  drawWorld();
  remotePlayers.forEach((player) => drawPlayer(player));
  drawPlayer(localPlayer, true);
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

function receive(connection, payload) {
  if (!payload || !payload.type) return;
  if (payload.type === 'state') {
    remotePlayers.set(payload.player.id, { ...payload.player, peerId: connection.peer });
    if (isHost) broadcast(payload, connection.peer);
    renderPlayers();
  }
  if (payload.type === 'hello' && isHost) {
    connection.send({ type: 'snapshot', players: [...remotePlayers.values(), localPlayer] });
    broadcast({ type: 'state', player: localPlayer }, connection.peer);
  }
  if (payload.type === 'snapshot') payload.players.forEach((player) => { if (player.id !== localPlayer.id) remotePlayers.set(player.id, player); });
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
window.addEventListener('keydown', (event) => keys.add(event.key.toLowerCase()));
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('resize', resize);
connectButton.addEventListener('click', connectRoom);
roomInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') connectRoom(); });
setInterval(sendState, 100);
resize(); renderPlayers(); requestAnimationFrame(frame);