# Adding a causal globe layer (atmosphere / emission / overlay)

1. Find the existing physics first (src/core/*.ts, rust/boreal-sim) - reuse it, never re-derive.
2. Emissions (airglow, aurora): add to `atmEmission` in src/world/globe/atmosphere.ts; units AIRGLOW.zenithUnits per 250 R; it runs in the dome and the tiles.
3. Overlays (field lines, plates): planet-frame geometry in a group positioned at -camPos each frame; `onBeforeCompile = withLogDepth` so the globe occludes it; gate with isOn(layer).
4. Sim fields: add a plane in grid.rs NAMES + planetBudget.ts PLANE_NAMES/PLANE_INFO, bump layout_version both sides, fix the planet-budget plane-count test, `npm run build:wasm`.
5. Test numbers against a cited source; shoot before/after with ?latlon=lat,lon|antisun, ?hide=, ?ev=, &shot (headless Chrome, night-shot.mjs).
6. Push only via push.sh (tsc, npm test `# fail 0`, cargo test).
