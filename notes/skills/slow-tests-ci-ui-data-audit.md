# Skill: `slow-tests-ci-ui-data-audit`

Reusable workflow for auditing Boreal's slow end-to-end test suite (`tests/slow/*.test.ts`), live `descent-frame.html` SwiftShader rendering, GitHub Actions CI/Pages workflows & Windows launchers (`.github/workflows/*.yml`, `Play Boreal.vbs`, `Stop Boreal.vbs`), root `index.html` / `src/style.css` desktop & narrow HUD geometry, and scientific reference datasets (`data/**/*.json`, `public/aerial/meta.json`) under Rules 6, 11, and 12.

## Steps
1. **Inspect live GitHub Actions logs first**: run `gh run list --limit 10` and `gh run view <runId> --log-failed` to catch real CI/Pages failures (e.g. `descent-swiftshader.test.ts` missing `--no-sandbox`/`--disable-dev-shm-usage`, `pages.yml` deprecated `upload-pages-artifact@v3`, and logged `climate-kenora.test.ts` annual precipitation / July temperature figures).
2. **Audit slow tests for cross-platform & scientific validity**:
   - Check browser discovery (Linux-only `/usr/bin/google-chrome` breaks Windows), Vite launch (`node node_modules/vite/bin/vite.js` instead of `.bin/vite`), temp/artifact paths (never `/opt/cursor/artifacts` or uncleaned `/tmp/...`), dynamic ports (`freePort()`), and explicit `devDependencies` (`playwright-core`).
   - Compare pinned climate assertions (`climate-kenora.test.ts`) against ECCC 1981–2010 station normals (Kenora A ID `6034075`: July `19.7 °C`, annual precip `715.8 mm`, Köppen `Dfb`).
3. **Audit CI/CD workflows, contest freeze & Windows launchers**:
   - Compare `.github/workflows/pages.yml` and `docs/CONTEST-FREEZE.md` deadlines against current date and `.github/PAGES_FROZEN`.
   - Check lockfile parity (`package.json` vs `package-lock.json` / `pnpm-lock.yaml`), `npm ci`, and whether `test:rust` and `vite build` run in CI.
   - Check Windows `.vbs` launchers for `--strictPort`, hidden-install error handling, and exact port + process-name checks (never loose `findstr :5173` substring matches).
4. **Capture live Chromium frames & DOM geometry at desktop (`1280×720`) and narrow (`680×720`) viewports**:
   - Start an isolated Vite server inside your assigned port range (`5250–5269` for `agy`; never `5173–5209`) and always stop it in `finally` (verify `0` remaining `Listen` sockets).
   - Record `descent-frame.html` (`window.__dive.dive()`) and encode PNG sequence frames via system `ffmpeg` into `recording.webm` (avoid Playwright `recordVideo` on Windows when Playwright's bundled ffmpeg is absent).
   - Measure live bounding-box overlaps (`#interaction` vs `#status`, `Data (U)` vs `body > header`, `elementFromPoint` occlusion of `#help`), audit `<dialog id="info">` claims against `public/models/**/*.glb` and `footer`, and check CSS cascade leaks (`header{position:absolute;pointer-events:none}` into `#inspector header`).
5. **Cross-check scientific JSON tables & asset manifests**:
   - Verify 100% `_sources` coverage (Rule 5) in `data/earth/species-density.json`, cause-based rules without hardcoded latitude bands in `cover-density.json`, physical constants in `materials.json` & `reference-figure.json` against published primary tables (Marinova 2011, Melosh 1989, Charette & Smith 2010, WGS84 NIMA TR8350.2), and geometric crop scale & overlap (`rectOverlapArea`) in `public/aerial/meta.json`.
6. **Verify gates** before committing: `npx tsc --noEmit` and `npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts`, and verify JSON event files are UTF-8 without BOM.

## Common Pitfalls to Avoid
- Inside `page.evaluate(...)` executed via `tsx`, avoid declaring local named arrow functions (`const helper = ...`) — `esbuild` `keepNames` injects `__name(...)` which throws `ReferenceError: __name is not defined` in the browser context; inline expressions instead.
- Never use `findstr :5173` without exact endpoint matching; it matches `:51730` and remote ports.
- Always check whether `#help` is physically occluded before assuming a Playwright click opened `#info`.
