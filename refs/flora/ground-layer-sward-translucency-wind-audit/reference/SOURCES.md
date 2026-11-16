# Real-World Visual Reference Sources (`T-0248`)

All four reference photographs are unmanipulated real-world nature photographs from Wikimedia Commons under open Creative Commons / Public Domain licenses:

1. **`ref-0.jpg` — *Cladonia stellaris* reindeer-lichen carpet mats across a Canadian boreal taiga forest floor**
   - **Source**: Wikimedia Commons — [`File:Cladonia-stellaris_taiga.jpg`](https://commons.wikimedia.org/wiki/File:Cladonia-stellaris_taiga.jpg)
   - **Photographer**: Cephas (1 July 2010, Parc national des Grands-Jardins, Québec, Canada)
   - **License**: Creative Commons Attribution-ShareAlike 3.0 Unported ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
   - **Relevance to `frame-0.png`**: Shows the high visual reflectance contrast (`VIS reflectance 0.20–0.28`, pale grey-cream cushions broken into `0.3–2 m` mats over exposed grey-pink granite bedrock alongside dark `0.04–0.08` feathermoss, Petzold & Goward 1988 *Can. J. Bot.* 66:2255) that `src/render/flora/moss.ts` computes, versus `src/render/continuousTerrain.ts:233` (`terrainMaterial().clone()`) dropping `terrainMaterial().onBeforeCompile` (`0%` of `moss.ts` + `pbr.ts` floor detail compiled onto the visible ground!), `src/render/pbr.ts:69–83` overwriting `92%` (`cover = 0.92`) of `groundLayers` inside `10.5 m`, and `0` visible Layer-1 terrain meshes in the `photoreal.ts:68` SH GI bounce probe.

2. **`ref-1.jpg` — Moonless starry-night Ontario forest silhouette**
   - **Source**: Wikimedia Commons — [`File:Night_Sky_Stars_Trees_02.jpg`](https://commons.wikimedia.org/wiki/File:Night_Sky_Stars_Trees_02.jpg)
   - **Photographer**: Michael J. Bennett (9 May 2013, Muskoka, Ontario, Canada)
   - **License**: Creative Commons Attribution-ShareAlike 3.0 Unported ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
   - **Relevance to `frame-1.png`**: Shows a real moonless clear night (`~0.001 lx` starlight + airglow, Kyba et al. 2015 *Sci. Rep.* 5:8409) in an Ontario boreal/hemiboreal forest where crowns, trunks, and ground vegetation are non-emissive dark silhouettes against the starry sky, versus `src/render/grass/grass.ts:145` (`STYLIZED.grassLift = [0.045, 0.068, 0.03]`) and `src/render/trees/conifer.ts:102, 122` (`barkLift`, `foliageLift`) glowing self-luminously green at midnight because neither participates in `buildScene.ts:556` `coatNight`.

3. **`ref-2.jpg` — Mid-June *Stipa pennata* feather-grass meadow steppe in green spring growth & wind**
   - **Source**: Wikimedia Commons — [`File:Stipa_pennata_flowering_spikes.jpg`](https://commons.wikimedia.org/wiki/File:Stipa_pennata_flowering_spikes.jpg)
   - **Photographer**: Le.Loup.Gris (16 June 2011)
   - **License**: Creative Commons Attribution-ShareAlike 3.0 Unported ([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/))
   - **Relevance to `frame-2.png`**: Shows *Stipa* feather-grass in mid-June (`day ~167`, spring/early-summer anthesis, *Flora of China* vol. 22) with live green basal foliage matching green steppe ground, continuous tussock coverage to the horizon, and flexible culms arching smoothly in steppe wind, versus `src/render/flora/steppeTuft.ts` rendering hardcoded cured September straw (`[0.36..0.72, 0.28..0.58, 0.10..0.22]`) atop green `steppeCure(156) = 0` ground, standing `100%` rigid (`0` wind sway), and cutting off abruptly at `STIPA_RADIUS_M = 8 m`.

4. **`ref-3.jpg` — Low morning sun casting sharp dark trunk shadows across backlit forest-floor grass**
   - **Source**: Wikimedia Commons — [`File:Forest_sunrise.jpg`](https://commons.wikimedia.org/wiki/File:Forest_sunrise.jpg)
   - **Photographer**: Peter Heeling (5 October 2015)
   - **License**: Creative Commons CC0 1.0 Universal Public Domain Dedication ([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/deed.en))
   - **Relevance to `frame-3.png`**: Shows low-angle direct morning sunlight through forest trunks where grass and understory leaves **only** exhibit bright yellow-green subsurface translucency inside unoccluded sunbeams while grass inside cast trunk shadows is dark (`0%` direct-beam transmittance, Jacquemoud & Baret 1990 *RSE* 34:75), and tree stems maintain inextensible arc-length geometry, versus `src/render/pbr.ts:96–105` `addTranslucency` glowing brightly inside CSM cast shadows and `src/render/trees.ts:95, 343` / `conifer.ts:34` shearing `22 m` crowns horizontally up to `15 m` at `12 m/s` without vertical foreshortening.
