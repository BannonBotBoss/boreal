/**
 * Procedural skeletons: one set of global rules for every animal and bird.
 * A species is only numbers (a plan); the generator turns a plan into a connected bone tree, and
 * validateSkeleton() checks every rule. See SKELETON-RULES.md for the rules, sources and open research.
 *
 * Conventions: metres; y up; −z forward; +x is the animal's left. Sagittal angle `a` is measured from
 * straight down, positive toward forward (a = 90 points forward, a = −90 backward, a = 180 straight up).
 * Hinge limits use the goniometric convention: the interior angle between parent and child, 180° = straight.
 */
export type Vec = [number, number, number];
export type JointType = 'root' | 'fixed' | 'hinge' | 'ball';
export type Role = 'pelvis' | 'spine' | 'neck' | 'skull' | 'snout' | 'jaw' | 'girdle' | 'limb' | 'digit' | 'tail' | 'wing' | 'keel';
export interface Range { min: number; max: number }
export interface Bone {
  id: string; parent: string | null; role: Role;
  head: Vec; tail: Vec; radius: number;
  joint: JointType;
  /** Goniometric interior-angle range for a hinge or ball flexion axis. */
  interior?: Range;
  /** Ranges relative to the rest pose (degrees): flex = pitch, side = yaw, twist = roll about the bone. */
  rel?: { flex?: Range; side?: Range; twist?: Range };
  /** Terminal piece: attached at one end only, no children. */
  end: boolean;
  /** This joint's interior angle is driven by another bone's joint (bird wrist follows elbow). */
  coupledTo?: { bone: string; from: Range; to: Range };
  source: string; provisional: boolean;
}
export interface Skeleton { species: string; plan: 'mammal' | 'bird'; archetype: string; bones: Bone[] }

// ---------------------------------------------------------------- research values
/** Dog goniometry, mean flexion–extension (°). Formenton et al. 2019 (French Bulldogs; reported similar to Labradors, Jaegger et al. 2002). */
export const CANID_LIMB = {
  shoulder: { min: 51, max: 160 }, elbow: { min: 50, max: 175 }, carpus: { min: 32, max: 204 },
  hip: { min: 58, max: 181 }, stifle: { min: 58, max: 173 }, tarsus: { min: 40, max: 188 },
} as const;
const SRC_GONIO = 'Formenton et al. 2019, Front. Vet. Sci. 6:424 (dog goniometry)';
/** Head joints, Labrador maxima during natural movement (°). Rot-joint fluoroscopy, Front. Vet. Sci. 2021, 8:709967. */
export const CANID_HEAD = { occipital: { flex: 16.8, side: 11.7, twist: 12.0 }, atlas: { flex: 9.7, side: 7.8, twist: 15.8 } } as const;
const SRC_HEAD = 'Front. Vet. Sci. 2021 8:709967 (canine upper cervical motion, Labrador maxima)';
/** Maximum interincisal opening (mm) by body mass in dogs. Gracis et al., Front. Vet. Sci. 2016 3:51. */
export const DOG_GAPE_MM: [number, number][] = [[5, 67], [10, 93], [25, 115], [Infinity, 134]];
const SRC_GAPE = 'Front. Vet. Sci. 2016 3:51 (dog mandibular opening by weight)';
/** Jaw opening angle from incisor gap and jaw length (chord of a hinge). */
export function gapeDegrees(massKg: number, jawLength: number) {
  const mm = DOG_GAPE_MM.find(([kg]) => massKg <= kg)![1];
  return 2 * Math.asin(Math.min(1, mm / 1000 / (2 * jawLength))) * 180 / Math.PI;
}
/** Bird wing folded angles: crown-bird medians, elbow 31.3°, wrist 52.2° (Zoological Letters 2023, s40851-023-00204-x). Extended values provisional. */
export const BIRD_WING = { elbow: { min: 31.3, max: 160 }, wrist: { min: 52.2, max: 175 } } as const;
const SRC_WING = 'Zool. Lett. 2023 (s40851-023-00204-x) folded medians; extension provisional';
/** Bird neck: 8–25 cervical vertebrae (Bird anatomy); owls 14, rotating 270° each way (de Kok-Mercado et al., Johns Hopkins 2013). */
export const BIRD_NECK = { min: 8, max: 25 } as const;
/** Every mammal in this region has 7 cervical vertebrae (mammalian rule; exceptions are sloths and manatees). */
export const MAMMAL_CERVICAL = 7;

// ---------------------------------------------------------------- vector helpers
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Vec, s: number): Vec => [a[0] * s, a[1] * s, a[2] * s];
const len = (a: Vec) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: Vec): Vec => mul(a, 1 / (len(a) || 1));
const lerp = (a: Vec, b: Vec, t: number): Vec => add(a, mul(sub(b, a), t));
const deg = (r: number) => r * 180 / Math.PI;
/** Sagittal direction from angle a (see conventions), with optional lateral component. */
export const dirA = (a: number, lateral = 0): Vec => norm([lateral, -Math.cos(a * Math.PI / 180), -Math.sin(a * Math.PI / 180)]);
/** Interior (goniometric) angle between parent and child bone directions; 180 = straight on. */
export function interiorAngle(parent: Bone, child: Bone) {
  const p = norm(sub(parent.tail, parent.head)), c = norm(sub(child.tail, child.head));
  return 180 - deg(Math.acos(Math.max(-1, Math.min(1, p[0] * c[0] + p[1] * c[1] + p[2] * c[2]))));
}
const sym = (r: number): Range => ({ min: -r, max: r });

class Builder {
  bones: Bone[] = [];
  get(id: string) { return this.bones.find(b => b.id === id)!; }
  at(id: string, t = 1) { const b = this.get(id); return lerp(b.head, b.tail, t); }
  add(b: Omit<Bone, 'tail' | 'end' | 'provisional'> & { dir: Vec; length: number; end?: boolean; provisional?: boolean }) {
    const { dir, length, ...rest } = b;
    const bone: Bone = { end: false, provisional: false, ...rest, tail: add(b.head, mul(norm(dir), length)) };
    this.bones.push(bone); return bone;
  }
  chain(parent: string, from: Vec, ids: string[], role: Role, dirs: Vec[], lengths: number[], radius: number, ranges: (i: number) => Partial<Bone>, src: string, provisional: boolean, lastEnd = false) {
    let p = parent, h = from;
    ids.forEach((id, i) => {
      this.add({ id, parent: p, role, head: h, dir: dirs[i], length: lengths[i], radius, joint: 'ball', source: src, provisional, end: lastEnd && i === ids.length - 1, ...ranges(i) });
      p = id; h = this.get(id).tail;
    });
  }
}

// ---------------------------------------------------------------- mammals
export type Posture = 'plantigrade' | 'digitigrade' | 'unguligrade' | 'bat';
export interface MammalPlan {
  kind: 'mammal'; archetype: string; posture: Posture;
  /** Shoulder height (m) — scales everything. */ withers: number; massKg: number;
  /** Ratios to withers. */ trunk: number; neck: number; skull: number; tail: number; width: number;
  /** Fraction of skull length that is snout. */ snout: number;
  tailCount: number;
  /** [scapula, humerus, forearm, manus, digits] / withers. */ fore: number[];
  /** [pelvis, femur, shank, pes, digits] / withers. */ hind: number[];
  /** Fore digit bones per foot (bats carry 4 wing fingers). */ foreDigits?: number;
  /** Carnivore gape uses the dog data; others are provisional. */ carnivore: boolean;
  provisional: boolean;
}
/** Rest angles per posture (see conventions). fore: scapula, humerus, forearm, manus, digits; hind: femur, shank, pes, digits. */
const POSTURE: Record<Posture, { fore: number[]; hind: number[] }> = {
  digitigrade: { fore: [30, -35, 3, 20, 85], hind: [25, -35, 10, 85] },
  plantigrade: { fore: [25, -25, 5, 88, 90], hind: [20, -20, 88, 90] },
  unguligrade: { fore: [30, -40, 0, 0, 25], hind: [20, -40, 0, 25] },
  // Bat at rest on the ground: wing folded — humerus back, forearm forward along it, fingers swept back.
  bat: { fore: [30, -50, 110, 100, -55], hind: [20, -20, 88, 90] },
};
export function buildMammal(species: string, p: MammalPlan): Skeleton {
  const B = new Builder(), w = p.withers, pv = p.provisional, PROV = 'provisional estimate';
  const fa = POSTURE[p.posture].fore, ha = POSTURE[p.posture].hind;
  const fl = p.fore.map(r => r * w), hl = p.hind.map(r => r * w);
  const vert = (ls: number[], as: number[]) => ls.reduce((s, l, i) => s + l * Math.cos(as[i] * Math.PI / 180), 0);
  const front = vert(fl, fa), hipH = vert(hl.slice(1), ha), pelvisLen = hl[0];
  const half = p.trunk * w / 2, lateral = p.width * w;
  // Trunk: pelvis (root) → lumbar → thoracic; withers at the front end so the fore toes touch the ground.
  const P0: Vec = [0, hipH + .25 * pelvisLen, half], P2: Vec = [0, front, -half];
  const P1: Vec = add(lerp(P0, P2, .45), [0, .03 * w, 0]);
  B.add({ id: 'pelvis', parent: null, role: 'pelvis', head: P0, dir: dirA(-60), length: pelvisLen, radius: .12 * w, joint: 'root', source: 'body plan', provisional: pv });
  B.add({ id: 'lumbar', parent: 'pelvis', role: 'spine', head: P0, dir: sub(P1, P0), length: len(sub(P1, P0)), radius: .16 * w, joint: 'ball', rel: { flex: sym(15), side: sym(10), twist: sym(5) }, source: PROV, provisional: true });
  B.add({ id: 'thoracic', parent: 'lumbar', role: 'spine', head: P1, dir: sub(P2, P1), length: len(sub(P2, P1)), radius: .2 * w, joint: 'ball', rel: { flex: sym(8), side: sym(8), twist: sym(5) }, source: PROV, provisional: true });
  // Neck: always 7 cervical vertebrae in mammals, C7 (base) to C1 (atlas).
  const neckSeg = p.neck * w / MAMMAL_CERVICAL;
  const neckIds = Array.from({ length: MAMMAL_CERVICAL }, (_, i) => `C${MAMMAL_CERVICAL - i}`);
  B.chain('thoracic', P2, neckIds, 'neck', neckIds.map(() => dirA(135)), neckIds.map(() => neckSeg), .08 * w, i =>
    i === MAMMAL_CERVICAL - 1 ? { rel: { flex: sym(CANID_HEAD.atlas.flex), side: sym(CANID_HEAD.atlas.side), twist: sym(CANID_HEAD.atlas.twist) }, source: SRC_HEAD, provisional: false }
      : { rel: { flex: sym(6), side: sym(6), twist: sym(2) }, source: PROV, provisional: true }, PROV, true);
  // Skull (oval) on the atlas, limited by the atlanto-occipital joint; snout fixed in front; jaw hinged at the rear skull base (below the ears, like the real jaw joint).
  const skullLen = p.skull * w, cranium = skullLen * (1 - p.snout), snout = skullLen * p.snout;
  B.add({ id: 'skull', parent: 'C1', role: 'skull', head: B.at('C1'), dir: dirA(100), length: cranium, radius: .45 * cranium, joint: 'ball',
    rel: { flex: sym(CANID_HEAD.occipital.flex), side: sym(CANID_HEAD.occipital.side), twist: sym(CANID_HEAD.occipital.twist) }, source: SRC_HEAD, provisional: false });
  B.add({ id: 'snout', parent: 'skull', role: 'snout', head: B.at('skull'), dir: dirA(95), length: snout, radius: .3 * cranium, joint: 'fixed', end: true, source: 'rule: snout is fixed and is the nose', provisional: false });
  // Measured opening is at the incisors with the real jaw joint behind the eye: angle from the real mandible (~85% of skull length).
  const gape = p.carnivore ? gapeDegrees(p.massKg, skullLen * .85) : 30;
  B.add({ id: 'jaw', parent: 'skull', role: 'jaw', head: B.at('C1'), dir: dirA(97), length: skullLen * .85, radius: .2 * cranium, joint: 'hinge', end: true,
    rel: { flex: { min: 0, max: gape } }, source: p.carnivore ? SRC_GAPE : PROV, provisional: !p.carnivore });
  // Limbs, mirrored left/right.
  for (const [s, x] of [['L', lateral], ['R', -lateral]] as const) {
    const dig = p.foreDigits ?? 1;
    B.add({ id: `scapula.${s}`, parent: 'thoracic', role: 'girdle', head: P2, dir: add(mul(dirA(fa[0]), fl[0]), [x, 0, 0]), length: Math.hypot(fl[0], x), radius: .06 * w, joint: 'ball', rel: { flex: sym(15), side: sym(5), twist: sym(5) }, source: PROV, provisional: true });
    // Bat wings fold far tighter than a dog's leg: separate (provisional) ranges.
    const fJoint = p.posture === 'bat' ? [CANID_LIMB.shoulder, { min: 10, max: 175 }, { min: 10, max: 200 }] : [CANID_LIMB.shoulder, CANID_LIMB.elbow, CANID_LIMB.carpus];
    const fNames = ['humerus', 'forearm', 'manus'];
    let parent = `scapula.${s}`;
    fNames.forEach((n, i) => {
      B.add({ id: `${n}.${s}`, parent, role: p.posture === 'bat' && i > 0 ? 'wing' : 'limb', head: B.at(parent), dir: dirA(fa[i + 1]), length: fl[i + 1], radius: (.05 - .008 * i) * w, joint: i === 0 ? 'ball' : 'hinge',
        interior: fJoint[i], rel: i === 0 ? { side: sym(20), twist: sym(10) } : undefined, source: p.posture === 'bat' && i > 0 ? PROV + ' (bat wing)' : SRC_GONIO + (p.archetype === 'canid' ? '' : ' (canid values applied)'), provisional: p.archetype !== 'canid' });
      parent = `${n}.${s}`;
    });
    for (let d = 0; d < dig; d++) {
      const spread = dig > 1 ? (d - (dig - 1) / 2) * (p.posture === 'bat' ? 6 : 25) : 0; // folded wing fingers lie close together
      B.add({ id: dig > 1 ? `digit${d + 2}.${s}` : `forefoot.${s}`, parent, role: p.posture === 'bat' ? 'wing' : 'digit', head: B.at(parent), dir: dirA(fa[4] + spread), length: fl[4], radius: .025 * w, joint: 'hinge', end: true, interior: { min: 10, max: 200 }, source: PROV, provisional: true });
    }
    B.add({ id: `ilium.${s}`, parent: 'pelvis', role: 'girdle', head: B.at('pelvis', .5), dir: [x, 0, 0], length: Math.abs(x), radius: .05 * w, joint: 'fixed', source: 'body plan: hip socket on the pelvis', provisional: false });
    const hNames = ['femur', 'shank', 'pes'], hJoint = [CANID_LIMB.hip, CANID_LIMB.stifle, CANID_LIMB.tarsus];
    parent = `ilium.${s}`;
    hNames.forEach((n, i) => {
      B.add({ id: `${n}.${s}`, parent, role: 'limb', head: B.at(parent), dir: dirA(ha[i]), length: hl[i + 1], radius: (.06 - .01 * i) * w, joint: i === 0 ? 'ball' : 'hinge',
        interior: hJoint[i], rel: i === 0 ? { side: sym(20), twist: sym(10) } : undefined, source: SRC_GONIO + (p.archetype === 'canid' ? '' : ' (canid values applied)'), provisional: p.archetype !== 'canid' });
      parent = `${n}.${s}`;
    });
    B.add({ id: `hindfoot.${s}`, parent, role: 'digit', head: B.at(parent), dir: dirA(ha[3]), length: hl[4], radius: .025 * w, joint: 'hinge', end: true, interior: { min: 10, max: 200 }, source: PROV, provisional: true });
  }
  // Interior ranges for the pelvis→femur "hip" are measured against the pelvis line, not the connector.
  // Tail: caudal chain from the sacrum, last vertebra is an end piece.
  const tailIds = Array.from({ length: p.tailCount }, (_, i) => `Ca${i + 1}`);
  const tailSeg = p.tail * w / Math.max(1, p.tailCount);
  B.chain('pelvis', B.at('pelvis', .25), tailIds, 'tail', tailIds.map((_, i) => dirA(-70 + i * 2)), tailIds.map(() => tailSeg), .03 * w, () => ({ rel: { flex: sym(20), side: sym(25), twist: sym(3) } }), PROV, true, true);
  return { species, plan: 'mammal', archetype: p.archetype, bones: B.bones };
}

// ---------------------------------------------------------------- birds
export type Toes = 'anisodactyl' | 'zygodactyl' | 'syndactyl' | 'pamprodactyl';
export interface BirdPlan {
  kind: 'bird'; archetype: string;
  /** Bill tip to tail tip (m) — scales everything. */ length: number;
  neckCount: number; /** Ratios to length. */ neck: number; skull: number; beak: number; body: number;
  wing: [number, number, number]; leg: [number, number, number, number];
  toes: Toes; caudals: number; /** Head roll available each way (°), spread over the neck. */ headTwist: number;
  /** Neck rest angle (see conventions); 180 = straight up. */ neckAngle: number;
  flight: boolean; provisional: boolean;
}
const TOE_LAYOUT: Record<Toes, number[]> = {
  anisodactyl: [-25, 0, 25, 180], zygodactyl: [-20, 20, 160, 200], syndactyl: [-15, 0, 15, 180], pamprodactyl: [-30, -10, 10, 30],
};
export function buildBird(species: string, p: BirdPlan): Skeleton {
  const B = new Builder(), L = p.length, pv = p.provisional, PROV = 'provisional estimate';
  const [fem, tib, tmt, toe] = p.leg.map(r => r * L), legAngles = [45, -30, 15];
  const hipH = fem * Math.cos(45 * Math.PI / 180) + tib * Math.cos(30 * Math.PI / 180) + tmt * Math.cos(15 * Math.PI / 180);
  const body = p.body * L, lateral = .12 * body;
  // Synsacrum (fused pelvis, root) runs back from the hip; the thorax (notarium) is fused to it.
  const P0: Vec = [0, hipH, body * .15];
  B.add({ id: 'synsacrum', parent: null, role: 'pelvis', head: P0, dir: dirA(-80), length: body * .4, radius: .18 * body, joint: 'root', source: 'Bird anatomy: synsacrum (fused)', provisional: false });
  B.add({ id: 'thorax', parent: 'synsacrum', role: 'spine', head: P0, dir: dirA(95), length: body * .6, radius: .25 * body, joint: 'fixed', source: 'Bird anatomy: notarium fused thoracic vertebrae', provisional: false });
  if (p.flight) B.add({ id: 'keel', parent: 'thorax', role: 'keel', head: B.at('thorax', .5), dir: dirA(10), length: body * .3, radius: .05 * body, joint: 'fixed', end: true, source: 'Bird anatomy: keeled sternum in flying birds', provisional: false });
  // Neck: 8–25 cervical vertebrae; head roll is shared across them (owl: 14 vertebrae, 270° each way).
  const seg = p.neck * L / p.neckCount, ids = Array.from({ length: p.neckCount }, (_, i) => `C${p.neckCount - i}`);
  const twist = p.headTwist / p.neckCount;
  B.chain('thorax', B.at('thorax'), ids, 'neck', ids.map(() => dirA(p.neckAngle)), ids.map(() => seg), .05 * body,
    () => ({ rel: { flex: sym(12), side: sym(12), twist: sym(twist) }, source: p.archetype === 'owl' ? 'de Kok-Mercado et al. 2013 (owl 270°/14 vertebrae)' : PROV, provisional: p.archetype !== 'owl' }), PROV, true);
  const skull = p.skull * L, beak = p.beak * L;
  B.add({ id: 'skull', parent: 'C1', role: 'skull', head: B.at('C1'), dir: dirA(95), length: skull, radius: .45 * skull, joint: 'ball', rel: { flex: sym(25), side: sym(15), twist: sym(twist) }, source: PROV, provisional: true });
  B.add({ id: 'snout', parent: 'skull', role: 'snout', head: B.at('skull'), dir: dirA(98), length: beak, radius: .2 * skull, joint: 'fixed', end: true, source: 'rule: upper beak is fixed (nose)', provisional: false });
  B.add({ id: 'jaw', parent: 'skull', role: 'jaw', head: B.at('C1'), dir: dirA(98), length: skull * .9 + beak, radius: .15 * skull, joint: 'hinge', end: true, rel: { flex: { min: 0, max: 30 } }, source: PROV, provisional: true });
  const rotY = (v: Vec, a: number): Vec => { const c = Math.cos(a * Math.PI / 180), s = Math.sin(a * Math.PI / 180); return norm([c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]]); };
  for (const [s, side] of [['L', 1], ['R', -1]] as const) {
    // Folded wing at rest: humerus back, forearm forward (elbow interior 31°), hand back (wrist interior 52°).
    const [hu, fo, ha] = p.wing.map(r => r * L);
    const hDir: Vec = norm([side * .25, 0, 1]); // folds in the horizontal plane beside the body
    B.add({ id: `humerus.${s}`, parent: 'thorax', role: 'wing', head: B.at('thorax', .9), dir: hDir, length: hu, radius: .04 * body, joint: 'ball', rel: { flex: sym(80), side: sym(90), twist: sym(45) }, source: PROV, provisional: true });
    const fDir = rotY(hDir, side * (180 - BIRD_WING.elbow.min));
    B.add({ id: `forearm.${s}`, parent: `humerus.${s}`, role: 'wing', head: B.at(`humerus.${s}`), dir: fDir, length: fo, radius: .03 * body, joint: 'hinge', interior: BIRD_WING.elbow, source: SRC_WING, provisional: true });
    B.add({ id: `hand.${s}`, parent: `forearm.${s}`, role: 'wing', head: B.at(`forearm.${s}`), dir: rotY(fDir, -side * (180 - BIRD_WING.wrist.min)), length: ha, radius: .02 * body, joint: 'hinge', end: true,
      interior: BIRD_WING.wrist, coupledTo: { bone: `forearm.${s}`, from: BIRD_WING.elbow, to: BIRD_WING.wrist }, source: SRC_WING + '; elbow–wrist coupling', provisional: true });
    B.add({ id: `acetabulum.${s}`, parent: 'synsacrum', role: 'girdle', head: P0, dir: [side * lateral, 0, 0], length: lateral, radius: .03 * body, joint: 'fixed', source: 'body plan: hip socket', provisional: false });
    let parent = `acetabulum.${s}`;
    (['femur', 'tibiotarsus', 'tarsometatarsus'] as const).forEach((n, i) => {
      B.add({ id: `${n}.${s}`, parent, role: 'limb', head: B.at(parent), dir: dirA(legAngles[i]), length: [fem, tib, tmt][i], radius: (.035 - .008 * i) * body,
        joint: i === 0 ? 'ball' : 'hinge', interior: i === 0 ? { min: 30, max: 180 } : i === 1 ? { min: 30, max: 170 } : { min: 20, max: 185 },
        rel: i === 0 ? { side: sym(20), twist: sym(15) } : undefined, source: PROV, provisional: true });
      parent = `${n}.${s}`;
    });
    TOE_LAYOUT[p.toes].forEach((yaw, t) => {
      const backward = Math.abs(yaw) > 90, d = rotY(dirA(90), side * yaw);
      B.add({ id: `toe${t + 1}.${s}`, parent, role: 'digit', head: B.at(parent), dir: d, length: toe * (backward ? .6 : 1), radius: .01 * body, joint: 'hinge', end: true, interior: { min: 10, max: 200 }, source: 'Bird anatomy: toe arrangement ' + p.toes, provisional: false });
    });
  }
  const cIds = Array.from({ length: p.caudals }, (_, i) => `Ca${i + 1}`);
  B.chain('synsacrum', B.at('synsacrum'), cIds, 'tail', cIds.map(() => dirA(-95)), cIds.map(() => body * .05), .03 * body, () => ({ rel: { flex: sym(15), side: sym(15), twist: sym(5) } }), PROV, true);
  B.add({ id: 'pygostyle', parent: cIds.length ? cIds[cIds.length - 1] : 'synsacrum', role: 'tail', head: B.at(cIds.length ? cIds[cIds.length - 1] : 'synsacrum'), dir: dirA(-100), length: body * .08, radius: .03 * body, joint: 'ball', end: true,
    rel: { flex: sym(30), side: sym(20), twist: sym(5) }, source: 'Bird anatomy: pygostyle (fused tail tip)', provisional: false });
  return { species, plan: 'bird', archetype: p.archetype, bones: B.bones };
}

// ---------------------------------------------------------------- rules
export interface RuleFailure { rule: string; bone?: string; detail: string }
const EPS = 1e-6;
/** Checks every global rule. An empty list means the skeleton is valid. */
export function validateSkeleton(s: Skeleton): RuleFailure[] {
  const f: RuleFailure[] = [], by = new Map(s.bones.map(b => [b.id, b]));
  const children = (id: string) => s.bones.filter(b => b.parent === id);
  const fail = (rule: string, detail: string, bone?: string) => f.push({ rule, detail, bone });
  // R1 one root; R2 everything connected in one tree.
  const roots = s.bones.filter(b => b.parent === null);
  if (roots.length !== 1 || roots[0].joint !== 'root') fail('R1 single root', `${roots.length} roots`);
  if (by.size !== s.bones.length) fail('R2 connected tree', 'duplicate bone ids');
  for (const b of s.bones) {
    if (b.parent !== null && !by.has(b.parent)) fail('R2 connected tree', `missing parent ${b.parent}`, b.id);
    let seen = 0, p: Bone | undefined = b; while (p?.parent && seen++ < s.bones.length) p = by.get(p.parent);
    if (seen >= s.bones.length) fail('R2 connected tree', 'cycle', b.id);
    if (s.bones.length < 2 || (b.parent === null && children(b.id).length === 0)) fail('R2 connected tree', 'bone connects to no other bone', b.id);
    // R3 the child's joint lies on its parent's segment.
    const parent = b.parent ? by.get(b.parent) : undefined;
    if (parent) {
      const ab = sub(parent.tail, parent.head), t = Math.max(0, Math.min(1, (ab[0] * (b.head[0] - parent.head[0]) + ab[1] * (b.head[1] - parent.head[1]) + ab[2] * (b.head[2] - parent.head[2])) / (len(ab) ** 2 || 1)));
      if (len(sub(b.head, lerp(parent.head, parent.tail, t))) > 1e-4) fail('R3 joint on parent', 'joint is detached from parent', b.id);
    }
    // R4 end pieces are terminal, and terminals are end pieces.
    if (b.end && children(b.id).length) fail('R4 end pieces', 'end piece has children', b.id);
    if (!b.end && b.parent !== null && children(b.id).length === 0) fail('R4 end pieces', 'terminal bone not marked as an end piece', b.id);
    // R5 joint types carry the right number of limits.
    const axes = (b.interior ? 1 : 0) + Object.keys(b.rel ?? {}).length;
    if (b.joint === 'fixed' && axes) fail('R5 joint types', 'fixed joint has a range', b.id);
    if (b.joint === 'hinge' && axes !== 1) fail('R5 joint types', `hinge has ${axes} axes`, b.id);
    if (b.joint === 'ball' && axes < 2) fail('R5 joint types', 'ball joint needs at least two limited axes', b.id);
    // R6 rest pose is inside every limit; ranges are ordered and finite.
    for (const r of [b.interior, ...Object.values(b.rel ?? {})]) if (r && !(Number.isFinite(r.min) && Number.isFinite(r.max) && r.min <= r.max)) fail('R6 limits', 'bad range', b.id);
    for (const r of Object.values(b.rel ?? {})) if (r && (r.min > EPS || r.max < -EPS)) fail('R6 limits', 'rest pose outside range', b.id);
    if (b.interior && parent && parent.joint !== 'root' && parent.role !== 'girdle') {
      const a = interiorAngle(parent, b);
      if (a < b.interior.min - .5 || a > b.interior.max + .5) fail('R6 limits', `rest interior ${a.toFixed(1)}° outside ${b.interior.min}–${b.interior.max}`, b.id);
    }
    // R11 sizes.
    if (!(len(sub(b.tail, b.head)) > 0 && b.radius > 0)) fail('R11 sizes', 'zero length or radius', b.id);
    // R12 every value has a source.
    if (!b.source) fail('R12 sources', 'missing source', b.id);
  }
  // R7 bilateral symmetry: every .L has a mirrored .R.
  for (const b of s.bones.filter(b => b.id.endsWith('.L'))) {
    const r = by.get(b.id.slice(0, -2) + '.R');
    if (!r) { fail('R7 symmetry', 'missing mirror', b.id); continue; }
    const m = (v: Vec): Vec => [-v[0], v[1], v[2]];
    if (len(sub(m(b.head), r.head)) > EPS || len(sub(m(b.tail), r.tail)) > EPS) fail('R7 symmetry', 'mirror does not match', b.id);
  }
  // R8 head: one skull; snout fixed end piece on the skull; jaw hinged at the rear skull base (the skull's start, where it meets the neck), closed at rest, opens downward.
  const skulls = s.bones.filter(b => b.role === 'skull'), snout = s.bones.find(b => b.role === 'snout'), jaw = s.bones.find(b => b.role === 'jaw');
  if (skulls.length !== 1) fail('R8 head', `${skulls.length} skulls`);
  if (!snout || snout.parent !== skulls[0]?.id || snout.joint !== 'fixed' || !snout.end) fail('R8 head', 'snout must be a fixed end piece on the skull');
  if (!jaw || !snout || len(sub(jaw.head, skulls[0].head)) > EPS || jaw.joint !== 'hinge' || !jaw.end || jaw.rel?.flex?.min !== 0 || !(jaw.rel.flex.max > 0))
    fail('R8 head', 'jaw must hinge at the rear skull base, closed against the upper jaw at 0, opening downward');
  // R9 the head joint is limited.
  const sk = skulls[0];
  if (sk && !(sk.rel?.flex && sk.rel.side && sk.rel.twist)) fail('R9 head limits', 'skull joint must limit pitch, yaw and roll');
  // R10 neck counts.
  const neck = s.bones.filter(b => b.role === 'neck').length;
  if (s.plan === 'mammal' && neck !== MAMMAL_CERVICAL) fail('R10 neck', `mammal has ${neck} cervical vertebrae`);
  if (s.plan === 'bird' && (neck < BIRD_NECK.min || neck > BIRD_NECK.max)) fail('R10 neck', `bird has ${neck} cervical vertebrae`);
  return f;
}

/** Game rule: consecutive vertebrae may be merged into one bone for distant/cheap rendering; ranges add up. */
export function mergedRange(ranges: Range[]): Range { return ranges.reduce((a, r) => ({ min: a.min + r.min, max: a.max + r.max }), { min: 0, max: 0 }); }
