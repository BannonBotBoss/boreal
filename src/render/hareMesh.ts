import * as THREE from 'three';
import { buildBody, type Vec3 } from '../core/body';
import { HARE_BONE, HARE_BONE_COUNT, HARE_EYE_AT, HARE_LEG_SEGS, HARE_SUMMER, HARE_TUBE, HARE_WINTER, hareLegBone, hareTubes, localWhiteness, moultWhiteness, sculptHare, type HareBind, type HareCoat } from '../animals/hareBody';
import { buildFurCards, furCardMaterial } from './furCards';

/**
 * Procedural furred snowshoe hare (Grok Bot, T-0028), assembled like render/playerWolf.ts and render/bear.ts: one skinned base
 * skin from the tube rings (animals/hareBody.ts) plus strand-textured fur cards (render/furCards.ts) on the same skeleton. The
 * skeleton is the bounding rig's: a body bone at the hip pivot (pitch), head and ear bones, and one bone per rig leg segment that
 * animals/hare.ts poseHare lays between the rig's joints each frame. No mesh file is loaded.
 *
 * Coat from the world date (setHareDay): Mills et al. 2013 moult whiteness, spread over the body (feet first in autumn). Fur
 * length and density follow Sheriff, Kuchel, Boutin & Humphries 2009 (J Mammal 90:761): guard hair 31.67 mm (autumn coat, 1-10
 * Oct) -> 43.19 mm (winter); hair density x2.28-2.48 in winter (downy 3,411.5 -> 7,788.8 per cm2, guard 57.0 -> 141.5), so a
 * summer hare shows .44 of the winter card count. Cards per hare from the wolf baseline (tasks/T-0028 draw-cost row).
 */
export const HARE_FUR = { cards: 7000, winterLength: .04319, summerLength: .03167, width: .013, summerDensity: .44, lean: .3, tone: .3, rootShade: .55, bareShade: .75, seed: 911 };
export interface HareLeg { segs: THREE.Bone[]; hind: boolean; /** first limbPoints index drawn (fore 0: the blade is a segment) */ from: number; /** bind direction of each segment (root space) */ dirs: THREE.Vector3[] }

interface Template { skin: THREE.BufferGeometry; fur: THREE.BufferGeometry; skinMat: THREE.Material; furMat: THREE.Material; eyeMat: THREE.Material; bind: HareBind; whiteness: number; cards: number }
let template: Template | undefined;
const SHARED = { shared: true };

function buildTemplate(bind: HareBind): Template {
  const bodyS = buildBody(hareTubes(bind, HARE_SUMMER)), clear = sculptHare(bodyS, bind);
  const bodyW = buildBody(hareTubes(bind, HARE_WINTER)); sculptHare(bodyW, bind);
  const F = HARE_FUR, shade = (furLen: number) => furLen >= .03 ? F.rootShade : F.bareShade;
  const skin = new THREE.BufferGeometry();
  skin.setAttribute('position', new THREE.Float32BufferAttribute(bodyS.position, 3));
  skin.setAttribute('normal', new THREE.Float32BufferAttribute(bodyS.normal, 3));
  const sCol = bodyS.color.map((c, i) => c * shade(bodyS.furLen[Math.floor(i / 3)])), wCol = bodyW.color.map((c, i) => c * shade(bodyW.furLen[Math.floor(i / 3)]));
  skin.setAttribute('color', new THREE.Float32BufferAttribute(sCol.slice(), 3));
  skin.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(bodyS.skinIndex, 4));
  skin.setAttribute('skinWeight', new THREE.Float32BufferAttribute(bodyS.skinWeight, 4));
  skin.setIndex(bodyS.index);
  skin.userData = { summer: sCol, winter: wCol, ...SHARED };
  // fur: the same seed, skin and filters give the same cards; only the colours differ between the two coats
  const head = bind.pivot[1] + bind.head[1], footY = .03;
  const tint = (coat: HareCoat) => (p: Vec3) => ({ color: coat.tip, amount: p[1] > footY && p[1] < head + .045 ? coat.tipAmount : 0 });
  // fur on the hind feet combs toward the toes (the snowshoe), on the ears up, elsewhere the skin's lay
  const comb = (p: Vec3) => p[1] < footY && p[2] > bind.pivot[2] - .16 ? { lay: [0, 0, -1] as Vec3, lean: .5 } : undefined;
  const opts = (coat: HareCoat, body: typeof bodyS) => buildFurCards(body, { count: F.cards, length: F.winterLength, width: F.width, seed: F.seed, clear, lean: F.lean, tone: F.tone, tipTint: tint(coat), comb });
  const fur = opts(HARE_SUMMER, bodyS), furW = opts(HARE_WINTER, bodyW);
  const n = fur.getAttribute('position').count, base = (fur.getAttribute('position').array as Float32Array).slice();
  const roots = new Float32Array(n * 3), rank = new Float32Array(n / 5);
  for (let c = 0; c < n / 5; c++) {
    for (let k = 0; k < 3; k++) { const r = (base[(c * 5) * 3 + k] + base[(c * 5 + 1) * 3 + k]) / 2; for (let v = 0; v < 5; v++) roots[(c * 5 + v) * 3 + k] = r; }
    const x = Math.sin(c * 12.9898 + 4.1) * 43758.5453; rank[c] = x - Math.floor(x); // which cards a summer coat keeps
  }
  fur.userData = { ...fur.userData, summer: (fur.getAttribute('color').array as Float32Array).slice(), winter: (furW.getAttribute('color').array as Float32Array).slice(), base, roots, rank, ...SHARED };
  furW.dispose();
  const skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }); skinMat.userData = SHARED;
  const furMat = furCardMaterial(); furMat.userData = SHARED;
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a0e07, roughness: .15 }); eyeMat.userData = SHARED;
  const t: Template = { skin, fur, skinMat, furMat, eyeMat, bind, whiteness: -1, cards: n / 5 };
  applyWhiteness(t, 0);
  return t;
}

/** Recolour and re-length the shared coat for a whole-coat whiteness (0 summer .. 1 winter); a no-op when unchanged. */
function applyWhiteness(t: Template, whole: number) {
  const W = Math.round(whole * 64) / 64; if (W === t.whiteness) return; t.whiteness = W;
  const F = HARE_FUR, sp = t.skin.getAttribute('position').array as Float32Array, sc = t.skin.getAttribute('color'), su = t.skin.userData;
  for (let v = 0; v < sc.count; v++) { const w = localWhiteness(W, sp[v * 3 + 1]); for (let k = 0; k < 3; k++) (sc.array as Float32Array)[v * 3 + k] = su.summer[v * 3 + k] + (su.winter[v * 3 + k] - su.summer[v * 3 + k]) * w; }
  sc.needsUpdate = true;
  const fu = t.fur.userData, fp = t.fur.getAttribute('position'), fc = t.fur.getAttribute('color'), P = fp.array as Float32Array, C = fc.array as Float32Array;
  for (let c = 0; c < fu.rank.length; c++) {
    const r = c * 15, w = localWhiteness(W, fu.roots[r + 1]);
    const keep = fu.rank[c] < F.summerDensity + (1 - F.summerDensity) * w, s = keep ? (F.summerLength + (F.winterLength - F.summerLength) * w) / F.winterLength : 0;
    for (let i = r; i < r + 15; i++) { P[i] = fu.roots[i] + (fu.base[i] - fu.roots[i]) * s; C[i] = fu.summer[i] + (fu.winter[i] - fu.summer[i]) * w; }
  }
  fp.needsUpdate = true; fc.needsUpdate = true;
}

/** Set every hare's coat from the world date (day of the year; core/timeOfDay dayAt). Returns the whole-coat whiteness. */
export function setHareDay(dayOfYear: number) { const w = moultWhiteness(dayOfYear); if (template) applyWhiteness(template, w); return w; }
/** Current coat state (tests, debug readout). */
export const hareCoatState = () => template ? { whiteness: template.whiteness, cards: template.cards, visibleCards: visibleCards(template) } : undefined;
function visibleCards(t: Template) { let n = 0; const P = t.fur.getAttribute('position').array as Float32Array, fu = t.fur.userData; for (let c = 0; c < fu.rank.length; c++) if (P[c * 15 + 12] !== fu.roots[c * 15 + 12] || P[c * 15 + 13] !== fu.roots[c * 15 + 13]) n++; return n; }

/** One hare: its own bones and skeleton over the shared skin, fur and materials. */
export function createHareMesh(bind: HareBind) {
  if (!template) template = buildTemplate(bind);
  const t = template, B = HARE_BONE, root = new THREE.Group(); root.name = 'hare';
  const bones = Array.from({ length: HARE_BONE_COUNT }, () => new THREE.Bone());
  const body = bones[B.body], head = bones[B.head], tail = bones[B.tail], ears = [bones[B.earL], bones[B.earR]];
  body.name = 'hare-body'; head.name = 'hare-head';
  body.position.set(...bind.pivot); root.add(body);
  head.position.set(...bind.head); body.add(head);
  ears.forEach((e, k) => { e.name = k ? 'ear-r' : 'ear-l'; e.position.set((k ? 1 : -1) * .014, .02, .012); head.add(e); });
  tail.position.set(0, .03, .06); body.add(tail);
  const legs: HareLeg[] = bind.limbs.map((P, leg) => {
    const segs = Array.from({ length: HARE_LEG_SEGS }, (_, s) => { const b = bones[hareLegBone(leg, s)]; b.name = `leg${leg}-${s}`; b.position.set(...P[s]); root.add(b); return b; });
    const dirs = segs.map((_, s) => new THREE.Vector3(P[s + 1][0] - P[s][0], P[s + 1][1] - P[s][1], P[s + 1][2] - P[s][2]).normalize());
    return { segs, hind: leg % 2 === 1, from: leg % 2 === 1 ? 1 : 0, dirs };
  });
  const skins = [new THREE.SkinnedMesh(t.skin, t.skinMat), new THREE.SkinnedMesh(t.fur, t.furMat)];
  skins.forEach((s, k) => { s.frustumCulled = false; s.name = k ? 'fur' : 'skin'; s.userData = SHARED; root.add(s); });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); skins.forEach(s => s.bind(skeleton));
  // eyes: large, dark, set on the side of the head (wide field of view), just proud of the socket
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.0075, 12, 10), t.eyeMat); eye.name = 'eye';
    eye.position.set(side * (HARE_EYE_AT[0] - .001), HARE_EYE_AT[1], HARE_EYE_AT[2]); eye.scale.set(.75, 1, 1.1); head.add(eye);
  }
  ears.forEach((e, k) => { e.rotation.z = (k ? -1 : 1) * .12; }); // splay a little outward
  return { root, body, head, ears, tail, legs, skins, tube: HARE_TUBE };
}
