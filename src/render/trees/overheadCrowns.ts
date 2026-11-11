/**
 * Overhead crowns (D24).
 *
 * A nadir camera looks at the top of the stand. A vertical billboard is edge-on
 * and disappears. These are horizontal quads, the top view of an impostor
 * (the same idea as an octahedral impostor's overhead frame, drawn as one
 * InstancedMesh). Placement is farTreesInTile, the Thomas clusters the far
 * stand already uses (Thomas 1949, via core/flora/stands). Not a satellite photo.
 *
 * Crown width 8–13 m. A mature black spruce crown is a few metres
 * (Viereck & Johnston 1990). At 400 m that is under 20 pixels and it
 * disappears into the tile noise, so the impostor is the crown plus its
 * shadow, wide enough to read, and spaced at 14 m so the ground shows between.
 */
import * as THREE from 'three';
import { FAR_TREES, farTreesInTile } from '../../core/flora/stands';
import { standAt } from '../../core/stand';
import { hash } from '../../proc/rng';
import { coverSampleLatLon } from '../../world/globe/coverSample';
import { toLatLon, type Planet } from '../../world/globe/planet';
import { tangentFrame } from '../../world/globe/landingSite';

export const CROWN_CAP = 6000;
export const CROWN_MIN_M = 8;
export const CROWN_MAX_M = 13;
const ATLAS = 48;
const SLOTS = 4;

/** One top-down crown. Alpha is 0 outside the disc, so the quad is not a square. */
export function crownSprite(slot: number, size = ATLAS): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const cx = (size - 1) / 2, cy = (size - 1) / 2;
  const squash = 0.82 + (slot % 3) * 0.08;
  const rot = slot * 0.7;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - cx) / (size * 0.42);
    const dy = (y - cy) / (size * 0.42 * squash);
    const xr = dx * Math.cos(rot) - dy * Math.sin(rot);
    const yr = dx * Math.sin(rot) + dy * Math.cos(rot);
    const blob = xr * xr + yr * yr + 0.18 * Math.sin(xr * 9 + slot) * Math.sin(yr * 7);
    if (blob > 1) continue;
    const sun = 0.72 + 0.4 * (1 - x / (size - 1));
    const gap = Math.sin(xr * 14 + slot) * Math.sin(yr * 11) > 0.72;
    const i = (y * size + x) * 4;
    rgba[i] = Math.round((gap ? 30 : 12) * sun);
    rgba[i + 1] = Math.round((gap ? 90 : 48) * sun);
    rgba[i + 2] = Math.round((gap ? 24 : 14) * sun);
    rgba[i + 3] = 255;
  }
  return rgba;
}

export function crownAtlas(): Uint8ClampedArray {
  const w = ATLAS * SLOTS, h = ATLAS, out = new Uint8ClampedArray(w * h * 4);
  for (let s = 0; s < SLOTS; s++) {
    const sprite = crownSprite(s);
    for (let y = 0; y < ATLAS; y++) out.set(sprite.subarray(y * ATLAS * 4, (y + 1) * ATLAS * 4), (y * w + s * ATLAS) * 4);
  }
  return out;
}

export interface CrownSpot { x: number; z: number; slot: number; metres: number }

/**
 * Crowns inside `radiusM` of the origin, from the existing far-stand placement.
 * `density` is the governor factor farTreesInTile already takes. Over the cap,
 * every k-th crown is kept so the disc stays covered and the gaps stay put.
 */
export function collectCrowns(
  radiusM: number,
  density: number,
  stems: (x: number, z: number) => number,
  dry: (x: number, z: number) => number = () => 1,
): CrownSpot[] {
  if (!(radiusM > 0) || !(density > 0)) return [];
  const T = FAR_TREES.tile;
  const r = Math.ceil(radiusM / T);
  const spots: CrownSpot[] = [];
  for (let tz = -r; tz <= r; tz++) for (let tx = -r; tx <= r; tx++) {
    for (const p of farTreesInTile(tx, tz, density, stems, dry)) {
      if (p.x * p.x + p.z * p.z > radiusM * radiusM) continue;
      const h = hash(`crown:${Math.round(p.x)}:${Math.round(p.z)}`);
      const metres = CROWN_MIN_M + (h % 1000) / 1000 * (CROWN_MAX_M - CROWN_MIN_M);
      spots.push({ x: p.x, z: p.z, slot: h % SLOTS, metres });
    }
  }
  return spots;
}

/**
 * One crown per patch of ground. The stand list is every stem; from overhead
 * the crowns that read are several metres apart (a 5 m crown with a gap).
 * Points that fail the spacing are dropped. The ones that remain are still
 * Thomas-cluster positions.
 */
export function spaceCrowns(spots: CrownSpot[], minM = 7): CrownSpot[] {
  const cell = minM;
  const grid = new Map<string, CrownSpot[]>();
  const kept: CrownSpot[] = [];
  for (const s of spots) {
    const gx = Math.floor(s.x / cell), gz = Math.floor(s.z / cell);
    let ok = true;
    for (let dz = -1; dz <= 1 && ok; dz++) for (let dx = -1; dx <= 1 && ok; dx++) {
      for (const o of grid.get(`${gx + dx}:${gz + dz}`) ?? []) {
        if ((o.x - s.x) ** 2 + (o.z - s.z) ** 2 < minM * minM) { ok = false; break; }
      }
    }
    if (!ok) continue;
    kept.push(s);
    const key = `${gx}:${gz}`;
    const list = grid.get(key);
    if (list) list.push(s); else grid.set(key, [s]);
    if (kept.length >= CROWN_CAP) break;
  }
  return kept;
}

/** View radius on the ground for a nadir camera. */
export function nadirRadius(altM: number, fovDeg = 45) {
  return Math.max(40, altM) * Math.tan((fovDeg * Math.PI / 180) / 2) * 1.15;
}

export interface OverheadCrowns {
  mesh: THREE.InstancedMesh;
  update(dir: THREE.Vector3, altM: number, radius: number, planet: Planet): number;
  dispose(): void;
}

export function createOverheadCrowns(): OverheadCrowns {
  const sprite = crownSprite(1);
  const tex = new THREE.DataTexture(sprite, ATLAS, ATLAS);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  const geo = new THREE.PlaneGeometry(1, 1);
  // No custom shader. The globe's log-depth materials do not share a depth
  // buffer with a default material, so the discs draw on top while the eye is
  // in the nadir band. A vertical billboard would be edge-on from here.
  const mat = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.4, transparent: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, CROWN_CAP);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CROWN_CAP * 3), 3);
  mesh.name = 'overhead-crowns';
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.renderOrder = 2;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), up = new THREE.Vector3();
  const east = new THREE.Vector3(), north = new THREE.Vector3();
  let key = '';
  const pub = { count: 0, alt: 0 };
  (globalThis as { __crowns?: typeof pub }).__crowns = pub;
  function update(dir: THREE.Vector3, altM: number, radius: number, planet: Planet) {
    pub.alt = altM;
    const show = altM > 180 && altM < 2200;
    if (!show) { mesh.count = 0; pub.count = 0; return 0; }
    const ll = toLatLon([dir.x, dir.y, dir.z]);
    const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
    const next = `${lat.toFixed(3)}:${lon.toFixed(3)}:${Math.round(altM / 40)}`;
    if (next === key && mesh.count > 0) return mesh.count;
    key = next;
    const cover = coverSampleLatLon(lat, lon);
    if (cover.water || cover.treeShare <= 0) { mesh.count = 0; pub.count = 0; return 0; }
    const reach = nadirRadius(altM);
    const spots = spaceCrowns(collectCrowns(reach, 1, (x, z) => standAt(x, z).stems * cover.treeShare), 14);
    const frame = tangentFrame([dir.x, dir.y, dir.z]);
    east.set(frame.east[0], frame.east[1], frame.east[2]);
    north.set(frame.north[0], frame.north[1], frame.north[2]);
    up.set(frame.dir[0], frame.dir[1], frame.dir[2]);
    q.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, up));
    const colors = mesh.instanceColor!;
    // `radius` is the visible surface radius (R + ground), the same length the tiles use.
    const at = new THREE.Vector3();
    let n = 0;
    for (const spot of spots) {
      if (n >= CROWN_CAP) break;
      at.copy(up).multiplyScalar(radius).addScaledVector(east, spot.x).addScaledVector(north, -spot.z);
      at.setLength(radius + 12);
      m.compose(at, q, s.set(spot.metres, spot.metres, 1));
      mesh.setMatrixAt(n, m);
      const shade = 0.75 + (spot.slot % 4) * 0.08;
      colors.setXYZ(n, shade, shade, shade * 0.85);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    colors.needsUpdate = true;
    pub.count = n;
    return n;
  }
  return {
    mesh, update,
    dispose() { geo.dispose(); mat.dispose(); tex.dispose(); },
  };
}
