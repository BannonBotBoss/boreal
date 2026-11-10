/**
 * A prairie stem is a feather-grass tuft, not a spruce.
 *
 * Stipa lessingiana culms are 30–60 cm, tufted, with setaceous blades
 * (Flora of China 22, Stipa lessingiana; flowering May–July). The Kazakh
 * steppe at the seeded home is that grass, not black spruce (9–15 m,
 * Viereck & Johnston 1990). The blade is drawn 8 mm wide: a 0.3–0.5 mm
 * blade is sub-pixel, the same calibration as wavy hairgrass in cover.ts.
 *
 * The ribbon is the grass card from the horizon billboards, built on the CPU
 * so a test can measure it. Three crossed cards keep a face toward the eye.
 */
import * as THREE from 'three';
import { CHUNK_SIZE } from '../../core/world';
import { random } from '../../proc/rng';
import { landingContext } from '../landingCast';

/** Culm length, metres. Flora of China 22: 30–60 cm. */
export const STIPA_CULM_M = { min: 0.30, max: 0.60 } as const;

const cache = new Map<string, boolean>();

/** True when the HUD sample at this point is prairie. Cached per chunk. */
export function steppeAt(x: number, z: number) {
  const key = `${Math.floor(x / CHUNK_SIZE)}:${Math.floor(z / CHUNK_SIZE)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const prairie = landingContext(x, z).biome === 'prairie';
  cache.set(key, prairie);
  return prairie;
}

export function clearSteppeCache() { cache.clear(); }
(globalThis as { borealSteppeAt?: (x: number, z: number) => boolean }).borealSteppeAt = steppeAt;

let material: THREE.MeshStandardMaterial | undefined;
function tuftMaterial() {
  if (!material) {
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    material.userData.shared = true;
  }
  return material;
}

/** One tuft. Three crossed cards, so a 40 m eye still sees a clump.
 *  A single 8 mm ribbon is under a pixel at that distance (same reason cover.ts
 *  draws hairgrass wider than the setaceous blade). Card width 0.16 m is the
 *  clump, not the leaf. Height stays inside the 30–60 cm culm. */
export function steppeTuftGeometry(seed: number) {
  const rnd = random(seed || 1);
  const pos: number[] = [];
  const col: number[] = [];
  const h = STIPA_CULM_M.min + rnd() * (STIPA_CULM_M.max - STIPA_CULM_M.min);
  const base: [number, number, number] = [0.16, 0.32, 0.07];
  const tip: [number, number, number] = [0.62, 0.55, 0.16];
  const cards = 3;
  for (let i = 0; i < cards; i++) {
    const ang = (i / cards) * Math.PI + rnd() * 0.2;
    const lean = 0.15 + rnd() * 0.2;
    const w = 0.16;
    const dx = Math.cos(ang) * w * 0.5;
    const dz = Math.sin(ang) * w * 0.5;
    const ox = Math.cos(ang + Math.PI / 2) * Math.sin(lean) * h;
    const oz = Math.sin(ang + Math.PI / 2) * Math.sin(lean) * h;
    const ty = Math.cos(lean) * h;
    const push = (x: number, y: number, z: number, c: [number, number, number]) => { pos.push(x, y, z); col.push(...c); };
    push(-dx, 0, -dz, base);
    push(dx, 0, dz, base);
    push(ox, ty, oz, tip);
    push(-dx, 0, -dz, base);
    push(dx, 0, dz, base);
    push(-ox, ty, -oz, tip);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

export function steppeTuftGroup(seed: number) {
  const mesh = new THREE.Mesh(steppeTuftGeometry(seed), tuftMaterial());
  mesh.name = 'steppe-tuft';
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}
