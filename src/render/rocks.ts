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
  const dims = whaleback ? [1, .24, .78] as const : bigTier ? [rawDims[0], Math.max(.46, rawDims[1] * .72), Math.max(.68, rawDims[2])] as const : rawDims;
  const geometry = icosphere(detail === 0 ? 1 : 0);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rough = 1 + (whaleback ? .10 : .17) * Math.sin(x * 4 + recipe.shape) * Math.cos(z * 5 - y * 3);
    const wy = whaleback ? (y > 0 ? Math.pow(y, .75) : y * 1.15) : y + x * .12 * (recipe.shape % 3);
    p.setXYZ(i, x * dims[0] * rough * recipe.flipX,
      wy * dims[1] * rough * (whaleback ? 1 : recipe.flipY), z * dims[2] * rough);
  }
  // Normalize every shape to a bounding sphere: no orientation exceeds the chosen diameter.
  geometry.computeBoundingSphere();
  const center = geometry.boundingSphere!.center.clone(), radius = geometry.boundingSphere!.radius;
  geometry.translate(-center.x, -center.y, -center.z);
  const d = rockDiameter(e);
  geometry.scale(d / (2 * radius), d / (2 * radius), d / (2 * radius));
  geometry.rotateX(bigTier ? (recipe.tilt - Math.PI) * (whaleback ? .04 : .14) : recipe.tilt);
  geometry.rotateY(e.rotation);
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
  const g0 = bigTier ? .44 + (recipe.grey - .28) * .55 : recipe.grey;
  const col = bigTier ? new THREE.Color().setRGB(g0 * 1.04, g0 * .99, g0 * .95) : new THREE.Color().setRGB(g0, g0, g0);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: col, map: texture, flatShading: true, roughness: 1, side: THREE.DoubleSide }));
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
