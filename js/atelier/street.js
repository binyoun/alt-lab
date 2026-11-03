// Atelier Square: an open town square in late-afternoon light. The nine
// ateliers, the Master's office, the History Hall and the Ledger face in
// around a fountain, each a different house with a glowing shop window,
// a striped awning, a hanging sign and an open, lit doorway.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { makeKit, BENCHES, PALETTE, mat, canvasTexture, rand, textSign } from './world.js';

// x along the north and south sides; one house each on the west and east
const XS = [-16, -8, 0, 8, 16];
const NORTH = ['vandyke', 'platinum', 'saltprint', 'albumen', 'master'];
const SOUTH = ['daguerreotype', 'tintype', 'anthotype', 'lumen', 'ledger'];
const WEST = 'cyanotype';
const EAST = 'history';
const FRONT = 9.3; // the house fronts on the north and south sides
const SIDE = 23.3; // the house fronts on the west and east sides

const OTHER = {
  master: { name: "The Master's Office", sub: 'Seals and letters' },
  history: { name: 'The History Hall', sub: 'From 1826 to now' },
  ledger: { name: 'The Ledger', sub: 'Your prints and seals' },
};

// each house its own colour: wall, trim, roof, awning stripe, height
const HOUSES = {
  cyanotype: { wall: '#ece5d4', trim: '#274a86', roof: '#4a5560', stripe: '#3d63a8', h: 5.6 },
  vandyke: { wall: '#cf9a62', trim: '#4a2c14', roof: '#9a4a32', stripe: '#7a4a24', h: 6.2 },
  platinum: { wall: '#c3c9ce', trim: '#3d3d3f', roof: '#59626b', stripe: '#6c737a', h: 5.4 },
  saltprint: { wall: '#e6d6b6', trim: '#5e3a22', roof: '#a5573a', stripe: '#a5573a', h: 6.0 },
  albumen: { wall: '#d38b7c', trim: '#553024', roof: '#6a4a3a', stripe: '#8a2c3a', h: 5.6 },
  master: { wall: '#93a384', trim: '#2a2622', roof: '#4a5560', stripe: '#3f5a32', h: 7.0 },
  daguerreotype: { wall: '#7d8b98', trim: '#2a2f35', roof: '#3f4850', stripe: '#2a2f35', h: 6.0 },
  tintype: { wall: '#ddb96a', trim: '#26262a', roof: '#8a4a32', stripe: '#26262a', h: 5.4 },
  anthotype: { wall: '#aac69c', trim: '#7a2547', roof: '#6b7a5a', stripe: '#9a3a62', h: 5.8 },
  lumen: { wall: '#ebcca4', trim: '#8a5a4a', roof: '#a5573a', stripe: '#b5704a', h: 5.6 },
  history: { wall: '#ddd2bd', trim: '#3a3226', roof: '#59626b', stripe: '#5a4a32', h: 7.0 },
  ledger: { wall: '#a8584a', trim: '#5b1f1a', roof: '#5a3a2e', stripe: '#5b1f1a', h: 6.2 },
};

// where each house's door is, and the way you face to walk in
export function doorOf(id) {
  let i = NORTH.indexOf(id);
  if (i >= 0) return { x: XS[i] + 1.6, z: -FRONT + 0.1, face: 0 };
  i = SOUTH.indexOf(id);
  if (i >= 0) return { x: XS[i] - 1.6, z: FRONT - 0.1, face: Math.PI };
  if (id === WEST) return { x: -SIDE + 0.1, z: -1.6, face: Math.PI / 2 };
  if (id === EAST) return { x: SIDE - 0.1, z: 1.6, face: -Math.PI / 2 };
  if (id === 'country') return { x: 21.3, z: 8.6, face: Math.PI };
  return null;
}

// warm stone setts in running courses, with thin soft joints
function paving(ctx, w, h) {
  const r = rand(31);
  ctx.fillStyle = '#b5a587';
  ctx.fillRect(0, 0, w, h);
  const rows = 8;
  for (let j = 0; j < rows; j++) {
    const y = (j * h) / rows;
    let x = j % 2 ? -16 : 0;
    while (x < w) {
      const len = 26 + r() * 22;
      ctx.fillStyle = `hsl(${32 + r() * 10}, ${18 + r() * 10}%, ${70 + r() * 9}%)`;
      ctx.fillRect(x + 1.5, y + 1.5, len - 3, h / rows - 3);
      x += len;
    }
  }
}

function stripes(a, b) {
  return (ctx, w, h) => {
    const n = 10;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? b : a;
      ctx.fillRect((i * w) / n, 0, w / n + 1, h);
    }
  };
}

export function buildStreet(scene) {
  const kit = makeKit(scene, [-22.6, -8.7, 22.6, 8.7]);
  kit.light({
    sky: '#ffe6c2', ground: '#7a6a52', ambient: 1.0,
    sun: '#ffd49a', sunI: 2.4, pos: [-16, 24, 12],
    background: '#e8c79e', fog: [40, 95],
  });
  // the ground beyond the houses, so the corners open onto country, not a void
  const fields = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat('#8aa36a'));
  fields.rotation.x = -Math.PI / 2;
  fields.position.y = -0.01;
  fields.receiveShadow = true;
  scene.add(fields);
  kit.floor(48, 20, 0, 0, canvasTexture(256, 256, paving, [16, 7]), 0.005);
  // a ring of darker stone round the fountain
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 4.2, 40), mat('#a59c88'));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.012;
  ring.receiveShadow = true;
  kit.ground.add(ring);

  const build = (id, fx, fz, ry) => {
    const b = BENCHES.find((p) => p.id === id);
    const info = b ? { name: b.name, sub: b.atelier } : OTHER[id];
    const c = HOUSES[id];
    const g = new THREE.Group();
    g.position.set(fx, 0, fz);
    g.rotation.y = ry;
    scene.add(g);
    const W = 7.2;
    const H = c.h;
    const box = (w, h, d, color, x, y, z) => kit.box(w, h, d, color, x, y, z, g);
    // the house: walls, plinth, cornice and a pitched roof
    box(W, H, 4, c.wall, 0, H / 2, -2);
    box(W + 0.12, 0.45, 4.1, '#8c8270', 0, 0.22, -2);
    box(W + 0.2, 0.22, 4.2, c.trim, 0, H, -2);
    for (const s of [-1, 1]) {
      const r = box(W + 0.5, 0.16, 2.75, c.roof, 0, H + 0.75, -2 + s * 1.05);
      r.rotation.x = s * 0.6;
    }
    // ground floor: a big glowing shop window and an open, lit door
    const glowMat = new THREE.MeshStandardMaterial({ color: '#ffe2b0', emissive: '#ffcf86', emissiveIntensity: 0.8, roughness: 1 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 2.1), glowMat);
    win.position.set(-1.5, 1.75, 0.03);
    g.add(win);
    if (b) {
      const tex = kit.loader.load(`img/print/${b.id}.jpg`);
      tex.colorSpace = THREE.SRGBColorSpace;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.98), new THREE.MeshBasicMaterial({ map: tex }));
      p.position.set(-1.5, 1.65, 0.05);
      g.add(p);
    }
    for (const x of [-3.0, -1.5, 0.0]) box(0.08, 2.2, 0.1, c.trim, x, 1.75, 0.06);
    box(3.1, 0.1, 0.12, c.trim, -1.5, 2.85, 0.06);
    box(3.2, 0.12, 0.3, c.trim, -1.5, 0.66, 0.12); // sill
    const doorway = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.35), glowMat);
    doorway.position.set(1.6, 1.18, 0.03);
    g.add(doorway);
    const leaf = box(0.08, 2.25, 1.2, c.trim, 2.28, 1.13, 0.55);
    leaf.rotation.y = 0.35; // the door stands open
    for (const x of [0.88, 2.32]) box(0.14, 2.6, 0.16, c.trim, x, 1.3, 0.07);
    box(1.6, 0.16, 0.16, c.trim, 1.6, 2.58, 0.07);
    // a striped awning over the window and the door
    const awn = new THREE.Mesh(
      new THREE.PlaneGeometry(6.6, 1.5),
      new THREE.MeshStandardMaterial({ map: canvasTexture(256, 64, stripes('#f4ecdc', c.stripe)), side: THREE.DoubleSide, roughness: 1 }),
    );
    awn.position.set(0, 3.35, 0.65);
    awn.rotation.x = -Math.PI / 2 + 0.5;
    awn.castShadow = true;
    g.add(awn);
    for (const x of [-3.2, 3.2]) {
      const arm = box(0.04, 0.04, 1.4, '#2d2b29', x, 3.15, 0.65);
      arm.rotation.x = 0.5;
    }
    // the painted fascia and, above, lit upper windows with flower boxes
    box(4.6, 0.6, 0.1, c.trim, 0, 3.95, 0.04);
    const fascia = new THREE.Mesh(new THREE.PlaneGeometry(4.3, 0.48), new THREE.MeshStandardMaterial({ map: textSign([[info.name, 58]], { w: 768, h: 86, bg: '#efe6d2' }), roughness: 1 }));
    fascia.position.set(0, 3.95, 0.1);
    g.add(fascia);
    const blooms = ['#c8384e', '#e0b040', '#9a4fb0'];
    if (H >= 5.4) {
      [-2.2, 0, 2.2].forEach((x, wi) => {
        const u = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshStandardMaterial({ color: '#f6dcb0', emissive: '#f0b868', emissiveIntensity: 0.35 }));
        u.position.set(x, H - 1.05, 0.03);
        g.add(u);
        box(1.04, 0.08, 0.1, c.trim, x, H - 0.5, 0.05);
        box(1.04, 0.08, 0.1, c.trim, x, H - 1.6, 0.05);
        box(1.1, 0.22, 0.32, '#6b4a32', x, H - 1.75, 0.2); // flower box
        for (let k = 0; k < 3; k++) {
          const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(k === 1 ? '#4c7a3a' : blooms[(k + wi) % 3]));
          f.position.set(x - 0.32 + k * 0.32, H - 1.55, 0.22);
          g.add(f);
        }
      });
    }
    // the hanging sign, out over the pavement
    box(0.06, 0.06, 1.1, '#2d2b29', 3.4, 3.7, 0.55);
    const short = b ? b.name.split(' ')[0] : info.name.replace(/^The /, '').split(' ')[0].replace(/'s$/, '');
    const blade = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.7),
      new THREE.MeshStandardMaterial({ map: textSign([[short, 54], [b ? String(b.year) : '', 34, true]], { w: 300, h: 220, bg: '#f2e9d6' }), side: THREE.DoubleSide, roughness: 1 }),
    );
    blade.position.set(3.4, 3.25, 1.05);
    blade.rotation.y = Math.PI / 2;
    g.add(blade);
    // houses between the camera and you step aside like the walls inside
    const sideways = Math.abs(Math.sin(ry)) > 0.5;
    const centre = new THREE.Vector3(0, 0, -2).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(fx, 0, fz));
    kit.fadeGroup(g, sideways ? 'x' : 'z', sideways ? centre.x : centre.z);
    // the house as an obstacle
    const hw = W / 2;
    if (sideways) kit.collide(centre.x - 2, fz - hw, centre.x + 2, fz + hw);
    else kit.collide(fx - hw, centre.z - 2, fx + hw, centre.z + 2);
    // the door you walk through, and a readable name over it
    const d = doorOf(id);
    const stand = [d.x + Math.sin(d.face) * 0.9, d.z + Math.cos(d.face) * 0.9];
    kit.interactables.push({
      kind: 'exit', id, stand, face: d.face, mesh: g,
      label: b ? `Enter ${b.atelier.toLowerCase()} (${b.name.toLowerCase()})` : `Go into ${info.name.toLowerCase()}`,
    });
    const label = document.createElement('div');
    label.className = 'door-tag';
    label.innerHTML = b ? `${b.name}<small>${b.atelier}</small>` : info.name;
    const tagObj = new CSS2DObject(label);
    tagObj.position.set(d.x, 2.9, d.z);
    scene.add(tagObj);
  };
  NORTH.forEach((id, i) => build(id, XS[i], -FRONT, 0));
  SOUTH.forEach((id, i) => build(id, XS[i], FRONT, Math.PI));
  build(WEST, -SIDE, 0, Math.PI / 2);
  build(EAST, SIDE, 0, -Math.PI / 2);

  // ---- the middle of the square ---------------------------------------------
  // the fountain
  kit.cyl(2.3, 2.4, 0.6, '#b8ae98', 0, 0.3, 0, scene, 28);
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.05, 28), mat('#6a9aac', { roughness: 0.15, metalness: 0.2 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.61;
  scene.add(water);
  kit.cyl(0.25, 0.35, 1.6, '#b8ae98', 0, 1.0, 0, scene, 12);
  kit.cyl(0.9, 0.5, 0.25, '#b8ae98', 0, 1.85, 0, scene, 20);
  const spray = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.9, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#e6f2f6', transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
  spray.position.y = 2.35;
  spray.rotation.x = Math.PI;
  scene.add(spray);
  kit.collide(-2.4, -2.4, 2.4, 2.4);

  // trees in round beds, and benches facing the fountain
  const tree = (x, z) => {
    kit.cyl(1.0, 1.0, 0.3, '#8c8270', x, 0.15, z, scene, 16);
    kit.cyl(0.9, 0.9, 0.02, '#5a4a32', x, 0.31, z, scene, 16);
    kit.cyl(0.14, 0.2, 2.4, '#6b4a32', x, 1.4, z, scene, 7);
    const greens = ['#5f8a3e', '#6f9a48', '#557f37'];
    [[0, 3.1, 0, 1.3], [0.7, 2.7, 0.3, 0.9], [-0.6, 2.8, -0.4, 0.95], [0.1, 3.7, -0.2, 0.8]].forEach(([dx, dy, dz, r], i) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(greens[i % 3]));
      m.position.set(x + dx, dy, z + dz);
      m.castShadow = true;
      scene.add(m);
    });
    kit.collide(x - 1.0, z - 1.0, x + 1.0, z + 1.0);
  };
  const bench = (x, z, ry) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    kit.box(1.8, 0.08, 0.5, PALETTE.wood, 0, 0.48, 0, g);
    kit.box(1.8, 0.45, 0.07, PALETTE.wood, 0, 0.78, -0.24, g);
    for (const sx of [-0.8, 0.8]) kit.box(0.08, 0.48, 0.45, PALETTE.iron, sx, 0.24, 0, g);
    const q = Math.abs(Math.sin(ry)) > 0.5;
    kit.collide(x - (q ? 0.3 : 0.95), z - (q ? 0.95 : 0.3), x + (q ? 0.3 : 0.95), z + (q ? 0.95 : 0.3));
  };
  for (const [x, z] of [[-9, -4], [9, -4], [-9, 4], [9, 4]]) tree(x, z);
  bench(-5.2, 0, Math.PI / 2);
  bench(5.2, 0, -Math.PI / 2);
  bench(0, -5.0, 0);

  // a few lamp posts, already glowing as the afternoon goes
  for (const [x, z] of [[-13, -5.5], [13, -5.5], [-13, 5.5], [13, 5.5]]) {
    kit.cyl(0.07, 0.1, 3.2, PALETTE.iron, x, 1.6, z);
    kit.box(0.34, 0.45, 0.34, mat('#f6d29a', { emissive: '#f6a640', emissiveIntensity: 0.7 }), x, 3.4, z, scene, { shadow: false });
    kit.box(0.44, 0.08, 0.44, PALETTE.iron, x, 3.66, z, scene, { shadow: false });
    kit.collide(x - 0.15, z - 0.15, x + 0.15, z + 0.15);
  }

  // the gate out to the country, in the south-east corner
  const gate = new THREE.Group();
  gate.position.set(21.3, 0, 8.9);
  scene.add(gate);
  for (const sx of [-1.1, 1.1]) kit.box(0.3, 2.6, 0.3, '#8c8270', sx, 1.3, 0, gate);
  const lintel = kit.box(2.6, 0.3, 0.32, '#8c8270', 0, 2.75, 0, gate);
  void lintel;
  const gs = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshStandardMaterial({ map: textSign([['To the country', 50]], { w: 420, h: 104 }), roughness: 1, side: THREE.DoubleSide }));
  gs.position.set(0, 3.25, 0);
  gate.add(gs);
  for (let k = 0; k < 6; k++) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mat(k % 2 ? '#5f8a3e' : '#4f7a34'));
    leaf.position.set(-1.1 + (k % 3) * 1.1, 2.95 + (k % 2) * 0.2, 0.1);
    gate.add(leaf);
  }
  kit.interactables.push({ kind: 'exit', id: 'country', label: 'Out through the gate to the country', stand: [21.3, 7.7], face: Math.PI, mesh: gate });
  const gtag = document.createElement('div');
  gtag.className = 'door-tag';
  gtag.innerHTML = 'The Country<small>meadow, wood, shore</small>';
  const gto = new CSS2DObject(gtag);
  gto.position.set(21.3, 2.2, 8.6);
  scene.add(gto);

  // flower tubs in the open corners
  for (const [x, z] of [[-20.5, -7.2], [20.5, -7.2], [-20.5, 7.2]]) {
    kit.box(1.4, 0.6, 1.4, '#9a6a4a', x, 0.3, z, scene, { collide: true });
    for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), mat(k % 2 ? '#5f8a3e' : ['#c8384e', '#e0b040', '#9a4fb0'][k % 3]));
      m.position.set(x - 0.35 + (k % 3) * 0.35, 0.8 + (k % 2) * 0.15, z - 0.3 + Math.floor(k / 3) * 0.6);
      scene.add(m);
    }
  }

  // trees beyond the houses, seen through the open corners
  for (const [x, z] of [[-27, -13], [-29, -9], [27, -13], [29, -9], [-27, 13], [-30, 9], [27, 13], [30, 9]]) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 0), mat('#5f8a3e'));
    m.position.set(x, 2.6, z);
    scene.add(m);
    kit.cyl(0.2, 0.3, 2.0, '#6b4a32', x, 1.0, z, scene, 6);
  }

  // a welcome board by where you arrive
  const board = new THREE.Group();
  board.position.set(-3.2, 0, 5.8);
  board.rotation.y = 0.3;
  scene.add(board);
  kit.box(0.08, 1.2, 0.08, PALETTE.woodDark, -0.45, 0.6, 0, board);
  kit.box(0.08, 1.2, 0.08, PALETTE.woodDark, 0.45, 0.6, 0, board);
  const note = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshStandardMaterial({ map: textSign([['Atelier Square', 50], ['nine ateliers, one for', 28, true], ['every process', 28, true]], { w: 400, h: 290 }), roughness: 1 }));
  note.position.set(0, 1.45, 0.05);
  board.add(note);
  kit.collide(-3.8, 5.5, -2.6, 6.1);

  return kit;
}
