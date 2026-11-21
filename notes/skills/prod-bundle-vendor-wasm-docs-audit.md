# Skill: Production Bundle, Vendor, WASM Parity & Governance Docs Audit (`prod-bundle-vendor-wasm-docs-audit`)

Reusable procedure for auditing Boreal's compiled production build (`vite build` + `--base=/boreal/`), runtime network waterfall on desktop vs WebXR, `vendor/` third-party libraries, `public/wasm/boreal_sim.wasm` export parity, static guardrail drift (`sim-home-ceiling.json` / `rules.test.ts`), and governance/spec/licence documentation.

## Steps
1. **Build both production targets** (without touching the served repo or port `5173`):
   - Default root bundle: `npm run build` (`tsc --noEmit && vite build` -> `dist/`).
   - GitHub Pages subpath bundle: `npx vite build --base=/boreal/ --outDir dist-pages` (remove `dist-pages` afterwards so no untracked artifacts remain).
   - Record Vite/Rollup warnings: mixed static/dynamic imports, chunks `> 500 kB`, and Rollup annotation warnings.
2. **Audit `dist/assets/` byte budget & unused payloads**:
   - Classify all `dist/assets/*` files by category: app JS, VR session chunk (`session-*.js`), IWSDK UIKit font/MSDF chunks, `HavokPhysics*.wasm`, Draco/Basis/KTX2 decoders, KaTeX font formats (`.woff2` vs redundant `.woff`/`.ttf`), CSS, and duplicated CSVs.
   - Cross-check binary glTF 2.0 JSON headers (`extensionsUsed` / `extensionsRequired`) across all `public/models/**/*.glb` to prove whether Draco/KTX2 decoders are actually required.
   - Grep `dist-pages/assets/*.js` for hardcoded root paths (`'/bake/...'`, `'cinematic/refs/...'`) and external CDN URLs (`unpkg.com`, `jsdelivr`, `cdnjs`).
   - Cross-check `package.json` `dependencies` + `devDependencies` against `src/`, `tests/`, and `tools/` to spot unused packages (e.g., `iwer`).
3. **Run live production preview + network waterfall capture (agent port range `5250–5269`)**:
   - Serve `dist/` at `/` and `dist-pages/` at `/boreal/` from an in-process Node `http.createServer` closed in `finally` (avoiding orphan dev servers).
   - Launch headless Edge/Chrome (SwiftShader, closed in `finally`) via `playwright-core` and log every `page.on('response')` (`path`, `status`, `bytes`, `content-type`), console errors, and HTTP 404s.
   - Verify whether heavy optional chunks (e.g., `/assets/session-*.js` for WebXR) are eagerly fetched on plain desktop visits.
   - Capture live PNG frames (`1280×720`) + VP8 WebM `canvas.captureStream` recording (`recording.webm`), and compare against natural study references (Rule 6).
4. **Audit `vendor/` and `public/wasm/boreal_sim.wasm` parity**:
   - Scan `vendor/**/*.{js,mjs}` for broken `//# sourceMappingURL=...` links and hardcoded CDN defaults.
   - Check `public/detect-gpu/*.json` coverage for current hardware (RTX 5060/5070/5080/5090, Quest 3 Adreno 740).
   - Inspect `WebAssembly.Module.exports(new WebAssembly.Module(buf))` directly in Node (no Rust toolchain needed!) and diff against `pub extern "C" fn` in `rust/boreal-sim/src/**/*.rs` AND against callers in `src/**/*.ts`.
5. **Audit static guardrails & governance docs**:
   - Diff `tests/sim-home-ceiling.json` against actual line counts (find stale slack lines) and against `AGENTS.md` (find pure render/UI/GLSL view files trapped in the simulation ceiling).
   - Check `tests/rules.test.ts` allowlists for dead files (`0` importers, e.g. `src/render/fur.ts`).
   - Verify claims, file paths, and licence tags in `PROJECT-RULES.md`, `SKELETON-RULES.md`, `ANIMAL-BEHAVIOUR.md`, `CHALLENGES.md`, `docs/*.md`, and `src/data/quizzes/*.json` directly against disk.
6. **Run calibrated Rule 11 script**:
   - Execute `npx tsx refs/audit/prod-bundle-vendor-wasm-docs-audit/audit.ts` and verify `calibrationValid = true` (`knownMatchScore >= 0.99`, `knownMismatchScore <= 0.25`) before reporting scores.

## Common Mistakes to Avoid
- Never rely on `vite` dev server alone for bundle/subpath audits: dev mode masks Rollup chunk sizes, unused WASM/font copies, static/dynamic import warnings, and `--base=/boreal/` path bugs.
- Measure network request totals *after* all async lazy imports settle (otherwise eager chunks like `session-*.js` that finish during post-load interactions are missed by early snapshots).
- Never leave temporary `dist-pages/` directories, headless browser processes, or preview HTTP listeners running after capture.
- Write all board event JSON files in UTF-8 without a BOM and verify with `tests/tasks.test.ts` + `tests/gait-gate.test.ts`.
