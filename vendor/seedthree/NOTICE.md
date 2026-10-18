# SeedThree generator core (vendored baseline)

Unmodified copies of the pure-math generator files from https://github.com/SkyeShark/SeedThree
at commit cf2eaad39d9b7355ed086aca2a95fb785e539242 (MIT, see LICENSE):
`src/core/weber-penn.js`, `src/core/branch-mesh.js`, `src/core/rng.js`, `src/species/douglas-fir.js`, `src/species/pine.js`.

SeedThree implements Weber & Penn, "Creation and Rendering of Realistic Trees", SIGGRAPH 1995.
The game's tailored TypeScript port lives in `src/render/trees/weberPenn.ts` and `src/render/trees/tube.ts`
(WebGL instead of WebGPU/TSL, proc/rng instead of its RNG, plus conifer additions: whorls, dead lower limbs and a club top).
These files are reference only. They are not imported or built.
