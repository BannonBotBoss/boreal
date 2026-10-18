/**
 * Locomotion layer (Grok Bot / Gait Builder): shared types. Behaviour hands us signals; we hand back a leg pose in the
 * same shape as core/animalBehavior quadrupedPose() plus root height/pitch/roll and foot contacts.
 * Leg order everywhere: LF, LH, RF, RH (front = even index), −z is forward, heading 0 faces −z (proc/math stepForward).
 */
import type { LegDims } from '../../core/animalBehavior';

export type GaitId = 'walk' | 'trot' | 'pace' | 'canter' | 'gallop' | 'bound' | 'pronk';
export type Lod = 'near' | 'mid';
export const LEG_NAMES = ['LF', 'LH', 'RF', 'RH'] as const;

/** What behaviour asks for this frame. The caller owns the body position (x, z) and moves it. */
export interface LocoSignals {
  x: number; z: number;
  /** rad, 0 = facing −z */ heading: number;
  /** m/s along the heading; negative walks backward */ speed: number;
  /** optional gait override; default is the Froude choice of core/animalBehavior gaitFor */ gait?: GaitId;
  /** reserved for milestone 2 (jump / pounce / stop) */ intent?: { kind: 'jump' | 'pounce' | 'stop'; target?: { x: number; z: number } };
}

/** Body plan the layer needs: limb dimensions and the hip/shoulder ground points in the body frame (x right, z back). */
export interface LegLayout { legs: LegDims; hips: ReadonlyArray<readonly [number, number]> }

/** Ground height as a function of world x, z (core/world heightAt has this shape). */
export type TerrainFn = (x: number, z: number) => number;

export interface Vec3 { x: number; y: number; z: number }

/** Output pose. Angle arrays follow quadrupedPose(); `abduct` is the sideways swing of each limb (rotation about z). */
export interface LegPose {
  girdles: number[]; legs: number[]; knees: number[]; wrists: number[]; paws: number[]; abduct: number[];
  /** foot (sole) world positions */ feet: Vec3[];
  contacts: boolean[];
  /** body-frame origin: ground point under the body centre (world y), plus tilt */ height: number; pitch: number; roll: number;
  gait: GaitId; phases: number[]; duty: number; cycle: number; froude: number;
  /** walking carry for head and tail (posture.ts): head pitch rad, head drop as a share of the rig's head drop, tail drop rad */
  carry?: { head: number; drop: number; tail: number };
  /** paws that touched down this frame (contact went false → true); empty on most frames */
  touchdowns: Touchdown[];
}

/**
 * Paw-touchdown event, for footstep audio, dust and prints. One per leg per stance (a jump landing gives one per paw).
 * strength 0..1: 0.3 at a slow walk rising with √Froude to 1 at a fast gallop; 1 for a jump landing.
 */
export interface Touchdown { leg: number; /** LF, LH, RF, RH */ name: typeof LEG_NAMES[number]; worldPos: Vec3; speed: number; gait: GaitId; strength: number; landing: boolean }
