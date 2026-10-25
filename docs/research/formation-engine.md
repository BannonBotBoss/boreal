# Formation engine: a time-driven solution for Boreal

## Recommended solution for Boreal

> **Hybrid: a small physics run for accretion, baked into a keyframe track, then Boreal's existing pure surface functions keyed to t.**
>
> The renderer never simulates while you scrub. It asks a pure function for the planet state at t and draws it. The only physics that runs is a one-off, deterministic accretion run in Boreal's Rust/wasm crate. Everything after the crust forms reuses code Boreal already has. This recommendation is my judgement, based on the sources below and a read-only review of the repo.

| Piece | File | Change |
| --- | --- | --- |
| Time axis | `src/core/deepTime.ts` | Keep as the single source of t (signed years from now). Add formation milestones before `earthAgeYr`: disc, planetesimals, embryos, Moon-forming impact, crust |
| Formation physics | new `rust/boreal-sim/src/formation.rs` | Seeded embryo N-body with merge-on-contact collisions. Writes a keyframe track: proto-Earth mass, radius, spin, molten fraction, impact list |
| Wasm bridge | new `src/core/formation.ts` | Loads the track the way `src/core/planetBudget.ts` loads the budgets. Exposes `formationAt(t)`, which interpolates keyframes, plus a TypeScript fallback |
| Layer gating | `src/core/layerExistence.ts` | Already gates plates over deep time. Add gates for magma ocean, crust, oceans and the craters-visible window |
| Surface | `src/world/globe/planet.ts` | `sampleSurface(seed, dir)` becomes `sampleSurface(seed, dir, state)`. Radius, oblate scale, sea level, crater stamps and relief amplitude come from `state` |
| Plates | `src/world/globe/plates.ts` | Keep the MORVEL Voronoi plates. Rotate them backwards by angular velocity times t, only inside the plates window |
| Tiles and LOD | `src/world/globe/tile.ts`, `tileWorker.ts`, `cube.ts`, `lod.ts` | Unchanged structure. Tile cache keys gain a quantized t bucket, so scrubbing rebuilds tiles only when the state changes |
| Disc view | new `src/world/formation/discView.ts` | Before a solid body exists, draw the track's particles as instanced points (WebGPU when available) |
| UI | `src/ui/chronometer.ts` | Log-time scrub dial, already the deep-time control |
| Handoff | `src/world/globe/handoff.ts` | Allow descent into the playable Kenora game only within a window near now; earlier t stays in the globe view |

### Data flow from t to the world

1. **t from the chronometer** — `deepTime` turns the dial position into years from now, on a log scale.
2. **State from the track** — `formationAt(t)` gives the bulk state (radius, spin, flattening, molten, crater density, sea level), and `layerExistence` says which layers are on.
3. **Surface per direction** — `planet.ts` evaluates relief, craters, plates and sea level for each unit direction, given seed and state.
4. **Tiles** — `tileWorker` meshes cube-sphere tiles at radius R(t) with oblate scale, cached by (tile key, t bucket).
5. **Climate** — `deepTime` luminosity feeds the Rust budgets (issue 47's boot order) for that epoch.
6. **Hand off at now** — `handoff.ts` passes the spot to the game's staged terrain (`core/stages`), unchanged.

### Phased plan

1. Milestone 1, accretion scrub: `formation.rs` runs about 2,000 seeded embryos and planetesimals for about 100 Myr with merges. Bake a track of about 200 keyframes. The globe radius grows with the largest body on the chronometer dial. Success test: same seed gives a byte-identical track, checked in `tests/`.
2. Phase 2, rounding and the magma ocean: flattening from spin, using the hydrostatic formula, with a molten shader before crust time and the differentiation milestone.
3. Phase 3, the Moon-forming impact as a scripted event, plus crater stamping that fades with t after the bombardment window.
4. Phase 4, oceans and plates: sea level fills from the crust window; plates rotate back along MORVEL poles.
5. Phase 5, link to now: the present-day surface is `planet.ts` today, so the last keyframe has to match it exactly, and handoff stays gated to that window.
6. Later, optional: an offline SWIFT or REBOUND run for higher-fidelity tracks, imported as keyframes. No runtime change is needed.

> **Main conflict**
>
> Boreal's surface is a pure function of (seed, direction) by design, and the home region is lifted to match Kenora today. Adding t keeps it pure, but every past epoch has to converge to today's surface at t = 0, or the handoff breaks. In my judgement the simplest rule is to blend each layer toward its present value inside the last window of the track.

## Architecture options

| Option | How | Pros | Cons | Fit |
| --- | --- | --- | --- | --- |
| Full physics | N-body, SPH and geodynamics from the disc to today | Physically honest | Research-grade compute: SWIFT Moon runs used up to 1e8 particles; can't scrub interactively | No |
| Hybrid (recommended) | Physics for accretion and impacts, baked to keyframes; procedural layers keyed to t after | Scrubbable, deterministic, reuses Boreal code | Physics fidelity limited to the bake | Yes |
| Pure procedural | Every stage a closed-form function of t | Cheapest; instant scrub | The sphere isn't formed by a process, which Matt asked for | Partial |

The fit ratings are my judgement.

## Physics methods per stage

| Stage | Method | Notes from sources |
| --- | --- | --- |
| Gravity, many bodies | Barnes-Hut tree, or fast multipole method | Barnes-Hut is O(N log N) with an octree rebuilt each step. FMM is O(N) in theory, but at about 1e-3 accuracy it did not beat Barnes-Hut even at N above 1e8 (CMU comparison) |
| GPU all-pairs | Tiled O(N squared) kernel | GPU Gems 3 chapter 31: shared-memory tiles, 16,384 bodies on an 8800 GTX. A WebGPU demo does 65,536 all-pairs in the browser |
| Planetesimals and pebbles | Streaming instability, then pebble accretion | Dense pebble filaments collapse into Ceres-size planetesimals. Pebble accretion speeds core growth 30 to 1000 times at 5 AU (Lambrechts and Johansen 2012). Use a parametric growth law, not a simulation |
| Embryos to planets | N-body with collisions | Chambers 2013 used 14 Mars-mass embryos plus 140 lunar-mass bodies, with hit-and-run and fragmentation (Mercury6). REBOUND offers IAS15 for close encounters and direct or tree collision search |
| Giant impact and Moon | SPH with self-gravity | SWIFT, about 400 runs up to 1e8 particles. Results converged above about 3 million particles (1e6.5); 1e5 to 1e6 often failed to converge (Kegerreis et al. 2022). Script this event for the game |
| Rounding and oblateness | Hydrostatic equilibrium | Gravity against spin; Earth's flattening is about 1/300, close to the ratio of centrifugal to gravitational force |
| Differentiation | Timed event | Core formation largely done within 30 Myr (Hf-W) |
| Plates, erosion, oceans | Procedural, from the planets section above | Already in Boreal: `plates.ts`, `core/stages` |

## Rendering as a function of t

- Fixed timestep in the bake, so the same seed gives the same track; the renderer only interpolates between keyframes.
- Keyframe density follows a log time scale: dense during accretion (Myr), sparse later (hundreds of Myr) (my judgement).
- Scrubbing reads the nearest two keyframes and never runs physics backward.
- Determinism: the bake runs once, in one engine (wasm), and the track is stored, so the renderer doesn't depend on float behaviour across browsers.
- Cache tiles per t bucket, so a constant-state scrub is free.

## From particles to a surface

- Radius field on the cube-sphere: per direction, take the outermost merged-mass radius, smooth it, and mesh with the existing `cube.ts` tiles. This is cheap and fits Boreal (my judgement).
- SDF plus marching cubes: splat particles into a density field and extract an isosurface, as GPU Gems 3 chapter 1 does for terrain. Use it for the impact phase, when the body isn't star-shaped.
- Hand over to the cube-sphere once the body is round and solid.

## Existing tools and browser feasibility

| Tool | What it is | Use for Boreal |
| --- | --- | --- |
| REBOUND | N-body code: IAS15 adaptive, WHFast symplectic, collision modules | Offline reference bakes; port of its ideas to Rust |
| SWIFT | Open-source SPH and gravity code | Offline giant-impact reference; import results as a scripted event |
| GADGET-4 | Parallel N-body and SPH, TreePM or FMM gravity | Reference only; cosmology scale |
| Mercury6 | Hybrid N-body integrator used by Chambers 2013 | Reference for embryo-stage setups |
| Universe Sandbox | Real-time simplified collisions: merge or fragment, conserving momentum, with impact heating | Its SPH prototype was shelved as too expensive for real time, which supports the hybrid approach |
| WebGPU demos | Gravity (65,536 all-pairs), WebGPU Galaxy (up to 4M particles), dgreenheck webgpu-galaxy (Three.js TSL, 750k) | Proof that disc-view particle counts are feasible |

Browser feasibility, my judgement from the demos: tens of thousands of all-pairs bodies, or about a million simple particles, run interactively on WebGPU. That is plenty for a disc view, but nowhere near SWIFT's resolution for impacts, so bake or script those. Space Engine was not researched here.

## Boreal today

| | |
| --- | --- |
| **Stack** | Three.js 0.180, TypeScript, Vite, tsx tests, plus a Rust crate `rust/boreal-sim` compiled to wasm (`package.json`, `rust/README.md`). |
| **Deep time** | `src/core/deepTime.ts` is already a pure t to planet module (solar luminosity, milestones from Earth forming to now). |
| **Globe** | `src/world/globe/`: cube-sphere quadtree adapted from SimonDev with skirts for cracks (`cube.ts`), quality-tier LOD (`lod.ts`), pure seeded `sampleSurface` with Kenora lifted as home (`planet.ts`), MORVEL plates (`plates.ts`). |
| **Local terrain** | Staged world per `WORLD-STAGES.md`: elevation, hydrology, rivers, soils in `src/core/stages/`. |
| **Handoff** | `handoff.ts` drops from globe to game below 2,000 m inside the home region. |
| **Open issues** | Planet climate boot order (47), Rust structure and planet budgets (46, 43), this report (50), wolf view (52), and a T-series board on animal behaviour, hunting, water, rivers and flora. |

---

*Research compiled 2026-10-24 by Grok Bot (read-only review of the repo; recommendations are judgement unless sourced). Full reading list: [sources.md](sources.md). Index: [README.md](README.md).*
