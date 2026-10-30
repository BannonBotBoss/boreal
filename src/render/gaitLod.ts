/**
 * Wolf levels of detail for the Meshy skin (#162 item 2, sprint #192). One gait phase drives every level, so a switch
 * cannot change where a leg is in its cycle:
 *  - far   (speck): no skin, no IK. The body follows its path; `speckBob` adds an optional phase bob.
 *  - mid   (low mesh): a vertex-clustered copy of the Meshy body on the same bones. The pose is a per-limb phase curve
 *          (forward kinematics sampled once from the gait, then interpolated), refreshed at `midHz`. No raycast, no IK.
 *  - near  (full mesh): the full gait (quadrupedPose with its IK) plus terrain foot placement (a two-bone sagittal
 *          solve per leg against heightAt). The player wolf copies its procedural rig instead, which already carries
 *          the controller's terrain IK.
 * Distances are the #162 ladder's (detailShares): a level changes where one share crosses one half, with hysteresis.
 * Each switch is blended for `blendS` by decaying the pose offset at the switch to zero (inertialization, after
 * D. Bollo, "Inertialization: High-Performance Animation Transitions in Gears of War", GDC 2016; this is the simple
 * exponential-free smoothstep decay, not his fifth-order polynomial).
 * The low mesh is vertex clustering (J. Rossignac and P. Borrel, "Multi-resolution 3D approximations for rendering
 * complex scenes", 1993): one representative vertex per grid cell keeps its uv and skin weights, so it needs no new
 * weights and costs one pass (three's SimplifyModifier took about 5 s on this 26k-triangle wolf in node, too slow to
 * run on load).
 * The Meshy wolf is rebound first (reboundTemplate / spawnWolf): the rig is bent onto the mesh's own mid-stride paws
 * before the bind, and the legs get leg-only weights, so a planted rig paw is a planted mesh paw.
 * Math is plain arrays and loops (portable to Rust); three only holds the bones.
 */
import * as THREE from 'three';
import type { DetailShares } from './animalLadder';
import { spawnSkin, type SkinSpawn, type SkinTemplate } from './meshySkin';
import { gaitFor, WOLF_LEGS, type Motion } from '../core/animalBehavior';
import { worldSec } from '../core/worldClock';

export const WOLF_LOD = {
  /** Pose blend across a switch, seconds (the brief's 0.2 s). */
  blendS: 0.2,
  /** A share must pass 0.5 by this much to change level: about 2.6 m either side of 32 m and 3.8 m of 94 m. [game calibration] */
  hyst: 0.1,
  /** Mid pose refresh rate, Hz. 15 Hz left trot joints stepping up to 1.2 rad between refreshes (wolf-lod-bench); 30 halves it. [game calibration] */
  midHz: 30,
  /** Phase samples per gait curve. [game calibration] */
  curveN: 32,
  /** Speed bucket of a cached curve, m/s. [game calibration] */
  speedStep: 0.5,
  /** Grid cell of the low mesh, metres. [game calibration: about 4k triangles on the wolf] */
  cellM: 0.04,
  /** Speck bob amplitude, metres. [estimate: about the wolf trot's body bob] */
  bobM: 0.02,
  /** Terrain foot offset clamp, metres. [game calibration] */
  footMaxM: 0.14,
} as const;

export type WolfLevel = 'near' | 'mid' | 'far';

/** Species drawn by this ladder. Data, not a file per species (PROJECT-RULES rule 3): the rebind and the phase curves
 * assume a canid on the wolf gait (meshySkin legsForSpecies useWolfGait). */
export const GAIT_LOD_SPECIES: readonly string[] = ['Gray Wolf'];

/** Level from the ladder shares with hysteresis. Pure. */
export function pickLevel(prev: WolfLevel | undefined, s: DetailShares, h: number = WOLF_LOD.hyst): WolfLevel {
  const hi = 0.5 + h, lo = 0.5 - h;
  if (!prev) return s.full >= 0.5 ? 'near' : s.speck >= 0.5 ? 'far' : 'mid';
  if (prev === 'near') return s.full >= lo ? 'near' : s.speck > hi ? 'far' : 'mid';
  if (prev === 'far') return s.speck >= lo ? 'far' : s.full > hi ? 'near' : 'mid';
  return s.full > hi ? 'near' : s.speck > hi ? 'far' : 'mid';
}

/** Speck bob from the gait phase, metres. Two bobs per stride (one per diagonal or girdle beat). [estimate] */
export function speckBob(phase: number, moving: boolean, amp: number = WOLF_LOD.bobM) {
  return moving ? amp * Math.abs(Math.sin(2 * Math.PI * phase)) : 0;
}

/** Inertial blend: decay an offset taken at the switch over `dur` seconds. Pure. */
export function blendWeight(t: number, dur: number = WOLF_LOD.blendS) {
  if (t >= dur) return 0;
  const u = Math.max(0, t / dur);
  return 1 - u * u * (3 - 2 * u);
}

// ---------- pose vector: tilt + every bone, rotation x/y and position y/z ----------
const CH = 4;
export interface PoseRig { nodes: THREE.Object3D[]; size: number }
export function poseRig(spawn: { root: THREE.Object3D; meshes: THREE.SkinnedMesh[] }): PoseRig {
  const tilt = spawn.root.getObjectByName('tilt');
  const nodes = [...(tilt ? [tilt] : []), ...spawn.meshes[0].skeleton.bones];
  return { nodes, size: nodes.length * CH };
}
export function readPose(rig: PoseRig, out: Float32Array = new Float32Array(rig.size)): Float32Array {
  rig.nodes.forEach((n, i) => { out[i * CH] = n.rotation.x; out[i * CH + 1] = n.rotation.y; out[i * CH + 2] = n.position.y; out[i * CH + 3] = n.position.z; });
  return out;
}
export function writePose(rig: PoseRig, v: ArrayLike<number>) {
  rig.nodes.forEach((n, i) => { n.rotation.x = v[i * CH]; n.rotation.y = v[i * CH + 1]; n.position.y = v[i * CH + 2]; n.position.z = v[i * CH + 3]; });
}

// ---------- low mesh ----------
/** Vertex clustering of one indexed geometry. Representative = the first vertex seen in a cell. Pure arrays. */
export function clusterIndex(pos: ArrayLike<number>, index: ArrayLike<number>, cell: number) {
  const n = pos.length / 3, rep = new Int32Array(n), cellOf = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    const key = `${Math.floor(pos[i * 3] / cell)},${Math.floor(pos[i * 3 + 1] / cell)},${Math.floor(pos[i * 3 + 2] / cell)}`;
    const r = cellOf.get(key);
    if (r === undefined) { cellOf.set(key, i); rep[i] = i; } else rep[i] = r;
  }
  const tris: number[] = [], seen = new Set<string>();
  for (let t = 0; t < index.length; t += 3) {
    const a = rep[index[t]], b = rep[index[t + 1]], c = rep[index[t + 2]];
    if (a === b || b === c || a === c) continue;
    const m = Math.min(a, b, c), key = m === a ? a + ',' + b + ',' + c : m === b ? b + ',' + c + ',' + a : c + ',' + a + ',' + b; // same face, same winding
    if (seen.has(key)) continue;
    seen.add(key); tris.push(a, b, c);
  }
  // compact to used vertices
  const remap = new Int32Array(n).fill(-1), keep: number[] = [];
  for (const v of tris) if (remap[v] < 0) { remap[v] = keep.length; keep.push(v); }
  return { keep, index: tris.map(v => remap[v]) };
}

function compact(g: THREE.BufferGeometry, keep: number[], index: number[]) {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(g.attributes) as [string, THREE.BufferAttribute][]) {
    const k = attr.itemSize, src = attr.array as ArrayLike<number>;
    const arr = new (attr.array.constructor as { new(n: number): Float32Array })(keep.length * k);
    keep.forEach((v, i) => { for (let c = 0; c < k; c++) arr[i * k + c] = src[v * k + c]; });
    out.setAttribute(name, new THREE.BufferAttribute(arr, k, attr.normalized));
  }
  out.setIndex(index);
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

const lowTemplates = new WeakMap<SkinTemplate, SkinTemplate>();
/** The low template: same bones and materials, clustered geometry. Cached per full template. */
export function lowTemplate(full: SkinTemplate, cell: number = WOLF_LOD.cellM): SkinTemplate {
  const hit = lowTemplates.get(full);
  if (hit) return hit;
  let tris = 0;
  const geometries = full.geometries.map(g => {
    const pos = g.getAttribute('position').array as ArrayLike<number>;
    const idx = g.index ? (g.index.array as ArrayLike<number>) : Array.from({ length: pos.length / 3 }, (_, i) => i);
    const c = clusterIndex(pos, idx, cell);
    tris += c.index.length / 3;
    return compact(g, c.keep, c.index);
  });
  const low = shareRestFit(full, { ...full, geometries, tris });
  lowTemplates.set(full, low);
  return low;
}

// ---------- leg weights ----------
/** Segment distance, pure. */
function segDist(px: number, py: number, pz: number, a: number[], b: number[]) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], L2 = ux * ux + uy * uy + uz * uz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - a[0]) * ux + (py - a[1]) * uy + (pz - a[2]) * uz) / L2)) : 0;
  return Math.hypot(px - a[0] - ux * t, py - a[1] - uy * t, pz - a[2] - uz * t);
}
/**
 * Leg-only skin weights below the belly (pure arrays). `segs[leg]` = rest segments [boneIndex, from, to] of one leg's
 * chain; `side(x, z)` picks the leg. Under `y0` a vertex takes only its leg's bones (inverse fourth-power distance, top
 * two); between `y0` and `y1` it blends to its original weights, and likewise from r0 to r1 metres
 * away from the leg's bones, so a tail hanging under the belly is not bound to a hind leg. Returns new skinIndex/skinWeight arrays.
 */
export function legWeights(pos: ArrayLike<number>, idx0: ArrayLike<number>, w0: ArrayLike<number>,
  segs: [number, number[], number[]][][], leg: (v: number) => number, y0: number, y1: number, r0 = 0.06, r1 = 0.1) {
  const n = pos.length / 3, idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4);
  for (let v = 0; v < n; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    let mix = y <= y0 ? 1 : y >= y1 ? 0 : 1 - (y - y0) / (y1 - y0);
    if (mix > 0) { // only near the leg itself: a hanging tail under the belly line keeps its weights
      const near = Math.min(...segs[leg(v)].map(([, a, e]) => segDist(x, y, z, a, e)));
      mix *= near <= r0 ? 1 : near >= r1 ? 0 : 1 - (near - r0) / (r1 - r0);
    }
    const acc = new Map<number, number>();
    for (let c = 0; c < 4; c++) acc.set(idx0[v * 4 + c], (acc.get(idx0[v * 4 + c]) ?? 0) + w0[v * 4 + c] * (1 - mix));
    if (mix > 0) {
      const own = segs[leg(v)].map(([b, a, e]) => [b, 1 / Math.pow(Math.max(0.01, segDist(x, y, z, a, e)), 4)] as const)
        .sort((p, q) => q[1] - p[1]).slice(0, 2);
      const sum = own.reduce((s, [, k]) => s + k, 0);
      for (const [b, k] of own) acc.set(b, (acc.get(b) ?? 0) + mix * k / sum);
    }
    const top = [...acc.entries()].filter(e => e[1] > 0).sort((p, q) => q[1] - p[1]).slice(0, 4);
    const sum = top.reduce((s, [, k]) => s + k, 0) || 1;
    top.forEach(([b, k], c) => { idx[v * 4 + c] = b; wt[v * 4 + c] = k / sum; });
  }
  return { idx, wt };
}

const reboundTemplates = new WeakMap<SkinTemplate, SkinTemplate>();
/** Rest fit per template: how far (metres, mesh space) each Meshy paw stands from its rig paw. */
const restFits = new WeakMap<SkinTemplate, { dx: number[]; dz: number[] }>();
/** Rebind switch (the evidence page and tests flip it to show the Meshy weights as they were). */
export const REBIND = { on: true };

const _w = new THREE.Vector3(), _t = new THREE.Vector3();
/** Move leg i's wrist (foot bone origin) by a world offset with a two-bone sagittal solve in the girdle frame; the foot keeps
 * its world pitch. Shared by the rest fit (z) and terrain feet (y). */
function moveWrist(root: THREE.Object3D, i: number, dy: number, dz: number) {
  const girdle = root.getObjectByName('girdle' + i), upper = root.getObjectByName('upper' + i);
  const lower = root.getObjectByName('lower' + i), foot = root.getObjectByName('foot' + i);
  if (!girdle || !upper || !lower || !foot) return;
  foot.getWorldPosition(_w);
  const W = girdle.worldToLocal(_w.clone()), T = girdle.worldToLocal(_t.copy(_w).add(new THREE.Vector3(0, dy, dz)));
  const U = upper.position, l1 = lower.position.length(), l2 = foot.position.length();
  const solve = (ty: number, tz: number) => {
    const ry = ty - U.y, rz = tz - U.z, d = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(l1 + l2 - 1e-4, Math.hypot(ry, rz)));
    const phi = Math.atan2(-rz, -ry);
    const alpha = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const beta = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
    return { phi, alpha, bend: Math.PI - beta };
  };
  const now = solve(W.y, W.z), to = solve(T.y, T.z), s = lower.rotation.x >= 0 ? 1 : -1;
  const a0 = upper.rotation.x, k0 = lower.rotation.x;
  const a1 = a0 + (to.phi - s * to.alpha) - (now.phi - s * now.alpha), k1 = k0 + s * (to.bend - now.bend);
  upper.rotation.x = a1; lower.rotation.x = k1; foot.rotation.x -= (a1 + k1) - (a0 + k0);
  root.updateMatrixWorld(true);
}

/**
 * Retarget bind: the Meshy wolf stands mid-stride (paws 13-19 cm from the rig's paws, which stand straight under the
 * girdles), so the rig's legs are bent onto the mesh's paws before the bind. The gait then writes absolute angles and the
 * mesh legs follow from their own rest pose; this is the same idea as three's SkeletonUtils.retarget (bind pose = the
 * mesh's rest pose), done for this procedural rig. Spawns from a rebound template must use spawnWolf.
 */
export function spawnWolf(tpl: SkinTemplate): SkinSpawn {
  const s = spawnSkin(tpl), fit = restFits.get(tpl);
  if (!fit) return s;
  s.root.updateMatrixWorld(true);
  for (let i = 0; i < 4; i++) moveWrist(s.root, i, 0, fit.dz[i]);
  const skeleton = s.meshes[0].skeleton;
  skeleton.calculateInverses();
  for (const m of s.meshes) m.bind(skeleton, m.matrixWorld);
  return s;
}

/** Paw-level vertex clusters, one per leg: fore/hind by the rig's girdle midpoint, side by that half's mean x. Pure arrays. */
export function meshPaws(pos: ArrayLike<number>, boneXZ: number[][], below: number) {
  const n = pos.length / 3, zMid = (boneXZ[0][1] + boneXZ[1][1]) / 2, low: number[] = [];
  for (let v = 0; v < n; v++) if (pos[v * 3 + 1] < below) low.push(v);
  const half = [0, 1].map(h => { const xs = low.filter(v => (pos[v * 3 + 2] >= zMid ? 1 : 0) === h).map(v => pos[v * 3]); return xs.reduce((q, x) => q + x, 0) / Math.max(1, xs.length); });
  const leftNeg = boneXZ[0][0] < 0;
  const quad = (v: number) => { const h = pos[v * 3 + 2] >= zMid ? 1 : 0, left = pos[v * 3] < half[h]; return h + (left === leftNeg ? 0 : 2); };
  return [0, 1, 2, 3].map(i => {
    const mine = low.filter(v => quad(v) === i);
    if (!mine.length) return { x: boneXZ[i][0], z: boneXZ[i][1], n: 0 };
    return { x: mine.reduce((q, v) => q + pos[v * 3], 0) / mine.length, z: mine.reduce((q, v) => q + pos[v * 3 + 2], 0) / mine.length, n: mine.length };
  });
}

/**
 * The wolf rebound for the gait: rest-fit bind (spawnWolf) and leg-only weights under the belly. The Meshy proximity
 * weights (meshySkin.proximityWeights, four nearest bones of a rig standing 13-19 cm off the mesh paws) leave a paw sole
 * 0-50 % on its own leg, so a planted rig paw drags a sliding mesh paw (tools/wolf-lod-bench). Belly line [estimate: a
 * wolf's chest floor at about 45-50 % of withers height]. Cached per template.
 */
export function reboundTemplate(tpl: SkinTemplate, y0Share = 0.42, y1Share = 0.52): SkinTemplate {
  const hit = reboundTemplates.get(tpl);
  if (hit) return hit;
  if (tpl.layout.kind !== 'quad' || !REBIND.on) return tpl;
  const withers = tpl.height * 0.62;
  const probe = spawnSkin(tpl);
  probe.root.updateMatrixWorld(true);
  const bonePaw = [0, 1, 2, 3].map(i => { const p = new THREE.Vector3(); probe.root.getObjectByName('paw' + i)!.getWorldPosition(p); return [p.x, p.z]; });
  const pos0 = tpl.geometries[0].getAttribute('position').array as ArrayLike<number>;
  const paws = meshPaws(pos0, bonePaw, 0.08 * withers);
  const fit = { dx: paws.map((p, i) => p.x - bonePaw[i][0]), dz: paws.map((p, i) => p.z - bonePaw[i][1]) };
  const stub = { ...tpl };
  restFits.set(stub, fit);
  const s = spawnWolf(stub), bones = s.meshes[0].skeleton.bones;
  const at = (name: string) => { const b = bones.find(x => x.name === name)!; const p = new THREE.Vector3(); b.getWorldPosition(p); return { i: bones.indexOf(b), p: p.toArray() }; };
  // rest-fit segments, moved in x onto each mesh leg (sagittal rotations do not care about x; the membership test does)
  const segs = [0, 1, 2, 3].map(i => {
    const [g, u, l, f, p] = ['girdle', 'upper', 'lower', 'foot', 'paw'].map(n => at(n + i)), dx = fit.dx[i];
    const sh = (v: number[]) => [v[0] + dx, v[1], v[2]];
    const toe = [p.p[0], p.p[1], p.p[2] - 0.06];
    return [[g.i, sh(g.p), sh(u.p)], [u.i, sh(u.p), sh(l.p)], [l.i, sh(l.p), sh(f.p)], [f.i, sh(f.p), sh(p.p)], [p.i, sh(p.p), sh(toe)]] as [number, number[], number[]][];
  });
  const geometries = tpl.geometries.map(g => {
    const pos = g.getAttribute('position').array as ArrayLike<number>;
    // each vertex belongs to the nearest rest-fit leg chain
    const legOf = new Int8Array(pos.length / 3);
    for (let v = 0; v < legOf.length; v++) {
      let best = 0, bd = Infinity;
      for (let i = 0; i < 4; i++) for (const [, a, e] of segs[i]) { const d = segDist(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], a, e); if (d < bd) { bd = d; best = i; } }
      legOf[v] = best;
    }
    const r = legWeights(pos, g.getAttribute('skinIndex').array as ArrayLike<number>, g.getAttribute('skinWeight').array as ArrayLike<number>,
      segs, v => legOf[v], y0Share * withers, y1Share * withers);
    const out = g.clone();
    out.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(r.idx, 4));
    out.setAttribute('skinWeight', new THREE.Float32BufferAttribute(r.wt, 4));
    return out;
  });
  const rebound = { ...tpl, geometries };
  restFits.set(rebound, fit);
  reboundTemplates.set(tpl, rebound);
  return rebound;
}
/** Carry the rest fit onto a derived template (the low mesh). */
export function shareRestFit(from: SkinTemplate, to: SkinTemplate) { const f = restFits.get(from); if (f) restFits.set(to, f); return to; }

// ---------- mid: phase curves ----------
const curves = new Map<string, Float32Array>();
let curveSpawn: { spawn: SkinSpawn; rig: PoseRig; tpl: SkinTemplate } | null = null;
function gaitKey(motion: Motion, speed: number) {
  const s = Math.round(speed / WOLF_LOD.speedStep) * WOLF_LOD.speedStep;
  return { s, name: gaitFor(motion, s, WOLF_LEGS)?.name ?? motion };
}
/** Per-limb phase curve table (curveN samples of the full gait) for this motion and speed bucket. */
export function phaseCurve(tpl: SkinTemplate, motion: Motion, speed: number) {
  const { s, name } = gaitKey(motion, speed), key = `${tpl.species}|${motion}|${name}|${s}`;
  let c = curves.get(key);
  if (c) return c;
  if (!curveSpawn || curveSpawn.tpl !== tpl) { const spawn = spawnWolf(tpl); curveSpawn = { spawn, rig: poseRig(spawn), tpl }; }
  const { spawn, rig } = curveSpawn, N = WOLF_LOD.curveN;
  c = new Float32Array(N * rig.size);
  const row = new Float32Array(rig.size);
  for (let k = 0; k < N; k++) { spawn.pose(motion, k / N, s); readPose(rig, row); c.set(row, k * rig.size); }
  curves.set(key, c);
  return c;
}
/** Interpolated curve sample at this phase. Pure. */
export function sampleCurve(c: Float32Array, size: number, phase: number, out: Float32Array = new Float32Array(size)) {
  const N = c.length / size, u = ((phase % 1) + 1) % 1 * N, k = Math.floor(u) % N, k2 = (k + 1) % N, f = u - Math.floor(u);
  for (let j = 0; j < size; j++) out[j] = c[k * size + j] * (1 - f) + c[k2 * size + j] * f;
  return out;
}
export function resetWolfLod() { curves.clear(); curveSpawn = null; }

// ---------- near: terrain feet ----------
const _a = new THREE.Vector3();
/**
 * Terrain foot placement on a posed Meshy quad: each paw moves by the ground height under it relative to the body's
 * own ground (clamped), solved as a two-bone sagittal chain (upper, lower) in the girdle frame; the foot keeps its
 * world pitch. Returns the largest offset applied, metres.
 */
export function terrainFeet(root: THREE.Object3D, ground: (x: number, z: number) => number, baseY: number, max: number = WOLF_LOD.footMaxM) {
  let worst = 0;
  root.updateMatrixWorld(true);
  for (let i = 0; i < 4; i++) {
    const paw = root.getObjectByName('paw' + i);
    if (!paw) continue;
    paw.getWorldPosition(_a);
    const dy = Math.max(-max, Math.min(max, ground(_a.x, _a.z) - baseY));
    if (Math.abs(dy) < 1e-4) continue;
    moveWrist(root, i, dy, 0);
    worst = Math.max(worst, Math.abs(dy));
  }
  return worst;
}

/** Copy the procedural player-wolf rig (tilt + four chains, Claude's playerWolf.ts) onto the Meshy bones. Read only. */
export function copyProcRig(procRoot: THREE.Object3D, rig: PoseRig, gaitScale: number) {
  const tilt = procRoot.getObjectByName('tilt');
  if (!tilt || tilt.children.length < 5) return false;
  const s = procRoot.scale.y * gaitScale, girdles = tilt.children.slice(1, 5);
  const by = new Map(rig.nodes.map(n => [n.name, n]));
  const tiltM = by.get('tilt');
  if (tiltM) { tiltM.rotation.x = tilt.rotation.x; tiltM.position.y = tilt.position.y * s; tiltM.position.z = tilt.position.z * s; }
  girdles.forEach((g, i) => {
    const chain = [g, g.children[0], g.children[0]?.children[0], g.children[0]?.children[0]?.children[0], g.children[0]?.children[0]?.children[0]?.children[0]];
    ['girdle', 'upper', 'lower', 'foot', 'paw'].forEach((part, j) => { const src = chain[j], dst = by.get(`${part}${i}`); if (src && dst) dst.rotation.x = src.rotation.x; });
  });
  return true;
}

// ---------- per-wolf driver ----------
export interface WolfLodState {
  level: WolfLevel; since: number; offset: Float32Array | null; last: Float32Array | null; midT: number; mid: Float32Array | null;
  /** A switch happened; the next driven pose takes the offset. */
  pend: boolean;
  /** Blend length, seconds (0 = hard switch, for measuring the pop). */
  blendS: number;
  /** Mid refresh rate, Hz. */
  midHz: number;
  /** Level before the last switch. */
  from: WolfLevel;
}
export interface WolfFrame { motion: Motion; phase: number; speed: number; moving: boolean; x: number; y: number; z: number; procRoot?: THREE.Object3D }

/** Pose one wolf's skin for this frame at its level (near or mid), with the switch blend. `rig` belongs to `spawn`. */
export function driveWolf(state: WolfLodState, spawn: SkinSpawn, rig: PoseRig, tpl: SkinTemplate, f: WolfFrame, dt: number,
  ground?: (x: number, z: number) => number) {
  const target = new Float32Array(rig.size);
  const nearPose = (out: Float32Array): Float32Array => {
    spawn.pose(f.motion, f.phase, f.speed);
    const gs = tpl.layout.kind === 'quad' ? tpl.layout.gaitScale : 1;
    if (!(f.procRoot && copyProcRig(f.procRoot, rig, gs)) && ground) terrainFeet(spawn.root, ground, f.y);
    return readPose(rig, out);
  };
  if (state.level === 'mid') {
    state.midT += dt;
    if (!state.mid || state.midT >= 1 / state.midHz - 1e-9) {
      state.midT = 0;
      state.mid = sampleCurve(phaseCurve(tpl, f.motion, f.speed), rig.size, f.phase, state.mid ?? new Float32Array(rig.size));
    }
    target.set(state.mid);
  } else nearPose(target);
  if (state.pend) {
    state.pend = false;
    if (state.last && state.blendS > 0) {
      // inertialization: the offset is what the old level would show on this frame minus the new level, so the blend
      // carries no extra lag (the last shown frame is one frame of motion behind)
      const old: Float32Array | null = state.from === 'mid' ? sampleCurve(phaseCurve(tpl, f.motion, f.speed), rig.size, f.phase) : state.from === 'near' ? nearPose(new Float32Array(rig.size)) : null;
      if (old) {
        const off = new Float32Array(target.length);
        for (let j = 0; j < off.length; j++) off[j] = old[j] - target[j];
        state.offset = off;
      }
    }
  }
  if (state.offset) {
    const w = blendWeight(state.since, state.blendS);
    if (w <= 0) state.offset = null;
    else for (let j = 0; j < target.length; j++) target[j] += state.offset[j] * w;
  }
  state.since += dt;
  writePose(rig, target);
  state.last = target;
  return target;
}

/** Change level. Into far the skin goes away, so there is no pose to blend from when it comes back (it fades in). */
export function switchLevel(state: WolfLodState, level: WolfLevel) {
  if (level === state.level) return false;
  state.from = state.level; state.level = level; state.since = 0; state.mid = null; state.midT = 0; state.offset = null;
  state.pend = level !== 'far';
  if (level === 'far') state.last = null;
  return true;
}

export function newWolfLod(level: WolfLevel, blendS: number = WOLF_LOD.blendS, midHz: number = WOLF_LOD.midHz): WolfLodState {
  return { level, since: 0, offset: null, last: null, midT: 0, mid: null, pend: false, blendS, midHz, from: level };
}

// ---------- picture hook (animalPicture.ts calls this for wolves) ----------
export interface WolfShow { full: number; low: number; level: WolfLevel; bob: number }
export interface WolfBody { key: string; x: number; y: number; z: number; yaw: number; moving: boolean; motion: Motion; phase: number; speed: number; root: THREE.Object3D }

/** One skinned body per wolf: the rebound full mesh near, the low mesh mid, none far. Pools per level; state per key. */
export function createWolfLod(scene: THREE.Scene, ground?: (x: number, z: number) => number) {
  type Live = { spawn: SkinSpawn; rig: PoseRig; used: boolean };
  const pools = { near: [] as Live[], mid: [] as Live[] }, states = new Map<string, WolfLodState>();
  let tplFull: SkinTemplate | null = null, tplLow: SkinTemplate | null = null, seenKeys = new Set<string>(), lastSec = -1, dt = 1 / 60;
  const stats = { near: 0, mid: 0, far: 0 };
  function claim(level: 'near' | 'mid') {
    const pool = pools[level];
    let live = pool.find(l => !l.used);
    if (!live) {
      const spawn = spawnWolf(level === 'near' ? tplFull! : tplLow!);
      spawn.root.userData.animalPicture = true; spawn.root.userData.species = tplFull!.species; spawn.root.userData.wolfLod = level;
      scene.add(spawn.root);
      live = { spawn, rig: poseRig(spawn), used: false };
      pool.push(live);
    }
    live.used = true; live.spawn.root.visible = true;
    return live;
  }
  return {
    stats,
    /** Before the bodies of a frame. */
    begin(template: SkinTemplate | null) {
      if (template && tplFull?.species !== template.species) { tplFull = reboundTemplate(template); tplLow = lowTemplate(tplFull); }
      for (const pool of [pools.near, pools.mid]) for (const l of pool) { l.used = false; l.spawn.root.visible = false; }
      // blend and mid refresh run on the world clock (core/worldClock): a paused game holds them
      const now = worldSec(); dt = lastSec >= 0 ? Math.max(0, Math.min(0.1, now - lastSec)) : 1 / 60; lastSec = now;
      seenKeys = new Set(); stats.near = stats.mid = stats.far = 0;
    },
    /** One wolf. `room` = may it take a near / mid body under the ladder caps. */
    show(b: WolfBody, share: DetailShares, room: { near: boolean; mid: boolean }, setOpacity: (root: THREE.Object3D, o: number) => void): WolfShow {
      seenKeys.add(b.key);
      let st = states.get(b.key);
      let level = pickLevel(st?.level, share);
      if (level === 'near' && !room.near) level = room.mid ? 'mid' : 'far';
      if (level === 'mid' && !room.mid) level = 'far';
      if (!st) { st = newWolfLod(level); states.set(b.key, st); } else switchLevel(st, level);
      const out: WolfShow = { full: 0, low: 0, level, bob: level === 'far' ? speckBob(b.phase, b.moving) : 0 };
      if (level !== 'far' && tplFull && tplLow) {
        const live = claim(level);
        live.spawn.root.position.set(b.x, b.y, b.z); live.spawn.root.rotation.y = b.yaw;
        driveWolf(st, live.spawn, live.rig, level === 'near' ? tplFull : tplLow,
          { motion: b.motion, phase: b.phase, speed: b.speed, moving: b.moving, x: b.x, y: b.y, z: b.z, procRoot: b.key === 'player-wolf' ? b.root : undefined }, dt, ground);
        const o = Math.min(1, share.full + share.low);
        setOpacity(live.spawn.root, o);
        if (level === 'near') out.full = o; else out.low = o;
      }
      stats[level]++;
      return out;
    },
    /** After the bodies: forget wolves no longer in the picture. */
    end() { for (const k of [...states.keys()]) if (!seenKeys.has(k)) states.delete(k); },
  };
}
