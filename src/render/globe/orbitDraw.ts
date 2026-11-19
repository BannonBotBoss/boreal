/**
 * Orbit disc shader and the browser upload of the cover bake.
 * Colour decisions stay in orbitCover.ts. This file only draws.
 */
import * as THREE from 'three';
import { buildOrbitCover } from './orbitCover';
import { loadOrbitVegetation } from './orbitVeg';

export function orbitFrag(cloudAlbedo: number, invTau: string, invPi: string) {
  return `
  if (uOrbit > 0.001) {
    vec3 od = normalize(vDetW + uCamP);
    vec2 ouv = vec2(atan(od.z, od.x) * ${invTau} + 0.5, asin(clamp(od.y, -1.0, 1.0)) * ${invPi} + 0.5);
    float ow = clamp(uOrbit, 0.0, 1.0) * presentW;
    vec4 alb = texture2D(uOrbitTex, ouv);
    diffuseColor.rgb = mix(diffuseColor.rgb, alb.rgb, ow);
    // Alpha is the open-ocean mask (0 ocean, 1 land or enclosed lake). The coarse
    // mesh still treats the Caspian depression as ocean, and the later Fresnel,
    // roughness and metalness reads use landMask. Pull that mask from the map.
    landMask = mix(landMask, alb.a, ow);
    if (uOrbitDeck > 0.5) {
      float c = texture2D(uOrbitCloud, ouv).r;
      float deck = smoothstep(0.08, 0.55, c);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${cloudAlbedo.toFixed(2)}), deck * ow);
    }
  }`;
}

let coverUploaded = false;
/** Browser upload of the cover map. Node tests call buildOrbitCover directly. */
export function uploadOrbitAlbedo(slot: { value: THREE.Texture }, empty: THREE.Texture) {
  if (coverUploaded || typeof document === 'undefined') return;
  coverUploaded = true;
  void loadOrbitVegetation().then(() => {
    const map = buildOrbitCover();
    const tex = new THREE.DataTexture(map.rgba, map.width, map.height);
    tex.colorSpace = THREE.NoColorSpace;
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    const prev = slot.value;
    slot.value = tex;
    if (prev && prev !== empty) prev.dispose();
    (window as unknown as { __orbitCover?: boolean }).__orbitCover = true;
  });
}
