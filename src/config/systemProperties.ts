/**
 * SYSTEM PROPERTIES (T-0037; Matthew 2026-10-22 ~01:25 PT: "a systems properties file will tie everything together and it
 * will allow me to see how everything is rigged up").
 *
 * Three parts, all pure data (this file imports nothing, so any module, worker or tool can read it):
 *  1. SYSTEM_PROPERTIES - the adjustable figures, one top-level key per group (alphabetical), `/** comment *\/ key: value`.
 *     Code reads from here: change a figure here, not at the call site. Readers keep their old export names (CHRONO, FEEL ...).
 *     T-0035's groups (autoFocus, targetGlow) and T-0036's (needsThoughts) merged in as whole sections.
 *  2. PROPERTY_META - per group: the modules that read it, and per figure its units and source ('estimate' when it is game
 *     calibration rather than a measurement).
 *  3. SYSTEM_MAP - per system: what it is, its modules, its groups here, what it depends on (the "feeds" direction is derived),
 *     its URL flags and links to the big data tables that stay in their own modules (species, gaits, quality ladder ...).
 * docs/system-map.md is generated from this file (`npm run system-map`); tests/system-properties.test.ts fails when it is stale.
 * How to add a system or a figure: notes/skills/system-properties.md.
 */
export const SYSTEM_PROPERTIES = {
  /** Held focus (core/focusLock, T-0035): hold the button to lock the wolf's attention on an object; keep within the radius to keep it. */
  autoFocus: {
    /** Engage and keep-lock radius, metres. From Matthew's red guideline ring (screenshot 01M5HB26..., 2026-10-22): its widest
     *  lateral extent projected onto the ground with the game camera (1.6 m up, 3 m back, 10 deg pitch, 48 deg fov) = 4.5 m. */
    radius: 4.5,
    /** View cone for picking a target: cosine of the angle off the view direction (0.4 = about 66 deg either side). */
    cone: .4,
    /** Auto-steer turn rate, rad/s: the player's own full-stick steering rate (main.ts), so focus never turns faster than the stick. */
    turnRateRadS: 2.2,
    /** Default binding (rebindable in Menu > Controls): gamepad LB (not otherwise bound), keyboard F. */
    binding: { keys: ['f'], pad: ['lb'] },
    /** Object kinds that can never be focused (pebbles: interactable only at nose contact, dozens per patch). */
    excludeKinds: ['rock'],
    /** Camera while locked: field of view (deg) and how fast it eases in / out (1/s); no snap. */
    cameraFovDeg: 36, cameraEase: 8,
    /** Hide the senses halo ring while a target is locked, so the target's glow is the only cue. */
    hideSensesHalo: true,
  },
  /** Animal behaviour pipeline (core/animalBehavior AnimalBrain): energy, feeding and threat memory. */
  behaviour: {
    /** energy an animal starts with, 0-100 */ defaultEnergy: 75,
    /** energy gained from one forage patch, 0-100 */ forageEnergy: 18,
    /** an animal hears the player within this distance (m) */ playerHearingRadius: 40,
    /** seconds spent eating at a forage patch before it is consumed */ feedDuration: 2,
    /** distance (m) from a forage patch at which an animal stops to eat */ feedReach: 1,
    /** seconds a sensed threat is remembered after leaving the senses (stops flip-flopping at the outer ring) */ threatMemory: 3,
    /** sense rings (m): touch, near, far */ senseRadii: [3, 10, 24] as const,
  },
  /** Follow camera (render/math): dead astern, just above the wolf, horizon level (T-0101). The wolf may lean with the ground; the camera does not roll. */
  camera: {
    /** resting pitch (deg). Negative looks above the horizon. -5 is near level and puts the body below screen centre. Game calibration of the angle. */
    defaultPitchDeg: -5,
    /** how far the look stick tilts up or down from the default (deg) */ lookPitchRangeDeg: 30,
    /** look-pitch spring return rate (1/s): 98 % settled in 0.3 s, no overshoot */ lookSpringRate: 14,
    /** metres above the ground. Gray-wolf withers are 80–85 cm (Mech 1970, The Wolf; Wikipedia "Wolf" restates it).
     *  The lens sits 20 cm above an 85 cm withers, so the view is the animal's, not a standing person's. */
    riderHeight: 1.05,
    /** metres behind the hips along the trail, at riderHeight. Scales with height. Game calibration so an 85 cm
     *  wolf is about a quarter of a 48° frame, the way the animal sits in issue #52. */
    riderDistance: 3.6,
    /** metres to the animal's left, at riderHeight. 0 is dead astern: the lens sits on the tail line and looks along the heading.
     *  T-0075 used 2.25 m (32° off the tail). That side offset made a diagonal shore read as a tilted horizon. */
    flank: 0,
    /** hard pitch limits (deg): negative looks above the horizon */ pitchMinDeg: -80, pitchMaxDeg: 89,
  },
  /** Chronometer dial (ui/chronometer): scrubbing the time of day. */
  chronometer: {
    /** game hours per real second at full stick */ rate: 3,
    /** how fast the scrub speed eases toward the stick (1/s) */ ease: 8,
  },
  /** World clock and season (core/timeOfDay, core/worldClock). */
  clock: {
    /** real seconds per game hour (300 = a full day in 2 real hours) */ realSecondsPerGameHour: 300,
    /** latitude of the map (deg N): Northwest Ontario */ latitudeDeg: 49.5,
    /** day of the year the world starts on (227 = mid-August) */ dayOfYear: 227,
    /** hour of day a new world starts at */ startHour: 8,
    /** cap on time credited while the game was closed (s; 3 days) */ maxOfflineSec: 3 * 86400,
  },
  /** Paw footstep sounds (audio/footsteps): timing and variation per step. */
  footsteps: {
    /** paws landing closer than this (s) merge into one sound */ minGap: .09,
    /** per-step random pitch (+- share) */ pitchJitter: .05,
    /** per-step random level cut (share) */ gainJitter: .25,
    /** playback rate of fore paws (heavier forequarters) */ foreRate: .96,
    /** playback rate of hind paws */ hindRate: 1.04,
    /** extra level per additional paw landing together */ pairBoost: .2,
  },
  /** Haptics defaults (ui/haptics FEEL; the Menu > Feel settings change them at runtime). */
  haptics: {
    /** rumble on gamepads, Quest controllers and phones */ on: true,
    /** rumble strength 0-1 (also the editor-limit thunk level) */ intensity: .6,
    /** play a soft thunk when an editor input hits its limit */ editorSound: true,
  },
  /** Hunting (core/needs/diet, T-0036): capture test, flight start, Howland jink. Matthew: "a capture is achievable with skill but is not trivial". */
  hunt: {
    /** m body contact that catches (~ half a wolf + half a hare); m a landing pounce catches within (+ jaw reach) */ catchContact: 0.9, catchPounce: 1.2,
    /** flight starts when the predator is inside flight.distanceM x (boltBase + boltPerLevel x perception) */ boltBase: .5, boltPerLevel: 1.5,
    /** m from the predator at which a fleeing prey calms down */ safeDistance: 35,
    /** s a prey commits to a zig before it may re-aim (turns are grip-limited, see evasion.lateralAccel) */ minZig: .2,
    /** jink (Howland 1974): when the pursuer is within jinkRadii x its turning radius v^2/a, turn jinkAngle rad off the
     *  straight-away line (pi/2 = Howland's optimum, perpendicular), at most every jinkEvery s */ jinkRadii: 1, jinkAngle: 1.57, jinkEvery: 1,
    /** s the view must stay on a prey before it locks. Regular saccade latency is about 200 ms
     *  (Fischer & Ramsperger 1984, Exp Brain Res 57:191); a shorter glance does not lock. */
    lockDwell: 0.2,
    /** degrees either side of the view. 60° is the upper end of the dog's behavioural binocular overlap
     *  (Miller & Murphy 1995, JAVMA 207:1623: 30–60°). Half of that overlap is 30°. */
    lockHalfDeg: 30,
    /** m. A stalking approach still alerts white-tailed deer inside 30 m (Lingle & Wilson 2001, Ethology 107:125).
     *  The lock uses that distance for any prey: beyond it, holding aim does not commit. */
    lockRadius: 30,
    /** m/s² ceiling on the leap's turn (v²/r). Wilson et al. 2013, Nature 498:185: cheetah hunts often exceed
     *  13 m/s² below 17 m/s. No wolf lateral acceleration was found; a wolf is not allowed to turn harder than that. */
    leapGrip: 13,
    /** Play seconds a released prey treats the wolf as a friend. Matthew 2026-10-21: about 3 min. The game clock is 12x,
     *  so this is play time, not world time (180 world-seconds would feel like 15 s). Inside the tonic-immobility range
     *  (seconds to several minutes: Whishaw, Flannigan & Barnsley 1979, Dev Psychobiol 12:595). */
    friendTau: 180,
    /** Strength exp(-t/tau) is still a friend at exactly one e-folding, and not after. */
    friendFloor: Math.exp(-1),
    /** Wet stomach + caecum + upper colon = gutA * mass^gutB (kg, kg). Belovsky 1984, Theor. Popul. Biol. 25:235, n=6, r^2=0.99.
     *  Read as kilograms (~10 % at 1.5 kg). Mendel & Mendel 1909, J Exp Med 11:36, rabbit stomach+cecum ~10 % of body weight.
     *  If the 1984 fit was in grams, this reading is high. */
    gutA: 0.096,
    gutB: 1.03,
  },
  /** Jump / pounce stages (animals/locomotion/jump), shares of the jump duration and fractions of hip height. */
  jump: {
    /** share of the jump spent crouching */ crouch: .18,
    /** share of the jump in the air */ flight: .65,
    /** share of the jump landing */ land: .17,
    /** crouch depth (fraction of hip height) */ depth: .15,
    /** fore-paw reach ahead in a pounce (fraction of hip height) */ reach: .35,
  },
  /** Outside links from the menus (ui/menu). */
  links: {
    /** Start menu "Board" button (opens in a new tab). Matthew 2026-10-22 01:51 PT chose the GitHub project board. Until that
     *  project exists (it needs `gh auth refresh -s project` once) this opens the repo's Issues, one per open task, mirrored by
     *  tools/board-github.ts. Then swap in the project URL that `npx tsx tools/board-github.ts project` prints. */
    board: 'https://github.com/Bannon-github/boreal/issues',
  },
  /** Loading screen (ui/loading). */
  loading: {
    /** seconds each fact card shows */ cardSeconds: 7,
    /** fade-out when loading finishes (ms) */ fadeMs: 900,
  },
  /** Player wolf movement feel (core/playerTuning): scales the base mode speeds of core/wolfModes. */
  movement: {
    /** speed multiplier per mode over the wolfModes base speed */ speedScale: { walk: 1, run: 1.5, sprint: 1.5, stealth: 1, 'super-stealth': 1 },
    /** minimum horizontal pounce speed (m/s) */ pounceSpeed: 8,
    /** share of the current speed a pounce carries */ pounceCarry: 1.15,
  },
  /** T-0036 need thought bubbles (core/needs/thoughts, render/thoughtBubbles). Matthew's spec unless noted. Times: real s. */
  needsThoughts: {
    /** a need below this % floats a bubble */ low: 30,
    /** at/below this % the bubble is the pulsing alert */ critical: 10,
    /** s between bubbles of one low need */ lowEvery: 10,
    /** s between alerts of one critical need ("faster frequency") */ criticalEvery: 3,
    /** s a low bubble takes to fade to 0 ("a second or two") */ fade: 1.75,
    /** s an alert takes to fade to 0 */ alertFade: 1.5,
    /** s of fade-in at birth (no pop) */ fadeIn: .15,
    /** peak opacity of a low bubble ("semi transparent") */ lowOpacity: .6,
    /** peak opacity of an alert */ alertOpacity: .85,
    /** m a bubble rises over its life */ rise: .55,
    /** m between stacked lanes when several needs are low */ laneSpacing: .3,
    /** s between the first bubbles of needs that go low together (stagger) */ stagger: 1.2,
    /** Hz of the alert's size pulse; +- share of size */ pulseHz: 3, pulseDepth: .2,
    /** m above the head-sensor where bubbles start; sprite size m */ above: .38, size: .34,
  },
  /** Shared perception (core/needs/senses, T-0036): thresholds over the species template senses. */
  perception: {
    /** perception level (0..1) at which an animal notices another */ notice: .25,
    /** embodied-player predator cue: level at which it shows; s it lingers after the predator is lost */ cueAt: .15, cueLinger: 2,
  },
  /** Adaptive quality governor (core/quality GOVERNOR): how it measures and steps the quality ladder. */
  quality: {
    /** frame rate the governor holds (fps; also the Target frame rate setting's default) */ targetFps: 60,
    /** ladder tier the game starts on (0 = Ultra, 1 = High ...) */ startTier: 1,
    /** length of one measuring window (ms) */ windowMs: 250,
    /** window averages kept */ iterations: 10,
    /** share of averages outside the margin needed to act */ threshold: .75,
    /** direction reversals before the governor locks on the cheaper tier */ flipflops: 6,
    /** step down below this x target fps */ lower: .92,
    /** step up above this x target fps */ upper: 1.35,
    /** no decision for this long after any step (ms) */ cooldownMs: 10000,
    /** no step up for this long after a step down (ms) */ upHoldMs: 30000,
    /** a tier left for being over budget is not re-entered for this long (ms) */ rememberMs: 60000,
    /** world knobs (radii, densities, shadows) follow a new tier only after it has held this long (ms) */ worldHoldMs: 20000,
  },
  /** Senses HUD (core/senses): hearing/smell range and cue lifetimes. */
  senses: {
    /** hearing and smelling range (m) */ range: 40,
    /** weakest scent level that becomes a cue, 0-1 */ threshold: .025,
    /** seconds a sound cue stays on screen */ cueLife: 3,
    /** most sound cues shown at once */ cueCap: 6,
    /** most scent thoughts shown at once */ thoughtCap: 3,
    /** HUD refresh interval (s) */ updateSeconds: .15,
  },
  /** Senses halo ring around the head (core/senseBeacons, render/sensesHalo). */
  sensesHalo: {
    /** ring radius (m) */ radius: .62,
    /** halo fully visible at or below this ground speed (m/s) */ fadeFrom: .9,
    /** halo gone at or above this ground speed (m/s) */ fadeTo: 4,
    /** smoothing time of the speed it fades by (s) */ speedEase: .35,
  },
  /** Headless animal simulation (core/sim, T-0036): game calibration, not species data. */
  sim: {
    /** s fixed sub-step (coarse ecosystem ticks may raise it). Needs use the world clock's game-second conversion, not a sim rate. */ step: 1 / 30,
    /** m spatial-grid cell; m scent search radius (as senses.range) */ cell: 25, scentRange: 40,
    /** m a grazer reaches food from; Energy % above which it stops seeking food */ biteReach: .6, fullAt: 90,
    /** m ring step of the water search */ waterStep: 2,
    /** NPC predator: m it breaks from stalk to chase; stalk speed x walk; m it pounces from; s pounce, s cooldown, speed carry (as movement) */
    chaseAt: 6, stalkSpeed: .2, pounceAt: 3, pounceSeconds: .85, pounceCooldown: 1.5, pounceCarry: 1.15,
    /** s of one NPC rest bout */ restBout: 60,
  },
  /** Group awareness (core/needs/social, T-0036). Link distance and relay delay are per species (template.social). */
  social: {
    /** most links an alarm passes along a chain of mates (bounds the relay) */ maxHops: 6,
    /** s a detection stays "known" after the animal last perceived the predator */ memorySeconds: 2,
  },
  /** Target glow (render/targetGlow, T-0035): soft outline tracing the interaction / focus target (three r180 OutlinePass). */
  targetGlow: {
    /** Glow colour (warm cream). */
    color: 0xffd89a,
    /** Thin-edge brightness, wide-glow strength and edge width (OutlinePass edgeStrength / edgeGlow / edgeThickness).
     *  Softened 2026-10-22 01:43 PT (Matthew: "make the glow less focused"): thicker blur on the thin edge, more of the wide
     *  quarter-res halo, lower overall strength so the summed brightness stays about the same. Was 1.8 / 1.0 / 1.6. */
    edgeStrength: 1.3, edgeGlow: 2.5, edgeThickness: 6.0,
  },
} as const;

export type SystemGroup = keyof typeof SYSTEM_PROPERTIES;
/** Groups other branches add to SYSTEM_PROPERTIES; listed in SYSTEM_MAP now so the wiring is complete before they land. */
export const PENDING_GROUPS: Record<string, string> = {};

/** Units + source per figure. Source: a citation, "Matthew" (his spec), or "estimate" (game calibration, no measurement). */
export interface GroupMeta { readers: string[]; keys: Record<string, [unit: string, source: string]> }
const EST = 'estimate (game calibration)';
export const PROPERTY_META: Record<string, GroupMeta> = {
  autoFocus: { readers: ['src/core/focusLock.ts', 'src/core/bindings.ts', 'src/render/buildScene.ts', 'src/main.ts'], keys: {
    radius: ['m', "Matthew (his red guideline ring, projected with the game camera; T-0035)"], cone: ['cos(angle)', EST],
    turnRateRadS: ['rad/s', 'the player\'s own full-stick steer rate (main.ts)'], binding: ['keys / pad inputs', 'Matthew (hold a gamepad button; LB / F)'],
    excludeKinds: ['object kinds', 'design (pebbles interact at nose contact only)'], cameraFovDeg: ['deg', EST], cameraEase: ['1/s', EST],
    hideSensesHalo: ['on/off', 'design'] } },
  behaviour: { readers: ['src/core/animalBehavior.ts'], keys: {
    defaultEnergy: ['0-100', EST], forageEnergy: ['0-100', EST], playerHearingRadius: ['m', EST], feedDuration: ['s', EST],
    feedReach: ['m', EST], threatMemory: ['s', EST], senseRadii: ['m', EST] } },
  camera: { readers: ['src/render/math.ts'], keys: {
    defaultPitchDeg: ['deg', EST], lookPitchRangeDeg: ['deg', EST], lookSpringRate: ['1/s', EST],
    riderHeight: ['m', 'withers 80–85 cm (Mech 1970, The Wolf) plus 20 cm, so the lens is just above the back'],
    riderDistance: ['m', EST], flank: ['m', EST], pitchMinDeg: ['deg', EST], pitchMaxDeg: ['deg', EST] } },
  chronometer: { readers: ['src/ui/chronometer.ts'], keys: { rate: ['game h / real s', 'Matthew (chronometer design)'], ease: ['1/s', EST] } },
  clock: { readers: ['src/core/timeOfDay.ts', 'src/core/worldClock.ts'], keys: {
    realSecondsPerGameHour: ['s', 'design (2 real h per game day)'],
    latitudeDeg: ['deg N', 'Thunder Bay 48.4 N, Kenora 49.8 N (Natural Resources Canada, Canadian Geographical Names Database)'],
    dayOfYear: ['day', 'design (mid-August)'], startHour: ['h', 'design'], maxOfflineSec: ['s', 'design'] } },
  footsteps: { readers: ['src/audio/footsteps.ts'], keys: {
    minGap: ['s', EST], pitchJitter: ['share', EST], gainJitter: ['share', EST],
    foreRate: ['x', 'fore legs carry ~60 % of a dog\'s weight (Lee et al. 1999, J Exp Biol 202:3565)'],
    hindRate: ['x', 'Lee et al. 1999 (as foreRate)'], pairBoost: ['share', EST] } },
  haptics: { readers: ['src/ui/haptics.ts', 'src/core/renderSettings.ts'], keys: { on: ['on/off', 'design'], intensity: ['0-1', EST], editorSound: ['on/off', 'design'] } },
  hunt: { readers: ['src/core/needs/diet.ts', 'src/core/hunt.ts', 'src/core/huntHold.ts'], keys: {
    catchContact: ['m', 'half a wolf (head-body 1.0-1.3 m, Mech & Boitani 2003) + half a hare; tuned by tools/hunt-sim'], catchPounce: ['m', 'catchContact + jaw reach; ' + EST],
    boltBase: ['x flight distance', EST], boltPerLevel: ['x flight distance per perception', EST], safeDistance: ['m', EST], minZig: ['s', EST],
    jinkRadii: ['x pursuer turning radius', 'Howland 1974 (J Theor Biol 47:333): turn when the pursuer is about one turning radius away'],
    jinkAngle: ['rad', 'Howland 1974: the optimal evasive turn is perpendicular'], jinkEvery: ['s', EST],
    lockDwell: ['s', 'Fischer & Ramsperger 1984, Exp Brain Res 57:191: regular saccade latency ~200 ms'],
    lockHalfDeg: ['deg', 'Miller & Murphy 1995, JAVMA 207:1623: dog binocular overlap 30–60°, upper end, half either side of the view'],
    lockRadius: ['m', 'Lingle & Wilson 2001, Ethology 107:125: stalking attacks alerted deer under 30 m'],
    leapGrip: ['m/s^2', 'Wilson et al. 2013, Nature 498:185: cheetah lateral acceleration often above 13 m/s^2 below 17 m/s; used as a ceiling'],
    friendTau: ['play s', 'Matthew 2026-10-21: friendship about 3 min. Whishaw, Flannigan & Barnsley 1979, Dev Psychobiol 12:595: tonic immobility lasts seconds to several minutes'],
    friendFloor: ['share of strength', 'exp(-1): the memory is live through one e-folding and gone after it'],
    gutA: ['kg / kg^gutB', 'Belovsky 1984, Theor. Popul. Biol. 25:235: wet stomach+caecum+upper colon = 0.096*W^1.03 (n=6, r^2=0.99). Unit read as kg; Mendel & Mendel 1909 J Exp Med 11:36 is the ~10% check'],
    gutB: ['exponent', 'Belovsky 1984, Theor. Popul. Biol. 25:235 (same fit)'] } },
  jump: { readers: ['src/animals/locomotion/jump.ts'], keys: {
    crouch: ['share', 'Claude gaitPose jump (game calibration)'], flight: ['share', 'Claude gaitPose jump (game calibration)'],
    land: ['share', 'Claude gaitPose jump (game calibration)'], depth: ['x hip height', EST], reach: ['x hip height', EST] } },
  links: { readers: ['src/ui/menu.ts'], keys: { board: ['URL', 'Matthew (start menu Board link opens the GitHub board, 2026-10-22 01:51 PT)'] } },
  loading: { readers: ['src/ui/loading.ts'], keys: { cardSeconds: ['s', EST], fadeMs: ['ms', EST] } },
  movement: { readers: ['src/core/playerTuning.ts'], keys: {
    speedScale: ['x', 'run 6 m/s, sprint 10.5 m/s: inside wolf travel ~2.2-2.5 m/s and chase up to ~15-17 m/s (Mech 1970; Mech & Boitani 2003)'],
    pounceSpeed: ['m/s', EST], pounceCarry: ['x', EST] } },
  needsThoughts: { readers: ['src/core/needs/thoughts.ts'], keys: {
    low: ['%', 'Matthew (T-0036: "below 30 %")'], critical: ['%', 'Matthew ("approach critical"); 10 % chosen'], lowEvery: ['s', 'Matthew ("every 10 seconds")'],
    criticalEvery: ['s', 'Matthew ("faster frequency"); 3 s chosen'], fade: ['s', 'Matthew ("a second or two")'], alertFade: ['s', EST], fadeIn: ['s', EST],
    lowOpacity: ['0-1', 'Matthew ("semi transparent")'], alertOpacity: ['0-1', EST], rise: ['m', EST], laneSpacing: ['m', EST], stagger: ['s', EST],
    pulseHz: ['Hz', EST], pulseDepth: ['share', EST], above: ['m', EST], size: ['m', EST] } },
  perception: { readers: ['src/core/needs/senses.ts'], keys: { notice: ['0-1', EST], cueAt: ['0-1', EST], cueLinger: ['s', EST] } },
  quality: { readers: ['src/core/quality.ts'], keys: {
    targetFps: ['fps', 'desktop 60 Hz displays; Quest 72/90 Hz (Meta performance guidance)'], startTier: ['tier', 'design'],
    windowMs: ['ms', 'drei PerformanceMonitor default (pmndrs/drei)'], iterations: ['count', 'drei PerformanceMonitor default'],
    threshold: ['share', 'drei PerformanceMonitor default'], flipflops: ['count', EST], lower: ['x target', EST], upper: ['x target', EST],
    cooldownMs: ['ms', '2026-10-18 omen bench (tier change every ~2.5 s)'], upHoldMs: ['ms', '2026-10-18 omen bench'],
    rememberMs: ['ms', '2026-10-18 uncapped bench (bounce every ~40 s)'], worldHoldMs: ['ms', EST] } },
  senses: { readers: ['src/core/senses.ts', 'src/core/sensePictures.ts'], keys: {
    range: ['m', EST], threshold: ['0-1', EST], cueLife: ['s', EST], cueCap: ['count', EST], thoughtCap: ['count', EST], updateSeconds: ['s', EST] } },
  sensesHalo: { readers: ['src/core/senseBeacons.ts'], keys: { radius: ['m', EST], fadeFrom: ['m/s', 'stealth speed 0.8 m/s (core/wolfModes)'], fadeTo: ['m/s', EST], speedEase: ['s', EST] } },
  sim: { readers: ['src/core/sim/index.ts'], keys: {
    step: ['s', 'design (30 Hz like the player sim)'], cell: ['m', EST], scentRange: ['m', 'senses.range'],
    biteReach: ['m', EST], fullAt: ['0-100', EST], waterStep: ['m', EST], chaseAt: ['m', EST], stalkSpeed: ['x walk', EST], pounceAt: ['m', EST],
    pounceSeconds: ['s', 'core/animalBehavior jump length'], pounceCooldown: ['s', 'core/animalBehavior jump cooldown'], pounceCarry: ['x speed', 'movement.pounceCarry'], restBout: ['s', EST] } },
  social: { readers: ['src/core/needs/social.ts', 'src/core/sim/index.ts'], keys: { maxHops: ['links', EST], memorySeconds: ['s', EST] } },
  targetGlow: { readers: ['src/render/targetGlow.ts'], keys: {
    color: ['sRGB hex', 'design (warm cream)'], edgeStrength: ['x', "Matthew (01:43 PT: \"make the glow less focused\"; estimate)"],
    edgeGlow: ['x', "Matthew (01:43 PT softer glow; estimate)"], edgeThickness: ['px blur', "Matthew (01:43 PT softer glow; estimate)"] } },
};

export type SystemId = 'animalSim' | 'audio' | 'behaviour' | 'camera' | 'clock' | 'controls' | 'globe' | 'interaction' | 'lighting' | 'locomotion' | 'needs'
  | 'physics' | 'player' | 'quality' | 'save' | 'senses' | 'sky' | 'stamina' | 'terrain' | 'ui' | 'vegetation' | 'water' | 'weather';
export interface SystemWiring {
  title: string; what: string;
  /** source modules of the system (src/...) */ modules: string[];
  /** SYSTEM_PROPERTIES groups that belong to it */ groups: string[];
  /** systems whose output it reads (the reverse, "feeds", is derived) */ dependsOn: SystemId[];
  /** URL flags: name -> what it does (module) */ flags: Record<string, string>;
  /** big data tables kept in their own module: 'src/path.ts#EXPORT' -> what it holds */ tables: Record<string, string>;
  /** tunables still at their call site (not yet moved) */ remaining: string[];
}
export const SYSTEM_MAP: Record<SystemId, SystemWiring> = {
  animalSim: { title: 'Headless animal simulation', what: 'Every animal as pure data + logic on a fixed tick (no renderer): species template needs, stamina, senses, diets (carnivore hunt / herbivore graze), group awareness and vigilance. Far or fast, the same animals are a density the coarse step eases toward a published count. Renderers read it through adapters.',
    modules: ['src/core/sim/index.ts', 'src/core/coarse.ts', 'src/core/needs/senses.ts', 'src/core/needs/diet.ts', 'src/core/needs/social.ts', 'src/animals/hare.ts', 'src/core/hunt.ts', 'src/core/huntHold.ts'],
    groups: ['hunt', 'perception', 'sim', 'social'], dependsOn: ['needs', 'senses', 'player', 'clock'], flags: {},
    tables: { 'src/core/needs/species/index.ts#NEEDS_SPECIES': 'species templates: senses, diet, social, evasion',
      'src/core/hunt.ts#HUNT_LOCK': 'aim dwell, binocular cone, lock radius, leap turn ceiling',
      'src/core/huntHold.ts#HUNT_HOLD': 'friend memory, gut allometry, pin and carry pose figures' }, remaining: [] },
  audio: { title: 'Audio and music', what: 'Ambience, animal calls, footsteps, wolf voice, music decks and the bus mixer.',
    modules: ['src/audio/borealSound.ts', 'src/audio/footsteps.ts', 'src/audio/mixer.ts', 'src/audio/music.ts', 'src/audio/musicSettings.ts', 'src/audio/wolfVoice.ts', 'src/core/callField.ts'],
    groups: ['footsteps'], dependsOn: ['clock', 'weather', 'locomotion', 'behaviour', 'player'],
    flags: { tones: 'show the isochronic / binaural tone controls (grok/music, T-0033)' },
    tables: { 'src/audio/borealSound.ts#MIX': 'clip gains and spatial mix', 'src/audio/borealSound.ts#SOUND_IDS': 'every sound clip id',
      'src/core/callField.ts#CALLERS': 'loon territory and wail counts, woodpecker density and drum rate',
      'src/audio/mixer.ts#VOICES': 'voice limits and priorities', 'src/audio/mixer.ts#CULL_DISTANCE': 'sounds beyond this are culled',
      'src/audio/music.ts#MUSIC': 'music deck crossfade and ducking' },
    remaining: ['audio/mixer + audio/music figures (grok/music, T-0033, is changing them; move after it merges)'] },
  behaviour: { title: 'Agent and behaviour pipeline', what: 'Animal brains: senses -> problem (explore, escape, feed ...) -> motion intent; deer herds, hares, people.',
    modules: ['src/core/animalBehavior.ts', 'src/core/autonomy.ts', 'src/core/agent.ts', 'src/animals/hare.ts', 'src/core/why.ts', 'src/core/events.ts', 'src/core/lifespan.ts'],
    groups: ['behaviour'], dependsOn: ['senses', 'needs', 'terrain', 'clock', 'vegetation'],
    flags: { contacts: '=1 logs every solid contact (main.ts)', watch: '=hare follows a hare (grok/rabbit-clover, T-0009)' },
    tables: { 'src/core/species.ts#MAMMAL_PLANS': 'body plans per mammal archetype', 'src/core/species.ts#MAMMALS': 'mammal species rows',
      'src/animals/hare.ts#HARE': 'snowshoe hare agent figures', 'src/core/species.ts#DEER_AGENT': 'white-tailed deer agent figures',
      'src/core/lifespan.ts#LIFESPAN': 'maximum and starting ages', 'src/core/why.ts#WHY_DEFAULTS': 'why-chains per object kind',
      'src/core/tuning.ts#BLOCK': 'step height and trunk clearance per animal' },
    remaining: ['core/autonomy autonomous wolf figures', 'animals/hare HARE (T-0009 is changing it)'] },
  camera: { title: 'Camera', what: 'Third-person follow camera: dead astern just above the wolf, level horizon, pitch spring and look-around.',
    modules: ['src/render/math.ts', 'src/render/buildScene.ts'], groups: ['camera'], dependsOn: ['player', 'controls', 'terrain', 'interaction'],
    flags: { at: '=x,z[,yaw] start position (main.ts)', fov: 'field of view override (grok/rabbit-clover, T-0009)' }, tables: {},
    remaining: ['main.ts mouse-drag look sensitivity and look-yaw return rate', 'render/buildScene base field of view (48 deg; the focus field of view is autoFocus.cameraFovDeg)'] },
  clock: { title: 'Time and clock', what: 'The one world clock and its one dial. Sky, weather, planet, water, animals, shaders, audio timing and ground years read it. The in-game time bar is the control. The rate eases; observation scale is a signal for later detail switches.',
    modules: ['src/core/timeOfDay.ts', 'src/core/worldClock.ts', 'src/core/timescale.ts', 'src/ui/chronometer.ts', 'src/ui/timeHud.ts', 'src/core/deepTime.ts'], groups: ['clock', 'chronometer'], dependsOn: ['save'],
    flags: { hour: '=HH sets the time of day on the one clock (core/timeOfDay)', day: '=1-366 sets the day of year (core/timeOfDay)', date: '=YYYY-MM-DD sets the year and day (core/timeOfDay)', timescale: 'sets the one dial (core/timescale, core/worldClock): pause inside ±0.01, the edge of that zone is exactly 1×, full deflection 10^12 sim seconds per real second, negative rewinds' },
    tables: { 'src/core/timeOfDay.ts#DAY': 'chronometer offset (persisted)', 'src/core/worldClock.ts#CLOCK': 'save key and offline cap',
      'src/core/deepTime.ts#DEEP': 'deep-time figures: solar-system formation, sun and Earth age, flux thresholds, life start (T-0060, T-0093)', 'src/core/deepTime.ts#MILESTONES': 'dated milestones on the deep-time dial (T-0060)' }, remaining: [] },
  controls: { title: 'Player controls and gamepad', what: 'One bindings table (keys + gamepad per action), dead zones, rebinding UI, haptics.',
    modules: ['src/core/bindings.ts', 'src/ui/controls.ts', 'src/ui/haptics.ts'], groups: ['haptics'], dependsOn: ['save'], flags: {},
    tables: { 'src/core/bindings.ts#ACTIONS': 'every action and its default keys / pad inputs', 'src/core/bindings.ts#DEADZONE': 'stick dead zone',
      'src/core/bindings.ts#ACTIVE': 'press threshold for analog inputs', 'src/ui/haptics.ts#HAPTIC_EVENTS': 'rumble pattern per event' },
    remaining: ['core/bindings DEADZONE / ACTIVE (the Focus binding default is autoFocus.binding)', 'core/wolfModes trigger thresholds'] },
  globe: { title: 'Globe (planet view)', what: 'Cube-sphere planet, atmosphere, far layer and the descent from orbit to the ground.',
    modules: ['src/world/globe/globeView.ts', 'src/world/globe/planet.ts', 'src/world/globe/inpage.ts', 'src/world/globe/transition.ts', 'src/world/globe/handoff.ts', 'src/world/globe/atmosphere.ts', 'src/world/globe/tile.ts', 'src/world/globe/lod.ts'],
    groups: [], dependsOn: ['terrain', 'clock', 'lighting', 'quality', 'save'],
    flags: { view: '=globe | farlayer (world/globe/entry)', transition: 'globe <-> ground mode (world/globe/transition)', alt: 'start altitude (globeView)',
      atmos: 'atmosphere on/off (globeView)', bench: 'benchmark run (globeView, main.ts)', dir: 'sun direction (globeView)', dome: 'sky dome (globeView)',
      handoff: 'handoff test (globeView)', look: 'look direction (globeView)', pitch: 'start pitch (globeView)', seams: 'show tile seams (globeView)',
      seed: 'world seed (globeView)', shot: 'screenshot mode (globeView)', tier: 'force a quality tier (globeView)', workers: 'tile worker count (globeView)',
      inpagedev: 'dev hooks for the in-page globe (inpage)', farSamples: 'far-layer demo samples (farLayerDemo)', farScale: 'far-layer demo scale (farLayerDemo)',
      start: '=globe opens on the planet (grok-globe/globe-default-view, T-0034)' },
    tables: { 'src/world/globe/planet.ts#PLANET': 'planet radius and relief', 'src/world/globe/planet.ts#GLOBE_COLOURS': 'globe surface colours',
      'src/world/globe/handoff.ts#HANDOFF': 'altitude where globe hands off to the ground', 'src/world/globe/transition.ts#TRANSITION': 'descent timing',
      'src/world/globe/inpage.ts#INPAGE': 'in-page globe figures', 'src/world/globe/lod.ts#GLOBE_LOD': 'tile detail per tier',
      'src/world/globe/atmosphere.ts#ATMOS': 'atmosphere scattering', 'src/world/globe/atmosphere.ts#CLOUDS': 'globe cloud layer',
      'src/world/globe/globeView.ts#NEAR_SPLIT': 'near/far camera split', 'src/world/globe/tile.ts#DETAIL': 'close-up detail noise' },
    remaining: ['globe figures (T-0034 is changing globeView / inpage; move after it merges)'] },
  interaction: { title: 'Interaction, focus and target glow', what: 'Picking the interaction target, held focus lock and steering, the glowing outline.',
    modules: ['src/core/focusLock.ts', 'src/render/targetGlow.ts', 'src/render/buildScene.ts', 'src/main.ts'], groups: ['autoFocus', 'targetGlow'], dependsOn: ['controls', 'player', 'behaviour', 'camera'],
    flags: { glow: '=0 turns the target glow off for A/B (grok/interact-outline, T-0035)' }, tables: {},
    remaining: ['main.ts interaction reach and the 48 deg base field of view the focus camera eases back to'] },
  lighting: { title: 'Lighting', what: 'Physical sun/moon illuminance, exposure, ambient and night vision.',
    modules: ['src/core/light.ts', 'src/render/pbr.ts', 'src/render/post.ts', 'src/render/photoreal.ts'], groups: [], dependsOn: ['clock', 'weather', 'quality'],
    flags: {}, tables: { 'src/core/light.ts#LUX': 'illuminance figures (CIE)', 'src/core/light.ts#EXPOSURE': 'exposure base',
      'src/core/light.ts#AMBIENT': 'ambient light shares', 'src/core/light.ts#NIGHT': 'night vision and moonlight', 'src/render/pbr.ts#LIGHTING': 'live light state' },
    remaining: ['core/light figures (sourced; link kept)'] },
  locomotion: { title: 'Animals and locomotion', what: 'Gaits, central pattern generator, IK, posture, jumps and the rigs that draw them.',
    modules: ['src/animals/locomotion/controller.ts', 'src/animals/locomotion/gaits.ts', 'src/animals/locomotion/cpg.ts', 'src/animals/locomotion/ik.ts', 'src/animals/locomotion/jump.ts', 'src/animals/locomotion/posture.ts', 'src/core/gaitData.ts', 'src/core/locomotion.ts'],
    groups: ['jump'], dependsOn: ['behaviour', 'stamina', 'physics', 'terrain'],
    flags: { loco: 'the controller-driven player wolf (animals/locomotion/game)', walkprobe: 'walk probe logging (dev/walkProbe)' },
    tables: { 'src/animals/locomotion/gaits.ts#GAIT_TABLE': 'gait phase and duty table', 'src/animals/locomotion/cpg.ts#CPG': 'pattern generator coupling',
      'src/animals/locomotion/controller.ts#SPRINGS': 'joint and body springs', 'src/animals/locomotion/posture.ts#POSTURE': 'posture figures',
      'src/animals/locomotion/ik.ts#FLEX_LIMIT': 'joint flex limits', 'src/core/gaitData.ts#REF_BODY': 'reference canid body', 'src/core/tuning.ts#PHYS': 'jump duration and muscle force' },
    remaining: ['locomotion tables (T-0009 is changing gaits / ik / foot; link only)'] },
  needs: { title: 'Needs (water, energy, rest)', what: 'Species needs drained at real-world rates, thought bubbles and alerts, needs-driven goals.',
    modules: ['src/core/needs/engine.ts', 'src/core/needs/template.ts', 'src/core/needs/species/index.ts', 'src/core/needs/behaviour.ts', 'src/core/needs/thoughts.ts', 'src/core/needs/water.ts', 'src/render/thoughtBubbles.ts', 'src/core/animalBehavior.ts', 'src/main.ts'],
    groups: ['needsThoughts'], dependsOn: ['clock', 'locomotion', 'water', 'weather'],
    flags: { needs: '=water:25,energy:8 sets need levels for testing (grok/wolf-hydration, T-0036)' },
    tables: { 'src/core/needs/species/index.ts#NEEDS_SPECIES': 'sourced species templates (needs, stamina, behaviour)', 'src/core/needs/template.ts#S': 'the Sourced value helper' },
    remaining: [] },
  physics: { title: 'Physics and materials', what: 'Gravity from G and Earth, densities and compositions, contact seating.',
    modules: ['src/proc/physics.ts', 'src/core/materials.ts', 'src/core/mass.ts', 'src/core/contactBus.ts'], groups: [], dependsOn: [], flags: {},
    tables: { 'src/core/tuning.ts#PHYS': 'physical constants (CODATA, NASA, IUGG)', 'src/core/materials.ts#MATERIALS': 'densities',
      'src/core/materials.ts#COMPOSITIONS': 'body compositions', 'src/core/contactBus.ts#SEAT_DEFAULTS': 'log/rock seating' }, remaining: [] },
  player: { title: 'Player wolf', what: 'Embodied wolf movement: mode speeds, pounce and the move/steer step.',
    modules: ['src/core/playerTuning.ts', 'src/core/wolfModes.ts', 'src/main.ts'], groups: ['movement'], dependsOn: ['controls', 'stamina', 'physics', 'terrain'],
    flags: {}, tables: { 'src/core/wolfModes.ts#modeSpeed': 'base speed per mode' },
    remaining: ['main.ts steer rate (2.2 rad/s) and wind frontal area'] },
  quality: { title: 'Graphics tiers and performance', what: 'One quality ladder, the governor that steps it, render settings caps and the interest radius.',
    modules: ['src/core/quality.ts', 'src/core/renderSettings.ts', 'src/core/probe.ts', 'src/core/interest.ts', 'src/render/startup.ts'],
    groups: ['quality'], dependsOn: ['save'],
    flags: { bench: 'per-tier and per-feature cost run (main.ts)', reprobe: 'redo the startup resource probe (main.ts)' },
    tables: { 'src/core/quality.ts#LADDER': 'quality tiers Ultra..Minimum', 'src/core/quality.ts#WORLD_KNOBS': 'knobs that rebuild the world',
      'src/core/renderSettings.ts#RENDER_SETTINGS': 'every Menu > Settings entry', 'src/core/renderSettings.ts#RENDER': 'live render config',
      'src/core/probe.ts#PROBE': 'startup probe figures', 'src/core/interest.ts#INTEREST': 'full-detail and LOD radii' },
    remaining: ['core/renderSettings defaults (Target frame rate, interest radii, LOD scales): the settings store applies them over GOVERNOR / USER at load'] },
  save: { title: 'Save and load', what: 'localStorage keys: clock, hour offset, ground, weather, deltas, bindings, settings, seed, player.',
    modules: ['src/main.ts', 'src/core/worldClock.ts', 'src/core/deltas.ts', 'src/core/ground.ts'], groups: [], dependsOn: [], flags: {},
    tables: { 'src/core/worldClock.ts#CLOCK': 'boreal.clock.v1', 'src/core/timeOfDay.ts#DAY': 'boreal.hour.v1', 'src/core/ground.ts#SAVE_KEY_GROUND': 'boreal.ground.v1',
      'src/core/weather.ts#SAVE_KEY_WEATHER': 'boreal.weather.v1', 'src/core/deltas.ts#SAVE_KEY_DELTAS': 'boreal.deltas.v1', 'src/core/bindings.ts#BINDINGS_KEY': 'boreal.bindings.v1' },
    remaining: ['main.ts autosave interval and the seed / player / music keys'] },
  senses: { title: 'Senses', what: 'Hearing and smell: scent plumes, sound cues, the senses HUD and the halo ring.',
    modules: ['src/core/senses.ts', 'src/core/senseBeacons.ts', 'src/ui/senses.ts', 'src/render/sensesHalo.ts'], groups: ['senses', 'sensesHalo'],
    dependsOn: ['weather', 'player', 'behaviour'], flags: {}, tables: {}, remaining: [] },
  sky: { title: 'Sky', what: 'Sky dome, sun and moon discs, clouds drawn from the weather cells.',
    modules: ['src/render/sky.ts', 'src/render/photoreal.ts'], groups: [], dependsOn: ['clock', 'lighting', 'weather'], flags: {}, tables: {},
    remaining: ['render/sky shader figures'] },
  stamina: { title: 'Stamina and energy', what: 'Run / sprint stamina, exhaustion and refill; energy spent by distance and ground cost.',
    modules: ['src/core/wolfModes.ts', 'src/core/animalBehavior.ts'], groups: [], dependsOn: ['controls', 'needs'], flags: {},
    tables: { 'src/core/wolfModes.ts#modeSpeed': 'mode speeds the stamina drain applies to', 'src/core/wolfModes.ts#WOLF_STAMINA': 'stamina rates from the species template (T-0036)' },
    remaining: [] },
  terrain: { title: 'Terrain and stages', what: 'Staged terrain: eroded elevation, soils, rivers and lakes; chunks, ground layers and rocks.',
    modules: ['src/core/world.ts', 'src/core/stages/elevation.ts', 'src/core/stages/soils.ts', 'src/core/stages/rivers.ts', 'src/core/ground.ts', 'src/core/rocks.ts', 'src/render/terrainCore.ts', 'src/render/bands.ts'],
    groups: [], dependsOn: ['quality', 'save', 'physics'],
    flags: { stages: '=0 / =1 staged terrain off / on (main.ts)', bands: '=0 off, or band amplitude (render/bands)' },
    tables: { 'src/core/tuning.ts#LEVEL': 'water, shore and upland heights', 'src/core/stages/elevation.ts#ELEV': 'elevation stage figures',
      'src/core/stages/soils.ts#SOIL_PROPS': 'soil kinds', 'src/core/stages/rivers.ts#RIVER': 'river figures', 'src/core/ground.ts#POOLS': 'ground carbon pools',
      'src/core/ground.ts#BEKKER': 'soil bearing (Bekker)', 'src/core/rocks.ts#ROCK_SIZES': 'rock size classes', 'src/render/terrainCore.ts#BAND_COLOR': 'terrain band colours' }, remaining: [] },
  ui: { title: 'UI, HUD and menus', what: 'Start / pause menu, settings panel, HUD status line, loading screen, chronometer, inspector, photo mode.',
    modules: ['src/ui/menu.ts', 'src/ui/settingsPanel.ts', 'src/ui/loading.ts', 'src/ui/chronometer.ts', 'src/ui/inspector.ts', 'src/photo/photoMode.ts', 'src/main.ts'],
    groups: ['links', 'loading'], dependsOn: ['clock', 'stamina', 'needs', 'quality', 'audio', 'controls', 'save'],
    flags: { nomenu: 'skip the start menu (main.ts)' },
    tables: { 'src/ui/loading.ts#FALLBACK_CARDS': 'built-in loading facts' }, remaining: ['main.ts notice duration and HUD text'] },
  vegetation: { title: 'Trees and vegetation', what: 'Stands and fire history, procedural trees (v2), far trees, flora, mosses and grass.',
    modules: ['src/core/stand.ts', 'src/core/population.ts', 'src/core/flora/plants.ts', 'src/core/flora/stands.ts', 'src/render/trees/game.ts', 'src/render/flora/flora.ts', 'src/render/flora/fartrees.ts', 'src/render/grass/grass.ts'],
    groups: [], dependsOn: ['terrain', 'water', 'quality', 'clock'],
    flags: { trees: '=v2 procedural trees (render/trees/game)', moss: '=0 moss off for A/B (render/flora/moss)', fartrees: '=0 far trees off for A/B (render/flora/fartrees)',
      patch: 'flora patch debug (render/flora/flora)', tree: 'procedural tree viewer page (world/globe/entry)' },
    tables: { 'src/core/flora/plants.ts#FLORA': 'plant species specs', 'src/core/flora/stands.ts#FAR_TREES': 'far tree stand figures',
      'src/core/flora/trees/forms.ts#TREE_FORMS': 'tree forms', 'src/core/stand.ts#FIRE': 'fire regime', 'src/core/stand.ts#SUCCESSION': 'succession stages',
      'src/core/population.ts#ENTITY_TREES': 'tree entity density', 'src/render/trees/game.ts#TREES_V2': 'v2 tree switch and near radius', 'src/core/growth.ts#MATURITY_SECONDS': 'plant maturity time' },
    remaining: ['render/trees/game age classes'] },
  water: { title: 'Water', what: 'Lake plane, river planform and flow, shore bands and water optics.',
    modules: ['src/render/water.ts', 'src/core/stages/rivers.ts', 'src/core/stages/flow.ts'], groups: [], dependsOn: ['terrain', 'weather', 'clock'], flags: {},
    tables: { 'src/core/tuning.ts#LEVEL': 'water surface height', 'src/core/stages/rivers.ts#RIVER': 'river figures' }, remaining: ['render/water shader figures'] },
  weather: { title: 'Weather', what: 'A small 3-D atmosphere grid over the player: temperature, wind, cloud and rain from station normals.',
    modules: ['src/core/weather.ts'], groups: [], dependsOn: ['clock', 'terrain'], flags: {},
    tables: { 'src/core/weather.ts#AIR': 'air constants', 'src/core/weather.ts#SITE': 'weather station site', 'src/core/weather.ts#NORMALS': 'monthly climate normals',
      'src/core/weather.ts#KESSLER': 'rain microphysics', 'src/core/weather.ts#WEATHER': 'live weather settings' }, remaining: [] },
};
