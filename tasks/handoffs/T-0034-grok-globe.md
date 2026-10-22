# T-0034 handoff (grok-globe)

- **Doing:** bare load -> globe view (task file tasks/T-0034-globe-default-view.md). Requested by Matthew via Grok Bot.
- **Branch:** grok-globe/globe-default-view, worktree C:\dev\boreal-grok-globe-default (from main a436a9d).
  Commits: 5582c23 propose + handoff, 2bd9252 startView test (failing first), 1520277 code, then this board commit.
- **Status:** built and verified on the branch; NOT claimed or completed (no approve-plan yet; rule 2). Waiting on an approve-plan.

## What was built
- `src/world/globe/startView.ts` (new): `startView(search)` and `bareStart(search)`. Bare query or `?start=globe` = globe;
  `?view=ground`, `?at=`, `?bench` or any other query = ground.
- `entry.ts`: a bare load is rewritten in place to `?start=globe&stages=1&trees=v2` (history.replaceState, no reload).
- `inpage.ts`: `enter()` = straight into globe mode at 2.2 R (the standalone globe's opening altitude) with the ascent's
  governor hold and workers; false on Low or below (main then takes the existing reload path `toGlobe`).
- `main.ts`: load = `inpage.enter()` (or `toGlobe()`) on a globe start, else the start menu as before; Esc on the in-page globe
  opens the start menu; footer `Menu` button opens it. `globeView.ts`: Esc leaves the globe only in the standalone page.
- `index.html`: the footer `Menu` button. The menu's contents are untouched (grok/music owns them).

## How to verify
- `npm test` (tests/start-view.test.ts), `npx tsc --noEmit`, `node tools/smoke-tiers.mjs http://127.0.0.1:<port>`.
- `node refs/T-0034/capture.mjs http://127.0.0.1:<port> <outDir>` (holds the bench lock): bare -> globe, Esc -> menu,
  Continue, zoom in -> descent to the game, `?view=ground`, `?at=0,0&nomenu`. It logs the URL, inpage mode, altitude, menu state.
- Results 2026-10-22 00:42-00:50 PT on :5182: npm test 352 pass / 0 fail; tsc clean; smoke-tiers PASS (Ultra 65 fps 235 draws,
  Minimum 128 fps). Capture log: bare `?start=globe&stages=1&trees=v2` mode globe alt 14,016 km, menu closed; Esc -> menu open
  over the globe; Continue -> globe; zoomTo(1000) -> game after 10 s, `TREES_V2.on` true; `?view=ground` -> game with the start
  menu (as before); `?at=0,0&nomenu` -> game. Frames: refs/T-0034/*.jpg.

## Numbers
| value | game number | real figure + source | resemble? |
|---|---|---|---|
| opening altitude | 2.2 R (14,016 km), reused from globeView startAlt | NASA "Blue Marble" AS17-148-22727 taken at about 29,000 km (4.6 R); full-disc views need > ~1 R | yes (whole disc in frame) |

## Frame answers (rule 6)
- What I see (globe-default-bare.jpg): the whole planet disc on black, blue ocean, green-brown continents, white cloud
  patches, lit from the upper right; the game HUD (title, status card, footer buttons incl. Menu, the "Explore" label) over it;
  no start menu. globe-default-menu.jpg: the same frame with the start menu (Continue/New world/Controls/Music/Graphics/Quit) at
  the left. globe-default-descent.jpg: the wolf on staged ground with trees, logs and boulders after the descent.
- Reference/95 % gate: this is a startup-flow change; the globe's look is unchanged by T-0034 (the globe's own gates). Screen
  recording of the bare-load -> descent flow: not done (no recorder in this run). **Needs from another agent:** a 20 s
  recording of http://boreal.game/ (bare) -> scroll in -> landing, saved to refs/T-0034/descent.mp4, if the reviewer wants it.

## Leftovers / risks
- The game HUD (title, status, "Explore / Approach an individual", footer) stays over the globe (same as Shift+G today).
- `?view=ground` with the start menu shows a frozen pre-world frame (flat, empty ground: the menu holds the first frame
  before chunks build). That is what Matthew saw on the bare load before; not changed here.
- `stages=1` in the rewritten URL persists staged terrain on (main.ts ?stages=); a "New world" with staged off is turned back
  on by a reload of that URL.
- Vite in a worktree shares node_modules/.vite (junction) with the served folder.

## Needs from another agent
- An approve-plan on T-0034 (not grok-globe), then grok-globe claims and completes.