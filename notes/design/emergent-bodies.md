# Emergent bodies: spec (grokbot-1, 2026-10-24; board task T-0070)

## Matthew's rules (chat, 2026-10-24 01:3x–01:53 PT, relayed verbatim where quoted)
1. "the distance from its core outwards, should be an axis… surface… would equate to the diameter". Every object has its centre at 0, the centre of mass, and any point is r·û. "any direction outward is a vector".
2. "so this way, we can have altitude". h = r − R_surface(û) is the single altitude source; negative h is depth.
3. "we should only create particles". Parcels of numbers, not atoms, modelling behaviour and interaction through time.
4. "when the numbers cross a threshold, they create an object with mass". Objects are found, never declared.
5. "that is how it should be generated, not (create a sphere)". No sphere primitive for a body.
6. g derives from G·M/r² via the constants graph: g(R_mean) = 9.820. With J2 and spin it is 9.780 at the equator and 9.832 at the pole, matching WGS84 Somigliana within 0.002.
7. "allow for the modelling of gases". The column uses cited composition (N2 78.084, O2 20.946, Ar 0.934 % from NOAA/CRC; CO2 from NOAA GML, with the climate seed in deep time).
8. "as the sun's rays come in, that number is also known, it travels through a gradient of gases, some of it reflecting back out, where there is cloud cover, and some heating the crust". TSI 1361 W/m², checked against CERES / Trenberth 2009 (100 / 78 / 161 W/m²).
9. Earth arises from altitude × lat × lon plus materials and physics, steered by real measurements. "all of this is in the repo": reuse first.

## Reuse audit (checked 2026-10-24; licences from each repo's licence file)
| Piece | In Boreal already | External | Licence | Decision |
|---|---|---|---|---|
| Constants graph | `src/data/constants.json` → `tools/gen-constants.ts` → `rust/.../constants.rs`, `src/core/constants.ts` | — | own | **Reuse.** Added dry air, CO2, g_earth_mean, earth_moi_prem (b80823a + this commit) |
| PREM interior | Facts only: `src/core/geodynamo.ts` INTERIOR (ranges, no profile) | PREM paper | public | **Built** `interior.rs` (density polynomials, mass, P, g); geodynamo facts kept |
| Gas column | `column_budget.rs` uses fixed columns (ozone 0.3 atm-cm, PW); `composition.ts` Rayleigh; no USSA76 | USSA76 (public domain); VIRA (paper); NRLMSIS 2.0 | NRLMSIS: NRL-SOF-014-1, no modification, non-commercial | **Built** `gas.rs` from USSA76/VIRA; NRLMSIS rejected |
| Radiative transfer (SW) | **`column_budget.rs`** Lacis & Hansen 1974 + two-stream cloud + aerosol, closes to Trenberth within 5 W/m² (8a07022), used by `update_energy.rs` | RRTMG (AER; BSD-3-style, to recheck before porting) | — | **Reuse** column_budget. The only change is to feed its ozone and water from `gas.rs` (stage 4), not to replace it |
| Radial frame / altitude | globeView `R + ground + alt`, `?dir`, `?latlon` | — | own | **Reuse**; `figure.ts` now supplies R_surface(û) |
| Isosurface meshing | none (cube-sphere heightfield, `cube.ts` from SimonDev quadtree) | Transvoxel (Lengyel; tables public), `transvoxel-rs` | MIT/Apache (crate, to pin) | Port when caves/cutaway need it (stage 7) |
| Particle / SPH core | none (`docs/deep-time-causes.md` cites SPH results only) | SPH-EXA | **MIT** | **Port the method and code** (attributed) |
| Planet initial conditions | none | WoMa | **GPL-3.0+** | Method only (Ruiz-Bonilla 2021) |
| EOS | none | SWIFT planetary EOS | LGPL-3.0 | Tillotson from the paper (Melosh 1989 parameters) |
| Self-gravity / N-body | Statistics only (`docs/deep-time-causes.md` Chambers, Kokubo; MEGNO plan) | REBOUND GPL-3.0; Gadget-4 GPL-3.0+; ChaNGa GPL-2.0; Phantom GPL-3.0+ | GPL | Methods only; Barnes–Hut written from the 1986 paper |
| Neighbour search | none | kiddo | MIT/Apache | **Use the crate** |
| Bound-object finding | Roche and Hill facts in `docs/deep-time-causes.md` §2 and §5 | SUBFIND (inside GPL Gadget), AHF (licence unverified) | — | Method only: FoF + unbinding |
| Live GPU particles | none | WebGPU-Ocean, jeantimex/fluid | **MIT** | Reuse the compute and splat pipeline |
| Near-camera detail | `planet.ts` ridged multifractal + fBm (Musgrave 1989), `rocks.ts`, trees | Procedural survey ([pages.grok.bot](https://procedural-generation-techniques-a-bmfj.pages.grok.bot/), canvas 9adc8a3b) | — | **Reuse** the chunk-independent noise conditioned on baked fields; see below |
Full licence table with links: `tasks/T-0070-bodies-from-density-fields.md`.

## Two-tier architecture (from the procedural survey)
- **Whole-map physics, baked.** Particles, self-gravity, relaxation, climate and erosion run coarse over the whole planet and do not stream. They bake fields over (r, lat, lon): density, material, terrain height, climate.
  - Erosion is baked per macro-region (Mei et al. 2007 GPU hydraulic; Sebastian Lague droplet erosion, MIT).
- **Near-camera detail, streamed.** Chunk-independent methods conditioned on the baked fields: fBm + domain warp, Worley/cell points, PCG integer hashes keyed on (seed, chunk, layer).
  - Vegetation: instanced L-system variants. Poisson-disk sampling stays inside a chunk with a margin.
  - Use GPU compute where the survey lists it; pin the noise library versions.

## Staged order (each stage: Rust/WASM sim code, toggle, pad, tests, push.sh, images)
1. **Earth shape without a sphere.** Done in this commit.
   - The surface is where the material field (PREM to gas.rs) goes from condensed to gas: 6371.0005 km.
   - Figure from Darwin–Radau with C/MR² = 0.330799 (PREM-integrated): 1/f = 299.69 (WGS84 298.257, −0.48 %), a = 6378.10 km (WGS84 6378.137), c = 6356.82 km (6356.752).
   - Tiles and camera altitude use `figureRadius(û)`.
   - Still spheres: the atmosphere dome (`atmosphere.ts:211`) and the shader's ground intersection. Those go in stage 4/7.
2. Radial frame and altitude: `?dir=lat,lon|body:sun`, `?r=`, slider, pad (stick aims û, trigger moves r), cutaway; `altitudeAt` replaces globeView's three calculations.
3. Gas column (`gas.rs`, pushed b80823a): readout and layer toggle.
4. Radiative transfer: `column_budget.rs` fed from `gas.rs` (O3 column, H2O path, Rayleigh optical depth from n(z)); TSI 1361 plus the solar cycle; Cox–Munk glint; CERES check.
5. Emergent objects: FoF + unbinding + count ≥ 20/100 + Hill/Roche; centre of mass gives the radial axis origin.
6. Particle formation (offline SPH, baked): relax to a hydrostatic Earth whose figure must reproduce stage 1; impacts.
7. Other bodies; Transvoxel near chunks; atmosphere dome replaced.

## Budgets
- Live view: ≤ 4e6 splatted particles, ≤ 2e5 live SPH, < 1.5 GB VRAM (8 GB card), 60 FPS target (current globe perf test unchanged).
- Offline formation: 1e5–1e6 particles, native Rust.
