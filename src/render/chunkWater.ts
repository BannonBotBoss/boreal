/**
 * Water meshes for one chunk.
 *
 * The flat teal plane (PlaneGeometry at LEVEL.waterSurface) is the open-water sheet.
 * It follows the cover sample: a dry prairie sample does not get a lake painted under it.
 *
 * The staged sheet is different. terrainCore builds it where lakeAt, pondAt or riverAt
 * says water (stages 2b/2c). isDryLand still treats those cells as water (world.ts),
 * so hiding the sheet leaves an empty carved channel. That sheet is always mounted
 * when the terrain job produced it.
 */
import * as THREE from 'three';
import { CHUNK_SIZE } from '../core/world';
import { LEVEL } from '../core/tuning';

export interface MountedWater {
  /** The flat cover-sample plane, or null when the sample is dry. */
  sheet: THREE.Mesh | null;
  /** The staged lake / river surface, or null when this chunk has none. */
  staged: THREE.Mesh | null;
}

export function mountChunkWater(
  root: THREE.Object3D,
  cx: number,
  cz: number,
  openSheet: boolean,
  staged: THREE.BufferGeometry | null,
  material: THREE.Material,
): MountedWater {
  let sheet: THREE.Mesh | null = null;
  let lake: THREE.Mesh | null = null;
  if (openSheet) {
    sheet = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE), material);
    sheet.name = 'open-water-sheet';
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.set((cx + .5) * CHUNK_SIZE, LEVEL.waterSurface, (cz + .5) * CHUNK_SIZE);
    root.add(sheet);
  }
  if (staged) {
    lake = new THREE.Mesh(staged, material);
    lake.name = 'staged-water';
    lake.userData.inspect = { type: 'terrain', key: `water:${cx}:${cz}` };
    root.add(lake);
  }
  return { sheet, staged: lake };
}
