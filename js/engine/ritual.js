// The ritual runner: walks a photograph through a process config,
// stage by stage, entirely on the visitor's device.
//
// Stage behavior comes from stage.type (defaulting by id):
//   upload | info | paint | hold | reveal | result
// The shader receives u_stage = the stage's index in config.stages.

import { createGL } from './gl.js';
import { createBrush } from './brush.js';
import { judge } from './judge.js';
import { ledger } from './ledger.js';
import { sound, mountSoundToggle } from './sound.js';
import { commissionsFor } from '../content/commissions.js';
import { botanicalPlate } from './sample.js';

const BRUSH_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M4 24c2-1 3-1 4-3l9-13 3 2-9 13c-1 2-1 3-1 4-2 0-4-1-6-3z' fill='%23c8c2b4'/%3E%3Cpath d='M18 7l3-4 4 3-4 3z' fill='%237fa3c8'/%3E%3C/svg%3E") 4 24, crosshair`;

const MAX_CANVAS = 1600;

const DEFAULT_TYPE = {
  upload: 'upload',
  negative: 'info',
  coat: 'paint',
  expose: 'hold',
  wash: 'reveal',
  result: 'result',
};

export function startRitual(root, config) {
  // ---- DOM scaffold -------------------------------------------------
  root.innerHTML = `
    <div class="ritual">
      <div class="ritual-head">
        <h1>${config.name}</h1>
        <div class="meta">${config.year} · ${config.inventor}</div>
        <button class="letters-btn" data-letters hidden></button>
      </div>
      <div class="steps"></div>
      <div class="stage-canvas-holder">
        <div class="upload-panel">
          <button class="btn" data-pick>Choose a photograph</button>
          <button class="btn ghost" data-camera>Use the camera</button>
          <p>Or drop an image here.</p>
          <p class="drawer-line">No photograph at hand?
            <button data-specimen>Borrow a specimen from the drawer</button></p>
          <p class="privacy">The photograph stays on this device. Nothing is uploaded.</p>
          <input type="file" accept="image/*" hidden data-file>
          <input type="file" accept="image/*" capture="environment" hidden data-capture>
        </div>
        <canvas class="print" hidden></canvas>
      </div>
      <div class="caption"></div>
      <div class="master-note" hidden></div>
      <div class="fulfilled-note" hidden></div>
      <div class="controls"></div>
      <div class="skip" hidden><button data-skip>Skip ahead to the finished print</button></div>
      <div class="letters-overlay" hidden>
        <div class="letters-sheaf">
          <h2>Letters for the ${config.name.toLowerCase()} bench</h2>
          <div class="letters-list"></div>
          <button class="btn ghost" data-letters-close>Back to the bench</button>
        </div>
      </div>
    </div>`;

  const el = (sel) => root.querySelector(sel);
  const canvas = el('canvas.print');
  const stepsEl = el('.steps');
  const captionEl = el('.caption');
  const controlsEl = el('.controls');
  const uploadPanel = el('.upload-panel');
  const skipEl = el('.skip');
  const noteEl = el('.master-note');
  const fulfilledEl = el('.fulfilled-note');

  mountSoundToggle();
  buildLetters();

  for (const s of config.stages) {
    const span = document.createElement('span');
    span.textContent = s.title;
    stepsEl.appendChild(span);
  }

  // ---- state ---------------------------------------------------------
  const state = {
    stage: 'upload',
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
    image: null, // offscreen canvas with the photo
  };

  // ---- the Master's judgment and the ledger -----------------------------
  function judgement() {
    return judge(config, resultPayload());
  }

  function resultPayload() {
    const v = {
      exposure: state.exposure,
      adj: state.adj,
      tone: state.tone,
      contrast: state.contrast,
      coverage: state.brush ? state.brush.coverage() : 0,
      handCoated: state.handCoated,
      handMarks: state.brush ? state.brush.marks() : 0,
    };
    return v;
  }

  function showVerdict() {
    const v = judgement();
    noteEl.innerHTML = `<span class="master-says">The Master looks it over.</span> ${v.remark}`;
    noteEl.hidden = false;
    return v;
  }

  function pressIntoLedger(button) {
    if (state.pressed) return;
    state.pressed = true;
    const v = judgement();
    const payload = { ...resultPayload(), tier: v.tier, eff: v.eff };

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

    const lines = [];
    if (state.skipped) {
      lines.push('The Master glances up. A print the studio made by itself earns no seal; walk the stages yourself next time.');
    }
    if (v.seal && !state.skipped && ledger.grantSeal(config.id)) {
      lines.push(`The Master presses the studio's <strong>${config.name.toLowerCase()} seal</strong> beside it. Yours now.`);
    }
    for (const c of commissionsFor(config.id)) {
      if (!state.skipped && !ledger.fulfilled(c.id) && c.check(payload)) {
        ledger.fulfil(c.id);
        lines.push(`Commission fulfilled: <strong>${c.from}</strong> will have their print.`);
      }
    }
    sound.thump();
    button.textContent = 'Pressed into the ledger';
    button.disabled = true;
    if (lines.length) {
      fulfilledEl.innerHTML = lines.join('<br>');
      fulfilledEl.hidden = false;
    }
    updateLettersBtn();
  }

  // ---- the letters ------------------------------------------------------
  function buildLetters() {
    const list = el('.letters-list');
    list.innerHTML = '';
    for (const c of commissionsFor(config.id)) {
      const done = ledger.fulfilled(c.id);
      const div = document.createElement('article');
      div.className = 'letter' + (done ? ' done' : '');
      div.innerHTML = `
        <div class="letter-from">${c.from}, ${c.year}</div>
        <p>${c.letter}</p>
        <div class="letter-goal">${c.goal}</div>
        ${done ? '<div class="letter-stamp">Fulfilled</div>' : ''}`;
      list.appendChild(div);
    }
    updateLettersBtn();
  }

  function updateLettersBtn() {
    const btn = el('[data-letters]');
    const all = commissionsFor(config.id);
    if (!all.length) return;
    const open = all.filter((c) => !ledger.fulfilled(c.id)).length;
    btn.hidden = false;
    btn.textContent = open
      ? (open === 1 ? 'A letter waits for you' : `${open} letters wait for you`)
      : 'Letters, both answered';
    btn.classList.toggle('all-done', open === 0);
  }

  el('[data-letters]').addEventListener('click', () => {
    buildLetters();
    el('.letters-overlay').hidden = false;
    sound.flip();
  });
  el('[data-letters-close]').addEventListener('click', () => {
    el('.letters-overlay').hidden = true;
  });

  const stageIndex = (id) => config.stages.findIndex((s) => s.id === id);
  const stageType = (s) => s.type || DEFAULT_TYPE[s.id] || 'info';
  const firstPaint = () =>
    config.stages.find((s) => stageType(s) === 'paint') || config.stages[1];

  function autoApply(stage) {
    const auto = stage && stage.auto;
    if (auto === 'pour') state.brush.autoPour(config.margin);
    else if (auto === 'scatter') state.brush.autoScatter(config.margin);
    else state.brush.autoCoat(config.margin);
    state.handCoated = false; // the studio did this one
    state.maskDirty = true;
  }

  // ---- image loading ---------------------------------------------------
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
      beginRitual();
    };
    img.onerror = () => { captionEl.textContent = 'That image could not be read. Try another.'; };
    img.src = url;
  }

  el('[data-pick]').addEventListener('click', () => el('[data-file]').click());
  el('[data-camera]').addEventListener('click', () => el('[data-capture]').click());
  el('[data-specimen]').addEventListener('click', () => {
    state.image = botanicalPlate(1600, 1200);
    beginRitual();
  });
  el('[data-file]').addEventListener('change', (e) => loadFile(e.target.files[0]));
  el('[data-capture]').addEventListener('change', (e) => loadFile(e.target.files[0]));
  uploadPanel.addEventListener('dragover', (e) => { e.preventDefault(); uploadPanel.classList.add('dragover'); });
  uploadPanel.addEventListener('dragleave', () => uploadPanel.classList.remove('dragover'));
  uploadPanel.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadPanel.classList.remove('dragover');
    loadFile(e.dataTransfer.files[0]);
  });

  function beginRitual() {
    const aspect = state.image.width / state.image.height;
    let w, h;
    if (aspect >= 1) { w = MAX_CANVAS; h = Math.round(MAX_CANVAS / aspect); }
    else { h = MAX_CANVAS; w = Math.round(MAX_CANVAS * aspect); }
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
    });

    state.exposure = 0;
    state.wash = 0;
    state.tilt = 0;
    state.adj = 1;
    state.contrast = 1;
    state.tone = 0;
    state.handCoated = false;
    state.pressed = false;
    state.skipped = false;

    uploadPanel.hidden = true;
    canvas.hidden = false;
    setStage(config.stages[1].id);
  }

  // ---- stage machine -------------------------------------------------
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let stageToken = 0;

  function setStage(id) {
    if (REDUCED) { applyStage(id); return; }
    const token = ++stageToken;
    captionEl.classList.add('stage-fade');
    controlsEl.classList.add('stage-fade');
    setTimeout(() => {
      if (token !== stageToken) return;
      applyStage(id);
      captionEl.classList.remove('stage-fade');
      controlsEl.classList.remove('stage-fade');
    }, 180);
  }

  function applyStage(id) {
    state.stage = id;
    const idx = stageIndex(id);
    stepsEl.querySelectorAll('span').forEach((span, i) => {
      span.classList.toggle('on', i === idx);
      span.classList.toggle('done', i < idx);
    });
    const stage = config.stages[idx];
    const type = stageType(stage);
    captionEl.innerHTML = stage.caption;
    skipEl.hidden = type === 'upload' || type === 'result';
    noteEl.hidden = type !== 'result';
    if (type !== 'result') fulfilledEl.hidden = true;
    canvas.style.cursor =
      type === 'paint' ? BRUSH_CURSOR
      : type === 'result' && config.tiltResult ? 'ew-resize'
      : 'default';
    sound.setScene({ paint: 'coat', hold: 'expose', reveal: 'wash' }[type] || 'room');
    sound.flip();
    buildControls(type, stage);
  }

  function buildControls(type, stage) {
    controlsEl.innerHTML = '';
    if (type === 'info') {
      addButton(stage.next, () => advance(stage));
    } else if (type === 'paint') {
      addButton(stage.autoLabel || 'Coat for me', () => autoApply(stage), 'ghost');
      addButton(stage.next, () => {
        if (stage.minCoverage !== 0 && state.brush.coverage() < 0.04) {
          captionEl.innerHTML = stage.bareText ||
            'The surface is still bare. Work it with your finger or pointer, or let the studio do it for you.';
          return;
        }
        advance(stage);
      });
    } else if (type === 'hold') {
      const meterWrap = document.createElement('div');
      meterWrap.className = 'meter';
      meterWrap.innerHTML = '<div></div><span class="ideal"></span>';
      meterWrap.querySelector('.ideal').style.left =
        (config.idealExposure / config.maxExposure) * 100 + '%';
      const label = document.createElement('span');
      label.className = 'meter-label';
      label.textContent = 'not yet exposed';
      const hold = document.createElement('button');
      hold.className = 'btn hold';
      hold.textContent = stage.holdLabel || 'Hold in the sun';
      hold.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hold.setPointerCapture(e.pointerId);
        state.exposing = true;
        hold.classList.add('exposing');
      });
      const stop = () => {
        state.exposing = false;
        hold.classList.remove('exposing');
      };
      hold.addEventListener('pointerup', stop);
      hold.addEventListener('pointercancel', stop);
      hold.addEventListener('contextmenu', (e) => e.preventDefault());
      controlsEl.append(hold, meterWrap, label);
      state.meterFill = meterWrap.querySelector('div');
      state.meterLabel = label;
      addButton(stage.next, () => {
        if (state.exposure < 0.05) {
          captionEl.innerHTML = stage.noLightText ||
            'No light has reached it yet. Hold the exposure a while first.';
          return;
        }
        advance(stage);
      });
    } else if (type === 'reveal') {
      addButton(stage.next, function revealNow() {
        this.disabled = true;
        state.washing = true;
      });
    } else if (type === 'result') {
      showVerdict();
      const refreshVerdict = () => { if (!state.pressed) showVerdict(); };
      const sliders = document.createElement('div');
      sliders.className = 'sliders';
      addSlider(sliders, 'Exposure', 0.5, 1.6, state.adj, (v) => {
        state.adj = v;
        state.gl.set({ u_adj: v });
        refreshVerdict();
      });
      addSlider(sliders, 'Contrast', 0.6, 1.6, state.contrast, (v) => {
        state.contrast = v;
        state.gl.set({ u_contrast: v });
        refreshVerdict();
      });
      addSlider(sliders, 'Toning', -1, 1, state.tone, (v) => {
        state.tone = v;
        state.gl.set({ u_tone: v });
        refreshVerdict();
      });
      controlsEl.appendChild(sliders);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';
      controlsEl.appendChild(row);
      const press = addButton('Press it into the ledger', function () {
        pressIntoLedger(this);
      }, '', row);
      if (state.pressed) {
        press.textContent = 'Pressed into the ledger';
        press.disabled = true;
      }
      addButton(config.downloadLabel || 'Download the print', downloadPrint, 'ghost', row);
      addButton('Make another', () => {
        state.brush.clear();
        state.maskDirty = true;
        state.exposure = 0;
        state.wash = 0;
        state.pressed = false;
        state.handCoated = false;
        state.skipped = false;
        setStage(firstPaint().id);
      }, 'ghost', row);
      addButton('New photograph', () => {
        canvas.hidden = true;
        uploadPanel.hidden = false;
        state.pressed = false;
        state.handCoated = false;
        state.skipped = false;
        setStage(config.stages[0].id);
      }, 'ghost', row);
    }
  }

  function advance(stage) {
    const idx = config.stages.indexOf(stage);
    setStage(config.stages[idx + 1].id);
  }

  function addButton(label, fn, cls = '', parent = controlsEl) {
    const b = document.createElement('button');
    b.className = 'btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    parent.appendChild(b);
    return b;
  }

  function addSlider(parent, label, min, max, value, fn) {
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = 'range';
    input.min = min;
    input.max = max;
    input.step = 0.01;
    input.value = value;
    input.addEventListener('input', () => fn(parseFloat(input.value)));
    parent.append(l, input);
  }

  el('[data-skip]').addEventListener('click', () => {
    if (state.brush.coverage() < 0.04) autoApply(firstPaint());
    if (state.exposure < 0.2) state.exposure = config.idealExposure;
    state.wash = 1;
    state.skipped = true;
    setStage(config.stages[config.stages.length - 1].id);
  });

  // ---- canvas pointer: painting, and tilt on the finished plate --------
  function maskPoint(e) {
    const r = canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * canvas.width,
      ((e.clientY - r.top) / r.height) * canvas.height,
    ];
  }
  let lastBrushSound = 0;
  canvas.addEventListener('pointerdown', (e) => {
    if (stageType(config.stages[stageIndex(state.stage)]) !== 'paint') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    state.brush.begin(...maskPoint(e));
    state.handCoated = true;
    state.maskDirty = true;
    sound.brush(0.6);
  });
  canvas.addEventListener('pointermove', (e) => {
    const type = stageType(config.stages[stageIndex(state.stage)]);
    if (type === 'paint' && e.buttons !== 0) {
      state.brush.moveTo(...maskPoint(e));
      state.handCoated = true;
      state.maskDirty = true;
      const now = performance.now();
      if (now - lastBrushSound > 90) {
        lastBrushSound = now;
        sound.brush(Math.min(1, (Math.abs(e.movementX) + Math.abs(e.movementY)) / 30));
      }
    } else if (type === 'result') {
      const r = canvas.getBoundingClientRect();
      state.tilt = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    }
  });
  canvas.addEventListener('pointerup', () => state.brush && state.brush.end());
  canvas.addEventListener('pointerleave', () => { state.tilt *= 0.0; });

  // ---- render loop -----------------------------------------------------
  let lastT = performance.now();
  let shownTilt = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (state.gl && !canvas.hidden) {
      if (state.exposing) {
        state.exposure = Math.min(config.maxExposure, state.exposure + config.exposureRate * dt);
        state.meterFill.style.width = (state.exposure / config.maxExposure) * 100 + '%';
        const n = Math.round(state.exposure * config.exposureScale);
        state.meterLabel.textContent = `about ${n} ${config.exposureUnit}`;
        state.tickTimer = (state.tickTimer || 0) + dt;
        if (state.tickTimer >= 1) { state.tickTimer = 0; sound.tick(); }
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
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- download ----------------------------------------------------------
  function downloadPrint() {
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
    ctx.fillText(
      `${config.name}, ${config.year} · simulated in the browser`,
      Math.round(strip * 0.4),
      canvas.height + strip / 2,
    );
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
}
