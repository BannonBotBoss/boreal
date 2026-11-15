# Real-World Boreal Lake Basins, Continuous Horizon Fetch, Underwater Snell's Window & Nocturnal Freshwater Reference Sources (`T-0246`)

All four reference photographs are unmanipulated public-domain or Creative Commons photographs from Wikimedia Commons / scientific & government repositories:

1. **`ref-0.jpg`** — Boreal Shield lake basin at Nestor Falls, Lake of the Woods, Ontario (the exact Kenora–Lake of the Woods geographic region modelled by Boreal's home world), showing open water completely filling the glaciated Shield depression up to the spruce/birch shoreline and rocky island (paired with `frame-0.png`: Boreal's `19.22 m`-deep home base-water lake basin at `(-100, -340)` near spawn where `surfaceAt` reports `lake: { surface: -0.25, kind: 'open' }, soil: 'water'`, `terrainCore` omits `waterGeo` because `lakeGrid` skips base-water outlets, and `buildScene.ts:180` `drawOpenWater` returns `false` across `99.40%` of home base-water lake points — draining `27%` of the home map into bare khaki-olive `0x929771` craters).
   - **Commons Title**: `File:Scenery of Lake of the Woods Ontario ^^Nestor falls ^^Au lac des Bois une des 14000 isles du Lac ^ - panoramio.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Scenery_of_Lake_of_the_Woods_Ontario_%5E%5ENestor_falls_%5E%5EAu_lac_des_Bois_une_des_14000_isles_du_Lac_%5E_-_panoramio.jpg
   - **Author**: Roger Sylvia
   - **License**: CC BY-SA 3.0

2. **`ref-1.jpg`** — Clearwater Lake in the Boundary Waters Canoe Area Wilderness (Superior–Quetico Canadian Shield), showing a continuous Fresnel-reflecting water sheet extending uninterrupted from the rocky conifer shoreline across hundreds of metres into atmospheric aerial perspective at the distant forested shore and horizon (paired with `frame-1.png`: Boreal's `102.6 ha` perched boreal lake at `(2265, 3180)` looking east across a `710 m` fetch, where `mountChunkWater` mounts `staged-water` only within `INTEREST.mid = 100 m`, cutting off in a rectangular `40 m` chunk stair-step cliff in mid-lake and exposing the remaining `610 m` of open lake — and `99.975%` of ocean horizon discs — as dry khaki-olive dirt without `curvatureDrop` or `addAerialPerspective`).
   - **Commons Title**: `File:Lake Clearwater (Minnesota).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Lake_Clearwater_(Minnesota).jpg
   - **Author**: chadly
   - **License**: CC BY 2.0

3. **`ref-2.jpg`** — Underwater low-angle scientific photograph looking upward toward the air–water interface (`Ifremer`), showing the bright `48.6°` Snell's critical-angle refraction window (`arcsin(1 / 1.333)`) surrounded by dark total internal reflection on the underside of the wavy water surface together with strong exponential water-column optical attenuation (`Kd > 0`) (paired with `frame-2.png`: Boreal's gameplay camera submerged `~1.7 m` underwater inside the `23.37 m` lake, where `waterMaterial` uses `THREE.FrontSide` so 100% of overhead water triangles are backface-culled and `Kd = 0`, rendering dry subaerial blue Preetham sky, clouds, and unattenuated shoreline spruce trees from underwater).
   - **Commons Title**: `File:Soleil à travers un paysage sous-marin de Bretagne (Ifremer 00378-48922 - 913).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Soleil_%C3%A0_travers_un_paysage_sous-marin_de_Bretagne_(Ifremer_00378-48922_-_913).jpg
   - **Author**: Olivier Dugornay / Ifremer
   - **License**: CC BY 4.0

4. **`ref-3.jpg`** — Starlit nocturnal view over shallow freshwater in Lake McDonald, Glacier National Park, showing dark freshwater reflecting only dim starlight (`< 0.01` nocturnal luminance) with zero self-luminous freshwater bioluminescence on ripples or wakes (paired with `frame-3.png`: Boreal's wolf wading at `00:03` astronomical midnight (`h_sun = -26.2°`), where `water.ts:50` unconditionally injects `totalEmissiveRadiance += vec3(0.55) * crest` so freshwater paw rings and Kelvin V-wakes glow bright neon white in pitch darkness while `waterWake.ts` applies `0 m/s` downstream advection on supercritical river currents).
   - **Commons Title**: `File:Stars on Lake McDonald (43915293311).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Stars_on_Lake_McDonald_(43915293311).jpg
   - **Author**: Glacier National Park (U.S. National Park Service)
   - **License**: Public domain (United States federal government work)
