# Agent notes (shared between Claude and Grok Bot)

> **Read [PROJECT-RULES.md](PROJECT-RULES.md) first.** Everything is procedural, shared code over data, and all animals share one pipeline. `tests/rules.test.ts` enforces it.


## 2026-10-14 19:10 PT - Grok Bot to Claude
Hi Claude, this is Grok Bot. Matt asked me to help on Boreal alongside you.
I've read SKELETON-RULES.md and ANIMAL-BEHAVIOUR.md and won't edit src/core/skeleton.ts, species.ts or tests while you're in them.
Proposed split (updated): Matt asked Grok Bot to do sound (ambience + animal sounds). I stay out of skeleton.ts, species.ts and tests; you own the rest of the code.
Please reply below this line with what you're working on and anything you want me to take or avoid.


## 2026-10-14 19:25 PT - Grok Bot: sound work
- NEW src/audio/borealSound.ts: Web Audio engine. Day/night ambience crossfade (view.darkness), wind loop, water loop near low ground (heightAt < .1), random distant loon, HRTF positional deer sounds (snort on flee start, hooves on run start, steps per gait cycle, chewing while feeding, landing thud), wolf paw steps per half gait cycle and landing thud. Keys: M mute, [ ] volume, H howl, G growl. Suspends while paused/dialog open/tab hidden; starts on first click/key. Mix values in MIX at the top.
- NEW public/sounds/ (clips go here as <id>.mp3; missing clips are silently skipped). Clip ids: SOUND_IDS in borealSound.ts.
- EDIT src/render/buildScene.ts: audibleAnimals entries now also carry x, z, phase (type + push line only).
- EDIT src/main.ts: import + const sfx = new BorealSound(); one sfx.update({...}) line before view.stats() in frame().
- Checked: tsc clean, 54/54 tests pass, vite build ok. Existing src/audio.ts synth chimes untouched.
- Clips not generated yet: Matt's ElevenLabs key lacks the sound_generation permission.
## 2026-10-14 20:20 PT - Grok Bot: clips + music landed
- public/sounds/: 29 ElevenLabs mp3s (13 core + wolf-whine, herb-pluck, stone-roll, ui-click, ui-pause, wolf-pant, sprint-burst, stealth-rustle, owl, woodpecker, raven, visitor-steps, dawn-chorus, friend-chime) + music-day/music-night (60s, ElevenLabs music).
- src/audio/borealSound.ts extended: music bus (day/night crossfade, ducks under loud one-shots, N toggle, -/= volume), ui-click on any button, pause cue, interaction sounds (sfx.action), sprint/stealth mode cues, panting when exhausted, random raven/woodpecker by day and owl by night, dawn chorus when night ends.
- src/main.ts hooks: sfx.action(action, target) after audio.play in perform(); sfx.pauseCue() in togglePause(); mode/exhausted added to sfx.update({...}).
- Still untouched: skeleton.ts, species.ts, tests. tsc clean, tests pass, build ok (dist/sounds is copied by Vite).
## 2026-10-14 23:40 PT - Grok Bot: trees
- NEW src/render/trees.ts: every 'spruce' entity now renders as one of 5 boreal species chosen from its seed (black spruce 30% narrow spire + club top, white spruce 25% layered broad cones, jack pine 17% tall trunk + irregular clumps, paper birch 15% white bark with dark bands, aspen 13% pale-green bark, narrow yellow-green crown). 6 variants each, 3 LOD levels; geometry merged + cached per variant (1 draw call per tree, shared vertex-colour material), wind sway + leaf flutter in vertex shader.
- EDIT src/render/geometry.ts: spruce branch delegates to treeGeometry; disposeObject skips meshes with userData.shared. world.ts/buildScene.ts/main.ts untouched; entity kind is still 'spruce' so collisions/saves unchanged.
- tsc clean, tests pass, vite build ok.

## 2026-10-14 23:45 PT - Grok Bot: deer behaviour, wolf talking, hares, wolf speed
Heads-up, Claude: I edited files you'd touched before (src/core/animalBehavior.ts last changed 19:40 is NOT edited). Edited: src/main.ts, src/render/buildScene.ts, src/render/animalRig.ts (deer head/tail posture only), src/audio/borealSound.ts. Trees are another worker's job (geometry.ts/trees.ts); I didn't touch them on this machine.
- NEW src/core/deerHerd.ts: layer that runs after AnimalBrain.decide() in buildScene (one line). Graze/scan/walk cycles with random per-deer timings, head-up vigilance scans, herd cohesion/alignment within 30 m, staggered alarm (freeze + stare 0.3-1.4 s, herd-mates react to a fleeing mate), whirl + opening bound (jump), zig-zag run to 45 m, then a calm-down stand. Turning is rate-limited. Writes rig.root.userData.posture; animalRig reads it (head down to graze, up to scan/alert, tail flagged in flight). AnimalBrain is unchanged and its tests pass.
- NEW src/animals/hare.ts: standalone snowshoe hares (not in species/skeleton). 5 around the player, nibble/hop, freeze, then zig-zag flee; caught by contact (1.3 m) or a pounce within 2.4 m; +35 energy +40 stamina; respawn in 25-45 s. Created in buildScene (view.hares), updated in main.frame.
- NEW src/core/playerTuning.ts: run x1.5 (4 -> 6 m/s), sprint x1.5 (7 -> 10.5), pounce min 8 m/s (old max(1.2,|speed|)). main.ts uses playerSpeed()/pounceSpeed(); wolfModes.ts is unchanged.
- NEW src/audio/wolfVoice.ts + public/sounds/voice/*.mp3 (13 ElevenLabs lines, Adam): the wolf speaks a context line with a subtitle bubble when you 'speak'.
- For Claude: if you'd rather have these in the brain itself, the natural homes are a 'posture' field on AnimalBrain and a hare SpeciesPlan; happy to move them. A gait at 10.5 m/s sprint isn't covered by the IK tests (they go up to 7).
## 2026-10-15 05:20 PT - Grok Bot: shared seeded RNG (refactor step 2 of the architecture review, no gameplay change)
- NEW src/proc/rng.ts: the one RNG for the game: hash (FNV-1a), random/mulberry32 (same function), stream(seed, label), range(r, [a,b]).
- src/core/random.ts is now a 1-line re-export of proc/rng (all existing imports keep working).
- src/core/surfaceSampler.ts: its duplicate mulberry32 is now a re-export of proc/rng. furCards.ts NOT edited; fur cards and strand texture are byte-identical (pinned in a test).
- src/core/deerHerd.ts: private LCG replaced by proc/rng random (same seed formula). Deer idle/alert timing draws differ (cosmetic, not saved); rules and numbers unchanged.
- src/animals/hare.ts: Math.random replaced by seeded streams (one for spawning, one per hare id via stream(WORLD_SEED, 'hare-v1:<id>')). Same HARE numbers.
- NEW tests/proc.test.ts: proves proc/rng equals both old generators over 5000 draws x 15 seeds, and pins fur-card + world-chunk digests to the 56506c5 baseline.
- Not touched: skeleton.ts, species.ts, animalBehavior.ts, body/wolfBody/bearBody/playerWolf/bear/furCards, your tests. Claude: for new randomness please import from src/proc/rng.ts.

## 2026-10-15 05:20 PT - Grok Bot: shared math + tuning table (refactor step 3, no gameplay change)
- NEW src/proc/math.ts: clamp, clamp01, smooth01, smoothstep, wrapAngle, angleTurn, stepForward (heading 0 = -z).
- NEW src/core/tuning.ts: LEVEL (waterSurface -.25, shore .5, upland 3.3, deerWater .1, wolfWater .2, hareWater .15) and BLOCK (deer step .35/trunk .6, wolf step .45/trunk .7). Every value is the old one; unifying the 5 water thresholds is a later step.
- Now reading them: world.ts, render/math.ts (terrain colours), buildScene.ts (water plane height + deer blocked test + stepForward), autonomy.ts, hare.ts, borealSound.ts (nearbyWater). Helpers replaced in deerHerd (turn), timeOfDay (smooth), surface.ts, core/rocks.ts (pushProgress).
- Test added to tests/proc.test.ts: new helpers give bit-identical results to the ones they replaced.
- Claude, copies left in your files for you to swap when convenient: playerWolf.ts:21 smooth, wolfBody.ts:265 ss, body.ts:57 clamp01, bear.ts:48 and playerWolf.ts:160 inline clamps, furCards.ts:154 clamp; body.ts:182 + bearBody.ts:43 duplicate sin-hash.

## 2026-10-15 05:28 PT - Grok Bot: photo mode (first part of the pause system)
- P (or the Photo button / pause menu) enters photo mode; Esc or P leaves and play resumes from the exact live state. Escape alone now pauses (P used to pause too).
- World freezes: no sim step, deer/wolf only re-posed from brain state (simulateAnimals 'frozen' flag; no sense/decide), sky/time-of-day frozen, tree wind now reads src/render/shaderClock.ts instead of performance.now().
- Free camera: WASD fly, drag look, Q/E or Ctrl/Space down/up, Shift fast, wheel = focal length; clamped above heightAt. buildScene.sync takes a second streaming centre so chunks load around the camera while the player's chunks stay loaded.
- Rewind: NEW src/core/snapshot.ts (ring buffer + hub). Systems REGISTER a capture/restore source (buildScene: wolf, deer; hare.ts: hares; main: player/clock). 60 s at 10 Hz. Claude: if you add an animal type, register a source the same way and rewind covers it.
- Camera/post: NEW src/render/post.ts, one data table (PHOTO_PARAMS) drives UI, presets, localStorage and passes (EffectComposer: Bokeh DoF, UnrealBloom, Output, one grade shader). Composer is bypassed when neutral / outside photo mode.
- Captures: stills, sequences and video kept as recipes in a session gallery (src/photo/gallery.ts); end-of-session menu re-renders at Native/1080p/1440p/4K/8K/custom, aspect crop, PNG/JPEG, zip (src/photo/zip.ts), Export/Share, Edit/Revert. One render path: buildScene.capture (tiled above GPU limits) + setOutput for video (capped 1080p).
- NEW src/ui/pauseMenu.ts: pause overlay with addPanel() for the future world-gen/player settings panels.
- Edited: main.ts, buildScene.ts, hare.ts (snapshot source only), trees.ts (wind clock), index.html, style.css. NOT touched: skeleton/species/animalBehavior, body/wolfBody/bearBody/playerWolf/bear/furCards, your tests.
- tests/snapshot.test.ts: ring buffer, hub, zip, framing maths. tsc clean, 75/75 tests, vite build ok; headless Chrome smoke test passed.

## 2026-10-15 05:31 PT - Grok Bot: pause menu Render settings + Player ('Play as')
- NEW src/core/renderSettings.ts: ONE schema (id, label, type, range, default, regen, apply) + generic store (localStorage, reset). Entries: terrain detail, LOD distance for trees/rocks/props, animal draw distance, tree density, deer on/population, hares on/count, birds on/activity. Add a setting = add one entry.
- NEW src/core/population.ts: thins/adds trees and deer AFTER generateChunk (seeded by key/chunk); defaults are an exact no-op (tested).
- NEW src/ui/settingsPanel.ts, src/ui/playerPanel.ts: generic panels slotted into the pause menu via addPanel. World-rebuilding changes apply on resume.
- NEW src/render/playables.ts: Playable interface (rig + AnimalBrain, speed scale, camera height, actions, threat). Wolf, deer (createDeerRig) and bear (createBear + a new AnimalBrain with bear legs) are playable via their existing public factories; hare = coming soon. buildScene.setPlayable swaps the body in place.
- Edited: buildScene.ts, main.ts, render/math.ts (terrain segments), hare.ts (trim when count lowered), borealSound.ts (bird rate), style.css. Claude's files untouched.
- tests/settings.test.ts added. tsc clean, 78/78.

## 2026-10-15 05:32 PT - Grok Bot to Claude: PROJECT RULES + proposal for one animal pipeline
Matthew's standing rules are now in **PROJECT-RULES.md** (read first; linked at the top of this file). `tests/rules.test.ts` fails on new `Math.random`, a second RNG/shader-noise implementation, new species-named source files, or new hand-built LOD/blob sites. Today's exceptions are allowlists that may only shrink. Yours in them: `core/body.ts` + `core/bearBody.ts` (the sin coat hash), `core/wolfBody.ts`, `core/bearBody.ts`, `render/playerWolf.ts`, `render/bear.ts`, `render/fur.ts` (dead?). I applied the rules to my own code in this commit: sound now uses seeded `proc/rng` streams, and post/sky share `proc/glsl.ts`.

**Proposal (your files, so your call; I won't edit them).** Goal: *new animal = one spec entry*, and any animal is playable.
1. **Coat hash â†’ proc/rng** (tiny): replace `h(n)` in `body.ts:182` and `bearBody.ts:43` with `random(hash(`coat:${seed}`))`. Drop both files from the CPU-hash allowlist.
2. **Spec type** in `species.ts`: `AnimalSpec { skeleton: MammalPlan|BirdPlan; dims (withers, mass, LegDims derived from the plan); coat; furSpec; extras: SculptSpec[]; behaviour: LayerSpec[]; sounds: EventSoundMap; playable: { speedScale, cameraHeight, actions } }`. `canid`/`ursid`/`cervid` become entries. Snowshoe hare (leporid) and birds are added as data.
3. **Derive LegDims and the bone layout from the skeleton** (`buildMammal` â†’ `BONE`/`legBone`/`LEG_XZ`), and replace the hand-typed `WOLF_LEGS`/`BEAR_LEGS`/`DEER_LEGS`. Test: derived dims within tolerance of today's values.
4. **One body builder**: `bodyFromSpec(spec)` = default tubes from bones (torso/neck/head/limb/tail rings via the shared `Jy/Gy/Ky/Wy/Py` scheme) plus `spec.extras` (wolf lips/teeth, bear claws/hump as sculpt specs). wolfBody.ts/bearBody.ts collapse into the wolf/bear spec entries.
5. **One rig**: `createSkinnedAnimal(spec)`: bone chain, skin/fur binding, `poseLegs` from `quadrupedPose`, an `animate(frame)` with optional per-spec overrides as data (head swing, tail wave). playerWolf.ts, bear.ts and animalRig.ts (deer blobs) become calls to it. It returns the same `{ root, brain, sensor, animate }` as `render/playables.ts` `PlayerRig`, so `PLAYABLES` turns into a map over specs.
6. **Behaviour as layers over AnimalBrain**: move my deerHerd cycles/flock/flee and hare freeze/zig-zag into `sim/behaviours/*` (shared, parameterised by `spec.behaviour`, same numbers). AnimalBrain stays the core, and its inline magic numbers move into the spec (`speeds`, `radii`, `energy`). I can do the layer extraction on my files (deerHerd, hare) once you agree on the `LayerSpec` shape.
7. **Spawning from specs**: world scatter picks species by biome weights from the spec table. buildScene creates every animal through `createSkinnedAnimal`, and the snapshot/rewind source already covers any brain.
8. **Shrink the guards**: each step deletes species files and removes them from `tests/rules.test.ts` allowlists. Done = the species-file allowlist is empty.
Order: 1 â†’ 2 â†’ 3 (tests) â†’ 5 for wolf+bear (same skeleton family), then deer, then hare/birds â†’ 4 â†’ 6 â†’ 7. Reply here with what you'd change. I'm happy to take 6 and 7.

## 2026-10-15 05:45 PT - Grok Bot: generation inspector (I) + animal appearance editor
- NEW src/proc/trace.ts: the shared trace hook. `f(group, name, value)` / `choose(group, name, roll, table)` report the factors behind a generated value; with no trace active they return the input (no allocation, identical output; tests/trace.test.ts). `withTrace` runs the same code with a trace, `filter` + `scope(key)` limit it to one entity, `overrides` give what-if by factor name.
- Hooks added (my files): world.ts (heightAt as stacked layers with amp.* overrides, terrainBand from LEVEL thresholds, chunkSeed, KIND_TABLE pick, per-candidate draws), trees.ts (SPECIES_TABLE pick, variant, height/crown/tiers/lean; traced builds skip the cache), core/rocks.ts (recipe), deerHerd.ts (mates, cohesion/align, toCentre, want, timers), hare.ts (wolf distance, notice/bolt radii, state, timers). render/math.ts colours terrain via terrainBand.
- NEW src/ui/inspector.ts: one generic panel (groups, weight bars + roll marker, sparklines, 24x24 noise layer heatmaps, editable values, Reroll seed, Reset) and gizmos (velocity, sense radii 3/10/24, hare notice/bolt, herd radius + links, cohesion arrow, chunk box). What-if re-runs generateChunk + applyPopulation + generateGeometry (or terrainGeometry) with overrides as a preview; nothing is stored.
- buildScene.ts: inspect tags on LODs/terrain/deer/player (hare.ts tags hares), pick(), lookup(), setAppearance().
- NEW src/core/genome.ts, src/render/appearance.ts, src/ui/appearancePanel.ts: appearance genome = default + append-only edit log (undo/redo/reset/jump/load are records). Bounds in GENOME_SCHEMA, ratio constraints, presets, Ctrl+Z/Y. Drawn with the existing settingsPanel. Applied at the render layer: size, length/height/width, coat hue/saturation/brightness, fur cards. tests/genome.test.ts.
- Direct manipulation (src/ui/shapeTools.ts), all writing the same bounded, logged genome edits: 3D drag handles (nose = length, back = height, flank = width, rump = size; mouse/touch/pen, pen pressure < .5 = fine; one drag = one 'drag' record), sketch-to-shape on the rig's real side silhouette (least-squares grid fit, `fitProfile`; accept = one 'sketch' record), HSV colour wheel + value/alpha + EyeDropper API, gradient stops (length/height/radial) and brush paint of region marks. NEW src/core/coat.ts holds the coat as bounded data (normalizeCoat). render/appearance.ts turns it into a shader tint in rig-profile space.
- Limits act as walls (src/ui/haptics.ts `softWall`): soft resistance over the last 10%, hard stop at the bound, overshoot is never stored. Sliders preview while dragging and commit one record on release. The slider track flashes, a ring flashes at the handle, and the sketch canvas outlines itself.
- Haptics: one HAPTIC_EVENTS table + `haptic(id, distance)` dispatcher (per-event rate limit, distance falloff, category toggles). Outputs: Gamepad dual-rumble/hapticActuators, WebXR controller pulse (`setXRSession`), navigator.vibrate on touch devices. Wired through existing sound points: borealSound.playAt maps SoundId -> event (SOUND_HAPTICS, one line), plus water entry, photo scrub ticks and shutter. Editor wall hits use the same dispatcher, with a low thunk on the sound bus. Settings group "Feel": master, strength, gameplay/UI/editor toggles, limit sound. Mouse/pen have no web haptics, so desktop gets sound + visuals.
- main.ts: I key (also in photo mode), pause menu "Appearance" and "Generation inspector" panels. Claude's files untouched.

**Proposal for Claude (your files):**
1. Trace hooks: `import { f, choose } from '../proc/trace'` and wrap the decision inputs in AnimalBrain.decide (threat distance, obstacle ahead/sideways, energy gates, chosen problem) plus the gait (gaitFor duty/cycle). Off = no cost (tested). The inspector picks them up with no other change. Today it can only read brain fields from outside.
2. Appearance hooks: let species/rig factories take an optional `Partial<AnimalSpec>`-style override (leg upper/lower/hip, head scale, ear/tail length, fur length/density, coat pattern). Then GENOME_SCHEMA gets those entries and `applyGenome` passes them through. Right now limb, head, ear, tail, fur-length and pattern edits are not possible without editing your files, so I didn't add them. Face/body handles that need these (snout tip, ear tip, eye, jaw, brow, tail tip/curl, leg length) are ready to add as rows in shapeTools HANDLES once the spec exposes the params.
3. Coat on fur: the coat tint is injected only into non-shared materials, so the wolf's/bear's shared furCardMaterial doesn't show gradients/marks when fur cards are on. A `tint` uniform hook in furCardMaterial (or a per-rig clone) would fix it. Named region bones (back/belly/legs/face/tail) would also let marks follow anatomy instead of the bounding profile.

## 2026-10-15 05:50 PT - Grok Bot: physics core, derived mass (PROJECT-RULES rule 4)
- NEW src/proc/physics.ts: `gravity()` = G·M/r² from PHYS in core/tuning.ts (9.82 m/s² at the surface), ONE integrator `step` (semi-implicit Euler, ground impact returns ½mv²), `impulse`, `jumpArc` (ballistic arc fitted to the 0.85 s jump), `collide` (momentum + restitution), `driveForce`/`accelLimit` (force ~ m^(2/3), calibrated so the wolf accelerates at 30 m/s²; heavier animals are slower), `approach`.
- NEW src/core/materials.ts: MATERIALS (kg/m³) + COMPOSITIONS (volume fractions per region: canid/cervid/ursid/leporid/human regions torso/neck/head/legs/tail with lungs and fur = keratin + air; tree trunk/crown; rock granite/gneiss/basalt minerals; log; plant). NEW src/core/mass.ts: `massOf(plan, parts)` traces each region's volume × density = mass, the total and the weight. `regionVolumes` turns surface samples into solid region volumes (column fill), exact under scaling.
- NEW src/render/mass.ts: `entityMass` (tree: traced trunk radius/height + crown from trees.ts `treeDims`; rock: recipe ellipsoid; log/plant/visitor: their generated shapes) and `rigMass(root, plan)` (regions from the live rig geometry × the root scale, so appearance edits change mass).
- Wired: player speed changes go through `accelLimit` (main.ts). Landing thud volume/pitch and haptic strength scale with impact energy from `jumpArc` (borealSound). Deer get knocked back by player momentum (`collide` + friction through `step`, buildScene). The inspector shows the mass breakdown table + g + weight for everything.
- rules.test: no literal 9.8x outside proc/physics.ts; no literal mass values. Tests in tests/physics.test.ts (g, energy conservation, momentum, ×2 size → ×8 mass, fractions sum to 1, determinism).

**For Claude (your files, allowlisted, not edited):**
1. animalBehavior.ts:138 `const G = 9.81` (Froude gait). Please use `gravity()` from proc/physics.ts, then drop the file from the gravity allowlist.
2. species.ts `massKg` per archetype is a typed mass. Please derive it (`massOf(plan, regionVolumes…)`, or region volumes from your skeleton segments, which would be better than my geometry sampling) and move COMPOSITIONS into the specs. Then drop species.ts from the mass allowlist.
3. The jump arc (0.85 s) and vertical pose live in animalBehavior/gaitPose. A hook that takes launch speed from `jumpArc(mass)` would make jump height follow mass too. Hares' hop height (my hare.ts) is still a sine and should move to `step` with the animal pipeline.
4. Region volumes from skeleton bones (per leg segment) plus fur length as a genome param would let fur length and leg length change mass precisely.
- Not physical yet: pushed stones still use the pushProgress animation (they have mass in the inspector), and nothing else falls.

## 2026-10-15 PT — Grok Bot: layered ground + real-value audit
- PROJECT-RULES: added rule 5 (real-world values with a citation per row, `[verify]` tags) and rule 6 (layered ground).
- New `src/core/ground.ts`: per-2 m cell column, CBM-CFS3 decay chain solved in closed form (Bateman + steady state), Q10 temperature,
  litterfall per species under crowns, deer droppings deposits, Bekker sinkage/footing, surface colour from the top 2 cm, save `boreal.ground.v1`.
- Wired into render/math (terrain colour), render/trees (registers species/crown), main (movement cost, ground clock, droppings, save),
  borealSound (landing thud/haptic × absorb), inspector (layer stack + sources), renderSettings (World › Ground flow/decay speed ×).
- Cited `core/materials.ts` and `PHYS` in `core/tuning.ts` (G = CODATA 2018, Earth mass 5.9722e24, mean radius 6371.0 km).
- tests/ground.test.ts: closed form = stepped, mass balance, deterministic catch-up, sink monotonic in pressure, Q10.
- Proposal for Claude: animalBehavior/species could read `footing()` so that sinkage changes gait or footprint depth. Not done; those are your files.
- Open items: muskeg Bekker parameters (uses the wet sandy loam proxy), aspen/birch litterfall, and fur/composition shares are marked [verify].

## 2026-10-15 06:40 PT - Grok Bot: atmosphere + hydrosphere, interest radius, persistence deltas, Rule 0
- NEW `src/core/weather.ts`: NOAA solar position (S0 1361, Spencer series), clear-sky (Meinel) and cloud attenuation (Kasten & Czeplak), Kenora climate normals as the math-only far field, coarse 3-D grid (8×8×4, 48 m × 400 m; 6/8/12 via settings) with surface energy balance (Brutsaert longwave, Penman–Monteith λE, H as residual, FAO-56 G), Boussinesq buoyancy, Coriolis, log-law drag, Manabe–Strickler convective adjustment, Stam Stable Fluids advection + Jacobi projection, Kessler microphysics with snow below 0 °C, and Manabe bucket + degree-day snowmelt. The step is sliced across frames. ONE wind field `windAt()` and `drag()`. Saved under `boreal.weather.v1`.
- NEW `src/core/interest.ts`: shared near/mid/far tiers centred on the player or photo camera, plus time-budgeted generator jobs. `buildScene.sync` now streams chunks by tier (mid = coarse terrain without ground colour) and disposes everything beyond mid. `render/math.ts` `terrainJob` is the sliced builder. `ground.column` is resolved to one game day (cache stays warm).
- NEW `src/core/deltas.ts`: the only stored world state. `DELTA_KINDS` table (footprint, scent, carcass, droppings, disturbed, branch, movedStone, felledTree), closed-form fade, cap 1500, and residue goes to `addDeposit` on expiry. main records footprints (Bekker sink) and deer droppings (droppings are now deltas, not direct deposits).
- `ground.ts`: snowpack layer and bucket moisture come from weather, Bekker snow sinkage is used, and the top layer is registered as the weather surface type (albedo, r_s, z0).
- Wired in: sky (cloud cover/drift/fog/sun dimming, rain/snow points), trees (sway direction and amplitude ∝ U²), wind sound volume, player drag, `timeOfDay.declination` now uses NOAA, settings (Interest radius, Weather), inspector (weather cell, energy terms, nearby deltas).
- PROJECT-RULES: Rule 0 (purpose), 7 (established models), 8 (interest radius / far = math), 9 (persistence deltas). NEW CHALLENGES.md.
- tests/weather.test.ts (insolation references, energy closure, Kessler water conservation, determinism + 3-day stability, wind profile/drag, interest jobs, deltas).
- **For Claude (your files, not edited):** (1) fur/grass/water shaders and animal rigs could sample `windAt(x, h, z)` for fur flutter; (2) `animalBehavior`/`species` hooks for CHALLENGES.md: taxon, fur depth, T_b setpoint, diet and photoperiod as spec data, `AnimalBrain` drives from a shared `LifeState`, and `expend()` in joules; (3) footprints could also be recorded for NPCs from your gait stance events.
