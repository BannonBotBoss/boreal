/** T-0028 (grok): the procedural furred snowshoe-hare mesh - own bone table, sourced dimensions, mass check, the moult by
 *  world date (Mills et al. 2013), Sheriff et al. 2009 fur length and density, skinned to the bounding rig, no mesh file. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { buildBody } from '../src/core/body';
import { BONE_COUNT as WOLF_BONE_COUNT } from '../src/core/wolfBody';
import { RIG_BONE as HARE_BONE, RIG_BONE_COUNT as HARE_BONE_COUNT, RIG_TUBE as HARE_TUBE, rigLegTube as hareLegTube, seasonalWhiteness, localWhiteness as rigLocal, unionVolume } from '../src/core/rigBody';
import { HARE_BODY, HARE_SKIN, createHareModel, hareBind, hareTubes, poseHare, setHareDay, hareCoatState, type HareModel } from '../src/animals/hare';
const HARE_FUR = HARE_SKIN.fur, MOULT = HARE_SKIN.moult, moultWhiteness = (d: number) => seasonalWhiteness(d, MOULT), localWhiteness = (w: number, y: number) => rigLocal(w, y, MOULT);
import { createAgent } from '../src/core/agent/pipeline';
import { HARE_AGENT } from '../src/core/agent/species';
import { stream } from '../src/proc/rng';
import { limbPoints } from '../src/animals/locomotion/bounding';
import { skeletonOf } from '../src/animals/locomotion/bodyPlan';
import { HARE_PLAN } from '../src/animals/hare';

const bind = hareBind(), body = buildBody(hareTubes(bind)), n = body.position.length / 3;
const bare = buildBody(hareTubes(bind, undefined, 0));

test('hare skin: finite, fully weighted to its OWN bone table (not the wolf indices)', () => {
  assert.equal(HARE_BONE_COUNT, 21); assert.notEqual(HARE_BONE_COUNT, WOLF_BONE_COUNT);
  assert.ok(body.position.every(Number.isFinite) && body.skinIndex.every(i => i >= 0 && i < HARE_BONE_COUNT));
  for (let v = 0; v < n; v++) assert.ok(Math.abs(body.skinWeight.slice(v * 4, v * 4 + 4).reduce((a, b) => a + b, 0) - 1) < 1e-9, `vertex ${v}`);
  assert.ok(n > 1000 && n < 6000, `vertices ${n}`);
});

test('dimensions: head-body 361-479 mm, ear 62-70 mm, hind foot 117-147 mm (ADW), feet on the ground', () => {
  let nose = 1, rump = -1, minY = 1;
  for (let v = 0; v < n; v++) { const t = body.tube[v], z = body.position[v * 3 + 2]; minY = Math.min(minY, body.position[v * 3 + 1]);
    if (t !== HARE_TUBE.tail && t < 6) { nose = Math.min(nose, z); rump = Math.max(rump, z); } }
  const hb = (rump - nose) * 1000; assert.ok(hb >= 361 && hb <= 479, `head-body ${hb.toFixed(0)} mm`);
  assert.ok(bind.ear >= .062 && bind.ear <= .07, `ear ${bind.ear}`);
  const H = bind.limbs[1], foot = Math.hypot(H[3][1] - H[2][1], H[3][2] - H[2][2]) + Math.hypot(H[4][1] - H[3][1], H[4][2] - H[3][2]);
  assert.ok(foot >= .117 && foot <= .147, `hind foot ${foot}`); assert.equal(HARE_BODY.hindFoot, .132);
  assert.ok(minY > -.002 && minY < .002, `lowest skin point ${minY}`);
});

test('mass check: bare body (no pelt) holds 1.43-1.55 kg at ~1000 kg/m3 [estimate], within 25 %', () => {
  const litres = unionVolume(bare, 30000) * 1000;
  assert.ok(litres > 1.43 * .75 && litres < 1.55 * 1.25, `bare body ${litres.toFixed(2)} L`);
  assert.ok(unionVolume(body, 30000) > unionVolume(bare, 30000), 'the pelt adds volume');
});

test('moult from the world date (Mills et al. 2013): autumn from ~10 Oct over 40 d, spring from ~10 Apr', () => {
  assert.equal(MOULT.autumnStart, 283); assert.equal(MOULT.autumnDays, 40);
  for (const [day, w] of [[227, 0], [283, 0], [303, .5], [323, 1], [15, 1], [100, 1], [120, .5], [140, 0], [227 + 365, 0], [303 - 365, .5]] as const)
    assert.ok(Math.abs(moultWhiteness(day) - w) < 1e-9, `day ${day}: ${moultWhiteness(day)} vs ${w}`);
  assert.ok(localWhiteness(.3, .01) > localWhiteness(.3, .2), 'feet whiten before the back');
  assert.equal(localWhiteness(1, .25), 1); assert.equal(localWhiteness(0, 0), 0);
});

test('coat: summer shows .44 of the cards at 31.67/43.19 of the winter length (Sheriff et al. 2009); winter all', () => {
  const hare = createHareModel(); assert.ok(hare.root);
  setHareDay(15); const winter = hareCoatState()!; assert.equal(winter.whiteness, 1); assert.equal(winter.visibleCards, winter.cards);
  const fur = hare.root.getObjectByName('fur') as THREE.SkinnedMesh, len = () => { const P = fur.geometry.getAttribute('position').array as Float32Array, R = fur.geometry.userData.roots as Float32Array; let s = 0, k = 0;
    for (let c = 0; c < R.length / 15; c++) { const d = Math.hypot(P[c * 15 + 12] - R[c * 15 + 12], P[c * 15 + 13] - R[c * 15 + 13], P[c * 15 + 14] - R[c * 15 + 14]); if (d > 0) { s += d; k++; } } return s / k; };
  const lw = len(); setHareDay(227); const summer = hareCoatState()!;
  assert.equal(summer.whiteness, 0);
  assert.ok(Math.abs(summer.visibleCards / summer.cards - HARE_FUR.summerDensity) < .03, `summer share ${summer.visibleCards / summer.cards}`);
  assert.ok(Math.abs(len() / lw - 31.67 / 43.19) < .01, `length ratio ${len() / lw}`);
  assert.ok(winter.cards > 3000 && winter.cards <= HARE_FUR.cards, `cards ${winter.cards}`);
  // colour: the winter back is near white, the summer back brown
  const C = fur.geometry.getAttribute('color').array as Float32Array; let r = 0; for (let i = 0; i < C.length; i += 3) r += C[i]; const summerMean = r / (C.length / 3);
  setHareDay(15); r = 0; for (let i = 0; i < C.length; i += 3) r += C[i]; assert.ok(r / (C.length / 3) > summerMean + .2, 'winter coat lighter');
  setHareDay(227);
});

test('skinned to the rig: every leg-segment bone sits on its rig joint and points at the next, posed by poseHare', () => {
  const hare: HareModel = { ...createHareModel(), hopPhase: 0, id: 1 }, sk = skeletonOf(HARE_PLAN);
  const skins = hare.root.children.filter(o => (o as THREE.SkinnedMesh).isSkinnedMesh) as THREE.SkinnedMesh[];
  assert.equal(skins.length, 2); assert.equal(skins[0].skeleton, skins[1].skeleton); assert.equal(skins[0].skeleton.bones.length, HARE_BONE_COUNT);
  const a = createAgent(HARE_AGENT, 'hare:test', 0, 0, stream(1, 't'), { energy: 60, relaxation: 95 });
  for (let i = 0; i < 90; i++) { a.speed = i > 30 ? 6 : 0; poseHare(hare, a, 1 / 60, i / 60, 0); }
  hare.root.updateMatrixWorld(true);
  const w = new THREE.Vector3(), d = new THREE.Vector3();
  hare.legs.forEach((leg, i) => { const P = limbPoints(sk, hare.frame!, i);
    leg.segs.forEach((bone, s) => { bone.getWorldPosition(w); const p = P[s + leg.from], q = P[s + leg.from + 1], ox = a.x - hare.frame!.x, oz = a.z - hare.frame!.z;
      assert.ok(Math.hypot(w.x - p.x - ox, w.y - p.y, w.z - p.z - oz) < 1e-6, `leg ${i} seg ${s} off its joint`);
      d.copy(leg.dirs[s]).transformDirection(bone.matrixWorld); const e = new THREE.Vector3(q.x - p.x, q.y - p.y, q.z - p.z).normalize();
      assert.ok(d.dot(e) > .9999, `leg ${i} seg ${s} direction`); }); });
  assert.ok(Math.abs(hare.body.rotation.x - hare.frame!.tilt.pitch) < 1e-12);
  assert.equal(HARE_BONE.head, 1); assert.equal(hareLegTube(0), 6);
});

test('no mesh file: the hare is built from code, nothing is fetched or loaded', () => {
  const src = ['src/animals/hare.ts', 'src/core/rigBody.ts', 'src/render/rigSkin.ts', 'src/render/furCards.ts', 'src/core/body.ts'].map(f => readFileSync(f, 'utf8')).join('\n');
  assert.doesNotMatch(src, /GLTFLoader|OBJLoader|FBXLoader|ColladaLoader|PLYLoader|STLLoader|\.(glb|gltf|fbx|obj|dae|ply|stl)['"`]|TextureLoader|new URL\(/);
  const walk = (d: string): string[] => !existsSync(d) ? [] : readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
  assert.deepEqual(walk('public').filter(f => /hare|rabbit|lepus/i.test(f) && /\.(glb|gltf|fbx|obj|dae|ply|stl|png|jpg|ktx2)$/i.test(f)), []);
  const g = globalThis as { fetch?: unknown; XMLHttpRequest?: unknown }, saved = [g.fetch, g.XMLHttpRequest]; let calls = 0;
  g.fetch = () => { calls++; throw new Error('fetch'); }; g.XMLHttpRequest = function () { calls++; throw new Error('xhr'); };
  try { createHareModel(); } finally { g.fetch = saved[0]; g.XMLHttpRequest = saved[1]; }
  assert.equal(calls, 0);
});
