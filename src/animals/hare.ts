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
import { windAt, climate, WEATHER } from '../core/weather';
import { siteAt, footprintsIn, covered } from '../core/flora/site';
import { createCloverField, cloverSuitability, CLOVER } from '../core/clover';
import { createAgent, stepAgent, poseOf, actionName, moods, modulators, type Agent, type Other } from '../core/agent/pipeline';
import { HARE_AGENT } from '../core/agent/species';
import { CONTACTS } from '../core/contactBus';
import { createCloverRenderer } from '../render/clover';
import type { SnapshotSource } from '../core/snapshot';

export const HARE = {
  count: 5, spawnMin: 18, spawnMax: 45, despawn: 70, respawnSeconds: [25, 45] as [number, number], nearClover: .75,
  catchContact: 1.3, catchPounce: 2.4, energy: 35, stamina: 40, cloverRadius: 48,
};
export type HareState = Agent['action'];
export interface Hare { id: number; x: number; z: number; heading: number; readonly state: HareState; agent: Agent; hopPhase: number; root: THREE.Group; head: THREE.Group; body: THREE.Group; rng: () => number; label?: THREE.Sprite }
export interface HareEvent { type: 'caught' | 'bolt' | 'hop'; x: number; z: number }
/** speed (m/s) and daylight (0..1) feed the hare's senses; `moving` is kept for older callers (speed defaults from it). */
export interface WolfInfo { x: number; z: number; mode: string; moving: boolean; pouncing: boolean; speed?: number; daylight?: number }
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).get('hare') === 'debug';

function model() {
  const root = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group(); root.add(body); body.add(head); head.position.set(0, .3, -.12);
  const brown = new THREE.MeshStandardMaterial({ color: 0x8a6d4e, flatShading: true, roughness: 1 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf1ede4, flatShading: true, roughness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b2420, flatShading: true, roughness: 1 });
  const blob = (parent: THREE.Group, m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rx = 0) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.x = rx; parent.add(mesh); return mesh;
  };
  blob(body, brown, 0, .2, .02, .14, .14, .22); blob(body, white, 0, .14, 0, .12, .09, .18);
  blob(head, brown, 0, .03, -.05, .09, .09, .1); blob(head, white, 0, 0, -.13, .05, .045, .05);
  for (const s of [-1, 1]) { blob(head, brown, s * .04, .17, -.02, .025, .1, .035, -.25); blob(head, dark, s * .04, .26, 0, .02, .03, .025); blob(head, dark, s * .055, .05, -.12, .012, .014, .012); blob(body, white, s * .07, .05, .12, .04, .05, .12); }
  blob(body, white, 0, .24, .24, .05, .05, .05);
  root.scale.setScalar(1.25); return { root, body, head };
}
/** Pose targets per pipeline pose: body pitch (rad, + = front up), body lift (m), head pitch (+ = nose up), head drop/forward (m). */
const POSES = { 'head-down': [-.22, -.02, -1.0, -.11, -.08], 'head-up': [.28, .03, .3, .02, 0], move: [-.05, 0, -.1, 0, 0], run: [-.1, 0, .05, 0, 0], rest: [-.05, -.04, -.15, -.02, 0], crouch: [-.08, -.06, -.25, -.05, .02] } as const;

function labelSprite() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 176;
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(3.4, .94, 1); s.renderOrder = 999;
  s.userData.draw = (lines: string[], colour = '#f4f1e6') => { const g = canvas.getContext('2d')!; g.clearRect(0, 0, 640, 176); g.font = 'bold 30px monospace'; const w = Math.min(640, 20 + Math.max(...lines.map(l => g.measureText(l).width)));
    g.fillStyle = 'rgba(12,16,12,.78)'; g.fillRect((640 - w) / 2, 0, w, 16 + lines.length * 38); g.fillStyle = colour; lines.forEach((l, i) => g.fillText(l, (640 - w) / 2 + 10, 36 + i * 38)); tex.needsUpdate = true; };
  return s;
}

export function createHares(scene: THREE.Scene) {
  const hares: Hare[] = []; let nextId = 1; const pending: number[] = [];
  const spawnRng = stream(WORLD_SEED, 'hares-v1'); // seeded: one stream for placement, one per hare id for behaviour
  const clover = createCloverField((x, z) => siteAt(x, z), (x, z, r) => covered(footprintsIn(x - r, z - r, x + r, z + r), x, z, r * .5));
  const cloverDraw = createCloverRenderer(scene, clover);
  const walkable = (x: number, z: number) => heightAt(x, z) > LEVEL.hareWater;
  const habitat = (x: number, z: number) => cloverSuitability(siteAt(x, z));
  const patchLabels: THREE.Sprite[] = [];
  function spawn(px: number, pz: number) {
    const near = [...clover.list()].filter(p => { const d = Math.hypot(p.x - px, p.z - pz); return d > HARE.spawnMin && d < HARE.spawnMax && p.units > 0; });
    for (let tries = 0; tries < 12; tries++) {
      const a = spawnRng() * Math.PI * 2, d = range(spawnRng, [HARE.spawnMin, HARE.spawnMax]), pick = spawnRng(), onClover = near.length > 0 && spawnRng() < HARE.nearClover;
      const p = onClover ? near[Math.floor(pick * near.length)] : undefined;
      const x = p ? p.x + Math.sin(a) * p.r * .5 : px + Math.sin(a) * d, z = p ? p.z + Math.cos(a) * p.r * .5 : pz + Math.cos(a) * d;
      if (heightAt(x, z) < LEVEL.shore) continue;
      const { root, body, head } = model(); scene.add(root);
      const id = nextId++; root.userData.inspect = { type: 'hare', key: `hare:${id}` }; const rng = stream(WORLD_SEED, `hare-v1:${id}`);
      const agent = createAgent(HARE_AGENT, `hare:${id}`, x, z, rng, { energy: 55 + rng() * 40, relaxation: 80 + rng() * 20 });
      const h: Hare = { id, x, z, heading: agent.heading, get state() { return agent.action; }, agent, hopPhase: 0, root, body, head, rng };
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
    clover.ensure(wolf.x, wolf.z, HARE.cloverRadius, 1); clover.regrow(dt, daylight, climate(WEATHER.day, WEATHER.hour).tC, WEATHER.day); cloverDraw.update(dt);
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
      // pose: hop arc while moving, head down to graze, head up to scan / alert
      const pose = POSES[poseOf(a)], k = 1 - Math.exp(-dt * 8);
      h.hopPhase += a.speed > 0 ? dt * (a.speed > 3 ? 7 : a.speed > .8 ? 4.5 : 3) : 0;
      const hop = a.speed > 0 ? Math.abs(Math.sin(h.hopPhase * Math.PI)) * (a.speed > 3 ? .28 : a.speed > .8 ? .1 : .03) : 0;
      h.root.position.set(a.x, heightAt(a.x, a.z) + hop, a.z); h.root.rotation.y = a.heading;
      const nibble = a.action === 'feed' ? Math.sin(time * 9 + h.id) * .05 : 0, hopPitch = a.speed > .8 ? -Math.sin(h.hopPhase * Math.PI) * .2 : 0;
      h.body.rotation.x += (pose[0] + hopPitch - h.body.rotation.x) * k; h.body.position.y += (pose[1] - h.body.position.y) * k;
      h.head.rotation.x += (pose[2] + nibble - h.head.rotation.x) * k; h.head.position.y += (.3 + pose[3] - h.head.position.y) * k; h.head.position.z += (-.12 + pose[4] - h.head.position.z) * k;
    }
    if (DEBUG && (labelWait -= dt) <= 0) { labelWait = .25; debugLabels(wolf); }
    return events;
  }
  function debugLabels(wolf: WolfInfo) {
    for (const h of hares) { const a = h.agent, m = modulators(a, a.sensed.level), md = moods(a), p = a.food ? clover.get(a.food) : a.target?.key ? clover.get(a.target.key) : undefined;
      h.label!.position.set(a.x, heightAt(a.x, a.z) + 1.25, a.z);
      h.label!.userData.draw([`${actionName(a)}`, `why: ${a.goal}`.slice(0, 40), `E ${a.energy.toFixed(1)} S ${a.stamina.toFixed(0)} R ${a.relaxation.toFixed(0)} hunger ${md.hunger.toFixed(2)}`,
        `threat ${a.sensed.level.toFixed(2)} (notice ${m.noticeAt.toFixed(2)})${p ? ` clover ${Math.round(p.units)}` : ''}`], a.action === 'flee' ? '#ffb4a0' : a.action === 'alert' ? '#ffe39a' : '#f4f1e6'); }
    const near = [...clover.list()].map(p => ({ p, d: Math.hypot(p.x - wolf.x, p.z - wolf.z) })).filter(e => e.d < 14).sort((a, b) => a.d - b.d).slice(0, 6);
    while (patchLabels.length < near.length) { const s = labelSprite(); s.scale.set(2, .55, 1); scene.add(s); patchLabels.push(s); }
    patchLabels.forEach((s, i) => { const e = near[i]; s.visible = !!e; if (!e) return; s.position.set(e.p.x, heightAt(e.p.x, e.p.z) + .45, e.p.z);
      s.userData.draw([`${Math.round(e.p.units)}/${e.p.max} (${Math.round(100 * e.p.units / e.p.max)}%)${e.p.units <= 0 ? ' grazed out' : ''}`, `${(e.p.units * CLOVER.mgPerUnit / 1000).toFixed(0)} g leaf, stolon ${e.p.stolon.toFixed(0)} g`], '#c8f0a8'); });
  }
  type HareShot = [number, number, number, number, number][];
  /** Photo-mode rewind: positions only; hares missing from a snapshot are hidden while it is shown. */
  const snapshot: SnapshotSource<HareShot> = {
    capture: () => hares.map(h => [h.id, h.x, h.z, h.heading, h.hopPhase]),
    restore(shot) {
      for (const h of hares) {
        const s = shot.find(e => e[0] === h.id); h.root.visible = !!s; if (!s) continue;
        [, h.x, h.z, h.heading, h.hopPhase] = s; h.root.position.set(h.x, heightAt(h.x, h.z), h.z); h.root.rotation.y = h.heading;
      }
    },
  };
  const api = { update, snapshot, list: () => hares as readonly Hare[], clover, cloverDraw, CLOVER, wolf: () => lastWolf };
  (globalThis as { borealHares?: unknown }).borealHares = api; // dev handle: borealHares.list()[0].agent, borealHares.clover
  return api;
}
