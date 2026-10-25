# Planets: shape formation along a timeline

Timeline at a glance:

| Stage | Age |
| --- | --- |
| Planetesimals | 4.57 Ga |
| Rounding | first Myr |
| Core forms | within 30 Myr |
| Crust | 4.47 Ga |
| Oceans | by 4.4 Ga |
| Bombardment | 3.95 to 3.8 Ga |
| Plates | by 3.35 Ga |
| Snowball | 717 to 635 Ma |
| Ice age | 20 ka |
| Today | now |

Earth's history, oldest first, with the procedural technique that imitates each stage. Ages come from the cited planetary science sources. The stage order is roughly chronological, but several stages overlap in reality, and volcanism and erosion run throughout. Technique choices are my judgement unless a project is named.

| Stage | What physically happens | Timescale | Procedural technique |
| --- | --- | --- | --- |
| 1. Accretion | Dust clumps into km-size planetesimals, then lunar-to-Mars-size embryos, then planets through giant impacts (PNAS review) | Dust to planetesimals ~1 Myr; embryos a few Myr; planets 10 to 100 Myr | Start from a base sphere mesh: a cube-sphere (six subdivided faces normalized, as Lague does) or an icosphere. Seed the planet's RNG here |
| 2. Rounding and oblateness | Gravity pulls a large body into a sphere; spin bulges the equator. Earth is 0.3% wider at the equator, Mars 0.6%, Saturn 10.7% (NASA). Earth's flattening is about 1 part in 300 | During and after accretion; spin keeps changing slowly over geological time | Scale the unit sphere's polar axis by (1 - f), with f derived from spin and size. Optional low-frequency 3D noise for a lumpy small moon |
| 3. Differentiation | Dense metal sinks to form the core; magma ocean crystallizes into early crust | Core mostly formed within 30 Myr; first silicate differentiation ~4.47 Ga (Royal Society) | Not visible on the surface. Use it to set a crust-type field (continental vs oceanic) from low-frequency 3D noise sampled at the unit-sphere position |
| 4. Early crust | A mafic, ultramafic surface; plate tectonics likely not yet active (Martin et al.) | 4.5 to 4.4 Ga | Base elevation: 3D fBm sampled on the unit sphere, so there are no poles or seams to fix |
| 5. Oceans | Water condenses in topographic lows; Jack Hills zircons point to liquid water | By 4.4 to 4.3 Ga | Sea-level threshold: pick the level that gives a target land fraction (one tectonic project targets about 30% land) |
| 6. Bombardment and cratering | Impacts scar the surface (Late Heavy Bombardment) | About 3.95 to 3.8 Ga, though some models place it earlier | Crater stamping: Lague's crater uses a parabolic cavity, a raised rim and a flat floor blended with smooth min and max, with sizes biased toward small craters. Later stages erode or bury most craters, so keep them only on airless bodies |
| 7. Plate tectonics and mountain building | Plates converge (mountains, trenches, island arcs), diverge (rifts, mid-ocean ridges) or slide past each other. Supercontinents assemble and break apart | Subduction by at least 3.35 Ga (Caltech zircons), start date debated; supercontinent cycle about 400 to 440 Myr | Voronoi plates on a sphere: flood-fill cells into 10 to 50 plates, give each a motion vector, classify boundaries and uplift convergent ones (Red Blob Games, Hello Worlds, planet_heightmap_generation) |
| 8. Volcanism | Island arcs at ocean-ocean convergence; hotspot plumes leave drifting island chains | Throughout planetary history | Hotspot domes with drift trails, and ridged noise for island arcs (planet_heightmap_generation) |
| 9. Erosion and sedimentation | Rivers and landslides wear ranges down; sediment fills basins. High Himalaya erosion is about 2.7 mm/yr | Relief removed over millions of years where active; inactive belts can keep relief for hundreds of Myr (Nature) | Hydraulic and thermal erosion on the sphere mesh: priority-flood drainage, stream-power erosion, talus-angle thermal erosion, soil creep (planet_heightmap_generation) |
| 10. Glaciation | Ice sheets carve fjords and U-shaped valleys. Snowball Earth episodes 717 to 659 Ma and about 650 to 635 Ma; at the Last Glacial Maximum sea level was more than 120 m lower (USGS) | Snowball episodes lasted 15 to 58 Myr; LGM 20,000 years ago, current sea level reached ~8,000 years ago | Latitude- and altitude-driven glacial carving; animate the sea-level threshold down and back up |
| 11. Present day | Climate sets biomes on the final relief | Now | Biomes from latitude temperature, elevation lapse and moisture, or a wind and current model (planet_heightmap_generation simulates seasonal winds and ocean gyres) |

## Simulating a planet as time-stepped generation

1. **One seed, one fixed stage order** — Each stage reads the previous stage's fields (elevation, crust type, plate id, water, ice) and writes new ones, with its RNG derived from hash(seed, stageId).
2. **Run global stages at low resolution** — Plates, drainage, erosion and climate run once on a coarse sphere mesh, for example a Fibonacci or Voronoi sphere of a few hundred thousand cells, and are cached.
3. **Add detail as pure functions** — Close-up detail is the cached coarse field interpolated, plus 3D noise and crater stamps evaluated at the unit-sphere position. It is pure, so any patch can be rebuilt on demand.
4. **Scrub time by saving snapshots** — Store each stage's output so a timeline slider can show the planet at any stage without re-simulating.
5. **Keep it deterministic** — Integer hashes, a fixed iteration count, no time-based or thread-order-dependent loops, and a version number for the generator.

This whole sub-section is my design recommendation. It splits generation into simulated global stages and pure local detail, which is how the cited planet projects behave.

## Close-up LOD and seams on a planet

| | |
| --- | --- |
| **Quadtree per cube face** | Six quadtrees, one per cube face mapped to the sphere, split by viewer distance. Lague's unfinished LOD system adds lookups for neighbor quads across faces. |
| **Seams between faces** | Lague notes that normals do not match along cube-face seams. Fix by computing normals from noise sampled at shared world positions, or from a ring of extra vertices beyond each patch edge. |
| **Cracks between LOD levels** | Use CDLOD-style vertex morphing, skirts, or neighbor-aware edge stitching (my judgement). |
| **Precision** | Planet-scale coordinates exceed 32-bit float precision close up. Build patches relative to their own center and use a floating origin (my judgement). |
| **Even cells** | A plain cube-sphere stretches cells near cube corners; an icosphere is more even, but each subdivision quadruples triangle count (Lague). |

---

*Research compiled 2026-10-24 by Grok Bot (read-only review of the repo; recommendations are judgement unless sourced). Full reading list: [sources.md](sources.md). Index: [README.md](README.md).*
