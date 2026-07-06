// Cyanotype, 1842. The reference implementation for the process engine.
// A process module = metadata + stage definitions + one fragment shader.

import { NOISE, PAPER, LUMA, IMAGE_SAMPLE } from '../engine/glsl.js';

const FRAG = `#version 300 es
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
uniform float u_tone;      // -1 violet .. 0 prussian .. 1 teal
uniform float u_adj;       // result exposure fine-tune multiplier

${NOISE}
${LUMA}
${PAPER}
${IMAGE_SAMPLE}

// Light through the negative: bright subjects block UV, shadows pass it.
float lightAt(float L) {
  return (L < 0.0) ? 1.0 : (1.0 - L);
}

// Ferric ammonium citrate + potassium ferricyanide, printed out.
vec3 printColor(vec2 uv, float m, float L, float E) {
  vec3 paper = paperColor(uv, vec3(0.94, 0.92, 0.86));
  if (m < 0.01) return paper;
  float x = E * lightAt(L) * 2.6;
  float d = 1.0 - exp(-x);
  d = clamp((d - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  d = pow(d, 1.05);
  d += (vnoise(uv * u_res * 0.7) - 0.5) * 0.04;
  d = clamp(d, 0.0, 1.0) * smoothstep(0.02, 0.35, m);
  vec3 deep = vec3(0.05, 0.12, 0.31);
  deep = mix(deep, vec3(0.03, 0.17, 0.29), max(u_tone, 0.0));
  deep = mix(deep, vec3(0.11, 0.08, 0.31), max(-u_tone, 0.0));
  vec3 col = mix(paper, deep, d);
  float bronze = smoothstep(2.8, 5.0, x);
  col = mix(col, vec3(0.38, 0.33, 0.26), bronze * 0.45);
  return col;
}

// Coated (and possibly exposing) paper, before the wash.
vec3 sensitizedColor(vec2 uv, float m, float L, float E) {
  vec3 paper = paperColor(uv, vec3(0.94, 0.92, 0.86));
  vec3 sens = paper * vec3(0.86, 0.90, 0.62);
  vec3 col = mix(paper, sens, clamp(m * 1.1, 0.0, 0.9));
  if (m < 0.01 || E <= 0.0) return col;
  float x = E * lightAt(L) * 2.6;
  float d = 1.0 - exp(-x);
  vec3 slate = vec3(0.34, 0.38, 0.44);
  vec3 deepSlate = vec3(0.21, 0.25, 0.33);
  vec3 printed = mix(slate, deepSlate, clamp(d * 1.2 - 0.4, 0.0, 1.0));
  col = mix(col, printed, clamp(d * 1.25, 0.0, 1.0) * smoothstep(0.02, 0.35, m));
  float bronze = smoothstep(2.4, 4.2, x);
  col = mix(col, vec3(0.42, 0.36, 0.27), bronze * 0.5);
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

export default {
  id: 'cyanotype',
  name: 'Cyanotype',
  year: 1842,
  inventor: 'Sir John Herschel',
  family: 'Iron and light',
  blurb:
    'Two iron salts, brushed onto paper, turn Prussian blue wherever ultraviolet light ' +
    'reaches them. Herschel devised the chemistry in 1842; Anna Atkins used it a year ' +
    'later to print the first book illustrated by photography.',

  // Engine parameters
  margin: 0.08,          // image inset on the paper
  idealExposure: 1.0,    // exposure units at the meter's ideal mark
  maxExposure: 2.4,
  exposureRate: 0.22,    // units per second while the sun button is held
  exposureMinutes: 12,   // real-world minutes represented by ideal exposure
  fragment: FRAG,

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
      title: 'Negative',
      caption:
        'A cyanotype is a contact print: the paper only darkens where light passes ' +
        'through. So the image must first become a <strong>negative</strong>, dark ' +
        'where the world was bright.',
      next: 'Coat the paper',
    },
    {
      id: 'coat',
      title: 'Coat',
      caption:
        'Brush the sensitizer across the paper. Work in dim light: the yellow-green ' +
        'iron salts are already listening for the sun. Where you do not coat, ' +
        'nothing will print.',
      next: 'Into the sun',
    },
    {
      id: 'expose',
      title: 'Expose',
      caption:
        'Press and hold to leave the print in the sun. Watch the coated paper turn ' +
        'from green to slate blue. Too little and the print will wash away pale; ' +
        'too long and the shadows bronze over.',
      next: 'Wash',
    },
    {
      id: 'wash',
      title: 'Wash',
      caption:
        'Plain water is the developer and the fixer at once. The unexposed salts ' +
        'rinse away, and the exposed iron settles into Prussian blue.',
      next: 'Wash the print',
    },
    {
      id: 'result',
      title: 'Print',
      caption:
        'A cyanotype. The blue will keep deepening for a day as it oxidizes; ' +
        'here you may deepen it yourself.',
    },
  ],
};
