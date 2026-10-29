/**
 * Skin a stored Meshy mesh onto the gait the animal already has (issues #156, #160, #162).
 * Bones are the quadruped chain poseWolfRig already drives (girdle, upper, lower, foot, paw),
 * or the bird skeleton's body, wings and legs. They are fitted to the mesh bounds. Vertices
 * take their skin weights from the nearest bones. quadrupedPose supplies the angles:
 * canids use WOLF_LEGS (the measured canid gait); every other mammal uses its own leg row.
 */
import * as THREE from 'three';
import {
  WOLF_LEGS, DEER_LEGS, quadrupedPose, pelvisShift, limbOf, type LegDims, type LimbDims, type Motion,
} from '../core/animalBehavior';
import { BEAR_LEGS } from '../core/bearBody';
import { MAMMALS, MAMMAL_PLANS, BIRD_GROUPS } from '../core/species';
import type { MammalPlan } from '../core/skeleton';

/** WOLF_LEGS is the 0.82 m shoulder wolf in animalBehavior.ts. Bone lengths scale onto the species row. */
const WOLF_LEG_SHOULDER = 0.82;
/** BEAR_LEGS matches the 1.05 m hump in bearBody.ts. */
const BEAR_LEG_SHOULDER = 1.05;
/** Wing flap, radians. Inside the bird humerus ball range (skeleton.ts, about ±80°). [game calibration] */
const WING_FLAP = 0.6;

export interface Segment {
  ax: number; ay: number; az: number;
  bx: number; by: number; bz: number;
  index: number;
  radius: number;
}

export interface QuadLayout {
  kind: 'quad';
  legs: LegDims;
  /** Multiply wolf-gait metres (bob, pelvis) onto this body. 1 when the gait legs are already this body. */
  gaitScale: number;
  useWolfGait: boolean;
  x: number;
  zFront: number;
  zHind: number;
  noseZ: number;
  tailZ: number;
  bodyR: number;
  legR: number;
  headR: number;
}

export interface BirdLayout {
  kind: 'bird';
  wingSpan: number;
  wingY: number;
  bodyY: number;
  hip: number;
  legX: number;
  legZ: number;
  headZ: number;
  tailZ: number;
  bodyR: number;
  legR: number;
  headR: number;
}

export type SkinLayout = QuadLayout | BirdLayout;

export interface SkinTemplate {
  species: string;
  layout: SkinLayout;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  height: number;
  width: number;
  depth: number;
  tris: number;
}

export interface SkinSpawn {
  root: THREE.Group;
  meshes: THREE.SkinnedMesh[];
  pose: (motion: Motion, phase: number, speed: number) => void;
}

function scaleLimb(L: LimbDims, k: number): LimbDims {
  return {
    hip: L.hip * k, upper: L.upper * k, lower: L.lower * k,
    foot: L.foot === undefined ? undefined : L.foot * k,
    footAngle: L.footAngle, footFlex: L.footFlex,
    girdle: L.girdle === undefined ? undefined : L.girdle * k,
    girdleRest: L.girdleRest, girdleSwing: L.girdleSwing,
    stance: L.stance === undefined ? undefined : L.stance * k,
    bend: L.bend,
  };
}

function scaleLegs(legs: LegDims, k: number): LegDims {
  return { ...scaleLimb(legs, k), hind: legs.hind ? scaleLimb(legs.hind, k) : undefined };
}

/** Leg row from the mammal plan ratios (already the species shape) when no dedicated gait row exists. */
function legsFromPlan(p: MammalPlan, shoulder: number): LegDims {
  const plant = p.posture === 'plantigrade';
  const ung = p.posture === 'unguligrade';
  const [girdle, upper, lower, foot] = p.fore;
  const h = p.hind;
  const fore: LimbDims = {
    hip: shoulder * (plant ? 0.7 : ung ? 0.95 : 0.78),
    upper: upper * shoulder, lower: lower * shoulder, foot: Math.max(0.02, foot * shoulder),
    girdle: girdle * shoulder, girdleRest: plant ? 0.3 : 0.5, girdleSwing: 0.3,
    footAngle: plant ? 1.2 : ung ? 0.2 : 0.05, footFlex: 0.8, bend: 'back',
    stance: Math.max(0.01, girdle * shoulder * 0.4),
  };
  const hind: LimbDims = {
    hip: shoulder * (plant ? 0.72 : ung ? 1.0 : 0.8),
    upper: h[1] * shoulder, lower: h[2] * shoulder, foot: Math.max(0.02, h[3] * shoulder),
    footAngle: plant ? 1.4 : 0.45, footFlex: 0.9, bend: 'forward',
    stance: Math.max(0.01, h[3] * shoulder * 0.35),
  };
  return { ...fore, hind };
}

export interface GaitFit { legs: LegDims; useWolfGait: boolean; gaitScale: number }

/** Which existing leg row drives this species, scaled onto its shoulder. */
export function legsForSpecies(name: string): GaitFit | null {
  const row = MAMMALS.find(r => r[0] === name);
  if (!row) return null;
  const arch = row[1];
  const shoulder = row[2];
  if (arch === 'canid') return { legs: scaleLegs(WOLF_LEGS, shoulder / WOLF_LEG_SHOULDER), useWolfGait: true, gaitScale: shoulder / WOLF_LEG_SHOULDER };
  if (arch === 'felid') return { legs: scaleLegs(WOLF_LEGS, shoulder / WOLF_LEG_SHOULDER), useWolfGait: false, gaitScale: 1 };
  if (arch === 'cervid') return { legs: scaleLegs(DEER_LEGS, shoulder / 1), useWolfGait: false, gaitScale: 1 };
  if (arch === 'ursid') return { legs: scaleLegs(BEAR_LEGS, shoulder / BEAR_LEG_SHOULDER), useWolfGait: false, gaitScale: 1 };
  return { legs: legsFromPlan(MAMMAL_PLANS[arch], shoulder), useWolfGait: false, gaitScale: 1 };
}

export function isBirdPlan(name: string) {
  return BIRD_GROUPS.some(r => r[0] === name);
}

function pointSeg2(px: number, py: number, pz: number, s: Segment) {
  const abx = s.bx - s.ax, aby = s.by - s.ay, abz = s.bz - s.az;
  const apx = px - s.ax, apy = py - s.ay, apz = pz - s.az;
  const ab2 = abx * abx + aby * aby + abz * abz || 1e-8;
  let t = (apx * abx + apy * aby + apz * abz) / ab2;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const dx = s.ax + abx * t - px, dy = s.ay + aby * t - py, dz = s.az + abz * t - pz;
  return dx * dx + dy * dy + dz * dz;
}

/** Four nearest bones, inverse-distance (Gaussian) weights, normalised. */
export function proximityWeights(positions: ArrayLike<number>, segs: readonly Segment[]) {
  const n = positions.length / 3;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const idx = [0, 0, 0, 0];
  const w = [0, 0, 0, 0];
  for (let v = 0; v < n; v++) {
    const px = positions[v * 3], py = positions[v * 3 + 1], pz = positions[v * 3 + 2];
    w[0] = w[1] = w[2] = w[3] = 0;
    idx[0] = idx[1] = idx[2] = idx[3] = 0;
    let nearest = 0, nearestD = Infinity;
    for (let s = 0; s < segs.length; s++) {
      const seg = segs[s];
      const d2 = pointSeg2(px, py, pz, seg);
      if (d2 < nearestD) { nearestD = d2; nearest = seg.index; }
      const influence = Math.exp(-d2 / (2 * seg.radius * seg.radius));
      let place = 4;
      for (let k = 0; k < 4; k++) if (influence > w[k]) { place = k; break; }
      if (place === 4) continue;
      for (let k = 3; k > place; k--) { w[k] = w[k - 1]; idx[k] = idx[k - 1]; }
      w[place] = influence; idx[place] = seg.index;
    }
    let sum = w[0] + w[1] + w[2] + w[3];
    if (sum < 1e-8) { idx[0] = nearest; w[0] = 1; w[1] = w[2] = w[3] = 0; sum = 1; }
    const o = v * 4;
    skinIndex[o] = idx[0]; skinIndex[o + 1] = idx[1]; skinIndex[o + 2] = idx[2]; skinIndex[o + 3] = idx[3];
    skinWeight[o] = w[0] / sum; skinWeight[o + 1] = w[1] / sum; skinWeight[o + 2] = w[2] / sum; skinWeight[o + 3] = w[3] / sum;
  }
  return { skinIndex, skinWeight };
}

interface Built {
  pivot: THREE.Object3D;
  bones: THREE.Bone[];
  pose: (motion: Motion, phase: number, speed: number) => void;
  segments: (radius: { body: number; leg: number; head: number }) => Segment[];
}

function tip(bone: THREE.Bone, local: THREE.Vector3, out: THREE.Vector3) {
  return bone.localToWorld(out.copy(local));
}

function seg(index: number, a: THREE.Vector3, b: THREE.Vector3, radius: number, inv: THREE.Matrix4): Segment {
  a.applyMatrix4(inv); b.applyMatrix4(inv);
  return { ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, index, radius };
}

function buildQuad(layout: QuadLayout): Built {
  const bones: THREE.Bone[] = [];
  const bone = (name: string) => { const b = new THREE.Bone(); b.name = name; bones.push(b); return b; };
  const tilt = new THREE.Group(); tilt.name = 'tilt';
  const torso = bone('torso');
  const head = bone('head');
  const tail = bone('tail');
  tilt.add(torso); torso.add(head); torso.add(tail);
  head.position.set(0, layout.legs.hip * 0.25, layout.noseZ * 0.45);
  tail.position.set(0, 0, layout.zHind);
  const chains = [0, 1, 2, 3].map(i => {
    const L = limbOf(layout.legs, i);
    const girdle = bone(`girdle${i}`), upper = bone(`upper${i}`), lower = bone(`lower${i}`), foot = bone(`foot${i}`), paw = bone(`paw${i}`);
    const x = (i < 2 ? -1 : 1) * layout.x;
    const z = i % 2 === 0 ? layout.zFront : layout.zHind;
    girdle.position.set(x, L.hip + (L.girdle ?? 0), z);
    upper.position.y = -(L.girdle ?? 0);
    lower.position.y = -L.upper;
    foot.position.y = -L.lower;
    paw.position.y = -(L.foot ?? 0);
    tilt.add(girdle); girdle.add(upper); upper.add(lower); lower.add(foot); foot.add(paw);
    return { girdle, upper, lower, foot, paw, x, z };
  });
  const pose = (motion: Motion, phase: number, speed: number) => {
    const src = layout.useWolfGait ? WOLF_LEGS : layout.legs;
    const p = quadrupedPose(motion, phase, 0, src, speed);
    const k = layout.useWolfGait ? layout.gaitScale : 1;
    tilt.rotation.set(p.pitch, 0, 0);
    tilt.position.set(0, (p.bob + p.shift.y) * k, p.shift.z * k);
    const pel = pelvisShift(p.spineFlex);
    chains.forEach((c, i) => {
      const L = limbOf(layout.legs, i);
      const hind = i % 2 === 1;
      c.girdle.position.set(c.x, L.hip + (L.girdle ?? 0) + (hind ? pel.y * k : 0), c.z + (hind ? pel.z * k : 0));
      c.girdle.rotation.x = p.girdles[i] - p.pitch;
      c.upper.rotation.x = p.legs[i];
      c.lower.rotation.x = p.knees[i];
      c.foot.rotation.x = p.wrists[i];
      c.paw.rotation.x = p.paws[i];
    });
    head.rotation.x = motion === 'idle' ? 0 : Math.sin(phase * Math.PI * 2) * 0.08;
    tail.rotation.y = motion === 'idle' ? 0 : Math.sin(phase * Math.PI * 2) * 0.2;
  };
  const segments = (radius: { body: number; leg: number; head: number }) => {
    const inv = new THREE.Matrix4();
    const out: Segment[] = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const push = (index: number, boneA: THREE.Bone, boneB: THREE.Object3D | null, localTip: THREE.Vector3 | null, r: number) => {
      boneA.getWorldPosition(a);
      if (boneB) boneB.getWorldPosition(b);
      else tip(boneA, localTip!, b);
      out.push(seg(index, a, b, r, inv));
    };
    // inv is filled by the caller via update; we invert the pivot's parent (the skinned root) below.
    return { fill(root: THREE.Object3D) {
      root.updateMatrixWorld(true);
      inv.copy(root.matrixWorld).invert();
      out.length = 0;
      push(0, torso, null, new THREE.Vector3(0, 0, layout.zFront), radius.body);
      push(1, head, null, new THREE.Vector3(0, layout.legs.hip * 0.1, layout.noseZ * 0.35), radius.head);
      push(2, tail, null, new THREE.Vector3(0, 0, Math.max(0.05, layout.tailZ - layout.zHind)), radius.body * 0.4);
      chains.forEach((c, i) => {
        const base = 3 + i * 5;
        push(base, c.girdle, c.upper, null, radius.leg);
        push(base + 1, c.upper, c.lower, null, radius.leg);
        push(base + 2, c.lower, c.foot, null, radius.leg);
        push(base + 3, c.foot, c.paw, null, radius.leg);
        push(base + 4, c.paw, null, new THREE.Vector3(0, -0.04, 0), radius.leg);
      });
      return out;
    } };
  };
  // segments() returns a filler; wrap so Built.segments matches the signature used below.
  const filler = segments({ body: 1, leg: 1, head: 1 });
  return {
    pivot: tilt, bones, pose,
    segments: (radius) => filler.fill((tilt.parent ?? tilt) as THREE.Object3D).map((s, i) => {
      const r = i === 1 ? radius.head : i < 3 ? radius.body : radius.leg;
      return { ...s, radius: r };
    }),
  };
}

function buildBird(layout: BirdLayout): Built {
  const bones: THREE.Bone[] = [];
  const bone = (name: string) => { const b = new THREE.Bone(); b.name = name; bones.push(b); return b; };
  const pivot = new THREE.Group();
  const body = bone('body'); body.position.y = layout.bodyY; pivot.add(body);
  const head = bone('head'); head.position.set(0, layout.bodyY * 0.15, layout.headZ - 0); body.add(head);
  head.position.z = layout.headZ * 0.5;
  const tail = bone('tail'); tail.position.set(0, 0, layout.tailZ * 0.5); body.add(tail);
  const wingL = bone('wingL'); wingL.position.set(-layout.wingSpan * 0.15, 0, 0); body.add(wingL);
  const wingR = bone('wingR'); wingR.position.set(layout.wingSpan * 0.15, 0, 0); body.add(wingR);
  const legs = ([-1, 1] as const).map(side => {
    const upper = bone(side < 0 ? 'legL' : 'legR');
    const lower = bone(side < 0 ? 'legL2' : 'legR2');
    const foot = bone(side < 0 ? 'legL3' : 'legR3');
    upper.position.set(side * layout.legX, -layout.bodyY + layout.hip, layout.legZ);
    lower.position.y = -layout.hip * 0.55;
    foot.position.y = -layout.hip * 0.4;
    body.add(upper); upper.add(lower); lower.add(foot);
    return { upper, lower, foot };
  });
  const pose = (motion: Motion, phase: number, _speed: number) => {
    const flap = motion === 'idle' ? 0 : Math.sin(phase * Math.PI * 2) * WING_FLAP;
    wingL.rotation.z = flap; wingR.rotation.z = -flap;
    const step = motion === 'idle' ? 0 : Math.sin(phase * Math.PI * 2) * 0.45;
    legs[0].upper.rotation.x = step; legs[1].upper.rotation.x = -step;
    legs[0].lower.rotation.x = Math.max(0, -step); legs[1].lower.rotation.x = Math.max(0, step);
  };
  const segments = (radius: { body: number; leg: number; head: number }) => {
    const root = (pivot.parent ?? pivot) as THREE.Object3D;
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    const out: Segment[] = [];
    const push = (index: number, boneA: THREE.Bone, localTip: THREE.Vector3, r: number) => {
      boneA.getWorldPosition(a);
      tip(boneA, localTip, b);
      out.push(seg(index, a, b, r, inv));
    };
    push(0, body, new THREE.Vector3(0, 0, layout.tailZ * 0.3), radius.body);
    push(1, head, new THREE.Vector3(0, 0, layout.headZ * 0.4), radius.head);
    push(2, tail, new THREE.Vector3(0, 0, layout.tailZ * 0.35), radius.body * 0.35);
    push(3, wingL, new THREE.Vector3(-layout.wingSpan, 0, 0), radius.leg);
    push(4, wingR, new THREE.Vector3(layout.wingSpan, 0, 0), radius.leg);
    legs.forEach((leg, i) => {
      const base = 5 + i * 3;
      push(base, leg.upper, new THREE.Vector3(0, -layout.hip * 0.55, 0), radius.leg);
      push(base + 1, leg.lower, new THREE.Vector3(0, -layout.hip * 0.4, 0), radius.leg);
      push(base + 2, leg.foot, new THREE.Vector3(0, -0.04, 0.05), radius.leg);
    });
    return out;
  };
  return { pivot, bones, pose, segments };
}

function layoutFromBox(box: THREE.Box3, fit: GaitFit | null): SkinLayout {
  const size = box.getSize(new THREE.Vector3());
  const bodyR = Math.max(0.04, Math.max(size.x, size.y) * 0.22);
  const legR = Math.max(0.015, size.x * 0.16);
  const headR = Math.max(0.02, size.y * 0.16);
  if (!fit) {
    return {
      kind: 'bird', wingSpan: Math.max(0.05, size.x * 0.45), wingY: size.y * 0.55,
      bodyY: Math.max(0.05, size.y * 0.45), hip: Math.max(0.04, size.y * 0.35),
      legX: Math.max(0.01, size.x * 0.08), legZ: size.z * 0.05,
      headZ: box.min.z * 0.8, tailZ: box.max.z * 0.8,
      bodyR, legR, headR,
    };
  }
  return {
    kind: 'quad', legs: fit.legs, gaitScale: fit.gaitScale, useWolfGait: fit.useWolfGait,
    x: Math.max(0.01, size.x * 0.22),
    zFront: -Math.max(0.05, size.z * 0.18),
    zHind: Math.max(0.05, size.z * 0.2),
    noseZ: box.min.z, tailZ: box.max.z,
    bodyR, legR, headR,
  };
}

/** Quantized glTF positions are normalized integers. Writing the fit back into them clamps anything outside −1..1. */
function floatAttribute(geometry: THREE.BufferGeometry, name: string) {
  const attr = geometry.getAttribute(name) as THREE.BufferAttribute | undefined;
  if (!attr || attr.array instanceof Float32Array) return;
  const f = new Float32Array(attr.count * attr.itemSize);
  for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) f[i * attr.itemSize + k] = attr.getComponent(i, k);
  geometry.setAttribute(name, new THREE.BufferAttribute(f, attr.itemSize));
}

function bake(fitted: THREE.Object3D) {
  fitted.updateMatrixWorld(true);
  const parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  fitted.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geometry = mesh.geometry.clone();
    floatAttribute(geometry, 'position');
    floatAttribute(geometry, 'normal');
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) ?? new THREE.MeshStandardMaterial({ color: 0x888888 });
    parts.push({ geometry, material });
  });
  return parts;
}

function triangles(geometry: THREE.BufferGeometry) {
  const index = geometry.index;
  if (index) return index.count / 3;
  return (geometry.getAttribute('position')?.count ?? 0) / 3;
}

/** Bake the fitted mesh, lay the bones inside its box, and write proximity weights. */
export function createSkinTemplate(fitted: THREE.Object3D, species: string): SkinTemplate | null {
  const parts = bake(fitted);
  if (!parts.length) return null;
  const box = new THREE.Box3();
  for (const part of parts) if (part.geometry.boundingBox) box.union(part.geometry.boundingBox);
  const fit = isBirdPlan(species) ? null : legsForSpecies(species);
  if (!fit && !isBirdPlan(species)) return null;
  const layout = layoutFromBox(box, fit);
  const holder = new THREE.Group();
  const built = layout.kind === 'quad' ? buildQuad(layout) : buildBird(layout);
  holder.add(built.pivot);
  built.pose('idle', 0, 0);
  const segs = built.segments({ body: layout.bodyR, leg: layout.legR, head: layout.headR });
  let tris = 0;
  for (const part of parts) {
    const pos = part.geometry.getAttribute('position');
    const skin = proximityWeights(pos.array as Float32Array, segs);
    part.geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skin.skinIndex, 4));
    part.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skin.skinWeight, 4));
    tris += triangles(part.geometry);
  }
  const size = box.getSize(new THREE.Vector3());
  return {
    species, layout, geometries: parts.map(p => p.geometry), materials: parts.map(p => p.material),
    height: size.y, width: Math.max(size.x, size.z * 0.35), depth: size.z, tris,
  };
}

/** One on-screen animal. Geometry stays shared; the material is a clone so its fade is its own. */
export function spawnSkin(template: SkinTemplate): SkinSpawn {
  const root = new THREE.Group();
  root.name = `meshy-${template.species}`;
  const built = template.layout.kind === 'quad' ? buildQuad(template.layout) : buildBird(template.layout);
  root.add(built.pivot);
  const meshes = template.geometries.map((geometry, i) => {
    const material = template.materials[i].clone();
    material.transparent = true;
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.name = 'meshy-skin';
    mesh.bindMode = 'attached';
    root.add(mesh);
    return mesh;
  });
  built.pose('idle', 0, 0);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(built.bones);
  for (const mesh of meshes) mesh.bind(skeleton);
  return { root, meshes, pose: built.pose };
}

/** A deformed vertex, in the mesh's local space (the shader's skinning, without the camera). */
export function skinnedVertex(mesh: THREE.SkinnedMesh, index: number) {
  mesh.skeleton.update();
  const pos = mesh.geometry.getAttribute('position');
  const si = mesh.geometry.getAttribute('skinIndex');
  const sw = mesh.geometry.getAttribute('skinWeight');
  const bind = new THREE.Vector3(pos.getX(index), pos.getY(index), pos.getZ(index)).applyMatrix4(mesh.bindMatrix);
  const acc = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mats = mesh.skeleton.boneMatrices;
  for (let k = 0; k < 4; k++) {
    const weight = sw.getComponent(index, k);
    if (weight === 0) continue;
    m.fromArray(mats, si.getComponent(index, k) * 16);
    acc.add(bind.clone().applyMatrix4(m).multiplyScalar(weight));
  }
  return acc.applyMatrix4(mesh.bindMatrixInverse);
}
