// Sample prints made by the engine itself: a botanical specimen plate
// passed through a process at ideal exposure. Used by the lab cards
// generator (tools/prints.html), the live landing hero, and the atelier's
// shared drying line, which redraws other apprentices' prints from recipes.

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

// Run fn with Math.random replaced by a seeded generator, so the same seed
// always lays the same leaves and the same coat.
export function withSeed(seed, fn) {
  const real = Math.random;
  let s = (seed >>> 0) % 2147483646 + 1;
  Math.random = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}

// A specimen print described by numbers alone: the drawer plate laid out by
// `seed`, coated by the studio, then exposed and finished as the recipe says.
// Draws into a 2D canvas and releases its WebGL context straight away.
export function renderRecipe(config, recipe, w = 480, h = 360) {
  const glCanvas = document.createElement('canvas');
  glCanvas.width = w;
  glCanvas.height = h;
  const gl = createGL(glCanvas, config.fragment);
  withSeed(recipe.seed, () => {
    gl.setTexture('u_image', botanicalPlate(w, h));
    const stage = paintStage(config);
    const brush = createBrush(w, h, config.brushMode);
    if (stage && stage.auto === 'pour') brush.autoPour(config.margin);
    else if (stage && stage.auto === 'scatter') brush.autoScatter(config.margin);
    else brush.autoCoat(config.margin);
    gl.setTexture('u_mask', brush.canvas);
  });
  gl.set({
    u_res: [w, h],
    u_margin: config.margin,
    u_exposure: recipe.exposure,
    u_wash: 1,
    u_adj: recipe.adj,
    u_contrast: recipe.contrast,
    u_tone: recipe.tone,
    u_tilt: 0,
    u_time: 0,
    u_stage: config.stages.length - 1,
  });
  gl.draw();
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(glCanvas, 0, 0);
  const ctx = glCanvas.getContext('webgl2');
  const lose = ctx && ctx.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
  return out;
}
