# Real-World Field Reference Photographs — Physics, Mass Allometry, Contact/Rock Mechanics & Visitor Anatomy Audit (`T-0239`)

All 4 reference photographs are unmanipulated field photographs from North American boreal / Great Lakes-St. Lawrence / Laurentian forest and Lake Superior shoreline habitats, retrieved from Wikimedia Commons under open Creative Commons / Public Domain licenses.

## `ref-0.jpg` — Adult White-tailed Deer (*Odocoileus virginianus*) in Forest Understory
- **Source page**: <https://commons.wikimedia.org/wiki/File:Buck-in-woods_ForestWander.jpg>
- **Direct image URL**: `https://upload.wikimedia.org/wikipedia/commons/1/1b/Buck-in-woods_ForestWander.jpg`
- **Author**: ForestWander
- **License**: CC BY-SA 3.0 US
- **What it proves**: An adult White-tailed Deer stands `~0.90–1.05 m` at the shoulder (`~75 kg` mean boreal adult mass; Fuller 1990 *Wildl. Monogr.* 110; Ditchkoff 2011) beneath mixed forest stems, with a slender hollow air gap beneath its ribcage (`~0.50 m` belly clearance) and slender cylindrical legs/neck. In contrast, Boreal's `createDeerRig` (`1.95 m` back height, `3.25 m` antler top at `scale = 1.0`, up to `4.55 m` at `scale = 1.40`) combined with `regionVolumes` (`src/core/mass.ts:33–42`) filling solid `~1,060 kg/m³` tissue columns from hooves to back/antlers produces **`515.35 kg`** at `scale = 1.0` and **`1,303 kg`** on wild deer `"1:0:15"` (`scale = 1.363`), while `buildScene.ts:322` (`const [, vd2] = collide(...)`) discards the player's post-collision recoil velocity (`0.00 m/s` speed loss on impact).

## `ref-1.jpg` — Boreal Lowbush Blueberry (*Vaccinium angustifolium*) Mat on Mossy Ground
- **Source page**: <https://commons.wikimedia.org/wiki/File:Lowbush_Blueberry_(Vaccinium_angustifolium)_-_St._John%27s,_Newfoundland_2019-08-08.jpg>
- **Direct image URL**: `https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Lowbush_Blueberry_%28Vaccinium_angustifolium%29_-_St._John%27s%2C_Newfoundland_2019-08-08.jpg/1280px-Lowbush_Blueberry_%28Vaccinium_angustifolium%29_-_St._John%27s%2C_Newfoundland_2019-08-08.jpg`
- **Author**: Ryan Hodnett
- **License**: CC BY-SA 4.0
- **What it proves**: Boreal lowbush blueberry (*Vaccinium angustifolium*) forms a low `0.15–0.30 m` dwarf-shrub mat (`r ≈ 0.38 m` clone patch) with slender woody twigs and foliage totaling `~0.20–0.50 kg` fresh above-ground shoot biomass (`~0.35 kg` mean; Hall et al. 1979 *Can. Field-Nat.* 93:415). In Boreal, `entityMass` (`src/render/mass.ts:18–19`) still uses a pre-`T-0027` 7-ellipsoid dense wood blob formula assigning **`130.38 kg`** at `scale = 1.0` (`372×` overweight; `8,692×` overweight for a `~0.015 kg` `plant` herb clump), while `log` mass (`1,001.92 kg`) and `settleTrunk` (`511.8 kg/m³`) ignore `logDecay.ts` Class 1–5 mass loss (`512 -> 108 kg/m³`).

## `ref-2.jpg` — Glacial Cobble Shore & Boreal Conifer Margin on Lake Superior
- **Source page**: <https://commons.wikimedia.org/wiki/File:Lake_Superior_shore_1.JPG>
- **Direct image URL**: `https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Lake_Superior_shore_1.JPG/1280px-Lake_Superior_shore_1.JPG`
- **Author**: Fungus Guy
- **License**: CC BY-SA 3.0
- **What it proves**: Wentworth cobble-class stones (`0.064–0.256 m` diameter, `~2–14 kg` at `2,620–2,900 kg/m³` granite/basalt density) pack together on boreal shorelines and slopes at their natural frictional angle of repose (`~32–38°`; Carson 1977 *Earth Surf. Process.* 2:363), embedded in underlying gravel/till with substantial Coulomb sliding resistance (`F = μ m g ≈ 55–80 N` for a `9.2–13.4 kg` cobble). In Boreal (`src/core/rocks.ts:77–92`, `src/core/events.ts:67–74`), snout-pushing (`move`) translates any cobble up to `0.22 m` (`13.38 kg`) by a fixed `PUSH_DISTANCE = 0.22 m` along a `60°`-quantized hex sector on a `0.55 s` ease regardless of mass, friction, soil embedment, steep slope stability, tree trunks, or surface water (`!isDryLand`).

## `ref-3.jpg` — Adult Human Hiker on Boreal / Great Lakes Forest Trail (Pictured Rocks NL)
- **Source page**: <https://commons.wikimedia.org/wiki/File:Walking_a_trail_at_Pictured_Rocks_NL_(8298c498-d67c-4d5e-8006-d092f1a89859).JPG>
- **Direct image URL**: `https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Walking_a_trail_at_Pictured_Rocks_NL_%288298c498-d67c-4d5e-8006-d092f1a89859%29.JPG/1280px-Walking_a_trail_at_Pictured_Rocks_NL_%288298c498-d67c-4d5e-8006-d092f1a89859%29.JPG`
- **Author**: National Park Service (NPS photo)
- **License**: Public Domain (US Federal Government work)
- **What it proves**: An adult human forest visitor stands `~1.70–1.80 m` (`1.75 m` ICRP 23 reference stature, `~70 kg` body mass), with cranial height `~1/7.5` of total stature (`~0.23 m`; Drillis & Contini 1966), articulated hip/knee/shoulder stride oscillation while walking at `~1.3 m/s`, and feet/legs resting entirely above ground. In Boreal (`src/render/geometry.ts:164–170`, `src/render/mass.ts:21–22`, `src/render/buildScene.ts:492–494`), `person` at `scale = 1.0` stands **`2.28 m`** (`2.45 m` mean, up to **`3.19 m`** at `scale = 1.40`) with a **`0.50 × 0.60 m` (`83 kg`) sphere head**, **`422.83 kg`** base mass (`690.65 kg` on wild visitor `"4:0:15"`), welded `0.00 rad` cylinder legs that glide without stride, and a `'rest'` posture that plunges the rigid legs **`0.45 * scale` (`0.34–0.63 m`) vertically underground** at a `20.1°` forward pitch.
