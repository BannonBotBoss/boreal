/** Shared GLSL snippets (Grok Bot): the ONE shader hash; every shader that needs noise builds on it. */
export const GLSL_HASH = 'float hash2s(vec2 p, float s) { return fract(sin(dot(p, vec2(127.1, 311.7)) + s) * 43758.5453); }';
/** Value noise + fBm over `hash2s` (seeded). Used by the sky clouds and the procedural PBR surfaces (render/pbr.ts). */
export const GLSL_NOISE = `${GLSL_HASH}
float vnoise(vec2 p, float s) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2s(i, s), hash2s(i + vec2(1, 0), s), u.x), mix(hash2s(i + vec2(0, 1), s), hash2s(i + vec2(1, 1), s), u.x), u.y);
}
// integer lattice hash: bit-exact for a cell id however the compiler folds the corner lookups (hash2s amplifies one
// float rounding step ~4e4 times, which ANGLE/D3D's unrolled, reassociated code hits at lattice lines: seams, specks)
float hash2u(vec2 c, float s) { uvec2 q = uvec2(ivec2(c)) * uvec2(1597334673u, 3812015801u); uint n = (q.x ^ q.y ^ floatBitsToUint(s)) * 1597334673u;
  n ^= n >> 16; n *= 0x7feb352du; n ^= n >> 15; return float(n) * (1.0 / 4294967295.0); }
float vnoiseU(vec2 p, float s) { // vnoise on hash2u: seamless at every lattice line
  vec2 i = floor(p), f = p - i, u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2u(i, s), hash2u(i + vec2(1, 0), s), u.x), mix(hash2u(i + vec2(0, 1), s), hash2u(i + vec2(1, 1), s), u.x), u.y);
}
float fbm(vec2 p, float s) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p, s); p = p * 2.03 + 17.1; a *= 0.5; } return v; }`;
