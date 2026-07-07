// Sample prints made by the engine itself: a botanical specimen plate
// passed through a process at ideal exposure. Used by the lab cards
// generator (tools/prints.html) and the live landing hero.

import { createGL } from './gl.js';
import { createBrush } from './brush.js';

// White fern and leaf silhouettes on near-black: the "specimen" the
// processes print from. Reuses the leaf brush in scatter mode.
export function botanicalPlate(w, h, leaves = 16) {
  const brush = createBrush(w, h, 'leaf');
  brush.autoScatter(0.06);
  for (let i = 0; i < leaves - 16; i++) {
    brush.begin(
      w * (0.12 + Math.random() * 0.76),
      h * (0.12 + Math.random() * 0.76),
    );
    brush.end();
  }
  return brush.canvas;
}

const DEFAULT_TYPE = { coat: 'paint' };
function paintStage(config) {
  return config.stages.find((s) => (s.type || DEFAULT_TYPE[s.id]) === 'paint');
}

// Prepare a canvas to render a process at its finished state.
// Returns { gl, recoat, replate } so callers can animate uniforms.
export function setupSample(config, canvas, opts = {}) {
  const w = canvas.width;
  const h = canvas.height;
  const gl = createGL(canvas, config.fragment);

  const stage = paintStage(config);
  const brush = createBrush(w, h, config.brushMode);
  const recoat = () => {
    if (stage && stage.auto === 'pour') brush.autoPour(config.margin);
    else if (stage && stage.auto === 'scatter') brush.autoScatter(config.margin);
    else brush.autoCoat(config.margin);
    gl.setTexture('u_mask', brush.canvas);
  };
  recoat();

  const replate = () => {
    // Lumen prints from laid objects, so its transparency is clear sky.
    if (config.brushMode === 'leaf') {
      const flat = document.createElement('canvas');
      flat.width = 8; flat.height = 8;
      const x = flat.getContext('2d');
      x.fillStyle = '#e8e8e4';
      x.fillRect(0, 0, 8, 8);
      gl.setTexture('u_image', flat);
    } else {
      gl.setTexture('u_image', botanicalPlate(w, h));
    }
  };
  replate();

  gl.set({
    u_res: [w, h],
    u_margin: config.margin,
    u_exposure: config.idealExposure * (opts.exposure || 1),
    u_wash: 1,
    u_adj: 1,
    u_contrast: 1,
    u_tone: opts.tone || 0,
    u_tilt: opts.tilt || 0,
    u_time: 0,
    u_stage: config.stages.length - 1,
  });
  return { gl, recoat, replate };
}

// One finished print, drawn once.
export function renderStill(config, canvas, opts = {}) {
  const sample = setupSample(config, canvas, opts);
  sample.gl.draw();
  return sample;
}
