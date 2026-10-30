/**
 * The distance picture of animals the simulation already placed (issues #156 and #162).
 * Specks are a fixed handful of pixels, so a herd cannot become a dome.
 * Up close, a stored model is skinned onto the existing gait, so a walk or a run
 * is the Meshy body. The mid distance is one shared camera-facing quad per species
 * (an impostor), instanced. No model means the procedural body, with fur cards on
 * the near step only.
 */
import * as THREE from 'three';
import { ANIMAL_LADDER, detailShares } from './animalLadder';
import { animalModel, ensureAnimalModels } from './animalModels';
import { spawnSkin, type SkinSpawn } from './meshySkin';
import type { Motion } from '../core/animalBehavior';
import { heightAt } from '../core/world';
import { createWolfLod, GAIT_LOD_SPECIES } from './gaitLod';

export interface PictureBody {
  key: string;
  species: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  moving: boolean;
  motion?: Motion;
  phase?: number;
  speed?: number;
  root: THREE.Object3D;
}

export interface PictureWeight { proc: number; full: number; low: number; speck: number; root: THREE.Object3D }

const TINT: Record<string, [number, number, number]> = {
  'Gray Wolf': [0.45, 0.46, 0.48],
  'Coyote': [0.55, 0.48, 0.32],
  'Red Fox': [0.72, 0.38, 0.16],
  'Gray Fox': [0.55, 0.48, 0.32],
  'Cougar': [0.62, 0.48, 0.28],
  'Striped Skunk': [0.15, 0.15, 0.15],
  'Northern Raccoon': [0.45, 0.42, 0.38],
  'Wolverine': [0.28, 0.22, 0.16],
  'North American River Otter': [0.25, 0.18, 0.12],
  'Ermine': [0.55, 0.42, 0.28],
  'American Mink': [0.22, 0.14, 0.08],
  'American Black Bear': [0.12, 0.10, 0.08],
  'Grizzly Bear': [0.35, 0.26, 0.14],
  'Moose': [0.28, 0.22, 0.16],
  'Elk': [0.42, 0.32, 0.20],
  'White-tailed Deer': [0.62, 0.48, 0.30],
  'Woodland Caribou': [0.48, 0.42, 0.34],
  'Snowshoe Hare': [0.55, 0.40, 0.26],
  'Beaver': [0.32, 0.22, 0.14],
  'Bald Eagle': [0.25, 0.22, 0.18],
  'Hawks, Kites and Eagles': [0.25, 0.22, 0.18],
  'Common Raven': [0.08, 0.08, 0.09],
  'Crows and Jays': [0.08, 0.08, 0.09],
};

function tintOf(species: string) {
  const rgb = TINT[species] ?? [0.50, 0.48, 0.36];
  return (rgb[0] * 255 << 16) + (rgb[1] * 255 << 8) + (rgb[2] * 255);
}

function gaitOf(item: PictureBody): { motion: Motion; phase: number; speed: number } {
  const moving = item.moving;
  const motion: Motion = item.motion && !(moving && item.motion === 'idle') ? item.motion : moving ? 'walk' : 'idle';
  return { motion, phase: item.phase ?? 0, speed: item.speed ?? (moving ? 1.5 : 0) };
}

function setOpacity(root: THREE.Object3D, opacity: number) {
  root.visible = opacity > 0.04;
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of list) {
      if ('opacity' in material) (material as THREE.Material & { opacity: number }).opacity = opacity;
    }
  });
}

function setFur(root: THREE.Object3D, show: boolean) {
  root.traverse(obj => { if (obj.name === 'fur') obj.visible = show; });
}

export function createAnimalPicture(scene: THREE.Scene) {
  const cap = ANIMAL_LADDER.speckCap;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(cap), 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: { uH: { value: 720 }, uPx: { value: ANIMAL_LADDER.speckPx } },
    vertexShader: `
attribute float aAlpha;
varying vec3 vC;
varying float vA;
uniform float uH;
uniform float uPx;
void main() {
  vC = color;
  vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = vA <= 0.0 ? 0.0 : uPx;
}`,
    fragmentShader: `
varying vec3 vC;
varying float vA;
void main() {
  if (vA <= 0.004) discard;
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float edge = smoothstep(0.25, 0.05, r);
  gl_FragColor = vec4(vC, vA * edge);
}`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  points.userData.animalPicture = true;
  points.visible = false;
  scene.add(points);

  const skinPool: (SkinSpawn & { species: string })[] = [];
  const impostorGeo = new THREE.PlaneGeometry(1, 1);
  const impostors = new Map<string, THREE.InstancedMesh>();
  const impostorMat = new Map<string, THREE.MeshBasicMaterial>();
  const dummy = new THREE.Object3D();
  const frustum = new THREE.Frustum();
  const proj = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  let last: PictureWeight[] = [];
  /** Wolves: near full mesh + terrain feet, mid low mesh on phase curves, far speck (gaitLod.ts, #162 item 2). */
  const wolves = createWolfLod(scene, heightAt);

  function claimSkin(species: string) {
    const model = animalModel(species);
    if (!model?.skin) return null;
    let live = skinPool.find(item => !item.root.visible && item.species === species);
    if (!live) {
      const spawned = spawnSkin(model.skin);
      spawned.root.userData.animalPicture = true;
      spawned.root.userData.species = species;
      scene.add(spawned.root);
      live = Object.assign(spawned, { species });
      skinPool.push(live);
    }
    live.root.visible = true;
    return live;
  }

  function impostor(species: string) {
    let mesh = impostors.get(species);
    if (mesh) return mesh;
    const material = new THREE.MeshBasicMaterial({ color: tintOf(species), transparent: true, depthWrite: false });
    mesh = new THREE.InstancedMesh(impostorGeo, material, ANIMAL_LADDER.lowCap);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.userData.animalPicture = true;
    scene.add(mesh);
    impostors.set(species, mesh);
    impostorMat.set(species, material);
    return mesh;
  }

  function hideSkins() { for (const item of skinPool) item.root.visible = false; }
  function hideImpostors() {
    for (const mesh of impostors.values()) { mesh.count = 0; mesh.visible = false; }
    for (const fade of impostorMat.values()) fade.opacity = 0;
  }

  return {
    weights: () => last,
    sync(items: readonly PictureBody[], camera: THREE.PerspectiveCamera, viewH: number) {
      ensureAnimalModels(items.map(item => item.species));
      mat.uniforms.uH.value = Math.max(1, viewH);
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      hideSkins();
      hideImpostors();
      wolves.begin(animalModel(GAIT_LOD_SPECIES[0])?.skin ?? null);
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const col = geo.getAttribute('color') as THREE.BufferAttribute;
      const alpha = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
      const ranked = items.map(item => ({ item, d: tmp.set(item.x - camera.position.x, item.y - camera.position.y, item.z - camera.position.z).length() }));
      ranked.sort((a, b) => a.d - b.d);
      let specks = 0, fulls = 0, lows = 0;
      const lowCount = new Map<string, number>();
      const weights: PictureWeight[] = [];
      for (const { item, d } of ranked) {
        const share = detailShares(d);
        const eye = camera.position.y - item.y;
        const horiz = Math.hypot(item.x - camera.position.x, item.z - camera.position.z);
        const overhead = eye > 80 && horiz < Math.max(90, eye * 0.5);
        const seen = d < 8 || overhead || frustum.containsPoint(tmp.set(item.x, item.y + 0.6, item.z));
        const model = animalModel(item.species);
        let proc = 0, full = 0, low = 0, speck = 0, bob = 0;
        const wolf = GAIT_LOD_SPECIES.includes(item.species) && !!model?.skin;
        if (wolf && seen) {
          const w = wolves.show({ ...item, ...gaitOf(item) }, share, { near: fulls < ANIMAL_LADDER.fullCap, mid: lows < ANIMAL_LADDER.lowCap }, setOpacity);
          full = w.full; low = w.low; bob = w.bob;
          if (full) fulls++;
          if (low) lows++;
        }
        if (!wolf && seen && model?.skin && share.full > 0.04 && fulls < ANIMAL_LADDER.fullCap) {
          const live = claimSkin(item.species);
          if (live) {
            const gait = gaitOf(item);
            live.root.position.set(item.x, item.y, item.z);
            live.root.rotation.y = item.yaw;
            live.pose(gait.motion, gait.phase, gait.speed);
            setOpacity(live.root, share.full);
            full = share.full;
            fulls++;
          }
        }
        const used = lowCount.get(item.species) ?? 0;
        if (!wolf && seen && model?.skin && share.low > 0.04 && lows < ANIMAL_LADDER.lowCap && used < ANIMAL_LADDER.lowCap) {
          const mesh = impostor(item.species);
          const height = Math.max(0.05, model.skin.height);
          const width = Math.max(0.05, model.skin.width);
          dummy.position.set(item.x, item.y + height * 0.5, item.z);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.set(width, height, 1);
          dummy.updateMatrix();
          mesh.setMatrixAt(used, dummy.matrix);
          mesh.count = used + 1;
          mesh.visible = true;
          mesh.instanceMatrix.needsUpdate = true;
          const fade = impostorMat.get(item.species);
          if (fade) fade.opacity = Math.max(fade.opacity, share.low);
          lowCount.set(item.species, used + 1);
          low = share.low;
          lows++;
        }
        if (!model?.skin) proc = seen ? share.full + share.low : 0;
        const uncovered = seen && full === 0 && low === 0 && proc < 0.04 && (share.full > 0.04 || share.low > 0.04 || share.speck > 0.02);
        if (seen && (share.speck > 0.02 || uncovered) && specks < cap) {
          const tint = TINT[item.species] ?? [0.50, 0.48, 0.36];
          pos.setXYZ(specks, item.x, item.y + 0.4 + bob, item.z);
          col.setXYZ(specks, tint[0], tint[1], tint[2]);
          alpha.setX(specks, Math.min(1, Math.max(share.speck, uncovered ? 0.45 : 0)) * 0.9);
          specks++;
          speck = Math.max(share.speck, uncovered ? 0.45 : 0);
        }
        setFur(item.root, share.full > 0.35 && proc > 0.2);
        weights.push({ proc, full, low, speck, root: item.root });
      }
      wolves.end();
      pos.needsUpdate = true; col.needsUpdate = true; alpha.needsUpdate = true;
      geo.setDrawRange(0, Math.max(1, specks));
      points.visible = specks > 0;
      last = weights;
      (globalThis as { borealPicture?: unknown }).borealPicture = () => ({ specks, fulls, lows, bodies: weights.filter(w => w.proc > 0.2).length, wolves: { ...wolves.stats } });
      return weights;
    },
  };
}
