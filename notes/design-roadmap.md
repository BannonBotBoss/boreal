# Live inside the living world

Header rule (Matthew, 2026-10-25 7:17 PM Pacific): the latest issue wins. When his issues conflict with each other, with older issues, or with existing code, plans, or tasks, follow the newer issue. A higher number wins, so #109 overrides #108 overrides #107, and #100–#109 override anything older. The same line is in `PROJECT-RULES.md`.

Rewrite permission, recorded as a rule 16 relay and not as an approval of any task (Matthew, 2026-10-25 7:15 PM Pacific, verbatim): "if you have to rewrite anything, i give you permission, as long as the design documents i posted are addressed."

Pinned at `14d5782` (main, 2026-10-25). Line numbers below are from that commit unless a line is named on an open change. Board task for this document: `tasks/T-0080-design-roadmap.md`. grokbot-3 does not approve its own plan.

## Plain-English summary

You will live inside an animal that was already alive, with its own past, body, and urges.
The sun, the season, the height of the land, and the sea make the weather. The animal feels snow, cold, wind, and food, not a name on a map.
A wolf follows scent. A deer watches for danger. You only sense what that animal could.
Hunger, thirst, and fear change how the world feels. There is no numbered bar.
One wheel moves time. Slow, you see a breath and a paw. Fast, you see herds, then seasons, then forests and ice.
Nothing pops away when time speeds up. A wolf becomes a pack, then many wolves, then the family line.
From the ground up to space it stays one picture. What shows depends on how far you are and how fast time is moving.
The order is where and when you are looking, then the climate, then stepping into a real animal, then senses, then the time wheel.
The one picture from space down to the trees, and the one clock in the game, are already being built. This plan follows them.
Where the game already fits your notes, it stays. Where it fights them, it is rewritten, which you allowed.

## What this document is

The full path from today's code to issues #100 through #109. No simulation code changes in this task. The first wave is eight proposed tasks. Every later step is the queue: a bot takes the next step whose dependencies are done, files one task under the next free id, and does not file the rest.

Matthew posted the ten issues between 6:56 and 7:13 PM Pacific on 2026-10-25 and is done supervising. This plan asks him nothing. Two pieces are already open and are linked, not rebuilt:

- The picture from space down to the forest is pull request #94, branch `grokbot-3/render-unification-plan`, task T-0078, write-up `notes/render-unification-plan.md`. That covers the spatial half of #107. Steps 33 and 36 add time and the view from outside a body. They do not add a second picture.
- The one clock, with the control in the game, is pull request #92, branch `grokbot-3/single-time-control`, task T-0077 on that branch. The in-game bar, the single rate, and the removal of the extra speed sliders stay. Steps 3, 30, 31, and 34 extend that clock. `grokbot-3/menu-no-bounce` also used the id T-0077; the clock work is the single-time-control branch. A merger who hits that collision renumbers by rule 13. Do not open a third clock task.

## Conflicts, and which issue won

Standing project rules are not older issues. The precedence line does not repeal them. Where a sketch in #100–#109 fights rule 3 (one animal pipeline), rule 4 (mass from volume times density), or rule 5 and rule 7 (published models, no invented digits), the standing rule keeps the mechanism and the winning issue keeps the relationship. The numbers gate still replaces example coefficients.

| # | Conflict | Winner | What the plan does |
|---|---|---|---|
| 1 | #101 sends a JSON list of real animals. #105 sends nested perception structs. #106 sends one packed buffer of perception only. | #106 | Step 16. No world JSON. |
| 2 | #101 always stores every individual. #107 says the simulation is always at full detail and only the picture changes. #109 switches the simulation itself (individual, population, species, geology) and says a thing transforms instead of vanishing. | #109 | Steps 14 and 32. Individuals exist only while time is slow and the animal is near. |
| 3 | #104 draws the whole forest for every species, then paints senses on top. #105 and #106 say the viewer receives only what that animal perceives. | #106 | Steps 15, 16, and 24. Nearby ground is drawn because it is perceived, not because the whole world was sent. |
| 4 | #101 picks an action with fixed cutoffs (fear 90, thirst 80, hunger 80, habitat 25, mating 85). #103 says the strongest weighted urge wins. `src/core/agent.ts` already picks by utilities. | #103, reusing `agent.ts` | Step 10. Do not port the cutoff ladder. |
| 5 | #108 names eight time scales (Immediate through Planetary). #109 names seven levels (Individual through Geological). | #109 | Step 32. Behavioral folds into Group. Seasonal and Generational fold into Ecosystem. Planetary is a height, not a time mode (step 33). |
| 6 | #108 maps a dial position from −8 to 8 with powers of ten. #109 maps −1 to 1 with `10^(12 × abs(position))` and a dead zone near 0. | #109 | Step 30. |
| 7 | #108 changes speed directly. #109 accelerates with a spring, jerk, and hysteresis, and blends instead of popping. | #109 | Steps 31 and 32. #108's fields (time, speed, target speed, mode) stay. |
| 8 | #107 walks backward along causes. #109 jumps with `state_at(time)` and does not keep every frame. Pull request #92 does not let rewind seek the clock, because ground years are an accumulator. | #109 | Step 34. One clock. A backward gap still does not age the ground twice. The seek uses the closed form. Step 37 keeps the cause chain as the explanation, not as the scrubber. |
| 9 | #100 and #101 show round example coefficients (a 35 degree latitude span, ±15 degrees of season, rain only above 70% humidity, an unweighted habitat sum). The forest climate is Kenora normals plus a cited diurnal curve (`src/core/weather.ts` `climateRaw`, lines 112–118). The planet grid uses the same family of published budgets (`rust/boreal-sim/src/planet_fundamentals/`). The numbers gate forbids invented digits. | The issues win the chain and who computes it. The digits stay sourced. | Step 2 moves authority to the Rust grid. Steps 5–9 add the missing relationships (rain shadow, ocean moderation, drought, habitat) with citations. The 35, 15, 70, and 80 are not game numbers. |
| 10 | #102 stores `body_mass` on the animal. Rule 4 says mass is volume times density and is never assigned. | Rule 4 | Step 18. Metabolism reads the generated mass. The field is not stored. |
| 11 | #100 and #101 score habitat as food + water + shelter − competition − predator pressure. #100 also subtracts environmental stress. #106 puts temperature and oxygen stress on the body. | #101 for the habitat sum, #106 for the stress | Step 9 sums #101's terms. Step 18 carries the stress. It is not subtracted twice. |
| 12 | #102 puts fear, curiosity, and mating in one mind. #103 puts hunger and fear in one instinct list. #106 splits body, emotion, and urge into three blocks. | #106 | Steps 16 and 19. |
| 13 | #105 asks for a renderer type per species (wolf, deer, eagle, salmon, bear). Rule 3 says a new animal is a spec row, not a new source file. | Rule 3 for the code shape. The issues for the behaviour. | Step 29. One filter table, one row per species. |
| 14 | #108 sets time zero at the formation of the solar system. `src/core/deepTime.ts` `dialToYears` (lines 91–96) sets zero at now. | #108 | Step 3. Now is Earth's age on that one line. The play clock remains the rate. |
| 15 | #100 says snow when temperature is below 0 °C, otherwise rain. The forest grid and the Rust precipitation already do that (`src/core/weather.ts` line 274, `precipitation.rs` line 77). | No fight. #100 matches the code. | Step 7 locks it with a test and exposes depth. Do not replace the threshold. |
| 16 | #107 turns layers on with hard altitude and speed rectangles. #109 uses a score, hysteresis, and a blend. | #109 | Step 33. #107's layer list is the menu of pictures. #109 decides when each one is visible. |
| 17 | The player rig is created fresh (`src/render/playables.ts` lines 27–50). #102 and #103 say you enter an animal that already has a past. | #102 and #103 | Step 17. The shared playable motor stays (rule 3). |
| 18 | The wolf senses panel shows a percent and a distance (`src/ui/senses.ts` lines 31 and 69; `src/core/needs/senses.ts` `threatCue` lines 37–41). #103 and #104 replace numbers with sensation. | #103 and #104, packed by #106 | Steps 20, 24, and 25. The scent math in `src/core/senses.ts` and `src/core/traces.ts` stays. |
| 19 | Inside #106, `#[repr(C)]` would pad the embodied id off the published offsets, and the sound fields sum to 24 bytes while the issue says 28. The offset table and the later "reserve bytes" line are the specific layout. | The offset table, with 4 reserved bytes on the sound so 28 holds | Step 16. Memory stays 20 bytes, which already matches its fields. |
| 20 | Pull request #92 clamps the one rate to 0.05–16 world seconds per real second (`src/core/worldClock.ts` `RATE_MIN` / `RATE_MAX` on that branch). #109 spans a pause through geological time on a log wheel. | #109 for the rate law. Pull request #92 for there being one clock. | Steps 30 and 31 replace the clamp. They do not add a wheel beside the bar. |
| 21 | #104's observer and #105's summary frame versus #107's optional embodiment versus #109's height times time. | #109 | Steps 1, 33, and 36. One simulation. Two readings: inside a body, or looking from outside. |

## What is already here

Reuse these. Do not write a second copy.

| Idea in the issues | Already in the repo | Gap the steps fill |
|---|---|---|
| Sun drives climate | `rust/boreal-sim/src/planet_fundamentals/energy/solar_budget.rs`, wired by `src/core/planetBudget.ts`. Forest fallback `weather.ts` `solar`. | The forest still computes its own climate (step 2). |
| Temperature, humidity, wind, rain, snow on a planet grid | Planes in `rust/boreal-sim/src/grid.rs` lines 7–17 (`tair`, `q`, `snow`, `soil`, `cloud`, `rh`). Snow below 0 °C in `precipitation.rs` line 77. | The forest grid does not read those planes (step 2). No rain shadow, no moisture debt (steps 5 and 6). |
| Near weather you can stand in | `src/core/weather.ts` `initWeather` / `updateWeather`: a moving column, Stam-style wind, Kessler rain, Manabe bucket, degree-day melt (lines 1–9, 249–274). | It is fed by `climateRaw`, a second climatology (lines 112–118). Step 4 keeps the column and changes the driver. |
| Far things are math | `src/core/interest.ts` lines 10–19. Near 60 m, mid 100 m, beyond that no stored body. | #109 agrees for fast time and far space. The radii stay. What they aggregate changes (step 14). |
| Ground, rivers, decay | `src/core/ground.ts`, river stages, `src/core/deltas.ts`. Closed form in years. | Step 34 queries them at a time. Do not store every year. |
| Deep time | `src/core/deepTime.ts`, tasks T-0060 and T-0065. | Epoch moves to #108 (step 3). The stage model stays. |
| One play clock on main | `src/core/worldClock.ts`: real seconds, frozen while the menu is open. A separate slow-motion (`src/core/timescale.ts`) does not move the sun. | Pull request #92 makes one rate, including the sun. This plan does not redo that. |
| Animal body and one motor | Skeleton and species specs. `Playable` in `src/render/playables.ts`. Needs in `src/core/needs/engine.ts` (Taylor, Heglund and Maloiy 1982). Wolf smell distance cited from Mech 1970 on `WOLF_NEEDS`. | You still spawn a fresh rig (step 17). Needs still show as numbers (step 20). |
| Urge from what is sensed | `src/core/agent.ts` lines 1–16: utilities, no mission timer. `AnimalBrain` in `src/core/animalBehavior.ts` is the legs. | Do not add `choose_action`. Step 10 feeds habitat into the utilities. Step 13 moves the authority to Rust. |
| Scent and sound | `src/core/senses.ts` `scentLevel`, `src/core/traces.ts`, `src/ui/senses.ts`, `src/render/sensesHalo.ts`. | The panel is a meter and a label (steps 24 and 25). |
| Populations when you are far | T-0040 headless animals. T-0070 density fields on the globe. | The simulation still steps individuals only. Step 14 adds the coarse modes #109 requires. |
| Why a thing is here | `src/core/why.ts`. | Step 37 extends the chain through drought and climate. |

## How to read a step

Each step has one plain goal, whether it reuses or rewrites, the issues it answers, what it depends on, a size (S one module and a test, M a few modules, L a system move), and the gates. Numbers: a table of game value, published value, source, and yes or no. Frame: a recording when the picture or the motion changes; otherwise N/A and a numeric check. Evidence: the files a reviewer opens. A bot does not start a step whose dependency is still open. Steps with no task id are the queue.

## Phase A — Where you are, and the climate that feeds the land

### Step 1 — One reading of where, how high, how fast, and who

- **Goal:** Any system can ask one record: position, height, time rate, and which creature you are inside, if any.
- **Kind:** Rewrite of the scattered reads. Reuses `INTEREST` (`src/core/interest.ts` lines 10–19), the playable id (`src/render/playables.ts` line 52), and `worldSec` (`src/core/worldClock.ts`). When pull request #92 lands, the rate field reads that clock's one rate. Until then it reads 1.
- **Issues:** #107 (observation coordinates), #109 (height and time together).
- **Depends on:** Nothing. Parallel with steps 2 and 16.
- **Size:** S. Board: T-0081.
- **Gates:** No new physical number (N/A, the fields are copies). Frame N/A (nothing on screen). Evidence: a test that the four fields match the camera position, the interest centre, the playable id, and the clock. No second interest radius and no second clock.

### Step 2 — The planet model is the weather the forest reads

- **Goal:** Standing in the forest, temperature, humidity, wind, rain, and snow come from the Rust planet grid, not from a second formula.
- **Kind:** Rewrite of authority. Replaces `climateRaw` (`src/core/weather.ts` lines 112–118) as the source. Reuses `planet_fundamentals` and `src/core/planetBudget.ts`. The TypeScript solar copy stays only as the fallback already documented when the wasm will not load (`planetBudget.ts` lines 8 and 124). Both must not drive the same frame.
- **Issues:** #100 (solar, temperature, moisture, wind, clouds, rain), #101 (Rust computes, the viewer asks).
- **Depends on:** Nothing. Parallel with steps 1 and 16.
- **Size:** M. Board: T-0082.
- **Gates:** Numbers: Kenora January and July means against Environment and Climate Change Canada 1981–2010 (already the `NORMALS` table), and the existing solar budget within the current parity. The 35 °C and ±15 °C sketches are not used. Frame: same date before and after, or N/A if the picture stays inside that tolerance, with the numeric check named. Evidence: `tests/planet-budget.test.ts` updated so a loaded wasm is the authority.

### Step 3 — Now sits on one line from the birth of the solar system

- **Goal:** Time zero is the formation of the solar system. The present is Earth's age on that same line. The play clock is still the only rate.
- **Kind:** Rewrite of the epoch in `dialToYears` (`src/core/deepTime.ts` lines 91–96), which puts zero at now. Reuses the stage model and T-0060. Does not add a clock. Waits for pull request #92 so the rate and the epoch are not edited in two places.
- **Issues:** #108 (the epoch). #109 does not pick a different zero.
- **Depends on:** Pull request #92 merged, or this step branched from `grokbot-3/single-time-control`. Parallel with step 4 once that lands.
- **Size:** M. Queue.
- **Gates:** Numbers: Earth's age and the solar-system formation age from the citations already on `DEEP` / T-0065, not a new round number. Frame N/A if the dial is not on screen yet; the numeric check is `state` at 0 and at the present. Evidence: one function, no second epoch.

### Step 4 — Weather moves, and the climate is what it relaxes toward

- **Goal:** The air around you is a weather cell (temperature, pressure, humidity, wind) that moves. Left alone, it relaxes to the planet climate from step 2, not to a private formula.
- **Kind:** Rewrite of the driver only. Reuses `initWeather`, `updateWeather`, the Kessler rain, and the bucket (`weather.ts` lines 134–139 and 249–274).
- **Issues:** #100 (weather cells, clouds, rain).
- **Depends on:** Step 2. Parallel with steps 5, 6, and 7.
- **Size:** M. Queue.
- **Gates:** Numbers: the existing cited lapse, Kessler, and Manabe constants stay; any new relaxation time needs a source or a `[game calibration]` label. Frame: a short clip of cloud or rain at a fixed date, plus the cell values. Evidence: `climateRaw` is not called from the near grid.

### Step 5 — The sea softens the seasons, and a ridge makes a dry side

- **Goal:** Coasts have milder seasons. A ridge is wet on the windward side and drier after the air crosses it.
- **Kind:** New relationships on the existing grid. Reuses elevation, humidity, and the land-sea mask (`planet_fundamentals/surface/`). Does not replace precipitation.
- **Issues:** #100 (ocean effect, rain shadow).
- **Depends on:** Step 2. Parallel with steps 4, 6, and 7.
- **Size:** M. Board: T-0085.
- **Gates:** Numbers: a cited coastal temperature contrast and a cited rain-shadow ratio (orographic enhancement versus leeward deficit), tabled. The issue's sketches are not the digits. Frame N/A on the forest floor if this is a map; a numeric transect across a test ridge is the check. Evidence: windward rain greater than leeward rain on that ridge, and the ocean term falling with distance from water.

### Step 6 — A dry spell is a debt, not a switched-off rain

- **Goal:** Each place remembers how far rain has fallen behind what the climate expected. The debt does not go below zero. Plants and animals can read it.
- **Kind:** New accumulator. Reuses the precipitation plane. Not a second hydrology.
- **Issues:** #100 (drought), #101 (`MoistureTracker`).
- **Depends on:** Step 2. Parallel with steps 4, 5, and 7.
- **Size:** S. Board: T-0086.
- **Gates:** Numbers: the expected rain is the existing climate normal; the debt index cites a published drought index or is labelled calibration. Frame N/A until step 9 changes plants. Evidence: a test where a dry month raises the debt and a wet month pays it down, and it never goes negative.

### Step 7 — Snow is a depth the body can feel

- **Goal:** The animal can read snow depth in centimetres. New snow falls below 0 °C. At and above 0 °C it is rain. Melt uses the degree-day factor already in the code.
- **Kind:** Reuse. Locks the threshold #100 already matches (`weather.ts` line 274, `precipitation.rs` line 77) and exposes depth from the snow-water store and `snowDensity` (`weather.ts` line 56, Sturm et al. 2010).
- **Issues:** #100 (snow).
- **Depends on:** Step 2. Parallel with steps 4, 5, and 6.
- **Size:** S. Board: T-0087.
- **Gates:** Numbers: density and the degree-day factor keep their citations; depth in centimetres is derived, not a new constant. Frame: snow on the ground in a below-zero month, bare ground in a warm month, or N/A with the depth formula checked against a known snow-water value. Evidence: no second snow model.

### Step 8 — A climate name is an output, and no animal reads it

- **Goal:** Average temperature, yearly rain, and how strong the seasons are produce a climate class. Deer and wolves never branch on that class. They read depth, degrees, wind, and food.
- **Kind:** New classifier over step 2 and step 5. Replaces any future temptation to hand a biome to behaviour. Existing surface bands stay as colours.
- **Issues:** #100 (classification, and the deer that ignores "temperate forest").
- **Depends on:** Step 5. Parallel with nothing in phase A after that.
- **Size:** S. Queue.
- **Gates:** Numbers: class boundaries from a published scheme (Köppen thresholds or the issue's four classes with those published bounds, not round guesses). Frame N/A. Evidence: a test that behaviour code does not read the class id.

### Step 9 — A place has food, water, shelter, and a score

- **Goal:** Each habitat cell carries food, water, shelter, vegetation, competition, predator pressure, and a quality score.
- **Kind:** New cell fed by steps 5–8 and the existing plants (`src/core/flora`, forage regrowth T-0015). Quality is food + water + shelter − competition − predator pressure (#101). Environmental stress is not in this sum (conflict 11).
- **Issues:** #100 (habitat), #101 (habitat cell and seasonal vegetation).
- **Depends on:** Steps 6, 7, and 8.
- **Size:** M. Queue.
- **Gates:** Numbers: food and shelter from existing plant biomass and cover, with the citation already on those systems; any new weight is calibration and labelled. Frame: a hunted clearing reads lower food than an ungrazed one, or N/A with the score tested on two fixture cells. Evidence: no animal reads a climate-class string.

### Step 10 — The strongest urge wins

- **Goal:** Hunger, thirst, fear, fatigue, and the habitat score change which urge is strongest. The animal then feeds, drinks, flees, rests, or moves. There is no ladder of magic cutoffs.
- **Kind:** Reuse `src/core/agent.ts` utilities. Adapt them to read step 9. Do not add #101's `choose_action`. `AnimalBrain` stays the legs until step 13.
- **Issues:** #100 (need score), #101 (the ladder, which loses), #103 (weighted drives).
- **Depends on:** Step 9.
- **Size:** M. Queue.
- **Gates:** Numbers: the existing need rates (Nagy and Peterson, Taylor et al., already on `needs/engine.ts`) stay. New weights need a source or a calibration label. Frame: a hungry animal approaches food and flees when a predator is sensed, recorded. Evidence: no threshold constants 90, 80, 25, or 85.

## Phase B — Rust decides. The picture only shows.

### Step 11 — One component store, empty

- **Goal:** The simulation world is an entity store. Nothing behaves yet.
- **Kind:** New crate, chosen the way rule 11 says. Shortlist `bevy_ecs` and `legion` (licence, maintenance, size). Do not invent a store. Record the pick in `AGENT-NOTES.md`.
- **Issues:** #101 (ECS).
- **Depends on:** Nothing. Parallel with steps 1, 2, and 16.
- **Size:** M. Board: T-0084.
- **Gates:** Numbers N/A (no rates). Frame N/A. Evidence: the crate links, an empty world constructs, `cargo test` still passes, and no species file was added.

### Step 12 — The animals live in that store

- **Goal:** Position, age, needs, kinship, and territory are components. Species stay data rows.
- **Kind:** Rewrite of where a creature is stored. Reuses species specs, `WOLF_NEEDS` / `HARE_NEEDS`, and the skeleton. `AnimalBrain` is no longer the record of truth after step 13; until then it mirrors the component.
- **Issues:** #101 (components), #102 (the creature already exists).
- **Depends on:** Step 11. Parallel with step 18's data definition.
- **Size:** L. Queue.
- **Gates:** Numbers: starting age and group size use the citations already on the species rows (Mech and Boitani for the wolf pack). Frame N/A until step 17. Evidence: a wolf spawned by the store has a non-zero age and a parent id or an explicit founder flag. No `body_mass` component (conflict 10).

### Step 13 — The viewer stops running the ecosystem

- **Goal:** Rust steps needs, urges, and acts. Three.js asks what to draw. It does not call the decision.
- **Kind:** Rewrite of authority in `src/main.ts` (the needs step and the brain). Reuses the need equations by porting them, checked against the TypeScript numbers. The picture code stays.
- **Issues:** #101 (the viewer never calculates the ecosystem), #103 (the stack from world to act).
- **Depends on:** Steps 10 and 12.
- **Size:** L. Queue.
- **Gates:** Numbers: a port parity table against `stepNeeds` for one wolf hour (water, energy, rest). Frame: the wolf still walks, recorded, because the motor is unchanged. Evidence: a test that the frame loop does not call `decide` or `stepNeeds` for a stored animal.

### Step 14 — Far away, or time sped up, the individual becomes a number

- **Goal:** Near and slow, creatures are individuals. Far, or at a faster time level, the same animals are a density, a herd, or a species range. They transform. They do not pop out.
- **Kind:** Rewrite of "always every individual" (#101 loses) and of "always full detail" (#107 loses). Reuses interest tiers, T-0040, and T-0070's fields as the picture of a density. The coarse step is new.
- **Issues:** #101, #107, #109 (switch the simulation; continuity).
- **Depends on:** Step 12. The time levels come from step 32; until then only the distance tier is live.
- **Size:** L. Queue.
- **Gates:** Numbers: densities from a published boreal figure (wolf or deer per square kilometre) or labelled calibration. Frame: leaving the near radius replaces bodies with the density drawing without a one-frame hole, recorded. Evidence: a count test that individuals plus the density describe the same population.

### Step 15 — Nothing sends the raw world across

- **Goal:** The only payloads are the perception buffer (step 16) and, when you are not inside a body, the summary (step 36).
- **Kind:** Rewrite of the JSON sketch in #101, which was never built. This step is the test that keeps it unbuilt.
- **Issues:** #101, #105, #106.
- **Depends on:** Step 16.
- **Size:** S. Queue.
- **Gates:** Numbers N/A. Frame N/A. Evidence: a static test that no new module serializes animal positions as JSON for the viewer.

## Phase C — You enter a life

### Step 16 — The buffer is what the animal perceives, in the order #106 gives

- **Goal:** One contiguous block: header, body feelings, emotions, urges, visible things, scent volumes, sounds, memory marks. Counts may be zero. Caps stay small (on the order of 32 visible, 16 scents, 8 sounds, 12 memories).
- **Kind:** New contract. Replaces the JSON and the nested-struct sketches (conflicts 1 and 19). No drawing yet.
- **Issues:** #105 (the fields), #106 (the bytes). #106 wins the packing.
- **Depends on:** Nothing. Parallel with steps 1 and 2.
- **Size:** S. Board: T-0083.
- **Gates:** Numbers N/A (sizes are the issue's layout, not physical constants). Frame N/A. Evidence: Rust writer and TypeScript reader agree on a known frame. Header offsets match the issue's table (embodied id at byte 20, not padded to 24). Sound entry is 28 bytes with 4 reserved. Memory entry is 20 bytes. Reserved tails stay for later senses (echo, heat, ultraviolet) without a version break.

### Step 17 — You step into an animal that is already alive

- **Goal:** Choosing a wolf, a deer, or a hare enters one that already has an age, a place, and a past. You do not mint a blank body.
- **Kind:** Rewrite of `Playable.create` as the entry (`playables.ts` lines 27–50). The motor interface stays, so there is still one control path (rule 3).
- **Issues:** #102, #103 (inhabit).
- **Depends on:** Steps 1 and 12.
- **Size:** M. Queue.
- **Gates:** Numbers: age inside the species' published lifespan. Frame: entering shows that animal in the place it already stood, recorded. Evidence: the embodied id on the step 1 record equals the store id, and a second entry of the same id keeps the memories from step 22.

### Step 18 — The body feels, and it does not store a mass

- **Goal:** Energy, water, temperature, health, stress, age, stamina, and pain are feelings. Mass stays the generated volume times density.
- **Kind:** Rewrite of "put `body_mass` on the struct" (conflict 10). Reuses `stepNeeds` and `rigMass`.
- **Issues:** #102, #103, #106 (physiology block).
- **Depends on:** Step 12.
- **Size:** M. Queue.
- **Gates:** Numbers: the existing water and energy equations, parity-checked. Pain and stress need a source or a calibration label. Frame N/A until step 20. Evidence: no assigned mass field; a test still derives mass from geometry.

### Step 19 — Body, feeling, and urge are three different blocks

- **Goal:** Hunger and thirst are the body. Fear and curiosity are feelings. The pull to feed, flee, mate, or move is the urge. Mating is an urge, not a mind stat.
- **Kind:** Rewrite of the single mind (#102) and the single instinct list (#103). Reuses step 10's weights.
- **Issues:** #102, #103, #105, #106.
- **Depends on:** Steps 10 and 18.
- **Size:** M. Queue.
- **Gates:** Numbers: carry the step 10 weights. Frame N/A. Evidence: the three blocks occupy the step 16 offsets, and a test that hunger does not also appear as an emotion.

### Step 20 — An urge is a feeling, not a mission

- **Goal:** A migrating animal grows restless as the season turns. Nobody prints "go south" or "hunger 91%". The percent meter and the "40 m ahead" line go away for the embodied player.
- **Kind:** Rewrite of the numeric readout (`src/ui/senses.ts` lines 31 and 69, `threatCue` in `needs/senses.ts` lines 37–41). Reuses the season from the clock.
- **Issues:** #102 (instincts, no traditional panel), #103 (sensations).
- **Depends on:** Step 19.
- **Size:** M. Queue.
- **Gates:** Numbers: the seasonal cue uses the existing day-of-year, not a new date. Frame: the meter is gone and the animal still responds, recorded. Evidence: a test that the embodied panel does not contain a percent.

### Step 21 — A life has ages, and it ends

- **Goal:** Young, adult, and old feel different (dependence, hunting, slower senses). Death is an end of that body.
- **Kind:** New life stage on the store. Reuses species lifespan citations. No per-species script.
- **Issues:** #102 (life cycle).
- **Depends on:** Steps 13 and 18.
- **Size:** L. Queue.
- **Gates:** Numbers: stage ages from a published life table for wolf, deer, or hare. Frame: an old animal moves more slowly than a young adult, recorded. Evidence: one stage function for every species.

### Step 22 — Places leave a mark

- **Goal:** A bad encounter at a river is remembered there. Entering that animal gives you that memory.
- **Kind:** New component. Reuses the delta log's positions as things that can be remembered, not as a second map.
- **Issues:** #102, #103, #104, #106 (memory marker).
- **Depends on:** Steps 17 and 19.
- **Size:** M. Queue.
- **Gates:** Numbers: memory life needs a source or a calibration label (decay of the emotional weight). Frame N/A until step 28. Evidence: the marker matches the 20-byte layout, and a new inhabitant of that id receives it.

### Step 23 — The body can refuse the move you asked for

- **Goal:** Asking to run while exhausted yields a slow run. The body is the limit.
- **Kind:** Reuse `playerSpeed` and the stamina rates. Wire them to the physiology block so the viewer does not invent a second stamina.
- **Issues:** #103 (motor layer).
- **Depends on:** Step 18. Parallel with step 22.
- **Size:** S. Queue.
- **Gates:** Numbers: the existing sprint seconds stay (already cited on `WOLF_NEEDS`). Frame: a tired run is slower than a fresh one, recorded. Evidence: one stamina pool.

## Phase D — The world as that animal

### Step 24 — Scent is a mist, not a meter

- **Goal:** Fresh scent is bright and thick. Old scent is thin. The wolf does not see a percent or a species name floating in a box. Direction and freshness come from the buffer.
- **Kind:** Rewrite of the panel. Reuses `scentLevel`, wind, and traces (Mech 1970 range already cited). Three.js builds the mist locally from the scent volumes. It does not receive a particle list (#106).
- **Issues:** #104, #105, #106.
- **Depends on:** Steps 16 and 19.
- **Size:** M. Queue.
- **Gates:** Numbers: the plume distances stay the cited ones. Frame: a fresh mark reads brighter than an old one, recorded, against a short reference of a visible plume. Evidence: the meter node is gone and the buffer's scent count is what was drawn.

### Step 25 — A sound is a direction and an urgency

- **Goal:** A snap is "something, that way, loud", not "wolf, 40 m".
- **Kind:** Rewrite of the named compass captions. Reuses `createSoundCues`.
- **Issues:** #104, #105, #106.
- **Depends on:** Step 16. Parallel with step 24.
- **Size:** M. Queue.
- **Gates:** Numbers: hearing range stays the species row (game calibration already labelled where it is). Frame: a snap shows a direction and does not print a species, recorded. Evidence: the sound entry is the 28-byte block.

### Step 26 — Hunger, thirst, and fear change the picture

- **Goal:** Hungry, food is easier to notice. Thirsty, water is louder and brighter. Afraid, the view tightens and the edge darkens.
- **Kind:** New filters. Reuses the post stack (`src/render/post.ts`) and the species camera. No new quality ladder (rule 10).
- **Issues:** #103, #104, #105. Environmental cues (water near, storm, cold) ride this step.
- **Depends on:** Steps 19 and 24.
- **Size:** M. Queue.
- **Gates:** Numbers: any blur or field-of-view scale is calibration and labelled; the fear and hunger values are the blocks from step 19. Frame: side by side, calm versus afraid, recorded. Evidence: the filter reads the buffer, not a hidden full-world list.

### Step 27 — A deer watches wide, and a hare is low

- **Goal:** Eye height, field of view, and what counts as a threat come from the species row. The deer emphasizes motion and cover. The hare sits low with a wide view.
- **Kind:** Reuse the follow camera. Replace the fixed `cameraHeight` literals on the deer, bear, and hare (`playables.ts` lines 30–40) with the spec. Wolf view work already landed (T-0075); do not restage it.
- **Issues:** #102, #104.
- **Depends on:** Steps 1 and 17.
- **Size:** M. Queue.
- **Gates:** Numbers: fields of view from a citation (the hare's panoramic eye is already Hughes 1971 on `HARE_NEEDS`) or a calibration label. Frame: deer and hare cameras, recorded. Evidence: no new species file.

### Step 28 — A remembered place feels uneasy

- **Goal:** Returning to a place where that animal was hurt shifts the colour and raises alertness, even if nothing is there now.
- **Kind:** New tint. Reuses step 22's markers and step 26's post path.
- **Issues:** #104, #105.
- **Depends on:** Steps 22 and 26.
- **Size:** S. Queue.
- **Gates:** Numbers: the tint amount is calibration, labelled, and it scales with the stored weight. Frame: the same river with and without the memory, recorded. Evidence: the tint is zero when the marker is absent.

### Step 29 — Another species is a row

- **Goal:** An eagle's motion emphasis, a fish's currents, heat, or a wider scent are rows in one filter table. They are not new programs.
- **Kind:** Reuse steps 16, 24, 26, and 27. Refuses #105's per-species renderer types (conflict 13).
- **Issues:** #102, #103, #104, #105.
- **Depends on:** Steps 16 and 27.
- **Size:** M. Queue.
- **Gates:** Numbers: each new sense limit has a citation or a calibration label before the row is playable. Frame: one non-mammal row (or N/A if the body cannot be drawn yet, with the row tested in the buffer). Evidence: no `WolfRenderer` or `EagleRenderer` source file.

## Phase E — The time wheel, on the clock that already exists

Pull request #92 is the clock and the bar. Do not build a second control. #109 replaces the rate law after that pull request is the base.

### Step 30 — The wheel is logarithmic, from a pause to geological time

- **Goal:** One wheel. Centre is paused. Toward the ends, speed grows as a power of ten (`10^(12 × abs(position))` on a −1 to 1 wheel, dead zone inside 0.01). Reverse is the same map with a minus sign.
- **Kind:** Rewrite of the 0.05–16 clamp on pull request #92 (conflict 20). Reuses that clock, that bar, and the pause holds. Removes #108's −8 to 8 map.
- **Issues:** #108 (one wheel, modes), #109 (the map). #109 wins the map.
- **Depends on:** Pull request #92. Parallel with nothing in this phase.
- **Size:** M. Queue.
- **Gates:** Numbers: the exponent 12 is the issue's map, labelled as the design's scale law, and the test pins 0, about 15× at 0.1, and a million-fold at 0.5 as #109 states. Frame: the existing bar still the only control, recorded at two speeds. Evidence: no second slider, and `RATE_MAX = 16` is gone.

### Step 31 — The wheel has weight

- **Goal:** A small nudge arrives quickly. A jump toward geological speed takes longer. Speed eases. It does not snap.
- **Kind:** Rewrite of an instant rate set. Reuses step 30's target. Adds acceleration and jerk.
- **Issues:** #109 (spring, inertia). #108's instant set loses.
- **Depends on:** Step 30.
- **Size:** M. Queue.
- **Gates:** Numbers: stiffness and damping are calibration, labelled, and a test shows a 10× step settling faster than a million-fold step. Frame: the readout eases, recorded. Evidence: one integrator on the one clock.

### Step 32 — Detail levels blend, and they do not flicker

- **Goal:** The levels are Individual, Group, Population, Ecosystem, Biome, Evolution, Geological. Entering a coarser level and leaving it use different thresholds. In the overlap, both pictures are partly there.
- **Kind:** Rewrite of hard switches (#107's rectangles lose, conflict 16). The names are #109's (conflict 5).
- **Issues:** #107 (what you see as time speeds up), #108 (the old names), #109.
- **Depends on:** Steps 14 and 31.
- **Size:** L. Queue.
- **Gates:** Numbers: the enter and exit thresholds are the issue's bands (Individual through about 50×, Group overlapping it, and so on), labelled as the design's bands where no field study defines them. Frame: crossing a band does not flicker and a wolf becomes a pack trail before the body is gone, recorded. Evidence: no second level-of-detail enum.

### Step 33 — Height and speed pick the picture together

- **Goal:** Detail is height times time rate, times whether this species could sense it. The spatial picture is pull request #94's one picture. This step adds the time axis to that gate.
- **Kind:** Extension, not a second tree. Reuses T-0078's distance table once its first code step exists. #109's score and hysteresis replace #107's on/off rectangles.
- **Issues:** #107, #109.
- **Depends on:** Step 32 and pull request #94's distance table (do not copy that plan's phases here).
- **Size:** M. Queue.
- **Gates:** Numbers: distances stay the ones T-0078 already found in the code; this step adds no new metres. Frame: high and fast shows seasons and flows, not fur, recorded against the #94 picture. Evidence: one gate function. Animals, trees, rivers, and photos still turn on by height as #94 describes.

### Step 34 — A time you can jump to, without a saved movie

- **Goal:** Ground, climate, and populations answer "what were you at this time?" in closed form. Scrubbing and rewind use that. Playing backward does not apply the ground's years twice.
- **Kind:** Rewrite of "rewind does not seek" for a geological jump (conflict 8), on the one clock. Reuses `ground.ts` closed form, `deepTime.ts`, and step 3's epoch. #107's cause browser is step 37, not this seek.
- **Issues:** #107, #108, #109.
- **Depends on:** Steps 3, 14, and 30.
- **Size:** L. Queue.
- **Gates:** Numbers: a ground column at 10 years matches `column()` advanced 10 years, within the existing decay test. Frame N/A for the formula; a recording only if a visible forest age changes. Evidence: no per-frame history buffer.

### Step 35 — Speeding up is something you feel

- **Goal:** Faster time trails motion, compresses sound, and speeds growth. Trees do not teleport. Rivers keep meandering. Herds become streams.
- **Kind:** New presentation on step 32. Reuses the post stack and the river path. Not a new simulator.
- **Issues:** #109 (time-warp feel).
- **Depends on:** Step 32. Parallel with step 34 after step 32.
- **Size:** M. Queue.
- **Gates:** Numbers: pitch shift labelled calibration. Growth uses the existing ground years, only faster. Frame: a tree and a trail at two speeds, recorded. Evidence: positions come from step 34's query, not from a skipped animation.

## Phase F — Looking from outside, and why it happened

### Step 36 — The view from outside a body

- **Goal:** When you are not inside an animal, you see populations, weather, migration, and habitat. Same simulation as when you are inside one. Different reading.
- **Kind:** New summary frame. Reuses step 14's densities and pull request #94's planet picture. Does not send the embodiment buffer's private sensations.
- **Issues:** #104, #105, #107, #108.
- **Depends on:** Steps 14, 16, and 33.
- **Size:** M. Queue.
- **Gates:** Numbers: the same densities as step 14. Frame: from high up, herds and weather, no scent mist, recorded. Evidence: the summary and the embodiment buffer are different types, one store.

### Step 37 — You can ask why

- **Goal:** A hunt points back through hunger, scarce food, a dry spell, and the climate that made it.
- **Kind:** Reuse `src/core/why.ts`. Extend the chain. It explains. It is not the rewind (step 34).
- **Issues:** #100 (the master chain), #107 (causes).
- **Depends on:** Steps 9, 13, and 34.
- **Size:** M. Queue.
- **Gates:** Numbers N/A (the chain is identities, not new rates). Frame: the explanation on a kill, recorded if it is on screen, otherwise the chain fixture is the check. Evidence: each link names the step that produced it.

### Step 38 — The next life inherits this one

- **Goal:** When the body dies you may continue as its offspring or enter another species. The world keeps what you did. A wolf that reduced the deer leaves fewer deer for the deer you become.
- **Kind:** New handoff. Reuses steps 14, 17, and 21. One population, so the consequence is the same store.
- **Issues:** #102 (generations).
- **Depends on:** Steps 14, 17, and 21.
- **Size:** L. Queue. Last, because it needs the store, the life stages, and the densities.
- **Gates:** Numbers: offspring count from the species' published litter or clutch. Frame: death, then the offspring in the same range, recorded. Evidence: the deer's density after a wolf's life is lower than a control run with no wolf, in a headless test.

## Coverage

Every section of the ten issues maps to a step. "Stays" means the current code already does it and the step only consumes it.

| Issue | Section | Step |
|---|---|---|
| #100 | Astronomy, then climate, season, weather, habitat, behaviour | 2, 4, 9, 10, 37 |
| #100 | Solar energy as the driver | 2 (existing solar budget) |
| #100 | Temperature from base, season, ocean, elevation, weather | 2 and 5 |
| #100 | Moisture, humidity, rain potential, plant potential | 2, 6, 9 |
| #100 | Wind from pressure, shaped by terrain | 2 (geostrophic wind already), 5 for the ridge |
| #100 | Ocean moderation and continental extremes | 5 |
| #100 | Rain shadow, wet forest then dry side | 5 |
| #100 | Climate class from temperature, rain, seasonality | 8 |
| #100 | Animals ignore the class and feel local numbers | 8, 9, 10 |
| #100 | Moving weather cells | 4 |
| #100 | Clouds from humidity and cooling | 2 (existing cloud fraction) |
| #100 | Rain from cloud and uplift | 4 and 5 |
| #100 | Snow below 0 °C, depth, melt, movement and hunting | 7, then 10 and 23 for the cost |
| #100 | Drought as moisture debt | 6 |
| #100 | Habitat quality | 9 |
| #100 | Need score and the decision | 10 (#103's weights, not a new formula) |
| #100 | Master chain back to the planet | 37 |
| #101 | Rust is the brain, Three.js is the camera | 2, 13, 15 |
| #101 | Climate, weather, hydrology, vegetation, habitat, population, behaviour | 2, 4, 5, 9, 12, 14 |
| #101 | JSON export of real animals | 15 and 16 (#106 wins; JSON is not built) |
| #101 | Climate cell fields | 2 |
| #101 | Seasonal temperature sketch | 2 (relationship only; digits stay sourced) |
| #101 | Rainfall sketch | 4 and 5 |
| #101 | Moisture tracker | 6 |
| #101 | Habitat cell and scoring | 9 |
| #101 | Seasonal vegetation biomass | 9 |
| #101 | Needs struct | 18 and 19 |
| #101 | `choose_action` ladder | 10 (loses; utilities stay) |
| #101 | Entity store | 11 and 12 |
| #101 | Viewer places what it is given | 13, 15, 24 |
| #101 | Planet, region, habitat, and close pictures | 14, 33, 36, on pull request #94's picture |
| #102 | Enter a creature that already exists | 17 |
| #102 | Physiology, including the mass field | 18 (mass is not stored) |
| #102 | Mind | 19 (#106's three blocks) |
| #102 | Species-specific worlds (eagle, wolf, deer, fish) | 24, 27, 29 |
| #102 | Perception is not raw data | 16 and 24 |
| #102 | Instincts instead of missions | 20 |
| #102 | No health bar; feelings instead | 20 and 26 |
| #102 | Life cycle | 21 |
| #102 | Generations and inherited consequences | 38 |
| #102 | The reality-model statement | The whole plan |
| #103 | Reality, perception, experience, input, action | 13, 16, 23 |
| #103 | The player never sees objective reality | 15 and 16 |
| #103 | Body model | 18 |
| #103 | Species sense limits | 27 and 29, from the existing spec rows |
| #103 | Vision, smell, hearing pipelines | 24, 25, 27 |
| #103 | Confidence, not certainty | 16 (certainty and salience) and 24 |
| #103 | Instinct engine | 10 and 19 |
| #103 | Sensations for hunger, fear, fatigue | 20 and 26 |
| #103 | Motor limits | 23 |
| #103 | Switch perspective | 17 |
| #103 | Eagle, wolf, deer, salmon pictures | 29, 24, 27 |
| #103 | Memory | 22 and 28 |
| #103 | The embodiment statement | The whole plan |
| #104 | Objective world, then filters, then the picture | 16 and 24 |
| #104 | Perceived world struct | 16 |
| #104 | Physical layer for every species | 24, limited by #106 (conflict 3) |
| #104 | Wolf scent mist | 24 |
| #104 | Eagle vision | 29 |
| #104 | Deer threat picture | 27 |
| #104 | Fish currents and gradients | 29 |
| #104 | Sound as expanding events | 25 |
| #104 | Instinct changes what is salient | 26 |
| #104 | Hunger, thirst, and fear filters | 26 |
| #104 | Memory tint | 28 |
| #104 | Camera from the species, not a human default | 27 |
| #104 | Observer and embodiment share one world | 17 and 36 |
| #104 | Flow through wasm | 16 |
| #104 | The rendering statement | 24 and 36 |
| #105 | Embodiment frame | 16 |
| #105 | Perception, visual objects, certainty | 16 and 24 |
| #105 | Scent, sound, environmental cues | 24, 25, 26 |
| #105 | Physiology, instinct, emotion, memory contracts | 18, 19, 22 |
| #105 | A renderer type per species | 29 (one table; conflict 13) |
| #105 | Observer summary versus embodiment frame | 36 and 16 |
| #105 | Packed binary, not JSON | 16 |
| #105 | The contract statement | 15 and 16 |
| #106 | Block order and contiguous memory | 16 |
| #106 | Header and offsets | 16 |
| #106 | Physiology, emotion, instinct blocks | 16, 18, 19 |
| #106 | Visual objects | 16 and 24 |
| #106 | Scent volumes, not particles | 16 and 24 |
| #106 | Sound events | 16 and 25 |
| #106 | Memory markers | 16 and 22 |
| #106 | Reader on the wasm memory | 16 |
| #106 | Small caps, not the whole ecosystem | 16 |
| #106 | Reserved bytes for later senses | 16 and 29 |
| #106 | Perception, not reality | 15 and 16 |
| #107 | Observation decides the representation | 1 and 33 |
| #107 | Observation coordinates | 1 |
| #107 | What each time speed shows | 32 (the pictures) and 30 (the wheel) |
| #107 | Individual, pack, population, lineage | 14 and 32 |
| #107 | Reverse time as causes | 37 explains; 34 seeks |
| #107 | Spatial scales from grass to orbit | Pull request #94, then step 33. Not rebuilt here. |
| #107 | Combined space and time | 33 |
| #107 | Earth from space | Pull request #94 and step 36 |
| #107 | The fidelity equation | 33 |
| #107 | Always-full-detail simulation | Loses to #109. Steps 14 and 32. |
| #107 | The observation statement | 33 |
| #108 | The dial is an object, not a playback trick | 30, on pull request #92's clock |
| #108 | Time zero at formation, present at Earth's age | 3 |
| #108 | Log speed | 30 (#109's map) |
| #108 | Paused, running, rewind, scrub | 30 and 34 |
| #108 | Eight scale names | 32 (#109's seven; conflict 5) |
| #108 | What runs at each scale | 14 and 32 |
| #108 | Observer plus dial | 1 and 30 |
| #108 | Height times time matrix | 33 |
| #108 | Hard visibility rectangles | 33 (#109's blend; conflict 16) |
| #108 | One wheel | 30 |
| #108 | Historical query | 34 |
| #108 | Compact time state to the viewer | 16's timestamp plus step 30's rate and level |
| #108 | The dial statement | 30 |
| #109 | No instant mode switch | 31 and 32 |
| #109 | Acceleration and jerk | 31 |
| #109 | Dial from −1 to 1 | 30 |
| #109 | `10^(12 × abs(position))` and the dead zone | 30 |
| #109 | Spring and heavy jumps | 31 |
| #109 | Hysteresis | 32 |
| #109 | Blend between pictures | 32 |
| #109 | The seven levels and their bands | 32 |
| #109 | Height times time | 33 |
| #109 | Blur, trails, pitch, growth, meanders | 35 |
| #109 | Switch the simulation, do not step every second | 14 |
| #109 | Transform, do not vanish | 14 and 32 |
| #109 | The continuity statement | 32 and 35 |

## First wave, and the queue

Proposed, not claimed. Other bots pick them up after someone else approves the plan. grokbot-3 will not claim them in this change.

| Order | Task | Step | Starts when | Beside |
|---|---|---|---|---|
| 1 | T-0080 | This document | Now | — |
| 2 | T-0081 | 1, the observation record | Now | T-0082, T-0083, T-0084 |
| 3 | T-0082 | 2, Rust weather in the forest | Now | T-0081, T-0083, T-0084 |
| 4 | T-0083 | 16, the perception buffer | Now | T-0081, T-0082, T-0084 |
| 5 | T-0084 | 11, the empty entity store | Now | T-0081, T-0082, T-0083 |
| 6 | T-0085 | 5, sea and rain shadow | T-0082 is done | T-0086, T-0087 |
| 7 | T-0086 | 6, moisture debt | T-0082 is done | T-0085, T-0087 |
| 8 | T-0087 | 7, snow depth | T-0082 is done | T-0085, T-0086 |

The queue, in dependency order, with no task file yet: steps 3, 4, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38. A bot takes the lowest step whose dependencies are met, one task, the next free id. It does not propose the rest.

Step 3 and steps 30–35 wait on pull request #92. Step 33 waits on pull request #94's distance table. Neither pull request is copied here.
