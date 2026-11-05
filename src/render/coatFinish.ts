/**
 * Coat colour written over the lit fragment so the sun cannot wash it out.
 * The mama stays grizzled: a dark saddle, tawny underside, and a small warm rim.
 * A pup is an opaque warm tabby — darker on the back, lighter on the belly —
 * held at the same brown at dusk and at night. Neither coat uses an emissive fill.
 */
import type * as THREE from 'three';

const MAMA = `
vec3 nrm = normalize(normal);
float agoutiUp = clamp(nrm.y * 0.5 + 0.5, 0.0, 1.0);
float wrap = clamp(dot(nrm, normalize(vec3(-0.2, 0.86, 0.32))), 0.0, 1.0);
vec3 agouti = diffuseColor.rgb * (0.38 + 0.72 * wrap);
agouti = mix(agouti, agouti * vec3(0.16, 0.12, 0.09), smoothstep(0.32, 0.82, agoutiUp) * 0.88);
agouti = mix(agouti, mix(agouti, vec3(0.46, 0.32, 0.18), 0.42), smoothstep(0.46, 0.08, agoutiUp) * 0.55);
float agoutiRim = pow(1.0 - clamp(dot(nrm, normalize(vViewPosition)), 0.0, 1.0), 2.8);
agouti += agoutiRim * vec3(0.42, 0.36, 0.28) * 0.05;
gl_FragColor.rgb = agouti;
`;

const PUP = `
vec3 nrm = normalize(normal);
float agoutiUp = clamp(nrm.y * 0.5 + 0.5, 0.0, 1.0);
float wrap = clamp(dot(nrm, normalize(vec3(-0.15, 0.88, 0.3))), 0.0, 1.0);
vec3 back = vec3(0.22, 0.12, 0.06);
vec3 belly = vec3(0.42, 0.26, 0.14);
vec3 coat = mix(belly, back, smoothstep(0.26, 0.78, agoutiUp));
coat *= 0.88 + 0.18 * wrap;
gl_FragColor.rgb = coat;
`;

const FOX = `
vec3 nrm = normalize(normal);
float wrap = clamp(dot(nrm, normalize(vec3(0.28, 0.82, 0.38))), 0.0, 1.0);
vec3 fox = diffuseColor.rgb * (0.7 + 0.55 * wrap);
fox.g = min(fox.g, fox.r * 0.28);
fox.b = min(fox.b, fox.r * 0.1);
gl_FragColor.rgb = fox;
`;

/** The stored fox map is pale. Tint it rust and ignore the daylight lamp so the orange survives noon. */
export function finishFoxCoat(material: THREE.Material) {
  const m = material as THREE.MeshStandardMaterial;
  if (!m || m.userData.foxCoat) return;
  m.userData.foxCoat = true;
  m.color.setRGB(1, 0.2, 0.03);
  m.emissive?.setRGB(0, 0, 0);
  m.emissiveIntensity = 0;
  m.emissiveMap = null;
  m.toneMapped = false;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = function (shader, renderer) {
    prev?.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${FOX}`);
  };
}

/** Moonlit rim, and a saddle on the mama. Safe to call once per material. */
export function finishAnimalCoat(material: THREE.Material, kind: 'mama' | 'pup' = 'mama') {
  const m = material as THREE.MeshStandardMaterial & { onBeforeCompile?: THREE.Material['onBeforeCompile'] };
  if (!m || m.userData.coatFinish) return;
  m.userData.coatFinish = true;
  if (typeof m.roughness === 'number') m.roughness = Math.min(m.roughness, 0.86);
  const chunk = kind === 'pup' ? PUP : MAMA;
  const prev = m.onBeforeCompile;
  const prevKey = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => `${prevKey ? prevKey() : 'coat'}|${kind}`;
  m.onBeforeCompile = function (shader, renderer) {
    prev?.call(this, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${chunk}`);
  };
}
