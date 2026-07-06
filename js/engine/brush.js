// Sensitizer brush: paints a coverage mask into a 2D canvas.
// The mask's red channel feeds the shader as coating thickness.

export function createBrush(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const radius = Math.max(width, height) * 0.045;
  let last = null;

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
    dab(x, y, radius);
  }

  function moveTo(x, y) {
    if (!last) { begin(x, y); return; }
    const [lx, ly] = last;
    const dist = Math.hypot(x - lx, y - ly);
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

  return { canvas, begin, moveTo, end, clear, autoCoat, coverage };
}
