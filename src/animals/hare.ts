/**
 * Snowshoe hares (Grok Bot): the render adapter over the headless sim (core/sim, T-0036), with the procedural rig (T-0009).
 * The hares' brains run headless in core/sim (template senses, shared vigilance, evasion, diet); this file spawns/despawns
 * them around the player, writes the embodied wolf into the sim, and reads positions/states back.
 * Body (T-0009 / T-0028, ported from grok/rabbit-clover): the procedural furred mesh (HARE_SKIN on core/rigBody + render/rigSkin)
 * posed by the bounding rig (animals/locomotion/bounding: half-bound / lagomorph gallop, planted feet, sit-up and graze-crouch).
 * LOD (core/interest, PROJECT-RULES rule 8): only hares in the near tier run the limb rig (poseHare); the embodied hare and the
 * HARE.foreLockNearest nearest also run the fore-stance lock (foreLockPick). Farther rendered hares are placed without limb IK;
 * hares outside the despawn radius exist only as sim data.
 */
import * as THREE from 'three';
import { heightAt, WORLD_SEED } from '../core/world';
import { stream, range } from '../proc/rng';
import { LEVEL } from '../core/tuning';
import { f, scope } from '../proc/trace';
import type { SnapshotSource } from '../core/snapshot';
import { createAnimal, createWorld, removeAnimal, takeEvents, tick, type SimAnimal, type SimState } from '../core/sim';
import { playerSpeed } from '../core/playerTuning';
import type { WolfMode } from '../core/wolfModes';
import { HARE_GAIT } from '../core/needs/species';
import { createBounding, limbPoints, poseRequestFor, GIRDLE, RUN_POSE_LEVEL, type BoundController, type BoundFrame, type HostPose } from './locomotion/bounding';
import { LEPORID_LIMITS } from './locomotion/ik';
import { skeletonOf, type BodyPlan } from './locomotion/bodyPlan';
import { createRigSkin, setCoatDay, coatState, type RigLeg } from '../render/rigSkin';
import { rigTubes, type CoatPalette, type RigBind, type SkinSpec } from '../core/rigBody';
import { dayAt } from '../core/timeOfDay';
import { worldSec } from '../core/worldClock';
import { INTEREST, tierAt } from '../core/interest';

export const HARE = {
  count: 5, spawnMin: 18, spawnMax: 45, despawn: 70, respawnSeconds: [25, 45] as [number, number],
  // T-0036: notice/bolt come from the template senses + flight distance, flight from behaviour.evasion (core/needs/diet),
  // catch radii and safe distance from SYSTEM_PROPERTIES.hunt, the meal from diet.foods.hare.
  freezeSeconds: [.6, 1.6] as [number, number], stamina: 40,
  /** T-0009 run 10: rendered hares (besides an embodied one) that run the fore-stance lock, nearest the interest centre */ foreLockNearest: 3,
};
export type HareState = 'nibble' | 'hop' | 'freeze' | 'flee';
/** The rig's action words (T-0009 poses: graze crouch, scan, sit-up alert, flight, rest, hide). */
export type HareAction = 'feed' | 'step' | 'approach' | 'seek' | 'scan' | 'rest' | 'alert' | 'flee' | 'pause' | 'hide' | 'held' | 'tame';
/** What the rig reads from a hare each frame: the sim animal's position, heading, speed and its state as a rig action. */
export interface HareBody { x: number; z: number; heading: number; speed: number; action: HareAction }
/** Sim state -> rig action. freeze is the noticed-the-wolf moment: the sit-up alert on the haunches (run 7, Matthew 18:23 PT). */
export const SIM_ACTION: Record<SimState, HareAction> = { graze: 'feed', eat: 'feed', drink: 'feed', move: 'approach', freeze: 'alert', flee: 'flee', rest: 'rest', stalk: 'approach', chase: 'approach' };
export const hareBody = (a: Pick<SimAnimal, 'x' | 'z' | 'heading' | 'speed' | 'state'>): HareBody => ({ x: a.x, z: a.z, heading: a.heading, speed: a.speed, action: SIM_ACTION[a.state] ?? 'feed' });
const POSE_OF: Record<HareAction, HostPose> = { feed: 'head-down', step: 'head-down', approach: 'move', seek: 'move', scan: 'head-up', alert: 'head-up', pause: 'head-up', flee: 'run', rest: 'rest', hide: 'crouch', held: 'crouch', tame: 'rest' };
const poseOf = (a: Pick<HareBody, 'action'>): HostPose => POSE_OF[a.action];
export interface Hare { sim: SimAnimal; id: number; x: number; z: number; heading: number; state: HareState; timer: number; flee: number; zig: number; hopPhase: number; root: THREE.Group; rng: () => number;
  body: THREE.Object3D; head: THREE.Object3D; /** fore trunk bone (parent of the head) */ chest?: THREE.Object3D; legs: Leg[]; ears: THREE.Object3D[];
  /** the bounding rig: only while the hare is in the core/interest near tier */ rig?: BoundController; frame?: BoundFrame; /** the player plays this hare (always gets the fore lock) */ embodied?: boolean }
/** One limb: the rig segments as bones of the skinned mesh (render/rigSkin.ts RigLeg). */
type Leg = RigLeg;
export interface HareEvent { type: 'caught' | 'bolt' | 'hop'; x: number; z: number }
export interface WolfInfo { x: number; z: number; mode: string; moving: boolean; pouncing: boolean; daylight?: number; wind?: { x: number; z: number } }

/** Body plan in metres, snowshoe hare summer adult (ADW Lepus americanus / Colorado PW): total length 413-518 mm (tail 39-52),
 *  hind foot 117-147 mm, ear 62-70 mm notch to tip, 1.43-1.55 kg; summer coat grizzled rusty/greyish brown, white belly, ears
 *  brownish with black tips, hind feet densely furred (white-toed in the reference). The hip is the body pivot, so sitting up
 *  lifts the forelegs off the ground. Limb bones (run 3, nature-checked; was fore .12 / hind .125, ~1.6x short):
 *  - hindLeg .202 = femur 94 mm (L. americanus, Illinois State Museum Larson collection) + tibia 108 mm = femur x 1.13-1.19
 *    (L. europaeus tibia/femur: Volf 2023 Lynx 54:193, means 147.3/130.7 mm; Williams et al. 2007 J Anat 210:472 Table 4,
 *    137/115 mm) [scaled]; upperShare .47 = femur / (femur + tibia).
 *  - foreLeg .187 (run 8; was .181) = humerus 77 mm (femur x .80, Volf 2023 means 104.8/130.7) + radius 74.6 mm (humerus x
 *    .969, the snowshoe hare's own ratio: L. americanus adult female UWBM-21111, Burke Museum, humerus 72.36 / radius 70.12 mm,
 *    Idaho Virtual Zooarchaeology specimens.iri.isu.edu id 79 - one specimen, a small Pacific-Northwest hare, so only its ratio is
 *    used; was x .90 from Williams et al. 2007 J Anat 211:475 Table 4, 101.5/113, another species) + manus 35 mm [estimate:
 *    drawn to the reference] = 151.6 mm / (1 - .19); manus share .19.
 *  - hindFoot .132 (hock to toe tip, in ADW's 117-147 mm hind foot range); standing hip .13 with the knee bent to
 *    hindBend .5 of the leg and the shoulder at foreBend .6 of the fore leg (crouched resting posture) [estimate: drawn to the
 *    reference photos]. Trunk (hip to shoulder joint) .21 m and head .30 m ahead of the hip (nose to tail ~.47 m, in the
 *    413-518 mm total length) [estimate: drawn to the reference]; headZ is from the hip.
 *  - run 5 (grok-gait v3 contract): hindToes .056 = the toes (MTP to tip) of the .132 hind foot, scapula .063 = the shoulder
 *    blade in the fore chain (= .816 x humerus), both from Lepus brachyurus bone means (Exp Anim 30(2):113, 1981, Tables 1
 *    and 4-6; working in tools/bound-plans.ts SPLIT / BLADE). */
export const HARE_BODY = { hipY: .13, hipZ: .09, shoulderZ: -.12, foreLeg: .187, hindLeg: .202, hindFoot: .132, hindToes: .056, scapula: .063, girdleTop: .157, upperShare: .47, manus: .19, foreBend: .6, hindBend: .5, ear: .066, headZ: -.27, headY: .085 };
/**
 * T-0028 skin + fur spec (data for the shared core/rigBody.ts + render/rigSkin.ts; tasks/T-0028 number table). No mesh file:
 * every vertex comes from these rings around the rig's bind pose (hareBind). Model space = the hare root (feet y 0, forward -z).
 * - Dimensions: head-body 361-479 mm (ADW total 413-518 minus tail 39-52), modelled nose to rump ~.45 m (run 2 of T-0028: shorter trunk, head 3 cm back, rounder higher rump, thicker thigh and forearm, ears leaning back ~30 deg [estimate: refs/hare/ attempt 2-3 and winter attempt 1-2]); tail 45 mm; ear
 *   66 mm (HARE_BODY.ear); hind foot = the rig's .132 m; prints fore ~5 x 3 cm, hind 12 x 8 cm (NatureNorth); bare volume
 *   1.07-1.94 L = 1.43-1.55 kg at 740-1340 kg/m3 [estimate: band around water density]. Girths, head, legs [estimate: drawn to
 *   refs/hare/]. Leg r = [sagittal, lateral] half-widths at each drawn joint (fore: blade pivot, glenoid, elbow, wrist, toe;
 *   hind: hip, knee, hock, MTP, toe tip): muscular thigh, slim shank, broad furred snowshoe hind foot; slim forelimb.
 * - Pelt: the downy underfur 25.15 / 25.64 mm (Sheriff, Kuchel, Boutin & Humphries 2009, J Mammal 90:761) stands under the
 *   guard hairs and reads as a solid layer, so the skin is drawn ~25 mm out on the trunk, thinner on head and limbs.
 * - Coat detail (ADW): summer blackish mid-dorsal line (ring `saddle`, none in winter), ears brownish with black tips and
 *   white / creamy borders (ear `rim`); winter almost all white except black eyelids (`eyelid`) and blackened ear tips.
 *   Winter body rounder: the pelt x1.72 as a morph target of the summer skin + fur (run 12, grok: winter guard hair 43.19 mm over
 *   the 25.15 mm underfur the summer pelt is drawn to, Sheriff 2009; was x1.5 [estimate]; box P1: winter crouch 67.9 -> 74.9; hair density
 *   x2.28-2.48 in winter, Sheriff 2009); winter skin under the cards shaded .8 (the dense coat hides the dusky bases).
 * - Coats: summer grizzled rusty / greyish brown back, white belly, brownish ears with black tips (ADW), hind feet keep white
 *   patches (Hinterland Who's Who); winter white but the black ear tips. Shades [estimate: read from refs/hare/].
 * - Moult: Mills et al. 2013 PNAS 110(18):7360 (doi:10.1073/pnas.1222724110): initiation fixed by day length ~10 Oct (day 283)
 *   and ~10 Apr (day 100); autumn brown-to-white ~40 d; spring plastic 30-50 d, modelled at 40. Low parts turn first and stay
 *   white longest (spread .6 over .24 m) [estimate: Hinterland Who's Who].
 * - Fur: guard hair 31.67 mm (autumn coat) -> 43.19 mm (winter); hair density x2.28-2.48 in winter (Sheriff 2009), so summer
 *   shows .44 of the winter cards. 9000 cards, .009 m wide (finer grain than v1's 7000 x .013), within the 5-wolf fur budget (tasks/T-0028 draw-cost row).
 */
const T = (z: number, y: number, rx: number, ry: number, fur: number, o: Partial<SkinSpec['trunk'][number]> = {}) => ({ at: 'trunk' as const, z, y, rx, ry, fur, ...o });
const Hd = (z: number, y: number, rx: number, ry: number, fur: number, o: Partial<SkinSpec['trunk'][number]> = {}) => ({ at: 'head' as const, z, y, rx, ry, fur, ...o });
export const HARE_SKIN: SkinSpec = {
  name: 'hare',
  // round rump behind the hip, the haunch over the hip joints, tapering to a narrow chest between the forelegs
  trunk: [T(.088, .032, .008, .017, 1), T(.075, .036, .016, .038, 1), T(.05, .042, .021, .054, 1, { saddle: .2 }), T(0, .044, .022, .057, 1, { saddle: .3 }),
    // run 9 (grok, gathered-pose outline): the chest rings 1.5x deeper downward by their chest weight c (ry += .5 c ry, top kept)
    // and narrower (rx x 1 - .4 c), so the bare body stays inside the mass check (1.877 -> 1.914 L, limit 1.94; 1.5x deeper without
    // narrowing = 2.01 L fails it). Was T(-.07, .03, .019, .046), T(-.13, .002, .018, .039), T(-.185, -.002, .016, .034),
    // T(-.215, .02, .012, .019). The references' gather and crouch carry a deep chest (refs/hare/graze-alert-flight attempt2
    // panels 1 + 4, winter attempt2). REFERENCE-MATCHED [estimate]: grid ?chest= / ?chestw= vs lookscore v1.3
    // (C:\dev\rabbit-rec13\look\grid-run9.txt): summer gather 47.3 -> 50.5, crouch, push, stretch up; winter stretch 93.6 -> 87.0.
    T(-.07, .0254, .01748, .0506, 1, { saddle: .3, chest: .2 }), T(-.13, -.008725, .01404, .049725, 1, { saddle: .25, chest: .55 }), T(-.185, -.01645, .01056, .04845, 1, { saddle: .2, chest: .85 }), T(-.215, .0105, .0072, .0285, .95, { head: .2, saddle: .15, chest: 1 })],
  neck: [T(-.205, .02, .018, .023, .95, { chest: 1 }), Hd(.045, -.02, .016, .019, .85, { head: .6, chest: 1 }), Hd(.025, -.005, .015, .017, .8)],
  // rounded cranium, puffy buff cheeks, blunt muzzle, dark-brown bare nose leather (fur < .03 grows no cards)
  head: [Hd(.0336, .0022, .0246, .0269, .7), Hd(.009, .0045, .0302, .0325, .6, { accent: .25 }), Hd(-.0202, -.0022, .028, .0291, .5, { accent: .55 }),
    Hd(-.0403, -.0101, .0213, .0224, .4, { accent: .5 }), Hd(-.0538, -.0146, .0134, .0146, .3, { accent: .3, pale: .2 }), Hd(-.0605, -.0146, .0067, .0067, .02, { dark: .8 })],
  tail: [T(.06, .03, .014, .014, 1, { tail: .5 }), T(.085, .035, .016, .015, .7, { tail: 1, pale: .3 }), T(.1, .033, .01, .01, .6, { tail: 1, pale: .5 })],
  ear: { base: [.014, .02, .012], lean: .04, rings: [{ t: 0, rx: .009, ry: .007, fur: .5 }, { t: .25, rx: .016, ry: .0045, fur: .4, rim: .7 },
    { t: .6, rx: .017, ry: .004, fur: .35, dark: .1, rim: .7 }, { t: .85, rx: .013, ry: .0035, fur: .35, dark: .7, rim: .3 }, { t: 1, rx: .006, ry: .003, fur: .3, dark: 1 }] },
  fore: { r: [[.022, .021], [.015, .014], [.011, .011], [.008, .009], [.006, .011]], fur: [[0, .5], [3, .45]], pale: [[0, 0], [3.5, .45]] },
  hind: { r: [[.034, .024], [.022, .016], [.011, .012], [.008, .02], [.006, .017]], fur: [[0, .75], [1.5, .5], [2.5, .55]], pale: [[0, 0], [2, .3], [2.5, .75]] },
  pelt: { body: .025, head: .012, limb: .012, ear: .0015 },
  eye: [.0365, .011, -.014], eyeClear: .013, eyelid: { radius: .015, amount: .85 }, winterPelt: 1.72, cheek: { at: [.022, -.011, -.022], radius: .018, offset: [.003, -.002, 0] },
  summer: { back: [.4, .29, .16], belly: [.86, .84, .8], dark: [.07, .06, .055], accent: [.55, .45, .33], tip: [.1, .08, .06], tipAmount: .35 },
  winter: { back: [.9, .9, .88], belly: [.93, .93, .91], dark: [.06, .055, .05], accent: [.9, .89, .86], tip: [.96, .96, .95], tipAmount: 0, saddle: 0, rootShade: .8 },
  moult: { autumnStart: 283, autumnDays: 40, springStart: 100, springDays: 40, spread: .6, height: .24 },
  fur: { cards: 9000, winterLength: .04319, summerLength: .03167, width: .009, summerDensity: .44, lean: .3, tone: .3, rootShade: .55, bareShade: .75, seed: 911 },
};
/** The hare's tubes in one coat (pelt 0 = bare body for the mass check). */
export const hareTubes = (bind: RigBind, coat: CoatPalette = HARE_SKIN.summer, pelt = 1) => rigTubes(bind, HARE_SKIN, coat, pelt);
/** Every hare's coat from the world date (day of the year); returns the whole-coat whiteness. */
export const setHareDay = (dayOfYear: number) => setCoatDay(HARE_SKIN, dayOfYear);
export const hareCoatState = () => coatState(HARE_SKIN);
/** T-0028: the procedural furred mesh replaces the run 1-6 blob model; the same body / head / ears / legs handles, now bones
 *  of one skinned skin + fur, posed by poseHare from the rig. */
function model() {
  const m = createRigSkin(hareBind(), HARE_SKIN), head = m.head as THREE.Object3D;
  // run 12 (T-0009 eating): a small pale lower jaw / chin under the muzzle, hinged behind the cheek; closed it sits inside the
  // muzzle fur, open (CHEW.gape) the chin drops ~3.5 mm. Placed from the head rings z -.040 / -.054 [estimate: drawn to them].
  const jaw = new THREE.Group(); jaw.name = 'jaw'; jaw.position.set(0, CHEW.pivot[0], CHEW.pivot[1]);
  const chin = new THREE.Mesh(JAW_GEO, JAW_MAT); chin.name = 'chin'; chin.position.set(0, CHEW.chin[0] - CHEW.pivot[0], CHEW.chin[1] - CHEW.pivot[1]); chin.scale.set(...CHEW.r);
  jaw.add(chin); head.add(jaw);
  return { root: m.root, body: m.body as THREE.Object3D, chest: m.chest as THREE.Object3D, head, legs: m.legs, ears: m.ears as THREE.Object3D[] };
}
/** Run 12 (T-0009 eating). Chewing cadence: rabbits chew at ~4 Hz, independent of food (hay, pellets, carrot; Ravosa, Scott,
 *  Ross et al. 2015, "Chewed out", PeerJ 3:e1345, doi:10.7717/peerj.1345, PMC4636421: "averaging about 4 Hz", 60 fps video),
 *  so the jaw opens and the head bobs once per 1/4 s while feeding and through the head-up scans (subtle vigilance keeps
 *  chewing: Monclus & Rodel 2008, Ethology 114:287). Bob .035 rad pitch + 1.5 mm, gape .16 rad and the crop tug every 8 chews
 *  (a short nose-up pull, the clover torn off) [estimate: drawn so the motion reads at 6-8 m; no measured leporid amplitude found]. */
export const CHEW = { hz: 4, bob: .035, lift: .0015, gape: .16, tugEvery: 8, tug: .09, pivot: [-.026, -.018] as const, chin: [-.037, -.043] as const, r: [.0095, .0055, .014] as [number, number, number] };
const JAW_GEO = new THREE.SphereGeometry(1, 12, 8), JAW_MAT = new THREE.MeshStandardMaterial({ color: new THREE.Color(.84, .82, .78), roughness: 1 });
const chewState = new WeakMap<HareModel, { amp: number; pitch: number; y: number; jaw?: THREE.Object3D }>();
let bindCache: RigBind | undefined;
/** The bind pose: the rig standing still at the origin, heading 0 (forward -z); joints relative to the hip-joint midpoint. */
export function hareBind(): RigBind {
  if (bindCache) return bindCache;
  const rig = createBounding(HARE_SKELETON, HARE_GAIT, () => 0, { x: 0, z: 0, heading: 0 }, GIRDLE, HARE_RIG);
  let fr = rig.update(1 / 60, 0, 0, null); for (let i = 0; i < 120; i++) fr = rig.update(1 / 60, 0, 0, null);
  const hl = limbPoints(HARE_SKELETON, fr, 1)[0], hr = limbPoints(HARE_SKELETON, fr, 3)[0], ox = (hl.x + hr.x) / 2, oz = (hl.z + hr.z) / 2;
  const limbs = [0, 1, 2, 3].map(i => { const P = limbPoints(HARE_SKELETON, fr, i).map(p => [p.x - ox, p.y, p.z - oz] as [number, number, number]); return i % 2 ? P.slice(1) : P; });
  // run 7: the chest bone at the fore girdle tops (blade pivots), from the pivot
  const py = (hl.y + hr.y) / 2, chest: [number, number, number] = [0, (limbs[0][0][1] + limbs[2][0][1]) / 2 - py, (limbs[0][0][2] + limbs[2][0][2]) / 2];
  return bindCache = { pivot: [0, py, 0], head: [0, HARE_BODY.headY, HARE_BODY.headZ], ear: HARE_BODY.ear, limbs, chest };
}
/** Pose targets: body pitch about the hip (rad, + = front up), body lift (m), head pitch (+ = nose up), head drop (m), ears
 *  (rad, + = laid back), foreleg and hind leg angles (rad, + = foot forward). Read from the reference sheet
 *  (refs/hare/graze-alert-flight attempt 2): grazing crouch = hunched, chin at the clover, ears back; scan = head up from the
 *  crouch; alert / pause = upright sit-up on the haunches, fore paws lifted, ears erect (run 7, Matthew 18:23 PT, reference panel 3;
 *  run 4-6 used a half sit-up on all fours); rest/freeze = tucked, ears flat [estimate]. */
export const POSES: Record<string, number[]> = {
  'head-down': [-.1, -.04, -.85, -.08, 1.5, .1, .45], // run 7: head -.55 -> -.85 (nose to the clover, refs attempt2 panel 1); run 11: ears .95 -> 1.5 (laid flat along the neck), drop -.075 -> -.08 (fur at the ground, test 'head pose (run 11)') - grid C:\dev\rabbit-rec15\grid-run11.txt W10-W12: winter crouch 64.4 -> 68.1, summer 51.3 -> 54.3; lower heads scored higher only with the muzzle in the ground (W5-W8, rejected), REFERENCE-MATCHED
  scan: [.3, 0, -.35, 0, -.05, -.15, .5],
  sit: [1.15, 0, -.8, -.025, -.15, -.7, .55, .4], // run 7: upright sit-up (body .95 from the rig's 'sit-up'), head turned back level, nose a little up; run 12: back hunched .4 rad (23 deg of lumbar flexion, inside the rabbit's passive 73-122 deg over 7 +- 1 joints, Grauer 2000) - box grid S3-S6 (C:\dev\rabbit-rec16\grid-run12.txt): sit 55.1 / 81.6 -> 61.6 / 92.9, end-on 65.5 -> 64.4 (noise)
  rest: [-.04, -.035, -.15, 0, .85, .25, .55],
  crouch: [-.06, -.045, -.1, 0, 1.15, .3, .6],
  move: [0, 0, -.1, 0, .5, 0, 0],
  run: [0, 0, -.55, -.06, .9, 0, 0], // run 11: head .05 -> -.55 (nose down), drop 0 -> -.06: the references' gathered hare carries its head low in front of the chest (grid R1-R13, gather 48 / 52 -> 64 / 62), REFERENCE-MATCHED
};
type PoseKey = 'head-down' | 'scan' | 'sit' | 'rest' | 'crouch' | 'move' | 'run';
const poseKey = (a: Pick<HareBody, 'action'>): PoseKey => a.action === 'alert' || a.action === 'pause' ? 'sit' : a.action === 'scan' ? 'scan' : poseOf(a) === 'head-up' ? 'scan' : poseOf(a) as PoseKey;

export type HareModel = Pick<Hare, 'root' | 'body' | 'chest' | 'head' | 'legs' | 'ears' | 'hopPhase' | 'id' | 'rig' | 'frame'>;
export const createHareModel = model;
/** The hare's limb skeleton for the bounding rig, from HARE_BODY (track half-widths [estimate: drawn to the reference]); run 5:
 *  split hind foot + shoulder blade, and the leporid joint ranges (ik.ts LEPORID_LIMITS: Hall et al. 2022, rabbit knee from
 *  Hildebrand, Holmberg & Shrive 2003). */
export const HARE_PLAN: BodyPlan = { hip: HARE_BODY.hipY, hipZ: HARE_BODY.hipZ, shoulderZ: HARE_BODY.shoulderZ, track: { fore: .03, hind: .045 }, foreLeg: HARE_BODY.foreLeg,
  hindLeg: HARE_BODY.hindLeg, hindFoot: HARE_BODY.hindFoot, hindToes: HARE_BODY.hindToes, scapula: HARE_BODY.scapula, upperShare: HARE_BODY.upperShare, manus: HARE_BODY.manus,
  foreBend: HARE_BODY.foreBend, hindBend: HARE_BODY.hindBend, limits: LEPORID_LIMITS, girdleTop: HARE_BODY.girdleTop };
/* girdleTop (grok): run 10 .17 [estimate from the 20-22 cm shoulder height, Prescott & Richard 2004 via fr.wikipedia, secondary];
 * run 11 .157: with Gait Builder's late-swing fore reach (bounding.ts FORE_REACH) the forearm held 39.0 / 37.8 / 38.5 deg below the
 * horizontal at 5 / 8.5 / 11.6 m/s at .17, past the 11-36 deg fore touchdown range of small therians (Schmidt 2008, JEB 211:3775,
 * Table 4); .157 holds 34.7 / 33.3 / 35.9 deg while the standing elbow stays 11 mm below the glenoid at 69 deg and the graze folds
 * fully (poseReach 1); .155 / .15 lose the graze fold (.97 / .88). Box v1.3: shape 72.4 / 81.5 vs 72.7 / 81.1 at .17 (noise),
 * end-on 66.0 vs 67.7. C:\dev\rabbit-rec15\grid-run11.txt. */
/** Rig options (run 5): the level-trunk running posture (needs the blade's fore reach) and turning in place by re-planting. */
export const HARE_RIG = { pose: RUN_POSE_LEVEL, turnInPlace: true };
const HARE_SKELETON = skeletonOf(HARE_PLAN);
/** Share of the rig's spine flex (rad) the chest bone turns by (front down when gathered, up when extended). Run 8: 1.0, the
 *  largest share that keeps the chest-to-rump bend inside the SOURCED spine range: the rig's flex is the pelvic movement the
 *  lumbar spine makes, capped at +-.366 rad (GIRDLE.spineMax: pika leading-limb stance excursion 109 -> 151 deg, Schilling &
 *  Hackert 2006 JEB 209:3925), and the skin's rump (body bone) does not turn with it, so the chest's turn relative to the body
 *  IS the shown lumbar bend: measured .335 / .339 rad at 1.0 (1.1: .370 / .375, over the cap). Both sides are inside the rabbit's
 *  passive lumbar range too (Grauer, Erulkar, Patel & Panjabi 2000, Eur Spine J, doi:10.1007/s005860000141, NZW L4-L7 in vitro: 12.1 / 12.4 / 15.2 deg flexion and
 *  5.9 / 5.6 / 6.1 deg extension per joint, over the 7 +- 1 bending presacral joints of Schilling & Hackert). Extension
 *  takes .44 of it: the rabbit's lumbar joints extend 17.6 deg for every 39.7 deg they flex (Grauer, same L4-L7 sums). Was .6 both ways [estimate]. */
// Run 12 (grok, T-0009, Matthew: "sourced spine flexion (the Grauer 2000 range)"): flex 1 -> 1.6, so the gathered chest turns up to
// .585 rad (33.5 deg) against the rump: beyond the pika LOCOMOTOR excursion cap above (.366) but well inside the rabbit's passive
// lumbar flexion (12.1-15.2 deg x 7 +- 1 joints = 73-122 deg, Grauer 2000). Box grid F1/F2/F3 (C:\dev\rabbit-rec16\grid-run12.txt):
// gather 63.9 / 61.9 -> 65.7 / 65.8 at 1.6 (2.0: 66.3 / 67.2, diminishing), end-on gather 69.0 -> 69.1. FLAGGED: past the locomotor cap.
export const SPINE_BEND = { flex: 1.6, extend: .44 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
const hunch = new WeakMap<HareModel, number>();
/** Pose one hare model from its headless sim animal (hareBody) for this frame (shared by the game host and tools/hare-strip). The legs, body
 *  height and pitch come from the bounding rig (planted feet, half-bound / lagomorph gallop, sit-up and graze-crouch pose
 *  requests); head and ears from the reference poses. `ground` is the terrain height function (or a flat height). */
export function poseHare(h: HareModel, a: HareBody, dt: number, time: number, ground: number | ((x: number, z: number) => number)) {
  const groundAt = typeof ground === 'number' ? () => ground : ground, k = 1 - Math.exp(-dt * 10);
  if (!h.rig) h.rig = createBounding(HARE_SKELETON, HARE_GAIT, groundAt, { x: a.x, z: a.z, heading: a.heading }, GIRDLE, HARE_RIG);
  // the sim animal is authoritative: the rig integrates the same speed and heading; a jump (spawn, rewind, blocked step) re-places it
  if (h.frame && Math.hypot(h.frame.x - a.x, h.frame.z - a.z) > .5) h.rig.place(a.x, a.z, a.heading);
  // run 7 (Matthew, 18:23 PT): the alert and the flight pause sit UP on the haunches, fore paws lifted (refs/hare/graze-alert-flight
  // attempt2 panel 3), not run 4's half sit-up on all fours
  const fr = h.frame = h.rig.update(Math.max(1e-4, dt), a.speed, a.heading, a.action === 'alert' || a.action === 'pause' ? { kind: 'sit-up' } : poseRequestFor(poseOf(a), a.action));
  const ox = a.x - fr.x, oz = a.z - fr.z; // small drift between the two integrations, drawn away
  // root at the hip joints (mid of the two hind chain tops), turned to the heading; the body pitches about it
  const hl = limbPoints(HARE_SKELETON, fr, 1)[0], hr = limbPoints(HARE_SKELETON, fr, 3)[0];
  h.root.position.set((hl.x + hr.x) / 2 + ox, 0, (hl.z + hr.z) / 2 + oz); h.root.rotation.y = fr.heading; h.root.updateMatrixWorld(); // the rig's heading (turnInPlace yaws it at TURN.rate)
  h.body.position.set(0, (hl.y + hr.y) / 2, 0); h.body.rotation.x = fr.tilt.pitch;
  const inv = h.root.matrixWorld.clone().invert();
  // run 7: the chest bone sits on the rig's fore girdle tops (the trunk span changes .13-.23 m through the bound) and turns by
  // the rig's spine flex (front down when flexed / gathered) on top of the hip-to-shoulder line, so the skin gathers and stretches
  const bind = hareBind(), c0 = bind.chest ?? [0, 0, 0];
  if (h.chest && bind.chest) {
    const fl = limbPoints(HARE_SKELETON, fr, 0)[0], frt = limbPoints(HARE_SKELETON, fr, 2)[0];
    h.body.updateMatrixWorld(); _a.set((fl.x + frt.x) / 2 + ox, (fl.y + frt.y) / 2, (fl.z + frt.z) / 2 + oz); h.body.worldToLocal(_a);
    const ang = (y: number, z: number) => Math.atan2(y, -z), want = ang(_a.y, _a.z) - ang(c0[1], c0[2]);
    // run 12: a standing pose may hunch the back (POSES [7], rad of lumbar flexion, inside the Grauer 2000 passive range), smoothed
    const hw = (POSES[a.speed > .05 ? (a.speed > 3 ? 'run' : 'move') : poseKey(a)][7] ?? 0), hs = (hunch.get(h) ?? 0) + (hw - (hunch.get(h) ?? 0)) * k; hunch.set(h, hs);
    h.chest.position.copy(_a); h.chest.rotation.x = want - (fr.spineFlex > 0 ? SPINE_BEND.flex : SPINE_BEND.extend) * fr.spineFlex - hs;
  }
  h.legs.forEach((leg, i) => {
    const P = limbPoints(HARE_SKELETON, fr, i), o = leg.from; // [top (blade pivot), girdle joint, knee/elbow, ankle/wrist, toe/MTP(, toe tip)]
    leg.segs.forEach((bone, s) => { // each segment bone sits on its upper joint, turned from its bind direction onto the rig's
      _a.set(P[s + o].x + ox, P[s + o].y, P[s + o].z + oz).applyMatrix4(inv); _b.set(P[s + o + 1].x + ox, P[s + o + 1].y, P[s + o + 1].z + oz).applyMatrix4(inv);
      _d.subVectors(_b, _a); if (_d.lengthSq() < 1e-12) return;
      bone.position.copy(_a); bone.quaternion.setFromUnitVectors(leg.dirs[s], _d.normalize());
    });
  });
  // head and ears: reference poses (sit-up for the alert and the flight pause, scan, graze, rest), smoothed
  const moving = a.speed > .05, pose = POSES[moving ? (a.speed > 3 ? 'run' : 'move') : poseKey(a)];
  // run 12: chewing (CHEW) rides on top of the smoothed pose, so the 4 Hz motion is not filtered away; was a 1.4 Hz nibble [estimate]
  let cw = chewState.get(h); if (!cw) chewState.set(h, cw = { amp: 0, pitch: 0, y: 0, jaw: h.head.getObjectByName('jaw') });
  const basePitch = h.head.rotation.x - cw.pitch, baseY = h.head.position.y - cw.y;
  cw.amp += ((!moving && (a.action === 'feed' || a.action === 'scan') ? 1 : 0) - cw.amp) * k;
  const ph = time * CHEW.hz * Math.PI * 2 + h.id * 1.7, s = Math.sin(ph), cyc = Math.floor(ph / (Math.PI * 2));
  const tug = a.action === 'feed' && (cyc + h.id) % CHEW.tugEvery === 0 ? Math.max(0, s) * CHEW.tug : 0;
  cw.pitch = (s * CHEW.bob + tug) * cw.amp; cw.y = Math.max(0, s) * CHEW.lift * cw.amp;
  h.head.rotation.x = basePitch + (pose[2] - basePitch) * k + cw.pitch; h.head.position.y = baseY + (HARE_BODY.headY - (h.chest ? c0[1] : 0) + pose[3] - baseY) * k + cw.y;
  if (cw.jaw) cw.jaw.rotation.x = -Math.max(0, -s) * CHEW.gape * cw.amp;
  for (const e of h.ears) e.rotation.x += (pose[4] - e.rotation.x) * k;
}

/** T-0009 run 10 (grok): which rendered hares run the fore-stance lock (bounding.ts FORE_LOCK: smooth fore stance, ~1 ms per hare
 *  per frame on omen): an embodied hare always, plus the `n` nearest the interest centre (core/interest: the player, or the free
 *  camera in photo mode), the embodied one not taking a slot. Hysteresis: the hare ranked n + 1 keeps what it had, so two hares at
 *  about the same distance don't toggle every frame (at most n + 1 locked, plus an embodied one). The rest keep the default scan;
 *  headless brains (core/sim, core/needs) have no limb rig at all, and rendered hares outside the core/interest near tier skip it. */
export function foreLockPick(hs: readonly { x: number; z: number; embodied?: boolean; locked: boolean }[], cx: number, cz: number, n = HARE.foreLockNearest): boolean[] {
  const out = hs.map(h => !!h.embodied);
  hs.map((h, i) => ({ i, d: Math.hypot(h.x - cx, h.z - cz) })).filter(e => !hs[e.i].embodied).sort((a, b) => a.d - b.d || a.i - b.i)
    .forEach((e, r) => { out[e.i] = r < n || (r === n && hs[e.i].locked); });
  return out;
}

/** Rig cost counters (dev / perf evidence): hares posed with the rig this frame, with the fore lock, and the ms they took. */
export const HARE_RIG_STATS = { rigged: 0, locked: 0, ms: 0 };

export function createHares(scene: THREE.Scene) {
  // T-0036: the hares' brains run headless in core/sim (template senses, shared vigilance, evasion, diet); this is the thin
  // render adapter: spawn/despawn around the player, write the embodied wolf into the sim, read positions/states back.
  const world = createWorld({ seed: WORLD_SEED, passable: (x, z) => heightAt(x, z) > LEVEL.hareWater });
  const wolfAnimal = createAnimal(world, 'wolf', { x: 0, z: 0 }, { controlled: true });
  const hares: Hare[] = []; const pending: number[] = [];
  const spawnRng = stream(WORLD_SEED, 'hares-v1'); // seeded placement
  function spawn(px: number, pz: number) {
    for (let tries = 0; tries < 12; tries++) {
      const a = spawnRng() * Math.PI * 2, d = range(spawnRng, [HARE.spawnMin, HARE.spawnMax]), x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
      if (heightAt(x, z) < LEVEL.shore) continue;
      const m = model(); scene.add(m.root);
      const sim = createAnimal(world, 'hare', { x, z });
      m.root.userData.inspect = { type: 'hare', key: `hare:${sim.id}` };
      m.root.position.set(x, heightAt(x, z), z); m.root.rotation.y = sim.heading;
      hares.push({ id: sim.id, sim, x, z, heading: sim.heading, state: 'nibble', timer: sim.timer, flee: 0, zig: 0, hopPhase: 0, rng: sim.rng, ...m });
      return;
    }
  }
  function remove(h: Hare, fromSim = true) {
    // the coat geometry and materials are shared between hares (render/rigSkin userData.shared): dispose only per-hare ones
    scene.remove(h.root); h.root.traverse(o => { if (o instanceof THREE.Mesh) { if (!o.geometry.userData.shared && o.geometry !== JAW_GEO) o.geometry.dispose(); const mt = o.material as THREE.Material; if (!mt.userData.shared && mt !== JAW_MAT) mt.dispose(); } });
    hares.splice(hares.indexOf(h), 1); if (fromSim) removeAnimal(world, h.sim);
  }
  const STATE: Record<string, HareState> = { graze: 'nibble', move: 'hop', freeze: 'freeze', flee: 'flee' };
  let time = 0;
  function update(dt: number, wolf: WolfInfo): HareEvent[] {
    const events: HareEvent[] = []; time += dt;
    setHareDay(dayAt(worldSec())); // T-0028: summer / moult / winter coat from the world date (no-op unless it changed)
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i] <= time) { pending.splice(i, 1); spawn(wolf.x, wolf.z); }
    for (let k = 0; k < HARE.count && hares.length + pending.length < HARE.count; k++) spawn(wolf.x, wolf.z); // bounded: spawn() can fail (no dry land in range)
    while (hares.length > HARE.count) remove(hares[hares.length - 1]); // count lowered in settings
    for (const h of [...hares]) if (Math.hypot(h.sim.x - wolf.x, h.sim.z - wolf.z) > HARE.despawn) remove(h);
    // the embodied wolf: the adapter writes its pose/gait; the sim senses it and tests captures
    Object.assign(wolfAnimal, { x: wolf.x, z: wolf.z, mode: wolf.mode, speed: wolf.moving ? playerSpeed(wolf.mode as WolfMode) : 0, crouched: wolf.mode.includes('stealth'), pouncing: wolf.pouncing });
    world.daylight = () => wolf.daylight ?? 1; world.wind = () => wolf.wind ?? { x: 0, z: 0 };
    tick(world, dt);
    for (const ev of takeEvents(world)) {
      const h = hares.find(x => x.id === ev.id); if (!h) continue;
      if (ev.type === 'caught') { events.push({ type: 'caught', x: ev.x, z: ev.z }); remove(h, false); pending.push(time + range(spawnRng, HARE.respawnSeconds)); }
      else if (ev.type === 'bolt') events.push({ type: 'bolt', x: ev.x, z: ev.z });
    }
    // T-0009 LOD: the limb rig only in the core/interest near tier; the fore lock for the embodied hare + the nearest few
    const near = hares.map(h => tierAt(h.sim.x, h.sim.z) === 'near');
    hares.forEach((h, i) => { if (!near[i] && h.rig) { h.rig = undefined; h.frame = undefined; } }); // leaving the near tier drops the rig
    const rigged = hares.filter((_, i) => near[i]);
    const lock = foreLockPick(rigged.map(h => ({ x: h.sim.x, z: h.sim.z, embodied: h.embodied, locked: !!h.rig?.foreLock })), INTEREST.x, INTEREST.z);
    rigged.forEach((h, i) => h.rig?.setForeLock(lock[i])); // a rig made this frame (poseHare) starts off and is picked next frame
    const t0 = performance.now(); HARE_RIG_STATS.rigged = 0; HARE_RIG_STATS.locked = 0;
    hares.forEach((h, i) => {
      const a = h.sim, prev = h.state; h.x = a.x; h.z = a.z; h.heading = a.heading; h.state = STATE[a.state] ?? 'nibble';
      if (h.state === 'hop' && prev !== 'hop' && Math.hypot(a.x - wolf.x, a.z - wolf.z) < 30) events.push({ type: 'hop', x: a.x, z: a.z });
      scope(`hare:${h.id}`); f('hare', 'state', h.state); f('hare', 'perceived', a.level); f('hare', 'knows', a.knowsAt ?? -1); f('hare', 'linked', a.linked); f('hare', 'speed', a.speed); f('hare', 'rig', near[i] ? 1 : 0); scope('');
      const speed = a.speed; h.hopPhase += speed > 0 ? dt * (speed > 3 ? 7 : 4) : 0;
      if (near[i]) { poseHare(h, hareBody(a), dt, time, heightAt); HARE_RIG_STATS.rigged++; if (h.rig?.foreLock) HARE_RIG_STATS.locked++; return; }
      // beyond the near tier: no limb IK; the furred body rides a cheap hop (the old adapter's) in its bind pose
      const hop = speed > 0 ? Math.abs(Math.sin(h.hopPhase * Math.PI)) * (speed > 3 ? .28 : .12) : 0;
      h.root.position.set(h.x, heightAt(h.x, h.z) + hop, h.z); h.root.rotation.y = h.heading;
    });
    HARE_RIG_STATS.ms = performance.now() - t0;
    return events;
  }
  type HareShot = [number, number, number, number, number][];
  /** Photo-mode rewind: positions only; hares missing from a snapshot are hidden while it is shown. */
  const snapshot: SnapshotSource<HareShot> = {
    capture: () => hares.map(h => [h.id, h.x, h.z, h.heading, h.hopPhase]),
    restore(shot) {
      for (const h of hares) {
        const s = shot.find(e => e[0] === h.id); h.root.visible = !!s; if (!s) continue;
        [, h.x, h.z, h.heading, h.hopPhase] = s; Object.assign(h.sim, { x: h.x, z: h.z, heading: h.heading }); h.root.position.set(h.x, heightAt(h.x, h.z), h.z); h.root.rotation.y = h.heading;
        h.rig?.place(h.x, h.z, h.heading); h.frame = undefined;
      }
    },
  };
  const api = { update, snapshot, list: () => hares as readonly Hare[], stats: HARE_RIG_STATS };
  (globalThis as { borealHares?: unknown }).borealHares = api; // dev handle (recordings, perf): borealHares.list(), borealHares.stats
  return api;
}
