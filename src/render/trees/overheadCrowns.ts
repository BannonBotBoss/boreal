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
import { hash } from '../../proc/rng';
import { smoothstep } from '../../proc/math';
import { coverSampleLatLon } from '../../world/globe/coverSample';
import { PLANET, toLatLon, vegetationWeight, type Planet } from '../../world/globe/planet';
import { tangentFrame } from '../../world/globe/landingSite';
import { AERIAL } from '../../world/globe/aerialExemplar';
import { buildConifer } from './conifer';

export const CROWN_CAP = 40000;

/** Small multipliers. The bake is already graded to the NAIP range. */
export const CROWN_HUES: [number, number, number][] = [
  [0.90, 0.94, 0.88],
  [0.84, 0.90, 0.90],
  [1.04, 1.00, 0.78],
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
  cover: (x: number, z: number) => number = () => 1,
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
      const c = Math.max(0, Math.min(1, cover(p.x, p.z)));
      if (c < 0.22) continue;
      const h = hash(`ov:${Math.round(p.x)}:${Math.round(p.z)}`);
      // vegetation weight is a canopy fraction, not a keep-every-stem flag.
      // Full stems at this weight tile the view; scale the keep to that fraction.
      if ((h % 1000) / 1000 > c * 0.18) continue;
      const u = (h % 10000) / 10000;
      const aspen = c > 0.55 && h % 8 === 0;
      const group = aspen ? 2 : h % 5 === 0 ? 1 : 0;
      const base = aspen ? 9 + u * 4 : 6.5 + Math.pow(u, 1.2) * 4;
      const scale = base * (0.85 + 0.15 * c);
      const fade = 1 - smoothstep(corner * 1.02, corner * 1.22, dist);
      spots.push({ x: p.x, z: p.z, slot: h % 3, scale, fade, group });
    }
  }
  if (spots.length <= CROWN_CAP) return spots;
  const keep = CROWN_CAP / spots.length;
  const kept = spots.filter(s => (hash(`keep:${Math.round(s.x)}:${Math.round(s.z)}`) % 100000) / 100000 < keep);
  return kept.slice(0, CROWN_CAP);
}

/** Mid olive, darker moss, and tan openings. Smooth, so it is not a pixel quilt. */
function floorTexture() {
  const n = 128, g = 24, cell = new Float32Array(g * g), cell2 = new Float32Array(g * g);
  for (let i = 0; i < g * g; i++) { cell[i] = (hash(`fl:${i}`) % 1000) / 1000; cell2[i] = (hash(`flb:${i}`) % 1000) / 1000; }
  const at = (grid: Float32Array, x: number, y: number) => {
    const fx = (x / n) * g, fy = (y / n) * g;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const s = (ix: number, iy: number) => grid[(((iy % g) + g) % g) * g + (((ix % g) + g) % g)];
    const a = s(x0, y0) * (1 - tx) + s(x0 + 1, y0) * tx;
    const b = s(x0, y0 + 1) * (1 - tx) + s(x0 + 1, y0 + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  const moss = [110, 121, 98], shade = [57, 67, 53], litter = [162, 146, 118];
  const data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = at(cell, x, y), w = at(cell2, x, y);
    const t = u < 0.72 ? u / 0.72 : 1;
    const base = u < 0.72 ? shade : moss;
    const mix = u < 0.72 ? moss : litter;
    const k = u < 0.72 ? t : (u - 0.72) / 0.28;
    const tan = w > 0.62 ? (w - 0.62) / 0.38 : 0;
    const i = (y * n + x) * 4;
    for (let c = 0; c < 3; c++) {
      const v = base[c] * (1 - k) + mix[c] * k;
      data[i + c] = Math.round(v * (1 - tan) + litter[c] * tan);
    }
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.repeat.set(3, 3);
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

/** Keep the bake's light and dark. Pull hue and saturation into the NAIP spruce range. */
function gradeFoliage(r: number, g: number, b: number): [number, number, number] {
  const lum = (0.25 * r + 0.65 * g + 0.1 * b) / 255;
  const v = Math.min(0.66, 0.12 + lum * 0.72);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 110;
  if (d > 2) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  const h2 = 112 + (h - 110) * 0.45;
  const s2 = 0.18 + Math.min(0.14, (mx - mn) / 320);
  const c = v * s2, hp = ((h2 % 360) + 360) % 360 / 60, x = c * (1 - Math.abs(hp % 2 - 1));
  let rr = 0, gg = 0, bb = 0;
  if (hp < 1) { rr = c; gg = x; }
  else if (hp < 2) { rr = x; gg = c; }
  else if (hp < 3) { gg = c; bb = x; }
  else if (hp < 4) { gg = x; bb = c; }
  else if (hp < 5) { rr = x; bb = c; }
  else { rr = c; bb = x; }
  const m = v - c;
  return [Math.round((rr + m) * 255), Math.round((gg + m) * 255), Math.round((bb + m) * 255)];
}

/**
 * Keep the lit foliage pixels. Do not fill the silhouette: a flat disc is the
 * clip-art crown. Clear texels copy a neighbour's colour so the mips do not
 * pull in the black clear.
 */
function sealCrown(buf: Uint8Array, size: number): { tex: THREE.DataTexture; fill: number } | null {
  const rgb = new Uint8Array(size * size * 3);
  const solid = new Uint8Array(size * size);
  let opaque = 0;
  for (let i = 0; i < size * size; i++) {
    const r = buf[i * 4], g = buf[i * 4 + 1], b = buf[i * 4 + 2], a = buf[i * 4 + 3];
    if (a > 90 && r + g + b > 30) {
      const [rr, gg, bb] = gradeFoliage(r, g, b);
      solid[i] = 1; rgb[i * 3] = rr; rgb[i * 3 + 1] = gg; rgb[i * 3 + 2] = bb; opaque++;
    }
  }
  if (opaque < 40) return null;
  // Close small holes between needle cards. Original pixels keep their shade,
  // so the lit side and the shaded side stay. This is not a flat disc fill.
  for (let pass = 0; pass < 18; pass++) {
    const ns = solid.slice(), next = rgb.slice();
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (solid[i]) continue;
      for (const j of [i - 1, i + 1, i - size, i + size]) if (solid[j]) {
        ns[i] = 1; next[i * 3] = rgb[j * 3]; next[i * 3 + 1] = rgb[j * 3 + 1]; next[i * 3 + 2] = rgb[j * 3 + 2];
        break;
      }
    }
    solid.set(ns); rgb.set(next);
  }
  for (let pass = 0; pass < 7; pass++) {
    const ns = solid.slice();
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (!solid[i]) continue;
      if (!solid[i - 1] || !solid[i + 1] || !solid[i - size] || !solid[i + size]) ns[i] = 0;
    }
    // Keep the real foliage pixels through the erode.
    for (let i = 0; i < size * size; i++) if (buf[i * 4 + 3] > 90) ns[i] = 1;
    solid.set(ns);
  }
  for (let pass = 0; pass < 4; pass++) {
    const next = rgb.slice();
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const i = y * size + x;
      if (solid[i]) continue;
      for (const j of [i - 1, i + 1, i - size, i + size]) if (solid[j] || next[j * 3] + next[j * 3 + 1] > 0) {
        next[i * 3] = rgb[j * 3]; next[i * 3 + 1] = rgb[j * 3 + 1]; next[i * 3 + 2] = rgb[j * 3 + 2];
        break;
      }
    }
    rgb.set(next);
  }
  const out = new Uint8Array(size * size * 4);
  let minX = size, minY = size, maxX = 0, maxY = 0, nKeep = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    out[i * 4] = rgb[i * 3]; out[i * 4 + 1] = rgb[i * 3 + 1]; out[i * 4 + 2] = rgb[i * 3 + 2];
    out[i * 4 + 3] = solid[i] ? 255 : 0;
    if (solid[i]) {
      nKeep++;
      if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
  }
  if (nKeep < 30) return null;
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
  const sun = new THREE.DirectionalLight(0xfff0d2, 3.1);
  sun.position.set(center.x + reach * 2.4, box.max.y + reach * 0.55, center.z + reach * 0.35);
  const fill = new THREE.DirectionalLight(0x9eb4c8, 0.28);
  fill.position.set(center.x - reach, box.max.y + reach * 0.2, center.z - reach);
  const sky = new THREE.AmbientLight(0x8ea0b4, 0.32);
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

/** Vegetation weight of the cover model, cached on a 24 m grid. 0 opens a gap. */
function coverAt(planet: Planet, east: THREE.Vector3, north: THREE.Vector3, up: THREE.Vector3) {
  const cache = new Map<string, number>();
  const R = PLANET.radius;
  const p = new THREE.Vector3();
  return (x: number, z: number) => {
    const ix = Math.round(x / 24), iz = Math.round(z / 24);
    const key = `${ix}:${iz}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    p.copy(up).addScaledVector(east, x / R).addScaledVector(north, -z / R).normalize();
    const d = p.toArray() as [number, number, number];
    const w = vegetationWeight(planet.sampleSurface(d), d);
    cache.set(key, w);
    return w;
  };
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
  const flat = new THREE.Quaternion(), spin = new THREE.Quaternion();
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
    const frame = tangentFrame([dir.x, dir.y, dir.z]);
    east.set(...frame.east); north.set(...frame.north); up.set(...frame.dir);
    const localCover = coverAt(_planet, east, north, up);
    const spots = collectCrowns(
      span.hx, span.hy,
      (x, z) => standAt(x, z).stems * cover.treeShare * localCover(x, z),
      () => 1,
      localCover,
    );
    flat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, up));
    const cam = camera.position;
    floor.visible = true;
    floor.quaternion.copy(flat);
    floor.position.copy(up).multiplyScalar(surfaceR).sub(cam);
    floor.scale.set(span.hx * 2.6, span.hy * 2.6, 1);
    const counts = meshes.map(() => 0);
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
      const ang = (hash(`rot:${Math.round(spot.x)}:${Math.round(spot.z)}`) % 628) / 100;
      spin.setFromAxisAngle(up, ang).multiply(flat);
      m4.compose(at, spin, s.set(quad, quad, 1));
      mesh.setMatrixAt(i, m4);
      const hue = CROWN_HUES[spot.group] ?? CROWN_HUES[0];
      mesh.instanceColor!.setXYZ(i, hue[0] * spot.fade, hue[1] * spot.fade, hue[2] * spot.fade);
      n++;
    }
    for (let k = 0; k < meshes.length; k++) {
      meshes[k].count = counts[k];
      meshes[k].instanceMatrix.needsUpdate = true;
      if (meshes[k].instanceColor) meshes[k].instanceColor!.needsUpdate = true;
    }
    shadows.count = 0;
    shadows.instanceMatrix.needsUpdate = true;
    pub.count = n;
    return n;
  }

  return {
    group, update,
    dispose() { group.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }); },
  };
}
