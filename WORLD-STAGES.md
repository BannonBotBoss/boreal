# Staged world generation: design (Grok Bot, 2026-10-15)

Goal: the world is built in **stages**. Each stage is a pure function of (seed or real map, position) that reads only earlier stages.
Far away everything stays math. Only small, coarse global grids are precomputed, once per seed or map.
When a cell activates (core/interest near/mid), it samples the stage outputs and adds detail.

```
Stage 1  elevation      E(x,z)        seeded noise + erosion  |  real DEM tiles (setting: world.source = seed | kenora)
Stage 2  hydrology      fill, flow dir, accumulation, lakes, streams (Strahler), waterfalls, glaciers, ocean (sea level)
Stage 3  ground         surficial type from E, slope, TWI, distance to water: bedrock / thin till / sand / clay / peat
Stage 4  vegetation     stand map (core/stand: fire age) × site type → stand structure → trees, understory, CWD (live)
Slow     closed-form functions of time: paludification, peat accumulation, soil creep, frost heave, CWD decay (core/ground)
Runtime  near the player: shallow-water flow (virtual pipes), weather coupling (rain/snowmelt → soil bucket → streams)
```

## Grids and budgets
- **Coarse global grid (precomputed once per seed/map, cached in IndexedDB):** 512×512 at 30 m (≈15 km square, the size of the
  Kenora DEM window). Float32 elevation 1 MB, Uint8 D8 direction 0.25 MB, Float32 accumulation 1 MB, Uint16 lake id 0.5 MB.
  Precompute < 300 ms in a Web Worker (Priority-Flood is O(n log n); n = 262k).
- **Fine detail:** bilinear coarse elevation + seeded noise octaves below 30 m (the existing `surfaceDetail`). Activated chunks
  carve channels and lake shores at 1–2 m using the coarse flow network as polylines, so rivers stay continuous across chunks.
- Outside the 15 km window, the coarse grid tiles in a seamless toroidal layout (seed mode) or falls back to the seed (real-map mode).

## Stage 1: elevation
- **Seed mode (first):** fBm ridged noise tuned to Canadian Shield relief (local relief 20–60 m, knobby ridges NE–SW).
  Then hydraulic erosion on the coarse grid. Adopt first: a port of the particle-based erosion of Hans Theobald Beyer
  (2015, "Implementation of a method for hydraulic erosion", MIT reference implementations by Sebastian Lague) plus thermal
  talus relaxation (Musgrave et al. 1989). Run at 512² in the worker, deterministic from the seed.
- **Real map (after):** NRCan **HRDEM / CDEM** (Open Government Licence – Canada, attribution: "Contains information licensed
  under the Open Government Licence – Canada") or **Copernicus GLO-30** (free licence with attribution "© DLR e.V. 2010-2014
  and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA"). Tiles are fetched
  per window as Cloud-Optimized GeoTIFF via **geotiff.js** (MIT), resampled to 30 m, and cached. Licences must be re-checked
  before shipping. The setting `world.source` switches seed ↔ kenora.

## Stage 2: hydrology (one shared water system)
- **Depression filling:** Priority-Flood + ε (Barnes, Lehman & Mulla 2014, Computers & Geosciences 62:117). Adopt: port of
  Barnes' RichDEM algorithm (MIT/GPL-3? check; implement from the paper if the licence does not fit).
- **Flow direction:** D8 (O'Callaghan & Mark 1984) for the network. Optional D-infinity (Tarboton 1997) for wetness.
- **Flow accumulation:** topological order from the filled DEM (O(n)). Accumulation × runoff = discharge.
- **Lakes and ponds:** filled depth = filled − original > 0. Connected components are labelled. Classes: pond < 2 ha,
  lake ≥ 2 ha; depth classes from max fill depth. **Beaver ponds:** low-order (1–3) streams on gentle slopes (< 2 %) near
  aspen stands (core/stand pioneers within 100 m) get a seeded dam that raises the fill by 1–1.5 m (Naiman et al. 1988) [verify].
- **Streams and rivers:** cells with accumulation × cell area > A_thresh (≈ 0.5 km² channel initiation, boreal Shield
  [verify]). **Strahler order** comes from the network. **Hydraulic geometry** (Leopold & Maddock 1953): w = a·Q^0.5, d = c·Q^0.4,
  v = k·Q^0.1. Coefficients for boreal Canadian rivers [verify]. Q comes from accumulated runoff (mean annual runoff Kenora
  ≈ 250 mm/yr [verify]) plus the live weather coupling.
- **Waterfalls and rapids:** along each channel, a local slope over 0.1 → rapids, and a drop over 2 m within one cell → waterfall.
  Shield bedrock ledges (stage 3 bedrock) raise the probability. They render with spray/mist particles (shared particle code with
  precipitation) and a sound source (audio).
- **Glaciers (only where climate allows; off for present-day Kenora):** degree-day mass balance ḃ = P_snow − DDF·PDD above
  the ELA (Braithwaite 1995 DDF ≈ 3–8 mm w.e. °C⁻¹ d⁻¹). Ice flow by the shallow-ice approximation, q = −(2A/(n+2))
  (ρg)^n H^(n+2) |∇s|^(n−1) ∇s with Glen's n = 3 and A = 2.4e-24 Pa⁻³ s⁻¹ (Cuffey & Paterson 2010), stepped on the coarse
  grid in the worker. Meltwater is added to the runoff.
- **Ocean:** cells below `world.seaLevel`. Tides are a closed-form sum of M2 + S2 constituents (amplitude by setting). Waves:
  adopt three.js `Water` (examples/jsm/objects/Water.js, MIT) first. An FFT ocean (e.g. jbouny's ocean or a Tessendorf 2001
  port) goes on Ultra.
- **Live coupling:** the weather supplies rain and snowmelt. Per coarse cell, the soil bucket (core/weather) spills to runoff, and
  runoff routes down the D8 tree with a linear-reservoir lag. Near the player, a 64×64 **virtual-pipes** shallow-water grid
  (O'Brien & Hodgins 1995; Mei et al. 2007) at 1 m carries visible flow over the activated chunk, with boundary inflow from
  the network.
- **Lake ice:** Stefan's law h = √(2 k_i · FDD / (ρ_i L)) (≈ 2.7 cm·√(°C·d) empirical, Lepparanta 1993) from the
  weather's freezing degree-days; break-up when the thawing degree-days reach the melt energy.
- **Rendering:** three.js `Water`/`Water2` (reflection, refraction, flow maps). Rivers sample a flow map built from D8 and
  discharge. Foam where velocity × slope is high. Caustics only on Ultra. Glaciers use ice and snow PBR (the shared terrain
  shader with an albedo/roughness table). All of it is on the quality ladder (reflection resolution, refraction on/off, FFT vs
  Gerstner, foam, caustics).

## Stage 3: ground composition (Canadian Shield) - DONE 2026-10-18 (core/stages/soils.ts)
Inputs: slope, TWI (stage 2a), HAND and flow distance to drainage (lake, outlet or river channel).
- Gharari et al. 2011 landscape classes (slope .129, HAND 5.9 m): hillslope / plateau / sloped wetland / flat wetland.
- Mapped to NOEGTS 36 (Hallett & Roed 1980) Kenora units: hillslope + highest plateaus -> bedrock knobs (share calibrated to
  ESA WorldCover outcrop, 11 %), plateaus -> thin ground moraine (till) with seeded outwash sand patches, flat wetland -> peat
  (TWI >= 9 or a filled pit) or Lake Agassiz glaciolacustrine clay (< 12 m above base water).
- Output feeds core/ground (wetness, depth to bedrock, peat layer), the tree mix and the terrain colour. Calibration: tools/terrain-ref.
- Open: Ontario FEC S-types (Sims et al. 1997) for finer moisture regimes; real-map mode from the OGS surficial geology map [verify].

## Stage 4: vegetation
- core/stand (live): fire age per patch → structure. Site wetness then comes from stage 3 (TWI, soil type) instead of
  height-above-shore. Peat → black spruce/tamarack; sand → jack pine; clay → aspen/balsam poplar; shallow till → mixed.

## Slow processes (closed form in time, no simulation)
- Paludification: organic depth grows under old conifer stands on wet sites, d(t) ≈ d∞(1 − e^(−t/τ)) with τ ~ 300–2000 yr
  (Simard et al. 2007) [verify].
- Peat accumulation: ≈ 0.3–0.5 mm/yr (Gorham 1991) [verify]. Soil creep: v ∝ slope (Culling 1963 linear diffusion).
  Frost heave: seasonal sinusoid × frost-susceptible soil (silt/clay) × freezing index.

## Testing (each piece)
Determinism (same seed → same grids). Filled DEM has no pits, and every cell drains to an outlet. Flow conservation
(Σ inflow = outflow at each node; total accumulation = cell count). No uphill rivers (elevation non-increasing downstream
on the filled DEM). Strahler order never decreases downstream. Hydraulic geometry is monotone in Q. Stefan's law matches
the analytic curve. Glacier mass is conserved apart from the balance terms.

## Build order (live, one small commit each, with a CHANGELOG-LIVE line)
1. Stand age (done). 2. This doc. 3. Seeded elevation on the coarse grid + erosion (toggle `world.stagedTerrain`).
4. Priority-Flood + D8 + accumulation (inspector: flow, accumulation, TWI). 5. Lakes and ponds. 6. Rivers (DONE 2026-10-18, core/stages/rivers.ts; Strahler,
hydraulic geometry, carved channels, water mesh). 7. Waterfalls and rapids. 8. Ground stage 3 (DONE 2026-10-18, core/stages/soils.ts; relief calibrated to Copernicus DEM / WorldCover / Sentinel-2 around Kenora, tools/terrain-ref). 9. Real DEM. 10. Ocean and tides,
glaciers, lake ice, live shallow water.
