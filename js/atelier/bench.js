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
import { commissionsFor, PROCESSES } from '../content/commissions.js';
import { shapes, dyes, specimenPlate, layOut, satchel } from './specimens.js';
import { skyNow, lightFactor, lightWords } from './sky.js';
import { views, viewImage } from './views.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STATION_OF = { upload: 'coat', info: 'coat', paint: 'coat', hold: 'expose', reveal: 'wash', result: 'result' };
export const ACTIVITY_OF = { coat: 'coating', expose: 'exposing', wash: 'washing', result: 'finishing' };

const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openBench({ config, stations, kit, scene, camera, me, walkTo, setActivity, hooks, placeName, onHang, onClose, field = null }) {
  // field: { image, rateScale, wetSeconds, notes() } for the wet-plate camera in the country
  // stations in the sun print at the pace of the sky; lamps and cameras do not
  const sunlit = stations.expose.shaft !== false || stations.expose.sky;
  const scale = field ? field.rateScale : 1;
  const core = createRitual(config, { maxCanvas: 1024, hooks: { ...hooks, lightRate: () => (sunlit ? lightFactor(skyNow()) : 1) * scale } });
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
    base.w = a >= 1 ? SHEET_W : SHEET_W * a;
    base.h = a >= 1 ? SHEET_W / a : SHEET_W;
  }

  // where the sheet is heading and how it gets there
  const pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), size: 1 };
  const base = { w: SHEET_W, h: SHEET_W * 0.75 }; // the sheet's size, before a station shrinks it
  let size = 1;
  let carried = false;
  function placeAt(st, instant = false) {
    carried = false;
    pose.pos.set(...st.sheet.pos);
    pose.quat.setFromEuler(new THREE.Euler(...st.sheet.rot, st.sheet.order || 'XYZ'));
    pose.size = st.sheet.scale || 1;
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
      <button class="back-btn" data-step-back><span aria-hidden="true">&larr;</span> Back to ${esc(placeName || 'the room')} <kbd>Esc</kbd></button>
      <div class="bench-title"><span class="bench-name">${esc(config.name)}</span><span class="step-count"></span><span class="wet-timer" hidden></span></div>
      <button class="letters-btn" data-letters hidden></button>
    </div>
    <div class="paper-card" hidden>
      <p class="card-title">A fresh sheet for the ${esc(config.name.toLowerCase())}</p>
      <button class="btn" data-pick>Choose a photograph</button>
      <button class="btn ghost" data-camera>Use the camera</button>
      <p class="drawer-line">No photograph at hand? <button data-specimen>Borrow a specimen from the drawer</button></p>
      <div class="from-satchel" hidden></div>
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

  // ---- the satchel at the bench --------------------------------------------------------
  const CAMERA = ['daguerreotype', 'tintype']; // these take pictures, not photograms
  function fillSatchelCard() {
    const box = el('.from-satchel');
    box.innerHTML = '';
    const sh = shapes();
    const dy = config.id === 'anthotype' ? dyes() : [];
    const photogram = !CAMERA.includes(config.id) && sh.length;
    const salt = config.id === 'saltprint' && (satchel().items.salt || 0) > 0;
    const vs = CAMERA.includes(config.id) ? views() : [];
    box.hidden = !photogram && !dy.length && !salt && !vs.length;
    if (box.hidden) return;
    const head = document.createElement('p');
    head.className = 'card-sub';
    head.textContent = 'From the country';
    box.append(head);
    if (photogram) {
      const b = document.createElement('button');
      b.className = 'btn';
      b.textContent = `Print what you gathered (${sh.length} kind${sh.length === 1 ? '' : 's'})`;
      b.title = sh.map((x) => x.name).join(', ');
      b.addEventListener('click', () => core.useCanvas(specimenPlate(sh, 1600, 1200, Date.now() % 9973), sh.map((x) => x.id)));
      box.append(b);
    }
    if (vs.length) {
      const row = document.createElement('div');
      row.className = 'view-row';
      const label = document.createElement('span');
      label.textContent = 'Develop a view you took in the country:';
      row.append(label);
      for (const v of vs) {
        const b = document.createElement('button');
        b.className = 'view-thumb';
        b.title = v.place;
        b.innerHTML = `<img src="${v.src}" alt="A view of ${esc(v.place)}"><small>${esc(v.place)}</small>`;
        b.addEventListener('click', async () => core.useCanvas(await viewImage(v), []));
        row.append(b);
      }
      box.append(row);
    }
    if (salt) {
      const b = document.createElement('button');
      b.className = 'btn ghost' + (state.salted ? ' on' : '');
      b.textContent = state.salted ? 'Salted with your sea salt' : 'Salt the paper with your sea salt';
      b.addEventListener('click', () => {
        core.setSalted(!state.salted);
        b.textContent = state.salted ? 'Salted with your sea salt' : 'Salt the paper with your sea salt';
      });
      box.append(b);
    }
    if (dy.length) {
      const row = document.createElement('div');
      row.className = 'dye-row';
      const label = document.createElement('span');
      label.textContent = 'Crush for the juice:';
      row.append(label);
      for (const d of dy) {
        const b = document.createElement('button');
        b.className = 'dye' + (state.dye === d.dye ? ' on' : '');
        b.style.setProperty('--dye', `rgb(${d.dye.map((v) => Math.round(v * 255)).join(',')})`);
        b.textContent = d.name;
        b.addEventListener('click', () => {
          core.setDye(state.dye === d.dye ? null : d.dye, d.id);
          row.querySelectorAll('.dye').forEach((x) => x.classList.toggle('on', x === b && !!state.dye));
        });
        row.append(b);
      }
      box.append(row);
    }
  }

  // ---- the wet plate's clock: from the silver bath to the developer ------------------------
  let wetLeft = null;
  let dried = false;
  const timerEl = () => el('.wet-timer');
  function wetClock(stage) {
    if (!field || !field.wetSeconds) return;
    if (stage.id === 'bath' && wetLeft === null) { wetLeft = field.wetSeconds; dried = false; }
    if (stageType(stage) === 'reveal' || stageType(stage) === 'result') {
      if (wetLeft !== null && wetLeft <= 0) dried = true;
      wetLeft = null;
      timerEl().hidden = true;
      if (dried && stageType(stage) === 'result') core.adjust({ contrast: 0.7 });
    }
    if (stage.id === 'pour' || stageType(stage) === 'paint') { wetLeft = null; dried = false; timerEl().hidden = true; }
  }
  function tickWet(dt) {
    if (wetLeft === null) return;
    wetLeft = Math.max(0, wetLeft - dt);
    const t = timerEl();
    t.hidden = false;
    const m = Math.floor(wetLeft / 60);
    const sec = Math.floor(wetLeft % 60);
    t.textContent = wetLeft > 0 ? `Plate wet · ${m}:${String(sec).padStart(2, '0')} left to develop` : 'The plate has dried';
    t.classList.toggle('urgent', wetLeft < 20);
  }

  // ---- stages ----------------------------------------------------------------------
  let captionOverride = null;
  core.on('stage', (stage, type) => {
    if (type !== 'upload') showLive();
    const where = stage.station || STATION_OF[type] || 'coat';
    wetClock(stage, type);
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
    el('.step-count').textContent = `Step ${idx + 1} of ${config.stages.length} · ${stage.title}`;
    card.hidden = type !== 'upload';
    if (type === 'upload') fillSatchelCard();
    if (captionOverride && type === 'hold') {
      captionEl.innerHTML = captionOverride + stage.caption;
      captionOverride = null;
    } else captionEl.innerHTML = type === 'upload' ? '' : stage.caption;
    if (type === 'hold' && sunlit) captionEl.innerHTML += `<span class="sky-note">${lightWords(skyNow())}.</span>`;
    el('.skip').hidden = type === 'upload' || type === 'result' || !!field;
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
      // lumen paper: lay what you gathered straight onto it
      if (config.brushMode === 'leaf' && shapes().length) {
        addButton('Lay your specimens', () => {
          const sh = shapes();
          core.layShapes((ctx, w, h) => layOut(ctx, w, h, sh, { seed: Date.now() % 9973, margin: 0.12 }), sh.map((x) => x.id));
          captionEl.innerHTML = 'Your gathered leaves and fronds lie on the paper, pressed flat under glass.';
        }, 'ghost');
      }
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
        const extra = [];
        if (field && dried) extra.push('And the collodion dried before you developed it; see the streaks and the fog.');
        if (field && field.notes) extra.push(...field.notes());
        noteEl.innerHTML = `<span class="master-says">The Master looks it over.</span> ${core.verdict().remark}${extra.length ? ' ' + extra.join(' ') : ''}`;
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
      // the way out of a finished print: press it, then hang it on the line
      const finish = () => {
        row.querySelector('.primary-action').remove();
        const hang = addButton('Hang it on the line', () => hangIt(), 'primary-action', row);
        row.prepend(hang);
        el('.bench-bar').classList.add('finished');
      };
      const press = addButton('Press it into the ledger', function () {
        const r = core.press();
        if (!r) return;
        if (r.lines.length) {
          fulfilledEl.innerHTML = r.lines.join('<br>');
          fulfilledEl.hidden = false;
        }
        if (r.seal) dropSeal();
        updateLettersBtn();
        finish();
      }, 'primary-action', row);
      if (state.pressed) setTimeout(finish);
      void press;
      addButton(config.downloadLabel || 'Download', () => core.download(), 'ghost', row);
      addButton('Make another', () => core.makeAnother(), 'ghost', row);
      addButton('New photograph', () => {
        live = false;
        useTexture(blank);
        base.w = SHEET_W;
        base.h = SHEET_W * 0.75;
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
    if (walking || hanging) return kind !== 'move';
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

  // ---- effects: a shaft of light, ripples in the wash, the seal ----------------------------
  const fxGroup = new THREE.Group();
  scene.add(fxGroup);
  const sunDir = kit.sun ? kit.sun.position.clone().sub(kit.sun.target.position).normalize() : new THREE.Vector3(0.3, 1, 0.3).normalize();
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 0.4, 7, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: '#fff1c4', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  fxGroup.add(shaft);
  const DUST = 70;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = Array.from({ length: DUST }, () => [Math.random(), Math.random() * Math.PI * 2, Math.random()]);
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#fff4d6', size: 0.035, transparent: true, opacity: 0, depthWrite: false }));
  fxGroup.add(dust);
  let shaftLevel = 0;
  // a small warm light by the wash, where a room is otherwise dark
  let glow = null;
  if (stations.wash.glow) {
    glow = new THREE.PointLight(0xffb070, 0, 4, 1.6);
    glow.position.set(...stations.wash.glow);
    fxGroup.add(glow);
  }
  // indoors, a lamp on the subject comes up while the lens is open
  let lamp = null;
  if (stations.expose.lamp) {
    lamp = new THREE.PointLight(0xffe6c0, 0, 6, 1.6);
    lamp.position.set(...stations.expose.lamp);
    fxGroup.add(lamp);
  }

  const ripples = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.33, 40), new THREE.MeshBasicMaterial({ color: '#e8f4f8', transparent: true, opacity: 0, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.userData.phase = i / 3;
    fxGroup.add(m);
    return m;
  });
  let rippleLevel = 0;

  // the house seal, dropped onto the corner of a print the Master keeps
  let seal = null;
  let sealT = 0;
  function dropSeal() {
    const color = (PROCESSES[config.id] || {}).seal || '#5b1f1a';
    seal = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.014, 18), new THREE.MeshStandardMaterial({ color, roughness: 0.35 }));
    seal.castShadow = true;
    scene.add(seal);
    sealT = 0;
  }
  const sealSpot = new THREE.Vector3();
  const sealNormal = new THREE.Vector3();

  // ---- hanging it on the line, which is also the way out ---------------------------------------
  let hanging = false;
  function hangIt() {
    const L = kit.dryingLine;
    if (!L) { close_(); return; }
    const [x0, z0] = L.from;
    const [x1, z1] = L.to;
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    // stand on the room side of the line, facing it
    let nx = -(z1 - z0);
    let nz = x1 - x0;
    const len = Math.hypot(nx, nz);
    nx /= len;
    nz /= len;
    if (nx * -mx + nz * -mz < 0) { nx = -nx; nz = -nz; }
    const sx = mx + nx * 1.0;
    const sz = mz + nz * 1.0;
    hanging = true;
    strip.classList.add('moving');
    el('.bench-bar').hidden = true;
    station = 'line';
    shot = null;
    carry();
    walking = true;
    setActivity('finishing');
    walkTo(sx, sz, () => {
      walking = false;
      me.rotation(Math.atan2(nx, nz) + Math.PI);
      // up onto the line, facing the room
      carried = false;
      pose.pos.set(mx, L.y - 0.32, mz);
      pose.quat.setFromEuler(new THREE.Euler(0, Math.atan2(nx, nz), 0));
      shot = { pos: new THREE.Vector3(mx + nx * 2.6, 1.9, mz + nz * 2.6), look: new THREE.Vector3(mx, L.y - 0.4, mz) };
      setTimeout(() => {
        if (onHang) onHang();
        close_();
      }, REDUCED ? 200 : 1400);
    });
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
    size += ((carried ? 1 : pose.size) - size) * Math.min(1, dt * 5);
    sheet.scale.set(base.w * size, base.h * size, 1);
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
    fx(dt);
    tickWet(dt);
  }

  let fxT = 0;
  function fx(dt) {
    fxT += dt;
    // the shaft of light stands over the sheet at the exposure, brighter while held
    const atLight = station === 'expose' && !walking && stations.expose.shaft !== false;
    shaftLevel += ((atLight ? (exposingNow ? 1 : 0.35) : 0) - shaftLevel) * Math.min(1, dt * 3);
    shaft.material.opacity = 0.16 * shaftLevel;
    dust.material.opacity = 0.8 * shaftLevel;
    shaft.visible = dust.visible = shaftLevel > 0.01;
    if (shaft.visible) {
      shaft.position.copy(sheet.position).addScaledVector(sunDir, 3.5);
      shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunDir);
      for (let i = 0; i < DUST; i++) {
        const [h, a, r] = dustSeed[i];
        const t = (h + fxT * 0.03 * (0.5 + r)) % 1;
        const rad = 0.4 + t * 0.45;
        const p = new THREE.Vector3(Math.cos(a + fxT * 0.2) * rad * r, 0, Math.sin(a + fxT * 0.2) * rad * r);
        p.applyQuaternion(shaft.quaternion).add(sheet.position).addScaledVector(sunDir, 0.2 + t * 5);
        dustPos.set([p.x, p.y, p.z], i * 3);
      }
      dustGeo.attributes.position.needsUpdate = true;
    }
    if (glow) {
      const want = (station === 'wash' || station === 'result') && !walking ? 5 : 0;
      glow.intensity += (want - glow.intensity) * Math.min(1, dt * 3);
    }
    if (lamp) {
      const want = station === 'expose' && !walking ? (exposingNow ? 9 : 2) : 0;
      lamp.intensity += (want - lamp.intensity) * Math.min(1, dt * 4);
    }
    // ripples spread round the sheet while it washes
    const inWash = station === 'wash' && stations.wash.ripples !== false && !walking && (state.washing || stageType(core.stage()) === 'reveal');
    rippleLevel += ((inWash ? 1 : 0) - rippleLevel) * Math.min(1, dt * 3);
    for (const r of ripples) {
      const t = (fxT * 0.45 + r.userData.phase) % 1;
      r.visible = rippleLevel > 0.01;
      r.position.set(sheet.position.x, sheet.position.y + 0.004, sheet.position.z);
      r.scale.setScalar(0.8 + t * 2.4);
      r.material.opacity = (1 - t) * 0.55 * rippleLevel;
    }
    // the seal falls, bounces once and settles on the corner
    if (seal) {
      sealT = Math.min(1, sealT + dt * 1.6);
      sealNormal.set(0, 0, 1).applyQuaternion(sheet.quaternion);
      sealSpot.set(0.36, -0.34, 0).applyMatrix4(sheet.matrixWorld);
      const drop = REDUCED ? 0 : Math.abs(Math.cos(sealT * Math.PI * 1.5)) * (1 - sealT) * 0.4;
      seal.position.copy(sealSpot).addScaledVector(sealNormal, 0.01 + drop);
      seal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sealNormal);
    }
  }

  function close_() {
    core.destroy();
    scene.remove(sheet);
    scene.remove(glass);
    scene.remove(fxGroup);
    if (seal) scene.remove(seal);
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
  } else if (field) {
    // you begin at the camera you just composed with, and walk to the tent
    station = 'expose';
    goTo('coat', () => core.useCanvas(field.image, []));
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
    get hideMe() { return !walking && !!(stations[station] && stations[station].hideMe); },
    get walking() { return walking; },
    get cursor() { return cursor; },
  };
}
