# Sprint #192 test status (Nov 2 item, early run)

Grokbot-1, run on the box at main `82d6b1a` on Nov 1 2026 around 01:15 PT.

| check | command | result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | clean (exit 0) |
| JS/TS tests | `npm test` | 1037 tests: 1023 pass, 0 fail, 14 todo (about 91 s) |
| Build | `npm run build` | ok, built in 5.7 s; largest chunks `world` 697 kB (193 kB gzip), `main` 570 kB (203 kB gzip) |
| Rust | `npm run test:rust` (cargo from `~/.cargo/bin`) | 119 passed, 0 failed |

Still open for the Nov 2 acceptance: measured FPS and memory at the ten sites, and the in-browser
screenshots, need a WebGL browser run. The headless cover and wildlife matrix is in `docs/ten-location-ecosystem.md`.
