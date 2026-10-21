import { canidPlan, gallopLegChord, reachTargets, REF_BODY, swingFollow, suspensionRise, suspensions, type CanidGait, type CanidPlan, type ReachBody } from './gaitData';

export const ANIMAL_DEFAULT_ENERGY = 75;
export const FORAGE_ENERGY = 18;
export const PLAYER_HEARING_RADIUS = 40;
/** Seconds an animal spends eating at a forage patch before it is consumed. */
export const FEED_DURATION = 2;
/** Distance (m) from a forage patch at which an animal stops to eat. */
export const FEED_REACH = 1;
/** Seconds a sensed threat is remembered after leaving the senses; stops flip-flopping at the 24 m edge. */
export const THREAT_MEMORY = 3;
export function withinEarshot(player: Point, animal: Point) { return Math.hypot(player.x-animal.x,player.y-animal.y,player.z-animal.z) <= PLAYER_HEARING_RADIUS; }
export type Motion = 'idle' | 'walk' | 'run' | 'back' | 'jump';
export type Problem = 'explore' | 'escape' | 'avoid' | 'feed' | 'recover' | 'player';
export interface SenseItem { key: string; x: number; y: number; z: number; kind: 'threat' | 'food' | 'obstacle' | 'animal'; low?: boolean }
export interface Point { x: number; y: number; z: number }
export const SENSE_RADII = [3, 10, 24] as const;
export class AnimalBrain {
  energy = ANIMAL_DEFAULT_ENERGY; motion: Motion = 'idle'; problem: Problem = 'explore';
  phase = 0; jumpTime = 0; jumpCooldown = 0; heading = 0; speed = 0;
  /** The gait of the last step, fed back to gaitFor for Froude hysteresis (no flicker at a transition). */
  gaitName?: GaitName;
  /** Phase before the last expend(), and how far a renderer is into the next fixed step (0..1): drawPhase interpolates
   *  between sim steps, so a 30 Hz sim does not draw the legs in 30 Hz jumps. drawAlpha stays 1 for animals stepped per frame. */
  prevPhase = 0; drawAlpha = 1;
  get drawPhase() { return this.prevPhase + (this.phase - this.prevPhase) * Math.max(0, Math.min(1, this.drawAlpha)); }
  near: SenseItem[] = []; middle: SenseItem[] = []; far: SenseItem[] = [];
  target?: SenseItem; time = 0; avoidTime = 0;
  feedTime = 0; meal?: SenseItem; alarm = 0; lastThreat?: SenseItem;
  /** Leg proportions used for gait timing; set per species. */
  legs: LegDims = DEER_LEGS; gaitSpeed = 0;
  constructor(public seed: number) {}
  sense(origin: Point, items: SenseItem[]) {
    const sorted = items.map(item => ({item,d:Math.hypot(item.x-origin.x,item.y-origin.y,item.z-origin.z)})).filter(v=>v.d<=24).sort((a,b)=>a.d-b.d);
    this.near=sorted.filter(v=>v.d<=3).map(v=>v.item);
    this.middle=sorted.filter(v=>v.d>3&&v.d<=10).map(v=>v.item);
    this.far=sorted.filter(v=>v.d>10).map(v=>v.item);
  }
  decide(origin: Point, dt: number, command?: {motion:Motion; heading:number; speed:number}) {
    this.time+=dt; this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);
    if(this.motion==='jump'&&this.jumpTime<.85) {this.jumpTime+=dt;return;}
    if(this.motion==='jump') {this.jumpTime=0;this.jumpCooldown=1.5;}
    if(command) {
      this.problem='player';this.motion=this.energy<=0?'idle':command.motion;
      this.heading=command.heading;this.speed=this.energy<=0?0:command.speed;
      if(this.motion==='jump') {this.jumpTime=dt;this.energy=Math.max(0,this.energy-1.5);}
      return;
    }
    const threats=[...this.near,...this.middle,...this.far].filter(i=>i.kind==='threat');
    this.alarm=Math.max(0,this.alarm-dt);
    if(threats[0]) {this.lastThreat=threats[0];this.alarm=THREAT_MEMORY;}
    const threat=threats[0] ?? (this.alarm>0 ? this.lastThreat : undefined); const obstacle=this.near.find(i=> {
      const dx=i.x-origin.x,dz=i.z-origin.z;
      const ahead=-Math.sin(this.heading)*dx-Math.cos(this.heading)*dz;
      const sideways=Math.abs(Math.cos(this.heading)*dx-Math.sin(this.heading)*dz);
      return i.kind==='obstacle' && ahead>0 && ahead<1.8 && sideways<.65;
    });
    this.target=undefined; this.meal=undefined;
    const feeding=this.feedTime; this.feedTime=0;
    if(this.energy<=0) {this.motion='idle';this.problem='recover';this.speed=0;return;}
    if(obstacle && this.jumpCooldown===0 && obstacle.low && this.energy>10) {
      this.motion='jump';this.problem='avoid';this.speed=2;this.jumpTime=dt;this.energy-=1.5;return;
    }
    if(obstacle || this.avoidTime>0) {
      if(this.avoidTime<=0) this.avoidTime=.7;
      this.avoidTime-=dt;this.motion='back';this.problem='avoid';this.speed=-.65;
      if(this.avoidTime<=0) this.heading+=Math.PI*.65;
      return;
    }
    if(threat) {
      this.target=threat;this.problem='escape';
      const distance=Math.hypot(threat.x-origin.x,threat.z-origin.z);
      this.motion=distance<2.5?'back':distance<12?'run':'walk';
      this.heading=Math.atan2(origin.x-threat.x,origin.z-threat.z)+(this.motion==='back'?0:Math.PI);
      this.speed=this.motion==='back'?-.7:this.motion==='run'?3:1;return;
    }
    if(this.energy<20 || (this.problem==='recover' && this.energy<45)) {this.motion='idle';this.problem='recover';this.speed=0;return;}
    const food=[...this.near,...this.middle,...this.far].find(i=>i.kind==='food');
    if(food&&this.energy<85) {
      this.problem='feed';this.target=food;
      const d=Math.hypot(food.x-origin.x,food.z-origin.z);
      this.heading=Math.atan2(origin.x-food.x,origin.z-food.z);
      if(d<FEED_REACH) {
        this.motion='idle';this.speed=0;this.feedTime=feeding+dt;
        // Caller consumes the patch and grants energy once the meal is finished.
        if(this.feedTime>=FEED_DURATION) {this.meal=food;this.feedTime=0;}
      } else {this.motion='walk';this.speed=.8;}
      return;
    }
    this.problem='explore'; this.motion=Math.sin(this.time*.15+this.seed)>.65?'idle':'walk';
    this.heading+=Math.sin(this.time*.3+this.seed)*dt*.25;this.speed=this.motion==='walk'?.65:0;
  }
  /** `effort` (>= 1 on soft ground: core/ground footing().cost) scales what a metre costs in energy. It never moves the legs:
   *  the gait phase advances by the distance actually travelled, so planted paws do not slide (closes the T-0002 open item). */
  expend(dt:number, distance:number, effort=1) {
    const cost=.003*dt + Math.max(0,distance)*effort*(this.motion==='run'?.18:this.motion==='jump'?.22:.08);
    const recovery=this.motion==='idle'&&this.problem==='recover' ? dt : 0;
    this.energy=Math.max(0,Math.min(100,this.energy-cost+recovery));
    // Phase advances by distance over the research-based stride length at the speed actually travelled.
    this.gaitSpeed=dt>0?Math.max(0,distance)/dt:this.gaitSpeed;
    const gait=gaitFor(this.motion,this.gaitSpeed,this.legs,this.gaitName);
    this.gaitName=gait?.name;
    this.prevPhase=this.phase;
    if(gait) this.phase+=Math.max(0,distance)/gait.cycle;
  }
}
/** Leg order LF, LH, RF, RH. Coupled phase offsets, not independent oscillators. */
export function gaitPose(motion:Motion, phase:number, jumpTime=0) {
  if(motion==='jump') {
    const t=Math.max(0,Math.min(1,jumpTime/.85)),air=Math.max(0,Math.min(1,(t-.18)/.65));
    const height=t<.18?-.05*Math.sin(t/.18*Math.PI):t>.83?-.04*Math.sin((t-.83)/.17*Math.PI):.48*4*air*(1-air);
    return {legs:[-.55,.8,-.55,.8].map((v,i)=>t<.18?.35:t>.83?-.25:v*Math.sin(air*Math.PI)),knees:[0,1,2,3].map(()=>Math.max(0,Math.sin(air*Math.PI))*.9),bob:height};
  }
  const offsets=motion==='run'?[.50,0,.62,.12]:[.25,0,.75,.5];
  const amplitude=motion==='idle'?0:motion==='run'?.85:.5,reverse=motion==='back'?-1:1;
  const angles=offsets.map(o=>2*Math.PI*(phase+o));
  return {legs:angles.map(a=>Math.sin(a)*amplitude*reverse),knees:angles.map(a=>Math.max(0,Math.cos(a))*(motion==='idle'?0:.65)),bob:motion==='run'?Math.abs(Math.sin(phase*Math.PI*2))*.055:0};
}

/**
 * Leg proportions for the procedural quadruped controller (metres, world scale). A limb is two analytic-IK bones
 * (`upper`, `lower`) to the carpus or hock, then an optional third bone (`foot`: the metacarpus or metatarsus) whose
 * angle is a rule, not a solve: `footAngle` in stance (+ puts the paw ahead of the hock) folding back by `footFlex`
 * in swing. An optional `girdle` is the shoulder blade: a pivot above the shoulder joint that swings with the stride.
 * `bend` says which way the middle joint points: 'forward' (stifle, deer carpus) or 'back' (elbow, deer hock);
 * default is deer-style (front legs forward, hind legs back). `hind` overrides the dimensions of the rear legs.
 */
export interface LimbDims {
  hip: number; upper: number; lower: number;
  foot?: number; footAngle?: number; footFlex?: number;
  girdle?: number; girdleRest?: number; girdleSwing?: number;
  /** Where the toes rest, ahead of the top joint (m). Plantigrade feet (bears) put the toes forward so the heel sits under the hip. */
  stance?: number;
  bend?: 'forward' | 'back';
}
export interface LegDims extends LimbDims { hind?: LimbDims }
/** Deer: hip 1.1 m; 1.24 m of leg keeps a slight bend standing and room to reach forward and back. */
export const DEER_LEGS: LegDims = { hip: 1.1, upper: .62, lower: .62 };
/**
 * Real-size gray wolf (shoulder 0.82 m). Front: shoulder blade, upper arm 22 cm, forearm 25 cm, wrist-to-paw 16 cm, elbow points
 * back. Rear: hip, thigh 23 cm, shank 25 cm (stifle points forward), hock-to-paw 19 cm (hock points back, paw ahead of it).
 * Joint heights are where each limb's top joint sits when standing; limits found by tests/animal-behavior (gallop tuck).
 */
export const WOLF_LEGS: LegDims = {
  hip: .55, upper: .22, lower: .25, foot: .16, footAngle: 0, footFlex: .9, girdle: .17, girdleRest: .5, girdleSwing: .35, bend: 'back',
  // T-0003: the fore paw rests (and its stance sweep is centred) under the shoulder joint, not under the shoulder-blade
  // pivot: girdle·sin(girdleRest) ahead of it. A standing canid's forelimb column is vertical below the glenoid. [verify]
  stance: .17 * Math.sin(.5),
  hind: { hip: .56, upper: .23, lower: .25, foot: .19, footAngle: .42, footFlex: 1, bend: 'forward' },
};
/**
 * T-0003 reach: the game wolf's own ReachBody for gaitData.reachTargets. legChord is what its limbs sweep by IK with the
 * stance foot angle (gaitFor's old reach rule without the gallop's ×1.1 body lift: 0.39 m), trunk and levers are REF_BODY's
 * (2 × LEG_XZ × WOLF_SCALE = 0.54 m; shoulder 0.55 + blade 0.17 m; hip 0.56 m), scapula cap about 20° (Hildebrand 1959).
 */
export const WOLF_REACH: ReachBody = { ...REF_BODY, legChord: { walk: .39, trot: .39, gallop: .39 } };
/**
 * Lumbosacral pivot relative to each hip joint (m, +y up, +z back): the pelvis and both hind chains rotate about it by
 * reachTargets' spineFlex. Above and in front of the acetabulum by the ilium; [verify] against a canine pelvis
 * (Evans & de Lahunta, Miller's Anatomy of the Dog) — derived from the model's croup line, not measured.
 */
export const LUMBAR_PIVOT = { y: .09, z: -.11 };
/** Fore and hind girdle positions along the body (m, +z back) from the body centre: LEG_XZ × WOLF_SCALE (core/wolfBody;
 * kept here because wolfBody imports this module; tests/locomotion-touchdown checks they agree). */
export const WOLF_GIRDLE_Z = [-.24, .30] as const;
export type GaitName = 'walk' | 'trot' | 'gallop';
export interface Gait { name: GaitName; duty: number; cycle: number; lift: number; offsets: readonly number[]; reverse: boolean;
  /** Swing follow-through, 0..1 (gaitData.swingFollow; omitted = 0): the share of the stance velocity a paw keeps through
   * liftoff and touchdown (footTarget). 0 is the old swing that stops dead at both ends. */
  follow?: number }
const G = 9.81;
/**
 * Research-based gait selection and stride length (dynamic similarity; Alexander 1976, Alexander & Jayes 1983):
 * Froude number Fr = v²/(g·h); relative stride λ/h ≈ 2.3·Fr^0.3; walk below Fr 0.5, trot to ~2.5, gallop above.
 * Duty factor (share of a cycle each foot bears weight): walk ~0.65, trot ~0.45, gallop ~0.3 falling to 0.2 at high speed.
 * If a stride would need more leg than the animal has, the cycle shortens (faster cadence) instead of overstretching.
 * Offsets lead the cycle. Leg order LF, LH, RF, RH: walk is a lateral sequence; trot pairs diagonals (LF+RH, RF+LH);
 * gallop: hind pair then fore pair, then flight with all four feet off the ground (a second, gathered flight appears at high speed).
 */
export function gaitFor(motion: Motion, speed: number, legs: LegDims, prev?: GaitName): Gait | null {
  if (motion === 'idle' || motion === 'jump') return null;
  const h = legs.hip, v = Math.max(.15, Math.abs(speed)), fr = v * v / (G * h);
  // T-0002/T-0003: wolves take cadence, stride, duty and the rotary offsets from measured canid data (core/gaitData,
  // canidPlan: Bryce & Williams 2017, Heglund & Taylor 1988, Walter & Carrier 2007), with Froude hysteresis via `prev`.
  // The stride is never shortened for reach: the girdles and the spine supply it (quadrupedPose, reachTargets).
  // Deer keep the Alexander stride below; walking backwards keeps it too.
  const canid = legs === WOLF_LEGS && motion !== 'back' ? canidPlan(v, h, prev as CanidGait | undefined) : null;
  if (canid) return { name: canid.gait, duty: canid.duty, cycle: canid.stride, lift: (canid.gait === 'walk' ? .1 : canid.gait === 'trot' ? .15 : .2) * h, offsets: canid.offsets, reverse: false, follow: swingFollow(canid.gait) };
  return alexanderGait(motion, speed, legs);
}
/**
 * The Alexander gait (dynamic similarity; Alexander 1976, Alexander & Jayes 1983) with the stride capped by leg reach:
 * deer, walking backwards, and gaits without a reach model (the ?loco=1 pace, canter, bound and pronk overrides).
 */
export function alexanderGait(motion: Motion, speed: number, legs: LegDims): Gait | null {
  if (motion === 'idle' || motion === 'jump') return null;
  const h = legs.hip, v = Math.max(.15, Math.abs(speed)), fr = v * v / (G * h);
  const name: GaitName = motion === 'back' || fr < .5 ? 'walk' : fr < 2.5 ? 'trot' : 'gallop';
  const duty = name === 'walk' ? .65 : name === 'trot' ? .45 : Math.max(.2, .3 - .02 * (fr - 2.5));
  // Reach limit, allowing for the gallop's body lift so stance feet stay reachable.
  const reachOf = (l: LimbDims) => {
    const vertical = (l.hip - (l.foot ? l.foot * Math.cos(l.footAngle ?? 0) : 0)) * (name === 'gallop' ? 1.1 : 1);
    // The back-most foot needs the carpus/hock further back by the foot bone's slant, and the tilted shoulder blade starts forward.
    const behind = (l.foot ?? 0) * Math.sin(l.footAngle ?? 0) + .6 * (l.girdle ?? 0) * Math.sin(l.girdleRest ?? 0) - (l.stance ?? 0);
    return 2 * Math.max(0, Math.sqrt(Math.max(0, (l.upper + l.lower) ** 2 * .97 - vertical * vertical)) - behind);
  };
  const maxStance = Math.min(reachOf(legs), legs.hind ? reachOf(legs.hind) : Infinity);
  const cycle = Math.max(.4 * h, Math.min(2.3 * h * fr ** .3, maxStance / duty));
  // Rotary order LH -> RH -> RF -> LF (offsets lead the cycle, so touchdown = 1 - offset).
  // Biancardi & Minetti 2012, JEB 215:4144, doi:10.1242/jeb.073031, Fig. 1.
  // Timing fractions remain game calibration; the old front-pair order was transverse.
  const offsets = name === 'walk' ? [.25, 0, .75, .5] : name === 'trot' ? [0, .5, .5, 0] : [.45, 0, .6, .9];
  return { name, duty, cycle, lift: (name === 'walk' ? .1 : name === 'trot' ? .15 : .2) * h, offsets, reverse: motion === 'back' };
}
/**
 * Legs that touched down while the gait phase went from `from` to `to` (a leg lands at phase 1 - offset, mod 1, the end of
 * its swing). Any species and gait: footstep sounds, prints. Spans longer than a stride count the last stride only.
 */
export function touchdownsBetween(from: number, to: number, offsets: readonly number[]): number[] {
  if (!(to > from)) return [];
  const a = Math.max(from, to - 1 + 1e-9);
  return offsets.flatMap((o, i) => Math.floor(to + o) > Math.floor(a + o) ? [i] : []);
}
/** Touchdown strength 0..1 from the Froude number: 0.3 at a slow walk rising with its square root, 1 at a fast gallop
 *  (footstep loudness, both player paths). */
export const touchdownStrength = (froude: number) => Math.min(1, .3 + .35 * Math.sqrt(Math.max(0, froude)));
/** Leg order LF, LH, RF, RH. Front legs are even indices. */
export const isFrontLeg = (i: number) => i % 2 === 0;
const frac = (v: number) => v - Math.floor(v);
const smooth = (s: number) => s * s * (3 - 2 * s);
/**
 * Gallop body lift: a bump over each flight phase. Stance windows are LH 0, RH .1, RF .4, LF .55 (+ duty);
 * at high speed (low duty) canids show two flights per stride, gathered (after the hind pair) and extended (after the fore pair).
 */
export function gallopBob(phase: number, hip: number, duty = .3) {
  const bump = (from: number, to: number, height: number) => {
    const half = (to - from) / 2 + .02; if (to <= from) return 0;
    const x = (frac(phase - (from + to) / 2 + .5) - .5) / half;
    return Math.abs(x) < 1 ? height * hip * (1 + Math.cos(Math.PI * x)) / 2 : 0;
  };
  return bump(.55 + duty, 1, .09) + bump(.1 + duty, .4, .05);
}
/**
 * Procedural foot target, relative to the ground point below the hip (−z is forward).
 * Stance feet stay on the ground and travel back duty × cycle per cycle, exactly the distance the body moves
 * while they are down (the phase advances by distance / cycle), so planted feet never slide.
 */
export function footTarget(gait: Gait | null, motion: Motion, phase: number, leg: number, bob = 0, jumpTime = 0, hip = DEER_LEGS.hip) {
  if (motion === 'jump') {
    const t = Math.max(0, Math.min(1, jumpTime / .85)), air = Math.max(0, Math.min(1, (t - .18) / .65)), s = Math.sin(air * Math.PI);
    // Airborne: forelegs fold tight under the chest; hind legs push back at take-off, then tuck.
    const push = Math.sin(Math.min(1, air * 2) * Math.PI);
    const k = hip / DEER_LEGS.hip; // tuck distances scale with leg size
    return isFrontLeg(leg) ? { z: .08 * k * s, y: bob + .55 * k * s } : { z: (.3 * push + .1 * s) * k, y: bob + .4 * k * s };
  }
  if (!gait) return { z: 0, y: 0 };
  const stride = gait.duty * gait.cycle, dir = gait.reverse ? -1 : 1;
  const p = frac(phase + gait.offsets[leg]);
  if (p < gait.duty) return { z: dir * stride * (p / gait.duty - .5), y: 0 };
  const s = (p - gait.duty) / (1 - gait.duty);
  // Swing: a cubic Hermite from the liftoff point back to the touchdown point. Its end slopes are `follow` x the stance
  // velocity (stride/duty per unit phase), so with follow > 0 the paw carries on back a little after liftoff and retracts
  // into touchdown instead of stopping dead and snapping (swing-leg retraction); follow 0 is the old smoothstep.
  const m = (gait.follow ?? 0) * (1 - gait.duty) / gait.duty;
  return { z: dir * stride * (.5 - smooth(s) + m * s * (1 - s) * (1 - 2 * s)), y: gait.lift * Math.sin(Math.PI * s) };
}
/**
 * Analytic two-bone IK in the leg's sagittal plane. Returns the hip rotation (about x; + swings the foot forward)
 * and the knee rotation. Front joints point forward (carpus), hind joints point back (hock).
 */
export function solveLeg(tz: number, ty: number, upper: number, lower: number, front: boolean) {
  const d = Math.max(Math.abs(upper - lower) + 1e-4, Math.min(upper + lower - 1e-4, Math.hypot(tz, ty)));
  const aim = Math.atan2(-tz, -ty);
  const alpha = Math.acos(Math.max(-1, Math.min(1, (upper * upper + d * d - lower * lower) / (2 * upper * d))));
  const bend = Math.PI - Math.acos(Math.max(-1, Math.min(1, (upper * upper + lower * lower - d * d) / (2 * upper * lower))));
  return front ? { hip: aim + alpha, knee: -bend } : { hip: aim - alpha, knee: bend };
}
/** The limb dimensions for leg i (rear legs use `hind` when the animal has it). */
export const limbOf = (legs: LegDims, i: number): LimbDims => (!isFrontLeg(i) && legs.hind) ? legs.hind : legs;
/** Does the middle joint of this limb point forward (stifle, deer carpus)? */
export const bendsForward = (legs: LegDims, i: number) => (limbOf(legs, i).bend ?? (isFrontLeg(i) ? 'forward' : 'back')) === 'forward';
/**
 * T-0003: ballistic body rise over each all-feet-off window of a canid gait (gaitData.suspensions), g·t²/8 at the top of a
 * flight lasting t (gaitData.suspensionRise), a parabola in between. Replaces the fixed gallopBob bump for the wolf.
 */
export function suspensionBob(phase: number, gait: Pick<Gait, 'cycle' | 'duty' | 'offsets'>, speed: number) {
  const hz = Math.max(.05, Math.abs(speed)) / gait.cycle, p = frac(phase);
  for (const w of suspensions(gait.offsets, gait.duty)) {
    const span = w.to - w.from, x = (p >= w.from ? p : p + 1) - w.from;
    if (span > 0 && x >= 0 && x < span) return suspensionRise(span, hz) * 4 * (x / span) * (1 - x / span);
  }
  return 0;
}
/** How far a limb's two IK bones may reach (m): (upper + lower)·√0.97, less a 1e-4 safety share. */
export const ikReach = (L: LimbDims) => (L.upper + L.lower) * Math.sqrt(.97) * (1 - 1e-4);
/** Hip joint shift (m, body frame, +z back, +y up) when the pelvis rotates by `flex` (+ flexed) about LUMBAR_PIVOT. */
export function pelvisShift(flex: number) {
  const ry = -LUMBAR_PIVOT.y, rz = -LUMBAR_PIVOT.z, c = Math.cos(flex), s = Math.sin(flex);
  return { z: ry * s + rz * c - rz, y: ry * c - rz * s - ry };
}
/**
 * Body offset (m, +y up, +z back, after the tilt) that turns a vault pitch about the ground point under the body centre
 * (the rigs' tilt pivot) into one about the trunk at `pivot` height (the hip height): each girdle then drops or rises
 * rather than also swinging fore or aft, which at a ground pivot moves a fore paw that is far ahead (or a hind paw far
 * behind) out of reach as fast as the drop brings it in. Game calibration of the pivot.
 */
export const pitchShift = (pitch: number, pivot: number) => ({ y: pivot * (1 - Math.cos(pitch)), z: -pivot * Math.sin(pitch) });
/**
 * One limb in a sagittal frame (z back, y up, origin at the limb's ground point), shared by quadrupedPose and the ?loco=1
 * limb IK (animals/locomotion/ik solveLimb). `top` is the chain top (blade pivot or hip joint). `blade` is the absolute
 * shoulder-blade angle; omitted, the blade swings toward the wrist by girdleSwing (the old rule). `fit` (T-0003) turns the
 * foot bone from its rule angle `psi0` toward the paw-to-joint line only as far as the two IK bones need to reach.
 * Absolute angles: upper = girdle + leg, lower = upper + knee, foot = lower + wrist (= the foot angle used), paw level.
 */
export function solveChain(L: LimbDims, forward: boolean, foot: { z: number; y: number }, psi0: number, top: { z: number; y: number }, blade?: number, fit = false) {
  const S = L.girdle ?? 0, M = L.foot ?? 0, rest = L.girdleRest ?? 0, r = ikReach(L);
  const jointAt = (g: number) => ({ z: top.z - S * Math.sin(g), y: top.y - S * Math.cos(g) });
  const wristAt = (q: number) => ({ z: foot.z + M * Math.sin(q), y: foot.y + M * Math.cos(q) });
  const bladeFor = (h: { z: number; y: number }) => {
    if (!S) return 0;
    if (blade !== undefined) return blade;
    const j0 = jointAt(rest); return rest + (L.girdleSwing ?? 0) * Math.atan2(-(h.z - j0.z), -(h.y - j0.y));
  };
  let psi = psi0;
  if (fit && M) {
    const J0 = jointAt(bladeFor(wristAt(psi0))), far = (q: number) => Math.hypot(wristAt(q).z - J0.z, wristAt(q).y - J0.y) > r;
    if (far(psi0)) {
      const aligned = Math.atan2(J0.z - foot.z, J0.y - foot.y); let lo = 0, hi = 1;
      for (let k = 0; k < 16; k++) { const m = (lo + hi) / 2; if (far(psi0 + (aligned - psi0) * m)) lo = m; else hi = m; }
      psi = psi0 + (aligned - psi0) * hi;
    }
  }
  const h = wristAt(psi), g = bladeFor(h), J = jointAt(g), sol = solveLeg(h.z - J.z, h.y - J.y, L.upper, L.lower, forward);
  return { girdle: g, leg: sol.hip - g, knee: sol.knee, wrist: M ? psi - (sol.hip + sol.knee) : 0, paw: M ? -psi : -(sol.hip + sol.knee), joint: J, psi, wristAt: h };
}
/** Body drop (m) a limb needs for its two IK bones to reach `wrist` from `joint` (0 if it already does). */
export function limbDrop(L: LimbDims, joint: { z: number; y: number }, wrist: { z: number; y: number }) {
  const dz = wrist.z - joint.z, dy = joint.y - wrist.y, r = ikReach(L);
  return Math.abs(dz) < r ? Math.max(0, dy - Math.sqrt(r * r - dz * dz)) : 0;
}
/** Most each end of the body may dip (m) in one vault: twice the largest need of the data gaits (6.4 cm at 9.2 m/s);
 * a foot still out of reach beyond it is a correction (the ?loco=1 leash steps it), not gait. Game calibration. */
export const VAULT_MAX_DROP = .12;
/** Share of a swing, at each end, over which a leg's vault dip eases in before touchdown and out after liftoff (game calibration). */
export const VAULT_SWING_EDGE = .25;
/**
 * Run-gallop retune: in a gallop the hind pair lands at the end of the gathered flight, which is ballistic (the body rises
 * then falls under gravity). Eased in over a quarter of the (now longer) swing, the hind touchdown dip would start pulling
 * the body down before the top of that flight; it eases in over the flight's falling half instead (half the gathered
 * flight's share of the swing, from gaitData.suspensions). Everything else keeps VAULT_SWING_EDGE.
 */
export function vaultEdgeIn(gait: { duty: number; offsets: readonly number[]; gait?: string }, leg: number) {
  if (gait.gait !== 'gallop' || isFrontLeg(leg)) return VAULT_SWING_EDGE;
  const g = suspensions(gait.offsets, gait.duty).find(w => w.kind === 'gathered');
  return g ? Math.min(VAULT_SWING_EDGE, (g.to - g.from) / 2 / (1 - gait.duty)) : VAULT_SWING_EDGE;
}
/**
 * Vault dip (m) one leg asks of its end of the body at gait phase `at` (frac(phase + offset)): along the stance, the chord
 * from `td` (the drop its touchdown pose needs) to `lo` (its liftoff pose); eased in over the last VAULT_SWING_EDGE of the
 * swing and out over the first. The drop a planted paw needs grows convexly toward either end of its sweep, so the chord
 * covers it without the body snapping down in the frame a paw runs out of reach (callers top up any residual), and a
 * paw in mid-swing never pulls the body down in flight. Continuous at touchdown and liftoff.
 */
export function vaultEnvelope(at: number, duty: number, td: number, lo: number, eIn = VAULT_SWING_EDGE) {
  if (at < duty) return td + (lo - td) * at / duty;
  const e = VAULT_SWING_EDGE, s = (at - duty) / (1 - duty), ease = (x: number) => x * x * (3 - 2 * x);
  return s < e ? lo * (1 - ease(s / e)) : s > 1 - eIn ? td * ease((s - (1 - eIn)) / eIn) : 0;
}
/** The stride phase at which leg i is at stance progress s (0 touchdown, 1 liftoff). */
export const stancePhase = (gait: { duty: number; offsets: readonly number[] }, i: number, s: number) => frac(s * gait.duty - gait.offsets[i]);
/** The stride a vault's stance needs are solved for: duty to 0.001 and stride to 1 cm, so one solve serves every speed that
 * rounds alike and the result does not depend on which speed asked first (the top-up covers the rounding). */
export const vaultPlan = <P extends { duty: number; stride: number }>(plan: P): P => ({ ...plan, duty: Math.round(plan.duty * 1e3) / 1e3, stride: Math.round(plan.stride * 100) / 100 });
const VAULT_NEEDS = new Map<string, number[][]>();
/**
 * Fore and hind vault dips (m) at a stride phase: per end, the largest vaultEnvelope of its legs. `need(i, s)` is the drop
 * of its own end that leg i's stance pose needs at stance progress s (each rig solves it with its own limbs, for a
 * vaultPlan); the needs depend only on the gait and the body, so they are kept per `key` (a few dozen at a time).
 */
export function vaultDips(phase: number, gait: { duty: number; offsets: readonly number[]; gait?: string }, need: (i: number, s: number) => number, key: string) {
  let needs = VAULT_NEEDS.get(key);
  if (!needs) {
    needs = [0, 1, 2, 3].map(i => [need(i, 0), need(i, 1)]);
    if (VAULT_NEEDS.size >= 48) VAULT_NEEDS.delete(VAULT_NEEDS.keys().next().value!);
    VAULT_NEEDS.set(key, needs);
  }
  const env = [0, 0];
  for (let i = 0; i < 4; i++) env[i & 1] = Math.max(env[i & 1], vaultEnvelope(frac(phase + gait.offsets[i]), gait.duty, needs[i][0], needs[i][1], vaultEdgeIn(gait, i)));
  return env;
}
/** ?loco=1 (world-planted feet): seconds over which a vault dip lets go once no leg needs it (no pop at liftoff); it
 * engages at once whenever a leg needs it, so reach is never lost. Game calibration. */
export const VAULT_RELEASE = .04;
/**
 * Full quadruped pose by IK at the animal's actual speed. Angles are scale-free; bob and feet are in world metres.
 * Per leg: `girdles` (shoulder-blade angle in the LEVEL body frame; a rig whose girdle bone hangs from the tilted body
 * subtracts `pitch`), `legs` (upper bone, relative to the girdle), `knees` (middle
 * joint), `wrists` (carpus/hock, only when the limb has a foot bone), `paws` (keeps the sole level), `tops` (top of the
 * chain: blade pivot or hip joint) and `joints` (top joint), both in the level body frame relative to the leg's ground point.
 * `pitch` (rad, + front up) tilts the body about its centre at hip height: a rig pivoting at the ground under the centre
 * adds `shift` (pitchShift); `spineFlex` (rad, + flexed) carries the hind chain tops about LUMBAR_PIVOT (pelvisShift); `bob`
 * is the body's height offset (m). Absolute bone angles are cumulative:
 * upper = girdle + leg, lower = upper + knee, foot = lower + wrist, paw = foot + paw = 0.
 *
 * T-0003 (wolf): the shoulder blades (relative to the trunk) and the spine follow gaitData.reachTargets (Hildebrand 1959;
 * Walter & Carrier 2007); a foot bone turns from its rule angle toward the paw-to-joint line only as far as the leg needs; the
 * body vaults (drops and pitches) by vaultDips of each leg's touchdown and liftoff needs, topped up so planted paws always
 * reach (this is reachTargets.pitch's stance vault solved with the rig's own limbs, and continuous, where that one steps at
 * each touchdown); and a swing paw still out of reach has its arc pulled in toward the leg (planted paws never move).
 * Other animals: unchanged.
 */
export function quadrupedPose(motion: Motion, phase: number, jumpTime: number, legs: LegDims, speed: number, prev?: GaitName) {
  const gait = gaitFor(motion, speed, legs, prev);
  const plan = gait && legs === WOLF_LEGS && !gait.reverse ? { gait: gait.name, duty: gait.duty, stride: gait.cycle, offsets: gait.offsets } as CanidPlan : null;
  const reach = plan ? reachTargets(plan, phase, WOLF_REACH) : null;
  const lift0 = motion === 'jump' ? gaitPose('jump', phase, jumpTime).bob
    : reach ? suspensionBob(phase, gait!, speed) : gait?.name === 'gallop' ? gallopBob(phase, legs.hip, gait.duty) : 0;
  const flex = reach?.spineFlex ?? 0, [zF, zH] = WOLF_GIRDLE_Z;
  /** Top of leg i's chain (blade pivot or hip joint) in the level body frame, for a body height offset, pitch and spine
   * flexion. The body pitches about its centre at hip height (pitchShift on the rigs' ground-level tilt pivot). */
  const topOf = (i: number, height: number, pitch: number, spine = flex) => {
    const L = limbOf(legs, i), at = isFrontLeg(i) ? zF : zH;
    let y = L.hip + (L.girdle ?? 0), z = 0;
    if (!isFrontLeg(i) && spine) { const sh = pelvisShift(spine); y += sh.y; z += sh.z; } // the pelvis carries the hip joint
    if (pitch) {
      const zz = at + z, c = Math.cos(pitch), s = Math.sin(pitch), sh = pitchShift(pitch, legs.hip);
      [y, z] = [y * c - zz * s + sh.y, y * s + zz * c - at + sh.z];
    }
    return { z, y: y + height };
  };
  const per = [0, 1, 2, 3].map(i => {
    const L = limbOf(legs, i);
    const f0 = footTarget(gait, motion, phase, i, lift0, jumpTime, L.hip), f = { z: f0.z - (L.stance ?? 0), y: f0.y };
    // Foot bone angle: its stance value, folding back as the paw lifts (swing) or tucks (jump).
    const lift = gait ? Math.min(1, f.y / Math.max(1e-6, gait.lift)) : motion === 'jump' ? Math.min(1, Math.max(0, (f.y - lift0) / (.35 * L.hip / DEER_LEGS.hip))) : 0;
    const planted = !!reach && frac(phase + gait!.offsets[i]) < gait!.duty;
    return { L, f, lift, planted, psi0: (L.footAngle ?? 0) - (L.footFlex ?? 0) * lift, forward: bendsForward(legs, i) };
  });
  const bladeOf = (i: number, pitch: number, r = reach) => r && per[i].L.girdle ? pitch + (per[i].L.girdleRest ?? 0) + r.scapula[i >> 1] : undefined;
  let height = lift0, pitch = 0;
  const dropped = [0, 0], drop = (d: number[]) => {
    const [dF, dH] = d.map((x, e) => Math.max(0, Math.min(x, VAULT_MAX_DROP - dropped[e])));
    dropped[0] += dF; dropped[1] += dH;
    const turn = (dH - dF) / (zH - zF); pitch += turn; height += -dF + zF * turn; // fore end drops dF, hind end dH
    return dF + dH;
  };
  if (plan) {
    /** Drop of its end that leg i's stance pose needs at touchdown (s = 0) or liftoff (s = 1), with the girdles and spine of
     * that phase. A few passes: the drop also pitches the body, which turns the blades. */
    const q = vaultPlan(plan), stanceNeed = (i: number, s: number) => {
      const p = per[i], r = reachTargets(q, stancePhase(q, i, s), WOLF_REACH), sign = isFrontLeg(i) ? -1 : 1;
      const f = { z: q.duty * q.stride * (s - .5) - (p.L.stance ?? 0), y: 0 };
      let d = 0;
      for (let pass = 0; pass < 4; pass++) {
        const pitch = sign * d / (zH - zF), height = (sign < 0 ? -d : 0) + zF * pitch;
        const c = solveChain(p.L, p.forward, f, p.L.footAngle ?? 0, topOf(i, height, pitch, r.spineFlex), bladeOf(i, pitch, r), true);
        const n = limbDrop(p.L, c.joint, c.wristAt); if (n <= 1e-6) break;
        d += n + 1e-5;
      }
      return d;
    };
    drop(vaultDips(phase, plan, stanceNeed, `pose ${q.gait} ${q.duty} ${q.stride}`));
  }
  // Planted paws always reach: top up whatever the envelope left (passes until it settles).
  for (let pass = 0; reach && pass < 12; pass++) {
    const need = [0, 0];
    per.forEach((p, i) => {
      if (!p.planted) return;
      const c = solveChain(p.L, p.forward, p.f, p.psi0, topOf(i, height, pitch), bladeOf(i, pitch), true);
      need[i & 1] = Math.max(need[i & 1], limbDrop(p.L, c.joint, c.wristAt));
    });
    if (need[0] <= 1e-7 && need[1] <= 1e-7) break;
    if (drop(need.map(d => d > 1e-7 ? d + 1e-5 : 0)) <= 0) break;
  }
  const hips: number[] = [], knees: number[] = [], feet: { z: number; y: number }[] = [], girdles: number[] = [], wrists: number[] = [], paws: number[] = [];
  const joints: { z: number; y: number }[] = [], tops: { z: number; y: number }[] = [];
  per.forEach((p, i) => {
    const T = topOf(i, height, pitch), M = p.L.foot ?? 0;
    let f = p.f, c = solveChain(p.L, p.forward, f, p.psi0, T, bladeOf(i, pitch), !!reach);
    const d = Math.hypot(c.wristAt.z - c.joint.z, c.wristAt.y - c.joint.y), r = ikReach(p.L);
    if (reach && !p.planted && d > r) { // a swing paw out of reach: pull its arc in toward the leg (planted paws never move)
      const h = { z: c.joint.z + (c.wristAt.z - c.joint.z) * r / d, y: c.joint.y + (c.wristAt.y - c.joint.y) * r / d };
      f = { z: h.z - M * Math.sin(c.psi), y: h.y - M * Math.cos(c.psi) };
      c = solveChain(p.L, p.forward, f, c.psi, T, bladeOf(i, pitch), false);
    }
    feet.push(f); joints.push(c.joint); tops.push(T); girdles.push(c.girdle); hips.push(c.leg); knees.push(c.knee); wrists.push(c.wrist); paws.push(c.paw);
  });
  return { legs: hips, knees, wrists, paws, girdles, joints, tops, bob: height, feet, gait, pitch, shift: pitchShift(pitch, legs.hip), spineFlex: flex };
}
