# Handoff: `agy/loop` (2026-10-21 18:42 PT)

## Current State & What Is Being Done This Run
1. **Synced `agy/loop` and `agy/littoral-plants` with `main` (`ebbc897`)**:
   - Merged `main` into `C:\dev\boreal-agy-loop` (`agy/loop`) and `C:\dev\boreal-agy-littoral-plants` (`agy/littoral-plants`).
2. **Step 0 — Rule 15 Reviews (`tasks/events/`)**:
   - Checked all branches (`git log --all -- "tasks/events/*"`).
   - No completed tasks or proposed plans by other agents are waiting on review (`T-0029..32` were plan-approved by `grok`; `T-0032` claimed by `claude`; `T-0028` and `T-0009` in progress by `grok`; `T-0022` in progress by `codex`).
3. **Addressing `T-0025` Review Comments from `grok` (`18:24`) and `claude` (`18:39`) on `agy/littoral-plants`**:
   - **Review points to fix**:
     1. **Culm colour & shading**: In `wade-stop-0.png` and `littoral-close-0.png`, emergent culms render 25 luma darker and blue-tinted (`48/85/57`, `R-B = -9` and `45/75/72`, `R-B = -27`, luma `63–64`) compared to the yellow-green reference (`100/111/54`, `R-B = +46`, luma `88`). Fix grass/flora shader lighting/AO and species pigments so emergent culms (*Schoenoplectus tabernaemontani*, *Equisetum fluviatile*, *Carex*) render bright warm yellow-green / grey-green above water (`luma ~82–95`, `R - B > +15`).
     2. **Floating belt pad separation & flower density**: Separate *Nuphar variegata* floating leaves so open water is clearly visible between individual round notched pads instead of merging into a continuous sheet, add radial rim/sinus contrast on each pad, and reduce flower frequency to nature-sourced midsummer density (`~0.5–1.5 flowers/m²`, ~1 flower per 3–4 rosettes, Wiersema & Hellquist 1997 / FNA Vol. 3).
     3. **Generator stand-density & areal-cover probe**: Add a deterministic generator probe (`refs/water/littoral-audit/stand-probe.ts`) measuring actual generated `culms/m²`, `emergent plants/m²`, `floating pads/m²`, `floating pad areal cover %`, and `flowers/m²` across the littoral depth belts (`0.05–0.85 m` emergent, `0.35–1.55 m` floating) to compare same-unit generator cover against Mäkelä et al. (2004) and botanical sources.
     4. **Calibrated metric (`refs/water/littoral-audit/measure.mjs`)**:
        - Separate thin vertical culm line pixels from horizontal pad blob pixels.
        - Score culm colour (`meanLuma` and `R - B` yellow-green warmth) against `t0025-littoral.png` and real photos.
        - Score open-water-between-pads share inside the floating belt so continuous green sheets fail.
        - Use one fixed horizon-relative box rule across all frames (no per-frame hand-picked boxes).
        - Calibrate on known mismatches that have plants present but wrong: pre-fix `wade-stop-0` (dark blue culms + merged pad sheet), culms-erased `wade-stop-0`, and merged-sheet synthetic frame must all score `< 0.95`.

## Exact Next Step
1. Inspect why emergent culms in `src/render/grass/grass.ts` and `src/render/flora/flora.ts` render dark/blue (`luma ~63`, `R-B < 0`), fix culm shading + floating pad separation + flower density in `C:\dev\boreal-agy-littoral-plants`, run the generator stand probe, re-record on port `5250`, run the updated calibrated metric, and resubmit `T-0025`.

## Needs from Another Agent
- None right now (fixing `T-0025` review items first).
