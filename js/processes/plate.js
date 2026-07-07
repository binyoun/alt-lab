// Factory for the plate processes: daguerreotype and tintype.
// Direct positives on metal, exposed in the camera, developed, then
// viewed in raking light (drag across the finished plate to tilt it).
//
// Stage indices for the shader: 1 prepare (paint), 2 expose (hold),
// 3 develop (reveal), 4 result.

import { NOISE, LUMA, IMAGE_SAMPLE } from '../engine/glsl.js';

const v3 = (c) => `vec3(${c.map((n) => n.toFixed(4)).join(', ')})`;

export function buildPlate(opts) {
  const {
    plateDark,        // the plate reflecting nothing
    plateBright,      // the plate catching the light
    deposit,          // the image material: frosted amalgam or collodion silver
    dull,             // the unprepared surface
    tarnish1,         // edge tarnish colours
    tarnish2,
    fogColor,         // overexposure milk
    restingReflect = 0.35, // reflection level before any tilt
    sheen = 0.0,      // varnish sheen band strength (tintype)
    mirrored = true,  // direct positives read left for right
  } = opts.look;

  const fragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;

uniform vec2  u_res;
uniform sampler2D u_mask;
uniform float u_stage;     // 1 prepare, 2 expose, 3 develop, 4 result
uniform float u_exposure;  // accumulated exposure, 1.0 = ideal
uniform float u_wash;      // 0..1 develop progress
uniform float u_time;
uniform float u_contrast;
uniform float u_tone;      // -1 cool .. 1 warm cast on the deposit
uniform float u_adj;
uniform float u_tilt;      // -1..1 raking light direction

${NOISE}
${LUMA}
${IMAGE_SAMPLE}

// The polished surface under a moving light.
vec3 plateBase(vec2 uv, float tilt) {
  float streaks = (fbm(vec2(uv.x * 24.0, uv.y * 420.0)) - 0.5) * 0.10;
  float f = clamp(${restingReflect.toFixed(3)} + 0.55 * tilt
    + 0.18 * tilt * (uv.x - 0.5) + streaks, 0.0, 1.0);
  vec3 col = mix(${v3(plateDark)}, ${v3(plateBright)}, f);
  col += vec3(1.0) * ${sheen.toFixed(3)}
    * exp(-pow((uv.x - (0.5 + tilt * 0.4)) * 3.2, 2.0));
  return col;
}

// How much image material has settled: bright subjects deposit more.
float depositAt(float L, float E) {
  if (L < 0.0) return 0.0;
  float d = 1.0 - exp(-E * L * 2.2);
  d = clamp((d - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  float fog = smoothstep(1.5, 2.8, E) * 0.4; // overexposure turns milky
  d = clamp(d + fog, 0.0, 1.0);
  d += (vnoise(gl_FragCoord.xy * 0.7) - 0.5) * 0.05;
  return clamp(d, 0.0, 1.0);
}

vec3 tarnishEdge(vec2 uv, vec3 col) {
  float b = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  float e = smoothstep(0.09, 0.0, b);
  vec3 t = mix(${v3(tarnish1)}, ${v3(tarnish2)}, fbm(uv * 5.0));
  return mix(col, t, e * (0.5 + 0.35 * fbm(uv * 11.0)));
}

void main() {
  float m = texture(u_mask, v_uv).r;
  float L = imageLuma(vec2(${mirrored ? '1.0 - v_uv.x' : 'v_uv.x'}, v_uv.y));
  int s = int(u_stage + 0.5);
  float tilt = (s == 4) ? u_tilt : 0.0;
  vec3 base = plateBase(v_uv, tilt);
  vec3 raw = ${v3(dull)} * (0.92 + 0.16 * fbm(v_uv * 90.0));
  vec3 col = mix(raw, base, smoothstep(0.05, 0.6, m));

  float E = (s == 4) ? u_exposure * u_adj : u_exposure;
  float d = depositAt(L, E) * smoothstep(0.05, 0.45, m);
  vec3 dep = ${v3(deposit)};
  dep = mix(dep, dep * vec3(1.06, 1.00, 0.92), max(u_tone, 0.0));
  dep = mix(dep, dep * vec3(0.94, 1.00, 1.10), max(-u_tone, 0.0));
  dep = mix(dep, ${v3(fogColor)}, smoothstep(1.5, 2.8, E) * 0.5);

  float rev = 0.0;
  if (s == 2) rev = 0.06; // the latent image, barely a rumour
  if (s == 3) rev = clamp((u_wash * 1.35 - fbm(v_uv * 6.0 + u_time * 0.05)) * 4.0, 0.0, 1.0);
  if (s == 4) rev = 1.0;

  col = mix(col, dep, d * rev);
  if (s >= 3) col = tarnishEdge(v_uv, col);
  o = vec4(col, 1.0);
}`;

  return {
    margin: 0.055,
    idealExposure: 1.0,
    maxExposure: 2.4,
    exposureRate: 0.22,
    exposureScale: opts.meta.exposureSeconds,
    exposureUnit: 'sec in the camera',
    downloadLabel: 'Download the plate',
    tiltResult: true,
    ...opts.meta,
    fragment,
    stages: opts.stages,
  };
}
