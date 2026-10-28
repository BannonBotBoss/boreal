/**
 * The distance picture of animals the simulation already placed (issue #156).
 * Specks are a fixed handful of pixels, so a herd cannot become a dome.
 * A stored model, when the manifest has one, is rigid while the animal is
 * still or far enough that the gait is not readable. In motion and close,
 * the procedural body keeps the bones. No model means the procedural body
 * at every close step, with fur cards dropped on the low step.
 */
import * as THREE from 'three';
import { ANIMAL_LADDER, detailShares } from './animalLadder';
import { animalModel, loadAnimalModels } from './animalModels';

export interface PictureBody {
  key: string;
  species: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  moving: boolean;
  root: THREE.Object3D;
}

export interface PictureWeight { proc: number; full: number; low: number; speck: number; root: THREE.Object3D }

const TINT: Record<string, [number, number, number]> = {
  'Gray Wolf': [0.45, 0.46, 0.48],
  'White-tailed Deer': [0.62, 0.48, 0.30],
  'Snowshoe Hare': [0.55, 0.40, 0.26],
};

function cloneModel(src: THREE.Object3D) {
  const copy = src.clone(true);
  copy.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const cloned = list.map(material => {
      const next = material.clone();
      next.transparent = true;
      return next;
    });
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0];
  });
  return copy;
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
  void loadAnimalModels().catch(() => { /* procedural bodies stay */ });
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

  const fullPool: THREE.Group[] = [];
  const lowPool: THREE.Group[] = [];
  const frustum = new THREE.Frustum();
  const proj = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  let last: PictureWeight[] = [];

  function claim(pool: THREE.Group[], template: THREE.Object3D, species: string) {
    let group = pool.find(item => !item.visible && item.userData.species === species);
    if (!group) {
      group = new THREE.Group();
      group.userData.species = species;
      group.userData.animalPicture = true;
      group.add(cloneModel(template));
      scene.add(group);
      pool.push(group);
    }
    group.visible = true;
    return group;
  }

  function hide(pool: THREE.Group[]) { for (const group of pool) group.visible = false; }

  return {
    weights: () => last,
    sync(items: readonly PictureBody[], camera: THREE.PerspectiveCamera, viewH: number) {
      mat.uniforms.uH.value = Math.max(1, viewH);
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(proj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      hide(fullPool);
      hide(lowPool);
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const col = geo.getAttribute('color') as THREE.BufferAttribute;
      const alpha = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
      const ranked = items.map(item => ({ item, d: tmp.set(item.x - camera.position.x, item.y - camera.position.y, item.z - camera.position.z).length() }));
      ranked.sort((a, b) => a.d - b.d);
      let specks = 0, fulls = 0, lows = 0;
      const weights: PictureWeight[] = [];
      for (const { item, d } of ranked) {
        const share = detailShares(d);
        const seen = d < 8 || frustum.containsPoint(tmp.set(item.x, item.y + 0.6, item.z));
        const model = animalModel(item.species);
        const rigidFull = !!model?.full && (!item.moving || d > ANIMAL_LADDER.fullM);
        const rigidLow = !!model?.low && d >= ANIMAL_LADDER.fullM;
        let proc = seen ? (rigidFull ? 0 : share.full) + (rigidLow ? 0 : share.low) : 0;
        let full = 0, low = 0, speck = 0;
        if (seen && share.speck > 0.02 && specks < cap) {
          const tint = TINT[item.species] ?? [0.50, 0.48, 0.36];
          pos.setXYZ(specks, item.x, item.y + 0.4, item.z);
          col.setXYZ(specks, tint[0], tint[1], tint[2]);
          alpha.setX(specks, Math.min(1, share.speck) * 0.9);
          specks++;
          speck = share.speck;
        }
        if (seen && rigidFull && model?.full && share.full > 0.04 && fulls < ANIMAL_LADDER.fullCap) {
          const group = claim(fullPool, model.full, item.species);
          group.position.set(item.x, item.y, item.z);
          group.rotation.y = item.yaw;
          setOpacity(group, share.full);
          full = share.full;
          fulls++;
        }
        if (seen && rigidLow && model?.low && share.low > 0.04 && lows < ANIMAL_LADDER.lowCap) {
          const group = claim(lowPool, model.low, item.species);
          group.position.set(item.x, item.y, item.z);
          group.rotation.y = item.yaw;
          setOpacity(group, share.low);
          low = share.low;
          lows++;
        }
        if (seen && !model?.full && !model?.low) proc = share.full + share.low;
        setFur(item.root, share.full > 0.35 && proc > 0.2);
        weights.push({ proc, full, low, speck, root: item.root });
      }
      pos.needsUpdate = true; col.needsUpdate = true; alpha.needsUpdate = true;
      geo.setDrawRange(0, Math.max(1, specks));
      points.visible = specks > 0;
      last = weights;
      const report = { specks, fulls, lows, bodies: weights.filter(w => w.proc > 0.2).length, weights };
      (globalThis as { borealPicture?: unknown }).borealPicture = () => ({ specks, fulls, lows, bodies: report.bodies });
      return weights;
    },
  };
}
