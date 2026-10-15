import * as THREE from 'three';

/**
 * Procedural fur by shell texturing: the body is drawn once opaque, then a few more times, each copy pushed
 * a little further out along the surface normal. Each copy keeps only some strands, chosen by hashing the
 * body-fixed rest position, so strands stay glued to the animal as it moves. No image files. Outer shells fade
 * out with distance, so far-away animals cost one draw. Method: NVIDIA "Shells and Fins"; Godot shell-fur example.
 */
export const FUR_SHELLS = 6;
/** Fur length in model units (the wolf is 0.5 tall before it is scaled up to real size). */
export const FUR_LENGTH = .016;

const NOISE = /* glsl */`
float hash3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

const COLOUR = /* glsl */`
{
  // Strands run head→tail on the body (flow 0) and down the legs (flow 1); cells are stretched along that way.
  const float FR = 230.0;
  vec3 q = mix(vec3(vRest.x * FR, vRest.y * FR, vRest.z * FR * 0.22), vec3(vRest.x * FR, vRest.y * FR * 0.22, vRest.z * FR), vFlow);
  vec2 cross = fract(vFlow > 0.5 ? q.xz : q.xy) - 0.5;            // position across the strand
  float fade = 1.0 - smoothstep(5.0, 12.0, length(vViewPosition));   // outer shells thin out with distance
  float strand = hash3(floor(q));
  // Each strand is a disc that narrows toward its tip; short strands drop out first.
  float width = mix(0.5, 0.26, uShell) * (0.65 + 0.35 * strand);
  if (uShell > 0.0 && (strand < uShell * 0.6 || length(cross) > width || uShell > fade)) discard;
  float tone = 0.82 + 0.36 * hash3(floor(q * 0.5) + 3.0);          // strand-to-strand variation
  float darkPatch = smoothstep(0.55, 0.8, vnoise(vRest * 38.0));      // darker guard-hair patches
  vec3 c = diffuseColor.rgb * tone * mix(1.0, 0.72, darkPatch);
  // Root is shaded (dense undercoat); tips catch the light and the pale band of each guard hair.
  c *= mix(0.5, 0.92, uShell);
  c = mix(c, c * 1.22 + 0.015, uShell * (0.3 + 0.7 * hash3(floor(q * 0.5) + 9.0)));
  diffuseColor.rgb = c;
}`;

const RIM = /* glsl */`
{
  float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  totalEmissiveRadiance += diffuseColor.rgb * rim * (0.04 + 0.08 * uShell);
}`;

export function furMaterial(shell: number, shells = FUR_SHELLS, length = FUR_LENGTH) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 });
  const uShell = { value: shells ? shell / shells : 0 }, uLen = { value: length };
  material.onBeforeCompile = shader => {
    shader.uniforms.uShell = uShell; shader.uniforms.uLen = uLen;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aRest; attribute float aFlow; attribute float aFur;\nvarying vec3 vRest; varying float vFlow;\nuniform float uShell, uLen;')
      .replace('#include <skinning_vertex>', '#include <skinning_vertex>\nvRest = aRest; vFlow = aFlow;\ntransformed += normalize(objectNormal) * uShell * uLen * aFur;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest; varying float vFlow;\nuniform float uShell;\n' + NOISE)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + COLOUR)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + RIM);
  };
  // One compiled program serves every shell (they differ only in uniforms).
  material.customProgramCacheKey = () => 'fur-shell';
  return material;
}
