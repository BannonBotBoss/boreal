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

## 2026-10-15 07:00 PT - Grok Bot: photoreal pipeline + adaptive quality governor (rules 10, 11)
**Adoptions (adopt-and-tailor-existing-code):**
| Need | Shortlist (language, licence) | Adopted | Why / changes |
|---|---|---|---|
| Cascaded shadows | three examples CSM (JS, MIT); three-csm (JS, MIT, older fork); Unreal/Godot CSM (C++) | **three r180 `examples/jsm/csm/CSM.js`**, unmodified, already a dependency | Native and zero new deps. Its `setupMaterial` *replaces* onBeforeCompile, so `render/photoreal.ts` chains it onto our wind/PBR hooks. Cascades and map size (≤2048) come from the ladder. |
| Ambient occlusion | three GTAOPass (JS, MIT); N8AO (JS, CC0/ISC, needs pmndrs `postprocessing`, ~0.8 MB pkg); XeGTAO (HLSL, MIT) | **three `GTAOPass`**, unmodified, in the existing EffectComposer | No new dependency, and same algorithm family as XeGTAO (Jiménez 2016). N8AO would have pulled in a second post stack. |
| Physical sky / IBL | three `Sky` (Preetham, MIT, already used); @takram/three-atmosphere (JS, MIT, Bruneton; needs `postprocessing`, 35 MB pkg, precomputed LUTs); Bruneton reference (C++/GLSL, BSD-3); Hosek–Wilkie (C, BSD) | **Keep three `Sky` + `PMREMGenerator`** | Already in the bundle. Turbidity is driven by the weather and IBL is re-baked every 2° of sun. Takram/Bruneton is the follow-up for Ultra (bundle and Quest cost too high now). |
| Adaptive quality | drei PerformanceMonitor (TSX, MIT, React-only); AdaptiveDpr (drei); detect-gpu (pmndrs, MIT, fetches benchmark JSON from a CDN at runtime) | **drei PerformanceMonitor algorithm**, baseline vendored unmodified in `vendor/drei/` (upstream bf6f4addf474, LICENSE kept), re-implemented in `core/quality.ts` | React-only, so the algorithm was ported (250 ms windows, 10 iterations, 75 % threshold, bounds, flip-flop fallback). Changes: discrete ladder, reversal-only flip-flops (cf. drei PR #1791), work/GPU time instead of wall fps, cap tier. detect-gpu was not adopted (runtime CDN fetch); we use a renderer-string regex instead (`tierForGpu`). |
| Tone mapping | three ACES/AgX (built in) | kept | Photo-mode EV already drives `toneMappingExposure`. |
- NEW `render/pbr.ts`: one shared terrain material (was one per chunk), with noise albedo, roughness and normal from `proc/glsl` `GLSL_NOISE` (sky's private noise moved there; the rules allowlist shrank). Wet/snow response comes from per-vertex `aWet`/`aSnow` (ground column). Needle translucency uses Barré-Brisebois & Bouchard 2011.
- `render/sky.ts`: Koschmieder fog/visibility from weather (Kunkel 1984 fog extinction) and turbidity from humidity/cloud. Exposes `sky, sunLight, hemi`.
- `render/post.ts`: GTAO pass; the composer is used outside photo mode only when AO is on.
- `core/renderSettings.ts`: Quality group (Auto, target 30/60/72/90/120, tier cap, max resolution/shadows/AO). `USER` + `capRender()` make the player's LOD, density and radii choices into caps.
- Inspector shows the tier, knobs, measured fps, GPU ms and GPU string. The renderer asks for `powerPreference: 'high-performance'` (Matthew's laptop is hybrid: RTX 5060 Laptop + Intel).
- tests/quality.test.ts: ladder ordered and bounded, step-down only after sustained overload, hold inside the margin, step-up with headroom, flip-flop lock, caps, GPU detection, XR caps.
- Not done: SSR/SSGI, contact shadows, Bruneton atmosphere, a WebXR session (XR caps exist but no `renderer.xr` path), fur/rig materials (Claude's) not given translucency.
- **For Claude:** animal materials are MeshStandardMaterial, so CSM shadows and IBL reach them automatically. If you want fur translucency, call `addTranslucency(shader)` from `render/pbr.ts` in your fur material's onBeforeCompile.

## 2026-10-15 07:20 PT - Grok Bot: lighting/shadows, spec-driven trees (aspen, balsam poplar, balsam fir), near-tier bark
- **Lighting:** NEW `core/light.ts` (tested). Sun colour comes from spectral Rayleigh (Hansen & Travis 1974) and Ångström aerosol transmittance on the Kasten–Young air mass. Illuminance is in lux: sun = shortwave × 105 lm/W, moon from Allen's phase law with Meeus lunar age, starlight 0.001 lx. An adaptation gain (E_ref/E)^0.85 is applied to the light intensities (it reproduces the old full-moon look; sky/cloud shaders keep their tuning). Moonlight follows the lunar age. Cloud shadows: the weather grid's cloud water → texture → direct light × (1 − 0.75 C^3.4), on terrain and trees (`addCloudShadow`). Bounce light: SH `LightProbe` from a 32² cube capture every 4 s (three `LightProbeGenerator`, MIT). New ladder knobs `gi` and `clouds`. Shadows reach every MeshStandardMaterial mesh (animals, trees, rocks): `photoreal.setupMaterials` sets cast/receive.
- **Not built (searched; follow-ups):** PCSS soft penumbrae (three `webgl_shadowmap_pcss` example overrides ShaderChunks and conflicts with CSM's chunk injection; needs a merged chunk), contact shadows (pmndrs `ContactShadows` is a ground-plane-only drei/R3F helper; a screen-space contact pass would be a port of the HDRP/UE approach), volumetric god rays (three `GodRaysShader`/pmndrs `GodRaysEffect` both need an occlusion prepass; candidate for Ultra), SSGI (pmndrs realism-effects is unmaintained and needs `postprocessing`).
- **Trees:** `render/trees.ts` now has ONE builder per crown form. Species are rows in NEW `core/treeSpecies.ts`: black/white spruce, balsam fir, jack pine, paper birch, **trembling aspen**, **balsam poplar**. Each has cited heights, DBH, wood (new `firWood`, `poplarWood` materials; trunk composition per wood), bark, leaves (size, flutter: aspen's flattened petioles), litterfall, Kenora stand share and site niche. Per-tree attributes and BRANCHES sample bounded distributions through ONE helper `proc/rng` `sample` (normal/lognormal, truncated; tested): DBH, Chapman–Richards height, crown ratio, whorl spacing, branches per whorl, insertion angle, length ratio, Leonardo Δ (pipe model), droop, phyllotaxis divergence and dead-branch zone. All traced to the inspector. The stand mix is weighted by site wetness. Phenology (leaf-out/colour/leaf-off by date) is in the shared tree shader. Adopt-first: ez-tree (MIT, 22.8 MB package, image bark/leaf textures, unique per-tree geometry) and proctree.js (MIT) were reviewed and not adopted (texture assets break rule 1, and per-tree meshes break the Quest draw-call budget). Weber–Penn's parameter scheme (Weber & Penn 1995) informed the attribute names. Sapling (Blender's Weber–Penn) is GPL, so it was not used.
- **Near-tier bark:** `BARK_GLSL` in trees.ts follows Lefebvre & Neyret 2002 (bark as patterns on the trunk chart), with the feature set of Blender/Substance birch graphs: lenticel rows from hashed cells, peeling strips with orange inner bark and one-step parallax, fissures, chevron scars per node row, and a dark rough base scaled by DBH. Only on LOD 0, crossfaded out by distance (`uBarkFar = INTEREST.near/2`). Aspen and poplar use the same function with different parameters. Birch bark linear albedo is 0.63 [verify source]. Shadertoy bark shaders were looked at for technique only (most are CC BY-NC-SA, so no code was copied).
- Mass fix: `PHYS.crownFill` .08 → .0015 (crown bulk ≈ 0.9 kg/m³, matching its own citation; the old value made a 20 m aspen weigh 32 t).

## 2026-10-15 06:45 PT - Grok Bot: remaining lighting/shadows and the first real-GPU benchmark
- Ladder knobs: `pcss` (PCSS from three's webgl_shadowmap_pcss, MIT, Fernando 2005), injected into the shadow chunk behind `#ifdef PCSS`, adapted for the directional sun. `contact` and `rays` run in ONE `SUNFX` pass in render/post that reads the composer's depth texture: contact shadows are a 16-step ray-march toward the sun (Bend Studio SSS idea), and god rays are a radial sky-mask blur (Mitchell 2007, as three GodRaysShader, but with no occlusion prepass). `gi` 2 = 64² probe every 1 s. SSGI was not adopted: three's SSGI is WebGPU/TSL-only in r180, and pmndrs realism-effects is unmaintained. The SH probe is the fallback.
- Bench (`?bench=1`, RTX 5060 Laptop, D3D11, 1920×1080, Ultra 2× res): 81 ms GPU / 99 ms frame, 7.9k calls, 1.55 M tris. Without GTAO: 37 ms GPU. Without CSM: 50 ms GPU and 2.5k calls. Later samples were contaminated by chunk streaming (calls rose to about 20k as interest radii loaded), so the pcss/contact/rays/gi/ibl/clouds deltas are NOT trustworthy yet. **The main bottleneck is draw calls**: every tree and prop is its own LOD mesh, and shadows multiply them per cascade. Next fix: instanced/merged trees per chunk and species, and cheaper shadow casters (impostors beyond the near tier). IBL bake = 87 ms CPU per re-bake (on 2° of sun movement). GI capture = 58–117 ms CPU even with only sky and terrain; investigate the readback.
- Console: no errors. 90 HLSL X3595 warnings (gradient in a loop with varying iteration; harmless). One "Cannot read properties of undefined (reading '2')" appeared once during a tier switch in the first run and did not recur; it is not yet located.

## 2026-10-18 03:10 PT - Grok Bot: world stage 2c, rivers (behind ?stages=1 / world.stagedTerrain)
- NEW `src/core/stages/rivers.ts`: everything derived from seed -> stage-1 grid -> stage-2a flow; nothing placed.
  - Channels = upslope area >= 0.5 km^2 (threshold extraction as WhiteboxTools ExtractStreams / pysheds) [verify threshold].
  - Strahler order: faithful port of xarray-spatial `_strahler_cpu` (MIT, Python/numba, xrspatial/hydro/stream_order_d8.py), adapted to our torus D8 receivers. Lake cells stay in the network for ordering but are not drawn or carved.
  - Bankfull width/depth from drainage area, Laurentian Upland curve (Bieger et al. 2015, JAWRA 51:842, via FluvialGeomorph/RegionalCurve): w = 4.15 A^0.308, d = 0.31 A^0.202 (fitted 16.6-366 km^2; small basins extrapolate [verify units/range]). Manning velocity (n = 0.035, Chow 1959) for flow scrolling/foam only.
  - `riverAt(seed,x,z)`: nearest D8 segment between grid nodes (mapgen4-style per-flow-edge rivers), evaluated per point, so rivers are continuous across chunks at any terrain resolution. `carve(h, hit)` only lowers terrain (parabolic bed + sloped bank, smooth blend back). The water surface follows the Priority-Flood FILLED surface (strictly downhill), minus a freeboard that tapers to 0 where the river enters a lake, so rivers meet lakes at the lake level.
  - Seed 1400: 911 channel cells, 457 drawn, max Strahler order 3, widths up to 12.4 m, built in ~2 ms.
- NEW `src/render/water.ts`: ONE shared water material (base plane, lakes, rivers; was one material per chunk). Two-phase flow (Vlachos 2010 / three Water2.js technique) driven by a per-vertex `aFlow` attribute instead of a flow-map texture; normals from the shared `fbm` gradient instead of normal-map textures; foam = noise x speed. No assets.
- `core/world.ts`: heightAt carves rivers; no trees/props inside channels; inspector shows order, basin km^2, width, depth, speed, distance.
- `render/buildScene.ts`: the stage-2 water sheet is 33x33 near (9x9 mid) and carries lake level / river surface + flow.
- `main.ts`: dev `?at=x,z[,yaw]` spawn for screenshots. `animals/hare.ts`: FIXED a hang. `while (count < N) spawn()` looped forever when no dry land was within spawn range (spawn gives up after 12 tries), e.g. spawning in staged lowlands. Now bounded per frame.
- tests/rivers.test.ts: synthetic Strahler Y, threshold = extraction, Bieger geometry, no uphill/order and width monotone downstream, lakes not drawn, carve only lowers, bed below surface, determinism.
- Known issues: the lake mask uses floor(x/cell) (cell-centred) while sampleGrid/rivers use nodes at i*cell, a half-cell offset at lake shores (pre-existing). Staged terrain relief is only ~3.5 m (LEVEL), so much land sits below `LEVEL.shore` and stays bare. Origin (spawn) is inside a lake on seed 1400.
- Next: stage 3 ground/soils from slope, TWI, distance to river/lake (height above nearest drainage, which needs this channel network), then waterfalls/rapids where slope x speed is high.
- For Claude: nothing of yours touched. `riverAt()` is available if animals should drink at or avoid river channels (deerWater uses heightAt, which now includes the carved beds).

## 2026-10-18 03:25 PT - Grok Bot: planet globe, milestone 1 (`?view=globe`)
- **What:** orbit-to-ground globe of the seeded world at `http://127.0.0.1:5173/?view=globe`. Cube-sphere with distance-based quadtree LOD (levels 1–2 at orbit down to L15+ at 300 m), elevation + ocean/lake colouring, OrbitControls drag with a logarithmic altitude zoom (wheel, + / -), auto tilt to the horizon near the ground, H = fly home, G/Esc = back to the game. Dev params: `alt=<m>`, `at=x,z` (game metres), `seed=`, `stages=1`, `tier=0..5`, `shot=1` (settle one level per frame).
- **Adopt-and-tailor:** shortlisted Hello Terrain (MIT, WebGPU/TSL only, needs three ≥ 0.182: we are on WebGLRenderer r180), @interverse three-terrain-lod (flat, three ≥ 0.182), quadsphere (MIT, R3F-first, 2023, 0 downloads), takram three-geospatial (MIT, ellipsoid/atmosphere, terrain needs 3D Tiles data), three-tile / 3d-tiles-renderer (streamed map/tiles data, not procedural). **Tailored SimonDev ProceduralTerrain_Part10** (JS, MIT, @09448f7): six face quadtrees, split when distance < k × node size, sphere-projected node centres, edge skirts, tile-local vertices (floating origin). Changes: integer node keys, Nowell 2005 spherified cube, no neighbour stitching (skirts instead), knobs from the quality ladder, builds as core/interest jobs.
- **NEW files (all mine):** `src/world/globe/planet.ts` (pure seeded surface: ridged multifractal + basins on 3D value noise from proc/rng, Earth land share 29.2 % by Fibonacci-sphere hypsometry, Kenora-latitude home with a lift to 370 m), `cube.ts` (faces, mapping, quadtree, split test), `tile.ts` (grid + skirt generator job), `lod.ts` (one row per LADDER tier), `globeView.ts` (renderer, camera, LOD loop, governor, HUD), `entry.ts` (page entry), `tests/globe.test.ts` (6 tests).
- **EDIT `index.html`:** the module script is now `/src/world/globe/entry.ts`, which dynamic-imports `main.ts` unless `?view=globe`. main.ts itself is untouched.
- **Same seed, same world:** the planet is a pure function of (seed, direction). Inside the home region (7.68 km square = one stage-1 grid tile) the height IS `core/world heightAt(x, z)` through a gnomonic projection (+x east, −z north), with the same `boreal.seed.v1` and `world.stagedTerrain` setting, blended into the planet over 1.2 km. Tested: `heightAt` + 370 m to 1e-6 m at sample points.
- **Governor:** start tier from the GPU string + cached probe cap (as photoreal), user caps through `createSettingsStore(RENDER_SETTINGS)`, `governFrame` every frame; tier → tile segments 48…16, split 1.8…1.25 × `applied().lod`, depth 19…15, cache 1400…350, resScale.
- **Measured (omen, headless Edge, Ultra):** 60 fps; 96 tiles at orbit, ~170 at 900 km, ~320 at 40 km, ~540 at 300 m (frustum culling cuts draw calls). One 48-segment tile ≈ 2–3 ms CPU.
- **Limits / next:** no atmosphere or sun from the world clock; vertex-colour coastlines are stair-stepped at mid zoom; staged lakes use the flat water level (no `lakeAt` surfaces or rivers yet); tile normals are per-tile (faint shading seams possible); no Web Worker builds; no in-game key yet (step 2: a G key / pause-menu button in main.ts, which needs the main.ts owner's OK); the game is not yet placed on the sphere (step 3: hand-off at ~2 km altitude to the flat chunk renderer).
- Not touched: skeleton.ts, species.ts, animalBehavior.ts, body/rig files, rivers/world-stage files, main.ts, buildScene.ts.

## 2026-10-18 03:30 PT - Grok Bot (Gait Builder): procedural locomotion layer M1 + hooks requested from Claude
- NEW (Grok Bot-owned) `src/animals/locomotion/`: `signals` (types), `gaits` (Hildebrand/Alexander gait table; auto choice and stride come from your `gaitFor`), `cpg` (four coupled Hopf/Kuramoto phase oscillators, Ijspeert 2008; frequency = speed / stride so feet don't skate; a gait change glides over about one stride instead of snapping), `foot` (feet locked in the world at touchdown, swing arc to a predicted landing point, terrain sampled through a `(x, z) => y` function such as `heightAt`), `balance` (body height/pitch/roll from the ground under the four limbs), `ik` (your `quadrupedPose` limb chain via your `solveLeg`, plus sideways swing and a clamp to the `CANID_LIMB` flexion limits), `spring` (Holden critically damped springs as the joint "muscle"), `controller` (near/mid LOD), `stickRig` (neutral capsule test body), `lab` + `tools/locomotion-lab.html` (dev page: `?terrain=flat|hills|world&gait=auto|walk|trot|pace|canter|gallop|bound|pronk&speed=&lod=near|mid&rig=stick|real&t=`).
- READ-ONLY imports of your code: `gaitFor, solveLeg, limbOf, bendsForward, isFrontLeg, WOLF_LEGS` (animalBehavior), `CANID_LIMB` (skeleton), `LEG_XZ` (wolfBody), `WOLF_SCALE` (wolfModes); `?rig=real` builds `createPlayerWolf()` and overwrites its leg-bone rotations after its own `animate()`. None of your files were edited. Nothing in the game loop uses the layer yet.
- Tests: `tests/locomotion-cpg|foot|ik.test.ts` (offsets converge for every gait, gait changes have no phase jumps, planted feet slip < 1 mm through gait/speed changes, turns and a stop on hills, duty factor matches the table, feet stay above the terrain, `solveLimb` reproduces `quadrupedPose` to 1e-9 on flat ground, flexion limits hold).
- Adoptions (rule 11; formulas ported, no code vendored): Hopf/Kuramoto CPG (Ijspeert 2008 Neural Networks 21:642; Righetti & Ijspeert 2008), gait offsets (Hildebrand 1965/1977; Alexander 1984; walk/trot/gallop rows = your gaitFor), world-planted feet + support plane (majidmanzarpour/threejs-procedural-spider, MIT, pattern only), springs (Holden 2021 "Spring-It-On"). Rejected: Rapier/cannon-es for walking (second integrator vs rule 4, active-ragdoll balance, rewind), PFNN/MANN/motion matching (stored mocap, licences).

**Hooks I'd like in your files (your call; small; default behaviour unchanged):**
1. Rig descriptor: `createPlayerWolf` / `createBear` (and `createSkinnedAnimal` later) also return `loco: { root, torso, scale, legs: LegDims, chains: [{ girdle, upper, lower, foot, paw, hipXZ }] /* LF, LH, RF, RH */, spine?: Bone[] }`.
2. Pose override: `animate(...)` accepts an optional `legPose` (same shape as `quadrupedPose()` plus `abduct[]`, `pitch`, `roll`, `height`); when given, use it instead of calling `quadrupedPose` and apply the tilt/height to the root/torso. When absent, nothing changes.
3. Brain signal: optional `intent?: { kind: 'jump' | 'pounce' | 'stop'; target?: { x, z } }` on `AnimalBrain`, set where you choose a jump today. Everything else I derive from `motion / gaitSpeed / heading / jumpTime`.
4. Stance events: the layer emits real touchdowns (`contacts` rising edges) for footsteps/footprints; `brain.phase` can stay as it is for sound until we agree who owns it.
5. When rigs get lumbar/thoracic bones (skeleton.ts already has them), expose them in `spine` and I'll bend them (gallop flexion, pounce extension).
6. (Repeat) `animalBehavior.ts` `G = 9.81` → `gravity()` from `proc/physics`.
The game-loop call (`buildScene.simulateAnimals` + player animate) is one line on my side, once you agree on 1 and 2.

**Open questions (for Matthew/Claude):** who owns `brain.phase` after integration (CPG write-back or AnimalBrain)? OK to add a `loco` column (full-IK radius, m) to `core/quality.ts` LADDER in M2? Ever want a physics ragdoll (knockdown/death only)? Next species after the wolf: the bear (skinned, plantigrade)? The deer needs a bone rig first.

## 2026-10-18 03:45 PT - Grok Bot: procedural grass blades (render/grass), ported from Quick_Grass
- **Adopted:** simondevyoutube/Quick_Grass (MIT, GLSL + JavaScript, @6b56164), itself after "Procedural Grass in Ghost of Tsushima" (Wohllaib, GDC 2021). Baseline in `vendor/quick-grass/` (unmodified, commit e8d3d96). Other candidates reviewed: al-ro grass (instanced quads, alpha-mapped TEXTURES from Eddie Lee's paper: breaks rule 1), James-Smyth/three-grass-demo (MIT, non-instanced 5-vertex blades, colour from a splatter TEXTURE). Quick_Grass was picked because its blades are pure vertex-ID geometry, it has two blade LODs and it is MIT.
- NEW `src/render/grass/grass.ts`: the port. Kept: vertex-ID blades (front + back), highLODOut, lean/curve, noise wind lean around an axis, player push, rounded normals mixed toward up (skyFadeIn), base→tip colour + base AO, view-space thickening. Changed: MeshStandardMaterial via onBeforeCompile (CSM/IBL/fog/cloud shadows/translucency), proc/glsl vnoise instead of murmurHash/noise12, per-blade data from the CPU, wind = the trees' uniforms (NEW `WIND_UNIFORMS` export in render/trees: the same objects, updated by updateTreeUniforms), fall colour = the same phenology uniform, blades ≥ 1.5 px wide (real 2-8 mm leaves alias away), DoubleSide not used (upstream's back faces kept).
- NEW `src/render/grass/cover.ts`: placement + species, pure CPU. Jittered grid (GoT) kept by the density field; roots on the terrain mesh's own vertex lattice + triangulation. ONE density field `coverAt` with `setCoverSource(fn)` for the soils stage. Default field: no blades in lakes, river channels (bed + inner bank) or water; bare rock = upland band / slope > 28-38° with 4 m soil pockets; TWI (stage 2a, bilinear) as wetness in staged mode, height proxy otherwise. Species rows (Baldwin & Sims 1997 habitats, FNA dimensions, [verify]): bluejoint, water/beaked sedge, wavy hairgrass, poverty oatgrass, lowbush blueberry and Labrador tea (shrubs as stem + elliptic-leaf sprigs from the same blade generator).
- Cost: tiles of 10 m (chunk/4) built as interest jobs (~6 ms each, sliced per row); instances keep-sorted, so distance thinning ((9/d)² beyond 9 m, 0 at the radius) and the LADDER `foliage` knob just set instanceCount. Radius = 48 m × √foliage, capped at INTEREST.near. Bench (RTX 5060 Laptop, D3D11, headless 1600×900, Ultra, 94 tiles, 467k blades built, 94k drawn): GPU 8.6 ms with grass vs 8.0 ms without (≈ 0.6 ms); frame stays at the 60 Hz v-sync. No shadow casting (upstream also off).
- Wiring: `render/buildScene.ts` creates the grass and calls `grass.update(camera, player, tier.foliage, INTEREST.near)` next to updateTreeUniforms. Dev handle `globalThis.borealGrass` {info, fx.off}.
- tests/grass.test.ts: species rows physical, falloff monotone, tiles deterministic + keep-sorted + on the terrain, staged world has no blades in lakes or river beds, soils hook replaces the field.
- **For the soils worker (your files, not edited):** when `core/stages/soils.ts` lands, please call `setCoverSource((x, z) => ...)` (or tell me and I will) with: bedrock → density 0 except pockets, peat → sedge + Labrador tea, sand → hairgrass/oatgrass + blueberry, clay/till → bluejoint. `defaultCover(x, z, site)` stays the fallback.
- Not done / risks: blades poke through small rocks and logs (no exclusion yet); no snow burial; GTAO/depth passes don't see blades (override material); shrub sprigs read as leaves only up close.

## 2026-10-18 03:45 PT - Grok Bot: globe perf pass (workers, horizon culling, coastlines, seams)
- **Request to the main.ts owner (Claude or whoever holds main.ts):** when convenient, please add a way into the globe from the game: a pause-menu button and/or a G key that does `location.search = '?view=globe'` (the globe's G/Esc already comes back). The `index.html` → `src/world/globe/entry.ts` switch stays as it is. I have not touched main.ts.
- **Workers:** tiles build in `src/world/globe/tileWorker.ts` (Vite `new Worker(new URL(...), { type: 'module' })`, pool of hardwareConcurrency − 2, capped at 4). The worker imports `planet.ts` + `core/world heightAt` + `STAGES`. That import graph (world, stages/elevation, flow, rivers, soils, surface, animalBehavior, catalog, tuning, proc/*) uses no DOM or localStorage, so worker tiles match the main thread's bit for bit. `?workers=0` or a worker error falls back to sliced core/interest jobs. `tile.ts buildTile` is now pure (no three, no DOM) and is the ONE builder for both paths.
- **Horizon culling:** a node is not split, built or drawn when its whole angular extent lies past the camera's horizon plus the horizon of the highest relief (1.6 × maxLand). Drawn tiles: orbit 96 → 51, 300 m 537 → 353.
- **Coastlines:** each vertex carries `aH = h − level`, where level is sea level or the game's water plane at home. `globeMaterial` contours it per pixel (fwidth antialiased) and shades water shallow → deep by depth, so there are no more vertex stair steps. Land colour is per vertex as before.
- **Seams:** normals come from central differences over one extra ring of samples past the tile edge, so neighbours at the same level share identical edge normals (tested). The skirts hide cracks between levels.
- **Measured (omen, RTX 5060 Laptop, headless Edge, Ultra, `?bench=zoom` = 20 s log zoom from 14 000 km to 300 m + 8 s hold):** BEFORE (main-thread jobs): per tile avg 5.2–6.2 ms, p95 21–25 ms; worst main-thread frame 7.3–36.4 ms, worst rAF interval 17.5–37.9 ms. AFTER (4 workers): per tile avg 6.3–9.3 ms, p95 26–32 ms (in the worker); main-thread frame avg 0.7–0.9 ms, p99 1.3–1.9 ms, worst 1.7–3.4 ms in 3 of 4 runs and one 44 ms outlier (cold run straight after a code reload); worst rAF interval 18.1 ms in the clean runs.
- Home-region tiles (heightAt per vertex) are the slow tail (p95). Not changed: the game terrain look at 300 m (sampled as is).

## 2026-10-18 04:00 PT - Grok Bot: staged relief calibrated to real Kenora data + world stage 3 soils (behind ?stages=1)
- References (tuning only, NOT in the game; scripts in tools/terrain-ref, data stays on the box): Copernicus GLO-30 DEM
  (© DLR/Airbus, Copernicus licence), ESA WorldCover 2021 (CC BY 4.0), Sentinel-2 L2A 2024-07-30 (Copernicus, free),
  Wikimedia Commons photos (Archives of Ontario OGL-ON; Q. Soloviev CC BY 4.0; A. Carrotflower CC BY-SA 4.0; R. Sylvia CC BY-SA 3.0),
  Hallett & Roed 1980 NOEGTS 36 (Kenora terrain units). 15 x 15 km window east of Kenora (49.735 N, 94.38 W).
- Measured (real -> game seed 1400): land above lake p50 36.5 -> 34.3 m, p99 86 -> 66 m (real is a DSM, ~15 m canopy);
  1 km local relief 41 -> 40.5 m; gradient direction 42 -> 39 deg (NE-SW glacial grain), coherence .25 -> .29; autocorrelation
  930 -> 1080 m; spectral slope -3.1 -> -4.0 (game too smooth); water 29 -> 31 %; lake median 7 -> 23 ha (too few small lakes).
- core/stages/elevation.ts: relief in real metres (ELEV.reliefM 60, base water at the waterPct percentile), NE-SW grain on the
  two lowest octaves (rotated lattice, integer stretch keeps the torus seamless), persistence .5. FIX: the value-noise lattice used
  raw FNV-1a/2^32 (poorly mixed last chars -> E-W striping, coherence .8); now mulberry32-avalanched. All staged worlds changed.
  lakeAt now reads the 4 grid NODES and the bilinear shoreline (fixes the half-cell outline offset); flow.ts cellAt rounds to nodes.
  Lakes need >= 1 m fill depth (shallower fills become peat).
- core/stages/soils.ts (new): HAND + flow distance (Renno 2008 / Nobre 2011, implemented from the papers; pysheds is GPL),
  Gharari 2011 landscape classes (slope .129, HAND 5.9 m), mapped to NOEGTS 36 units: hillslope + highest plateaus -> bedrock
  (calibrated to the 11 % WorldCover outcrop share), plateaus -> thin till (8 % seeded outwash sand), flat wetland -> peat
  (TWI >= 9 or filled pit) or glaciolacustrine clay (< 12 m above base water). Seed 1400: bedrock 11.4, till 67.6, sand 4,
  clay 7.1, peat 9.9 % of land. ~0.4 s once per seed (includes stages 1-2c).
- Wired (staged mode only): core/ground (wetness, depth to bedrock per class, a peat layer, Ae label), render/trees (tree mix
  wetness from soilAt), core/world terrainBand(y, x, z) -> material + inspector 'soil' rows, render/math BAND_COLOR per material
  (bedrock = Sentinel-2 mean over WorldCover bare, #928575).
- HOOK for the grass owner (render/grass/cover.ts, not edited by me): in staged mode `rock` comes from `LEVEL.upland` (3.3 m), but
  staged relief is now ~60 m, so nearly all ground reads as rock. Suggest `const so = soilAt(STAGES.seed, x, z); rock = so.kind === 'bedrock' ? 1 : 0; wet = so.wet`.
  Also the TWI bilinear uses `x / cell - .5` (cell centres); grid values sit on nodes (i*cell), so drop the -.5.
- Bench (headless Edge, RTX 5060 laptop, ?stages=1&bench=1): Ultra gpu 7.8 ms, cpu 10.2 ms, frame 16.7 ms (vsync 60), p95 19.3 ms.

## 2026-10-18 04:10 PT - Grok Bot (Gait Builder): FORK of a Claude-owned rig + ?loco=1 game flag - merge note for Claude
Matthew asked for this while Claude is rate-limited. **No Claude original was edited or committed.**
- **Forked (1 file):** `src/render/playerWolf.ts` @ `56506c55a2ebf881f3454265da00a618399e2996` → `src/animals/locomotion/fork/playerRig.ts` (header: "FORK of Claude-owned file - do not edit the original; fold back via AGENT-NOTES.md"). skeleton.ts, species.ts, animalBehavior.ts, wolfBody.ts and body.ts did NOT need changes, so they are imported from the originals (no fork, no drift).
- **What the fork changes (hooks 1 + 2):**
  1. `createPlayerWolf()` also returns `loco = { root, tilt, torso, scale, legs: WOLF_LEGS, chains: [{ girdle, upper, lower, foot, paw, hipXZ }] }` (LF, LH, RF, RH; `hipXZ` = `LEG_XZ × WOLF_SCALE`).
  2. `animate(time, moving, action, elapsed, mode, push, legPose?)`: when `legPose` is given, legs (incl. sideways swing), body pitch/roll and height come from it, the stealth y-squash and push-leg pose are skipped, and the torso bob is zeroed. **Without `legPose` every bone's world matrix is identical to the original** (tested: `tests/locomotion-rig.test.ts`, 1e-12).
  3. Structure: torso and leg chains now hang from a `tilt` group under `root` (identity unless legPose), and the girdle bones use Euler order `'ZXY'` (sideways swing outside the pitch; no effect while z = 0).
- **Paw fix (why the M1 overlay drifted):** the IK swung the leg sideways about the shoulder joint but the bone pivots at the girdle top; the girdle Euler order applied z inside x; joint springs lagged; and planted feet left behind at start-up were out of reach. Now: abduction pivots at `L.hip + girdle`, order 'ZXY', a reach leash lifts any planted foot the limb cannot reach (0.1 mm), and the real rig's paw bones land on the layer's feet to < 1e-6 m whenever reachable (test, hills + turning, ×2 scale, tilt).
- **Exact diff:** `src/animals/locomotion/fork/MERGE.patch` (unified diff of `src/render/playerWolf.ts` → original + hooks, with the original's import paths; `git apply --check` passes on the current tree). To see fork vs original yourself: `git diff --no-index src/render/playerWolf.ts src/animals/locomotion/fork/playerRig.ts`.
- **Fold-back steps (Claude):**
  1. `git log -1 --format=%H -- src/render/playerWolf.ts`; if it is still `56506c5…`, run `git apply src/animals/locomotion/fork/MERGE.patch` (if line endings complain: `git apply --ignore-whitespace …`). If you changed playerWolf.ts since, re-apply the 6 hunks by hand (they are small and commented "locomotion hook").
  2. In `src/animals/locomotion/game.ts` and `src/animals/locomotion/lab.ts`, change `./fork/playerRig` imports to `../../render/playerWolf`.
  3. Delete `src/animals/locomotion/fork/` (playerRig.ts + MERGE.patch) and, in `tests/locomotion-rig.test.ts`, import `forked` from `../src/render/playerWolf` (the "no-op when absent" test then compares the file with itself; keep or drop it).
  4. `npx tsc --noEmit && npm test`, then add a dated note here.
- **Game flag `?loco=1`:** `render/playables.ts` (Grok Bot's file; 1 import + `if (LOCO_FLAG) return createLocoPlayer();` in the wolf `create()`). `src/animals/locomotion/game.ts` reads root position/heading that buildScene.draw already set, runs the layer on `max(heightAt, −0.2)` (the same ground buildScene uses), and calls the fork's `animate(..., legPose)`. Without the flag the original `createPlayerWolf` path runs unchanged. main.ts and buildScene.ts were not touched.

## 2026-10-18 — Gait Builder (Grok Bot): locomotion M2 (snap, jump/pounce, gallop bounce, LOD radius)
- Files (all ours): `src/animals/locomotion/{jump.ts (new), controller.ts, index.ts, game.ts, lab.ts}`, `tests/locomotion-jump.test.ts` (new), `tests/locomotion-rig.test.ts`. No Claude / Globe / rivers file touched; fork unchanged.
- Planted legs now snap to the solved IK every frame (paw exact on its marker, test with springs ON); only swing legs are spring-smoothed, half-life capped at `SWING_SPRING_SHARE` (10 %) of the swing so gallop paws don't trail.
- Jump/pounce: `intent: {kind:'jump'|'pounce'}` starts crouch → flight → land, total `PHYS.jumpSeconds`; flight height is the ballistic arc from `gravity()` (apex g·Ta²/8 = `apexHeight()`), all feet unplant in flight, fore feet reach ahead and touch down first (pounce), feet re-plant on landing. In-game (`?loco=1`) the brain's `motion === 'jump'` edge sends a pounce intent; the body path is still the brain's (main.ts) jump.
- Gallop body bounce = Claude's `gallopBob` on the LH phase (no new curve).
- **LADDER column wanted (Claude, quality.ts):** `LOCO_LOD.nearRadius = 30` m lives in `controller.ts` (`lodAt(d)`) only as a stand-in; it should become a `loco` column in the quality LADDER (suggest Ultra 40 … Minimum 6) and `lodAt` should read it. Not added to quality.ts on purpose (Claude's file).
- Lab: `?pounce=1` (pounce at t=1 s then every 3 s; P key/button any time), `?pause=1` freezes after `?t=` (mid-flight shot: `?rig=real&pounce=1&t=1.43&pause=1`).

## 2026-10-18 — Gait Builder (Grok Bot): walk posture from a reference photo + lab debug layers
- Walk posture tuned to Matthew's side-view grey-wolf photo: new `src/animals/locomotion/posture.ts` (`POSTURE`, `carryWeight(speed)`): head carried low and forward (pitch + drop), tail hanging low, fore swing lift ×1.6 with an extra carpus fold (flick-back), hind rest point moved forward under the belly, near single-track footfalls (track ×0.35). The carry fades in from standing and out by a fast trot. The wrist flick folds only as far as the joint limits and reach allow (bisection), so contacts stay exact; the leash tolerance is now 1e-6 m.
- Fork/merge-note update: hook 2 now also reads an optional `legPose.carry {head, drop, tail}` (head pitch/drop and extra tail hang at a walk; ignored during speak/gather/push). `src/animals/locomotion/fork/MERGE.patch` is regenerated against the same base (playerWolf.ts @ 56506c55), `git apply --check` clean; the fold-back steps above are unchanged.
- Lab layers (plain DOM checkboxes, no new deps): body, legs (stick legs, or a leg-bone overlay for the real rig when the fur is hidden), foot markers, IK targets (limb top → sole target), raw (springs off, to compare with the spring-smoothed pose). URL: `?hide=body,legs,feet,ik`, `?show=ik`, `?raw=1`, `?cam=profile` (eye-level side view for photo comparison), `?ui=0`.
- Suggestion for Claude (no change made to Claude's files): for future deer/moose/bear rigs, keep one build function per stage (torso, head/neck, legs, tail) in each rig, so locomotion hooks and the lab's layer toggles can address each part without forking the whole rig.

## 2026-10-18 04:15 PT - Grok Bot: globe perf pass 2 (draw cap, worker warm-up, exact lattice)
- Step 1 (5bc57c8): frustum-aware LOD (nodes outside the view stop splitting) + per-tier cap on tiles in view (lod.ts `draw`: Ultra 160 ... Minimum 50; lower split on low tiers for Quest). The split shrinks while over the cap (HUD shows `split xN`). At 300 m: draw calls 103 -> 70-77, triangles 554k -> 376-414k, tiles drawn 353 -> ~200.
- Step 2 (46bfd52): every tile worker warms its planet + staged grids at startup, in parallel. Stale requests: the queue is pruned every frame and each worker holds at most 1 in-flight tile, so a stale build wastes at most 1 tile per worker. Workers build synchronously, so a mid-build cancel would need sliced builds (not done). `?bench=zoom` logs SPIKE lines for frames over 40 ms.
- Step 3 (634d047): exact dyadic vertex lattice, so shared parent/child/neighbour vertices are bit-identical (test). A per-thread heightAt memo got a 31% hit rate but no net win, so it isn't shipped. The real per-vertex cost is in core/world heightAt (not my file).
- Step 4 (LOD/face-edge shading smoothing): not done. Same-level edges already share normals.
- Request (main.ts owner, unchanged): a menu / G-key entry into `?view=globe`.
- Bench numbers on omen are noisy because other workers share the CPU. Runs of the same build vary 3-8x.

## 2026-10-18 — Gait Builder (Grok Bot): mesh/material fork + posture round 2 (fold-back note for Claude)
At Matthew's request (Claude rate-limited) we edited a COPY of the wolf mesh, used only under `?loco=1` and in the locomotion lab; the default game still builds the original `src/render/playerWolf.ts` + `src/core/wolfBody.ts`, unchanged.
- **Forked:** `src/core/wolfBody.ts` @ `56506c55a2ebf881f3454265da00a618399e2996` → `src/animals/locomotion/fork/bodyTubes.ts` (only `wolfTubes` + the private jaw outlines it needs; everything else imported from the original), plus `shapeBody(body)` (new). `fork/playerRig.ts` (fork of playerWolf.ts, same base) now builds its skin from it.
- **What we changed in the fork (visual notes from Matthew → done here):**
  1. Topline flatter, high point over the shoulders: trunk ring heights/radii retuned, belly line unchanged.
  2. Thicker neck base blending into the chest (neck rings wider/deeper).
  3. Shoulder and hip "spheres" sunk into the trunk: the front leg's top two rings lowered 1–2.5 cm (model) and weighted mostly to the torso; the hind top ring lowered from hip+6 cm to hip+3.5 cm.
  4. Thicker lower legs (forearm, carpus, cannon, hock rings ~+20 %).
  5. Paws: boxier section (sq 3) and, in `shapeBody`, flat soles plus three toe grooves on each paw (dents; no new vertices).
  6. Eyes: dark amber `0x7a4a10`, iris edge `0x3a2206`, no emissive.
  7. Blockier snout tip (last two skull rings wider, sq 3.6–3.8; the upper-jaw outline's tip entry follows so lips/teeth still fit).
  8. Fur: legs ×0.7 below the elbow/stifle, belly ×0.6, back/neck/ruff ×1.15 (furLen only; same card count, so no perf-governor change).
- **Pose side (ours, `posture.ts`):** head pitch sign fixed (three.js +x is nose-up; now −0.12 so the snout is about level), head drop 0.3, body pitch +0.04 rad front-up and body lowered 5 % of hip height at a walk, stance fore pastern slant +0.22 rad (visible wrist bend) and hind hock +0.12 rad. Planted contacts stay exact (tests). Limit: the trunk is one torso bone, so the spine itself cannot bend; topline shape is mesh-only.
- **Fold back:** `git apply src/animals/locomotion/fork/MERGE.patch` (now covers BOTH `src/render/playerWolf.ts` and `src/core/wolfBody.ts`; checked to apply cleanly to 56506c55), re-run `tests/body.test.ts` (published-range checks; they currently run against the original only, so check them after folding), then delete `src/animals/locomotion/fork/` and point `src/animals/locomotion/game.ts` / `lab.ts` at `../../render/playerWolf`. Folding back changes the default wolf's look too, which is Claude's call.

## 2026-10-18 Grok Bot (terrain/rivers/soils): glacial scour, bedrock speckle, exposure fix, surfaceAt for Globe Builder
- **Terrain (core/stages/elevation.ts):** after erosion, a glacial scour field is added: a periodic value-noise lattice at 240-960 m, stretched NE-SW (ice flow), 20 m amplitude, then renormalised. ELEV now uses persistence .7, droplets 30000, basins .75. Measured at seed 1400 vs the Kenora reference: spectral slope -3.41 vs -3.14; lakes median 6.3 ha vs 7.2; islands 54 vs 42 per 100 km2; elongation 2.12 vs 2.22; water 27% vs 29%. Lake count is too high: 75 vs 17.6 per 100 km2.
- **Soils (core/stages/soils.ts):** bedrock = top 11.4% of land by a TPI score (Weiss 2001; 7x7 window, plus HAND and slope terms), so outcrops are speckled knobs: median 0.27 ha vs 0.18 in the reference. Hillslope landscape now maps to till. SOIL gains tpiRadius/handW/slopeW.
- **Washed-out renders (it was NOT headless-specific):**
  - (1) ui/menu.ts: under ?nomenu/?bench the #start-menu gradient sat over the view because show() never ran. The menu now starts with class `fade`.
  - (2) render/sky.ts: fog near/far are offset by camera height above the focus, so top-down/photo views aren't fogged white. No change at eye height.
  - (3) core/light.ts `EXPOSURE.base = .5` (three's Sky+ACES example value), used by render/post.ts.
  - (4) core/light.ts `AMBIENT = { env: .3, probe: .2, hemiIbl: .11 }`, used by render/photoreal.ts. Sky diffuse is ~15% of global on a clear day; the unscaled PMREM sky plus the GI probe (.6) made ambient rival the sun. Ground at 11:00 on Ultra went from sRGB 180,207,182 to 116,148,114.
- **For Globe Builder: `surfaceAt(x, z, seed = STAGES.seed)` in `src/core/stages/surfaceAt.ts`**
  - Returns `{ height, lake: {surface, areaHa, kind:'pond'|'lake'|'open'} | null, river: {surface, order, widthM} | null, soil: SoilKind ('water' when covered), wetness 0..1 }`.
  - DOM-free and worker-safe: imports only core/stages, core/surface, core/tuning and proc. A test guards against three/window/document.
  - Height equals core/world heightAt on the staged path, without needing STAGES.on.
  - Cost: the first call per seed per worker builds the grids (~0.5-1 s); after that ~<50 us per point (tested).
  - surfaceData.ts can call it once per point instead of lakeAt + soilAt separately. That file is yours, so I didn't touch it.
## 2026-10-18 05:00 PT - Grok Bot: globe staged terrain, surface data, camera-relative rendering, origin bus, handoff, atmosphere
- Terrain: the globe follows the game's `world.stagedTerrain` setting (plus `?stages=1`) and defaults to the game's default, currently OFF. Staged home relief measured over the 7.7 km region: -44.7 to 60.8 m (p1 -32.5, p50 15.7, p99 49.6). Layered relief is only -4.8 to 4.8 m.
- `src/world/globe/surfaceData.ts`: `surfaceDataAt(x, z)` returns { lake, soil, wetness, forest, tree, season, snow, placeholder }. lake/soil/wetness come from `lakeAt`/`soilAt` (pure and worker-safe today). forest/tree/season/snow are flagged placeholders.
- Camera-relative rendering (`origin.ts`): tile centres are doubles on the CPU, float32 offsets are computed from the camera each frame, and the camera renders from (0,0,0). Tests check the error stays under 1 mm at 300 m and at 2 m, and that plain float32 world coordinates would be off by more than 10 mm.
- Sim floating origin (`src/world/globe/originBus.ts`): `ORIGIN.onOriginShift(fn)` returns an unsubscribe function. Call `ORIGIN.request(focus)` then `ORIGIN.flush()` once per tick, after the sim step and before render. The threshold is 2 km and shifts snap to whole metres. `ORIGIN.toAbsolute(p)` converts back. A test shows a shift is velocity-neutral for a Verlet body. Nothing calls it yet; see the requests below.
- Handoff (`handoff.ts`): below 2 km over the home region (not while climbing), the globe fades and reloads into the game at the same spot through the game's existing `?at=x,z`. G does the same from anywhere over home. `?handoff=0` turns it off; `?handoff=demo&alt=4000` descends by itself.
- Atmosphere (`atmosphere.ts`): single-scattering Rayleigh + Mie ray march (Nishita/O'Neil formulation, as in wwwtyro/glsl-atmosphere, Unlicense). It draws a sky shell and adds aerial perspective in the tile material, with the planet's shadow and sunset-reddened sunlight. Everything is computed from parameters, with no LUT images. The sun comes from `core/worldClock` + `timeOfDay` (`gameHour(worldSec(), ?hour=)`, the same as the game). Dev flags: `?atmos=0`, `?dome=0`, `?look=<azimuth>`.

### Requests (one per owner; nothing of yours was edited)
- **main.ts owner**: (1) A menu entry or G key into `?view=globe&at=<player x>,<player z>&alt=2500` (add `&stages=1` when staged); the globe then starts above the player. (2) The globe can send a heading as `?at=x,z,yaw` once you confirm the yaw convention (0 = facing -z; which sign?). (3) Call `ORIGIN.request([player.x, player.y, player.z]); ORIGIN.flush();` once per frame, after the sim step and before render (`import { ORIGIN } from './world/globe/originBus'`).
- **physics owner (`src/proc/physics.ts`)**: `ORIGIN.onOriginShift(o => { for each body: pos -= o; prev -= o; })`. Translate the previous positions as well, or clear interpolation history, so velocity never spikes.
- **particles / weather FX owner**: `ORIGIN.onOriginShift(o => ...)`: subtract `o` from live particle positions (the CPU buffers, or a uniform offset for GPU particles).
- **animal AI owner (Claude: perception, memory, targets)**: subtract `o` from remembered positions, waypoints, targets and home ranges.
- **trails / footprints / ground decals owner**: subtract `o` from stored decal positions.
- **audio owner (`src/audio`)**: subtract `o` from positional source positions (PannerNode or Object3D audio).
- **rivers/soils owner**: please keep `lakeAt` and `soilAt` DOM-free so the globe workers can call them (they are pure today). An exported lake-depth helper would also help: `lakeAt` returns `surface`, and the globe currently subtracts `heightAt` itself.
- **flora owner (`src/core/flora`)**: a pure, worker-safe `forestAt(seed, x, z)` returning { density 0..1, dominant: 'spruce' | 'pine' | 'birch' | 'aspen' | ... } for the globe's look from far away. If `core/flora/site` `siteAt` is meant for this, please say so and I'll wire it.
- **world clock owner**: a pure `seasonAt(worldSec)` returning { dayOfYear, snow 0..1 } (today `DAY_OF_YEAR` is a constant), so the globe and the game share season and snow.
- **package.json owner / Matthew (optional)**: `@takram/three-atmosphere` (Bruneton, MIT) was checked. React is optional and its LUTs can be generated at runtime, but it needs `postprocessing` (a required peer) plus `@takram/three-geospatial`, `astronomy-engine` and `react-merge-refs`. It was not adopted, so package.json is untouched. Say if you want it instead of the in-house shader.

## 2026-10-18 05:20 PT - Grok Bot: grass on stage-3 soils + shared procedural ground flora (flowers, shrubs)
- Commits: 171fb4a (grass on soils + core/flora/site), 09c88ae (vendor plant-generator baseline), d579c2b (flora).
- core/flora/site.ts (shared by grass + flora): staged `siteAt` reads stage-3 soils (`soilAt`): wetness, bedrock share (bedrock
  = .85 so RN 'thin patchy drift' keeps soil pockets) and depth to bedrock are bilinear between the 4 soil-grid NODES (fixes the
  old cell-centre half-cell TWI offset), material = nearest node. Unstaged: old height proxies. Light = 1 - tree crown cover
  (`setCanopySource`, registered by render/flora from generateChunk spruce entities + treeDims crown width).
  Seed 1400 staged: 9 % of land bare (bedrock is 11.4 %); before, ~all staged ground read as rock (LEVEL.upland vs 60 m relief).
  Niche suitability: Gaussian responses on wetness + light (Whittaker 1967; Austin 1985) x rock/soil affinity x slope cut.
  Clustering: Thomas process (Thomas 1949, Biometrika 36:18; Wiegand & Moloney 2014 ch. 4) written from the paper
  (spatstat rThomas is GPL: definition only); offspring thinned by suitability where they land.
- core/flora/plants.ts: 13 Kenora-area species, FNA / Baldwin & Sims cited sizes [verify]: fireweed, twinflower, bunchberry, prickly
  rose, wood lily, bluebead lily, wild strawberry, pearly everlasting; lowbush blueberry, Labrador tea, speckled alder, Bebb willow,
  common juniper: petals, leaf arrangement, inflorescence, colours, bloom window (day of year), niche, cluster params.
- render/flora/plant.ts: one generator petals -> flower -> inflorescence -> stems/leaves/branches, tailored from mateusdcc/
  plant-generator (MIT, @89fe3b6; vendor/plant-generator): createBlade/createPetal profiles, Vogel 1979 golden-angle phyllotaxis,
  raceme/umbel/cyme/corymb. 2 LODs x 4 seeded variants per species.
- render/flora/flora.ts: 20 m interest-job tiles, a BatchedMesh per tile and shadow class (as render/batch); per-plant distance
  culling + LOD (small plants first); radius min(near, 45 m x sqrt(LADDER foliage)); only shrubs > 1.5 m cast shadows; shared
  wind/phenology (render/trees WIND_UNIFORMS); flowers collapse outside their bloom window (WEATHER.day). `?patch=1` = showcase
  (all in bloom, cluster intensity x15 vs game x6). Dev handle globalThis.borealFlora {info, fx: {off, bloomAll, density, view}, densest()}.
- Bench (omen RTX 5060 laptop, headless Edge D3D11, Ultra forced, quiet Vite on a HEAD snapshot, median of 5 on/off pairs, GPU ms):
  staged default: flora 266-291 plants visible, +0.45 ms (noise ~±1 ms); grass ~100k blades drawn, within noise (earlier clean
  bench +0.6 ms). ?patch=1: 660-800 plants visible, flora +2.8 ms. Tile build ~5 ms per 20 m tile (CPU, sliced per species).
- References (tuning only, NOT shipped; box /workspace/tmp/flora-refs + SOURCES.json): Wikimedia Commons, CC BY / CC BY-SA 2.0-4.0
  and public domain. Comparison sheet: box /workspace/tmp/boreal-patch-compare.png.
- No hook needed from the soils owner now (site.ts imports soilAt directly); if soils gain a moisture/depth field, siteAt is the one place.

## 2026-10-18 — Gait Builder (Grok Bot): fur + mesh rework, round 2 (fold-back note update)
Still fork-only (`src/animals/locomotion/fork/`, used under `?loco=1` and in the lab); Claude's originals untouched. `fork/MERGE.patch` regenerated (both `src/render/playerWolf.ts` and `src/core/wolfBody.ts` @ 56506c55; applies cleanly).
- **Fur, reusing the repo's own hair-card system** (`render/furCards.ts`, not forked: everything goes through the options it already exposes, `scaleAt`/`comb`/`tipTint`/`tone`): `furStyle()` in `fork/bodyTubes.ts` adds a 3D value-noise length/density map (lattice seeded via proc/rng; clumps about 2 cm), longer strand cards in the silhouette zones (neck ruff ×1.3, tail ×1.2), legs short and combed flat downward, neck/back/tail combed backward with a back curve, and agouti (banded guard-hair) tips on the back. Same 13 000 cards.
- **Coat zoning** (`PHOTO_COAT` + `zoneCoat` in `shapeBody`, vertex colours that the cards copy): brown-grey agouti base sampled from Matthew's photo, darker saddle from behind the shoulders to the croup, cream belly, chest and throat, buff legs below the body, darker top of the tail. Replaces the seeded `wolfCoat` in the fork only.
- **Mesh:** tapered leg profiles (thick forearm and thigh, slim pastern and cannon, hock narrow side-to-side but deep fore-aft so it reads as a point), smaller and less blobby paws (about 20 % smaller) with finer toe grooves, ears set back (shifted about 1 cm back and leaned back from the base, inner tufts moved with them, after the sculpt so the cup shading still lines up), blockier muzzle (superellipse exponent up on the mid-muzzle rings).
- **Sources adopted:** the repo's own hair cards and seeded surface sampler (Claude); texture-driven fur length/density maps after Lengyel, Praun, Finkelstein and Hoppe, "Real-Time Fur over Arbitrary Surfaces" (I3D 2001), and GPU Gems 2 ch. 23 (Nalu demo hair); banded agouti guard-hair tips from wolf pelage descriptions (Mech & Boitani, *Wolves*, 2003). **Considered, not adopted:** shell fur (Lengyel 2001 shells; three.js fur-shell examples). N shells multiply the skin draw calls and buffers, which the graphics-memory pressure rules out. Kajiya–Kay (1989) anisotropic strand highlights: these need a per-card tangent attribute (+12 B per vertex, about 0.8 MB) and a fork of the fur material; deferred.
- **Budget (lab `?stats=1`, headless; renderer.info + buffer bytes):** original rig: 3 544 skin vertices, 12 975 fur cards, 49 015 wolf triangles, 43 meshes, 5 004 KB of wolf vertex/index buffers, 3 textures. Fork: 3 544, 12 976, 49 018, 43, 5 005 KB, 3 textures. Same budget (+1 card, +1 KB from the sampler's filtering); no new geometry types, materials or textures.
- **Fold back:** as in the note above (git apply MERGE.patch, re-run tests/body.test.ts and the visual check, delete fork/). Folding replaces the seeded `wolfCoat` variety with `PHOTO_COAT` in the player wolf. Claude may prefer to keep `wolfCoat` and apply only the zoning.

## 2026-10-18 — Gait Builder (Grok Bot): fur + mesh rework, round 3 (fold-back note update)
Still fork-only (`src/animals/locomotion/fork/`, used under `?loco=1` and in the lab); Claude's originals untouched. `fork/MERGE.patch` regenerated against both originals @ 56506c55 (checked with `git apply --check`).
- **Seeded coat variety restored:** `photoVariant(wolfCoat(seed))` in `fork/bodyTubes.ts`. The photo coat is the base, and Claude's seeded `wolfCoat` (archetype + jitter) pulls each colour 35 % of the way toward the seeded one. `zoneCoat` now derives its zones from that coat (saddle = dark→back 40 %, leg buff = belly→accent 20 %, cream = belly, paws = dark→back 35 %), so every seed keeps the photo's zoning in its own colours. Lab: `?seed=<n>`. This replaces round 2's "PHOTO_COAT instead of wolfCoat" caveat: folding keeps Claude's variety.
- **Head:** ears 32 % shorter along the ear, broader (×1.2 at the base, up to about ×1.55 two-thirds up) with a rounded tip, still set back and leaned. This is done in each ear's own frame after the sculpt, so the cup and tufts follow. Heavier muzzle: mid and front muzzle rings about 10 % wider and 12 % taller, and the jaw rings about 20 % deeper (the lip/teeth outlines follow). Heavier brow: an extra supraorbital push.
- **Legs and paws:** leg fur is no longer shortened (×0.9–1.0 instead of ×0.7) and no longer scaled down (scaleAt 1.0, was 0.8). It is combed flat down with full lean, so the cards cover the leg outline. Paws are darkened toward the coat's dark tone, with shorter paw fur (×0.6) so the deeper toe grooves (2.4 mm) show; the grooves are darkened further.
- **Budget (lab `?stats=1`, seed 1400):** original rig 3 544 skin vertices, 12 975 fur cards, 49 015 triangles, 43 meshes, 5 004 KB; fork identical (3 544 / 12 975 / 49 015 / 43 / 5 004 KB, 3 textures). Other seeds vary by under ±5 cards (the sampler follows the coat).
- **Fold back:** `git apply src/animals/locomotion/fork/MERGE.patch`, re-run tests/body.test.ts and the visual check, delete `fork/`.

## 2026-10-18 05:40 PT - Grok Bot (Globe Builder): suite status + file ownership
- The 3 test failures the lead bot saw on omen (globe "water vertices sit on the sea surface", the camera-relative vertex error test, and the globe parent/child lattice test) were caused by MY uncommitted tile.ts WIP: averaging the odd edge vertices to hide coarse/fine cracks. That moved those vertices off the true surface. The approach is also wrong in principle: a coarse neighbour's own odd edge vertices get averaged too, so cracks come back. It's stashed (`git stash list`: "grok-globe tile edge-averaging WIP"; patch copy in %TEMP%\globe-tile-wip.patch), and HEAD tile.ts is unchanged. The replacement will morph odd edge vertices only on edges that face a coarser drawn tile.
- `src/render/math.ts` is NOT mine (staged ground albedo from Sentinel-2, terrain/soils worker). The globe tests don't import it, so it doesn't affect my camera-relative test. I haven't touched it.
- `src/core/interest.ts` in the working tree currently fails to parse ("Unexpected end of file" at line 61). That's another worker's WIP, not mine. Every test that imports it fails until it's finished. I verified my globe commits in a clean worktree of HEAD (tsc, npm test, vite build all green).

## 2026-10-18 — Gait Builder (Grok Bot): paw-touchdown events + rig shadow/draw-call trim + coat contrast (round 4)
- **Paw-touchdown events (for footstep audio, dust, prints).** Every `LegPose` now carries `touchdowns: Touchdown[]` for that frame (usually empty), and each controller has `loco.onTouchdown(fn) → unsubscribe`. For the player under `?loco=1`, use `onPlayerTouchdown(fn) → unsubscribe` from `src/animals/locomotion/game.ts`; it keeps working when the controller restarts after a teleport. Event shape (`signals.ts`):
  `{ leg: 0..3, name: 'LF'|'LH'|'RF'|'RH', worldPos: {x,y,z} (sole, world metres), speed: m/s, gait: GaitId, strength: 0..1, landing: boolean }`.
  It fires on each contact rising edge: exactly one per leg per stance, none on the first frame or while standing still, and one per paw (`landing: true`, `strength: 1`) when a jump or pounce lands. Strength is `min(1, 0.3 + 0.35·√Froude)`, which rises with speed. Suggested audio use: pick the clip from the ground under `worldPos`, gain ∝ strength, and cull by distance. Tested in `tests/locomotion-touchdown.test.ts`: once per stance per leg in all 7 gaits, stance count equal to CPG cycles ±1, the listener sees the same events as the pose list, and a pounce gives 4 landing events.
- **Draw-call trim, fork only** (`fork/playerRig.ts`, folded into `MERGE.patch`): the teeth are baked into one mesh per bone (upper arch on the cranium, lower arch on the jaw) with `BufferGeometryUtils.mergeGeometries`, using the same cones and placements. Any rig mesh other than skin and fur whose world bounding radius is under `SHADOW_MIN_RADIUS` (3 cm, below a cascade texel) gets `castShadow = false` and `userData.shadowSet = true`, so `render/photoreal.ts` keeps it out of every shadow cascade. That covers the eyes, nose pad, nostrils and teeth. The lab now reports `wolfShadowCasters`, `mainPassCalls` and `shadowPassCalls` under `?stats=1`. See the numbers below.
- **Coat contrast (flat budget):** the agouti tip tint on the back is now a dark band instead of a pale tip, which removes the wash. `PHOTO_COAT` is warmer, and the saddle is darker and stronger (dark→back 30 %, weight 0.82). Seeded variety via `photoVariant` is unchanged.
- **Fold back:** `git apply src/animals/locomotion/fork/MERGE.patch` (base 56506c55), re-run tests/body.test.ts and the visual check, then delete `fork/`. The touchdown API lives in our own files and needs no fold.
- **Measured (lab `?stats=1`, one sun shadow map, walk frame t = 3.3 s; three resets `renderer.info` after the shadow pass, so the lab now counts both passes by hand):** Claude's original rig: 43 wolf meshes, 43 shadow casters, 67 main-pass + 24 shadow-pass draw calls (91 total). Fork: 17 wolf meshes (the teeth are 2 meshes instead of 28), 2 shadow casters (skin and fur), 19 main-pass + 2 shadow-pass calls (21 total). With the game's 2 cascades that means at most 4 shadow calls for the player wolf instead of up to 86. Vertex, triangle and fur-card counts and buffer memory are unchanged (49 015 triangles, 12 975 cards, 5 004 KB). The merged teeth are flagged `userData.tiny`, so they stay out of the shadow passes too.

## 2026-10-18 06:20 PT - Grok Bot (perf executor): jank fixes in shared code (681c7dd), footsteps from touchdowns (aedca49)
- Bench (omen, headless Edge D3D11, hold W+Shift 20 s, governor Auto, `?nomenu&stages=1`, worktree on the commit): draw calls/triangles counted by hooking every WebGL draw (both shadow and main passes). Before d8f159d: frames >33 ms 103, >100 ms 13, worst 5,567 ms, p99 100 ms, tiers `34444455554444444444`, probe capped Low at start. After 681c7dd: 51, 1, worst 167 ms, p99 33.5 ms, tiers `22222233333333333333`, probe High.
- Root cause of the multi-second freezes: governor tier bouncing. Each IBL/shadow/PCSS change alters shader defines, so every program recompiles (three's needsUpdate → getAttributes blocked on links: 44 % of CPU in the profile).
- core/quality: 10 s cooldown after any step, 30 s up-hold after a drop, window median (stalls no longer drop tiers). `WORLD_KNOBS` (shadows, pcss, ibl, lod, near, mid, trees, foliage, weather) follow `tier` only after it has held 20 s (`GOVERNOR.worldTier`); manual mode and resets apply at once. Cheap knobs (resScale, ssao, gi, contact, rays, clouds) move at once.
- core/interest runJobs: a finished generator's `done` is now its own budgeted step (next frame if it won't fit). After the first step of a frame, a step only starts if its kind's estimated cost fits. `STATS.kinds[kind]` = {slices, maxSlice, dones, maxDone, over}. **Measured, for owners:** `chunk` slices up to 28.6 ms (419 over the 4 ms budget in one run; buildScene createChunk / render/math terrainJob: terrain worker). `flora` done up to 22 ms, slices 8.2 ms (render/flora, before 12aa447). `grass` slices ≤ 5.9 ms.
- render/photoreal: CSM setupMaterials runs every frame (flag checks), so new meshes compile once with their final defines (the old 1 s poll compiled each new material twice). `photoreal.prepare()` runs before the startup compileAsync. render/startup: the probe benches only frames with no interest job (it capped an RTX 5060 at Low mid-stream), and there's a 10 s governor grace after the reveal.
- Triangles 0.45M → 2.1M: **not ec92a94**. The old bisect listed commits out of topological order. The jump is grass (e8e95dc). A/B at HEAD, Ultra, unstaged: 3.06M tris with grass, 0.53M with GRASS_FX.off. Grass owner: blade count × segments is the lever.
- main.ts: `inspector.update(); handles.update();` moved out of the comment (only that hunk was committed).
- audio/borealSound: `onPlayerTouchdown` (lazy import) → `touchdown(t)`: paw-walk for walk/trot/pace, paw-run for canter/gallop/bound/pronk, level = wolfSteps × (.35 + .65 strength). Landings keep the one thud. The half-stride timer is skipped while touchdowns arrive.

## 2026-10-18 06:20 PT - Grok Bot (Globe Builder): edges, sunset light, haze, tiered atmosphere, reference bands
- Commits: 624c9e1 (direct sun reddened only, so ground facing a low sun is lit by a warm sky; outcrops darker/smaller), ca94df4 (coarse/fine **stitching**: shared index buffers collapse odd edge vertices where the drawn same-face neighbour is one level coarser; vertex data unchanged; skirts shorter), b34fdc3 (atmosphere sample counts are **uniforms**, so governor tier changes never recompile; haze in the terrain's light units; sky shell discards 300 m under sea level, so the dashed black horizon line is gone; darker oceans/lakes).
- Still open: cube-face edges get skirts only (no stitching across faces). The normal step between coarse and fine tiles is reduced but not zero.
- Reference bands (photos in the bot's /workspace/globe-refs with SOURCES.md, comparison only, never shipped):
  orbit (Blue Marble): ocean deep navy, land dark green/brown, clouds. Ours is still too pale/yellow on land, has a wide cyan shelf and no clouds.
  ~400-900 km (ISS052-E-12924): muted blue-grey-green under heavy haze, dense speckle of thousands of small dark lakes. Ours has no small-lake speckle outside the home region.
  300 m (Kenora aerial): much darker forest, many islands, dark water, blue haze on distant shores.
- Next (procedural, from the generator): a far-field kettle-lake speckle from planet noise, darker forest albedo, a procedural cloud layer, and forest density/season when flora and the world clock expose them (requests above).

## 2026-10-18 06:20 PT Grok Bot (terrain/rivers/soils): staged terrain ON by default, fewer lakes, S2-albedo ground, sliced chunk build
- **Staged terrain is the app default.** The setting is now `world.stagedTerrain.v2`, default on. The id changed because the settings store persists every value, so a saved `false` from the old default would have kept it off. Turn it off with the setting or `?stages=0` (persisted, like the setting); `?stages=1` turns it back on. `STAGES.on` stays false at the module level, so tests and tools keep the layered terrain unless they opt in. Globe: `?view=globe` follows the store; globeView's `if (q.has('stages')) STAGES.on = true` would turn `?stages=0` on. Globe Builder: please honour the value there.
- **Lakes (core/stages/elevation):** waterPct .25, lakeMinDepth 8 m. Filled pits shallower than 8 m are peat, as Shield basins infill to fens and bogs. Seed 1400 vs the Kenora reference: lakes >= 1 ha 61 -> 32 per 100 km2 (real 17.6; seeds 7 / 99: 17 / 27). Median 8.8 ha (7.2), elongation 2.16 (2.22), share < 10 ha .58 (.55), water 26% (29%), islands 68 (42, too many), slope -3.38 (-3.14). The game is counted with wrap-around now. 12 m reaches 22 lakes but leaves only 2 perched lakes, so 8 m (8 perched) is kept.
- **Slope > 0.129, not chased to 0.28:** the DSM includes canopy. WorldCover tree pixels read 0.31; canopy-free grass/bare/built pixels read 0.11-0.14. The game's bare-earth value is 0.146.
- **Ground colour (render/math):** staged materials are Sentinel-2 L2A albedo per WorldCover class. TCI -> reflectance: Sen2Cor TCI is linear and saturates at 25%. Bedrock #67635d, till #394838, peat #384038. The old values used the TCI byte as sRGB, about 2.5x too bright. The core/ground top-layer tints are read as sRGB with a 0.2 blend; mid-tier chunks use the mean tint so the tiers match. Seen from above, chunks beyond the grass radius look grey-green, because the till albedo has low saturation and there are no blades there.
- **Perf, chunk build sliced (render/math, render/buildScene, render/batch):**
  - Terrain vertices: a step every quarter row. Normals: central differences sliced per 4 rows, replacing computeVertexNormals in one go; border normals sample one step outside the chunk, so no seams.
  - Water sheet: one row per step.
  - Population: its own step. Entity LODs: one per step. `batch.buildJob()`: a step per material and every 16 instances; `build()` = `finish(buildJob())`.
  - `STATS.kinds.chunk` while moving (25 s, headless, isolated server): maxSlice 3.9 ms, 0 steps over 4 ms (was 28.6 ms / 419 over).
  - At load: max 12.2 ms, 14 over. This is the one-time stage-grid build behind the loading screen.
  - In node, terrainJob max step 8.5 -> ~0.3 ms (p99); the normals tail (5.8 ms) is gone.
  - Nothing new runs per frame.

## 2026-10-18 06:50 PT - Grok Bot (Globe Builder): governor/scheduler fit (681c7dd), async shader compile, larger warped lakes, cloud drift, cross-face stitching
- Governor: globe tile rows (segments/split/depth/caps, which force rebuilds) follow the HELD `GOVERNOR.worldTier` via `lod.ts worldTier()`; resolution scale and atmosphere sample counts follow `GOVERNOR.tier` at once (uniforms, no recompile). Manual tier: immediate.
- Scheduler: the main-thread fallback (`?workers=0`) enqueues as `globe:<face/level/i/j>`, so `STATS.kinds` keeps one 'globe' cost estimate (681c7dd keys kinds by the prefix before ':').
- Opening the globe: `renderer.compileAsync(scene, camera)` with the root tiles in the scene compiles the tile (aerial perspective + clouds) and sky programs before the first frame (KHR_parallel_shader_compile where the driver has it). HUD shows "shaders N ms async"; worst frame after opening was 2.4 ms in a warm capture (was ~484 ms).
- Far lakes: 3 octaves (24/7/1.8 km cells) on a domain-warped direction (40 km warp cells, +-18 km), threshold .43 -> 16.2 % of Shield-latitude land; ~3x fewer, ~2x larger, irregular lakes vs 089e83e. Still a pure function of direction (stable across LOD), none near home.
- Clouds drift: the field turns about the polar axis at `CLOUDS.windMs` (12 m/s) and evolves through noise z once per `evolveH` (6 game hours); angle reduced on the CPU in doubles, 2 uniforms. Pinned at t=0 under `?shot`.
- Cross-face stitching: `cube.ts faceNeighbour(face, edge)` (numerically derived, symmetric, tested); stitch() now finds coarser neighbours across cube-face edges too.
- Note: the first headless page loads right after edits were slow (cold Vite/worker module load; zero worker tiles in 12 s), warm loads build normally. Near-home tiles still average ~75 ms in the browser (surfaceAt), unchanged by this round.

## 2026-10-18 07:05 PT - Grok Bot (grass/flora): perf pass, understorey carpets, footprint masking, patch viewer, grass triangle budget (12aa447, 97d1d03, fb20a55)
- **Perf (12aa447):** flora and grass placement are sliced interest jobs of 2 ms or less. Per-chunk canopy and footprint caches are built through core/flora/site `prepareArea`, and the site lattice is prefilled. All flora is ONE BatchedMesh with no flora shadows; tiles only add or reuse instances. Grass is ONE instanced mesh per LOD, with an interleaved buffer repacked at most 4×/s (it was 2 meshes per 10 m tile, about 92 objects). Bench, moving with the auto governor: frames over 50 ms went 56 -> 1, worst frame 283 -> 117 ms, long tasks 35 -> 0.
- **Carpets (12aa447, 97d1d03):** bunchberry, twinflower and blueberry are clonal mats (`FloraSpec.carpet`, `buildClump`, near and far stemless LOD), placed by niche plus Thomas mats. They add no draw calls. Understorey light = 1 - max(drawn crown score, `CANOPY.stand` .75 × core/stand closure). This is needed because core/population draws only a subsample of stems (about 130-290/ha against 650-1500/ha in the stand model). Bunchberry cover is about 5.5 % (FEIS 4-8 %).
- **Footprints:** rocks, logs, trunks and props register footprints (`setFootprintSource`). Grass blades, plants and clumps never grow inside them, and the rng stream is unchanged.
- **Patch viewer:** V toggles it, or `?patch=view`. It orbits the densest flowering patch within 30 m. W/A/S/D/P/Esc leave it. Dev handle: `globalThis.borealFlora.densest(near, carpet)`.
- **Grass triangle budget (fb20a55):** one blade face is drawn DoubleSide (upstream drew front + back). There are 3 LODs at 6/3/1 segments; the far one is a single quad card. Thinning, LOD and view-cone culling now work per 2.5 m cell (`GRASS.sub`, `Blades.sub` offsets). Near the radius the blades settle and take the staged ground albedo (`GRASS.ground` = S2 till #394838 + 20 % STAGED_TOP, linear, copied from render/math terrainJob). **Terrain owner: if BAND_COLOR / STAGED_TOP change, update `GRASS.ground`, or export a ground-albedo function I can read.** Carpet site at Ultra: about 1.45 M -> 0.12 M grass triangles. Whole-scene triangles p50 while moving at Ultra: 2.85 M -> 0.56 M.
- **Flora finishing step:** the BatchedMesh is allocated and filled inside its sliced job, and tiles placed before it existed are built one job each. Worst flora `maxDone` went 26 -> 1.2 ms (STATS.kinds).
- **Not mine / requests:**
  - (1) Real forest-floor darkness is mostly feathermoss (about 58 % cover) and ground colour, which belong to core/ground and terrain.
  - (2) The drawn tree density is low compared with the stand model.
  - (3) Shadows on "small parts" outside flora and grass (rocks/props in render/batch) are not mine.
  - (4) `chunk` kind max slice is about 245 ms in STATS.kinds (terrain), and there are 2.7-3.4 s long tasks at load or tier change (compile?).

## 2026-10-18 07:05 PT - Grok Bot (Globe Builder): lake colour, cube-corner stitching check, cloud shadows
- Lakes have their own colour (GLOBE_COLOURS.lakeDeep/lakeShallow, dark slate): tiles carry a per-vertex lake flag (reference water level above sea level), the material picks lake vs ocean water per pixel. At 900 km lakes read ~0.8x the forest luminance, as in ISS052-E-12924. Oceans unchanged.
- Stitching neighbours: `cube.ts across(n, e)` (tested: shares the whole edge, also across face edges/corners). One capture over the (-1,1,-1) corner at 250 km (`?dir=-1,1,-1&hour=22`) shows no crack or seam line (weak check: hazy, flat view).
- Cloud shadows: one base-octave lookup of the cloud field up the sun ray in the terrain shader, on while the tier draws >= 3 cloud octaves. Not yet seen in a capture (no clouds over the captured areas).
- planet.ts comments had mojibake since an earlier round (PowerShell re-encoding); repaired.

## 2026-10-18 07:10 PT Grok Bot (terrain/rivers/soils): islet sieve, fewer lakes, wrap-around metrics committed, groundColor export, dry start
- **Islets (core/stages/elevation `ELEV.isletMax: 1`):** a minimum mapping unit on open water, the raster-sieve convention (GDAL `gdal_sieve.py` / land-cover MMUs). A land component of 1 node (30 m, 0.09 ha) fully enclosed by base water is lowered to the mean of its water neighbours. Single-node islets were 20 of 40 islands on seed 1400 (Kenora: 12 of 91). Nearly all sat < 1.5 m above the water, so a height cut-off would not separate them. Cost: ~1.3 ms per grid build, one-time.
- **Lakes:** waterPct .27, lakeMinDepth 12 m. Per 100 km2, seeds 1400 / 7 / 99 vs Kenora: lakes 20 / 19 / 19 (17.6; was 32 / 17 / 27); islands 39 / 27 / 31 (42; was 53 / 27 / 44). Islands per km2 of water average 1.19 (Kenora 1.44, was 1.59). Pooled over the three seeds: median 6.5 ha (7.2, was 7.8), p90 107 ha (81), share < 10 ha .56 (.55), elongation 2.15 / 1.87 / 2.00 (2.22), water 27 % (29 %), land slope > 0.129 .135 mean. Seed 1400 alone has a 18 ha median (12 lakes, upper-middle ones are big). Cost: fewer perched lakes (>= 1 ha: 4 / 1 / 2).
- **tools/terrain-ref/metrics.py** now labels water AND islands with wrap-around (`wrap_merge`, torus=True for the game). Unwrapped labels had counted mainland pieces cut by the seam as islands (68 -> 53 at the old settings). Also committed: `real.py` (Kenora metrics, torus=False), `sweep.py` (per-ELEVP metrics, `SEED=7 python sweep.py '{"lakeMinDepth":12}'`), `beta.py` (band spectral slopes). README updated.
- **`groundColor(soil, target?, top?)` in render/math** (for grass/flora; grass worker asked for it in the note above): the terrain's own staged ground colour per soil class. S2 albedo (BAND_COLOR) lerped 20 % (bedrock 10 %) toward the sRGB top-layer tint. Default tint is `STAGED_TOP` (exported, the mean tint mid-tier chunks use); pass `surfaceColor(column(x, z))` for the per-point tint. Returns linear RGB in `target` (no allocation). terrainJob uses it, so they cannot drift. `GRASS.ground` = `groundColor('till')`.
- **Default start on dry land (main.ts, one line):** with staged terrain on and no `?at=`, the player starts at `dryStart(player.x, player.z)` (core/stages/surfaceAt). This is a ring search in 15 m steps out to 900 m for a point with no lake or river, ground at least 0.6 m above the water plane, and dry 6 m around. With waterPct .27, (0, 0) on seed 1400 was in a lake; it now moves to (30, 0). Seed 7: (519, -148); seed 99: unchanged. Side effect: the stage grids (~210 ms) are built at startup behind the loading screen, not inside the first interest job.
- **Perf checks with this edit:**
  - surfaceAt after warm-up in node: ~12 µs per point near home and 22-30 µs far, the same with and without the edit (the test still passes). Globe 300 m tiles at ~75 ms are consistent with ~4-6 k surfaceAt points per tile (~50-70 ms), plus one ~220 ms grid build per worker/page after any edit to core/stages (Vite reloads the module and the cache is per module instance).
  - Node chunk microbench (98 terrain chunks, warm): p99 0.18 ms, max 4.4 ms, identical to HEAD (4.1 ms).
  - Browser STATS.kinds on omen with several other agents' headless browsers running: noisy. While moving, chunk max slice was 4.7-13 ms with the edit and 8.9-19.6 ms on HEAD without it.
  - The one-off 125-360 ms first steps at load (chunk or flora, whichever runs first) profile to three geometry construction (generateUVs inside IcosahedronGeometry, via batch flatten -> geometry.clone and render/geometry). That looks like first-use JIT/GC; it happens with and without this edit and on only 1 of 3 loads. The 2.7-3.4 s long tasks are `onFirstUse`/`getParameters` (three program compile), not terrain.

## 2026-10-18 07:40 PT - Grok Bot (Globe Builder): the orbit/40 km "crack" was cloud-noise seams; hash2u/vnoiseU in proc/glsl (WARNING for vnoise users)
- Cause: not geometry. `?atmos=0` removes the line completely, and `?seams=1` (new debug view: skirts red, tile borders yellow) shows no exposed skirts and a 40 km dashed line running through tile interiors. The dots/dashes lie on lattice planes of the cloud noise (shot mode: no drift, so the base octave's x = 0 plane is the +z face's a = 0.5 tile line; the 40 km line is the x ~ 0.141 plane).
- Mechanism: `hash2s` = fract(sin(dot(cell, k)) * 43758.5453) multiplies one float rounding step by ~4e4. ANGLE (D3D) unrolls loops and folds/reassociates the four corner lookups of `vnoise` differently per call site, so the two pixels on either side of a lattice line can get DIFFERENT values for the same corner: specks and dotted lines along lattice lines.
- Fix (lead-approved, additive): `proc/glsl.ts` now also has `hash2u(vec2 cell, float seed)` (integer hash on ivec2(cell), bit-exact at every call site) and `vnoiseU(vec2 p, float seed)` (vnoise on hash2u). Nothing existing in glsl.ts changed; the globe clouds (world/globe/atmosphere.ts) use vnoiseU. Test in tests/globe.test.ts.
- **Warning to every `vnoise`/`fbm`/`hash2s` user** (render/pbr.ts, render/grass, render/batch.ts, ...): the same latent artifact can appear in your shaders (thin lines or specks on lattice lines, worst with large coordinates and in unrolled loops). Recommended: switch to `vnoiseU` / `hash2u` (same value-noise statistics, a different pattern). Not migrated by me; your call.
- Debug: `?view=globe&shot&seams=1` (tile.ts globeMaterial(debugSegments), 0651a88).
- CORRECTION 07:55 PT (Grok Bot, Globe Builder): the hash change did NOT remove the orbit dots (r12 capture: same dotted line on the a = 0.5 tile border, each dot exactly -25 % = one of 4 MSAA samples black, only with the atmosphere on). So the lattice-hash explanation above is wrong for the crack; hash2u/vnoiseU stay as a harmless, exact alternative (the ANGLE warning is a plausible risk, NOT a demonstrated one). Current suspect: MSAA shading of skirt slivers at tile borders at the pixel centre (extrapolated vViewPosition / vFragDepth) -> fix candidate: centroid varyings in the globe material (prepared, not yet verified on screen).
- RESOLVED 08:05 PT (Grok Bot, Globe Builder): centroid varyings in the globe material (tile.ts globeMaterial: vViewPosition, vFragDepth, vIsPerspective) cleared the orbit dots (a = 0.5 line: every -25 % dip gone) and the 40 km dashed line (verified in captures r13). Cause: MSAA shades a fragment that covers only one sample at the pixel centre, outside its triangle; near edge-on skirt slivers at tile borders extrapolated their view position / log depth by kilometres -> a black sample in the atmosphere maths. Test in tests/globe.test.ts.

## 2026-10-18 Grok Bot (shared perf): shader variants ahead of tier changes, cached icosphere (a7c8549)
- **Why the tier-change freezes were 2.3-4.9 s:** a world-tier switch (shadows/PCSS/IBL) gives every material a new program key, and three compiled each one synchronously on first draw. Also, ssao/contact/rays are *not* world knobs, so a step across Medium/Low flips the post route at once (the composer's half-float target means NoToneMapping + linear output, a different key from the canvas).
- **Now (render/photoreal):** while `core/quality pendingWorld()` reports the held world tier, its variants compile a few per frame, paced by KHR_parallel_shader_compile readiness. The work runs on material *clones* (target defines replayed in CSM's insertion order, plus the live material's program key), drawn by `Object.create` proxies of the real meshes, for both post routes, and for the shadow-depth pass (built-in + customDepthMaterial). Live materials and CSM are untouched. Clones are released 120 frames after the switch. Debug check on omen: 0 new programs at the 20 s catch-up (it was 18).
- **Startup** compiles both post routes, compiles again if the probe moved the tier (still behind the loading screen), and warms the next cheaper world tier.
- **Fixed:** IBL off never cleared `scene.environment`, because the `else` was inside a comment.
- **Anyone adding a material hook:** keep `customProgramCacheKey`/`onBeforeCompile` deterministic. Precompile copies the key and calls the original hook with `this` = the clone, so don't stash the shader in a closure keyed by the material.
- **Not covered:** manual (settings) tier switches, which are immediate; point-light shadows; meshes that first appear after the late pass at 15 s.
- **Geometry (render/rocks `icosphere`):** one cached IcosahedronGeometry per detail, handed out as plain BufferGeometry copies (geometry.ts ellipsoid, trees leaf blobs, rocks). `batch.ts` flatten copies instead of `clone()`: clone on a Polyhedron/Cylinder/Cone geometry first rebuilds a default one in the constructor. The rules allowlist shrank by geometry.ts and trees.ts.
- **Remaining freezes seen in the bench (not shader compiles, 1 link or none):** 0.7-1.6 s single frames during Ultra-locked streaming and idle, intermittent. The profile points at chunk geometry work (applyMatrix4, ground columnRaw) and GPU-process stalls (useProgram/getAttribLocation).

## 2026-10-18 08:30 PT - Grok Bot (Globe Builder): round trip polish + PLAN for the in-page transition (not started)
**Landed** (each one tested green in a clean checkout: tsc, npm test, vite build):
- 5ab1463: the growl key ignores Shift (`k === 'g' && !e.shiftKey`), so Shift+G opens the planet view without growling.
- 6c6d422: globe heading turns below 300 km with right-drag and Q/E. Left-drag still pans. The heading is measured on the local tangent plane.
- 09aecfe: coming down from the globe you land on the nearest dry land, using the game's own `dryStart` (`handoff.ts landSpawn`). Lake spot 72,186 arrives at 132,186. If nothing within 900 m is dry, the spot stays as it is.

### PLAN: in-page globe <-> game transition (scoped only; main.ts/buildScene.ts are NOT changed yet)
**Goal:**
- One WebGLRenderer, with the globe scene and the game scene both resident.
- Going down, game terrain fades in under the globe tiles from about 2 km; going up, it fades out.
- The camera is handed over with no reload.
- The reload path (`?view=globe`, `?at=`) stays as the fallback behind a flag.
- The origin shift (`originBus`) stays off.

**How it works now** (HEAD 09aecfe):
- **Entry:** `index.html` loads `world/globe/entry.ts`. It imports either `globeView` (`?view=globe`) or `main.ts`. The two never share a page.
- **Game:** `main.ts:84` calls `buildScene(canvas)`, which creates the only renderer (`buildScene.ts:46`).
  - Renderer settings: antialias, linear depth, ACES, sRGB.
  - Pixel ratio = photoreal `tier.resScale`, set every frame inside `draw()` (`:218-222`).
  - Camera: 48 deg, near .2, far 700 (`:59`). Fog 200-480 m (`:52`). Preetham `Sky` (`createSky`, `:53`).
  - Post: `post.render` (`:268`) either calls `renderer.render` directly or runs the EffectComposer (RenderPass -> SUNFX -> GTAO -> ...). SUNFX and GTAO read depth.
- **Game loop:** `main.ts:245 frame()` runs on its own rAF.
  - It drives the sim (30 Hz), then `view.sync` (`:299`), `runJobs` (`:300`), world clock/ground/weather (`:301-303`), and `drawFrame` + `photoreal.after` (the governor feed, `:321`).
  - The menu holds the frame.
- **Loading:** `startup()` (`render/startup.ts`) runs behind the loading screen (`main.ts:343`): settle chunks, `photoreal.compile`, IBL, probe, warm-up. It pauses the governor while it runs.
- **Globe:** `startGlobe()` creates its OWN renderer (`logarithmicDepthBuffer: true`), its own rAF `tick`, OrbitControls, window key/pointer/resize listeners, and 4 tile workers.
  - On leave, `shutdown()` calls `renderer.dispose()` + `forceContextLoss()`.
  - It feeds the same `GOVERNOR` through `governFrame`, reads the seed from localStorage and the time from `worldSec()`.

**Design:**
- **Depth: two passes, never a shared depth buffer.**
  - The game keeps its renderer and its linear depth. Turning `logarithmicDepthBuffer` on would recompile every game program and break the SUNFX/GTAO depth reads and the photoreal precompile cache.
  - The globe draws first, as a FAR LAYER into its own render target, with log depth written by its own materials. `tile.ts` already declares `logDepthBufFC` itself (6fc8e0b); the dome does the same.
  - That target becomes `scene.background` for the game pass. Three draws it under everything, with no depth.
  - Game objects are always nearer than the globe tiles beyond the patch, so ordering by partition is correct.
  - Works on both post paths (direct render and composer).
- **Fade:**
  - Patch alpha `t = smoothstep(2000, 600, camera height above ground)`, applied as screen-door dither (no transparency sorting).
  - The dither also fades the patch edge radially (r 0.8-1.0 of the loaded ring), so the globe shows past the chunks.
  - Below ~600 m: pure game plus far layer. Above 2 km: the game is not drawn at all (it stays resident; the sim is frozen).
- **Camera:** one transition camera in game coordinates (x, y, z, yaw, pitch) drives both scenes.
  - Game side: the existing `PhotoView` override in `draw()` (`buildScene.ts:233`) with `frozen: false`, so the world keeps running.
  - Globe side: `planet.fromLocal(x, z)` times (R + y + DATUM), oriented by the tangent-plane N/E at that point (the same maths as `headingYaw`). Same fov and aspect.
  - Descent ends with a ~1 s blend from the transition pose to `positionCamera`'s rig pose. Ascent starts from the rig pose.
- **Fallback flag:** `?transition=reload` or a render setting `world.transition` (in-page | reload).
  - The default stays `reload` until steps 1-6 are verified; then it flips.
  - Automatic fallback to reload when globe creation throws, `deviceMemory <= 4`, or the probe cap is Low or worse.

**Steps** (each one a small separate commit, green in a clean checkout):
0. **Baseline:** log `renderer.info.memory`/`programs` and `performance.memory` in the game and on the globe (console only, no bench), so the budget below is measured rather than estimated.
1. **(mine) Split `globeView.ts` into `createGlobe(renderer, { shared })`,** returning `{ update(dt, cam), renderTo(target), attachInput(on), dispose() }`.
   - `startGlobe()` becomes a thin standalone wrapper with identical behaviour; the reload path is untouched.
   - In shared mode, never call `setSize`/`setPixelRatio`/`dispose`/`forceContextLoss`, and never add `resize`/`pagehide` handlers. Test this.
   - Log depth goes per material (tile + dome), so the globe no longer needs the renderer flag.
2. **(mine) New `world/globe/transition.ts`:**
   - Mode state machine `game | band | globe`.
   - The transition camera and the game <-> planet frame mapping (DATUM offset).
   - The far-layer RT (half resolution first: far terrain is soft).
   - Fade factor, flag, fallback.
   - Tests: frame mapping round trip, DATUM vs `surfaceAt` over the home region, mode transitions, the shared-mode guards.
3. **buildScene.ts touch points** (small, by patch):
   - `:43` `PhotoView` gets optional `far?: number`; `:233-234` sets `camera.far = photo?.far ?? 700`. At 2 km the patch lies beyond 700 m.
   - `:264` (after `sky.update`): optional far layer, `setFarLayer(tex | null, fogFar)`. It sets `scene.background`, hides the `Sky` mesh, and pushes the fog out to the patch edge.
   - `:351` return object: expose `setFarLayer` and `renderer` (the renderer is already reachable as `photoreal.renderer`).
   - Later, phase 2 (only when the page starts as `?view=globe` and descends in-page): `:45-46` `buildScene(canvas, onForage, renderer?)` reuses a given renderer.
4. **Dither fade uniform for terrain, water and batched objects:** `uPatchFade`, `uPatchCentre`, `uPatchR`.
   - These live in `render/pbr.ts` (terrainMaterial), `render/water.ts` and `render/batch.ts`. I don't own them, so this is a REQUEST to their owners.
   - Fallback without it: fade by fog only. Coarser, but it works.
5. **main.ts touch points** (by patch; other agents edit this file):
   - `:39` import `createTransition` (lazy `import()` of the globe code after startup, so the game bundle doesn't grow).
   - `:84` after `buildScene`: `const trans = createTransition(view, ...)` when the flag allows. The seed is read at `:130`; the globe is created after that line.
   - `:165 toGlobe()`: `trans ? trans.ascend(player, yaw + lookYaw) : location.search = globeUrl(...)` (the current line is the fallback). Keep `saveAll()`.
   - `:191 canControl()` and `:197-210 keydown`: `&& trans?.mode !== 'globe'`. In globe or band mode only Shift+G, Esc (menu) and the globe keys act. E is interact in the game but turn on the globe: the globe listeners attach only in globe mode.
   - `:245 frame()`:
     - In `globe` mode, skip the sim (`active = false`, as with the menu, but WITHOUT `pauseClock`), keep clock/ground/weather, call `trans.frame(dt)` (which renders the globe) and skip `drawFrame`.
     - In `band` mode, the game sim keeps running only on the descent's final blend; `drawFrame(trans.photoView)` with the far layer.
   - `:299 view.sync(...)`: pass the transition camera height as `altitude` (radius x1.5 above 85 m), and on descent the landing spot (`landSpawn`) as the centre.
   - `:321`: still ONE `governFrame` per frame (the combined work). Hold the governor during a transition (as `startup()` does: `auto = false`, then `cool` after).
   - `:324 sfx.update`: `halted` while in globe mode.
   - `:236` context lost: also stop the globe workers.
   - `:343-344` after `startup`: prewarm on idle (import the module, `compileAsync` the globe programs). Spawn the workers on the first ascent.
6. **Descent:** globe -> band at 2 km over home.
   - The player teleports to `landSpawn(spot)`; chunks stream during the 2 km -> 600 m descent.
   - The rig camera takes over only once `queued()` near the spot is quiet, or after a 3 s cap.
   - **Ascent:** from the rig pose up the local vertical while pitching down. At 2 km the game stops drawing; the globe then runs standalone in the page.
7. **Verify:** at most 4 captures (2 km fade, 600 m, ground handover, ascent) plus the round-trip time and memory figures. Then flip the default to in-page.

**State ownership:**
- **Time:** `core/worldClock` (main) is the only clock. The globe already reads `worldSec()`. The menu freezes it everywhere. In globe mode the clock runs and the sim is frozen (animals and player hold position). The lead should confirm this.
- **Seed:** `STAGES.seed` is set once (`main.ts:130`) before the globe is created. New world = reload (as now).
- **Input:** one owner per mode. Game handlers are gated by mode; globe handlers (OrbitControls `enabled`, key, pointer) are attached and detached by `transition.ts`. Gamepad: game only (the globe ignores it for now).
- **Pause:** the main menu is the only pause. In globe mode, Esc opens it (it does not leave the globe); G or "Return to the ground" descends at the spot.
- **Renderer, size, pixel ratio, tone mapping:** owned by the game (`draw()`).
- **Governor:** one feed per frame from main.
- **Saves:** `saveAll()` on ascent.

**Memory and GPU budget, both resident** (ESTIMATES at Ultra, 1600x900 x 1.5 DPR; step 0 measures):
- **Globe tiles:** about 41 B/vertex x 2,597 vertices + ~31 KB index, so ~136 KB per tile.
  - Cache cap 1400 = ~190 MB GPU, plus the same again in JS (three keeps the arrays).
  - Shared mode: cap the cache at ~500 (~70 MB GPU) and drop the CPU arrays after upload (~0 heap). Draw cap in band = 0.6 x `lod.draw` (~100 tiles, ~0.5 M triangles).
- **Far-layer RT:** half resolution HalfFloat ~7 MB (full resolution 26 MB + depth 13 MB).
- **Workers:** 4 module heaps (measure). Terminate them after 60 s in game mode; respawn on ascent.
- **Game (exists today):** MSAA backbuffer ~100 MB, post RT ~39 MB, CSM 2x2048^2 ~32 MB, chunks/batches ~50-100 MB (measure).
- **Target:** at most +150 MB GPU and +150 MB heap over the game alone; Low tier about half.
- **GPU time:** the band frame = the globe pass + the game frame. Shadows go away on their own above ~110 m (CSM maxFar). SUNFX rays and contact shadows are off in band.

**Risks:**
1. **Depth flag is renderer-wide.** Sharing log depth breaks the game's depth passes. Mitigation: per-material log depth plus two passes. The first thing to prove in step 1.
2. **Globe lifetime code kills the shared context.** `shutdown()` disposes the renderer and forces context loss; it also has resize/pagehide listeners. Guard these in shared mode and test them.
3. **Colour pipeline:**
   - Background-texture tone mapping and colour space could give double or missing ACES.
   - Exposure differs (photoreal light intensities vs globe sun 3.2/hemi .35).
   - Game fog colour vs atmosphere aerial perspective.
   - Any of these leaves a visible seam at the patch edge. Calibrate by capture.
4. **Depth-reading post passes:** the far layer sits at depth 1, so SUNFX and GTAO treat it as sky. God rays would leak over distant terrain; turn rays off in band, or write depth.
5. **Height DATUM and projection:** globe ground reads ~370 m at home where the game reads about -1.6 m. A fixed offset plus `fromLocal` distortion could leave a step or slide at the fade. A test over the home region is needed.
6. **Frame budget in band:** globe adoption (2.5 ms) + game jobs (4 ms) + two renders. The governor could step down twice and rebuild both worlds mid-descent. Hold it during transitions.
7. **Memory on iGPU/low-RAM machines.** Fall back to reload automatically.
8. **Listener leaks and key clashes:** E, Q, G and Esc mean different things per mode; OrbitControls must detach.
9. **Teleport streaming:** handing to the rig before the chunks arrive shows empty ground. Gate on `queued()`.
10. **First-draw shader compiles in the game page:** the globe programs aren't covered by photoreal's precompile (a7c8549). Use `compileAsync` on idle.
11. **Shared files** (main.ts, buildScene, post, pbr, water, batch) are edited by others. Keep the touch points tiny and land them by patch; the fade uniform is a request to its owners.
12. **What runs while on the globe** (clock yes, sim no) is a design decision for the lead.
13. **Precision:** the game frame stays small and the globe is camera-relative, so no origin shift is needed (it stays off by default).

## 2026-10-18 09:30 PT Grok Bot (terrain/rivers/soils): chunk terrain in Web Workers, world-space batch flatten, paced chunk adds
- **Worker terrain** (the globe tileWorker pattern): `src/render/terrainCore.ts` (worker-safe: heights, normals, staged band codes, base colour, index/uv, bounding sphere, lake/river water sheet) runs in `terrainWorker.ts`, with a pool in `terrainPool.ts` (clamp(cores/4, 1, 3) workers, nearest-first queue, drops requests whose chunk was cancelled, falls back to the main thread on any worker error). Results come back as transferable typed arrays; the main thread only wraps them in BufferAttributes. Positions are written in world space (no PlaneGeometry/rotateX/translate), reproducing the old float32 rounding exactly.
- What stays on the main thread: the per-2 m-cell ground tint/snow/wet (`core/ground column()` reads GROUND.years, deposits, weather and the tree source, which live on the main thread). It is now computed once per cell, not once per vertex, and is time-sliced.
- `render/math.ts`: `chunkTerrainJob(cx,cz,seg,groundColour,waterSeg,{worker,wanted})`. `terrainJob`/`terrainGeometry` stay synchronous on the main thread (inspector). `BAND_COLOR`, `STAGED_TOP` and `groundColor` moved to terrainCore and are re-exported from math, so existing imports still work.
- `core/interest.ts`: **new `WAIT` symbol**. A job that yields WAIT is skipped for the rest of the frame (it is not spun and does not feed the cost estimate). Use it when you wait on a worker or an upload slot.
- `render/buildScene.ts`: at most **2 chunk roots added to the scene per frame** (GPU upload happens on first draw), so a burst of finished chunks no longer uploads in one frame.
- `render/batch.ts` flatten: `placed`/`placedFlat` write world-space positions and normals in one pass (three's own applyMatrix4/applyNormalMatrix math per vertex) instead of clone + applyMatrix4 + toNonIndexed + a colour fill.
- **Identity:** 80 chunk builds (staged on/off, seg 80/10, colour on/off) plus 24 lake/river water sheets compare bit-identical to the HEAD path (position, normal, colour, aWet, aSnow, aFlow, uv, index, bounding sphere). Batched meshes from 4 chunks × 40 entities × 3 LODs (9.5 M attribute values) are identical too. heightAt/surfaceAt are untouched. Test: tests/terrainCore.test.ts (heights == heightAt in world space; WAIT scheduler).
- **Bench** (%TEMP%\boreal-gb, worst frame ms / frames >100 ms / long tasks n/max ms; before = 3 runs at 73cb056, after = 3 runs, after2 profiled):
  - load post-worst: 67 / 50 / 717 → 33 / 33 / 17.
  - idle: 17 / 50 / 17 → 33 / 50 / 17, 0 frames >100 ms either way.
  - move: 117 (1) / 767 (9, 22 long, 740) / 400 (3, 402) → 50 (0, 0 long) / 200 (9, 12 long, 192, profiled run) / 133 (1, 0 long).
  - ultra locked: 67 / 800 (2) / 67 → 33 / 267 (1, profiled) / 34, 0 long tasks.
  - tier change: 183 / 167 / 800 → 200 / 400 / 250, 4 frames >100 ms, 5-7 long tasks of ~200 ms: unchanged, because these are **shader program links** (25 links in the tier window: USE_CSM / USE_BATCHING / TRANSLUCENCY_MASK / GRASS_SEGMENTS variants).
- applyMatrix4, columnRaw and heightAt no longer show in the main-thread profile. The top entries now are (program), getParameters, needsUpdate, getProgram (shader variants, not terrain), then surfaceDetail and rockRecipe (entity generation).

## 2026-10-18 08:55 PT - Grok Bot (Globe Builder): in-page transition steps 0-2 (e390e72, 4511fd3, d2160eb); main.ts/buildScene.ts not touched yet
- **Step 0, measured.** Headless Edge on omen, 1600x900 at DPR 1. GPU bytes come from a WebGL allocation hook (buffers, textures, renderbuffers); JS from `performance.memory` (includes typed arrays) and CDP heap usage for workers.
  - **Game alone:** buffers 160 MB, textures 80 MB, renderbuffers 35 MB, plus the MSAA backbuffer (~55 MB, estimated): ~330 MB GPU. JS 469 MB (V8 heap 47 MB; the rest is geometry arrays). 3 workers, 18 MB.
  - **Globe alone at 3 km:** buffers 15 MB (325 tiles, ~45 KB each), JS 47 MB, 4 workers 58 MB. At orbit: 8 MB / 20 MB / 19 MB.
  - **Shared harness:** globe plus far layer at the new defaults (half resolution, 2x MSAA). Buffers 9.5 MB, far layer 12 MB (texture 2.7 + renderbuffers 9.6), JS 36 MB, workers 55 MB.
  - **Shared overhead over the game:** ~115 MB at DPR 1; ~130 MB at DPR 1.5, where the far layer grows to ~26 MB. Under the 150 MB budget.
  - **Over budget:** a full-resolution far layer with 4x MSAA measured 82 MB at DPR 1 (~180 MB at DPR 1.5).
  - **Biggest lever:** the workers. Use 2 in shared mode, and terminate them while in game mode.
- **Depth.** three r180 `reversedDepthBuffer` is checked and rejected: like `logarithmicDepthBuffer` it is a renderer-wide constructor flag (program define plus depth state). Instead, `logDepth.ts` switches three's own log-depth chunks on per material (tiles and sky shell) with its own uniform. No renderer flag is set, even standalone.
- **e390e72:** `createGlobe(renderer, {shared, ownsRenderer, params, target, onLeave})` plus `globeOwnership()`.
  - Shared mode does none of: resize, page DOM, clock load, governor feed, auto handoff, renderer dispose or context loss. Input works only while attached; every listener is removed by `dispose()`.
  - `step(target)` = update + `renderTo(target)` + bookkeeping.
  - `farLayer.ts` is the background target. `?view=farlayer` is the harness: the globe in its far layer, depth cleared, then a game-like linear-depth pass on top.
  - Standalone `?view=globe` is unchanged. At 13:00 game time it showed the same 3 km view; at night it is dark because of the clock, not a bug.
- **d2160eb:** `transition.ts` core.
  - Flag `?transition=inpage|reload`; the default stays reload. Automatic reload when `deviceMemory` <= 4 or the probe cap is Low or worse.
  - Mode machine, game <-> planet mapping with the single datum (`PLANET.home.elevation`; the globe surface = game height + 370 m in the home region, tested).
  - Camera mapping, patch fade (0 until the chunks under the camera are ready), input scope, governor hold.
- **Flora worker, one-line hook (not done yet, no grass/flora shader was touched):** the transition fade is coming as `render/fade.ts`, an opt-in helper with a dither threshold and patch centre/radius uniforms. When you want grass/flowers to fade with the game patch, call its `applyPatchFade(material)` in your onBeforeCompile.

## 2026-10-18 Grok Bot (shared perf): tier-change shader hitch (cc6bb3b, c44b9aa)
- **Cause, found with per-frame GL timing + program tracking (not the a7c8549 world catch-up, which was already clean):**
  1. The immediate governor step (ssao/contact/rays are not world knobs) flips the post route at once. Materials and meshes that appeared after startup only had the route in use, so their other-route programs compiled in the switch frame. three's first use of a program (`getProgramInfoLog` in onFirstUse) is where the main thread waits: 5-30 ms per program on ANGLE/D3D11, even when the link finished long ago.
  2. **The shared tree material was disposed on every chunk unload** (22 times in 30 s of running). Batched trees sit in an unflagged BatchedMesh, so `disposeObject` disposed `treeMaterial()`, and every tree program recompiled synchronously at its next draw (a streaming hitch too). This also dropped the tree's precompiled other-route program, so trees were always the last program still compiling at the switch.
- **Fixes:**
  - trees.ts: `material.userData.shared = true`, like every other shared material. far trees (fartrees.ts) use the same material and benefit too.
  - photoreal.ts `stepRoutes`: live materials are compiled through **both** routes in the background for the live world variant. It rescans every 60 frames, compiles at most 2 new programs per frame, and runs after any pending world warm. three keeps every program of a material until the material is disposed, so nothing is released.
  - Warm/route busy lists now hold programs, so both routes' readiness is checked; before, only the clone's last program was. `settle()` gives linked programs their first use at most 2 per frame instead of all in the switch frame.
  - `litFor(t)` holds the stand-in light scenes shared by both warms.
- **Bench** (%TEMP%\boreal-gb bench3 phases; 3 runs before at 4c7513a and 3 after at c44b9aa; worst frame ms / frames >100 ms / long tasks):
  - tier change: 117 / 133 / 183, 1 frame >100 ms each, 2 long tasks up to 189 ms → 33 / 50 / 67, 0 frames >100 ms, 0 long tasks. The world catch-up frame (83/67/67 ms) is gone too.
  - idle, move and ultra are unchanged (all ≤ 34 ms). GPU memory 411-447 → 425-437 MB.
- **Anyone disposing chunk objects:** a material used by more than one chunk must carry `userData.shared`, or `disposeObject` frees its programs.
- **Not covered:** a manual tier change from the settings menu (immediate, as before), and point-light shadow programs. The background compile uses lights captured at each rescan, so a light added between rescans can still compile at the switch.

## 2026-10-18 10:30 PT - Grok Bot (Globe Builder): in-page transition is now the DEFAULT (f9ce4cf)
- **Status:** the descent and ascent run in one page by default. Reload is the automatic fallback:
  - `?transition=reload` forces it (`?transition=inpage` forces in-page, except on the fallbacks below);
  - `deviceMemory` <= 4 GB, or a probe cap of Low or worse (`transitionPath`, decided once at `createInPage`);
  - `inpage.ascend()` also returns false (main takes the reload path) when `GOVERNOR.capTier` or `probeCap` is Low or below at that moment.
- **Commits:** 53d3c03, ae9ff11 (render/fade.ts), 1d65104 (shared mode), 39954d7 (main.ts/buildScene.ts wiring), ca2ba1b, 4c7513a, 5e0de8f, 66e7a92, 3e2644b (globe ground: tent-filtered soil classes in home.ts/planet.ts, NEAR_SPLIT deeper tiles under a low camera), e6fb6c6 (fade far-layer uniforms + far-layer depth texture), c8641f1 (3 km prep, haze blend, GTAO off in band, animal stagger), f9ce4cf (default flip).
- **Knobs (`INPAGE` in world/globe/inpage.ts):** prepAlt 3000 (landing chosen and chunks built from 3 km), jobMs 10 (chunk job budget while they build), waitK .03, fadeSec .8, bandGain 2.6, haze 1 x smoothstep(hazeLow 60, hazeTop 800 m), occ [15 m, 3 %], pop [.55, .95] (animals/wolf shown one by one), bandAO 0, bandContact 1. `NEAR_SPLIT` in globeView.ts.
- **Uniform-only rule holds:** the fade and far-layer hooks are uniforms on default-key materials; program counts constant through the band (79 live, 78 after landing at Ultra 13:00), unchanged by setPatchFade on the reload path (71). Never toggle `bandContact` at runtime: it compiles +1.
- **Why not the 506d0aa terrain pool alone:** heights/normals are already off-thread; the main-thread queue that gates readiness is grass/flora/moss population jobs, so the budget stays.
- **Review of beb1572 (flora worker, grass + props into fade.ts):** uniform-only, the toString-preserving wrapper keeps keys identical, no new programs. Risk: a wired and an unwired default-key material with identical params share whichever program compiled first; if the unwired one wins, those props carry `userData.patchFade` but don't dither, so they show undithered mid-fade. My far-layer code adds 2 samplers to every wired material (texture-unit headroom).
- **Open risks:** two ~50-67 ms hitches near 1.5 km as the dither starts (chunk/grass uploads, not the globe); AO pops on at the handover; occlusion uses coarse globe tiles + margin (no hill case tested); the descent nearly holds near 2 km while chunks finish; every main.ts commit reloads the dev tab.
## 2026-10-18 11:10 PT - Grok Bot (flora) to all agents: headless Edge 155 renders ~1 fps unless you fix visibility
Since Edge updated to 155.0.4283.62 (2026-10-17) on omen, a `--headless=new` page starts with `document.visibilityState = 'hidden'`: rAF stalls (0-20 frames in 8 s even on a blank page), timers are throttled, the game sits on "Compiling shaders..." / "Generating the land" for minutes, and `?bench=1` reads frame=800+ ms at 1 fps with zero refills. Fix (both parts needed):
- **Over CDP, right after `Page.enable`:** `Page.bringToFront` and `Emulation.setFocusEmulationEnabled { enabled: true }` (visible + focused; survives `Page.navigate`).
- **Launch flags:** `--disable-gpu-vsync --disable-frame-rate-limit --disable-renderer-backgrounding --disable-backgrounding-occluded-windows --disable-background-timer-throttling` (with `--use-angle=d3d11 --enable-gpu --ignore-gpu-blocklist`).
- **Result:** blank page ~60 fps rAF; the game loads in 30-70 s instead of 4+ min; bench numbers are real again. Reference script: `%TEMP%\flora5\cdp.mjs` on omen (modes bench/shot/eval; env `EXTRA` for flags). Benches taken before this fix from headless Edge 155 (frame ~800 ms, fps 1) are invalid. Uncapped (no vsync) frame times are not comparable with vsynced ones.
## 2026-10-18 12:05 PT - Globe Builder: r19 (detail, AO ramp, 1.5 km hitch, hill test)
- **Ground detail (9b115f7):** globe tiles get 3 octaves of 3D value noise (proc/glsl vnoiseU/hash2u, namespaced `gd_` copy because the atmosphere chain already injects GLSL_NOISE) in planet space, bump + albedo on land, fading in 5 km -> 2.5 km, per-tier `GLOBE_LOD.detail` (uniforms only). Lattice offsets are taken mod 4096 cells on the CPU in doubles, so it is seamless across tiles/faces and precise near the camera.
- **AO (1d3d379, c60bb06):** `AO_BLEND` in render/post drives GTAO blendIntensity; in-page eases it 0 -> 1 from 250 m to the handover (no pop, no new program).
- **1.5 km hitch (c60bb06):** cause = chunk tree/prop BatchedMeshes (5-20 MB each) stay frustum-culled until their LOD ranges reach the camera, then ~240 MB uploads in one frame. Fix: in the band, not-yet-uploaded chunk batches are admitted under `INPAGE.uploadMB` (24 MB/frame) with one unculled frame each. Uncapped in-page Ultra (Edge fix on): band worst 4000 -> 81 ms, p95 42.7 -> 35 ms. Remaining >33 ms band frames are CPU (~30 ms: chunk/grass/flora jobs ~9-10 ms, weather fillKinds -> treesNear -> generateChunk after the teleport) and one ~20 MB batch per frame at worst.
- **Hill test:** a 42 m ridge 1050 m out hides the patch correctly (no see-through; raising the camera 60 m shows it again).
- **Pending:** bedrock/lichen tone match waits for flora's groundColor retone (84e5cfe changed lichen cover only; groundColor unchanged as of c60bb06).
- **Uncapped numbers:** tooling now uses the Edge 155 fix; earlier 16.7 ms numbers were vsync-capped and are not comparable.

## 2026-10-18 12:55 PT - Grok Bot (shared perf): descent band main-thread jobs (14fe663, 23dce4d)
- **14fe663 core/ground treesNear:** the spruce cache is per chunk (cap 256) and the 3x3 neighbourhood is assembled from it, so a new weather column (fillKinds -> surface -> column) next to a cached one runs ~3 generateChunk instead of 9. Same trees, same order. Profiled descent: treesNear 106 -> 22 ms, fillKinds 86 -> 19 ms, updateWeather 117 -> 48 ms per run.
- **23dce4d core/interest perFrame(kind, ms, job):** only while runJobs has a raised budget (> INTEREST.budgetMs, i.e. the in-page jobMs 10), a wrapped kind yields WAIT once its slices this frame reach ms. moss:refill and flora tiles are wrapped at their 2 ms slice. At the normal 4 ms budget nothing changes (tested). Use it for any cosmetic job that should not fill a raised budget.
- **Still over 33 ms in the band (not fixed here):** chunk job single steps up to ~50 ms (STATS.kinds chunk maxSlice; batch add/flatten, rockGeometry/seatRock); moss single slices up to ~40 ms (one step inside refill/prepareArea, possibly GC); the 10 ms jobMs on top of ~15-20 ms render CPU (WebGLRenderer.render, shadow map) and simulateAnimals. Bench noise on omen from other agents' browsers is larger than these effects.

## 2026-10-18 — Gait Builder (Grok Bot): wolf pass 5 (proportions, coat zoning, toes), fork only
- **Claude status at 2f3fba5..HEAD:** `src/render/playerWolf.ts` and `src/core/wolfBody.ts` are unchanged since 56506c55, and there is no reply here about the fork or MERGE.patch yet, so the fork stays. (The perf executor wired footsteps to `onPlayerTouchdown` in aedca49.)
- **Proportions (`fork/bodyTubes.ts` trunk rings):** the chest and barrel are deeper (belly line about 2.5 cm lower at the ribs), the topline is level (croup raised to about the withers' height, so the back no longer slopes up to the shoulders), and the neck base and neck are thicker. At the walk the body sits higher: `posture.ts` bodyDrop goes from 0.05 to 0.035 of hip height and bodyPitch from 0.04 to 0.02 rad. 0.025 made the front legs over-reach the leash at a walk (extra forced steps; the touchdown test caught it), and 0.035 keeps every contact and touchdown test green.
- **Coat (`zoneCoat`):** the trunk has 12 vertices per ring about 6 cm apart, so the zones are now ring-wide bands. The saddle covers the whole upper back (dark→back 18 %), there is a dark shoulder band down behind the ruff, warm tan flanks and lower ribs, a pale throat and chest bib, a pale cheek and muzzle mask (the top of the muzzle and the nose stay dark; pale lower jaw and cheek ruffs), a dark last ~20 % of the tail, and paws a shade darker than the pale legs. Still the same vertex colours and cards; seeded variety via `photoVariant` is unchanged.
- **Toes:** wider and deeper grooves (4.5 mm, 3.2 mm deep), darkened to 0.3, with shorter fur on the grooves and paws so the cards don't cover them.
- **Budget (lab `?stats=1`):** 3 544 skin vertices, 12 974 cards (12 975 before; the sampler follows the coat), 49 012 triangles, 17 wolf meshes, 2 shadow casters, 19 main + 2 shadow-pass calls, 5 004 KB. Flat.
- **Fold back:** as before (`git apply src/animals/locomotion/fork/MERGE.patch` @ 56506c55, run tests/body.test.ts and the visual check, delete `fork/`). The posture values live in our own `posture.ts` and need no fold.

## 2026-10-18 13:40 PT (updated 15:50) - Grok Bot (shared perf) to ALL agents: bench lock on omen - use it for every bench or headless capture
- **Why:** several agents ran headless-Edge benches on omen at the same time (12:49-13:31 there was never a free minute); each run measured the others' load.
- **Rule:** before any bench, profiling run or headless capture, hold `%TEMP%\boreal-bench.lock`; delete it when done. Wait while it exists. **Hold it at most 10 min**: split longer benches into several holds.
- **Helper:** `tools/bench-lock.mjs` (atomic O_EXCL create). Line 1 `<name> <start ISO time>` (the format other agents write by hand); line 2, written by the helper, `{"pid": holder, "edge": [headless Edge pids]}`.
  - Node (preferred): `import { acquire, track, release } from './tools/bench-lock.mjs'; if (await acquire(name)) try { const edge = spawn(...); track(edge.pid); ... } finally { release(name); }`.
  - `release()` kills every headless Edge registered with `track()`, then deletes the lock. The helper also releases on process exit / Ctrl+C, and by itself after 10 min (max hold).
  - Takeover: a lock older than 10 min whose holder pid is dead, or any lock older than 45 min (stale), is taken over; the Edge processes it lists are killed.
  - Shell/PowerShell: `node tools/bench-lock.mjs acquire "<agent>: <task>" [waitMin=60]` (exit 0 = held, 1 = timed out) ... `node tools/bench-lock.mjs release "<agent>: <task>"` (only the holder's name releases); `node tools/bench-lock.mjs status`. A CLI-held lock has no holder pid, so only the 45 min rule frees it if you are cut off: release it yourself.
- `tools/smoke-tiers.mjs` (app smoke check: loads the game, holds every tier, fails on page errors, an unbuilt world, a dead tier or a software renderer) takes the lock (`BENCH_NAME` names it), tracks its Edge, and logs `nvidia-smi` GPU memory/utilisation at the start and after the tiers (contention check).
- Matthew may be playing on omen meanwhile: that is allowed; say so in your report when frame times look contended.
- **Tests:** `npm test` (`tsx --test tests/*.test.ts`, node:test; 268 pass at f7d60c6, also in a git worktree). Not vitest: `npx vitest run` reports "No test suite found" for every file because the suites use node:test, not because of the worktree.

## 2026-10-18 — Gait Builder (Grok Bot): wolf pass 6, layered coat + procedural dark streaks (fork only)
- **Coat as layers** (`zoneCoat` in `fork/bodyTubes.ts`): BASE coat (photo tones: warm flanks, buff legs, paws), then a LIGHTEN mask (belly, throat/chest bib, cheek and muzzle mask, lower jaw, cheek ruffs) mixed toward cream, then a DARKEN mask multiplied over it (`colour × (1 − 0.75·min(1, darken·mask))`: broad saddle, shoulder band, tail top and tip, toe lines). The darken strength is `COAT.darken` (default 1, the best photo match; 0 = no darkening, 2 = very dark).
- **Dark guard-hair streaks** (`streakAt` / `streakCards`, Matthew's spec): thin near-black slices perpendicular to the spine, over the back and down the sides. Seeded per side from `proc/rng` (rig seed), with jitter in spacing, width, length (how far down from the dorsal line) and darkness, plus a gentle noise wobble down each streak (`valueNoise3`). They are densest and darkest over the saddle and shoulders (spacing ×1 there, ×1.7 toward the croup and neck), only ~30–50 % of streaks reach below the midline (sparse on the flanks), and there are none on the bib, belly, legs, head or tail. The 5 mm streaks are far finer than the skin's ~6 cm vertex spacing, so they are applied per fur card: each card's ROOT position picks its streak value, and the card's root and middle go near-black (×0.1 at full) while the tip, which is combed back along the spine, gets half, so the streak stays a slice instead of smearing backward. Colours only; same cards, same budget.
- **Lab controls:** `?darken=0..2`, `?streakSpacing` (default 0.015 model units, about 1.5 cm on the rig), `?streakWidth` (0.0035), `?streakJitter=0..1` (0.6; 0 = regular stripes), plus matching sliders in the panel (a change reloads the lab with the value in the URL, because the coat is baked at build time). The game under `?loco=1` uses the defaults.
- **Budget (lab `?stats=1`):** flat. 3 544 skin vertices, 12 983 cards (original rig 12 975; the card sampler follows the slightly wider paws), 49 039 triangles, 17 meshes, 2 shadow casters, 21 calls, 5 007 KB. Streaks change colours only.
- **Fold-back check fixed:** our round-2 paws were 6.8 cm wide, below `tests/body.test.ts`'s 7–11 cm, so the folded patch would have failed that test. The paws are now 8 % wider (about 7.3 cm). Verified in a temporary worktree at HEAD: `git apply MERGE.patch`, then `tsc` and the body, rules and fur-card tests all pass.
- Captures for this pass were taken under `tools/bench-lock.mjs`.
- **Fold back:** `fork/MERGE.patch` regenerated (base 56506c55, `git apply --check` clean): `COAT`, `streakAt`, `streakCards` and the layered `zoneCoat` go into `core/wolfBody.ts`, and `render/playerWolf.ts` wraps the game wolf's fur geometry in `streakCards(g, seed)`.

## 2026-10-18 14:20 PT - Grok Bot (trees M1): procedural black spruce, Weber-Penn base, near/mid/crown/impostor LODs, far-ring bench
Not in the live game yet: nothing in the game imports the new files. Viewer: `/tools/tree-viewer.html?tree=1`, with `&view=lod` (`&atlas=1`), `&view=one&age=&seed=`, and `&bench=far&r=260&split=160` (`&imp=0`).

### Base survey (Milestone 1)
| candidate | licence | conifer | bark / needle cards | LOD / impostor | seed determinism | cost |
|---|---|---|---|---|---|---|
| **SeedThree weber-penn.js + branch-mesh.js** (SkyeShark, @cf2eaad) | MIT | good: W&P shape 0 conical, downAngle/curve per level gives drooping tiers | tubes; cards are ours | none (ours) | RNG injectable | ~10 ms/tree |
| ez-tree (dgreenheck, @dcf309b) | MIT | weak (broadleaf recursion, image textures) | image textures | none | seeded | medium |
| proctree.js | BSD-3 | broadleaf only | leaf cards | none | seeded | cheap |
| space colonization | various | broadleaf crowns | none | none | ok | slow (attraction points) |
| Blender Sapling (W&P) | GPL | the reference implementation | n/a | n/a | n/a | paper only |
| repo vendor/plant-generator | MIT | herbs only | n/a | n/a | yes | n/a |
| **agargaro/octahedral-impostor** (@ca0046a) | MIT | (impostors) | albedo + normal/depth atlas | hemi-octahedral 3-sprite blend, WebGL GLSL | n/a | 1 bake per variant |

Choice: a Weber & Penn (1995) port tailored from SeedThree, plus octahedral-impostor for the far LOD. Both are MIT; unmodified baselines are in `vendor/seedthree` and `vendor/octahedral-impostor` (NOTICE.md in each).

Why: W&P is parametric per level, so a species is a parameter table (`src/core/flora/trees/forms.ts`, data), not code. The generator is a pure function of (seed, age) through proc/rng, and conifers come straight out of shape 0 + whorls.

### Files
- `src/core/flora/trees/forms.ts`: species form data: W&P params, growth, colours from photo medians, citations; `heightAt` (Richards, [verify] Plonski 1974) and `dbhAt` (inverse Peng et al. 2001 H-DBH, the core/treeSpecies coefficients).
- `src/render/trees/weberPenn.ts`: skeleton with trunk whorls (whorlSpacing from core/treeSpecies), dead lower stubs, a club-top band, a conical shape cap and tropism.
- `tube.ts`: parallel-transport tubes, vertex colours.
- `conifer.ts`: `buildConifer(form, seed, age)` gives near (tubes + cross-cards with baked AO), mid (thinned tubes + one spray card per limb) and crown (trunkless, 38 tris).
  - Needle atlas: DataTexture with shade-filled transparent texels, Golus mip-alpha, alphaToCoverage.
  - Crown material follows Matthew's wide-view architecture: per-instance palette by `vnoiseU(worldXZ/70)` + hash jitter, fake vertical AO `mix(.25, 1.15, y)`, up-bent normals. Uniform-only, one program key.
- `impostor.ts`: tailored octahedral-impostor (sRGB albedo target, mip-alpha in the bake, renderer state restored, normals bent up via `IMPOSTOR_FX`).
- `farRing.ts`: crowns inside `split`, impostors beyond, one InstancedMesh per variant. Placement comes from `farTreesInTile` (Thomas clusters, core/flora/stands); variant, rotation and non-uniform scale come from `hash(key)`. No Math.random, no FogExp2.
- `tests/trees.test.ts`: allometry, determinism, spire taper.
- `tools/tree-ref/`: 10 Commons photos (CC BY / BY-SA / PD), SOURCES.json, README.

### Numbers (omen, RTX 5060 Laptop, Edge 155 headless D3D11, under the bench lock)
- Triangles per LOD, age 90 / 13.4 m / DBH 14.9 cm: near 47,850 | mid 3,516 | crown 38 | impostor 2.
- Near triangles by age (mean of 3 seeds): age 15 ≈ 6k; 35 ≈ 15k; 70 ≈ 33k; 120 ≈ 51k. Age 140 (16.2 m) is 73k.
- Build time, all LODs, CPU: mean 12.8 ms per tree over 12 trees (3.4–13.7 ms; the first call is 59 ms, cold atlas + JIT).
  - Single cold tree: 53–89 ms.
  - Impostors: 4 variants built and baked (1024² atlas, 8×8 sprites) in 252 ms, so roughly 50 ms per bake.
- Draw calls per tree: near 2 (bark + leaves), mid 2, crown 1 per InstancedMesh, impostor 1 per InstancedMesh.
- Far ring (1600×900, camera 120 m up):
  - r = 260 m, 26,176 trees (10,086 crowns + 16,090 impostors, 4 variants): **9 draw calls, 416k tris, GPU 0.94 ms** (timer query median, p95 1.01); render + readback 1.4 ms.
  - Same ring, crowns only: 5 calls, 995k tris, **GPU 0.54 ms**. On this GPU the 38-tri crowns are cheaper than alpha-tested impostors (overdraw), so prefer crowns to ~260 m and impostors only farther out.
  - r = 400 m, 61,975 trees (12,834 crowns + 49,141 impostors): 9 calls, 586k tris, GPU 1.68 ms.
  - Placement 78–146 ms, sync, for the whole ring. In-game this must go through the job scheduler per tile, as fartrees does.

### Known gaps (M2)
- Compared with the photos (`spruce-vs-ref.png`), the generated trees are too regular and too full. Real black spruce are scragglier: ragged, uneven limb lengths, gaps, layering skirts and a denser club. Add per-whorl limb drop-outs, a length jitter and broken tops.
- Colours: near foliage renders bluer and darker than the sunlit photos. The mid gain (1.9) and crown tint (.36) are matched to the near LOD in the viewer [game calibration]; recheck under the game's light and fog.
- The impostor albedo is yellower than near (blue low).
- Only black spruce. Next: jack pine, white spruce, balsam fir and tamarack from the same W&P tables, then aspen/birch with `uNormalUp` > 0.

### Upstream bug (octahedral-impostor @ca0046a)
`createOctahedralImpostorMaterial` replaces `#include <map_fragment>` after inserting its own chunk, and that chunk contains the same include inside a comment. The replace hits the comment, so the impostor shows the whole atlas or black. Fix: replace map_fragment first. Not reported upstream yet.

### Proposals (nothing of yours edited)
- Globe Builder: a one-line `?tree=1` route in `src/world/globe/entry.ts`, e.g. `if (q.has('tree')) { await import('../../render/trees/viewer'); return; }`, so the viewer opens at `/?tree=1`. Until then use `/tools/tree-viewer.html?tree=1`.
- Far filler (render/flora/fartrees.ts owner): swap the BatchedMesh LOD for `farRing`'s crown InstancedMesh per species group (crowns ≤ ~260 m, impostors beyond), behind a hook in trees.ts. Ask before the swap. The dark forest floor under thinning trees is a ground-colour mix by far-tree density (core/ground owner).

## 2026-10-18 Codex: wolf gallop and restored shoreline encounters
- Corrected rotary gallop contact order in core/animalBehavior.ts and animals/locomotion/gaits.ts to LH, RH, RF, LF; existing sequence was transverse. Research: Biancardi & Minetti (2012), JEB 215:4144-4156, doi:10.1242/jeb.073031, Fig. 1. Timing fractions remain game calibration, not measured wolf motion capture.
- core/world.ts exposes the existing dry-land placement predicate; render/buildScene.ts applies it to restored people too. Saved events/relationships are retained.
- Focused behavior/locomotion checks passed (24 tests), typecheck and build passed.
- Proposed coordinated rig correction (NOT applied): remove the independent wall-clock torso bounce in render/playerWolf.ts AND animals/locomotion/fork/playerRig.ts fallback together, retaining the distance-driven pose.bob. The fork is being edited; changing only the default rig breaks the exact-bone parity test. Also still needed for greater realism: articulated spinal flexion and filmed side-view comparison. Do not describe current motion as fully realistic.

## 2026-10-18 16:30 PT - Gait Builder (Grok Bot): wolf pass 7, procedural coat texture with streaks painted on the skin (fork only, appearance only)
- **Coat texture** (`coatTexture(seed, coat)` in `fork/bodyTubes.ts`): built at load from the seed and `COAT`, with no image files. 512 × 128 RGBA8 `DataTexture`, mipmapped: 256 KB, or 341 KB with mips (budget 0.5 MB). RGB holds a colour multiplier ÷ 2 over the vertex-coloured skin. The skin material's `color` is 2, so 128 is neutral. Over the trunk it holds the LIGHTEN mask (belly, throat and chest bib; per-channel gain toward the cream belly, capped at ×2), the broad DARKEN mask (saddle, shoulder band; `COAT.darken`) and the guard-hair STREAK slices (the same seeded `streaks()` list as pass 6, ×0.08 at full). The trunk's vertex colours keep only the base coat. Head, jaw, tail, legs and paws keep their per-vertex lighten and darken layers. Same controls: `?darken ?streakSpacing ?streakWidth ?streakJitter` and the lab sliders.
- **UVs** (`coatSkin(geometry, body)`): derived in the fork. Trunk vertices get u along the spine (croup z .185 → neck z -.29) and v around the trunk axis (atan2 about `TRUNK_AXIS`, with the belly as the seam). Every other tube samples a neutral 8-column strip. Wrapping triangles at the belly seam get duplicated vertices with v + 1 (`RepeatWrapping` in v): +23 skin vertices.
- **Fur** (`coatCards`, which replaces `streakCards`): each card's root samples the same trunk masks and streaks (`trunkMul`), so zones and streaks carry on from the skin into the fur. The streak gets the root and middle at full and the tip at half, so a slice doesn't smear backward. `furStyle().scaleAt` shortens cards by up to 12 % on the streaked sides (saddle and shoulders, from below the midline up to under the dorsal ridge). The topline and the belly keep their length, so the silhouette is unchanged.
- **Budget (lab `?stats=1`, walk t = 3.3 s, under the bench lock):** before: 3 544 skin vertices, 12 983 cards, 49 039 wolf tris, 17 meshes, 2 shadow casters, 23 main + 2 shadow-pass calls, 1 wolf texture (fur strand, 341 KB), 5 007 KB buffers, 5 348 KB wolf GPU total, renderer textures 3. After: 3 567 vertices, 12 972 cards, 49 006 tris, 17 meshes, 2 casters, **23 + 2 calls (unchanged)**, 2 wolf textures (683 KB, so +342 KB for the coat), 5 032 KB buffers, 5 715 KB total (+367 KB), renderer textures 4. The lab's `?stats=1` now also reports `wolfTextures`, `wolfTextureKB` and `wolfGpuKB`.
- **Fold back:** `fork/MERGE.patch` regenerated (base 56506c55). Verified in a temp worktree at HEAD ba5677d: `git apply` is clean, `tsc` passes, and the body, rules and fur-card tests pass (18/18). `coatTexture`, `coatSkin` and `coatCards` go into `core/wolfBody.ts` (which now imports three at runtime). `render/playerWolf.ts` calls `coatSkin` and sets the material map and colour 2 (non-portrait only).
- No movement or locomotion code was touched in this pass (Codex owns wolf movement). In `fork/playerRig.ts` only the skin material, UV and fur-colour lines changed.

## 2026-10-20 Codex: validated local commit
- Commit scope: music off by default; corrected rotary gallop offsets in both shared gait tables; restored people rechecked against dry land; regression tests.
- Full-suite validation exposed backward CPG phase during gallop-to-walk transitions. src/animals/locomotion/cpg.ts now allows coupling to delay a stride but not reverse it; the existing transition regression passes.
- Validation: npm test, 270/270 passing. Audio direction/scent thought UI is not implemented in this commit. Spine/hip reach remains coordinated follow-up work.

## 2026-10-20 Codex: sensory HUD (codex/senses, based on main 178e8ee)
- Six implementation/test files: src/main.ts, src/audio/borealSound.ts, src/core/senses.ts, src/ui/senses.ts, src/ui/senses.css, tests/senses.test.ts. Sound cues come from admitted positional audio events, are capped/coalesced and fade; UI directions follow camera yaw. Scent uses nearby entities and decaying scent/carcass/dropping deltas, sampled at the head sensor, with wind from the shared weather field. SVG thought pictograms distinguish unfamiliar, remembered and friend records; sensing never saves an entity.
- Reused the native Web Audio engine (zero dependency bytes) after considering three.js PositionalAudio/Helper (MIT, maintained, already installed but no reason to replace the existing engine) and Tone.js Panner3D (MIT, maintained, new package and duplicate routing). No external code copied. Scent math uses the Gaussian crosswind factor described by EPA ISC Section 6 eq 6-1 (https://archive.epa.gov/epawaste/hazard/web/pdf/1_06_air.pdf); its normalized range/width are game calibration, not measured wolf physiology.
- Fresh npm test: 284 pass; npm run build passes. Visual/gamepad acceptance remains for the integrated preview. No animation files touched. Grok will resolve the adjacent T-0006 contact-listener insertion in main.ts.
- T-0003 coordination posted on the task board: agree with gaitData contract, distance/stride phase, actual m/s, LF/LH/RF/RH ordering, same plan for phase/feet/reach, world metre translations converted once by WOLF_SCALE, retain nonnegative CPG rate. Claude owns isolated spine/hip changes; no competing Codex animal edits.

## 2026-10-21 codex: seasonal sky inspection (codex/sky-audit)
- Inspected live port 5173 in an isolated headless browser; archived video, six simultaneous screenshots and runtime date/solar calculations in refs/sky/season-audit. No production source changed.
- Proposed T-0022: sky defaults to day 227 after world clock reaches day 355; NOAA same-input altitude discrepancy 37.7156 degrees. Full open handoff tasks/handoffs/T-0022-codex.md; another agent's plan approval needed before claim.
- Reused existing CDP scripts and bench-lock; no new runtime dependencies. Added reusable audit skill under .agents/skills/boreal-seasonal-light-audit. Commented on T-0021 gate measurability and T-0008 missing current-gate evidence, with no approvals in others' names.
- npm test: 348 pass, 12 todo, 0 fail; npx tsc --noEmit passes. Both launched browser trees terminated. Served checkout/5173 process untouched.

## 2026-10-23 PT - Grok Bot: adaptive music stems (music/adaptive-stems, opt-in)
- **What:** four original loopable stems (night drone, day pad, weather swell, tension gate) in `public/music/stems/*.ogg` (4.4 MB total, Ogg Vorbis q4 so the decoded length is sample-exact; MP3 padding would click at the loop). Key A minor pentatonic, 90 BPM, 32 bars = 85.333 s = 3,763,200 frames at 44.1 kHz, about -20 LUFS each, peaks -5.9 to -7.3 dBFS. Synthesised from our own sample-lab chains, no ElevenLabs and no third-party audio. Description in `public/music/stems/manifest.json`, kept separate from `public/music/manifest.json` because `tests/music.test.ts` ties that one to the guitar tracks.
- **Code:** new `src/audio/adaptiveStems.ts` (native Web Audio: decoded AudioBuffers looped with `loop = true`, one GainNode per stem, equal-power night/day crossfade, rain and threat ducking, exponential smoothing). `music.ts` gets a minimal hook: new source 'Adaptive stems', `stems?.update(darkness, rain, threat)` in `update`, stop on source change. `musicSettings.ts` adds the opt-in flag.
- **Opt-in, default unchanged:** off unless the URL has `?stems`, then Menu > Music > Track > Adaptive stems. Without the flag the picker and saved settings behave as before. Stems start only inside `rebuild()`, which runs after the first-gesture audio start, so autoplay rules hold. The followWorld toggle is not needed for stems (they follow the world whenever selected).
- **Tests:** `tests/adaptive-stems.test.ts`, 12 `node:test` tests of the pure logic (weights, equal-power, ducking, sum cap, headroom against the -10 dBFS music compressor, smoothing, frame-rate independence, threat hysteresis, loop points, files/manifest, opt-in picker). The repo uses `node:test`, not vitest. npm test: 413 pass, 0 fail, 13 todo (baseline 401 pass, 13 todo); tsc and build pass.
- **Not verified:** nobody has listened to the stems (loudness and peaks were measured only). Playback in a real browser was not manually checked. Memory is about 120 MB of decoded buffers when selected.
- **Not wired:** the threat signal. `update` takes a third argument that defaults to 0 and `main.ts` is untouched. Candidate sources (not checked): player mode sprint/super-stealth, exhaustion, nearby predators.
- **Review needed:** this branch needs a non-author agent review (`tools/agent-review.mjs`) and green `ci` before Grok merges.

## 2026-10-24 PT - grokbot-3: register grokbot-3 as a Matthew relay and a distinct reviewer (T-0071)
Matthew in chat, 2026-10-24 11:36 PT, replied "switch" when asked whether to switch to grokbot-3 to match grokbot-1 and grokbot-2, and to add that name to `RELAYS_MATTHEW`. Branch `grokbot-3/relay-reviewer`. Not merged.
- `tools/tasks.ts` `RELAYS_MATTHEW` now includes `grokbot-3`, so a `"for": "matthew"` approve-plan or approve written by grokbot-3 counts the way one written by grok does.
- `tools/agent-review.mjs` `AGENTS` now includes `grokbot-3` (branch prefix `grokbot-3/`), listed before the bare `grok` prefix. grokbot-3 may review other agents' PRs and is refused on its own.
- `tasks/RULES.md` rules 16 and 17(c) list grokbot-3 with grokbot-1 and grokbot-2.
- `tests/tasks.test.ts` and `tests/agent-review.test.ts` cover the relay and the cross-review.
- New skill `notes/skills/grokbot-relay-reviewer.md` (T-0069 had `skill: false` and left no how-to). `notes/skills/board-rule-inspection.md` names the relay list.
- Nothing on screen. Evidence is the rule 12 table in `tasks/handoffs/T-0071-grokbot-3.md`. `npx tsc --noEmit` exit 0. `npm test` 630 tests, 616 pass, 0 fail, 14 todo; the board todo stays at 23 legacy rule breaks. A non-author `agent-review` is still open if the merger wants one. The task is completed, not approved, on this run.

## 2026-10-24 17:17 PT - grokbot-3: renumber the collided wolf-file task off T-0071 to T-0074
Matthew in chat, 2026-10-24 17:10 PT: "yes, automaticallly fix anything like this mmoving forward". Branch `grokbot-3/fix-duplicate-t0071` from main `71d5c46`. Not merged. main not pushed.
- Two files on main used id T-0071. The relay is `tasks/T-0071-grokbot-3-relay.md` (PR #54). The wolf-file landing from PR #55 is now `tasks/T-0074-land-orphan-task-files.md`. Next free id: `git log --all --name-only -- "tasks/T-*"` max is T-0073, T-0046 stays reserved, no T-0074 existed on any branch.
- Append-only. `tasks/events/2026-10-24T11-53-59-grokbot-3-propose-T-0071.json` is unchanged. New events, stamped by `/tmp/write-board-event.mjs`: comment `tasks/events/2026-10-24T17-17-25-grokbot-3-comment-T-0071.json`, propose `tasks/events/2026-10-24T17-17-27-grokbot-3-propose-T-0074.json`, comment `tasks/events/2026-10-24T17-17-28-grokbot-3-comment-T-0074.json` (`"for": "matthew"`, names old id T-0071, says this is not an approve-plan). T-0074 stays proposed, 20 cr, no claimant. The ledger row for T-0071 is the relay again, 30 cr, completed.
- `tools/tasks.ts` keeps the first filename when two files share an id and reports `duplicate task id`. `tests/tasks.test.ts` fails the suite on that (the legacy 22-break check is still a todo and would not have caught it).
- Skill `notes/skills/next-free-task-id.md`. `notes/skills/board-rule-inspection.md` and `notes/skills/grokbot-relay-reviewer.md` point at it. Handoffs: `tasks/handoffs/grokbot-3-loop.md`, `tasks/handoffs/T-0071-grokbot-3.md`.
- Nothing on screen. Evidence table is in `tasks/handoffs/grokbot-3-loop.md` under "2026-10-24 17:17 PT". `npx tsx tools/tasks.ts` after the events: 22 rule breaks, same count as before, no duplicate-id line. `npx tsc --noEmit` exit 0. `npm test` 640 tests, 626 pass, 0 fail, 14 todo; the board todo stays at 22 legacy rule breaks. PR https://github.com/BannonBotBoss/boreal/pull/61. Not merged.

## 2026-10-24 20:46 PT - grokbot-3: why chains name a placement cause and a live doing step (T-0016)
Issue #12. Branch `grokbot-3/why-every-object`. Not merged.
- `src/core/why.ts`: a placed object gets `by` on `grew`, `born`, `embedded` or `wandered` from `standAt` (years since fire), `gapLight()` (the existing gap-phase canopy), or the river channel. Hare and wolf chains say birth plus the interest ring or the player. `withDoing` appends one ongoing goal step and is not stored. `doingFromProblem` / `doingFromAgent` read the brain and the sim, and an unsensed explore says so.
- `src/core/world.ts`: the legacy river gaussian scale² is `LEGACY_RIVER_FOLD2` (110, the value `heightAt` already used).
- `src/ui/inspector.ts`: static objects, deer, hares and the player wolf show `inspectWhy` now and chain. The doing step is computed in `observed` and not written to a record.
- Tests: `tests/why-place.test.ts`. Skill: `notes/skills/why-chain-placement.md`. Handoff: `tasks/handoffs/T-0016-grokbot-3.md`.
- No new rate. The age check is exact equality with `standAt`; an age one year off fails.

## 2026-10-24 18:07 PT - grokbot-3: move the wolf-file landing from T-0074 to T-0076
Matthew in chat, 2026-10-24 17:10 PT: "yes, automaticallly fix anything like this mmoving forward". Same branch `grokbot-3/fix-duplicate-t0071`, PR #61. Not merged. main not pushed.
- T-0074 is grokbot-1's open PR #60 (`grokbot-1/wolf-jump-ballistic`, title and `tests/animal-behavior.test.ts`, no task file), opened about five minutes before PR #61. T-0075 is PR #64 (`tasks/T-0075-wolf-view.md`). After `git fetch --all`, the highest id in `tasks/` and `tasks/events` across every remote branch is T-0075. T-0046 stays reserved. The landing file is `tasks/T-0076-land-orphan-task-files.md`.
- Append-only for main. `tasks/events/2026-10-24T11-53-59-grokbot-3-propose-T-0071.json` is unchanged. The 17:17 T-0074 events existed only on this unmerged branch and were replaced. New events, clock-stamped: comment `tasks/events/2026-10-24T18-07-21-grokbot-3-comment-T-0071.json`, propose `tasks/events/2026-10-24T18-07-22-grokbot-3-propose-T-0076.json`, comment `tasks/events/2026-10-24T18-07-23-grokbot-3-comment-T-0076.json` (`"for": "matthew"`, names old id T-0071, says this is not an approve-plan). T-0076 stays proposed, 20 cr, no claimant. T-0071 stays the relay, 30 cr, completed.
- `notes/skills/next-free-task-id.md` now says to scan open PR heads (titles, bodies, and labelled tests), because skipping those caused the T-0074 collision. `tools/tasks.ts` duplicate-id check is unchanged. `tests/tasks.test.ts` expects T-0076 and no live T-0074 task or event.
- Handoffs: `tasks/handoffs/grokbot-3-loop.md`, `tasks/handoffs/T-0071-grokbot-3.md`. Nothing on screen. `npx tsc --noEmit` exit 0. `npm test` 640 tests, 626 pass, 0 fail, 14 todo; the board todo stays at 22 legacy rule breaks. `npx tsx tools/tasks.ts`: T-0071 completed, 30 cr; T-0076 proposed, 20 cr; no `duplicate task id` line.

## 2026-10-24 18:39 PT - grokbot-3: T-0004 surface bands claim and the plan's 0.85-1.15 contrast
Branch `grokbot-3/surface-bands` off main `71d5c46`. Claim event after claude's approve-plan (2026-10-20 16:45 PT). The chunk was already on main; this pass locks it to the spec.
- `src/render/bands.ts`: `wantsBands`, `applySurfaceBands`, one fragment chunk before `#include <alphamap_fragment>`, noise from `proc/glsl` `GLSL_NOISE` only. Program key is the previous key plus `|bands`. `?bands=0` off, `?bands=<amp>` sets the half-range. Default amp is now 0.15 (diffuse × 0.85-1.15), the plan. The earlier preview used 0.30 so the bands would read; that was wider than the plan. Matthew still owns the shipped on/off. The spec says this preview branch is ON.
- `render/batch` still calls `applySurfaceBands` before `fadeOptIn`. Trees still set `userData.bandsMask` to bark only. Logs (`LOG_MATERIAL`) and rocks (`ROCK_MATERIAL`) stay opted out because they ship their own pattern. Terrain (`render/pbr`) and animals are not on this path. The wolf rig still sets `userData.noBands`.
- `tests/bands.test.ts` covers the selection rule, the shared key, a single noise paste, the bark mask, the fade key, and the query switch. Skill: `notes/skills/surface-bands.md`. Task header `skill: surface-bands`.
- Spacing (full sine cycle): 0.357 m vertical, 0.500 m along +X, 0.556 m along +Z (`bandCycleM`). That is decimetre scale (Bondy gneiss veins), coarser than the 11.1 cm bark window in Juola, Hovi & Rautiainen 2022, Ecol. Evol. 12:e8718. Contrast CV of a 0.15 sine is about 10.6%, inside that paper's 8-32% between-tree CV for non-birch species. The paper did not measure along one trunk. Numbers gate is not a pass.
- Headless SwiftShader stills: `tasks/evidence/T-0004/`. Warm trunk pair, Minimum tier: 74 program links with bands and 74 without; 4 fragment sources contain the chunk when on, 0 when off. Median rAF 299.6 ms on vs 309.1 ms off. Center-box mean absolute luminance 0.51 (known match 0; a synthetic 0.15 sine moves CV by 0.020, the trunk pair by 0.00008). Not the omen 5% gate. No complete event.
- Main still has two `T-0071` task files. PR #61 already renumbers the orphan file to T-0076. This branch only comments; it does not take T-0076 again.
## 2026-10-24 17:40 PT - grokbot-3: wolf follow view (T-0075, issue #52)
Matthew, issue #52, 2026-10-23 19:14:55 PT: "please use this and refine the view of the wolf, as well as the wolf itself". Branch `grokbot-3/wolf-view`. Not merged, not self-approved.
- Adopted the existing follow camera and the existing tube wolf. `positionCamera` now stands 1.05 m up, 3.6 m behind and 2.25 m to the wolf's left (32°), pitch −5°. Wolf `cameraHeight` reads that eye height. The landing clearance line uses the same flank.
- Timber-grey stops are a darker gray with a cream belly (Gipson, Bangs et al. 2002 for the grey morph; the RGB triples are [verify]). Shoulder guard hair 10.5 cm, inside 9–13 cm (Wikipedia "Wolf"). Back stays 6–7.2 cm. Tail plume ~12 cm [verify: no separate table]. Pale tips on the upper-body cards (Young and Goldman 1944 [verify page]). Game fur cards 18000. The fork rig was left at 13000.
- Mass is `rigMass` of the player wolf on the canid plan: 73.4 kg. Not assigned.
- Scores in `refs/wolf/view/score.json`. wolf-frame v1 (geometry) 0.987, legacy camera 0.559. box-histogram v1 against the issue image: before 0.111, after 0.149. The 0.95 pixel gate is not met.
- `npx tsc --noEmit` exit 0. `npm test` 644 tests, 630 pass, 0 fail, 14 todo. Skill update is the T-0075 section of `notes/skills/visual-inspection-recording.md`.
