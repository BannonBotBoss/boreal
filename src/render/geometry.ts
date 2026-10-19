import * as THREE from 'three';
import { heightAt, type Entity } from '../core/world';
import { random } from '../core/random';
import { settleTrunk, type Settle } from '../core/settle';
import { soilAt } from '../core/stages/soils';
import { STAGES } from '../core/stages/elevation';
import { createDeerRig } from './animalRig';
import { icosphere, rockGeometry } from './rocks';
import { treeGeometry } from './trees';

/** Fallen logs share one batch material with the same parameters as render/batch PROP_MATERIAL (same program key, no new
 *  program), colour per vertex. Being a different material, the chunk batch gives logs their own BatchedMesh, which casts
 *  shadows (render/photoreal: near cascade only), while plants and bushes (PROP_MATERIAL) cast none. */
export const LOG_MATERIAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }); LOG_MATERIAL.userData.shared = true;
const tinted = (g: THREE.BufferGeometry, hex: number) => { const c = new THREE.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };

/** Fallen log on the ground (T-0005, Matthew 2026-10-19: "settled down into the ground"; the same idea as render/rocks seatRock).
 *  Gravity pulls the trunk down until it lies flat against the earth (tilted with the slope) and the earth yields until its
 *  push equals the trunk's weight: core/settle gives the depth from the trunk and earth densities (about a third of the width
 *  on till and clay, deeper in peat, a few cm on bedrock). The log is a frustum along local x (radius .32 at -x, .43 at +x,
 *  4.4 m) on an axis group. Ground heights are sampled at both ends and the middle along the yawed axis, and half a metre to
 *  either side of the middle; the axis is fitted so the log is pressed in by that depth everywhere along it (measured
 *  perpendicular to the ground: the axis sits k r (1 - 2 h) above it, h = depth / width, k = sqrt(1 + slope^2 + cross^2)).
 *  Pitch follows the fitted line; roll follows the cross-slope (on a round log that only turns the bark and the cut end).
 *  Two passes, because a pitched log reaches less far horizontally. Deterministic (heightAt, soilAt and the entity seed);
 *  memoised per entity, so the three LODs share one result and one set of heightAt calls (11). On ground too curved for a
 *  straight log (more than ~6 cm over its length, about 1 log in 10) every sample stays within 0.2 of the width of that depth. */const LOG_X = 2.2, LOG_R = [.32, .375, .43];
type Vec3 = [number, number, number];
/** A seated log: axis height `a` (local units above the entity origin), pitch and roll, the seeded bury share `bury` of the
 *  thickness, and the contact for T-0006 (grok/T-0006-solid-contact): `at` = the world point under the middle of the log where
 *  it rests on the earth, `normal` = the ground normal there (from the same along and cross samples). */
export interface LogSeat { a: number; pitch: number; roll: number; at: Vec3; normal: Vec3; settle: Settle }
const logSeats = new WeakMap<Entity, LogSeat>();
/** Pure (no three.js objects): the seat of entity `e`, memoised per entity. */
export function logSeat(e: Entity, h: (x: number, z: number) => number = heightAt): LogSeat {
  let seat = logSeats.get(e); if (seat) return seat;
  const s = e.scale, c = Math.cos(e.rotation), sn = Math.sin(e.rotation), hc = h(e.x, e.z);
  // how far the earth yields under this trunk (core/settle: trunk weight = weight of the earth it displaces; ~1/3 of the width on till)
  const settle = settleTrunk(2 * LOG_R[1] * s, soilAt(STAGES.seed, e.x, e.z), random(e.seed ^ 0x51ab)()), f = settle.depth;
  // local (unscaled, yaw-free) point -> ground height relative to the entity origin, in local units. three's rotation.y maps local x to (cos, 0, -sin), z to (sin, 0, cos)
  const at = (lx: number, lz: number) => (h(e.x + (lx * c + lz * sn) * s, e.z + (-lx * sn + lz * c) * s) - hc) / s;
  const w = .5 / s, cross = (at(0, w) - at(0, -w)) / (2 * w);
  let b = 0, a = 0, along = 0;
  for (let pass = 0; pass < 2; pass++) {
    const X = LOG_X / Math.sqrt(1 + b * b), g = [at(-X, 0), 0, at(X, 0)], k = Math.sqrt(1 + (along = (g[2] - g[0]) / (2 * X)) ** 2 + cross * cross);
    const t = g.map((y, i) => y + k * LOG_R[i] * (1 - 2 * f));
    b = (t[2] - t[0]) / (2 * X); a = (t[0] + t[1] + t[2]) / 3;
    // A straight log can't follow curved ground: keep every sample within 0.2 of the width of its settled depth (no floating end, never out of sight)
    const fLo = Math.max(0, f - .2), fHi = Math.min(.65, f + .2);
    let lo = -Infinity, hi = Infinity; for (let i = 0; i < 3; i++) { const base = g[i] - b * (i - 1) * X; lo = Math.max(lo, base + k * LOG_R[i] * (1 - 2 * fHi)); hi = Math.min(hi, base + k * LOG_R[i] * (1 - 2 * fLo)); }
    a = Math.min(hi, Math.max(lo, a));
  }
  const gx = along * c + cross * sn, gz = -along * sn + cross * c, nl = Math.hypot(gx, 1, gz); // ground gradient in world x, z
  seat = { a, pitch: Math.atan(b), roll: Math.atan(cross), at: [e.x, hc, e.z], normal: [-gx / nl, 1 / nl, -gz / nl], settle };
  logSeats.set(e, seat); return seat;
}
/** Applies the seat to a log group (root: yaw + scale; children[0]: the axis group) and returns the contact for T-0006.
 *  T-0006 hook (one call site, render/buildScene chunk build): `const { at, normal } = logSeat(entity)` feeds its single
 *  `CONTACTS.begin({ a: entity.key, b: 'ground', at, normal, kind: 'solid-solid', source: 'log-seat' })`. This branch adds no
 *  contact bus of its own; if T-0006 lands first, that call's temporary centre sample is swapped for `logSeat(entity)`. */
export function seatLog(group: THREE.Object3D, e: Entity, h: (x: number, z: number) => number = heightAt): Pick<LogSeat, 'at' | 'normal' | 'settle'> {
  const seat = logSeat(e, h), axis = group.children[0];
  axis.position.set(0, seat.a, 0); axis.rotation.set(seat.roll, 0, seat.pitch, 'ZYX'); // roll about the log's own axis first, then pitch
  return { at: seat.at, normal: seat.normal, settle: seat.settle }; // settle: trunk and earth densities + depth, for T-0006's why
}
/** Only this layer knows Three.js. No model files are loaded. */export function generateGeometry(entity: Entity, detail: number): THREE.Group {
  if (entity.kind === 'deer') { const rig = createDeerRig(entity.seed, detail); rig.root.scale.setScalar(entity.scale); rig.root.rotation.y = entity.rotation; return rig.root; }
  if (entity.kind === 'rock') return rockGeometry(entity, detail);
  if (entity.kind === 'spruce') return treeGeometry(entity, detail); // boreal species: src/render/trees.ts
  const group = new THREE.Group(), rng = random(entity.seed);
  const segments = [9, 6, 4][detail];
  const material = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: .95, flatShading: true });
  const wood = material(0x70513b), leaf = material(0x315746), pale = material(0xc4ab7a);
  const body = material(entity.kind === 'person' ? 0x9b6650 : 0xa28055);
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); group.add(mesh); return mesh;
  };
  const ellipsoid = (mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) =>
    add(icosphere(detail === 0 ? 1 : 0), mat, x, y, z, sx, sy, sz);
  if (entity.kind === 'log') {
    // The parts hang off an axis group (T-0005): seatLog pitches, rolls and sinks it to the ground; the root keeps yaw + scale.
    const axis = new THREE.Group(); group.add(axis); axis.position.y = .4;
    const log = add(tinted(new THREE.CylinderGeometry(.32, .43, 4.4, segments), 0x70513b), LOG_MATERIAL, 0, 0, 0); log.rotation.z = Math.PI / 2;
    const end = add(tinted(new THREE.CircleGeometry(.33, segments), 0xc4ab7a), LOG_MATERIAL, 2.21, 0, 0); end.rotation.y = Math.PI / 2;
    axis.add(log, end); seatLog(group, entity);
    log.userData.shared = end.userData.shared = true; // render/batch keeps a shared material as is (its own batch) instead of baking it into PROP_MATERIAL
  } else if (entity.kind === 'forage') {
    const berries = material(0x536fb7), leaves = material(0x528d40);
    for(let i=0;i<(detail===2?3:7);i++) {
      const angle=i*2.4;
      ellipsoid(leaves,Math.cos(angle)*.28,.17,Math.sin(angle)*.28,.22,.13,.17);
      ellipsoid(berries,Math.cos(angle)*.22,.32,Math.sin(angle)*.22,.06,.065,.06);
    }
  } else if (entity.kind === 'plant') {
    for (let i = 0; i < (detail === 2 ? 2 : 5); i++) {
      const a = i * 2.4;
      ellipsoid(leaf, Math.cos(a) * .25, .35, Math.sin(a) * .25, .23, .5, .18);
      ellipsoid(material(0xd9a15c), Math.cos(a) * .3, .8, Math.sin(a) * .3, .13, .15, .13);
    }
  } else {
    ellipsoid(body, 0, 1.05, 0, .38, .65, .23);
    ellipsoid(pale, 0, 1.98, 0, .25, .3, .25);
    for (const x of [-.18, .18]) add(new THREE.CylinderGeometry(.12, .09, .8, segments), wood, x, .4, 0);
    for (const x of [-.48, .48]) {
      const arm = add(new THREE.CylinderGeometry(.10, .08, .8, segments), body, x, 1.2, 0); arm.name = 'arm'; arm.rotation.z = x * .3;
    }
  }
  // Materials created but unused by this recipe have no GPU allocation.
  group.scale.setScalar(entity.scale); group.rotation.y = entity.rotation;
  return group;
}
export function disposeObject(object: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  object.traverse(child => {
    if (child instanceof THREE.Mesh && !child.userData.shared) { // shared tree geometry/material stay cached
      child.geometry.dispose();
      for (const m of Array.isArray(child.material) ? child.material : [child.material]) materials.add(m);
    }
  });
  materials.forEach(m => { if (!m.userData.shared) m.dispose(); }); // shared materials (render/pbr) outlive chunks
}
