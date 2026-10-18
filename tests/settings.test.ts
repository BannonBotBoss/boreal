import test from 'node:test';
import assert from 'node:assert/strict';
import { RENDER, RENDER_SETTINGS, createSettingsStore } from '../src/core/renderSettings';
import { applyPopulation } from '../src/core/population';
import { generateChunk } from '../src/core/world';
import { PLAYABLES } from '../src/render/playables';

const memory = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test('settings store applies, persists and resets over the schema', () => {
  const storage = memory(), store = createSettingsStore(RENDER_SETTINGS, 'k', storage);
  assert.equal(RENDER.treeDensity, 1);
  assert.equal(store.set('world.treeDensity', .5), true); // needs regeneration
  assert.equal(RENDER.treeDensity, .5);
  assert.equal(createSettingsStore(RENDER_SETTINGS, 'k', storage).get('world.treeDensity'), .5); // persisted
  store.reset(); assert.equal(RENDER.treeDensity, 1);
  assert.ok(RENDER_SETTINGS.every(d => d.id && d.label && d.default !== undefined));
});

test('population layer: defaults change nothing; density thins/adds trees deterministically', () => {
  const store = createSettingsStore(RENDER_SETTINGS, 'k', memory()); store.reset();
  store.set('world.stagedTerrain.v2', false); // population knobs are checked on the layered terrain (staged is the app default since 2026-10-18)
  const base = generateChunk(1, 2);
  store.set('world.standMap', false); assert.deepEqual(applyPopulation(base, 1, 2), base); // stand map off = original generator
  const count = (es: { kind: string }[], k: string) => es.filter(e => e.kind === k).length;
  store.set('world.treeDensity', .5); const thin = applyPopulation(base, 1, 2);
  assert.ok(count(thin, 'spruce') < count(base, 'spruce'));
  assert.deepEqual(applyPopulation(base, 1, 2), thin);
  store.set('world.treeDensity', 2); assert.ok(count(applyPopulation(base, 1, 2), 'spruce') > count(base, 'spruce'));
  store.set('animals.deer', false); assert.equal(count(applyPopulation(base, 1, 2), 'deer'), 0);
  store.reset();
});

test('playables: wolf is the default entry and unavailable ones are marked', () => {
  assert.equal(PLAYABLES[0].id, 'wolf');
  assert.ok(PLAYABLES.filter(p => !p.available).every(p => p.note));
});
