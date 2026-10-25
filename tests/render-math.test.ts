import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { positionCamera, terrainGeometry, clampPitch, RIDER_DISTANCE, RIDER_FLANK, RIDER_HEIGHT } from '../src/render/math';
import { CHUNK_SIZE, heightAt } from '../src/core/world';
import { generateGeometry, disposeObject } from '../src/render/geometry';
import { catalog } from '../src/core/catalog';
import type { Entity } from '../src/core/world';
const close = (actual: number, expected: number, epsilon = 1e-5) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
const riderSlant = Math.hypot(RIDER_DISTANCE, RIDER_FLANK);

test('camera can look down, across horizon and up without changing position', () => {
  const camera = new THREE.PerspectiveCamera(48, 1.5, .2, 700);
  const ground = Math.max(heightAt(0, 0), -.2);
  for (const degrees of [-80, -30, 0, 45, 80, 89]) {
    const pitch = degrees * Math.PI / 180;
    positionCamera(camera, 0, 0, 50, .7, pitch);
    close(camera.position.y - ground, 50);
    close(Math.hypot(camera.position.x, camera.position.z), 50 * Math.hypot(RIDER_DISTANCE, RIDER_FLANK) / RIDER_HEIGHT);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    close(Math.asin(-direction.y), pitch);
    assert.ok(camera.matrixWorld.elements.every(Number.isFinite));
  }
  close(clampPitch(-10), -80 * Math.PI / 180);
  close(clampPitch(10), 89 * Math.PI / 180);
});
test('chased wolf projects below screen centre through zoom, turns and aspect changes', () => {
  for (const aspect of [.6, 1, 16 / 9, 2.4]) for (const altitude of [15, 43, 85, 145]) for (const yaw of [-Math.PI, -.35, 0, Math.PI / 2]) {
    const camera = new THREE.PerspectiveCamera(48, aspect, .2, 700);
    positionCamera(camera, 23, -41, altitude, yaw);
    const ground = Math.max(heightAt(23, -41), -.2);
    const center = new THREE.Vector3(23, ground + altitude * .25, -41).project(camera);
    close(center.x, 0); assert.ok(center.y < -.2 && center.y > -.9);
    assert.ok(center.z > -1 && center.z < 1, 'target must lie between clipping planes');
    close(camera.position.y - ground, altitude);
    close(camera.position.distanceTo(new THREE.Vector3(23, ground, -41)), altitude * Math.hypot(1, Math.hypot(RIDER_DISTANCE, RIDER_FLANK) / RIDER_HEIGHT));
  }
});
test('camera projection matches independent perspective formula', () => {
  const camera = new THREE.PerspectiveCamera(60, 2, 1, 100);
  camera.updateMatrixWorld();
  const projected = new THREE.Vector3(2, 1, -10).project(camera);
  close(projected.x, 2 / (10 * Math.tan(Math.PI / 6) * 2));
  close(projected.y, 1 / (10 * Math.tan(Math.PI / 6)));
  close(new THREE.Vector3(0, 0, -1).project(camera).z, -1);
  close(new THREE.Vector3(0, 0, -100).project(camera).z, 1);
});
test('world transform applies scale, then rotation, then translation', () => {
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(10, 2, -4), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(2, 3, 4));
  const result = new THREE.Vector3(1, 1, 1).applyMatrix4(matrix);
  close(result.x, 14); close(result.y, 5); close(result.z, -6);
});
test('neighboring terrain chunks share identical border positions, including negative coordinates', () => {
  for (const cx of [-3, -1, 0, 2]) for (const cz of [-2, 0, 3]) {
    const a = terrainGeometry(cx, cz), b = terrainGeometry(cx + 1, cz), c = terrainGeometry(cx, cz + 1);
    const edge = (g: THREE.BufferGeometry, axis: 'x' | 'z', value: number) => {
      const p = g.attributes.position, result: number[][] = [];
      for (let i = 0; i < p.count; i++) if (Math.abs((axis === 'x' ? p.getX(i) : p.getZ(i)) - value) < .0001)
        result.push([p.getX(i), p.getY(i), p.getZ(i)]);
      return result.sort((u, v) => axis === 'x' ? u[2] - v[2] : u[0] - v[0]);
    };
    assert.deepEqual(edge(a, 'x', (cx + 1) * CHUNK_SIZE), edge(b, 'x', (cx + 1) * CHUNK_SIZE));
    assert.deepEqual(edge(a, 'z', (cz + 1) * CHUNK_SIZE), edge(c, 'z', (cz + 1) * CHUNK_SIZE));
    a.dispose(); b.dispose(); c.dispose();
  }
});
test('terrain triangles face upward and have nonzero area', () => {
  const geometry = terrainGeometry(0, 0), p = geometry.attributes.position, indices = geometry.index!;
  for (let i = 0; i < indices.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + 2));
    const normal = b.sub(a).cross(c.sub(a)); assert.ok(normal.y > 0); assert.ok(normal.lengthSq() > 0);
  }
  geometry.dispose();
});
test('generated normals are finite and normalized at all detail levels', () => {
  for (const kind of Object.keys(catalog) as Entity['kind'][]) for (const detail of [0, 1, 2]) {
    const object = generateGeometry({ kind, key: 'test', seed: 42, generatorVersion: 1, x: 0, z: 0, scale: 1, rotation: 0 }, detail);
    object.traverse(child => { if (child instanceof THREE.Mesh) {
      const normals = child.geometry.attributes.normal;
      for (let i = 0; i < normals.count; i++) close(Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)), 1);
    } });
    disposeObject(object);
  }
});
test('LOD changes detail at intended distances, with hysteresis preventing boundary flicker', () => {
  const lod = new THREE.LOD(), camera = new THREE.PerspectiveCamera();
  for (const distance of [0, 55, 115]) lod.addLevel(new THREE.Object3D(), distance, .12);
  const level = (distance: number) => { camera.position.set(0, 0, distance); camera.updateMatrixWorld(); lod.updateMatrixWorld(); lod.update(camera); return lod.getCurrentLevel(); };
  assert.equal(level(10), 0); assert.equal(level(60), 1); assert.equal(level(54), 1);
  assert.equal(level(45), 0); assert.equal(level(120), 2); assert.equal(level(114), 2); assert.equal(level(99), 1);
});

test('sled rider camera is three metres behind at human eye height', async () => {
  const { createPlayerWolf } = await import('../src/render/playerWolf');
  const wolf = createPlayerWolf();
  const bounds = new THREE.Box3().setFromObject(wolf.root);
  const { WOLF_SCALE } = await import('../src/core/wolfModes');
  assert.ok(Math.abs(bounds.min.y) < .02, `sole at ${bounds.min.y}`); // paws on the ground (fur adds a few mm)
  assert.ok(bounds.max.y >= .5 * WOLF_SCALE - .001 && bounds.max.y < .5 * WOLF_SCALE + .06, `ear tips at ${bounds.max.y}`); // real wolf: ears ~1 m, plus ear fur
  const camera = new THREE.PerspectiveCamera();
  for (const yaw of [0, Math.PI / 2, Math.PI]) {
    positionCamera(camera, 0, 0, RIDER_HEIGHT, yaw);
    close(Math.hypot(camera.position.x, camera.position.z), riderSlant); // behind and to the left, not dead astern
    close(camera.position.y - Math.max(heightAt(0, 0), -.2), RIDER_HEIGHT); // just above the withers
  }
  // T-0003: the torso and the leg chains hang from the body's `tilt` group (torso first, then the four girdle bones).
  const tilt = wolf.root.getObjectByName('tilt')!, torso = tilt.children[0];
  const base = torso.rotation.clone();
  wolf.brain.motion = 'walk'; wolf.brain.phase = .17;
  wolf.animate(1, true, undefined, 0);
  assert.ok(tilt.children.slice(1).some(part => Math.abs(part.rotation.x) > .01), 'walking moves the leg chains');
  for (const action of ['speak', 'gather'] as const) {
    wolf.animate(1, false, action, .4);
    assert.ok(torso.children.some(part => part instanceof THREE.Bone && Math.abs(part.rotation.x) > .1), `${action} turns the head`);
  }
  disposeObject(wolf.root);
});