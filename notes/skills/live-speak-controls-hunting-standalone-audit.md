# Skill: Live Speak/Bioacoustics, Controls Rebinding, Hunting Bond Persistence, & Standalone Modes Audit (`live-speak-controls-hunting-standalone-audit`)

## Purpose
Verify four end-to-end live gameplay domains in headless Microsoft Edge with zero overlap against prior audits (`T-0001..T-0304`):
1. Live `E` Speak (`src/audio/wolfVoice.ts`, `src/audio/borealSound.ts`, `src/main.ts`) under non-wolf playables (`?play=deer`) and spatialized/transactional `H`/`G` vocalization reactions on nearby wildlife and `#senses`.
2. Live `Pause -> Controls` rebinding UX (`src/ui/controls.ts`, `src/core/bindings.ts`, `src/style.css`): Back/footer bounding-box clearance, fast-tap (`<16 ms`) keypress capture reliability, shifted-symbol release order (`Shift+1` -> `'!'` vs `'1'`), `swapAssign` conflict handling, context grouping (`CONTEXTS`/`actionsIn`), unbind controls, and footnote accuracy.
3. Live Hunting II pin/hold/eat/release hare bond persistence (`src/main.ts`, `src/animals/hare.ts`, `src/core/sim/index.ts`, `src/core/huntHold.ts`, `src/core/events.ts`): immediate `localStorage` commit on `B` release, reload clock monotonicity (`0 <= friendStrength <= 1.0`), live sim bond restoration (`sim.friendOf`), `eatPrey` (`X`) stamina consistency, and prey-playable HUD filtering.
4. Live standalone entry modes (`?view=farlayer`, `?tree=1` / `?tree=1&view=one` / `?tree=1&view=lod`, and `?watch=1` witness camera) compared against eye-level *Picea mariana* (`ref-0`) and elevated wolf witness (`ref-1`) references.

## Tools & Workflow
1. Serve the target commit on an agent-local Vite port (`agy`: `5250–5269`, never `5173–5209`) with `--strictPort`.
2. Launch headless Microsoft Edge (`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`) via Playwright with `&nomenu=1&noprobe=1&rec=1` whenever testing unpaused live gameplay (remembering that `?view=ground` without `&nomenu=1` opens the paused Start menu).
3. Record live interactions with CDP `Page.startScreencast` + `ffmpeg -c:v libvpx` into `recording.webm`, and capture clean `1280×720` PNG frames. Always close browser and Vite in `finally`.
4. Test BOTH fast `page.keyboard.press()` taps (`<10 ms`) AND held keystrokes (`150 ms`) inside `Pause -> Controls`, plus synthetic shifted-symbol release order (`keydown Shift`, `keydown '!'`, `keyup Shift`, `keyup '1'`), to catch rAF-poll drops and `KeyboardEvent.key` mismatch latches.
5. Run `npx tsx refs/audit/live-speak-controls-hunting-standalone-audit/audit.ts` to produce calibrated Rule 11 `numbers.json` (`knownMatchScore = 1.0000`, `knownMismatchScore = 0.0000`, `calibrationValid = true`).

## Checks That Prove Fixes Work
- **Speak & Bioacoustics**: embodied `White-tailed deer` speaking to a deer shows species-appropriate UI/audio (no `🐺` emoji, Adam voice, or `wolf-whine`); `posture` is passed to `wolfSpeak`; `H`/`G` are species-gated, call `sfx.start()`, pass player `{ x, z }` to `playAt` so `onSpatialCue` fires, and trigger measurable prey reaction; non-predator `#status` omits `Q lock`.
- **Controls Rebinding**: `Back` / `<footer>` overlap is `0 px²`; fast `<16 ms` key taps complete capture reliably; releasing `Shift` before a shifted digit never wedges `held`; conflict banners offer `Swap` (`swapAssign`); rows are grouped by `CONTEXTS` with per-row unbind; footnote matches actual fixed keys.
- **Hunting II Bonds**: pressing `B` immediately commits the bond to `boreal.events.v1`; after `page.reload()`, `friendStrength` stays in `[0, 1]` on a monotonic clock and spawned hares restore `friendOf`; `eatPrey` stamina handling is consistent with `caught`; prey playables omit predator prompts.
- **Standalone Modes**: `?view=farlayer` renders the Earth globe (`flatGreyVoidFrac < 0.50`), logs `FARLAYER {...}`, hides `#descent-cover`, and honors `readUniverseSeed()`; `?tree=1&view=lod` `crown` and `impostor` match `near` (`<= 1.4×` filled area, `<= 1.35×` width) and provide species controls; `?watch=1` frames a live moving animal (`ref-1`) with Enter-life UI and preserves `WITNESS_ALTITUDE_SCALE` across `#home`.

## Mistakes to Avoid
- Do not omit `&nomenu=1` when testing unpaused `?view=ground` / `?watch=1` gameplay in headless captures, or the Start menu will keep the world paused.
- Do not rely solely on `localStorage` inspection after 2 seconds when testing `releasePrey` — inspect immediately (`<100 ms`) to catch missing `commitContext()` calls masked by the `1 s` autosave interval.
- Keep all new simulation logic in `rust/boreal-sim` and verify `tests/sim-home.test.ts` stays green (`AGENTS.md`).
