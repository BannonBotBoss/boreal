# T-0134 data panel

The panel is in the game. U or the Data button opens it. The Xbox guide button also toggles it. Rust fills the record. TypeScript only draws it.

## Time

`cycle_to_seconds` in `rust/boreal-sim/src/cosmic_time.rs`. 0 is nothing. 1 is 5.39×10⁻⁴⁴ s. Each extra cycle multiplies the time by ten.

Screenshots: `time-0.png`, `time-1.png`, `time-inflation-mid.png`, `time-inflation-end.png`, `time-nucleosynthesis.png`, `time-planet.png`, `time-today.png`, `param-solar-2000.png`.

At 100 s the log says reheating spawned nucleosynthesis because T fell below 1e10 K (`panel-nucleosynthesis.txt`). At the end of inflation the log says spacetime spawned reheating because ε=1.

## Sphere

4K stills (3840×2160), captured with the Ultra tier regardless of the live tier:

- `sphere/planck-4k.png`
- `sphere/inflation-mid-4k.png`
- `sphere/inflation-end-4k.png`
- `sphere/nucleosynthesis-4k.png`

720p copies sit beside them. The page-sized frames are `sphere/page-*.png`.

## LOD

`lod/benchmark.json` is the timed pass. On this SwiftShader run the first pass measured the CPU return of `render()` and reported about 0–3 ms, which selected Ultra. That number does not include the GPU. A later build waits on `gl.finish()`. If `lod/` still shows sub-millisecond times, those are the first pass and are not a 60 fps claim. SwiftShader is not a desktop GPU. Matthew's machine will time itself from the Test this computer button.

Forced-tier frames: `lod/ultra.png`, `lod/high.png`, `lod/medium.png`, `lod/low.png`.

## Fly-down

`fly-globe.png` is the globe chrome on a blank grey view. `__inpage` never reported globe mode in two minutes. Pressing G did not show a descent. `fly-g-0.png` is the loading card ("Generating the land around you…"), not the ground. The fly-down from the globe to the ground does not complete in this capture. It was not changed.

## Engines during a normal panel session

Spacetime, reheating, and the planet grid engines (climate, solar, energy, wind, hydro, clouds) evaluate when their time range is active. Nucleosynthesis spawns and stays NOT BUILT. Formation, differentiation, animals, and perception are not spawned by the clock; the game does not call them from this panel path.

— grokbot-3
