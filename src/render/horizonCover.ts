/**
 * Mid-distance cover on the horizon skirt. Far cover is the ground colour.
 * Near cover is the chunk meshes. These are the billboards in between.
 * Placement is coverSpots (world/globe/coverKind.ts). Ground height is heightAt; plant height is the simulation's
 * cover row (coverRow, cover.rs #167), so prairie clumps are knee-high and boreal spruce 10-25 m, not one card size.
 * One instanced mesh, capped. Not a new tree species.
 */
import * as THREE from 'three';
import { heightAt } from '../core/world';
import { vegetationWeight, type Planet } from '../world/globe/planet';
import { coverRow, coverSpots, type CoverKind } from '../world/globe/coverKind';
import { skirtLatLon, type SkirtOrigin } from '../world/globe/horizonSkirt';
import { treeAtlas } from './trees/billboardAtlas';
import { CC0_TREES, bakeTreeAtlas } from './trees/cc0Impostors';
import { elevationWins, sampleDem } from '../world/globe/openTiles';
import { STYLIZED } from './stylizedPalette';

const CAP = 4096;
const ATLAS = treeAtlas();
const treeTex = new THREE.DataTexture(ATLAS.rgba, ATLAS.w, ATLAS.h);
treeTex.colorSpace = THREE.SRGBColorSpace;
treeTex.magFilter = THREE.LinearFilter;
treeTex.minFilter = THREE.LinearFilter;
treeTex.needsUpdate = true;
const colsUniform = { value: 2 };
const normalUniform = { value: null as THREE.Texture | null };

/** Boreal uses the three pines. Prairie and desert use the two broadleaf cards. */
export function treeSlot(kind: CoverKind, x: number, z: number) {
  const h = Math.abs(Math.sin(x * 0.17 + z * 0.09));
  if (kind === 'boreal') return Math.floor(h * 3) % 3;
  return 3 + (Math.floor(h * 2) % 2);
}

/** Card is 10 m tall at scale 1. Scale to the cover row's plant height, with a +-15% per-spot spread. */
export const CARD_HEIGHT_M = 10;
export function billboardScale(heightM: number, x: number) {
  return (heightM / CARD_HEIGHT_M) * (0.85 + 0.3 * Math.abs(Math.sin(x * 0.07)));
}

export function createHorizonCover(renderer?: THREE.WebGLRenderer) {
  const geo = new THREE.PlaneGeometry(5.2, 10);
  geo.translate(0, 5, 0);
  const slots = new Float32Array(CAP);
  geo.setAttribute('aTree', new THREE.InstancedBufferAttribute(slots, 1));
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.8, metalness: 0, side: THREE.DoubleSide,
    map: treeTex, alphaTest: 0.35, alphaToCoverage: true, transparent: false,
  });
  mat.emissive.setRGB(STYLIZED.foliageLift[0], STYLIZED.foliageLift[1], STYLIZED.foliageLift[2]); // stylized fill so far crowns read with the near foliage (#192)
  mat.onBeforeCompile = shader => {
    shader.uniforms.uTreeCols = colsUniform;
    shader.uniforms.uTreeNormal = normalUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTree;\nvarying float vTree;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTree = aTree;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTreeCols;\nuniform sampler2D uTreeNormal;\nvarying float vTree;')
      .replace('#include <map_fragment>', `
        vec2 treeUv = vec2((vMapUv.x + vTree) / max(uTreeCols, 1.0), vMapUv.y);
        vec4 sampledDiffuseColor = texture2D(map, treeUv);
        diffuseColor *= sampledDiffuseColor;
      `)
      .replace('#include <normal_fragment_maps>', `
        #include <normal_fragment_maps>
        if (uTreeCols > 2.5) {
          vec2 treeUv = vec2((vMapUv.x + vTree) / max(uTreeCols, 1.0), vMapUv.y);
          vec3 n = texture2D(uTreeNormal, treeUv).xyz * 2.0 - 1.0;
          normal = normalize(mix(normal, n, 0.65));
        }
      `);
  };
  mat.customProgramCacheKey = () => 'horizon-cover-cc0-impostor';
  const mesh = new THREE.InstancedMesh(geo, mat, CAP);
  mesh.name = 'horizon-cover';
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.count = 0;
  mesh.userData.horizonSkirt = true;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color(1, 1, 1);
  let key = '';
  let baking = false;
  function bake() {
    if (baking || !renderer || colsUniform.value > 2.5) return;
    baking = true;
    void bakeTreeAtlas(renderer).then(atlas => {
      baking = false;
      if (!atlas) return;
      mat.map = atlas.albedo;
      normalUniform.value = atlas.normal;
      colsUniform.value = atlas.cols;
      mat.needsUpdate = true;
      key = '';
    });
  }

  function update(planet: Planet, cx: number, cz: number, origin: SkirtOrigin) {
    const ll = skirtLatLon(planet, cx, cz, origin.remote);
    const s = planet.sampleSurface(ll.dir);
    const veg = vegetationWeight(s, ll.dir);
    const dem = sampleDem(ll.latDeg, ll.lonDeg);
    const water = !elevationWins(s.kind, dem) && (s.kind === 'ocean' || s.kind === 'lake' || s.h < s.level);
    const row = coverRow(ll.latDeg, ll.lonDeg, dem != null && dem > 0 ? dem : s.h, veg, water);
    const kind = row.kind;
    bake();
    const cols = colsUniform.value;
    const next = `${kind}:${row.heightM.toFixed(1)}:${cols}:${dem != null ? Math.round(dem) : 'x'}:${Math.round(cx / 40)}:${Math.round(cz / 40)}`;
    if (next === key) return kind;
    key = next;
    const spots = coverSpots(cx, cz, kind);
    mesh.count = spots.length;
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      dummy.position.set(s.x, heightAt(s.x, s.z), s.z);
      const tall = billboardScale(row.heightM, s.x);
      dummy.scale.set(tall, tall, 1);
      dummy.lookAt(cx, dummy.position.y + 4, cz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const jitter = 0.82 + 0.36 * Math.abs(Math.sin(s.x * 0.21 + s.z * 0.13));
      tint.setRGB(jitter, 0.92 + 0.16 * jitter, 0.8);
      mesh.setColorAt(i, tint);
      slots[i] = cols > 2.5 ? treeSlot(kind, s.x, s.z) : (kind === 'boreal' ? 0 : 1);
    }
    (geo.getAttribute('aTree') as THREE.InstancedBufferAttribute).needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.userData.kind = kind;
    mesh.userData.count = spots.length;
    mesh.userData.heightM = row.heightM;
    mesh.userData.stemsPerHa = row.stemsPerHa;
    return kind;
  }

  return { mesh, update, bake, dispose() { geo.dispose(); mat.dispose(); } };
}

export const TREE_VARIANTS = CC0_TREES.length;
