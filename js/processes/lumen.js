// Lumen print. Expired photo paper, sunlight, and whatever the garden gives.

import { NOISE, PAPER, LUMA, IMAGE_SAMPLE } from '../engine/glsl.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;

uniform vec2  u_res;
uniform sampler2D u_mask;  // laid botanicals blocking the light
uniform float u_stage;     // 1 lay, 2 expose, 3 fix, 4 result
uniform float u_exposure;
uniform float u_wash;
uniform float u_time;
uniform float u_contrast;
uniform float u_tone;      // -1 pink .. 1 amber
uniform float u_adj;

${NOISE}
${LUMA}
${PAPER}
${IMAGE_SAMPLE}

// Sunlight through the transparency, blocked by whatever lies on the paper.
float lightAt(vec2 uv, float m, float L) {
  float through = (L < 0.0) ? 1.0 : L;
  return through * (1.0 - smoothstep(0.15, 0.75, m));
}

// The slow print-out colours of gelatin silver paper left in the sun.
vec3 lumenColor(vec2 uv, float m, float L, float E) {
  vec3 paper = paperColor(uv, vec3(0.89, 0.87, 0.82), 0.5);
  float e = E * lightAt(uv, m, L);
  float d = 1.0 - exp(-e * 2.0);
  d = clamp((d - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  d += (vnoise(gl_FragCoord.xy * 0.6) - 0.5) * 0.04;
  d = clamp(d, 0.0, 1.0);
  vec3 col = mix(paper, vec3(0.79, 0.60, 0.52), smoothstep(0.0, 0.45, d));
  col = mix(col, vec3(0.52, 0.33, 0.31), smoothstep(0.40, 0.80, d));
  col = mix(col, vec3(0.32, 0.20, 0.22), smoothstep(0.75, 1.0, d));
  col = mix(col, col * vec3(1.06, 0.99, 0.88), max(u_tone, 0.0));
  col = mix(col, col * vec3(1.02, 0.96, 1.04), max(-u_tone, 0.0));
  // moisture creeps out from under the botanicals
  float halo = smoothstep(0.10, 0.45, m) * (1.0 - smoothstep(0.45, 0.85, m));
  col = mix(col, vec3(0.60, 0.48, 0.38), halo * 0.30 * step(0.05, E));
  // the sheltered paper under the objects, silvery and faintly mauve
  col = mix(col, vec3(0.88, 0.86, 0.87), smoothstep(0.60, 0.95, m));
  return col;
}

// After the hypo: the wild colour calms toward amber and cream.
vec3 fixedColor(vec2 uv, float m, float L, float E) {
  vec3 col = lumenColor(uv, m, L, E);
  return col * vec3(1.07, 1.00, 0.86) * 1.06;
}

// The botanicals themselves, still lying on the paper.
vec3 withObjects(vec2 uv, float m, vec3 col) {
  vec3 leaf = vec3(0.33, 0.38, 0.20) * (0.8 + 0.4 * fbm(uv * 60.0));
  return mix(col, leaf, smoothstep(0.35, 0.85, m));
}

void main() {
  float m = texture(u_mask, v_uv).r;
  float L = imageLuma(v_uv);
  int s = int(u_stage + 0.5);
  vec3 col;
  if (s == 1) {
    col = withObjects(v_uv, m, lumenColor(v_uv, m, L, 0.0));
  } else if (s == 2) {
    col = withObjects(v_uv, m, lumenColor(v_uv, m, L, u_exposure));
  } else if (s == 3) {
    float front = u_wash * 1.2 - 0.1;
    float edge = fbm(vec2(v_uv.x * 6.0, u_time * 0.4)) * 0.07;
    float done = smoothstep(front + 0.02, front - 0.07, v_uv.y - edge);
    vec3 before = withObjects(v_uv, m, lumenColor(v_uv, m, L, u_exposure));
    col = mix(before, fixedColor(v_uv, m, L, u_exposure), done);
  } else {
    col = fixedColor(v_uv, m, L, u_exposure * u_adj);
  }
  o = vec4(col, 1.0);
}`;

export default {
  id: 'lumen',
  name: 'Lumen print',
  year: 'today',
  inventor: 'anonymous experimenters',
  family: 'Plant and experimental',
  blurb:
    'Take photographic paper, preferably old and expired, lay something on it, ' +
    'and leave it in the sun for an afternoon. The silver prints out in pinks ' +
    'and rusts no developer would ever give. Fix it and lose half the colour, ' +
    'or scan it quickly and let it keep changing.',

  margin: 0.05,
  idealExposure: 1.0,
  maxExposure: 2.4,
  exposureRate: 0.22,
  exposureScale: 6,
  exposureUnit: 'hours of sun',
  brushMode: 'leaf',
  fragment: FRAG,

  remarks: {
    fine: 'The paper remembered more than it was told. Fix it quickly or love it briefly.',
    over: 'Cooked to plum jam. Even expired silver deserves better.',
    pale: 'Hardly an afternoon of sun. Leave it out; the paper has nowhere to be.',
  },

  stages: [
    {
      id: 'upload',
      title: 'Photograph',
      caption:
        'Choose a photograph; it becomes the transparency lying on the paper. ' +
        'Everything happens on your device. The image is never uploaded anywhere.',
    },
    {
      id: 'coat',
      title: 'Lay',
      auto: 'scatter',
      autoLabel: 'Scatter some leaves',
      minCoverage: 0,
      caption:
        'The photo paper is already made; this process begins in the garden. ' +
        'Tap or drag to lay leaves and stems over the transparency, or scatter ' +
        'a handful. Bare paper is fine too: the photograph alone will print.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold. An afternoon, a day. Where the sun reaches the paper it ' +
        'blooms peach, then rust, then plum; under the leaves it stays silver, ' +
        'and their dampness draws halos.',
      next: 'Fix',
    },
    {
      id: 'wash',
      title: 'Fix',
      caption:
        'The dilemma of every lumen printer: hypo makes it permanent but steals ' +
        'the wildest colour, calming everything toward amber. We fix this one.',
      next: 'Fix the print',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'A lumen print, fixed and settled. The silhouettes are the garden; ' +
        'the weather in the background is your photograph.',
    },
  ],
};
