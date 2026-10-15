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
  expend(dt:number, distance:number) {
    const cost=.003*dt + Math.max(0,distance)*(this.motion==='run'?.18:this.motion==='jump'?.22:.08);
    const recovery=this.motion==='idle'&&this.problem==='recover' ? dt : 0;
    this.energy=Math.max(0,Math.min(100,this.energy-cost+recovery));
    // Phase advances by distance over the research-based stride length at the speed actually travelled.
    this.gaitSpeed=dt>0?Math.max(0,distance)/dt:this.gaitSpeed;
    const gait=gaitFor(this.motion,this.gaitSpeed,this.legs);
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
  hind: { hip: .56, upper: .23, lower: .25, foot: .19, footAngle: .42, footFlex: 1, bend: 'forward' },
};
export type GaitName = 'walk' | 'trot' | 'gallop';
export interface Gait { name: GaitName; duty: number; cycle: number; lift: number; offsets: readonly number[]; reverse: boolean }
const G = 9.81;
/**
 * Research-based gait selection and stride length (dynamic similarity; Alexander 1976, Alexander & Jayes 1983):
 * Froude number Fr = v²/(g·h); relative stride λ/h ≈ 2.3·Fr^0.3; walk below Fr 0.5, trot to ~2.5, gallop above.
 * Duty factor (share of a cycle each foot bears weight): walk ~0.65, trot ~0.45, gallop ~0.3 falling to 0.2 at high speed.
 * If a stride would need more leg than the animal has, the cycle shortens (faster cadence) instead of overstretching.
 * Offsets lead the cycle. Leg order LF, LH, RF, RH: walk is a lateral sequence; trot pairs diagonals (LF+RH, RF+LH);
 * gallop: hind pair then fore pair, then flight with all four feet off the ground (a second, gathered flight appears at high speed).
 */
export function gaitFor(motion: Motion, speed: number, legs: LegDims): Gait | null {
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
  const offsets = name === 'walk' ? [.25, 0, .75, .5] : name === 'trot' ? [0, .5, .5, 0] : [.6, 0, .45, .9];
  return { name, duty, cycle, lift: (name === 'walk' ? .1 : name === 'trot' ? .15 : .2) * h, offsets, reverse: motion === 'back' };
}
/** Leg order LF, LH, RF, RH. Front legs are even indices. */
export const isFrontLeg = (i: number) => i % 2 === 0;
const frac = (v: number) => v - Math.floor(v);
const smooth = (s: number) => s * s * (3 - 2 * s);
/**
 * Gallop body lift: a bump over each flight phase. Stance windows are LH 0, RH .1, LF .4, RF .55 (+ duty);
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
  return { z: dir * stride * (.5 - smooth(s)), y: gait.lift * Math.sin(Math.PI * s) };
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
 * Full quadruped pose by IK at the animal's actual speed. Angles are scale-free; bob and feet are in world metres.
 * Per leg: `girdles` (shoulder-blade swing), `legs` (upper bone, relative to the girdle), `knees` (middle joint),
 * `wrists` (carpus/hock, only when the limb has a foot bone), `paws` (keeps the sole level), `joints` (top joint position).
 * Absolute bone angles are cumulative: upper = girdle + leg, lower = upper + knee, foot = lower + wrist, paw = foot + paw = 0.
 */
export function quadrupedPose(motion: Motion, phase: number, jumpTime: number, legs: LegDims, speed: number) {
  const gait = gaitFor(motion, speed, legs);
  const bob = motion === 'jump' ? gaitPose('jump', phase, jumpTime).bob : gait?.name === 'gallop' ? gallopBob(phase, legs.hip, gait.duty) : 0;
  const hips: number[] = [], knees: number[] = [], feet: { z: number; y: number }[] = [], girdles: number[] = [], wrists: number[] = [], paws: number[] = [], joints: { z: number; y: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const L = limbOf(legs, i), S = L.girdle ?? 0, M = L.foot ?? 0, front = isFrontLeg(i);
    const f0 = footTarget(gait, motion, phase, i, bob, jumpTime, L.hip), f = { z: f0.z - (L.stance ?? 0), y: f0.y }; feet.push(f);
    // Foot bone angle: its stance value, folding back as the paw lifts (swing) or tucks (jump).
    const lift = gait ? Math.min(1, f.y / Math.max(1e-6, gait.lift)) : motion === 'jump' ? Math.min(1, Math.max(0, (f.y - bob) / (.35 * L.hip / DEER_LEGS.hip))) : 0;
    const psi = (L.footAngle ?? 0) - (L.footFlex ?? 0) * lift;
    const hz = f.z + M * Math.sin(psi), hy = f.y + M * Math.cos(psi); // the carpus/hock the two-bone IK must reach
    // Shoulder blade: rests tilted, and swings with where the paw is (scapular glide).
    const jointAt = (g: number) => ({ z: -S * Math.sin(g), y: L.hip + bob + S - S * Math.cos(g) });
    let g = 0;
    if (S) { const j0 = jointAt(L.girdleRest ?? 0); g = (L.girdleRest ?? 0) + (L.girdleSwing ?? 0) * Math.atan2(-(hz - j0.z), -(hy - j0.y)); }
    const J = jointAt(g); joints.push(J); girdles.push(g);
    const forward = bendsForward(legs, i);
    const sol = solveLeg(hz - J.z, hy - J.y, L.upper, L.lower, forward);
    hips.push(sol.hip - g); knees.push(sol.knee);
    wrists.push(M ? psi - (sol.hip + sol.knee) : 0);
    paws.push(M ? -psi : -(sol.hip + sol.knee));
  }
  return { legs: hips, knees, wrists, paws, girdles, joints, bob, feet, gait };
}
