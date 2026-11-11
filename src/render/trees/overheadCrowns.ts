/**
 * Overhead crowns from the existing spruce (D24).
 *
 * Top-down billboards baked from the mid LOD of buildConifer (three seeds).
 * The octahedral impostor shader does not compile in this WebGL build
 * (unpackRGBToNormal). A lit orthographic render of the same mesh is the
 * billboard. Each disc lies in the tangent plane, with a soft shadow beside
 * it. Placement is farTreesInTile across the whole nadir rectangle, faded
 * toward the frame edge rather than cut off in a circle.
 */
import * as THREE from 'three';
import { FAR_TREES, farTreesInTile } from '../../core/flora/stands';
import { standAt } from '../../core/stand';
import { hash } from '../../proc/rng';
import { smoothstep } from '../../proc/math';
import { coverSampleLatLon } from '../../world/globe/coverSample';
import { toLatLon, type Planet } from '../../world/globe/planet';
import { tangentFrame } from '../../world/globe/landingSite';
import { AERIAL } from '../../world/globe/aerialExemplar';
import { buildConifer } from './conifer';

export const CROWN_CAP = 3200;

export interface CrownSpot { x: number; z: number; slot: number; scale: number; fade: number }

/** Half-extents of the ground rectangle a nadir camera sees, metres. */
export function viewSpan(altM: number, fovDeg = 45, aspect = 16 / 9) {
  const hy = Math.max(30, altM) * Math.tan(fovDeg * Math.PI / 360);
  return { hx: hy * Math.max(0.6, aspect), hy };
}

/**
 * Thomas points inside the view rectangle. `fade` is 1 in the middle and falls
 * off in the outer band of the rectangle, so the field reaches the frame and
 * does not end in a circle.
 */
export function collectCrowns(
  hx: number, hy: number,
  stems: (x: number, z: number) => number,
  dry: (x: number, z: number) => number = () => 1,
): CrownSpot[] {
  if (!(hx > 1) || !(hy > 1)) return [];
  const T = FAR_TREES.tile;
  const spots: CrownSpot[] = [];
  const tx0 = Math.floor(-hx / T) - 1, tx1 = Math.ceil(hx / T) + 1;
  const tz0 = Math.floor(-hy / T) - 1, tz1 = Math.ceil(hy / T) + 1;
  for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
    for (const p of farTreesInTile(tx, tz, 1, stems, dry)) {
      const ex = Math.abs(p.x) / hx, ez = Math.abs(p.z) / hy;
      const edge = Math.max(ex, ez);
      if (edge > 1.08) continue;
      const h = hash(`ov:${Math.round(p.x)}:${Math.round(p.z)}`);
      const fade = 1 - smoothstep(0.72, 1.08, edge);
      spots.push({ x: p.x, z: p.z, slot: h % 3, scale: 0.72 + (h % 700) / 700 * 0.7, fade });
    }
  }
  if (spots.length <= CROWN_CAP) return spots;
  spots.sort((a, b) => ((hash(`ord:${a.x}:${a.z}`) >>> 0) - (hash(`ord:${b.x}:${b.z}`) >>> 0)));
  return spots.slice(0, CROWN_CAP);
}

function shadowTexture() {
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;
    const d = Math.sqrt(u * u + v * v);
    const a = Math.round(255 * Math.max(0, 1 - smoothstep(0.15, 1, d)) * 0.55);
    const i = (y * n + x) * 4;
    data[i] = 8; data[i + 1] = 14; data[i + 2] = 6; data[i + 3] = a;
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** One lit top-down billboard of a real spruce. The octahedral material failed to compile here. */
function bakeTopDown(renderer: THREE.WebGLRenderer, root: THREE.Object3D): { texture: THREE.Texture; width: number } {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const reach = Math.max(size.x, size.z, 1) * 0.62;
  const cam = new THREE.OrthographicCamera(-reach, reach, reach, -reach, 0.05, size.y + 4);
  cam.position.set(center.x + reach * 0.42, center.y + Math.max(size.y, 1) * 0.85, center.z + reach * 0.22);
  cam.up.set(0, 0, -1);
  cam.lookAt(center.x, center.y, center.z);
  const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
  sun.position.set(center.x + reach, box.max.y + reach, center.z + reach * 0.35);
  sun.intensity = 1.15;
  const sky = new THREE.AmbientLight(0x8aa4c4, 0.35);
  const scene = new THREE.Scene();
  scene.add(root, sun, sky);
  const rt = new THREE.WebGLRenderTarget(256, 256, { format: THREE.RGBAFormat });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.generateMipmaps = true;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  const old = { rt: renderer.getRenderTarget(), pr: renderer.getPixelRatio(), cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), tm: renderer.toneMapping };
  renderer.setPixelRatio(1);
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.clear();
  renderer.render(scene, cam);
  renderer.setRenderTarget(old.rt);
  renderer.setPixelRatio(old.pr);
  renderer.setClearColor(old.cc, old.ca);
  renderer.toneMapping = old.tm;
  scene.remove(root);
  return { texture: rt.texture, width: reach * 2 };
}

function disposeTree(root: THREE.Object3D) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}

export interface OverheadCrowns {
  group: THREE.Group;
  update(dir: THREE.Vector3, altM: number, surfaceR: number, planet: Planet, aspect: number, fovDeg: number): number;
  dispose(): void;
}

export function createOverheadCrowns(renderer: THREE.WebGLRenderer): OverheadCrowns {
  const group = new THREE.Group();
  group.name = 'overhead-crowns';
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), alphaTest: 0.06, transparent: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    CROWN_CAP,
  );
  shadows.name = 'overhead-shadows';
  shadows.renderOrder = 1;
  shadows.frustumCulled = false;
  shadows.count = 0;
  group.add(shadows);
  const meshes: THREE.InstancedMesh[] = [];
  const widths: number[] = [];
  let baked = false;
  const pub = { count: 0, alt: 0 };
  (globalThis as { __crowns?: typeof pub }).__crowns = pub;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const east = new THREE.Vector3(), north = new THREE.Vector3(), up = new THREE.Vector3(), at = new THREE.Vector3();
  const flat = new THREE.Quaternion();
  let key = '';

  function ensure() {
    if (baked) return;
    baked = true;
    for (const seed of [11, 29, 53]) {
      const tree = buildConifer('black-spruce', seed, 55 + (seed % 40));
      try {
        const shot = bakeTopDown(renderer, tree.mid);
        const mesh = new THREE.InstancedMesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ map: shot.texture, alphaTest: 0.28, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
          CROWN_CAP,
        );
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CROWN_CAP * 3), 3);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        group.add(mesh);
        meshes.push(mesh);
        widths.push(shot.width);
      } catch (err) {
        console.warn('overhead billboard bake failed', err);
      }
      disposeTree(tree.near);
      disposeTree(tree.mid);
      tree.crown.dispose();
    }
  }

  function update(dir: THREE.Vector3, altM: number, surfaceR: number, _planet: Planet, aspect: number, fovDeg: number) {
    pub.alt = altM;
    const show = altM > 180 && altM < 2200;
    AERIAL.uCrownFloor.value = show ? 1 : 0;
    if (!show) {
      for (const mesh of meshes) mesh.count = 0;
      shadows.count = 0;
      pub.count = 0;
      return 0;
    }
    ensure();
    if (!meshes.length) { pub.count = 0; return 0; }
    const ll = toLatLon([dir.x, dir.y, dir.z]);
    const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
    const span = viewSpan(altM, fovDeg, aspect);
    const next = `${lat.toFixed(3)}:${lon.toFixed(3)}:${Math.round(altM / 50)}:${span.hx.toFixed(0)}`;
    if (next === key && meshes[0].count > 0) return pub.count;
    key = next;
    const cover = coverSampleLatLon(lat, lon);
    if (cover.water || cover.treeShare <= 0) {
      for (const mesh of meshes) mesh.count = 0;
      shadows.count = 0;
      pub.count = 0;
      return 0;
    }
    const spots = collectCrowns(span.hx, span.hy, (x, z) => standAt(x, z).stems * cover.treeShare);
    const frame = tangentFrame([dir.x, dir.y, dir.z]);
    east.set(...frame.east); north.set(...frame.north); up.set(...frame.dir);
    flat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, up));
    const counts = meshes.map(() => 0);
    const hues: [number, number, number][] = [[0.55, 0.72, 0.4], [0.72, 0.62, 0.32], [0.4, 0.58, 0.3], [0.85, 0.78, 0.38]];
    let n = 0;
    for (const spot of spots) {
      const vi = spot.slot % meshes.length;
      const mesh = meshes[vi];
      const i = counts[vi]++;
      if (i >= CROWN_CAP) continue;
      at.copy(up).multiplyScalar(surfaceR).addScaledVector(east, spot.x).addScaledVector(north, -spot.z);
      at.setLength(surfaceR + 2);
      const sc = widths[vi] * spot.scale * 2.4 * Math.max(0.05, spot.fade);
      m4.compose(at, flat, s.set(sc, sc, 1));
      mesh.setMatrixAt(i, m4);
      const hue = hues[hash(`hue:${spot.x}:${spot.z}`) % hues.length];
      mesh.instanceColor!.setXYZ(i, hue[0], hue[1], hue[2]);
      const sh = at.clone().addScaledVector(east, sc * 0.18).setLength(surfaceR + 0.2);
      m4.compose(sh, flat, s.set(sc * 1.35, sc * 1.05, 1));
      shadows.setMatrixAt(n, m4);
      n++;
    }
    for (let k = 0; k < meshes.length; k++) {
      meshes[k].count = counts[k];
      meshes[k].instanceMatrix.needsUpdate = true;
      if (meshes[k].instanceColor) meshes[k].instanceColor!.needsUpdate = true;
    }
    shadows.count = n;
    shadows.instanceMatrix.needsUpdate = true;
    pub.count = n;
    return n;
  }

  return {
    group, update,
    dispose() { group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); },
  };
}
