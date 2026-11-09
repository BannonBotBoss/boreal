/**
 * Coat colour written over the lit fragment so the noon sun cannot clip it to white.
 * The mama stays grizzled: a dark saddle, tawny underside, and a small warm rim.
 * A pup keeps that scene brightness and the sculpt of the body: the light turns
 * around the head, ears and legs, the back is darker, the belly is lighter.
 * A moonlit rim is only a thin edge. Neither coat uses an emissive fill.
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
float wrap = clamp(dot(nrm, normalize(vec3(-0.25, 0.72, 0.45))), 0.0, 1.0);
vec3 back = vec3(0.22, 0.12, 0.06);
vec3 belly = vec3(0.42, 0.26, 0.14);
vec3 tabby = mix(belly, back, smoothstep(0.18, 0.84, agoutiUp));
// The vertex colour is the sculpt: muzzle, ear, belly, leg. The wrap turns with the normal.
vec3 coat = mix(diffuseColor.rgb, tabby, 0.62);
coat *= 0.48 + 0.95 * wrap;
// outgoingLight still carries the sun. Keep its shape (form) and the #316 brightness (shade).
vec3 light = outgoingLight / max(diffuseColor.rgb, vec3(0.05));
float lum = max(dot(light, vec3(0.2126, 0.7152, 0.0722)), 0.001);
vec3 form = mix(vec3(1.0), light / lum, 0.82);
float shade = sqrt(clamp(lum, 0.14, 1.4));
coat *= shade * form;
float moonRim = pow(1.0 - clamp(dot(nrm, normalize(vViewPosition)), 0.0, 1.0), 3.2);
coat += moonRim * vec3(0.50, 0.58, 0.68) * 0.02;
// Wool. A four-week gray wolf is not a smooth tan solid (Mech and Boitani 2003,
// Wolves: Behavior, Ecology and Conservation, pups emerge from the den woolly).
// Bands follow the body so the coat reads at the distance the litter is drawn.
float furBand = 0.5 + 0.5 * sin(vPupLocal.y * 70.0 + vPupLocal.z * 22.0);
float furStrand = 0.5 + 0.5 * sin(vPupLocal.x * 55.0 + vPupLocal.y * 16.0);
coat *= mix(0.45, 1.22, furBand);
coat *= mix(0.78, 1.12, furStrand);
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
    if (kind === 'pup') {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPupLocal;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPupLocal = transformed;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPupLocal;');
    }
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `#include <opaque_fragment>\n${chunk}`);
  };
}
