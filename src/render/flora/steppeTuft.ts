/**
 * A prairie stem is a feather-grass tuft, not a spruce.
 *
 * Stipa lessingiana culms are 30–60 cm, tufted, with setaceous blades
 * (Flora of China 22, Stipa lessingiana; flowering May–July). The Kazakh
 * steppe at the seeded home is that grass, not black spruce (9–15 m,
 * Viereck & Johnston 1990). The blade is drawn 8 mm wide: a 0.3–0.5 mm
 * blade is sub-pixel, the same calibration as wavy hairgrass in cover.ts.
 *
 * The ribbon is built on the CPU so a test can measure it. A tussock is a
 * fan of narrow blades, not three wide triangles. The setaceous leaf is
 * sub-pixel, the same calibration as wavy hairgrass in cover.ts. Each drawn
 * blade is 12 mm wide so the fan reads as grass. The fan, not one card, is
 * the tussock.
 *
 * The near field is a sward, not the few spruce stems the cover share keeps.
 * Those stems sit outside the 13 m clear around the wolf, so a standing eye
 * never reached one. Spacing 0.5 m puts several tussocks in that view.
 * cover-density.json's 28 m prairie step is the billboard spacing, and its
 * note says that count is not grass tillers.
 */
import * as THREE from 'three';
import { CHUNK_SIZE, heightAt, isDryLand } from '../../core/world';
import { hash2u, random } from '../../proc/rng';
import { openTileGeneration } from '../../world/globe/openTiles';
import { landingContext } from '../landingCast';

/** Culm length, metres. Flora of China 22: 30–60 cm. */
export const STIPA_CULM_M = { min: 0.30, max: 0.60 } as const;
/** Drawn tussock spacing. A closed sward, not the 28 m billboard step. */
export const STIPA_SPACING_M = 0.5;
/** Radius of the sward around the camera. The standing eye is inside it. */
export const STIPA_RADIUS_M = 8;
/**
 * Drawn blade width. 12 mm is [game calibration] so a setaceous leaf is a
 * few pixels at the standing eye, the same reason cover.ts draws hairgrass
 * wider than the real leaf. A 28 cm triangle reads as a spike.
 */
export const STIPA_BLADE_M = 0.012;
/** Blades in one tussock. Three wide cards read as pyramids. */
export const STIPA_BLADES = 9;

const cache = new Map<string, boolean>();
let cacheGen = -1;

/** True when the HUD sample at this point is prairie. Cached per chunk until the photograph changes. */
export function steppeAt(x: number, z: number) {
  const gen = openTileGeneration();
  if (gen !== cacheGen) { cache.clear(); cacheGen = gen; }
  const key = `${Math.floor(x / CHUNK_SIZE)}:${Math.floor(z / CHUNK_SIZE)}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const prairie = landingContext(x, z).biome === 'prairie';
  cache.set(key, prairie);
  return prairie;
}

export function clearSteppeCache() { cache.clear(); cacheGen = -1; }
(globalThis as { borealSteppeAt?: (x: number, z: number) => boolean }).borealSteppeAt = steppeAt;

let material: THREE.MeshStandardMaterial | undefined;
function tuftMaterial() {
  if (!material) {
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
    material.userData.shared = true;
  }
  return material;
}

/** One tussock: a fan of narrow bent blades. Height stays inside the 30–60 cm culm. */
export function steppeTuftGeometry(seed: number) {
  const rnd = random(seed || 1);
  const pos: number[] = [];
  const col: number[] = [];
  const h = STIPA_CULM_M.min + rnd() * (STIPA_CULM_M.max - STIPA_CULM_M.min);
  // Day 227 is past anthesis (May–July). The culm is cured straw, the colour of the Akmola steppe in September.
  const base: [number, number, number] = [0.36, 0.28, 0.10];
  const mid: [number, number, number] = [0.55, 0.44, 0.16];
  const tip: [number, number, number] = [0.72, 0.58, 0.22];
  const half = STIPA_BLADE_M / 2;
  for (let i = 0; i < STIPA_BLADES; i++) {
    const ang = (i / STIPA_BLADES) * Math.PI * 2 + rnd() * 0.15;
    const lean = 0.45 + rnd() * 0.35;
    const side = ang + Math.PI / 2;
    const dx = Math.cos(side) * half;
    const dz = Math.sin(side) * half;
    const reach = Math.sin(lean) * h;
    const ox = Math.cos(ang) * reach;
    const oz = Math.sin(ang) * reach;
    const ty = Math.cos(lean) * h;
    const mx = ox * 0.42, mz = oz * 0.42, my = ty * 0.55;
    const push = (x: number, y: number, z: number, c: [number, number, number]) => { pos.push(x, y, z); col.push(...c); };
    const tri = (a: number[], b: number[], c: number[], ca: [number, number, number], cb: [number, number, number], cc: [number, number, number]) => {
      push(a[0], a[1], a[2], ca); push(b[0], b[1], b[2], cb); push(c[0], c[1], c[2], cc);
    };
    const a0 = [-dx, 0, -dz], b0 = [dx, 0, dz];
    const am = [mx - dx * 0.7, my, mz - dz * 0.7], bm = [mx + dx * 0.7, my, mz + dz * 0.7];
    const tipP = [ox, ty, oz];
    tri(a0, b0, bm, base, base, mid);
    tri(a0, bm, am, base, mid, mid);
    tri(am, bm, tipP, mid, mid, tip);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Ground-edge length of each triangle, and how many triangles reach a culm tip. */
export function tuftBladeCensus(seed: number) {
  const pos = steppeTuftGeometry(seed).getAttribute('position').array as ArrayLike<number>;
  let wideGround = 0, tips = 0;
  for (let i = 0; i < pos.length; i += 9) {
    const v = [0, 1, 2].map(k => ({ x: pos[i + k * 3], y: pos[i + k * 3 + 1], z: pos[i + k * 3 + 2] }));
    if (Math.max(v[0].y, v[1].y, v[2].y) > 0.25) tips++;
    for (let a = 0; a < 3; a++) {
      const p = v[a], q = v[(a + 1) % 3];
      if (p.y < 0.05 && q.y < 0.05 && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) > 0.04) wideGround++;
    }
  }
  return { wideGround, tips };
}

export function steppeTuftGroup(seed: number) {
  const mesh = new THREE.Mesh(steppeTuftGeometry(seed), tuftMaterial());
  mesh.name = 'steppe-tuft';
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

export function stipaCulmM(seed: number) {
  const rnd = random(seed || 1);
  return STIPA_CULM_M.min + rnd() * (STIPA_CULM_M.max - STIPA_CULM_M.min);
}

/** Tussock centres inside the standing view. Empty when the sample is not prairie. */
export function tuftFieldPoints(cx: number, cz: number, radius = STIPA_RADIUS_M, spacing = STIPA_SPACING_M) {
  const out: { x: number; z: number; h: number }[] = [];
  if (!steppeAt(cx, cz)) return out;
  const x0 = Math.floor((cx - radius) / spacing) * spacing;
  const z0 = Math.floor((cz - radius) / spacing) * spacing;
  for (let x = x0; x <= cx + radius; x += spacing) {
    for (let z = z0; z <= cz + radius; z += spacing) {
      const j = hash2u(Math.round(x * 10), Math.round(z * 10), 3);
      const px = x + (j - 0.5) * spacing * 0.6;
      const pz = z + (hash2u(Math.round(z * 10), Math.round(x * 10), 5) - 0.5) * spacing * 0.6;
      if (Math.hypot(px - cx, pz - cz) > radius) continue;
      if (!isDryLand(px, pz)) continue;
      if (!steppeAt(px, pz)) continue;
      out.push({ x: px, z: pz, h: stipaCulmM(Math.round(j * 1e9) || 1) });
    }
  }
  return out;
}

let field: THREE.InstancedMesh | undefined;
let fieldX = Infinity, fieldZ = Infinity, fieldGen = -1;

/** Rebuild the sward when the camera moves or the photograph changes. */
export function updateSteppeField(scene: THREE.Scene, camera: THREE.Camera) {
  const x = camera.position.x, z = camera.position.z, gen = openTileGeneration();
  if (field && Math.hypot(x - fieldX, z - fieldZ) < 3 && gen === fieldGen) return;
  fieldX = x; fieldZ = z; fieldGen = gen;
  if (field) { scene.remove(field); field.geometry.dispose(); field = undefined; }
  if (!steppeAt(x, z)) return;
  const pts = tuftFieldPoints(x, z);
  if (!pts.length) return;
  const geo = steppeTuftGeometry(1);
  const mesh = new THREE.InstancedMesh(geo, tuftMaterial(), pts.length);
  mesh.name = 'steppe-field';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const baseH = stipaCulmM(1);
  for (let i = 0; i < pts.length; i++) {
    const t = pts[i];
    p.set(t.x, heightAt(t.x, t.z), t.z);
    s.set(1, t.h / baseH, 1);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash2u(i, 1, 7) * Math.PI);
    mesh.setMatrixAt(i, m.compose(p, q, s));
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
  field = mesh;
  (globalThis as { borealSteppeField?: () => number }).borealSteppeField = () => mesh.count;
}
