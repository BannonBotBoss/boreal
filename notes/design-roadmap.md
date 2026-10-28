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
The one picture from space down to the trees is already being built. The clock in the game already has the time wheel. This plan follows both.
Where the game already fits your notes, it stays. Where it fights them, it is rewritten, which you allowed.

## What this document is

The full path from today's code to issues #100 through #109. No simulation code changes in this task. The first wave is eight proposed tasks. Every later step is the queue: a bot takes the next step whose dependencies are done, files one task under the next free id, and does not file the rest.

Matthew posted the ten issues between 6:56 and 7:13 PM Pacific on 2026-10-25 and is done supervising. This plan asks him nothing. Two pieces are already open and are linked, not rebuilt:

- The picture from space down to the forest is pull request #94, branch `grokbot-3/render-unification-plan`, task T-0078, write-up `notes/render-unification-plan.md`. That covers the spatial half of #107. Step 33 multiplies that picture by the time scale pull request #92 already reports. Step 36 adds the view from outside a body. They do not add a second picture.
- The one clock is pull request #92, branch `grokbot-3/single-time-control`. The bar, the single rate, and the removal of the extra speed sliders were the first commit on that branch (filed there as T-0077). The time wheel from #109 and #108 is already on the same branch (commit `565b2e6`, filed there as T-0078). That T-0078 is not the render plan's T-0078. A merger who hits either collision renumbers by rule 13. Steps 30 and 31 are that delivery. Do not open another clock or another wheel. The same pull request is moving the edge of the dead zone so it is exactly 1×. That adjustment stays on #92. It is not a new step.

## Conflicts, and which issue won

Standing project rules are not older issues. The precedence line does not repeal them. Where a sketch in #100–#109 fights rule 3 (one animal pipeline), rule 4 (mass from volume times density), or rule 5 and rule 7 (published models, no invented digits), the standing rule keeps the mechanism and the winning issue keeps the relationship. The numbers gate still replaces example coefficients.

| # | Conflict | Winner | What the plan does |
|---|---|---|---|
| 1 | #101 sends a JSON list of real animals. #105 sends nested perception structs. #106 sends one packed buffer of perception only. | #106 | Step 16. No world JSON. |
| 2 | #101 always stores every individual. #107 says the simulation is always at full detail and only the picture changes. #109 switches the simulation itself (individual, population, species, geology) and says a thing transforms instead of vanishing. | #109 | Pull request #92 already holds animals and the weather grid above Immediate. Steps 14 and 32 still transform them into a density instead of only holding them. Individuals exist only while time is slow and the animal is near. |
| 3 | #104 draws the whole forest for every species, then paints senses on top. #105 and #106 say the viewer receives only what that animal perceives. | #106 | Steps 15, 16, and 24. Nearby ground is drawn because it is perceived, not because the whole world was sent. |
| 4 | #101 picks an action with fixed cutoffs (fear 90, thirst 80, hunger 80, habitat 25, mating 85). #103 says the strongest weighted urge wins. `src/core/agent.ts` already picks by utilities. | #103, reusing `agent.ts` | Step 10. Do not port the cutoff ladder. |
| 5 | #108 names eight time scales (Immediate through Planetary). #109 names seven levels (Individual through Geological). | The eight names on pull request #92, with #109's hysteresis and blend | The signal is delivered (`OBSERVATION_SCALES`, `resolveObservation`). Do not add a second list. Step 32 still wires animals, weather, and ground to that signal. Height stays a separate axis (step 33). |
| 6 | #108 maps a dial position from −8 to 8 with powers of ten. #109 maps −1 to 1 with `10^(12 × abs(position))` and a dead zone near 0. | #109, already on pull request #92 | Step 30 is delivered. The same pull request is setting the lip of the dead zone to exactly 1×. |
| 7 | #108 changes speed directly. #109 accelerates with a spring, and blends instead of popping. | #109, already on pull request #92 | Step 31 is delivered (spring in decades, inertia `1 + error²`). The blend of the scale label is delivered with it. The pictures those labels should show are still step 32. |
| 8 | #107 walks backward along causes. #109 jumps with `state_at(time)` and does not keep every frame. An earlier draft of pull request #92 refused to seek the clock. | #109 for the clock and the sun, which now rewind. The closed-form query of the land is still open. | Rewind of the clock and the sun is delivered. Ground years still refuse a backward gap, so decay is not applied twice. Step 34 still makes ground, climate, and populations answer a time. Step 37 keeps the cause chain as the explanation, not as the scrubber. |
| 9 | #100 and #101 show round example coefficients (a 35 degree latitude span, ±15 degrees of season, rain only above 70% humidity, an unweighted habitat sum). The forest climate is Kenora normals plus a cited diurnal curve (`src/core/weather.ts` `climateRaw`, lines 112–118). The planet grid uses the same family of published budgets (`rust/boreal-sim/src/planet_fundamentals/`). The numbers gate forbids invented digits. | The issues win the chain and who computes it. The digits stay sourced. | Step 2 moves authority to the Rust grid. Steps 5–9 add the missing relationships (rain shadow, ocean moderation, drought, habitat) with citations. The 35, 15, 70, and 80 are not game numbers. |
| 10 | #102 stores `body_mass` on the animal. Rule 4 says mass is volume times density and is never assigned. | Rule 4 | Step 18. Metabolism reads the generated mass. The field is not stored. |
| 11 | #100 and #101 score habitat as food + water + shelter − competition − predator pressure. #100 also subtracts environmental stress. #106 puts temperature and oxygen stress on the body. | #101 for the habitat sum, #106 for the stress | Step 9 sums #101's terms. Step 18 carries the stress. It is not subtracted twice. |
| 12 | #102 puts fear, curiosity, and mating in one mind. #103 puts hunger and fear in one instinct list. #106 splits body, emotion, and urge into three blocks. | #106 | Steps 16 and 19. |
| 13 | #105 asks for a renderer type per species (wolf, deer, eagle, salmon, bear). Rule 3 says a new animal is a spec row, not a new source file. | Rule 3 for the code shape. The issues for the behaviour. | Step 29. One filter table, one row per species. |
| 14 | #108 sets time zero at the formation of the solar system. `src/core/deepTime.ts` `dialToYears` used to set zero at now. | #108 | Step 3, T-0093. Time zero is formation. Earth's age is the span from Earth-formation to the present on that line. The play clock remains the rate. |
| 15 | #100 says snow when temperature is below 0 °C, otherwise rain. The forest grid and the Rust precipitation already do that (`src/core/weather.ts` line 274, `precipitation.rs` line 77). | No fight. #100 matches the code. | Step 7 locks it with a test and exposes depth. Do not replace the threshold. |
| 16 | #107 turns layers on with hard altitude and speed rectangles. #109 uses a score, hysteresis, and a blend. | #109 for the time signal, already on pull request #92 | Hysteresis and the blend of the time scale are delivered. Step 33 still multiplies that signal by height. #107's hard rectangles are not built. |
| 17 | The player rig is created fresh (`src/render/playables.ts` lines 27–50). #102 and #103 say you enter an animal that already has a past. | #102 and #103 | Step 17. The shared playable motor stays (rule 3). |
| 18 | The wolf senses panel shows a percent and a distance (`src/ui/senses.ts` lines 31 and 69; `src/core/needs/senses.ts` `threatCue` lines 37–41). #103 and #104 replace numbers with sensation. | #103 and #104, packed by #106 | Steps 20, 24, and 25. The scent math in `src/core/senses.ts` and `src/core/traces.ts` stays. |
| 19 | Inside #106, `#[repr(C)]` would pad the embodied id off the published offsets, and the sound fields sum to 24 bytes while the issue says 28. The offset table and the later "reserve bytes" line are the specific layout. | The offset table, with 4 reserved bytes on the sound so 28 holds | Step 16. Memory stays 20 bytes, which already matches its fields. |
| 20 | An earlier draft of pull request #92 clamped the one rate to 0.05–16. #109 spans a pause through geological time on a log wheel. | #109, and it is already the clock on that branch | Steps 30 and 31 are delivered. The 0.05–16 clamp is gone. There is still one bar. |
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
| One play clock, and now the time wheel | Pull request #92, `src/core/worldClock.ts` at commit `565b2e6` (branch tip `8f14525` when this plan was corrected): dial −1..+1, powers of ten, spring, reverse for the clock and the sun, `observation()` with hysteresis. | Steps 30 and 31, and the scale signal, are that file. Do not write a second wheel. Animals, the weather grid, and the ground still only hold or advance. They do not yet follow the scale by transforming (the rest of step 32, with step 14). |
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
- **Kind:** Rewrite of the scattered reads. Reuses `INTEREST` (`src/core/interest.ts` lines 10–19), the playable id (`src/render/playables.ts` line 52), and the one clock. On a base that includes pull request #92, the rate is `clockRate()` and the scale is `observation()`. On main, until that branch is the base, the rate is 1. Do not build the wheel (steps 30 and 31 are that pull request).
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
- **Kind:** Rewrite of the epoch in `dialToYears` (`src/core/deepTime.ts` lines 91–96), which puts zero at now. Reuses the stage model and T-0060. Does not add a clock. Pull request #92 already passes `epochOffsetYr` (session seconds) into `deepTimeAt`. That is not this epoch: zero there is still now. Branch from that clock so the epoch and the wheel are not edited in two places.
- **Issues:** #108 (the epoch). #109 does not pick a different zero.
- **Depends on:** Pull request #92 merged, or this step branched from `grokbot-3/single-time-control`. Parallel with step 4 once that lands.
- **Size:** M. Board: T-0093.
- **Gates:** Numbers: Earth's age and the solar-system formation age from the citations already on `DEEP` / T-0065, not a new round number. The dial is already on pull request #92, so the frame is N/A if only the zero moves. The numeric check is `state` at 0 and at the present. Evidence: one function, no second epoch.

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
- **Size:** S. Board: T-0094.
- **Gates:** Numbers: class boundaries from a published scheme (Köppen thresholds or the issue's four classes with those published bounds, not round guesses). Frame N/A. Evidence: a test that behaviour code does not read the class id.

### Step 9 — A place has food, water, shelter, and a score

- **Goal:** Each habitat cell carries food, water, shelter, vegetation, competition, predator pressure, and a quality score.
- **Kind:** New cell fed by steps 5–8 and the existing plants (`src/core/flora`, forage regrowth T-0015). Quality is food + water + shelter − competition − predator pressure (#101). Environmental stress is not in this sum (conflict 11).
- **Issues:** #100 (habitat), #101 (habitat cell and seasonal vegetation).
- **Depends on:** Steps 6, 7, and 8. Those files stay on their own changes. This step reads the crop, the canopy, and the bucket.
- **Size:** M. Board: T-0098.
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
- **Size:** L. Board: T-0092.
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
- **Depends on:** Step 12. The scale signal is already `observation()` on pull request #92. Until this step lands, only the distance tier changes what is drawn; above Immediate the animals hold. Do not add a second list of scales.
- **Size:** L. Queue.
- **Gates:** Numbers: densities from a published boreal figure (wolf or deer per square kilometre) or labelled calibration. Frame: leaving the near radius replaces bodies with the density drawing without a one-frame hole, recorded. Evidence: a count test that individuals plus the density describe the same population.

### Step 15 — Nothing sends the raw world across

- **Goal:** The only payloads are the perception buffer (step 16) and, when you are not inside a body, the summary (step 36).
- **Kind:** Rewrite of the JSON sketch in #101, which was never built. This step is the test that keeps it unbuilt.
- **Issues:** #101, #105, #106.
- **Depends on:** Step 16.
- **Size:** S. Board: T-0095.
- **Gates:** Numbers N/A. Frame N/A. Evidence: `tests/no-raw-world.test.ts` fails if a module serializes animal positions or the raw world as JSON for the viewer. The allowlist in that file is empty.

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
- **Size:** M. Board: T-0102.
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

Pull request #92 is the clock, the bar, and the wheel. Steps 30 and 31 are that delivery. Do not build a second control. The same pull request is setting the lip of the dead zone to exactly 1×. That stays on #92.

What this phase still queues is the wiring. Animals, the weather grid, and the ground follow the scale (the rest of step 32). Height multiplies that scale (step 33). Ground, climate, and populations answer a time (step 34). Speeding up is something you see and hear (step 35).

### Step 30 — The wheel is logarithmic, from a pause to geological time

- **Goal:** One wheel. Centre is paused. Toward the ends, speed grows as a power of ten (`10^(12 × abs(position))` on a −1 to 1 wheel, dead zone inside 0.01). Reverse is the same map with a minus sign. The bar reads the rate, and past a year it reads the deep-time label.
- **Kind:** Delivered by pull request #92, `src/core/worldClock.ts` and `src/ui/timeHud.ts`, commit `565b2e6` (branch tip `8f14525` when this plan was corrected). Replaced the 0.05–16 clamp (conflict 20). One bar. #108's −8 to 8 map was not built.
- **Issues:** #108 (one wheel, modes), #109 (the map). #109 wins the map.
- **Depends on:** Nothing further. This step is not in the queue.
- **Size:** M. Delivered by pull request #92.
- **Gates:** Met there. Numbers: `targetRateFromDial` pins 0 inside the dead zone, about 15× at 0.1, and a million-fold at 0.5 (`tests/worldClock.test.ts` on that branch). Frame: that pull request's bar is the only control. Evidence: no second slider, and `RATE_MAX = 16` is gone. The same pull request is moving the lip of the dead zone from about 1.32× to exactly 1×. That adjustment stays on #92. It is not a new step.

### Step 31 — The wheel has weight

- **Goal:** A small nudge arrives quickly. A jump toward geological speed takes longer. Speed eases. It does not snap.
- **Kind:** Delivered by pull request #92 on the same clock. The spring is in decades (log10 of the rate), stiffness 64 and damping 13.6, labelled game calibration, inertia `1 + error²`. Damping acts on the decade-velocity so the rate rests on the target.
- **Issues:** #109 (spring, inertia). #108's instant set loses.
- **Depends on:** Step 30, which is the same delivery.
- **Size:** M. Delivered by pull request #92.
- **Gates:** Met there. A test on that branch shows the rate has not arrived in one frame, and half a second does not leap to geological time. Evidence: one integrator on the one clock. The scale blend rides the same step (`resolveObservation`).

### Step 32 — Animals, weather, and the ground follow the scale that already exists

- **Goal:** The scale signal is already on pull request #92. Eight names, from Immediate through Planetary. The label waits to enter a coarser scale and to leave it. In the overlap, a blend says how far you are between the two. What remains is to make animals, the weather grid, and the ground change with that signal. Near and slow they stay individuals. Faster, the same animals become the density from step 14. They transform. They do not pop, and they do not merely freeze.
- **Kind:** The signal is reuse of `observation()`, `resolveObservation`, and `SCALE_BOUNDS` on pull request #92 (conflicts 5 and 16). Do not add #109's seven names beside the eight. Today `simWorldSec` returns 0 unless time is moving forward and the scale is still Immediate, so animals and the weather grid hold. `groundWorldSec` advances at any forward rate and refuses a backward gap. That hold is the limit this step replaces when time is moving forward.
- **Issues:** #107 (what you see as time speeds up), #108 (the eight names), #109 (hysteresis, blend, transform).
- **Depends on:** Step 14, and a base that includes pull request #92. The signal itself does not wait.
- **Size:** L. Queue for the wiring only. The signal is delivered by pull request #92.
- **Gates:** Numbers: the enter and exit bands are the ones already on `SCALE_BOUNDS` (8 and 12, then 800 and 1200, and the bands above those). Do not invent a second set. Frame: crossing a band does not flicker, and a wolf becomes the density drawing before the body is gone, recorded. Evidence: callers read `observation()`. No second level-of-detail enum. `simWorldSec` is no longer the only response above Immediate.

### Step 33 — Height and speed pick the picture together

- **Goal:** Detail is height times the time scale, times whether this species could sense it. The spatial picture is pull request #94's one picture. The time half is already `observation()` on pull request #92. This step multiplies the two. It does not build a second picture.
- **Kind:** Extension, not a second tree. Reuses T-0078's distance table once its first code step exists. The time hysteresis and blend are already delivered (conflict 16). #107's hard rectangles are not built.
- **Issues:** #107, #109.
- **Depends on:** The remaining wiring in step 32, and pull request #94's distance table (do not copy that plan's phases here). The time signal does not wait.
- **Size:** M. Queue.
- **Gates:** Numbers: distances stay the ones T-0078 already found in the code; this step adds no new metres. Frame: high and fast shows seasons and flows, not fur, recorded against the #94 picture. Evidence: one gate function. Animals, trees, rivers, and photos still turn on by height as #94 describes. The time axis is `observation()`, not a new rate.

### Step 34 — A time you can jump to, without a saved movie

- **Goal:** Ground, climate, and populations answer "what were you at this time?" in closed form. Scrubbing uses that. The clock and the sun already rewind on pull request #92. Playing backward already does not apply the ground's years twice (`groundWorldSec` returns 0 when the gap is negative).
- **Kind:** The rewind of the clock and the sun is delivered (conflict 8). What remains is the closed-form query. Reuses `ground.ts` closed form, `deepTime.ts`, and step 3's epoch. #107's cause browser is step 37, not this seek.
- **Issues:** #107, #108, #109.
- **Depends on:** Steps 3 and 14, and pull request #92's clock, which already rewinds.
- **Size:** L. Queue for the query. The clock, the sun, and the ground's refusal of a backward gap are delivered by pull request #92.
- **Gates:** Numbers: a ground column at 10 years matches `column()` advanced 10 years, within the existing decay test. Frame N/A for the formula; a recording only if a visible forest age changes. Evidence: no per-frame history buffer.

### Step 35 — Speeding up is something you feel

- **Goal:** Faster time trails motion, compresses sound, and speeds growth. Trees do not teleport. Rivers keep meandering. Herds become streams. The readable rate and the deep-time label on the bar are already on pull request #92. This step is the picture and the sound, not the readout.
- **Kind:** New presentation on the remaining wiring in step 32. Reuses the post stack and the river path. Not a new simulator. Does not rebuild the scale.
- **Issues:** #109 (time-warp feel).
- **Depends on:** The remaining wiring in step 32. Parallel with step 34 after that wiring.
- **Size:** M. Queue.
- **Gates:** Numbers: pitch shift labelled calibration. Growth uses the existing ground years, only faster. Frame: a tree and a trail at two speeds, recorded. Evidence: positions come from step 34's query, not from a skipped animation. The rate label stays `formatRate`.

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
| #107 | What each time speed shows | 30, the wheel, delivered by pull request #92. The scale label is `observation()` there. The pictures stay in the rest of step 32, with step 14. |
| #107 | Individual, pack, population, lineage | 14 and the rest of 32. The signal is already on pull request #92. The transform is not. |
| #107 | Reverse time as causes | 37 explains. The clock and the sun already rewind on pull request #92. Step 34 still seeks the land. |
| #107 | Spatial scales from grass to orbit | Pull request #94, then step 33. Not rebuilt here. |
| #107 | Combined space and time | 33. The time half is already `observation()`. |
| #107 | Earth from space | Pull request #94 and step 36 |
| #107 | The fidelity equation | 33 |
| #107 | Always-full-detail simulation | Loses to #109. Pull request #92 holds above Immediate. Steps 14 and 32 still transform. |
| #107 | The observation statement | 33 |
| #108 | The dial is an object, not a playback trick | 30, delivered by pull request #92 |
| #108 | Time zero at formation, present at Earth's age | 3, T-0093. Time zero is formation. Earth's age is the span to the present on that line. `epochOffsetYr` stays session seconds. |
| #108 | Log speed | 30, delivered (#109's map) |
| #108 | Paused, running, rewind, scrub | Pause, play, and rewind of the clock and the sun are step 30, delivered. Scrub of ground, climate, and populations is still step 34. |
| #108 | Eight scale names | Delivered on pull request #92 as `OBSERVATION_SCALES`. Do not replace them with #109's seven (conflict 5). The rest of step 32 wires systems to those names. |
| #108 | What runs at each scale | The hold is on pull request #92 (`simWorldSec`). The transform is step 14 and the rest of step 32. |
| #108 | Observer plus dial | 1, and 30 which is delivered |
| #108 | Height times time matrix | 33. The time axis is already `observation()`. |
| #108 | Hard visibility rectangles | Not built. Time hysteresis is delivered (conflict 16). Step 33 multiplies it by height. |
| #108 | One wheel | 30, delivered |
| #108 | Historical query | 34 still open. Clock rewind is delivered. |
| #108 | Compact time state to the viewer | 16's timestamp, plus the rate and the scale already on pull request #92 |
| #108 | The dial statement | 30, delivered |
| #109 | No instant mode switch | 31, delivered (the spring). The label's blend is delivered with it. The pictures still transform in the rest of step 32. |
| #109 | Acceleration and jerk | 31, delivered |
| #109 | Dial from −1 to 1 | 30, delivered |
| #109 | `10^(12 × abs(position))` and the dead zone | 30, delivered. The lip moving to exactly 1× stays on pull request #92. |
| #109 | Spring and heavy jumps | 31, delivered |
| #109 | Hysteresis | Delivered on pull request #92 (`resolveObservation`). Wiring animals, weather, and ground is the rest of step 32. |
| #109 | Blend between pictures | The blend number is delivered. Wolf and pack sharing the frame is the rest of step 32, with step 14. |
| #109 | The seven levels and their bands | The eight names from #108 landed. Do not add the seven (conflict 5). The bands are `SCALE_BOUNDS` on pull request #92. |
| #109 | Height times time | 33. Still open. The time axis is `observation()`. |
| #109 | Blur, trails, pitch, growth, meanders | 35. Still open. The readable rate and the deep-time label are step 30, delivered. |
| #109 | Switch the simulation, do not step every second | 14. Still open. Today's hold is not the switch. |
| #109 | Transform, do not vanish | 14 and the rest of 32 |
| #109 | The continuity statement | The rest of 32, and 35 |

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

The queue, in dependency order, with no task file yet: steps 3, 4, 8, 9, 10, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, the remaining wiring in step 32, then 33, 34, 35, 36, 37, 38. Step 15 is T-0095. A bot takes the lowest step whose dependencies are met, one task, the next free id. It does not propose the rest. Steps 30 and 31 are not in the queue.
The queue, in dependency order, with no task file yet: steps 4, 8, 9, 10, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, the remaining wiring in step 32, then 33, 34, 35, 36, 37, 38. A bot takes the lowest step whose dependencies are met, one task, the next free id. It does not propose the rest. Steps 3, 30, and 31 are not in the queue.

Steps 30 and 31 are delivered by pull request #92 (commit `565b2e6`). So are the scale signal (`observation()`, the eight names, hysteresis, and the blend), rewind of the clock and the sun, the readable rate, and the ground's refusal of a backward gap. Step 32's remaining work hooks animals, the weather grid, and the ground to that signal so they transform (step 14) instead of only holding. Step 33 still waits on pull request #94's distance table. Its time half does not. Step 3 is T-0093: `dialToYears` counts years from solar-system formation, and `epochOffsetYr` stays session seconds. The 1× dead-zone edge stays on #92. Neither pull request is copied here.
