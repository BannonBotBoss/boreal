/**
 * Local volumetric clouds around the camera (grokbot-1, T-0073). Matt: the sim grid is fine; render only the region the camera
 * is in as stacked vertical layers. One sim cell's column (core/atmo/cloudColumn: temperature, humidity, dew point, LCL,
 * buoyant top, layer saturation) is baked into a small R8 Data3DTexture over a box around the camera's ground point, broken
 * into cells horizontally by value noise thresholded at the sim's cloud fraction, and ray-marched. Ray-march structure from
 * three.js examples/webgl_volume_cloud (MIT), written here for this box. WebGL2 (three WebGLRenderer, 3D textures); a WebGPU
 * path can reuse the same baked texture. Beyond the box (and from orbit) the existing cheap shell (atmosphere.ts) draws.
 * Budget: 64 x 64 x 48 bytes = 192 KB VRAM, rebaked only when the camera moves a quarter box or the column changes.
 */
import * as THREE from 'three';
import { cloudColumn, type Column } from '../../core/atmo/cloudColumn';
import { hash, random } from '../../proc/rng';
import { toLatLon, type Vec3 } from './planet';

export const LOCAL_CLOUDS = { sizeM: 32000, topM: 12000, nx: 64, nz: 48, showBelowM: 40000, rebakeFrac: .25, cellM: 2500, steps: 96, waterFull: 1.5e-3 }; // [game calibration: box and cell size]
/** 0 at showBelowM, 1 at sizeM. The box and the flat shell crossfade across that span instead of swapping in one frame. */
export function localCloudFade(alt: number, L = LOCAL_CLOUDS) {
  const span = L.showBelowM - L.sizeM;
  const u = span <= 0 ? (alt < L.showBelowM ? 1 : 0) : (L.showBelowM - alt) / span;
  const t = Math.min(1, Math.max(0, u));
  return t * t * (3 - 2 * t);
}
/** Issue #202: the in-page band (bandTop..fadeFull). The far-layer box shows where the patch has not dithered in yet (1 - patch);
 *  the overlay copy drawn after the game pass covers the rest, so the summed cloud stays localCloudFade(alt) through the band. */
export function bandCloudOpacity(alt: number, patch: number, L = LOCAL_CLOUDS) {
  return localCloudFade(alt, L) * Math.min(1, Math.max(0, patch));
}
/** Issue #202: a camera-relative planet-frame matrix (the globe renders from the origin) -> game metres. basis: gameBasis at the
 *  camera (game -> planet rotation, orthonormal), camPos: the game camera. */
export function toGameFrame(basis: THREE.Matrix4, camPos: THREE.Vector3, m: THREE.Matrix4, out = new THREE.Matrix4()) {
  const r = basis.clone().transpose().setPosition(camPos); return out.multiplyMatrices(r, m);
}
/** Issue #202 (2): CPU mirror of the overlay's BAND_OCCLUDE depth: window depth (0..1, default depth range) of a box-local point. */
export function nearEdgeDepth(p: THREE.Vector3, modelView: THREE.Matrix4, proj: THREE.Matrix4) {
  const c = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(modelView).applyMatrix4(proj); return Math.min(1, Math.max(0, c.z / c.w * .5 + .5));
}
/** Issue #202 (1): after the 60 m handover the overlay box stays, frozen in game metres where it was at the handover. It holds at
 *  full strength while the player is within a quarter box of that centre and fades out by the box edge (no rebake in game mode). */
export function keptCloudFade(distM: number, L = LOCAL_CLOUDS) {
  const t = Math.min(1, Math.max(0, (distM - L.sizeM / 4) / (L.sizeM / 4))); return 1 - t * t * (3 - 2 * t);
}
/** Issue #202 (1): sine of the view elevation below which a ray from the ground reaches the cloud base (baseM above the eye) only
 *  past the box edge (edgeM away). The painted dome fills the sky below it; above it the dew-point box is the cloud. */
export function boxEdgeSin(baseM: number, edgeM: number) { const b = Math.max(1, baseM); return b / Math.hypot(b, Math.max(1, edgeM)); }
export interface ColumnInput { tsC: number; q: number; cover: number }
/** Nearest sim cell to a planet direction (planes from core/planetBudget).
 *  Live globe clouds read `weatherAtLatLon` instead. This stays for the nearest-cell check in tests/cloud-column.test.ts. */
export function columnAt(planes: { lat: ArrayLike<number>; lon: ArrayLike<number>; ts: ArrayLike<number>; q: ArrayLike<number>; cloud: ArrayLike<number> }, d: Vec3): ColumnInput | null {
  const { lat, lon } = toLatLon(d), la = lat * 180 / Math.PI, lo = lon * 180 / Math.PI; let best = -1, bd = Infinity;
  for (let i = 0; i < planes.lat.length; i++) { let dl = Math.abs(planes.lon[i] - lo) % 360; if (dl > 180) dl = 360 - dl; const k = (planes.lat[i] - la) ** 2 + (dl * Math.cos(lat)) ** 2; if (k < bd) { bd = k; best = i; } }
  return best < 0 ? null : { tsC: planes.ts[best], q: planes.q[best], cover: Math.max(0, Math.min(1, planes.cloud[best])) };
}
const vnoise2 = (salt: number) => { const L = (i: number, j: number) => random(hash(`lc:${salt}:${i}:${j}`))();
  return (x: number, y: number) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    const a = L(i, j), b = L(i + 1, j), c = L(i, j + 1), e = L(i + 1, j + 1); return a + (b - a) * su + (c - a) * sv + (a - b - c + e) * su * sv; }; };
const n1 = vnoise2(1), n2 = vnoise2(2), n3 = vnoise2(3);
/** Bake density bytes (x fastest, then y = height, then z) for a column; ox, oz: box origin in a fixed local grid (m) so the
 *  cells stay put while the box re-centres. Horizontal cells: fBm > threshold, threshold set so the covered share ~ cover. */
export function bakeLocal(col: Column, cover: number, ox: number, oz: number, L = LOCAL_CLOUDS) {
  const out = new Uint8Array(L.nx * L.nx * L.nz), dz = L.topM / L.nz, h = new Float32Array(L.nx * L.nx), cut = 1 - cover;
  for (let k = 0; k < L.nx; k++) for (let i = 0; i < L.nx; i++) { const x = (ox + (i + .5) / L.nx * L.sizeM) / L.cellM, z = (oz + (k + .5) / L.nx * L.sizeM) / L.cellM;
    const f = (n1(x, z) * .55 + n2(x * 2.1, z * 2.1) * .3 + n3(x * 4.3, z * 4.3) * .15); h[k * L.nx + i] = Math.max(0, Math.min(1, (f - (.25 + .5 * cut)) / .12)); } // fBm spans ~.25-.75
  const w = new Float32Array(L.nz); for (let j = 0; j < L.nz; j++) { const z = (j + .5) * dz, li = Math.min(col.layers.length - 1, Math.round(z / (col.layers[1]?.z || 250))); w[j] = Math.min(1, (col.layers[li]?.water ?? 0) / L.waterFull); }
  for (let k = 0; k < L.nx; k++) for (let j = 0; j < L.nz; j++) for (let i = 0; i < L.nx; i++) out[i + L.nx * (j + L.nz * k)] = Math.round(255 * w[j] * h[k * L.nx + i]);
  return out;
}

const VERT = `out vec3 vOrigin; out vec3 vDir; uniform vec3 uCamLocal;
void main() { vOrigin = uCamLocal; vDir = position - uCamLocal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FRAG = `precision highp float; precision highp sampler3D; in vec3 vOrigin; in vec3 vDir; out vec4 outColor;
uniform sampler3D uVol; uniform vec3 uSunLocal; uniform float uSteps; uniform float uOpacity;
#ifdef BAND_OCCLUDE
uniform mat4 modelViewMatrix, projectionMatrix;
#endif
vec2 hitBox(vec3 o, vec3 d) { vec3 bmin = vec3(-.5), bmax = vec3(.5), ti = 1.0 / d, t0 = (bmin - o) * ti, t1 = (bmax - o) * ti, tmin = min(t0, t1), tmax = max(t0, t1);
  return vec2(max(tmin.x, max(tmin.y, tmin.z)), min(tmax.x, min(tmax.y, tmax.z))); }
float dens(vec3 p) { return texture(uVol, p + .5).r; }
void main() { vec3 rd = normalize(vDir); vec2 b = hitBox(vOrigin, rd); if (b.x > b.y) discard; b.x = max(b.x, 0.0);
  float dt = (b.y - b.x) / uSteps; vec3 p = vOrigin + rd * b.x; vec4 acc = vec4(0.0); vec3 first = vec3(0.0); bool hit = false;
  for (float i = 0.0; i < 256.0; i++) { if (i >= uSteps || acc.a > .97) break;
    float d = dens(p); if (d > .01) { if (!hit) { hit = true; first = p; } float sh = dens(p + uSunLocal * .03) + dens(p + uSunLocal * .07); float lit = exp(-sh * 2.5) * max(uSunLocal.y + .25, .15) + .25;
      float a = 1.0 - exp(-d * dt * 220.0); acc.rgb += (1.0 - acc.a) * a * vec3(lit); acc.a += (1.0 - acc.a) * a; }
    p += rd * dt; }
  if (acc.a < .01) discard;
#ifdef BAND_OCCLUDE
  vec4 c = projectionMatrix * (modelViewMatrix * vec4(first, 1.0)); gl_FragDepth = clamp(c.z / c.w * .5 + .5, 0.0, 1.0); // issue #202: depth of the cloud's near edge, so ground in front culls it
#endif
  outColor = vec4(acc.rgb / max(acc.a, 1e-3), acc.a * uOpacity); }`;

export interface LocalClouds { mesh: THREE.Mesh; /** issue #202: the same box for the game pass in the band (shared volume, own opacity); placed by inpage */ overlay: THREE.Mesh; update(camPos: ArrayLike<number>, groundR: number, alt: number, sunDir: THREE.Vector3, input: ColumnInput | null): void; column(): Column | null }
/** The local box. The mesh is placed camera-relative (the globe renders from the origin, globeView renderTo). */
export function createLocalClouds(L = LOCAL_CLOUDS): LocalClouds {
  const tex = new THREE.Data3DTexture(new Uint8Array(L.nx * L.nx * L.nz), L.nx, L.nz, L.nx); tex.format = THREE.RedFormat; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.unpackAlignment = 1; tex.needsUpdate = true;
  const uniforms = { uVol: { value: tex }, uCamLocal: { value: new THREE.Vector3() }, uSunLocal: { value: new THREE.Vector3(0, 1, 0) }, uSteps: { value: L.steps }, uOpacity: { value: 1 } };
  const mat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: 'precision highp float; uniform mat4 modelViewMatrix, projectionMatrix; in vec3 position;\n' + VERT, fragmentShader: FRAG, uniforms, side: THREE.BackSide, transparent: true, depthWrite: false, depthTest: false });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.visible = false;
  const omat = mat.clone(); omat.uniforms = { ...uniforms, uOpacity: { value: 0 }, uCamLocal: { value: new THREE.Vector3() } }; // shared volume and sun; own opacity and camera (game metres, set by inpage)
  // issue #202 (2): the overlay writes the depth of the cloud's near edge (BAND_OCCLUDE) and is depth-tested against the game
  // pass, so a ridge in front hides the cloud behind it while cloud in front of the ground stays. The globe copy keeps depthTest off.
  omat.defines = { BAND_OCCLUDE: 1 }; omat.depthTest = true;
  const overlay = new THREE.Mesh(mesh.geometry, omat); overlay.frustumCulled = false; overlay.renderOrder = 10; overlay.visible = false; overlay.matrixAutoUpdate = false; overlay.userData.bandClouds = true;
  const frame = new THREE.Matrix4(), inv = new THREE.Matrix4(), up = new THREE.Vector3(), east = new THREE.Vector3(), north = new THREE.Vector3();
  let centre: THREE.Vector3 | null = null, key = '', col: Column | null = null;
  return { mesh, overlay, column: () => col,
    update(cp, groundR, alt, sunDir, input) {
      const fade = localCloudFade(alt, L); mesh.visible = !!input && fade > 0; uniforms.uOpacity.value = fade; if (!mesh.visible || !input) return;
      const cam = new THREE.Vector3(cp[0], cp[1], cp[2]); up.copy(cam).normalize();
      const k = `${input.tsC.toFixed(1)}:${input.q.toFixed(5)}:${input.cover.toFixed(2)}`;
      if (!centre || centre.distanceTo(up.clone().multiplyScalar(groundR)) > L.sizeM * L.rebakeFrac || k !== key) {
        east.set(0, 1, 0).cross(up); if (east.lengthSq() < 1e-8) east.set(1, 0, 0); east.normalize(); north.crossVectors(up, east);
        centre = up.clone().multiplyScalar(groundR); key = k; col = cloudColumn(input.tsC, input.q, input.cover, L.topM);
        const { lat, lon } = toLatLon([up.x, up.y, up.z]), R = groundR, ox = lon * R * Math.cos(lat) - L.sizeM / 2, oz = lat * R - L.sizeM / 2; // fixed lat/lon metre grid
        tex.image.data = bakeLocal(col, input.cover, ox, oz, L); tex.needsUpdate = true;
        frame.makeBasis(east.clone().multiplyScalar(L.sizeM), up.clone().multiplyScalar(L.topM), north.clone().multiplyScalar(L.sizeM)).setPosition(centre.clone().addScaledVector(up, L.topM / 2));
        inv.copy(frame).invert();
      }
      // camera-relative placement: the scene renders from the origin
      mesh.matrixAutoUpdate = false; mesh.matrix.copy(frame); mesh.matrix.elements[12] -= cam.x; mesh.matrix.elements[13] -= cam.y; mesh.matrix.elements[14] -= cam.z; mesh.matrixWorldNeedsUpdate = true;
      uniforms.uCamLocal.value.copy(cam).applyMatrix4(inv);
      const s = sunDir.clone().transformDirection(inv); uniforms.uSunLocal.value.copy(s);
    } };
}
