/**
 * The picture of a density (roadmap step 14). The mark is the T-0070 parcel disc
 * (`world/globe/parcels.ts`): one point, a round sprite. It is drawn in the forest
 * camera, so it does not take the planet clip plane or the globe log-depth path.
 *
 * Issue #107: draw only what would look real from this viewpoint. A herd or a
 * density is not a shape standing on the grass. From the ground the camera-facing
 * sprite is not drawn (it becomes a dome). The same animals are a flat mottled
 * patch on the litter, the play-camera picture of this mark. From the 1 km station
 * upward, looking down, that patch gives way to a faint stain. The fade starts at
 * #107's 1 km station and is full at 2000 m, the forest camera's top (`HANDOFF.alt`).
 *
 * Disc widths are [game calibration] so the stain matches the field from above.
 * Herd matches the deer's cohesion distance. Density and range are the interest
 * radii, not new metres.
 */
import * as THREE from 'three';
import { INTEREST } from '../core/interest';
import { DEER_AGENT } from '../core/species';
import { smoothstep } from '../proc/math';
import { GLSL_HASH } from '../proc/glsl';
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

/**
 * When the round point may show. Rise is metres of eye above the mark.
 * Nadir is the upward part of the unit vector from the mark to the eye (1 = straight above).
 * Below the 1 km station, or looking across, the weight is 0 so nothing is drawn.
 */
export const DENSITY_TINT = {
  riseStartM: 1000,
  riseFullM: 2000,
  /** [game calibration] Steep enough that a camera-facing disc reads as a ground stain. */
  nadirStart: 0.55,
  nadirFull: 0.85,
  /** [game calibration] Peak opacity, so the stain is a tint. */
  peakAlpha: 0.12,
  /** Screen cap so a wide field cannot fill the view. */
  maxPx: 64,
} as const;

/** Metres above the ground. The stain sits in the litter, not at chest height. [game calibration] */
export const DENSITY_MARK_LIFT_M = 0.08;

export function densityTintGate(riseM: number, nadir: number): number {
  if (!(riseM > 0)) return 0;
  return smoothstep(DENSITY_TINT.riseStartM, DENSITY_TINT.riseFullM, riseM)
    * smoothstep(DENSITY_TINT.nadirStart, DENSITY_TINT.nadirFull, nadir);
}

/**
 * How solid the flat ground patch is. The camera-facing sprite stays behind `densityTintGate`
 * (a standing disc reads as a dome). This patch is the play-camera picture of the same mark:
 * on while the eye is low, gone once the high stain is open. [game calibration]
 */
export const GROUND_MARK_ALPHA = 0.62;
/** Painted radius is half the step-14 width, times this, so a herd sits with the animal. [game calibration] */
export const GROUND_MARK_SCALE = 0.55;

export function groundMarkOpacity(ink: number, riseGate: number): number {
  if (!(ink > 0)) return 0;
  const grounded = 1 - Math.min(1, Math.max(0, riseGate));
  if (grounded < 0.04) return 0;
  return Math.min(1, ink) * grounded * GROUND_MARK_ALPHA;
}

export function groundMarkRadius(kind: Exclude<PictureKind, 'individual'>): number {
  return SIZE[kind] * 0.5 * GROUND_MARK_SCALE;
}

export function createAnimalDensity(scene: THREE.Scene) {
  let n = 0;
  const geo = new THREE.BufferGeometry();
  const maxPx = DENSITY_TINT.maxPx.toFixed(1);
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
  gl_PointSize = aSize <= 0.0 || aAlpha <= 0.0 ? 0.0 : clamp(aSize * projectionMatrix[1][1] * uH / max(1.0, -mv.z), 2.0, ${maxPx});
}`,
    fragmentShader: `
varying vec3 vC;
varying float vA;
void main() {
  if (vA <= 0.004) discard;
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float edge = smoothstep(0.25, 0.04, r);
  gl_FragColor = vec4(vC, vA * edge);
}`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  pts.visible = false;
  scene.add(pts);
  const discGeo = new THREE.CircleGeometry(1, 28);
  discGeo.rotateX(-Math.PI / 2); // unit circle on the ground, face up
  const discs: THREE.Mesh[] = [];
  function discMesh() {
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 } },
      vertexShader: `
varying vec2 vLocal;
void main() {
  vLocal = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: `
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vLocal;
${GLSL_HASH}
void main() {
  float r = length(vLocal);
  if (r > 1.0 || uAlpha <= 0.02) discard;
  vec2 g = floor(vLocal * 7.0);
  float n = hash2s(g, 0.0); // shared proc/glsl hash (PROJECT-RULES: one hash library)
  float clump = 0.62 + 0.38 * smoothstep(0.15, 0.85, n);
  float edge = smoothstep(1.0, 0.35, r);
  float a = uAlpha * edge * clump;
  if (a < 0.03) discard;
  vec3 soil = vec3(0.29, 0.24, 0.14);
  gl_FragColor = vec4(mix(soil, uColor, 0.78), a);
}`,
    });
    const mesh = new THREE.Mesh(discGeo, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.visible = false;
    scene.add(mesh);
    discs.push(mesh);
    return mesh;
  }
  return {
    sync(marks: readonly DensityMark[], viewH: number, eye: { x: number; y: number; z: number }) {
      mat.uniforms.uH.value = Math.max(1, viewH);
      const draw = marks.filter(m => m.ink > 0 && m.kind !== 'individual');
      if (draw.length !== n) {
        n = draw.length;
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
        geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(Math.max(1, n)), 1));
        geo.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(Math.max(1, n)), 1));
      }
      const pos = geo.getAttribute('position') as THREE.BufferAttribute;
      const col = geo.getAttribute('color') as THREE.BufferAttribute;
      const size = geo.getAttribute('aSize') as THREE.BufferAttribute;
      const alpha = geo.getAttribute('aAlpha') as THREE.BufferAttribute;
      let any = false;
      let discN = 0;
      draw.forEach((m, i) => {
        const kind = m.kind === 'individual' ? 'herd' : m.kind;
        const c = RGB[kind];
        const dx = eye.x - m.x, dy = eye.y - m.y, dz = eye.z - m.z;
        const gate = densityTintGate(dy, dy / Math.max(Math.hypot(dx, dy, dz), 1));
        if (gate > 0.02) any = true;
        if (n) {
          pos.setXYZ(i, m.x, m.y, m.z);
          col.setXYZ(i, c[0], c[1], c[2]);
          size.setX(i, gate > 0 ? SIZE[kind] * (0.35 + 0.65 * m.ink) : 0);
          alpha.setX(i, Math.min(1, m.ink) * gate * DENSITY_TINT.peakAlpha);
        }
        const opacity = groundMarkOpacity(m.ink, gate);
        if (opacity <= 0.02) return;
        const mesh = discs[discN] ?? discMesh();
        const material = mesh.material as THREE.ShaderMaterial;
        material.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
        material.uniforms.uAlpha.value = opacity;
        const radius = groundMarkRadius(kind);
        mesh.position.set(m.x, m.y + 0.12, m.z);
        mesh.scale.set(radius, 1, radius);
        mesh.visible = true;
        discN++;
      });
      for (let i = discN; i < discs.length; i++) discs[i].visible = false;
      if (n) {
        pos.needsUpdate = true; col.needsUpdate = true; size.needsUpdate = true; alpha.needsUpdate = true;
        geo.setDrawRange(0, n);
      }
      pts.visible = any;
    },
  };
}

/** Fade a body while its density share is already counted. Shared materials are cloned once, per mesh. */
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
