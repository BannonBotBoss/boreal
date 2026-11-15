# Real-World Aerial Boreal Lake Shoreline, Nocturnal Darkness & Arid Desert Reference Sources (`T-0245`)

All four reference photographs are unmanipulated public-domain or Creative Commons photographs from Wikimedia Commons / U.S. Federal Government agencies:

1. **`ref-0.jpg`** — Nadir nighttime Suomi NPP VIIRS Day-Night Band + USGS Landsat view over unpopulated North American wilderness (`Dark Skies Over the Great Basin`), showing near-zero nocturnal radiance across unlit natural terrain, ridges, and lakes away from human settlements (paired with `frame-0.png`: `450 m` nadir globe view over Boreal's home lake shoreline at `00:03` astronomical midnight where `tile.ts:569–580` `uCrownFloor = 1` overwrites `gl_FragColor.rgb = floorD` after tone-mapping across all land, `overheadCrowns.ts` `FLOOR_FRAG` (`toneMapped: false`, `depthTest: false`) covers the open lake in an unlit green moss/grass plane, and `overhead-shadows` stamps directional black sun shadows under a `-26.8°` sun).
   - **Commons Title**: `File:Dark Skies Over the Great Basin (154735 - vir 20250812 lrg).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Dark_Skies_Over_the_Great_Basin_(154735_-_vir_20250812_lrg).jpg
   - **Author**: NASA Earth Observatory (Wanmei Liang, USGS Landsat & Suomi NPP VIIRS Day-Night Band)
   - **License**: Public domain (United States federal government work)

2. **`ref-1.jpg`** — Low-altitude oblique daytime aerial photograph over Superior National Forest boreal lake country (Minnesota / Canadian Shield border adjacent to Kenora–Quetico), showing irregular self-thinning clumped conifer and aspen canopy ($R \approx 0.85\text{–}1.05$) terminating strictly at rocky shorelines with zero trees growing in open lake water and continuous 3D crown texture from foreground to the multi-kilometre horizon (paired with `frame-1.png`: daytime `135 m` `band` drone view where `horizonCover` places `4,096` stored `.glb` tree cards on an unjittered `6 m × 6 m` rectangular lattice ($R = 2.000$) straight across submerged water cells and truncates abruptly at `219.6 m` (`5.9%` of the `900 m` annulus), while seeded `homeLon` drapes Central Asian steppe EOX tiles over the Kenora boreal forest).
   - **Commons Title**: `File:Lake country from air, October 1969 (5187451237).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Lake_country_from_air,_October_1969_(5187451237).jpg
   - **Author**: U.S. Forest Service, Superior National Forest
   - **License**: CC BY 2.0 (also U.S. Forest Service work)

3. **`ref-2.jpg`** — Starlit nocturnal view across Lake McDonald and sub-boreal conifer ridges in Glacier National Park, showing dark silhouetted conifer slopes, dark star-reflecting lake water, and a low-luminance nocturnal horizon without any daylight sky-blue haze band or glowing green trees (paired with `frame-2.png`: `260 m` `band` drone view at `00:03` astronomical midnight where `horizonMesh.ts:21, 93–100` mixes post-tonemap `uSkirtHazeColor = RGB(0.78, 0.86, 0.98)` across distant land and `85%` grazing water, `inpage.ts:476` forces `scene.fog.color = RGB(0.45, 0.62, 0.90)`, and `horizonCover` `STYLIZED.foliageLift` glows green in the dark).
   - **Commons Title**: `File:Milky Way over Lake McDonald (17178666872).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Milky_Way_over_Lake_McDonald_(17178666872).jpg
   - **Author**: Glacier National Park (U.S. National Park Service)
   - **License**: Public domain (United States federal government work)

4. **`ref-3.jpg`** — Low-altitude daytime oblique aerial photograph over the Namib Desert, showing bare aeolian sand dunes, gravel plains, rocky inselbergs, and sparse xeric scrub without any boreal conifer canopy mosaic or temperate broadleaf oak trees (paired with `frame-3.png`: daytime `220 m` `band` drone view over a remote `biome = 'desert'` site where `horizonMesh.ts:40, 68–92` leaves `uForest` unread and stamps `22.2 m` boreal conifer `uCanopy` blobs and `12 m` crown contrast over desert sand, `horizonCover.ts:30–33, 109` spawns temperate `oak.glb` and `broadleaf.glb` trees across the desert, and `tile.ts` blends North American boreal NAIP canopy/fen exemplars with `uCrownFloor = 1`).
   - **Commons Title**: `File:Namib desert aerial view.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Namib_desert_aerial_view.jpg
   - **Author**: Hp.Baumeler
   - **License**: CC BY-SA 4.0
