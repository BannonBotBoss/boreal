# Skill: Live Multi-Biome Ground Landing, `?autoplay=1`, Ground Time Dial & Save/Continue Audit (`live-multibiome-autoplay-dial-save-audit`)

Reusable workflow for live browser verification of Boreal's end-to-end player journeys across remote globe landings, self-playing `?autoplay=1`, ground Time Dial controls, and Save/Reload/Continue persistence.

## When to Use
- Auditing or verifying remote globe-to-ground landings (`inpage.placeAt`, `engageLanding`, `SITE.remote`, `grass.ts`, `flora.ts`, `water.ts`, `waterWake.ts`).
- Auditing or verifying `/?autoplay=1` end-to-end boot, `#loading` / `inpage.prewarm()` lifecycle, and `startView.ts`.
- Auditing or verifying `#109` ground Time Dial continuous hold (`,`, `.`, `;`), HUD rate/rewind indicators, `loadClock()` offline credits, and `Esc -> Save` -> Reload -> `Continue` round-trips.

## Steps
1. **Spin up a temporary Vite preview server** on an agent-range port (`agy`: `5250–5269`, never `5173–5209`) inside a `try/finally` block that kills the full process tree (`taskkill /PID <pid> /T /F` on Windows) and closes headless Microsoft Edge / Chromium cleanly.
2. **Capture live multi-biome remote ground landings** (`/?start=globe&transition=inpage&noprobe=1&stages=1&day=196&hour=12&rec=1`):
   - Sequence at least 3 contrasting Earth biomes (`Sahara 23.5, 10.0`, `Greenland Ice 72.5, -40.0`, `Pacific Ocean 0.0, -140.0`) via `window.__inpage.placeAt(lat, lon, 35)` -> wait for chunks -> press `G` to embody.
   - Record an in-browser VP8 WebM (`canvas.captureStream(15)` + `MediaRecorder`) during embody + walk, screenshot each landing, and sample HUD `#status`, `#act`, `hareCount`, `namedAnimals`, `groundAt`, and `scene.fog`.
   - Inspect upper sky (`y = 2–28%`) on ocean/lowland landings after a higher-elevation landing to catch stale cached grass/flora tiles floating in mid-air (`grass.ts`).
3. **Capture live `/?autoplay=1` end-to-end** without `?noprobe` so the real user boot path (`startup()` + `inpage.prewarm()` + `startView()`) is measured verbatim. Sample `#loading` text, `window.__autoplayLog`, and `window.__autoplayDone` every ~4.5 s and screenshot on timeout or completion.
4. **Capture live Time Dial & Save/Reload/Continue**:
   - Walk away from spawn (`W` + `D`) so pre-Save `(x, z, yaw)` differs measurably from default spawn.
   - Hold `.` (`timeFaster`), toggle `;` (`timePause`), and hold `,` (`timeSlower`) for `>= 2 s`, logging `#status` before/after each gesture.
   - Press `Escape` -> click `Save` -> dump all `boreal.*` `localStorage` keys -> reload WITHOUT `?nomenu=1` -> verify `Continue` enabled -> click `Continue` -> measure `(x, z)` Euclidean drift (`m`), angular `yaw` drift (`deg`), and post-Continue clock direction/rate.
5. **Compare live biome frames against natural documentary references** (generated or verified real photos for Sahara erg/hamada, Greenland Summit sastrugi ice sheet, and open Pacific marine horizon).
6. **Run calibrated Rule 11 script (`audit.ts` -> `numbers.json`)**:
   - Compute RGB pixel metrics with `pngjs` (`snowFrac`, `grassDarkGreenFrac`, `greenDomFrac`, `meanLum`) and deterministic 60 Hz `worldClock.ts` hold/save/load assertions.
   - Verify `knownMatchScore >= 0.99`, `knownMismatchScore <= 0.25`, `calibrationValid === true`, and `0` console/page errors.

## Pitfalls to Avoid
- Never test remote landings in isolation on a single fresh tab without also testing sequential landings across differing ground heights (e.g. `+2.5 m` land -> `-0.2 m` ocean), which exposes un-cleared grass/flora tile caches floating overhead.
- Never pass `?noprobe=1` when auditing `/?autoplay=1`, or you will mask `startup()` + `inpage.prewarm()` `#loading` hangs that real users hit.
- Always check `localStorage['boreal.events.v1']` for `resume` after clicking explicit `Save` in ground sessions (`!hasSeenBigBang`), and verify `loadClock()` offline credit when saved paused or rewinding.
- Write all board event JSON files as UTF-8 without BOM and match filename timestamp to Pacific `at` (`-08:00` PST / `-07:00` PDT).
