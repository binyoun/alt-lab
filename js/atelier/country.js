// The Country: the land beyond Atelier Square, where photographers went
// out to gather. A road from the square's gate runs north into a meadow
// of wildflowers and berries, a fern wood, a stream with a bridge and a
// mill, a seashore with rock pools and a salt pan, and a hill with ruins.
// The sun crosses the sky and clouds come and go.

import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { makeKit, PALETTE, mat, rand, textSign } from './world.js';

const SIZE = 38; // walkable half-size

// the stream wanders north to south a little east of the middle
export const streamX = (z) => 8 + Math.sin(z * 0.12) * 3;
const onBridge = (x, z) => Math.abs(z) < 1.4 && Math.abs(x - streamX(z)) < 2.4;

// the lie of the land
export function heightAt(x, z) {
  let h = 4.2 * Math.exp(-((x - 20) ** 2 + (z + 24) ** 2) / 90); // the hill
  if (!onBridge(x, z)) h -= 0.55 * Math.exp(-((x - streamX(z)) ** 2) / 2.2); // the stream bed
  if (x > 26) h -= (x - 26) * 0.12; // down to the shore
  h += Math.sin(x * 0.15) * Math.cos(z * 0.13) * 0.22;
  return h;
}

// the road, as segments from the gate
const ROAD = [
  [[0, 37], [0, 6]], [[0, 6], [-14, -2]], [[0, 6], streamBridge()], [[streamBridge()[0], 0], [26, 4]],
  [[streamBridge()[0], 0], [17, -16]], [[-14, -2], [-18, -14]],
];
function streamBridge() { return [streamX(0), 0]; }
function nearRoad(x, z) {
  let best = 99;
  for (const [[ax, az], [bx, bz]] of ROAD) {
    const dx = bx - ax;
    const dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

// the places, for labels and later for gathering
export const PLACES = {
  meadow: { name: 'The Meadow', at: [-17, 9] },
  wood: { name: 'The Fern Wood', at: [-20, -22] },
  stream: { name: 'The Mill Stream', at: [12, -6] },
  shore: { name: 'The Shore', at: [30, 6] },
  hill: { name: 'Ruin Hill', at: [20, -24] },
};

export function buildCountry(scene) {
  const kit = makeKit(scene, [-SIZE, -SIZE, 33, SIZE]);
  kit.heightAt = heightAt;
  kit.light({
    sky: '#dff0ff', ground: '#6a7a4a', ambient: 1.0,
    sun: '#fff0d0', sunI: 2.6, pos: [-20, 30, 14],
    background: '#a9cde8', fog: [55, 130], beyond: false,
  });
  const r = rand(77);
  const ground = (x, z) => heightAt(x, z);

  // ---- the land: one sheet of ground, coloured by what grows where -------------
  const N = 120;
  const geo = new THREE.PlaneGeometry(120, 120, N, N);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = heightAt(x, z);
    pos.setY(i, y);
    const n = r() * 0.06;
    if (x > 26.5) col.set('#d9c79a').offsetHSL(0, 0, n - 0.03); // sand
    else if (nearRoad(x, z) < 1.3) col.set('#b9a57e').offsetHSL(0, 0, n - 0.03); // the road
    else if (Math.hypot(x + 20, z + 22) < 15) col.set('#4f6a3a').offsetHSL(0, 0, n - 0.03); // under the wood
    else if (Math.hypot(x + 17, z - 9) < 11) col.set('#8fae58').offsetHSL(0.02, 0, n); // the meadow
    else col.set('#7d9a52').offsetHSL(0, 0, n - 0.03);
    if (Math.abs(x - streamX(z)) < 1.6 && !onBridge(x, z)) col.set('#6a7a5a');
    colors.set([col.r, col.g, col.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  land.receiveShadow = true;
  kit.ground.add(land);

  // the sea, out past the shore
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 300), new THREE.MeshStandardMaterial({ color: '#4f86a6', roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(134, -0.6, 0);
  scene.add(sea);
  kit.sea = sea;

  // ---- the stream, its bridge and the mill ----------------------------------------
  // one smooth ribbon of water along the stream's line
  const verts = [];
  const idx = [];
  for (let z = -60, i = 0; z <= 60; z += 0.5, i++) {
    const x = streamX(z);
    verts.push(x - 1.2, -0.28, z, x + 1.2, -0.28, z);
    if (i > 0) idx.push(2 * i - 2, 2 * i, 2 * i - 1, 2 * i - 1, 2 * i, 2 * i + 1);
  }
  const ribbon = new THREE.BufferGeometry();
  ribbon.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  ribbon.setIndex(idx);
  ribbon.computeVertexNormals();
  scene.add(new THREE.Mesh(ribbon, new THREE.MeshStandardMaterial({ color: '#5e9ab4', roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide })));
  for (let z = -SIZE; z < SIZE; z += 1) {
    const x = streamX(z + 0.5);
    if (!onBridge(x, z + 0.5)) kit.collide(x - 1.1, z, x + 1.1, z + 1);
  }
  const bx = streamX(0);
  const bridge = new THREE.Group();
  bridge.position.set(bx, 0, 0);
  scene.add(bridge);
  kit.box(5.0, 0.16, 2.4, PALETTE.wood, 0, 0.1, 0, bridge);
  for (const sz of [-1.15, 1.15]) {
    kit.box(5.0, 0.08, 0.08, PALETTE.woodDark, 0, 0.9, sz, bridge);
    for (let i = -2; i <= 2; i++) kit.box(0.1, 0.85, 0.1, PALETTE.woodDark, i * 1.2, 0.5, sz, bridge);
    kit.collide(bx - 2.5, sz - 0.06, bx + 2.5, sz + 0.06);
  }
  // the mill, its wheel turning in the stream
  const mx = streamX(-8) + 3.4;
  const millY = ground(mx, -8);
  kit.box(4.2, 3.6, 3.6, '#c9b591', mx + 0.6, millY + 1.8, -8, scene, { collide: true });
  for (const s of [-1, 1]) {
    const roof = kit.box(4.8, 0.16, 2.6, '#7a4a32', mx + 0.6, millY + 4.15, -8 + s * 0.95);
    roof.rotation.x = s * 0.62;
  }
  const wheel = new THREE.Group();
  wheel.position.set(mx - 1.75, millY + 1.2, -8);
  scene.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.08, 6, 24), mat(PALETTE.woodDark));
  rim.rotation.y = Math.PI / 2;
  wheel.add(rim);
  for (let i = 0; i < 8; i++) {
    const paddle = kit.box(0.5, 0.06, 2.8, PALETTE.wood, 0, 0, 0, wheel);
    paddle.rotation.x = (i / 8) * Math.PI;
  }
  kit.wheel = wheel;

  // ---- the meadow: wildflowers, and bushes with berries -------------------------
  const flowers = ['#c8384e', '#3d63c8', '#f4f0e0', '#e8c040', '#b04fa0'];
  const flowerGeo = new THREE.IcosahedronGeometry(0.09, 0);
  for (let i = 0; i < 520; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 11;
    const x = -17 + Math.cos(a) * d;
    const z = 9 + Math.sin(a) * d;
    if (nearRoad(x, z) < 1.5) continue;
    const f = new THREE.Mesh(flowerGeo, mat(flowers[(r() * flowers.length) | 0]));
    f.position.set(x, ground(x, z) + 0.28 + r() * 0.15, z);
    scene.add(f);
    if (i % 3 === 0) {
      const stem = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.02), mat('#4c7a3a'));
      stem.position.set(x, ground(x, z) + 0.14, z);
      scene.add(stem);
    }
  }
  const bush = (x, z, berry) => {
    const y = ground(x, z);
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 + r() * 0.2, 0), mat(k % 2 ? '#4f7a34' : '#5f8a3e'));
      m.position.set(x + (r() - 0.5) * 0.9, y + 0.5 + r() * 0.3, z + (r() - 0.5) * 0.9);
      m.castShadow = true;
      scene.add(m);
    }
    for (let k = 0; k < 10; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat(berry));
      b.position.set(x + (r() - 0.5) * 1.2, y + 0.4 + r() * 0.7, z + (r() - 0.5) * 1.2);
      scene.add(b);
    }
    kit.collide(x - 0.8, z - 0.8, x + 0.8, z + 0.8);
  };
  bush(-25, 13, '#3c1430');
  bush(-10, 16, '#6e1838');
  bush(-22, 3, '#3c1430');
  bush(-9, 2.5, '#2a1a40');

  // ---- the fern wood ---------------------------------------------------------------------
  const tree = (x, z, kind) => {
    const y = ground(x, z);
    if (kind === 'pine') {
      kit.cyl(0.16, 0.24, 2.2, '#5a3e28', x, y + 1.1, z, scene, 6);
      for (let k = 0; k < 3; k++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.5 - k * 0.38, 1.8, 7), mat(k % 2 ? '#2f5a34' : '#3a6a3c'));
        c.position.set(x, y + 2.4 + k * 1.05, z);
        c.castShadow = true;
        scene.add(c);
      }
    } else {
      kit.cyl(0.2, 0.3, 2.6, '#5a3e28', x, y + 1.3, z, scene, 7);
      for (const [dx, dy, dz, rr] of [[0, 3.2, 0, 1.5], [0.8, 2.8, 0.4, 1.0], [-0.7, 2.9, -0.5, 1.05]]) {
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(rr, 0), mat(['#4f7a34', '#5f8a3e', '#46702f'][(r() * 3) | 0]));
        m.position.set(x + dx, y + dy, z + dz);
        m.castShadow = true;
        scene.add(m);
      }
    }
    kit.collide(x - 0.32, z - 0.32, x + 0.32, z + 0.32);
  };
  const fern = (x, z) => {
    const y = ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = r() * Math.PI;
    scene.add(g);
    for (let k = 0; k < 6; k++) {
      const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.9), mat('#4c8a3a', { side: THREE.DoubleSide }));
      frond.position.set(0, 0.32, 0);
      frond.rotation.set(-0.9, (k / 6) * Math.PI * 2, 0, 'YXZ');
      frond.translateY(0.3);
      g.add(frond);
    }
  };
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2;
    const d = 2.5 + Math.sqrt(r()) * 13;
    const x = -20 + Math.cos(a) * d;
    const z = -22 + Math.sin(a) * d;
    if (nearRoad(x, z) < 2.2 || z < -SIZE + 1 || x < -SIZE + 1) continue;
    tree(x, z, r() < 0.45 ? 'pine' : 'oak');
  }
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 14;
    const x = -20 + Math.cos(a) * d;
    const z = -22 + Math.sin(a) * d;
    if (nearRoad(x, z) < 1.3) continue;
    fern(x, z);
  }
  // a few trees scattered across the open land
  for (const [x, z] of [[-30, 26], [-4, 24], [10, 20], [18, 12], [-32, -4], [3, -18], [-6, -30], [22, 28]]) tree(x, z, 'oak');

  // ---- the shore: rock pools with seaweed, and a salt pan -------------------------------
  const pool = (x, z) => {
    const y = ground(x, z);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35 + r() * 0.25, 0), mat(['#7a746a', '#8a8478', '#6a655c'][k % 3]));
      rock.position.set(x + Math.cos(a) * 1.3, y + 0.15, z + Math.sin(a) * 1.3);
      rock.castShadow = true;
      scene.add(rock);
    }
    const w = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), mat('#4f86a6', { roughness: 0.15 }));
    w.rotation.x = -Math.PI / 2;
    w.position.set(x, y + 0.06, z);
    scene.add(w);
    for (let k = 0; k < 5; k++) {
      const weed = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.12), mat(['#5a6a2a', '#6a4a2a', '#3a5a3a'][k % 3]));
      weed.position.set(x + (r() - 0.5) * 1.2, y + 0.2, z + (r() - 0.5) * 1.2);
      weed.rotation.z = (r() - 0.5) * 0.8;
      scene.add(weed);
    }
    kit.collide(x - 1.2, z - 1.2, x + 1.2, z + 1.2);
  };
  pool(30, 11);
  pool(31, -3);
  pool(29.5, 21);
  // the salt pan: shallow beds of white crystals
  for (let i = 0; i < 3; i++) {
    const x = 29 + i * 1.6;
    const y = ground(x, 30);
    kit.box(1.4, 0.12, 2.6, '#a5937a', x, y + 0.06, 30);
    kit.box(1.2, 0.02, 2.4, '#f4f2ec', x, y + 0.13, 30, kit.scene, { shadow: false });
  }
  kit.collide(28.2, 28.6, 33, 31.4);

  // ---- Ruin Hill --------------------------------------------------------------------------
  const hy = ground(20, -24);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const x = 20 + Math.cos(a) * 3.4;
    const z = -24 + Math.sin(a) * 3.4;
    const h = k % 3 === 0 ? 3.2 : 1.0 + r() * 1.4;
    kit.box(0.7, h, 0.7, '#b8b0a0', x, ground(x, z) + h / 2, z, scene, { collide: true });
  }
  // a standing arch at the back of the ruin
  for (const ax of [18.2, 21.8]) kit.box(0.7, 3.6, 0.7, '#b8b0a0', ax, ground(ax, -27.4) + 1.8, -27.4, scene, { collide: true });
  kit.box(4.3, 0.6, 0.75, '#b8b0a0', 20, ground(20, -27.4) + 3.85, -27.4);
  kit.box(1.6, 0.4, 0.5, PALETTE.wood, 20, hy + 0.4, -21.5, scene, { collide: true }); // a bench at the viewpoint

  // ---- signs: back to the square, and where the places are --------------------------------
  const post = (x, z, lines, rot = 0) => {
    const y = ground(x, z);
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    kit.box(0.12, 1.8, 0.12, PALETTE.woodDark, 0, 0.9, 0, g);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshStandardMaterial({ map: textSign(lines, { w: 360, h: 150 }), roughness: 1, side: THREE.DoubleSide }));
    sign.position.y = 1.55;
    g.add(sign);
    kit.collide(x - 0.12, z - 0.12, x + 0.12, z + 0.12);
    return g;
  };
  const gate = post(1.6, 35.8, [['Atelier Square', 44], ['back through the gate', 24, true]]);
  kit.interactables.push({ kind: 'exit', id: 'street', label: 'Back to Atelier Square', stand: [0, 36.2], face: Math.PI, mesh: gate });
  post(2.0, 7.5, [['Meadow, Wood  /  Mill, Shore', 28], ['Ruin Hill to the north-east', 22, true]], 0.3);
  for (const p of Object.values(PLACES)) {
    const label = document.createElement('div');
    label.className = 'place-tag';
    label.textContent = p.name;
    const o = new CSS2DObject(label);
    o.position.set(p.at[0], ground(...p.at) + 4.5, p.at[1]);
    scene.add(o);
  }

  // ---- life: clouds, birds and butterflies ----------------------------------------------------
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(2 + r() * 1.5, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true }));
      puff.position.set(k * 2.4 - 3.6, r() * 0.8, (r() - 0.5) * 2);
      g.add(puff);
    }
    g.position.set(-70 + r() * 140, 22 + r() * 6, -60 + r() * 120);
    scene.add(g);
    clouds.push(g);
  }
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.03, 0.14), mat('#2a2622'));
      wing.position.x = s * 0.22;
      g.add(wing);
    }
    g.userData = { cx: -20 + r() * 40, cz: -20 + r() * 30, rad: 6 + r() * 10, y: 9 + r() * 6, speed: 0.15 + r() * 0.2, phase: r() * 10 };
    scene.add(g);
    birds.push(g);
  }
  const butterflies = [];
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const c = ['#f4e070', '#f4f0e0', '#e8904a', '#9ab8e8'][i % 4];
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.12), mat(c, { side: THREE.DoubleSide }));
      wing.position.x = s * 0.07;
      wing.userData.side = s;
      g.add(wing);
    }
    g.userData = { cx: -17 + (r() - 0.5) * 18, cz: 9 + (r() - 0.5) * 16, phase: r() * 10 };
    scene.add(g);
    butterflies.push(g);
  }

  // ---- the day: the sun crosses the sky, clouds come and go ----------------------------------
  const DAY = 15 * 60; // one day every fifteen minutes
  const sunCol = new THREE.Color();
  let cover = 0;
  let coverTarget = 0;
  let nextWeather = 40;
  kit.weather = { time: 0.35, cover: 0 }; // time of day 0 (dawn) .. 1 (dusk); cloud cover 0..1
  kit.tick = (dt, t) => {
    // the sun's arc
    const day = ((t / DAY) + 0.3) % 1;
    kit.weather.time = day;
    const a = day * Math.PI;
    const elev = Math.sin(a);
    if (kit.sun) {
      kit.sun.position.set(Math.cos(a) * -40, 6 + elev * 34, 16);
      sunCol.set('#ffb070').lerp(new THREE.Color('#fff4e0'), Math.min(1, elev * 1.6));
      kit.sun.color.copy(sunCol);
    }
    // weather drifts between clear and overcast
    nextWeather -= dt;
    if (nextWeather <= 0) {
      coverTarget = r() < 0.35 ? 0.6 + r() * 0.35 : r() * 0.3;
      nextWeather = 50 + r() * 90;
    }
    cover += (coverTarget - cover) * Math.min(1, dt * 0.2);
    kit.weather.cover = cover;
    if (kit.sun) kit.sun.intensity = (0.6 + elev * 2.2) * (1 - cover * 0.7);
    if (kit.hemi) kit.hemi.intensity = 0.7 + elev * 0.4 - cover * 0.15;
    for (const c of clouds) {
      c.position.x += dt * (0.8 + cover);
      if (c.position.x > 80) c.position.x = -80;
      c.children.forEach((p) => p.material.color.setScalar(1 - cover * 0.35));
    }
    for (const b of birds) {
      const u = b.userData;
      const k = t * u.speed + u.phase;
      b.position.set(u.cx + Math.cos(k) * u.rad, u.y + Math.sin(k * 2) * 0.6, u.cz + Math.sin(k) * u.rad);
      b.rotation.y = -k;
      const flap = Math.sin(t * 9 + u.phase) * 0.5;
      b.children[0].rotation.z = flap;
      b.children[1].rotation.z = -flap;
    }
    for (const f of butterflies) {
      const u = f.userData;
      const k = t * 0.5 + u.phase;
      const x = u.cx + Math.sin(k) * 2.5 + Math.sin(k * 2.3) * 0.8;
      const z = u.cz + Math.cos(k * 0.8) * 2.5;
      f.position.set(x, ground(x, z) + 0.6 + Math.sin(k * 3) * 0.25, z);
      f.rotation.y = k;
      const flap = Math.sin(t * 18 + u.phase) * 0.9;
      f.children[0].rotation.y = flap;
      f.children[1].rotation.y = -flap;
    }
    if (kit.wheel) kit.wheel.rotation.x -= dt * 0.6;
  };

  return kit;
}

// how the sky is, in words, for the HUD and the Master
export function skyWords({ time, cover }) {
  const part = time < 0.2 ? 'Morning' : time < 0.4 ? 'Late morning' : time < 0.6 ? 'Midday' : time < 0.8 ? 'Afternoon' : 'Evening';
  const sky = cover > 0.6 ? 'overcast' : cover > 0.3 ? 'hazy sun' : 'bright sun';
  return `${part}, ${sky}`;
}
