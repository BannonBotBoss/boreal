# Real-World Planetary Interior, Snow-Free Orbital Albedo, Tectonic Plate Boundary & Twilight Cumulus Reference Sources (`T-0247`)

All four visual references are unmanipulated Public Domain or Creative Commons files from Wikimedia Commons / NASA / U.S. Geological Survey:

1. **`ref-0.png`** — Clean schematic cross-section cutaway of Earth's interior concentric shells (inner core, outer core, lower/upper mantle, oceanic and continental crust) and overlying atmospheric thermal layers, with the near hemisphere cleanly removed so neither foreground clouds nor unclipped atmospheric haze obscures the cut section (paired with `frame-0.png`: `?view=globe&r=6371&gaslayers=1` through-planet `Axis` cutaway where `axisView.ts:86` clips only `globeMaterial` and leaves `atmos.dome`, `orbitAlbedo` Blue Marble clouds, `localClouds`, `plateLayer`, and `fieldLines` unclipped across the sliced interior, `discMat` omits `#include <tonemapping_fragment>` / `#include <colorspace_fragment>`, and keyboard `R` fails to toggle the cutaway despite `axisView.ts:6`).
   - **Commons Title**: `File:Earth-crust-cutaway.png`
   - **URL**: https://commons.wikimedia.org/wiki/File:Earth-crust-cutaway.png
   - **Author**: Jeremykemp (Wikimedia Commons, Public Domain dedication)
   - **License**: Public domain

2. **`ref-1.jpg`** — Snow-free NASA Blue Marble orthographic satellite composite over North America and Hudson Bay, illustrating dark green boreal forest across Ontario/Manitoba/Quebec and deep dark-blue ice-free water across Hudson Bay and the Great Lakes when seasonal snow and sea-ice layers are absent, with white cryospheric reflectance confined strictly to permanent glaciers and the Greenland ice sheet (paired with `frame-1.png`: `680 km` orbital view over Northern Canada and Hudson Bay with both `Clouds` and `Snow / ice` unchecked in `#globe-layers`, where `hydroLayer.ts` `uHydroLayer = 1` completely shadows `planetLayers.ts` `uLayerTex` across all `5 / 5` active quality tiers and ignores `setSnowIceShown(false)` (`uLayers.x = 0, uLayers.y = 0`) and `visibleWeight`, leaving `100%` of seasonal snow and sea ice painted bright white while `PlanetSim` classifies central Sahara `23.5°N, 10°E` as `720.6 mm/yr` `Cfa` humid subtropical and boreal Kenora `49.79°N, -94.36°W` as `268.3 mm/yr`, `27.57 °C`-July `BSk` arid cold steppe).
   - **Commons Title**: `File:North America satellite orthographic.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:North_America_satellite_orthographic.jpg
   - **Author**: NASA (Blue Marble satellite composite)
   - **License**: Public domain (United States federal government work)

3. **`ref-2.png`** — U.S. Geological Survey tectonic plate boundary block diagram illustrating right-handed Euler plate kinematics: divergent mid-ocean spreading ridges where adjacent plates move apart ($\mathbf{v}_b - \mathbf{v}_a$ has positive outward normal component $v_n > 0$, e.g. East Pacific Rise between Pacific moving NW and Nazca moving E), convergent subduction trenches where plates move toward one another ($v_n < 0$, e.g. Peru–Chile Trench), and transform faults (paired with `frame-2.png`: `9,800 km` globe `Plates` overlay where `plates.ts:20, 40` evaluates $\boldsymbol{\omega} \times \mathbf{p}$ on the left-handed `unit(lat, lon)` parameterization $\hat{\mathbf{e}}_\lambda \times \hat{\mathbf{e}}_\phi = -\hat{\mathbf{e}}_r$, inverting `100%` of the 25 NNR-MORVEL56 velocity vectors to $-\mathbf{v}_{\text{ECEF}}$ and swapping `100%` of divergent ridges and convergent trenches while oversampling polar latitudes by $1/\cos\phi$).
   - **Commons Title**: `File:Tectonic plate boundaries.png`
   - **URL**: https://commons.wikimedia.org/wiki/File:Tectonic_plate_boundaries.png
   - **Author**: Jose F. Vigil, U.S. Geological Survey (USGS)
   - **License**: Public domain (United States federal government work)

4. **`ref-3.jpg`** — Ground-to-sky photograph of cumuliform clouds (`Cumulus` / `Stratocumulus`) during civil twilight just after sunset, showing cloud bases and bodies in dark slate-grey silhouette darker than the surrounding twilight sky because direct sunlight is blocked below the horizon and diffuse twilight illuminance drops to $\sim 960\text{ lx}$ at $h = 0^\circ$ ($\approx 0.048\times$ clear-day diffuse sky, decaying $0.4\text{ dex/deg}$ below $0^\circ$ per Schaefer 1993) (paired with `frame-3.png`: `1,900 m` volumetric `localClouds` view at civil twilight $h \approx -1.5^\circ$ where `localClouds.ts:312` `skyLevel` omits the `0.048` sunset-to-daylight ratio present in `atmosphere.ts:204` `atmSkyF`, leaving twilight cumulus `20.83×` overbright, while `inpage.ts:553–560` `keptClouds` freezes `0 / 5` lighting uniforms in `game` mode).
   - **Commons Title**: `File:Cumuliform clouds at sunset.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Cumuliform_clouds_at_sunset.jpg
   - **Author**: Vitaium
   - **License**: CC BY-SA 4.0
