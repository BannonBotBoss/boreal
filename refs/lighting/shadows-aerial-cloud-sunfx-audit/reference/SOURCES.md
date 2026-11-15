# Real-World Boreal Atmospheric Haze, Fog, Winter Tree Shadows & Crepuscular Cloud-Ray Reference Sources (`T-0244`)

All four reference photographs are unmanipulated public-domain or Creative Commons nature photographs from Wikimedia Commons / U.S. Federal Government agencies:

1. **`ref-0.jpg`** — Starlit night sky and Milky Way over remote sub-boreal conifer forest and distant terrain horizon at Big Prairie, Glacier National Park, showing dark foreground ground, silhouetted spruce/fir crowns, and dark distant ridges meeting low-luminance night sky/airglow without any daylight-white horizon glow (paired with `frame-0.png`: `00:00` midnight in Boreal where `sky.ts:150–151` leaves `AERIAL.uHorizon = RGB(0.92, 0.90, 0.84)` unattenuated by `light.day`, causing `continuousTerrain` to glow daylight cream-white at the horizon beneath a dark `0x0d1422` night sky while `scene.fog` fades trees to black).
   - **Commons Title**: `File:Milky Way over Big Prairie (16631110890).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Milky_Way_over_Big_Prairie_(16631110890).jpg
   - **Author**: Glacier National Park (U.S. National Park Service)
   - **License**: Public domain (United States federal government work)

2. **`ref-1.jpg`** — Dense radiation mist and fog bank enveloping a boreal black spruce (*Picea mariana*) forest and underlying terrain ridges together at a shared Koschmieder (1924) extinction scale $V = 3.912/\beta_{\text{ext}}$ (paired with `frame-1.png`: dense fog / rain weather in Boreal where `sky.ts:185,200` shrinks `scene.fog` visibility down to `77.8 m` via Kunkel 1984 so trees vanish into fog, while `continuousTerrain` sets `mat.fog = false` and `aerial.ts:24` hardcodes dry clear-sky `BETA_M = 2.2e-4` `V = 17.78 km` — leaving distant ground crystal-clear beneath vanished trees).
   - **Commons Title**: `File:A mist rises from a black spruce forest.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:A_mist_rises_from_a_black_spruce_forest.jpg
   - **Author**: Steve Hillebrand, U.S. Fish and Wildlife Service
   - **License**: Public domain (United States federal government work)

3. **`ref-2.jpg`** — Winter sunlight through boreal Scots pine (*Pinus sylvestris*) and leafless birch (*Betula*) saplings in Tuntorp, Sweden, casting crisp trunk shadows near caster bases, open sunlit snow between leafless deciduous twigs, and solar-disc (`0.533°`) penumbra softening with shadow distance (paired with `frame-2.png`: January 15 winter noon in Boreal where `trees.ts` lacks `customDepthMaterial` so leafless `uOff = 1` deciduous birch/aspen cast solid summer-foliage cones and swaying crowns cast rigid frozen shadows, `photoreal.ts:92` comments out `CSM` `shadowMapSize`, and `#ifdef PCSS` is read by `0` shaders).
   - **Commons Title**: `File:Sun and tree shadows on snow in Tuntorp.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Sun_and_tree_shadows_on_snow_in_Tuntorp.jpg
   - **Author**: W.carter
   - **License**: CC BY-SA 4.0

4. **`ref-3.jpg`** — Broken cumulus cloud shadows mottling forested slopes and crepuscular sunbeams passing only through cloud gaps above the ridge while solid distant mountain ridges (`> 2 km`) completely occlude direct sunlight (paired with `frame-3.png`: low-sun vista across `> 1.6 km` Boreal terrain ridges where `uCloudTex` is `0.000` across all cells despite planetary cloud cover and clamps `100%` of Kenora solar slant rays outside `±192 m`, `addCloudShadow` double-attenuates Kasten–Czeplak `1 - 0.75 C^3.4`, and `SUNFX` `step(0.9999, tDepth)` treats all solid hills beyond `~1.6 km` as unoccluded sky — shining god-rays through solid terrain and under `100%` overcast or `-2.86°` post-sunset skies).
   - **Commons Title**: `File:Sunbeams (163792095).jpeg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Sunbeams_(163792095).jpeg
   - **Author**: Raphael Andres
   - **License**: CC BY 3.0
