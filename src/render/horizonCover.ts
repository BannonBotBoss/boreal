/**
 * Mid-distance cover on the horizon skirt. Far cover is the ground colour.
 * Near cover is the chunk meshes. These are the billboards in between.
 * Placement is coverSpots (world/globe/coverKind.ts). Height is heightAt.
 * One instanced mesh, capped. Not a new tree species.
 */
import * as THREE from 'three';
import { heightAt } from '../core/world';
import { vegetationWeight, type Planet } from '../world/globe/planet';
import { coverKind, coverSpots, type CoverKind } from '../world/globe/coverKind';
import { skirtLatLon, type SkirtOrigin } from '../world/globe/horizonSkirt';
import { treeAtlas } from './trees/billboardAtlas';
import { elevationWins, sampleDem } from '../world/globe/openTiles';

const ATLAS = treeAtlas();
const treeTex = new THREE.DataTexture(ATLAS.rgba, ATLAS.w, ATLAS.h);
treeTex.colorSpace = THREE.SRGBColorSpace;
treeTex.magFilter = THREE.LinearFilter;
treeTex.minFilter = THREE.LinearFilter;
treeTex.needsUpdate = true;
/** 0 = conifer (left half), 1 = broadleaf (right half). */
function treeSlot(kind: CoverKind) { return kind === 'boreal' ? 0 : 1; }

export function createHorizonCover() {
  const geo = new THREE.PlaneGeometry(2.4, 7);
  geo.translate(0, 3.5, 0);
  const slots = new Float32Array(480);
  geo.setAttribute('aTree', new THREE.InstancedBufferAttribute(slots, 1));
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.85, metalness: 0, side: THREE.DoubleSide,
    map: treeTex, alphaTest: 0.4, alphaToCoverage: true, transparent: false,
  });
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTree;\nvarying float vTree;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTree = aTree;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vTree;')
      .replace('#include <map_fragment>', `
        vec4 sampledDiffuseColor = texture2D(map, vec2(vMapUv.x * 0.5 + vTree * 0.5, vMapUv.y));
        diffuseColor *= sampledDiffuseColor;
      `);
  };
  mat.customProgramCacheKey = () => 'horizon-cover-tree-atlas';
  const mesh = new THREE.InstancedMesh(geo, mat, 480);
  mesh.name = 'horizon-cover';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.count = 0;
  mesh.userData.horizonSkirt = true;
  const dummy = new THREE.Object3D();
  const white = new THREE.Color(1, 1, 1);
  let key = '';

  function update(planet: Planet, cx: number, cz: number, origin: SkirtOrigin) {
    const ll = skirtLatLon(planet, cx, cz, origin.remote);
    const s = planet.sampleSurface(ll.dir);
    const veg = vegetationWeight(s, ll.dir);
    const dem = sampleDem(ll.latDeg, ll.lonDeg);
    const water = !elevationWins(s.kind, dem) && (s.kind === 'ocean' || s.kind === 'lake' || s.h < s.level);
    const kind = coverKind(ll.latDeg, dem != null && dem > 0 ? dem : s.h, veg, water);
    const next = `${kind}:${dem != null ? Math.round(dem) : 'x'}:${Math.round(cx / 40)}:${Math.round(cz / 40)}`;
    if (next === key) return kind;
    key = next;
    const spots = coverSpots(cx, cz, kind);
    mesh.count = spots.length;
    const slot = treeSlot(kind);
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      dummy.position.set(s.x, heightAt(s.x, s.z), s.z);
      dummy.scale.set(1, kind === 'prairie' ? 0.45 : kind === 'desert' ? 0.35 : 1, 1);
      dummy.lookAt(cx, dummy.position.y + 3, cz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, white);
      slots[i] = slot;
    }
    (geo.getAttribute('aTree') as THREE.InstancedBufferAttribute).needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.kind = kind;
    mesh.userData.count = spots.length;
    return kind;
  }

  return { mesh, update, dispose() { geo.dispose(); mat.dispose(); } };
}
