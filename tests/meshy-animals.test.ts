/** T-0113. Stored Meshy animals: the manifest, meshopt, real size, and a gait that moves the mesh. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as THREE from 'three';
import { ImageLoader } from 'three';
import { BIRD_GROUPS, MAMMALS } from '../src/core/species';
import {
  WITHERS_SHARE, bodyMetres, entriesFor, fitAnimalModel, fitModeFor, loadAnimalBuffer, resetAnimalModels, type ModelEntry,
} from '../src/render/animalModels';
import { legsForSpecies, proximityWeights, skinnedVertex, spawnSkin, createSkinTemplate, type Segment } from '../src/render/meshySkin';

const manifest = JSON.parse(readFileSync('public/models/animals/manifest.json', 'utf8')) as Record<string, ModelEntry | string>;
const rows = Object.entries(manifest).filter((entry): entry is [string, ModelEntry] => typeof entry[1] === 'object' && !!entry[1].full);

test('the manifest lists the 21 Meshy species and every file is meshopt', () => {
  assert.equal(rows.length, 21);
  const names = rows.map(([name]) => name).sort();
  assert.deepEqual(names, [
    'American Black Bear', 'American Mink', 'Bald Eagle', 'Beaver', 'Common Raven', 'Cougar', 'Coyote', 'Elk', 'Ermine',
    'Gray Fox', 'Gray Wolf', 'Grizzly Bear', 'Moose', 'North American River Otter', 'Northern Raccoon', 'Red Fox',
    'Snowshoe Hare', 'Striped Skunk', 'White-tailed Deer', 'Wolverine', 'Woodland Caribou',
  ]);
  const files = new Set(readdirSync('public/models/animals'));
  assert.equal(files.has('wolf.glb'), false);
  assert.equal(files.has('wolf-low.glb'), false);
  for (const [, entry] of rows) {
    assert.equal(files.has(entry.full!), true, entry.full);
    const buf = readFileSync(`public/models/animals/${entry.full}`);
    const jsonLen = buf.readUInt32LE(12);
    const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as { extensionsRequired?: string[] };
    assert.ok(json.extensionsRequired?.includes('EXT_meshopt_compression'), entry.full);
    assert.ok(buf.length < 1_100_000, `${entry.full} is ${buf.length} bytes`);
  }
});

test('names that are not species rows borrow a row, and a species with no file is not fetched', () => {
  const table = Object.fromEntries(rows) as Record<string, ModelEntry>;
  assert.equal(table['Grizzly Bear'].as, 'American Black Bear');
  assert.equal(table['Bald Eagle'].as, 'Hawks, Kites and Eagles');
  assert.equal(table['Common Raven'].as, 'Crows and Jays');
  assert.equal(bodyMetres('American Black Bear'), 0.9);
  assert.equal(bodyMetres('Hawks, Kites and Eagles'), BIRD_GROUPS.find(r => r[0] === 'Hawks, Kites and Eagles')![3]);
  assert.equal(bodyMetres('Crows and Jays'), 0.6);
  assert.equal(fitModeFor('Hawks, Kites and Eagles'), 'length');
  assert.equal(fitModeFor('Gray Wolf'), 'shoulder');
  assert.equal(bodyMetres('Canada Lynx'), 0.55);
  const near = entriesFor(table, ['Gray Wolf', 'Snowshoe Hare', 'Canada Lynx', 'Hawks, Kites and Eagles']);
  assert.deepEqual(near.map(([name]) => name).sort(), ['Bald Eagle', 'Gray Wolf', 'Snowshoe Hare']);
});

test('a mammal stands at its shoulder and a bird at its length, feet on the ground', () => {
  const mammal = new THREE.Group();
  mammal.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 0.4)));
  fitAnimalModel(mammal, 0.74, 'shoulder');
  const box = new THREE.Box3().setFromObject(mammal);
  assert.ok(Math.abs(box.min.y) < 1e-4, `feet ${box.min.y}`);
  assert.ok(Math.abs((box.max.y - box.min.y) * WITHERS_SHARE - 0.74) < 1e-3);
  assert.ok(Math.abs((box.min.x + box.max.x) / 2) < 1e-3 && Math.abs((box.min.z + box.max.z) / 2) < 1e-3, 'centred on the heading');
  const bird = new THREE.Group();
  bird.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.5)));
  fitAnimalModel(bird, 0.55, 'length');
  const wing = new THREE.Box3().setFromObject(bird);
  assert.ok(Math.abs(wing.min.y) < 1e-4);
  assert.ok(Math.abs((wing.max.z - wing.min.z) - 0.55) < 1e-3, `length ${wing.max.z - wing.min.z}`);
});

test('proximity weights sum to 1 and prefer the nearest bone', () => {
  const segs: Segment[] = [
    { ax: 0, ay: 0, az: 0, bx: 0, by: 1, bz: 0, index: 0, radius: 0.2 },
    { ax: 1, ay: 0, az: 0, bx: 1, by: 1, bz: 0, index: 1, radius: 0.2 },
  ];
  const positions = new Float32Array([0.02, 0.5, 0, 0.9, 0.5, 0]);
  const skin = proximityWeights(positions, segs);
  for (let v = 0; v < 2; v++) {
    const sum = skin.skinWeight.slice(v * 4, v * 4 + 4).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6, `vertex ${v} sums to ${sum}`);
  }
  assert.equal(skin.skinIndex[0], 0);
  assert.equal(skin.skinIndex[4], 1);
});

function columnAnimal(species: string) {
  const root = new THREE.Group();
  const add = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    mesh.position.set(x, y, z);
    root.add(mesh);
  };
  add(0.28, 0.36, 0.7, 0, 0.62, 0);
  add(0.16, 0.16, 0.24, 0, 0.78, -0.42);
  for (const [x, z] of [[-0.1, -0.18], [0.1, -0.18], [-0.1, 0.2], [0.1, 0.2]] as const) add(0.06, 0.55, 0.06, x, 0.28, z);
  const template = createSkinTemplate(root, species);
  assert.ok(template, species);
  return template!;
}

test('a walk moves the skinned feet and leaves the idle pose on the mesh', () => {
  for (const species of ['Gray Wolf', 'Snowshoe Hare', 'White-tailed Deer', 'American Black Bear']) {
    const template = columnAnimal(species);
    const live = spawnSkin(template);
    const mesh = live.meshes[0];
    live.pose('idle', 0, 0);
    live.root.updateMatrixWorld(true);
    const idle = skinnedVertex(mesh, 0);
    const rest = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), 0);
    assert.ok(idle.distanceTo(rest) < 1e-3, `${species} idle drifted ${idle.distanceTo(rest)}`);
    let footMesh = live.meshes[0], foot = 0, best = -1;
    for (const candidate of live.meshes) {
      const si = candidate.geometry.getAttribute('skinIndex');
      const sw = candidate.geometry.getAttribute('skinWeight');
      const pos = candidate.geometry.getAttribute('position');
      for (let v = 0; v < pos.count; v++) {
        if (pos.getY(v) > 0.2) continue;
        let w = 0;
        for (let k = 0; k < 4; k++) if (si.getComponent(v, k) >= 3) w += sw.getComponent(v, k);
        if (w > best) { best = w; foot = v; footMesh = candidate; }
      }
    }
    assert.ok(best > 0.25, `${species} foot weight ${best}`);
    const before = skinnedVertex(footMesh, foot);
    live.pose('run', 0.37, 6);
    live.root.updateMatrixWorld(true);
    const after = skinnedVertex(footMesh, foot);
    assert.ok(before.distanceTo(after) > 0.01, `${species} foot moved ${before.distanceTo(after)}`);
    live.pose('run', 0.37, 6);
    for (const bone of mesh.skeleton.bones) {
      bone.updateMatrixWorld();
      assert.ok(Number.isFinite(bone.position.x + bone.position.y + bone.rotation.x), species);
    }
  }
});

test('a bird flaps: the wing tip leaves the idle pose', () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.4), new THREE.MeshStandardMaterial());
  body.position.set(0, 0.2, 0);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.15), new THREE.MeshStandardMaterial());
  wing.position.set(0, 0.24, -0.02);
  root.add(body, wing);
  const template = createSkinTemplate(root, 'Hawks, Kites and Eagles');
  assert.ok(template);
  const live = spawnSkin(template!);
  const mesh = live.meshes.slice().sort((a, b) => {
    a.geometry.computeBoundingBox(); b.geometry.computeBoundingBox();
    const wa = a.geometry.boundingBox!.max.x - a.geometry.boundingBox!.min.x;
    const wb = b.geometry.boundingBox!.max.x - b.geometry.boundingBox!.min.x;
    return wb - wa;
  })[0];
  const pos = mesh.geometry.getAttribute('position');
  let tip = 0, x = 0;
  for (let v = 0; v < pos.count; v++) if (Math.abs(pos.getX(v)) > x) { x = Math.abs(pos.getX(v)); tip = v; }
  live.pose('idle', 0, 0);
  live.root.updateMatrixWorld(true);
  const before = skinnedVertex(mesh, tip);
  live.pose('walk', 0.25, 2);
  live.root.updateMatrixWorld(true);
  const after = skinnedVertex(mesh, tip);
  assert.ok(before.distanceTo(after) > 0.01, `wing moved ${before.distanceTo(after)}`);
});

test('every mammal with a model has finite legs, and the wolf file decodes', async () => {
  for (const [name, entry] of rows) {
    const plan = entry.as ?? name;
    if (MAMMALS.some(r => r[0] === plan)) {
      const fit = legsForSpecies(plan);
      assert.ok(fit, plan);
      assert.ok(fit!.legs.hip > 0 && fit!.legs.upper > 0 && fit!.legs.lower > 0, plan);
      assert.ok(Number.isFinite(fit!.gaitScale));
    }
  }
  (globalThis as { self?: unknown }).self = globalThis;
  const imageLoad = ImageLoader.prototype.load;
  ImageLoader.prototype.load = function (_url: string, onLoad?: (data: HTMLImageElement) => void) {
    onLoad?.({ width: 1, height: 1 } as HTMLImageElement);
    return { width: 1, height: 1 } as HTMLImageElement;
  };
  resetAnimalModels();
  const buf = readFileSync('public/models/animals/gray-wolf.glb');
  const loaded = await loadAnimalBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), 'Gray Wolf');
  assert.ok(loaded?.skin);
  assert.ok(Math.abs(loaded!.fullTris - 26033) < 5, `wolf triangles ${loaded!.fullTris}`);
  assert.equal(loaded!.shoulderM, 0.74);
  assert.equal(loaded!.lowTris, 2);
  const fitted = loaded!.skin!;
  assert.ok(Math.abs(fitted.height * WITHERS_SHARE - 0.74) < 0.02, `wolf height ${fitted.height}`);
  const live = spawnSkin(loaded!.skin!);
  live.pose('walk', 0.2, 1.6);
  live.root.updateMatrixWorld(true);
  const mesh = live.meshes[0];
  const moved = skinnedVertex(mesh, 10);
  assert.ok(Number.isFinite(moved.x + moved.y + moved.z));
  const src = readFileSync('src/render/animalModels.ts', 'utf8');
  assert.match(src, /gltfLoader\.setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(src, /three\/examples\/jsm\/libs\/meshopt_decoder\.module\.js/);
  resetAnimalModels();
  ImageLoader.prototype.load = imageLoad;
});
