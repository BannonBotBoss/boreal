---
id: T-0070
title: Bodies, air and oceans are particles; fields and surfaces are derived from them
author: grokbot-1
scratch: false
research: false
skill: false
tags: [globe, render, sim]
credits: 60
---

# T-0070 Particles only: bodies, air and oceans as SPH parcels

Matthew in chat, relayed 2026-10-24 01:46 PT: "that is how it should be generated, not (create a sphere)."
Each body is a material/density field rho(r, lat, lon) about its centre. Its surface is the emergent isosurface where
solid or liquid meets gas. Its figure (oblateness) comes from hydrostatic equilibrium with spin.
Revised 01:47 PT, Matthew: "we should only create particles." The only primitive is the particle: a coarse-grained parcel with
mass, material (equation of state), temperature and composition. Density, pressure and gas mix over (r, lat, lon) are SPH kernel estimates
from the particles. Surfaces are isosurfaces of that derived density. The density-field plan below is superseded where it says "field".
Staged after T-0068's follow-ups: the axis, altitude, gas column and radiative transfer.

## Audit (2026-10-24, main at a130e4c)
| Body / part | Built now | Sphere primitive? |
|---|---|---|
| Earth surface | `world/globe/cube.ts` cube-sphere quadtree; `tile.ts:42` places each vertex at `r = R + max(h, water)` along `faceDir`, a sphere of radius R displaced by a heightfield | Yes in effect: an implicit sphere, spherical (no flattening), single-valued (no caves, overhangs or cutaway) |
| Earth atmosphere | `atmosphere.ts:211` `SphereGeometry(Ra*1000)` dome running the scattering shader | Yes, a SphereGeometry |
| Earth interior | none rendered; `interior.rs` (PREM) has the profile only | n/a |
| Moon | no mesh; `render/sky.ts` uses a light direction and a disc in the sky dome | No body at all |
| Venus | `render/venusSky.ts` a `THREE.Points` sprite | Point sprite |
| Mercury | gas column only (`gas.rs`); not rendered | n/a |
| Sun | a disc term in the atmosphere shader (`atmosphere.ts:197`) | Analytic disc |
| Ground sky (`render/sky.ts:74`) | `SphereGeometry(550)` hemisphere for clouds | Yes (ground view, not a body) |
Not bodies, so out of scope: eyes, noses and joints (`bear.ts`, `playerWolf.ts`, `rigSkin.ts`, `hare.ts`, `stickRig.ts`), rocks and tree icospheres (`rocks.ts`, `trees.ts`, `geometry.ts`), editor handles (`shapeTools.ts`, `lab.ts`).

## Existing systems: licence survey (checked 2026-10-24 01:50 PT from each repo's licence file / GitHub API)
Matthew: "I'm sure there is already a system that achieves this out there." There is, for formation and planet set-up, but the planetary codes are copyleft:
| System | What it does | Licence (verified) | Reuse |
|---|---|---|---|
| [WoMa](https://github.com/srbonilla/WoMa) (Ruiz-Bonilla et al. 2021) | Spinning layered planet profiles, then particle placement (SEAGen/stretched-equal-area) | **GPL-3.0+** (LICENSE.txt), not MIT | Method from the paper only (MNRAS 500:2861); no code |
| [SWIFT](https://github.com/SWIFTSIM/SWIFT) | SPH + gravity, planetary EOS (Tillotson, ANEOS, SESAME tables), giant impacts (Kegerreis) | **LGPL-3.0** | Methods only; EOS parameters come from the papers they cite |
| [SPH-EXA](https://github.com/sphexa-org/sphexa) | Exascale SPH + gravity (C++/CUDA) | **MIT** | Port its SPH core (kernels, gradients, time-stepping) to Rust/WebGPU with attribution |
| [Phantom](https://github.com/danieljprice/phantom) | SPH, astrophysical | **GPL-3.0+** with a name condition | Method only (Price 2012 review) |
| [Gadget-4](https://gitlab.mpcdf.mpg.de/vrs/gadget4) | SPH/N-body cosmology | **GPL-3.0+** (GitLab API) | Method only |
| [ChaNGa](https://github.com/N-BodyShop/changa) | SPH/N-body (Charm++) | **GPL-2.0** | Method only |
| [REBOUND](https://github.com/hannorein/rebound) | N-body orbits (no hydrodynamics) | **GPL-3.0** | Method only (WHFast, IAS15 papers) |
| [kiddo](https://github.com/sdd/kiddo) | Rust kd-tree, neighbour queries | **MIT OR Apache-2.0** (crates.io) | Use directly as a crate |
| [WebGPU-Ocean](https://github.com/matsuoka-601/WebGPU-Ocean) | WebGPU SPH fluid + screen-space fluid rendering, ~1e5–1e6 particles | **MIT** | Reuse its WebGPU SPH grid and splat renderer, with attribution |
| [jeantimex/fluid](https://github.com/jeantimex/fluid) | WebGPU SPH and PIC/FLIP | **MIT** | Alternative reference for WebGPU neighbour search |
Not adopted: rapier (rigid bodies, not SPH). ANEOS/M-ANEOS licence is not yet checked; Tillotson (published formula) is the default.

### Recommended reuse path
1. Initial conditions: WoMa's method, reimplemented in Rust from the paper and not from its GPL code.
   - Build a spinning hydrostatic layered profile (PREM layers, constants-graph G, M, ω), then place particles on spherical shells by stretched equal-area tessellation.
   - Compare flattening and density against WoMa's published Earth cases.
2. SPH core: port SPH-EXA (MIT) kernels, density/force loops and time-stepping to Rust, compiled natively for formation and to WASM for small runs.
   - Neighbours via `kiddo`; gravity via a Barnes–Hut tree written from Barnes & Hut 1986.
   - EOS: Tillotson with Melosh 1989 parameters (SWIFT's tables are used only as a cross-check of values, with their papers cited).
3. Live/visible tier: WebGPU-Ocean (MIT) compute pipeline and screen-space splat renderer, adapted for split/merge particles and self-gravity off (a fixed relaxed field near the camera).
4. Giant impact: the method follows Canup 2004 / Kegerreis 2019 and Lock & Stewart 2017, and runs offline on our own Rust SPH.
   - No SWIFT/Gadget code.
   - Validate against the published outcomes: disk mass, angular momentum, iron fraction.

## Objects emerge from particles (Matthew, relayed 01:49 PT: "when the numbers cross a threshold, they create an object with mass")
No object is declared. A body exists when a group of particles passes these tests, applied every N steps:
1. **Grouping**: friends-of-friends (Davis et al. 1985). Linking length b times the local mean spacing; in SPH use b ≈ the smoothing length h (b = 0.2 is the cosmology value). Neighbours come from `kiddo`.
2. **Unbinding**: iteratively drop particles with KE + PE + U > 0 in the group's centre-of-mass frame, until stable. This is the SUBFIND unbinding loop (Springel et al. 2001; method only, since its code ships in GPL Gadget). AHF (Knollmann & Knebe 2009) has the same idea; its licence is unverified, so method only.
3. **Minimum count**: ≥ 20 bound particles to exist (the SUBFIND default) and ≥ 100 before mass, spin or layers are trusted (resolution studies, e.g. Kegerreis et al. 2019). Below that, it remains loose particles.
4. **Hill/Roche**: a group survives only if its radius < Hill radius a(m/3M)^(1/3) relative to the most-perturbing neighbour.
   - It must also lie outside that neighbour's fluid Roche limit 2.44 R (ρ_M/ρ_m)^(1/3) (Chandrasekhar 1969), unless it is held by material strength (Holsapple & Michel 2006).
   - Inside, the group is a disk/debris, not an object (e.g. the proto-lunar disk until the Moon accretes outside ~2.9 R_E, Canup 2004).
5. **Properties are summed, never set**:
   - Mass = Σm; centre = centre of mass, which becomes the origin of that object's radial axis (û, r, h from the existing radial code); spin L = Σ m (r × v), giving ω from the inertia tensor.
   - Layers by material sort: radial order of the EOS materials (iron, silicate, water, gas) gives the core/mantle/ocean/atmosphere boundaries, the inputs for the interior profile and the surface isosurface.
6. **Scale-appropriate cohesion (later)**: the same FoF + "bound" loop with the binding energy swapped.
   - Drops: surface energy, Weber number We = ρv²d/σ < ~12 (Pilch & Erdman 1987).
   - Grains/aggregates: van der Waals / JKR contact energy (Johnson, Kendall & Roberts 1971).
   - Gravity dominates once the body's binding energy exceeds the material-strength energy (Holsapple 1994; transition ~100s m to km).
Test cases:
- A relaxed Earth gives exactly 1 object with mass GM_earth/G within 0.1% and ω = ω_earth.
- A canonical impact gives Earth + disk, then a Moon object after accretion.
- Two particles flying apart give no object.
- A thrown cloud of 10 unbound particles gives no object.

## Plan (particles only)
1. **Formation (offline, Rust; WASM for small runs).**
   - SPH with self-gravity: Barnes–Hut tree, plus kd-tree neighbours via `kiddo` (MIT/Apache, verified).
   - Methods follow Monaghan 1992 and Price 2012, with Wendland C2 kernels and the Tillotson 1962 EOS (published formula; granite/basalt/iron/water/ice parameters from Melosh 1989).
   - ANEOS/M-ANEOS: licence to be checked before use; Tillotson is the default.
   - Accretion, then the seeded giant impact, with two variants: canonical (Canup 2004: 0.13 M_E impactor, ~1.2e5 particles) and synestia (Lock & Stewart 2017/2018).
   - Licences: SWIFT is LGPL and Gadget is GPL, so the methods are reimplemented from the papers and no code is copied. The MIT SPH core is SPH-EXA (see the survey).
2. **Present-day hand-off.**
   - Map the impact outcome to layered particles; relax them to hydrostatic equilibrium with spin ω (damping).
   - Tests: flattening 1/298.257 within 1% (Darwin–Radau cross-check); PREM density at 10 radii within 5%; total mass = GM_earth/G.
   - Ocean and air are particle layers with water-EOS and ideal-gas parcels. Their T, p and mix must reproduce `gas.rs`, which becomes the reference test, not the source.
3. **Adaptive resolution.**
   - Particle split/merge by camera distance (Feldman & Bonet 2007 style splitting, conserving mass and momentum), keyed on the visible quadtree so only what is seen is refined.
   - Coarse particles far away; fine near the camera.
4. **Rendering.**
   - Far: splatting of particle density (screen-space depth splats, then the normal and shade).
   - Near: an isosurface of the SPH density on a chunk grid, then Transvoxel meshing.
   - Air: ray-march through the derived gas density.

### Honest particle counts and FPS (estimates, to be measured)
| Use | Particles | Where | Speed |
|---|---|---|---|
| Giant impact | 1e5–1e6 (Canup 2004: ~1.2e5; current papers 1e6–1e8) | offline native Rust, multithreaded | 1e5: hours; 1e6: ~a day on 8 cores for ~24 h simulated. Not in the browser. |
| Relaxed present-day Earth | ~1e6 global | WASM CPU | ~1–3 SPH steps/s; precomputed and shipped, not live |
| Live view, after split/merge | 2–4e6 visible | WebGPU compute + splat | ~30–60 FPS splat-only; SPH dynamics live for ≤ ~2e5 near-camera parcels (ocean/air) at ~30 FPS |
| VRAM | 64 B/particle → 4e6 = 256 MB; with neighbour grids and chunk meshes < 1.5 GB | | within 8 GB |
Limits, stated plainly:
- With 1e6 global particles each parcel is ~6e18 kg with a smoothing length of ~100 km. Mountains, coasts and ground detail exist only through local splitting near the camera; down to ~1 m that needs ~10 split levels and a strict visible-only budget.
- The far view at 1e6 particles will be blobbier than the current heightfield until the splitting is tuned.
- WebGPU compute is required; WebGL2 is a fallback with splat-only, no live SPH.

### Stages and gates (no migration before approve-plan)
- (a) SPH core in Rust: kernel, EOS, self-gravity. Tests: a Tillotson iron/granite planet relaxes to hydrostatic, mass and energy conserved to 1e-3.
- (b) Present-day Earth relax, with the flattening and PREM tests.
- (c) Canonical impact offline at 1e5, then the synestia variant. Images.
- (d) Splat render behind `?particles=1`, with a before/after image and FPS.
- (e) Split/merge near the camera; Transvoxel near surface.
- (f) Ocean and air as particles; `gas.rs` and the radiative transfer read their derived fields.
- (g) Moon, Venus, Mercury and the Sun (as particles, photosphere at τ = 2/3).

## Objectives
- [ ] Stage (a) SPH core with conservation tests.
- [ ] Stage (b) relaxed Earth: flattening 1/298.257 within 1%, PREM within 5%.
- [ ] Object finder (FoF + unbinding + count + Hill/Roche) with the test cases above; objects carry the centre-of-mass radial axis.
- [ ] Stage (c) canonical and synestia impacts offline, with images.
- [ ] Stage (d) to (f): Earth from particles behind `?particles=1`; atmosphere dome removed; before/after images; FPS measured within budget.
- [ ] Moon, Venus, Mercury and Sun migrated; images and figure tests.
- [ ] Remove the sphere-based globe path once the flag is the default (with Matthew's approval).
