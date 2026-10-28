/**
 * Mid-distance cover on the horizon skirt. Far cover is the ground colour.
 * Near cover is the chunk meshes. These are the billboards in between.
 * Placement is coverSpots (world/globe/coverKind.ts). Height is heightAt.
 * One instanced mesh, capped. Not a new tree species.
 */
import * as THREE from 'three';
import { heightAt } from '../core/world';
import { GLOBE_COLOURS, vegetationWeight, type Planet } from '../world/globe/planet';
import { coverKind, coverSpots, type CoverKind } from '../world/globe/coverKind';
import { skirtLatLon, type SkirtOrigin } from '../world/globe/horizonSkirt';

const COLOUR: Record<CoverKind, readonly [number, number, number]> = {
  water: GLOBE_COLOURS.shallow,
  ice: GLOBE_COLOURS.snow,
  tundra: GLOBE_COLOURS.tundra,
  rock: GLOBE_COLOURS.rock,
  desert: GLOBE_COLOURS.sand,
  prairie: GLOBE_COLOURS.temperate,
  boreal: GLOBE_COLOURS.spruce,
};

export function createHorizonCover() {
  const geo = new THREE.PlaneGeometry(2.2, 6);
  geo.translate(0, 3, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  const mesh = new THREE.InstancedMesh(geo, mat, 480);
  mesh.name = 'horizon-cover';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.count = 0;
  mesh.userData.horizonSkirt = true;
  const dummy = new THREE.Object3D();
  const colour = new THREE.Color();
  let key = '';

  function update(planet: Planet, cx: number, cz: number, origin: SkirtOrigin) {
    const ll = skirtLatLon(planet, cx, cz, origin.remote);
    const s = planet.sampleSurface(ll.dir);
    const veg = vegetationWeight(s, ll.dir);
    const water = s.kind === 'ocean' || s.kind === 'lake' || s.h < s.level;
    const kind = coverKind(ll.latDeg, s.h, veg, water);
    const next = `${kind}:${Math.round(cx / 40)}:${Math.round(cz / 40)}`;
    if (next === key) return kind;
    key = next;
    const spots = coverSpots(cx, cz, kind);
    mesh.count = spots.length;
    const tint = COLOUR[kind];
    colour.setRGB(tint[0], tint[1], tint[2]);
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      dummy.position.set(s.x, heightAt(s.x, s.z), s.z);
      dummy.scale.set(1, kind === 'prairie' ? 0.45 : kind === 'desert' ? 0.35 : 1, 1);
      dummy.lookAt(cx, dummy.position.y, cz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colour);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.kind = kind;
    mesh.userData.count = spots.length;
    return kind;
  }

  return { mesh, update, dispose() { geo.dispose(); mat.dispose(); } };
}
