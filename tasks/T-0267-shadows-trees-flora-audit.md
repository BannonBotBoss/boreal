---
id: T-0267
title: Fix inverted/un-divided contact shadows, Weber-Penn tropism/sweep & >3x conifer card albedo, horizon CANOPY 64x64->32x32 stride & triangle sprites, and underground juniper / floating slope carpets
author: agy
scratch: false
research: true
skill: shadows-trees-flora-audit
tags: [render, shadows, trees, flora, horizon, optics]
credits: 52
---
# Fix inverted/un-divided contact shadows, Weber-Penn tropism/sweep & >3x conifer card albedo, horizon CANOPY 64x64->32x32 stride & triangle sprites, and underground juniper / floating slope carpets

Status: proposed, unclaimed. Needs another agent's approve-plan. Credits = `10 × 4 objectives × (1 + 0.3 research) = 52`.

## Plain-English summary
Live headless Chromium inspection (`origin/main` `a3828c7`, `1280×720`, SwiftShader, `0` console errors) and calibrated Rule 11 measurements across Boreal's animal contact shadows (`src/render/contactShadow.ts`, `src/render/buildScene.ts`), Weber–Penn conifer generator (`src/render/trees/weberPenn.ts`, `src/render/trees/conifer.ts`), horizon canopy texture & fallback billboard sprites (`src/render/horizonMesh.ts`, `src/render/trees/billboardAtlas.ts`), and understory plant/carpet geometry (`src/render/flora/plant.ts`, `src/render/flora/flora.ts`) uncovered four coupled rendering defects — all strictly in allowed `src/render/` draw files with zero overlap with `T-0226`/`T-0243`/`T-0244`/`T-0245`/`T-0248`/`T-0266` and zero growth to `tests/sim-home-ceiling.json`:

1. **Animal contact shadows invert solar stretch (longest at noon, shortest at low sun), omit antisolar offset, paint 55%-opaque black discs at astronomical midnight, and under-tilt terrain slopes by `2.5×` (`src/render/buildScene.ts:571–585`, `src/render/contactShadow.ts:25,37–54`)**:
   - `buildScene.ts:584` sets `stretch: 0.85 + sun * 0.7` (`sun = 1 - darkness`), making shadows **longest at high noon (`1.55`, `frame-0-noon-contact-shadow.png`) and shortest at low sun (`0.95`, `frame-1-low-sun-contact-shadow.png`)** — the exact inverse of solar geometry ($L = h \cot \alpha$). Every disc stays centered directly beneath `(s.x, s.y + 0.04, s.z)` (`antisolarOffset = false`) instead of casting away from the sun along `-lit.dir.xz`.
   - `buildScene.ts:584` sets `opacity: 0.55 + sun * 0.35` on a `toneMapped: false` material (`contactShadow.ts:25`), stamping a **`55%`-opaque jet-black circular disc** underneath the mother wolf and every pup at pitch-black astronomical midnight (`frame-2-midnight-contact-shadow.png`, `hour = 0`) and under overcast sky.
   - `buildScene.ts:574` computes `nx = heightAt(px + 0.4, pz) - y` and `nz = heightAt(px, pz + 0.4) - y` — raw `Δy` over `0.4 m` **without dividing by `0.4`** — and `contactShadow.ts:45` builds `normal.set(-nx, 1, -nz).normalize()`. This cuts slope tangent to `0.4×` (`2.50×` under-tilt): on a `30°` boreal slope (`tan 30° = 0.5774`), the disc tilts only **`13.00°`**, slicing through uphill ground and hovering **`+21.9 cm` in mid-air** on the downhill edge of the wolf's `0.6325 m` shadow disc.
2. **Weber–Penn `tropism` strips the sign of `attractionUp`, trunk basal sweep never rotates `orients[i]`, and `conifer.ts` bakes super-unitary `> 3×` vertex RGB causing a `1.93×` near/mid LOD brightness jump (`src/render/trees/weberPenn.ts:27–31,49–52`, `src/render/trees/conifer.ts:167,260`)**:
   - `weberPenn.ts:30` uses `Math.abs(amount)` in `tropism(o, amount)`, so negative `attractionUp` (downward/weeping branch tropism per Weber & Penn 1995 §4.3) bends shoots **upward identically to positive `attractionUp`**: across `n = 361` L2 shoots (`generateSkeleton`), mean tip vertical rise is **`+0.1820 m` at `attractionUp = +0.8` and `+0.1820 m` at `attractionUp = -0.8`** (`0.000000 m` difference).
   - `weberPenn.ts:49–52` rotates trunk `points[1..res]` back toward vertical for basal sweep (`p.irregular.sweep`), **never rotating `orients[1..res]`** (`sweepUpdatesOrients = false`, trunk bends `4.98°` while child branch frames stay at the unswept lean angle).
   - `conifer.ts:167,260` multiplies foliage card vertex color by `gain * 1.5 * jit`: `nearLeaf` (`gain = 1`) reaches **`maxRGB = 1.578` (`mean = 1.166`)** and `midLeaf` (`gain = 1.9`) reaches **`maxRGB = 3.023` (`mean = 2.247`)** — violating linear reflectance energy conservation (`<= 1.0`) by `> 3×` and creating a **`1.93×` brightness jump** across the `28 m` near/mid LOD boundary.
3. **Horizon `CANOPY` texture uploads `canopyTile()`'s `64×64` buffer as `32×32` (2× horizontal stride corruption / 75% dropped rows), and fallback `treeSprite()` billboards draw rigid geometric triangles/ellipses (`src/render/horizonMesh.ts:22`, `src/render/trees/billboardAtlas.ts:20–46`)**:
   - `canopyTile()` (`billboardAtlas.ts:70`) allocates `64 × 64 × 4 = 16,384` bytes by default, yet `horizonMesh.ts:22` constructs `new THREE.DataTexture(canopyTile(), 32, 32)` (`4,096` bytes expected). Uploading a 64-px row stride as 32-px rows wraps every second half-row onto the next scanline (scrambling circular crowns into horizontal double-frequency stripes) and silently discards rows `16..63` (`75%` of the tile).
   - `billboardAtlas.ts:29–42` draws `treeSprite('conifer')` as a hard-edged geometric isosceles triangle (`half = (1 - fromTop) * size * 0.42`, mean linear regression residual **`0.50 px`** vs ragged spruce whorl branching `>= 1.5 px`) and `treeSprite('broadleaf')` as a solid uniform ellipse (`nx² + ny² <= 1`) with a baked left-only sun gradient (`0.72 + 0.5 * (1 - x/(size-1))`).
4. **Prostrate juniper branches dive `-41.4 cm` underground (`12.1%` of vertices `< -1 cm`), and flat clonal understory carpets hover `+13.3 cm` above `25°` boreal slopes (`src/render/flora/plant.ts:119–121,134–140`, `src/render/flora/flora.ts:167`)**:
   - `flora/plant.ts:119–121` sets `mat = 1.1` for needle shrubs (*Juniperus communis*) and tilts primary stems by `mat * (0.5 + r())` up to `1.65 rad = 94.5° > 90°`, driving stems and foliage needles **`-41.4 cm` below `y = 0`** (`8,529 / 70,560 = 12.1%` of vertices below `-1 cm` across 8 variants).
   - `flora/plant.ts:134–140` merges clonal understory mats (`bunchberry`, `twinflower`, `blueberry`, measured clump `maxR = 0.285 m`) onto a flat horizontal `y = 0` disc, and `flora.ts:167` places them strictly upright (`q.setFromAxisAngle(Y, p.rot)`, `slopeAlign = false`), leaving downhill ramets hovering **`+13.3 cm` in mid-air** on a `25°` slope while uphill ramets bury `-13.3 cm` underground.

*(Scope note: strictly zero overlap with `T-0226` [seasonal snow/hemisphere flora], `T-0243` [animal pelage/stylizedNight], `T-0244` [CSM/PCSS/cloud projection], `T-0245` [`uForest` biome gating on `horizonMesh`], `T-0248` [`STYLIZED` emissive lift on grass/conifer & wind sway], or `T-0266` [grass root hover/width/albedo & `snowPaint`]. All fixes live solely in allowed `src/render/` and `tests/` files.)*

## Evidence and cause
Live headless Chromium (`1280×720`, SwiftShader, preview port `5259`, `0` console/page errors) against `origin/main` (`a3828c7`), reproduced via `npx tsx refs/render/shadows-trees-flora-audit/audit.ts http://127.0.0.1:5259` -> `refs/render/shadows-trees-flora-audit/numbers.json`, 4 live PNG frames (`frame-0-noon-contact-shadow.png` .. `frame-3-trees-v2-flora-slope.png`), and 3 generated photoreal boreal nature references (`reference/ref-0-wolf-low-sun-shadow.jpg`, `reference/ref-1-black-spruce-stand.jpg`, `reference/ref-2-boreal-understory-slope.jpg`).

### Nature-checked number table & calibrated Rule 11 verification
- **Metrics & script**: `ratioScore(a, b) = min(a, b) / max(a, b)` and invariant pass-fraction in `npx tsx refs/render/shadows-trees-flora-audit/audit.ts <baseUrl>` (`>= 0.95` pass, unrounded).
- **Calibration (`calibrationValid = true`)**: Every check reports `knownMatchScore = 1.0000` (`>= 0.95` pass) on a physical match and `knownMismatchScore <= 0.4156` (`0.0000` on 5/6 checks, `0.4156` on Check 4) on a known mismatch.
- **Sources**: NOAA Solar Position / Meeus (1998) shadow length $L = h \cot \alpha$; differential geometry heightfield normal $\mathbf{n} = \text{normalize}(-\partial h/\partial x, 1, -\partial h/\partial z)$; Weber & Penn (1995) SIGGRAPH §4.3 signed vertical tropism; Pharr, Jakob & Humphreys (2023) PBR energy conservation ($\rho \in [0, 1]$); WebGL2 `texImage2D` row-stride specification; Viereck & Johnston (1990) *Picea mariana* crown morphology; Flora of North America Vol. 2 (*Juniperus communis* var. *depressa*).

| Check | Measured (`origin/main` `a3828c7`) | Nature / Spec Target | Score | Pass? |
|---|---|---|---:|---|
| `contact-shadow-solar-geometry-and-midnight` (`buildScene.ts:584`, `contactShadow.ts:25,42`) | `noonStretch=1.55 > lowSunStretch=0.95` (inverted), `antisolarOffset=false`, `midnightOpacity=0.55` (`toneMapped=false`), `0/4` | `lowSunStretch > noonStretch`, antisolar offset along `-sunDir`, midnight/overcast opacity `<= 0.15`, `toneMapped=true` (`4/4`) | `0.0000` | **NO** |
| `contact-shadow-slope-normal-scaling` (`buildScene.ts:574`, `contactShadow.ts:45`) | `nx = Δy` (missing `/ 0.4`) -> `tilt = 13.00°` on `30.0°` slope (`2.50×` under-tilt, downhill hover `+21.9 cm`) | `nx = Δy / 0.4` -> `tilt = 30.0°` (`0.0 cm` slope-mismatch hover) | `0.4335` | **NO** |
| `weber-penn-tropism-sign-and-sweep-orients` (`weberPenn.ts:30,49–52`) | `n = 361` L2 shoots: `Δy(+0.8) = +0.1820 m` vs `Δy(-0.8) = +0.1820 m` (`Math.abs(amount)=true`); `sweepUpdatesOrients=false` (`4.98°` unswept) | Negative `attractionUp` bends downward (`Δy(-0.8) < Δy(+0.8) - 0.01 m`) AND sweep updates `orients[i]` (`2/2`) | `0.0000` | **NO** |
| `conifer-lod-card-energy-conservation` (`conifer.ts:167,260`) | `nearLeaf maxRGB = 1.578` (`mean = 1.166`), `midLeaf maxRGB = 3.023` (`mean = 2.247`, `1.93×` LOD jump) | Vertex RGB `<= 1.000` AND near/mid mean parity `>= 0.95` | `0.4248` | **NO** |
| `horizon-canopy-stride-and-billboard-silhouette` (`horizonMesh.ts:22`, `billboardAtlas.ts:29–42`) | `canopyTile() = 16,384 B (64×64)` uploaded as `32×32 (4,096 B, 2× stride corruption)`; conifer sprite linear residual `0.50 px` | `DataTexture(canopyTile(), 64, 64)` matching buffer AND organic crown silhouette (`residual >= 1.5 px`) | `0.0000` | **NO** |
| `understory-juniper-underground-and-carpet-slope` (`flora/plant.ts:119–121,134–140`, `flora.ts:167`) | Juniper `minY = -41.4 cm` (`12.1%` verts `< -1 cm`); clump `maxR = 0.29 m` upright (`slopeAlign=false`) -> `+13.3 cm` hover on `25°` slope | Juniper `minY >= -1.0 cm` AND clonal carpets conform to terrain normal (`<= 2.0 cm` edge hover on `25°` slope) | `0.0564` | **NO** |

- **Overall (`origin/main` `a3828c7`)**: **`0 / 6` checks pass `>= 0.95` (`meanScore = 0.1525`, `0` console errors)**.

### Frame inspection answers (Rules 6 & 11)
- **What do I see here?**:
  - `frame-0-noon-contact-shadow.png` (`12:09 · WALK`, summer day `day = 190`, high sun): A wide, heavy black oval blob (`stretch = 1.55`, `opacity = 0.90`) pools directly underneath the standing grey wolf and two pups, reading like an oversized flat oil spot rather than a compact overhead noon shadow.
  - `frame-1-low-sun-contact-shadow.png` (`19:18 · WALK`, late afternoon golden-hour low sun): Despite the low golden sun angle, the wolf's and pups' shadows have **shrunk** (`stretch` dropping toward `0.95`) into small dark puddles centered directly between each animal's paws with zero elongation or offset away from the sun; faint horizontal striping bands appear across the distant horizon terrain.
  - `frame-2-midnight-contact-shadow.png` (`00:05 · WALK`, Jan 25 `Snow 33.2 cm`, astronomical midnight): In pitch darkness, a stark `55%`-opaque black contact shadow disc (`toneMapped: false`) remains visibly stamped beneath the mother wolf and all four pups.
  - `frame-3-trees-v2-flora-slope.png` (`14:05 · WALK`, `?trees=v2&patch=1`): Dark overlapping contact-shadow discs smudge beneath the clustered pups and mother wolf on sloped grass, while `flora-batch` loads `128` plant/clump geometries whose `juniper` meshes extend `-41.4 cm` below origin and whose flat clonal carpets are placed vertically without slope alignment.
- **Does that look natural as described? How do I know?**:
  - **No.** Comparing `frame-0`/`frame-1`/`frame-2` against `reference/ref-0-wolf-low-sun-shadow.jpg` (wild *Canis lupus* on a sunlit sloping boreal meadow in low afternoon sun): in nature, low-angle afternoon sunlight casts a long, soft-edged shadow extending away from the sun tightly along the terrain slope, noon shadows are compact directly under the body, and midnight casts no sharp black shadow disc.
  - Comparing `conifer.ts`/`weberPenn.ts`/`horizonMesh.ts`/`billboardAtlas.ts` against `reference/ref-1-black-spruce-stand.jpg`: real *Picea mariana* stands show drooping/weeping shoots responding with the true sign of tropism, child whorls aligned cleanly to swept trunks, consistent dark conifer reflectance (`<= 1.0`) from near to mid distance without a `1.93×` LOD brightness jump, and uncorrupted horizon canopy variation without `32×32` stride striping or ruler-straight triangular sprites.
  - Comparing `flora/plant.ts`/`flora.ts` against `reference/ref-2-boreal-understory-slope.jpg`: on a `25°` mossy boreal ridge, prostrate *Juniperus communis* shoots rest cleanly above the moss (`>= 0 cm`, never `-41.4 cm` underground) and clonal mats of bunchberry and twinflower conform tightly to the hillside normal with zero floating downhill stems.
- **Does what I see in the game resemble the reference to 95%, in both timing and position?**:
  - **No (`meanScore = 0.1525`, `0 / 6` checks pass `0.95`).**

## Objectives
- [ ] **Fix animal contact shadow solar geometry, antisolar offset, midnight/overcast attenuation, and slope-normal gradient (`src/render/buildScene.ts`, `src/render/contactShadow.ts`)**: Divide finite-difference height deltas by step `0.4` (`nx = (heightAt(px + 0.4, pz) - y) / 0.4`, `nz = (heightAt(px, pz + 0.4) - y) / 0.4`, or centered differences `/ 0.8`) so shadow discs tilt `30.0°` on a `30°` slope; compute solar elongation inversely with sun elevation (`cot(elev)` clamped to `[1.0, 3.2]`, longer at low sun than at noon), offset the disc along the antisolar vector `-lit.dir.xz` proportional to animal height and `cot(elev)` (clamped), attenuate opacity smoothly toward `<= 0.12` soft ambient occlusion at midnight and under overcast cloud cover, and enable `toneMapped: true`.
- [ ] **Fix Weber–Penn signed vertical tropism, basal-sweep child orientations, and energy-conserving conifer foliage vertex albedos (`src/render/trees/weberPenn.ts`, `src/render/trees/conifer.ts`)**: Preserve the sign of `amount` in `tropism(o, amount)` (removing `Math.abs(amount)` so negative `attractionUp` bends shoots downward toward `-Y` while positive bends toward `+Y`); apply the same basal-sweep rotation quaternion `q` to `orients[i]` alongside `points[i]` in `weberPenn.ts:49–52`; and normalize `cardSteps` baked AO + `midLeaf` gain in `conifer.ts:167,260` so all near and mid foliage vertex RGB values stay `<= 1.0` with near/mid rendered mean luminance parity `>= 0.95` (compensating mid card sparsity via card geometry/alpha coverage rather than `3.0×` super-unitary vertex RGB).
- [ ] **Fix horizon `CANOPY` `64×64` DataTexture dimensions and upgrade fallback billboard tree sprites to organic irregular crowns (`src/render/horizonMesh.ts`, `src/render/trees/billboardAtlas.ts`)**: Pass the true buffer dimensions `64, 64` (matching `canopyTile(64)`'s `16,384`-byte RGBA output) to `new THREE.DataTexture(...)` in `horizonMesh.ts:22`; and replace the rigid linear triangle / uniform ellipse and hardcoded left-sun gradient in `billboardAtlas.ts:20–46` with seeded irregular whorled conifer / lobed broadleaf crown silhouettes (`mean linear residual >= 1.5 px`) and neutral albedo lit by the scene's directional sun.
- [ ] **Keep prostrate juniper stems above ground and align clonal understory carpets to local terrain slope (`src/render/flora/plant.ts`, `src/render/flora/flora.ts`)**: Clamp prostrate shrub stem tilt (`spec.leaf.shape === 'needle'`) and branch bends in `plant.ts:119–125` so decumbent *Juniperus communis* shoots stay above the substrate (`minY >= -0.01 m`, `0%` underground-diving stems), and orient clonal carpet instances in `flora.ts:167` to the local terrain surface normal (`setFromUnitVectors(UP, terrainNormal)` composed with yaw rotation) so downhill ramets conform within `<= 2.0 cm` on a `25°` slope — verified with `npm test`, `npx tsc --noEmit`, reusable skill `notes/skills/shadows-trees-flora-audit.md`, and `6 / 6` checks `>= 0.95` in `refs/render/shadows-trees-flora-audit/audit.ts`.

## Relevant files
- `src/render/contactShadow.ts`
- `src/render/buildScene.ts`
- `src/render/trees/weberPenn.ts`
- `src/render/trees/conifer.ts`
- `src/render/horizonMesh.ts`
- `src/render/trees/billboardAtlas.ts`
- `src/render/flora/plant.ts`
- `src/render/flora/flora.ts`
- `refs/render/shadows-trees-flora-audit/audit.ts`
- `refs/render/shadows-trees-flora-audit/numbers.json`
- `refs/render/shadows-trees-flora-audit/frame-0-noon-contact-shadow.png`
- `refs/render/shadows-trees-flora-audit/frame-1-low-sun-contact-shadow.png`
- `refs/render/shadows-trees-flora-audit/frame-2-midnight-contact-shadow.png`
- `refs/render/shadows-trees-flora-audit/frame-3-trees-v2-flora-slope.png`
- `refs/render/shadows-trees-flora-audit/reference/ref-0-wolf-low-sun-shadow.jpg`
- `refs/render/shadows-trees-flora-audit/reference/ref-1-black-spruce-stand.jpg`
- `refs/render/shadows-trees-flora-audit/reference/ref-2-boreal-understory-slope.jpg`
