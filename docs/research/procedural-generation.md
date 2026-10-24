# Procedural generation techniques: a developer's survey

What each major technique does, where it fits, how it behaves in chunked worlds, and a concrete pipeline for a seeded open-world browser game.

## Bottom line

> **Use functions of position for the open world, and local algorithms for what sits inside it.**
>
> Noise (fBm plus domain warping), Worley-style cell points and integer hashing can all be evaluated at any world coordinate, so chunks match at their edges and generate independently. Erosion, Poisson-disk sampling, WFC and cellular automata are stateful or global, so they need margins, regions or baking before they fit a streamed world.

Ratings in the table below are my engineering judgement, drawn from the cited sources but not quoted from any one of them. Sources are in the reading list at the end.

## Comparison

| Technique | Best for | Strengths | Weaknesses | Cost | Chunk-safe |
| --- | --- | --- | --- | --- | --- |
| Perlin / Simplex | Base height, moisture, density | Cheap, smooth, seedable | Bland alone; ranges differ per library | Low | Yes |
| Worley (cellular) | Cells, rocks, craters, regions | Per-cell hash, no tables | Hard cell edges; 3x3 lookups | Low to medium | Yes |
| fBm | Natural-looking terrain detail | Linear in octaves, easy to tune | Self-similar, isotropic | Low | Yes |
| Domain warping | Organic, swirled features | Smooth, animatable | Each warp level multiplies noise calls | Medium | Yes |
| Heightmap terrain | Open-world ground | Simple, fast to mesh and LOD | No caves or overhangs | Low | Yes |
| Hydraulic / thermal erosion | Realistic ridges, valleys, talus | Strong realism | Runs on a whole grid | High | No, bake it |
| L-systems | Trees, plants, fractals | Compact rules, endless variants | Weak environment interaction | Low per tree | Yes, per instance |
| Shape grammars | Buildings, facades, cities | Controllable, scales to huge models | Needs rule and asset authoring | Medium | Per lot |
| Cellular automata | 2D caves, organic blobs | A few lines of code | Needs connectivity cleanup | Low | Needs margins |
| BSP / room-corridor | Dungeons, interiors | Fast, no overlaps | Grid-like feel | Low | Per level |
| Graph / mission | Quest and dungeon structure | Guarantees playability | Authoring grammar rules | Low | Per level |
| WFC / constraints | Tile and module layouts | Local rules, style from examples | Contradictions, backtracking | Medium to high | With care |
| Voronoi / Poisson-disk | Regions, tree and object placement | Even spacing, no clumps | Bridson is sequential, so seams | Low | Use cell-jittered points |
| ML-assisted | Style transfer, repair, co-creation | Learns from examples | Training data; weak guarantees | Varies | Rarely |

## Noise methods

### Perlin, Simplex and OpenSimplex

| | |
| --- | --- |
| **What** | Gradient noise: pseudo-random gradients on a lattice, smoothly interpolated. Perlin's 2002 fade curve 6t^5 - 15t^4 + 10t^3 removes second-order discontinuities. Simplex (2001) uses a triangular lattice and sums corner contributions. |
| **Best for** | Base fields such as elevation, moisture and density. |
| **Strengths** | Simplex needs fewer multiplications, scales to higher dimensions at much lower cost, has no noticeable directional artifacts and a cheap continuous gradient (Gustavson). |
| **Weaknesses** | Simplex is not a drop-in swap: feature size, value range and statistics differ. Libraries return different ranges (0 to 1, -1 to 1, others). |
| **Cost** | Cheap per sample. Perlin cost grows steeply with dimension, simplex less so. |
| **Seen in** | The Simplex patent (US 6,867,776) expired on 8 January 2022. OpenSimplex (Kurt Spencer, 2014) avoided it, with a larger kernel that is smoother but slower. For JS, `simplex-noise` takes a seeded PRNG such as `alea`. |

### Worley (cellular) noise

| | |
| --- | --- |
| **What** | Scatter one feature point per grid cell and return the distance to the nearest (F1) or second nearest (F2) point. Published by Steven Worley, SIGGRAPH 1996. |
| **Best for** | Flagstone, cracked ground, craters, rocky ridges, region borders. |
| **Strengths** | Needs no precalculation or tables. Each sample checks its own cell and the eight around it. Complements Perlin rather than replacing it. |
| **Weaknesses** | Cell edges look artificial unless blended; loops are fixed-count in GLSL. |
| **Cost** | Nine point lookups per sample in 2D. |
| **Seen in** | Textures and terrain in offline renderers; the Book of Shaders teaches the GPU version. |

### fBm (fractal Brownian motion)

| | |
| --- | --- |
| **What** | Sum noise at doubling frequency (octaves) and falling amplitude (persistence). |
| **Best for** | Nearly all natural terrain, clouds and texture detail. |
| **Strengths** | Cost is linear in octaves. Quilez notes that 24 octaves can span the planet down to 2 metre detail. |
| **Weaknesses** | Looks alike everywhere. Red Blob Games suggests offsetting or rotating octaves to avoid correlated artifacts, and normalizing by the sum of amplitudes. |
| **Cost** | A typical map uses about 5 octaves with persistence 0.5. |
| **Seen in** | The standard building block in almost every noise-based generator. |

### Domain warping

| | |
| --- | --- |
| **What** | Evaluate f(p + h(p)) instead of f(p), with fBm for both pattern and displacement. |
| **Best for** | Organic swirls, believable biome boundaries, break-up of regular patterns. |
| **Strengths** | Smooth, so it animates and blends well, and combines with other techniques. |
| **Weaknesses** | Each warp level multiplies fBm calls: one warp is 3 fBms, two warps are 7. |
| **Cost** | Medium. At 5 octaves, one warp is about 15 noise calls per sample. |
| **Seen in** | Quilez's marble and cloud patterns, dating to Perlin's 1984 marble texture. |

## Terrain

### Heightmaps and voxel density

| | |
| --- | --- |
| **What** | Treat noise as elevation. Reshape it with a power curve to flatten valleys, and add an island or continent mask for coastlines. |
| **Best for** | Most open worlds. Use a 3D density function instead when you need caves and overhangs. |
| **Strengths** | Red Blob Games notes that noise can produce infinite maps, or part of a map without generating the rest. |
| **Weaknesses** | Large-scale noise terrain tends to look bland if the player sees the whole map. |
| **Cost** | Low for heightmaps. 3D density is heavier because it needs meshing such as marching cubes. |
| **Seen in** | Minecraft 1.18 evaluates density functions at every block: above 0 is stone, otherwise air or fluid. No Man's Sky generates voxel terrain at runtime. |

### Erosion: hydraulic and thermal

| | |
| --- | --- |
| **What** | Hydraulic: droplets follow the gradient, carry sediment, then erode or deposit (Sebastian Lague's implementation), or a grid shallow-water model (Mei et al., 2007). Thermal: material above a repose or talus angle slumps downhill. |
| **Best for** | Hero terrain, baked heightmaps and macro regions. |
| **Strengths** | Adds ridges, valleys, debris fans and talus. Houdini suggests a repose angle of 30 to 45 degrees for rock and dirt. |
| **Weaknesses** | Physical modeling typically runs on the whole map, so it does not suit infinite or partly generated worlds (Red Blob Games). Tuning tends toward over-realism. |
| **Cost** | High. Mei et al. run it in parallel on the GPU. |
| **Seen in** | Tools: Houdini HeightField Erode, Gaea Thermal and Thermal2, World Machine. |

## Plants and buildings

### L-systems and vegetation

| | |
| --- | --- |
| **What** | Parallel string rewriting rules, interpreted by a turtle to draw branching forms. Covered in The Algorithmic Beauty of Plants. |
| **Best for** | Trees, shrubs, phyllotaxis and fractal plants. |
| **Strengths** | Tiny rule sets give endless variation. |
| **Weaknesses** | They struggle with environmental interaction, plant-to-plant collision and forest-scale growth. |
| **Cost** | Cheap per plant. Pair with GPU instancing, LOD and cached branch assets. |
| **Seen in** | SpeedTree mixes procedural generators with manual editing and exports assets with LOD and wind data. |

### Shape grammars (buildings and cities)

| | |
| --- | --- |
| **What** | Context-sensitive rules that split, extrude and detail a shape. CGA Shape (Muller et al., 2006) is the reference. |
| **Best for** | Facades, buildings, street-lot cities. |
| **Strengths** | Highly controllable. The original paper reported Pompeii with 190 rules and about 1.4 billion polygons. |
| **Weaknesses** | You author the rules and an asset kit. |
| **Cost** | Medium. A building is generated per lot, so it scales with chunks. |
| **Seen in** | CityEngine: lots, extrude, `comp(f)` facade split, then floor and tile splits. |

## Layouts and constraints

### Cellular automata caves

| | |
| --- | --- |
| **What** | Seed about 45 percent walls, then apply the 4-5 rule for 4 to 5 passes: a wall stays with 4 or more wall neighbors, and a floor becomes wall with 5 or more. |
| **Best for** | 2D caves and organic rooms. |
| **Strengths** | Very simple, with synchronous updates writing to a new grid each pass. |
| **Weaknesses** | Can leave sealed pockets. Flood-fill afterward and keep the largest connected floor region. |
| **Cost** | Low. Cells times passes. |
| **Seen in** | RogueBasin's cave method; the python-tcod `cavegen.py` example. |

### BSP and room-and-corridor dungeons

| | |
| --- | --- |
| **What** | Recursively split a rectangle into non-overlapping regions, put a room in each, then connect with corridors. |
| **Best for** | Classic roguelike floors and building interiors. |
| **Strengths** | Fast and overlap-free. |
| **Weaknesses** | Regular, grid-like results. |
| **Cost** | Low. |
| **Seen in** | Described in Liapis's chapter of the PCG book. Spelunky instead uses a 4x4 room grid with a random start-to-exit path and hand-made templates. |

### Graph and mission generation

| | |
| --- | --- |
| **What** | Build a mission graph first, then expand it spatially. Dormans uses a graph grammar for the mission and a shape grammar for rooms, corridors, doors and keys. |
| **Best for** | Quest chains, lock-and-key dungeons, guaranteed progression. |
| **Strengths** | The structure is playable by construction. |
| **Weaknesses** | Rule authoring, and spatial embedding can fail. |
| **Cost** | Low. |
| **Seen in** | Boris the Brave's Unexplored generator rewrites a 5x5 node graph to add loops and dead ends, then expands it to tiles. |

### Wave Function Collapse and constraint solving

| | |
| --- | --- |
| **What** | Learn which local tiles or patterns may touch, then repeatedly pick the lowest-entropy cell and propagate constraints. Operationally a non-backtracking greedy search (Karth and Smith). |
| **Best for** | Tile and module layouts: towns, islands, interiors. |
| **Strengths** | Local rules and example-driven style. Gameplay constraints can be layered on. |
| **Weaknesses** | Contradictions need backtracking or a restart. Infinite worlds need overlapping chunks and a fixed evaluation order for determinism. |
| **Cost** | Medium to high, depending on grid and tile count. |
| **Seen in** | Bad North (300+ 3D tiles, bespoke implementation) and Townscaper, which drives WFC from hidden solidity and color layers. |

## Placement

### Voronoi and Poisson-disk

| | |
| --- | --- |
| **What** | Voronoi: cells around seed points, improved by Lloyd relaxation. Poisson-disk: random points with a minimum spacing, for example Bridson's O(N) algorithm. |
| **Best for** | Regions and biomes (Voronoi); trees, rocks and props (Poisson-disk). |
| **Strengths** | Even spacing without clumps or grid alignment. |
| **Weaknesses** | Bridson uses a grid, an active list and about 30 candidates per sample, so it is sequential and does not tile across chunks on its own. |
| **Cost** | Low. Bridson is linear in samples. |
| **Seen in** | Amit Patel's mapgen2 builds islands from 1,000 to 8,000 polygons with two Lloyd passes. |

## GPU, LOD and streaming

### GPU and compute approaches

| | |
| --- | --- |
| **What** | Evaluate noise, density or erosion in shaders or compute. |
| **Best for** | Per-pixel noise, voxel terrain, erosion, heavy fBm. |
| **Strengths** | Highly parallel. GPU Gems 3 chapter 1 generates 32 cubed voxel blocks from a density function, with caves and overhangs. |
| **Weaknesses** | Fixed loop bounds in GLSL, readback cost, and float behaviour that varies by device. PCG-style integer hashes are recommended for GPU use (Jarzynski and Olano). |
| **Cost** | Fast, but verify the output across devices before using it for gameplay. |
| **Seen in** | Mei et al. GPU erosion; Geiss's terrain demo. |

### LOD and streaming

| | |
| --- | --- |
| **What** | CDLOD: a quadtree of grid nodes with LOD chosen by 3D distance and morphed in the vertex shader. Geometry clipmaps: nested grids centered on the viewer. |
| **Best for** | Large visible heightfields. |
| **Strengths** | CDLOD avoids seams and stitching. Clipmaps give uniform screen-space detail. |
| **Weaknesses** | Both are heightfield-oriented and more work than fixed-size chunk rings. |
| **Cost** | Low per frame once built. |
| **Seen in** | CDLOD (Strugar) and geometry clipmaps (Losasso and Hoppe). |

## ML-assisted generation

PCGML trains models on existing game content to generate levels, maps, stories and cards. The 2018 survey by Summerville et al. covers neural networks, Markov models, clustering and matrix factorization, plus repair, critique and co-creation uses. It fits tool-side work such as style transfer, texture and heightmap authoring, and repairing generator output. In a seeded browser world it is the weakest fit: model output is hard to make bit-identical across devices and hard to guarantee playable (my assessment). Smith's WFC paper itself frames WFC as constraint solving combined with machine learning, which is a lighter way to get example-driven style.

## Recommended pipeline

For an open-world browser game with Three.js and seeded chunks. Steps 1 to 4 follow the sources directly; steps 5 to 8 are my design suggestions built on them.

1. **Derive every random value from an integer hash** — Hash (worldSeed, chunkX, chunkZ, layerId) with a PCG-style integer hash, so a chunk never depends on generation order. Use a seeded PRNG such as alea for noise permutation.
2. **Sample terrain at absolute world coordinates** — Height is fBm at (worldX, worldZ), so shared edge vertices match exactly. Add a low-frequency continent mask, a power curve for valleys, one level of domain warping, and optional ridges.
3. **Mesh in a Web Worker with a border ring** — Sample one extra vertex around the chunk, compute normals on the expanded grid, emit only interior vertices, and transfer the buffers to the main thread.
4. **Use a floating origin** — Keep mesh coordinates chunk-local or camera-relative to avoid float jitter far from the origin.
5. **Bake expensive terrain features** — Do erosion offline or per macro-region and sample the result as a detail layer, rather than simulating per chunk.
6. **Place objects with cell-jittered points** — One hashed point per cell, as in Worley noise, is chunk-independent. Use Poisson-disk only inside a chunk with a margin of neighbor cells.
7. **Instance vegetation** — Pre-generate a few L-system or authored tree variants per biome, then draw them with `InstancedMesh`, random rotation and scale.
8. **Run local generators in region cells** — Villages, dungeons and caves get one anchor per large hashed cell. Inside it, use shape grammars, WFC, CA or mission graphs with a fixed seed and a retry cap, and keep them away from the border or give them overlap margins.
9. **Add LOD last** — Start with rings of fixed-size chunks at several resolutions, and move to CDLOD-style morphing or clipmaps once draw distance demands it.

## Pitfalls

| Pitfall | Cause | Fix |
| --- | --- | --- |
| Chunk seams | Per-chunk coordinates, or normals computed without neighbors | Sample at world coordinates; border ring for normals; morph LOD (CDLOD) or add skirts |
| Different worlds on different machines | Browser engines may differ in the last bit of `Math.sin`; GPU floats vary by device | Integer hashes and arithmetic for gameplay-critical decisions; one portable math implementation if you need lockstep; test across browsers |
| Order-dependent generation | A single sequential PRNG stream | Hash per chunk and layer instead of sharing one stream |
| Repetition and sameness | Plain fBm is self-similar; classic Perlin has directional artifacts | Domain warping, rotated octaves, biome variation, Worley or ridged layers, hand-authored set pieces |
| Library mismatch | Noise ranges and scales differ between libraries | Pin the library and version, and normalize explicitly |
| Generator drift | Changing any constant changes every saved world | Version the generator, store edits as deltas, never regenerate old chunks silently |
| Unreachable or sealed areas | Cellular automata and WFC can disconnect space | Flood-fill and keep the largest region; add connectivity constraints |
| WFC contradictions | Greedy search with no backtracking | Backtrack with a step limit, retry only the affected block, and use overlap margins between chunks |
| Float jitter far from origin | Large world coordinates in 32-bit floats | Floating origin and chunk-local meshes |

---

*Research compiled 2026-10-24 by Grok Bot (read-only review of the repo; recommendations are judgement unless sourced). Full reading list: [sources.md](sources.md). Index: [README.md](README.md).*
