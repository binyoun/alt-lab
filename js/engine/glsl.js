// Shared GLSL chunks used by process shaders.

export const NOISE = `
float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * vnoise(p);
    p = p * 2.13 + 17.7;
    a *= 0.5;
  }
  return v;
}`;

// Paper with visible fiber: long horizontal grain plus fine tooth.
export const PAPER = `
vec3 paperColor(vec2 uv, vec3 base) {
  float fiber = fbm(uv * vec2(180.0, 60.0)) * 0.5 + fbm(uv * 700.0) * 0.5;
  float shade = 1.0 - (fiber - 0.5) * 0.10;
  float vig = 1.0 - 0.12 * pow(distance(uv, vec2(0.5)) * 1.4, 2.0);
  return base * shade * vig;
}`;

export const LUMA = `
float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}`;

// Maps print uv to image uv given margins; returns luminance of the
// uploaded photo, or -1.0 outside the image area.
export const IMAGE_SAMPLE = `
uniform sampler2D u_image;
uniform float u_margin;
float imageLuma(vec2 uv) {
  vec2 iuv = (uv - vec2(u_margin)) / (1.0 - 2.0 * u_margin);
  if (iuv.x < 0.0 || iuv.x > 1.0 || iuv.y < 0.0 || iuv.y > 1.0) return -1.0;
  return luma(texture(u_image, iuv).rgb);
}`;
