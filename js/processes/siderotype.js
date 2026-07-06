// Factory for the iron-salt (siderotype) family: cyanotype, Van Dyke brown,
// platinum and palladium. Same ritual, different chemistry and colour.

import { NOISE, PAPER, LUMA, IMAGE_SAMPLE } from '../engine/glsl.js';

const v3 = (c) => `vec3(${c.map((n) => n.toFixed(4)).join(', ')})`;

export function buildSiderotype(opts) {
  const {
    paper,            // base paper colour
    sens,             // sensitizer tint (multiplies paper)
    deep,             // fully printed colour
    toneWarm,         // deep colour at toning slider +1
    toneCool,         // deep colour at toning slider -1
    printOutMid,      // visible print-out colour during exposure
    printOutDeep,     // deeper print-out colour
    bronze,           // overexposure colour
    bronzeStart = 2.8,
    bronzeEnd = 5.0,
    exposedStrength = 1.0, // how loudly the image prints out before the bath
    fiber = 1.0,           // paper texture relief; coated papers sit low
    gloss = 0.0,           // surface sheen lifting the highlights (albumen)
  } = opts.look;

  const fragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;

uniform vec2  u_res;
uniform sampler2D u_mask;
uniform float u_stage;     // 1 negative, 2 coat, 3 expose, 4 wash, 5 result
uniform float u_exposure;  // accumulated exposure, 1.0 = ideal
uniform float u_wash;      // 0..1 wash progress
uniform float u_time;
uniform float u_contrast;  // result adjustment
uniform float u_tone;      // -1 cool .. 0 native .. 1 warm
uniform float u_adj;       // result exposure fine-tune multiplier

${NOISE}
${LUMA}
${PAPER}
${IMAGE_SAMPLE}

// Light through the negative: bright subjects block UV, shadows pass it.
float lightAt(float L) {
  return (L < 0.0) ? 1.0 : (1.0 - L);
}

vec3 printColor(vec2 uv, float m, float L, float E) {
  vec3 paper = paperColor(uv, ${v3(paper)}, ${fiber.toFixed(3)});
  if (m < 0.01) return paper;
  float x = E * lightAt(L) * 2.6;
  float d = 1.0 - exp(-x);
  d = clamp((d - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  d = pow(d, 1.05);
  d += (vnoise(uv * u_res * 0.7) - 0.5) * 0.04;
  d = clamp(d, 0.0, 1.0) * smoothstep(0.02, 0.35, m);
  vec3 deepC = ${v3(deep)};
  deepC = mix(deepC, ${v3(toneWarm)}, max(u_tone, 0.0));
  deepC = mix(deepC, ${v3(toneCool)}, max(-u_tone, 0.0));
  vec3 col = mix(paper, deepC, d);
  float bz = smoothstep(${bronzeStart.toFixed(2)}, ${bronzeEnd.toFixed(2)}, x);
  col = mix(col, ${v3(bronze)}, bz * 0.45);
  float sheen = fbm(uv * vec2(40.0, 220.0));
  col = mix(col, col * 1.07 + vec3(0.035, 0.030, 0.012) * sheen,
    ${gloss.toFixed(3)} * (1.0 - d));
  return col;
}

// Coated (and possibly exposing) paper, before the bath.
vec3 sensitizedColor(vec2 uv, float m, float L, float E) {
  vec3 paper = paperColor(uv, ${v3(paper)}, ${fiber.toFixed(3)});
  vec3 sensC = paper * ${v3(sens)};
  vec3 col = mix(paper, sensC, clamp(m * 1.1, 0.0, 0.9));
  if (m < 0.01 || E <= 0.0) return col;
  float x = E * lightAt(L) * 2.6;
  float d = (1.0 - exp(-x)) * ${exposedStrength.toFixed(3)};
  vec3 printed = mix(${v3(printOutMid)}, ${v3(printOutDeep)},
    clamp(d * 1.2 - 0.4, 0.0, 1.0));
  col = mix(col, printed, clamp(d * 1.25, 0.0, 1.0) * smoothstep(0.02, 0.35, m));
  float bz = smoothstep(${(bronzeStart - 0.4).toFixed(2)}, ${(bronzeEnd - 0.8).toFixed(2)}, x * ${exposedStrength.toFixed(3)});
  col = mix(col, ${v3(bronze)}, bz * 0.5);
  return col;
}

// The transparency, viewed on the light table.
vec3 negativeView(vec2 uv, float L) {
  vec3 bg = vec3(0.065, 0.07, 0.085) * (0.9 + 0.2 * fbm(uv * 300.0));
  vec2 e = vec2(u_margin * 0.55);
  bool onFilm = uv.x > e.x && uv.x < 1.0 - e.x && uv.y > e.y && uv.y < 1.0 - e.y;
  if (!onFilm) return bg;
  if (L < 0.0) return vec3(0.10, 0.11, 0.14); // film rebate
  float dens = L; // bright subjects lay down silver on the negative
  vec3 col = mix(vec3(0.80, 0.83, 0.88), vec3(0.05, 0.06, 0.10), dens);
  col *= 0.96 + 0.08 * fbm(uv * 500.0);
  return col;
}

void main() {
  float m = texture(u_mask, v_uv).r;
  float L = imageLuma(v_uv);
  int s = int(u_stage + 0.5);
  vec3 col;
  if (s == 1) {
    col = negativeView(v_uv, L);
  } else if (s == 2) {
    col = sensitizedColor(v_uv, m, L, 0.0);
  } else if (s == 3) {
    col = sensitizedColor(v_uv, m, L, u_exposure);
  } else if (s == 4) {
    float front = u_wash * 1.2 - 0.1;
    float edge = fbm(vec2(v_uv.x * 6.0, u_time * 0.4)) * 0.07;
    float washed = smoothstep(front + 0.02, front - 0.07, v_uv.y - edge);
    vec3 before = sensitizedColor(v_uv, m, L, u_exposure);
    vec3 after = printColor(v_uv, m, L, u_exposure);
    col = mix(before, after, washed);
    float glint = exp(-abs(v_uv.y - edge - front) * 26.0)
      * (0.5 + 0.5 * sin(v_uv.x * 42.0 + u_time * 5.0))
      * 0.09 * step(0.01, u_wash) * (1.0 - step(0.995, u_wash));
    col += glint;
  } else {
    col = printColor(v_uv, m, L, u_exposure * u_adj);
  }
  o = vec4(col, 1.0);
}`;

  return {
    margin: 0.08,
    idealExposure: 1.0,
    maxExposure: 2.4,
    exposureRate: 0.22,
    exposureScale: opts.meta.exposureMinutes,
    exposureUnit: 'min of sun',
    ...opts.meta,
    fragment,
    stages: opts.stages,
  };
}
