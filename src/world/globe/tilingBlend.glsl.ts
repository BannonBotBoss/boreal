/**
 * Runtime of "Procedural Stochastic Textures by Tiling and Blending",
 * Thomas Deliot and Eric Heitz, GPU Zen 2, 2019.
 *
 * Ported from GaussianBlend.cginc and BlendDemo.shader in
 * https://github.com/Error-mdl/UnityGaussianTex (BSD-3-Clause, Copyright (c) 2021, Error-mdl).
 * The triangle-grid offsets, barycentric weights, and variance-preserving blend are that code.
 * HLSL `float2x2` is row-major; the `mat2` literals below are the GLSL column-major equivalent,
 * so `mat2 * uv` matches `mul(M, uv)`. No `out` parameters: this compiles as GLSL ES 3.00 and as
 * the WebGL1 path three still accepts.
 *
 * Each exemplar is stored as a per-channel Gaussian (mean 0.5) plus a 256×4 sRGB lookup table,
 * one row per cover. That is the chapter's 1D histogram transform (three independent channels,
 * no eigen colours). The bake is tools/bake-aerial-exemplars.py.
 */
export const TILING_BLEND_GLSL = `
const float TB_SQRT3 = 1.732050808;
const float TB_TAN30 = 0.577350269;
const float TB_TWO_TAN30 = 1.154700538;

vec2 tbHash2(vec2 p) {
  return fract(sin(mat2(137.231, 199.137, 512.37, 373.351) * p) * 23597.3733);
}

vec3 tbBlend3(vec3 g1, vec3 g2, vec3 g3, vec3 w) {
  vec3 g = ((w.x * g1 + w.y * g2 + w.z * g3 - vec3(0.5)) / sqrt(dot(w, w))) + vec3(0.5);
  return clamp(g, 0.0, 1.0);
}

vec3 tbSrgbToLin(vec3 c) {
  vec3 lo = c / 12.92;
  vec3 hi = pow((c + 0.055) / 1.055, vec3(2.4));
  return mix(lo, hi, step(vec3(0.04045), c));
}

vec3 tbLut(sampler2D lut, float layer, vec3 g) {
  float y = 1.0 - (layer + 0.5) / 4.0;
  return tbSrgbToLin(vec3(
    texture2D(lut, vec2(g.r, y)).r,
    texture2D(lut, vec2(g.g, y)).g,
    texture2D(lut, vec2(g.b, y)).b));
}

/** One tap through the same lookup. The three-offset blend is for a repeat you can see.
 *  A 1024 m canopy already fills a 400–800 m frame, and blending three offsets turns crowns into speckle. */
vec3 tbSampleOne(sampler2D tex, sampler2D lut, float layer, vec2 uv, float lod) {
  return tbLut(lut, layer, textureLod(tex, uv, lod).rgb);
}

vec3 tbSample(sampler2D tex, sampler2D lut, float layer, vec2 uv, float lod) {
  mat2 sheared = mat2(-TB_TAN30, TB_TWO_TAN30, 1.0, 0.0);
  vec2 s = sheared * (uv * TB_SQRT3);
  vec2 iuv = floor(s);
  vec2 fuv = fract(s);
  float third = 1.0 - fuv.x - fuv.y;
  vec2 v0 = third > 0.0 ? vec2(0.0) : vec2(1.0);
  vec2 h0 = tbHash2(iuv + v0);
  vec2 h1 = tbHash2(iuv + vec2(0.0, 1.0));
  vec2 h2 = tbHash2(iuv + vec2(1.0, 0.0));
  vec3 w = third > 0.0 ? vec3(third, fuv.y, fuv.x) : vec3(-third, 1.0 - fuv.x, 1.0 - fuv.y);
  // Square the barycentric weights so the blend stays near one sample. The raw weights
  // (Error-mdl RandomOffsetTiling) left a diagonal brightness wave on this canopy.
  w = w * w;
  w /= max(w.x + w.y + w.z, 1e-4);
  vec3 g = tbBlend3(textureLod(tex, uv + h0, lod).rgb, textureLod(tex, uv + h1, lod).rgb, textureLod(tex, uv + h2, lod).rgb, w);
  return tbLut(lut, layer, g);
}
`;
