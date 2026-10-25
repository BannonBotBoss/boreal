# Hardware-scaled rendering

## Recommended solution for Boreal

> **Boreal already has the core of this: a startup probe, a six-tier ladder and a frame-time governor with hysteresis. Extend it rather than replace it.**
>
> A read-only look at the repo (commit of 24 Oct 2026, 12:56 PT) found `src/core/probe.ts` (detect-gpu tier, `MAX_TEXTURE_SIZE`, `deviceMemory`, `hardwareConcurrency` and a timed bench of the start scene at Ultra, cheapest cap wins, cached per GPU string), `src/core/quality.ts` (Ultra to Minimum ladder, drei-style governor using `EXT_disjoint_timer_query_webgl2` GPU time, world knobs held until a tier is stable) and `src/world/globe/lod.ts` (globe tile rows per tier). Rendering is `WebGLRenderer` with CSM, GTAO, PCSS, god rays and a ray-marched atmosphere. The gaps are: no WebGPU path, no upscaler or TAA, no KTX2 textures, and no GPU-driven culling. Recommendations below are my judgement.

1. Keep `probe.ts` + governor as is; add the WebGPU adapter's `limits`, `features` and `info` to `ProbeInput`, so an Ultra+ row only unlocks with WebGPU and timestamp queries.
2. Add KTX2/Basis textures first: cheapest win on every tier, cutting VRAM and upload hitches.
3. Add TAA-style upsampling (or FSR1 as a post pass) so `resScale` below 1 looks acceptable; the governor already moves `resScale`.
4. Treat WebGPURenderer as a second backend, not a swap: `photoreal.ts` patches `ShaderChunk`, which WebGPURenderer does not support, so those effects would need TSL ports.
5. Use the WebGPU backend first for the formation disc view and globe tiles (compute culling, indirect draws), leaving the ground game on WebGL until ports are done.

Hardware: repo comments benchmark an RTX 5060 Laptop GPU on a machine called omen (Ultra about 13.5 ms per frame on 15 Oct). That GPU ships with 8 GB, which matches the earlier note, but I could not confirm it is the machine Matt plays on, so treat it as assumed.

## Tier table

| Tier | Backend | Features | Frame cost | Target hardware |
| --- | --- | --- | --- | --- |
| Low | WebGL2 | resScale 0.5 to 0.8, 1 shadow map or none, no AO, hemisphere light, short draw distance, impostor trees, sky via cheap analytic gradient, KTX2 textures | About 0.27 to 0.47 of Ultra (repo relCost) | Integrated GPUs, old laptops, Quest |
| Mid | WebGL2 | resScale 0.9, 1 cascade, IBL, contact shadows, god rays 24, cloud shadows, LOD 0.85, TAA upsampling | About 0.8 of Ultra | GTX 1060 class, 4 GB |
| High | WebGL2 or WebGPU | Native res, 2 cascades, PCSS, half-res GTAO, probe GI, full foliage, Bruneton-style precomputed atmosphere LUTs | About 0.9 of Ultra | RTX 3060 / 5060 Laptop, 8 GB (assumed Matt's) |
| Ultra | WebGPU preferred | 3 cascades at 2048, full-res GTAO, Hillaire sky-view and aerial-perspective LUTs, ray-marched clouds, compute culling plus indirect draws, clustered lights, optional supersampling | 1.0 (13.5 ms on the bench GPU) | Desktop RTX 4070 class and up |

Low to High map onto Boreal's existing six rows (Minimum and Very low fold into Low). Ultra items beyond today's ladder are proposals.

## Hardware-test design

1. **Read static caps (under 5 ms)** — WebGPU: `navigator.gpu.requestAdapter()` then `adapter.limits`, `adapter.features` (`timestamp-query`, `texture-compression-bc`/`astc`) and `adapter.info`. WebGL2: `MAX_TEXTURE_SIZE`, `WEBGL_debug_renderer_info` unmasked renderer, compressed-texture extensions. Plus `deviceMemory` (Chromium, capped at 8) and `hardwareConcurrency`.
2. **Look up a tier list** — detect-gpu maps the renderer string to a benchmark tier 0 to 3. Use it only when no bench exists: its database lags new GPUs (the repo saw an RTX 5060 Laptop rated tier 1).
3. **Run a short timed bench (1 to 2 s)** — Render the real start scene at Ultra for about 60 frames behind the loading screen; take the median GPU time from timer queries (WebGL2) or `timestamp-query` (WebGPU), CPU frame time otherwise.
4. **Pick the tier** — Highest tier whose predicted cost (bench times relative cost) fits 85 percent of the frame budget; every signal gives a cap and the lowest wins.
5. **Cache and re-probe** — Store per GPU string and probe version; re-run when the driver or GPU changes, or on a hybrid laptop that switched to the iGPU.
6. **Adapt at runtime** — Dynamic resolution first (cheap, no rebuild), tier steps second; step down after sustained misses, up only after several windows of headroom, and remember tiers that failed (hysteresis).

## Rendering methods

| Method | What it buys | Web status | Boreal use |
| --- | --- | --- | --- |
| WebGPURenderer + TSL | Compute shaders, indirect draws, one shader source for WGSL and GLSL | Three.js falls back to a WebGL2 backend automatically; `ShaderMaterial` and `onBeforeCompile` unsupported | Disc view and globe first |
| Forward | Simple, MSAA-friendly | Default in three.js | Ground game today |
| Forward+ / clustered | Hundreds of lights at low cost | Needs compute or texture tricks; toji's WebGPU demo | Only if night scenes add many lights |
| Deferred | Many lights, cheap screen-space effects | Heavy bandwidth, no MSAA, MRT needed | Not needed: one sun dominates |
| LOD and impostors | Distant trees as octahedral billboards | Works on WebGL2 | Already has far tree rings; impostors for Low |
| GPU culling + indirect draws | CPU stays free with huge instance counts | WebGPU `drawIndirect`; WebGL2 has only `BatchedMesh` multi-draw | Ultra foliage and tiles |
| Clipmaps / CDLOD quadtree | Even screen-space terrain detail | Works everywhere | Cube-sphere quadtree already in `lod.ts` |
| Cascaded shadows | Sharp near, wide far shadows | three CSM addon | Already: 0 to 3 cascades by tier |
| SSAO / GTAO | Contact darkening | GTAOPass; TSL `ao` node | Already: half or full res |
| Bruneton / Hillaire atmosphere | Physically based sky from orbit to ground via LUTs | Ports exist for WebGL and WebGPU | Replace per-pixel ray march on Low/Mid with LUTs |
| Ray marching planets | Atmosphere and clouds from space | Fragment cost scales with pixels | Already in `atmosphere.ts`; step count per tier |
| FSR1 / TAA upsampling | Render at 60 to 80 percent, display sharp | FSR1 is a portable spatial shader; three has TRAA in WebGPU examples | Missing; pairs with `resScale` |
| KTX2 / Basis | GPU-compressed textures, 4 to 8 times less VRAM | three `KTX2Loader` transcodes per device | Missing; do first |

Status and ratings are from the sources below; Boreal-use column is my judgement.

## How engines do it

| | |
| --- | --- |
| **Unity** | Named quality levels in Project Settings, each a bundle of shadow, LOD bias, texture and AA settings, switched at runtime with `QualitySettings.SetQualityLevel`. |
| **Unreal** | Scalability groups (view distance, shadows, AA, post, textures, effects, foliage, shading), each 0 to 4 (Low to Cinematic) via `sg.` cvars; a startup hardware benchmark can pick levels; dynamic resolution holds a frame budget. |
| **three.js / drei** | `PerformanceMonitor` averages fps over windows, calls onIncline or onDecline outside bounds, and locks after too many flip-flops. Boreal's governor follows this. |
| **Babylon.js** | `SceneOptimizer` steps through prioritized optimizations (shadows, post, textures, hardware scaling, merging meshes) until a target fps is met, and can degrade or improve. |

## Globe-to-ground mapping

| Phase | Bottleneck | Scale with |
| --- | --- | --- |
| Formation disc | Particle count, overdraw | Particle count per tier; WebGPU compute integration; point size instead of geometry |
| Globe from orbit | Atmosphere and cloud ray march (per pixel) | Cloud octaves and steps, LUT atmosphere at Low, resScale plus upsampling |
| Descent | Tile rebuilds, shader compiles | Tile segments and cache from `lod.ts`; precompile next tier during the world hold |
| Ground game | Shadows, AO, foliage draw calls | Cascades, GTAO, foliage density, impostors, GPU culling on Ultra |

One governor should own all phases, with a per-phase cost table, since the bench scene measures only the start view (my judgement).

## Open gaps

- Matt's actual GPU and VRAM are unconfirmed; the 8 GB figure rests on the repo's RTX 5060 Laptop bench.
- No measured WebGPU versus WebGL2 numbers for Boreal; TSL port effort for `photoreal.ts` not estimated.
- Browser WebGPU support on Matt's browser and OS not checked.
- FSR1 web ports were not evaluated for quality; VRAM use per tier is not measured by the probe.

## Sources: rendering

- [WebGPURenderer manual](https://threejs.org/manual/en/webgpurenderer) — three.js
- [Three.js Shading Language (TSL)](https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language) — three.js wiki
- [three.js r180 release notes](https://github.com/mrdoob/three.js/releases/tag/r180) — GitHub
- [GPUAdapter.limits](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapter/limits) — MDN
- [GPUAdapter.info](https://developer.mozilla.org/en-US/docs/Web/API/GPUAdapter/info) — MDN
- [WEBGL_debug_renderer_info](https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info) — MDN
- [EXT_disjoint_timer_query_webgl2](https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query_webgl2) — MDN
- [Navigator.deviceMemory](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/deviceMemory) — MDN
- [Navigator.hardwareConcurrency](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/hardwareConcurrency) — MDN
- [detect-gpu](https://github.com/pmndrs/detect-gpu) — GitHub, pmndrs
- [PerformanceMonitor](https://drei.docs.pmnd.rs/performances/performance-monitor) — drei docs
- [Scene Optimizer](https://doc.babylonjs.com/features/featuresDeepDive/scene/sceneOptimizer) — Babylon.js docs
- [Quality settings](https://docs.unity3d.com/Manual/class-QualitySettings.html) — Unity Manual
- [Scalability reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/scalability-reference-for-unreal-engine) — Unreal Engine docs
- [Dynamic resolution](https://dev.epicgames.com/documentation/en-us/unreal-engine/dynamic-resolution-in-unreal-engine) — Unreal Engine docs
- [Clustered deferred and forward shading](https://www.cse.chalmers.se/~uffe/clustered_shading_preprint.pdf) — Olsson et al.
- [WebGPU clustered shading](https://github.com/toji/webgpu-clustered-shading) — GitHub, toji
- [GPURenderPassEncoder.drawIndirect](https://developer.mozilla.org/en-US/docs/Web/API/GPURenderPassEncoder/drawIndirect) — MDN
- [Octahedral impostors](https://shaderbits.com/blog/octahedral-impostors) — ShaderBits, Ryan Brucks
- [Terrain rendering using GPU-based geometry clipmaps](https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry) — GPU Gems 2
- [Parallel-split shadow maps](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-10-parallel-split-shadow-maps-programmable-gpus) — GPU Gems 3
- [Practical real-time strategies for accurate indirect occlusion (GTAO)](https://www.activision.com/cdn/research/Practical_Real_Time_Strategies_for_Accurate_Indirect_Occlusion_NEW%20VERSION_COLOR.pdf) — Jimenez et al., Activision
- [Precomputed atmospheric scattering](https://ebruneton.github.io/precomputed_atmospheric_scattering/) — Eric Bruneton
- [A scalable and production ready sky and atmosphere](https://sebh.github.io/publications/egsr2020.pdf) — Hillaire, EGSR 2020
- [FidelityFX Super Resolution 1](https://gpuopen.com/fidelityfx-superresolution/) — AMD GPUOpen
- [TRAA post-processing example](https://threejs.org/examples/webgpu_postprocessing_traa.html) — three.js examples
- [KTX2Loader](https://threejs.org/docs/#examples/en/loaders/KTX2Loader) — three.js docs
- [Basis Universal](https://github.com/BinomialLLC/basis_universal) — GitHub, Binomial
- [GeForce RTX 50 Series laptops](https://www.nvidia.com/en-us/geforce/laptops/50-series/) — NVIDIA

---

*Research compiled 2026-10-24 by Grok Bot (read-only review of the repo; recommendations are judgement unless sourced). Full reading list: [sources.md](sources.md). Index: [README.md](README.md).*
