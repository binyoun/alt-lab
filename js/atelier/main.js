// Atelier Square: walk the square, go through a door into one process's own
// atelier, step up to its bench and the ritual opens in front of you.
// Each atelier (and the square) is its own presence room, so you meet the
// apprentices working on the same process as you.

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { BENCHES } from './world.js';
import { buildStreet, doorOf } from './street.js';
import { buildAtelier, STATIONS } from './ateliers.js';
import { openBench as openInWorldBench, ACTIVITY_OF } from './bench.js';
import { makeAvatar, INKS } from './avatar.js';
import { connect, roomCode, peekCount } from './net.js';
import { startRitual } from '../engine/ritual.js';
import { ledger } from '../engine/ledger.js';
import { readLetters } from '../engine/letters.js';
import { renderRecipe } from '../engine/sample.js';
import { sound, mountSoundToggle } from '../engine/sound.js';
import { PROCESSES, COMMISSIONS } from '../content/commissions.js';

const $ = (s) => document.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE = matchMedia('(pointer: coarse)').matches;
const PREFS_KEY = 'altlab-atelier-v1';
const R = 0.3; // apprentice radius
const HINT = COARSE
  ? 'Tap the ground to walk, drag to look around. Tap a door to go in.'
  : 'Walk with WASD or click the ground. Drag to look around. E at a door or a bench.';
const SCENES = ['street', ...BENCHES.map((b) => b.id)];
const sceneName = (id) => (id === 'street' ? 'Atelier Square' : BENCHES.find((b) => b.id === id).atelier);

// ---- preferences (name and apron), per viewer ------------------------------
function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    if (p && typeof p === 'object') return p;
  } catch (e) { /* private mode */ }
  return {};
}
function savePrefs(p) {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) { /* blocked */ }
}
const prefs = loadPrefs();
if (!prefs.name) prefs.name = `Apprentice ${100 + Math.floor(Math.random() * 900)}`;
if (!INKS.includes(prefs.ink)) prefs.ink = INKS[Math.floor(Math.random() * INKS.length)];

// ---- renderer -------------------------------------------------------------------
const canvas = $('#world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (e) {
  document.body.classList.add('no-webgl');
  throw e;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, COARSE ? 1.5 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const labels = new CSS2DRenderer({ element: $('#labels') });
const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  labels.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// the signs are painted in the house typeface, so wait for it
await document.fonts.load('48px "IM Fell English"').catch(() => {});

function tag(text, cls, y) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  const o = new CSS2DObject(div);
  o.position.set(0, y, 0);
  return o;
}

// ---- the apprentice, carried from scene to scene ------------------------------------
const me = makeAvatar(prefs.ink);
const meTag = tag(prefs.name, 'tag me-tag', 2.15);
me.root.add(meTag);
const player = { x: 0, z: 0, r: Math.PI, speed: 0, path: [], pending: null, stuck: 0, activity: '' };
const cam = { yaw: 0, pitch: 0.55, dist: 7.5, x: 0, z: 0 };

// ---- scenes -----------------------------------------------------------------------------
let here = null; // { id, scene, kit, master? }
let entered = false;

function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.isCSS2DObject) o.element.remove();
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    // shared materials from mat() stay cached; only dispose the one-offs
    if (m && !Array.isArray(m) && (m.transparent || m.map)) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

function buildScene(id) {
  const scene = new THREE.Scene();
  const kit = id === 'street' ? buildStreet(scene) : buildAtelier(scene, id);
  const s = { id, scene, kit };
  if (id === 'street') {
    // the Master stands outside his office
    const door = doorOf('master');
    const m = makeAvatar('#000', { master: true });
    m.root.position.set(door.x + 1.9, 0, door.z + 1.0);
    m.root.rotation.y = 0;
    m.root.add(tag('The Master', 'tag master-tag', 2.35));
    scene.add(m.root);
    kit.colliders.push([door.x + 1.6, door.z + 0.7, door.x + 2.2, door.z + 1.3]);
    s.master = m;
  }
  return s;
}

const fader = $('.fader');
async function go(id, from) {
  if (!REDUCED) {
    fader.classList.add('on');
    await new Promise((r) => setTimeout(r, 260));
  }
  if (here) {
    here.scene.remove(me.root);
    disposeScene(here.scene);
  }
  for (const pid of [...peers.keys()]) removePeer(pid);
  lineItems.length = 0;
  here = buildScene(id);
  here.scene.add(me.root);
  addRings(here.scene);
  grid = null;
  nearest = null;
  promptBtn.hidden = true;

  // where you stand when you arrive
  if (id === 'street') {
    // out of the door you came through, facing the square
    const d = from && doorOf(from);
    if (d) {
      player.x = d.x + Math.sin(d.face) * 1.4;
      player.z = d.z + Math.cos(d.face) * 1.4;
      player.r = d.face;
    } else {
      player.x = 0;
      player.z = 6.5;
      player.r = Math.PI;
    }
  } else {
    player.x = 0;
    player.z = 3.4;
    player.r = Math.PI;
  }
  player.path = [];
  player.pending = null;
  player.activity = '';
  cam.x = player.x;
  cam.z = player.z;
  cam.yaw = 0;
  // the square is seen wide, so its houses frame you; rooms closer in
  cam.dist = (id === 'street' ? 11.5 : 7.5) * (innerWidth < innerHeight ? 1.3 : 1); // phones see more
  cam.pitch = id === 'street' ? 0.5 : 0.62;

  refreshSeals();
  hangOwnPrints();
  try { history.replaceState(null, '', urlFor(id)); } catch (e) { /* file:// */ }
  $('[data-back-square]').hidden = id === 'street';
  refreshMap();
  if (entered) startNet();
  refreshCount();
  if (!REDUCED) setTimeout(() => fader.classList.remove('on'), 60);
}

function urlFor(id) {
  const u = new URL(location.href);
  if (id === 'street') u.searchParams.delete('at'); else u.searchParams.set('at', id);
  return u.toString();
}

// ---- seals on benches -----------------------------------------------------------------
function refreshSeals() {
  if (!here) return;
  for (const it of here.kit.interactables) {
    if (it.kind === 'bench') it.seal.visible = ledger.hasSeal(it.id);
  }
}

// ---- the drying line of this atelier --------------------------------------------------------
const lineItems = []; // newest first: { key, mine, by, name, process, tier, img, group }
const pinMat = new THREE.MeshStandardMaterial({ color: '#b89a6a', flatShading: true });

function hangPrint(item) {
  const L = here && here.kit.dryingLine;
  if (!L || lineItems.some((i) => i.key === item.key)) return;
  const tex = new THREE.Texture(item.img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const aspect = item.img.width / item.img.height || 1.33;
  const w = aspect >= 1 ? 0.56 : 0.56 * aspect;
  const h = w / aspect;
  const g = new THREE.Group();
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }));
  sheet.position.y = -h / 2 - 0.02;
  sheet.castShadow = true;
  sheet.userData.lineItem = item;
  g.add(sheet);
  for (const px of [-w / 2 + 0.06, w / 2 - 0.06]) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.03), pinMat);
    pin.position.set(px, -0.01, 0);
    g.add(pin);
  }
  g.rotation.y = L.angle;
  item.group = g;
  item.sway = Math.random() * 6;
  L.group.add(g);
  lineItems.unshift(item);
  while (lineItems.length > L.slots) L.group.remove(lineItems.pop().group);
  layoutLine();
}

// newest in the middle of the line, older ones spreading outward
function layoutLine() {
  const L = here.kit.dryingLine;
  const [x0, z0] = L.from;
  const [x1, z1] = L.to;
  lineItems.forEach((it, i) => {
    const k = (i % 2 ? -1 : 1) * Math.ceil(i / 2);
    const t = 0.5 + (k / L.slots);
    it.group.position.set(x0 + (x1 - x0) * t, L.y, z0 + (z1 - z0) * t);
  });
}

function imageFrom(src) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// your own recent prints of this process start the line
async function hangOwnPrints() {
  if (!here || here.id === 'street') return;
  const id = here.id;
  const own = ledger.get().prints.filter((p) => p.process === id).slice(0, 4).reverse();
  for (const p of own) {
    try {
      const img = await imageFrom(p.thumb);
      if (here.id !== id) return;
      hangPrint({ key: 'own-' + p.ts, mine: true, name: prefs.name, process: p.process, tier: p.verdict, img });
    } catch (e) { /* a broken thumb is skipped */ }
  }
}

// ---- presence: one room per scene ------------------------------------------------------------
const base = roomCode();
const roomFor = (id) => `${base}-${id}`;
const peers = new Map();
let net = null;
const hidden = new Set();
const hiddenNames = new Set();
const isHidden = (id, name) => hidden.has(id) || hiddenNames.has(name);

function addPeer(p) {
  if ((net && p.id === net.id) || peers.has(p.id) || !here) return;
  const av = makeAvatar(INKS.includes(p.ink) ? p.ink : INKS[0]);
  av.root.position.set(p.x || 0, 0, p.z || 0);
  here.scene.add(av.root);
  const t = tag(p.name, 'tag peer', 2.15);
  t.element.title = 'Hide or show this person';
  t.element.addEventListener('click', () => askHide(p.id));
  if (isHidden(p.id, p.name)) t.element.classList.add('muted');
  av.root.add(t);
  peers.set(p.id, { av, tagEl: t.element, x: p.x || 0, z: p.z || 0, r: p.r || 0, tx: p.x || 0, tz: p.z || 0, tr: p.r || 0, a: '', name: p.name });
  refreshCount();
}
function removePeer(id) {
  const p = peers.get(id);
  if (!p) return;
  if (here) here.scene.remove(p.av.root);
  p.av.root.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); });
  peers.delete(id);
  refreshCount();
}
const WORKING = { coating: 'coating a sheet', exposing: 'in the light', washing: 'at the wash', finishing: 'looking over a print' };
function activityText(a) {
  if (WORKING[a]) return WORKING[a];
  return BENCHES.find((x) => x.id === a) ? 'at the bench' : '';
}

// Someone working carries a sheet; to everyone else it is blank paper.
const blankSheet = new THREE.MeshStandardMaterial({ color: '#efe9dc', roughness: 0.9, side: THREE.DoubleSide });
function peerSheet(p) {
  const want = !!WORKING[p.a];
  if (want && !p.sheet) {
    p.sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.32), blankSheet);
    p.sheet.position.set(0, 1.05, 0.38);
    p.sheet.rotation.x = -1.1;
    p.av.root.add(p.sheet);
  } else if (!want && p.sheet) {
    p.av.root.remove(p.sheet);
    p.sheet = null;
  }
}

function startNet() {
  if (net) net.close();
  const sceneId = here.id;
  net = connect({
    room: roomFor(sceneId),
    name: prefs.name,
    ink: prefs.ink,
    on: {
      status: setStatus,
      welcome(m) {
        for (const id of [...peers.keys()]) removePeer(id);
        m.peers.forEach(addPeer);
        (m.line || []).slice().reverse().forEach(sharedPrint);
        refreshCount();
      },
      join(m) { addPeer(m); feed(`${m.name} comes in.`, 'sys'); },
      leave(m) {
        const p = peers.get(m.id);
        if (p) feed(`${p.name} has gone out.`, 'sys');
        removePeer(m.id);
      },
      pos(m) {
        const p = peers.get(m.id);
        if (!p) return;
        p.tx = m.x;
        p.tz = m.z;
        p.tr = m.r;
        if (p.a !== m.a) {
          p.a = m.a;
          p.tagEl.dataset.act = activityText(m.a);
          peerSheet(p);
        }
      },
      chat(m) {
        if (isHidden(m.id, m.name)) return;
        const p = peers.get(m.id);
        feed(m.text, '', m.name, m.id);
        if (p) bubble(p.av.root, m.text);
      },
      handoff(m) {
        if (isHidden(m.from, m.name)) return;
        sheets[m.process] = m;
        const bench = BENCHES.find((b) => b.id === m.process);
        toast(`${m.name} hands you a coated ${bench.name.toLowerCase()} sheet. Take it to the bench to expose it.`);
        feed(`${m.name} hands you a coated ${bench.name.toLowerCase()} sheet.`, 'sys');
      },
      pairdone(m) {
        const bench = BENCHES.find((b) => b.id === m.process);
        const lines = [`${m.name} exposed the ${bench.name.toLowerCase()} sheet you coated: the Master calls it ${m.tier}.`];
        if (m.tier === 'fine') {
          for (const c of COMMISSIONS) {
            if (c.pair && c.process === m.process && ledger.fulfil(c.id)) lines.push(`Commission fulfilled: ${c.from}.`);
          }
        }
        toast(lines.join(' '));
        feed(lines[0], 'sys');
      },
      hang(m) {
        sharedPrint(m.item);
        // the coater already heard from their partner; no second toast
        if ((!net || m.item.by !== net.id) && !m.item.name.endsWith(` & ${prefs.name}`)) {
          const what = `${m.item.tier === 'fine' ? 'fine ' : ''}${((PROCESSES[m.item.process] || {}).name || 'print').toLowerCase()}`;
          toast(`${m.item.name} hung ${/^[aeiou]/.test(what) ? 'an' : 'a'} ${what} on the line.`);
        }
      },
    },
  });
}

// Shared prints arrive as recipes, never as pictures; each browser redraws
// them from the drawer's specimen with its own engine.
const configs = {};
async function sharedPrint(it) {
  if (isHidden(it.by, it.name) || !here || it.process !== here.id) return;
  try {
    if (!configs[it.process]) configs[it.process] = (await import(`../processes/${it.process}.js`)).default;
    const img = renderRecipe(configs[it.process], it);
    hangPrint({ key: 'net-' + it.ts + it.by, by: it.by, mine: net && it.by === net.id, name: it.name, process: it.process, tier: it.tier, img });
  } catch (e) { /* a recipe this browser cannot draw is skipped */ }
}

// ---- hiding someone ------------------------------------------------------------------------------
function askHide(id) {
  const p = peers.get(id);
  if (!p) return;
  const menu = $('.hide-menu');
  const was = hidden.has(id);
  menu.querySelector('p').textContent = was
    ? `Show ${p.name} again?`
    : `Hide ${p.name}? You will no longer see their messages or the prints they hang.`;
  const yes = menu.querySelector('[data-yes]');
  yes.textContent = was ? 'Show' : 'Hide';
  yes.onclick = () => {
    if (was) { hidden.delete(id); hiddenNames.delete(p.name); } else { hidden.add(id); hiddenNames.add(p.name); }
    p.tagEl.classList.toggle('muted', !was);
    if (!was) {
      for (let i = lineItems.length - 1; i >= 0; i--) {
        const it = lineItems[i];
        if (!it.mine && (it.by === id || it.name === p.name)) {
          here.kit.dryingLine.group.remove(it.group);
          lineItems.splice(i, 1);
        }
      }
      layoutLine();
    }
    menu.hidden = true;
  };
  menu.hidden = false;
}
$('.hide-menu [data-no]').addEventListener('click', () => { $('.hide-menu').hidden = true; });

// ---- HUD -----------------------------------------------------------------------------------
const promptBtn = $('.prompt');
const statusEl = $('.room-status');
let netStatus = 'solo';

function setStatus(s) {
  netStatus = s;
  refreshCount();
}
function refreshCount() {
  const n = peers.size + 1;
  const where = here ? sceneName(here.id) : '';
  if (netStatus === 'online') statusEl.textContent = `${where} · ${n === 1 ? 'only you here' : `${n} here`}`;
  else if (netStatus === 'offline') statusEl.textContent = `${where} · reconnecting`;
  else statusEl.textContent = where;
  $('.room-tools').hidden = netStatus === 'solo';
  $('[data-room-code]').textContent = base === 'commons' ? 'Open atelier' : `Class ${base.replace(/^class-/, '')}`;
}

$('[data-copy-room]').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', base);
  url.searchParams.delete('at');
  try {
    await navigator.clipboard.writeText(url.toString());
    toast('Link copied. Anyone with it walks into the same Atelier Square.');
  } catch (e) {
    toast(url.toString());
  }
});
$('[data-line-link]').href = `line/?room=${base}`;
$('[data-new-room]').addEventListener('click', () => {
  const url = new URL(location.href);
  url.searchParams.set('room', 'class-' + Math.random().toString(36).slice(2, 6));
  url.searchParams.delete('at');
  location.href = url.toString();
});

function feed(text, cls = '', who = '', id = '') {
  const list = $('.feed');
  const li = document.createElement('li');
  if (cls) li.className = cls;
  if (who) {
    const b = document.createElement(id ? 'button' : 'b');
    b.className = 'who';
    b.textContent = who;
    if (id) {
      b.title = 'Hide or show this person';
      b.addEventListener('click', () => askHide(id));
    }
    li.append(b, ' ');
  }
  li.appendChild(document.createTextNode(text));
  list.appendChild(li);
  while (list.children.length > 8) list.firstChild.remove();
  setTimeout(() => li.classList.add('fade'), 40000);
  setTimeout(() => li.remove(), 42000);
}

function bubble(root, text) {
  const old = root.children.find((c) => c.isCSS2DObject && c.element.classList.contains('bubble'));
  if (old) { root.remove(old); old.element.remove(); }
  const b = tag(text, 'bubble', 2.6);
  root.add(b);
  setTimeout(() => { root.remove(b); b.element.remove(); }, 6500);
}

let toastTimer = 0;
function toast(text) {
  const t = $('.toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 5200);
}

const chatForm = $('.chat');
const chatInput = chatForm.querySelector('input');
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim().slice(0, 140);
  chatInput.value = '';
  chatInput.blur();
  if (!text) return;
  feed(text, 'mine', prefs.name);
  bubble(me.root, text);
  if (net) net.chat(text);
});

// ---- overlays: the bench, the Master, the ledger, the history ------------------------------
const benchOverlay = $('.bench-overlay');
const benchHost = $('.bench-host');
const pageOverlay = $('.page-overlay');
const pageFrame = pageOverlay.querySelector('iframe');
const masterOverlay = $('.master-overlay');
let ritual = null;
let overlayOpen = null;

// sheets partners have coated and handed to you, waiting at their bench
const sheets = {};

// the apprentice as the in-world bench sees them
const meHandle = {
  x: () => player.x,
  z: () => player.z,
  rotation(face) { player.r = face + Math.PI; },
  handsWorld(pos, quat) {
    pos.set(player.x + Math.sin(player.r) * 0.38, 1.05, player.z + Math.cos(player.r) * 0.38);
    quat.setFromEuler(new THREE.Euler(-1.1, player.r, 0, 'YXZ'));
  },
};
let bench = null; // the in-world bench, when one is open

async function openBench(id) {
  const mod = await import(`../processes/${id}.js`);
  if (STATIONS[id]) {
    overlayOpen = 'inworld';
    document.body.classList.add('at-bench');
    promptBtn.hidden = true;
    bench = openInWorldBench({
      config: mod.default,
      stations: STATIONS[id],
      kit: here.kit,
      scene: here.scene,
      camera,
      me: meHandle,
      walkTo: (x, z, then) => walkTo(x, z, then),
      setActivity: (a) => { player.activity = a || ''; },
      hooks: { ...benchHooks(id), onPress: (p) => { pendingHang = pressed(p, false); } },
      placeName: sceneName(here.id),
      onHang: () => hangPending(),
      onClose: () => {
        hangPending(); // a pressed print is never lost by stepping back
        bench = null;
        overlayOpen = null;
        document.body.classList.remove('at-bench');
        me.root.visible = true;
        player.path = [];
        player.pending = null;
        refreshSeals();
        canvas.focus();
      },
    });
    sound.setScene('room');
    return;
  }
  overlayOpen = 'bench';
  benchOverlay.hidden = false;
  document.body.classList.add('in-overlay');
  player.activity = id;
  ritual = startRitual(benchHost, mod.default, benchHooks(id));
  benchHost.scrollTop = 0;
  sound.setScene('room');
}

function benchHooks(id) {
  const hooks = { onPress: pressed };
  if (net && net.online) {
    hooks.partners = () => [...peers.entries()]
      .filter(([pid, p]) => !isHidden(pid, p.name))
      .map(([pid, p]) => ({ id: pid, name: p.name }));
    hooks.handoff = (sheet) => net.handoff(sheet);
  }
  if (sheets[id]) {
    const s = sheets[id];
    delete sheets[id];
    hooks.preset = { seed: s.seed, points: s.points, from: { id: s.from, name: s.name } };
  }
  return hooks;
}

// A pressed print: hang it on this atelier's line (now, or once it has been
// carried there) and, for specimen prints, share its recipe with the room.
let pendingHang = null;
function hangPending() {
  if (!pendingHang) return;
  const { item, share } = pendingHang;
  pendingHang = null;
  hangPrint(item);
  share();
}
function pressed(p, hangNow = true) {
  // a copy large enough to read on the line; the ritual canvas goes away on close
  const img = document.createElement('canvas');
  img.width = 360;
  img.height = Math.round(360 * p.print.height / p.print.width);
  img.getContext('2d').drawImage(p.print, 0, 0, img.width, img.height);
  const item = { key: 'own-' + Date.now(), mine: true, name: prefs.name, process: p.process, tier: p.tier, img };
  refreshSeals();
  if (p.partner && net && net.online) net.pairdone(p.partner.id, p.process, p.skipped ? 'thin' : p.tier);
  const share = () => {
    if (p.specimen && p.recipe && !p.skipped && net && net.online) {
      net.hang({ process: p.process, tier: p.tier, ...p.recipe, ...(p.partner ? { with: p.partner.id } : {}) });
      toast('Hung on the line for everyone in this atelier.');
    } else if (net && net.online) {
      toast(p.specimen ? 'Hung on your line. Prints the studio made for you stay private.' : 'Hung on your line. Prints of your own photographs stay on your device.');
    }
  };
  if (hangNow) {
    hangPrint(item);
    share();
    return null;
  }
  return { item, share };
}

function openPage(src) {
  overlayOpen = 'page';
  pageFrame.src = src;
  pageOverlay.hidden = false;
  document.body.classList.add('in-overlay');
}

function openMaster() {
  overlayOpen = 'master';
  const seals = ledger.sealCount();
  const say =
    seals === 0 ? 'Nothing pressed yet. Nine ateliers round this square, and every one of them waiting. So am I.'
    : seals < 4 ? `${seals} of nine seals. A start. Do not get comfortable.`
    : seals < 9 ? `${seals} of nine. The street is beginning to know your hand.`
    : 'All nine seals. There is nothing left I can teach you, which is a lie, but a kind one.';
  const sealRow = BENCHES.map((b) => {
    const has = ledger.hasSeal(b.id);
    return `<div class="seal-slot"><span class="seal${has ? '' : ' ghost'}" style="--seal:${PROCESSES[b.id].seal}">${b.name[0]}</span><small>${b.name}</small></div>`;
  }).join('');
  const waiting = COMMISSIONS.filter((c) => !ledger.fulfilled(c.id));
  masterOverlay.querySelector('.letters-sheaf').innerHTML = `
    <article class="letter">
      <div class="letter-from">The Master</div>
      <p>${say}</p>
    </article>
    <div class="seal-row">${sealRow}</div>
    <h2>${waiting.length ? (waiting.length === 1 ? 'One letter still waits' : `${waiting.length} letters still wait`) : 'Every letter answered'}</h2>
    <div class="master-letters"></div>
    <button class="btn ghost" data-close>Back to the square</button>`;
  // one letter at a time, each naming the atelier it belongs to
  readLetters(masterOverlay.querySelector('.master-letters'), waiting.map((c) => ({
    ...c, goal: `${BENCHES.find((b) => b.id === c.process).atelier}: ${c.goal}`,
  })), { onTurn: () => sound.flip() });
  masterOverlay.hidden = false;
  document.body.classList.add('in-overlay');
}

function closeOverlay() {
  if (!overlayOpen || overlayOpen === 'welcome') return;
  if (ritual) { ritual.destroy(); ritual = null; }
  benchOverlay.hidden = true;
  pageOverlay.hidden = true;
  masterOverlay.hidden = true;
  if (overlayOpen === 'page') {
    pageFrame.src = 'about:blank';
    ledger.reload();
  }
  overlayOpen = null;
  player.activity = '';
  document.body.classList.remove('in-overlay');
  refreshSeals();
  canvas.focus();
}
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
masterOverlay.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeOverlay(); });

function interact(it) {
  if (!it) return;
  player.r = it.face + Math.PI;
  if (it.kind === 'bench') openBench(it.id);
  else if (it.kind === 'history') openPage(`history/#ch-${it.id}`);
  else if (it.kind === 'exit') {
    if (it.id === 'street') go('street', here.id);
    else if (it.id === 'master') openMaster();
    else if (it.id === 'history') openPage('history/');
    else if (it.id === 'ledger') openPage('ledger/');
    else go(it.id, 'street');
  }
}

// ---- input ------------------------------------------------------------------------------------
const keys = new Set();
const typing = () => document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (bench && document.querySelector('.bench-strip .letters-overlay:not([hidden])')) {
      document.querySelector('.bench-strip .letters-overlay').hidden = true;
    } else if (bench) bench.close();
    else if (overlayOpen === 'map') closeMap();
    else closeOverlay();
    chatInput.blur();
    return;
  }
  if (overlayOpen || typing() || !entered) return;
  const k = e.key.toLowerCase();
  if ((k === 'e' || k === 'enter') && nearest) { interact(nearest); return; }
  if (k === 't' || k === 'enter') { e.preventDefault(); chatInput.focus(); return; }
  if (k === 'm') { openMap(); return; }
  keys.add(k);
  if (k.startsWith('arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
function benchPointer(kind, e) {
  return bench && bench.pointer(kind, e, canvas.getBoundingClientRect());
}
canvas.addEventListener('pointerdown', (e) => {
  if (!entered) return;
  if (benchPointer('down', e)) { canvas.setPointerCapture(e.pointerId); e.preventDefault(); return; }
  drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (benchPointer('move', e)) return;
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  cam.yaw -= dx * 0.006;
  cam.pitch = Math.min(1.2, Math.max(0.18, cam.pitch + dy * 0.004));
  drag.x = e.clientX;
  drag.y = e.clientY;
});
canvas.addEventListener('pointerup', (e) => {
  if (benchPointer('up', e)) return;
  if (!drag) return;
  const tapped = !drag.moved;
  drag = null;
  if (tapped) tap(e.clientX, e.clientY);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (bench) return;
  cam.dist = Math.min(13, Math.max(3.2, cam.dist * (1 + Math.sign(e.deltaY) * 0.08)));
}, { passive: false });

function tap(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const k = here.kit;
  const targets = [k.ground, ...k.interactables.map((i) => i.mesh)];
  if (k.dryingLine) targets.push(k.dryingLine.group);
  for (const h of ray.intersectObjects(targets, true)) {
    if (h.object.userData.lineItem) { showPrint(h.object.userData.lineItem); return; }
    const it = k.interactables.find((i) => isChild(h.object, i.mesh));
    if (it) { walkTo(it.stand[0], it.stand[1], it); return; }
    if (isChild(h.object, k.ground)) { walkTo(h.point.x, h.point.z, null); showTarget(h.point.x, h.point.z); return; }
  }
}
function isChild(o, parent) {
  for (let p = o; p; p = p.parent) if (p === parent) return true;
  return false;
}

function showPrint(item) {
  const card = $('.print-card');
  const proc = (PROCESSES[item.process] || {}).name || 'Print';
  card.querySelector('img').src = item.img.src || item.img.toDataURL();
  card.querySelector('p').textContent = `${item.mine ? 'Yours' : item.name}: ${proc.toLowerCase()}, judged ${item.tier}.`;
  card.hidden = false;
}
$('.print-card').addEventListener('click', () => { $('.print-card').hidden = true; });

// ---- walking: A* over a quarter-metre grid of this scene, pulled taut ---------------------------
const CELL = 0.25;
let grid = null;
let G = null; // { x0, z0, w, h }

function blocked(x, z, rad = R) {
  for (const [x0, z0, x1, z1] of here.kit.colliders) {
    const cx = Math.max(x0, Math.min(x, x1));
    const cz = Math.max(z0, Math.min(z, z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < rad * rad) return true;
  }
  const [bx0, bz0, bx1, bz1] = here.kit.bounds;
  return x < bx0 || x > bx1 || z < bz0 || z > bz1;
}

function buildGrid() {
  const [x0, z0, x1, z1] = here.kit.bounds;
  G = { x0, z0, w: Math.ceil((x1 - x0) / CELL), h: Math.ceil((z1 - z0) / CELL) };
  grid = new Uint8Array(G.w * G.h);
  for (let j = 0; j < G.h; j++) for (let i = 0; i < G.w; i++) {
    grid[j * G.w + i] = blocked(G.x0 + (i + 0.5) * CELL, G.z0 + (j + 0.5) * CELL, R + 0.08) ? 1 : 0;
  }
}
const cellOf = (x, z) => [
  Math.min(G.w - 1, Math.max(0, Math.floor((x - G.x0) / CELL))),
  Math.min(G.h - 1, Math.max(0, Math.floor((z - G.z0) / CELL))),
];
const centre = (i, j) => [G.x0 + (i + 0.5) * CELL, G.z0 + (j + 0.5) * CELL];

function nearestFree(i, j) {
  if (!grid[j * G.w + i]) return [i, j];
  for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    const a = i + di;
    const b = j + dj;
    if (a >= 0 && b >= 0 && a < G.w && b < G.h && !grid[b * G.w + a]) return [a, b];
  }
  return null;
}

function clearLine([ax, az], [bx, bz]) {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.12);
  for (let k = 1; k <= n; k++) {
    const [i, j] = cellOf(ax + (bx - ax) * (k / n), az + (bz - az) * (k / n));
    if (grid[j * G.w + i]) return false;
  }
  return true;
}

function findPath(fx, fz, tx, tz) {
  if (!grid) buildGrid();
  const s = nearestFree(...cellOf(fx, fz));
  const g = nearestFree(...cellOf(tx, tz));
  if (!s || !g) return null;
  const W = G.w;
  const start = s[1] * W + s[0];
  const goal = g[1] * W + g[0];
  const cost = new Float32Array(grid.length).fill(Infinity);
  const from = new Int32Array(grid.length).fill(-1);
  const f = new Float32Array(grid.length);
  const h = (n) => Math.hypot((n % W) - g[0], Math.floor(n / W) - g[1]);
  const open = [start];
  cost[start] = 0;
  f[start] = h(start);
  const push = (n) => {
    open.push(n);
    for (let k = open.length - 1; k > 0;) {
      const p = (k - 1) >> 1;
      if (f[open[p]] <= f[open[k]]) break;
      [open[p], open[k]] = [open[k], open[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = open[0];
    const last = open.pop();
    if (open.length) {
      open[0] = last;
      for (let k = 0; ;) {
        const l = 2 * k + 1;
        let m = k;
        if (l < open.length && f[open[l]] < f[open[m]]) m = l;
        if (l + 1 < open.length && f[open[l + 1]] < f[open[m]]) m = l + 1;
        if (m === k) break;
        [open[m], open[k]] = [open[k], open[m]];
        k = m;
      }
    }
    return top;
  };
  while (open.length) {
    const n = pop();
    if (n === goal) break;
    const i = n % W;
    const j = Math.floor(n / W);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= W || b >= G.h) continue;
      const m = b * W + a;
      if (grid[m] || (di && dj && (grid[j * W + a] || grid[b * W + i]))) continue;
      const c = cost[n] + (di && dj ? Math.SQRT2 : 1);
      if (c < cost[m]) { cost[m] = c; from[m] = n; f[m] = c + h(m); push(m); }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const pts = [];
  for (let n = goal; n !== -1; n = from[n]) pts.push(centre(n % W, Math.floor(n / W)));
  pts.reverse();
  const out = [];
  let anchor = [fx, fz];
  for (let k = 1; k < pts.length; k++) {
    if (!clearLine(anchor, pts[k])) { out.push(pts[k - 1]); anchor = pts[k - 1]; }
  }
  const [ti, tj] = cellOf(tx, tz);
  out.push(grid[tj * W + ti] ? pts[pts.length - 1] : [tx, tz]);
  return out;
}

function walkTo(x, z, pending) {
  const path = findPath(player.x, player.z, x, z);
  player.path = path || [];
  player.pending = path ? pending : null;
  player.stuck = 0;
}

function step(dt) {
  let mx = 0;
  let mz = 0;
  const fw = (keys.has('w') || keys.has('arrowup')) - (keys.has('s') || keys.has('arrowdown'));
  const rt = (keys.has('d') || keys.has('arrowright')) - (keys.has('a') || keys.has('arrowleft'));
  const run = keys.has('shift') ? 1.7 : 1;
  if (fw || rt) {
    player.path = [];
    player.pending = null;
    const sy = Math.sin(cam.yaw);
    const cy = Math.cos(cam.yaw);
    mx = -sy * fw + cy * rt;
    mz = -cy * fw - sy * rt;
  } else if (player.path.length) {
    const [tx, tz] = player.path[0];
    const d = Math.hypot(tx - player.x, tz - player.z);
    if (d < 0.12) {
      player.path.shift();
      if (!player.path.length && player.pending) {
        const it = player.pending;
        player.pending = null;
        if (typeof it === 'function') it(); else interact(it);
      }
    } else {
      mx = (tx - player.x) / d;
      mz = (tz - player.z) / d;
    }
  }
  const len = Math.hypot(mx, mz);
  let speed = 0;
  if (len > 0) {
    mx /= len;
    mz /= len;
    const v = 3.2 * run * dt;
    const ox = player.x;
    const oz = player.z;
    if (!blocked(player.x + mx * v, player.z)) player.x += mx * v;
    if (!blocked(player.x, player.z + mz * v)) player.z += mz * v;
    const moved = Math.hypot(player.x - ox, player.z - oz);
    speed = moved / dt;
    if (player.path.length && moved < v * 0.2) {
      player.stuck += dt;
      if (player.stuck > 0.6) {
        const it = player.pending;
        player.path = [];
        player.pending = null;
        if (typeof it === 'function') it();
        else if (it && Math.hypot(it.stand[0] - player.x, it.stand[1] - player.z) < 1.8) interact(it);
      }
    } else player.stuck = 0;
    let d = Math.atan2(mx, mz) - player.r;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    player.r += d * Math.min(1, dt * 10);
  }
  player.speed = speed;
}

// ---- nearest thing to work at ----------------------------------------------------------------------
let nearest = null;
function findNearest() {
  let best = null;
  let bd = 1.6;
  for (const it of here.kit.interactables) {
    const d = Math.hypot(it.stand[0] - player.x, it.stand[1] - player.z);
    if (d < bd) { bd = d; best = it; }
  }
  if (best !== nearest) {
    nearest = best;
    promptBtn.hidden = !best;
    if (best) promptBtn.querySelector('span').textContent = best.label;
  }
  if (rings) {
    rings.near.visible = !!nearest;
    if (nearest) rings.near.position.set(nearest.stand[0], 0.03, nearest.stand[1]);
  }
}

// ---- rings on the ground: what is in front of you, and where you are going ---
let rings = null;
function addRings(scene) {
  const make = (color, r0, r1) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = 2;
    scene.add(m);
    return m;
  };
  rings = { near: make('#f6d29a', 0.42, 0.52), target: make('#e8e4da', 0.18, 0.24), targetT: 0 };
}
function showTarget(x, z) {
  if (!rings) return;
  rings.target.position.set(x, 0.03, z);
  rings.target.visible = true;
  rings.targetT = 1;
}
function animateRings(dt, t) {
  if (!rings) return;
  const pulse = REDUCED ? 1 : 1 + Math.sin(t * 4) * 0.08;
  rings.near.scale.setScalar(pulse);
  rings.near.material.opacity = 0.55 + (REDUCED ? 0 : Math.sin(t * 4) * 0.2);
  if (rings.targetT > 0) {
    rings.targetT = Math.max(0, rings.targetT - dt * 1.2);
    rings.target.material.opacity = rings.targetT * 0.8;
    rings.target.scale.setScalar(1 + (1 - rings.targetT) * 1.4);
    if (!rings.targetT || !player.path.length) rings.target.visible = rings.targetT > 0;
  }
}

// ---- the map: every house on the square, one tap away ------------------------
const MAP_ORDER = {
  north: ['vandyke', 'platinum', 'saltprint', 'albumen', 'master'],
  west: 'cyanotype',
  east: 'history',
  south: ['daguerreotype', 'tintype', 'anthotype', 'lumen', 'ledger'],
};
const MAP_OTHER = {
  master: { name: "The Master's Office", sub: 'Seals and letters', tint: '#2a2622' },
  history: { name: 'The History Hall', sub: 'From 1826 to now', tint: '#3a3226' },
  ledger: { name: 'The Ledger', sub: 'Your prints and seals', tint: '#5b1f1a' },
};
function mapCell(id) {
  const b = BENCHES.find((x) => x.id === id);
  const info = b ? { name: b.atelier, sub: b.name, tint: b.tint } : MAP_OTHER[id];
  const btn = document.createElement('button');
  btn.className = 'map-house';
  btn.dataset.id = id;
  btn.style.setProperty('--tint', info.tint);
  btn.innerHTML = `<b>${info.name}</b><small>${info.sub}</small>`;
  btn.addEventListener('click', () => goMap(id));
  return btn;
}
function buildMap() {
  const grid = $('.map-grid');
  grid.innerHTML = '';
  const row = (cls, ids) => {
    const r = document.createElement('div');
    r.className = 'map-row ' + cls;
    ids.forEach((id) => r.append(mapCell(id)));
    grid.append(r);
  };
  row('north', MAP_ORDER.north);
  const mid = document.createElement('div');
  mid.className = 'map-row middle';
  mid.append(mapCell(MAP_ORDER.west));
  const square = document.createElement('button');
  square.className = 'map-square';
  square.dataset.id = 'street';
  square.innerHTML = '<b>The square</b><small>fountain, benches</small>';
  square.addEventListener('click', () => goMap('street'));
  mid.append(square, mapCell(MAP_ORDER.east));
  grid.append(mid);
  row('south', MAP_ORDER.south);
}
buildMap();
function refreshMap() {
  document.querySelectorAll('.map-grid [data-id]').forEach((b) => {
    const isHere = here && b.dataset.id === here.id;
    b.classList.toggle('here', isHere);
    b.classList.toggle('sealed', ledger.hasSeal(b.dataset.id));
  });
}
function openMap() {
  if (!entered || bench || (overlayOpen && overlayOpen !== 'map')) return;
  refreshMap();
  $('.map-overlay').hidden = false;
  overlayOpen = 'map';
}
function closeMap() {
  $('.map-overlay').hidden = true;
  if (overlayOpen === 'map') overlayOpen = null;
}
function goMap(id) {
  closeMap();
  if (id === 'master') { openMaster(); return; }
  if (id === 'history') { openPage('history/'); return; }
  if (id === 'ledger') { openPage('ledger/'); return; }
  if (here && id === here.id) return;
  go(id, here.id === 'street' ? 'street' : here.id);
}
$('[data-map]').addEventListener('click', openMap);
$('[data-map-close]').addEventListener('click', closeMap);
$('.map-overlay').addEventListener('click', (e) => { if (e.target.classList.contains('map-overlay')) closeMap(); });
$('[data-back-square]').addEventListener('click', () => { if (here && here.id !== 'street' && !bench) go('street', here.id); });
promptBtn.addEventListener('click', () => nearest && interact(nearest));

// ---- walls step aside for the camera -------------------------------------------------------------------
const toPlayer = new THREE.Vector3();
const fadeRay = new THREE.Raycaster();
function fadeWalls(dt) {
  const fades = here.kit.fades;
  if (!fades.length) return;
  const target = new THREE.Vector3(player.x, 1.0, player.z);
  toPlayer.subVectors(target, camera.position);
  const dist = toPlayer.length();
  fadeRay.set(camera.position, toPlayer.normalize());
  fadeRay.far = dist;
  const hit = new Set(fadeRay.intersectObjects(fades, false).map((h) => h.object));
  for (const w of fades) {
    // a wall fades when it is in the line of sight, or simply stands
    // between the camera and the apprentice: a cutaway, like a doll's house
    const pl = w.userData.plane;
    const between = pl && (camera.position[pl.axis] - pl.at) * ((pl.axis === 'x' ? player.x : player.z) - pl.at) < 0;
    const full = w.userData.baseOpacity ?? 1;
    const want = hit.has(w) || between ? Math.min(full, 0.1) : full;
    const m = w.material;
    m.opacity += (want - m.opacity) * Math.min(1, dt * 8);
    m.depthWrite = m.opacity > 0.95;
    if (w.userData.partner) {
      w.userData.partner.material.opacity = m.opacity;
      w.userData.partner.material.depthWrite = m.depthWrite;
    }
  }
}

// ---- entry ------------------------------------------------------------------------------------------
const entry = $('.entry');
const nameInput = entry.querySelector('input[name=name]');
nameInput.value = prefs.name;
const swatches = entry.querySelector('.swatches');
INKS.forEach((ink) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'swatch' + (ink === prefs.ink ? ' on' : '');
  b.style.background = ink;
  b.setAttribute('aria-label', 'Apron colour');
  b.addEventListener('click', () => {
    prefs.ink = ink;
    me.setInk(ink);
    swatches.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('on', s === b));
  });
  swatches.appendChild(b);
});
Promise.all(SCENES.map((id) => peekCount(roomFor(id)))).then((ns) => {
  if (ns.some((n) => n == null)) return;
  const n = ns.reduce((a, b) => a + b, 0);
  entry.querySelector('.entry-count').textContent =
    n === 0 ? 'The square is quiet right now. You would be the first in.'
    : n === 1 ? 'One apprentice is on Atelier Square right now.'
    : `${n} apprentices are on Atelier Square right now.`;
});

entry.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24);
  if (name) prefs.name = name;
  savePrefs(prefs);
  meTag.element.textContent = prefs.name;
  entry.hidden = true;
  $('.hud').hidden = false;
  entered = true;
  ledger.begin();
  mountSoundToggle();
  sound.setScene('room');
  startNet();
  refreshCount();
  if (!ledger.onboarded()) welcome();
  else feed(HINT, 'sys');
});

function welcome() {
  const o = $('.welcome');
  o.hidden = false;
  overlayOpen = 'welcome';
  o.querySelector('[data-apron]').addEventListener('click', () => {
    ledger.setOnboarded();
    o.hidden = true;
    overlayOpen = null;
    feed(HINT, 'sys');
  }, { once: true });
}

// ---- loop ---------------------------------------------------------------------------------------------
const clock = new THREE.Clock();
let sendTimer = 0;
const look = new THREE.Vector3();
const want = new THREE.Vector3();
const lookWant = new THREE.Vector3();
let gliding = false;
const BRUSH_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M4 24c2-1 3-1 4-3l9-13 3 2-9 13c-1 2-1 3-1 4-2 0-4-1-6-3z' fill='%23c8c2b4'/%3E%3Cpath d='M18 7l3-4 4 3-4 3z' fill='%237fa3c8'/%3E%3C/svg%3E") 4 24, crosshair`;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (!here) return;
  if (overlayOpen === 'bench' || overlayOpen === 'page') {
    // the ritual has the GPU; keep presence alive but skip drawing
    if (net) net.pos(player.x, player.z, player.r, player.activity);
    return;
  }

  if (entered && (!overlayOpen || (bench && bench.walking))) step(dt);
  else player.speed = 0;
  if (bench) bench.update(dt);
  // at a station the camera looks over your shoulder; step out of its way
  me.root.visible = !(bench && !bench.walking && Math.hypot(camera.position.x - player.x, camera.position.z - player.z) < 1.4);
  me.root.position.set(player.x, 0, player.z);
  me.root.rotation.y = player.r;
  me.animate(dt, player.speed, t);
  if (here.master) here.master.animate(dt, 0, t + 1.3);
  if (entered && !bench) findNearest();
  if (bench && rings) rings.near.visible = false;
  animateRings(dt, t);

  for (const p of peers.values()) {
    const k = Math.min(1, dt * 6);
    const ox = p.x;
    const oz = p.z;
    p.x += (p.tx - p.x) * k;
    p.z += (p.tz - p.z) * k;
    let d = p.tr - p.r;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    p.r += d * k;
    p.av.root.position.set(p.x, 0, p.z);
    p.av.root.rotation.y = p.r;
    p.av.animate(dt, Math.hypot(p.x - ox, p.z - oz) / dt, t);
  }

  for (const l of here.kit.lamps) l.light.intensity = l.base * (0.94 + Math.sin(t * 7 + l.phase) * 0.03 + Math.sin(t * 13.1 + l.phase) * 0.03);
  if (!REDUCED) for (const it of lineItems) it.group.children[0].rotation.x = Math.sin(t * 1.3 + it.sway) * 0.06;

  if (!entered && !REDUCED) cam.yaw += dt * 0.06;
  const k = 1 - Math.exp(-dt * 6);
  cam.x += (player.x - cam.x) * k;
  cam.z += (player.z - cam.z) * k;
  if (bench && bench.shot) {
    // the bench's shot: glide there, or cut when motion is reduced
    const g = REDUCED ? 1 : 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(bench.shot.pos, g);
    look.lerp(bench.shot.look, g);
  } else {
    const cp = Math.cos(cam.pitch) * cam.dist;
    want.set(cam.x + Math.sin(cam.yaw) * cp, 1.2 + Math.sin(cam.pitch) * cam.dist, cam.z + Math.cos(cam.yaw) * cp);
    // coming back from a shot, ease out; otherwise follow as before
    const g = gliding && !REDUCED ? 1 - Math.exp(-dt * 3.2) : 1;
    camera.position.lerp(want, g);
    look.lerp(lookWant.set(cam.x, 1.2, cam.z), g);
    if (gliding && camera.position.distanceTo(want) < 0.05) gliding = false;
  }
  if (bench) gliding = true;
  camera.lookAt(look);
  canvas.style.cursor = bench && bench.cursor === 'brush' ? BRUSH_CURSOR : bench && bench.cursor === 'tilt' ? 'ew-resize' : '';
  fadeWalls(dt);

  if (net && entered) {
    sendTimer += dt;
    if (sendTimer > 0.25) {
      sendTimer = 0;
      net.pos(player.x, player.z, player.r, player.activity);
    }
  }

  renderer.render(here.scene, camera);
  labels.render(here.scene, camera);
}

// a handle for the headless walkthrough test (?debug)
if (new URLSearchParams(location.search).has('debug')) {
  window.__atelier = {
    player, walkTo, lineItems, peers, go, interact,
    get world() { return here.kit; },
    get bench() { return bench; },
    camera,
    cam,
    get here() { return here.id; },
  };
}

const startAt = new URLSearchParams(location.search).get('at');
await go(SCENES.includes(startAt) ? startAt : 'street', null);
document.body.classList.add('ready');
frame();
