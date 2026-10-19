/**
 * Gait readout (T-0002, grok-gait): what the default rig's gait is doing right now, for the inspector and the locomotion lab.
 * Cadence = speed / stride (the phase advances by distance / cycle in AnimalBrain.expend); airborne = every foot is in swing.
 */
import { gaitFor, type LegDims, type Motion } from './animalBehavior';
import { gravity } from '../proc/physics';

export interface GaitReadout { gait: string; froude: number; hz: number; stride: number; duty: number; airborne: boolean }
const frac = (v: number) => v - Math.floor(v);
export function gaitReadout(motion: Motion, speed: number, legs: LegDims, phase: number): GaitReadout {
  const v = Math.abs(speed), froude = v * v / (gravity() * legs.hip), g = gaitFor(motion, speed, legs);
  if (!g) return { gait: motion, froude, hz: 0, stride: 0, duty: 1, airborne: motion === 'jump' };
  return { gait: g.name, froude, hz: v / g.cycle, stride: g.cycle, duty: g.duty, airborne: g.offsets.every(o => frac(phase + o) >= g.duty) };
}
export const formatGait = (r: GaitReadout) =>
  `${r.gait}  Fr ${r.froude.toFixed(2)}  ${r.hz.toFixed(2)} Hz  stride ${r.stride.toFixed(2)} m  duty ${r.duty.toFixed(2)}  ${r.airborne ? 'AIRBORNE' : 'ground'}`;