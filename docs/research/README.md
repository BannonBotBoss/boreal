# Boreal research

Research notes behind Boreal's world generation, deep-time planet formation, rendering and development process. Compiled 2026-10-24 from a read-only review of this repo paired with external sources. Documentation only; no code changes.

| Doc | What it covers |
| --- | --- |
| [Procedural generation techniques](procedural-generation.md) | Noise (Perlin/Simplex, Worley, fBm, domain warping), terrain and erosion, L-systems and shape grammars, cellular automata, BSP, WFC, Poisson-disk placement, GPU/LOD/streaming, ML-assisted generation, a recommended Three.js pipeline and pitfalls. |
| [Planet formation timeline](planet-formation-timeline.md) | Earth's shape formation in 11 stages from 4.57 Ga to today, each paired with a procedural technique, plus time-stepped simulation and planet LOD notes. |
| [Formation engine](formation-engine.md) | **Recommended solution for Boreal:** a seeded accretion bake in `rust/boreal-sim` (proposed `formation.rs`) producing keyframes, read by a proposed `src/core/formation.ts` `formationAt(t)`, rendered by the existing globe code. Phased plan, architecture options, physics per stage. |
| [Hardware-scaled rendering](hardware-scaled-rendering.md) | Building on `probe.ts`, `quality.ts` and `lod.ts`: KTX2 textures, TAA/FSR1 upscaling, a WebGPU backend option, tier table and hardware-test design. |
| [AI game development strategies](ai-game-dev-strategies.md) | Using AI where its output can be checked: one bot per issue/PR with tests and review, playtest bots, AI props, offline lore drafting; tools and evidence. |
| [Sources](sources.md) | Full reading list. Section-specific sources also appear inside each doc. |

## Key open points

- Every past epoch must converge on today's seeded surface (Kenora home region) or the globe-to-game handoff breaks.
- Matt's actual GPU/VRAM is unconfirmed; tiers assume the RTX 5060 Laptop bench seen in the repo.
- `photoreal.ts` patches `ShaderChunk`, which WebGPURenderer doesn't support; those effects need TSL ports.
- Space Engine was not researched; the particles-to-surface step rests on one source.
