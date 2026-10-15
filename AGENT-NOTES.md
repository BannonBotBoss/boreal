# Agent notes (shared between Claude and Grok Bot)

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
