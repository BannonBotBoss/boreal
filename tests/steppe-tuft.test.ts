/**
 * Prairie stems are feather-grass tufts.
 * Stipa lessingiana culms are 30–60 cm (Flora of China 22).
 * Black spruce is 9–15 m (Viereck & Johnston 1990). A prairie sample that
 * still builds that mesh is the pole defect.
 * The steppe pixel is the Sentinel-2 cloudless colour at 49.77 N, 65.54 E
 * (EOX, CC BY 4.0): linear RGB 0.242, 0.138, 0.060.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GENERATOR_VERSION, type Entity } from '../src/core/world';
import { landingContext } from '../src/render/landingCast';
import { treeGeometry } from '../src/render/trees';
import { clearSteppeCache, steppeTuftGeometry, tuftBladeCensus, tuftFieldPoints } from '../src/render/flora/steppeTuft';
import { cancelPendingTreeBuilds, placeTree, reconcileSteppe, treeRecord } from '../src/render/trees/game';
import { OPEN_TILES, slippy, storePhoto, storeTerrarium, type RgbaTile } from '../src/world/globe/openTiles';

function srgbByte(linear: number) {
  const x = Math.min(1, Math.max(0, linear));
  const s = x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(255, Math.max(0, s * 255)));
}

function solid(r: number, g: number, b: number): RgbaTile {
  const rgba = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < 256 * 256; i++) {
    rgba[i * 4] = r; rgba[i * 4 + 1] = g; rgba[i * 4 + 2] = b; rgba[i * 4 + 3] = 255;
  }
  return { w: 256, h: 256, rgba };
}

function dem216(): RgbaTile {
  return solid(128, 216, 0);
}

function paint(lat: number, lon: number, photo: RgbaTile, dem: RgbaTile) {
  const dLat = 120 / 111320;
  const dLon = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
  for (const [a, o] of [[0, 0], [dLat, 0], [-dLat, 0], [0, dLon], [0, -dLon]] as const) {
    for (const z of OPEN_TILES.photoZoom) {
      const s = slippy(lat + a, lon + o, z);
      storePhoto(z, Math.floor(s.x), Math.floor(s.y), photo);
    }
    for (const z of OPEN_TILES.demZoom) {
      const s = slippy(lat + a, lon + o, z);
      storeTerrarium(z, Math.floor(s.x), Math.floor(s.y), dem);
    }
  }
}

function spruce(x: number, z: number): Entity {
  return { key: `steppe-test:${x}:${z}`, kind: 'spruce', seed: 11, generatorVersion: GENERATOR_VERSION, x, z, rotation: 0.4, scale: 1 };
}

function measure(g: THREE.Group) {
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  const h = box.max.y - box.min.y;
  const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  return { h, w, name: (g.children[0] as THREE.Mesh | undefined)?.name ?? '' };
}

const STEPPE: [number, number, number] = [0.242, 0.138, 0.060];
const FOREST: [number, number, number] = [0.02, 0.08, 0.02];

test('a prairie sample draws a feather-grass tuft, not a spruce pole', () => {
  clearSteppeCache();
  try {
    const at = landingContext(0, 0);
    paint(at.lat, at.lon, solid(srgbByte(STEPPE[0]), srgbByte(STEPPE[1]), srgbByte(STEPPE[2])), dem216());
    clearSteppeCache();
    const hud = landingContext(0, 0);
    assert.equal(hud.biome, 'prairie');
    assert.equal(hud.water, false);
    const drawn = measure(treeGeometry(spruce(0, 0), 0));
    assert.equal(drawn.name, 'steppe-tuft');
    assert.ok(drawn.h <= 0.60, `tuft height ${drawn.h} m is above the 60 cm culm`);
    assert.ok(drawn.h >= 0.20, `tuft height ${drawn.h} m is not a grass clump`);
    assert.ok(drawn.w >= 0.20, `tuft width ${drawn.w} m still reads as a pole`);
  } finally {
    clearSteppeCache();
  }
});

test('a tuft is a fan of narrow blades, not three wide triangles', () => {
  const census = tuftBladeCensus(1);
  assert.equal(census.wideGround, 0, `a ground edge is wider than 4 cm (${census.wideGround})`);
  assert.ok(census.tips >= 8, `only ${census.tips} triangles reach a culm tip`);
  const g = steppeTuftGeometry(1);
  g.computeBoundingBox();
  const box = g.boundingBox!;
  const w = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
  const h = box.max.y - box.min.y;
  assert.ok(w >= 0.20, `fan width ${w} m still reads as a pole`);
  assert.ok(h >= 0.30 && h <= 0.60, `culm height ${h} m left 30–60 cm`);
});

test('a boreal sample still draws a tree taller than a tuft', () => {
  clearSteppeCache();
  try {
    const at = landingContext(30, 0);
    paint(at.lat, at.lon, solid(srgbByte(FOREST[0]), srgbByte(FOREST[1]), srgbByte(FOREST[2])), dem216());
    clearSteppeCache();
    assert.equal(landingContext(30, 0).biome, 'boreal');
    const drawn = measure(treeGeometry(spruce(30, 0), 2));
    assert.notEqual(drawn.name, 'steppe-tuft');
    assert.ok(drawn.h > 2, `boreal stem is only ${drawn.h} m`);
  } finally {
    clearSteppeCache();
  }
});

test('a spruce placed before the photo is replaced by a tuft once the sample is prairie', () => {
  clearSteppeCache();
  const scene = new THREE.Scene();
  try {
    placeTree('late-spruce', 4, 1, 6, 0, 1, 1, 1, 3, 1, false);
    assert.ok(treeRecord('late-spruce'));
    const at = landingContext(4, 6);
    paint(at.lat, at.lon, solid(srgbByte(STEPPE[0]), srgbByte(STEPPE[1]), srgbByte(STEPPE[2])), dem216());
    clearSteppeCache();
    reconcileSteppe(scene);
    assert.equal(treeRecord('late-spruce'), undefined);
    const tuft = scene.getObjectByName('steppe-tuft');
    assert.ok(tuft, 'a tuft stands where the spruce was');
  } finally {
    cancelPendingTreeBuilds();
    clearSteppeCache();
  }
});

test('the standing eye has tussocks inside two metres, each 30–60 cm', () => {
  clearSteppeCache();
  try {
    const at = landingContext(0, 0);
    paint(at.lat, at.lon, solid(srgbByte(STEPPE[0]), srgbByte(STEPPE[1]), srgbByte(STEPPE[2])), dem216());
    clearSteppeCache();
    const pts = tuftFieldPoints(0, 0);
    const near = pts.filter(p => Math.hypot(p.x, p.z) < 2);
    assert.ok(near.length >= 4, `only ${near.length} tussocks inside 2 m`);
    assert.ok(pts.every(p => p.h >= 0.30 && p.h <= 0.60), 'a tussock left the 30–60 cm culm');
  } finally {
    clearSteppeCache();
  }
});

test('the far filler does not keep a spruce on a prairie sample', () => {
  const far = readFileSync(new URL('../src/render/flora/fartrees.ts', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/render/trees.ts', import.meta.url), 'utf8');
  assert.match(scene, /steppeAt\(/);
  assert.match(scene, /steppeTuftGroup\(/);
  assert.match(far, /steppeAt\(/);
});
