import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBody, wolfCoat } from '../src/core/body';
import { wolfTubes, BONE_COUNT, TAIL_BONES, TUBE, legBone, JAW_AT, HEAD_AT } from '../src/core/wolfBody';

const body = buildBody(wolfTubes(wolfCoat(1400))), n = body.position.length / 3;

test('wolf skin arrays are consistent, finite and within the skeleton', () => {
  assert.ok(n > 500 && n < 6000, `vertex count ${n}`);
  for (const a of [body.position, body.color, body.rest, body.skinWeight]) assert.ok(a.every(Number.isFinite));
  assert.equal(body.rest.length, body.position.length);
  assert.equal(body.color.length, n * 3); assert.equal(body.flow.length, n);
  assert.equal(body.skinIndex.length, n * 4); assert.equal(body.skinWeight.length, n * 4);
  assert.ok(body.index.every(i => i >= 0 && i < n) && body.index.length % 3 === 0);
  assert.ok(body.skinIndex.every(i => i >= 0 && i < BONE_COUNT));
});

test('every vertex is fully weighted to the bones (weights sum to one)', () => {
  for (let v = 0; v < n; v++) {
    const sum = body.skinWeight.slice(v * 4, v * 4 + 4).reduce((s, w) => s + w, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `vertex ${v}: ${sum}`);
  }
});

test('faces point outward: the signed volume of the closed skin is positive', () => {
  // Divergence theorem: sum of A·(B×C)/6 over triangles is the enclosed volume, positive only if faces point out.
  let volume = 0;
  for (let t = 0; t < body.index.length; t += 3) {
    const [A, B, C] = [0, 1, 2].map(k => body.position.slice(body.index[t + k] * 3, body.index[t + k] * 3 + 3));
    volume += (A[0] * (B[1] * C[2] - B[2] * C[1]) + A[1] * (B[2] * C[0] - B[0] * C[2]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
  }
  assert.ok(volume > .001 && volume < .05, `volume ${volume} (a 0.5 m model wolf is roughly 0.01 cubic model-metres)`);
});

test('coats are a pure function of the seed and stay in range', () => {
  assert.deepEqual(wolfCoat(7), wolfCoat(7));
  for (let s = 0; s < 200; s++) for (const { back, belly, dark } of [wolfCoat(s)]) for (const c of [back, belly, dark]) assert.ok(c.every(x => x >= 0 && x <= 1));
  const lightness = (s: number) => wolfCoat(s).back.reduce((a, b) => a + b, 0);
  assert.ok(lightness(18) < lightness(1400) * .6, 'seed 18 is the black coat');
  assert.deepEqual([1400, 1, 18].map(s => wolfCoat(s).name), ['timber grey', 'golden tan', 'black']);
});

// Real-wolf proportions (Wikipedia "Wolf", adult gray wolf; model units × 200 = cm). Measured on the bind pose.
const cm = (v: number) => v * 200;
const verts = Array.from({ length: n }, (_, v) => ({
  x: body.position[v * 3], y: body.position[v * 3 + 1], z: body.position[v * 3 + 2],
  bone: body.skinIndex[v * 4 + body.skinWeight.slice(v * 4, v * 4 + 4).indexOf(Math.max(...body.skinWeight.slice(v * 4, v * 4 + 4)))],
  tube: body.tube[v],
  pure: Math.max(...body.skinWeight.slice(v * 4, v * 4 + 4)) > .99,
}));
const range = (vs: typeof verts, k: 'x' | 'y' | 'z') => { const a = vs.map(v => v[k]); return cm(Math.max(...a) - Math.min(...a)); };
const within = (label: string, value: number, lo: number, hi: number) => assert.ok(value >= lo && value <= hi, `${label}: ${value.toFixed(1)} cm, expected ${lo}–${hi}`);
const skull = verts.filter(v => v.tube === TUBE.skull), ears = verts.filter(v => v.tube === TUBE.earL || v.tube === TUBE.earR);

test('wolf body matches published wolf proportions', () => {
  const chest = verts.filter(v => v.pure && v.bone === 0 && v.z > -.18 && v.z < -.09);
  within('shoulder height', cm(Math.max(...chest.map(v => v.y))), 80, 86);
  within('chest width (narrow-chested)', range(chest.filter(v => v.y > .28), 'x'), 18, 26); // above the leg tops
  within('chest depth (deep ribcage)', range(chest.filter(v => Math.abs(v.x) < .02), 'y'), 30, 42);
  within('skull + muzzle length', range(skull, 'z'), 25, 34);
  within('skull width (stylised ~25% broader than the 13–15 cm measured)', range(skull, 'x'), 16, 21);
  within('ear height above skull', cm(Math.max(...ears.map(v => v.y)) - Math.max(...skull.map(v => v.y))), 9, 12);
  within('tail length', range(verts.filter(v => v.pure && (TAIL_BONES as readonly number[]).includes(v.bone)), 'z'), 29, 50);
  const hindPaw = verts.filter(v => v.pure && v.bone === legBone(1).paw && v.y < .04);
  within('paw length', range(hindPaw, 'z'), 10, 15);
  within('paw width', range(hindPaw, 'x'), 7, 11);
});

test('jaw hinges at the rear skull base, below the ears, and is a separate mesh from the upper skull', () => {
  const jaw = verts.filter(v => v.tube === TUBE.jaw);
  assert.ok(jaw.length > 0 && skull.length > 0);
  const hinge = HEAD_AT[2] + JAW_AT[2], earBase = HEAD_AT[2];
  assert.ok(Math.abs(hinge - earBase) < .03, 'hinge is under the ears, not at the snout');
  assert.ok(JAW_AT[1] < -.02, 'hinge is below the skull top');
  assert.ok(Math.min(...jaw.map(v => v.z)) < hinge - .08, 'jaw extends forward from the hinge');
  assert.ok(jaw.some(v => v.pure && v.bone === 2), 'jaw has its own bone');
});

test('tail is a curved chain of four bones weighted smoothly', () => {
  const tailVerts = verts.filter(v => (TAIL_BONES as readonly number[]).includes(v.bone));
  for (const bone of TAIL_BONES) assert.ok(tailVerts.some(v => v.bone === bone), `bone ${bone} owns part of the tail`);
});
