/**
 * ONE registry of how every piece of object state relates to time (Grok Bot; Matthew's pause rule).
 *  'clock'    : a function of the world clock (core/worldClock) + seed: age, growth, ripeness, decay, seasons, time of
 *               day, weather, ground ageing. While the start/pause menu is open the world clock is frozen, so these hold.
 *  'snapshot' : dynamic / interaction state (position, pose, velocity, current action) and ALL vitals (health, hunger,
 *               thirst, energy, stamina). Held by not simulating while the menu is open; resume continues from that state.
 * Only age / growth / ripeness / decay / season fields are 'clock' (they advance only while playing).
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
    gaitName: 'snapshot', // T-0003: last gait, the Froude-hysteresis input of gaitFor
    prevPhase: 'snapshot', drawAlpha: 'snapshot', // render interpolation between fixed sim steps (core/drawLerp)
    legs: 'clock', gaitSpeed: 'clock', seed: 'clock', // body build: from seed (+ age)
    stored: 'snapshot' }, // T-0092 mirror of the store record. The live age clock stays player.bornSec.
  /** core/wolfModes state (the player's animal) */
  modes: { stamina: 'snapshot', maxStamina: 'clock', mode: 'snapshot', first: 'snapshot', left: 'snapshot', right: 'snapshot',
    sprintTime: 'snapshot', sprintSpent: 'snapshot', exhausted: 'snapshot' },
  /** core/needs NeedsState (T-0036; Energy stays on the brain) */
  needs: { water: 'snapshot', rest: 'snapshot' },
  /** main.ts player record */
  player: { x: 'snapshot', z: 'snapshot', heading: 'snapshot', abilities: 'snapshot', bornSec: 'clock' }, // age from world clock (frozen with the menu)
  /** core/agent Agent (T-0009). Species and the seeded rng are identity; levels and the plan are vitals. */
  agent: { key: 'clock', species: 'clock', rng: 'clock',
    x: 'snapshot', z: 'snapshot', heading: 'snapshot', action: 'snapshot', goal: 'snapshot', timer: 'snapshot', elapsed: 'snapshot',
    energy: 'snapshot', stamina: 'snapshot', relaxation: 'snapshot', target: 'snapshot', food: 'snapshot', contact: 'snapshot',
    zig: 'snapshot', bitten: 'snapshot', sensed: 'snapshot', speed: 'snapshot' },
  /** core/fields CloverPatch. Place and capacity come from the seed; units, the grazed clock, stolon and why change when eaten. */
  cloverPatch: { key: 'clock', x: 'clock', z: 'clock', r: 'clock', light: 'clock', max: 'clock',
    units: 'snapshot', at: 'snapshot', stolon: 'snapshot', why: 'snapshot' },
  /** world-wide fields */
  world: { timeOfDay: 'clock', season: 'clock', weather: 'clock', groundYears: 'clock', deltaExpiry: 'clock', standAge: 'clock',
    cloverRegrowth: 'clock' },
} as const satisfies Record<string, Record<string, TimeTag>>;
export type StateGroup = keyof typeof STATE_FIELDS;
export const tagOf = (group: StateGroup, field: string): TimeTag | undefined => (STATE_FIELDS[group] as Record<string, TimeTag>)[field];
/** Keys of `obj` that the registry does not know (the test asserts this is empty). */
export const untagged = (group: StateGroup, obj: object) => Object.keys(obj).filter(k => !tagOf(group, k));
