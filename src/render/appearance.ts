/**
 * Applies an appearance genome (core/genome.ts) to ANY animal rig from outside, at the render layer (Grok Bot):
 * root scale for proportions, material colour for coat hue/saturation/brightness, 'fur' meshes for fur cards, and the
 * procedural coat (core/coat.ts: gradient + painted marks) as a small shader tint in the rig's own profile space.
 * Base values are captured once, so applying is idempotent and the default genome restores the original exactly.
 * Eyes/emissive parts and shared materials (fur cards) are untouched.
 */
import * as THREE from 'three';
import type { Genome } from '../core/genome';
import { parseCoat } from '../core/coat';

const MAX_STOPS = 6, MAX_MARKS = 24;
interface CoatUniforms { uRootInv: { value: THREE.Matrix4 }; uMin: { value: THREE.Vector3 }; uSize: { value: THREE.Vector3 }; uMode: { value: number };
  uStops: { value: THREE.Vector4[] }; uStopT: { value: number[] }; uNStops: { value: number }; uMarks: { value: THREE.Vector4[] }; uMarkC: { value: THREE.Vector4[] }; uNMarks: { value: number } }

/** Rig-local base bounds and a side-profile point cloud (z,y), normalized to centre 0 / span 1. Captured once. */
export function baseProfile(root: THREE.Object3D) {
  if (root.userData.profile) return root.userData.profile as { min: THREE.Vector3; size: THREE.Vector3; side: [number, number][] };
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), pts: THREE.Vector3[] = [];
  root.traverse(o => { if (!(o instanceof THREE.Mesh) || !o.visible) return; m.multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 400));
    for (let i = 0; i < p.count; i += step) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(m).clone()); });
  const box = new THREE.Box3().setFromPoints(pts), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  // side silhouette: per 32 columns along z, the top and bottom y (a closed outline the sketch tool fits against)
  const cols = Array.from({ length: 32 }, () => [Infinity, -Infinity]);
  for (const p of pts) { const k = Math.min(31, Math.floor((p.z - box.min.z) / (size.z || 1) * 32)); cols[k][0] = Math.min(cols[k][0], p.y); cols[k][1] = Math.max(cols[k][1], p.y); }
  const side: [number, number][] = [];
  cols.forEach(([lo, hi], k) => { if (lo > hi) return; const z = -((box.min.z + (k + .5) / 32 * size.z) - c.z) / size.z; // -z is forward: nose at +0.5
    side.push([z, (hi - c.y) / size.y], [z, (lo - c.y) / size.y]); });
  return root.userData.profile = { min: box.min, size, side };
}

function coatUniforms(root: THREE.Object3D): CoatUniforms {
  if (root.userData.coatU) return root.userData.coatU;
  const { min, size } = baseProfile(root), vec = (n: number) => Array.from({ length: n }, () => new THREE.Vector4());
  return root.userData.coatU = { uRootInv: { value: new THREE.Matrix4() }, uMin: { value: min }, uSize: { value: size }, uMode: { value: 0 },
    uStops: { value: vec(MAX_STOPS) }, uStopT: { value: new Array(MAX_STOPS).fill(0) }, uNStops: { value: 0 }, uMarks: { value: vec(MAX_MARKS) }, uMarkC: { value: vec(MAX_MARKS) }, uNMarks: { value: 0 } };
}
const rgba = (hex: string, a: number) => new THREE.Vector4(...new THREE.Color(hex).toArray(), a);
function inject(m: THREE.MeshStandardMaterial, u: CoatUniforms) {
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = 'uniform mat4 uRootInv;\nvarying vec3 vRig;\n' + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvRig = (uRootInv * modelMatrix * vec4(transformed, 1.)).xyz;');
    shader.fragmentShader = `uniform vec3 uMin, uSize; uniform int uMode, uNStops, uNMarks; uniform vec4 uStops[${MAX_STOPS}]; uniform float uStopT[${MAX_STOPS}];
uniform vec4 uMarks[${MAX_MARKS}], uMarkC[${MAX_MARKS}]; varying vec3 vRig;
vec3 coatTint(vec3 base) {
  vec3 n = (vRig - uMin) / max(uSize, vec3(1e-4)); vec2 uv = vec2(1. - n.z, n.y); // u: tail 0 .. nose 1, v: feet 0 .. back 1
  float t = uMode == 0 ? uv.x : uMode == 1 ? uv.y : clamp(length(uv - .5) * 2., 0., 1.);
  float lum = dot(base, vec3(.299, .587, .114)) * 2.; vec4 g = uStops[0];
  for (int i = 1; i < ${MAX_STOPS}; i++) if (i < uNStops && t > uStopT[i - 1]) g = mix(uStops[i - 1], uStops[i], clamp((t - uStopT[i - 1]) / max(uStopT[i] - uStopT[i - 1], 1e-4), 0., 1.));
  vec3 c = uNStops > 0 ? mix(base, g.rgb * lum, g.a) : base;
  for (int i = 0; i < ${MAX_MARKS}; i++) if (i < uNMarks) { float d = distance(uv, uMarks[i].xy); c = mix(c, uMarkC[i].rgb * lum, uMarkC[i].a * (1. - smoothstep(uMarks[i].z * .7, uMarks[i].z, d))); }
  return c;
}
` + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = coatTint(diffuseColor.rgb);');
  };
  m.customProgramCacheKey = () => 'boreal-coat'; m.needsUpdate = true;
}

export function applyGenome(root: THREE.Object3D, g: Genome) {
  const base = (root.userData.genomeBase ??= { scale: root.scale.clone() }) as { scale: THREE.Vector3 };
  const coat = parseCoat(g.coat as string), u = (coat.stops.length || coat.marks.length || root.userData.coatU) ? coatUniforms(root) : undefined;
  const s = g.size as number;
  root.scale.set(base.scale.x * s * (g.width as number), base.scale.y * s * (g.height as number), base.scale.z * s * (g.length as number));
  if (u) {
    u.uMode.value = ['length', 'height', 'radial'].indexOf(coat.mode); u.uNStops.value = coat.stops.length; u.uNMarks.value = coat.marks.length;
    coat.stops.forEach((st, i) => { u.uStops.value[i].copy(rgba(st.color, st.a)); u.uStopT.value[i] = st.t; });
    coat.marks.forEach((mk, i) => { u.uMarks.value[i].set(mk.u, mk.v, mk.r, 0); u.uMarkC.value[i].copy(rgba(mk.color, mk.a)); });
  }
  root.traverse(o => {
    if (o.name === 'fur') o.visible = g.fur as boolean;
    if (!(o instanceof THREE.Mesh) || o.userData.shared) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      const sm = m as THREE.MeshStandardMaterial; if (!sm.color || (sm.emissive && sm.emissive.getHex() !== 0)) continue;
      const orig = (sm.userData.coatBase ??= sm.color.getHex()) as number;
      sm.color.setHex(orig).offsetHSL((g.hue as number) / 360, g.saturation as number, 0).multiplyScalar(g.brightness as number);
      if (u && !sm.userData.coatInjected && sm.isMeshStandardMaterial) { sm.userData.coatInjected = true; inject(sm, u);
        o.onBeforeRender = () => { u.uRootInv.value.copy(root.matrixWorld).invert(); }; }
    }
  });
}
