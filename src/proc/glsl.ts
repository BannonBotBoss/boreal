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
/** Worley 1996 F1 (cellular), jittered with the shared hash2u so there is no second hash. 3×3×3 neighbourhood,
 *  the iq voronoi loop (MIT, https://iquilezles.org/articles/smoothvoronoi/) in 3D. One call, not per octave. */
export const GLSL_WORLEY = `
float worleyF1(vec3 p) {
  vec3 ip = floor(p), f = fract(p); float d = 1.0;
  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(
      hash2u(vec2(ip.x + g.x, ip.y + g.y + ip.z * 17.0), 3.1),
      hash2u(vec2(ip.y + g.y, ip.z + g.z + ip.x * 13.0), 5.7),
      hash2u(vec2(ip.z + g.z, ip.x + g.x + ip.y * 19.0), 8.3));
    vec3 r = g + o - f; d = min(d, dot(r, r));
  }
  return sqrt(d);
}`;
/** 3D simplex, Ashima Arts / Stefan Gustavson, webgl-noise, MIT (https://github.com/stegu/webgl-noise). Returns about −1..1. */
export const GLSL_SIMPLEX = `
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute4(vec4 x) { return mod289v4(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt4(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0); const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy)); vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz); vec3 l = 1.0 - g; vec3 i1 = min(g.xyz, l.zxy); vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx; vec3 x2 = x0 - i2 + C.yyy; vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute4(permute4(permute4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857; vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); vec4 x_ = floor(j * ns.z); vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy; vec4 y = y_ * ns.x + ns.yyyy; vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy); vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0; vec4 s1 = floor(b1) * 2.0 + 1.0; vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy; vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x); vec3 p1 = vec3(a0.zw, h.y); vec3 p2 = vec3(a1.xy, h.z); vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt4(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0); m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}`;
