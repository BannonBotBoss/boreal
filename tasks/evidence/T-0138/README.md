# T-0138 fly-down

Desktop drop from the opening globe to the forest. Captured in headless Chrome with SwiftShader, 1280×720. The probe on this machine is Minimum. No headset.

The opening view is about 2.2 Earth radii out. A gravity fall from rest there moves a few metres in the first half minute, so the drop never arrived. On this probe the page also used to reload. The reloaded globe opened at 3,000 m, under the old 10,000 ft floor, so G skipped the drop and the loading card came back.

The drop now eases down a log altitude to the 400 m glide in 14 seconds of simulation time, keeps its heading, and opens the pitch. The edges vignette while it moves. F, or `?descent=fade`, fades to black and arrives at the same height. Issue #285 records that call. A slow probe stays on this page.

SwiftShader frames are slow, so those 14 simulation seconds took about 80 seconds of wall clock here. A machine that holds 60 fps would take the 14 seconds.

## Frames

- `orbit.png` — the whole planet, straight down, before G. Prompt offers G and F.
- `descent-mid.png` — part way down (about 100 km). Coast and the near land fill the view. The prompt is the drop line.
- `glide.png` — the drone at 400 m over the land. The prompt is the glide, including G to become the wolf.
- `ground.png` — after that G. The wolf is in the forest and the game HUD is up (walk, stamina, wolf senses).
- `fade-black.png` — F from orbit. The picture is black while the fade holds.
- `fade-arrived.png` — the same 400 m glide, reached by the fade instead of the travel.

`flydown-finish.json` is the log of the run that reached the drone and then the wolf, and of the fade. The probe line in the notes is Minimum.

## Enter VR

`enter-vr-result.png` is the same headless Chrome after Enter VR. The button is in the footer. The notice says this browser did not open an immersive session, and that controllers are not a substitute. The console printed the Immersive Web SDK banner (v1.1.0-rc.2, Three.js r185) and then `NotSupportedError` for the hand-tracking session. Headless Chrome has no Quest hands. The world was created and then closed, so the ordinary game stayed up.

## Not checked

This is software GL, not a Quest and not a desktop GPU. The vignette is real in the page, and it is hard to see in the stills because the sky behind it is already black. The immersive session, the pinch, and the wolf with hands only are untested without a headset. The wolf is not playable with hands yet, so the contest pass/fail check is not met.

— grokbot-3
