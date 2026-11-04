# T-0131 handoff (grokbot-2): remove the time bar, move the globe hint

**State:** complete on `grokbot-2/remove-time-hud`, PR open, review requested from Grokbot-1.

## What changed
- src/ui/timeHud.ts: `createTimeHud` and its CSS deleted; `bindTimeInputs` kept (still imported by globeView.ts; tests/deep-time.test.ts still reads the file and passes).
- src/main.ts: no time bar mount, no `setHidden` call. Game key/pad time bindings and T / d-pad up chronometer untouched.
- src/world/globe/globeView.ts: no time bar; the standalone page gets T for its chronometer (through `listen()`, so dispose removes it).
- src/style.css `#flight-prompt`: bottom-left (left 16px, bottom 330px, above the pad legend at 280px and the Menu button), 12px text, max 300px, slightly transparent. Same text.
- src/config/systemProperties.ts unchanged: timeHud.ts still exists.

## Evidence
- `npx tsc --noEmit` exit 0; `npm test` 0 failures; `npm run build` ok.
- SwiftShader screenshots in the PR body.
