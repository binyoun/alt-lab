// Shared building kit for Atelier Square and its nine ateliers: low-poly
// pieces made from primitives and canvas textures. The only pictures in
// any room are prints the simulator itself rendered (img/print/*).

import * as THREE from 'three';

export { HISTORY, BENCHES } from './places.js';
import { HISTORY, BENCHES } from './places.js';

export const PALETTE = {
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
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...opts }));
  }
  return mats.get(key);
}

export function canvasTexture(w, h, draw, repeat) {
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

export function rand(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function planks(ctx, w, h) {
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

export function flagstones(ctx, w, h) {
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

export function grass(ctx, w, h) {
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

export function cobbles(ctx, w, h) {
  const r = rand(19);
  ctx.fillStyle = '#2e2b27';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 16) {
    for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
      ctx.fillStyle = `hsl(30, 6%, ${30 + r() * 14}%)`;
      ctx.beginPath();
      ctx.ellipse(x + 8, y + 8, 7, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function bricks(ctx, w, h) {
  const r = rand(23);
  ctx.fillStyle = '#b9ab92';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0, row = 0; y < h; y += 16, row++) {
    for (let x = row % 2 ? -16 : 0; x < w; x += 32) {
      ctx.fillStyle = `hsl(${12 + r() * 10}, 38%, ${36 + r() * 10}%)`;
      ctx.fillRect(x + 1, y + 1, 30, 14);
    }
  }
}

export function wallpaper(color, motif) {
  return (ctx, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = motif;
    for (let y = 8; y < h; y += 32) {
      for (let x = (y / 32) % 2 ? 24 : 8; x < w; x += 32) {
        ctx.beginPath();
        ctx.ellipse(x, y, 3, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
}

export function checker(a, b) {
  return (ctx, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      ctx.fillStyle = (i + j) % 2 ? a : b;
      ctx.fillRect((i * w) / n, (j * h) / n, w / n, h / n);
    }
  };
}

// ---------------------------------------------------------------------------
// A kit binds the builders to one scene and collects what main.js needs:
// colliders for walking, things to interact with, walls that fade when
// they stand between the camera and the apprentice, and flickering lamps.

export function makeKit(scene, bounds) {
  const kit = {
    scene,
    bounds, // [x0, z0, x1, z1] the walkable rectangle
    colliders: [],
    interactables: [],
    lamps: [],
    fades: [],
    ground: new THREE.Group(),
    loader: new THREE.TextureLoader(),
  };
  scene.add(kit.ground);

  kit.box = (w, h, d, material, x, y, z, parent = scene, { collide = false, shadow = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'string' ? mat(material) : material);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    parent.add(m);
    if (collide) kit.colliders.push([x - w / 2, z - d / 2, x + w / 2, z + d / 2]);
    return m;
  };
  kit.cyl = (rt, rb, h, material, x, y, z, parent = scene, seg = 10) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof material === 'string' ? mat(material) : material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  kit.floor = (w, d, x, z, tex, y = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    kit.ground.add(m);
    return m;
  };
  kit.collide = (x0, z0, x1, z1) => kit.colliders.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);

  // A wall with its own material so it can fade out of the camera's way.
  kit.wall = (x0, z0, x1, z1, { h = 3.2, color = PALETTE.plaster, tex = null, trim = PALETTE.woodDark, fade = true, t = 0.25 } = {}) => {
    const w = Math.max(t, Math.abs(x1 - x0));
    const d = Math.max(t, Math.abs(z1 - z0));
    const material = new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : color, map: tex || null, flatShading: true, roughness: 0.9, transparent: true });
    const m = kit.box(w, h, d, material, (x0 + x1) / 2, h / 2, (z0 + z1) / 2, scene, { collide: true });
    if (trim) {
      const tm = new THREE.MeshStandardMaterial({ color: trim, flatShading: true, transparent: true });
      const top = kit.box(w + 0.04, 0.12, d + 0.04, tm, (x0 + x1) / 2, h, (z0 + z1) / 2);
      m.userData.partner = top;
    }
    if (fade) kit.fade(m);
    return m;
  };

  // Fade everything in a group (a shopfront, a door frame) with one plane.
  kit.fadeGroup = (g, axis, at) => {
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      o.material.transparent = true;
      o.userData.plane = { axis, at };
      kit.fades.push(o);
    });
  };

  // Register a box to fade; its plane is its thin axis.
  kit.fade = (m) => {
    const { width, depth } = m.geometry.parameters;
    m.userData.plane = depth <= width ? { axis: 'z', at: m.position.z } : { axis: 'x', at: m.position.x };
    kit.fades.push(m);
    return m;
  };

  kit.lamp = (x, y, z, color = 0xffb46b, intensity = 8, distance = 9, globe = true) => {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(x, y, z);
    scene.add(l);
    if (globe) {
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color }));
      g.position.set(x, y, z);
      scene.add(g);
    }
    kit.lamps.push({ light: l, base: intensity, phase: Math.random() * 10 });
    return l;
  };

  kit.light = ({ sky = '#f3dcb4', ground = '#2b2117', ambient = 0.8, sun = '#ffd9a0', sunI = 2.0, pos = [10, 18, 8], background = '#14120e', fog = [24, 60] } = {}) => {
    scene.background = new THREE.Color(background);
    scene.fog = new THREE.Fog(background, fog[0], fog[1]);
    kit.hemi = new THREE.HemisphereLight(sky, ground, ambient);
    scene.add(kit.hemi);
    if (sunI > 0) {
      const s = new THREE.DirectionalLight(sun, sunI);
      kit.sun = s;
      s.position.set(...pos);
      s.castShadow = true;
      s.shadow.mapSize.set(2048, 2048);
      const [x0, z0, x1, z1] = bounds;
      const span = Math.max(x1 - x0, z1 - z0) / 2 + 4;
      Object.assign(s.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 80 });
      s.target.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
      scene.add(s.target);
      s.shadow.bias = -0.0006;
      scene.add(s);
    }
    // the world beyond the walls
    const beyond = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat('#16140f'));
    beyond.rotation.x = -Math.PI / 2;
    beyond.position.y = -0.03;
    beyond.receiveShadow = true;
    scene.add(beyond);
  };

  // A picture the simulator made, framed on a wall
  kit.print = (src, x, y, z, rot, w = 0.7, h = 0.52, frame = PALETTE.woodDark) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    kit.box(w + 0.1, h + 0.1, 0.04, frame, 0, 0, 0, g);
    const tex = kit.loader.load(src);
    tex.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    p.position.z = 0.025;
    g.add(p);
    return g;
  };

  // The history chapter for this atelier, on a plaque
  kit.plaque = (year, x, z, rot) => {
    const ch = HISTORY.find(([y]) => y === year) || HISTORY[0];
    const g = new THREE.Group();
    g.position.set(x, 1.55, z);
    g.rotation.y = rot;
    scene.add(g);
    kit.box(1.22, 0.86, 0.06, PALETTE.woodDark, 0, 0, 0, g);
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.74),
      new THREE.MeshStandardMaterial({ map: textSign([[ch[0], 70], [ch[1], ch[1].length > 24 ? 26 : 32, true]], { w: 512, h: 344, bg: '#e9e2d0' }), roughness: 1 }),
    );
    plate.position.z = 0.035;
    g.add(plate);
    const stand = [x + Math.sin(rot) * 1.1, z + Math.cos(rot) * 1.1];
    kit.interactables.push({ kind: 'history', id: ch[0], label: `Read: ${ch[0]}, ${ch[1].toLowerCase()}`, stand, face: rot, mesh: g });
    return g;
  };

  // A doorway out of (or into) a room. `face` is the direction the
  // apprentice faces to walk through it.
  kit.exit = (x, z, face, label, to, { color = PALETTE.woodDark, w = 1.4 } = {}) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = face;
    scene.add(g);
    kit.box(w, 2.3, 0.08, '#1b1712', 0, 1.15, -0.02, g, { shadow: false });
    for (const sx of [-w / 2 - 0.08, w / 2 + 0.08]) kit.box(0.16, 2.5, 0.2, color, sx, 1.25, 0, g);
    kit.box(w + 0.32, 0.18, 0.22, color, 0, 2.45, 0, g);
    const quarter = Math.abs(Math.sin(face)) > 0.5;
    kit.fadeGroup(g, quarter ? 'x' : 'z', quarter ? x : z);
    const stand = [x + Math.sin(face) * 0.9, z + Math.cos(face) * 0.9];
    kit.interactables.push({ kind: 'exit', id: to, label, stand, face, mesh: g });
    return g;
  };

  // A drying line between two posts; main.js hangs prints along it.
  kit.line = (x0, z0, x1, z1, y = 2.2, slots = 8) => {
    const g = new THREE.Group();
    scene.add(g);
    for (const [x, z] of [[x0, z0], [x1, z1]]) {
      kit.cyl(0.05, 0.07, y + 0.1, PALETTE.woodDark, x, (y + 0.1) / 2, z, g, 6);
      kit.collide(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
    }
    const len = Math.hypot(x1 - x0, z1 - z0);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 4), mat('#cbbd9c'));
    cord.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    cord.rotation.z = Math.PI / 2;
    cord.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    g.add(cord);
    kit.dryingLine = { group: g, from: [x0, z0], to: [x1, z1], y, slots, angle: -Math.atan2(z1 - z0, x1 - x0) };
    return g;
  };

  kit.bench = (b, x, z, face) => buildBench(kit, b, x, z, face);
  return kit;
}

// ---------------------------------------------------------------------------
// The working bench for a process: table, its still life of tools, the
// sample print on an easel, the hanging sign and the seal once earned.

function buildBench(kit, b, x, z, face) {
  const { box, cyl, scene } = kit;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = face;
  scene.add(g);
  const benchTop = mat(PALETTE.wood);
  const benchLeg = mat(PALETTE.woodDark);
  box(2.0, 0.08, 0.8, benchTop, 0, 0.9, 0, g);
  for (const [lx, lz] of [[-0.9, -0.32], [0.9, -0.32], [-0.9, 0.32], [0.9, 0.32]]) box(0.08, 0.9, 0.08, benchLeg, lx, 0.45, lz, g);
  box(1.9, 0.05, 0.7, benchLeg, 0, 0.25, 0, g);
  PROPS[b.props](g, { box, cyl, b });

  const easel = new THREE.Group();
  easel.position.set(0, 0.94, -0.3);
  easel.rotation.x = -0.18;
  g.add(easel);
  box(0.72, 0.56, 0.04, mat(PALETTE.woodDark), 0, 0.3, 0, easel);
  const tex = kit.loader.load(`img/print/${b.id}.jpg`);
  tex.colorSpace = THREE.SRGBColorSpace;
  const print = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  print.position.set(0, 0.3, 0.025);
  easel.add(print);

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

  kit.colliders.push(rotatedBox([x, z], face, 2.1, 0.9));
  const it = { kind: 'bench', id: b.id, label: `Work at the ${b.name.toLowerCase()} bench`, stand: standPoint([x, z], face, 1.15), face, mesh: g, seal };
  kit.interactables.push(it);
  return it;
}

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
  // the sheet itself is the apprentice's; only a spare one waits, to the side
  paper(box, g, -0.62, 0.3, sens, 0.25);
  cyl(0.02, 0.03, 0.25, mat(PALETTE.wood), 0.4, 0.96, 0.3, g).rotation.z = 1.4; // hake brush
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
