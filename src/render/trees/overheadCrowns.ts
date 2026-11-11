/**
 * Overhead crowns from the existing spruce (D24).
 *
 * An octahedral impostor stood on the radial shows the side of the tree off
 * the nadir and the frame becomes a vortex of streaks. The billboard is a lit
 * top-down render of that foliage mesh, laid in the tangent plane.
 * farTreesInTile places them. Fade is world distance past the view corner,
 * so the screen rectangle does not thin. Shadows sit on the side opposite
 * the sun. The tiled canopy is off.
 */
import * as THREE from 'three';
import { FAR_TREES, farTreesInTile } from '../../core/flora/stands';
import { standAt } from '../../core/stand';
import { worldSec } from '../../core/worldClock';
import { dayAt, hourAt, sunPosition } from '../../core/timeOfDay';
import { hash } from '../../proc/rng';
import { smoothstep } from '../../proc/math';
import { coverSampleLatLon } from '../../world/globe/coverSample';
import { toLatLon, type Planet } from '../../world/globe/planet';
import { tangentFrame } from '../../world/globe/landingSite';
import { AERIAL } from '../../world/globe/aerialExemplar';
import { buildConifer } from './conifer';

export const CROWN_CAP = 24000;

/** 0 spruce, 1 spruce (cooler), 2 aspen/birch. Multiplies the baked crown. */
export const CROWN_HUES: [number, number, number][] = [
  [0.50, 0.64, 0.60],
  [0.62, 0.76, 0.64],
  [1.25, 1.15, 0.34],
];

export interface CrownSpot { x: number; z: number; slot: number; scale: number; fade: number; group: number }

/** Half-extents of the ground rectangle a nadir camera sees, metres. */
export function viewSpan(altM: number, fovDeg = 45, aspect = 16 / 9) {
  const hy = Math.max(30, altM) * Math.tan(fovDeg * Math.PI / 360);
  return { hx: hy * Math.max(0.6, aspect), hy };
}

/**
 * Thomas points across the ground the nadir camera can see, plus a margin so a
 * crown centred just outside the frame still covers the edge. `fade` is 1
 * everywhere inside that view. It falls with world distance past the corner,
 * never with the screen rectangle.
 */
export function collectCrowns(
  hx: number, hy: number,
  stems: (x: number, z: number) => number,
  dry: (x: number, z: number) => number = () => 1,
): CrownSpot[] {
  if (!(hx > 1) || !(hy > 1)) return [];
  const T = FAR_TREES.tile;
  const spots: CrownSpot[] = [];
  const corner = Math.hypot(hx, hy);
  const pad = 18;
  const tx0 = Math.floor((-hx - pad) / T) - 1, tx1 = Math.ceil((hx + pad) / T) + 1;
  const tz0 = Math.floor((-hy - pad) / T) - 1, tz1 = Math.ceil((hy + pad) / T) + 1;
  for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
    for (const p of farTreesInTile(tx, tz, 1, stems, dry)) {
      const dist = Math.hypot(p.x, p.z);
      if (dist > corner * 1.22) continue;
      const h = hash(`ov:${Math.round(p.x)}:${Math.round(p.z)}`);
      const u = (h % 10000) / 10000;
      const group = h % 10 < 6 ? 0 : h % 10 < 8 ? 1 : 2;
      const dense = Math.min(1, Math.max(0, stems(p.x, p.z)) / 900);
      const base = group === 2 ? 7 + Math.pow(u, 0.85) * 9 : 3.5 + Math.pow(u, 1.15) * 8.5;
      const scale = base * (0.75 + 0.55 * dense);
      const fade = 1 - smoothstep(corner * 1.02, corner * 1.22, dist);
      spots.push({ x: p.x, z: p.z, slot: h % 3, scale, fade, group });
    }
  }
  if (spots.length <= CROWN_CAP) return spots;
  const keep = CROWN_CAP / spots.length;
  const kept = spots.filter(s => (hash(`keep:${Math.round(s.x)}:${Math.round(s.z)}`) % 100000) / 100000 < keep);
  return kept.slice(0, CROWN_CAP);
}

/** Mid-tone moss, shrub and litter. Display sRGB, close to the NAIP gap (99, 115, 82). */
function floorTexture() {
  const n = 64, data = new Uint8Array(n * n * 4);
  const moss = [86, 116, 80], litter = [104, 118, 76], shrub = [118, 124, 74];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const h = hash(`fl:${x >> 2}:${y >> 2}`) % 1000 / 1000;
    const k = hash(`fl2:${x >> 2}:${y >> 2}`) % 1000 / 1000;
    const a = h < 0.7 ? moss : h < 0.88 ? litter : shrub;
    const i = (y * n + x) * 4;
    data[i] = a[0]; data[i + 1] = Math.max(0, a[1] - Math.round(k * 10)); data[i + 2] = a[2]; data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.repeat.set(5, 5);
  tex.needsUpdate = true;
  return tex;
}

function shadowTexture() {
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;
    const d = Math.sqrt(u * u + v * v);
    const a = d < 0.78 ? 255 : 0;
    const i = (y * n + x) * 4;
    data[i] = 46; data[i + 1] = 54; data[i + 2] = 32; data[i + 3] = a;
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Copy crown colour into the clear texels, then drop the dark fringe.
 * A black clear averaged into the mips is the outline around each crown.
 */
function sealCrown(buf: Uint8Array, size: number): { tex: THREE.DataTexture; fill: number } | null {
  const rgb = new Uint8Array(size * size * 3);
  const solid = new Uint8Array(size * size);
  let opaque = 0;
  for (let i = 0; i < size * size; i++) {
    const r = buf[i * 4], g = buf[i * 4 + 1], b = buf[i * 4 + 2], a = buf[i * 4 + 3];
    if (a > 70 && r + g + b > 48) {
      solid[i] = 1; rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = Math.max(b, g * 0.48); opaque++;
    }
  }
  if (opaque < 40) return null;
  for (let pass = 0; pass < 8; pass++) {
    const next = rgb.slice(), ns = solid.slice();
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (solid[i]) continue;
      for (const j of [i - 1, i + 1, i - size, i + size]) if (solid[j]) {
        next[i * 3] = rgb[j * 3]; next[i * 3 + 1] = rgb[j * 3 + 1]; next[i * 3 + 2] = rgb[j * 3 + 2];
        ns[i] = 1; break;
      }
    }
    rgb.set(next); solid.set(ns);
  }
  const out = new Uint8Array(size * size * 4);
  const keep = new Uint8Array(size * size);
  let minX = size, minY = size, maxX = 0, maxY = 0, cx = 0, cy = 0, nKeep = 0;
  let sr = 0, sg = 0, sb = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const a = buf[i * 4 + 3], lum = buf[i * 4] + buf[i * 4 + 1] + buf[i * 4 + 2];
    if (!(a > 80 && lum > 28)) continue;
    keep[i] = 1; nKeep++; cx += x; cy += y;
    sr += rgb[i * 3]; sg += rgb[i * 3 + 1]; sb += rgb[i * 3 + 2];
    if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
  }
  if (nKeep < 30) return null;
  // The top-down cards are a star. Fill the silhouette so the floor does not
  // show through the gaps as a dark rim, and neighbouring crowns can close.
  const inv = 1 / Math.max(1, nKeep);
  cx *= inv; cy *= inv;
  const mr = Math.max(8, sr * inv), mg = Math.max(8, sg * inv), mb = Math.max(8, sb * inv);
  let rad = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!keep[y * size + x]) continue;
    rad = Math.max(rad, Math.hypot(x - cx, y - cy));
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = (x - cx) / rad, dy = (y - cy) / rad;
    const d = Math.hypot(dx, dy);
    const wobble = 0.9 + 0.1 * ((Math.sin(dx * 9.0 + dy * 5.0) + Math.sin(dx * 4.0 - dy * 11.0)) * 0.5);
    const inside = d < wobble;
    out[i * 4] = inside ? (keep[i] ? rgb[i * 3] : mr) : rgb[i * 3];
    out[i * 4 + 1] = inside ? (keep[i] ? rgb[i * 3 + 1] : mg) : rgb[i * 3 + 1];
    out[i * 4 + 2] = inside ? (keep[i] ? rgb[i * 3 + 2] : mb) : rgb[i * 3 + 2];
    out[i * 4 + 3] = inside ? 255 : 0;
    if (inside) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  }
  const tex = new THREE.DataTexture(out, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const fill = Math.min(1, Math.max(0.35, Math.max(maxX - minX, maxY - minY, 1) / size));
  return { tex, fill };
}

/** Lit top-down billboard of one spruce's foliage. */
function bakeTopDown(renderer: THREE.WebGLRenderer, root: THREE.Object3D): { texture: THREE.Texture; fill: number } {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const reach = Math.max(size.x, size.z, 1) * 0.62;
  const cam = new THREE.OrthographicCamera(-reach, reach, reach, -reach, 0.05, Math.max(size.y, 1) + 4);
  cam.position.set(center.x, box.max.y + 1.5, center.z);
  cam.up.set(0, 0, -1);
  cam.lookAt(center);
  const sun = new THREE.DirectionalLight(0xfff6e4, 2.4);
  sun.position.set(center.x, box.max.y + reach * 4, center.z);
  const fill = new THREE.DirectionalLight(0xd5e2cc, 0.7);
  fill.position.set(center.x + reach, box.max.y + reach, center.z - reach * 0.4);
  const sky = new THREE.AmbientLight(0xc5d0c0, 1.05);
  const scene = new THREE.Scene();
  scene.add(root, sun, fill, sky);
  const n = 256;
  const rt = new THREE.WebGLRenderTarget(n, n, { format: THREE.RGBAFormat });
  const old = { rt: renderer.getRenderTarget(), pr: renderer.getPixelRatio(), cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), tm: renderer.toneMapping };
  renderer.setPixelRatio(1);
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.clear();
  renderer.render(scene, cam);
  const buf = new Uint8Array(n * n * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, n, n, buf);
  renderer.setRenderTarget(old.rt);
  renderer.setPixelRatio(old.pr);
  renderer.setClearColor(old.cc, old.ca);
  renderer.toneMapping = old.tm;
  scene.remove(root);
  const sealed = sealCrown(buf, n);
  if (sealed) { rt.dispose(); return { texture: sealed.tex, fill: sealed.fill }; }
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  rt.texture.generateMipmaps = true;
  rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
  rt.texture.needsUpdate = true;
  return { texture: rt.texture, fill: 0.7 };
}

/** Horizontal sun, in the tangent frame. Shadows fall the other way. */
function shadowAway(planet: Planet, east: THREE.Vector3, north: THREE.Vector3) {
  const d = sunPosition(hourAt(worldSec()), dayAt(worldSec())).direction;
  const sun = new THREE.Vector3(...planet.east).multiplyScalar(d.x)
    .addScaledVector(new THREE.Vector3(...planet.home), d.y)
    .addScaledVector(new THREE.Vector3(...planet.north), -d.z);
  let se = sun.dot(east), sn = sun.dot(north);
  const len = Math.hypot(se, sn);
  if (len < 1e-4) return { e: -1, n: 0 };
  return { e: -se / len, n: -sn / len };
}

function disposeTree(root: THREE.Object3D) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.geometry.dispose();
  });
}

export interface OverheadCrowns {
  group: THREE.Group;
  update(dir: THREE.Vector3, altM: number, surfaceR: number, planet: Planet, aspect: number, fovDeg: number, camera: THREE.Camera): number;
  dispose(): void;
}

export function createOverheadCrowns(renderer: THREE.WebGLRenderer): OverheadCrowns {
  const group = new THREE.Group();
  group.name = 'overhead-crowns';
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: floorTexture(), depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
  );
  floor.name = 'overhead-floor';
  floor.renderOrder = 0.5;
  floor.frustumCulled = false;
  floor.visible = false;
  group.add(floor);
  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), alphaTest: 0.5, transparent: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
    CROWN_CAP,
  );
  shadows.name = 'overhead-shadows';
  shadows.renderOrder = 1;
  shadows.frustumCulled = false;
  shadows.count = 0;
  group.add(shadows);
  const meshes: THREE.InstancedMesh[] = [];
  const fills: number[] = [];
  let baked = false;
  const pub = { count: 0, alt: 0 };
  (globalThis as { __crowns?: typeof pub }).__crowns = pub;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const east = new THREE.Vector3(), north = new THREE.Vector3(), up = new THREE.Vector3(), at = new THREE.Vector3();
  const ax = new THREE.Vector3(), ay = new THREE.Vector3();
  const flat = new THREE.Quaternion(), shQ = new THREE.Quaternion();
  let key = '';

  function ensure() {
    if (baked) return;
    baked = true;
    for (const seed of [11, 29, 53]) {
      const tree = buildConifer('black-spruce', seed, 55 + (seed % 40));
      try {
        const foliage = tree.mid.children[1] ?? tree.mid;
        const shot = bakeTopDown(renderer, foliage);
        const mesh = new THREE.InstancedMesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({ map: shot.texture, alphaTest: 0.5, transparent: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide }),
          CROWN_CAP,
        );
        mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CROWN_CAP * 3), 3);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.renderOrder = 2;
        group.add(mesh);
        meshes.push(mesh);
        fills.push(shot.fill);
      } catch (err) {
        console.warn('overhead crown bake failed', err);
      }
      disposeTree(tree.near);
      disposeTree(tree.mid);
      tree.crown.dispose();
    }
  }

  function update(dir: THREE.Vector3, altM: number, surfaceR: number, _planet: Planet, aspect: number, fovDeg: number, camera: THREE.Camera) {
    pub.alt = altM;
    const show = altM > 180 && altM < 2200;
    AERIAL.uCrownFloor.value = show ? 1 : 0;
    if (!show) {
      floor.visible = false;
      for (const mesh of meshes) mesh.count = 0;
      shadows.count = 0;
      pub.count = 0;
      return 0;
    }
    ensure();
    if (!meshes.length) { floor.visible = false; pub.count = 0; return 0; }
    const ll = toLatLon([dir.x, dir.y, dir.z]);
    const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
    const span = viewSpan(altM, fovDeg, aspect);
    const next = `${lat.toFixed(3)}:${lon.toFixed(3)}:${Math.round(altM / 50)}:${span.hx.toFixed(0)}`;
    if (next === key && meshes[0].count > 0) return pub.count;
    key = next;
    const cover = coverSampleLatLon(lat, lon);
    if (cover.water || cover.treeShare <= 0) {
      floor.visible = false;
      for (const mesh of meshes) mesh.count = 0;
      shadows.count = 0;
      pub.count = 0;
      return 0;
    }
    const spots = collectCrowns(span.hx, span.hy, (x, z) => standAt(x, z).stems * cover.treeShare);
    const frame = tangentFrame([dir.x, dir.y, dir.z]);
    east.set(...frame.east); north.set(...frame.north); up.set(...frame.dir);
    flat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, up));
    const cam = camera.position;
    floor.visible = true;
    floor.quaternion.copy(flat);
    floor.position.copy(up).multiplyScalar(surfaceR).sub(cam);
    floor.scale.set(span.hx * 2.6, span.hy * 2.6, 1);
    const counts = meshes.map(() => 0);
    const away = shadowAway(_planet, east, north);
    let n = 0;
    for (const spot of spots) {
      if (spot.fade < 0.04) continue;
      const vi = spot.slot % meshes.length;
      const mesh = meshes[vi];
      const i = counts[vi]++;
      if (i >= CROWN_CAP) continue;
      at.copy(up).multiplyScalar(surfaceR).addScaledVector(east, spot.x).addScaledVector(north, -spot.z);
      at.setLength(surfaceR + 1);
      at.sub(cam);
      const vis = spot.scale;
      const quad = vis / (fills[vi] || 1);
      m4.compose(at, flat, s.set(quad, quad, 1));
      mesh.setMatrixAt(i, m4);
      const hue = CROWN_HUES[spot.group] ?? CROWN_HUES[0];
      mesh.instanceColor!.setXYZ(i, hue[0] * spot.fade, hue[1] * spot.fade, hue[2] * spot.fade);
      ax.copy(east).multiplyScalar(away.e).addScaledVector(north, away.n);
      ay.copy(up).cross(ax);
      shQ.setFromRotationMatrix(m4.makeBasis(ax, ay, up));
      const sh = at.clone().addScaledVector(ax, vis * 0.46);
      m4.compose(sh, shQ, s.set(vis * 0.55, vis * 0.55, 1));
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
