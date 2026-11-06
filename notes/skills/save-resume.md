# Skill: remember the cosmic intro and the last place

Use when a return visit should skip the cosmic intro and stand or orbit where the player left off. The intro film, its words, and its sound belong to the globe cinematic. This skill is only the save.

## Steps
1. Keep the flag and the place on the events document (`boreal.events.v1`, `SAVE_KEY` in `src/main.ts`). `saveAll`, the one-second save, and `hasSave` already write and read that key. Do not add a second store.
2. The fields are optional on `EventContext`: `introComplete` and `resume` (`mode` of `game`, `globe`, or `band`, plus `lat`, `lon`, `alt`, `x`, `z`, `yaw` when they are finite). `parseContext` drops a damaged place and still loads the events. `hasSeenBigBang`, `markBigBangSeen`, `loadResume`, and `saveResume` are the calls. `bootChoice` decides the load.
3. A first visit is `bootChoice('sphere', false, …)` and stays `'sphere'`. Do not skip the intro and do not jump the cosmic timeline to the present. The page still calls `createOpening` for that visit.
4. Mark the intro when a `cinematic:complete` event fires, or an explicit dismiss (`cinematic:dismiss`, `intro-dismiss`). The listener only writes the events save. It does not stop the walk on screen and it does not jump to the present. The opening already on main also marks when its own end callback runs, including its click-to-skip. Globe code can call `window.__borealSave.markBigBangSeen()` for the same write. Do not mark it for `?start=globe`.
5. A return visit with `introComplete` skips `createOpening`. `resume-game` puts the animal back at `x`, `z`, `yaw` (unless `?at=`, `?bench`, `?nomenu`, or `?view=ground`). `resume-globe` aims the existing globe `latlon` / `alt` query once, through `globeAim`, before the globe is built. No saved place means the same planet entry the intro already ends on.
6. `?bench` and `?nomenu` stay on their old path. A new world forgets the place and keeps `introComplete`.

## Checks that prove it worked
- `tests/save-resume.test.ts`: the events JSON round-trips; a bad place does not reject the save; a first visit stays on the sphere; a return visit names `resume-game` or `resume-globe`.
- `tests/start-view.test.ts` still requires `opened === 'sphere'` and `createOpening(`.
- `npx tsc --noEmit` and `npm test`.

## Mistakes to avoid
- A second localStorage key for the intro or the place. The events save is the store.
- Treating any old clock or ground key as "already watched". Those keys are written during the intro. Only `introComplete` skips it.
- Editing the sphere film, the data panel, the Rust cosmic report, or the intro audio from this task.
- Skipping the intro on the first visit, including when a resume place is already present and the flag is still false.
- Numbering this save T-0166. That id is the cinematic on pull request #322. This save is T-0167. The branch may still be named `grokbot-2/t0166-save-resume`.
