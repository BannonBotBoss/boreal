# Documentary & Generated Reference Sources (T-0303)

1. **`ref-0-blm-wasson-lake-conifer-aerial.jpg`** (`293,885 B`)
   - **Subject:** Oblique aerial photograph of dense conifer forest surrounding a dark reflective boreal-type lake (Wasson Lake, Devil's Staircase Wilderness).
   - **Source:** Bureau of Land Management (BLM) Oregon & Washington — Public Domain (US Federal Government work; copied from repo `tasks/evidence/drone-ref/wasson-lake.jpg`, Wikimedia Commons `File:Wasson_Lake,_Devil's_Staircase_Wilderness_(49229155023).jpg`).
   - **Used against:** `frame-6-live-drone-band-day-400m.png` (live `400 m` daytime in-page drone glide over Kenora boreal landing rendering flat blocky brown-ochre polygons with zero conifer canopy structure, alongside the `6,674.4×` `Shift+G` ascent snap and `1`-frame `404.35 m -> 4.47 m` `G` embody teleport).

2. **`ref-1-midnight-boreal-forest-aerial-reference.jpg`** (`761,303 B`)
   - **Subject:** Low-luminance oblique aerial view (`~35°` below horizon from `400 m`) over a northern boreal spruce/pine forest and dark reflective lake at `01:00 AM` midnight under starlight and dim moonlight (dark charcoal-indigo canopy, dark water, no daytime blue fog, no clipped whiteout).
   - **Source:** Generated reference image (`image-generator` subagent, 2026-11-21) matching Boreal's exact `01:05 AM` `400 m` isometric drone description (Rule 6 & Step 2).
   - **Used against:** `frame-7-live-drone-band-midnight-blue-fog.png` (live `01:05 AM` `400 m` midnight drone band blown out into blinding pure-white/neon-chartreuse overexposure with hardcoded midday blue fog `RGB(0.45, 0.62, 0.9)` from `src/world/globe/inpage.ts:473–476`).

3. **Additional Published Standards & Peer-Reviewed Citations Verified in `audit.ts`:**
   - **ISO 9241-110 (Controllability, Conformity with User Expectations, Error Tolerance)** — Gallery `Edit` opened from `#vf-bar` must freeze the simulation and route `WASD`/drag to the photo camera instead of walking the wolf; exiting Photo Mode during active `MediaRecorder` recording must await `onstop` before checking `gallery.count`; `V` camera mode must not hijack desktop keyboard into Pad Menu or render a keyboard-dead `.padx` overlay; browser modifier shortcuts (`Ctrl+-`, `Ctrl+M`) and focused `<select>` controls must not be hijacked by audio hotkeys; WebGL context loss must halt the `rAF` draw loop and provide an actionable Reload control.
   - **WCAG 2.1 AA (SC 1.4.3 Contrast Minimum, `>= 4.5:1`, & SC 1.4.10 Reflow)** — `#camera-panel` `Filter` `<select>` contrast (`frame-3`) and `640×720` split-window HUD overlap avoidance (`frame-4`).
   - **NOAA / Allen (1976) Night Sky Illuminance** — Clear moonless/starlit midnight illuminance is `~0.001–0.05 lx` (`< 0.0001%` of midday `100,000 lx`), requiring dark low-luminance night fog and night-scaled aerial exposure rather than hardcoded midday blue fog `RGB(0.45, 0.62, 0.9)` and `5.2×` daytime background gain (`inpage.ts:473–476`).
