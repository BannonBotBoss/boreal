# T-0166 handoff — grokbot-2

Save and resume only. The cosmic film stays with Globe Builder.

## Doing

Extend `boreal.events.v1` so a finished or dismissed intro is remembered, and a return visit restores the last mode and place. A first visit still plays the intro.

## Done

- Task `tasks/T-0166-save-resume.md`. Approve-plan and claim are rule 16b for Matthew's 2026-11-05 ~12:06 PT request, with the ~12:13 PT bar (first visit does not skip and does not jump to the present).
- `introComplete` and `resume` live on `EventContext`. `saveAll`, the one-second save, and `hasSave` still use `SAVE_KEY`. No second key.
- `bootChoice` keeps a first visit on `sphere`. A return visit is `resume-game`, `resume-globe`, or the existing planet entry when no place was stored.
- `cinematic:complete`, `cinematic:dismiss`, and `intro-dismiss` call `markIntroFlag`, which sets `introComplete` on the events save and does not change the walk on screen. The opening already on main still marks when its own end callback runs, including its click-to-skip, and then stores the place. `window.__borealSave.markBigBangSeen` is the same flag write.
- `globeAim` passes a saved orbit through the globe's existing `latlon` and `alt` query, once, and only on a return visit.

## Number table

N/A. No rate, size, density, or timing was introduced. The saved numbers are the player's last latitude, longitude, altitude, and game metres.

## Evidence

| finding | evidence | became |
|---|---|---|
| The events save is `boreal.events.v1` | `src/main.ts` `SAVE_KEY`; `src/core/events.ts` `parseContext` | the flag and the place were added there |
| A first visit must stay on the intro | `bootChoice` returns `sphere` when `seen` is false; `openAfterLoad` calls `createOpening` only then | tested in `tests/save-resume.test.ts` |
| The film file was not edited | `src/world/cosmos/opening.ts` has no `introComplete` | the test asserts that |
| T-0165 was already taken | open pull request #321 | this task is T-0166 |

A reviewer can spot-check those four against the files and the test.

## Frames

N/A for this save. Nothing in the film, the panel, or the sound changed. The visible skip is the next load after the flag is set, and that load is the unit choice above. No recording is claimed.

## Next

Grokbot-1 reviews https://github.com/BannonBotBoss/boreal/pull/323. Do not merge from this branch. When Globe's intro ends, it dispatches `cinematic:complete`, or `cinematic:dismiss` / `intro-dismiss`, or calls `window.__borealSave.markBigBangSeen()`.

## Needs from another agent

None for the save. The cosmic timeline, the data panel, and the intro audio remain Globe Builder's.
