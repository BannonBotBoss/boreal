/**
 * Snowshoe hares (Grok Bot): a standalone prey animal, outside the skeleton/species system, now driven by the SHARED animal
 * pipeline (core/agent/pipeline + the HARE_AGENT record in core/agent/species). This file is only the host: spawning, the
 * cartoon model and its poses, clover (core/clover + render/clover), the catch, and the ?hare=debug readout.
 * Behaviour (Matthew's spec): graze head-down on clover in sunlit clearings, step to the next section, lift the head to scan;
 * a sensed wolf (sight / hearing / scent) -> head up (alert); a moving wolf during the alert -> flight away from it, pause,
 * flee again while it still senses the wolf, else relax (rest, scan, trot to sensed clover, seek sunlit ground). Nothing
 * moves without a sensed or felt cause. Caught by body contact or by a pounce that lands close (unchanged).
 */
import * as THREE from 'three';
import { heightAt, WORLD_SEED } from '../core/world';
import { stream, range } from '../proc/rng';
import { LEVEL } from '../core/tuning';
import { f, scope } from '../proc/trace';
import { windAt } from '../core/weather';
import { siteAt, footprintsIn, covered } from '../core/flora/site';
import { createCloverField, cloverSuitability, CLOVER, CLOVER_STATE, type CloverDelta } from '../core/clover';
import { worldSec } from '../core/worldClock';
import { cloverPatchesInTile } from '../core/clover';
import { createAgent, stepAgent, poseOf, actionName, moods, modulators, type Agent, type Other } from '../core/agent/pipeline';
import { HARE_AGENT } from '../core/agent/species';
import { createBounding, limbPoints, poseRequestFor, type BoundController, type BoundFrame } from './locomotion/bounding';
import { skeletonOf, type BodyPlan } from './locomotion/bodyPlan';
import { CONTACTS } from '../core/contactBus';
import { createCloverRenderer } from '../render/clover';
import type { SnapshotSource } from '../core/snapshot';

export const HARE = {
  count: 5, spawnMin: 18, spawnMax: 45, despawn: 70, respawnSeconds: [25, 45] as [number, number], nearClover: .75,
  catchContact: 1.3, catchPounce: 2.4, energy: 35, stamina: 40, cloverRadius: 48,
};
export type HareState = Agent['action'];
export interface Hare { id: number; x: number; z: number; heading: number; readonly state: HareState; agent: Agent; hopPhase: number; root: THREE.Group; head: THREE.Group; body: THREE.Group; legs: Leg[]; ears: THREE.Group[]; rng: () => number; label?: THREE.Sprite; rig?: BoundController; frame?: BoundFrame }
/** One limb drawn from the bounding rig: three segments (upper, lower, foot) placed between the rig's joints each frame. */
interface Leg { segs: THREE.Mesh[]; hind: boolean }
export interface HareEvent { type: 'caught' | 'bolt' | 'hop'; x: number; z: number }
/** speed (m/s) and daylight (0..1) feed the hare's senses; `moving` is kept for older callers (speed defaults from it). */
export interface WolfInfo { x: number; z: number; mode: string; moving: boolean; pouncing: boolean; speed?: number; daylight?: number }
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('hare') === 'debug';

/** Body plan in metres, snowshoe hare summer adult (ADW Lepus americanus / Colorado PW): total length 413-518 mm (tail 39-52),
 *  hind foot 117-147 mm, ear 62-70 mm notch to tip, 1.43-1.55 kg; summer coat grizzled rusty/greyish brown, white belly, ears
 *  brownish with black tips, hind feet densely furred (white-toed in the reference). The hip is the body pivot, so sitting up
 *  lifts the forelegs off the ground. Limb bones (run 3, nature-checked; was fore .12 / hind .125, ~1.6x short):
 *  - hindLeg .202 = femur 94 mm (L. americanus, Illinois State Museum Larson collection) + tibia 108 mm = femur x 1.13-1.19
 *    (L. europaeus tibia/femur: Volf 2023 Lynx 54:193, means 147.3/130.7 mm; Williams et al. 2007 J Anat 210:472 Table 4,
 *    137/115 mm) [scaled]; upperShare .47 = femur / (femur + tibia).
 *  - foreLeg .181 = humerus 77 mm (femur x .80, Volf 2023 means 104.8/130.7) + radius 69 mm (humerus x .90, Williams et al.
 *    2007 J Anat 211:475 Table 4, 101.5/113) [scaled] + manus 35 mm [estimate: drawn to the reference]; manus share .19.
 *  - hindFoot .132 (hock to toe tip, in ADW's 117-147 mm hind foot range); standing hip .13 with the knee bent to
 *    hindBend .5 of the leg and the shoulder at foreBend .6 of the fore leg (crouched resting posture) [estimate: drawn to the
 *    reference photos]. Trunk (hip to shoulder joint) .21 m and head .30 m ahead of the hip (nose to tail ~.47 m, in the
 *    413-518 mm total length) [estimate: drawn to the reference]; headZ is from the hip. */
export const HARE_BODY = { hipY: .13, hipZ: .09, shoulderZ: -.12, foreLeg: .181, hindLeg: .202, hindFoot: .132, upperShare: .47, manus: .19, foreBend: .6, hindBend: .5, ear: .066, headZ: -.3, headY: .085 };
function model() {
  const B = HARE_BODY, root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(); root.add(body); body.add(head);
  body.position.set(0, B.hipY, 0); head.position.set(0, B.headY, B.headZ); // body = the hip pivot
  const mat = (c: number) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 });
  const brown = mat(0x7d6247), buff = mat(0x9c8060), white = mat(0xeeeae0), dark = mat(0x1e1a17);
  const blob = (parent: THREE.Object3D, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.x = rx; parent.add(mesh); return mesh;
  };
  // torso relative to the hip pivot: haunch, back, chest; white belly and tail
  blob(body, brown, 0, .015, .0, .075, .08, .085); blob(body, brown, 0, .03, -.09, .07, .075, .11, .1); blob(body, buff, 0, .01, -.17, .055, .06, .06);
  blob(body, white, 0, -.035, -.08, .05, .035, .1); blob(body, white, 0, .05, .085, .022, .022, .02);
  // head: cranium, muzzle, eyes, nose
  blob(head, brown, 0, 0, 0, .038, .04, .05); blob(head, buff, 0, -.012, -.045, .025, .022, .025); blob(head, dark, 0, -.008, -.07, .006, .005, .004);
  for (const s of [-1, 1]) blob(head, dark, s * .03, .012, -.02, .008, .009, .008);
  const ears: THREE.Group[] = [];
  for (const s of [-1, 1]) { const e = new THREE.Group(); e.position.set(s * .017, .03, .015); e.rotation.z = -s * .12; head.add(e); ears.push(e);
    blob(e, brown, 0, B.ear / 2, 0, .012, B.ear / 2, .02); blob(e, dark, 0, B.ear * .92, 0, .009, .008, .016); }
  // limbs: segments between the bounding rig's joints (src/animals/locomotion/bounding.ts), in root space, rig leg order
  // LF, LH, RF, RH. Thickness [estimate: drawn to the reference]: muscular thigh, slim shank, broad furred hind foot.
  const legs: Leg[] = [];
  const seg = (m: THREE.Material, r: number, w = r) => { const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), m); mesh.userData.r = [w, r]; root.add(mesh); return mesh; };
  for (let i = 0; i < 4; i++) { const hind = i % 2 === 1;
    legs.push({ hind, segs: hind ? [seg(brown, .03, .026), seg(buff, .014), seg(white, .011, .022)] : [seg(buff, .013), seg(buff, .01), seg(white, .009, .012)] }); }
  return { root, body, head, legs, ears };
}
/** Pose targets: body pitch about the hip (rad, + = front up), body lift (m), head pitch (+ = nose up), head drop (m), ears
 *  (rad, + = laid back), foreleg and hind leg angles (rad, + = foot forward). Read from the reference sheet
 *  (refs/hare/graze-alert-flight attempt 2): grazing crouch = hunched, chin at the clover, ears back; scan = head up from the
 *  crouch; alert = sat up on the haunches, forefeet off the ground, ears erect; rest/freeze = tucked, ears flat [estimate]. */
const POSES: Record<string, readonly number[]> = {
  'head-down': [-.1, -.02, -.55, -.075, .95, .1, .45],
  scan: [.3, 0, -.35, 0, -.05, -.15, .5],
  sit: [.95, 0, -.95, 0, -.15, -.7, .55],
  rest: [-.04, -.035, -.15, 0, .85, .25, .55],
  crouch: [-.06, -.045, -.1, 0, 1.15, .3, .6],
  move: [0, 0, -.1, 0, .5, 0, 0], run: [0, 0, .05, 0, .9, 0, 0],
};
type PoseKey = 'head-down' | 'scan' | 'sit' | 'rest' | 'crouch' | 'move' | 'run';
const poseKey = (a: Agent): PoseKey => a.action === 'alert' || a.action === 'pause' ? 'sit' : a.action === 'scan' ? 'scan' : poseOf(a) === 'head-up' ? 'scan' : poseOf(a) as PoseKey;

function labelSprite() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 176;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(3.4, .94, 1); s.renderOrder = 999;
  s.userData.draw = (lines: string[], colour = '#f4f1e6') => { const g = canvas.getContext('2d')!; g.clearRect(0, 0, 640, 176); g.font = 'bold 30px monospace'; const w = Math.min(640, 20 + Math.max(...lines.map(l => g.measureText(l).width)));
    g.fillStyle = 'rgba(12,16,12,.78)'; g.fillRect((640 - w) / 2, 0, w, 16 + lines.length * 38); g.fillStyle = colour; lines.forEach((l, i) => g.fillText(l, (640 - w) / 2 + 10, 36 + i * 38)); tex.needsUpdate = true; };
  return s;
}

export type HareModel = Pick<Hare, 'root' | 'body' | 'head' | 'legs' | 'ears' | 'hopPhase' | 'id' | 'rig' | 'frame'>;
export const createHareModel = model;
/** The hare's limb skeleton for the bounding rig, from HARE_BODY (track half-widths [estimate: drawn to the reference]). */
export const HARE_PLAN: BodyPlan = { hip: HARE_BODY.hipY, hipZ: HARE_BODY.hipZ, shoulderZ: HARE_BODY.shoulderZ, track: { fore: .03, hind: .045 }, foreLeg: HARE_BODY.foreLeg,
  hindLeg: HARE_BODY.hindLeg, hindFoot: HARE_BODY.hindFoot, upperShare: HARE_BODY.upperShare, manus: HARE_BODY.manus, foreBend: HARE_BODY.foreBend, hindBend: HARE_BODY.hindBend };
const HARE_SKELETON = skeletonOf(HARE_PLAN);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
/** Pose one hare model from its pipeline agent for this frame (shared by the game host and tools/hare-strip). The legs, body
 *  height and pitch come from the bounding rig (planted feet, half-bound / lagomorph gallop, sit-up and graze-crouch pose
 *  requests); head and ears from the reference poses. `ground` is the terrain height function (or a flat height). */
export function poseHare(h: HareModel, a: Agent, dt: number, time: number, ground: number | ((x: number, z: number) => number)) {
  const groundAt = typeof ground === 'number' ? () => ground : ground, k = 1 - Math.exp(-dt * 10);
  if (!h.rig) h.rig = createBounding(HARE_SKELETON, HARE_AGENT.gait!, groundAt, { x: a.x, z: a.z, heading: a.heading });
  // the agent is authoritative: the rig integrates the same speed and heading; a jump (spawn, rewind, blocked step) re-places it
  if (h.frame && Math.hypot(h.frame.x - a.x, h.frame.z - a.z) > .5) h.rig.place(a.x, a.z, a.heading);
  const fr = h.frame = h.rig.update(Math.max(1e-4, dt), a.speed, a.heading, poseRequestFor(poseOf(a), a.action));
  const ox = a.x - fr.x, oz = a.z - fr.z; // small drift between the two integrations, drawn away
  // root at the hip joints (mid of the two hind chain tops), turned to the heading; the body pitches about it
  const hl = limbPoints(HARE_SKELETON, fr, 1)[0], hr = limbPoints(HARE_SKELETON, fr, 3)[0];
  h.root.position.set((hl.x + hr.x) / 2 + ox, 0, (hl.z + hr.z) / 2 + oz); h.root.rotation.y = a.heading; h.root.updateMatrixWorld();
  h.body.position.set(0, (hl.y + hr.y) / 2, 0); h.body.rotation.x = fr.tilt.pitch;
  const inv = h.root.matrixWorld.clone().invert();
  h.legs.forEach((leg, i) => {
    const P = limbPoints(HARE_SKELETON, fr, i); // [top, girdle joint, knee/elbow, ankle/wrist, toe]
    leg.segs.forEach((m, s) => {
      _a.set(P[s + 1].x + ox, P[s + 1].y, P[s + 1].z + oz).applyMatrix4(inv); _b.set(P[s + 2].x + ox, P[s + 2].y, P[s + 2].z + oz).applyMatrix4(inv);
      _d.subVectors(_b, _a); const len = Math.max(1e-4, _d.length()), [w, r] = m.userData.r as [number, number];
      m.position.addVectors(_a, _b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(UP, _d.divideScalar(len)); m.scale.set(w, len / 2 + r * .6, r);
    });
  });
  // head and ears: reference poses (sit-up for the alert and the flight pause, scan, graze, rest), smoothed
  const moving = a.speed > .05, pose = POSES[moving ? (a.speed > 3 ? 'run' : 'move') : poseKey(a)];
  const nibble = a.action === 'feed' ? Math.sin(time * 9 + h.id) * .04 : 0;
  h.head.rotation.x += (pose[2] + nibble - h.head.rotation.x) * k; h.head.position.y += (HARE_BODY.headY + pose[3] - h.head.position.y) * k;
  for (const e of h.ears) e.rotation.x += (pose[4] - e.rotation.x) * k;
}

export function createHares(scene: THREE.Scene) {
  const hares: Hare[] = []; let nextId = 1; const pending: number[] = [];
  const spawnRng = stream(WORLD_SEED, 'hares-v1'); // seeded: one stream for placement, one per hare id for behaviour
  const blockedAt = (x: number, z: number, r: number) => covered(footprintsIn(x - r, z - r, x + r, z + r), x, z, r * .5);
  const clover = createCloverField((x, z) => siteAt(x, z), blockedAt, WORLD_SEED, () => worldSec());
  // Clover outcompetes grass where it grows (a dense stoloniferous mat): grass blades thin to 20 % inside a patch, blended
  // over its rim. The patch layout is seeded, so the grass packer can ask for any tile without the live field (memoised).
  const layout = new Map<string, { x: number; z: number; r: number }[]>();
  const presence = (x: number, z: number) => { const tx = Math.floor(x / CLOVER.tile), tz = Math.floor(z / CLOVER.tile); let best = 0;
    for (let j = tz - 1; j <= tz + 1; j++) for (let i = tx - 1; i <= tx + 1; i++) { const k = `${i}:${j}`; let ps = layout.get(k);
      if (!ps) { ps = cloverPatchesInTile(i, j, (a, b) => siteAt(a, b), blockedAt).map(p => ({ x: p.x, z: p.z, r: p.r })); if (layout.size > 4000) layout.clear(); layout.set(k, ps); }
      for (const p of ps) { const d = Math.hypot(p.x - x, p.z - z); if (d < p.r * 1.15) best = Math.max(best, 1 - Math.max(0, (d - p.r * .85) / (p.r * .3))); } }
    return best; };
  /** Grass cover with clover patches thinned (render/buildScene installs it as the grass cover source: importing
   *  render/grass/cover here would close an import cycle through core/renderSettings). */
  const thinGrass = <C extends { density: number }>(x: number, z: number, c: C): C => { const p = presence(x, z); return p > 0 ? { ...c, density: c.density * (1 - .8 * p) } : c; };
  const cloverDraw = createCloverRenderer(scene, clover);
  const walkable = (x: number, z: number) => heightAt(x, z) > LEVEL.hareWater;
  const habitat = (x: number, z: number) => cloverSuitability(siteAt(x, z));
  const patchLabels: THREE.Sprite[] = [];
  function spawn(px: number, pz: number) {
    const near = [...clover.list()].filter(p => { const d = Math.hypot(p.x - px, p.z - pz); return d > HARE.spawnMin && d < HARE.spawnMax && clover.unitsOf(p) > 0; });
    for (let tries = 0; tries < 12; tries++) {
      const a = spawnRng() * Math.PI * 2, d = range(spawnRng, [HARE.spawnMin, HARE.spawnMax]), pick = spawnRng(), onClover = near.length > 0 && spawnRng() < HARE.nearClover;
      const p = onClover ? near[Math.floor(pick * near.length)] : undefined;
      const x = p ? p.x + Math.sin(a) * p.r * .5 : px + Math.sin(a) * d, z = p ? p.z + Math.cos(a) * p.r * .5 : pz + Math.cos(a) * d;
      if (heightAt(x, z) < LEVEL.shore) continue;
      const { root, body, head, legs, ears } = model(); scene.add(root);
      const id = nextId++; root.userData.inspect = { type: 'hare', key: `hare:${id}` }; const rng = stream(WORLD_SEED, `hare-v1:${id}`);
      const agent = createAgent(HARE_AGENT, `hare:${id}`, x, z, rng, { energy: 55 + rng() * 40, relaxation: 80 + rng() * 20 });
      const h: Hare = { id, x, z, heading: agent.heading, get state() { return agent.action; }, agent, hopPhase: 0, root, body, head, legs, ears, rng };
      if (DEBUG) { h.label = labelSprite(); scene.add(h.label); }
      hares.push(h); return;
    }
  }
  function remove(h: Hare) {
    scene.remove(h.root); h.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    if (h.label) { scene.remove(h.label); h.label.material.map?.dispose(); h.label.material.dispose(); }
    if (h.agent.contact) CONTACTS.end(h.agent.key, h.agent.contact); // leaving the world ends its contact
    hares.splice(hares.indexOf(h), 1);
  }
  let time = 0, labelWait = 0, lastWolf: WolfInfo | undefined;
  function update(dt: number, wolf: WolfInfo): HareEvent[] {
    const events: HareEvent[] = []; time += dt; lastWolf = wolf;
    const daylight = wolf.daylight ?? 1, speed = wolf.speed ?? (wolf.moving ? 2 : 0);
    clover.ensure(wolf.x, wolf.z, HARE.cloverRadius, 1); cloverDraw.update(dt); // regrowth is lazy (core/clover sunSeconds)
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i] <= time) { pending.splice(i, 1); spawn(wolf.x, wolf.z); }
    for (let k = 0; k < HARE.count && hares.length + pending.length < HARE.count; k++) spawn(wolf.x, wolf.z); // bounded: spawn() can fail (no dry land in range)
    while (hares.length > HARE.count) remove(hares[hares.length - 1]); // count lowered in settings
    const others: Other[] = [{ key: 'player', kind: 'wolf', x: wolf.x, z: wolf.z, speed, crouched: wolf.mode.includes('stealth') }];
    for (const h of [...hares]) {
      const a = h.agent, d = Math.hypot(a.x - wolf.x, a.z - wolf.z);
      if (d > HARE.despawn) { remove(h); continue; }
      if (d < HARE.catchContact || (wolf.pouncing && d < HARE.catchPounce)) {
        events.push({ type: 'caught', x: a.x, z: a.z }); remove(h); pending.push(time + range(h.rng, HARE.respawnSeconds)); continue;
      }
      const wind = windAt(a.x, .3, a.z);
      for (const ev of stepAgent(a, { others, wind: { x: wind.x, z: wind.z }, daylight, food: { clover }, habitat, walkable }, dt))
        if ((ev.type === 'bolt' || ev.type === 'hop') && (ev.type === 'bolt' || d < 30)) events.push({ type: ev.type, x: ev.x, z: ev.z });
      h.x = a.x; h.z = a.z; h.heading = a.heading;
      scope(`hare:${h.id}`); f('hare', 'wolfDistance', d); f('hare', 'state', a.action); f('hare', 'goal', a.goal); f('hare', 'energy', a.energy); f('hare', 'stamina', a.stamina); f('hare', 'relaxation', a.relaxation); f('hare', 'threat', a.sensed.level); f('hare', 'speed', a.speed); scope('');
      poseHare(h, a, dt, time, heightAt);
    }
    if (DEBUG && (labelWait -= dt) <= 0) { labelWait = .25; debugLabels(wolf); }
    return events;
  }
  function debugLabels(wolf: WolfInfo) {
    for (const h of hares) { const a = h.agent, m = modulators(a, a.sensed.level), md = moods(a), p = a.food ? clover.get(a.food) : a.target?.key ? clover.get(a.target.key) : undefined;
      h.label!.position.set(a.x, heightAt(a.x, a.z) + 1.25, a.z);
      h.label!.userData.draw([`${actionName(a)}`, `why: ${a.goal}`.slice(0, 40), `E ${a.energy.toFixed(1)} S ${a.stamina.toFixed(0)} R ${a.relaxation.toFixed(0)} hunger ${md.hunger.toFixed(2)}`,
        `threat ${a.sensed.level.toFixed(2)} (notice ${m.noticeAt.toFixed(2)})${p ? ` clover ${Math.round(clover.unitsOf(p))}` : ''}`], a.action === 'flee' ? '#ffb4a0' : a.action === 'alert' ? '#ffe39a' : '#f4f1e6'); }
    const near = [...clover.list()].map(p => ({ p, d: Math.hypot(p.x - wolf.x, p.z - wolf.z) })).filter(e => e.d < 14).sort((a, b) => a.d - b.d).slice(0, 6);
    while (patchLabels.length < near.length) { const s = labelSprite(); s.scale.set(2, .55, 1); scene.add(s); patchLabels.push(s); }
    patchLabels.forEach((s, i) => { const e = near[i]; s.visible = !!e; if (!e) return; s.position.set(e.p.x, heightAt(e.p.x, e.p.z) + .45, e.p.z); const u = clover.unitsOf(e.p);
      s.userData.draw([`${Math.round(u)}/${e.p.max} (${Math.round(100 * u / e.p.max)}%)${u <= 0 ? ' grazed out' : ''}`, `${(u * CLOVER.mgPerUnit / 1000).toFixed(0)} g leaf, stolon ${e.p.stolon.toFixed(0)} g`], '#c8f0a8'); });
  }
  /** the agent fields STATE_FIELDS.agent tags 'snapshot' */
  const AGENT_SNAP = ['x', 'z', 'heading', 'action', 'goal', 'timer', 'elapsed', 'energy', 'stamina', 'relaxation', 'target', 'food', 'contact', 'zig', 'sensed', 'speed'] as const;
  type HareShot = { hares: { id: number; hop: number; a: Record<string, unknown> }[]; clover: [string, CloverDelta][] };
  /** Photo-mode rewind: every hare's snapshot fields (position, action, levels, feed contact) and the clover grazed deltas;
   *  hares missing from a snapshot are hidden while it is shown. Contacts are re-begun/ended on the bus to match. */
  const snapshot: SnapshotSource<HareShot> = {
    capture: () => ({ hares: hares.map(h => ({ id: h.id, hop: h.hopPhase, a: Object.fromEntries(AGENT_SNAP.map(k => [k, structuredClone(h.agent[k])])) })),
      clover: [...CLOVER_STATE].map(([k, d]) => [k, { ...d }]) }),
    restore(shot) {
      for (const h of hares) {
        const s = shot.hares.find(e => e.id === h.id); h.root.visible = !!s; if (!s) continue;
        if (h.agent.contact) CONTACTS.end(h.agent.key, h.agent.contact);
        Object.assign(h.agent, structuredClone(s.a)); h.hopPhase = s.hop; h.x = h.agent.x; h.z = h.agent.z; h.heading = h.agent.heading;
        if (h.agent.contact) CONTACTS.begin({ a: h.agent.key, b: h.agent.contact, at: [h.x, 0, h.z], normal: [0, 1, 0], kind: 'feed', source: 'agent:feed' });
        h.root.position.set(h.x, heightAt(h.x, h.z), h.z); h.root.rotation.y = h.heading;
      }
      CLOVER_STATE.clear(); for (const [k, d] of shot.clover) CLOVER_STATE.set(k, { ...d }); clover.reload();
    },
  };
  const api = { update, snapshot, thinGrass, list: () => hares as readonly Hare[], clover, cloverDraw, CLOVER, wolf: () => lastWolf };
  (globalThis as { borealHares?: unknown }).borealHares = api; // dev handle: borealHares.list()[0].agent, borealHares.clover
  return api;
}
