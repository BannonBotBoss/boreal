/**
 * Species records for the shared animal pipeline (core/agent/pipeline). Every radius, rate, bout length, speed and diet row
 * lives here; the pipeline has no species-specific numbers. A new animal = a new record (deer, people and the wolf's
 * autonomous mode are meant to move onto this; see AGENT-NOTES / the rabbit-clover report).
 */
import type { BoundGait } from './bound';
export interface AgentSpecies {
  id: string;
  /** display words for actions (the debug readout and future UI) */ labels: Partial<Record<string, string>>;
  senses: {
    /** range m; night = vision floor in the dark (0..1); motion = speed (m/s) band from 'not moving' to 'clearly moving';
     *  presence = m within which a still body is seen; crouched = presence factor for a crouched body; movingAt = motion share
     *  that counts as moving */
    sight: { range: number; night: number; motion: [number, number]; presence: number; crouched: number; movingAt: number };
    /** range m; loud = speed band (m/s) from silent to loud footfalls; movingAt = sound level that counts as moving */
    hearing: { range: number; loud: [number, number]; movingAt: number };
    /** potency of an other's scent at this nose (core/senses scentLevel plume) */ scent: { potency: number };
  };
  /** how much each kind of other is feared (0 = ignored) */ fear: Record<string, number>;
  levels: {
    /** energy 0..max; drain per s at rest; fleeMult x drain while fleeing; fed = above this no hunger; full = rests to digest */
    energy: { max: number; start: number; drain: number; fleeMult: number; fed: number; full: number };
    /** stamina: fleeing empties it in drainSeconds; recovers 0 -> max in recoverSeconds of not fleeing */
    stamina: { max: number; drainSeconds: number; recoverSeconds: number };
    /** relaxation: settles toward max x (1 - cue / panic) (habituation to a steady cue); falls at threatDrop x cue per s, recovers
     *  at `recover` per s, and drops a further fleeDrop per s while fleeing */
    relaxation: { max: number; threatDrop: number; fleeDrop: number; recover: number; panic: number };
  };
  /** typical seconds for a calm, fed animal; jitter = +- share of natural variation; react = s before a moving cue can bolt it */
  timing: { feed: number; scan: number; alert: number; alertMin: number; /** s an alert animal holds (freezes) before a moving or rising cue may bolt it */ react: number; /** rad/s the body turns toward the cue while alert (default 4); 0 = a motionless freeze */ alertTurn?: number; flee: number; pause: number; rest: [number, number]; jitter: number };
  /** how relaxation (calm/nerve), hunger and cue strength bend the timings and thresholds (pipeline `modulators`) */
  mood: { boutNerve: number; boutHunger: number; scanChance: [number, number]; scanHunger: number; scanNerve: number; scanHungerShort: number;
    notice: [number, number]; noticeHunger: number; bolt: [number, number]; boltHunger: number; fleeNerve: number; fleeStaminaFull: number;
    pauseNerve: number; resume: number; unhide: number };
  /** relaxed-choice utilities (pipeline `decide`) */
  utility: { feedHere: number; approach: number; approachDistance: number; rest: number; restFull: number; restBase: number; scan: number; seek: number; seekBase: number; noise: number };
  /** m: food sensed within `food`; habitat probed at `seek`; a feeding step [min, max] and turn (rad); giveUp s for a move */
  reach: { food: number; seek: number; step: [number, number]; stepTurn: number; giveUp: number };
  speed: { feedStep: number; approach: number; flee: number; fleeTired: number; /** m/s^2 from a standstill into flight; omitted = instant */ accel?: number };
  flee: { burstSeconds: number; zig: [number, number]; zigAngle: number; /** flight initiation distance (m): a threat this close bolts it at once */ distance?: number };
  /** per food kind: units eaten per eatSeconds, units per +1 energy */ diet: Record<string, { eatUnits: number; eatSeconds: number; unitsPerEnergy: number }>;
  /** asymmetric bounding gait for the host's legs (core/agent/bound); optional */ gait?: BoundGait;
}

/** Snowshoe hare (Lepus americanus). Matthew's numbers are the calm, fed defaults: graze 3 s, head up 1 s, sprint 3 s, pause
 *  1 s; stamina emptied by 8 s of flight, refilled by 8 s of rest. Energy and diet are nature-checked (notes/grok.md):
 *  energy 100 = one summer day's food, 167 g DM (captive snowshoe hares, Seeley Lake MT, UMT thesis); spent over a real day
 *  (100 per 86 400 s), x8 in flight [estimate: sprint vs daily-average metabolism, verify]. Clover (1 unit = 15 mg DM, core/
 *  clover): 167 g = 11 133 units, so 111 units = +1 energy; cropping rate = 167 g over 8.7 h/day foraging x 26 % of it
 *  actually cropping (Belovsky 1984, Theor. Popul. Biol., doi:10.1016/0040-5809(84)90009-1) = 20.5 mg/s = 4.1 units per 3 s bite bout. Senses / mood bends are game calibration. Hares are crepuscular with
 *  large eyes (good dim-light vision: night floor .45) and very mobile ears [game calibration, verify]. */
export const HARE_AGENT: AgentSpecies = {
  id: 'hare',
  labels: { feed: 'graze', step: 'graze (next section)', approach: 'relax: trot to clover', seek: 'relax: seek sunlight', scan: 'scan', rest: 'relax: rest', alert: 'alert (head up)', flee: 'flight', pause: 'flight pause', hide: 'freeze (no stamina)', held: 'held', tame: 'tame' },
  senses: {
    sight: { range: 26, night: .45, motion: [.5, 2], presence: 4, crouched: .5, movingAt: .25 }, // .5 m/s = slow stealth: slower is not "moving"
    hearing: { range: 22, loud: [1.5, 7], movingAt: .08 },
    scent: { potency: .8 },
  },
  fear: { wolf: 1 },
  levels: {
    energy: { max: 100, start: 70, drain: 100 / 86400, fleeMult: 8, fed: 80, full: 97 },
    stamina: { max: 100, drainSeconds: 8, recoverSeconds: 8 },
    relaxation: { max: 100, threatDrop: 60, fleeDrop: 12, recover: 3, panic: .6 },
  },
  // alertTurn 0 (run 4): the freeze is motionless (same source), so the body does not swing round to the wolf.
  // react 1 s: snowshoe hares freeze first, relying on crypsis, and only then flee (Emmel 2024, UMT MSc thesis, "The Hare and
  // the Hawk"; Chapman & Flux 2008); the ~1 s hold is read from the reference video (refs/hare/graze-alert-flight attempt 4)
  // [estimate: no measured freeze duration found]. Inside flee.distance the hare bolts at once.
  timing: { feed: 3, scan: 1, alert: 1, alertMin: .3, react: 1, alertTurn: 0, flee: 3, pause: 1, rest: [2, 4], jitter: .15 },
  mood: { boutNerve: .6, boutHunger: 1, scanChance: [.1, .9], scanHunger: .4, scanNerve: 1.5, scanHungerShort: .3,
    notice: [.06, .3], noticeHunger: .6, bolt: [.55, .8], boltHunger: .2, fleeNerve: .3, fleeStaminaFull: 40, pauseNerve: .4, resume: .8, unhide: .25 },
  utility: { feedHere: .5, approach: .4, approachDistance: 60, rest: 1, restFull: .6, restBase: .05, scan: .8, seek: .7, seekBase: .05, noise: .05 },
  reach: { food: 20, seek: 10, step: [.25, .45], stepTurn: .5, giveUp: 25 },
  // accel 10 m/s^2: top flight speed in ~3 bounds (0.85 s at ~4 Hz) as in the reference video; below the cheetah's measured
  // 13 m/s^2 peak (Wilson et al. 2013, Nature 498:185) [estimate: no measured hare acceleration found; Williams et al. 2007
  // J Anat 210:472 describe the hare pelvic limb as specialised for acceleration without a value].
  speed: { feedStep: .35, approach: 1.2, flee: 8.5, fleeTired: 5, accel: 10 },
  // distance 3.7 m: mean flight initiation distance of radio-collared snowshoe hares approached on foot, 224 approaches,
  // 74 hares (Emmel 2024, UMT MSc thesis, Fig. 1: 3.97 m winter-brown, 3.02 m winter-white; less concealed hares flee earlier).
  flee: { burstSeconds: 2.5, zig: [.45, .9], zigAngle: .35, distance: 3.7 },
  diet: { clover: { eatUnits: 4.1, eatSeconds: 3, unitsPerEnergy: 111 } },
  /** Half-bound: hind pair lands near-simultaneously, the fore pair staggered; Lepus also gallops (transverse and rotary) at the
   *  fastest speeds (Hildebrand 1977, J Mammal 58:131, Table 1: Lepus T, R, 1/2B; Simons 1999 / Bertram & Gutmann 2009, J R Soc
   *  Interface 6:549: leporids half-bound at all but the fastest speeds, stiff-backed when slow, flexed-back when escaping).
   *  Touchdown phases [estimate, from Hildebrand-style diagrams]: fore lead .08 is > 3x the hind lead .03, as Hildebrand 1977
   *  gives for half-bounding rabbits.
   *  Duty (HIND), re-sourced run 4: duty = sweep / stride, clamped to [.20, .60]. Bounds: Lepus hind contact spans ~60 %
   *  (slow) to ~20 % (very fast) of the stride (Hildebrand 1977 Fig. 2; the hind contact "approaches 20 percent of the cycle
   *  for various fast runners ... to the jumping mouse and rabbit. It is less than 18 percent only for individual strides of
   *  exceptional cursors"); Hildebrand states "actual speed cannot be derived from contact intervals", so the old linear
   *  .60 @ 1.68 -> .20 @ 11.6 m/s mapping had no speed source and is retired. Sweep .40 m = 1.2 x (hind leg .202 + foot .132):
   *  galloping dogs at 9.2 m/s sweep 9.2 x .073 s = .67 m in stance (Walter & Carrier 2007, JEB 210:208, Tables 1-2: contact
   *  71-75 ms), about 1.2 leg lengths; the same sweep in leg lengths for the hare is dynamic similarity (Alexander & Jayes 1983,
   *  J Zool 201:135) [estimate: no lagomorph stance length vs speed found]. Gives .60 @ 1.68, .56 @ 3, .35 @ 5, .21 @ 8.5,
   *  .20 (floor) @ 11.6 m/s. Fore share .90 -> .70 of the hind: "fore contacts drop to 70 percent or less of hind contacts
   *  for Lepus at speed" (Hildebrand 1977); ~.9 for the slow Lepus plots in Fig. 2; fore floor .16 ("the fore contact
   *  interval approaches 16 percent of the cycle in various fast-moving mammals", same paper).
   *  Cadence: Heglund & Taylor 1988 (JEB 138:301) allometry for 1.5 kg (ADW: 1.43-1.55 kg): trot-gallop transition
   *  1.54 M^0.216 = 1.68 m/s at 4.19 M^-0.150 = 3.94 Hz; preferred gallop 2.78 M^0.116 = 2.91 m/s at 4.44 M^-0.156 = 4.17 Hz;
   *  max sustained gallop 3.71 M^0.176 = 3.98 m/s at 4.70 M^-0.162 = 4.40 Hz. Above 3.98 m/s the frequency is held at 4.40 Hz
   *  up to the 11.6 m/s top speed (26 mph, Seton 1928 via MacLulich 1937) and speed grows by stride length, as in Heglund &
   *  Taylor's galloping animals [estimate: sprint frequency not measured in Lepus]. Slow hops f ~ v^0.25 [estimate]. */
  gait: { touchdown: [0, .08, .42, .45], duty: [.6, .2], sweep: .40, foreMin: .16, foreShare: [.9, .7], cadence: { transitionSpeed: 1.68, transitionHz: 3.94, topSpeed: 11.6, topHz: 4.4, slowExp: .25, points: [[2.91, 4.17], [3.98, 4.4]] } },
};
