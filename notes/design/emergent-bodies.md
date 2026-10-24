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
   - **First pass (approved by Matthew 04:37 PT, 2026-10-24).** Built in `formation.rs`, baked to `public/bake/earth-parcels.{bin,json}`, and drawn by `parcels.ts` (Axis → Parcels, key k, pad X).
   - Parcels: 48,000 equal-mass parcels from PREM's mass distribution. SPH uses the M4 kernel, Shepard per material class, and a PREM barotrope. Gravity is a Barnes–Hut tree, with spin. The run is damped for 2,000 steps (4.0 h simulated).
   - Measured vs real:

     | Quantity | Measured | Real | Error |
     |---|---|---|---|
     | M | 5.9732e24 kg | | +0.02 % |
     | R_vol | 6297.2 km | | −1.16 % |
     | J2 | 8.31e-4 | 1.0826e-3 | −23 % |
     | 1/f | 342.8 | 298.257 | |
     | C/MR² | 0.3007 | 0.3307 | |
     | g equator / pole | 10.013 / 10.067 m/s² | 9.780 / 9.832 m/s² | +2.4 % |
     | COM | 0.9 mm from the centre point | | |

   - Open:
     - J2 was still rising when the run stopped. Fix: a longer run or a lower-noise (glass) start.
     - Residual SPH density bias, which gives a smaller, more centrally condensed body. Fix: more parcels, Barnes–Hut quadrupoles, and an integral kernel-gradient scheme.
     - The ocean and atmosphere are not resolved at this parcel mass (about 11 ocean parcels).
     - Tiles still come from figure.ts, not from the bake.
     - Impacts and Tillotson EOS.
     - Chunk detail conditioned on the bake.
     - Live GPU parcels (WebGPU).
7. Other bodies; Transvoxel near chunks; atmosphere dome replaced.

## Budgets
- Live view: ≤ 4e6 splatted particles, ≤ 2e5 live SPH, < 1.5 GB VRAM (8 GB card), 60 FPS target (current globe perf test unchanged).
- Offline formation: 1e5–1e6 particles, native Rust.

## Core pass (2026-10-24, Matthew t242u "let's figure out this core"; boundaries rule t245u/t246u)

Rule: every boundary (inner/outer core, core-mantle, crust, ocean, air, surface) must come out of physics. No parcel is
seeded by PREM layer radius; PREM / WGS84 / US76 are for verification only.

Cause found (stage 6 bake): the density estimator was Shepard-normalised, rho_i = sum m_j W / sum (m_j/rho_j) W. Any
uniform field is a fixed point of that, so it only smoothed the starting PREM density and never responded to compression:
the bake's SPH density is flat 11106 kg/m3 through the whole core and 4632 through the outer mantle, while the actual
mass per shell volume reaches ~15000 in the core. Pressure therefore did not resist squeezing, so the body came out too
small (R -1.2 %), too centrally condensed (C/MR2 0.301) and with g +2.4 %. Fixed: standard summation density with h
iterated to consistency (Price 2012). The old 48-fold stratified start also put parcels in tight shells (summation read
~40 % high on it); the new start uses the SEAGen method (Kegerreis 2019, reimplemented, not their GPL code).

Core-mantle separation (done): start = a uniform mix, 32.5 % iron by mass (McDonough 2003), rest silicate, in a sphere
of the mix's uncompressed volume; cold Tillotson iron / basalt (Melosh 1989 table; data/earth/materials.json). Gravity
alone sorts it: separation index 0.32 -> 1.00 within ~1000 steps (~3.5 h simulated). Emergent core-mantle boundary
2937 km (PREM 3480 km). Bake: public/bake/earth-mix-6k.bin (6000 parcels, 20000 steps).

Why the numbers are off, in order of size:
1. Cold EOS: Tillotson at zero thermal energy has no thermal pressure, so iron squeezes to ~23000 kg/m3 at the centre
   (PREM 13088) and the planet to 5831 km. Next: carry specific energy u per parcel (gravitational energy released by
   differentiation + accretion heat, then an adiabat) and use Tillotson's full form; later ANEOS-class tables (methods only).
2. Basalt Tillotson is too soft for the lower mantle (A = 2.67e10 Pa vs PREM K ~ 2-6e11): needs a cited high-pressure
   silicate (forsterite/perovskite) parameter set.
3. Interface gap: plain summation across the iron/silicate jump over-reads silicate density next to iron and pushes it
   away, leaving an empty band at ~2700-3200 km. Fix with a published interface treatment (Ruiz-Bonilla et al. 2022,
   MNRAS 512:4660, or density-independent SPH, Saitoh & Makino 2013), methods only.
4. Resolution: 6000 parcels leaves the mantle as ~4 parcel shells; J2 still wobbles 6.5-7.8e-4 between outputs.

Rest of the boundaries (plan, not done):
- Inner core: temperature per parcel from u (above) and the iron melting curve of Anzellini et al. 2013 (in materials.json);
  parcels with T < T_m(P) freeze (solid flag / denser phase). The inner-core boundary is where the adiabat crosses T_m.
- Crust: partial melting of the silicate where T exceeds a cited peridotite solidus (Hirschmann 2000) makes a light melt
  fraction that rises; needs a lighter material class.
- Ocean, air: volatiles (ocean 1.4e21 kg, air 5.15e18 kg, cited in materials.json) are below one parcel at <= 48k parcels;
  they need a lighter tier (split parcels / a separate fluid shell computed from the outgassed mass), with surface
  temperature from the existing energy budget to decide liquid vs vapour.

## Core pass 2 results (2026-10-24, 6k parcels, hot.rs: 6000 hot + 6000 cooling steps)
Measured (PREM for checking only): R_vol 6532 km (6371), CMB 3541 km (3480), ICB 3117 km (1221.5), centre 14274 kg/m3 (13088), 375 GPa (364), 5650 K;
C/MR2 0.316 (0.3307), 1/f 328 (298.3), g_eq 9.30 (9.78), separation 0.993. The mean SPH density follows PREM through the mantle; the core is 0-15 % dense.
Inner core too big: this is pure iron (no light elements), so its melting point at the CMB (~4100 K, Anzellini 2013) is above our core-top T
(mantle bottom + 1000 K boundary layer, Lay 1998). Real outer core is liquid because S/O/Si lower the melting point (Alfè et al. 2002), not yet modelled.
Open: light-element melting depression, GDF f_i term, time-compressed cooling, escaping surface parcels (vmax ~1.5 km/s), COM drift 19 km, latent heat,
no phase changes in Tillotson, crust/ocean/air not differentiated yet; 24k run in progress.
