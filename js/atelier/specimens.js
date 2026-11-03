// What grows (and washes up) in the country, for the satchel, the
// herbarium and the benches. Plain data and 2D canvas drawing, no Three.js,
// so the ledger page can use it too.
//
// shape: how the specimen lies on a sheet as a photogram silhouette
// dye:   for berries and petals, the colour their juice gives an anthotype

export const SPECIMENS = [
  { id: 'poppy', name: 'Field poppy', place: 'meadow', shape: 'flower', color: '#c8384e', dye: [0.62, 0.12, 0.14], note: 'Scarlet and short-lived; its juice bleaches fast in sun.' },
  { id: 'cornflower', name: 'Cornflower', place: 'meadow', shape: 'flower', color: '#3d63c8', dye: [0.22, 0.28, 0.58], note: 'A blue that survives in the herbarium for a century.' },
  { id: 'daisy', name: 'Oxeye daisy', place: 'meadow', shape: 'flower', color: '#f4f0e0', note: 'Prints as a crisp white star.' },
  { id: 'elderberry', name: 'Elderberries', place: 'meadow', shape: null, color: '#3c1430', dye: [0.30, 0.10, 0.28], note: 'Crushed, a deep violet juice for the anthotype.' },
  { id: 'blackberry', name: 'Blackberries', place: 'meadow', shape: null, color: '#6e1838', dye: [0.40, 0.09, 0.19], note: 'Wine-dark, and stains the fingers for days.' },
  { id: 'ladyfern', name: 'Lady fern', place: 'wood', shape: 'fern', color: '#4c8a3a', note: 'The frond every photogram-maker reached for first.' },
  { id: 'hartstongue', name: "Hart's-tongue fern", place: 'wood', shape: 'strap', color: '#3f7a32', note: 'One long undivided blade, like a tongue.' },
  { id: 'oak', name: 'Oak leaf', place: 'wood', shape: 'oak', color: '#6b7a3a', note: 'Lobed edges that print like lace.' },
  { id: 'ivy', name: 'Ivy', place: 'wood', shape: 'ivy', color: '#2f5a34', note: 'Three-pointed, waxy, and everywhere.' },
  { id: 'willow', name: 'Willow leaf', place: 'stream', shape: 'narrow', color: '#7a9a4a', note: 'Slender leaves from the bank by the mill.' },
  { id: 'mint', name: 'Water mint', place: 'stream', shape: 'round', color: '#5a8a4a', note: 'Smells of summer when you press it.' },
  { id: 'bladderwrack', name: 'Bladderwrack', place: 'shore', shape: 'weed', color: '#6a5a2a', note: 'Forked fronds with air bladders; it pops.' },
  { id: 'dulse', name: 'Red dulse', place: 'shore', shape: 'weed', color: '#8a2a3a', note: 'Anna Atkins pressed algae like this for her British Algae.' },
  { id: 'salt', name: 'Sea salt', place: 'shore', shape: null, color: '#f4f2ec', note: 'Talbot salted his paper before silvering it.' },
  { id: 'bracken', name: 'Bracken', place: 'hill', shape: 'fern', color: '#7a7a2a', note: 'Coarse fronds from the slopes of Ruin Hill.' },
  { id: 'harebell', name: 'Harebell', place: 'hill', shape: 'flower', color: '#8a7ad8', dye: [0.36, 0.30, 0.58], note: 'A small blue bell that nods in the wind.' },
];

export const byId = (id) => SPECIMENS.find((s) => s.id === id);

// ---- the satchel: what you carry, and when you first found each ------------
const KEY = 'altlab-satchel-v1';

export function satchel() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s && typeof s === 'object') return { items: s.items || {}, found: s.found || {} };
  } catch (e) { /* private mode */ }
  return { items: {}, found: {} };
}

export function gather(id) {
  const s = satchel();
  s.items[id] = (s.items[id] || 0) + 1;
  const first = !s.found[id];
  if (first) s.found[id] = new Date().toISOString();
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* blocked */ }
  return { count: s.items[id], first };
}

export const carried = () => Object.entries(satchel().items).filter(([, n]) => n > 0).map(([id]) => byId(id)).filter(Boolean);
export const shapes = () => carried().filter((s) => s.shape);
export const dyes = () => carried().filter((s) => s.dye);

// ---- silhouettes ------------------------------------------------------------------
function lens(ctx, x, y, len, wid, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(-len, 0);
  ctx.quadraticCurveTo(0, -wid, len, 0);
  ctx.quadraticCurveTo(0, wid, -len, 0);
  ctx.fill();
  ctx.restore();
}

// draw one specimen's silhouette, `size` long, centred at x, y
export function drawShape(ctx, shape, x, y, size, rot, rnd = Math.random) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const s = size / 2;
  ctx.lineCap = 'round';
  if (shape === 'fern') {
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(s, 0);
    ctx.stroke();
    const n = 11;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const lx = -s * 0.8 + t * s * 1.75;
      const l = (1 - t * 0.8) * s * 0.42;
      lens(ctx, lx, -l * 0.75, l, l * 0.28, -1.0);
      lens(ctx, lx, l * 0.75, l, l * 0.28, 1.0);
    }
  } else if (shape === 'strap') {
    lens(ctx, 0, 0, s, s * 0.22, 0);
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s * 1.25, 0);
    ctx.lineTo(-s, 0);
    ctx.stroke();
  } else if (shape === 'narrow') {
    lens(ctx, 0, 0, s * 0.85, s * 0.16, 0);
    ctx.lineWidth = size * 0.015;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s * 0.85, 0);
    ctx.stroke();
  } else if (shape === 'round') {
    for (let i = 0; i < 3; i++) lens(ctx, -s * 0.5 + i * s * 0.55, (i % 2 ? -1 : 1) * s * 0.18, s * 0.32, s * 0.24, (i % 2 ? -0.5 : 0.5));
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(s * 0.9, 0);
    ctx.stroke();
  } else if (shape === 'oak') {
    lens(ctx, 0, 0, s * 0.8, s * 0.22, 0);
    for (let i = 0; i < 5; i++) {
      const lx = -s * 0.55 + i * s * 0.28;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(lx, side * s * 0.22, s * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(-s * 0.75, 0);
    ctx.stroke();
  } else if (shape === 'ivy') {
    for (const a of [-0.9, 0, 0.9]) lens(ctx, Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35, s * 0.42, s * 0.26, a);
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(0, 0);
    ctx.stroke();
  } else if (shape === 'weed') {
    // forking fronds, branch on branch
    const branch = (bx, by, ang, len, w, depth) => {
      const ex = bx + Math.cos(ang) * len;
      const ey = by + Math.sin(ang) * len;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (depth > 0) {
        branch(ex, ey, ang - 0.45 - rnd() * 0.2, len * 0.72, w * 0.75, depth - 1);
        branch(ex, ey, ang + 0.45 + rnd() * 0.2, len * 0.72, w * 0.75, depth - 1);
      }
    };
    branch(-s, 0, 0, s * 0.55, size * 0.07, 4);
  } else if (shape === 'flower') {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      lens(ctx, Math.cos(a) * s * 0.38, Math.sin(a) * s * 0.38, s * 0.38, s * 0.16, a);
    }
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(-s * 0.15, s * 0.1);
    ctx.lineTo(-s * 1.0, s * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function seeded(seed) {
  let s = (seed >>> 0) % 2147483646 + 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// Lay the given specimens out in a loose grid, as on a herbarium sheet.
// `fill` draws them (white for a plate, or onto a brush mask).
export function layOut(ctx, w, h, list, { seed = 7, margin = 0.07, fill = 'rgba(255,255,255,0.95)' } = {}) {
  const rnd = seeded(seed);
  const items = [];
  // two of each kind you carry, up to a dozen, so the sheet looks gathered
  for (const sp of list) for (let k = 0; k < 2; k++) items.push(sp);
  const n = Math.min(12, items.length);
  const cols = Math.ceil(Math.sqrt(n * (w / h)));
  const rows = Math.ceil(n / cols);
  const cw = (w * (1 - margin * 2)) / cols;
  const ch = (h * (1 - margin * 2)) / rows;
  ctx.fillStyle = fill;
  ctx.strokeStyle = fill;
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = w * margin + cw * (c + 0.5) + (rnd() - 0.5) * cw * 0.3;
    const y = h * margin + ch * (r + 0.5) + (rnd() - 0.5) * ch * 0.3;
    const size = Math.min(cw, ch) * (1.05 + rnd() * 0.3);
    drawShape(ctx, items[i].shape, x, y, size, rnd() * Math.PI * 2, rnd);
  }
}

// A plate of your specimens: white silhouettes on near-black, the same
// kind of picture as the drawer's botanical plate, for a photogram.
export function specimenPlate(list, w = 1600, h = 1200, seed = 7) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0b0d';
  ctx.fillRect(0, 0, w, h);
  layOut(ctx, w, h, list, { seed });
  return c;
}
