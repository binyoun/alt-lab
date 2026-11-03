// The ritual inside the atelier: the second interface to the ritual core
// (the flat lab's page is the first). The sheet lies on the bench as a live
// print; you brush it in 3D; the apprentice carries it to the light and to
// the wash; the camera follows from shot to shot; a slim strip at the
// bottom holds the steps, the caption and the controls.

import * as THREE from 'three';
import { createRitual, stageType } from '../engine/ritual-core.js';
import { ledger } from '../engine/ledger.js';
import { sound } from '../engine/sound.js';
import { readLetters } from '../engine/letters.js';
import { commissionsFor } from '../content/commissions.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STATION_OF = { upload: 'coat', info: 'coat', paint: 'coat', hold: 'expose', reveal: 'wash', result: 'result' };
export const ACTIVITY_OF = { coat: 'coating', expose: 'exposing', wash: 'washing', result: 'finishing' };

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openBench({ config, stations, kit, scene, camera, me, walkTo, setActivity, hooks, onClose }) {
  const core = createRitual(config, { maxCanvas: 1024, hooks });
  const { state } = core;

  // ---- the sheet ------------------------------------------------------------
  const blank = document.createElement('canvas');
  blank.width = 4;
  blank.height = 3;
  const bctx = blank.getContext('2d');
  bctx.fillStyle = '#efe9dc';
  bctx.fillRect(0, 0, 4, 3);
  // a texture's storage is sized once, so blank paper and the live print
  // each get their own texture rather than swapping images on one
  const makeTex = (img) => {
    const t = new THREE.CanvasTexture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  let tex = makeTex(blank);
  const sheetMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide });
  function useTexture(img) {
    tex.dispose();
    tex = makeTex(img);
    sheetMat.map = tex;
    sheetMat.needsUpdate = true;
  }
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), sheetMat);
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  const SHEET_W = 0.5;
  sheet.scale.set(SHEET_W, SHEET_W * 0.75, 1);
  scene.add(sheet);
  // glass laid over the sheet at the light, like a printing frame
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#cfe3e8', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1 }));
  glass.visible = false;
  scene.add(glass);
  let live = false; // the sheet shows the core's canvas rather than blank paper

  function showLive() {
    if (live) return;
    live = true;
    useTexture(core.canvas);
    const a = core.canvas.width / core.canvas.height;
    sheet.scale.set(a >= 1 ? SHEET_W : SHEET_W * a, a >= 1 ? SHEET_W / a : SHEET_W, 1);
  }

  // where the sheet is heading and how it gets there
  const pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  let carried = false;
  function placeAt(st, instant = false) {
    carried = false;
    pose.pos.set(...st.sheet.pos);
    pose.quat.setFromEuler(new THREE.Euler(...st.sheet.rot));
    if (instant || REDUCED) {
      sheet.position.copy(pose.pos);
      sheet.quaternion.copy(pose.quat);
    }
    glass.visible = !!st.glass;
  }
  const hands = new THREE.Vector3();
  const handQuat = new THREE.Quaternion();
  function carry() {
    carried = true;
    glass.visible = false;
  }

  // ---- the camera shot ---------------------------------------------------------
  let shot = null; // { pos, look } or null to follow the apprentice
  let close = false;

  // ---- stations ------------------------------------------------------------------
  let station = null;
  let walking = false;
  function goTo(name, then) {
    const st = stations[name];
    if (station === name) { then && then(); return; }
    const from = station;
    station = name;
    setActivity(ACTIVITY_OF[name] || '');
    const arrive = () => {
      walking = false;
      me.rotation(st.face);
      placeAt(st, from === null);
      shot = { pos: new THREE.Vector3(...st.cam.pos), look: new THREE.Vector3(...st.cam.look) };
      close = !!st.close || name === 'coat';
      then && then();
    };
    const [sx, sz] = st.stand;
    if (from === null || Math.hypot(sx - me.x(), sz - me.z()) < 0.2) { arrive(); return; }
    // carry the sheet across the yard, the camera following behind
    walking = true;
    shot = null;
    close = false;
    carry();
    walkTo(sx, sz, arrive);
  }

  // ---- the strip ------------------------------------------------------------------
  const strip = document.createElement('div');
  strip.className = 'bench-strip';
  strip.innerHTML = `
    <div class="bench-top">
      <button class="btn ghost" data-step-back>Step back</button>
      <span class="bench-name">${esc(config.name)}</span>
      <button class="letters-btn" data-letters hidden></button>
    </div>
    <div class="paper-card" hidden>
      <p class="card-title">A fresh sheet for the ${esc(config.name.toLowerCase())}</p>
      <button class="btn" data-pick>Choose a photograph</button>
      <button class="btn ghost" data-camera>Use the camera</button>
      <p class="drawer-line">No photograph at hand? <button data-specimen>Borrow a specimen from the drawer</button></p>
      <p class="privacy">The photograph stays on this device. Others here see only a blank sheet in your hands.</p>
      <input type="file" accept="image/*" hidden data-file>
      <input type="file" accept="image/*" capture="environment" hidden data-capture>
    </div>
    <div class="bench-bar">
      <div class="steps"></div>
      <div class="caption"></div>
      <div class="master-note" hidden></div>
      <div class="fulfilled-note" hidden></div>
      <div class="controls"></div>
      <div class="skip" hidden><button data-skip>Skip ahead to the finished print</button></div>
    </div>
    <div class="letters-overlay" hidden>
      <div class="letters-sheaf">
        <h2>Letters for the ${esc(config.name.toLowerCase())} bench</h2>
        <div class="letters-list"></div>
        <button class="btn ghost" data-letters-close>Back to the bench</button>
      </div>
    </div>`;
  document.body.appendChild(strip);
  const el = (s) => strip.querySelector(s);
  const captionEl = el('.caption');
  const controlsEl = el('.controls');
  const stepsEl = el('.steps');
  const noteEl = el('.master-note');
  const fulfilledEl = el('.fulfilled-note');
  const card = el('.paper-card');
  for (const s of config.stages) {
    const span = document.createElement('span');
    span.textContent = s.title;
    stepsEl.appendChild(span);
  }

  // letters, one at a time
  function updateLettersBtn() {
    const btn = el('[data-letters]');
    const all = commissionsFor(config.id);
    if (!all.length) return;
    const open = all.filter((c) => !ledger.fulfilled(c.id)).length;
    btn.hidden = false;
    btn.textContent = open ? (open === 1 ? 'A letter waits' : `${open} letters wait`) : 'Every letter answered';
    btn.classList.toggle('all-done', open === 0);
  }
  updateLettersBtn();
  el('[data-letters]').addEventListener('click', () => {
    readLetters(el('.letters-list'), commissionsFor(config.id), { onTurn: () => sound.flip() });
    el('.letters-overlay').hidden = false;
    sound.flip();
  });
  el('[data-letters-close]').addEventListener('click', () => { el('.letters-overlay').hidden = true; });

  // choosing a photograph
  el('[data-pick]').addEventListener('click', () => el('[data-file]').click());
  el('[data-camera]').addEventListener('click', () => el('[data-capture]').click());
  el('[data-specimen]').addEventListener('click', () => core.useSpecimen());
  el('[data-file]').addEventListener('change', (e) => core.loadFile(e.target.files[0]));
  el('[data-capture]').addEventListener('change', (e) => core.loadFile(e.target.files[0]));
  core.on('error', (m) => { captionEl.textContent = m; });
  el('[data-skip]').addEventListener('click', () => core.skip());
  el('[data-step-back]').addEventListener('click', () => close_());

  // ---- stages ----------------------------------------------------------------------
  let captionOverride = null;
  core.on('stage', (stage, type) => {
    if (type !== 'upload') showLive();
    const where = STATION_OF[type] || 'coat';
    // the controls wait until the apprentice has arrived
    strip.classList.add('moving');
    goTo(where, () => {
      strip.classList.remove('moving');
      applyStage(stage, type);
    });
  });

  function applyStage(stage, type) {
    const idx = core.stageIndex(stage.id);
    stepsEl.querySelectorAll('span').forEach((span, i) => {
      span.classList.toggle('on', i === idx);
      span.classList.toggle('done', i < idx);
    });
    card.hidden = type !== 'upload';
    if (captionOverride && type === 'hold') {
      captionEl.innerHTML = captionOverride + stage.caption;
      captionOverride = null;
    } else captionEl.innerHTML = type === 'upload' ? '' : stage.caption;
    el('.skip').hidden = type === 'upload' || type === 'result';
    noteEl.hidden = type !== 'result';
    if (type !== 'result') fulfilledEl.hidden = true;
    canvasCursor(type === 'paint' ? 'brush' : type === 'result' && config.tiltResult ? 'tilt' : '');
    buildControls(type, stage);
  }

  function next() {
    const why = core.advance();
    if (why) captionEl.innerHTML = why;
  }

  function addButton(label, fn, cls = '', parent = controlsEl) {
    const b = document.createElement('button');
    b.className = 'btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', fn);
    parent.appendChild(b);
    return b;
  }

  let meterFill = null;
  let meterLabel = null;
  core.on('exposure', (m) => {
    if (meterFill) meterFill.style.width = m.fraction * 100 + '%';
    if (meterLabel) meterLabel.textContent = m.label;
  });

  let exposingNow = false;
  function buildControls(type, stage) {
    controlsEl.innerHTML = '';
    meterFill = meterLabel = null;
    if (type === 'info') {
      addButton(stage.next, next);
    } else if (type === 'paint') {
      addButton(stage.autoLabel || 'Coat for me', () => core.autoApply(), 'ghost');
      if (core.canHandOff()) addButton('Hand it to a partner', () => choosePartner(stage), 'ghost');
      addButton(stage.next, next);
    } else if (type === 'hold') {
      const m = core.meter();
      const hold = addButton(stage.holdLabel || 'Hold in the sun', () => {}, 'hold');
      const wrap = document.createElement('div');
      wrap.className = 'meter';
      wrap.innerHTML = '<div></div><span class="ideal"></span>';
      wrap.querySelector('.ideal').style.left = m.ideal * 100 + '%';
      wrap.querySelector('div').style.width = m.fraction * 100 + '%';
      const label = document.createElement('span');
      label.className = 'meter-label';
      label.textContent = m.label;
      controlsEl.append(wrap, label);
      meterFill = wrap.querySelector('div');
      meterLabel = label;
      hold.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        hold.setPointerCapture(e.pointerId);
        core.exposeOn();
        exposingNow = true;
        hold.classList.add('exposing');
      });
      const stop = () => { core.exposeOff(); exposingNow = false; hold.classList.remove('exposing'); };
      hold.addEventListener('pointerup', stop);
      hold.addEventListener('pointercancel', stop);
      hold.addEventListener('contextmenu', (e) => e.preventDefault());
      addButton(stage.next, next);
    } else if (type === 'reveal') {
      addButton(stage.next, function () {
        this.disabled = true;
        core.reveal();
      });
    } else if (type === 'result') {
      const showVerdict = () => {
        noteEl.innerHTML = `<span class="master-says">The Master looks it over.</span> ${core.verdict().remark}`;
        noteEl.hidden = false;
      };
      showVerdict();
      const refresh = () => { if (!state.pressed) showVerdict(); };
      const sliders = document.createElement('div');
      sliders.className = 'sliders';
      const slider = (label, min, max, value, fn) => {
        const l = document.createElement('label');
        l.textContent = label;
        const input = document.createElement('input');
        Object.assign(input, { type: 'range', min, max, step: 0.01, value });
        input.addEventListener('input', () => { fn(parseFloat(input.value)); refresh(); });
        sliders.append(l, input);
      };
      slider('Exposure', 0.5, 1.6, state.adj, (v) => core.adjust({ adj: v }));
      slider('Contrast', 0.6, 1.6, state.contrast, (v) => core.adjust({ contrast: v }));
      slider('Toning', -1, 1, state.tone, (v) => core.adjust({ tone: v }));
      controlsEl.appendChild(sliders);
      const row = document.createElement('div');
      row.className = 'row';
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
      if (state.pressed) { press.textContent = 'Pressed into the ledger'; press.disabled = true; }
      addButton(config.downloadLabel || 'Download', () => core.download(), 'ghost', row);
      addButton('Make another', () => core.makeAnother(), 'ghost', row);
      addButton('New photograph', () => {
        live = false;
        useTexture(blank);
        sheet.scale.set(SHEET_W, SHEET_W * 0.75, 1);
        core.newPhotograph();
      }, 'ghost', row);
    }
  }

  function choosePartner(stage) {
    const back = () => { buildControls('paint', stage); captionEl.innerHTML = stage.caption; };
    if (!state.strokes || !state.strokes.length) {
      captionEl.innerHTML = 'Coat the sheet by your own hand first. A partner can only expose what you have brushed.';
      return;
    }
    const people = hooks.partners();
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
        captionEl.innerHTML = `You hand the coated sheet to <strong>${esc(p.name)}</strong>. When they bring it out of the wash, you will hear how it turned out.`;
        controlsEl.innerHTML = '';
        addButton('Coat another sheet', () => { core.clearSheet(); back(); }, 'ghost');
      });
    }
    addButton('Never mind', back, 'ghost');
  }

  // ---- brushing on the sheet ------------------------------------------------------------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let painting = false;
  let tilting = false;
  function sheetUV(e, rect) {
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(sheet, false)[0];
    return hit ? [hit.uv.x, 1 - hit.uv.y] : null;
  }
  let cursor = '';
  function canvasCursor(c) { cursor = c; }

  // returns true when the pointer event was the bench's to handle
  function pointer(kind, e, rect) {
    if (walking) return kind !== 'move';
    const type = stageType(core.stage());
    if (type === 'paint') {
      if (kind === 'down') {
        const uv = sheetUV(e, rect);
        if (!uv) return true;
        painting = true;
        core.brushBegin(...uv);
        return true;
      }
      if (kind === 'move' && painting) {
        const uv = sheetUV(e, rect);
        if (uv) core.brushMove(...uv, (Math.abs(e.movementX) + Math.abs(e.movementY)) / 30);
        return true;
      }
      if (kind === 'up' && painting) { painting = false; core.brushEnd(); return true; }
      return kind !== 'move';
    }
    if (type === 'result' && config.tiltResult) {
      if (kind === 'down') { tilting = true; return true; }
      if (kind === 'move' && tilting) { core.setTilt(((e.clientX - rect.left) / rect.width - 0.5) * 2); return true; }
      if (kind === 'up') { tilting = false; core.setTilt(0); return true; }
    }
    return kind !== 'move'; // taps belong to the bench while it is open
  }

  // ---- per-frame ---------------------------------------------------------------------------
  let lastVersion = -1;
  const sunBase = kit.sun ? kit.sun.intensity : 0;
  const hemiBase = kit.hemi ? kit.hemi.intensity : 0;
  function update(dt) {
    // the live print onto the sheet, only when it changed
    if (live && state.version !== lastVersion) {
      lastVersion = state.version;
      tex.needsUpdate = true;
    }
    // the sheet follows the hands, or settles into its station
    if (carried) {
      me.handsWorld(hands, handQuat);
      sheet.position.copy(hands);
      sheet.quaternion.copy(handQuat);
    } else {
      const k = Math.min(1, dt * 5);
      sheet.position.lerp(pose.pos, k);
      sheet.quaternion.slerp(pose.quat, k);
    }
    glass.position.copy(sheet.position).add(new THREE.Vector3(0, 0.012, 0).applyQuaternion(sheet.quaternion));
    glass.quaternion.copy(sheet.quaternion);
    glass.scale.set(sheet.scale.x * 1.15, sheet.scale.y * 1.15, 1);
    // the light comes up while the sheet is exposed
    if (kit.sun) {
      const want = sunBase * (exposingNow ? 1.7 : 1);
      kit.sun.intensity += (want - kit.sun.intensity) * Math.min(1, dt * 4);
    }
    if (kit.hemi) {
      const want = hemiBase * (exposingNow ? 1.35 : 1);
      kit.hemi.intensity += (want - kit.hemi.intensity) * Math.min(1, dt * 4);
    }
  }

  function close_() {
    core.destroy();
    scene.remove(sheet);
    scene.remove(glass);
    tex.dispose();
    sheetMat.dispose();
    if (kit.sun) kit.sun.intensity = sunBase;
    if (kit.hemi) kit.hemi.intensity = hemiBase;
    strip.remove();
    setActivity('');
    onClose();
  }

  // ---- begin: step up to the bench -------------------------------------------------------------
  if (hooks.preset) {
    captionOverride = `<strong>${esc(hooks.preset.from.name)}</strong> coated this sheet for you. `;
    showLive();
    station = null;
    goTo('coat', () => core.applyPreset(hooks.preset));
  } else {
    goTo('coat', () => applyStage(config.stages[0], 'upload'));
  }

  return {
    core,
    sheet,
    pointer,
    update,
    close: close_,
    get shot() { return shot; },
    get closeUp() { return close; },
    get walking() { return walking; },
    get cursor() { return cursor; },
  };
}
