const canvas = document.querySelector('#game');
const context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
const APP_VERSION = '2026.09.11.213000';
const VERSION_CHECK_INTERVAL = 15000;
const VERSION_RELOAD_KEY = 'prairie-last-reloaded-version';
const appVersionBadge = document.querySelector('#app-version-badge');
const SUPABASE_URL = 'https://izqjuvgwlienoxjbftle.supabase.co';
let versionMismatchTriggered = false;
const SUPABASE_KEY = 'sb_publishable_7O1ZXIgr6kKHJVrYjoq7cg_1n2fi36Y';
const authClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
const authSessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
let authPresenceChannel = null;
let authUserId = null;
let authSessionLost = false;
let isAuthenticated = false;
const gameShell = document.querySelector('.game-shell');
const joystick = document.querySelector('#joystick');
const stick = document.querySelector('#stick');
const chatMessages = document.querySelector('#chat-messages');
const chatEmpty = document.querySelector('#chat-empty');
const chatForm = document.querySelector('#chat-form');
const chatInput = document.querySelector('#chat-input');
const speechBubbles = document.querySelector('#speech-bubbles');
const eggReward = document.querySelector('#egg-reward');
const eggCooldown = document.querySelector('#egg-cooldown');
const eggModal = document.querySelector('#egg-modal');
const eggClose = document.querySelector('#egg-close');
const eggImage = document.querySelector('#egg-image');
const eggShard = document.querySelector('#egg-shard');
const eggProgress = document.querySelector('#egg-progress');
const eggResult = document.querySelector('#egg-result');
const skinModal = document.querySelector('#skin-modal');
const skinClose = document.querySelector('#skin-close');
const skinList = document.querySelector('#skin-list');
const skinResult = document.querySelector('#skin-result');
const coinAmount = document.querySelector('#coin-amount');
const skinCoinAmount = document.querySelector('#skin-coin-amount');
const chatToggle = document.querySelector('#chat-toggle');
const chatPanel = document.querySelector('.chat-panel');
const reloadButton = document.querySelector('#reload-button');
const mainMenu = document.querySelector('#main-menu');
const authChoice = document.querySelector('#auth-choice');
const showLogin = document.querySelector('#show-login');
const showCreate = document.querySelector('#show-create');
const authForm = document.querySelector('#auth-form');
const authFormTitle = document.querySelector('#auth-form-title');
mainMenu.hidden = true;
authForm.hidden = true;
authChoice.hidden = false;
const backAuth = document.querySelector('#back-auth');
const closeAuth = document.querySelector('#close-auth');
const newAccountName = document.querySelector('#new-account-name');
const createAccount = document.querySelector('#create-account');
const menuMessage = document.querySelector('#menu-message');
const accountButton = document.querySelector('#account-button');
const accountName = document.querySelector('#account-name');
const accountModal = document.querySelector('#account-modal');
const accountClose = document.querySelector('#account-close');
const accountModalName = document.querySelector('#account-modal-name');
const accountCoins = document.querySelector('#account-coins');
const accountNickname = document.querySelector('#account-nickname');
const saveNickname = document.querySelector('#save-nickname');
const accountSkins = document.querySelector('#account-skins');
const accountLogout = document.querySelector('#account-logout');
const loginIdentifier = document.querySelector('#login-identifier');
const loginPassword = document.querySelector('#login-password');
const loginAccount = document.querySelector('#login-account');
const openMenuSkins = document.querySelector('#open-menu-skins');
const TILE_SIZE = 20;
const WORLD_SIZE = { width: 2520, height: 1200 };
const MIN_CAMERA_ZOOM = .75;
const MAX_CAMERA_ZOOM = 2.5;
let cameraZoom = 1.35;
const PLAYER_SPEED = 100;
const ROOM_ID = 'prairie';
const TILE_TEXTURE_NAMES = ['0011', '0110', '0111', '1001', '1011', '1100', '1101', '1110', '1111'];
const SIDEWALK_TEXTURE_NAMES = ['0001', '0010', '0011', '0100', '0101', '0110', '1000', '1001', '1010', '1100'];
const tileTextures = { grass: {}, road: {}, sidewalk: {} };

function updateVersionBadge(version = APP_VERSION) {
  if (appVersionBadge) appVersionBadge.textContent = `v${version}`;
}

function buildReloadUrl(version = APP_VERSION) {
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('v', version);
  nextUrl.searchParams.set('reload', Date.now().toString());
  return nextUrl.toString();
}

function reloadGameSafely() {
  if (versionMismatchTriggered) return;
  versionMismatchTriggered = true;
  console.warn('Reloading the game safely.');
  if (peer) {
    try { peer.destroy(); } catch {}
    peer = null;
  }
  closeAllConnections();
  localStorage.setItem('app-last-version', APP_VERSION);
  window.location.replace(buildReloadUrl(APP_VERSION));
}

function forceVersionReload(version = APP_VERSION, reason = 'Une mise à jour du jeu est disponible.') {
  if (versionMismatchTriggered) return;
  if (sessionStorage.getItem(VERSION_RELOAD_KEY) === version) return;
  versionMismatchTriggered = true;
  sessionStorage.setItem(VERSION_RELOAD_KEY, version);
  console.warn(`${reason} Reloading to version ${version}.`);
  if (peer) {
    try { peer.destroy(); } catch {}
    peer = null;
  }
  closeAllConnections();
  localStorage.setItem('app-last-version', version);
  window.location.replace(buildReloadUrl(version));
}

async function checkForGameVersion() {
  updateVersionBadge();

  const currentQueryVersion = new URLSearchParams(window.location.search).get('v');
  if (currentQueryVersion && currentQueryVersion === APP_VERSION) {
    return;
  }

  try {
    const response = await fetch(`version.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;

    const { version } = await response.json();
    if (!version) return;

    updateVersionBadge(version);

    if (version !== APP_VERSION) {
      console.warn(`Old game version detected: ${APP_VERSION} -> ${version}. Reloading...`);
      addChatMessage('Une nouvelle version du jeu est disponible. Recharge en cours…', 'Prairie');
      // Jitter avoids every connected client reloading (and dropping the P2P mesh) at the exact same instant.
      setTimeout(() => forceVersionReload(version, 'Version du jeu obsolète.'), 1500 + Math.random() * 4000);
    }
  } catch (error) {
    console.warn('Impossible de verifier la version du jeu.', error);
  }
}

function handleVersionMismatch(remoteVersion, source = 'remote') {
  const message = source === 'peer'
    ? 'Un autre joueur utilise une version différente. La session continue sans lui.'
    : `Version du jeu différente (${APP_VERSION} vs ${remoteVersion}).`;
  addChatMessage(message, 'Prairie');
  if (source === 'remote') {
    setTimeout(() => reloadGameSafely(), 1200);
  }
}

function sendVersionAwareReload() {
  if (connections.size > 0 || hostConnection) {
    closeAllConnections();
    addChatMessage('Déconnexion de la prairie pour actualiser proprement le jeu…', 'Prairie');
  }
  reloadGameSafely();
}

function loadTileTexture(type, mask, variation = '') {
  const image = new Image();
  const separator = type === 'grass' ? '_' : '';
  const folder = type === 'grass' ? 'Grass' : type === 'sidewalk' ? '' : 'Road';
  const fileName = type === 'sidewalk' ? `sidewalk${mask}${variation}.png` : `${type}${separator}${mask}${variation}.png`;
  image.src = type === 'grass' || type === 'road' ? `Tilesets/${folder}/${fileName}` : `${fileName}`;
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
SIDEWALK_TEXTURE_NAMES.forEach((mask) => {
  tileTextures.sidewalk[mask] = [loadTileTexture('sidewalk', mask)];
});
const roadFallback = new Image();
roadFallback.src = 'Tilesets/Road/road.png';
roadFallback.addEventListener('load', () => requestAnimationFrame(draw));
const loadAssetImage = (src) => {
  const image = new Image();
  image.src = src;
  image.addEventListener('load', () => requestAnimationFrame(draw));
  return image;
};
const houseTextures = {
  house: loadAssetImage('Houses/house.png'),
  house2: loadAssetImage('Houses/house2.png'),
  house3: loadAssetImage('Houses/house3.png'),
};
const talkboxTextures = Object.fromEntries(['corner', 'side', 'interior'].map((name) => {
  const image = new Image();
  image.src = `Characters/Noelle/talkbox_ui_${name}.png`;
  image.addEventListener('load', () => requestAnimationFrame(draw));
  return [name, image];
}));

const directions = ['down', 'left', 'right', 'up'];

const skinPaths = {
  noelle: { folder: 'Characters/Noelle', prefix: 'noelle' },
  'noelle-alt': { folder: 'Characters/Noelle/Alt', prefix: 'noelle_alt' },
  frisk: { folder: 'Characters/Frisk', prefix: 'frisk' },
  spamton: { folder: 'Characters/Spamton', prefix: 'spamton' },
  temmie: { folder: 'Characters/Temmie', prefix: 'temmie' },
  asgore: { folder: 'Characters/Asgore', prefix: 'asgore' },
  jevil: { folder: 'Characters/Jevil', prefix: 'jevil' },
  papyrus: { folder: 'Characters/Papyrus', prefix: 'papyrus' },
  sans: { folder: 'Characters/Sans', prefix: 'sans' },
  undyne: { folder: 'Characters/Undyne', prefix: 'undyne' },
  foxy: { folder: 'Characters/Foxy', prefix: 'foxy' },
  pikachu: { folder: 'Characters/Pikachu', prefix: 'pikachu' },
  puppet: { folder: 'Characters/Puppet', prefix: 'puppet' },
  'withered-bonnie': { folder: 'Characters/WitheredBonnie', prefix: 'withered_bonnie' },
  villager: { folder: 'Characters/Villageois', prefix: 'villager' },
  'rouxls-kaard': { folder: 'Characters/Rouxls', prefix: 'rouxls_kaard' },
};

const characterSprites = Object.fromEntries(
  Object.keys(skinPaths).map((character) => [character, Object.fromEntries(directions.map((direction) => [direction, []]))]),
);
const spriteLoadPromises = new Map();

function createSprite(character, direction, frame) {
  const image = new Image();
  const skin = skinPaths[character] || skinPaths.noelle;
  const folder = skin.folder ? `${skin.folder}/` : '';
  const prefix = skin.prefix;
  image.src = `${folder}${prefix}_${direction}${frame}.png`;
  return image;
}

function getSpriteFrameCount(character, direction) {
  const frames = characterSprites?.[character]?.[direction];
  return Array.isArray(frames) ? frames.length : 0;
}

function probeSpriteFrame(character, direction, frame) {
  return new Promise((resolve) => {
    const image = createSprite(character, direction, frame);
    const finalize = () => resolve(image.complete && image.naturalWidth > 0 ? image : null);
    image.addEventListener('load', finalize, { once: true });
    image.addEventListener('error', () => resolve(null), { once: true });
    if (image.complete) finalize();
  });
}

async function loadCharacterSpriteDirection(character, direction) {
  const frames = [];
  const maxFrames = 12;
  for (let frame = 1; frame <= maxFrames; frame += 1) {
    const sprite = await probeSpriteFrame(character, direction, frame);
    if (!sprite) break;
    frames.push(sprite);
  }
  characterSprites[character][direction] = frames;
  return frames;
}

function ensureCharacterSprites(character) {
  if (!character || !characterSprites[character]) return Promise.resolve(characterSprites[character]);
  if (spriteLoadPromises.has(character)) return spriteLoadPromises.get(character);
  const loadPromise = Promise.all(directions.map((direction) => loadCharacterSpriteDirection(character, direction)))
    .then((results) => Object.fromEntries(directions.map((direction, index) => [direction, results[index]])))
    .finally(() => spriteLoadPromises.delete(character));
  spriteLoadPromises.set(character, loadPromise);
  return loadPromise;
}

function getAnimationFrameIndex(player, frames = []) {
  if (!player?.moving || !player?.character || !Array.isArray(frames) || frames.length === 0) return 0;
  const frameCount = frames.length;
  const speedRatio = Number.isFinite(player.movementSpeed) ? Math.max(.2, Math.min(1.75, player.movementSpeed)) : 1;
  const frameDuration = 240 / speedRatio;
  const animationOffset = Number.isFinite(player.animationOffset) ? player.animationOffset : 0;
  return Math.floor((animationTime + animationOffset) / frameDuration) % frameCount;
}

function updateSkinLibraryAnimations() {
  if (!skinList) return;
  const previews = skinList.querySelectorAll('.skin-preview');
  previews.forEach((preview) => {
    const skinId = preview.dataset.skinId;
    const selectedSprites = characterSprites[skinId] || characterSprites.noelle;
    const frames = selectedSprites.down || [];
    if (!frames.length) {
      ensureCharacterSprites(skinId);
      return;
    }
    const frameCount = frames.length;
    const frameIndex = Math.floor(animationTime / 180) % frameCount;
    const image = frames[frameIndex] || frames[0];
    if (image) preview.src = image.src;
  });
}

const eggTextures = {
  stages: ['Tilesets/pipis.png', 'Tilesets/pipis_break1.png', 'Tilesets/pipis_break2.png', 'Tilesets/pipis_break3.png'],
  broken: 'Tilesets/pipis_broken.png',
  left: 'Tilesets/pipis_broken_left.png',
  right: 'Tilesets/pipis_broken_right.png',
  shards: ['Tilesets/pipis_shard1.png', 'Tilesets/pipis_shard2.png', 'Tilesets/pipis_shard3.png'],
};
const eggRarities = ['Commun', 'Non commun', 'Rare', 'Légendaire'];
const eggRewards = [8, 15, 24, 36, 52, 73, 100, 135, 180, 240, 340, 500];
const eggBreakChance = .3;

function getEggRewardForLevel(level) {
  if (!level) return 0;
  const index = Math.min(level, eggRewards.length) - 1;
  return eggRewards[index] ?? eggRewards[eggRewards.length - 1];
}
const skins = [
  { id: 'noelle', label: 'Noelle', rarity: 'Commun', price: 0 },
  { id: 'noelle-alt', label: 'Noelle Alt', rarity: 'Non commun', price: 60 },
  { id: 'frisk', label: 'Frisk', rarity: 'Rare', price: 220 },
  { id: 'villager', label: 'Villageois', rarity: 'Non commun', price: 90 },
  { id: 'temmie', label: 'Temmie', rarity: 'Rare', price: 120 },
  { id: 'spamton', label: 'Spamton', rarity: 'Légendaire', price: 450 },
  { id: 'asgore', label: 'Asgore', rarity: 'Légendaire', price: 350 },
  { id: 'jevil', label: 'Jevil', rarity: 'Légendaire', price: 450 },
  { id: 'papyrus', label: 'Papyrus', rarity: 'Rare', price: 180 },
  { id: 'sans', label: 'Sans', rarity: 'Rare', price: 180 },
  { id: 'undyne', label: 'Undyne', rarity: 'Rare', price: 180 },
  { id: 'foxy', label: 'Foxy', rarity: 'Rare', price: 150 },
  { id: 'pikachu', label: 'Pikachu', rarity: 'Légendaire', price: 400 },
  { id: 'puppet', label: 'Puppet', rarity: 'Rare', price: 250 },
  { id: 'withered-bonnie', label: 'Withered Bonnie', rarity: 'Légendaire', price: 520 },
  { id: 'rouxls-kaard', label: 'Rouxls Kaard', rarity: 'Légendaire', price: 500 },
];
const sessionStorageKey = 'noelle-meadow-session-v1';
const accountsStorageKey = 'noelle-meadow-accounts-v1';
const activeAccountStorageKey = 'noelle-meadow-active-account-v1';
const session = loadSession();
const eggState = { hits: 0, open: false, broken: false, cooldownUntil: session.cooldownUntil, shardTimer: null };

function loadSession() {
  try {
    const legacy = JSON.parse(localStorage.getItem(sessionStorageKey) || '{}');
    const accounts = JSON.parse(localStorage.getItem(accountsStorageKey) || '{}');
    let activeName = localStorage.getItem(activeAccountStorageKey);
    if (!Object.keys(accounts).length && Object.keys(legacy).length) {
      accounts.Joueur = legacy;
      localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
    }
    if (!activeName || !accounts[activeName]) activeName = Object.keys(accounts)[0] || 'Joueur';
    const saved = accounts[activeName] || {};
    const ownedSkins = Array.isArray(saved.ownedSkins) ? saved.ownedSkins.filter((id) => skins.some((skin) => skin.id === id)) : [];
    if (!ownedSkins.includes('noelle')) ownedSkins.unshift('noelle');
    if (accounts[activeName]) localStorage.setItem(activeAccountStorageKey, activeName);
    return { accountName: activeName, nickname: saved.nickname || activeName, coins: Number.isFinite(saved.coins) ? saved.coins : 0, cooldownUntil: Number.isFinite(saved.cooldownUntil) ? saved.cooldownUntil : 0, character: ownedSkins.includes(saved.character) ? saved.character : 'noelle', ownedSkins };
  } catch {
    return { accountName: 'Joueur', nickname: 'Joueur', coins: 0, cooldownUntil: 0, character: 'noelle', ownedSkins: ['noelle'] };
  }
}

function saveSession() {
  try {
    const accountData = {
      nickname: session.nickname,
      coins: session.coins,
      cooldownUntil: eggState.cooldownUntil,
      character: localPlayer.character,
      ownedSkins: session.ownedSkins,
    };
    const accounts = JSON.parse(localStorage.getItem(accountsStorageKey) || '{}');
    accounts[session.accountName] = accountData;
    localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
    localStorage.setItem(activeAccountStorageKey, session.accountName);
    if (authClient) saveRemoteSession().catch(() => {});
  } catch {
    // Storage can be unavailable in private browsing; the session remains usable.
  }
}

function authEmail(identifier) {
  return `${identifier.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@accounts.laprairie.game`;
}

function showAuthError(error) {
  const message = `${error?.code || ''} ${error?.message || ''}`.toLowerCase();
  if (message.includes('already registered') || message.includes('already exists') || message.includes('duplicate')) return 'Cet identifiant est déjà utilisé.';
  if (message.includes('invalid login') || message.includes('invalid credentials') || message.includes('invalid')) return 'Identifiant ou mot de passe incorrect.';
  if (message.includes('email not confirmed') || message.includes('not confirmed')) return 'Ce compte n’est pas encore activé. Réessayez après l’activation du service de comptes.';
  if (message.includes('password') && (message.includes('short') || message.includes('least'))) return 'Le mot de passe doit contenir au moins 8 caractères.';
  if (message.includes('rate limit') || message.includes('too many')) return 'Trop de tentatives. Patientez un instant avant de réessayer.';
  return 'Impossible de terminer cette action. Vérifiez vos informations et réessayez.';
}

async function releaseAuthSession(message = '') {
  authSessionLost = true;
  if (authPresenceChannel) {
    await authPresenceChannel.untrack().catch(() => {});
    await authClient.removeChannel(authPresenceChannel);
    authPresenceChannel = null;
  }
  await authClient.auth.signOut({ scope: 'local' }).catch(() => {});
  localStorage.removeItem(activeAccountStorageKey);
  isAuthenticated = false;
  mainMenu.hidden = true;
  updateAccountUi();
  hideAuthForm();
  if (message) menuMessage.textContent = message;
}

async function claimAuthSession(userId) {
  if (!authClient || !userId) return true;
  authUserId = userId;
  authSessionLost = false;
  const channelName = `account-session:${userId}`;
  authPresenceChannel = authClient.channel(channelName, { config: { presence: { key: authSessionId } } });
  authPresenceChannel.on('broadcast', { event: 'claim' }, ({ payload }) => {
    if (payload?.sessionId && payload.sessionId !== authSessionId && payload.sessionId < authSessionId) {
      releaseAuthSession('Ce compte est déjà ouvert sur un autre appareil.');
    }
  });
  const subscribeStatus = await new Promise((resolve) => {
    authPresenceChannel.subscribe((status) => resolve(status));
  });
  if (subscribeStatus !== 'SUBSCRIBED') {
    await authClient.removeChannel(authPresenceChannel);
    authPresenceChannel = null;
    return true;
  }
  const existingSessions = Object.keys(authPresenceChannel.presenceState()).filter((key) => key !== authSessionId);
  const winner = [authSessionId, ...existingSessions].sort()[0];
  if (winner !== authSessionId) {
    await releaseAuthSession('Ce compte est déjà ouvert sur un autre appareil.');
    return false;
  }
  await authPresenceChannel.track({ sessionId: authSessionId, joinedAt: Date.now() });
  await authPresenceChannel.send({ type: 'broadcast', event: 'claim', payload: { sessionId: authSessionId } });
  return true;
}

async function loadRemoteSession(user) {
  if (!authClient) return;
  const [{ data: profile }, { data: playerData }] = await Promise.all([
    authClient.from('profiles').select('login_id,nickname').eq('user_id', user.id).single(),
    authClient.from('player_data').select('coins,cooldown_until,equipped_skin,owned_skins').eq('user_id', user.id).single(),
  ]);
  if (profile) {
    session.accountName = profile.login_id;
    session.nickname = profile.nickname || profile.login_id;
  }
  if (playerData) {
    session.coins = Number.isFinite(playerData.coins) ? playerData.coins : 0;
    session.cooldownUntil = playerData.cooldown_until ? new Date(playerData.cooldown_until).getTime() : 0;
    session.character = skins.some((skin) => skin.id === playerData.equipped_skin) ? playerData.equipped_skin : 'noelle';
    session.ownedSkins = Array.isArray(playerData.owned_skins) ? playerData.owned_skins.filter((id) => skins.some((skin) => skin.id === id)) : ['noelle'];
    if (!session.ownedSkins.includes('noelle')) session.ownedSkins.unshift('noelle');
    localPlayer.character = session.character;
    eggState.cooldownUntil = session.cooldownUntil;
  }
  localStorage.setItem(activeAccountStorageKey, session.accountName);
  updateAccountUi();
  updateRewardUi();
}

async function saveRemoteSession() {
  if (authSessionLost || !authClient) return;
  const { data: authData } = await authClient.auth.getUser();
  if (!authData.user) return;
  await authClient.from('profiles').update({ nickname: session.nickname, updated_at: new Date().toISOString() }).eq('user_id', authData.user.id);
  await authClient.from('player_data').upsert({ user_id: authData.user.id, coins: session.coins, cooldown_until: eggState.cooldownUntil ? new Date(eggState.cooldownUntil).toISOString() : null, equipped_skin: localPlayer.character, owned_skins: session.ownedSkins, updated_at: new Date().toISOString() });
}

function updateAccountUi() {
  accountName.textContent = isAuthenticated ? session.accountName : 'Invité';
  accountModalName.textContent = session.accountName;
  accountCoins.textContent = session.coins;
  accountNickname.value = session.nickname;
}

function enterGame() {
  localStorage.setItem(activeAccountStorageKey, session.accountName);
  saveSession();
  mainMenu.hidden = true;
  updateAccountUi();
}

function showAuthForm(mode) {
  const creating = mode === 'create';
  authChoice.hidden = true;
  authForm.hidden = false;
  authFormTitle.textContent = creating ? 'Créer un compte' : 'Se connecter';
  loginAccount.hidden = creating;
  createAccount.hidden = !creating;
  newAccountName.hidden = !creating;
  menuMessage.textContent = '';
  loginIdentifier.focus();
}

function hideAuthForm() {
  authForm.hidden = true;
  authChoice.hidden = false;
  menuMessage.textContent = '';
}

function closeAuthWindow() {
  hideAuthForm();
  mainMenu.hidden = true;
  menuMessage.textContent = '';
}

function createLocalAccount() {
  const name = newAccountName.value.trim().replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 18);
  if (name.length < 2) {
    menuMessage.textContent = 'Choisissez un nom de 2 caractères minimum.';
    return;
  }
  const accounts = JSON.parse(localStorage.getItem(accountsStorageKey) || '{}');
  if (accounts[name]) {
    menuMessage.textContent = 'Ce compte existe déjà.';
    return;
  }
  accounts[name] = { coins: 0, cooldownUntil: 0, character: 'noelle', ownedSkins: ['noelle'] };
  localStorage.setItem(accountsStorageKey, JSON.stringify(accounts));
  localStorage.setItem(activeAccountStorageKey, name);
  session.accountName = name;
  session.nickname = name;
  session.coins = 0;
  session.cooldownUntil = 0;
  session.character = 'noelle';
  session.ownedSkins = ['noelle'];
  localPlayer.character = 'noelle';
  updateAccountUi();
  mainMenu.hidden = true;
}

function openAccount() {
  if (!isAuthenticated) {
    mainMenu.hidden = false;
    hideAuthForm();
    showLogin.focus();
    return;
  }
  updateAccountUi();
  accountModal.hidden = false;
  accountClose.focus();
}

function closeAccount() {
  accountModal.hidden = true;
}

function toggleChat() {
  const isOpen = !chatPanel.hidden;
  chatPanel.hidden = isOpen;
  chatToggle.setAttribute('aria-expanded', String(!isOpen));
  chatToggle.setAttribute('aria-label', isOpen ? 'Ouvrir le tchat' : 'Fermer le tchat');
  if (!isOpen) chatInput.focus();
}

function logoutAccount() {
  const logout = authClient ? authClient.auth.signOut({ scope: 'local' }) : Promise.resolve();
  logout.finally(() => {
    if (authPresenceChannel) authClient.removeChannel(authPresenceChannel);
    authPresenceChannel = null;
    authUserId = null;
    authSessionLost = false;
    isAuthenticated = false;
    localStorage.removeItem(activeAccountStorageKey);
    mainMenu.hidden = true;
    accountModal.hidden = true;
    updateAccountUi();
  });
}

async function signInAccount() {
  const identifier = loginIdentifier.value.trim();
  const password = loginPassword.value;
  if (!identifier || password.length < 8) {
    menuMessage.textContent = 'Identifiant et mot de passe de 8 caractères minimum requis.';
    return;
  }
  loginAccount.disabled = true;
  const { data, error } = await authClient.auth.signInWithPassword({ email: authEmail(identifier), password });
  if (error) menuMessage.textContent = showAuthError(error);
  else if (data.user) {
    await loadRemoteSession(data.user);
    if (await claimAuthSession(data.user.id)) {
      isAuthenticated = true;
      mainMenu.hidden = true;
      updateAccountUi();
    }
  }
  loginAccount.disabled = false;
}

async function createRemoteAccount() {
  const nickname = newAccountName.value.trim();
  const identifier = loginIdentifier.value.trim();
  const password = loginPassword.value;
  if (nickname.length < 2 || identifier.length < 3 || password.length < 8) {
    menuMessage.textContent = 'Pseudo, identifiant et mot de passe valide requis.';
    return;
  }
  createAccount.disabled = true;
  const { data, error } = await authClient.auth.signUp({ email: authEmail(identifier), password, options: { data: { login_id: identifier, nickname } } });
  if (error) {
    menuMessage.textContent = showAuthError(error);
  } else if (data.session) {
    await loadRemoteSession(data.session.user);
    if (await claimAuthSession(data.session.user.id)) {
      isAuthenticated = true;
      mainMenu.hidden = true;
      updateAccountUi();
    }
  } else {
    menuMessage.textContent = 'Compte créé. Connectez-vous avec votre identifiant.';
  }
  createAccount.disabled = false;
}

async function saveAccountNickname() {
  const nickname = accountNickname.value.trim();
  if (nickname.length < 2) return;
  session.nickname = nickname;
  saveSession();
  updateAccountUi();
}

async function initializeAuth() {
  if (!authClient) {
    mainMenu.hidden = true;
    return;
  }
  const { data } = await authClient.auth.getSession();
  if (data.session) {
    await loadRemoteSession(data.session.user);
    if (!await claimAuthSession(data.session.user.id)) return;
    isAuthenticated = true;
    updateAccountUi();
    mainMenu.hidden = true;
  } else {
    isAuthenticated = false;
    updateAccountUi();
    mainMenu.hidden = true;
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
  skinCoinAmount.textContent = session.coins;
  eggCooldown.textContent = available ? 'Disponible' : `Prochain Pipis dans ${formatCooldown()}`;
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
  const reward = getEggRewardForLevel(eggState.hits);
  session.coins += reward;
  eggState.cooldownUntil = Date.now() + 120000;
  saveSession();
  updateRewardUi();
  eggImage.src = eggTextures.broken;
  eggImage.alt = 'Oeuf brisé';
  eggImage.setAttribute('aria-disabled', 'true');
  eggResult.textContent = `Pipis gagnés : +${reward} pièces`;
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
  const reward = getEggRewardForLevel(eggState.hits);
  const stage = Math.min(3, Math.floor(eggState.hits / 3));
  setEggStage(stage);
  if (eggState.hits % 3 === 0 && stage > 0) showEggShard(stage);
  if (eggState.hits === 12) {
    eggResult.textContent = `Dernier niveau ! Potentiel : +${reward} pièces`;
    breakEgg();
    return;
  }
  if (Math.random() < eggBreakChance) breakEgg();
  else eggResult.textContent = `Gain potentiel : +${reward} pièces`;
}

function getPlayerAnimationOffset(playerId = '') {
  let hash = 0;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = (hash * 31 + playerId.charCodeAt(index)) >>> 0;
  }
  return (hash % 3000) + 1;
}

const localPlayer = { id: `player-${Math.random().toString(36).slice(2, 8)}`, x: .55, y: .62, direction: 'down', moving: false, character: session.character, animationOffset: getPlayerAnimationOffset(`local-${Math.random().toString(36).slice(2, 8)}`) };
const remotePlayers = new Map();
const speechElements = new Map();
const connections = new Map();
const keys = new Set();
const joystickInput = { x: 0, y: 0, active: false, pointerId: null };
const zoomPointers = new Map();
let pinchDistance = null;
let peer = null;
let hostConnection = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

function scheduleReconnect(immediate = false) {
  if (reconnectTimer) return;
  reconnectAttempts += 1;
  const delay = immediate ? 400 : Math.min(1500 * reconnectAttempts, 8000);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (versionMismatchTriggered) return;
    if (!isHost && (!hostConnection || !hostConnection.open)) createPeer();
  }, delay);
}
let isHost = false;
let lastTime = performance.now();
let animationTime = 0;
let viewport = { width: 0, height: 0, dpr: 1 };
let worldMap = [];
let worldSize = { width: 0, height: 0 };
const camera = { x: .5, y: .55 };
const houseStructures = [
  { id: 'house-1', texture: houseTextures.house, anchorX: 420 - 2 * TILE_SIZE, anchorY: 610 + 2 * TILE_SIZE, baseWidth: 120, baseHeight: 54, visualWidth: 120, visualHeight: 100, hitbox: { left: 0, top: 0, right: 0, bottom: 0 } },
  { id: 'house-2', texture: houseTextures.house2, anchorX: 700 - 2 * TILE_SIZE, anchorY: 610 + 2 * TILE_SIZE, baseWidth: 128, baseHeight: 58, visualWidth: 128, visualHeight: 104, hitbox: { left: 0, top: 0, right: 0, bottom: 0 } },
  { id: 'house-3', texture: houseTextures.house3, anchorX: 980 - 2 * TILE_SIZE, anchorY: 610 + 2 * TILE_SIZE, baseWidth: 138, baseHeight: 60, visualWidth: 138, visualHeight: 110, hitbox: { left: 0, top: 0, right: 0, bottom: 0 } },
  { id: 'house-4', texture: houseTextures.house2, anchorX: 1280 - 2 * TILE_SIZE, anchorY: 610 + 2 * TILE_SIZE, baseWidth: 128, baseHeight: 55, visualWidth: 128, visualHeight: 102, hitbox: { left: 0, top: 0, right: 0, bottom: 0 } },
  { id: 'house-5', texture: houseTextures.house, anchorX: 1600 - 2 * TILE_SIZE, anchorY: 610 + 2 * TILE_SIZE, baseWidth: 120, baseHeight: 52, visualWidth: 120, visualHeight: 100, hitbox: { left: 0, top: 0, right: 0, bottom: 0 } },
  { id: 'house-6', texture: houseTextures.house3, anchorX: 1900 - 2 * TILE_SIZE, anchorY: 610 + 2 * TILE_SIZE, baseWidth: 138, baseHeight: 60, visualWidth: 138, visualHeight: 110, hitbox: { left: 0, top: 0, right: 0, bottom: 0 } },
];

function updateHouseStructureBounds() {
  houseStructures.forEach((structure) => {
    const texture = structure.texture && structure.texture.complete && structure.texture.naturalWidth > 0 ? structure.texture : houseTextures.house;
    structure.visualWidth = texture.naturalWidth > 0 ? texture.naturalWidth : structure.baseWidth;
    structure.visualHeight = texture.naturalHeight > 0 ? texture.naturalHeight : structure.baseHeight + 48;
    structure.hitbox.left = structure.anchorX - structure.baseWidth / 2;
    structure.hitbox.right = structure.anchorX + structure.baseWidth / 2;
    structure.hitbox.top = structure.anchorY - structure.baseHeight;
    structure.hitbox.bottom = structure.anchorY;
  });
}

function createWorldMap() {
  worldSize = WORLD_SIZE;
  const columns = Math.ceil(worldSize.width / TILE_SIZE) + 1;
  const rows = Math.ceil(worldSize.height / TILE_SIZE) + 1;
  const map = Array.from({ length: rows }, () => Array(columns).fill('grass'));

  const roadCenterX = Math.floor(columns * .55);
  const roadCenterY = Math.floor(rows * .58);
  const roadWidth = 3;
  const roadHalfWidth = Math.floor(roadWidth / 2);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const onHorizontalRoad = Math.abs(row - roadCenterY) <= roadHalfWidth;
      const onVerticalRoad = Math.abs(column - roadCenterX) <= roadHalfWidth;
      if (onHorizontalRoad || onVerticalRoad) {
        map[row][column] = 'road';
      }
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (map[row][column] !== 'road') continue;
      const neighbors = [
        [row - 1, column], [row + 1, column],
        [row, column - 1], [row, column + 1],
      ];
      neighbors.forEach(([targetRow, targetColumn]) => {
        if (!map[targetRow]?.[targetColumn]) return;
        if (map[targetRow][targetColumn] === 'grass') map[targetRow][targetColumn] = 'sidewalk';
      });
    }
  }

  // Preserve roads and sidewalks. Houses are drawn on top of the terrain; carving
  // road tiles here creates visible gaps and breaks the street layout.
  houseStructures.forEach(() => {});

  worldMap = map;
}

function tileMask(column, row, type) {
  const same = (offsetColumn, offsetRow) => worldMap[row + offsetRow]?.[column + offsetColumn] === type;
  return `${same(0, -1) ? 1 : 0}${same(1, 0) ? 1 : 0}${same(0, 1) ? 1 : 0}${same(-1, 0) ? 1 : 0}`;
}

function closestTexture(type, mask) {
  const candidates = type === 'sidewalk' ? SIDEWALK_TEXTURE_NAMES : TILE_TEXTURE_NAMES;
  const available = candidates.reduce((best, candidate) => {
    const distance = candidate.split('').reduce((total, bit, index) => total + (bit !== mask[index] ? 1 : 0), 0);
    return distance < best.distance ? { mask: candidate, distance } : best;
  }, { mask: candidates[0] || '1111', distance: Number.POSITIVE_INFINITY });
  return tileTextures[type][available.mask] || [];
}

function tileRandom(column, row, type, mask) {
  let hash = (column * 374761393 + row * 668265263 + (type === 'road' ? 1442695041 : 1013904223) + Number.parseInt(mask, 2) * 2246822519) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
}

function drawTile(type, column, row) {
  const mask = tileMask(column, row, type);
  const textures = tileTextures[type]?.[mask] || closestTexture(type, mask);
  const availableTextures = textures.filter((image) => image.complete && image.naturalWidth > 0);
  const image = availableTextures.length > 0 ? availableTextures[tileRandom(column, row, type, mask) % availableTextures.length] : null;
  const x = column * TILE_SIZE;
  const y = row * TILE_SIZE;

  if (type === 'sidewalk') {
    if (image) context.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
    else {
      context.fillStyle = '#c8c5b5';
      context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    }
    return;
  }

  if (image) context.drawImage(image, x, y, TILE_SIZE, TILE_SIZE);
  else if (type === 'road' && roadFallback.complete && roadFallback.naturalWidth > 0) context.drawImage(roadFallback, x, y, TILE_SIZE, TILE_SIZE);
  else {
    context.fillStyle = type === 'road' ? '#6e4f86' : '#315951';
    context.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  }
}

function resize() {
  const visualViewport = window.visualViewport;
  viewport = { width: visualViewport?.width || window.innerWidth, height: visualViewport?.height || window.innerHeight, dpr: Math.min(window.devicePixelRatio || 1, 2) };
  canvas.width = viewport.width * viewport.dpr;
  canvas.height = viewport.height * viewport.dpr;
  context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
  context.imageSmoothingEnabled = false;
  createWorldMap();
  updateHouseStructureBounds();
}

function drawStructure(structure) {
  const texture = structure?.texture && structure.texture.complete && structure.texture.naturalWidth > 0 ? structure.texture : houseTextures.house;
  if (!texture || !texture.complete || texture.naturalWidth <= 0) return;
  const position = worldToScreen(structure.anchorX / worldSize.width, structure.anchorY / worldSize.height);
  const left = position.x - structure.visualWidth * cameraZoom / 2;
  const top = position.y - structure.visualHeight * cameraZoom;
  const width = structure.visualWidth * cameraZoom;
  const height = structure.visualHeight * cameraZoom;
  context.drawImage(texture, left, top, width, height);
}

function drawWorld() {
  const { width, height } = viewport;
  context.fillStyle = '#315951'; context.fillRect(0, 0, width, height);
  const cameraX = camera.x * worldSize.width;
  const cameraY = camera.y * worldSize.height;
  const visibleLeft = Math.max(0, Math.floor((cameraX - width / (2 * cameraZoom)) / TILE_SIZE) - 1);
  const visibleRight = Math.min(worldMap[0]?.length || 0, Math.ceil((cameraX + width / (2 * cameraZoom)) / TILE_SIZE) + 1);
  const visibleTop = Math.max(0, Math.floor((cameraY - height / (2 * cameraZoom)) / TILE_SIZE) - 1);
  const visibleBottom = Math.min(worldMap.length, Math.ceil((cameraY + height / (2 * cameraZoom)) / TILE_SIZE) + 1);
  context.save();
  context.translate(width / 2 - cameraX * cameraZoom, height / 2 - cameraY * cameraZoom);
  context.scale(cameraZoom, cameraZoom);
  for (let rowIndex = visibleTop; rowIndex < visibleBottom; rowIndex += 1) {
    for (let columnIndex = visibleLeft; columnIndex < visibleRight; columnIndex += 1) {
      drawTile(worldMap[rowIndex][columnIndex], columnIndex, rowIndex);
    }
  }
  context.restore();
  context.fillStyle = 'rgba(247,241,222,.3)'; context.font = '11px DM Mono, monospace'; context.fillText('MEADOW 01', 30, height - 30);
}

function worldToScreen(x, y) {
  return {
    x: viewport.width / 2 + (x * worldSize.width - camera.x * worldSize.width) * cameraZoom,
    y: viewport.height / 2 + (y * worldSize.height - camera.y * worldSize.height) * cameraZoom,
  };
}

function drawPlayer(player, isLocal = false) {
  const selectedSprites = characterSprites[player.character] || characterSprites.noelle;
  const imageFrames = selectedSprites?.[player.direction] || selectedSprites?.down || [];
  if (!Array.isArray(imageFrames) || imageFrames.length === 0) {
    ensureCharacterSprites(player.character);
    return;
  }
  const frame = getAnimationFrameIndex(player, imageFrames);
  const image = imageFrames[frame] || imageFrames[0];
  if (!image) return;
  const pixelWidth = image.naturalWidth || 23;
  const pixelHeight = image.naturalHeight || 47;
  const width = pixelWidth * cameraZoom;
  const height = pixelHeight * cameraZoom;
  const position = worldToScreen(player.x, player.y);
  const x = position.x;
  const y = position.y + 4;
  if (!isLocal && (x < -width || x > viewport.width + width || y < -height || y > viewport.height + height)) return;
  context.save();
  context.globalAlpha = isLocal ? 1 : .9;
  context.fillStyle = 'rgba(10, 26, 24, .26)';
  context.beginPath(); context.ellipse(x, y + height * .05, width * .42, height * .1, 0, 0, Math.PI * 2); context.fill();
  if (image.complete && image.naturalWidth > 0) context.drawImage(image, x - width / 2, y - height + 3, width, height);
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

  const drawables = [
    ...houseStructures.map((structure) => ({
      y: structure.anchorY / worldSize.height,
      draw: () => drawStructure(structure),
    })),
    ...players.map((player) => ({
      y: player.y,
      draw: () => drawPlayer(player, player.isLocal),
    })),
  ].sort((first, second) => first.y - second.y);

  drawables.forEach((item) => item.draw());
  syncSpeechBubbles(players);
}

function syncSpeechBubbles(players) {
  const activeIds = new Set();
  players.forEach((player) => {
    if (!player.speech || player.speechUntil <= performance.now()) return;
    const position = worldToScreen(player.x, player.y);
    if (position.x < -180 || position.x > viewport.width + 180 || position.y < -180 || position.y > viewport.height + 180) return;
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
    bubble.style.left = `${position.x}px`;
    const bubbleHeight = (characterSprites[player.character]?.[player.direction]?.[0]?.naturalHeight || 47) * cameraZoom;
    bubble.style.top = `${position.y - bubbleHeight - 13}px`;
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
  if (keys.has('arrowleft') || keys.has('q')) x -= 1;
  if (keys.has('arrowright') || keys.has('d')) x += 1;
  if (keys.has('arrowup') || keys.has('z')) y -= 1;
  if (keys.has('arrowdown') || keys.has('s')) y += 1;
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function collidesWithHouseAt(x, y, radiusX = 16, radiusY = 12) {
  const localLeft = x * worldSize.width - radiusX;
  const localRight = x * worldSize.width + radiusX;
  const localTop = y * worldSize.height - radiusY;
  const localBottom = y * worldSize.height + radiusY;
  return houseStructures.some((house) => {
    const houseHitbox = house.hitbox;
    return localLeft < houseHitbox.right && localRight > houseHitbox.left && localTop < houseHitbox.bottom && localBottom > houseHitbox.top;
  });
}

function update(delta) {
  const vector = inputVector();
  const movementStrength = Math.hypot(vector.x, vector.y);
  const moving = movementStrength > .08;
  localPlayer.moving = moving;
  localPlayer.movementSpeed = moving ? Math.min(1.75, movementStrength * 1.5) : 0;
  if (localPlayer.speech && localPlayer.speechUntil <= performance.now()) {
    localPlayer.speech = '';
    localPlayer.speechUntil = 0;
  }
  if (moving) {
    const normalizedDistance = PLAYER_SPEED * delta / 1000 / worldSize.width;
    const nextX = Math.max(.04, Math.min(.96, localPlayer.x + vector.x * normalizedDistance));
    const nextY = Math.max(.17, Math.min(.92, localPlayer.y + vector.y * normalizedDistance * worldSize.width / worldSize.height));
    const xBlocked = collidesWithHouseAt(nextX, localPlayer.y, 16, 11);
    if (!xBlocked) localPlayer.x = nextX;
    const yBlocked = collidesWithHouseAt(localPlayer.x, nextY, 12, 16);
    if (!yBlocked) localPlayer.y = nextY;
    if (Math.abs(vector.x) > Math.abs(vector.y)) localPlayer.direction = vector.x > 0 ? 'right' : 'left';
    else localPlayer.direction = vector.y > 0 ? 'down' : 'up';
  }
  const smoothing = 1 - Math.exp(-delta / 85);
  remotePlayers.forEach((player) => {
    if (player.speech && player.speechUntil <= performance.now()) {
      player.speech = '';
      player.speechUntil = 0;
    }
    const previousX = player.x;
    const previousY = player.y;
    player.x += (player.targetX - player.x) * smoothing;
    player.y += (player.targetY - player.y) * smoothing;
    const traveled = Math.hypot(player.x - previousX, player.y - previousY);
    player.movementSpeed = traveled > 0 ? Math.min(1.75, traveled / (PLAYER_SPEED * delta / 1000 / worldSize.width)) : 0;
    player.moving = traveled > 0.0001;
  });
}

function frame(now) {
  const delta = Math.min(now - lastTime, 50);
  lastTime = now; animationTime += delta; update(delta); camera.x = localPlayer.x; camera.y = localPlayer.y; updateSkinLibraryAnimations(); draw();
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
      speech: localPlayer.speech || '',
      speechUntil: Number.isFinite(localPlayer.speechUntil) ? localPlayer.speechUntil : 0,
    },
  };
  if (isHost) broadcast(payload);
  else if (hostConnection?.open) hostConnection.send(payload);
}

function broadcast(payload, exceptId = null) {
  connections.forEach((connection, id) => { if (id !== exceptId && connection.open) connection.send(payload); });
}

function announcePresence(event, playerId, exceptId = null) {
  const label = playerId.slice(-6);
  const message = event === 'join' ? `${label} arrive dans la prairie.` : `${label} quitte la prairie.`;
  addChatMessage(message, 'Prairie');
  broadcast({ type: 'presence', event, playerId, sender: label }, exceptId);
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

function openSkinLibrary() {
  renderSkinLibrary();
  skinResult.textContent = '';
  skinModal.hidden = false;
  skinClose.focus();
}

function closeSkinLibrary() {
  skinModal.hidden = true;
}

function renderSkinLibrary() {
  skinList.replaceChildren();
  skins.forEach((skin) => {
    const owned = session.ownedSkins.includes(skin.id);
    const equipped = localPlayer.character === skin.id;
    const item = document.createElement('article');
    item.className = `skin-item${equipped ? ' is-equipped' : ''}`;
    const preview = document.createElement('img');
    preview.className = 'skin-preview';
    preview.dataset.skinId = skin.id;
    const skinConfig = skinPaths[skin.id] || skinPaths.noelle;
    const previewPath = skin.preview || `${skinConfig.folder}/${skinConfig.prefix}`;
    preview.src = `${previewPath}_down2.png`;
    preview.alt = skin.label;
    const details = document.createElement('div');
    details.className = 'skin-details';
    details.innerHTML = `<strong>${skin.label}</strong><span>${skin.rarity}</span>`;
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'skin-action';
    action.textContent = equipped ? 'Équipé' : owned ? 'Équiper' : `${skin.price} ¢`;
    item.classList.toggle('is-affordable', !owned && !equipped && session.coins >= skin.price);
    item.classList.toggle('is-unaffordable', !owned && !equipped && session.coins < skin.price);
    action.disabled = equipped;
    action.addEventListener('click', () => chooseSkin(skin));
    item.append(details, preview, action);
    skinList.append(item);
  });
}

function chooseSkin(skin) {
  if (!session.ownedSkins.includes(skin.id)) {
    if (session.coins < skin.price) {
      skinResult.textContent = `Il te manque ${skin.price - session.coins} pièce${skin.price - session.coins > 1 ? 's' : ''}.`;
      return;
    }
    session.coins -= skin.price;
    session.ownedSkins.push(skin.id);
  }
  localPlayer.character = skin.id;
  localPlayer.speech = '';
  localPlayer.speechUntil = 0;
  saveSession();
  updateRewardUi();
  renderSkinLibrary();
  skinResult.textContent = `${skin.label} est maintenant équipé.`;
  sendState();
}

function removeRemotePlayerByPeer(peerId) {
  const removedPlayers = [];
  remotePlayers.forEach((player, playerId) => {
    if (player.peerId === peerId) {
      remotePlayers.delete(playerId);
      removedPlayers.push(playerId);
    }
  });
  return removedPlayers;
}

function closeConnection(connection, silent = false) {
  if (!connection) return [];
  const removedPlayers = removeRemotePlayerByPeer(connection.peer);
  connections.delete(connection.peer);
  if (connection === hostConnection) hostConnection = null;
  try { connection.close(); } catch {}
  if (!silent && removedPlayers.length && isHost) removedPlayers.forEach((playerId) => announcePresence('leave', playerId, connection.peer));
  return removedPlayers;
}

function receive(connection, payload) {
  if (!payload || !payload.type) return;

  if (payload.type === 'version-mismatch') {
    addChatMessage('Un autre joueur a une version différente. Sa session est temporairement ignorée.', 'Prairie');
    closeConnection(connection, true);
    return;
  }

  if (payload.type === 'leave') {
    remotePlayers.delete(payload.playerId);
    if (isHost) announcePresence('leave', payload.playerId, connection.peer);
    return;
  }
  if (payload.type === 'state') {
    const previous = remotePlayers.get(payload.player.id);
    const player = {
      ...payload.player,
      speech: payload.player.speech ?? previous?.speech ?? '',
      speechUntil: Number.isFinite(payload.player.speechUntil) ? payload.player.speechUntil : (previous?.speechUntil ?? 0),
      x: previous?.x ?? payload.player.x,
      y: previous?.y ?? payload.player.y,
      targetX: payload.player.x,
      targetY: payload.player.y,
      animationOffset: previous?.animationOffset ?? getPlayerAnimationOffset(payload.player.id || connection.peer),
      peerId: connection.peer,
    };
    remotePlayers.set(payload.player.id, player);
    if (isHost) broadcast(payload, connection.peer);
  }
  if (payload.type === 'hello') {
    const remoteVersion = payload.version || 'unknown';
    if (remoteVersion !== APP_VERSION) {
      connection.send({ type: 'version-mismatch', version: APP_VERSION });
      addChatMessage('Version incompatible détectée. Ce joueur ne rejoint pas la prairie.', 'Prairie');
      closeConnection(connection, true);
      return;
    }
    if (isHost) {
      connection.send({ type: 'snapshot', players: [...remotePlayers.values(), localPlayer] });
      broadcast({ type: 'state', player: localPlayer }, connection.peer);
      announcePresence('join', payload.player.id, connection.peer);
    }
    return;
  }
  if (payload.type === 'presence') {
    addChatMessage(payload.event === 'join' ? `${payload.sender} arrive dans la prairie.` : `${payload.sender} quitte la prairie.`, 'Prairie');
    if (payload.event === 'leave') {
      remotePlayers.delete(payload.playerId);
    }
    if (isHost) broadcast(payload, connection.peer);
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
  if (payload.type === 'snapshot') {
    remotePlayers.clear();
    payload.players.forEach((player) => {
    if (player.id !== localPlayer.id) {
      const existing = remotePlayers.get(player.id);
      remotePlayers.set(player.id, { ...player, targetX: player.x, targetY: player.y, animationOffset: existing?.animationOffset ?? getPlayerAnimationOffset(player.id), peerId: connection.peer });
    }
    });
  }
}

function wireConnection(connection) {
  if (!connection || !connection.peer) return;
  connections.set(connection.peer, connection);
  connection.on('data', (payload) => receive(connection, payload));
  connection.on('close', () => {
    const removedPlayers = removeRemotePlayerByPeer(connection.peer);
    connections.delete(connection.peer);
    if (connection === hostConnection) hostConnection = null;
    if (isHost) removedPlayers.forEach((playerId) => announcePresence('leave', playerId, connection.peer));
    else if (connection === hostConnection) {
      remotePlayers.clear();
      if (!versionMismatchTriggered) {
        addChatMessage('Connexion à la prairie perdue. Tentative de reconnexion…', 'Prairie');
        scheduleReconnect(true);
      }
    }
  });
}

function closeAllConnections() {
  const connectionsSnapshot = [...connections.values()];
  connectionsSnapshot.forEach((connection) => closeConnection(connection, true));
  if (hostConnection && !connections.has(hostConnection.peer)) {
    try { hostConnection.close(); } catch {}
    hostConnection = null;
  }
  remotePlayers.clear();
}

let leaveSent = false;
function sendLeave() {
  if (leaveSent) return;
  leaveSent = true;
  const payload = { type: 'leave', playerId: localPlayer.id };
  if (isHost) broadcast(payload);
  else if (hostConnection?.open) hostConnection.send(payload);
  if (peer) {
    try { peer.destroy(); } catch {}
    peer = null;
  }
  closeAllConnections();
}

function createPeer() {
  if (!window.Peer) return;
  const hostId = `noelle-meadow-${ROOM_ID}`;
  if (peer) {
    try { peer.destroy(); } catch {}
    peer = null;
  }
  closeAllConnections();
  peer = new Peer(hostId);
  peer.on('open', () => { isHost = true; reconnectAttempts = 0; });
  peer.on('connection', (connection) => { wireConnection(connection); connection.on('open', () => connection.send({ type: 'snapshot', players: [...remotePlayers.values(), localPlayer] })); });
  peer.on('disconnected', () => {
    if (versionMismatchTriggered) return;
    try { peer.reconnect(); } catch { scheduleReconnect(); }
  });
  peer.on('close', () => { if (!versionMismatchTriggered) scheduleReconnect(); });
  peer.on('error', (error) => {
    if (error?.type === 'unavailable-id') { connectToHost(hostId); return; }
    isHost = false;
    if (!versionMismatchTriggered) scheduleReconnect();
  });
}

function connectToHost(hostId) {
  if (peer) {
    try { peer.destroy(); } catch {}
    peer = null;
  }
  closeAllConnections();
  peer = new Peer();
  peer.on('open', () => {
    hostConnection = peer.connect(hostId, { reliable: true });
    wireConnection(hostConnection);
    hostConnection.on('open', () => {
      reconnectAttempts = 0;
      hostConnection.send({ type: 'hello', version: APP_VERSION, player: localPlayer });
    });
  });
  peer.on('disconnected', () => {
    if (versionMismatchTriggered) return;
    try { peer.reconnect(); } catch { scheduleReconnect(); }
  });
  peer.on('close', () => { if (!versionMismatchTriggered) scheduleReconnect(); });
  peer.on('error', () => { if (!versionMismatchTriggered) scheduleReconnect(); });
}

function resetJoystickPosition() {
  joystick.style.left = '28px';
  joystick.style.top = 'auto';
  joystick.style.bottom = '24px';
  joystick.style.right = 'auto';
  stick.style.transform = 'translate(0, 0)';
}

function setJoystick(event) {
  const rect = joystick.getBoundingClientRect();
  const radius = rect.width / 2;
  const centerX = rect.left + radius;
  const centerY = rect.top + radius;
  const distanceX = event.clientX - centerX;
  const distanceY = event.clientY - centerY;
  const distance = Math.min(Math.hypot(distanceX, distanceY), radius - 26);
  const angle = Math.atan2(distanceY, distanceX);
  joystickInput.x = Math.cos(angle) * distance / (radius - 26);
  joystickInput.y = Math.sin(angle) * distance / (radius - 26);
  stick.style.transform = `translate(${joystickInput.x * (radius - 26)}px, ${joystickInput.y * (radius - 26)}px)`;
}

function moveJoystickTo(clientX, clientY) {
  const rect = joystick.getBoundingClientRect();
  const left = Math.min(Math.max(clientX - rect.width / 2, 12), window.innerWidth - rect.width - 12);
  const top = Math.min(Math.max(clientY - rect.height / 2, 12), window.innerHeight - rect.height - 12);
  joystick.style.left = `${left}px`;
  joystick.style.top = `${top}px`;
  joystick.style.bottom = 'auto';
  joystick.style.right = 'auto';
}

function updateCameraZoom(nextZoom) {
  cameraZoom = Math.max(MIN_CAMERA_ZOOM, Math.min(MAX_CAMERA_ZOOM, nextZoom));
}

function getPinchDistance() {
  const points = [...zoomPointers.values()];
  if (points.length < 2) return null;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  updateCameraZoom(cameraZoom * (1 - event.deltaY * .001));
}, { passive: false });
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  zoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  pinchDistance = getPinchDistance();
});
canvas.addEventListener('pointermove', (event) => {
  if (!zoomPointers.has(event.pointerId)) return;
  zoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const nextDistance = getPinchDistance();
  if (pinchDistance && nextDistance) updateCameraZoom(cameraZoom * nextDistance / pinchDistance);
  pinchDistance = nextDistance;
});
function releaseZoomPointer(event) {
  zoomPointers.delete(event.pointerId);
  pinchDistance = getPinchDistance();
}
canvas.addEventListener('pointerup', releaseZoomPointer);
canvas.addEventListener('pointercancel', releaseZoomPointer);

window.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'touch') return;
  if (zoomPointers.size > 0 || event.isPrimary === false) return;
  if (event.target instanceof Element && event.target.closest('button, input, textarea, select')) return;
  if (joystickInput.active && joystickInput.pointerId !== null && event.pointerId !== joystickInput.pointerId) return;
  joystickInput.active = true;
  joystickInput.pointerId = event.pointerId;
  moveJoystickTo(event.clientX, event.clientY);
  setJoystick(event);
}, { passive: true });
window.addEventListener('pointermove', (event) => {
  if (zoomPointers.size > 0) {
    if (joystickInput.active) releaseJoystick();
    return;
  }
  if (joystickInput.active && event.pointerId === joystickInput.pointerId) setJoystick(event);
}, { passive: true });
function releaseJoystick() {
  joystickInput.active = false;
  joystickInput.pointerId = null;
  joystickInput.x = 0;
  joystickInput.y = 0;
  resetJoystickPosition();
}
window.addEventListener('pointerup', releaseJoystick, { passive: true });
window.addEventListener('pointercancel', releaseJoystick, { passive: true });
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!skinModal.hidden) { closeSkinLibrary(); return; }
    if (!eggModal.hidden) { closeEgg(); return; }
    if (!accountModal.hidden) { closeAccount(); return; }
    if (!mainMenu.hidden) { closeAuthWindow(); return; }
    return;
  }
  if (event.target instanceof HTMLInputElement) return;
  keys.add(event.key.toLowerCase());
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('pagehide', sendLeave);
window.addEventListener('beforeunload', sendLeave);
chatForm.addEventListener('submit', sendChatMessage);
accountButton.addEventListener('click', openAccount);
chatToggle.addEventListener('click', toggleChat);
reloadButton.addEventListener('click', sendVersionAwareReload);
accountClose.addEventListener('click', closeAccount);
accountModal.querySelector('.account-modal-backdrop').addEventListener('click', closeAccount);
accountSkins.addEventListener('click', () => { closeAccount(); openSkinLibrary(); });
accountLogout.addEventListener('click', logoutAccount);
showLogin.addEventListener('click', () => showAuthForm('login'));
showCreate.addEventListener('click', () => showAuthForm('create'));
openMenuSkins.addEventListener('click', () => { closeAuthWindow(); openSkinLibrary(); });
closeAuth.addEventListener('click', closeAuthWindow);
backAuth.addEventListener('click', hideAuthForm);
loginAccount.addEventListener('click', () => authClient ? signInAccount() : enterGame());
createAccount.addEventListener('click', () => authClient ? createRemoteAccount() : createLocalAccount());
saveNickname.addEventListener('click', saveAccountNickname);
newAccountName.addEventListener('keydown', (event) => { if (event.key === 'Enter') (authClient ? createRemoteAccount() : createLocalAccount()); });
eggReward.addEventListener('click', openEgg);
eggClose.addEventListener('click', closeEgg);
eggModal.querySelector('.egg-modal-backdrop').addEventListener('click', closeEgg);
skinClose.addEventListener('click', closeSkinLibrary);
skinModal.querySelector('.skin-modal-backdrop').addEventListener('click', closeSkinLibrary);
eggImage.addEventListener('click', hitEgg);
eggImage.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hitEgg(); }
});
setInterval(sendState, 100);
setInterval(updateRewardUi, 1000);
setInterval(checkForGameVersion, VERSION_CHECK_INTERVAL);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || versionMismatchTriggered) return;
  if (!isHost && (!hostConnection || !hostConnection.open) && !reconnectTimer) createPeer();
  if (peer?.disconnected && !peer.destroyed) { try { peer.reconnect(); } catch { scheduleReconnect(); } }
});
setInterval(() => {
  if (versionMismatchTriggered) return;
  const stale = !peer || peer.destroyed || (!isHost && (!hostConnection || !hostConnection.open));
  if (stale && !reconnectTimer) createPeer();
}, 6000);
updateAccountUi();
chatPanel.hidden = true;
chatToggle.setAttribute('aria-expanded', 'false');
mainMenu.hidden = true;
checkForGameVersion();
resize(); updateRewardUi(); createPeer(); requestAnimationFrame(frame);
initializeAuth().catch(() => { isAuthenticated = false; mainMenu.hidden = true; updateAccountUi(); });
