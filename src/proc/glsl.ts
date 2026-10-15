/** Shared GLSL snippets (Grok Bot): the ONE shader hash; every shader that needs noise builds on it. */
export const GLSL_HASH = 'float hash2s(vec2 p, float s) { return fract(sin(dot(p, vec2(127.1, 311.7)) + s) * 43758.5453); }';
/** Value noise + fBm over `hash2s` (seeded). Used by the sky clouds and the procedural PBR surfaces (render/pbr.ts). */
export const GLSL_NOISE = `${GLSL_HASH}
float vnoise(vec2 p, float s) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2s(i, s), hash2s(i + vec2(1, 0), s), u.x), mix(hash2s(i + vec2(0, 1), s), hash2s(i + vec2(1, 1), s), u.x), u.y);
}
float fbm(vec2 p, float s) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p, s); p = p * 2.03 + 17.1; a *= 0.5; } return v; }`;
