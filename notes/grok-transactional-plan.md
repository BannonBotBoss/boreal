# Boreal: transactional, causal behaviour for every object (Grok Bot plan)

2026-10-21, Grok Bot. Read-only audit of main `0d54785` plus a migration plan. This branch (`grok/transactional-plan`) changes
no game code and contains only this file.

## Matthew's rule (2026-10-21, applies to the whole game)
For every object, ask:
1. **"What gives? Why is this object here?"** Give it a short causal chain. A tree: photosynthesis, then a seed forms, the
   seed disperses, it sprouts and it grows. A fallen log: tipped by gravity, settled by density, decaying through oxygen,
   insects and water. The forest floor is fallen trunks layered over the ages. Clover grows where sunlight reaches the ground.
2. **"How can its behaviour be generated procedurally, in a transactional way?"** Behaviour comes from **transactions**
   when objects touch or sense each other (sunlight with clover, rabbit with clover, wolf with prey, log with insects, water,
   oxygen and gravity). It also comes from **internal levels** (energy, stamina, relaxation, hunger). It never comes from
   random actions or bare timers. "The animal doesn't just randomly jump around for no reason."

**What randomness is still allowed:** seeded noise decides *what an individual is* and *where the world put it*. That covers
terrain, placement, body build, and a per-individual temperament drawn once at birth. Randomness never decides *what it
does next*. Every action needs a cause that can be named: a percept, a level crossing a threshold, or a transaction. A
seeded value can still break a tie between two causes that are exactly equal.

---

## 1. Inventory: every object, agent and system

Legend for **driver**: S = static or derived once, R = random per decision, T = bare timer, RR = reactive rule (distance or
geometry trigger with no goal), N = need-driven (an internal level picks the action), X = transactional (an effect happens
because two things touched or sensed each other). Line numbers are for main 0d54785. There is **no `Math.random` anywhere
in src/**. All randomness goes through seeded `proc/rng.ts`, so the offenders below are seeded-random or timer *behaviour*,
not unseeded randomness.

### 1.1 World and abiotic
| Object / system | Files | Causal "why" today | Driver | Notes / offenders |
|---|---|---|---|---|
| Terrain (elevation, depressions) | core/world.ts `heightAt`, core/stages/elevation.ts, render/terrainCore.ts | Physical: an eroded grid (stage 1), and the lowest 8 % becomes water. `GROUND_WHY` = weathered, then accumulated (core/why.ts:51) | S (seeded noise + erosion) | Fine under the rule (placement noise). |
| Hydrology: lakes, rivers, flow | core/stages/flow.ts, rivers.ts, `lakeAt` | Physical: D8 flow accumulation, TWI, Strahler order | S | Good causal base. Water is a *resource field* nobody consumes yet (no drinking). |
| Soils | core/stages/soils.ts | HAND, slope, TWI, then material (Gharari 2011) | S | Good. |
| Ground column (litter, duff, humus, SOM, moss) | core/ground.ts | CBM-CFS3 decay chain in closed form from the stand's fire origin. Deposits (droppings, residue) are superposed | X-ish (closed-form decay + deposit pulses) | **Already transactional in spirit.** `addDeposit` (ground.ts:194) is the sink for residue. Bekker `footing()` costs the wolf energy. |
| Deltas (footprints, scent, carcass, droppings, branch, movedStone, felledTree) | core/deltas.ts | Each kind cites a decay source. Strength decays as m0·e^(−t/τ) and the residue goes to the ground | X (decay) | Only **footprint** and **droppings** are ever written (main.ts:185–187, a 1 s `setInterval`). **scent, carcass, disturbed, branch, felledTree are never written**, even though the senses HUD already smells scent, carcass and droppings (ui/senses.ts:65). Deer droppings are written on a 1 s interval from mass and intake, which is a rate rather than a transaction: acceptable. |
| Weather / atmosphere | core/weather.ts | Physical: surface energy balance, Stable Fluids wind, Kessler rain, bucket hydrology | X-ish (physics) | `windAt` is the ONE wind field and is already read by scent (senses.ts plume). Good. |
| Sky, sun, moon, time | core/timeOfDay.ts, core/weather.ts `solar`/`shortwave`, core/light.ts, render/sky.ts, ui/chronometer.ts | NOAA solar position, lunar phase law, lux | S (function of the clock) | `shortwave(cosZ, cloud)` (weather.ts:76) gives W/m², the input for a **sunlight-on-ground field**. |
| World clock | core/worldClock.ts | n/a | clock | Good: one clock, frozen with the menu. |
| Light under the canopy | core/flora/site.ts `siteAt().light` (line 72) | 1 − max(drawn crown cover, stand closure) | S | **The ready-made "sunlight reaches the ground" input for clover.** |

### 1.2 Vegetation and inanimate objects
| Object | Files | Why today | Driver | Notes / offenders |
|---|---|---|---|---|
| Trees (spruce entities) | core/world.ts:51 `KIND_TABLE` (60 % of 35 seeded candidates per 40 m chunk), core/population.ts (thinned or added by stand stems/ha), core/stand.ts (fire patches give stand age, which gives density and succession), core/treeSpecies.ts, render/trees*, render/trees/game.ts (v2) | `WHY_DEFAULTS.spruce` = GROWN (photosynthesized, seeded, dispersed, sprouted, grew) | S | Density has a cause (fire history and stand age). **Position within a chunk is uniform.** No gaps are created by a cause. Gaps exist only where the dice skipped. Matthew wants "trees dispersed in a pattern that allows for gaps" so sunlight reaches the clover. |
| Far / look-only trees | core/flora/stands.ts, render/flora/fartrees.ts | stand stems | S | Same. |
| Fallen logs | core/world.ts KIND_TABLE (11 %), population.ts (CWD from stand), render/geometry.ts `seatLog` (T-0005), core/settle.ts, core/logContact.ts | The richest chain in the game: 23 steps from GROWN through failed, pulled, tipped, displaced, settled, resting, then the ongoing steps ceased, oxidized, decaying, held, insected, wetted, sunned, rotting, nursing, buried (why.ts:40) | S + X (seating physics; log\|ground contact on the bus) | The chain is **labels only** (why.ts:13). Nothing ties a log to a *missing tree* or to a *canopy gap*. Insects, water and sunlight are not transactions yet. T-0007 (the forest floor) is open. |
| Rocks (Shield stones) | core/world.ts (35-candidate roll + 120 "stones" per chunk), core/rocks.ts, render/rocks.ts `seatRock` | weathered, embedded on ground | S + X (the player snout-push `move` transaction, events.ts:36, writes `moved by player`) | Good. |
| Practice herb (`plant`) | catalog.ts:26, world.ts | GROWN | S + X (`gather` adds to the inventory) | It is a demo item. It never regrows. |
| Forage berry patch | world.ts:73–78 (22 uniform seeded points per chunk), catalog.ts:22, events.ts `consumeForage` | GROWN | X, but one-shot | **Uniformly placed, ignoring the site niche, light and wetness.** Eating removes it **forever** (`eatenForage`, buildScene.ts:174). It gives a flat **+18 energy** (`FORAGE_ENERGY`). There is no regrowth and no units. |
| Ground flora, grass, moss | core/flora/site.ts (niche suitability: Whittaker/Austin Gaussian; Thomas cluster process), plants.ts, mosses.ts, render/grass, render/flora | Niche: wet, light, rock, soil | S (causal placement!) | **The model to copy for clover.** Clover is a niche (high `light`, mid `wet`) placed with the same `thomas()` process, plus a units field. |
| Clover | (none on main). It is planned in grok/rabbit-clover | none | none | The worktree `C:\dev\boreal-grok-rabbit` was created at 10:14 PT. At the time of this audit it had **no changes or commits** yet (HEAD 6226a02, behind main 0d54785). |
| Water surface | render/water.ts | hydrology | S | It is a resource no one uses yet (thirst). |

### 1.3 Animals and people
| Agent | Files | Why today | Driver | Every random / timer / reactive behaviour (file:line) |
|---|---|---|---|---|
| **Shared AnimalBrain** (deer, the player wolf in Autonomous mode) | core/animalBehavior.ts:18–106 | none (the deer gets `born, wandered`) | RR + N (energy only) | `decide()`. **:52–57 a "low obstacle" (any log or rock over 0.22 m, buildScene.ts:190–191) within 1.8 m ahead and 0.65 m to the side, together with :61–62 → JUMP**, whenever the cooldown is 0 and energy is above 10. That fires constantly in a forest. **:64–68 any other obstacle → back up for a 0.7 s timer, then turn heading by 0.65π (117°).** :41–42 the jump is a fixed 0.85 s plus a 1.5 s cooldown (a timer; acceptable as the duration of the motion itself). :49–51 a threat is the *nearest* item tagged threat inside 24 m by distance only (no wind, no sight, no sound level), with `THREAT_MEMORY` = a 3 s timer. :73–75 flee speed is chosen by distance bands (2.5 m, 12 m). :77 recover idles until energy reaches 45 (a level: good). :83–86 `FEED_DURATION` is a fixed 2 s timer, and the meal is a flat +18. **:90–91 explore: idle/walk from `sin(time·.15+seed) > .65` and heading drift `sin(time·.3+seed)` (a clock-driven wander with no cause).** :96–98 energy recovers at +1/s only while idle-recovering. |
| **Autonomous wolf** | core/autonomy.ts:6–18, main.ts:334–348 | none | RR | **autonomy.ts:8–11 explore → RUN at 4 m/s whenever energy > 25 and stamina > 20. It runs straight ahead with no goal.** :12–16 a 0.25 s probe: water, a step, or a trunk → `heading += dt·2`, idle (it spins on the spot). It inherits every jump and back-up rule from `decide()`. Its only food is forage (`brain.meal` → `view.forageWolf`, main.ts:347). Its stamina comes from player-mode rules (wolfModes.ts). |
| **Deer** | core/deerHerd.ts (posture layer over AnimalBrain), render/buildScene.ts:193–224 | `born, wandered` | T + R (seeded) + RR | deerHerd.ts:35 initial graze timer `lerp(rng, [5,14])`. **:89–93 calm cycle on timers: graze 5–14 s → scan 1.5–3.5 s → (`rng() < .55` graze : walk 3–9 s).** :61 alert delay random 0.3–1.4 s. :75 flee zig `sin(fleeTime·2.2+seed)`. :78 the opening bound is always a jump (stotting: has a reason, but it is fixed). :80 calm-down random 4–9 s and `settled = 15` s. :102 a lone deer's heading wanders by `sin(time·.2+seed)`. buildScene.ts:203 the player is a threat *only* by species (`current.threat`) or by friendship, never by scent, noise or sight. :213 blocked → `heading += dt·2` (spin). The herd cohesion and alignment (:95–101) are real social percepts: good. |
| **Snowshoe hares** | animals/hare.ts (standalone, not on AnimalBrain) | none. Hares spawn in a ring 18–45 m around the wolf (`spawn`, :46–54) and respawn on a timer | T + R + RR | :16–21 notice and bolt radii come from a lookup table keyed by player *mode*. **:51 initial nibble timer 1–4 s. :74 freeze 0.6–1.6 s random. :78 back to nibble 2–5 s. :81 zig every 0.45–0.9 s, ±0.9·rng() rad, random side. :83 safe → nibble 3–6 s. :84 hop → nibble 2–6 s. :85 nibble → HOP for 0.6–1.4 s with heading += rand(±1.2) (the purposeless random hop).** :82 flee speed bursts at 8.5 m/s for a fixed 2.5 s, then drops to 5 m/s (a timer, not stamina). :88 water → heading += 0.6π. :69 caught → it vanishes, with **respawn 25–45 s** later somewhere random. :68 a catch is contact under 1.3 m, or under 2.4 m while pouncing. It has no energy, stamina, relaxation or food, and it does not eat forage. |
| **People ("Visitor")** | catalog.ts:28, world.ts KIND_TABLE (0.5 %), buildScene.ts:268–270 | `born, wandered` | S | They do not move. Their only motion is **a body sway from `sin(time·.7+seed)`** (buildScene.ts:270). `speak` makes them a permanent friend. |
| **Player wolf (manual)** | main.ts:320–350, core/wolfModes.ts, core/locomotion.ts, render/playerWolf.ts, animals/locomotion/* | n/a (the player is the cause) | N (energy, stamina) | wolfModes.ts:27 sprint is a fixed 1.5 s; :29–30 stamina drains 16 or 7 per s and recovers +10/s (rates: fine). The hare catch is a flat +35 energy and +35 stamina (main.ts:384–386). Super-stealth `focusTarget` (main.ts:358–366) is the **seed of lock-on**: the nearest deer or person within 30 m inside a facing cone (dot > 0.4). |
| Bear / other playables | render/bear.ts, core/bearBody.ts, render/playables.ts | n/a | (rig only) | Same brain as the player. |

### 1.4 Senses, memory, relationships, energy
| System | Files | State | Notes |
|---|---|---|---|
| Wolf scent | core/senses.ts `scentLevel` (EPA Gaussian plume with `windAt`), `smell` | X-ready | **The best sensing code in the game, and only the player HUD and halo use it.** Prey never smell the wolf. Potencies are a table (ui/senses.ts:23). |
| Sound cues | core/senses.ts `createSoundCues`, audio `onSpatialCue` | X-ready | They only feed the HUD and halo. No animal hears a sound level. |
| Sight | none | none | There is no line of sight, light-level detection or facing cone for prey. `core/light.ts` lux and `darkAdapted` exist and could set the sight range. |
| Senses halo / HUD | core/senseBeacons.ts, render/sensesHalo.ts, ui/senses.ts | UI | Fine. |
| Interest radius | core/interest.ts | infra | near = 60 m full sim, mid = 100 m low rate, far = math only. **The agent core must respect it** (far-away animals cost nothing). |
| Records / memory / relationships | core/events.ts `RecordEntry` (relationship `'friend' \| null` is **permanent**), `playerRemembered`, `parseContext` | X (pure transactions on the save) | Nothing decays, so there is no way to make a friendship that "lasts a few minutes until the rabbit's memory is reset". Deltas (closed-form decay) are the existing pattern for anything that fades. |
| Energy | AnimalBrain.energy, `expend(dt, distance, effort)` | N | The wolf also has stamina (wolfModes). Deer have energy only, and hares have neither. There is no relaxation level for any animal. |
| Why chains | core/why.ts, events.ts `solidContact`, ui/inspector | X (rock push, log\|ground) | A closed vocabulary of 28 tags. Derived per kind and stored only when a transaction changes it. This is **the field to extend**, not replace. |
| Contact bus | core/contactBus.ts `CONTACTS` | X | Rising and falling edges between order-free pairs. The only emitter today is log\|ground at chunk build. Claude's rule (notes/claude.md): no per-paw contacts; at most one pair per solid an animal stands on. |

### 1.5 Sound and ambience
| Item | File:line | Driver |
|---|---|---|
| Birds (owl/raven/woodpecker) | audio/borealSound.ts:248–250, `MIX.birdEverySeconds` [20,50] (:43) | **T + R**: a random interval, a random spot 15–35 m away, a random species. There is no bird behind the sound. |
| Loon | borealSound.ts:260–261, [45,110] s (:38) | **T + R** (gated by darkness or nearby water: a partial cause). |
| Deer chew | borealSound.ts:287, every 2 + rng() s while `problem==='feed'` | T (tied to a real feeding state: acceptable, and better tied to bites) |
| Footsteps | borealSound.ts:219, audio/footsteps.ts | X (paw touchdowns), with pitch jitter (cosmetic, fine) |
| Clip offset and pitch jitter | borealSound.ts:137, 157, 167 | cosmetic R (fine) |
| Wolf voice lines | audio/wolfVoice.ts:31–36 | R line pick. Night lines when `darkness > .5 && rng() < .6` (cosmetic, fine) |
| Hare catch sound | borealSound.ts:207, then chew via `setTimeout` 500 ms | T (a sound sequence: fine) |
| Music | audio/music.ts:31 session shuffle | not world state (fine) |

### 1.6 The biggest offenders (Matthew's "random jumping" and "no reason")
1. **`AnimalBrain.decide()` jumps at any log or rock 1.8 m ahead** (animalBehavior.ts:52–62). Every log and every rock over 22 cm counts as a low obstacle (buildScene.ts:190–191), so in the forest the wolf and the deer hop constantly. **The jump has no goal behind it.**
2. **Back off 0.7 s, then turn 117°** (animalBehavior.ts:64–68), and **spin by `dt·2` when blocked** (autonomy.ts:16, buildScene.ts:213). It looks like twitching.
3. **Autonomous explore = run at 4 m/s in a straight line** (autonomy.ts:8–11), plus the brain's sine-wave wander (animalBehavior.ts:90–91).
4. **Hare random hops**: nibble on a timer, then a hop with a ±1.2 rad random turn (hare.ts:84–85). There are also random freeze and zig timers, a fixed 2.5 s burst, and a timed respawn at a random spot (hare.ts:51, 74, 78, 81–83, 69).
5. **Deer calm cycle on timers with a 55 % coin flip** (deerHerd.ts:89–93), plus random alert and calm-down delays (:61, :80).
6. **Senses are distance-only for every non-player animal.** Prey ignore wind, scent, noise level, light and facing, even though senses.ts already models the scent plume.
7. **Forage**: placed uniformly, eaten once, never regrows, and gives a flat +18. **Scent, carcass and felledTree deltas are never written**, so the world never accumulates the traces it already knows how to decay.
8. **Ambient birds and loons** are timers and dice with no animal behind them.

---

## 2. Infrastructure to build on (reuse, don't duplicate)
| Piece | Where | How the plan uses it |
|---|---|---|
| `CONTACTS` bus | core/contactBus.ts | The **only** place touching is announced. Agents publish `agent\|target` when within reach (one pair per target, begin when reach starts, end when it stops), following Claude's per-entity rule. Transactions subscribe. |
| `solidContact`, `interact`, `consumeForage` | core/events.ts | They are already pure `(context, …) → context`. They become **registry entries** (same purity, same save rules: `playerRemembered`, generated objects never enter the save). |
| `why` chains | core/why.ts | Keep the closed vocabulary. Add tags for the new causes (see §3.5). The derived-per-kind default plus store-only-on-change rule stays. |
| `smell` / `scentLevel` + `windAt` | core/senses.ts, core/weather.ts | **Prey smell the wolf** with the same plume: the awareness "radius" becomes scent level vs the species' threshold, so being downwind matters. |
| Sound cues | core/senses.ts `createSoundCues`, audio `onSpatialCue`, footsteps (paw touchdowns, ground `absorb`) | **Prey hear the wolf**: the footstep level comes from mode, speed and ground absorb, attenuated by distance. Slow stealth stays quiet, so the "move slowly enough" rule emerges from it. |
| Light | core/light.ts (lux, `darkAdapted`), weather.ts `solar`/`shortwave`, flora/site.ts `siteAt().light` | Sight range for prey (darker means a shorter range). **Sunlight on the ground** = `siteAt.light × shortwave(cosZ, cloud)`, which feeds clover growth. |
| Niche + Thomas clusters | core/flora/site.ts `suitability`, `thomas` | Clover and forage placement (a sunlit-gap niche). The same function gives habitat suitability for spawning hares. |
| Closed-form decay / deltas | core/deltas.ts, core/ground.ts `chain`, `addDeposit` | Clover depletion and regrowth, temporary friendship, and scent marks are all *sparse deltas with a closed-form recovery*: no per-frame cost and exact catch-up (rule 8 and rule 9). |
| `expend(dt, distance, effort)` + `footing().cost` | animalBehavior.ts:95, ground.ts:180 | The energy cost of every action. Keep it. |
| Gaits / rigs | gaitFor, quadrupedPose, rigs | The agent core outputs `motion/heading/speed` into the existing `AnimalBrain` fields, so **locomotion, rigs, sound and snapshots are untouched**. |
| Interest tiers + jobs | core/interest.ts | Near: the full agent tick. Mid: a low-rate tick. Far: the closed-form state only. |
| Seeded RNG | proc/rng.ts (`stream`, `sample` with `Dist`) | Used once per individual for temperament (boldness, vigilance, flight distance), and for placement only. |
| Trace / inspector | proc/trace.ts `f()`, ui/inspector.ts | Every goal score and level is traced, so the inspector can show *why the rabbit is doing this*. |
| `focusTarget` cone | main.ts:358–366 | Becomes the lock-on percept (aim hold → lock). |

---

## 3. Proposed shared architecture (minimal, species-data-driven)

```
 percepts ─┐                     ┌─> action ──> AnimalBrain.motion/heading/speed ──> existing gait/rig/sound
 (senses)  ├─> levels ─> goals ──┤
 levels ───┘   (needs)  (scored) └─> reach/contact ──> CONTACTS ──> TRANSACTIONS registry ──> effects
                                                                     (resource transfer, level change, state, why, delta, sound)
 resource fields (sunlight on ground, clover units, forage units, water) <── regrowth transactions (sunlight×clover…)
```

### 3.1 `core/agent.ts`: ONE agent core for every animal (wolf autonomy, deer, hare, later people and birds)
- **Levels** (0..100, all species, data-driven rates): `energy` (general), `stamina` (burst reserve), `relaxation`
  (calm ↔ alarmed), with `hunger` = a function of energy and `fear` = the strongest threat percept. Rates come from species
  data. For the hare these are Matthew's numbers: energy −1/8 per s relaxed, ×8 in flight; stamina 100 → 0 in 8 s of flight
  and 0 → 100 in 8 s of rest; 100 clover = 1 energy. The `AnimalBrain` keeps `energy` and `expend()`, so the agent core
  wraps it rather than forking it.
- **Percepts** from ONE `perceive(agent, world)`:
  - smell (senses.ts plume with `windAt`);
  - hearing (sound cues with level × distance falloff, from the player's footsteps and the noises of other agents);
  - sight (facing cone × range from `light.ts` lux × cover from `siteAt`);
  - touch (the `CONTACTS` pairs it is in);
  - percepts carry `{ key, kind, level, bearing, distance }`. They replace `AnimalBrain.sense()` distance bins, which stay
    as a compatibility shim.
- **Goals**: a short species table of drives. Each is scored as `weight × need × percept`, and the highest score wins with
  hysteresis (no flip-flop). Examples: `graze` (hunger × clover percept), `flee` (fear × stamina > 0), `scan` (when
  relaxation drops below the species' vigilance level), `rest` (low stamina or energy), `follow herd`, `investigate`
  (unknown scent or sound), `drink`, and for the wolf `hunt` / `stalk` / `mark`.
- **Actions** have *completion conditions*, never bare timers:
  - graze ends when a bite transaction completes (100 units moved) or when the patch is empty;
  - scan ends when relaxation recovers (no new percept) or when a percept confirms a threat;
  - flee ends when the threat percept is gone *and* relaxation is rising, or when stamina hits 0.
  - Matthew's 3 s graze and 1 s head-up are the *calm, well-fed* outcomes of these rates. They are not clocks.
- **Steering** (`core/steer.ts`, tiny): context steering over 12–16 directions. Each direction is scored by goal alignment,
  minus obstacle and water cost from the same probe as today. **A jump is an action**, chosen only when the goal direction
  is blocked by a low obstacle *and* the detour costs more energy than the jump (for example in flight or a pounce). That
  ends the "jump at every log" behaviour and the 117° back-and-turn and spin.
- **Temperament**: drawn once per individual from its seed (`sample(r, Dist)`): boldness (flight distance), vigilance (how
  fast relaxation recovers), and gregariousness (deer). It is variation with a cause (the individual), not dice per decision.
- **Species data**: `BEHAVIOUR[species] = { levels, drives, percept thresholds, gait speeds, reach, diet }` in one file
  (`core/behaviourData.ts`). Only data differs between wolf, deer and hare. The code is one path.

### 3.2 `core/transactions.ts`: ONE registry keyed by (kindA, kindB, verb)
```ts
type Effect =
  | { transfer: 'clover' | 'forage' | 'energy' | 'water'; from: 'a' | 'b' | 'field'; to: 'a' | 'b'; rate: number }
  | { level: 'energy' | 'stamina' | 'relaxation'; on: 'a' | 'b'; delta: number }
  | { state: string; on: 'a' | 'b' }           // e.g. prey 'held', 'limp', 'friend-until'
  | { why: WhyStep; on: 'a' | 'b' }            // closed tag
  | { delta: DeltaKind; at: 'a' | 'b'; m: number } // footprint, scent, carcass, grazed…
  | { sound: string; at: 'a' | 'b' };
interface Transaction { a: Kind; b: Kind; verb: 'contact' | 'graze' | 'bite' | 'release' | 'consume' | 'tick'; when?: (A, B) => boolean; effects: Effect[] }
```
- Fired by a **contact** (a `CONTACTS` rising edge or a lasting pair while the action holds it) or by an agent **action**
  (graze, bite). Ticks only happen for lasting pairs and fields, at the interest tier's rate.
- Pure `(state, txn) → state`, like events.ts. Player-remembered records go to the save; transient ones stay in memory
  (the existing `playerRemembered` rule).
- **The first entries** are drawn from things that exist or are designed:

| a × b | verb | effects |
|---|---|---|
| sunlight × clover patch | tick | `transfer clover field → patch at rate = regrow × groundLight(x,z,t)` (0 → 100 % in ~15 min of full sun, Matthew) |
| hare × clover | graze | `transfer clover patch → hare 100 units per bite`; `level energy +1 per 100 units` |
| deer × forage | graze | same, replacing the flat `FORAGE_ENERGY`. Replaces `consumeForage`'s remove-forever with depletion and regrowth |
| wolf × hare | bite | `state hare 'held'/'limp'`, sound squeal (once), why `caught by player` |
| wolf × hare (held) | consume | `transfer energy hare → wolf` (from hare mass, not a flat 35), `delta carcass` (small remains) |
| wolf × hare (held) | release | `state hare 'friend' with closed-form decay (~3 min)`; flight suppressed while the relationship strength is above a threshold |
| log × ground | contact | existing `solidContact` (why: resting) |
| log × water/insects/sunlight | tick | (T-0007) ongoing why steps become real: wetness from the soil bucket, `sunned` from groundLight |
| player × rock | move | existing `interact('move')` |
| wolf × ground | mark | `delta scent` (finally written), which prey and other wolves smell |

### 3.3 Resource fields: `core/fields.ts` (pure functions plus sparse deltas)
- `groundLight(x, z, worldSec)` = `siteAt(x,z).light × shortwave(solar(day,hour).cosZ, weatherAt(x,z).cloud)`. It is cheap,
  pure and shared by clover growth, rabbit thermoregulation (later) and the inspector.
- Patches (clover, forage): their positions come from `thomas()` with a niche (clover = high light, mid wetness). Their
  `units(t)` are **closed form**: `min(cap, u_last + ∫ regrow·groundLight dt)`, integrated per game hour, so there is no
  per-frame cost and catch-up is exact when the chunk loads again. Only a patch that was grazed stores a `grazed` delta
  `{ key, u_last, t_last }`. Everything else is derived. This follows rule 8 (far = math) and rule 9 (only deltas stored).
- Water: the existing hydrology (`lakeAt`, `riverAt`, soil bucket) is the drink field (a later step).

### 3.4 How the rabbit branch generalises (don't duplicate it)
grok/rabbit-clover (worktree `C:\dev\boreal-grok-rabbit`) is the **first user** of this core. It had no code yet at audit
time, so it should be written *as* the core, not alongside it:
- the hare's energy, stamina and relaxation → the `levels` in `core/agent.ts` with `BEHAVIOUR.hare`;
- graze, head-up, flight and relax → `drives`/`actions` with completion conditions, as in §3.1;
- the awareness radius → `perceive()` (scent plume + footstep level + sight), with thresholds in `BEHAVIOUR.hare`;
- clover patches and sunlight regrowth → `core/fields.ts` + the first two registry rows;
- the wolf and deer steps (§4) then add only data (`BEHAVIOUR.wolf`, `BEHAVIOUR.deer`) and delete code
  (`deerHerd.ts` timers, `autonomy.ts`, the jump and back-up branches of `decide()`).

**Ask for the rabbit branch:** put the levels, goal scoring, steering and transaction registry in `core/agent.ts`,
`core/steer.ts`, `core/transactions.ts` and `core/fields.ts` (names can change), with hare and clover as data. If that is
done, steps 1–2 below shrink to data plus the call-site swap.

### 3.5 A compact "why" on every spawned object
- Keep `why.ts`: closed tags, derived per kind, stored only on change. **Add tags** (still closed, still short):
  `gap` (a canopy gap opened by a fallen tree), `lit` (sunlight reaches the ground), `grazed`, `regrew`, `drawn` (an animal
  came to the place because of `by: clover|cover|water`), `fled`, `caught`, `released`, `befriended`, `marked`, `eaten`.
- **Spawned animals get a real why.** A hare is not "spawned in a ring 18–45 m around the wolf". Its chain is
  `born → drawn by cover+clover`, and its spawn point is a habitat-suitable cell (clover nearby, cover nearby) within the
  interest ring. A respawn comes from the local population density, not from a 25–45 s timer.
- **Logs and gaps link up** (the T-0007 seam): a log's chain already says `failed → pulled → tipped`. Its placement should
  remove the tree it came from, which leaves a canopy gap. The gap raises `siteAt.light`, so clover grows there. That gives
  one causal thread: tree fell → log + gap → sunlight → clover → hares → wolf.
- **Agents also carry a live, never-saved `because`** (`{ goal, cause: key, level }`), for example "grazing: hungry (energy
  41), clover 64 units". The inspector and the debug view show it.

---

## 4. Migration plan (small, mergeable steps, in priority order)
Each step is a `grok/<topic>` branch off main and merges when Matthew says "merge it". Tests stay green and headless
browsers are killed after each run.

| # | Step | Files touched | Size | Risk | What Matthew will see |
|---|---|---|---|---|---|
| 0 | **Contract.** The rabbit branch implements §3.1–3.3 as the shared core, with hare and clover as the first data (no extra branch, just this interface) | core/agent.ts, core/steer.ts, core/transactions.ts, core/fields.ts, core/behaviourData.ts (new), animals/hare.ts | (in the rabbit work) | low | The rabbit grazes head-down in clover in sunlit gaps, lifts its head when you cross its senses, and flees with real stamina (already planned) |
| 1 | **Wolf Autonomous mode on the agent core: no purposeless jumps.** Replace `autonomy.ts` explore-run, the spin and the brain's sine wander with drives: investigate the strongest scent (senses.ts `smell`), approach prey, graze forage or eat when hungry, rest when stamina or energy is low, follow terrain. Context steering around trunks. A jump only when the goal path is blocked by a low obstacle and the detour costs more | core/autonomy.ts (shrinks to a call), core/agent.ts, core/steer.ts, core/behaviourData.ts (`wolf`), main.ts:345 call site, tests/autonomy.test.ts | M | low (Autonomous mode only; manual play untouched) | In Autonomous mode the wolf walks with its nose to the wind toward scents, goes *around* trees and logs, trots toward prey, lies down when tired. It never hop-storms, back-and-turns or runs blind. The status line shows its reason ("following deer scent") |
| 2 | **Deer on the core.** `deerHerd.ts` timers → levels: head-down time ends when relaxation drops (it falls faster alone, at dusk, or after a sound); a scan ends when relaxation recovers. Alarm comes from *perceived* wolf scent, footsteps or sight, not from species. Flight ends on lost percept plus stamina. Stotting is kept as the *first bound of flight* (a reason). Herd cohesion is kept as a percept | core/deerHerd.ts (shrinks), core/animalBehavior.ts (`decide()` jump/back/explore branches removed; `sense` kept as a shim), render/buildScene.ts:190–224, core/behaviourData.ts (`deer`), tests | M | medium (shared brain; the snapshot fields `STATE_FIELDS.brain` need the new levels tagged) | Deer graze calmly and look up more when alone or after you snap a twig. Approaching from downwind and slowly lets you get close, while upwind they flee early. No random bounding over every log |
| 3 | **Merge rabbit + clover** (the rabbit branch, if not already in before step 1) | (rabbit branch) | L | medium | Clover in sunny gaps, rabbits grazing and regrowth. The debug view shows energy, stamina, relaxation and clover units |
| 4 | **Dynamic contacts + registry wiring.** Agents begin and end `agent\|target` pairs at reach. `consumeForage` and the hare catch become registry rows. Forage gets units and sunlight regrowth (no more eaten-forever, no flat +18) | core/transactions.ts, core/events.ts (forage row), render/buildScene.ts `eat`, core/fields.ts, core/deltas.ts (`grazed` kind) | M | medium (save format: add `grazed` deltas; no RecordEntry change) | Berry patches thin out when eaten and grow back over time. Everything that eats now goes through one path |
| 5 | **Hunting I: lock-on + stalk + steered pounce.** Hold the aim on prey and it locks (from `focusTarget`, extended to hares). In stealth, the prey's awareness comes from your footstep level and scent, so moving slowly keeps you unnoticed. Releasing the crawl and leaping steers the pounce to the locked target until contact | main.ts:358–366 (lock percept), core/agent.ts (prey awareness already from step 0), core/locomotion.ts / jump (pounce steering), ui (lock marker on the senses ring) | M | medium (player controls; bindings from the controls screen) | A lock marker on the rabbit. The rabbit keeps grazing while you creep. The leap curves onto it |
| 6 | **Hunting II: pin, bite, hold, consume, release, temporary friendship.** Pin with the front paws, grasp with the jaws, one squeal, then limp. **A** eats (energy from the hare's mass), **B** lets it go. A release writes a decaying friendship (~3 min, closed form), during which flight is suppressed, then the memory resets | core/transactions.ts (bite, consume, release rows), core/events.ts (relationship strength + expiry, parseContext), render/playerWolf.ts (jaw/pin pose), animals/hare.ts (held/limp pose), audio (squeal once), bindings | L | medium–high (animation + save validation) | The full hunt Matthew described. A released rabbit lets you walk up to it for a few minutes, then grows wary again |
| 7 | **Why chains on spawned objects.** New closed tags. Hares spawn on habitat (clover + cover) with `born → drawn by`. Logs remove their source tree and open a gap (`gap`, `lit`). The inspector shows `why` + live `because` | core/why.ts, core/world.ts / population.ts (log ↔ tree link), animals/hare.ts spawn, ui/inspector.ts | M | medium (changes placement: GENERATOR_VERSION bump or a new stream, so existing saves stay valid) | The inspector on any rabbit, tree, log or clover patch says why it is there and what it is doing, and why. Clearings appear where trees fell |
| 8 | **Traces become real.** The wolf marks territory (a `scent` delta), kills leave `carcass` remains, hares leave droppings. All are smelled through the existing plume | core/deltas.ts writers, main.ts:183–187 (move off the 1 s interval into transactions), ui/senses.ts (already reads them) | S | low | Your own marks and old kills show up on the senses ring. Remains fade naturally |
| 9 | **Ambience from agents.** Birds and loons become cheap mid-tier agents in their habitat (water for loons, snags for woodpeckers, night for owls), and their calls are their actions (a level such as territorial drive at dawn) instead of timers | audio/borealSound.ts:243–262, core/behaviourData.ts (birds) | M | low | Bird calls come from places that make sense (the loon from the lake, the woodpecker from dead trees) and follow the time of day |
| 10 | **People ("Visitors") on the core** (needs: rest, warmth, travel along water), or retire the demo | core/behaviourData.ts, buildScene.ts:268–270 | M | low | Visitors walk somewhere for a reason, instead of swaying on the spot |
| 11 | **T-0007 forest floor**: logs as ongoing transactions (wetted from the soil bucket, sunned from groundLight, insects, decay into the ground pools via `addDeposit`) and nurse-log seedlings | core/ground.ts, core/why.ts, render (T-0007 plan) | L | medium | The forest floor visibly builds from old trunks. Moss and seedlings grow on the damp side of logs |

**Guard rails for every step**
- No `Math.random`, and no per-decision dice. A seeded draw is only for an individual's traits or for placement.
- Every new constant is data in `behaviourData.ts`, with a citation or a `[game calibration]` tag (PROJECT-RULES rule 5).
- Interest tiers: near is a full tick, mid is a low rate, far is closed form. There is no per-frame cost for resting contacts
  or unvisited patches.
- `STATE_FIELDS` tags every new field (tests/stateFields.test.ts). Snapshots (photo rewind) capture the new levels.
- Save: only player-remembered records and sparse deltas are written. `parseContext` validates every new field.
