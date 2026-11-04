# smoke-tiers "world not built" on main: bisect (Grokbot-2, 2026-10-28)

Box run: tools/smoke-tiers.mjs adapted for Linux headless Chrome on SwiftShader (no bench lock, Ultra tier only, 20 s hold,
one warm-up load so vite's dependency optimisation does not abort the first load). SwiftShader draws fewer frames than omen,
but the per-commit counts repeat exactly. USE_CSM = lit colour draws, DEPTH_PACKING = shadow draws.

| commit | what | Ultra draws | lit / shadow | smoke |
|---|---|---:|---|---|
| 7490003 | before | 182 | 64 / 90 | pass |
| ec3f34b | #141 | 154 | 67 / 60 | pass |
| e02e804 | #142 | 192 | 69 / 94 | pass |
| 1a38710 | #143 T-0096 one viewpoint | 138 | 26 / 84 | FAIL (break 1) |
| 1a38710 + prewarm fix | | 152 | 66 / 60 | pass |
| d495d29 + prewarm fix | #152 | 191 | 67 / 94 | pass |
| 27d803a + prewarm fix | #161 T-0108 animal ladder | 76 | 20 / 23 | FAIL (break 2, heuristic) |
| 36bf6af + prewarm fix | #155 | 55-72 | | FAIL (same as 27d803a) |
| 5b59c4f unpatched | main | 54 | camera near 60 m, far 12,742 km | FAIL |
| 5b59c4f + this PR | | 58 | camera near 0.2 m, far 700 m | pass |

Break 1 (a real bug, still on main): #143 attaches view.camera to the globe as the one viewpoint (inpage ensureGlobe).
inpage.prewarm() then steps the globe behind the loading screen while the mode is still 'game'; globeView.step maps
the planet camera onto the forest camera and writes the orbit clip onto it (near = altitude x 0.02 = 60 m at the 3 km
entry altitude). Game mode restores 0.2 / 700 only when cameraTouched is set, which the prewarm never sets, so every
game start that runs the prewarm (?nomenu, the start menu, ?at=) clips everything within 60 m of the camera.

Break 2 (not an unbuilt world): with break 1 fixed, the scene at 27d803a has the same chunks, trees and camera as d495d29.
The difference is the player wolf: #161's animal picture ladder shows a still wolf as one rigid wolf.glb mesh and hides the
~42-mesh procedural rig (setBodyShare(root, 0)), and four far hares fade out. That removes ~45 lit and ~70 shadow draws,
so a built Ultra world now draws under the script's 150 floor. The smoke now reads the built chunk count and the game
camera clip from the page instead of inferring them from draws.
