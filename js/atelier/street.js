// Atelier Row: a lamp-lit street at dusk with a shopfront for every
// process, plus the Master's office, the history hall and the ledger.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { makeKit, BENCHES, PALETTE, mat, canvasTexture, cobbles, bricks, textSign } from './world.js';

// north side, west to east, then south side
const NORTH = ['cyanotype', 'vandyke', 'platinum', 'saltprint', 'albumen', 'master'];
const SOUTH = ['daguerreotype', 'tintype', 'anthotype', 'lumen', 'history', 'ledger'];
const XS = [-16.25, -9.75, -3.25, 3.25, 9.75, 16.25];

const FACADES = ['#7d6a55', '#6b5848', '#8a7a64', '#5f5245', '#76624f', '#6e5c4b'];

const OTHER = {
  master: { name: "The Master's Office", sub: 'Seals and letters', tint: '#2a2622' },
  history: { name: 'The History Hall', sub: 'From 1826 to now', tint: '#3a3226' },
  ledger: { name: 'The Ledger', sub: 'Your prints and seals', tint: '#5b1f1a' },
};

export function doorOf(id) {
  let i = NORTH.indexOf(id);
  if (i >= 0) return { x: XS[i], z: -3.95, face: 0 };
  i = SOUTH.indexOf(id);
  if (i >= 0) return { x: XS[i], z: 3.95, face: Math.PI };
  return null;
}

export function buildStreet(scene) {
  const kit = makeKit(scene, [-21, -3.3, 21, 3.3]);
  kit.light({ sky: '#7f86a8', ground: '#2b2117', ambient: 0.75, sun: '#9fb0d8', sunI: 0.9, pos: [-8, 20, 10], background: '#1b1e2c', fog: [22, 52] });
  kit.floor(44, 8, 0, 0, canvasTexture(256, 256, cobbles, [11, 2]));
  // pavements along each side
  kit.box(44, 0.12, 0.9, PALETTE.stone, 0, 0.06, -3.6, scene, { shadow: false });
  kit.box(44, 0.12, 0.9, PALETTE.stone, 0, 0.06, 3.6, scene, { shadow: false });

  const build = (id, x, north, i) => {
    const b = BENCHES.find((p) => p.id === id);
    const info = b ? { name: b.name, sub: b.atelier, tint: b.tint } : OTHER[id];
    const z = north ? -4.5 : 4.5;
    const face = north ? 0 : Math.PI;
    // the building front, set back from the pavement
    const front = new THREE.MeshStandardMaterial({ color: FACADES[i % FACADES.length], flatShading: true, roughness: 0.9, transparent: true });
    const wallMesh = kit.box(6.3, 5.2, 1.0, front, x, 2.6, z, scene, { collide: true });
    kit.fade(wallMesh);
    const g = new THREE.Group();
    g.position.set(x, 0, north ? -3.98 : 3.98);
    g.rotation.y = face;
    scene.add(g);
    // cornice and the painted sign board
    kit.box(6.3, 0.25, 0.3, PALETTE.woodDark, 0, 5.1, 0, g);
    kit.box(4.6, 0.75, 0.1, info.tint, 0, 3.35, 0.02, g);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.6), new THREE.MeshStandardMaterial({ map: textSign([[info.name, 58], [info.sub, 30, true]], { w: 768, h: 108, bg: '#e9e2d0' }), roughness: 1 }));
    sign.position.set(0, 3.35, 0.08);
    g.add(sign);
    // the shop window: a sample print for the process houses, glow for the rest
    kit.box(2.0, 1.5, 0.1, PALETTE.woodDark, -1.75, 1.55, 0.02, g);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3), new THREE.MeshBasicMaterial({ color: '#f1c27d' }));
    glow.position.set(-1.75, 1.55, 0.08);
    g.add(glow);
    if (b) {
      const tex = kit.loader.load(`img/print/${b.id}.jpg`);
      tex.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.82), new THREE.MeshBasicMaterial({ map: tex }));
      p.position.set(-1.75, 1.5, 0.1);
      g.add(p);
    }
    // the door, with a little lantern beside it
    kit.exit(x, north ? -3.95 : 3.95, face, b ? `Enter ${b.atelier.toLowerCase()} (${b.name.toLowerCase()})` : `Go into ${info.name.toLowerCase()}`, id, { color: info.tint });
    kit.box(0.08, 0.5, 0.25, PALETTE.iron, 1.3, 2.3, 0.15, g);
    kit.fadeGroup(g, 'z', z);
    // a readable name over the door, since the painted sign sits high
    const label = document.createElement('div');
    label.className = 'door-tag';
    label.innerHTML = b ? `${b.name}<small>${b.atelier}</small>` : info.name;
    const tagObj = new CSS2DObject(label);
    tagObj.position.set(x, 2.75, north ? -3.9 : 3.9);
    scene.add(tagObj);
    kit.lamp(x + (north ? 1.3 : -1.3), 2.15, north ? -3.75 : 3.75, 0xffb46b, 2.2, 4, true);
  };
  NORTH.forEach((id, i) => build(id, XS[i], true, i));
  SOUTH.forEach((id, i) => build(id, XS[i], false, i + 3));

  // the ends of the street: brick walls under an arch that names it
  for (const sx of [-21.6, 21.6]) {
    kit.wall(sx, -4, sx, 4, { h: 4.2, tex: canvasTexture(256, 256, bricks, [2, 1]), trim: PALETTE.woodDark, fade: true, t: 0.4 });
    const arch = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.7), new THREE.MeshStandardMaterial({ map: textSign([['Atelier Row', 60]], { w: 512, h: 104 }), roughness: 1 }));
    arch.position.set(sx + (sx < 0 ? 0.22 : -0.22), 3.3, 0);
    arch.rotation.y = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(arch);
  }

  // gas lamps down the middle of the street
  for (const x of [-13, 0, 13]) {
    kit.cyl(0.06, 0.09, 3.2, PALETTE.iron, x, 1.6, 0);
    kit.box(0.3, 0.4, 0.3, mat('#f6d29a', { emissive: '#f6a640', emissiveIntensity: 0.9 }), x, 3.35, 0, scene, { shadow: false });
    kit.lamp(x, 3.0, 0, 0xffb060, 9, 12, false);
    kit.collide(x - 0.15, -0.15, x + 0.15, 0.15);
  }

  // a welcome board near the middle
  const board = new THREE.Group();
  board.position.set(-6.5, 0, 1.6);
  scene.add(board);
  kit.box(0.08, 1.2, 0.08, PALETTE.woodDark, -0.45, 0.6, 0, board);
  kit.box(0.08, 1.2, 0.08, PALETTE.woodDark, 0.45, 0.6, 0, board);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshStandardMaterial({ map: textSign([['Atelier Row', 54], ['nine ateliers, one for', 28, true], ['every process', 28, true]], { w: 400, h: 290 }), roughness: 1 }));
  note.position.set(0, 1.45, 0.05);
  board.add(note);
  kit.collide(-7.0, 1.5, -6.0, 1.7);

  return kit;
}
