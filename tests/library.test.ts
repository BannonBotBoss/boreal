import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChunk, type Entity } from '../src/core/world';
import { availableActions, createContext, friendCount, interact, parseContext, restoreEntities } from '../src/core/events';
import { generateGeometry, disposeObject } from '../src/render/geometry';
import { catalog } from '../src/core/catalog';
import { Mesh } from 'three';
/** First generated individual of a kind, searched outward from the origin chunk (no hand-placed fixtures). */
function firstOf(kind: Entity['kind']) {
  for (let r = 0; r < 8; r++) for (let cx = -r; cx <= r; cx++) for (let cz = -r; cz <= r; cz++) {
    const found = generateChunk(cx, cz).find(e => e.kind === kind); if (found) return { found, cx, cz };
  }
  throw new Error(`no ${kind} generated`);
}
const { found: deer, cx: deerCx, cz: deerCz } = firstOf('deer');
const player = { x: deer.x + 1, z: deer.z, abilities: ['speak', 'gather'] as ('speak' | 'gather')[] };
const bounds = { minX: deerCx * 40, minZ: deerCz * 40, maxX: (deerCx + 1) * 40, maxZ: (deerCz + 1) * 40 };
test('generation repeats independently of visit order; encounters store no individuals', () => {
  const before = generateChunk(0, 0); generateChunk(-9, 4);
  assert.deepEqual(generateChunk(0, 0), before);
  for (let cx = -2; cx <= 2; cx++) for (let cz = -2; cz <= 2; cz++)
    assert.ok(generateChunk(cx, cz).every(e => /^(\d|-|stones:|forage:)/.test(e.key)), 'no hand-placed entities');
  const context = createContext();
  assert.deepEqual(availableActions(player, deer, context), ['speak']);
  assert.equal(Object.keys(context.records).length, 0);
  assert.notDeepEqual(generateChunk(2, 1, 1400), generateChunk(2, 1, 99));
});
test('capability and range gates prevent invalid interaction', () => {
  assert.deepEqual(availableActions({ ...player, abilities: [] }, deer, createContext()), []);
  assert.throws(() => interact(createContext(), { ...player, x: 50 }, deer, 'speak'));
});
test('friendship survives serialization without duplicate rewards or duplicate individuals', () => {
  const original = createContext();
  const once = interact(original, player, deer, 'speak');
  assert.equal(friendCount(original), 0);
  const loaded = parseContext(JSON.stringify(once));
  assert.equal(friendCount(loaded), 1);
  const twice = interact(loaded, player, deer, 'speak');
  assert.equal(friendCount(twice), 1);
  assert.equal(restoreEntities(generateChunk(deerCx, deerCz), twice, bounds).filter(e => e.key === deer.key).length, 1);
  assert.deepEqual(twice.records[deer.key].entity, deer);
});
test('gathered herbs leave one shoot in the inventory and the plant in the world; a second gather throws', () => {
  const { found: plant, cx, cz } = firstOf('plant');
  const near = { ...player, x: plant.x, z: plant.z };
  const plantBounds = { minX: cx * 40, minZ: cz * 40, maxX: (cx + 1) * 40, maxZ: (cz + 1) * 40 };
  const context = parseContext(JSON.stringify(interact(createContext(), near, plant, 'gather')));
  assert.equal(context.inventory.herb, 1);
  assert.equal(context.records[plant.key].removed, false);
  assert.ok(restoreEntities(generateChunk(cx, cz), context, plantBounds).some(e => e.key === plant.key));
  assert.throws(() => interact(context, near, plant, 'gather'));
});
test('incompatible save versions are rejected', () => {
  assert.throws(() => parseContext(JSON.stringify({ ...createContext(), generatorVersion: 42 })));
  assert.throws(() => parseContext('{broken'));
});
test('every recipe generates finite geometry and lowers triangle count at far detail', () => {
  for (const kind of Object.keys(catalog) as Entity['kind'][]) {
    const e: Entity = { ...deer, kind };
    const count = (detail: number) => {
      const object = generateGeometry(e, detail); let triangles = 0;
      object.traverse(child => { if (child instanceof Mesh) {
        const p = child.geometry.attributes.position;
        assert.ok([...p.array].every(Number.isFinite));
        triangles += (child.geometry.index?.count ?? p.count) / 3;
      } });
      disposeObject(object); return triangles;
    };
    assert.ok(count(0) > count(2), kind);
  }
});

test('botanical forage and plant props stay below wolf withers (0.55 m) and use shared PROP_MATERIAL geometry', () => {
  for (const kind of ['forage', 'plant'] as const) {
    const { found } = firstOf(kind);
    const g0 = generateGeometry(found, 0), g2 = generateGeometry(found, 2);
    g0.updateMatrixWorld(true);
    let minY = Infinity, maxY = -Infinity, meshes = 0;
    g0.traverse(c => {
      if (c instanceof Mesh) {
        meshes++;
        assert.equal(c.userData.shared, true);
        assert.deepEqual(Object.keys(c.geometry.attributes).sort(), ['color', 'normal', 'position']);
        const p = c.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i) * found.scale;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    });
    assert.equal(meshes, 1);
    const h = maxY - minY;
    assert.ok(h >= 0.12 && h <= 0.55, `${kind} height ${h}`);
    disposeObject(g0); disposeObject(g2);
  }
});
