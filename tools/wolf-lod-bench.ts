/**
 * Wolf LOD bench and realism numbers (#162 item 2): low mesh size, per-wolf cost per level, switch pop, footfall timing
 * and duty against Maes et al. 2008 (dogs, J Exp Biol 211:138), planted-paw slip, mesh-vs-bone drift, candy-wrapper
 * collapse, terrain feet. Node only: `npx tsx tools/wolf-lod-bench.ts [--json out.json]`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { ImageLoader } from 'three';
import { loadAnimalBuffer, resetAnimalModels } from '../src/render/animalModels';
import { skinnedVertex, type SkinTemplate } from '../src/render/meshySkin';
import { detailShares } from '../src/render/animalLadder';
import { gaitFor, WOLF_LEGS, type Motion } from '../src/core/animalBehavior';
import { WOLF_LOD, lowTemplate, reboundTemplate, spawnWolf, poseRig, readPose, driveWolf, newWolfLod, pickLevel, switchLevel, speckBob, terrainFeet, phaseCurve, resetWolfLod, type WolfLevel } from '../src/render/gaitLod';

export async function loadWolf(): Promise<SkinTemplate> {
  (globalThis as { self?: unknown }).self = globalThis;
  ImageLoader.prototype.load = function (_u: string, onLoad?: (d: HTMLImageElement) => void) { onLoad?.({ width: 1, height: 1 } as HTMLImageElement); return { width: 1, height: 1 } as HTMLImageElement; } as never;
  resetAnimalModels(); resetWolfLod();
  const buf = readFileSync('public/models/animals/gray-wolf.glb');
  const L = await loadAnimalBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'Gray Wolf');
  return L!.skin!;
}
const frac = (x: number) => ((x % 1) + 1) % 1;
const front = (i: number) => i % 2 === 0;

export const GAITS: { label: string; motion: Motion; speed: number }[] = [
  { label: 'walk', motion: 'walk', speed: 1.2 }, { label: 'trot', motion: 'run', speed: 2.6 }, { label: 'gallop', motion: 'run', speed: 7 },
];

/** Maes et al. 2008 (malinois dogs, 0.4-10 m/s): walk DF > 50%; DF falls below 50% above ~2 m/s; trot FL = HL = 50%,
 * PL 50%; rotary gallop FL and HL < 50% (their Table 1 and Fig. 4A, read from the text: bands, not their exact means). */
export const MAES = {
  walk: { duty: [0.5, 0.8], fl: [0.45, 0.55], hl: [0.45, 0.55] },
  trot: { duty: [0.3, 0.55], fl: [0.45, 0.55], hl: [0.45, 0.55], pl: [0.4, 0.6] },
  gallop: { duty: [0.15, 0.45], fl: [0.02, 0.45], hl: [0.02, 0.45] },
} as const;

export function footfalls() {
  return GAITS.map(g => {
    const gait = gaitFor(g.motion, g.speed, WOLF_LEGS)!;
    const o = gait.offsets, on = (i: number) => frac(-o[i]); // touchdown phase of leg i (planted while frac(phase + o) < duty)
    const fl = frac(on(2) - on(0)), hl = frac(on(3) - on(1)), pl = frac(on(1) - on(0));
    const lagSym = (x: number) => Math.min(x, 1 - x) === x ? x : 1 - x; // order of a pair is a labelling choice
    return { label: g.label, gait: gait.name, speed: g.speed, duty: gait.duty, stride: gait.cycle, fl: lagSym(fl), hl: lagSym(hl), pl, offsets: [...o] };
  });
}

/** Planted-paw slip and mesh-vs-bone drift over one stride at 240 Hz, body moving at speed·gaitScale. */
export function stanceSlip(tpl: SkinTemplate, motion: Motion, speed: number) {
  const s = spawnWolf(tpl), gait = gaitFor(motion, speed, WOLF_LEGS)!;
  const k = tpl.layout.kind === 'quad' ? tpl.layout.gaitScale : 1, mesh = s.meshes[0];
  const sw = mesh.geometry.getAttribute('skinWeight'), si = mesh.geometry.getAttribute('skinIndex');
  const bones = mesh.skeleton.bones, pawBone = [0, 1, 2, 3].map(i => bones.findIndex(b => b.name === `paw${i}`));
  // the sole: each mesh paw is the paw-level vertex cluster in that leg's quadrant (fore/hind by the bones' girdle midpoint,
  // side by that half's mean x); its sole vertex is the cluster vertex nearest the cluster centre
  s.root.updateMatrixWorld(true);
  const rest = new THREE.Vector3(), gp = mesh.geometry.getAttribute('position');
  const boneAt = pawBone.map(b => { bones[b].getWorldPosition(rest); return rest.clone(); });
  const zMid = (boneAt[0].z + boneAt[1].z) / 2, low: number[] = [];
  for (let v = 0; v < gp.count; v++) if (gp.getY(v) < 0.03) low.push(v);
  const half = [0, 1].map(h => { const xs = low.filter(v => (gp.getZ(v) >= zMid ? 1 : 0) === h).map(v => gp.getX(v)); return xs.reduce((q, x) => q + x, 0) / Math.max(1, xs.length); });
  const quad = (v: number) => { const h = gp.getZ(v) >= zMid ? 1 : 0, left = gp.getX(v) < half[h]; return h + (left === (boneAt[0].x < 0) ? 0 : 2); };
  const pawVert = [0, 1, 2, 3].map(i => {
    const mine = low.filter(v => quad(v) === i), cx = mine.reduce((q, v) => q + gp.getX(v), 0) / mine.length, cz = mine.reduce((q, v) => q + gp.getZ(v), 0) / mine.length;
    let best = mine[0], dd = 9; for (const v of mine) { const d = Math.hypot(gp.getX(v) - cx, gp.getZ(v) - cz); if (d < dd) { dd = d; best = v; } }
    let w = 0; for (let c = 0; c < 4; c++) if (new RegExp('^(paw|foot|lower)' + i + '$').test(bones[si.getComponent(best, c)].name)) w += sw.getComponent(best, c);
    return { v: best, w, distMm: Math.hypot(cx - boneAt[i].x, cz - boneAt[i].z) * 1000 };
  });
  const N = Math.round(240 * gait.cycle / speed) || 240; // foot paths are WOLF_LEGS metres times k, so one stride is cycle�k at speed�k
  const slip = [0, 0, 0, 0], drift = [0, 0, 0, 0], start: (THREE.Vector3 | null)[] = [null, null, null, null];
  const mslip = [0, 0, 0, 0], mstart: (THREE.Vector3 | null)[] = [null, null, null, null];
  const rel0: (number | null)[] = [null, null, null, null];
  const p = new THREE.Vector3();
  for (let n = 0; n <= N; n++) {
    const phase = n / N, x = -speed * k * (n / 240); // the body walks -Z (game forward)
    s.root.position.set(0, 0, x); s.pose(motion, phase, speed); s.root.updateMatrixWorld(true);
    for (let i = 0; i < 4; i++) {
      const u = frac(phase + gait.offsets[i]);
      const bone = bones[pawBone[i]];
      bone.getWorldPosition(p);
      const planted = u > 0.05 * gait.duty && u < 0.95 * gait.duty;
      if (planted) { if (!start[i]) start[i] = p.clone(); else slip[i] = Math.max(slip[i], Math.hypot(p.x - start[i]!.x, p.z - start[i]!.z)); }
      else start[i] = null;
      const vtx = skinnedVertex(mesh, pawVert[i].v).applyMatrix4(mesh.matrixWorld);
      if (planted) { if (!mstart[i]) mstart[i] = vtx.clone(); else mslip[i] = Math.max(mslip[i], Math.hypot(vtx.x - mstart[i]!.x, vtx.z - mstart[i]!.z)); } else mstart[i] = null;
      const d = vtx.distanceTo(p);
      if (rel0[i] === null) rel0[i] = d; else drift[i] = Math.max(drift[i], Math.abs(d - rel0[i]!));
    }
  }
  return { slipMm: slip.map(v => v * 1000), meshSlipMm: mslip.map(v => v * 1000), driftMm: drift.map(v => v * 1000), pawWeight: pawVert.map(v => v.w), pawToBoneMm: pawVert.map(v => v.distMm) };
}

/** Candy wrapper: skinned triangle area / rest area for leg-bound triangles (every third) over a stride; collapse shows as a
 * ratio near 0, a stretched sheet as a large one. */
export function wrapperRatio(tpl: SkinTemplate, motion: Motion, speed: number, steps = 24) {
  const s = spawnWolf(tpl), mesh = s.meshes[0], g = mesh.geometry, idx = g.index!;
  const si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight');
  const legBones = new Set(mesh.skeleton.bones.map((b, i) => /^(upper|lower|foot|paw)/.test(b.name) ? i : -1).filter(i => i >= 0));
  const tris: number[] = [];
  for (let t = 0; t < idx.count; t += 3) {
    const v = idx.getX(t); let w = 0; for (let c = 0; c < 4; c++) if (legBones.has(si.getComponent(v, c))) w += sw.getComponent(v, c);
    if (w > 0.5 && (t / 3) % 3 === 0) tris.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  }
  const area = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
  s.pose('idle', 0, 0);
  const rest = []; for (let t = 0; t < tris.length; t += 3) rest.push(area(skinnedVertex(mesh, tris[t]), skinnedVertex(mesh, tris[t + 1]), skinnedVertex(mesh, tris[t + 2])));
  const ratios: number[] = [];
  for (let k = 0; k < steps; k++) {
    s.pose(motion, k / steps, speed);
    s.root.updateMatrixWorld(true);
    for (let t = 0, j = 0; t < tris.length; t += 3, j++) if (rest[j] > 1e-8) ratios.push(area(skinnedVertex(mesh, tris[t]), skinnedVertex(mesh, tris[t + 1]), skinnedVertex(mesh, tris[t + 2])) / rest[j]);
  }
  ratios.sort((a, b) => a - b);
  return { tris: tris.length / 3, p01: ratios[Math.floor(ratios.length * 0.01)], min: ratios[0], median: ratios[ratios.length >> 1], p99: ratios[Math.floor(ratios.length * 0.99)], max: ratios[ratios.length - 1], under10pct: ratios.filter(r => r < 0.1).length / ratios.length };
}

function timeIt(fn: () => void, n: number) { for (let i = 0; i < Math.min(50, n); i++) fn(); const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t0) / n * 1000; }

/** Per-wolf CPU cost per level, microseconds per frame (pose + bone matrices; GPU skinning not included). */
export function levelCost(full: SkinTemplate, low: SkinTemplate, ground: (x: number, z: number) => number) {
  const out: Record<string, Record<string, number>> = {};
  for (const g of GAITS) {
    const sF = spawnWolf(full), rF = poseRig(sF), sL = spawnWolf(low), rL = poseRig(sL);
    const near = newWolfLod('near'), mid = newWolfLod('mid'); let ph = 0;
    const f = () => ({ motion: g.motion, phase: (ph = frac(ph + 0.013)), speed: g.speed, moving: true, x: 0, y: 0, z: 0 });
    phaseCurve(low, g.motion, g.speed);
    out[g.label] = {
      nearUs: timeIt(() => { driveWolf(near, sF, rF, full, f(), 1 / 60, ground); sF.root.updateMatrixWorld(true); sF.meshes[0].skeleton.update(); }, 400),
      nearNoTerrainUs: timeIt(() => { driveWolf(near, sF, rF, full, f(), 1 / 60); sF.root.updateMatrixWorld(true); sF.meshes[0].skeleton.update(); }, 400),
      midUs: timeIt(() => { const fr = f(); driveWolf(mid, sL, rL, low, fr, 1 / 60); if (mid.midT === 0) { sL.root.updateMatrixWorld(true); sL.meshes[0].skeleton.update(); } }, 400),
      farUs: timeIt(() => { speckBob(f().phase, true); }, 4000),
    };
  }
  return out;
}

/** A wolf trots out from 10 m to 150 m and back at 60 Hz. Pop = the one-frame change of a pose channel (rad, m) or a
 * paw's world position (mm) beyond what a near-only reference wolf at the same phase changes on that frame, worst over the
 * 0.3 s after each switch (`pop`) and elsewhere (`base`, the mid curve's own lag and 15 Hz steps). */
export function switchPop(full: SkinTemplate, low: SkinTemplate, blendS: number, midHz: number = WOLF_LOD.midHz, motion: Motion = 'run', speed = 2.6) {
  const sF = spawnWolf(full), rF = poseRig(sF), sL = spawnWolf(low), rL = poseRig(sL), sR = spawnWolf(full), rR = poseRig(sR);
  const st = newWolfLod('near', blendS, midHz), ref = newWolfLod('near', 0), gait = gaitFor(motion, speed, WOLF_LEGS)!;
  const dt = 1 / 60, T = 2 * 14;
  let prev: Float32Array | null = null, prevR: Float32Array | null = null, prevPaw: THREE.Vector3[] | null = null, prevPawR: THREE.Vector3[] | null = null;
  let level: WolfLevel = 'near', since = 99, switches = 0, kind = '';
  const byKind: Record<string, { rad: number; pawMm: number; d: number }> = {};
  const pop = { rad: 0, m: 0, pawMm: 0, at: '' }, base = { rad: 0, m: 0, pawMm: 0, at: '' }, p = new THREE.Vector3();
  const paws = (root: THREE.Object3D) => { root.updateMatrixWorld(true); return [0, 1, 2, 3].map(i => { root.getObjectByName('paw' + i)!.getWorldPosition(p); return p.clone(); }); };
  for (let n = 0; n < T / dt; n++) {
    const t = n * dt, u = t < T / 2 ? t / (T / 2) : 2 - t / (T / 2), d = 10 + 140 * u;
    const next = pickLevel(level, detailShares(d));
    if (switchLevel(st, next)) { kind = level + '>' + next; level = next; since = 0; switches++; byKind[kind] ??= { rad: 0, pawMm: 0, d }; }
    since += dt;
    const phase = frac(t * speed / gait.cycle), fr = { motion, phase, speed, moving: true, x: 0, y: 0, z: 0 };
    const poseR = driveWolf(ref, sR, rR, full, fr, dt), pawR = paws(sR.root);
    if (level === 'far') { prev = null; prevPaw = null; prevR = poseR.slice(); prevPawR = pawR; continue; }
    const s = level === 'near' ? sF : sL, r = level === 'near' ? rF : rL, tpl = level === 'near' ? full : low;
    const pose = driveWolf(st, s, r, tpl, fr, dt), pw = paws(s.root);
    if (prev && prevR) {
      const into = since < 0.3 ? pop : base;
      for (let j = 0; j < pose.length; j++) {
        const ex = Math.abs(pose[j] - prev[j]) - Math.abs(poseR[j] - prevR[j]);
        if (j % 4 < 2 ? ex > into.rad : ex > into.m) { if (j % 4 < 2) into.rad = ex; else into.m = ex; into.at = rR.nodes[j >> 2].name + ' d=' + d.toFixed(1) + ' ' + level; }
      }
      if (prevPaw && prevPawR) for (let i = 0; i < 4; i++) into.pawMm = Math.max(into.pawMm, (pw[i].distanceTo(prevPaw[i]) - pawR[i].distanceTo(prevPawR[i])) * 1000);
      if (since < 0.3 && byKind[kind]) {
        const k = byKind[kind];
        for (let j = 0; j < pose.length; j++) if (j % 4 < 2) k.rad = Math.max(k.rad, Math.abs(pose[j] - prev[j]) - Math.abs(poseR[j] - prevR[j]));
        if (prevPaw && prevPawR) for (let i = 0; i < 4; i++) k.pawMm = Math.max(k.pawMm, (pw[i].distanceTo(prevPaw[i]) - pawR[i].distanceTo(prevPawR[i])) * 1000);
      }
    }
    prev = pose.slice(); prevR = poseR.slice(); prevPaw = pw; prevPawR = pawR;
  }
  return { blendS, midHz, switches, pop, base, byKind };
}

/** Terrain feet on a 1:4 slope: planted paw height above the ground, before and after the solve. */
export function terrainCheck(full: SkinTemplate) {
  const s = spawnWolf(full), ground = (_x: number, z: number) => -0.25 * z;
  const res = { beforeMm: 0, afterMm: 0 }, p = new THREE.Vector3();
  const gait = gaitFor('walk', 1.2, WOLF_LEGS)!;
  for (let n = 0; n < 24; n++) {
    const phase = n / 24; s.root.position.set(0, 0, 0); s.pose('walk', phase, 1.2); s.root.updateMatrixWorld(true);
    const planted = [0, 1, 2, 3].filter(i => frac(phase + gait.offsets[i]) < gait.duty * 0.9);
    const err = () => Math.max(...planted.map(i => { s.root.getObjectByName(`paw${i}`)!.getWorldPosition(p); return Math.abs(p.y - (ground(p.x, p.z) + pawY0[i])); }));
    if (n === 0) var pawY0 = [0, 1, 2, 3].map(i => { s.root.getObjectByName(`paw${i}`)!.getWorldPosition(p); return p.y; });
    res.beforeMm = Math.max(res.beforeMm, err() * 1000);
    terrainFeet(s.root, ground, 0);
    res.afterMm = Math.max(res.afterMm, err() * 1000);
  }
  return res;
}

if (process.argv[1]?.endsWith('wolf-lod-bench.ts')) {
  const full = await loadWolf();
  const meshy = full; const t1 = performance.now(); const rb = reboundTemplate(meshy); const rbMs = performance.now() - t1;
  const t0 = performance.now(); const low = lowTemplate(rb); const lowMs = performance.now() - t0;
  const out = {
    mesh: { fullTris: full.tris, fullVerts: full.geometries[0].getAttribute('position').count, lowTris: low.tris, lowVerts: low.geometries[0].getAttribute('position').count, lowBuildMs: lowMs, rebindMs: rbMs, cellM: WOLF_LOD.cellM },
    footfalls: footfalls(),
    slipMeshy: Object.fromEntries(GAITS.map(g => [g.label, stanceSlip(meshy, g.motion, g.speed)])),
    slip: Object.fromEntries(GAITS.map(g => [g.label, stanceSlip(rb, g.motion, g.speed)])),
    slipLow: Object.fromEntries(GAITS.map(g => [g.label, stanceSlip(low, g.motion, g.speed)])),
    wrapperMeshy: Object.fromEntries(GAITS.map(g => [g.label, wrapperRatio(meshy, g.motion, g.speed)])),
    wrapper: Object.fromEntries(GAITS.map(g => [g.label, wrapperRatio(rb, g.motion, g.speed)])),
    terrain: terrainCheck(full),
    cost: levelCost(rb, low, (_x, z) => 0.05 * Math.sin(z * 2)),
    pop: [switchPop(rb, low, WOLF_LOD.blendS), switchPop(rb, low, 0), switchPop(rb, low, WOLF_LOD.blendS, 60), switchPop(rb, low, 0, 60), switchPop(rb, low, WOLF_LOD.blendS, 15)],
  };
  console.log(JSON.stringify(out, (_k, v) => typeof v === 'number' ? Math.round(v * 1000) / 1000 : v, 1));
  const at = process.argv.indexOf('--json'); if (at > 0) writeFileSync(process.argv[at + 1], JSON.stringify(out, null, 1));
}