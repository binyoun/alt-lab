// The nine ateliers off Atelier Row, one per process. Every room shares a
// plan (door to the south, the bench to the north, a drying line along the
// east wall, its history chapter on the west wall) and differs in light,
// surfaces and the things lying about.

import * as THREE from 'three';
import { makeKit, BENCHES, PALETTE, mat, canvasTexture, planks, flagstones, grass, bricks, wallpaper, checker } from './world.js';

const W = 6.6; // half width
const D = 5.2; // half depth

export function buildAtelier(scene, id) {
  const b = BENCHES.find((p) => p.id === id);
  const style = STYLES[id];
  const kit = makeKit(scene, [-W + 0.3, -D + 0.3, W - 0.3, D - 0.3]);
  kit.light(style.light);
  kit.floor(W * 2, D * 2, 0, 0, canvasTexture(256, 256, style.floor, style.floorRepeat || [4, 3]));

  const wallOpts = { h: style.wallH || 3.4, color: style.wall, tex: style.wallTex ? canvasTexture(256, 256, style.wallTex, [3, 1]) : null, trim: style.trim === undefined ? PALETTE.woodDark : style.trim };
  if (style.glass) Object.assign(wallOpts, { color: '#cfe8e6', tex: null });
  const walls = [
    kit.wall(-W, -D, W, -D, wallOpts),
    kit.wall(-W, D, -1, D, wallOpts),
    kit.wall(1, D, W, D, wallOpts),
    kit.wall(-W, -D, -W, D, wallOpts),
    kit.wall(W, -D, W, D, wallOpts),
  ];
  if (style.glass) for (const w of walls) { w.material.opacity = 0.28; w.userData.baseOpacity = 0.28; }
  const lintel = new THREE.MeshStandardMaterial({ color: style.trim || PALETTE.woodDark, flatShading: true, transparent: true });
  kit.fade(kit.box(2.2, 0.7, 0.26, lintel, 0, (wallOpts.h || 3.4) - 0.35, D, scene)); // lintel over the door

  kit.exit(0, D - 0.1, Math.PI, 'Back out to Atelier Row', 'street');
  kit.bench(b, 0, -D + 1.6, 0);
  kit.plaque(b.chapter, -W + 0.15, 0.4, Math.PI / 2);
  kit.line(W - 1.4, -D + 1.6, W - 1.4, D - 1.8, 2.25, 7);
  style.dress(kit, b);
  return kit;
}

// ---------------------------------------------------------------------------
// small furniture

function shelf(kit, x, z, rot, items = []) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  kit.scene.add(g);
  for (const y of [0.9, 1.5, 2.1]) kit.box(1.6, 0.05, 0.35, PALETTE.wood, 0, y, 0, g);
  for (const sx of [-0.78, 0.78]) kit.box(0.05, 2.2, 0.35, PALETTE.woodDark, sx, 1.1, 0, g);
  items.forEach(([color, h, r], i) => {
    const row = [0.9, 1.5, 2.1][i % 3];
    const m = kit.cyl(r || 0.06, r || 0.06, h || 0.22, mat(color, { roughness: 0.3 }), -0.55 + (Math.floor(i / 3) % 4) * 0.36, row + (h || 0.22) / 2 + 0.03, 0, g);
    m.castShadow = true;
  });
  const quarter = Math.abs(Math.sin(rot)) > 0.5;
  kit.collide(x - (quarter ? 0.25 : 0.85), z - (quarter ? 0.85 : 0.25), x + (quarter ? 0.25 : 0.85), z + (quarter ? 0.85 : 0.25));
  return g;
}

function pot(kit, x, z, s = 1, leaf = '#3f5a32', bloom = null) {
  kit.cyl(0.22 * s, 0.16 * s, 0.35 * s, '#9a5a3c', x, 0.17 * s, z);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 * s, 0), mat(leaf));
    m.position.set(x + Math.sin(i * 1.7) * 0.12 * s, (0.45 + (i % 2) * 0.15) * s, z + Math.cos(i * 1.7) * 0.12 * s);
    m.castShadow = true;
    kit.scene.add(m);
  }
  if (bloom) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 * s, 0), mat(bloom));
    m.position.set(x, 0.75 * s, z);
    kit.scene.add(m);
  }
  kit.collide(x - 0.25 * s, z - 0.25 * s, x + 0.25 * s, z + 0.25 * s);
}

// a window that glows with daylight; mullions make a grid of panes
function window(kit, x, y, z, rot, w, h, { light = '#fff6dc', cols = 2, rows = 2, frame = PALETTE.woodDark } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  kit.scene.add(g);
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: light }));
  pane.position.z = 0.02;
  g.add(pane);
  for (let i = 0; i <= cols; i++) kit.box(0.06, h + 0.06, 0.06, frame, -w / 2 + (i * w) / cols, 0, 0.05, g, { shadow: false });
  for (let j = 0; j <= rows; j++) kit.box(w + 0.06, 0.06, 0.06, frame, 0, -h / 2 + (j * h) / rows, 0.05, g, { shadow: false });
  return g;
}

function table(kit, x, z, w = 1.4, d = 0.8, color = PALETTE.wood) {
  kit.box(w, 0.06, d, color, x, 0.8, z);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) kit.box(0.06, 0.8, 0.06, PALETTE.woodDark, x + dx * (w / 2 - 0.06), 0.4, z + dz * (d / 2 - 0.06));
  kit.collide(x - w / 2, z - d / 2, x + w / 2, z + d / 2);
}

function rug(kit, x, z, w, d, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, z);
  m.receiveShadow = true;
  kit.ground.add(m);
}

// ---------------------------------------------------------------------------
// the nine rooms

const warm = { sky: '#f3dcb4', ground: '#2b2117' };

const STYLES = {
  cyanotype: {
    // an open yard under a hard blue sky: iron prints want the sun
    floor: flagstones, wall: '#b9ab92', wallTex: bricks, wallH: 2.4, trim: '#8a7a64',
    light: { sky: '#cfe6ff', ground: '#5c574d', ambient: 1.0, sun: '#fff1d6', sunI: 3.0, pos: [6, 20, 9], background: '#8fb8de', fog: [30, 70] },
    dress(kit) {
      // racks of contact frames tilted at the sun
      for (const z of [-1.2, 1.0]) {
        for (let i = 0; i < 3; i++) {
          const f = kit.box(0.6, 0.03, 0.45, mat(PALETTE.glass, { roughness: 0.1, transparent: true, opacity: 0.6 }), -4.5 + i * 0.75, 0.75, z);
          f.rotation.x = -0.6;
          kit.box(0.62, 0.01, 0.47, '#274a86', -4.5 + i * 0.75, 0.73, z).rotation.x = -0.6;
        }
        kit.box(2.4, 0.5, 0.5, PALETTE.wood, -3.75, 0.25, z, kit.scene, { collide: true });
      }
      // the wash trough with running water
      kit.box(1.6, 0.6, 0.9, PALETTE.stone, 3.6, 0.3, -3.6, kit.scene, { collide: true });
      const water = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.7), mat('#4f7a8c', { roughness: 0.15, metalness: 0.2 }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(3.6, 0.605, -3.6);
      kit.scene.add(water);
      // the sun table, where a coated sheet lies under glass in a printing frame
      kit.box(1.1, 0.06, 0.8, PALETTE.wood, 2.4, 0.8, -0.6);
      for (const [dx, dz] of [[-0.48, -0.33], [0.48, -0.33], [-0.48, 0.33], [0.48, 0.33]]) kit.box(0.06, 0.8, 0.06, PALETTE.woodDark, 2.4 + dx, 0.4, -0.6 + dz);
      kit.collide(1.85, -1.0, 2.95, -0.2);
      // ferns, as Anna Atkins would have had them
      for (const [x, z] of [[-5.8, -4.4], [-5.8, 3.8], [3.8, 4.2], [-2.5, 4.3]]) pot(kit, x, z, 1.2, '#4c7a3a');
      // blue prints drying on a cord over the yard
      kit.print('img/print/cyanotype.jpg', -3.2, 2.0, -5.05, 0, 0.8, 0.6);
    },
  },

  vandyke: {
    // a warm panelled room under a skylight, shelves of brown glass
    floor: planks, wall: '#7a5232', trim: '#3b2618',
    light: { ...warm, ambient: 0.55, sun: '#ffcf8a', sunI: 1.4, pos: [2, 22, 2], background: '#1a120c', fog: [18, 40] },
    dress(kit) {
      shelf(kit, -4.9, -4.75, 0, Array.from({ length: 12 }, (_, i) => [i % 2 ? '#5a3a1e' : '#3d2614', 0.22 + (i % 3) * 0.05, 0.06]));
      shelf(kit, 3.2, -4.75, 0, Array.from({ length: 9 }, (_, i) => [i % 3 ? '#6a4520' : '#2d1d10', 0.2, 0.07]));
      kit.lamp(-3, 2.8, 1.5, 0xffa24d, 6, 8);
      kit.lamp(3, 2.8, 1.5, 0xffa24d, 6, 8);
      table(kit, -3.5, 2.0, 1.6, 0.9);
      kit.cyl(0.08, 0.08, 0.26, mat('#5a3a1e', { roughness: 0.3 }), -3.8, 0.96, 2.0);
      kit.cyl(0.05, 0.05, 0.16, mat('#d6b47a'), -3.2, 0.91, 1.9);
      kit.print('img/print/vandyke.jpg', -6.45, 1.7, -2.4, Math.PI / 2, 0.8, 0.6);
      rug(kit, 0, 1.2, 3.4, 2.2, '#6b2a1c');
    },
  },

  platinum: {
    // a cool, grey studio lit by tall north windows
    floor: checker('#6b6e72', '#585b5f'), wall: '#a7adb3', trim: '#5d6166',
    light: { sky: '#e6eef6', ground: '#3a3d42', ambient: 1.0, sun: '#e9f1ff', sunI: 1.3, pos: [0, 16, -14], background: '#20242a', fog: [20, 44] },
    dress(kit) {
      for (const x of [-4.4, 4.0]) window(kit, x, 1.9, -D + 0.14, 0, 1.6, 2.2, { light: '#eef4fb', cols: 2, rows: 3, frame: '#4b4f55' });
      // the noble prints, hung like a gallery
      kit.print('img/print/platinum.jpg', -6.45, 1.75, -2.6, Math.PI / 2, 0.9, 0.68, '#2a2b2e');
      kit.print('img/print/platinum.jpg', 6.45, 1.75, 3.4, -Math.PI / 2, 0.9, 0.68, '#2a2b2e');
      table(kit, -4, 2.4, 1.6, 0.9, '#cfd3d7');
      kit.box(0.5, 0.02, 0.4, '#e8e5dc', -4.2, 0.84, 2.4); // a sheet of rag paper
      kit.cyl(0.03, 0.03, 0.18, mat('#aab0b6', { metalness: 0.6, roughness: 0.3 }), -3.6, 0.9, 2.3); // a dropper
      kit.lamp(0, 3.0, 0, 0xdfe9ff, 3, 10);
    },
  },

  saltprint: {
    // Talbot's room: stone floor, plaster walls, the lattice window
    floor: flagstones, wall: '#d8cdb6', trim: PALETTE.woodDark,
    light: { ...warm, ambient: 0.75, sun: '#fff0cf', sunI: 1.8, pos: [-4, 16, -12], background: '#1b1712', fog: [18, 42] },
    dress(kit) {
      window(kit, -3.6, 1.9, -D + 0.14, 0, 2.2, 2.0, { light: '#fff4da', cols: 6, rows: 6, frame: '#2b1f16' });
      kit.lamp(-3.6, 2.0, -3.6, 0xfff0d0, 4, 6, false);
      for (const [x, z] of [[-5.5, 3.6], [-4.8, 4.1]]) {
        kit.cyl(0.3, 0.34, 0.6, '#c9b991', x, 0.3, z); // sacks of salt
        kit.collide(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
      }
      table(kit, 3.6, -3.4, 1.4, 0.8);
      for (let i = 0; i < 4; i++) kit.box(0.28, 0.06, 0.38, ['#5b1f1a', '#2c3b2a', '#3a2c1a', '#5b1f1a'][i], 3.4 + i * 0.05, 0.86 + i * 0.06, -3.4); // books
      kit.print('img/print/saltprint.jpg', -6.45, 1.7, -2.6, Math.PI / 2, 0.8, 0.6);
    },
  },

  albumen: {
    // a Victorian parlour: patterned paper, a rug, the family album
    floor: planks, wall: '#ffffff', wallTex: wallpaper('#6e2f2a', '#8a4a3a'), trim: '#2b1a12',
    light: { ...warm, ambient: 0.6, sun: '#ffd8a0', sunI: 0.9, pos: [5, 18, 6], background: '#170e0b', fog: [18, 40] },
    dress(kit) {
      rug(kit, 0, 0.8, 4.2, 3.0, '#3f2a4a');
      // a chandelier
      kit.cyl(0.02, 0.02, 0.8, PALETTE.iron, 0, 3.0, 0.8);
      kit.cyl(0.5, 0.3, 0.08, mat(PALETTE.brass, { metalness: 0.6, roughness: 0.3 }), 0, 2.6, 0.8);
      kit.lamp(0, 2.5, 0.8, 0xffc070, 7, 9);
      // the album on its lectern
      kit.cyl(0.08, 0.12, 1.0, PALETTE.woodDark, -4.6, 0.5, 2.6);
      const al = kit.box(0.7, 0.1, 0.5, '#4a1c18', -4.6, 1.08, 2.6);
      al.rotation.x = 0.3;
      kit.collide(-5.0, 2.3, -4.2, 2.9);
      // crates of eggs
      for (const [x, z] of [[4.6, -3.9], [4.6, -3.1]]) {
        kit.box(0.7, 0.35, 0.6, '#a9875a', x, 0.18, z, kit.scene, { collide: true });
        for (let i = 0; i < 6; i++) {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#efe6d3'));
          e.scale.y = 1.3;
          e.position.set(x - 0.2 + (i % 3) * 0.2, 0.42, z - 0.12 + Math.floor(i / 3) * 0.24);
          kit.scene.add(e);
        }
      }
      kit.print('img/print/albumen.jpg', -6.45, 1.75, -2.4, Math.PI / 2, 0.7, 0.52, PALETTE.brass);
      kit.print('img/print/albumen.jpg', -6.45, 1.75, -1.2, Math.PI / 2, 0.5, 0.38, PALETTE.brass);
    },
  },

  daguerreotype: {
    // the dark plate room: red safelight, mercury and iodine boxes
    floor: planks, wall: '#2e2826', trim: '#140f0c',
    light: { sky: '#8a5a54', ground: '#1e1412', ambient: 0.7, sunI: 0, background: '#0b0807', fog: [14, 30] },
    dress(kit) {
      kit.lamp(0, 2.8, -1.6, 0xff3b2a, 10, 10);
      kit.lamp(-4, 2.6, 2.4, 0xff3b2a, 7, 8);
      kit.lamp(3, 2.6, 2.0, 0xff5a3a, 6, 8);
      // iodine and bromine boxes, the mercury bath on its stand
      kit.box(0.6, 0.5, 0.5, '#4a3626', -4.6, 0.25, -3.9, kit.scene, { collide: true });
      kit.box(0.6, 0.5, 0.5, '#3a2a1e', -3.8, 0.25, -3.9, kit.scene, { collide: true });
      kit.box(0.7, 0.9, 0.5, '#2a1f18', 3.8, 0.45, -3.9, kit.scene, { collide: true });
      kit.cyl(0.08, 0.1, 0.12, mat('#bfc4c8', { metalness: 1, roughness: 0.15 }), 3.8, 0.96, -3.9);
      // the buffing wheel
      table(kit, -4.2, 2.4, 1.4, 0.8);
      const wheel = kit.cyl(0.3, 0.3, 0.08, '#c2a98a', -4.2, 1.15, 2.4, kit.scene, 16);
      wheel.rotation.z = Math.PI / 2;
      // cased plates on the wall, glinting
      for (let i = 0; i < 3; i++) kit.print('img/print/daguerreotype.jpg', -6.45, 1.6, -2.8 + i * 0.85, Math.PI / 2, 0.42, 0.52, '#5a1c1c');
    },
  },

  tintype: {
    // the portrait studio: a painted backdrop, a posing chair, a skylight
    floor: planks, wall: '#8c8070', trim: PALETTE.woodDark,
    light: { ...warm, ambient: 0.75, sun: '#fff1d8', sunI: 2.0, pos: [-3, 22, 3], background: '#191410', fog: [18, 40] },
    dress(kit) {
      // the backdrop on the west wall: painted sky and a column
      const bd = canvasTexture(512, 384, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#7f8a8a');
        g.addColorStop(1, '#b7ad97');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(70,64,56,0.55)';
        ctx.fillRect(w * 0.12, h * 0.15, w * 0.12, h * 0.85);
        ctx.fillRect(w * 0.09, h * 0.12, w * 0.18, h * 0.05);
      });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), new THREE.MeshStandardMaterial({ map: bd, roughness: 1 }));
      back.position.set(-6.4, 1.5, 2.7);
      back.rotation.y = Math.PI / 2;
      kit.scene.add(back);
      // posing chair with its head brace
      kit.box(0.55, 0.06, 0.55, '#5b1f1a', -5.2, 0.5, 2.7);
      kit.box(0.06, 0.6, 0.55, '#5b1f1a', -5.45, 0.8, 2.7);
      for (const [dx, dz] of [[-0.24, -0.24], [0.24, -0.24], [-0.24, 0.24], [0.24, 0.24]]) kit.box(0.05, 0.5, 0.05, PALETTE.woodDark, -5.2 + dx, 0.25, 2.7 + dz);
      kit.cyl(0.02, 0.03, 1.5, PALETTE.iron, -5.6, 0.75, 2.7);
      kit.box(0.05, 0.05, 0.3, PALETTE.iron, -5.55, 1.5, 2.7);
      kit.collide(-5.7, 2.4, -4.9, 3.0);
      // the camera on its stand, aimed at the chair
      const cam = new THREE.Group();
      cam.position.set(-1.6, 0, 2.7);
      cam.rotation.y = -Math.PI / 2;
      kit.scene.add(cam);
      kit.box(0.5, 1.1, 0.5, PALETTE.woodDark, 0, 0.55, 0, cam);
      kit.box(0.5, 0.4, 0.4, PALETTE.wood, 0, 1.3, 0, cam);
      kit.box(0.42, 0.34, 0.3, '#2a1a14', 0, 1.3, 0.32, cam);
      kit.cyl(0.09, 0.09, 0.18, mat(PALETTE.brass, { metalness: 0.7, roughness: 0.35 }), 0, 1.3, 0.55, cam).rotation.x = Math.PI / 2;
      kit.collide(-1.9, 2.4, -1.3, 3.0);
      // finished tintypes pinned by the door
      for (let i = 0; i < 3; i++) kit.print('img/print/tintype.jpg', 2.2 + i * 0.6, 1.7, D - 0.17, Math.PI, 0.4, 0.5, '#1b1b1d');
    },
  },

  anthotype: {
    // a glasshouse full of plants and flowers to crush
    floor: grass, wall: '#cfe8e6', glass: true, trim: '#d8dcd6', wallH: 3.0,
    light: { sky: '#e8ffe8', ground: '#4f6a3a', ambient: 1.0, sun: '#fff6dc', sunI: 2.6, pos: [8, 22, 10], background: '#9cc9a0', fog: [26, 60] },
    dress(kit) {
      // raised beds of flowers along the west, pots everywhere
      kit.box(1.0, 0.5, 3.6, PALETTE.wood, -5.6, 0.25, -2.9, kit.scene, { collide: true });
      for (let i = 0; i < 5; i++) {
        const z = -4.4 + i * 0.75;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(i % 2 ? '#476a35' : '#56743d'));
        m.position.set(-5.6, 0.68, z);
        m.castShadow = true;
        kit.scene.add(m);
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(['#a8344e', '#d8b440', '#8a4fa0', '#e07a3a'][i % 4]));
        f.position.set(-5.6, 0.92, z);
        kit.scene.add(f);
      }
      for (const [x, z, c] of [[3.6, -4.2, '#a8344e'], [-3.2, 4.2, '#d8b440'], [3.2, 4.2, '#8a4fa0'], [-2.4, -4.2, '#e07a3a']]) pot(kit, x, z, 1.3, '#4f7a3a', c);
      kit.print('img/print/anthotype.jpg', 3.2, 1.0, -2.0, -0.3, 0.6, 0.45);
    },
  },

  lumen: {
    // a low attic: a sunbeam through the window onto old paper and leaves
    floor: planks, wall: '#a8916f', trim: '#5a3b26', wallH: 2.6,
    light: { ...warm, ambient: 0.55, sun: '#ffe2a8', sunI: 2.4, pos: [-12, 10, -6], background: '#1a140e', fog: [16, 36] },
    dress(kit) {
      window(kit, -6.45, 1.5, -1.6, Math.PI / 2, 1.4, 1.1, { light: '#fff1c8', cols: 2, rows: 2 });
      // rafters along the side walls, where the roof comes down low
      for (let z = -D + 0.8; z < D; z += 1.6) {
        for (const sx of [-1, 1]) {
          const r = kit.box(0.16, 1.6, 0.16, PALETTE.woodDark, sx * (W - 0.7), 1.9, z, kit.scene, { shadow: false });
          r.rotation.z = sx * 0.7;
        }
      }
      // boxes of expired paper
      for (const [x, z, c] of [[4.6, -3.9, '#d9c8a0'], [4.6, -3.2, '#c7b38a'], [3.9, -3.9, '#e4d6b0']]) kit.box(0.6, 0.35, 0.5, c, x, 0.18, z, kit.scene, { collide: true });
      // leaves drying on strings by the window
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), mat(['#6b8a3a', '#9a7a2a', '#7a4a2a'][i % 3]));
        leaf.scale.set(1, 1.5, 0.15);
        leaf.position.set(-5.6, 1.9 - (i % 2) * 0.2, -3.2 + i * 0.5);
        kit.scene.add(leaf);
      }
      kit.box(0.02, 0.02, 2.6, '#cbbd9c', -5.6, 2.05, -2.2, kit.scene, { shadow: false });
      table(kit, -4.4, 2.4, 1.2, 0.7);
      kit.print('img/print/lumen.jpg', -4.4, 0.88, 2.4, 0, 0.5, 0.38);
    },
  },
};

// ---------------------------------------------------------------------------
// Where the in-world ritual happens in each atelier. For every station:
// where the apprentice stands (and faces), where the sheet lies, and the
// camera shot. Stages map to stations by type: upload, info and paint at
// the bench; hold at the light; reveal in the wash; result held up to look.
// Ateliers without stations still open the ritual as a page.

export const STATIONS = {
  cyanotype: {
    coat: {
      stand: [0, -2.45], face: 0,
      sheet: { pos: [0, 0.955, -3.5], rot: [-Math.PI / 2, 0, 0] },
      cam: { pos: [0, 2.15, -2.55], look: [0, 0.95, -3.5] },
    },
    expose: {
      stand: [2.4, 0.45], face: 0,
      sheet: { pos: [2.4, 0.86, -0.6], rot: [-Math.PI / 2 + 0.25, 0, 0] },
      glass: true,
      cam: { pos: [4.7, 2.6, 1.6], look: [2.3, 0.8, -0.7] },
    },
    wash: {
      stand: [3.6, -2.55], face: 0,
      sheet: { pos: [3.6, 0.615, -3.6], rot: [-Math.PI / 2, 0, 0.1] },
      cam: { pos: [3.6, 2.0, -2.2], look: [3.6, 0.55, -3.6] },
    },
    result: {
      stand: [3.6, -2.55], face: 0,
      sheet: { pos: [3.6, 1.45, -3.15], rot: [0, 0, 0] },
      cam: { pos: [3.6, 1.5, -1.95], look: [3.6, 1.42, -3.15] },
      close: true,
    },
  },
};
