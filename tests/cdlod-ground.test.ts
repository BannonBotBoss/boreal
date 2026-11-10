/**
 * CDLOD ground (Strugar 2010). The gate is uncovered pixels below the geometric horizon.
 * A flat disc scores 0. The same disc with one triangle removed scores above 0.
 * interiorGaps is the seam check: a morphed T-junction is not a gap, a missing face is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { heightAt } from '../src/core/world';
import { PLANET } from '../src/world/globe/planet';
import { horizonMetres } from '../src/world/globe/horizonSkirt';
import { DEFAULT_PITCH, positionCamera } from '../src/render/math';
import {
  CDLOD, buildCdlodMesh, groundFarPlane, interiorGaps, levelRatio, selectNodes, skyPixelsBelowHorizon,
  vertexMorph, type CdlodMeshData, type SkyCam,
} from '../src/world/terrain/cdlod';

const flat = (y: number) => () => ({ y, rgb: [0.2, 0.3, 0.1] as [number, number, number] });

function pose(altitude: number, x = 120, z = -80): SkyCam {
  const camera = new THREE.PerspectiveCamera(48, 1280 / 720, 0.2, groundFarPlane(altitude));
  positionCamera(camera, x, z, altitude, -0.35, DEFAULT_PITCH, 0);
  camera.aspect = 1280 / 720;
  camera.near = 0.2;
  camera.far = groundFarPlane(altitude);
  camera.updateMatrixWorld(true);
  const m = camera.matrixWorld.elements;
  const eye = camera.position.y - Math.max(heightAt(x, z), -0.2);
  return {
    x: camera.position.x, y: camera.position.y, z: camera.position.z,
    right: [m[0], m[1], m[2]], up: [m[4], m[5], m[6]], forward: [-m[8], -m[9], -m[10]],
    fovY: 48 * Math.PI / 180, aspect: 1280 / 720, near: 0.2, far: camera.far, eye,
  };
}

function punch(mesh: CdlodMeshData, cam: SkyCam): CdlodMeshData {
  // Drop the faces around the point the lens is looking at, so the hole is on screen.
  const pos = mesh.position, idx = mesh.index;
  const look = cam.eye / Math.tan(6 * Math.PI / 180);
  const tx = cam.x + cam.forward[0] * look, tz = cam.z + cam.forward[2] * look;
  const keep: number[] = [];
  let dropped = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const ax = pos[idx[i] * 3], az = pos[idx[i] * 3 + 2];
    const bx = pos[idx[i + 1] * 3], bz = pos[idx[i + 1] * 3 + 2];
    const cx = pos[idx[i + 2] * 3], cz = pos[idx[i + 2] * 3 + 2];
    const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3;
    if (Math.hypot(mx - tx, mz - tz) < 12) dropped++;
    else keep.push(idx[i], idx[i + 1], idx[i + 2]);
  }
  assert.ok(dropped > 0, 'a patch in front of the lens to remove');
  return { ...mesh, index: new Uint32Array(keep), triangles: keep.length / 3 };
}

test('nodes stay within one level and the morph reaches 1 at the band end', () => {
  for (const eye of [1.55, 40]) {
    const radius = horizonMetres(eye) * CDLOD.cover;
    const nodes = selectNodes(0, 0, radius);
    assert.ok(nodes.length > 8, `eye ${eye} nodes ${nodes.length}`);
    assert.ok(levelRatio(nodes) <= 2, `eye ${eye} level ratio ${levelRatio(nodes)}`);
    const sizes = new Set(nodes.map(n => n.size));
    assert.ok(sizes.has(CDLOD.leaf), 'the finest grid is present under the camera');
  }
  assert.equal(vertexMorph(0, 32), 0);
  assert.equal(vertexMorph(32 * CDLOD.range, 32), 0);
  assert.equal(vertexMorph(32 * CDLOD.range * 2, 32), 1);
  assert.ok(vertexMorph(32 * CDLOD.range * 1.5, 32) > 0.4 && vertexMorph(32 * CDLOD.range * 1.5, 32) < 0.6);
});

test('a flat disc has no interior gap, and one missing face is a gap', () => {
  const eye = 40;
  const cam = { x: 0, y: 40, z: 0, forward: [0, 0, -1] as [number, number, number] };
  const mesh = buildCdlodMesh(0, 0, eye, flat(0));
  const horizon = horizonMetres(eye);
  assert.ok(mesh.outerM >= horizon, `outer ${mesh.outerM} horizon ${horizon}`);
  assert.ok(mesh.triangles < 120_000, `triangles ${mesh.triangles}`);
  assert.equal(mesh.fade.every(v => v === 1), true, 'nothing is dithered out inside the mesh');
  const gaps = interiorGaps(mesh, 0, 0, horizon);
  assert.equal(gaps, 0, `flat gaps ${gaps}`);
  const index = mesh.index.slice(0, mesh.index.length - 24);
  const opened = { ...mesh, index, triangles: index.length / 3 };
  const openedGaps = interiorGaps(opened, 0, 0, horizon * 2);
  assert.ok(openedGaps > 0, `a removed face must count as a gap, got ${openedGaps}`);
  void cam;
});

test('the same pose at the spawn eye and at 40 m has no sky below the horizon', () => {
  // 160×90 is the same lens as 1280×720. A known hole is large enough to cover pixels at this size.
  const w = 160, h = 90;
  for (const altitude of [1.55, 40]) {
    const cam = pose(altitude);
    const y = heightAt(cam.x, cam.z);
    const mesh = buildCdlodMesh(cam.x, cam.z, cam.eye, flat(y));
    const full = skyPixelsBelowHorizon(mesh, cam, w, h, 0);
    assert.ok(full.below > 50, `altitude ${altitude} pixels below the horizon ${full.below}`);
    assert.equal(full.sky, 0, `altitude ${altitude} sky ${full.sky} of ${full.below}`);
    const holed = punch(mesh, cam);
    const broken = skyPixelsBelowHorizon(holed, cam, w, h, 0);
    assert.ok(broken.sky > 0, `altitude ${altitude} a hole in view must count sky pixels, got ${broken.sky}`);
  }
});

test('bumpy ground stays sealed, and the 40 m eye is not a ring of 7 m steps', () => {
  const eye = 40;
  const cam = pose(eye);
  const ground = cam.y - cam.eye;
  const mesh = buildCdlodMesh(cam.x, cam.z, cam.eye, (x, z) => ({
    y: ground + 8 * Math.sin(x * 0.01) + 6 * Math.cos(z * 0.013),
    rgb: [0.15, 0.22, 0.08],
  }));
  assert.equal(interiorGaps(mesh, cam.x, cam.z, horizonMetres(eye)), 0);
  const quad = CDLOD.leaf / CDLOD.grid;
  assert.ok(quad <= 4, `finest quad ${quad} m`);
  // The old skirt's first ring stepped (56-28)/4 = 7 m. The finest quads are smaller, and they morph.
  assert.ok(quad < 7, 'finer than the old 7 m ring step');
  const sky = skyPixelsBelowHorizon(mesh, cam, 160, 90, 0.5 * Math.PI / 180);
  assert.equal(sky.sky, 0, JSON.stringify(sky));
  let up = 0;
  const verts = mesh.normal.length / 3;
  for (let i = 0; i < verts; i++) if (mesh.normal[i * 3 + 1] > 0.5) up++;
  assert.ok(up / verts > 0.9, `up share ${(up / verts).toFixed(3)}`);
});

test('home height and the planet radius used for the dip are the published ones', () => {
  const r = horizonMetres(40);
  const exact = Math.sqrt(2 * PLANET.radius * 40 + 40 * 40);
  assert.ok(Math.abs(r - exact) < 1e-6);
  assert.ok(groundFarPlane(40) > r);
  assert.ok(groundFarPlane(1.55) > horizonMetres(1.55));
});
