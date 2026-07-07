// Sensitizer brush: paints a coverage mask into a 2D canvas.
// The mask's red channel feeds the shader as coating thickness.

export function createBrush(width, height, mode = 'brush') {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const radius = Math.max(width, height) * 0.045;
  let last = null;
  let marks = 0; // manual gestures only; autoCoat/autoPour/autoScatter reset it

  // A pressed leaf or fern frond, for photogram work.
  function lens(cx, cy, len, wid, rot) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(-len, 0);
    ctx.quadraticCurveTo(0, -wid, len, 0);
    ctx.quadraticCurveTo(0, wid, -len, 0);
    ctx.fill();
    ctx.restore();
  }

  function stampLeaf(x, y) {
    const angle = Math.random() * Math.PI * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = 'rgba(255,255,255,0.94)';
    if (Math.random() < 0.45) {
      // fern frond: leaflets alternating along a stem
      const len = radius * (1.6 + Math.random() * 1.0);
      ctx.lineWidth = radius * 0.06;
      ctx.beginPath();
      ctx.moveTo(-len * 0.25, 0);
      ctx.lineTo(len, 0);
      ctx.stroke();
      const n = 7 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const lx = t * len;
        const s = (1 - t * 0.75) * radius * 0.5;
        lens(lx, -s * 0.8, s, s * 0.32, -0.9);
        lens(lx, s * 0.8, s, s * 0.32, 0.9);
      }
    } else {
      // a single tapered leaf with its stem
      const len = radius * (0.7 + Math.random() * 0.5);
      const wid = len * (0.30 + Math.random() * 0.15);
      ctx.lineWidth = radius * 0.07;
      ctx.beginPath();
      ctx.moveTo(-len * 1.6, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      lens(len * 0.05, 0, len, wid, (Math.random() - 0.5) * 0.2);
    }
    ctx.restore();
  }

  function stamp(x, y, r, alpha) {
    const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A dab with a few jittered bristle marks around it.
  function dab(x, y, r) {
    stamp(x, y, r, 0.28);
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.3 + Math.random() * 0.5);
      stamp(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.4, 0.16);
    }
  }

  function begin(x, y) {
    last = [x, y];
    marks++;
    if (mode === 'leaf') stampLeaf(x, y);
    else dab(x, y, radius);
  }

  function moveTo(x, y) {
    if (!last) { begin(x, y); return; }
    const [lx, ly] = last;
    const dist = Math.hypot(x - lx, y - ly);
    if (mode === 'leaf') {
      if (dist < radius * 2.4) return; // leaves land spaced apart
      last = [x, y];
      marks++;
      stampLeaf(x, y);
      return;
    }
    const steps = Math.max(1, Math.floor(dist / (radius * 0.35)));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      dab(lx + (x - lx) * t, ly + (y - ly) * t, radius);
    }
    last = [x, y];
  }

  function end() { last = null; }

  function clear() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    last = null;
    marks = 0;
  }

  // Even horizontal strokes with ragged ends, like a coating rod pass.
  function autoCoat(margin) {
    clear();
    const inset = margin * 0.45;
    const x0 = width * inset;
    const x1 = width * (1 - inset);
    const y0 = height * inset;
    const y1 = height * (1 - inset);
    const rows = 12;
    const r = (y1 - y0) / rows * 1.1;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i <= rows; i++) {
        const y = y0 + ((y1 - y0) * i) / rows + (Math.random() - 0.5) * r * 0.4;
        const overL = Math.random() * r * 1.5;
        const overR = Math.random() * r * 1.5;
        const steps = 26;
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const x = (x0 - overL) + (x1 + overR - x0 + overL) * t;
          const wob = Math.sin(t * 9 + i * 2.3) * r * 0.15;
          dab(x, y + wob, r);
        }
      }
    }
    end();
  }

  // Collodion pour: one generous puddle tilted across the plate,
  // with thin corners and a drip or two.
  function autoPour(margin) {
    clear();
    const inset = margin * 0.4;
    const cx = width * 0.5;
    const cy = height * 0.5;
    const R = Math.min(width, height) * 0.30;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.pow(Math.random(), 0.6);
      const x = cx + Math.cos(a) * d * (width * 0.5 - width * inset - R * 0.5);
      const y = cy + Math.sin(a) * d * (height * 0.5 - height * inset - R * 0.5);
      stamp(x, y, R * (0.7 + Math.random() * 0.5), 0.5);
    }
    // a drip running off one edge
    const dx = width * (0.2 + Math.random() * 0.6);
    for (let y = height * 0.75; y < height; y += radius * 0.4) {
      stamp(dx + Math.sin(y * 0.02) * radius, y, radius * 0.8, 0.4);
    }
    end();
  }

  // A loose handful of botanicals across the paper.
  function autoScatter(margin) {
    clear();
    const inset = margin * 0.6 + 0.06;
    for (let i = 0; i < 16; i++) {
      stampLeaf(
        width * (inset + Math.random() * (1 - 2 * inset)),
        height * (inset + Math.random() * (1 - 2 * inset)),
      );
    }
    end();
  }

  // Rough coverage estimate, sampled coarsely.
  function coverage() {
    const data = ctx.getImageData(0, 0, width, height).data;
    let sum = 0, n = 0;
    for (let i = 0; i < data.length; i += 4 * 61) {
      sum += data[i];
      n++;
    }
    return sum / (n * 255);
  }

  return {
    canvas, begin, moveTo, end, clear,
    autoCoat, autoPour, autoScatter, coverage,
    marks: () => marks,
  };
}
