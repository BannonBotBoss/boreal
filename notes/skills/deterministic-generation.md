# Skill: Deterministic Generation Audit & Entity Replay (`deterministic-generation`)

Use this skill when auditing procedural generators against Issue `#97` (`Entity = G(seed, place, time, parent)`), checking that new systems introduce zero unseeded or visit-order-dependent randomness, or writing deterministic entity replay tests.

## 1. Canonical Formula (`#97`)

Every world or organism generator must be a pure function of up to four explicit arguments:
1. **`seed`**: Derived from `universeSeed -> worldSeedFromUniverse(universeSeed)` (`src/core/universeSeed.ts`) and branched via `hash`, `random` (`mulberry32`), `stream(seed, label)`, `sample`, or `hash2u` in `src/proc/rng.ts` (or `place_hash(lat, lon)` in `src/world/globe/coverKind.ts` / `rust/boreal-sim/src/cover.rs`).
   - **Refusal isolation**: When a site filter can reject candidates (e.g. `site.light`, `SITE.treeShare`), draw acceptance from an indexed sub-stream `random(hash(\`<tag>:${worldSeed}:${cx}:${cz}:${i}\`))()` or consume fixed draws per slot so changing a downstream filter never shifts subsequent entity identities.
2. **`place`**: Explicit cell/world/geographic coordinates (`(cx, cz)`, `(x, z)`, `(lat, lon, elevM, coastM)`), never iteration order of a `Set`/async fetch or camera history.
3. **`time`**: Explicit simulation clock `(year, day, hour, gameSeconds)` or fire/growth age (`fireAt(...).age`, `ageAfter(...)`), never `Date.now()` or `performance.now()`.
4. **`parent`**: Explicit parent structure or state (stand canopy `site.light`, cluster parent `(px, pz)` in `thomas(...)` / till `parents[i % 16]`, prey `cycle_lag_years`, maternal pose in `pupAim`, or base genome + `Edit[]` in `replay(log)`).

## 2. Unseeded & Wall-Clock Source Audit Procedure

1. Run across both TS and Rust trees:
   ```powershell
   git grep -n -E "Math\.random|crypto\.getRandomValues|Date\.now|performance\.now|new Date\(|thread_rng|OsRng|SystemTime|Instant::now|rand::" -- src/ rust/boreal-sim/src/
   ```
2. Classify every match:
   - **Allowed seed minting**: `src/core/universeSeed.ts` (`mintUniverseSeed`, guarded by `tests/rules.test.ts`).
   - **Allowed frame-slice / profiler / real-time clock plumbing**: `performance.now()` / `Date.now()` used strictly to cap work per animation frame (`interest.ts`, `batch.ts`, `tile.ts`, etc.), record `ms` diagnostics, or advance `worldClock.ts` real-time delta — verify the job's *output* does not depend on slice boundaries.
   - **Violation**: Any terrain, flora, fauna, weather, or cosmos generator reading wall clock, `Math.random`, `crypto`, or render/load order.

## 3. Replay Verification Pattern

Pin at least one named entity by calling its generator twice in different orders (e.g. after generating unrelated chunks/tiles first) and asserting `assert.deepEqual(first, second)`, plus asserting sensitivity to each of `(seed, place, time, parent)`.
