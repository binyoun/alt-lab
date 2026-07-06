// The ritual runner: walks a photograph through a process config,
// stage by stage, entirely on the visitor's device.

import { createGL } from './gl.js';
import { createBrush } from './brush.js';

const MAX_CANVAS = 1600;

export function startRitual(root, config) {
  // ---- DOM scaffold -------------------------------------------------
  root.innerHTML = `
    <div class="ritual">
      <div class="ritual-head">
        <h1>${config.name}</h1>
        <div class="meta">${config.year} · ${config.inventor}</div>
      </div>
      <div class="steps"></div>
      <div class="stage-canvas-holder">
        <div class="upload-panel">
          <button class="btn" data-pick>Choose a photograph</button>
          <button class="btn ghost" data-camera>Use the camera</button>
          <p>Or drop an image here.</p>
          <p class="privacy">The photograph stays on this device. Nothing is uploaded.</p>
          <input type="file" accept="image/*" hidden data-file>
          <input type="file" accept="image/*" capture="environment" hidden data-capture>
        </div>
        <canvas class="print" hidden></canvas>
      </div>
      <div class="caption"></div>
      <div class="controls"></div>
      <div class="skip" hidden><button data-skip>Skip ahead to the finished print</button></div>
    </div>`;

  const el = (sel) => root.querySelector(sel);
  const canvas = el('canvas.print');
  const stepsEl = el('.steps');
  const captionEl = el('.caption');
  const controlsEl = el('.controls');
  const uploadPanel = el('.upload-panel');
  const skipEl = el('.skip');

  for (const s of config.stages) {
    const span = document.createElement('span');
    span.textContent = s.title;
    span.dataset.stage = s.id;
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
    adj: 1,
    contrast: 1,
    tone: 0,
    image: null, // offscreen canvas with the photo
  };

  const stageIndex = (id) => config.stages.findIndex((s) => s.id === id);
  const stageNum = { negative: 1, coat: 2, expose: 3, wash: 4, result: 5 };

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
    const iw = state.image.width;
    const ih = state.image.height;
    const aspect = iw / ih;
    let w, h;
    if (aspect >= 1) { w = MAX_CANVAS; h = Math.round(MAX_CANVAS / aspect); }
    else { h = MAX_CANVAS; w = Math.round(MAX_CANVAS * aspect); }
    canvas.width = w;
    canvas.height = h;

    if (!state.gl) state.gl = createGL(canvas, config.fragment);
    state.gl.setTexture('u_image', state.image);
    state.brush = createBrush(w, h);
    state.gl.setTexture('u_mask', state.brush.canvas);
    state.gl.set({
      u_res: [w, h],
      u_margin: config.margin,
      u_exposure: 0,
      u_wash: 0,
      u_adj: 1,
      u_contrast: 1,
      u_tone: 0,
    });

    state.exposure = 0;
    state.wash = 0;
    state.adj = 1;
    state.contrast = 1;
    state.tone = 0;

    uploadPanel.hidden = true;
    canvas.hidden = false;
    setStage('negative');
  }

  // ---- stage machine -------------------------------------------------
  function setStage(id) {
    state.stage = id;
    const idx = stageIndex(id);
    stepsEl.querySelectorAll('span').forEach((span, i) => {
      span.classList.toggle('on', i === idx);
      span.classList.toggle('done', i < idx);
    });
    const stage = config.stages[idx];
    captionEl.innerHTML = stage.caption;
    skipEl.hidden = !(id === 'negative' || id === 'coat' || id === 'expose' || id === 'wash');
    buildControls(id, stage);
  }

  function buildControls(id, stage) {
    controlsEl.innerHTML = '';
    if (id === 'negative') {
      addButton(stage.next, () => setStage('coat'));
    } else if (id === 'coat') {
      addButton('Coat for me', () => {
        state.brush.autoCoat(config.margin);
        state.maskDirty = true;
      }, 'ghost');
      addButton(stage.next, () => {
        if (state.brush.coverage() < 0.04) {
          captionEl.innerHTML = 'The paper is still bare. Brush some sensitizer on, or let the studio coat it for you.';
          return;
        }
        setStage('expose');
      });
    } else if (id === 'expose') {
      const meterWrap = document.createElement('div');
      meterWrap.className = 'meter';
      meterWrap.innerHTML = '<div></div><span class="ideal"></span>';
      meterWrap.querySelector('.ideal').style.left =
        (config.idealExposure / config.maxExposure) * 100 + '%';
      const label = document.createElement('span');
      label.className = 'meter-label';
      label.textContent = 'no sun yet';
      const hold = document.createElement('button');
      hold.className = 'btn hold';
      hold.textContent = 'Hold in the sun';
      hold.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hold.setPointerCapture(e.pointerId);
        state.exposing = true;
      });
      const stop = () => { state.exposing = false; };
      hold.addEventListener('pointerup', stop);
      hold.addEventListener('pointercancel', stop);
      hold.addEventListener('contextmenu', (e) => e.preventDefault());
      controlsEl.append(hold, meterWrap, label);
      state.meterFill = meterWrap.querySelector('div');
      state.meterLabel = label;
      addButton(stage.next, () => {
        if (state.exposure < 0.05) {
          captionEl.innerHTML = 'The paper has not seen the sun. Hold the print out a while first.';
          return;
        }
        setStage('wash');
      });
    } else if (id === 'wash') {
      addButton(stage.next, function washNow() {
        this.disabled = true;
        state.washing = true;
      });
    } else if (id === 'result') {
      const sliders = document.createElement('div');
      sliders.className = 'sliders';
      addSlider(sliders, 'Exposure', 0.5, 1.6, state.adj, (v) => {
        state.adj = v;
        state.gl.set({ u_adj: v });
      });
      addSlider(sliders, 'Contrast', 0.6, 1.6, state.contrast, (v) => {
        state.contrast = v;
        state.gl.set({ u_contrast: v });
      });
      addSlider(sliders, 'Toning', -1, 1, state.tone, (v) => {
        state.tone = v;
        state.gl.set({ u_tone: v });
      });
      controlsEl.appendChild(sliders);
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;justify-content:center;';
      controlsEl.appendChild(row);
      addButton('Download the print', downloadPrint, '', row);
      addButton('Print again', () => {
        state.brush.clear();
        state.maskDirty = true;
        state.exposure = 0;
        state.wash = 0;
        setStage('coat');
      }, 'ghost', row);
      addButton('New photograph', () => {
        canvas.hidden = true;
        uploadPanel.hidden = false;
        setStage('upload');
      }, 'ghost', row);
    }
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
    if (state.brush.coverage() < 0.04) {
      state.brush.autoCoat(config.margin);
      state.maskDirty = true;
    }
    if (state.exposure < 0.2) state.exposure = config.idealExposure;
    state.wash = 1;
    setStage('result');
  });

  // ---- coat painting ---------------------------------------------------
  function maskPoint(e) {
    const r = canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) / r.width) * canvas.width,
      ((e.clientY - r.top) / r.height) * canvas.height,
    ];
  }
  canvas.addEventListener('pointerdown', (e) => {
    if (state.stage !== 'coat') return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    state.brush.begin(...maskPoint(e));
    state.maskDirty = true;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (state.stage !== 'coat' || e.buttons === 0) return;
    state.brush.moveTo(...maskPoint(e));
    state.maskDirty = true;
  });
  canvas.addEventListener('pointerup', () => state.brush && state.brush.end());

  // ---- render loop -----------------------------------------------------
  let lastT = performance.now();
  function frame(t) {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    if (state.gl && !canvas.hidden) {
      if (state.exposing && state.stage === 'expose') {
        state.exposure = Math.min(config.maxExposure, state.exposure + config.exposureRate * dt);
        state.meterFill.style.width = (state.exposure / config.maxExposure) * 100 + '%';
        const min = Math.round(state.exposure * config.exposureMinutes);
        state.meterLabel.textContent = 'about ' + min + ' min of sun';
      }
      if (state.washing) {
        state.wash = Math.min(1, state.wash + dt / 2.6);
        if (state.wash >= 1) {
          state.washing = false;
          setStage('result');
        }
      }
      if (state.maskDirty) {
        state.gl.setTexture('u_mask', state.brush.canvas);
        state.maskDirty = false;
      }
      state.gl.set({
        u_stage: stageNum[state.stage] || 5,
        u_exposure: state.exposure,
        u_wash: state.wash,
        u_time: t / 1000,
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
      `${config.name}, ${config.year} process · simulated in the browser`,
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
