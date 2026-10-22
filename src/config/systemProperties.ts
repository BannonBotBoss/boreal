/**
 * SYSTEM PROPERTIES (T-0037; Matthew 2026-10-22 ~01:25 PT: "a systems properties file will tie everything together and it
 * will allow me to see how everything is rigged up").
 *
 * Three parts, all pure data (this file imports nothing, so any module, worker or tool can read it):
 *  1. SYSTEM_PROPERTIES - the adjustable figures, one top-level key per group (alphabetical), `/** comment *\/ key: value`.
 *     Code reads from here: change a figure here, not at the call site. Readers keep their old export names (CHRONO, FEEL ...).
 *     Same shape as T-0035 (focus, targetGlow) and T-0036 (needsThoughts), so their groups merge in as whole sections.
 *  2. PROPERTY_META - per group: the modules that read it, and per figure its units and source ('estimate' when it is game
 *     calibration rather than a measurement).
 *  3. SYSTEM_MAP - per system: what it is, its modules, its groups here, what it depends on (the "feeds" direction is derived),
 *     its URL flags and links to the big data tables that stay in their own modules (species, gaits, quality ladder ...).
 * docs/system-map.md is generated from this file (`npm run system-map`); tests/system-properties.test.ts fails when it is stale.
 * How to add a system or a figure: notes/skills/system-properties.md.
 */
export const SYSTEM_PROPERTIES = {
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
  /** Follow camera (render/math): rider height/distance behind the wolf and the look-pitch spring. */
  camera: {
    /** default downward pitch (deg): aims a little above the wolf so it sits below screen centre */ defaultPitchDeg: 10,
    /** how far the look stick tilts up or down from the default (deg) */ lookPitchRangeDeg: 30,
    /** look-pitch spring return rate (1/s): 98 % settled in 0.3 s, no overshoot */ lookSpringRate: 14,
    /** camera height above ground at the start (m) */ riderHeight: 1.6,
    /** camera distance behind at riderHeight (m); scales with height */ riderDistance: 3,
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
  /** Jump / pounce stages (animals/locomotion/jump), shares of the jump duration and fractions of hip height. */
  jump: {
    /** share of the jump spent crouching */ crouch: .18,
    /** share of the jump in the air */ flight: .65,
    /** share of the jump landing */ land: .17,
    /** crouch depth (fraction of hip height) */ depth: .15,
    /** fore-paw reach ahead in a pounce (fraction of hip height) */ reach: .35,
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
} as const;

export type SystemGroup = keyof typeof SYSTEM_PROPERTIES;
/** Groups other branches add to SYSTEM_PROPERTIES; listed in SYSTEM_MAP now so the wiring is complete before they land. */
export const PENDING_GROUPS: Record<string, string> = {
  focus: 'grok/interact-outline (T-0035)', targetGlow: 'grok/interact-outline (T-0035)', needsThoughts: 'grok/wolf-hydration (T-0036)',
};

/** Units + source per figure. Source: a citation, "Matthew" (his spec), or "estimate" (game calibration, no measurement). */
export interface GroupMeta { readers: string[]; keys: Record<string, [unit: string, source: string]> }
const EST = 'estimate (game calibration)';
export const PROPERTY_META: Record<string, GroupMeta> = {
  behaviour: { readers: ['src/core/animalBehavior.ts'], keys: {
    defaultEnergy: ['0-100', EST], forageEnergy: ['0-100', EST], playerHearingRadius: ['m', EST], feedDuration: ['s', EST],
    feedReach: ['m', EST], threatMemory: ['s', EST], senseRadii: ['m', EST] } },
  camera: { readers: ['src/render/math.ts'], keys: {
    defaultPitchDeg: ['deg', EST], lookPitchRangeDeg: ['deg', EST], lookSpringRate: ['1/s', EST], riderHeight: ['m', EST],
    riderDistance: ['m', EST], pitchMinDeg: ['deg', EST], pitchMaxDeg: ['deg', EST] } },
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
  jump: { readers: ['src/animals/locomotion/jump.ts'], keys: {
    crouch: ['share', 'Claude gaitPose jump (game calibration)'], flight: ['share', 'Claude gaitPose jump (game calibration)'],
    land: ['share', 'Claude gaitPose jump (game calibration)'], depth: ['x hip height', EST], reach: ['x hip height', EST] } },
  loading: { readers: ['src/ui/loading.ts'], keys: { cardSeconds: ['s', EST], fadeMs: ['ms', EST] } },
  movement: { readers: ['src/core/playerTuning.ts'], keys: {
    speedScale: ['x', 'run 6 m/s, sprint 10.5 m/s: inside wolf travel ~2.2-2.5 m/s and chase up to ~15-17 m/s (Mech 1970; Mech & Boitani 2003)'],
    pounceSpeed: ['m/s', EST], pounceCarry: ['x', EST] } },
  quality: { readers: ['src/core/quality.ts'], keys: {
    targetFps: ['fps', 'desktop 60 Hz displays; Quest 72/90 Hz (Meta performance guidance)'], startTier: ['tier', 'design'],
    windowMs: ['ms', 'drei PerformanceMonitor default (pmndrs/drei)'], iterations: ['count', 'drei PerformanceMonitor default'],
    threshold: ['share', 'drei PerformanceMonitor default'], flipflops: ['count', EST], lower: ['x target', EST], upper: ['x target', EST],
    cooldownMs: ['ms', '2026-10-18 omen bench (tier change every ~2.5 s)'], upHoldMs: ['ms', '2026-10-18 omen bench'],
    rememberMs: ['ms', '2026-10-18 uncapped bench (bounce every ~40 s)'], worldHoldMs: ['ms', EST] } },
  senses: { readers: ['src/core/senses.ts'], keys: {
    range: ['m', EST], threshold: ['0-1', EST], cueLife: ['s', EST], cueCap: ['count', EST], thoughtCap: ['count', EST], updateSeconds: ['s', EST] } },
  sensesHalo: { readers: ['src/core/senseBeacons.ts'], keys: { radius: ['m', EST], fadeFrom: ['m/s', 'stealth speed 0.8 m/s (core/wolfModes)'], fadeTo: ['m/s', EST], speedEase: ['s', EST] } },
};

export type SystemId = 'audio' | 'behaviour' | 'camera' | 'clock' | 'controls' | 'globe' | 'interaction' | 'lighting' | 'locomotion' | 'needs'
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
  audio: { title: 'Audio and music', what: 'Ambience, animal calls, footsteps, wolf voice, music decks and the bus mixer.',
    modules: ['src/audio/borealSound.ts', 'src/audio/footsteps.ts', 'src/audio/mixer.ts', 'src/audio/music.ts', 'src/audio/musicSettings.ts', 'src/audio/wolfVoice.ts'],
    groups: ['footsteps'], dependsOn: ['clock', 'weather', 'locomotion', 'behaviour', 'player'],
    flags: { tones: 'show the isochronic / binaural tone controls (grok/music, T-0033)' },
    tables: { 'src/audio/borealSound.ts#MIX': 'clip gains and spatial mix', 'src/audio/borealSound.ts#SOUND_IDS': 'every sound clip id',
      'src/audio/mixer.ts#VOICES': 'voice limits and priorities', 'src/audio/mixer.ts#CULL_DISTANCE': 'sounds beyond this are culled',
      'src/audio/music.ts#MUSIC': 'music deck crossfade and ducking' },
    remaining: ['audio/mixer + audio/music figures (grok/music, T-0033, is changing them; move after it merges)'] },
  behaviour: { title: 'Agent and behaviour pipeline', what: 'Animal brains: senses -> problem (explore, escape, feed ...) -> motion intent; deer herds, hares, people.',
    modules: ['src/core/animalBehavior.ts', 'src/core/autonomy.ts', 'src/core/deerHerd.ts', 'src/animals/hare.ts', 'src/core/why.ts', 'src/core/events.ts', 'src/core/lifespan.ts'],
    groups: ['behaviour'], dependsOn: ['senses', 'needs', 'terrain', 'clock', 'vegetation'],
    flags: { contacts: '=1 logs every solid contact (main.ts)', watch: '=hare follows a hare (grok/rabbit-clover, T-0009)' },
    tables: { 'src/core/species.ts#MAMMAL_PLANS': 'body plans per mammal archetype', 'src/core/species.ts#MAMMALS': 'mammal species rows',
      'src/animals/hare.ts#HARE': 'snowshoe hare agent figures', 'src/core/deerHerd.ts#HERD': 'deer herd figures',
      'src/core/lifespan.ts#LIFESPAN': 'maximum and starting ages', 'src/core/why.ts#WHY_DEFAULTS': 'why-chains per object kind',
      'src/core/tuning.ts#BLOCK': 'step height and trunk clearance per animal' },
    remaining: ['core/autonomy autonomous wolf figures', 'animals/hare HARE (T-0009 is changing it)'] },
  camera: { title: 'Camera', what: 'Third-person follow camera behind the wolf: pitch spring, look-around and rider distance.',
    modules: ['src/render/math.ts', 'src/render/buildScene.ts'], groups: ['camera'], dependsOn: ['player', 'controls', 'terrain', 'interaction'],
    flags: { at: '=x,z[,yaw] start position (main.ts)', fov: 'field of view override (grok/rabbit-clover, T-0009)' }, tables: {},
    remaining: ['main.ts mouse-drag look sensitivity and look-yaw return rate', 'render/buildScene field of view (T-0035 is changing the focus camera there)'] },
  clock: { title: 'Time and clock', what: 'The one world clock (frozen in menus), game hour, date and sun position; chronometer offset.',
    modules: ['src/core/timeOfDay.ts', 'src/core/worldClock.ts', 'src/core/timescale.ts', 'src/ui/chronometer.ts'], groups: ['clock', 'chronometer'], dependsOn: ['save'],
    flags: { hour: '=HH sets the time of day (core/timeOfDay)', timescale: 'speeds the simulation, not the clock (core/timescale)' },
    tables: { 'src/core/timeOfDay.ts#DAY': 'chronometer offset (persisted)', 'src/core/worldClock.ts#CLOCK': 'save key and offline cap' }, remaining: [] },
  controls: { title: 'Player controls and gamepad', what: 'One bindings table (keys + gamepad per action), dead zones, rebinding UI, haptics.',
    modules: ['src/core/bindings.ts', 'src/ui/controls.ts', 'src/ui/haptics.ts'], groups: ['haptics'], dependsOn: ['save'], flags: {},
    tables: { 'src/core/bindings.ts#ACTIONS': 'every action and its default keys / pad inputs', 'src/core/bindings.ts#DEADZONE': 'stick dead zone',
      'src/core/bindings.ts#ACTIVE': 'press threshold for analog inputs', 'src/ui/haptics.ts#HAPTIC_EVENTS': 'rumble pattern per event' },
    remaining: ['core/bindings DEADZONE / ACTIVE (T-0035 adds the Focus binding in the same file; move after it merges)', 'core/wolfModes trigger thresholds'] },
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
    modules: ['src/render/buildScene.ts', 'src/main.ts'], groups: ['focus', 'targetGlow'], dependsOn: ['controls', 'player', 'behaviour', 'camera'],
    flags: { glow: '=0 turns the target glow off for A/B (grok/interact-outline, T-0035)' }, tables: {},
    remaining: ['focus and targetGlow groups arrive with grok/interact-outline (T-0035)'] },
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
    modules: ['src/core/animalBehavior.ts', 'src/main.ts'],
    groups: ['needsThoughts'], dependsOn: ['clock', 'locomotion', 'water', 'weather'],
    flags: { needs: '=water:25,energy:8 sets need levels for testing (grok/wolf-hydration, T-0036)' },
    tables: {}, remaining: ['today only energy exists (AnimalBrain.energy); the needs engine, species template (core/needs/*) and the needsThoughts group arrive with grok/wolf-hydration (T-0036)'] },
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
    tables: { 'src/core/wolfModes.ts#modeSpeed': 'mode speeds the stamina drain applies to' },
    remaining: ['core/wolfModes stamina drain / refill (T-0036 moves them into the species template; link after it merges)'] },
  terrain: { title: 'Terrain and stages', what: 'Staged terrain: eroded elevation, soils, rivers and lakes; chunks, ground layers and rocks.',
    modules: ['src/core/world.ts', 'src/core/stages/elevation.ts', 'src/core/stages/soils.ts', 'src/core/stages/rivers.ts', 'src/core/ground.ts', 'src/core/rocks.ts', 'src/render/terrainCore.ts', 'src/render/bands.ts'],
    groups: [], dependsOn: ['quality', 'save', 'physics'],
    flags: { stages: '=0 / =1 staged terrain off / on (main.ts)', bands: '=0 off, or band amplitude (render/bands)' },
    tables: { 'src/core/tuning.ts#LEVEL': 'water, shore and upland heights', 'src/core/stages/elevation.ts#ELEV': 'elevation stage figures',
      'src/core/stages/soils.ts#SOIL_PROPS': 'soil kinds', 'src/core/stages/rivers.ts#RIVER': 'river figures', 'src/core/ground.ts#POOLS': 'ground carbon pools',
      'src/core/ground.ts#BEKKER': 'soil bearing (Bekker)', 'src/core/rocks.ts#ROCK_SIZES': 'rock size classes', 'src/render/terrainCore.ts#BAND_COLOR': 'terrain band colours' }, remaining: [] },
  ui: { title: 'UI, HUD and menus', what: 'Start / pause menu, settings panel, HUD status line, loading screen, chronometer, inspector, photo mode.',
    modules: ['src/ui/menu.ts', 'src/ui/settingsPanel.ts', 'src/ui/loading.ts', 'src/ui/chronometer.ts', 'src/ui/inspector.ts', 'src/photo/photoMode.ts', 'src/main.ts'],
    groups: ['loading'], dependsOn: ['clock', 'stamina', 'needs', 'quality', 'audio', 'controls', 'save'],
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
