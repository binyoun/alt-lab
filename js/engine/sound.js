// The studio's ears: everything synthesized in WebAudio, nothing sampled.
// Silent until the visitor turns the sound on (their gesture wakes the
// AudioContext). Bin can replace any voice here with recordings later.

import { ledger } from './ledger.js';

let ctx = null;
let master = null;
let layers = {};   // name -> { gain, stop() }
let scene = 'room';
let timers = [];

function ensureCtx() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  buildLayers();
  applyScene();
}

function noiseBuffer(brown) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    else d[i] = w;
  }
  return buf;
}

function loopNoise(brown, filterType, freq, q, gainValue) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(brown);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter).connect(gain).connect(master);
  src.start();
  return { gain, filter, target: gainValue };
}

function buildLayers() {
  layers.room = loopNoise(true, 'lowpass', 240, 0.7, 0.028);
  layers.wind = loopNoise(false, 'bandpass', 420, 0.6, 0.02);
  layers.water = loopNoise(false, 'bandpass', 950, 0.9, 0.05);
  // slow wander in the wind and water so the loops never read as loops
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.11;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 160;
  lfo.connect(lfoGain).connect(layers.wind.filter.frequency);
  lfo.start();
  const lfo2 = ctx.createOscillator();
  lfo2.frequency.value = 0.23;
  const lfo2Gain = ctx.createGain();
  lfo2Gain.gain.value = 240;
  lfo2.connect(lfo2Gain).connect(layers.water.filter.frequency);
  lfo2.start();

  schedule(() => drip(), 4000, 11000);
  schedule(() => { if (scene === 'expose') bird(); }, 1800, 6000);
}

function schedule(fn, min, max) {
  const tick = () => {
    fn();
    timers.push(setTimeout(tick, min + Math.random() * (max - min)));
  };
  timers.push(setTimeout(tick, min + Math.random() * (max - min)));
}

function env(gainNode, peak, attack, decay) {
  const t = ctx.currentTime;
  gainNode.gain.cancelScheduledValues(t);
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function blip(freq, endFreq, peak, attack, decay, type = 'sine') {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), ctx.currentTime + attack + decay);
  osc.connect(g).connect(master);
  env(g, peak, attack, decay);
  osc.start();
  osc.stop(ctx.currentTime + attack + decay + 0.05);
}

function burst(filterFreq, peak, decay, filterType = 'highpass') {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(false);
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  const g = ctx.createGain();
  src.connect(f).connect(g).connect(master);
  env(g, peak, 0.006, decay);
  src.start();
  src.stop(ctx.currentTime + decay + 0.1);
}

function drip() {
  if (scene !== 'room' && scene !== 'wash') return;
  blip(720 + Math.random() * 500, 240, 0.035, 0.004, 0.16);
}

function bird() {
  const base = 2400 + Math.random() * 1400;
  blip(base, base * 1.5, 0.022, 0.02, 0.09);
  setTimeout(() => blip(base * 1.2, base * 0.8, 0.018, 0.02, 0.08), 130 + Math.random() * 120);
}

function applyScene() {
  if (!ctx) return;
  const targets = {
    room: { room: 1, wind: 0, water: 0 },
    coat: { room: 1, wind: 0, water: 0 },
    expose: { room: 0.3, wind: 1, water: 0 },
    wash: { room: 0.5, wind: 0, water: 1 },
  };
  const t = targets[scene] || targets.room;
  for (const name of Object.keys(t)) {
    const layer = layers[name];
    layer.gain.gain.setTargetAtTime(layer.target * t[name], ctx.currentTime, 0.8);
  }
}

export const sound = {
  enabled: () => ledger.soundOn(),

  enable(on) {
    ledger.setSound(on);
    if (on) {
      ensureCtx();
      if (ctx.state === 'suspended') ctx.resume();
      master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.3);
    } else if (ctx) {
      master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
    }
  },

  setScene(name) {
    scene = name;
    applyScene();
  },

  brush(strength) {
    if (!ctx || !ledger.soundOn()) return;
    burst(1400 + Math.random() * 600, Math.min(0.05, 0.015 + strength * 0.03), 0.07);
  },
  tick() {
    if (!ctx || !ledger.soundOn()) return;
    blip(1500, 1500, 0.012, 0.003, 0.03, 'square');
  },
  flip() {
    if (!ctx || !ledger.soundOn()) return;
    burst(2600, 0.03, 0.11, 'bandpass');
  },
  thump() {
    if (!ctx || !ledger.soundOn()) return;
    blip(110, 55, 0.20, 0.008, 0.22);
    burst(3000, 0.03, 0.05);
  },
};

// The header toggle, present on every page that loads this module.
export function mountSoundToggle() {
  const nav = document.querySelector('.site-nav');
  if (!nav || nav.querySelector('.sound-toggle')) return;
  const b = document.createElement('button');
  b.className = 'sound-toggle';
  b.setAttribute('aria-pressed', String(ledger.soundOn()));
  b.textContent = ledger.soundOn() ? 'Sound on' : 'Sound off';
  b.addEventListener('click', () => {
    const on = !ledger.soundOn();
    sound.enable(on);
    b.textContent = on ? 'Sound on' : 'Sound off';
    b.setAttribute('aria-pressed', String(on));
    b.classList.toggle('on', on);
  });
  b.classList.toggle('on', ledger.soundOn());
  nav.appendChild(b);
  // a visitor who enabled sound on a previous page gets it back on first gesture
  if (ledger.soundOn()) {
    const wake = () => { sound.enable(true); removeEventListener('pointerdown', wake); };
    addEventListener('pointerdown', wake, { once: true });
  }
}
