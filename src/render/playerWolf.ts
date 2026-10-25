import * as THREE from 'three';
import { WOLF_SCALE, type WolfMode } from '../core/wolfModes';
import { AnimalBrain, pelvisShift, quadrupedPose, WOLF_LEGS } from '../core/animalBehavior';
import { pushProgress } from '../core/rocks';
import { buildBody, wolfCoat } from '../core/body';
import { BONE, BONE_COUNT, EYE_AT, HEAD_AT, JAW_AT, LEG_XZ, TAIL_AT, TAIL_BONES, TAIL_SEG, legBone, limbModel, sculptWolf, wolfTeeth, wolfTubes } from '../core/wolfBody';
import { buildFurCards, furCardMaterial } from './furCards';

/**
 * Procedural wolf: a low-poly base skin (tubes swept around an invisible skeleton, see core/body.ts and core/wolfBody.ts)
 * covered in hair cards (render/furCards.ts). Modelled with feet at zero and ear tips at 0.5, then scaled by WOLF_SCALE to
 * real size. The IK gait (core/animalBehavior.ts) drives the leg chains; the cranium carries the jaw, hinged at the rear
 * skull base; the tail is a four-bone chain that follows the body with a lag.
 */
/** Fur cards over the whole coat (about 3 triangles each). */
/** Skin under fur matches the cards' root shade (see furCards: root vertices are 0.55 × coat colour); bare skin keeps the earlier 0.72. */
const FUR_ROOT_SHADE = .55, BARE_SHADE = .72;
export const FUR_CARDS = 18000, FUR_LENGTH = .03, FUR_WIDTH = .009; // wider than before: the strand texture cuts away about half of each card. 18000 is game calibration so the grizzle covers the skin.
/** Tail hangs about 40° below horizontal at rest and lifts toward level as the wolf speeds up; the extra bend per joint curves it. */
const TAIL_HANG = .7, TAIL_LEVEL = .2, TAIL_CURVE = [0, .16, .12, -.08];
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HEAD_DROP = HEAD_AT[1] - .137;
/** Portrait mode: a darker charcoal-and-silver coat, much finer fur over only the head and neck, eye liner and teeth. The game wolf is unchanged. */
const PORTRAIT_COAT = { back: [.17, .18, .2] as [number, number, number], belly: [.44, .45, .45] as [number, number, number], dark: [.04, .04, .05] as [number, number, number], accent: [.5, .33, .19] as [number, number, number] };
/** A leg chain of a wolf rig: its bones from the girdle down, limb lengths in model units, and its rest position (x, z). */
export interface WolfChain { girdle: THREE.Bone; upper: THREE.Bone; lower: THREE.Bone; foot: THREE.Bone; paw: THREE.Bone; m: ReturnType<typeof limbModel>; x: number; z: number }
/**
 * T-0003: pose a wolf rig (torso and leg chains under a `tilt` group at the ground point under the body centre) from
 * quadrupedPose: body pitch, height and pitch shift on the tilt group, hind chain tops carried by the pelvis (pelvisShift), shoulder
 * blades and legs relative to the tilted body. Shared with the ?loco=1 fork rig, so both rigs pose every bone alike.
 */
export function poseWolfRig(tilt: THREE.Object3D, chains: WolfChain[], pose: ReturnType<typeof quadrupedPose>, extra?: (i: number) => number) {
  tilt.rotation.set(pose.pitch, 0, 0); tilt.position.set(0, (pose.bob + pose.shift.y) / WOLF_SCALE, pose.shift.z / WOLF_SCALE);
  const shift = pelvisShift(pose.spineFlex);
  chains.forEach((c, i) => {
    const hind = i % 2 === 1;
    c.girdle.position.set(c.x, c.m.hip + c.m.girdle + (hind ? shift.y / WOLF_SCALE : 0), c.z + (hind ? shift.z / WOLF_SCALE : 0));
    c.girdle.rotation.x = pose.girdles[i] - pose.pitch; c.upper.rotation.x = pose.legs[i] + (extra ? extra(i) : 0);
    c.lower.rotation.x = pose.knees[i]; c.foot.rotation.x = pose.wrists[i]; c.paw.rotation.x = pose.paws[i];
  });
}
export function createPlayerWolf(seed = 1400, options: { portrait?: boolean } = {}) {
  const portrait = !!options.portrait;
  const root = new THREE.Group(); root.scale.setScalar(WOLF_SCALE);
  const bones = Array.from({ length: BONE_COUNT }, () => new THREE.Bone());
  const torso = bones[BONE.torso], head = bones[BONE.head], jaw = bones[BONE.jaw];
  head.name = 'cranium'; jaw.name = 'jaw';
  // T-0003: torso and leg chains hang from a tilt group (body pitch and height; pivot: the ground point under the body centre).
  const tilt = new THREE.Group(); tilt.name = 'tilt'; root.add(tilt);
  tilt.add(torso);
  head.position.set(...HEAD_AT); torso.add(head);
  jaw.position.set(...JAW_AT); head.add(jaw); // hinge at the rear skull base, below the ears
  const tail = TAIL_BONES.map(i => bones[i]);
  tail.forEach((bone, k) => { bone.name = `tail${k}`; if (k === 0) { bone.position.set(...TAIL_AT); torso.add(bone); } else { bone.position.z = TAIL_SEG; tail[k - 1].add(bone); } });
  // Leg chains: girdle (shoulder blade) → upper → lower → foot bone → paw. Each starts at the root so the body can bob over them.
  const chains = LEG_XZ.map(([x, z], i) => {
    const ids = legBone(i), m = limbModel(i);
    const [girdle, upper, lower, foot, paw] = [bones[ids.girdle], bones[ids.leg], bones[ids.knee], bones[ids.wrist], bones[ids.paw]];
    girdle.position.set(x, m.hip + m.girdle, z); tilt.add(girdle);
    upper.position.y = -m.girdle; girdle.add(upper);
    lower.position.y = -m.upper; upper.add(lower);
    foot.position.y = -m.lower; lower.add(foot);
    paw.position.y = -m.foot; foot.add(paw); // pivots at the sole and is counter-rotated each frame to stay level
    return { girdle, upper, lower, foot, paw, m, x, z };
  });

  // Skin: built once at the straight bind pose, then bound to the skeleton. Fur cards grow from it.
  const body = buildBody(wolfTubes(portrait ? PORTRAIT_COAT : wolfCoat(seed)));
  const coat = portrait ? PORTRAIT_COAT : wolfCoat(seed);
  const clear = sculptWolf(body, portrait ? { ...coat, belly: [.7, .66, .58] } : coat); // portrait: cream cheeks in the muzzle gradient
  // Brow shelf fur: short, swept back and outward over the ridge.
  const browAt = (p: [number, number, number]) => {
    for (const side of [-1, 1]) {
      const dx = p[0] - side * EYE_AT[0], dy = p[1] - HEAD_AT[1] - EYE_AT[1] - .012, dz = p[2] - HEAD_AT[2] - EYE_AT[2];
      if (Math.hypot(dx, dy, dz) < .014) return { lay: [side * .6, .15, 1] as [number, number, number], lean: .35 };
    }
    return undefined;
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(body.position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(body.normal, 3));
  // Skin tint: under fur, the skin takes the fur-root shade (cards start at 0.55 × the coat colour), so gaps between strands read as
  // depth and shadow, not bare skin. Bare parts (nose, lips, tongue, mouth seal, ear cups) keep their own colour. Vertex colours only: no extra cost.
  const skinColor = body.color.map((c, i) => c * (body.furLen[Math.floor(i / 3)] >= .03 ? FUR_ROOT_SHADE : BARE_SHADE));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(skinColor, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(body.skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(body.skinWeight, 4));
  geometry.setIndex(body.index);
  const skinMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 });
  const skins = [
    new THREE.SkinnedMesh(geometry, skinMaterial),
    new THREE.SkinnedMesh(buildFurCards(body, portrait
      ? { count: 320000, length: .03, width: .0052, seed, clear, lean: .45, tone: .7,
        // Muzzle bridge and nose: fur combed forward toward the nose, lying nearly flat (about 10° off the skin).
        comb: p => browAt(p) ?? (p[2] < HEAD_AT[2] - .02 && p[1] > HEAD_AT[1] - .03 ? { lay: [0, -.18, -1], lean: .2 } : undefined), scaleAt: p => .55 + .45 * (1 - smooth(HEAD_AT[2] + .04, HEAD_AT[2] + .14, p[2])) }
      : { count: FUR_CARDS, length: FUR_LENGTH, width: FUR_WIDTH, seed, clear,
        // Banded guard hairs: pale tip over a darker shaft, which is what reads as grizzle (Young and Goldman 1944, The Wolves of North America) [verify page].
        tipTint: (p) => p[1] > .30 ? { color: [.72, .70, .66], amount: .45 } : undefined }), furCardMaterial()),
  ];
  skins.forEach(skin => { skin.frustumCulled = false; skin.name = skin === skins[0] ? 'skin' : 'fur'; });
  // Eyes sit forward in the sculpted sockets and ride on the cranium; the head sensor too.
  const amber = new THREE.MeshStandardMaterial({ color: 0xc9830f, emissive: 0xe07800, emissiveIntensity: 1.0, roughness: .25 }), pupil = new THREE.MeshStandardMaterial({ color: 0x120c04, roughness: .3 });
  const lidMaterial = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: .6, side: THREE.DoubleSide });
  const irisEdge = new THREE.MeshStandardMaterial({ color: 0x6a3806, emissive: 0x4a2404, emissiveIntensity: .8, roughness: .3, side: THREE.DoubleSide });
  // Flat almond eyelid cut: a dark flat shape with an almond hole, lying in the facial plane. Pointed corners, upper lid fuller than the lower.
  const almond = (a: number, up: number, down: number) => { const sh = new THREE.Shape(); sh.moveTo(-a, 0); sh.quadraticCurveTo(-a * .1, up * 1.9, a, 0); sh.quadraticCurveTo(-a * .1, -down * 1.9, -a, 0); return sh; };
  // Upper lid droops: the opening's top edge sits low, so the lid covers roughly the top quarter of the iris.
  const lidShape = almond(.0093, .0054, .0037); lidShape.holes.push(almond(.0085, .0034, .0033));
  const lidGeometry = new THREE.ShapeGeometry(lidShape);
  for (const side of [-1, 1]) {
    // The eyeball is pushed back into the socket so only the almond opening shows; it looks forward and ~15° outward, outer corner tilted up.
    const eye = new THREE.Group(); eye.position.set(side * EYE_AT[0], EYE_AT[1], EYE_AT[2]);
    eye.rotation.set(0, side * .26, side * .3);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.0058, 16, 12), amber); ball.scale.set(1, 1, .75); ball.position.z = .0048; // round iris
    const dot = new THREE.Mesh(new THREE.SphereGeometry(.0034, 14, 10), pupil); dot.position.set(0, 0, .0009); dot.scale.set(1, 1, .25); // round pupil, centred
    const lid = new THREE.Mesh(lidGeometry, lidMaterial); lid.position.z = -.0004;
    // Iris: a dark amber ring at the outer edge fading into bright amber toward the pupil.
    const ring = new THREE.Mesh(new THREE.RingGeometry(.0036, .0058, 28), irisEdge); ring.position.z = .0005;
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(almond(.0085, .0049, .0033)), pupil); inner.position.z = .0022; // shadow behind the opening
    eye.add(inner, ball, ring, dot, lid); head.add(eye);
  }
  // Nose pad (rhinarium): a heart/wedge of matte leather, broad and slightly notched on top, narrowing to a point at the lip.
  // Two mirrored teardrop nostrils are cut through it (real holes, dark behind), separated by a vertical groove (philtrum).
  const leather = new THREE.MeshStandardMaterial({ color: 0x09090a, roughness: .75 });
  const heart = new THREE.Shape();
  heart.moveTo(0, .0042);
  heart.bezierCurveTo(.004, .0068, .0105, .0058, .0098, .0005);
  heart.bezierCurveTo(.009, -.0035, .003, -.0062, 0, -.0068);
  heart.bezierCurveTo(-.003, -.0062, -.009, -.0035, -.0098, .0005);
  heart.bezierCurveTo(-.0105, .0058, -.004, .0068, 0, .0042);
  const nostrilShape = (side: number) => { // teardrop: round outer bulb, tip curling toward the midline and up
    const d = new THREE.Path(), x = side * .0046;
    d.moveTo(x - side * .0028, .0016);
    d.bezierCurveTo(x - side * .0006, .0008, x + side * .0022, .0016, x + side * .0021, -.0006);
    d.bezierCurveTo(x + side * .002, -.0024, x - side * .0008, -.0026, x - side * .0014, -.0008);
    d.bezierCurveTo(x - side * .0018, .0002, x - side * .0024, .0012, x - side * .0028, .0016);
    return d;
  };
  heart.holes.push(nostrilShape(-1), nostrilShape(1));
  const pad = new THREE.Mesh(new THREE.ExtrudeGeometry(heart, { depth: .005, bevelEnabled: true, bevelThickness: .0016, bevelSize: .0011, bevelSegments: 3, curveSegments: 10 }), leather);
  pad.scale.set(.85, .85, 1); pad.rotation.x = .35; pad.position.set(0, -.0158, -.1072); head.add(pad); // tilted back with the muzzle slope so it reads as a rounded wedge, not a flat plate // front face at about z -0.110; the back sinks into the muzzle tip
  const nostrilMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const nostrilBack = new THREE.Mesh(new THREE.PlaneGeometry(.018, .01), nostrilMaterial); nostrilBack.rotation.x = .35; nostrilBack.position.set(0, -.0158, -.1052); head.add(nostrilBack); // dark inside the nostrils
  const philtrum = new THREE.Mesh(new THREE.BoxGeometry(.0008, .0052, .0008), nostrilMaterial); philtrum.rotation.x = .35; philtrum.position.set(0, -.0188, -.1083); head.add(philtrum); // groove down the middle of the pad
  // Dental arch (core/wolfBody.wolfTeeth): canines, incisors, premolars and molars along the jaw edges.
  const ivory = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: .35 });
  for (const t of wolfTeeth()) {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(t.r, t.h, 7), ivory);
    mesh.position.set(t.at[0], t.at[1] + (t.jaw ? t.h / 2 : -t.h / 2), t.at[2]);
    mesh.rotation.x = t.jaw ? t.tilt : Math.PI - t.tilt;
    (t.jaw ? jaw : head).add(mesh);
  }
  const brain = new AnimalBrain(1400); brain.legs = WOLF_LEGS; const sensor = new THREE.Object3D(); sensor.name = 'head-sensor'; sensor.userData.brain = brain; head.add(sensor);
  root.add(...skins); root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones); // inverses captured now, at the bind pose
  skins.forEach(skin => skin.bind(skeleton));
  // render/bands (T-0004): animals opt out. Its pattern is in world space, so it would slide over a moving body, and the
  // coat already has its own zones and streaks.
  root.traverse(o => { for (const m of [(o as THREE.Mesh).material ?? []].flat()) m.userData.noBands = true; });

  const poseLegs = (pose: ReturnType<typeof quadrupedPose>, extra?: (i: number) => number) => poseWolfRig(tilt, chains, pose, extra);
  const tailPitch = { value: TAIL_HANG }, tailYaw = tail.map(() => 0);
  const setTail = () => tail.forEach((bone, k) => { bone.rotation.x = k === 0 ? tailPitch.value : TAIL_CURVE[k] * (1 - .6 * (TAIL_HANG - tailPitch.value) / (TAIL_HANG - TAIL_LEVEL)); bone.rotation.y = tailYaw[k]; });
  poseLegs(quadrupedPose('idle', 0, 0, WOLF_LEGS, 0)); setTail(); // stand on the ground before the first frame
  let lastTime = 0;
  return { root, brain, sensor, animate(time: number, moving: boolean, action: 'speak' | 'gather' | 'move' | undefined, elapsed: number, mode: WolfMode = 'walk', push?: { x: number; z: number; yaw: number }) {
    const stealth = mode === 'stealth' || mode === 'super-stealth';
    const running = mode === 'run' || mode === 'sprint';
    root.scale.set(WOLF_SCALE, WOLF_SCALE * (stealth && action !== 'move' ? .72 : 1), WOLF_SCALE);
    const dt = Math.max(0, Math.min(.1, time - lastTime)); lastTime = time;
    // T-0002/T-0003: the gait's own body motion (suspension arc, vault, pitch, pelvis) replaces the old wall-clock bounce.
    const pose = quadrupedPose(brain.motion, brain.drawPhase, brain.jumpTime, WOLF_LEGS, brain.gaitSpeed, brain.gaitName); // drawPhase: between 30 Hz sim steps
    poseLegs(pose);
    torso.position.y = moving ? 0 : Math.sin(time * 2) * .003;
    head.rotation.x = action === 'speak' ? -.45 * Math.sin(Math.min(1, elapsed / .2) * Math.PI / 2)
      : action === 'gather' ? .65 + Math.sin(elapsed * 12) * .12 : Math.sin(time * 1.4) * .035;
    head.position.set(...HEAD_AT);
    if (action === 'move' && push) {
      const retract = Math.max(0, Math.min(1, (1.2 - elapsed) / .4));
      const amount = pushProgress(elapsed) * retract;
      head.rotation.x = 0; torso.position.y = 0;
      head.position.y -= HEAD_DROP * Math.min(1, elapsed / .25) * retract;
      head.position.x += (Math.cos(push.yaw) * push.x - Math.sin(push.yaw) * push.z) * amount;
      head.position.z += (Math.sin(push.yaw) * push.x + Math.cos(push.yaw) * push.z) * amount;
      poseLegs(quadrupedPose('idle', 0, 0, WOLF_LEGS, 0), i => (i % 2 ? -.15 : .15) * Math.sin(Math.PI * pushProgress(elapsed)));
    }
    // The jaw is hinged at the rear skull base and opens only downward (rotation about x is negative = chin drops).
    jaw.rotation.x = -(action === 'speak' ? (1 + Math.sin(elapsed * 22)) * .12 : portrait ? .07 : 0); // portrait rests slightly parted (about 30% of a full open)
    // Tail: the root follows the gait phase and each joint lags the one before, so the sway travels down the chain.
    const lift = brain.motion === 'idle' ? 0 : Math.min(1, brain.gaitSpeed / 6), blendTo = 1 - Math.exp(-12 * dt);
    tail.forEach((_, k) => {
      const wave = brain.motion === 'idle' ? Math.sin(time * 1.3 - k * .8) * .05 : Math.sin(brain.drawPhase * Math.PI * 2 - k * .9) * (.09 + .02 * k);
      tailYaw[k] += (wave - tailYaw[k]) * blendTo;
    });
    tailPitch.value += (TAIL_HANG + (TAIL_LEVEL - TAIL_HANG) * lift - tailPitch.value) * (1 - Math.exp(-4 * dt));
    setTail();
    tail[0].position.set(...TAIL_AT);
  } };
}
