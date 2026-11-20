# Skill: `shipped-assets-audio-impostors-autoplay-audit`

Reusable workflow for auditing Boreal's shipped binary assets in `public/` (audio waveforms, GLB geometry/PBR materials, images, bakes, data CSVs, `detect-gpu` tables, bundle bloat, provenance/licencing), runtime asset-URL base-path hygiene (`asset()`), live `bakeTreeAtlas()` impostor rendering, and live `?autoplay=1` user journeys under Rules 6, 11, and 12.

## Steps
1. **Measure every shipped audio file objectively with `ffprobe` and `ffmpeg ebur128=peak=true`**:
   - Check integrated loudness (`LUFS`), true peak (`dBTP` vs ITU-R BS.1770-4 / EBU R128 `<= -1.0 dBTP`), sample rate consistency (`44.1 kHz`), channel count, and duration against docs/manifests.
   - Check same-category clip spread (e.g., `public/sounds/pups/call_01.ogg` vs `call_02.ogg`) and verify whether the playback path applies per-clip trims and provides Safari-compatible MP3 fallback for `.ogg` banks.
   - Decode looped beds (`music-day.mp3`, `music-night.mp3`, `amb-*.mp3`, `wind-pines.mp3`, `water.mp3`) to raw PCM (`-f f32le`) and measure leading/trailing silence (`|sample| <= 1e-3`) to detect loop-wrap dropouts.
2. **Account for every byte in `public/` (copied verbatim into `dist/` by Vite)**:
   - Cross-reference every file in `public/` with `git grep` across `src/` and `index.html` to flag unreferenced placeholders, alternate takes, raw build inputs, and unused bakes/CSVs.
   - Verify every third-party or AI-generated binary asset directory carries a `LICENCE.txt` or `CREDITS.md` (and check GLB `asset.copyright`).
   - Verify all runtime asset fetches use `asset(...)` (never raw `'/bake/...'` or relative `'cinematic/refs/...'` that 404 under GitHub Pages `/boreal/`, and never `new URL('../../../public/...', import.meta.url)` which causes Vite to double-bundle `public/` files).
3. **Inspect GLB binary JSON headers & live impostor baking**:
   - Parse each `.glb` header (`chunkLength = buf.readUInt32LE(12)`, JSON slice `buf.subarray(20, 20 + chunkLength)`) to check `pbrMetallicRoughness.metallicFactor` (glTF 2.0 defaults to `1.0` pure metal when omitted without a `metallicRoughnessTexture`!), `doubleSided` flags on closed meshes, triangle counts vs physical species size, and embedded texture counts/formats.
   - Render `bakeTreeAtlas(renderer)` live in headless Chromium onto a 2D preview canvas to inspect both `albedo` and `normal` atlas rows directly — verifying frustum framing (`0%` crown clipping), linear-vs-sRGB color space handling, species-distinct albedo/bark, and GPU buffer disposal.
4. **Capture live `?autoplay=1`, globe, and forest frames + VP8 WebM**:
   - Serve the repo on an isolated port in your assigned range (`5250–5269` for `agy`; never `5173–5209`) with `--strictPort`, capture live frames + PNG sequence via Playwright + Edge/Chrome SwiftShader, encode `recording.webm` with `ffmpeg -c:v libvpx`, generate matched photographic nature references, and always close browser + `taskkill /T /F` Vite in `finally` (verify `0` `LISTENING` sockets).
5. **Run calibrated Rule 11 script & verify gates**:
   - Ensure `audit.ts` verifies `knownMatchScore >= 0.95` and `knownMismatchScore <= 0.25` (`calibrationValid = true`), then run `npx tsc --noEmit` and `npx tsx --test tests/tasks.test.ts tests/gait-gate.test.ts tests/sim-home.test.ts tests/rules.test.ts`.

## Common Pitfalls to Avoid
- Never rely solely on `mixer.ts` `CLIP_TRIM_DB` to judge audio quality: digital clipping baked into `.mp3`/`.ogg` waveforms (`> 0.0 dBTP`) remains distorted even after gain attenuation.
- Never parse `.glb` files with embedded WebP textures via Three.js `GLTFLoader` in Node without a browser `self.URL` shim; parsing the glTF 2.0 JSON chunk directly from bytes `20..20+jsonLen` is instantaneous, zero-dependency, and exact.
- Do not forget to verify `0` `LISTENING` sockets on your temporary Vite port after stopping it (`TIME_WAIT` sockets are normal closed client connections).
