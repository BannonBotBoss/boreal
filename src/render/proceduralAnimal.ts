/**
 * A stylized body for a landing species whose Meshy file is missing (Canada Lynx today).
 * Mammals step with the gait they already have (`quadrupedPose` / `legsForSpecies`).
 * Birds flap on the same phase the stored eagle uses. Feet are calibrated to y = 0
 * in the idle pose so the root can sit on heightAt.
 */
import * as THREE from 'three';
import { quadrupedPose, type Motion } from '../core/animalBehavior';
import { bodyMetres } from './animalModels';
import { isBirdPlan, legsForSpecies } from './meshySkin';
import { icosphere } from './rocks';
import { applyStylizedFill, coatOf } from './stylizedPalette';

const GEO = icosphere(0);

export interface ProceduralAnimal {
  root: THREE.Group;
  pose: (motion: Motion, phase: number, speed: number) => void;
}

function part(parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  const mesh = new THREE.Mesh(GEO, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(Math.max(0.02, sx), Math.max(0.02, sy), Math.max(0.02, sz));
  mesh.castShadow = false;
  parent.add(mesh);
  return mesh;
}

function material(name: string) {
  const rgb = coatOf(name);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(rgb[0], rgb[1], rgb[2]), roughness: 0.72, flatShading: true });
  applyStylizedFill(mat, rgb);
  return mat;
}

/** Lift the body so the idle feet sit on local y = 0. The root itself stays at the ground the caller sets. */
function sitOnGround(root: THREE.Object3D) {
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const lift = Number.isFinite(box.min.y) ? -box.min.y : 0;
  if (Math.abs(lift) < 1e-4) return;
  const local = lift / (root.scale.y || 1);
  for (const child of root.children) child.position.y += local;
  root.updateMatrixWorld(true);
}

function mammal(name: string, mat: THREE.Material): ProceduralAnimal {
  const fit = legsForSpecies(name)!;
  const L = fit.legs;
  const root = new THREE.Group();
  root.name = `proc-${name}`;
  const body = new THREE.Group();
  root.add(body);
  const shoulder = bodyMetres(name) ?? L.hip;
  part(body, mat, 0, L.hip * 1.05, 0, shoulder * 0.28, shoulder * 0.22, shoulder * 0.48);
  part(body, mat, 0, L.hip * 1.35, -shoulder * 0.42, shoulder * 0.16, shoulder * 0.14, shoulder * 0.22);
  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const spots: [number, number][] = [[1, -1], [-1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of spots) {
    const hip = new THREE.Group();
    hip.position.set(sx * shoulder * 0.18, L.hip, sz * shoulder * 0.28);
    root.add(hip);
    hips.push(hip);
    part(hip, mat, 0, -L.upper / 2, 0, shoulder * 0.06, L.upper / 2, shoulder * 0.06);
    const knee = new THREE.Group();
    knee.position.y = -L.upper;
    hip.add(knee);
    knees.push(knee);
    part(knee, mat, 0, -L.lower / 2, 0, shoulder * 0.05, L.lower / 2, shoulder * 0.05);
  }
  const poseAt = (motion: Motion, phase: number, speed: number, bodyBase: number) => {
    const p = quadrupedPose(motion, phase, 0, L, speed);
    hips.forEach((hip, i) => { hip.rotation.x = p.legs[i]; });
    knees.forEach((knee, i) => { knee.rotation.x = p.knees[i]; });
    body.position.y = bodyBase + p.bob;
  };
  poseAt('idle', 0, 0, 0);
  sitOnGround(root);
  const bodyBase = body.position.y;
  return { root, pose: (motion, phase, speed) => poseAt(motion, phase, speed, bodyBase) };
}

function bird(name: string, mat: THREE.Material): ProceduralAnimal {
  const length = bodyMetres(name) ?? 0.5;
  const root = new THREE.Group();
  root.name = `proc-${name}`;
  const body = new THREE.Group();
  root.add(body);
  const stand = length * 0.38;
  part(body, mat, 0, stand, 0, length * 0.12, length * 0.1, length * 0.28);
  part(body, mat, 0, stand * 1.15, -length * 0.22, length * 0.08, length * 0.07, length * 0.12);
  const wings: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const wing = part(body, mat, side * length * 0.28, stand, 0, length * 0.26, length * 0.035, length * 0.1);
    wings.push(wing);
  }
  part(root, mat, length * 0.06, stand * 0.35, length * 0.08, length * 0.02, stand * 0.35, length * 0.02);
  part(root, mat, -length * 0.06, stand * 0.35, length * 0.08, length * 0.02, stand * 0.35, length * 0.02);
  const poseAt = (_motion: Motion, phase: number, _speed: number, bodyBase: number) => {
    const flap = Math.sin(phase * Math.PI * 2) * 0.45;
    wings[0].rotation.z = flap;
    wings[1].rotation.z = -flap;
    body.position.y = bodyBase + Math.max(0, Math.sin(phase * Math.PI * 2) * length * 0.02);
  };
  poseAt('idle', 0, 0, 0);
  sitOnGround(root);
  const bodyBase = body.position.y;
  return { root, pose: (motion, phase, speed) => poseAt(motion, phase, speed, bodyBase) };
}

/** A coat that stays its own colour. The shared fill washes a fox out to pale tan. */
/** Unlit on purpose. Daylight clips a lit orange to cream; this colour is the colour on screen. */
function foxMat(r: number, g: number, b: number) {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
  mat.toneMapped = false;
  return mat;
}

/**
 * Red-orange back, white chest and tail tip, black legs and ear tips.
 * Forward is local −z, the same way the wolf mesh faces.
 */
function redFox(): ProceduralAnimal {
  const orange = foxMat(0.55, 0.09, 0.015);
  const white = foxMat(0.5, 0.46, 0.4);
  const black = foxMat(0.05, 0.04, 0.04);
  const root = new THREE.Group();
  root.name = 'proc-Red Fox';
  const body = new THREE.Group();
  root.add(body);
  part(body, orange, 0, 0.36, 0.02, 0.11, 0.1, 0.28);
  part(body, white, 0, 0.3, -0.08, 0.08, 0.05, 0.14);
  part(body, orange, 0, 0.46, -0.26, 0.07, 0.07, 0.1);
  part(body, orange, 0, 0.44, -0.36, 0.035, 0.03, 0.06);
  part(body, black, 0, 0.43, -0.4, 0.02, 0.015, 0.02);
  part(body, orange, -0.045, 0.54, -0.24, 0.02, 0.05, 0.015);
  part(body, orange, 0.045, 0.54, -0.24, 0.02, 0.05, 0.015);
  part(body, black, -0.045, 0.58, -0.24, 0.012, 0.015, 0.01);
  part(body, black, 0.045, 0.58, -0.24, 0.012, 0.015, 0.01);
  part(body, orange, 0, 0.4, 0.32, 0.06, 0.05, 0.16);
  part(body, white, 0, 0.42, 0.46, 0.04, 0.035, 0.05);
  const hips: THREE.Group[] = [];
  const knees: THREE.Group[] = [];
  const spots: [number, number][] = [[1, -1], [-1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of spots) {
    const hip = new THREE.Group();
    hip.position.set(sx * 0.07, 0.32, sz * 0.12);
    root.add(hip);
    hips.push(hip);
    part(hip, black, 0, -0.08, 0, 0.018, 0.08, 0.018);
    const knee = new THREE.Group();
    knee.position.y = -0.16;
    hip.add(knee);
    knees.push(knee);
    part(knee, black, 0, -0.07, 0, 0.015, 0.07, 0.015);
  }
  const L = legsForSpecies('Red Fox')!.legs;
  const poseAt = (motion: Motion, phase: number, speed: number, bodyBase: number) => {
    const p = quadrupedPose(motion, phase, 0, L, speed);
    hips.forEach((hip, i) => { hip.rotation.x = p.legs[i]; });
    knees.forEach((knee, i) => { knee.rotation.x = p.knees[i]; });
    body.position.y = bodyBase + p.bob;
  };
  root.scale.setScalar(1.7);
  poseAt('idle', 0, 0, 0);
  sitOnGround(root);
  const bodyBase = body.position.y;
  return { root, pose: (motion, phase, speed) => poseAt(motion, phase, speed, bodyBase) };
}

/** Null when the name is not a mammal or bird row. */
export function createProceduralAnimal(name: string): ProceduralAnimal | null {
  if (!bodyMetres(name)) return null;
  if (name === 'Red Fox') return redFox();
  const mat = material(name);
  if (legsForSpecies(name)) return mammal(name, mat);
  if (isBirdPlan(name)) return bird(name, mat);
  return null;
}
