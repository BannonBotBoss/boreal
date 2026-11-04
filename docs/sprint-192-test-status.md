# Sprint #192 test status (Nov 2 item, early run)

Grokbot-1, run on the box at main `82d6b1a` on Nov 1 2026 around 01:15 PT.

| check | command | result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | clean (exit 0) |
| JS/TS tests | `npm test` | 1037 tests: 1023 pass, 0 fail, 14 todo (about 91 s) |
| Build | `npm run build` | ok, built in 5.7 s; largest chunks `world` 697 kB (193 kB gzip), `main` 570 kB (203 kB gzip) |
| Rust | `npm run test:rust` (cargo from `~/.cargo/bin`) | 119 passed, 0 failed |

## Re-run at `1ffd063` (Nov 1, about 08:20 PT)

After #222 to #225 merged: `npx tsc --noEmit` clean; `npm test` 1040 tests, 1026 pass, 0 fail, 14 todo; `npm run build` ok;
`npm run test:rust` 119 passed, 0 failed. `tests/ten-location-ecosystem.test.ts` passes with the Arctic, Hudson Bay, Amazon,
Egypt and Montana-shore fixes.

Still open after that Nov 1 re-run: measured FPS and memory at the ten sites, and the in-browser
screenshots, needed a WebGL browser run. The headless cover and wildlife matrix is in `docs/ten-location-ecosystem.md`.

## Handoff re-run (Nov 2, 19:49–19:52 UTC)

grokbot-3. Source under test is main `2dc8e20` (through #243). The frames and the first copy of this note are commit `2aa6820`. No TypeScript or Rust files were edited, so these checks are the `2dc8e20` tree.

| check | command | result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | clean (exit 0) |
| JS/TS tests | `npm test` | 1059 tests: 1045 pass, 0 fail, 14 todo (about 111 s) |
| Build | `npm run build` | ok, built in 4.36 s; largest chunks `world` 698 kB (195 kB gzip), `main` 571 kB (205 kB gzip) |
| Rust | `npm run test:rust` | 130 passed, 0 failed (lib tests, 54 s) |

The in-page screenshots are `tasks/evidence/T-0127/`. Hardware FPS and GPU memory stay **UNVERIFIED**: the capture renderer was SwiftShader, and this machine has no GPU. Software `frameMs` in that folder is not a hardware frame time. GitHub `test` and `slow` are the PR checks; this local run is the build and Rust coverage CI does not record.

## Squash on main `e22e358` (Nov 2, 20:23 UTC)

PR #245 squash-merged to main as `e22e358d3213bffc77fcbbc409f767582e6f3015`. That is the handoff commit. Its parent is `940346d` (#244, ice-line aspect), which Grokbot-1 merged while the capture was running. grokbot-3 did not merge #244. The ten frames were captured on `2dc8e20` (through #243) and do not include the #244 ice-line change.

GitHub `test` passed in 4m17s and `slow` passed in 28m0s on the PR branch before the squash (run [41514235917](https://github.com/BannonBotBoss/boreal/actions/runs/41514235917)).

The four commands were run again on `e22e358` itself, 20:25–20:28 UTC (this tree includes #244):

| check | command | result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | clean (exit 0) |
| JS/TS tests | `npm test` | 1059 tests: 1045 pass, 0 fail, 14 todo (about 119 s) |
| Build | `npm run build` | ok, built in 4.72 s; largest chunks `world` 698 kB (195 kB gzip), `main` 571 kB (205 kB gzip) |
| Rust | `npm run test:rust` | 131 passed, 0 failed (lib tests, 58 s) |

Hardware FPS and GPU memory on that commit stay **UNVERIFIED**.

## Recapture on main `afecd46` (Nov 3, 15:54–15:58 UTC)

grokbot-3. Source under test is main `afecd46` (through #260: #247 GI probe NaN fix, #248 coast and tundra cover, #249 tree thinning, #250–#260 layered clouds). No TypeScript or Rust files were edited, so these checks are that tree. The frames are `tasks/evidence/T-0129/`.

| check | command | result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | clean (exit 0) |
| JS/TS tests | `npm test` | 1073 tests: 1059 pass, 0 fail, 14 todo (about 120 s) |
| Build | `npm run build` | ok, built in 5.25 s; largest chunks `world` 698 kB (195 kB gzip), `main` 572 kB (206 kB gzip) |
| Rust | `npm run test:rust` | 131 passed, 0 failed (lib tests, 57 s) |

Hardware FPS and GPU memory stay **UNVERIFIED**. The capture renderer was SwiftShader, and this machine has no GPU. Software `frameMs` in T-0129 (10.2–15.9 ms) is not a hardware frame time.

Gate verdicts from the T-0129 frames, against T-0127:

| gate | verdict |
|---|---|
| Smooth descent to game mode | PASS. All ten dropped on the click, glided from 2100 m through under 650 m, and embodied at 400 m in `game`. |
| Coordinates | PASS at nine sites (within 0.001°). Wetland is still 0.0078° and 0.0125° off, the same offset as T-0127. |
| Cover against the picture | PARTIAL. Boreal now reads boreal, coast now reads boreal, polar now reads tundra. Yukon still reads boreal over a closed mixed stand with an empty census. Desert still draws trees. Ocean and wetland are still dry prairie. Polar tundra is still a conifer stand. Prairie is still spruce. |
| Wildlife you can see | PARTIAL. The boreal five, the coast deer and eagle, the ocean bear, the polar caribou and a white canid, the prairie hare, deer, and eagle, and the wetland deer, beaver, and moose are readable. The tropics deer is not. The desert fox is only a sliver. Yukon is still empty. |
| Readable ground (black foreground) | PASS. Near-black share of the lower-middle band fell from 22–72% to 0.0–19.0%. Ground and plants are lit at all ten. The wetland landed frames have a flat black region in the upper right, with no shader error. |
| Clouds on the descent | PARTIAL. No black cloud base and no shader error. The nadir frames at 2100 m and about 760–800 m do not show a readable cloud deck. Wetland 2100 m has blocky green tiles. Wetland ~799 m is a blurred warm field with soft bands. Ocean ~798 m is blocky translucent green polygons. |
| Hardware FPS and GPU memory | UNVERIFIED. No GPU. |
| Tests, build, and Rust | PASS. Local results above. GitHub `test` and `slow` are the PR checks. |

## Wildlife placement on main `5c0075d` (Nov 3)

grokbot-3. Branch `cursor/landing-cast-view-1634`. The frames were captured on this branch, then the branch was rebased onto main `0e986dc` (#267, interior thermal dump only). That commit does not touch the viewer. The viewer places the census cast inside the follow camera's frame, beside the wolf when there is only one animal, and clears the sight line. The Rust simulation, the census, the cover classification, `world/globe/inpage.ts`, `render/sky.ts`, the landed-ground lighting, and the cloud code were not edited. The frames are `tasks/evidence/T-0130/`.

| check | command | result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | clean (exit 0) |
| JS/TS tests | `npm test` | 1082 tests: 1068 pass, 0 fail, 14 todo (about 110 s) |
| Build | `npm run build` | ok, built in 4.26 s; largest chunks `world` 698 kB (195 kB gzip), `main` 577 kB (207 kB gzip) |
| Rust | `npm run test:rust` | 131 passed, 0 failed (lib tests). Rust sources were not edited. |

Hardware FPS and GPU memory stay **UNVERIFIED**. The capture renderer was SwiftShader, and this machine has no GPU. Software `frameMs` in T-0130 (6.6–35.6 ms) is not a hardware frame time.

Wildlife against the T-0129 frames: the tropics deer and the desert fox now read beside the wolf. The boreal five still read. Coast, prairie, polar, and wetland still show at least the animals that read before, and some show more. Ocean still shows a census animal (the deer); the bear is mostly behind the wolf. Yukon tundra and alpine are still an empty census. The procedural lynx is still not a body that can be picked out.
