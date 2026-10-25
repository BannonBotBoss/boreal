/**
 * Wading wake (T-0024). One disturbance field for every animal: a paw that lands in water raises a ring,
 * a body that is moving through water raises a Kelvin wake. Species differ by data (hips, mass, waterline, paw area).
 *
 * Dispersion (Lighthill, Waves in Fluids, 1978): c = sqrt(g/k + σ k/ρ), cg = (g + 3 σ k²/ρ) / (2 ω), ω = c k.
 * Chosen wavelength 0.10 m, inside the task's 5–30 cm band. σ = 0.07275 N/m (IAPWS R1-76(2014), pure water, 20 °C).
 * ρ = 998.2071 kg/m³ (Tanaka et al. 2001, Metrologia 38:301, 20 °C). ν = 1.0034e-6 m²/s (Kestin, Sokolov & Wakeham 1978,
 * J. Phys. Chem. Ref. Data 7:941, 20 °C). g is gravity() from proc/physics.
 *
 * Kelvin half-angle asin(1/3) while the hull Froude number U/sqrt(g L) is at most 0.5. Above that the angle narrows
 * as 1/Fr (Rabaud & Moisy 2013, PRL 110:214503); the join used here is continuous at 0.5: α = α_K * (0.5/Fr).
 * Viscous decay exp(−2 ν k² t) does not fade a 10 cm wave in a few seconds (τ ~ 100 s), so the ring that the eye
 * follows fades by geometric spreading and the packet width, and the wake fades by one body-length of group travel.
 */
import { gravity } from '../proc/physics';
import { CONTACTS, type ContactBus } from './contactBus';
import { FOOT } from './ground';
import { RIG_BODY_PLAN } from './materials';
import { gaitFor, footTarget, touchdownsBetween, type Gait, type GaitName, type LegDims, type Motion } from './animalBehavior';
import { LEG_XZ } from './wolfBody';
import { WOLF_SCALE } from './wolfModes';
import { BEAR_LEG_XZ } from './bearBody';
import { heightAt } from './world';
import { surfaceAt } from './stages/surfaceAt';
import { STAGES } from './stages/elevation';
import { LEVEL } from './tuning';

export const SIGMA = 0.07275;
export const RHO = 998.2071;
export const NU = 1.0034e-6;
export const LAMBDA = 0.1;
export const RING_CAP = 8;
export const WAKE_CAP = 8;
/** Linear steepness ak below the Stokes 1880 limit (~0.44). The crest height is capped at this. */
export const STEEPNESS = 0.3;
/** Arm thickness in radians. Game calibration: how wide the bright arm reads. The ridge is the sourced angle. */
export const ARM = 0.07;
const BEHIND_SKIP = 0.05;
const SPEED_MIN = 0.15;
const SOLE = 0.001;
/** Floor on the wake's along-track decay length (m). Game calibration so a very slow body does not decay in millimetres. */
const DECAY_FLOOR = 0.3;

const TAU = 2 * Math.PI;
export function dispersion(lambda: number, g = gravity()) {
  const k = TAU / lambda;
  const c = Math.sqrt(g / k + (SIGMA * k) / RHO);
  const w = c * k;
  const cg = (g + (3 * SIGMA * k * k) / RHO) / (2 * w);
  return { k, c, w, cg, g };
}
const D = dispersion(LAMBDA);
export const WAVE = { ...D, kelvin: Math.asin(1 / 3), cap: STEEPNESS / D.k };

/** Head-and-body or rig waterline (m), the L in the hull Froude number. Wolf: Wikipedia "Wolf", the page wolfBody.ts
 *  cites, head-and-body 105–160 cm, midpoint. Deer: fore-to-hind span of DEER_HIP_XZ. Hare: ADW head-body 361–479 mm
 *  midpoint, the range already in animals/hare.ts. Bear: fore-to-hind span of BEAR_LEG_XZ (core/bearBody). Person:
 *  leg length ≈ 0.53 × stature (Winter, Biomechanics and Motor Control of Human Movement, 4th ed. 2009) at 1.71 m [verify]. */
export const DEER_HIP_XZ: ReadonlyArray<readonly [number, number]> = [[-.38, -.65], [-.38, .65], [.38, -.65], [.38, .65]];
/** Hare hips, body metres. Lateral half-widths are the stance (fore ~3 cm, the NatureNorth print cited in animals/hare.ts);
 *  z is HARE_BODY.shoulderZ and HARE_BODY.hipZ. Order LF, LH, RF, RH. */
export const HARE_HIP_XZ: ReadonlyArray<readonly [number, number]> = [[-.03, -.12], [-.035, .09], [.03, -.12], [.035, .09]];
/** Two human soles. ±0.12 m is a narrow standing stance. Foot size is HUMAN_FOOT, not the Bekker FOOT table. */
export const PERSON_HIPS: ReadonlyArray<readonly [number, number]> = [[-.12, 0], [.12, 0]];
/** Winter 2009: foot length ≈ 0.152 × stature. Stature 1.71 m [verify]. Width ≈ 0.40 × length [verify]. Not added to FOOT. */
export const HUMAN_FOOT = { w: 0.104, l: 0.26 };
/** Preferred walking stride, two steps (Winter 2009, step length near 0.75 m) [verify]. Duty is a normal walk. */
export const PERSON_STRIDE = 1.5;
export const PERSON_DUTY = 0.62;

export const WATERLINE: Record<string, number> = {
  wolf: (1.05 + 1.60) / 2,
  deer: DEER_HIP_XZ[1][1] - DEER_HIP_XZ[0][1],
  hare: (0.361 + 0.479) / 2,
  bear: Math.abs(BEAR_LEG_XZ[1][1] - BEAR_LEG_XZ[0][1]),
  person: 0.90,
};
/** World-metre waterline. The wolf rig is modelled in half-size and drawn at WOLF_SCALE, so its published length is
 *  already the world length at that scale. Other rigs are modelled in metres. */
export function waterline(id: string, scaleX = 1) {
  const base = WATERLINE[id] ?? WATERLINE.wolf;
  return id === 'wolf' ? base * (scaleX / WOLF_SCALE) : base * scaleX;
}
export function hipsFor(id: string, scaleX = 1, scaleZ = scaleX): Array<[number, number]> {
  const src = id === 'deer' ? DEER_HIP_XZ : id === 'bear' ? BEAR_LEG_XZ : id === 'hare' ? HARE_HIP_XZ : id === 'person' ? PERSON_HIPS : LEG_XZ;
  return src.map(([x, z]) => [x * scaleX, z * scaleZ]);
}
export function pawArea(id: string) {
  if (id === 'person') return HUMAN_FOOT.w * HUMAN_FOOT.l;
  const foot = FOOT[RIG_BODY_PLAN[id] ?? 'canid'] ?? FOOT.canid;
  return foot.w * foot.l;
}
/** Signed travel speed: the gait advances by distance, so gaitSpeed is the speed the paws actually used. */
export function travelSpeed(speed: number, gaitSpeed: number) {
  const sign = speed < 0 ? -1 : 1;
  return gaitSpeed > 0.01 ? sign * gaitSpeed : speed;
}

export function wakeHalfAngle(froude: number) {
  if (!(froude > 0.5)) return WAVE.kelvin;
  return WAVE.kelvin * (0.5 / froude);
}
export const wakeHalfAngleDeg = (froude: number) => wakeHalfAngle(froude) * 180 / Math.PI;
export function hullFroude(speed: number, length: number, g = WAVE.g) {
  return Math.abs(speed) / Math.sqrt(g * Math.max(length, 0.05));
}

/**
 * Crest amplitude (m) from one paw's share of the body's kinetic energy.
 * Deep-water energy over the paw patch: (1/2) ρ g A² × area = ½ (m/n) v², so A = sqrt( (m/n) v² / (ρ g area) ).
 * Capped at STEEPNESS/k, then × min(1, |v|/c) so a foot slower than the ripple raises a smaller crest.
 */
export function crestAmp(mass: number, paws: number, speed: number, pawAreaM2: number) {
  const v = Math.abs(speed);
  if (!(v > 0) || !(mass > 0) || !(paws > 0) || !(pawAreaM2 > 0)) return 0;
  const share = 0.5 * (mass / paws) * v * v;
  const amp = Math.sqrt((2 * share) / (RHO * WAVE.g * pawAreaM2));
  return Math.min(amp, WAVE.cap) * Math.min(1, v / WAVE.c);
}

export function bodyToWorld(x: number, z: number, heading: number, lx: number, lz: number) {
  const c = Math.cos(heading), s = Math.sin(heading);
  return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
}

/** Top-down audit camera (?top=1). h is metres above the water, fov is the vertical field in degrees. */
export const TOP_CAM = { h: 6, fovDeg: 40 };
export interface TopCam { x: number; z: number; heading: number; h: number; fovDeg: number; y?: number }
/** Screen pixels. Up is the body's forward, right is (cos yaw, −sin yaw), matching a three.js camera that looks down with that up. */
export function projectTop(p: { x: number; z: number }, cam: TopCam, width: number, height: number) {
  const halfH = cam.h * Math.tan((cam.fovDeg * Math.PI / 180) / 2);
  const halfW = halfH * (width / Math.max(1, height));
  const relx = p.x - cam.x, relz = p.z - cam.z;
  const right = relx * Math.cos(cam.heading) - relz * Math.sin(cam.heading);
  const up = -relx * Math.sin(cam.heading) - relz * Math.cos(cam.heading);
  const ndcX = right / halfW, ndcY = up / halfH;
  return { x: (ndcX * 0.5 + 0.5) * width, y: (0.5 - ndcY * 0.5) * height };
}
export function unprojectTop(px: number, py: number, cam: TopCam, width: number, height: number) {
  const halfH = cam.h * Math.tan((cam.fovDeg * Math.PI / 180) / 2);
  const halfW = halfH * (width / Math.max(1, height));
  const ndcX = (px / width) * 2 - 1, ndcY = 1 - (py / height) * 2;
  const right = ndcX * halfW, up = ndcY * halfH;
  const rx = Math.cos(cam.heading), rz = -Math.sin(cam.heading);
  const fx = -Math.sin(cam.heading), fz = -Math.cos(cam.heading);
  return { x: cam.x + right * rx + up * fx, z: cam.z + right * rz + up * fz };
}

export interface XZ { x: number; z: number }
function frameOf(p: XZ, origin: XZ, heading: number) {
  const relx = p.x - origin.x, relz = p.z - origin.z;
  const fx = -Math.sin(heading), fz = -Math.cos(heading);
  const rx = Math.cos(heading), rz = -Math.sin(heading);
  const behind = -(relx * fx + relz * fz);
  const lateral = relx * rx + relz * rz;
  return { behind, lateral, r: Math.hypot(relx, relz) };
}
/**
 * Radius from the 2 cm histogram (mean of the modal bin and its neighbours): the ring piles up at one radius and the
 * arms do not. Each radius sample is weighted by 1/r, because a filled ring has more pixels farther out; the mode is the ridge.
 * Angle from the 0.5° histogram of points behind the body and off that radius.
 */
export function fitDisturbance(points: readonly XZ[], origin: XZ, heading: number) {
  const framed = points.map(p => frameOf(p, origin, heading));
  const rBins = new Map<number, { w: number; rs: number[] }>();
  for (const f of framed) {
    const b = Math.round(f.r / 0.02);
    const w = 1 / Math.max(f.r, 0.05); // a ring's outer pixels are more numerous; weight so the mode is the ridge
    const slot = rBins.get(b); if (slot) { slot.w += w; slot.rs.push(f.r); } else rBins.set(b, { w, rs: [f.r] });
  }
  let mode = 0, modeN = -1;
  for (const [b, slot] of rBins) if (slot.w > modeN) { modeN = slot.w; mode = b; }
  let wSum = 0, rSum = 0, nRadius = 0;
  for (const db of [-1, 0, 1]) for (const slot of [rBins.get(mode + db)].filter(Boolean) as { w: number; rs: number[] }[]) {
    for (const r of slot.rs) { const w = 1 / Math.max(r, 0.05); wSum += w; rSum += w * r; nRadius++; }
  }
  const radius = wSum > 0 ? rSum / wSum : 0;
  const aBins = new Map<number, number[]>();
  for (const f of framed) {
    if (f.behind <= 0.3 || Math.abs(f.r - radius) <= 0.12) continue;
    const deg = Math.atan2(Math.abs(f.lateral), f.behind) * 180 / Math.PI;
    const b = Math.round(deg / 0.5);
    const arr = aBins.get(b); if (arr) arr.push(deg); else aBins.set(b, [deg]);
  }
  let am = 0, amN = -1;
  for (const [b, arr] of aBins) if (arr.length > amN) { amN = arr.length; am = b; }
  const angPts: number[] = [];
  for (const db of [-1, 0, 1]) for (const a of aBins.get(am + db) ?? []) angPts.push(a);
  const angleDeg = angPts.length ? angPts.reduce((a, b) => a + b, 0) / angPts.length : 0;
  return { radius, angleDeg, nRadius, nAngle: angPts.length };
}
/** 1 when the measurement matches. The angle part divides by the predicted angle, the radius part by the predicted radius. */
export function wakeScore(measured: { radius: number; angleDeg: number }, expected: { radius: number; angleDeg: number }) {
  const angle = 1 - Math.abs(measured.angleDeg - expected.angleDeg) / Math.max(1e-6, expected.angleDeg);
  const radius = 1 - Math.abs(measured.radius - expected.radius) / Math.max(1e-6, expected.radius);
  return { angle, radius, score: Math.min(angle, radius) };
}

export interface Ring { x: number; z: number; t0: number; amp: number }
export interface WakeSlot { id: string; x: number; z: number; heading: number; t0: number; speed: number; amp: number; angle: number; length: number }
export function ringAt(x: number, z: number, t: number, ring: Ring) {
  const age = Math.max(0, t - ring.t0);
  const dx = x - ring.x, dz = z - ring.z, rad = Math.hypot(dx, dz);
  const u = (rad - WAVE.cg * age) / LAMBDA;
  const packet = Math.exp(-u * u);
  const phase = WAVE.k * (rad - WAVE.c * age);
  const s = Math.sin(phase);
  const spread = 1 / Math.sqrt(Math.max(rad, LAMBDA));
  const visc = Math.exp(-2 * NU * WAVE.k * WAVE.k * age);
  const h = ring.amp * packet * s * spread * visc;
  const dp = packet * (-2 * u / LAMBDA);
  const ds = WAVE.k * Math.cos(phase);
  const dsp = rad > LAMBDA ? -0.5 * rad ** (-1.5) : 0;
  const dhdr = ring.amp * visc * (dp * s * spread + packet * ds * spread + packet * s * dsp);
  const inv = rad > 1e-4 ? dhdr / rad : 0;
  return { h, sx: inv * dx, sz: inv * dz };
}
export function wakeAt(x: number, z: number, t: number, w: WakeSlot) {
  if (!(w.amp > 0)) return { h: 0, sx: 0, sz: 0 };
  const age = Math.max(0, t - w.t0);
  const relx = x - w.x, relz = z - w.z;
  const fx = -Math.sin(w.heading), fz = -Math.cos(w.heading);
  const rx = Math.cos(w.heading), rz = -Math.sin(w.heading);
  const behind = -(relx * fx + relz * fz);
  if (behind <= BEHIND_SKIP) return { h: 0, sx: 0, sz: 0 };
  const lateral = relx * rx + relz * rz;
  const ang = Math.atan2(Math.abs(lateral), behind);
  const on = Math.exp(-(((ang - w.angle) / ARM) ** 2));
  const spd = Math.max(w.speed, 0.05);
  const lamW = Math.max(0.4, TAU * spd * spd / WAVE.g);
  const kW = TAU / lamW;
  const spatial = Math.exp(-behind * WAVE.cg / Math.max(spd * w.length, DECAY_FLOOR));
  const fade = Math.exp(-age * WAVE.cg / Math.max(w.length, 0.05));
  const wave = Math.sin(kW * behind);
  const h = w.amp * on * wave * spatial * fade;
  const dhd = w.amp * on * spatial * fade * kW * Math.cos(kW * behind);
  return { h, sx: dhd * -fx, sz: dhd * -fz };
}

const n6 = (n: number) => n.toFixed(6);
/** Shader twin of ringAt / wakeAt. Speeds are baked from WAVE so the program cannot drift from the CPU field.
 *  uWakeG is gravity() (a uniform, not a written literal). 2π is radians(360.0). */
export const WAKE_GLSL = `
uniform float uWakeNow;
uniform float uWakeG;
uniform vec4 uRings[8];
uniform vec4 uWakeA[8];
uniform vec4 uWakeB[8];
#define WK ${n6(WAVE.k)}
#define WC ${n6(WAVE.c)}
#define WCG ${n6(WAVE.cg)}
#define WL ${n6(LAMBDA)}
#define WNU ${NU.toExponential(6)}
#define WCAP ${n6(WAVE.cap)}
#define WARM ${n6(ARM)}
vec4 wakeField(vec2 p) {
  float h = 0.0; float env = 0.0; vec2 slope = vec2(0.0);
  for (int i = 0; i < 8; i++) {
    vec4 r = uRings[i]; if (r.w <= 0.0) continue;
    float age = max(0.0, uWakeNow - r.z);
    vec2 d = p - r.xy; float rad = length(d);
    float u = (rad - WCG * age) / WL;
    float packet = exp(-u * u);
    float ph = WK * (rad - WC * age);
    float s = sin(ph);
    float spread = inversesqrt(max(rad, WL));
    float visc = exp(-2.0 * WNU * WK * WK * age);
    float base = r.w * packet * spread * visc;
    h += base * s;
    float ridge = smoothstep(0.72, 0.98, packet);
    env = max(env, max(ridge, clamp(s, 0.0, 1.0) * packet * 0.55));
    float dp = packet * (-2.0 * u / WL);
    float ds = WK * cos(ph);
    float dsp = rad > WL ? -0.5 * pow(rad, -1.5) : 0.0;
    float dhdr = r.w * visc * (dp * s * spread + packet * ds * spread + packet * s * dsp);
    if (rad > 1e-4) slope += (dhdr / rad) * d;
  }
  for (int i = 0; i < 8; i++) {
    vec4 a = uWakeA[i]; vec4 b = uWakeB[i]; if (b.y <= 0.0) continue;
    float age = max(0.0, uWakeNow - a.w);
    vec2 rel = p - a.xy;
    vec2 fwd = vec2(-sin(a.z), -cos(a.z));
    vec2 right = vec2(cos(a.z), -sin(a.z));
    float behind = -dot(rel, fwd);
    if (behind <= ${n6(BEHIND_SKIP)}) continue;
    float lateral = dot(rel, right);
    float ang = atan(abs(lateral), behind);
    float on = exp(-pow((ang - b.z) / WARM, 2.0));
    float spd = max(b.x, 0.05);
    float lamW = max(0.4, radians(360.0) * spd * spd / uWakeG);
    float kW = radians(360.0) / lamW;
    float spatial = exp(-behind * WCG / max(spd * b.w, ${n6(DECAY_FLOOR)}));
    float fade = exp(-age * WCG / max(b.w, 0.05));
    float wave = sin(kW * behind);
    float wbase = b.y * on * spatial * fade;
    h += wbase * wave;
    float wridge = smoothstep(0.72, 0.98, on);
    env = max(env, max(wridge, clamp(wave, 0.0, 1.0) * on * 0.55) * spatial * fade);
    float dhd = wbase * kW * cos(kW * behind);
    slope += dhd * vec2(-fwd.x, -fwd.y);
  }
  return vec4(h, slope, env);
}
`;

export interface SurfaceSample { ground: number; water?: number }
export type SampleFn = (x: number, z: number) => SurfaceSample;
/** What the rig stands on (heightAt) and the water surface above it, if any. River water wins over a lake. */
export function sampleSurface(x: number, z: number): SurfaceSample {
  const ground = heightAt(x, z);
  if (!STAGES.on) return ground < LEVEL.waterSurface ? { ground, water: LEVEL.waterSurface } : { ground };
  const p = surfaceAt(x, z);
  const water = p.river ? p.river.surface : p.lake ? p.lake.surface : ground < LEVEL.waterSurface ? LEVEL.waterSurface : undefined;
  return water === undefined ? { ground } : { ground, water };
}

interface BodyNote {
  id: string; x: number; z: number; heading: number; motion: Motion; speed: number; t: number;
  mass: number; length: number; hips: ReadonlyArray<readonly [number, number]>; pawArea: number; sample: SampleFn;
  phase: number; prevPhase: number;
}
interface Walker { x: number; z: number; phase: number; seen: boolean; stride: number; wet: boolean; leaveAt?: number; waterY: number }

export function createWake(bus: ContactBus = CONTACTS) {
  const rings: Ring[] = [], wakes: WakeSlot[] = [], walkers = new Map<string, Walker>(), owned = new Set<string>();
  let view: TopCam | undefined, now = 0;
  const blank = (): Walker => ({ x: 0, z: 0, phase: 0, seen: false, stride: 0.8, wet: false, waterY: 0 });
  const endWet = (id: string) => { owned.delete(id); return bus.end(`wake:${id}`, 'water'); };
  const beginWet = (id: string, x: number, y: number, z: number) => {
    owned.add(id);
    return bus.begin({ a: `wake:${id}`, b: 'water', at: [x, y, z], normal: [0, 1, 0], kind: 'solid-solid', source: 'water-wake' });
  };
  function slot(id: string) {
    const found = wakes.find(w => w.id === id); if (found) return found;
    if (wakes.length >= WAKE_CAP) wakes.splice(wakes.reduce((bi, w, i, a) => w.t0 < a[bi].t0 ? i : bi, 0), 1);
    const s: WakeSlot = { id, x: 0, z: 0, heading: 0, t0: 0, speed: 0, amp: 0, angle: WAVE.kelvin, length: 1 };
    wakes.push(s); return s;
  }
  function step(n: BodyNote, gait: Gait | null) {
    const walker = walkers.get(n.id) ?? blank();
    walkers.set(n.id, walker);
    walker.x = n.x; walker.z = n.z;
    if (gait) walker.stride = gait.cycle;
    const hips = n.hips;
    if (gait && n.mass > 0) {
      const amp = crestAmp(n.mass, hips.length, n.speed, n.pawArea);
      if (amp > 0) for (const i of touchdownsBetween(n.prevPhase, n.phase, gait.offsets)) {
        if (i >= hips.length) continue;
        const ft = footTarget(gait, n.motion, -(gait.offsets[i] ?? 0), i);
        const p = bodyToWorld(n.x, n.z, n.heading, hips[i][0], hips[i][1] + ft.z);
        const s = n.sample(p.x, p.z);
        if (s.water === undefined || s.ground + ft.y >= s.water - SOLE) continue;
        rings.push({ x: p.x, z: p.z, t0: n.t, amp });
        while (rings.length > RING_CAP) rings.shift();
      }
    }
    let wet = false, waterY = walker.waterY, wx = n.x, wz = n.z;
    for (let i = 0; i < hips.length; i++) {
      const ft = footTarget(gait, n.motion, n.phase, i);
      const p = bodyToWorld(n.x, n.z, n.heading, hips[i][0], hips[i][1] + ft.z);
      const s = n.sample(p.x, p.z);
      if (s.water !== undefined && s.ground + ft.y < s.water - SOLE) { wet = true; waterY = s.water; wx = p.x; wz = p.z; break; }
    }
    if (wet) {
      walker.wet = true; walker.leaveAt = undefined; walker.waterY = waterY;
      beginWet(n.id, wx, waterY, wz);
      if (Math.abs(n.speed) > SPEED_MIN) {
        const s = slot(n.id);
        s.x = n.x; s.z = n.z; s.heading = n.motion === 'back' ? n.heading + Math.PI : n.heading;
        s.speed = Math.abs(n.speed); s.length = Math.max(n.length, 0.05); s.t0 = n.t;
        s.angle = wakeHalfAngle(hullFroude(n.speed, s.length));
        s.amp = crestAmp(n.mass, Math.max(1, hips.length), n.speed, n.pawArea);
      }
    } else if (walker.wet) {
      if (walker.leaveAt === undefined) walker.leaveAt = n.t + walker.stride / Math.max(Math.abs(n.speed), 0.25);
      if (n.t >= walker.leaveAt) { walker.wet = false; walker.leaveAt = undefined; endWet(n.id); }
    }
  }
  function pack(t: number) {
    now = t;
    const ringsA = new Float32Array(32), wakeA = new Float32Array(32), wakeB = new Float32Array(32);
    rings.forEach((r, i) => { if (i < RING_CAP) ringsA.set([r.x, r.z, r.t0, r.amp], i * 4); });
    wakes.forEach((w, i) => {
      if (i >= WAKE_CAP) return;
      wakeA.set([w.x, w.z, w.heading, w.t0], i * 4);
      wakeB.set([w.speed, w.amp, w.angle, w.length], i * 4);
    });
    return { rings: ringsA, wakeA, wakeB, now: t };
  }
  return {
    noteGait(n: BodyNote & { legs: LegDims; gaitName?: GaitName }) {
      step(n, gaitFor(n.motion, n.speed, n.legs, n.gaitName));
    },
    noteTimed(n: BodyNote & { offsets: readonly number[]; duty: number; stride: number }) {
      step(n, { name: 'walk', duty: n.duty, cycle: n.stride, lift: 0.05, offsets: n.offsets, reverse: n.motion === 'back' });
    },
    noteMover(n: Omit<BodyNote, 'phase' | 'prevPhase'> & { offsets: readonly number[]; duty: number; stride: number }) {
      const w = walkers.get(n.id) ?? blank();
      walkers.set(n.id, w);
      const dist = w.seen ? Math.hypot(n.x - w.x, n.z - w.z) : 0;
      const prev = w.phase;
      w.phase = w.seen ? w.phase + dist / Math.max(0.05, n.stride) : 0;
      w.x = n.x; w.z = n.z; w.seen = true;
      step({ ...n, phase: w.phase, prevPhase: prev }, { name: 'walk', duty: n.duty, cycle: n.stride, lift: 0.05, offsets: n.offsets, reverse: n.motion === 'back' });
    },
    field(x: number, z: number, t: number) {
      let h = 0;
      for (const r of rings) h += ringAt(x, z, t, r).h;
      for (const w of wakes) h += wakeAt(x, z, t, w).h;
      return h;
    },
    pack, capture() {
      return { rings: rings.map(r => ({ ...r })), wakes: wakes.map(w => ({ ...w })), walkers: [...walkers].map(([id, w]) => [id, { ...w }] as [string, Walker]) };
    },
    restore(s: { rings: Ring[]; wakes: WakeSlot[]; walkers: [string, Walker][] }) {
      for (const id of [...owned]) endWet(id);
      rings.splice(0, rings.length, ...s.rings.map(r => ({ ...r })));
      wakes.splice(0, wakes.length, ...s.wakes.map(w => ({ ...w })));
      walkers.clear();
      for (const [id, w] of s.walkers) {
        walkers.set(id, { ...w });
        if (w.wet) beginWet(id, w.x, w.waterY, w.z);
      }
    },
    reset() {
      for (const id of [...owned]) endWet(id);
      rings.splice(0, rings.length); wakes.splice(0, wakes.length); walkers.clear(); view = undefined;
    },
    rememberView(v: TopCam) { view = { ...v }; },
    debug() { return { rings: rings.map(r => ({ ...r })), wakes: wakes.map(w => ({ ...w })), view, owned: [...owned], now }; },
  };
}
export type Wake = ReturnType<typeof createWake>;
/** The game's single wake, on the shared contact bus. Tests build their own. */
export const WAKES = createWake();
