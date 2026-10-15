import * as THREE from 'three';
import { quadrupedPose, type Motion } from '../core/animalBehavior';
import { buildBody } from '../core/body';
import { bearFootTubes, BEAR_BONE, BEAR_BONE_COUNT, BEAR_EYE_AT, BEAR_HEAD_AT, BEAR_JAW_AT, BEAR_LEGS, BEAR_LEG_XZ, BEAR_TAIL_AT, bearCoat, bearLegBone, bearLimb, bearTubes, sculptBear, type BearVariant } from '../core/bearBody';
import { buildFurCards, furCardMaterial } from './furCards';

/**
 * Procedural bear (core/bearBody.ts): one skinned base skin, dense strand-textured fur cards with grizzled tips, plantigrade feet with
 * five curved claws each, deep-set eyes and a leather nose. Same IK gait as the wolf (quadrupedPose with BEAR_LEGS).
 */
const FUR_CARDS = 32000, FUR_LENGTH = .075, FUR_WIDTH = .03, FUR_ROOT_SHADE = .55, BARE_SHADE = .8;

export function createBear(seed = 1, variant: BearVariant = 'grizzly') {
  const root = new THREE.Group(); root.name = `bear-${variant}`;
  const bones = Array.from({ length: BEAR_BONE_COUNT }, () => new THREE.Bone());
  const torso = bones[BEAR_BONE.torso], head = bones[BEAR_BONE.head], jaw = bones[BEAR_BONE.jaw], tail = bones[BEAR_BONE.tail];
  root.add(torso);
  head.position.set(...BEAR_HEAD_AT); torso.add(head);
  jaw.position.set(...BEAR_JAW_AT); head.add(jaw);
  tail.position.set(...BEAR_TAIL_AT); torso.add(tail);
  const chains = BEAR_LEG_XZ.map(([x, z], i) => {
    const ids = bearLegBone(i), m = bearLimb(i);
    const [girdle, upper, lower, foot, paw] = [bones[ids.girdle], bones[ids.leg], bones[ids.knee], bones[ids.wrist], bones[ids.paw]];
    girdle.position.set(x, m.hip + m.girdle, z); root.add(girdle);
    upper.position.y = -m.girdle; girdle.add(upper);
    lower.position.y = -m.upper; upper.add(lower);
    foot.position.y = -m.lower; lower.add(foot);
    paw.position.y = -m.foot; foot.add(paw);
    return { girdle, upper, lower, foot, paw, m, front: i % 2 === 0 };
  });

  const coat = bearCoat(variant, seed);
  const body = buildBody(bearTubes(coat, variant)), clear = sculptBear(body);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(body.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(body.normal, 3));
  // Dark-brown undercoat: skin under fur takes the fur-root shade, so gaps between strands read as depth.
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(body.color.map((c, i) => c * (body.furLen[Math.floor(i / 3)] >= .03 ? FUR_ROOT_SHADE : BARE_SHADE)), 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(body.skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(body.skinWeight, 4));
  geometry.setIndex(body.index);
  // Grizzled tips: strongest on the head, neck ruff and shoulder hump, light on the back, none on the legs.
  const H = BEAR_HEAD_AT, grizzle = coat.grizzle;
  // Soles stay bare. In the bind pose a foot pad's sole faces +z (it rotates to face down when the foot lies flat); the toes' sole faces −y.
  const soles = new Map<number, 'pad' | 'toes'>(); for (let i = 0; i < 4; i++) { const t = bearFootTubes(i); soles.set(t.pad, 'pad'); soles.set(t.toes, 'toes'); }
  const tipTint = grizzle ? (p: [number, number, number]) => {
    // Frontness peaks over the shoulders, ruff and head; height keeps it to the upper surfaces, so the flanks and legs stay dark brown.
    const front = Math.max(0, Math.min(1, (-.15 - p[2]) / .5)), high = Math.max(0, Math.min(1, (p[1] - .78) / .2));
    const muzzle = p[2] < H[2] - .24 ? .25 : 1;
    const amount = (.08 + .55 * front) * high * muzzle;
    return amount > .02 ? { color: grizzle, amount } : undefined;
  } : undefined;
  const skins = [
    new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 })),
    new THREE.SkinnedMesh(buildFurCards(body, { count: FUR_CARDS, length: FUR_LENGTH, width: FUR_WIDTH, seed: seed * 31 + 7, clear, lean: .7, tone: .35, tipTint, keepCard: (p, n, tube) => !soles.has(tube) || (soles.get(tube) === 'pad' ? n[2] < -.15 && p[1] < -.12 : n[1] > .05) }), furCardMaterial()), // bare soles; no cards at the heel bend, where they would hang to the ground
  ];
  skins.forEach((s, k) => { s.frustumCulled = false; s.name = k ? 'fur' : 'skin'; });

  // Deep-set, forward-facing dark eyes.
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1b0f07, roughness: .2 });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.017, 12, 10), eyeMat);
    eye.position.set(side * BEAR_EYE_AT[0], BEAR_EYE_AT[1], BEAR_EYE_AT[2] - .007); // front just proud of the socket floor; the brow overhangs it
    eye.scale.set(1, .85, .8); eye.name = 'eye'; head.add(eye);
  }
  // Wide, blunt leather nose with two nostrils.
  const leather = new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: .6 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), leather); nose.scale.set(1.35, .8, .6); nose.position.set(0, -.035, -.452); head.add(nose);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const side of [-1, 1]) {
    const hole = new THREE.Mesh(new THREE.SphereGeometry(.013, 10, 8), holeMat); hole.scale.set(1.3, .7, .4); hole.position.set(side * .03, -.042, -.478); hole.rotation.z = side * .35; head.add(hole);
  }
  // Claws: five per paw, non-retractable, curved (a tapered base plus a down-turned tip). Front claws are the long digging claws.
  const clawMat = new THREE.MeshStandardMaterial({ color: 0x2a241c, roughness: .4 });
  chains.forEach(c => {
    const length = c.front ? .085 : .045, spread = c.front ? .075 : .07;
    for (let k = 0; k < 5; k++) {
      const s = (k - 2) / 2, claw = new THREE.Group(); claw.name = 'claw';
      claw.position.set(s * spread, .035 - Math.abs(s) * .006, -.085 + Math.abs(s) * .018);
      claw.rotation.set(-.15, s * .18, 0); // fan outward, angled slightly down; the tip curls to the ground
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.006, .011, length * .55, 7), clawMat); base.rotation.x = -Math.PI / 2; base.position.z = -length * .27;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(.006, length * .5, 7), clawMat);
      const bend = new THREE.Group(); bend.position.z = -length * .55; bend.rotation.x = -.6; tip.rotation.x = -Math.PI / 2; tip.position.z = -length * .24; bend.add(tip);
      claw.add(base, bend); c.paw.add(claw);
    }
  });

  root.add(...skins); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skins.forEach(s => s.bind(skeleton));

  const pose = (motion: Motion, phase: number, speed: number) => {
    const p = quadrupedPose(motion, phase, 0, BEAR_LEGS, speed);
    chains.forEach((c, i) => {
      c.girdle.position.y = c.m.hip + c.m.girdle + p.bob;
      c.girdle.rotation.x = p.girdles[i]; c.upper.rotation.x = p.legs[i]; c.lower.rotation.x = p.knees[i]; c.foot.rotation.x = p.wrists[i]; c.paw.rotation.x = p.paws[i];
    });
    torso.position.y = p.bob;
    return p;
  };
  pose('idle', 0, 0);
  return {
    root, legs: BEAR_LEGS,
    /** Pose the bear: gait motion, phase 0–1 through the stride, speed in m/s; the head swings low and slow with the walk. */
    animate(time: number, motion: Motion = 'idle', phase = 0, speed = 0) {
      pose(motion, phase, speed);
      head.rotation.x = motion === 'idle' ? Math.sin(time * .8) * .03 : .08 + Math.sin(phase * Math.PI * 4) * .05;
      head.rotation.y = motion === 'idle' ? 0 : Math.sin(phase * Math.PI * 2) * .06;
      tail.rotation.x = .5;
    },
  };
}
