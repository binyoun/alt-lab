// The ritual as a page: the flat lab's interface to the ritual core
// (ritual-core.js). It lays out the canvas, steps, caption and controls,
// and turns clicks and pointer strokes into the core's actions.

import { createRitual, stageType } from './ritual-core.js';
import { ledger } from './ledger.js';
import { sound, mountSoundToggle } from './sound.js';
import { commissionsFor } from '../content/commissions.js';
import { readLetters } from './letters.js';

const BRUSH_CURSOR =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Cpath d='M4 24c2-1 3-1 4-3l9-13 3 2-9 13c-1 2-1 3-1 4-2 0-4-1-6-3z' fill='%23c8c2b4'/%3E%3Cpath d='M18 7l3-4 4 3-4 3z' fill='%237fa3c8'/%3E%3C/svg%3E") 4 24, crosshair`;

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function startRitual(root, config, hooks = {}) {
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

  const core = createRitual(config, { hooks, canvas });
  const { state } = core;

  mountSoundToggle();
  buildLetters();
  for (const s of config.stages) {
    const span = document.createElement('span');
    span.textContent = s.title;
    stepsEl.appendChild(span);
  }

  // ---- the Master and the letters ------------------------------------------
  function showVerdict() {
    noteEl.innerHTML = `<span class="master-says">The Master looks it over.</span> ${core.verdict().remark}`;
    noteEl.hidden = false;
  }

  function buildLetters() {
    readLetters(el('.letters-list'), commissionsFor(config.id), { onTurn: () => sound.flip() });
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
      : 'Every letter answered';
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

  // ---- choosing a photograph -------------------------------------------------
  el('[data-pick]').addEventListener('click', () => el('[data-file]').click());
  el('[data-camera]').addEventListener('click', () => el('[data-capture]').click());
  el('[data-specimen]').addEventListener('click', () => core.useSpecimen());
  el('[data-file]').addEventListener('change', (e) => core.loadFile(e.target.files[0]));
  el('[data-capture]').addEventListener('change', (e) => core.loadFile(e.target.files[0]));
  uploadPanel.addEventListener('dragover', (e) => { e.preventDefault(); uploadPanel.classList.add('dragover'); });
  uploadPanel.addEventListener('dragleave', () => uploadPanel.classList.remove('dragover'));
  uploadPanel.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadPanel.classList.remove('dragover');
    core.loadFile(e.dataTransfer.files[0]);
  });
  core.on('error', (msg) => { captionEl.textContent = msg; });

  // ---- stages ----------------------------------------------------------------
  let stageToken = 0;
  let captionOverride = null; // a line to show instead of the stage caption, once
  core.on('stage', (stage, type) => {
    if (REDUCED) { applyStage(stage, type); return; }
    const token = ++stageToken;
    captionEl.classList.add('stage-fade');
    controlsEl.classList.add('stage-fade');
    setTimeout(() => {
      if (token !== stageToken) return;
      applyStage(stage, type);
      captionEl.classList.remove('stage-fade');
      controlsEl.classList.remove('stage-fade');
    }, 180);
  });

  function applyStage(stage, type) {
    const idx = core.stageIndex(stage.id);
    stepsEl.querySelectorAll('span').forEach((span, i) => {
      span.classList.toggle('on', i === idx);
      span.classList.toggle('done', i < idx);
    });
    uploadPanel.hidden = type !== 'upload';
    canvas.hidden = type === 'upload';
    if (captionOverride && type === 'hold') {
      captionEl.innerHTML = captionOverride + stage.caption;
      captionOverride = null;
    } else captionEl.innerHTML = stage.caption;
    skipEl.hidden = type === 'upload' || type === 'result';
    noteEl.hidden = type !== 'result';
    if (type !== 'result') fulfilledEl.hidden = true;
    canvas.style.cursor =
      type === 'paint' ? BRUSH_CURSOR
      : type === 'result' && config.tiltResult ? 'ew-resize'
      : 'default';
    buildControls(type, stage);
  }

  function next(stage) {
    const why = core.advance();
    if (why) captionEl.innerHTML = why;
  }

  function buildControls(type, stage) {
    controlsEl.innerHTML = '';
    if (type === 'info') {
      addButton(stage.next, () => next(stage));
    } else if (type === 'paint') {
      addButton(stage.autoLabel || 'Coat for me', () => core.autoApply(), 'ghost');
      if (core.canHandOff()) addButton('Hand it to a partner', () => choosePartner(stage), 'ghost');
      addButton(stage.next, () => next(stage));
    } else if (type === 'hold') {
      const meterWrap = document.createElement('div');
      meterWrap.className = 'meter';
      meterWrap.innerHTML = '<div></div><span class="ideal"></span>';
      const m = core.meter();
      meterWrap.querySelector('.ideal').style.left = m.ideal * 100 + '%';
      meterWrap.querySelector('div').style.width = m.fraction * 100 + '%';
      const label = document.createElement('span');
      label.className = 'meter-label';
      label.textContent = m.label;
      const hold = document.createElement('button');
      hold.className = 'btn hold';
      hold.textContent = stage.holdLabel || 'Hold in the sun';
      hold.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hold.setPointerCapture(e.pointerId);
        core.exposeOn();
        hold.classList.add('exposing');
      });
      const stop = () => {
        core.exposeOff();
        hold.classList.remove('exposing');
      };
      hold.addEventListener('pointerup', stop);
      hold.addEventListener('pointercancel', stop);
      hold.addEventListener('contextmenu', (e) => e.preventDefault());
      controlsEl.append(hold, meterWrap, label);
      meterFill = meterWrap.querySelector('div');
      meterLabel = label;
      addButton(stage.next, () => next(stage));
    } else if (type === 'reveal') {
      addButton(stage.next, function revealNow() {
        this.disabled = true;
        core.reveal();
      });
    } else if (type === 'result') {
      showVerdict();
      const refreshVerdict = () => { if (!state.pressed) showVerdict(); };
      const sliders = document.createElement('div');
      sliders.className = 'sliders';
      addSlider(sliders, 'Exposure', 0.5, 1.6, state.adj, (v) => { core.adjust({ adj: v }); refreshVerdict(); });
      addSlider(sliders, 'Contrast', 0.6, 1.6, state.contrast, (v) => { core.adjust({ contrast: v }); refreshVerdict(); });
      addSlider(sliders, 'Toning', -1, 1, state.tone, (v) => { core.adjust({ tone: v }); refreshVerdict(); });
      controlsEl.appendChild(sliders);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';
      controlsEl.appendChild(row);
      const press = addButton('Press it into the ledger', function () {
        const r = core.press();
        if (!r) return;
        this.textContent = 'Pressed into the ledger';
        this.disabled = true;
        if (r.lines.length) {
          fulfilledEl.innerHTML = r.lines.join('<br>');
          fulfilledEl.hidden = false;
        }
        updateLettersBtn();
      }, '', row);
      if (state.pressed) {
        press.textContent = 'Pressed into the ledger';
        press.disabled = true;
      }
      addButton(config.downloadLabel || 'Download the print', () => core.download(), 'ghost', row);
      addButton('Make another', () => core.makeAnother(), 'ghost', row);
      addButton('New photograph', () => core.newPhotograph(), 'ghost', row);
    }
  }

  let meterFill = null;
  let meterLabel = null;
  core.on('exposure', (m) => {
    if (meterFill) meterFill.style.width = m.fraction * 100 + '%';
    if (meterLabel) meterLabel.textContent = m.label;
  });

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

  el('[data-skip]').addEventListener('click', () => core.skip());

  // ---- handing a sheet to a partner -----------------------------------------------
  function choosePartner(stage) {
    const people = hooks.partners();
    const back = () => { buildControls('paint', stage); captionEl.innerHTML = stage.caption; };
    if (!state.strokes || !state.strokes.length) {
      captionEl.innerHTML = 'Coat the sheet by your own hand first. A partner can only expose what you have brushed.';
      return;
    }
    controlsEl.innerHTML = '';
    if (!people.length) {
      captionEl.innerHTML = 'Nobody else is in the atelier to hand it to. Share the room link and try again.';
      addButton('Back to the brush', back, 'ghost');
      return;
    }
    captionEl.innerHTML = 'Who should expose this sheet? It goes to them as it is; they take it into the light.';
    for (const p of people) {
      addButton(p.name, () => {
        const why = core.handOff(p);
        if (why) { back(); captionEl.innerHTML = why; return; }
        captionEl.innerHTML = `You hand the coated sheet to <strong>${escapeHtml(p.name)}</strong>. When they bring it out of the wash, you will hear how it turned out.`;
        controlsEl.innerHTML = '';
        addButton('Coat another sheet', () => { core.clearSheet(); back(); }, 'ghost');
      });
    }
    addButton('Never mind', back, 'ghost');
  }

  function escapeHtml(t) {
    return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // A sheet a partner coated starts at the exposure, with a word about who coated it
  if (hooks.preset) {
    captionOverride = `<strong>${escapeHtml(hooks.preset.from.name)}</strong> coated this sheet for you. `;
    core.applyPreset(hooks.preset);
  }

  // ---- canvas pointer: painting, and tilt on the finished plate --------
  function uv(e) {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (stageType(core.stage()) !== 'paint') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    core.brushBegin(...uv(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    const type = stageType(core.stage());
    if (type === 'paint' && e.buttons !== 0) {
      core.brushMove(...uv(e), (Math.abs(e.movementX) + Math.abs(e.movementY)) / 30);
    } else if (type === 'result') {
      core.setTilt((uv(e)[0] - 0.5) * 2);
    }
  });
  canvas.addEventListener('pointerup', () => core.brushEnd());
  canvas.addEventListener('pointerleave', () => core.setTilt(0));

  // ---- teardown, for hosts that open and close benches ----
  return {
    core,
    destroy() {
      core.destroy();
      root.innerHTML = '';
    },
  };
}
