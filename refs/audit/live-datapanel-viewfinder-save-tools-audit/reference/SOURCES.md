# Documentary Reference Sources (T-0302)

1. **`ref-0-nasa-wmap-early-universe-timeline.jpg`** (`220,688 B`)
   - **Subject:** Early-universe cosmological timeline (inflation, quantum fluctuations, CMB afterglow, cosmic expansion history, labeled epoch scale).
   - **Source:** NASA / WMAP Science Team (`File:CMB_Timeline75.jpg` on Wikimedia Commons, Public Domain — US Federal Government work).
   - **Used against:** `frame-0-live-data-panel-and-early-cosmos.png` (unlabeled Expansion/Reheating plots with zero axes/ticks/bounds and un-tone-mapped clipped white-pink `#cosmos-sphere` disc, plus `12×` duplicated `planet` parameters across all non-planet cards and `1.45e6×` `Drives` vs Rust `prey` card mismatch).

2. **`ref-1-nasa-giss-global-surface-temperature-map.jpg`** (`294,432 B`)
   - **Subject:** Global equirectangular surface temperature map with explicit numerical colorbar legend, units, clear geographical coastlines/lat-lon framing, and legible typography.
   - **Source:** NASA Goddard Institute for Space Studies (GISS) / Earth Observatory (`File:NASA-global-warming-map-1970-79-to-2000-09.jpg` on Wikimedia Commons, Public Domain — US Federal Government work).
   - **Used against:** `frame-4-live-tools-planet-layers.png` (`tools/planet-layers.html`: missing colorbar scale/legend, missing latitude/longitude graticule and coastline outlines, identical seed `ts`/`tair` extrema `-61.13 .. 31.28 °C`, coarse blocky `180×90` upscaling).

3. **Additional Published Standards & Peer-Reviewed Citations Verified in `audit.ts`:**
   - **WCAG 2.1 AA (SC 1.4.3 Contrast Minimum, `>= 4.5:1`)** — `#photo-gallery` white-on-white `<select>` dropdowns (`frame-1`) and `tools/locomotion-lab.html` white-on-white `<select>`/`<button>` controls (`frame-5`).
   - **ISO 9241-110 (Controllability & Error Tolerance)** — `Escape` closing active `#data-panel` instead of opening Pause behind it; `Pause -> Save` reporting honest error when `saveBlocked = true` instead of printing `"Saved <time>"`; explicit recovery affordance on corrupt `localStorage` instead of auto-hiding notice before `#loading` finishes or crashing boot on `boreal.badges = "null"`; mouse click support on `tools/gamepad.html` tabs & rows.
   - **Stein et al. 2007 / 2012 (*Nature* 446:904; *Nature* 483:78)** — Oldest known terrestrial forests (*Wattieza* / Gilboa & Cairo, NY) date to the Middle Devonian (`~385 Ma`), ~154 Myr after the base of the Cambrian (`538.8 Ma`, ICS v2026-06), contradicting `deepTime.ts:86` labeling `-538.8 Ma` as `"Oceans, forests and animals"`.
   - **Gough 1981 (*Solar Physics* 74:21) & Dalrymple 2001 (*Geol. Soc. London Spec. Pub.* 190:205)** — Earth formation at `-4.54 Ga` should display the Hadean stage (`hadean`), not fall into `"Before the Earth / No globe"` (`no-planet`) due to HTML range-slider `step` quantization in `tools/deep-time.ts:11`.
