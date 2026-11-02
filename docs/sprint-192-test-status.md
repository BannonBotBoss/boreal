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
