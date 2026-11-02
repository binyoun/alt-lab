// The atelier as a low-poly diorama: a lamp-lit hall with a sunlit
// courtyard to the east and a garden to the west. Everything here is built
// from primitives and canvas textures; the only pictures in the room are
// prints the simulator itself rendered (img/print/*).

import * as THREE from 'three';

export const HISTORY = [
  ['1826', 'The first fixed image'],
  ['1839', 'The daguerreotype'],
  ['1840', 'The negative, and the salt print'],
  ['1842', 'Iron, blue, and the garden'],
  ['1850', 'Albumen, and the family album'],
  ['1851', 'Wet collodion'],
  ['1873', 'Platinum, and the noble prints'],
  ['1888', 'You press the button'],
  ['1907', 'Colour arrives'],
  ['1925', 'Small cameras, instant pictures'],
  ['1975', 'The sensor'],
  ['now', 'The return of slow light'],
];

// Benches. `at` is the bench centre, `face` the direction the worker
// faces (radians, 0 = toward -z). The worker stands 1.1 m in front.
export const BENCHES = [
  { id: 'cyanotype', name: 'Cyanotype', year: 1842, at: [17, -5.6], face: -Math.PI / 2, props: 'iron', tint: '#274a86' },
  { id: 'vandyke', name: 'Van Dyke brown', year: 1895, at: [21, 0], face: -Math.PI / 2, props: 'iron', tint: '#4a2c14' },
  { id: 'platinum', name: 'Platinum', year: 1873, at: [17, 5.6], face: -Math.PI / 2, props: 'iron', tint: '#3d3d3f' },
  { id: 'daguerreotype', name: 'Daguerreotype', year: 1839, at: [-9, -7.9], face: 0, props: 'fuming', tint: '#6b7076' },
  { id: 'tintype', name: 'Tintype', year: 1856, at: [-5, -7.9], face: 0, props: 'camera', tint: '#26262a' },
  { id: 'saltprint', name: 'Salt print', year: 1840, at: [-9, 7.9], face: Math.PI, props: 'salt', tint: '#5e3a22' },
  { id: 'albumen', name: 'Albumen print', year: 1850, at: [-5, 7.9], face: Math.PI, props: 'egg', tint: '#553024' },
  { id: 'anthotype', name: 'Anthotype', year: 1842, at: [-19, -4.5], face: Math.PI / 2, props: 'berry', tint: '#7a2547' },
  { id: 'lumen', name: 'Lumen print', year: 1840, at: [-19, 4.5], face: Math.PI / 2, props: 'leaf', tint: '#8a5a4a' },
];

const PALETTE = {
  plank: '#6b4a32',
  plankDark: '#4a3322',
  plaster: '#cdbfa6',
  wood: '#5a3b26',
  woodDark: '#3b2618',
  stone: '#9b9384',
  grass: '#5d7044',
  iron: '#2d2b29',
  brass: '#b08a4a',
  paper: '#efe9dc',
  glass: '#cfe3e8',
};

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts }));
  }
  return mats.get(key);
}

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

function rand(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function planks(ctx, w, h) {
  const r = rand(7);
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const y = (i * h) / rows;
    const l = 30 + r() * 10;
    ctx.fillStyle = `hsl(26, 32%, ${l}%)`;
    ctx.fillRect(0, y, w, h / rows);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y, w, 2);
    const cut = r() * w;
    ctx.fillRect(cut, y, 2, h / rows);
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = `rgba(30,18,8,${0.05 + r() * 0.08})`;
      ctx.fillRect(0, y + r() * (h / rows), w, 1);
    }
  }
}

function flagstones(ctx, w, h) {
  const r = rand(11);
  ctx.fillStyle = '#5c574d';
  ctx.fillRect(0, 0, w, h);
  const n = 4;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const l = 52 + r() * 12;
      ctx.fillStyle = `hsl(40, 8%, ${l}%)`;
      ctx.fillRect((i * w) / n + 3, (j * h) / n + 3, w / n - 6, h / n - 6);
    }
  }
}

function grass(ctx, w, h) {
  const r = rand(5);
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `hsla(${80 + r() * 30}, 30%, ${24 + r() * 22}%, 0.6)`;
    ctx.fillRect(r() * w, r() * h, 2, 4);
  }
}

export function textSign(lines, { w = 512, h = 160, bg = PALETTE.paper, ink = '#3a3226', border = true } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    if (border) {
      ctx.strokeStyle = 'rgba(58,50,38,0.55)';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, w - 20, h - 20);
    }
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const step = h / (lines.length + 1);
    lines.forEach(([text, size, italic], i) => {
      ctx.font = `${italic ? 'italic ' : ''}${size}px "IM Fell English", Georgia, serif`;
      ctx.fillText(text, w / 2, step * (i + 1));
    });
  });
}

// ---------------------------------------------------------------------------

export function buildWorld(scene) {
  const colliders = []; // [x0, z0, x1, z1]
  const interactables = []; // { kind, id, label, stand:[x,z], face, mesh }
  const lamps = [];
  const loader = new THREE.TextureLoader();

  function box(w, h, d, material, x, y, z, parent = scene, { collide = false, shadow = true } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    if (collide) colliders.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    return m;
  }
  function cyl(rt, rb, h, material, x, y, z, parent = scene, seg = 10) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ---- ground ----------------------------------------------------------
  const ground = new THREE.Group();
  ground.name = 'ground';
  scene.add(ground);
  const floor = (w, d, x, z, tex) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0, z);
    m.receiveShadow = true;
    ground.add(m);
  };
  floor(24, 18, 0, 0, canvasTexture(256, 256, planks, [6, 5]));
  floor(12, 18, 18, 0, canvasTexture(256, 256, flagstones, [4, 6]));
  floor(12, 18, -18, 0, canvasTexture(256, 256, grass, [3, 4]));
  // the world beyond: dark earth so the diorama floats in night
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat('#16140f'));
  beyond.rotation.x = -Math.PI / 2;
  beyond.position.y = -0.02;
  beyond.receiveShadow = true;
  scene.add(beyond);

  // ---- hall walls (low, so the camera can see over them) -----------------
  const plaster = mat(PALETTE.plaster);
  const WALL_H = 2.4;
  const T = 0.3;
  const wall = (x0, z0, x1, z1) => {
    const w = Math.max(T, Math.abs(x1 - x0));
    const d = Math.max(T, Math.abs(z1 - z0));
    box(w, WALL_H, d, plaster, (x0 + x1) / 2, WALL_H / 2, (z0 + z1) / 2, scene, { collide: true });
    box(w + 0.04, 0.12, d + 0.04, mat(PALETTE.woodDark), (x0 + x1) / 2, WALL_H, (z0 + z1) / 2);
  };
  wall(-12, -9, 12, -9);
  wall(-12, 9, 12, 9);
  wall(12, -9, 12, -2.4);
  wall(12, 2.4, 12, 9);
  wall(-12, -9, -12, -2.4);
  wall(-12, 2.4, -12, 9);
  // door frames
  for (const sx of [-12, 12]) {
    for (const sz of [-2.4, 2.4]) box(0.4, 3, 0.4, mat(PALETTE.woodDark), sx, 1.5, sz);
    box(0.4, 0.3, 5.2, mat(PALETTE.woodDark), sx, 3, 0);
  }

  // ---- courtyard and garden borders -----------------------------------------
  const fence = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const posts = Math.ceil(len / 1.5);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      box(0.14, 1.1, 0.14, mat(PALETTE.wood), x0 + (x1 - x0) * t, 0.55, z0 + (z1 - z0) * t);
    }
    const w = Math.max(0.08, Math.abs(x1 - x0));
    const d = Math.max(0.08, Math.abs(z1 - z0));
    box(w, 0.08, d, mat(PALETTE.wood), (x0 + x1) / 2, 0.95, (z0 + z1) / 2);
    box(w, 0.08, d, mat(PALETTE.wood), (x0 + x1) / 2, 0.5, (z0 + z1) / 2);
    colliders.push([Math.min(x0, x1) - 0.1, Math.min(z0, z1) - 0.1, Math.max(x0, x1) + 0.1, Math.max(z0, z1) + 0.1]);
  };
  fence(12, -9, 24, -9);
  fence(12, 9, 24, 9);
  fence(24, -9, 24, 9);
  fence(-12, -9, -24, -9);
  fence(-12, 9, -24, 9);
  fence(-24, -9, -24, 9);

  // ---- lamps in the hall --------------------------------------------------------
  const lamp = (x, z, color = 0xffb46b, intensity = 9) => {
    const l = new THREE.PointLight(color, intensity, 9, 1.6);
    l.position.set(x, 3.2, z);
    scene.add(l);
    const glass = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    glass.position.set(x, 3.2, z);
    scene.add(glass);
    cyl(0.01, 0.01, 1.2, mat(PALETTE.iron), x, 3.9, z);
    lamps.push({ light: l, base: intensity, phase: Math.random() * 10 });
  };
  lamp(-6, -3);
  lamp(6, -3);
  lamp(-6, 4);
  lamp(6, 4);
  lamp(0, -6.5, 0xffc078, 7);
  // the plate corner works under a red safelight
  lamp(-7, -7, 0xff3b2a, 6);

  // ---- benches ------------------------------------------------------------------
  const benchTop = mat(PALETTE.wood);
  const benchLeg = mat(PALETTE.woodDark);
  for (const b of BENCHES) {
    const g = new THREE.Group();
    g.position.set(b.at[0], 0, b.at[1]);
    g.rotation.y = b.face;
    scene.add(g);
    box(2.0, 0.08, 0.8, benchTop, 0, 0.9, 0, g);
    for (const [lx, lz] of [[-0.9, -0.32], [0.9, -0.32], [-0.9, 0.32], [0.9, 0.32]]) box(0.08, 0.9, 0.08, benchLeg, lx, 0.45, lz, g);
    box(1.9, 0.05, 0.7, benchLeg, 0, 0.25, 0, g);
    PROPS[b.props](g, { box, cyl, b });

    // sample print on a small easel at the back of the bench
    const easel = new THREE.Group();
    easel.position.set(0, 0.94, -0.3);
    easel.rotation.x = -0.18;
    g.add(easel);
    box(0.72, 0.56, 0.04, mat(PALETTE.woodDark), 0, 0.3, 0, easel);
    const tex = loader.load(`img/print/${b.id}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    const print = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    print.position.set(0, 0.3, 0.025);
    easel.add(print);

    // hanging sign with the process name
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.4),
      new THREE.MeshStandardMaterial({ map: textSign([[b.name, 64], [String(b.year), 34, true]]), roughness: 1 }),
    );
    sign.position.set(0, 2.1, -0.35);
    g.add(sign);
    for (const sx of [-0.55, 0.55]) cyl(0.006, 0.006, 0.45, mat(PALETTE.iron), sx, 2.5, -0.35, g, 4);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.025, 14), mat(b.tint, { roughness: 0.4 }));
    seal.rotation.x = Math.PI / 2;
    seal.position.set(0.56, 1.98, -0.33);
    seal.visible = false;
    g.add(seal);

    colliders.push(rotatedBox(b.at, b.face, 2.1, 0.9));
    const stand = standPoint(b.at, b.face, 1.15);
    interactables.push({ kind: 'bench', id: b.id, label: `Work at the ${b.name.toLowerCase()} bench`, stand, face: b.face, mesh: g, seal });
  }

  // ---- the Master's desk -------------------------------------------------------
  const desk = new THREE.Group();
  desk.position.set(0, 0, -7.6);
  scene.add(desk);
  box(2.6, 0.1, 1.1, mat(PALETTE.woodDark), 0, 0.95, 0, desk);
  box(2.5, 0.9, 1.0, mat(PALETTE.wood), 0, 0.45, 0, desk);
  box(0.5, 0.06, 0.36, mat('#5b1f1a'), -0.5, 1.03, 0.1, desk); // the ledger, closed
  box(0.46, 0.02, 0.32, mat(PALETTE.paper), 0.3, 1.01, 0.15, desk); // a letter
  cyl(0.05, 0.06, 0.1, mat(PALETTE.iron), 0.9, 1.05, -0.1, desk); // inkwell
  cyl(0.04, 0.04, 0.22, mat('#efe2c4'), -1.0, 1.11, -0.2, desk); // candle
  const flame = new THREE.PointLight(0xffa040, 2.5, 3, 2);
  flame.position.set(-1.0, 1.3, -0.2);
  desk.add(flame);
  lamps.push({ light: flame, base: 2.5, phase: 2 });
  colliders.push([-1.35, -8.2, 1.35, -7.0]);
  interactables.push({ kind: 'master', id: 'master', label: 'Speak with the Master', stand: [0, -6.2], face: 0, mesh: desk });

  // ---- the ledger lectern ---------------------------------------------------------
  const lectern = new THREE.Group();
  lectern.position.set(0, 0, 8.1);
  scene.add(lectern);
  cyl(0.08, 0.12, 1.1, mat(PALETTE.woodDark), 0, 0.55, 0, lectern);
  const top = box(0.7, 0.06, 0.5, mat(PALETTE.wood), 0, 1.15, 0, lectern);
  top.rotation.x = 0.35;
  const book = box(0.6, 0.06, 0.42, mat('#5b1f1a'), 0, 1.21, 0.02, lectern);
  book.rotation.x = 0.35;
  colliders.push([-0.4, 7.8, 0.4, 8.4]);
  interactables.push({ kind: 'ledger', id: 'ledger', label: 'Open your ledger', stand: [0, 7.0], face: Math.PI, mesh: lectern });

  // ---- history plaques along the east half of the hall --------------------------------
  HISTORY.forEach(([year, title], i) => {
    const north = i < 6;
    const k = north ? i : i - 6;
    const x = 2.6 + k * 1.55;
    const z = north ? -8.8 : 8.8;
    const g = new THREE.Group();
    g.position.set(x, 1.55, z);
    g.rotation.y = north ? 0 : Math.PI;
    scene.add(g);
    box(1.22, 0.86, 0.06, mat(PALETTE.woodDark), 0, 0, 0, g);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.74),
      new THREE.MeshStandardMaterial({ map: textSign([[year, 70], [title, title.length > 24 ? 26 : 32, true]], { w: 512, h: 344, bg: '#e9e2d0' }), roughness: 1 }),
    );
    plate.position.z = 0.035;
    g.add(plate);
    interactables.push({ kind: 'history', id: year, label: `Read: ${year}, ${title.toLowerCase()}`, stand: [x, north ? -7.7 : 7.7], face: north ? 0 : Math.PI, mesh: g });
  });

  // ---- courtyard dressing: wash trough, drying racks -----------------------------------
  const trough = new THREE.Group();
  trough.position.set(22.3, 0, -6.5);
  scene.add(trough);
  box(1.6, 0.6, 0.9, mat(PALETTE.stone), 0, 0.3, 0, trough);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), mat('#4f7a8c', { roughness: 0.15, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.58;
  trough.add(water);
  cyl(0.05, 0.05, 1.2, mat(PALETTE.iron), 0.7, 0.9, 0, trough);
  colliders.push([21.4, -7.0, 23.2, -6.0]);
  for (const z of [-3, 3]) {
    const rack = new THREE.Group();
    rack.position.set(14.2, 0, z);
    scene.add(rack);
    for (let i = 0; i < 3; i++) {
      const f = box(0.6, 0.03, 0.45, mat(PALETTE.glass, { roughness: 0.1, transparent: true, opacity: 0.6 }), 0, 0.5 + i * 0.05, (i - 1) * 0.5, rack);
      f.rotation.x = -0.6;
      box(0.62, 0.01, 0.47, mat('#d8d0a8'), 0, 0.48 + i * 0.05, (i - 1) * 0.5, rack).rotation.x = -0.6;
    }
    colliders.push([13.8, z - 0.9, 14.6, z + 0.9]);
  }

  // ---- garden: a tree and planters -------------------------------------------------
  const tree = (x, z, s = 1) => {
    cyl(0.12 * s, 0.2 * s, 2.2 * s, mat('#4b3424'), x, 1.1 * s, z);
    const leaves = mat('#3f5a32');
    for (const [dx, dy, dz, r] of [[0, 2.6, 0, 1.0], [0.6, 2.3, 0.3, 0.7], [-0.5, 2.4, -0.3, 0.75], [0.1, 3.1, -0.2, 0.6]]) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), leaves);
      m.position.set(x + dx * s, dy * s, z + dz * s);
      m.castShadow = true;
      scene.add(m);
    }
    colliders.push([x - 0.3, z - 0.3, x + 0.3, z + 0.3]);
  };
  tree(-22, -6.8, 1.2);
  tree(-22.2, 6.5);
  const planter = (x, z, color) => {
    box(1.6, 0.45, 0.6, mat(PALETTE.wood), x, 0.22, z, scene, { collide: true });
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 + (i % 2) * 0.06, 0), mat(i % 2 ? '#56743d' : '#476a35'));
      m.position.set(x - 0.6 + i * 0.3, 0.6, z);
      m.castShadow = true;
      scene.add(m);
      if (i % 2) {
        const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(color));
        bloom.position.set(x - 0.6 + i * 0.3, 0.82, z);
        scene.add(bloom);
      }
    }
  };
  planter(-15, -7.8, '#a8344e');
  planter(-15, 7.8, '#d8b440');
  planter(-22.6, 0, '#8a4fa0');

  return { colliders, interactables, lamps, ground };
}

// ---------------------------------------------------------------------------
// Bench props, one small still life per process family.

const PROPS = {};

function bottle(cyl, g, x, z, color) {
  cyl(0.06, 0.06, 0.22, mat(color, { roughness: 0.3 }), x, 1.05, z, g);
  cyl(0.025, 0.03, 0.06, mat(color, { roughness: 0.3 }), x, 1.19, z, g);
  cyl(0.03, 0.03, 0.03, mat('#2a1d14'), x, 1.235, z, g);
}
function tray(box, g, x, z, color = '#e7e3d8') {
  box(0.5, 0.05, 0.38, mat(color), x, 0.965, z, g);
}
function paper(box, g, x, z, color = PALETTE.paper, rot = 0) {
  const p = box(0.36, 0.01, 0.28, mat(color), x, 0.945, z, g);
  p.rotation.y = rot;
  return p;
}

PROPS.iron = (g, { box, cyl, b }) => {
  const sens = b.id === 'cyanotype' ? '#c9d36a' : b.id === 'vandyke' ? '#c8a95e' : '#d9cf9a';
  bottle(cyl, g, -0.75, -0.05, '#5a3a1e');
  bottle(cyl, g, -0.6, 0.12, '#5a3a1e');
  paper(box, g, -0.2, 0.12, sens, 0.1);
  cyl(0.02, 0.03, 0.25, mat(PALETTE.wood), 0.08, 0.96, 0.18, g).rotation.z = 1.4; // hake brush
  // contact frame propped toward the sun
  const f = box(0.46, 0.03, 0.36, mat(PALETTE.woodDark), 0.62, 1.05, 0.05, g);
  f.rotation.x = -0.7;
  const glass = box(0.4, 0.01, 0.3, mat(PALETTE.glass, { roughness: 0.05, transparent: true, opacity: 0.55 }), 0.62, 1.07, 0.06, g);
  glass.rotation.x = -0.7;
};

PROPS.fuming = (g, { box, cyl }) => {
  box(0.5, 0.36, 0.4, mat('#3a2a1e'), -0.55, 1.12, 0, g); // the fuming box
  box(0.2, 0.02, 0.2, mat('#d8d8d8', { metalness: 1, roughness: 0.15 }), -0.55, 1.31, 0, g);
  cyl(0.03, 0.03, 0.14, mat('#efe2c4'), 0.1, 1.01, 0.2, g); // candle
  box(0.24, 0.015, 0.18, mat('#c8ccd2', { metalness: 1, roughness: 0.1 }), 0.5, 0.95, 0.1, g); // polished plate
  cyl(0.02, 0.02, 0.4, mat('#8a6a4a'), 0.5, 0.97, -0.15, g).rotation.z = Math.PI / 2; // buffing stick
};

PROPS.camera = (g, { box, cyl }) => {
  // a studio camera standing beside the bench on its tripod
  const cam = new THREE.Group();
  cam.position.set(1.4, 0, 0.35);
  cam.rotation.y = -0.5;
  g.add(cam);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = cyl(0.02, 0.025, 1.4, mat(PALETTE.wood), Math.cos(a) * 0.22, 0.68, Math.sin(a) * 0.22, cam, 5);
    leg.rotation.z = Math.cos(a) * 0.18;
    leg.rotation.x = -Math.sin(a) * 0.18;
  }
  box(0.36, 0.3, 0.3, mat(PALETTE.wood), 0, 1.5, 0, cam);
  box(0.3, 0.26, 0.2, mat('#2a1a14'), 0, 1.5, 0.24, cam); // bellows
  cyl(0.07, 0.07, 0.14, mat(PALETTE.brass, { metalness: 0.7, roughness: 0.35 }), 0, 1.5, 0.4, cam).rotation.x = Math.PI / 2;
  box(0.26, 0.2, 0.015, mat('#1b1b1d', { roughness: 0.3 }), -0.4, 0.95, 0.1, g).rotation.x = -1.4; // black plate
  bottle(cyl, g, 0.1, -0.1, '#6c5a3a');
};

PROPS.salt = (g, { box, cyl }) => {
  tray(box, g, -0.45, 0.05);
  const salt = box(0.4, 0.02, 0.3, mat('#f4f1ea'), -0.45, 0.99, 0.05, g);
  salt.castShadow = false;
  bottle(cyl, g, 0.15, -0.1, '#3a4a5a');
  paper(box, g, 0.55, 0.1, '#ece4d2', -0.15);
};

PROPS.egg = (g, { box, cyl }) => {
  cyl(0.2, 0.12, 0.12, mat('#e8e2d4'), -0.45, 1.0, 0.05, g, 14); // bowl
  for (let i = 0; i < 4; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mat('#efe6d3'));
    e.scale.y = 1.3;
    e.position.set(0.05 + i * 0.1, 0.99, 0.2 - (i % 2) * 0.06);
    e.castShadow = true;
    g.add(e);
  }
  paper(box, g, 0.55, 0.0, '#f0e8d0', 0.12);
};

PROPS.berry = (g, { box, cyl }) => {
  cyl(0.16, 0.1, 0.1, mat('#8a6a4a'), -0.5, 0.99, 0.05, g, 12); // mortar
  cyl(0.025, 0.03, 0.26, mat('#8a6a4a'), -0.45, 1.12, 0.05, g).rotation.z = 0.5; // pestle
  for (let i = 0; i < 9; i++) {
    const berry = new THREE.Mesh(new THREE.IcosahedronGeometry(0.03, 0), mat(i % 3 ? '#6e1838' : '#3c1430'));
    berry.position.set(0.0 + (i % 3) * 0.06, 0.965, 0.1 + Math.floor(i / 3) * 0.06);
    g.add(berry);
  }
  paper(box, g, 0.55, 0.05, '#c27a9a', 0.1);
};

PROPS.leaf = (g, { box }) => {
  paper(box, g, 0.0, 0.08, '#d9a99a', 0);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), mat('#4f6f38'));
    leaf.scale.set(1, 0.08, 0.45);
    leaf.rotation.y = i * 0.8;
    leaf.position.set(-0.12 + (i % 3) * 0.12, 0.955, 0.0 + Math.floor(i / 3) * 0.12);
    g.add(leaf);
  }
  const glass = box(0.42, 0.01, 0.34, mat(PALETTE.glass, { roughness: 0.05, transparent: true, opacity: 0.45 }), 0.0, 0.96, 0.08, g);
  glass.castShadow = false;
  tray(box, g, -0.65, 0.1, '#3a3a3a');
};

// ---------------------------------------------------------------------------

function standPoint([x, z], face, d) {
  // face 0 means the worker looks toward -z, so they stand on the +z side
  return [x + Math.sin(face) * d, z + Math.cos(face) * d];
}

function rotatedBox([x, z], face, w, d) {
  const quarter = Math.abs(Math.sin(face)) > 0.5;
  const hw = (quarter ? d : w) / 2;
  const hd = (quarter ? w : d) / 2;
  return [x - hw, z - hd, x + hw, z + hd];
}
