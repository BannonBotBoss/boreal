# Skill: Chunk-Commit Animal Lifecycle (`chunk-commit-animal-lifecycle`)

## When to Use
Use this skill when streamed chunk jobs (`src/render/buildScene.ts`, `src/core/interest.ts`) instantiate dynamic entities (such as deer rigs in `animals` or contact edges in `CONTACTS`) across multiple yielded slices while a per-frame simulation loop (`simulateAnimals` in `draw`) prunes entities whose chunk is not yet in `chunks`.

## Root Cause Pattern
1. `createChunk(cx, cz, ...)` in `src/render/buildScene.ts` is a budgeted generator run via `enqueue('chunk:...', priority, createChunk(...), done)` and `runJobs()` (`src/core/interest.ts`).
2. `main.ts` calls `runJobs()` and then `draw()` -> `simulateAnimals()` on every frame.
3. Even after `createChunk` returns, `runJobs()` defers `job.done(result)` (`chunks.set(key, c)`) to a separate `finishing` step (`src/core/interest.ts:67-70`).
4. If `createChunk` adds an animal rig to `scene` and `animals` mid-generator before `job.done` runs `chunks.set(key, c)`, `simulateAnimals` computes `keys = new Set([...chunks.values()].flatMap(c => c.entities).map(e => e.key))` on an intermediate frame, sees `!keys.has(key)`, and deletes/disposes the newly created rig before the chunk commits.
5. Similarly, when a chunk already in `chunks` is rebuilt in place (`changed` or `near <-> mid` tier switch in `sync`), `chunks.delete(key)` removes the old chunk while `chunkJobs.has(key)` builds the replacement; pruning without checking `chunkJobs` drops the live animal state (`previous = animals.get(entity.key)`).

## Implementation Steps
1. **Prepare in the generator, commit in `done`**:
   - Inside `createChunk`, collect prepared `{ rig, entity }` pairs in a local `deer` array without calling `scene.add(rig.root)` or `animals.set(entity.key, ...)` (so cancelled chunk jobs also leave zero leaked rigs in `scene` or `animals`).
   - Return `deer` on the chunk record `c`.
   - In `enqueue`'s `done` callback, immediately after `chunks.set(key, c)`, call `commitChunkAnimals(c.deer, animals, scene)` to either update `entity` from `previous = animals.get(entity.key)` (and dispose the newly built duplicate `rig.root`) or add `rig.root` to `scene` and register `{ rig, entity }` in `animals`.
2. **Retain live animals across in-flight chunk rebuilds**:
   - Use `shouldRetainChunkAnimal(key, keys, chunkJobs)` (`keys.has(key) || chunkJobs.has(key.slice(0, key.lastIndexOf(':')))`) in `simulateAnimals` so an animal from a chunk currently rebuilding in `chunkJobs` is not pruned before the replacement chunk commits.

## Verification & Calibration
- **Unit test (`tests/deer-rig-commit.test.ts`)**:
  - Verify `createChunk` has no mid-job `animals.set` or `scene.add(rig.root)` call.
  - Interleave `runJobs(0)` (one slice per frame) with the `simulateAnimals` prune step on seed `1400` chunk `(1, 0)` and assert all three deer (`1:0:1`, `1:0:15`, `1:0:34`) survive chunk commit and remain attached to `scene`.
  - Verify tier rebuild (`chunkJobs.has('1:0')`) preserves moved animal state (`x`, `z`, `rotation`, `energy`) and disposes the duplicate prebuilt rig.
- **Calibrated live measurement (`refs/deer/t0047-deer-commit/capture.mjs`)**:
  - Metric: `chunkDeerSurvivalRatio = survivingChunkDeer / generatedChunkDeer` on seed `1400` chunk `(1, 0)` (`1:0:1`, `1:0:15`, `1:0:34`).
  - Known mismatch (pre-fix `tasks/evidence/2026-10-23-grok-loop-0216/deer-drop.json`): `0 / 3 = 0.000`.
  - Known match (post-fix): `3 / 3 = 1.000`, with deer `1:0:34` (`66.27, 30.91`) visible in `close-deer-post.png` and `still-deer-post.png`.
