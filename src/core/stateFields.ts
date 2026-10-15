/**
 * ONE registry of how every piece of object state relates to time (Grok Bot; Matthew's pause rule).
 *  'clock'    : a function of the world clock (core/worldClock) + seed: age, growth, ripeness, decay, seasons, time of
 *               day, weather, ground ageing. Always follows world time, also in-radius during pause; never snapshotted.
 *  'snapshot' : dynamic / interaction state (position, pose, velocity, current action, health). Captured at pause and
 *               restored exactly on resume.
 *               ALL vitals (health, hunger, thirst, energy, stamina) are pure snapshot: restored exactly, no clock part.
 * Only age / growth / ripeness / decay / season fields are 'clock'.
 * tests/stateFields.test.ts fails on any field of the sampled state objects that is not tagged here.
 */
export type TimeTag = 'clock' | 'snapshot';
export const STATE_FIELDS = {
  /** core/world Entity (generated individuals) */
  entity: { key: 'clock', kind: 'clock', seed: 'clock', generatorVersion: 'clock', // identity: derived from seed, never snapshotted
    x: 'snapshot', z: 'snapshot', rotation: 'snapshot', rollX: 'snapshot', rollZ: 'snapshot',
    scale: 'clock',        // size grows with age
    energy: 'snapshot' },  // vital
  /** core/animalBehavior AnimalBrain (Claude's file: read-only here) */
  brain: { energy: 'snapshot', motion: 'snapshot', problem: 'snapshot', phase: 'snapshot', jumpTime: 'snapshot', jumpCooldown: 'snapshot',
    heading: 'snapshot', speed: 'snapshot', near: 'snapshot', middle: 'snapshot', far: 'snapshot', target: 'snapshot', time: 'snapshot',
    avoidTime: 'snapshot', feedTime: 'snapshot', meal: 'snapshot', alarm: 'snapshot', lastThreat: 'snapshot',
    legs: 'clock', gaitSpeed: 'clock', seed: 'clock' }, // body build: from seed (+ age)
  /** core/wolfModes state (the player's animal) */
  modes: { stamina: 'snapshot', maxStamina: 'clock', mode: 'snapshot', first: 'snapshot', left: 'snapshot', right: 'snapshot',
    sprintTime: 'snapshot', sprintSpent: 'snapshot', exhausted: 'snapshot' },
  /** main.ts player record */
  player: { x: 'snapshot', z: 'snapshot', heading: 'snapshot', abilities: 'snapshot', bornSec: 'clock' }, // age = clock (core/lifespan)
  /** world-wide fields */
  world: { timeOfDay: 'clock', season: 'clock', weather: 'clock', groundYears: 'clock', deltaExpiry: 'clock', standAge: 'clock' },
} as const satisfies Record<string, Record<string, TimeTag>>;
export type StateGroup = keyof typeof STATE_FIELDS;
export const tagOf = (group: StateGroup, field: string): TimeTag | undefined => (STATE_FIELDS[group] as Record<string, TimeTag>)[field];
/** Keys of `obj` that the registry does not know (the test asserts this is empty). */
export const untagged = (group: StateGroup, obj: object) => Object.keys(obj).filter(k => !tagOf(group, k));
/** Pause: copy the snapshot fields. Clock fields are deliberately not copied. */
export function snapshot<T extends object>(group: StateGroup, obj: T): Partial<T> {
  const out: Partial<T> = {}; for (const k of Object.keys(obj) as (keyof T & string)[]) if (tagOf(group, k) === 'snapshot') out[k] = structuredClone(obj[k]);
  return out;
}
/** Resume: write the snapshot back exactly (clock fields keep their world-clock values). */
export const restore = <T extends object>(obj: T, snap: Partial<T>) => Object.assign(obj, snap);
