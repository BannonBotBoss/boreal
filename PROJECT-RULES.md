# Boreal project rules (read first)

The last twenty GitHub issues take precedence. Where they conflict with each other, with older issues, or with these rules, plans, tasks, notes, or code, the latest issue wins: a higher number wins. The twenty are #99, #100, #101, #102, #103, #104, #105, #106, #107, #108, #109, #110, #111, #112, #113, #115, #116, #117, #118 and #119. An issue opened after these wins over them the same way. This replaces the 2026-10-25 7:17 PM line that stopped at #100–#109. The resolutions are tasks/RULES.md rule 18. (Matthew, 2026-10-26, in chat: "i want the last 20 issues to take precedence, any conflict, the latest issue wins.")

## Talking to Matthew
This section binds every agent: Grok, Grokbot-1, Grokbot-2, grokbot-3, claude, agy, and any other agent. Read it before you write to Matthew.

1. Keep every message to Matthew short: two or three plain sentences about what he will see or experience in the game. No file paths, function names, code or jargon unless he asks.
2. Never use abbreviations or acronyms with him. Say "the change is ready for review" (not PR), "the automatic tests passed" (not CI), "merged into the game" and "left bumper button" (not LB). Spell everything out.
3. Before building anything he asked for, restate in one plain sentence what you think he wants, so he can correct a wrong guess early.
4. Ask at most one simple yes/no question at a time, and only when it is genuinely his decision. Don't ask common-sense confirmation questions. Just do the obvious follow-through.
5. Any plan, proposal or audit that needs his approval must open with a short "Plain-English summary" (about 12 short lines max, no jargon). It covers what the player will see and feel differently, what gets removed, what stays the same, any place where it differs from what he has asked for, and the decisions he needs to make as simple yes/no or A/B questions. He finds full plans too hard to read and otherwise approves them unread.
6. Never reinvent something. Reuse what already exists in the repo.
7. Matthew is not a coder. He is an artist who draws. Describe changes in visual, in-game terms, and show results with screenshots or short clips (before/after) rather than code descriptions.
8. He may send sketches to explain what he wants. Treat a sketch as the spec, and when it's unclear, ask one plain question about the picture. A little personality and warmth is welcome, as long as messages stay short and plain.

## 0. The purpose: live the lives of different animals
The game exists so the player can experience the life of any animal. Its challenges (hunger, cold and heat, thirst, speed and endurance limits, predators and prey, breeding seasons, ageing) are generated from real-world biological math applied to the species spec and to the simulated world. No challenge is hand-written for one species. See `CHALLENGES.md`.

These are Matthew's standing rules for every contributor, human or agent. `tests/rules.test.ts` enforces the parts that can be checked statically. `npm test` fails on a new violation.

## 1. Everything is procedurally generated
Terrain, trees, rocks, props, animals, and sound where feasible all come from seeded generators. Nothing is hand-placed, and there are no stored 3D models.
- All randomness comes from `src/proc/rng.ts` (`hash`, `random`, `stream`, `range`). **No `Math.random`** anywhere else. *(guarded)*
- Every generated thing is reproducible from `WORLD_SEED` plus a stable key (chunk, entity key, id). Render order is never used as identity.
- Recorded audio clips are allowed for voice, music and bird calls. Their *timing and variation* still come from `proc/rng`.

## 2. Minimize code, maximize sharing
A feature is data or specs fed into shared generators. Never per-instance bespoke code.
- One implementation each: RNG/hash (`proc/rng.ts`), shader hash/noise (`proc/glsl.ts`), math helpers (`proc/math.ts`), tuning values (`core/tuning.ts`), snapshots (`core/snapshot.ts`), post effects (`render/post.ts` param table), settings (`core/renderSettings.ts` schema). *(RNG and shader-noise duplicates are guarded)*
- LOD assembly and "icosahedron blob" geometry sites may only shrink until there is one mesh/LOD path. *(guarded)*
- A new setting, filter preset, sound event or biome is **one data entry**, not new code.
- Before you write a helper, search `src/proc` and `src/core` for one that already exists.

## 3. All animals share the same code
One pipeline: **species spec → skeleton (`skeleton.ts`/`species.ts`) → body + rig → behaviour layers → controls**. Species are data only.
- **A new animal = a new spec entry only.** No new species-named source files. *(guarded: today's species files are an allowlist that only shrinks)*
- Behaviour (graze, flee, freeze, herd, hunt) is a set of shared layers parameterised per species, all over `AnimalBrain`.
- Any animal can be player-controlled through the same `Playable` interface (`render/playables.ts`). No animal gets bespoke control code.
- Rewind/photo: each system registers one snapshot source. No per-animal snapshot code.

## 4. Everything has mass; gravity comes from G
- Constants live in `src/data/constants.json` (core/constants.ts `K`, docs/constants.md); `core/tuning.ts` `PHYS` G/Earth mass/radius read from it. `g = G·M/r²` comes from `proc/physics.ts` `gravity()`. **No literal 9.8 / 9.81** anywhere else. *(guarded)*
- **Never assign a mass** to an animal or any object. *(guarded)* Mass = Σ over regions/parts (torso, neck, head, legs, tail; trunk, crown; rock body) of **volume from the generated geometry** × that region's **composition-weighted density**.
- Materials (bone, muscle, fat, organ, blood, keratin, air, heartwood, sapwood, bark, needles, quartz, feldspar…) live ONCE in `core/materials.ts` `MATERIALS`. Compositions reference them by id with volume fractions that sum to 1 *(tested)*; fur = keratin + trapped air.
- So mass follows size (×2 size → ×8 mass, tested), and appearance edits change mass automatically. The inspector shows the region breakdown.
- Everything that moves steps through ONE integrator (`physics.step`). Inertia = force/mass (`accelLimit`), contacts exchange momentum (`collide`), impacts are ½mv² (`kinetic`). Static things still carry mass for interactions and the inspector.

## 5. Use real-world values everywhere
- Every constant and every table row comes from a published measurement and has a citation comment (author, year, venue or table).
- No invented numbers. A value from memory or derived gets a `[verify]` tag until it is checked against the source; pure game calibration says so.

## 6. The ground is layered material, not a hard surface
- Each ~2 m cell is a column: water, moss mat, litter (L), fragmented (F), duff, humus, mineral Ae/B with SOM, bedrock (`core/ground.ts`).
- Softness comes from pressure = weight / foot area (Bekker). It drives sinkage, landing absorption and movement cost.
- Trees and fauna deposit material. Decay follows the CBM-CFS3 chain (rates × Q10). Mass is conserved minus respiration.
- Time is closed-form: a cell is a function of seed + elapsed years, so catch-up is exact and there is no per-frame stepping.

## 7. Use established mathematical models, implemented as lightly as possible
- Physical, biological and atmospheric behaviour comes from a published model, cited by name in the code (for example NOAA solar position, Penman–Monteith, Stam Stable Fluids, Kessler microphysics, Olson/CBM-CFS3 decay, Bekker sinkage, Kleiber scaling). Ad-hoc rules are not allowed.
- Use the simplest established form that gives the right behaviour at game scale: coarse grids, closed forms and low update rates.
- Pure game calibration must be labelled as such in a comment.

## 8. Only what is near is real; everything else is math
- ONE interest system (`core/interest.ts`) is centred on the player, or the free camera in photo mode. Its tiers and radii come from `INTEREST`, and the render settings expose them.
  - **near**: full simulation and full render.
  - **mid**: cheap LOD and low-rate simulation.
  - **far**: no meshes, no stored per-entity objects and no per-frame simulation.
- Far state is a pure function of (seed, position, elapsed time): noise terrain, deterministic placement, closed-form ground decay, climatological weather (from solar input, season and latitude), and animal populations as density fields. Whatever enters range is instantiated from those functions, and whatever leaves it is disposed.
- This applies to every system: terrain chunks, ground cells, the weather grid, vegetation, animals, particles and sound.
- Instantiation runs as time-budgeted jobs (`enqueue`/`runJobs`, `INTEREST.budgetMs`) so it never stalls a frame. Write new builders as generators that `yield` between slices.

## 9. Only certain interactions persist, and only for a while
- The only stored world state is the sparse, capped delta log in `core/deltas.ts`. Each entry is `{kind, x, z, t, m}`. Examples are tracks, scent marks, carcasses, droppings, disturbed ground, broken branches, moved stones and felled trees.
- Each kind's lifetime and decay is ONE row in `DELTA_KINDS`, with a cited real rate or a `[verify]` tag. Deltas fade in closed form, are dropped when they expire, and their residue merges into the math layer that owns it (for example, carcass mass goes into the ground's decay chain).
- Everything else is NOT stored; it regenerates from the seed. The ground clock, the weather grid near the player and the delta log are the whole save.

## 10. Photoreal, but always smooth: one quality ladder, one governor
- Rendering is physically based: the Preetham sky driven by the NOAA sun and the weather cells, IBL from that sky (PMREM), ACES/AgX tone mapping with photo-mode exposure, procedural PBR surfaces (`render/pbr.ts`) whose wet and snow response comes from the ground state, CSM shadows, GTAO, Koschmieder fog, and needle translucency.
- Every cost knob is a column of `LADDER` in `core/quality.ts`, ordered best to cheapest (tested). No feature may add its own quality switch outside it.
- ONE governor (adapted from drei's PerformanceMonitor) measures work time and GPU time, and steps the ladder with hysteresis toward the target (60 fps on desktop, 72/90 Hz on Quest). The starting tier comes from the GPU (a discrete GeForce or Radeon starts at Ultra). It steps down only when frames miss the target, then recovers.
- Manual settings are CAPS. The governor may only lower quality below what the player chose, never raise it. WebXR applies `XR_CAPS` (Quest 3: about 100 draw calls, 750K triangles per eye, textures up to 2048).

## 11. Search for existing solutions first, in any language
Before building a feature, follow `adopt-and-tailor-existing-code`:
- Search npm, the three.js examples, the pmndrs packages, Shadertoy and GLSL/HLSL, C++ engines, Python and Fortran scientific code, and papers' reference code.
- Shortlist 2 or 3 candidates, recording licence, maintenance, size and the model each implements, and pick one.
- Prefer a native dependency. Otherwise vendor the code with its licence and source, or port it faithfully, then check the port numerically against the original.
- Commit the unmodified baseline first, then refactor it onto the shared modules. Keep attribution and test it.
- Record each adoption in `AGENT-NOTES.md`.

## Checks before you commit
1. `npx tsc --noEmit` and `npm test` (includes `tests/rules.test.ts`) are green.
2. If you fixed an allowlisted legacy file, remove it from its allowlist. The lists only shrink.
3. Add a dated entry to `AGENT-NOTES.md` saying what you changed and which files.
4. Don't edit another agent's in-progress files. Propose the change in `AGENT-NOTES.md` instead.
