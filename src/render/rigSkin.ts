import * as THREE from 'three';
import { buildBody, type Vec3 } from '../core/body';
import { RIG_BONE, RIG_BONE_COUNT, RIG_LEG_SEGS, RIG_TUBE, localWhiteness, rigLegBone, rigTubes, sculptRig, seasonalWhiteness, type CoatPalette, type RigBind, type SkinSpec } from '../core/rigBody';
import { buildFurCards, furCardMaterial } from './furCards';
import { stream } from '../proc/rng';

/**
 * Rig-skinned furred body (Grok Bot, T-0028), assembled like render/playerWolf.ts and render/bear.ts: one skinned base skin from
 * the tube rings of a SkinSpec (core/rigBody.ts) plus strand-textured fur cards (render/furCards.ts) on the same skeleton. The
 * skeleton is the bounding rig's: a body bone at the hip pivot (pitch), head and ear bones, a tail bone, and one bone per rig leg
 * segment that the host (animals/hare.ts poseHare) lays between the rig's joints each frame. No mesh file is loaded.
 * Coat from the world date (setCoatDay): the spec's moult whiteness spread over the body; summer shows `summerDensity` of the
 * cards at summerLength / winterLength of the winter length. Geometry and materials are shared by every animal of one spec.
 */
export interface RigLeg { segs: THREE.Bone[]; hind: boolean; /** first limbPoints index drawn (fore 0: the blade is a segment) */ from: number; /** bind direction of each segment (root space) */ dirs: THREE.Vector3[] }

interface Template { spec: SkinSpec; skin: THREE.BufferGeometry; fur: THREE.BufferGeometry; skinMat: THREE.Material; furMat: THREE.Material; eyeMat: THREE.Material; whiteness: number; cards: number }
const templates = new Map<string, Template>(), wanted = new Map<string, number>(); // whiteness asked for before the first build
const SHARED = { shared: true };

function buildTemplate(bind: RigBind, spec: SkinSpec): Template {
  const bodyS = buildBody(rigTubes(bind, spec, spec.summer)), clear = sculptRig(bodyS, bind, spec);
  const bodyW = buildBody(rigTubes(bind, spec, spec.winter)); sculptRig(bodyW, bind, spec);
  const F = spec.fur, shade = (furLen: number) => furLen >= .03 ? F.rootShade : F.bareShade;
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.Float32BufferAttribute(bodyS.position, 3));
  skin.setAttribute('normal', new THREE.Float32BufferAttribute(bodyS.normal, 3));
  const sCol = bodyS.color.map((c, i) => c * shade(bodyS.furLen[Math.floor(i / 3)])), wCol = bodyW.color.map((c, i) => c * shade(bodyW.furLen[Math.floor(i / 3)]));
  skin.setAttribute('color', new THREE.Float32BufferAttribute(sCol.slice(), 3));
  skin.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bodyS.skinIndex, 4));
  skin.setAttribute('skinWeight', new THREE.Float32BufferAttribute(bodyS.skinWeight, 4));
  skin.setIndex(bodyS.index);
  skin.userData = { summer: sCol, winter: wCol, ...SHARED };
  // fur: the same seed, skin and filters give the same cards (tipTint always answers, so the random sequence matches); only the colours differ
  const head = bind.pivot[1] + bind.head[1], footY = .03;
  const tint = (coat: CoatPalette) => (p: Vec3) => ({ color: coat.tip, amount: p[1] > footY && p[1] < head + .045 ? coat.tipAmount : 0 });
  const comb = (p: Vec3) => p[1] < footY && p[2] > bind.pivot[2] - .16 ? { lay: [0, 0, -1] as Vec3, lean: .5 } : undefined; // foot fur combs toward the toes
  const cards = (coat: CoatPalette, body: typeof bodyS) => buildFurCards(body, { count: F.cards, length: F.winterLength, width: F.width, seed: F.seed, clear, lean: F.lean, tone: F.tone, tipTint: tint(coat), comb });
  const fur = cards(spec.summer, bodyS), furW = cards(spec.winter, bodyW);
  const n = fur.getAttribute('position').count, base = (fur.getAttribute('position').array as Float32Array).slice();
  const roots = new Float32Array(n * 3), rank = new Float32Array(n / 5), rnd = stream(F.seed, `${spec.name}-coat-rank`);
  for (let c = 0; c < n / 5; c++) {
    for (let k = 0; k < 3; k++) { const r = (base[(c * 5) * 3 + k] + base[(c * 5 + 1) * 3 + k]) / 2; for (let v = 0; v < 5; v++) roots[(c * 5 + v) * 3 + k] = r; }
    rank[c] = rnd(); // which cards a summer coat keeps
  }
  fur.userData = { ...fur.userData, summer: (fur.getAttribute('color').array as Float32Array).slice(), winter: (furW.getAttribute('color').array as Float32Array).slice(), base, roots, rank, ...SHARED };
  furW.dispose();
  const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }); skinMat.userData = SHARED;
  const furMat = furCardMaterial(); furMat.userData = SHARED;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a0e07, roughness: .15 }); eyeMat.userData = SHARED;
  const t: Template = { spec, skin, fur, skinMat, furMat, eyeMat, whiteness: -1, cards: n / 5 };
  applyWhiteness(t, wanted.get(spec.name) ?? 0);
  return t;
}

/** Recolour and re-length the shared coat for a whole-coat whiteness (0 summer .. 1 winter); a no-op when unchanged. */
function applyWhiteness(t: Template, whole: number) {
  const W = Math.round(whole * 64) / 64; if (W === t.whiteness) return; t.whiteness = W;
  const F = t.spec.fur, M = t.spec.moult, sp = t.skin.getAttribute('position').array as Float32Array, sc = t.skin.getAttribute('color'), su = t.skin.userData;
  for (let v = 0; v < sc.count; v++) { const w = localWhiteness(W, sp[v * 3 + 1], M); for (let k = 0; k < 3; k++) (sc.array as Float32Array)[v * 3 + k] = su.summer[v * 3 + k] + (su.winter[v * 3 + k] - su.summer[v * 3 + k]) * w; }
  sc.needsUpdate = true;
  const fu = t.fur.userData, fp = t.fur.getAttribute('position'), fc = t.fur.getAttribute('color'), P = fp.array as Float32Array, C = fc.array as Float32Array;
  for (let c = 0; c < fu.rank.length; c++) {
    const r = c * 15, w = localWhiteness(W, fu.roots[r + 1], M);
    const keep = fu.rank[c] < F.summerDensity + (1 - F.summerDensity) * w, s = keep ? (F.summerLength + (F.winterLength - F.summerLength) * w) / F.winterLength : 0;
    for (let i = r; i < r + 15; i++) { P[i] = fu.roots[i] + (fu.base[i] - fu.roots[i]) * s; C[i] = fu.summer[i] + (fu.winter[i] - fu.summer[i]) * w; }
  }
  fp.needsUpdate = true; fc.needsUpdate = true;
}

/** Set the coat of every animal of a spec from the world date (day of the year; core/timeOfDay dayAt). Returns the whiteness. */
export function setCoatDay(spec: SkinSpec, dayOfYear: number) { const w = seasonalWhiteness(dayOfYear, spec.moult); wanted.set(spec.name, w); const t = templates.get(spec.name); if (t) applyWhiteness(t, w); return w; }
/** Current coat state of a spec (tests, debug readout). */
export function coatState(spec: SkinSpec) { const t = templates.get(spec.name); if (!t) return undefined;
  let n = 0; const P = t.fur.getAttribute('position').array as Float32Array, fu = t.fur.userData; for (let c = 0; c < fu.rank.length; c++) if (P[c * 15 + 12] !== fu.roots[c * 15 + 12] || P[c * 15 + 13] !== fu.roots[c * 15 + 13]) n++;
  return { whiteness: t.whiteness, cards: t.cards, visibleCards: n }; }

/** One animal: its own bones and skeleton over the spec's shared skin, fur and materials. */
export function createRigSkin(bind: RigBind, spec: SkinSpec) {
  let t = templates.get(spec.name); if (!t) { t = buildTemplate(bind, spec); templates.set(spec.name, t); }
  const B = RIG_BONE, root = new THREE.Group(); root.name = spec.name;
  const bones = Array.from({ length: RIG_BONE_COUNT }, () => new THREE.Bone());
  const body = bones[B.body], head = bones[B.head], tail = bones[B.tail], ears = [bones[B.earL], bones[B.earR]];
  body.name = 'rig-body'; head.name = 'rig-head';
  body.position.set(...bind.pivot); root.add(body);
  head.position.set(...bind.head); body.add(head);
  ears.forEach((e, k) => { e.name = k ? 'ear-r' : 'ear-l'; e.position.set((k ? 1 : -1) * spec.ear.base[0], spec.ear.base[1], spec.ear.base[2]); head.add(e); });
  const tb = spec.tail[0]; tail.position.set(0, tb.y, tb.z); body.add(tail);
  const legs: RigLeg[] = bind.limbs.map((P, leg) => {
    const segs = Array.from({ length: RIG_LEG_SEGS }, (_, s) => { const b = bones[rigLegBone(leg, s)]; b.name = `leg${leg}-${s}`; b.position.set(...P[s]); root.add(b); return b; });
    const dirs = segs.map((_, s) => new THREE.Vector3(P[s + 1][0] - P[s][0], P[s + 1][1] - P[s][1], P[s + 1][2] - P[s][2]).normalize());
    return { segs, hind: leg % 2 === 1, from: leg % 2 === 1 ? 1 : 0, dirs };
  });
  const skins = [new THREE.SkinnedMesh(t.skin, t.skinMat), new THREE.SkinnedMesh(t.fur, t.furMat)];
  skins.forEach((s, k) => { s.frustumCulled = false; s.name = k ? 'fur' : 'skin'; s.userData = SHARED; root.add(s); });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); skins.forEach(s => s.bind(skeleton));
  for (const side of [-1, 1]) { // eyes: large, dark, on the side of the head, just proud of the socket
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.0082, 12, 10), t.eyeMat); eye.name = 'eye';
    eye.position.set(side * (spec.eye[0] - .001), spec.eye[1], spec.eye[2]); eye.scale.set(.75, 1, 1.1); head.add(eye);
  }
  ears.forEach((e, k) => { e.rotation.z = (k ? -1 : 1) * .12; }); // splay a little outward
  return { root, body, head, ears, tail, legs, skins, tube: RIG_TUBE };
}
