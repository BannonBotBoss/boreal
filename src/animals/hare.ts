/**
 * Snowshoe hares (Grok Bot): a standalone prey animal, outside the skeleton/species system.
 * Cartoon model (autumn moult: brown back, white feet/belly). A few live around the player and respawn elsewhere.
 * Calm: nibble and short hops. Wolf noticed: freeze (hares trust camouflage), then a zig-zag sprint that tires.
 * Caught by body contact or by a pounce (jump) that lands close. Non-gory: the hare just vanishes with a squeak.
 */
import * as THREE from 'three';
import { heightAt, WORLD_SEED } from '../core/world';
import { stream, range } from '../proc/rng';

export const HARE = {
  count: 5, spawnMin: 18, spawnMax: 45, despawn: 70, respawnSeconds: [25, 45] as [number, number],
  notice: { walk: 14, run: 18, stealth: 7, 'super-stealth': 3.5 } as Record<string, number>,
  freezeSeconds: [.6, 1.6] as [number, number], bolt: { walk: 5, run: 7, stealth: 2.5, 'super-stealth': 1.8 } as Record<string, number>,
  burstSpeed: 8.5, burstSeconds: 2.5, tiredSpeed: 5, zigEvery: [.45, .9] as [number, number], zigAngle: .9, safeDistance: 35,
  catchContact: 1.3, catchPounce: 2.4, energy: 35, stamina: 40,
};
export type HareState = 'nibble' | 'hop' | 'freeze' | 'flee';
export interface Hare { id: number; x: number; z: number; heading: number; state: HareState; timer: number; flee: number; zig: number; hopPhase: number; root: THREE.Group; rng: () => number }
export interface HareEvent { type: 'caught' | 'bolt' | 'hop'; x: number; z: number }
export interface WolfInfo { x: number; z: number; mode: string; moving: boolean; pouncing: boolean }

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
  const hares: Hare[] = []; let nextId = 1; const pending: number[] = [];
  const spawnRng = stream(WORLD_SEED, 'hares-v1'); // seeded: one stream for placement, one per hare id for behaviour
  function spawn(px: number, pz: number) {
    for (let tries = 0; tries < 12; tries++) {
      const a = spawnRng() * Math.PI * 2, d = range(spawnRng, [HARE.spawnMin, HARE.spawnMax]), x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
      if (heightAt(x, z) < .5) continue;
      const { root } = model(); scene.add(root);
      const id = nextId++, rng = stream(WORLD_SEED, `hare-v1:${id}`);
      hares.push({ id, x, z, heading: rng() * 6.3, state: 'nibble', timer: range(rng, [1, 4]), flee: 0, zig: 0, hopPhase: 0, root, rng });
      return;
    }
  }
  function remove(h: Hare) {
    scene.remove(h.root); h.root.traverse(o => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    hares.splice(hares.indexOf(h), 1);
  }
  let time = 0;
  function update(dt: number, wolf: WolfInfo): HareEvent[] {
    const events: HareEvent[] = []; time += dt;
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i] <= time) { pending.splice(i, 1); spawn(wolf.x, wolf.z); }
    while (hares.length + pending.length < HARE.count) spawn(wolf.x, wolf.z);
    for (const h of [...hares]) {
      const dx = h.x - wolf.x, dz = h.z - wolf.z, d = Math.hypot(dx, dz);
      if (d > HARE.despawn) { remove(h); continue; }
      if (d < HARE.catchContact || (wolf.pouncing && d < HARE.catchPounce)) {
        events.push({ type: 'caught', x: h.x, z: h.z }); remove(h); pending.push(time + range(h.rng, HARE.respawnSeconds)); continue;
      }
      const noticeAt = HARE.notice[wolf.mode] ?? 14, boltAt = HARE.bolt[wolf.mode] ?? 5;
      let speed = 0; h.timer -= dt; const rand = (a: number, b: number) => range(h.rng, [a, b]);
      if (h.state !== 'flee' && h.state !== 'freeze' && d < noticeAt && (wolf.moving || d < boltAt)) { h.state = 'freeze'; h.timer = rand(...HARE.freezeSeconds); }
      // A stalking (stealth) wolf keeps a hare frozen, trusting its camouflage, until it is very close.
      const stalking = wolf.mode.includes('stealth');
      if (h.state === 'freeze' && (d < boltAt || h.timer <= 0 && d < noticeAt && !stalking)) { h.state = 'flee'; h.flee = 0; h.zig = 0; h.heading = Math.atan2(dx, dz) + Math.PI; events.push({ type: 'bolt', x: h.x, z: h.z }); }
      else if (h.state === 'freeze' && h.timer <= 0 && d >= noticeAt) { h.state = 'nibble'; h.timer = rand(2, 5); }
      if (h.state === 'flee') {
        h.flee += dt; h.zig -= dt;
        if (h.zig <= 0) { h.zig = rand(...HARE.zigEvery); h.heading = Math.atan2(dx, dz) + Math.PI + (h.rng() < .5 ? -1 : 1) * HARE.zigAngle * h.rng(); }
        speed = h.flee < HARE.burstSeconds ? HARE.burstSpeed : HARE.tiredSpeed;
        if (d > HARE.safeDistance) { h.state = 'nibble'; h.timer = rand(3, 6); }
      } else if (h.state === 'hop') { speed = 1.6; if (h.timer <= 0) { h.state = 'nibble'; h.timer = rand(2, 6); } }
      else if (h.state === 'nibble' && h.timer <= 0) { h.state = 'hop'; h.timer = rand(.6, 1.4); h.heading += rand(-1.2, 1.2); if (d < 30) events.push({ type: 'hop', x: h.x, z: h.z }); }
      // Move (hares turn back from water and steep ground), then animate the hop.
      const nx = h.x - Math.sin(h.heading) * speed * dt, nz = h.z - Math.cos(h.heading) * speed * dt;
      if (speed > 0) { if (heightAt(nx, nz) > .15) { h.x = nx; h.z = nz; } else h.heading += Math.PI * .6; }
      h.hopPhase += speed > 0 ? dt * (speed > 3 ? 7 : 4) : 0;
      const hop = speed > 0 ? Math.abs(Math.sin(h.hopPhase * Math.PI)) * (speed > 3 ? .28 : .12) : 0;
      h.root.position.set(h.x, heightAt(h.x, h.z) + hop, h.z); h.root.rotation.y = h.heading;
      const body = h.root.children[0]; body.rotation.x = h.state === 'nibble' ? Math.sin(time * 9 + h.id) * .03 + .12 : h.state === 'freeze' ? -.05 : -Math.sin(h.hopPhase * Math.PI) * .2;
    }
    return events;
  }
  return { update, list: () => hares as readonly Hare[] };
}
