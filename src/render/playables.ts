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

export interface AnimateFrame { time: number; dt: number; moving: boolean; action?: 'speak' | 'gather' | 'move'; elapsed: number; mode: WolfMode; push?: { x: number; z: number; yaw: number } }
export interface PlayerRig { root: THREE.Object3D; brain: AnimalBrain; sensor: THREE.Object3D; animate(f: AnimateFrame): void }
export interface Playable {
  id: string; label: string; available: boolean; note?: string;
  speedScale: number; cameraHeight: number; actions: Action[];
  /** Whether wild deer treat this player as a predator. */ threat: boolean;
  create(): PlayerRig;
}
export const PLAYABLES: Playable[] = [
  { id: 'wolf', label: 'Grey wolf', available: true, speedScale: 1, cameraHeight: 1.6, actions: ['speak', 'gather', 'move'], threat: true,
    create() { const w = createPlayerWolf(); return { ...w, animate: f => w.animate(f.time, f.moving, f.action, f.elapsed, f.mode, f.push) }; } },
  { id: 'deer', label: 'White-tailed deer', available: true, speedScale: 1.15, cameraHeight: 2.2, actions: ['speak'], threat: false,
    create() { const d = createDeerRig(4242, 0); return { root: d.root, brain: d.brain, sensor: d.sensor, animate: f => d.animate(f.dt) }; } },
  { id: 'bear', label: 'Grizzly bear', available: true, speedScale: .85, cameraHeight: 2.4, actions: ['speak', 'move'], threat: true,
    create() {
      const b = createBear(7), brain = new AnimalBrain(7), sensor = new THREE.Object3D(); brain.legs = b.legs;
      sensor.position.set(0, 1.1, -1); b.root.add(sensor);
      return { root: b.root, brain, sensor, animate: f => b.animate(f.time, brain.motion, brain.phase, brain.gaitSpeed) };
    } },
  { id: 'hare', label: 'Snowshoe hare', available: false, note: 'coming soon (needs a skeleton rig)', speedScale: 1, cameraHeight: 1, actions: [], threat: false, create() { throw new Error('not playable yet'); } },
];
export const playable = (id: string) => PLAYABLES.find(p => p.id === id && p.available) ?? PLAYABLES[0];
