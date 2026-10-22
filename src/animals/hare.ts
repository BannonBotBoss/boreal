/**
 * Snowshoe hares (Grok Bot): a standalone prey animal, outside the skeleton/species system.
 * Cartoon model (autumn moult: brown back, white feet/belly). A few live around the player and respawn elsewhere.
 * Calm: nibble and short hops. Wolf noticed: freeze (hares trust camouflage), then a zig-zag sprint that tires.
 * Caught by body contact or by a pounce (jump) that lands close. Non-gory: the hare just vanishes with a squeak.
 */
import * as THREE from 'three';
import { heightAt, WORLD_SEED } from '../core/world';
import { stream, range } from '../proc/rng';
import { LEVEL } from '../core/tuning';
import { f, scope } from '../proc/trace';
import type { SnapshotSource } from '../core/snapshot';
import { createAnimal, createWorld, removeAnimal, takeEvents, tick, type SimAnimal } from '../core/sim';
import { playerSpeed } from '../core/playerTuning';
import type { WolfMode } from '../core/wolfModes';

export const HARE = {
  count: 5, spawnMin: 18, spawnMax: 45, despawn: 70, respawnSeconds: [25, 45] as [number, number],
  // T-0036: notice/bolt come from the template senses + flight distance, flight from behaviour.evasion (core/needs/diet),
  // catch radii and safe distance from SYSTEM_PROPERTIES.hunt, the meal from diet.foods.hare.
  freezeSeconds: [.6, 1.6] as [number, number], stamina: 40,
};
export type HareState = 'nibble' | 'hop' | 'freeze' | 'flee';
export interface Hare { sim: SimAnimal; id: number; x: number; z: number; heading: number; state: HareState; timer: number; flee: number; zig: number; hopPhase: number; root: THREE.Group; rng: () => number }
export interface HareEvent { type: 'caught' | 'bolt' | 'hop'; x: number; z: number }
export interface WolfInfo { x: number; z: number; mode: string; moving: boolean; pouncing: boolean; daylight?: number; wind?: { x: number; z: number } }

function model() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const brown = new THREE.MeshStandardMaterial({ color: 0x8a6d4e, flatShading: true, roughness: 1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf1ede4, flatShading: true, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2420, flatShading: true, roughness: 1 });
  const blob = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.x = rx; body.add(mesh); return mesh;
  };
  blob(brown, 0, .2, .02, .14, .14, .22); blob(white, 0, .14, 0, .12, .09, .18);
  blob(brown, 0, .33, -.17, .09, .09, .1); blob(white, 0, .3, -.25, .05, .045, .05);
  for (const s of [-1, 1]) { blob(brown, s * .04, .47, -.14, .025, .1, .035, -.25); blob(dark, s * .04, .56, -.12, .02, .03, .025); blob(dark, s * .055, .35, -.24, .012, .014, .012); blob(white, s * .07, .05, .12, .04, .05, .12); }
  blob(white, 0, .24, .24, .05, .05, .05);
  root.scale.setScalar(1.25); return { root, body };
}

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
      const { root } = model(); scene.add(root);
      const sim = createAnimal(world, 'hare', { x, z });
      root.userData.inspect = { type: 'hare', key: `hare:${sim.id}` };
      hares.push({ id: sim.id, sim, x, z, heading: sim.heading, state: 'nibble', timer: sim.timer, flee: 0, zig: 0, hopPhase: 0, root, rng: sim.rng });
      return;
    }
  }
  function remove(h: Hare, fromSim = true) {
    scene.remove(h.root); h.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    hares.splice(hares.indexOf(h), 1); if (fromSim) removeAnimal(world, h.sim);
  }
  const STATE: Record<string, HareState> = { graze: 'nibble', move: 'hop', freeze: 'freeze', flee: 'flee' };
  let time = 0;
  function update(dt: number, wolf: WolfInfo): HareEvent[] {
    const events: HareEvent[] = []; time += dt;
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
    for (const h of hares) {
      const a = h.sim, prev = h.state; h.x = a.x; h.z = a.z; h.heading = a.heading; h.state = STATE[a.state] ?? 'nibble';
      if (h.state === 'hop' && prev !== 'hop' && Math.hypot(a.x - wolf.x, a.z - wolf.z) < 30) events.push({ type: 'hop', x: a.x, z: a.z });
      scope(`hare:${h.id}`); f('hare', 'state', h.state); f('hare', 'perceived', a.level); f('hare', 'knows', a.knowsAt ?? -1); f('hare', 'linked', a.linked); f('hare', 'speed', a.speed); scope('');
      const speed = a.speed; h.hopPhase += speed > 0 ? dt * (speed > 3 ? 7 : 4) : 0;
      const hop = speed > 0 ? Math.abs(Math.sin(h.hopPhase * Math.PI)) * (speed > 3 ? .28 : .12) : 0;
      h.root.position.set(h.x, heightAt(h.x, h.z) + hop, h.z); h.root.rotation.y = h.heading;
      const body = h.root.children[0]; body.rotation.x = h.state === 'nibble' ? Math.sin(time * 9 + h.id) * .03 + .12 : h.state === 'freeze' ? -.05 : -Math.sin(h.hopPhase * Math.PI) * .2;
    }
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
      }
    },
  };
  return { update, snapshot, list: () => hares as readonly Hare[] };
}
