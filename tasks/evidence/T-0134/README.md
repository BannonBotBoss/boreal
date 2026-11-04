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

`lod/benchmark.json` is a second timed pass, after `gl.finish()` was added following `composer.render`. On this SwiftShader session the 95th percentile is still about 0.4–6.7 ms (Ultra about 1.2 ms). A 3840×2160 raymarch cannot really be that cheap here, so the number is the CPU return, not a 60 fps measurement, and picking Ultra from it is not evidence the scene holds the frame budget. SwiftShader is not a desktop GPU. Matthew's machine times itself from the Test this computer button.

Forced-tier frames: `lod/ultra.png`, `lod/high.png`, `lod/medium.png`, `lod/low.png`.

## Reheating

`reheating/decay.csv` is the Boltzmann integration from the spacetime handoff: time, temperature, inflaton density, radiation density. `reheating/decay.svg` plots those. Radiation starts empty. It crosses the inflaton density at 6.983×10⁻¹⁹ s, where the integrated temperature is 6.256×10¹⁸ K. The analytic estimate is 9.790×10¹⁸ K (ratio 0.64, inside a factor of two). g* is 106.75 through that hot window and 3.363 on the late, cool samples (`reheating/check.txt`).

`reheating/species.csv` and `reheating/species.svg` are the equilibrium number densities. Top, W, and Higgs densities fall through zero as the temperature drops through their masses. Electrons and up quarks follow later. Photons stay. The quark-hadron flag is 1 near 150 MeV (about 10⁻⁴ s in `reheating/samples.tsv`) and is only a threshold; quarks and gluons are not switched off, because that plasma is a future engine. Panel frames, scrolled to the reheating block: `reheating/panel-inflation-end.png` (g* = 106.75, live Boltzmann symbols), `reheating/panel-decay.png`, `reheating/panel-qcd.png` (quark-hadron threshold 1 near 2×10¹² K), `reheating/panel-nucleosynthesis.png`. The equation frames are `reheating/panel-*-equation.png`. At 100 s the temperature line is 1.335×10⁹ K and g* is 3.363.

## Fly-down

`fly-globe.png` is the globe chrome on a blank grey view. `__inpage` never reported globe mode in two minutes. Pressing G did not show a descent. `fly-g-0.png` is the loading card ("Generating the land around you…"), not the ground. The fly-down from the globe to the ground does not complete in this capture. It was not changed.

## Engines during a normal panel session

Spacetime, reheating, and the planet grid engines (climate, solar, energy, wind, hydro, clouds) evaluate when their time range is active. Nucleosynthesis spawns and stays NOT BUILT. Formation, differentiation, animals, and perception are not spawned by the clock; the game does not call them from this panel path.

— grokbot-3
