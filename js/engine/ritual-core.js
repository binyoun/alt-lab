// The ritual's core: walks a photograph through a process config, stage
// by stage, entirely on the visitor's device. It owns the chemistry (GL,
// brush, exposure, wash), the Master's verdict and the ledger, and knows
// nothing about pages or buttons. An interface listens to its events and
// calls its actions: the flat lab page (ritual.js) and the in-world bench
// in the atelier are two such interfaces.
//
// Stage behavior comes from stage.type (defaulting by id):
//   upload | info | paint | hold | reveal | result
// The shader receives u_stage = the stage's index in config.stages.
//
// Events (core.on(name, fn)):
//   stage    (stage, type)        the stage changed
//   exposure ({ value, fraction, ideal, label })  while the light is on
//   pressed  (result)             a print went into the ledger
//   error    (message)            an image could not be read

import { createGL } from './gl.js';
import { createBrush } from './brush.js';
import { judge } from './judge.js';
import { ledger } from './ledger.js';
import { sound } from './sound.js';
import { commissionsFor } from '../content/commissions.js';
import { botanicalPlate, withSeed } from './sample.js';

const DEFAULT_TYPE = {
  upload: 'upload',
  negative: 'info',
  coat: 'paint',
  expose: 'hold',
  wash: 'reveal',
  result: 'result',
};

export const stageType = (s) => s.type || DEFAULT_TYPE[s.id] || 'info';

export function createRitual(config, { maxCanvas = 1600, hooks = {}, canvas = document.createElement('canvas') } = {}) {
  const listeners = {};
  const emit = (name, ...args) => (listeners[name] || []).forEach((fn) => fn(...args));

  const state = {
    stage: config.stages[0].id,
    gl: null,
    brush: null,
    maskDirty: false,
    exposure: 0,
    exposing: false,
    wash: 0,
    washing: false,
    tilt: 0,
    adj: 1,
    contrast: 1,
    tone: 0,
    handCoated: false, // any manual work on the surface, not undone by auto
    pressed: false,    // this print already sits in the ledger
    skipped: false,    // the studio made this one; the Master seals no shortcuts
    image: null,       // offscreen canvas with the photo
    specimen: false,   // the drawer's botanical plate, not the visitor's photo
    seed: 0,           // how the drawer's plate was laid out, for recipes
    strokes: [],       // hand coating as normalised [x, y, newStroke] triples; null once the studio coats
    partner: null,     // { id, name } of the apprentice who coated this sheet
    version: 0,        // bumps whenever the print on the canvas may have changed
    dye: null,         // a gathered juice for the anthotype, as [r, g, b]
    source: 'photo',   // photo | specimen (the drawer) | gathered (your satchel)
  };

  const stageIndex = (id) => config.stages.findIndex((s) => s.id === id);
  const current = () => config.stages[stageIndex(state.stage)];
  const firstPaint = () => config.stages.find((s) => stageType(s) === 'paint') || config.stages[1];

  // ---- the Master's judgment ---------------------------------------------
  function resultPayload() {
    return {
      exposure: state.exposure,
      adj: state.adj,
      tone: state.tone,
      contrast: state.contrast,
      coverage: state.brush ? state.brush.coverage() : 0,
      handCoated: state.handCoated,
      handMarks: state.brush ? state.brush.marks() : 0,
    };
  }
  const verdict = () => judge(config, resultPayload());

  // ---- loading a photograph ---------------------------------------------------
  function begin() {
    const aspect = state.image.width / state.image.height;
    let w, h;
    if (aspect >= 1) { w = maxCanvas; h = Math.round(maxCanvas / aspect); }
    else { h = maxCanvas; w = Math.round(maxCanvas * aspect); }
    canvas.width = w;
    canvas.height = h;

    if (!state.gl) state.gl = createGL(canvas, config.fragment);
    state.gl.setTexture('u_image', state.image);
    state.brush = createBrush(w, h, config.brushMode);
    state.gl.setTexture('u_mask', state.brush.canvas);
    state.gl.set({
      u_res: [w, h],
      u_margin: config.margin,
      u_exposure: 0,
      u_wash: 0,
      u_adj: 1,
      u_contrast: 1,
      u_tone: 0,
      u_tilt: 0,
      u_dye: state.dye || [0, 0, 0],
    });
    Object.assign(state, {
      exposure: 0, wash: 0, tilt: 0, adj: 1, contrast: 1, tone: 0,
      handCoated: false, pressed: false, skipped: false, strokes: [], partner: null,
    });
    setStage(config.stages[1].id);
  }

  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, 2048 / Math.max(img.naturalWidth, img.naturalHeight));
      const off = document.createElement('canvas');
      off.width = Math.round(img.naturalWidth * scale);
      off.height = Math.round(img.naturalHeight * scale);
      off.getContext('2d').drawImage(img, 0, 0, off.width, off.height);
      state.image = off;
      state.specimen = false;
      state.source = 'photo';
      begin();
    };
    img.onerror = () => emit('error', 'That image could not be read. Try another.');
    img.src = url;
  }

  function useSpecimen() {
    state.seed = Math.floor(Math.random() * 2147483646);
    state.image = withSeed(state.seed, () => botanicalPlate(1600, 1200));
    state.specimen = true;
    state.source = 'specimen';
    begin();
  }

  // A picture made of what the apprentice gathered (a plate of specimens).
  function useCanvas(c) {
    state.image = c;
    state.specimen = false; // it is theirs, so it stays on their device
    state.source = 'gathered';
    begin();
  }

  // Lay shapes straight onto the sheet (gathered leaves on lumen paper).
  function layShapes(draw) {
    state.brush.clear();
    const c = state.brush.canvas;
    draw(c.getContext('2d'), c.width, c.height);
    state.handCoated = true;
    state.strokes = null;
    state.maskDirty = true;
  }

  // A gathered juice for the anthotype.
  function setDye(rgb) {
    state.dye = rgb;
    if (state.gl) state.gl.set({ u_dye: rgb || [0, 0, 0] });
  }

  // ---- stages ------------------------------------------------------------------
  function setStage(id) {
    state.stage = id;
    const stage = current();
    const type = stageType(stage);
    sound.setScene({ paint: 'coat', hold: 'expose', reveal: 'wash' }[type] || 'room');
    sound.flip();
    emit('stage', stage, type);
  }

  // What stands in the way of moving on, if anything: a caption to show.
  function blocker() {
    const stage = current();
    const type = stageType(stage);
    if (type === 'paint' && stage.minCoverage !== 0 && state.brush.coverage() < 0.04) {
      return stage.bareText || 'The surface is still bare. Work it with your finger or pointer, or let the studio do it for you.';
    }
    if (type === 'hold' && state.exposure < 0.05) {
      return stage.noLightText || 'No light has reached it yet. Hold the exposure a while first.';
    }
    return null;
  }

  function advance() {
    const why = blocker();
    if (why) return why;
    setStage(config.stages[stageIndex(state.stage) + 1].id);
    return null;
  }

  function autoApply() {
    const stage = current();
    const auto = stage && stage.auto;
    if (auto === 'pour') state.brush.autoPour(config.margin);
    else if (auto === 'scatter') state.brush.autoScatter(config.margin);
    else state.brush.autoCoat(config.margin);
    state.handCoated = false; // the studio did this one
    state.strokes = null;
    state.maskDirty = true;
  }

  function skip() {
    if (state.brush.coverage() < 0.04) {
      const paint = firstPaint();
      const auto = paint && paint.auto;
      if (auto === 'pour') state.brush.autoPour(config.margin);
      else if (auto === 'scatter') state.brush.autoScatter(config.margin);
      else state.brush.autoCoat(config.margin);
      state.handCoated = false;
      state.strokes = null;
      state.maskDirty = true;
    }
    if (state.exposure < 0.2) state.exposure = config.idealExposure;
    state.wash = 1;
    state.skipped = true;
    setStage(config.stages[config.stages.length - 1].id);
  }

  // ---- the brush, in normalised sheet coordinates (0..1) -------------------------------
  let lastBrushSound = 0;
  function record(x, y, fresh) {
    if (!state.strokes || state.strokes.length >= 4500) return;
    state.strokes.push(+x.toFixed(3), +y.toFixed(3), fresh);
  }
  function brushBegin(u, v) {
    if (stageType(current()) !== 'paint') return;
    state.brush.begin(u * canvas.width, v * canvas.height);
    record(u, v, 1);
    state.handCoated = true;
    state.maskDirty = true;
    sound.brush(0.6);
  }
  function brushMove(u, v, speed = 0.5) {
    if (stageType(current()) !== 'paint') return;
    state.brush.moveTo(u * canvas.width, v * canvas.height);
    record(u, v, 0);
    state.handCoated = true;
    state.maskDirty = true;
    const now = performance.now();
    if (now - lastBrushSound > 90) {
      lastBrushSound = now;
      sound.brush(Math.min(1, speed));
    }
  }
  function brushEnd() {
    if (state.brush) state.brush.end();
  }

  // ---- light, wash, finishing --------------------------------------------------------------
  const exposeOn = () => { state.exposing = true; };
  const exposeOff = () => { state.exposing = false; };
  function meter() {
    const n = Math.round(state.exposure * config.exposureScale);
    return {
      value: state.exposure,
      fraction: state.exposure / config.maxExposure,
      ideal: config.idealExposure / config.maxExposure,
      label: state.exposure > 0 ? `about ${n} ${config.exposureUnit}` : 'not yet exposed',
    };
  }
  const reveal = () => { state.washing = true; };

  function adjust({ adj, contrast, tone }) {
    if (adj !== undefined) { state.adj = adj; state.gl.set({ u_adj: adj }); }
    if (contrast !== undefined) { state.contrast = contrast; state.gl.set({ u_contrast: contrast }); }
    if (tone !== undefined) { state.tone = tone; state.gl.set({ u_tone: tone }); }
  }
  const setTilt = (t) => { state.tilt = Math.max(-1, Math.min(1, t)); };

  // Press the finished print into the ledger. Returns what the Master said.
  function press() {
    if (state.pressed) return null;
    state.pressed = true;
    const v = verdict();
    const payload = { ...resultPayload(), tier: v.tier, eff: v.eff, paired: !!state.partner };

    const thumb = document.createElement('canvas');
    thumb.width = 168;
    thumb.height = Math.round(168 * canvas.height / canvas.width);
    thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
    ledger.savePrint({
      process: config.id,
      verdict: v.tier,
      params: { eff: +v.eff.toFixed(2), tone: +state.tone.toFixed(2) },
      thumb: thumb.toDataURL('image/jpeg', 0.7),
    });
    if (hooks.onPress) {
      hooks.onPress({
        process: config.id,
        tier: v.tier,
        skipped: state.skipped,
        specimen: state.specimen,
        partner: state.partner,
        // enough to redraw a specimen print elsewhere without sending it
        recipe: state.specimen ? {
          seed: state.seed,
          exposure: +state.exposure.toFixed(4),
          adj: +state.adj.toFixed(3),
          contrast: +state.contrast.toFixed(3),
          tone: +state.tone.toFixed(3),
        } : null,
        thumb,
        print: canvas,
      });
    }

    const lines = [];
    let seal = false;
    if (state.skipped) {
      lines.push('The Master glances up. A print the studio made by itself earns no seal; walk the stages yourself next time.');
    }
    if (v.seal && !state.skipped && ledger.grantSeal(config.id)) {
      seal = true;
      lines.push(`The Master presses the studio's <strong>${config.name.toLowerCase()} seal</strong> beside it. Yours now.`);
    }
    for (const c of commissionsFor(config.id)) {
      if (!state.skipped && !ledger.fulfilled(c.id) && c.check(payload)) {
        ledger.fulfil(c.id);
        lines.push(`Commission fulfilled: <strong>${c.from}</strong> will have their print.`);
      }
    }
    sound.thump();
    const result = { tier: v.tier, seal, lines };
    emit('pressed', result);
    return result;
  }

  function makeAnother() {
    state.brush.clear();
    state.maskDirty = true;
    Object.assign(state, { exposure: 0, wash: 0, pressed: false, handCoated: false, skipped: false, strokes: [], partner: null });
    setStage(firstPaint().id);
  }

  function newPhotograph() {
    Object.assign(state, { pressed: false, handCoated: false, skipped: false });
    setStage(config.stages[0].id);
  }

  // ---- working in pairs: one apprentice coats, the other exposes -----------------------------
  const canHandOff = () => !!(hooks.handoff && hooks.partners && state.specimen && config.brushMode !== 'leaf');
  function handOff(partner) {
    if (!state.strokes || !state.strokes.length || state.brush.coverage() < 0.04) {
      return 'Coat the sheet by your own hand first. A partner can only expose what you have brushed.';
    }
    hooks.handoff({ to: partner.id, process: config.id, seed: state.seed, points: state.strokes });
    return null;
  }
  function clearSheet() {
    state.brush.clear();
    state.strokes = [];
    state.maskDirty = true;
  }

  // A sheet a partner coated: lay out the same specimen, replay their brush,
  // and start at the exposure.
  function applyPreset({ seed, points, from }) {
    state.seed = seed;
    state.image = withSeed(seed, () => botanicalPlate(1600, 1200));
    state.specimen = true;
    begin();
    for (let i = 0; i + 2 < points.length; i += 3) {
      const x = points[i] * canvas.width;
      const y = points[i + 1] * canvas.height;
      if (points[i + 2]) { state.brush.end(); state.brush.begin(x, y); } else state.brush.moveTo(x, y);
    }
    state.brush.end();
    state.maskDirty = true;
    state.strokes = null;
    state.partner = from;
    setStage(config.stages.find((s) => stageType(s) === 'hold').id);
  }

  // ---- render loop ---------------------------------------------------------------------------
  let lastT = performance.now();
  let shownTilt = 0;
  let rafId = 0;
  let alive = true;
  let tickTimer = 0;
  function frame(t) {
    if (!alive) return;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (state.gl) {
      if (state.exposing) {
        state.exposure = Math.min(config.maxExposure, state.exposure + config.exposureRate * dt);
        emit('exposure', meter());
        tickTimer += dt;
        if (tickTimer >= 1) { tickTimer = 0; sound.tick(); }
      }
      if (state.washing) {
        state.wash = Math.min(1, state.wash + dt / 2.6);
        if (state.wash >= 1) {
          state.washing = false;
          setStage(config.stages[config.stages.length - 1].id);
        }
      }
      if (state.maskDirty) {
        state.gl.setTexture('u_mask', state.brush.canvas);
        state.maskDirty = false;
      }
      shownTilt += (state.tilt - shownTilt) * Math.min(1, dt * 6);
      state.gl.set({
        u_stage: stageIndex(state.stage),
        u_exposure: state.exposure,
        u_wash: state.wash,
        u_time: t / 1000,
        u_tilt: shownTilt,
      });
      state.gl.draw();
      state.version++;
    }
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  // ---- download ------------------------------------------------------------------------------
  function download() {
    const strip = Math.max(44, Math.round(canvas.width * 0.055));
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height + strip;
    const ctx = out.getContext('2d');
    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 0);
    ctx.fillStyle = '#9a958a';
    ctx.font = `${Math.round(strip * 0.3)}px Georgia, serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`${config.name}, ${config.year} · simulated in the browser`, Math.round(strip * 0.4), canvas.height + strip / 2);
    out.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      a.download = `${config.id}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }, 'image/jpeg', 0.92);
  }

  function destroy() {
    alive = false;
    cancelAnimationFrame(rafId);
    if (state.gl) {
      const ctx = canvas.getContext('webgl2');
      const lose = ctx && ctx.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  }

  return {
    config, canvas, state,
    on(name, fn) { (listeners[name] = listeners[name] || []).push(fn); },
    stage: current,
    stageIndex,
    loadFile, useSpecimen, useCanvas, layShapes, setDye, setStage, advance, blocker, autoApply, skip,
    brushBegin, brushMove, brushEnd,
    exposeOn, exposeOff, meter, reveal, adjust, setTilt,
    verdict, press, makeAnother, newPhotograph,
    canHandOff, handOff, clearSheet, applyPreset,
    download, destroy,
  };
}
