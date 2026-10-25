/**
 * Controllable animals (Grok Bot). One interface for anything the player can be: a rig with an AnimalBrain the
 * player loop drives, a speed scale over the wolf-mode speeds, a camera height, and the actions it may take.
 * Rigs are created through each animal's existing public factory; no animal file is changed.
 */
import * as THREE from 'three';
import type { Player } from '../core/events';
type Action = Player['abilities'][number];
import { AnimalBrain } from '../core/animalBehavior';
import type { WolfMode } from '../core/wolfModes';
import { createPlayerWolf } from './playerWolf';
import { createDeerRig } from './animalRig';
import { createBear } from './bear';
import { createHareModel, poseHare, type HareBody, type HareModel } from '../animals/hare';
import { heightAt } from '../core/world';
import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { LOCO_FLAG, createLocoPlayer } from '../animals/locomotion/game'; // ?loco=1 only (Gait Builder)

export interface AnimateFrame { time: number; dt: number; moving: boolean; action?: 'speak' | 'gather' | 'move'; elapsed: number; mode: WolfMode; push?: { x: number; z: number; yaw: number } }
export interface PlayerRig { root: THREE.Object3D; brain: AnimalBrain; sensor: THREE.Object3D; animate(f: AnimateFrame): void }
export interface Playable {
  id: string; label: string; available: boolean; note?: string;
  speedScale: number; cameraHeight: number; actions: Action[];
  /** Whether wild deer treat this player as a predator. */ threat: boolean;
  create(): PlayerRig;
}
export const PLAYABLES: Playable[] = [
  { id: 'wolf', label: 'Grey wolf', available: true, speedScale: 1, cameraHeight: SYSTEM_PROPERTIES.camera.riderHeight, actions: ['speak', 'gather', 'move'], threat: true,
    create() { if (LOCO_FLAG) return createLocoPlayer(); const w = createPlayerWolf(); return { ...w, animate: f => w.animate(f.time, f.moving, f.action, f.elapsed, f.mode, f.push) }; } },
  { id: 'deer', label: 'White-tailed deer', available: true, speedScale: 1.15, cameraHeight: 2.2, actions: ['speak'], threat: false,
    create() { const d = createDeerRig(4242, 0); return { root: d.root, brain: d.brain, sensor: d.sensor, animate: f => d.animate(f.dt) }; } },
  { id: 'bear', label: 'Grizzly bear', available: true, speedScale: .85, cameraHeight: 2.4, actions: ['speak', 'move'], threat: true,
    create() {
      const b = createBear(7), brain = new AnimalBrain(7), sensor = new THREE.Object3D(); brain.legs = b.legs;
      sensor.position.set(0, 1.1, -1); b.root.add(sensor);
      return { root: b.root, brain, sensor, animate: f => b.animate(f.time, brain.motion, brain.phase, brain.gaitSpeed) };
    } },
  // The snowshoe hare (T-0064): the T-0009 furred rig (createHareModel) posed by the same poseHare the NPC hares use, driven by the
  // player's AnimalBrain instead of the headless sim. Speeds/stamina/needs come from HARE_NEEDS (main: needsSpecies()); eating is 'gather'.
  { id: 'hare', label: 'Snowshoe hare', available: true, speedScale: 1, cameraHeight: .8, actions: ['gather'], threat: false,
    create() {
      const m: HareModel = { ...createHareModel(), id: 0, hopPhase: 0 }, brain = new AnimalBrain(11), sensor = new THREE.Object3D(); sensor.position.set(0, .2, -.27); m.root.add(sensor);
      const ground = (x: number, z: number) => Math.max(heightAt(x, z), -.2); // as buildScene.draw places every player body
      const body: HareBody = { x: 0, z: 0, heading: 0, speed: 0, action: 'scan' };
      return { root: m.root, brain, sensor, animate(f) { // draw() has just put the root at the player's x, z and heading
        body.x = m.root.position.x; body.z = m.root.position.z; body.heading = m.root.rotation.y; body.speed = f.moving ? Math.abs(brain.speed) : 0;
        body.action = f.action === 'gather' ? 'feed' : 'scan'; // eating bows the head to the clover; otherwise the head-up scan
        poseHare(m, body, f.dt, f.time, ground);
      } };
    } },
];
export const playable = (id: string) => PLAYABLES.find(p => p.id === id && p.available) ?? PLAYABLES[0];
