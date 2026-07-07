// Anthotype, 1842. An image bleached into plant juice by weeks of sun.

import { NOISE, PAPER, LUMA, IMAGE_SAMPLE } from '../engine/glsl.js';

const FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;

uniform vec2  u_res;
uniform sampler2D u_mask;
uniform float u_stage;     // 1 positive, 2 coat, 3 expose, 4 unframe, 5 result
uniform float u_exposure;
uniform float u_wash;
uniform float u_time;
uniform float u_contrast;
uniform float u_tone;      // -1 spinach .. 0 beetroot .. 1 turmeric
uniform float u_adj;

${NOISE}
${LUMA}
${PAPER}
${IMAGE_SAMPLE}

vec3 dyeColor(vec2 uv) {
  vec3 dye = vec3(0.44, 0.13, 0.22);                     // beetroot
  dye = mix(dye, vec3(0.66, 0.47, 0.10), max(u_tone, 0.0));  // turmeric
  dye = mix(dye, vec3(0.30, 0.38, 0.17), max(-u_tone, 0.0)); // spinach
  dye *= 0.92 + 0.16 * fbm(uv * 26.0); // juice never coats evenly
  return dye;
}

// The sun bleaches the dye wherever the positive lets light through.
float bleachAt(float L, float E) {
  float light = (L < 0.0) ? 1.0 : L;
  float b = 1.0 - exp(-E * light * 2.0);
  b = clamp((b - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  b += (vnoise(gl_FragCoord.xy * 0.6) - 0.5) * 0.05;
  return clamp(b, 0.0, 1.0);
}

vec3 printColor(vec2 uv, float m, float L, float E) {
  vec3 paper = paperColor(uv, vec3(0.93, 0.90, 0.83), 1.2);
  if (m < 0.01) return paper;
  vec3 dyed = mix(paper, dyeColor(uv), clamp(m * 1.05, 0.0, 0.95));
  return mix(dyed, paper, bleachAt(L, E) * smoothstep(0.02, 0.35, m));
}

// The contact frame's glass, before it is opened.
vec3 glassOver(vec2 uv, vec3 col) {
  float glare = exp(-pow((uv.x + uv.y - 0.9) * 2.2, 2.0)) * 0.10;
  return col * 1.02 + vec3(glare);
}

// The transparency: an anthotype needs a positive, not a negative.
vec3 positiveView(vec2 uv, float L) {
  vec3 bg = vec3(0.065, 0.07, 0.085) * (0.9 + 0.2 * fbm(uv * 300.0));
  vec2 e = vec2(u_margin * 0.55);
  bool onFilm = uv.x > e.x && uv.x < 1.0 - e.x && uv.y > e.y && uv.y < 1.0 - e.y;
  if (!onFilm) return bg;
  if (L < 0.0) return vec3(0.10, 0.11, 0.14);
  vec3 col = mix(vec3(0.05, 0.06, 0.10), vec3(0.80, 0.83, 0.88), L);
  col *= 0.96 + 0.08 * fbm(uv * 500.0);
  return col;
}

void main() {
  float m = texture(u_mask, v_uv).r;
  float L = imageLuma(v_uv);
  int s = int(u_stage + 0.5);
  vec3 col;
  if (s == 1) {
    col = positiveView(v_uv, L);
  } else if (s == 2) {
    col = printColor(v_uv, m, L, 0.0);
  } else if (s == 3) {
    col = glassOver(v_uv, printColor(v_uv, m, L, u_exposure));
  } else if (s == 4) {
    float front = u_wash * 1.2 - 0.1;
    float edge = fbm(vec2(v_uv.x * 5.0, 3.7)) * 0.06;
    float lifted = smoothstep(front + 0.02, front - 0.06, v_uv.y - edge);
    vec3 under = glassOver(v_uv, printColor(v_uv, m, L, u_exposure));
    col = mix(under, printColor(v_uv, m, L, u_exposure), lifted);
  } else {
    col = printColor(v_uv, m, L, u_exposure * u_adj);
  }
  o = vec4(col, 1.0);
}`;

export default {
  id: 'anthotype',
  name: 'Anthotype',
  year: 1842,
  inventor: 'Sir John Herschel',
  family: 'Plant and experimental',
  blurb:
    'Crushed petals, berries or leaves, painted onto paper and bleached by weeks ' +
    'of sun under a positive. Nothing fixes an anthotype: the same light that ' +
    'made it will, eventually, take it back.',

  margin: 0.08,
  idealExposure: 1.0,
  maxExposure: 2.4,
  exposureRate: 0.22,
  exposureScale: 14,
  exposureUnit: 'days of sun',
  fragment: FRAG,

  remarks: {
    fine: 'Weeks of sun, and the flower gave up its colour exactly where you asked.',
    over: 'Bleached past the picture. The garden worked for nothing.',
    pale: 'The juice barely noticed the sun. Patience is the whole recipe here.',
  },

  stages: [
    {
      id: 'upload',
      title: 'Photograph',
      caption:
        'Choose a photograph. Everything happens on your device. ' +
        'The image is never uploaded anywhere.',
    },
    {
      id: 'negative',
      title: 'Positive',
      caption:
        'The anthotype works backwards from every other contact print: light ' +
        '<strong>bleaches</strong> the colour away, so the transparency must be ' +
        'a positive. Bright sky, clear film.',
      next: 'Coat the paper',
    },
    {
      id: 'coat',
      title: 'Coat',
      caption:
        'Brush the juice across the paper: beetroot today, though spinach or ' +
        'turmeric would do. Whatever the garden has. Two or three coats, dried ' +
        'in the dark between each.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold, and be patient: this exposure is measured in ' +
        '<strong>days</strong>, sometimes weeks, the frame chasing the sun ' +
        'across a windowsill. The colour thins wherever the light gets through.',
      next: 'Open the frame',
    },
    {
      id: 'wash',
      title: 'Unframe',
      caption:
        'There is no developer and no fixer. Lift the glass, peel the positive ' +
        'away, and the print is simply finished, as finished as it will ever be.',
      next: 'Lift the glass',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'An anthotype. Keep it in a drawer and show it rarely: the sun that drew ' +
        'it is still hungry. The toning slider reaches for other plants.',
    },
  ],
};
