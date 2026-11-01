// Issue #192: the viewer consumes the wasm landing list and stands a capped cast in front of the player.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { loadPlanetSim } from '../src/core/planetBudget';
import {
  LANDING_DISPLAY, LANDING_SHOWN_CAP, pickLandingSlots, placeLandingAnimals,
} from '../src/core/landingRoster';
import { createProceduralAnimal } from '../src/render/proceduralAnimal';
import { pictureOrder } from '../src/render/animalPicture';
import { castShouldReplace, landingLight } from '../src/render/landingCast';
import { applyStylizedFill, coatOf, stylizedFill, STYLIZED } from '../src/render/stylizedPalette';

const boreal = [
  { species: 'snowshoe_hare', count: 4000 },
  { species: 'white_tailed_deer', count: 80 },
  { species: 'moose', count: 12 },
  { species: 'canada_lynx', count: 4 },
  { species: 'gray_wolf', count: 2 },
  { species: 'american_black_bear', count: 6 },
  { species: 'bald_eagle', count: 3 },
  { species: 'beaver', count: 20 },
  { species: 'red_fox', count: 15 },
  { species: 'caribou', count: 1 },
  { species: 'grizzly_bear', count: 1 },
];

test('a landing cast is capped, keeps one of each role, and drops a species the list omits', () => {
  const slots = pickLandingSlots(boreal);
  assert.ok(slots.length <= LANDING_SHOWN_CAP);
  assert.equal(slots.length, LANDING_SHOWN_CAP);
  const keys = slots.map(s => s.key);
  assert.ok(keys.includes('snowshoe_hare'), 'the common small animal');
  assert.ok(keys.includes('moose') || keys.includes('white_tailed_deer'), 'a herbivore');
  assert.ok(keys.includes('gray_wolf') || keys.includes('red_fox') || keys.includes('canada_lynx'), 'a predator');
  assert.ok(keys.includes('bald_eagle'), 'the bird');
  const prairie = [
    { species: 'white_tailed_deer', count: 90 },
    { species: 'red_fox', count: 10 },
    { species: 'bald_eagle', count: 1 },
    { species: 'moose', count: 0 },
    { species: 'snowshoe_hare', count: 0 },
    { species: 'canada_lynx', count: 0 },
  ];
  const shown = pickLandingSlots(prairie);
  assert.deepEqual(shown.map(s => s.key).sort(), ['bald_eagle', 'red_fox', 'white_tailed_deer']);
  assert.ok(shown.every(s => s.display === LANDING_DISPLAY[s.key]));
});

test('animals stand in front of the player, on dry ground, and a wet landing draws none', () => {
  const slots = pickLandingSlots(boreal);
  const placed = placeLandingAnimals(slots, { x: 10, z: 30, yaw: 0 }, () => true);
  assert.equal(placed.length, slots.length);
  for (const animal of placed) {
    const dx = animal.x - 10, dz = animal.z - 30;
    assert.ok(dz < -4, `ahead of yaw 0, got z ${animal.z}`);
    assert.ok(Math.hypot(dx, dz) < 24);
    assert.ok(Math.hypot(dx, dz) > 3.5);
  }
  assert.deepEqual(placed, placeLandingAnimals(slots, { x: 10, z: 30, yaw: 0 }, () => true));
  const wet = placeLandingAnimals(slots, { x: 0, z: 0, yaw: 0 }, () => false);
  assert.equal(wet.length, slots.length, 'a named animal is still placed when the arc has no dry cell');
  assert.ok(wet.every(animal => animal.z < -3));
  assert.ok(wet.every(animal => Math.hypot(animal.x, animal.z) < 24), 'a fully wet arc keeps the cast in the first view');
});

test('a wet arc walks out to the first dry bank instead of standing in the water', () => {
  const slots = pickLandingSlots(boreal).slice(0, 2);
  const dryFar = (x: number, z: number) => Math.hypot(x, z) > 28;
  const placed = placeLandingAnimals(slots, { x: 0, z: 0, yaw: 0 }, dryFar);
  assert.equal(placed.length, slots.length);
  for (const animal of placed) {
    assert.ok(dryFar(animal.x, animal.z), `${animal.display} at ${animal.x},${animal.z}`);
    assert.ok(animal.z < -4, 'still ahead of the player');
    assert.ok(Math.hypot(animal.x, animal.z) < 48, 'still inside the low-body distance');
  }
});

test('the cast steps back in front when the wolf turns, and stays put for a small look', () => {
  const origin = { x: 0, z: 0, yaw: 0 };
  assert.equal(castShouldReplace(origin, 0, 0, 0.1), false);
  assert.equal(castShouldReplace(origin, 3, 1, 0), false);
  assert.equal(castShouldReplace(origin, 0, 0, 1.2), true);
  assert.equal(castShouldReplace(origin, 20, 0, 0), true);
});

test('the landing cast keeps the full-mesh slots ahead of nearer home animals', () => {
  const order = [
    { key: 'hare:1.0:2.0', d: 3 },
    { key: 'landing:moose:0', d: 12 },
    { key: 'player-wolf', d: 1 },
    { key: 'landing:bald_eagle:1', d: 14 },
  ].sort(pictureOrder);
  assert.deepEqual(order.map(row => row.key), ['landing:moose:0', 'landing:bald_eagle:1', 'player-wolf', 'hare:1.0:2.0']);
});

test('every species the landing list can name has a body, and the morning sun is up at home', () => {
  for (const name of Object.values(LANDING_DISPLAY)) {
    const body = createProceduralAnimal(name);
    assert.ok(body, name);
    body.root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body.root);
    assert.ok(Math.abs(box.min.y) < 0.08, `${name} feet at ${box.min.y}`);
  }
  const light = landingLight(0);
  assert.ok(light.sunElevation > 10, `sun ${light.sunElevation}`);
  assert.ok(light.state === 'day' || light.state === 'golden');
  assert.ok(light.latitude > 49 && light.latitude < 51);
});

test('canada lynx has no stored model and the procedural body sits on y = 0', () => {
  const manifest = readFileSync('public/models/animals/manifest.json', 'utf8');
  assert.equal(manifest.includes('Canada Lynx'), false);
  const lynx = createProceduralAnimal('Canada Lynx');
  assert.ok(lynx);
  lynx.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(lynx.root);
  assert.ok(Math.abs(box.min.y) < 0.08, `feet at ${box.min.y}`);
  assert.ok(box.max.y > 0.35 && box.max.y < 1.4, `lynx height ${box.max.y}`);
  const eagle = createProceduralAnimal('Bald Eagle');
  assert.ok(eagle);
  eagle.root.updateMatrixWorld(true);
  const bird = new THREE.Box3().setFromObject(eagle.root);
  assert.ok(Math.abs(bird.min.y) < 0.08, `eagle feet at ${bird.min.y}`);
  lynx.pose('walk', 0.25, 1.2);
  lynx.root.updateMatrixWorld(true);
  const stepped = new THREE.Box3().setFromObject(lynx.root);
  assert.ok(stepped.min.y > -0.25, `walk sank to ${stepped.min.y}`);
});

test('the stylized fill stays in the shared palette', () => {
  const fox = coatOf('Red Fox'), moose = coatOf('Moose');
  assert.ok(fox[0] > moose[0]);
  const fill = stylizedFill(coatOf('American Black Bear'));
  assert.ok(fill[0] >= STYLIZED.fillFloor[0] * 0.9);
  assert.deepEqual(STYLIZED.grassLift[1] > STYLIZED.grassLift[0], true);
  const mapped = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  applyStylizedFill(mapped);
  assert.equal(mapped.emissiveMap, mapped.map);
  assert.equal(mapped.toneMapped, false);
  const flat = new THREE.MeshStandardMaterial({ color: 0x224466 });
  applyStylizedFill(flat);
  assert.equal(flat.emissiveMap, null);
  assert.ok(flat.emissive.r > 0.1);
});

test('the wasm landing list is what the cast draws, including an empty lake', async () => {
  const sim = await loadPlanetSim(readFileSync('public/wasm/boreal_sim.wasm'));
  assert.ok(sim);
  const pop = sim!.landingPopulation(55, -100, 300, 0.9, false, 2026, 5000);
  const slots = pickLandingSlots(pop);
  assert.ok(slots.length > 0 && slots.length <= LANDING_SHOWN_CAP);
  assert.ok(slots.every(s => pop.some(row => row.species === s.key && row.count >= 1)));
  assert.ok(slots.some(s => s.key === 'snowshoe_hare' || s.key === 'moose'));
  assert.equal(pickLandingSlots(sim!.landingPopulation(45, -95, 0, 1, true, 2026, 5000)).length, 0);
  const prairie = sim!.landingPopulation(50, -105, 600, 0.45, false, 2026, 5000);
  assert.ok(!prairie.some(row => row.species === 'snowshoe_hare' || row.species === 'canada_lynx'));
  const shown = pickLandingSlots(prairie);
  assert.ok(shown.every(s => s.key !== 'snowshoe_hare' && s.key !== 'canada_lynx'));
  assert.ok(shown.every(s => prairie.some(row => row.species === s.key && row.count > 0)));
});
