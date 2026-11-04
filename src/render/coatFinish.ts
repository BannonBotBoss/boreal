/**
 * A grizzled coat read on top of the existing skin. The saddle darkens where the
 * normal faces up, the legs and belly stay tawny, and a soft rim catches the fur
 * edge. This does not touch emissive, so the night coat still dims with the clock.
 */
import type * as THREE from 'three';

const CHUNK = `
float agoutiUp = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
float agoutiRim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.5);
vec3 agouti = gl_FragColor.rgb;
agouti = mix(agouti, agouti * vec3(0.18, 0.14, 0.11), smoothstep(0.42, 0.88, agoutiUp) * 0.72);
agouti = mix(agouti, mix(agouti, vec3(0.62, 0.40, 0.18), 0.45), smoothstep(0.5, 0.12, agoutiUp) * 0.4);
agouti += agoutiRim * vec3(0.85, 0.62, 0.36) * 0.28;
gl_FragColor.rgb = agouti;
`;

/** Warm rim and saddle on a standard material. Safe to call once per material. */
export function finishAnimalCoat(material: THREE.Material) {
  const m = material as THREE.MeshStandardMaterial & { onBeforeCompile?: THREE.Material['onBeforeCompile'] };
  if (!m || m.userData.coatFinish) return;
  m.userData.coatFinish = true;
  if (typeof m.roughness === 'number') m.roughness = Math.min(m.roughness, 0.82);
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) {
    prev?.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${CHUNK}`);
  };
}
