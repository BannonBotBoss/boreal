Upstream: https://github.com/simondevyoutube/Quick_Grass @ 6b56164272f213e353a4045d1439d071d5a968cd (MIT, LICENSE alongside)
Files: public/shaders/grass-lighting-model-vsh.glsl, grass-lighting-model-fsh.glsl, common.glsl, src/base/render/grass-component.js
Implements the Ghost of Tsushima grass talk (Eric Wohllaib, "Procedural Grass in Ghost of Tsushima", GDC 2021):
vertex-ID blade geometry, jittered placement, two blade LODs, per-blade curve/lean, noise wind, rounded normals,
view-space thickening, tiles around the camera.
Baseline copy, unmodified, not compiled. Boreal port: src/render/grass/grass.ts (shader + tiles) and
src/render/grass/cover.ts (placement density field + species, CPU).
