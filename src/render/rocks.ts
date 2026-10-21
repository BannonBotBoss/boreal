import * as THREE from 'three';
import { ROCK_SHAPES, rockDiameter, rockRecipe } from '../core/rocks';
import { STAGES, elevationGrid, sampleGrid, toWorld } from '../core/stages/elevation';
import { heightAt, type Entity } from '../core/world';
export { ROCK_SHAPES };
const pixels = new Uint8Array(16 * 16 * 4);
for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
  const i = (y * 16 + x) * 4;
  const grey = Math.round(150 + y * 4 + ((x * 13 + y * 7) % 11) * 4);
  pixels.set([grey, grey, grey, 255], i);
}
const texture = new THREE.DataTexture(pixels, 16, 16);
texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
/** Unit icosphere (detail 0 or 1) as a fresh plain BufferGeometry copy of one cached build. Building IcosahedronGeometry
 * (subdivision + UV generation in JS) per part cost 125-360 ms steps at load (2026-10-18 profile), and cloning a
 * PolyhedronGeometry rebuilds a default one in its constructor; a BufferGeometry copy is a typed-array copy. */
const ICO: THREE.BufferGeometry[] = [];
export const icosphere = (detail: number) => (ICO[detail] ??= new THREE.BufferGeometry().copy(new THREE.IcosahedronGeometry(1, detail))).clone();
export function rockGeometry(e: Entity, detail: number) {
  const recipe = rockRecipe(e.seed), rawDims = ROCK_SHAPES[recipe.shape], bigTier = recipe.size >= 9, whaleback = recipe.size === 11;
  const dims = whaleback ? [1, .36, .74] as const : bigTier ? [rawDims[0], Math.max(.52, rawDims[1] * .82), Math.max(.70, rawDims[2])] as const : rawDims;
  const geometry = icosphere(bigTier ? (detail === 0 ? 2 : detail === 1 ? 1 : 0) : (detail === 0 ? 1 : 0));
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rough = 1 + (whaleback ? .12 : .17) * Math.sin(x * 4 + recipe.shape) * Math.cos(z * 5 - y * 3);
    const wy = whaleback ? (y > 0 ? Math.pow(y, .88) * (1 + .14 * x) : y * .95) : y + x * .12 * (recipe.shape % 3);
    p.setXYZ(i, x * dims[0] * rough * recipe.flipX,
      wy * dims[1] * rough * (whaleback ? 1 : recipe.flipY), z * dims[2] * rough);
  }
  // Normalize every shape to a bounding sphere: no orientation exceeds the chosen diameter.
  geometry.computeBoundingSphere();
  const center = geometry.boundingSphere!.center.clone(), radius = geometry.boundingSphere!.radius;
  geometry.translate(-center.x, -center.y, -center.z);
  const d = rockDiameter(e);
  geometry.scale(d / (2 * radius), d / (2 * radius), d / (2 * radius));
  geometry.rotateX(bigTier ? (recipe.tilt - Math.PI) * (whaleback ? .05 : .14) : recipe.tilt);
  geometry.rotateY(e.rotation);
  // Per-vertex basal ground-contact occlusion & damp humus rim around the emerging perimeter (before slope shear).
  let minY0 = Infinity, maxY0 = -Infinity;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < minY0) minY0 = y; if (y > maxY0) maxY0 = y; }
  const spanY = Math.max(1e-3, maxY0 - minY0), vCols = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const hNorm = (p.getY(i) - minY0) / spanY;
    const u = Math.max(0, Math.min(1, (hNorm - .38) / .24)), basal = bigTier ? .44 + .56 * (u * u * (3 - 2 * u)) : .65 + .35 * hNorm;
    vCols[i * 3] = basal; vCols[i * 3 + 1] = basal * (.96 + .04 * u); vCols[i * 3 + 2] = basal * (.93 + .07 * u);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(vCols, 3));
  if (bigTier) {
    // Conform boulders and whaleback outcrops to the local terrain gradient (O(1) on elevationGrid) so uphill and downhill perimeters embed equally.
    let gx: number, gz: number;
    if (STAGES.on) {
      const g = elevationGrid(STAGES.seed);
      gx = (toWorld(g, sampleGrid(g, e.x + 1, e.z)) - toWorld(g, sampleGrid(g, e.x - 1, e.z))) * .5;
      gz = (toWorld(g, sampleGrid(g, e.x, e.z + 1)) - toWorld(g, sampleGrid(g, e.x, e.z - 1))) * .5;
    } else {
      gx = (heightAt(e.x + 1, e.z) - heightAt(e.x - 1, e.z)) * .5;
      gz = (heightAt(e.x, e.z + 1) - heightAt(e.x, e.z - 1)) * .5;
    }
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + p.getX(i) * gx + p.getZ(i) * gz);
  }
  geometry.computeVertexNormals();
  if (bigTier) {
    // Smooth dome normals across shared icosphere corners so glacially scoured whalebacks and boulders shade as rounded domes.
    const nrm = geometry.getAttribute('normal') as THREE.BufferAttribute, sums = new Map<number, [number, number, number]>();
    for (let i = 0; i < p.count; i++) {
      const k = (Math.round(p.getX(i) * 500) * 73856093) ^ (Math.round(p.getY(i) * 500) * 19349663) ^ (Math.round(p.getZ(i) * 500) * 83492791);
      const s = sums.get(k); if (s) { s[0] += nrm.getX(i); s[1] += nrm.getY(i); s[2] += nrm.getZ(i); } else sums.set(k, [nrm.getX(i), nrm.getY(i), nrm.getZ(i)]);
    }
    for (let i = 0; i < p.count; i++) {
      const k = (Math.round(p.getX(i) * 500) * 73856093) ^ (Math.round(p.getY(i) * 500) * 19349663) ^ (Math.round(p.getZ(i) * 500) * 83492791);
      const s = sums.get(k)!, l = Math.hypot(s[0], s[1], s[2]) || 1; nrm.setXYZ(i, s[0] / l, s[1] / l, s[2] / l);
    }
  }
  // Linear reflectance of Canadian Shield pink-grey orthoclase granite / quartz monzonite (USGS Spectral Library HS19.3B; Sentinel-2 Kenora bare outcrop ~0.18 mean).
  const t = (recipe.grey - .28) / .34;
  const col = new THREE.Color().setRGB(.24 + t * .08, .175 + t * .06, .13 + t * .045);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: col, map: texture, flatShading: !bigTier, roughness: .92, side: THREE.DoubleSide }));
  mesh.userData.rock = true; // render/batch maps it to the procedural ROCK_MATERIAL
  const group = new THREE.Group(); group.add(mesh); seatRock(group, e); return group;
}
const seatV = new THREE.Vector3(), seatH = new Map<number, number>();
export function seatRock(group: THREE.Object3D, e: Entity) {
  const mesh = group.children[0] as THREE.Mesh;
  mesh.rotation.set(e.rollX ?? 0, 0, e.rollZ ?? 0);
  mesh.position.y = 0; mesh.updateMatrix();
  const p = mesh.geometry.attributes.position, v = seatV, big = rockDiameter(e) > .22;
  // The ground lift only matters for small rocks; the icosphere is non-indexed (each corner repeated ~6x), so heightAt runs once
  // per distinct (x, z) corner, and the centre height once per rock (was 2 heightAt per vertex: ~480 per rock). Same result.
  let lift = -Infinity, minY = Infinity, maxY = -Infinity; const h0 = big ? 0 : heightAt(e.x, e.z); seatH.clear();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrix);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    if (big) continue;
    const k = v.x * 1048573 + v.z; let h = seatH.get(k); if (h === undefined) { h = heightAt(e.x + v.x, e.z + v.z); seatH.set(k, h); }
    lift = Math.max(lift, h - h0 - v.y);
  }
  mesh.position.y = big ? -(minY + maxY) / 2 : lift;
}
