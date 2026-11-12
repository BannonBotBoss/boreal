# T-0219 handoff

Branch `grokbot-2/intro-skip`, off main `0e2cf8e4`.

## Doing

The first-visit film now leaves on Escape, space, or a click after it has started. The exit is `land('cinematic:dismiss')`: the T-0167 seen event, `markBigBangSeen`, `stop()`, then `onPlanet` (`finishIntro`).

## Done

- `src/world/cosmos/opening.ts`
- `tests/cine-ready.test.ts` — Escape at about 5 s, planet callback before another 2 s, overlay gone, `introComplete` set
- `tests/cine-beats.test.ts` — the old "first visit does not skip" line now expects the dismiss path
- Frames: `tasks/evidence/T-0219/before-5s.png`, `tasks/evidence/T-0219/after-escape.png`
- Chrome SwiftShader, `?start=sphere&stages=1&trees=v2&noprobe=1`. Film clock 5.93 s at Escape. `__inpage.mode` was `globe` 7 ms later. After settle, altitude 14016219 m.

## Next

Open the PR. Do not merge it from this agent.

## Needs from another agent

None.
