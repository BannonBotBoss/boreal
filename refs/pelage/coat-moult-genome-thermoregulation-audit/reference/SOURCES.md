# Real-World Wildlife Pelage, Seasonal Moult & Thermoregulation Reference Sources (`T-0243`)

All four reference photographs are unmanipulated public-domain or Creative Commons wildlife photographs from Wikimedia Commons / U.S. National Park Service:

1. **`ref-0.jpg`** — Wild Snowshoe Hare (*Lepus americanus*) in full camouflaged white winter pelage (`back` reflectance ~0.88–0.90, retaining dark eye and ear-tip pigment) resting on winter snow beneath boreal conifer branches (paired with `frame-0.png`: midwinter January 15 `dayOfYear = 15`, where `HARE_SKIN` computes `seasonalWhiteness = 1.000` per Mills et al. 2013 *PNAS* 110:7360, yet `animalPicture.ts:202,233` hides the procedural hare rig inside `32 m` and renders static summer-brown `snowshoe-hare.glb` — and `ermine.glb` — coated with `applyStylizedFill` `emissiveIntensity = 14`, `toneMapped = false`).
   - **Commons Title**: `File:Snowshoe hare in winter (6ff16019-41d3-4369-8fa7-667b2ec8624e).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Snowshoe_hare_in_winter_(6ff16019-41d3-4369-8fa7-667b2ec8624e).jpg
   - **Author**: National Park Service / Jim Peaco
   - **License**: Public domain (United States federal government work)

2. **`ref-1.jpg`** — Wild North American Gray Wolf (*Canis lupus*, Druid Peak pack melanistic/grizzled-silver female "Half Black") walking in snow near Lamar River Bridge, illustrating natural *CBD103* ($K^B$) melanistic, grizzled-grey, and cream coat polymorphism, anatomical guard-hair gradients, and individual body-proportion variation (paired with `frame-1.png`: `Pause -> More -> Appearance` on `player:wolf`, where `baseProfile(wolf.root)` in `src/render/appearance.ts:21` skips hidden procedural meshes leaving `canvas.profile` blank with `0` silhouette dots, `setAppearance` in `src/render/buildScene.ts:656-660` never scales or tints the visible `meshy-Gray Wolf` skin, and `MAMA` in `src/render/coatFinish.ts:20-28` overwrites `gl_FragColor.rgb` with one hardcoded charcoal/cream palette across every wolf seed).
   - **Commons Title**: `File:Black and grey wolf (female from Druid pack, "Half Black") walking in snow near Lamar River bridge (16054296980).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Black_and_grey_wolf_(female_from_Druid_pack,_%22Half_Black%22)_walking_in_snow_near_Lamar_River_bridge_(16054296980).jpg
   - **Author**: Yellowstone National Park (National Park Service)
   - **License**: Public domain (United States federal government work)

3. **`ref-2.jpg`** — Wild Red Fox (*Vulpes vulpes*) photographed at night on dark grass, showing natural low-irradiance shading where the russet coat, dark ear backs, and white muzzle attenuate proportionally with nocturnal ambient light (paired with `frame-2.png`: `00:00` midnight in Boreal where `finishFoxCoat` in `src/render/coatFinish.ts:62-66,77` sets `toneMapped = false` and writes `gl_FragColor.rgb = fox` with **zero `outgoingLight` term**, and `dressCervidCoat` in `src/render/coatFinish.ts:100-108` likewise omits `outgoingLight`, causing Red Fox and cervids to glow at `100%` daytime brightness in pitch-dark night).
   - **Commons Title**: `File:City Foxes - Cambridgeshire - City Fox - The Movie (5719043099).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:City_Foxes_-_Cambridgeshire_-_City_Fox_-_The_Movie_(5719043099).jpg
   - **Author**: Huw from UK
   - **License**: CC BY-SA 2.0

4. **`ref-3.jpg`** — Wild Timber Wolf (*Canis lupus*) swimming in cold open water, showing darkened, sleekly clumped wet guard hairs with specular sheen on water-saturated pelage (Lekner & Dorf 1988 *Appl. Opt.* 27:1278) and cold-water immersion exposure (Scholander et al. 1950 *Biol. Bull.* 99:237) (paired with `frame-3.png`: January 15 midwinter wolf in icy boreal water where `coatFinish.ts` and `furCards.ts` have `0%` wet darkening/roughness/clumping, `0%` snow dusting, `0` `windAt` fur deflection, and `needs/engine.ts:35` + `bodyFeelings.ts:115` compute `0.000` cold or wet-coat thermoregulatory energy cost and `temperatureStress = 0.000` at `-30 °C`).
   - **Commons Title**: `File:Timber wolf swimming in water - DPLA - 6a1e3bdddc75a59bb90a47f3944d0cb0.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Timber_wolf_swimming_in_water_-_DPLA_-_6a1e3bdddc75a59bb90a47f3944d0cb0.jpg
   - **Author**: Warren Garst (1922–2016), Colorado State University Libraries / DPLA
   - **License**: CC BY-SA 4.0
