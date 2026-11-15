# Real-World & Human-Factors Reference Sources (`T-0241` Controls, Camera Orbit, Gamepad Completeness, Haptics & Embodied HUD Audit)

All four reference photographs are unmanipulated public-domain or Creative Commons photographs from Wikimedia Commons:

1. **`ref-0.jpg`** — Wild Gray Wolf (*Canis lupus*) standing/moving in a summer meadow with an unobstructed, diegetic sightline (paired with `frame-0.png`: embodied play rendering always-on numeric health/reserve readouts `Stamina 100/100 · Energy 75/100 · Water 100% · Rest 100%` in `#status` in violation of Rule 18 `#102` & `#118`, `#data-panel-btn` crashing over `<header>` `"PROCEDURAL WORLD / 01"`, `#camera-panel` colliding over `Library / controls` and hijacking the `C` stealth key, and `main.ts:612` normalizing yaw steer with forward throttle to cut turning forward speed by `29.3%`).
   - **Commons Title**: `File:Gray Wolf - Canis lupus (51545668593).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Gray_Wolf_-_Canis_lupus_(51545668593).jpg
   - **Author**: Gregory Smith
   - **License**: CC BY-SA 2.0

2. **`ref-1.jpg`** — Wild Gray Wolf (*Canis lupus*) carrying prey in its jaws while framed centered from a ~60° three-quarter flank observation angle (paired with `frame-1.png`: `positionCamera` in `src/render/math.ts:38-43` keeping `camera.position` fixed behind the tail and panning `camera.lookAt` so a `60°` horizontal orbit pushes the embodied wolf completely off-screen at `ndcX = -2.1132`, snapping back to `0°` on pointer release, limiting Right-Stick look yaw to `1.0 rad/s` = `57.3°/s`, and leaving `eatPrey` / `releasePrey` with `pad: []` so `#device` reads `— eat held · — release`).
   - **Commons Title**: `File:Wolf with dinner (6923936041).jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Wolf_with_dinner_(6923936041).jpg
   - **Author**: Denali National Park and Preserve (NPS)
   - **License**: Public domain (United States federal government work)

3. **`ref-2.jpg`** — Standard W3C / Microsoft Xbox Wireless Controller showing circular mechanical thumbstick gates, ABXY face buttons, View (`⧉`), Menu (`≡`), bumpers, and triggers (paired with `frame-2.png`: `src/core/bindings.ts:166-168` applying independent per-axis square `DEADZONE = 0.18` that creates a `20.74°` cardinal dead cross and `-35.7%` 45° stick turn speed loss, `8` `play`/`any` actions missing gamepad defaults in `Controls`, and `src/ui/controls.ts` dumping `87` ungrouped rows while bleeding over the unhidden game footer).
   - **Commons Title**: `File:Microsoft-Xbox-One-controller.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Microsoft-Xbox-One-controller.jpg
   - **Author**: Evan-Amos
   - **License**: Public domain (CC0 / Public Domain dedication)

4. **`ref-3.jpg`** — Garmin G1000 Multi-Function Display (MFD) showing complete dark-background context softkeys/page groups with non-overlapping bezel/overlay hierarchy (paired with `frame-3.png`: `src/ui/gamepadSettings.ts` & `CONTEXTS` in `src/core/bindings.ts:25` omitting `'axis'` so all `12` `axis*` actions are unreachable, hardcoded keys/buttons in `timeHud.ts`/`menu.ts`/`dataPanel.ts`/`cameraPanel.ts` bypassing saved rebindings, `#data-panel-btn` bleeding at `z-index: 70` over `Gamepad settings` / `Photo mode` / `Globe`, unclamped `> 1.0` W3C `GamepadHapticActuator` magnitudes, unwired `setXRSession`, and `0` tactile feedback on the `#109` `±1×` time-dial detent).
   - **Commons Title**: `File:Multi Function Display Garmin G1000.jpg`
   - **URL**: https://commons.wikimedia.org/wiki/File:Multi_Function_Display_Garmin_G1000.jpg
   - **Author**: Kyle Harmon (`WKHarmon`)
   - **License**: CC BY 2.0
