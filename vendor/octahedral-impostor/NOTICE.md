# octahedral-impostor (vendored baseline)

Unmodified copy of `src/` from https://github.com/agargaro/octahedral-impostor at commit
ca0046a49fef8f8c75745a6e49e52752ef3cf8e3 (MIT, see LICENSE).

The game's tailored copy, with its shaders inlined, is `src/render/trees/impostor.ts`. It differs from this baseline in four ways:
- An sRGB albedo target.
- Golus mip-alpha in the bake.
- Renderer state is restored after the bake.
- A fix for an upstream bug: `#include <map_fragment>` was replaced after a custom chunk that itself contained that include in a comment, so the impostor sampled the whole atlas. map_fragment is now replaced first.

The baked normal is also blended, through `IMPOSTOR_FX.normalMix`. This baseline is not imported or built.
