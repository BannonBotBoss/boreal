import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSkeleton, interiorAngle, gapeDegrees, MAMMAL_CERVICAL, mergedRange, type Skeleton } from '../src/core/skeleton';
import { MAMMALS, BIRD_GROUPS, mammalSkeleton, birdSkeleton, MAMMALS_POST_1400 } from '../src/core/species';
const all: Skeleton[] = [...MAMMALS.map(r => mammalSkeleton(r[0])), ...BIRD_GROUPS.map(r => birdSkeleton(r[0]))];
const bone = (s: Skeleton, id: string) => s.bones.find(b => b.id === id)!;
test('every native mammal and every bird group obeys every global rule', () => {
  assert.equal(MAMMALS.length, 56 - MAMMALS_POST_1400.length);
  for (const s of all) assert.deepEqual(validateSkeleton(s), [], s.species);
});
test('the validator catches broken skeletons', () => {
  const wolf = mammalSkeleton('Gray Wolf');
  const detached = structuredClone(wolf); bone(detached, 'jaw').head = [9, 9, 9];
  assert.ok(validateSkeleton(detached).some(f => f.rule.startsWith('R3')));
  const movingSnout = structuredClone(wolf); bone(movingSnout, 'snout').joint = 'hinge'; bone(movingSnout, 'snout').rel = { flex: { min: 0, max: 5 } };
  assert.ok(validateSkeleton(movingSnout).some(f => f.rule.startsWith('R8')));
  const orphan = structuredClone(wolf); bone(orphan, 'skull').parent = 'nothing';
  assert.ok(validateSkeleton(orphan).some(f => f.rule.startsWith('R2')));
  const sixNeck = structuredClone(wolf); sixNeck.bones = sixNeck.bones.filter(b => b.id !== 'C4'); bone(sixNeck, 'C3').parent = 'C5';
  assert.ok(validateSkeleton(sixNeck).some(f => f.rule.startsWith('R10') || f.rule.startsWith('R3')));
});
test('wolf head: oval skull on the atlas, fixed snout, jaw hinged at the rear skull base opening downward ~40°', () => {
  const w = mammalSkeleton('Gray Wolf'), skull = bone(w, 'skull'), snout = bone(w, 'snout'), jaw = bone(w, 'jaw');
  assert.equal(skull.parent, 'C1'); assert.equal(snout.joint, 'fixed'); assert.ok(snout.end && jaw.end);
  assert.deepEqual(jaw.head, skull.head); assert.equal(jaw.rel!.flex!.min, 0);
  assert.ok(jaw.rel!.flex!.max > 28 && jaw.rel!.flex!.max < 45, `gape ${jaw.rel!.flex!.max}`);
  assert.equal(skull.rel!.flex!.max, 16.8); assert.equal(bone(w, 'C1').rel!.twist!.max, 15.8);
  assert.equal(w.bones.filter(b => b.role === 'neck').length, MAMMAL_CERVICAL);
  assert.ok(Math.abs(gapeDegrees(40, .1) - 2 * Math.asin(.134 / .2) * 180 / Math.PI) < 1e-9);
});
test('limb joints rest inside measured dog ranges; feet stand on the ground', () => {
  for (const name of ['Gray Wolf', 'White-tailed Deer', 'American Black Bear', 'Red Squirrel']) {
    const s = mammalSkeleton(name);
    for (const side of ['L', 'R']) {
      const elbow = interiorAngle(bone(s, `humerus.${side}`), bone(s, `forearm.${side}`));
      assert.ok(elbow >= 50 && elbow <= 175, `${name} elbow ${elbow}`);
      for (const foot of [`forefoot.${side}`, `hindfoot.${side}`]) {
        const f = bone(s, foot), low = Math.min(f.head[1], f.tail[1]); assert.ok(Math.abs(low) < 1e-3, `${name} ${foot} at ${low}`);
      }
    }
  }
});
test('birds: owl has 14 neck vertebrae sharing 270° of head roll; wrist follows elbow; toes match the group', () => {
  const owl = birdSkeleton('Owls'), neck = owl.bones.filter(b => b.role === 'neck');
  assert.equal(neck.length, 14);
  assert.ok(Math.abs(mergedRange(neck.map(b => b.rel!.twist!)).max - 270) < 1e-9);
  assert.equal(bone(owl, 'hand.L').coupledTo!.bone, 'forearm.L');
  assert.ok(Math.abs(interiorAngle(bone(owl, 'humerus.L'), bone(owl, 'forearm.L')) - 31.3) < .01, 'wing folded at rest');
  const swan = birdSkeleton('Swans'); assert.equal(swan.bones.filter(b => b.role === 'neck').length, 25);
  const back = (s: Skeleton) => s.bones.filter(b => b.id.startsWith('toe') && b.id.endsWith('.L') && b.tail[2] > b.head[2]).length;
  assert.equal(back(owl), 2); assert.equal(back(birdSkeleton('Thrushes')), 1); assert.equal(back(birdSkeleton('Swifts')), 0);
  assert.ok(owl.bones.some(b => b.role === 'keel')); assert.equal(bone(owl, 'pygostyle').end, true);
});
