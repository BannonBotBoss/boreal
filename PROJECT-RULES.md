# Boreal project rules (read first)

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

## Checks before you commit
1. `npx tsc --noEmit` and `npm test` (includes `tests/rules.test.ts`) are green.
2. If you fixed an allowlisted legacy file, remove it from its allowlist. The lists only shrink.
3. Add a dated entry to `AGENT-NOTES.md` saying what you changed and which files.
4. Don't edit another agent's in-progress files. Propose the change in `AGENT-NOTES.md` instead.
