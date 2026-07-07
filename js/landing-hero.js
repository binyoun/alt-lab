// The landing hero: a real cyanotype ritual, looping slowly behind the title.
// Runs the same fragment shader as the lab, on a scattered botanical plate.

import { setupSample } from './engine/sample.js';
import config from './processes/cyanotype.js';

const LOOP = 26; // seconds

export function startHero(canvas) {
  const W = Math.min(1400, Math.round((window.devicePixelRatio || 1) * window.innerWidth));
  const H = Math.round(W * 0.62);
  canvas.width = W;
  canvas.height = H;

  const sample = setupSample(config, canvas);
  const resultStage = config.stages.length - 1;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    sample.gl.draw(); // one finished print, perfectly still
    return;
  }

  let start = performance.now();
  function frame(t) {
    let s = (t - start) / 1000;
    if (s >= LOOP) {
      start = t;
      s = 0;
      sample.replate();
      sample.recoat();
    }
    const u = { u_time: t / 1000, u_tone: 0 };
    if (s < 2.5) {
      u.u_stage = 2; u.u_exposure = 0; u.u_wash = 0;       // coated, waiting
    } else if (s < 12.5) {
      u.u_stage = 3; u.u_exposure = ((s - 2.5) / 10) * 1.2; // the sun works
    } else if (s < 17.5) {
      u.u_stage = 4; u.u_exposure = 1.2;
      u.u_wash = (s - 12.5) / 5;                            // the water tells
    } else {
      u.u_stage = resultStage; u.u_exposure = 1.2; u.u_wash = 1;
      u.u_tone = Math.sin((s - 17.5) * 0.35) * 0.12;        // oxidizing drift
    }
    // dissolve out and in across the loop seam
    canvas.style.opacity = s > LOOP - 1 ? (LOOP - s).toFixed(2)
      : s < 1 ? s.toFixed(2) : 1;
    sample.gl.set(u);
    sample.gl.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
