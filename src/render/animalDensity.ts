/**
 * The picture of a density (roadmap step 14). The disc is the T-0070 parcel picture
 * (`world/globe/parcels.ts`): one point, a round sprite, shaded brighter in the middle,
 * coloured by the field. It is drawn in the forest camera, so it does not take the
 * planet clip plane or the globe log-depth path. Those belong to the globe.
 *
 * Disc widths are [game calibration] so the mark reads at this camera. Herd matches the
 * deer's cohesion distance. Density and range are the interest radii, not new metres.
 */
import * as THREE from 'three';
import { INTEREST } from '../core/interest';
import { DEER_AGENT } from '../core/species';
import type { PictureKind } from '../core/coarse';

export interface DensityMark {
  x: number;
  y: number;
  z: number;
  /** 0..1 painted strength. The ledger share lives in the coarse module. */
  ink: number;
  kind: PictureKind;
}

const herdM = DEER_AGENT.social?.cohesionAt;
if (herdM === undefined) throw new Error('deer social row has no cohesion distance');
const HERD_M = herdM;
const SIZE: Record<Exclude<PictureKind, 'individual'>, number> = {
  herd: HERD_M,
  density: INTEREST.near / 2,
  range: INTEREST.mid * 2,
};
const RGB: Record<Exclude<PictureKind, 'individual'>, [number, number, number]> = {
  herd: [0.64, 0.50, 0.33],
  density: [0.45, 0.58, 0.28],
  range: [0.55, 0.62, 0.32],
};

export function createAnimalDensity(scene: THREE.Scene) {
  let n = 0;
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: { uH: { value: 720 } },
    vertexShader: `
attribute float aSize;
attribute float aAlpha;
varying vec3 vC;
varying float vA;
uniform float uH;
void main() {
  vC = color;
  vA = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aSize * projectionMatrix[1][1] * uH / max(1.0, -mv.z), 2.0, 240.0);
}`,
    fragmentShader: `
varying vec3 vC;
varying float vA;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float shade = 1.0 - 1.6 * r;
  gl_FragColor = vec4(vC * shade, vA * shade);
}`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  pts.visible = false;
  scene.add(pts);
  return {
    sync(marks: readonly DensityMark[], viewH: number) {
      mat.uniforms.uH.value = Math.max(1, viewH);
      const draw = marks.filter(m => m.ink > 0 && m.kind !== 'individual');
      if (draw.length !== n) {
        n = draw.length;
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(Math.max(1, n)), 1));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(Math.max(1, n)), 1));
      }
      pts.visible = n > 0;
      if (!n) return;
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const col = geo.getAttribute('color') as THREE.BufferAttribute;
      const size = geo.getAttribute('aSize') as THREE.BufferAttribute;
      const alpha = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
      draw.forEach((m, i) => {
        const kind = m.kind === 'individual' ? 'herd' : m.kind;
        const c = RGB[kind];
        pos.setXYZ(i, m.x, m.y, m.z);
        col.setXYZ(i, c[0], c[1], c[2]);
        size.setX(i, SIZE[kind] * (0.35 + 0.65 * m.ink));
        alpha.setX(i, Math.min(1, m.ink));
      });
      pos.needsUpdate = true; col.needsUpdate = true; size.needsUpdate = true; alpha.needsUpdate = true;
      geo.setDrawRange(0, n);
    },
  };
}

/** Fade a body while its density disc is already drawn. Shared materials are cloned once, per mesh. */
export function setBodyShare(root: THREE.Object3D, body: number) {
  root.visible = body > 0.02;
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    let mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat || !('opacity' in mat)) return;
    if (body >= 0.98) {
      const base = mat.userData.base as THREE.Material | undefined;
      if (mat.userData.densityFade && base) mesh.material = base;
      return;
    }
    if (!mat.userData.densityFade) {
      const base = mat;
      mat = base.clone();
      mat.userData.densityFade = true;
      mat.userData.base = base;
      mat.transparent = true;
      mesh.material = mat;
    }
    mat.opacity = Math.max(0, Math.min(1, body));
    mat.depthWrite = body > 0.45;
  });
}
