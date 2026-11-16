# Scientific, Visual-Ergonomics, Anthropometric & Hardware Reference Figures (`T-0252` WebXR / IWSDK Seated Journey, Hand-Tracking Biomechanics, Stereo Forest Renderer, and Quest `72/90 Hz` Governor Audit)

All four reference figures are unmanipulated Public Domain / Creative Commons scientific, visual-ergonomics, anthropometric, and hardware reference images retrieved directly from Wikimedia Commons via the MediaWiki `imageinfo` API (`1280px` width):

1. **`ref-0.jpg` — Meta Quest 3 Standalone WebXR Headset & Optical Hand-Tracking Cameras (`frame-0.png` reference)**
   - **Title**: `File:Meta Quest 3 front View.jpg`
   - **Source URL**: https://commons.wikimedia.org/wiki/File:Meta_Quest_3_front_View.jpg
   - **Author**: `Roy.wonder.cohen`
   - **License**: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
   - **What it shows in nature**: A Meta Quest 3 standalone WebXR headset showing its front depth projector and optical hand-tracking camera array (`72 Hz / 90 Hz / 120 Hz` stereoscopic display, `local-floor` seated tracking, W3C WebXR `immersive-vr` + `hand-tracking` session entry). Any visible `Enter VR` button (`#vr-btn`) on the planet globe (`?view=globe`) or forest view must check `navigator.xr.isSessionSupported('immersive-vr')` and bind a live session handler before allocating a secondary WebGL context, and cleanly release `#iwsdk-root`, `setQuestProfile(false)`, and `world` on `session.end` or forest renderer handover.

2. **`ref-1.jpg` — NASA / WMAP Cosmological Expansion & Planet Formation Timeline (`frame-1.png` reference)**
   - **Title**: `File:CMB Timeline300 no WMAP.jpg`
   - **Source URL**: https://commons.wikimedia.org/wiki/File:CMB_Timeline300_no_WMAP.jpg
   - **Author**: NASA / WMAP Science Team
   - **License**: Public domain (`PD-USGov-NASA`)
   - **What it shows in nature**: Cosmological expansion from hot early plasma through Dark Ages, first stars, and planet formation (`9.2 Gyr`), governed by the Friedmann equations — matching the seated IWSDK VR journey (`dark -> sphere -> globe`), where time begins only after the player's opening pinch or open-palm gesture, the equation readout sits comfortably beside (never occluding or truncating) the 3D sphere/globe, pinch-scrubbing bidirectionally updates elapsed cycle across the `sphere <-> globe` boundary without snapping back on release, and hand-rotating the globe preserves its `OneHandGrabbable` orientation without resetting `lookAt` or accidentally triggering a fall after `0.3 s`.

3. **`ref-2.png` — Human Foveal, Parafoveal & Peripheral Visual Field Eccentricity Zones (`frame-2.png` reference)**
   - **Title**: `File:Peripheral vision.svg`
   - **Source URL**: https://commons.wikimedia.org/wiki/File:Peripheral_vision.svg
   - **Author**: `User:Zyxwv99`
   - **License**: CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)
   - **What it shows in nature**: The human binocular visual field partitioned into central foveal (`5°`), macular (`18°`), central (`30°`), and near/mid/far peripheral (`60°–110°`) eccentricity rings. During a seated orbital drop (`14 s` log-altitude glide to `400 m` over the visible planet/terrain, Issue `#285`) or forest locomotion, a VR comfort vignette (Fernandes & Feiner 2016, IEEE 3DUI) masks **peripheral** optical flow (`> 25°–35°` eccentricity) while keeping **central foveal vision (`0°–25°`) `100%` clear (`alpha = 0`)** over visible scenery — never blanking the world into a `10 s` empty dark `#071018` void covered by a uniform solid-black full-fovea quad (`opacity = 0.55–0.70`).

4. **`ref-3.png` — Human Hand Osteology: Radiocarpal Wrist, Metacarpals & Phalanges (`frame-3.png` reference)**
   - **Title**: `File:Scheme human hand bones-en.svg`
   - **Source URL**: https://commons.wikimedia.org/wiki/File:Scheme_human_hand_bones-en.svg
   - **Author**: Mariana Ruiz Villarreal (`User:LadyofHats`); retouches by `Nyks`
   - **License**: Public domain (`CC0 / PD-self`)
   - **What it shows in nature**: Human hand skeletal proportions from the radiocarpal `wrist` through the carpals, metacarpals (`palm`), and proximal, middle, and distal phalanges (`fingertips`). Across adult humans (Garrett 1971; NASA-STD-3000 Vol. I Table 3.3.1, 5th-percentile female `16.5 cm` to 95th-percentile male `21.1 cm`), fingertip curl vs extension scales proportionally to each individual's own palm/metacarpal length (`wrist -> middle-finger-metacarpal`), whereas fixed metric cutoffs (`openM = 0.12 m`, `fistM = 0.09 m`) misclassify neutral resting hands (`13.5–16.5 cm`) as `'open'` and reject 95th-percentile male fists (`9.5–10.5 cm > 0.09 m`). On the forest floor (`#287`), stereo `xrOrigin` must propagate world-space head coordinates to terrain, grass, flora, sky, and GI, lower the seated camera to *Canis lupus* eye height (`~0.70 m`), and expose full hands-only locomotion, gait modes, foraging/hunting, and head-relative snap turning at Quest `72/90 Hz` frame budgets.
