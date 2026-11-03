// The atelier: walk the studio, step up to a bench, and the ritual opens
// in front of you. Other apprentices in the same room appear as you work.

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildWorld, BENCHES } from './world.js';
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
  ? 'Tap the floor to walk, drag to look around. Tap a bench to work at it.'
  : 'Walk with WASD or tap the floor. Drag to look around. E to work at a bench.';

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

const scene = new THREE.Scene();
scene.background = new THREE.Color('#14120e');
scene.fog = new THREE.Fog('#14120e', 28, 64);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 200);

scene.add(new THREE.HemisphereLight('#f3dcb4', '#2b2117', 0.9));
const sun = new THREE.DirectionalLight('#ffd9a0', 2.2);
sun.position.set(26, 30, 14);
sun.castShadow = true;
sun.shadow.mapSize.set(COARSE ? 1024 : 2048, COARSE ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 16, bottom: -16, near: 1, far: 90 });
sun.shadow.bias = -0.0006;
scene.add(sun);

// the signs are painted in the house typeface, so wait for it
await document.fonts.load('48px "IM Fell English"').catch(() => {});
const world = buildWorld(scene);

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  labels.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---- the Master, at his desk ----------------------------------------------------
const master = makeAvatar('#000', { master: true });
master.root.position.set(0, 0, -8.55);
scene.add(master.root);
master.root.add(tag('The Master', 'tag master-tag', 2.35));

// ---- the apprentice --------------------------------------------------------------
const me = makeAvatar(prefs.ink);
scene.add(me.root);
const meTag = tag(prefs.name, 'tag me-tag', 2.15);
me.root.add(meTag);
const player = { x: 0, z: 3.5, r: Math.PI, speed: 0, path: [], pending: null, stuck: 0, activity: '' };

// camera orbit
const cam = { yaw: 0, pitch: 0.55, dist: 7.5, x: 0, z: 3.5 };

function tag(text, cls, y) {
  const div = document.createElement('div');
  div.className = cls;
  div.textContent = text;
  const o = new CSS2DObject(div);
  o.position.set(0, y, 0);
  return o;
}

// ---- seals on benches -----------------------------------------------------------------
function refreshSeals() {
  for (const it of world.interactables) {
    if (it.kind === 'bench') it.seal.visible = ledger.hasSeal(it.id);
  }
}
refreshSeals();

// ---- the drying line -------------------------------------------------------------------
const LINE = { z: 2.2, y: 2.35, x0: -5.6, x1: 5.6, slots: 14 };
const line = new THREE.Group();
scene.add(line);
for (const x of [LINE.x0 - 0.3, LINE.x1 + 0.3]) {
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, LINE.y + 0.1, 6), new THREE.MeshStandardMaterial({ color: '#3b2618', flatShading: true }));
  post.position.set(x, (LINE.y + 0.1) / 2, LINE.z);
  post.castShadow = true;
  line.add(post);
  world.colliders.push([x - 0.15, LINE.z - 0.15, x + 0.15, LINE.z + 0.15]);
}
const cord = new THREE.Mesh(
  new THREE.CylinderGeometry(0.008, 0.008, LINE.x1 - LINE.x0 + 0.6, 4),
  new THREE.MeshStandardMaterial({ color: '#cbbd9c' }),
);
cord.rotation.z = Math.PI / 2;
cord.position.set(0, LINE.y, LINE.z);
line.add(cord);

const lineItems = []; // newest first: { key, mine, name, process, tier, img, group }
const pinMat = new THREE.MeshStandardMaterial({ color: '#b89a6a', flatShading: true });

function hangPrint(item) {
  if (lineItems.some((i) => i.key === item.key)) return;
  const tex = new THREE.Texture(item.img);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  const aspect = item.img.width / item.img.height || 1.33;
  const w = aspect >= 1 ? 0.62 : 0.62 * aspect;
  const h = w / aspect;
  const g = new THREE.Group();
  const sheet = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 }),
  );
  sheet.position.y = -h / 2 - 0.02;
  sheet.castShadow = true;
  sheet.userData.lineItem = item;
  g.add(sheet);
  for (const px of [-w / 2 + 0.06, w / 2 - 0.06]) {
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.03), pinMat);
    pin.position.set(px, -0.01, 0);
    g.add(pin);
  }
  item.group = g;
  item.sway = Math.random() * 6;
  line.add(g);
  lineItems.unshift(item);
  while (lineItems.length > LINE.slots) {
    const old = lineItems.pop();
    line.remove(old.group);
  }
  layoutLine();
}

// newest in the middle of the line, older ones spreading outward
function layoutLine() {
  const gap = (LINE.x1 - LINE.x0) / LINE.slots;
  lineItems.forEach((it, i) => {
    const side = i % 2 ? -1 : 1;
    it.group.position.set(side * Math.ceil(i / 2) * gap, LINE.y, LINE.z);
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

// your own most recent prints from the ledger start the line
(async () => {
  const own = ledger.get().prints.slice(0, 5).reverse();
  for (const p of own) {
    try {
      const img = await imageFrom(p.thumb);
      hangPrint({ key: 'own-' + p.ts, mine: true, name: prefs.name, process: p.process, tier: p.verdict, img });
    } catch (e) { /* a broken thumb is skipped */ }
  }
})();

// ---- presence ----------------------------------------------------------------------------
const room = roomCode();
const peers = new Map(); // id -> { av, tagEl, x, z, r, tx, tz, tr, a, name }
let net = null;

function addPeer(p) {
  if (net && p.id === net.id) return;
  if (peers.has(p.id)) return;
  const av = makeAvatar(INKS.includes(p.ink) ? p.ink : INKS[0]);
  av.root.position.set(p.x || 0, 0, p.z || 0);
  scene.add(av.root);
  const t = tag(p.name, 'tag peer', 2.15);
  t.element.title = 'Hide or show this person';
  t.element.addEventListener('click', () => askHide(p.id));
  av.root.add(t);
  peers.set(p.id, { av, tagEl: t.element, x: p.x || 0, z: p.z || 0, r: p.r || 0, tx: p.x || 0, tz: p.z || 0, tr: p.r || 0, a: '', name: p.name });
  refreshCount();
}
function removePeer(id) {
  const p = peers.get(id);
  if (!p) return;
  scene.remove(p.av.root);
  p.av.root.traverse((o) => { if (o.isCSS2DObject) o.element.remove(); });
  peers.delete(id);
  refreshCount();
}
function activityText(a) {
  const b = BENCHES.find((x) => x.id === a);
  return b ? `at the ${b.name.toLowerCase()} bench` : '';
}

function startNet() {
  net = connect({
    room,
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
      join(m) {
        addPeer(m);
        feed(`${m.name} walks in.`, 'sys');
      },
      leave(m) {
        const p = peers.get(m.id);
        if (p) feed(`${p.name} has gone home.`, 'sys');
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
        toast(`${m.name} hands you a coated ${bench.name.toLowerCase()} sheet. Take it to the ${bench.name.toLowerCase()} bench to expose it.`);
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
  if (isHidden(it.by, it.name)) return;
  try {
    if (!configs[it.process]) configs[it.process] = (await import(`../processes/${it.process}.js`)).default;
    const img = renderRecipe(configs[it.process], it);
    hangPrint({ key: 'net-' + it.ts + it.by, by: it.by, mine: net && it.by === net.id, name: it.name, process: it.process, tier: it.tier, img });
  } catch (e) { /* a recipe this browser cannot draw is skipped */ }
}

// ---- hiding someone -------------------------------------------------------------------------
const hidden = new Set(); // peer ids, for this visit
const hiddenNames = new Set(); // and their names, so earlier prints go too
const isHidden = (id, name) => hidden.has(id) || hiddenNames.has(name);
function askHide(id) {
  const p = peers.get(id);
  if (!p) return;
  const menu = $('.hide-menu');
  const wasHidden = hidden.has(id);
  menu.querySelector('p').textContent = wasHidden
    ? `Show ${p.name} again?`
    : `Hide ${p.name}? You will no longer see their messages or the prints they hang.`;
  const yes = menu.querySelector('[data-yes]');
  yes.textContent = wasHidden ? 'Show' : 'Hide';
  yes.onclick = () => {
    if (wasHidden) { hidden.delete(id); hiddenNames.delete(p.name); }
    else { hidden.add(id); hiddenNames.add(p.name); }
    applyHidden(id);
    menu.hidden = true;
  };
  menu.hidden = false;
}
$('.hide-menu [data-no]').addEventListener('click', () => { $('.hide-menu').hidden = true; });
function applyHidden(id) {
  const p = peers.get(id);
  const off = hidden.has(id);
  if (p) {
    p.tagEl.classList.toggle('muted', off);
    p.av.root.traverse((o) => { if (o.isCSS2DObject && o.element.classList.contains('bubble')) o.element.hidden = off; });
  }
  if (off) {
    for (let i = lineItems.length - 1; i >= 0; i--) {
      if (!lineItems[i].mine && (lineItems[i].by === id || (p && lineItems[i].name === p.name))) {
        line.remove(lineItems[i].group);
        lineItems.splice(i, 1);
      }
    }
    layoutLine();
  }
}

// ---- HUD -----------------------------------------------------------------------------------
const hud = $('.hud');
const promptBtn = $('.prompt');
const statusEl = $('.room-status');
let netStatus = 'solo';

function setStatus(s) {
  netStatus = s;
  refreshCount();
}
function refreshCount() {
  const n = peers.size + 1;
  if (netStatus === 'online') {
    statusEl.textContent = `Room ${room} · ${n === 1 ? 'only you here' : `${n} apprentices here`}`;
  } else if (netStatus === 'offline') {
    statusEl.textContent = `Room ${room} · reconnecting`;
  } else {
    statusEl.textContent = 'Working alone';
  }
  $('.room-tools').hidden = netStatus === 'solo';
}

$('[data-copy-room]').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', room);
  try {
    await navigator.clipboard.writeText(url.toString());
    toast('Link to this room copied. Anyone with it walks into the same atelier.');
  } catch (e) {
    toast(url.toString());
  }
});
$('[data-line-link]').href = `line/?room=${room}`;
$('[data-new-room]').addEventListener('click', () => {
  const code = 'class-' + Math.random().toString(36).slice(2, 6);
  const url = new URL(location.href);
  url.searchParams.set('room', code);
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

async function openBench(id) {
  const mod = await import(`../processes/${id}.js`);
  overlayOpen = 'bench';
  benchOverlay.hidden = false;
  document.body.classList.add('in-overlay');
  player.activity = id;
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
  ritual = startRitual(benchHost, mod.default, hooks);
  benchHost.scrollTop = 0;
  sound.setScene('room');
}

function pressed(p) {
  // a copy large enough to read on the line; the ritual canvas goes away on close
  const img = document.createElement('canvas');
  img.width = 360;
  img.height = Math.round(360 * p.print.height / p.print.width);
  img.getContext('2d').drawImage(p.print, 0, 0, img.width, img.height);
  hangPrint({ key: 'own-' + Date.now(), mine: true, name: prefs.name, process: p.process, tier: p.tier, img });
  refreshSeals();
  if (p.partner && net && net.online) net.pairdone(p.partner.id, p.process, p.skipped ? 'thin' : p.tier);
  if (p.specimen && p.recipe && !p.skipped && net && net.online) {
    net.hang({ process: p.process, tier: p.tier, ...p.recipe, ...(p.partner ? { with: p.partner.id } : {}) });
    toast('Hung on the shared line for everyone in the room.');
  } else if (net && net.online) {
    toast(p.specimen ? 'Hung on your line. Prints the studio made for you stay private.' : 'Hung on your line. Prints of your own photographs stay on your device.');
  }
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
    seals === 0 ? 'Nothing pressed yet. The benches are waiting, and so am I.'
    : seals < 4 ? `${seals} of nine seals. A start. Do not get comfortable.`
    : seals < 9 ? `${seals} of nine. The studio is beginning to know your hand.`
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
    <button class="btn ghost" data-close>Back to the studio</button>`;
  // one letter at a time, each naming the bench it belongs to
  readLetters(masterOverlay.querySelector('.master-letters'), waiting.map((c) => ({
    ...c, goal: `${PROCESSES[c.process].name}: ${c.goal}`,
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
  face(it.face);
  if (it.kind === 'bench') openBench(it.id);
  else if (it.kind === 'master') openMaster();
  else if (it.kind === 'ledger') openPage('ledger/');
  else if (it.kind === 'history') openPage(`history/#ch-${it.id}`);
}
function face(f) {
  player.r = f + Math.PI;
}

// ---- input ------------------------------------------------------------------------------------
const keys = new Set();
const typing = () => document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeOverlay(); chatInput.blur(); return; }
  if (overlayOpen || typing() || !entered) return;
  const k = e.key.toLowerCase();
  if ((k === 'e' || k === 'enter') && nearest) { interact(nearest); return; }
  if (k === 't' || k === 'enter') { e.preventDefault(); chatInput.focus(); return; }
  keys.add(e.key.toLowerCase());
  if (e.key.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!entered) return;
  drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
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
  if (!drag) return;
  const tapped = !drag.moved;
  drag = null;
  if (tapped) tap(e.clientX, e.clientY);
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  cam.dist = Math.min(13, Math.max(3.2, cam.dist * (1 + Math.sign(e.deltaY) * 0.08)));
}, { passive: false });

function tap(cx, cy) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const targets = [world.ground, line, ...world.interactables.map((i) => i.mesh)];
  const hits = ray.intersectObjects(targets, true);
  for (const h of hits) {
    if (h.object.userData.lineItem) { showPrint(h.object.userData.lineItem); return; }
    const it = world.interactables.find((i) => isChild(h.object, i.mesh));
    if (it) { walkTo(it.stand[0], it.stand[1], it); return; }
    if (isChild(h.object, world.ground)) { walkTo(h.point.x, h.point.z, null); return; }
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

// ---- movement ------------------------------------------------------------------------------------
// Walking by tap: A* over a quarter-metre grid of the floor, then the path
// is pulled taut so apprentices walk straight lines, not staircases.
const GRID = { x0: -24, z0: -9, cell: 0.25, w: 192, h: 72 };
let grid = null;
function buildGrid() {
  grid = new Uint8Array(GRID.w * GRID.h);
  for (let j = 0; j < GRID.h; j++) {
    for (let i = 0; i < GRID.w; i++) {
      const x = GRID.x0 + (i + 0.5) * GRID.cell;
      const z = GRID.z0 + (j + 0.5) * GRID.cell;
      grid[j * GRID.w + i] = blocked(x, z, R + 0.08) ? 1 : 0;
    }
  }
}
const cellOf = (x, z) => [
  Math.min(GRID.w - 1, Math.max(0, Math.floor((x - GRID.x0) / GRID.cell))),
  Math.min(GRID.h - 1, Math.max(0, Math.floor((z - GRID.z0) / GRID.cell))),
];
const centre = (i, j) => [GRID.x0 + (i + 0.5) * GRID.cell, GRID.z0 + (j + 0.5) * GRID.cell];

function nearestFree(i, j) {
  if (!grid[j * GRID.w + i]) return [i, j];
  for (let r = 1; r < 12; r++) {
    for (let dj = -r; dj <= r; dj++) {
      for (let di = -r; di <= r; di++) {
        const a = i + di;
        const b = j + dj;
        if (a >= 0 && b >= 0 && a < GRID.w && b < GRID.h && !grid[b * GRID.w + a]) return [a, b];
      }
    }
  }
  return null;
}

function findPath(fx, fz, tx, tz) {
  if (!grid) buildGrid();
  const s = nearestFree(...cellOf(fx, fz));
  const g = nearestFree(...cellOf(tx, tz));
  if (!s || !g) return null;
  const W = GRID.w;
  const start = s[1] * W + s[0];
  const goal = g[1] * W + g[0];
  const cost = new Float32Array(grid.length).fill(Infinity);
  const from = new Int32Array(grid.length).fill(-1);
  const open = [start]; // small binary heap keyed on f
  const f = new Float32Array(grid.length);
  const h = (n) => Math.hypot((n % W) - g[0], Math.floor(n / W) - g[1]);
  cost[start] = 0;
  f[start] = h(start);
  const push = (n) => {
    open.push(n);
    let k = open.length - 1;
    while (k > 0) {
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
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < open.length && f[open[l]] < f[open[m]]) m = l;
        if (r < open.length && f[open[r]] < f[open[m]]) m = r;
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
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= W || b >= GRID.h) continue;
        const m = b * W + a;
        if (grid[m]) continue;
        if (di && dj && (grid[j * W + a] || grid[b * W + i])) continue; // no corner cutting
        const c = cost[n] + (di && dj ? Math.SQRT2 : 1);
        if (c < cost[m]) {
          cost[m] = c;
          from[m] = n;
          f[m] = c + h(m);
          push(m);
        }
      }
    }
  }
  if (from[goal] === -1 && goal !== start) return null;
  const cells = [];
  for (let n = goal; n !== -1; n = from[n]) cells.push(n);
  cells.reverse();
  // pull taut: keep only the points needed to stay in clear line of sight
  const pts = cells.map((n) => centre(n % W, Math.floor(n / W)));
  const out = [];
  let anchor = [fx, fz];
  for (let k = 1; k < pts.length; k++) {
    if (!clearLine(anchor, pts[k])) {
      out.push(pts[k - 1]);
      anchor = pts[k - 1];
    }
  }
  out.push(grid[cellOf(tx, tz)[1] * W + cellOf(tx, tz)[0]] ? pts[pts.length - 1] : [tx, tz]);
  return out;
}

function clearLine([ax, az], [bx, bz]) {
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(d / 0.12);
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const [i, j] = cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
    if (grid[j * GRID.w + i]) return false;
  }
  return true;
}

function walkTo(x, z, pending) {
  const path = findPath(player.x, player.z, x, z);
  player.path = path || [];
  player.pending = path ? pending : null;
  player.stuck = 0;
}

function blocked(x, z, rad = R) {
  for (const [x0, z0, x1, z1] of world.colliders) {
    const cx = Math.max(x0, Math.min(x, x1));
    const cz = Math.max(z0, Math.min(z, z1));
    if ((x - cx) ** 2 + (z - cz) ** 2 < rad * rad) return true;
  }
  return x < -23.7 || x > 23.7 || z < -8.7 || z > 8.7;
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
    const dx = tx - player.x;
    const dz = tz - player.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) {
      player.path.shift();
      if (!player.path.length && player.pending) {
        const it = player.pending;
        player.pending = null;
        interact(it);
      }
    } else {
      mx = dx / d;
      mz = dz / d;
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
        // close enough to the bench to work at it anyway?
        const it = player.pending;
        player.path = [];
        player.pending = null;
        if (it && Math.hypot(it.stand[0] - player.x, it.stand[1] - player.z) < 1.8) interact(it);
      }
    } else {
      player.stuck = 0;
    }
    const want = Math.atan2(mx, mz);
    let d = want - player.r;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    player.r += d * Math.min(1, dt * 10);
  }
  player.speed = speed;
}

// ---- nearest thing to work at ----------------------------------------------------------------------
let nearest = null;
function findNearest() {
  let best = null;
  let bd = 1.7;
  for (const it of world.interactables) {
    const d = Math.hypot(it.stand[0] - player.x, it.stand[1] - player.z);
    if (d < bd) { bd = d; best = it; }
  }
  if (best !== nearest) {
    nearest = best;
    if (best) {
      promptBtn.querySelector('span').textContent = best.label;
      promptBtn.hidden = false;
    } else {
      promptBtn.hidden = true;
    }
  }
}
promptBtn.addEventListener('click', () => nearest && interact(nearest));

// ---- entry ------------------------------------------------------------------------------------------
let entered = false;
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
peekCount(room).then((n) => {
  if (n == null) return;
  entry.querySelector('.entry-count').textContent =
    n === 0 ? 'The atelier is empty right now. You would be the first in.'
    : n === 1 ? 'One apprentice is working inside right now.'
    : `${n} apprentices are working inside right now.`;
});

entry.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = nameInput.value.replace(/[\u0000-\u001f]/g, '').trim().slice(0, 24);
  if (name) prefs.name = name;
  savePrefs(prefs);
  meTag.element.textContent = prefs.name;
  entry.hidden = true;
  hud.hidden = false;
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
const tmp = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (overlayOpen === 'bench' || overlayOpen === 'page') {
    // the ritual has the GPU; keep presence alive but skip drawing
    if (net) net.pos(player.x, player.z, player.r, player.activity);
    return;
  }

  if (entered && !overlayOpen) step(dt);
  else player.speed = 0;
  me.root.position.set(player.x, 0, player.z);
  me.root.rotation.y = player.r;
  me.animate(dt, player.speed, t);
  master.animate(dt, 0, t + 1.3);
  if (entered) findNearest();

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

  for (const l of world.lamps) l.light.intensity = l.base * (0.94 + Math.sin(t * 7 + l.phase) * 0.03 + Math.sin(t * 13.1 + l.phase) * 0.03);
  if (!REDUCED) for (const it of lineItems) it.group.rotation.x = Math.sin(t * 1.3 + it.sway) * 0.06;

  // camera
  if (!entered && !REDUCED) cam.yaw += dt * 0.06;
  const k = 1 - Math.exp(-dt * 6);
  cam.x += (player.x - cam.x) * k;
  cam.z += (player.z - cam.z) * k;
  const cp = Math.cos(cam.pitch) * cam.dist;
  camera.position.set(cam.x + Math.sin(cam.yaw) * cp, 1.2 + Math.sin(cam.pitch) * cam.dist, cam.z + Math.cos(cam.yaw) * cp);
  camera.lookAt(tmp.set(cam.x, 1.2, cam.z));

  if (net && entered) {
    sendTimer += dt;
    if (sendTimer > 0.25) {
      sendTimer = 0;
      net.pos(player.x, player.z, player.r, player.activity);
    }
  }

  renderer.render(scene, camera);
  labels.render(scene, camera);
}

// a handle for the headless walkthrough test (?debug)
if (new URLSearchParams(location.search).has('debug')) {
  window.__atelier = { player, world, walkTo, lineItems, peers };
}

document.body.classList.add('ready');
frame();
