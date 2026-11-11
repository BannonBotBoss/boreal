/**
 * Aerial cover exemplars for the 400–2000 m band.
 *
 * Proland and flight sims keep the elevation and the land-cover weights, and take colour from a
 * small set of real aerial photographs, one per cover. These four are samples of boreal canopy,
 * fen, shore, and open water. They are not a map of 52 N, 97 W.
 *
 * Repeats are hidden by Deliot and Heitz, GPU Zen 2 (2019), via tilingBlend.glsl.ts.
 * Source and licence: public/aerial/CREDITS.md. Ground sample distance is about 1.6 m
 * (USGS Imagery Only / NAIP, zoom 16). One 128 px crop is uExMetres of world.
 */
import * as THREE from 'three';
import { asset } from '../../core/asset';

export const AERIAL_EXEMPLAR = {
  /** Metres of ground across one 128 px crop. Set again from public/aerial/meta.json when it loads. */
  metres: 205,
  /**
   * NAIP sRGB green ~110 is linear ~0.16. The globe sun is intensity 3.2 and Lambert divides by π,
   * so an albedo near the daylight stand table (landMosaic OVERHEAD_STAND, a few percent to ~0.2)
   * is what tone-maps into the EOX frame. 2.5 is the value that put the 2000 m still near that
   * tile's brightness. It is a uniform so a still can change it without a rebuild.
   */
  gain: 2.5,
};

function dataTexture(repeat: boolean) {
  const tex = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = repeat ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.generateMipmaps = repeat;
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  tex.needsUpdate = true;
  return tex;
}

export const AERIAL = {
  uExCanopy: { value: dataTexture(true) },
  uExFen: { value: dataTexture(true) },
  uExShore: { value: dataTexture(true) },
  uExWater: { value: dataTexture(true) },
  uExLut: { value: dataTexture(false) },
  uExOn: { value: 0 },
  uExMetres: { value: AERIAL_EXEMPLAR.metres },
  uExGain: { value: AERIAL_EXEMPLAR.gain },
  /** 1 while overhead impostors cover this view. The tiled canopy photo is replaced by a smooth floor. */
  uCrownFloor: { value: 0 },
};

const READY = 'aerial-exemplars';

function adopt(slot: { value: THREE.Texture }, tex: THREE.Texture, repeat: boolean) {
  tex.colorSpace = THREE.NoColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = repeat ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.generateMipmaps = repeat;
  tex.wrapS = tex.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.flipY = true;
  tex.needsUpdate = true;
  slot.value.dispose();
  slot.value = tex;
}

/** Load the four Gaussian exemplars and the lookup table. Safe to call once from the globe view. */
export function loadAerialExemplars() {
  const g = globalThis as { __aerial?: typeof AERIAL; __aerialReady?: boolean };
  g.__aerial = AERIAL;
  if (g.__aerialReady) return;
  const loader = new THREE.TextureLoader();
  const files: [keyof typeof AERIAL, string, boolean][] = [
    ['uExCanopy', 'aerial/canopy.png', true],
    ['uExFen', 'aerial/fen.png', true],
    ['uExShore', 'aerial/shore.png', true],
    ['uExWater', 'aerial/water.png', true],
    ['uExLut', 'aerial/lut.png', false],
  ];
  let left = files.length;
  const done = () => {
    if (--left > 0) return;
    AERIAL.uExOn.value = 1;
    g.__aerialReady = true;
    console.log(READY);
  };
  for (const [slot, file, repeat] of files) {
    loader.load(asset(file), tex => { adopt(AERIAL[slot] as { value: THREE.Texture }, tex, repeat); done(); }, undefined, () => { console.warn(`aerial exemplar missing: ${file}`); done(); });
  }
  fetch(asset('aerial/meta.json')).then(r => r.ok ? r.json() : null).then(meta => {
    const metres = Number(meta?.metres);
    if (metres > 1) AERIAL.uExMetres.value = metres;
  }).catch(() => { /* the compiled default stands */ });
}
