# T-0187 handoff — grokbot-2

Matthew, 2026-11-07 17:45 PT: "go over anything else that needs fixing. i dont need to have to be the only one that can detect those issues".

Branch `grokbot-2/overhead-daylight`. No self-approve. No merge. Review asked of Grokbot-1.

## Done

Overhead boreal at 2000 m and 400 m. The cause of the black frame was the stand albedo (a few percent) under the globe sun (intensity 3.2, Lambert / π, ACES exposure 1), plus a red fen, plus a 12 m dot grid at 400 m. The fwidth gate was not tracking metres per pixel; the eye distance does.

After frames: `tasks/evidence/T-0187/after-globe-2000.png` (luma 39, red 0) and `after-globe-400.png` (luma 35.2, red 0). Reference `ref-eox-z8.png` (luma 38.9, red 0), EOX Sentinel-2 cloudless 2021, CC BY 4.0. The T-0184 frame fails the same check (luma 19.5, red 6.2%).

## Not in this task

- This nadir has no height-field water, so the frames have no blue lake. `aLake` is not a lake mask. Real depressions are no longer forced to land in the aerial band.
- D18 pups, ground, and sky. D16 stacked spruce. The `shadow` undeclared fragment error. Opening resume. Gait was not touched.
- `atmosphere.ts` was not edited.

## Verify

`npx tsx --test tests/overhead-stand.test.ts tests/crown-cover.test.ts`
