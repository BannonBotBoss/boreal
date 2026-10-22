# T-0034 handoff (grok-globe)

- **Doing:** bare load -> globe view (task file tasks/T-0034-globe-default-view.md). Requested by Matthew via Grok Bot.
- **Branch:** grok-globe/globe-default-view, worktree C:\dev\boreal-grok-globe-default (from main a436a9d).
  Commits: 5582c23 propose + handoff, 2bd9252 startView test (failing first), 1520277 code, then this board commit.
- **Status:** approve-plan by grok 00:55:41 PT, claimed 01:02 PT (d118bc7), descent fixes done, completed 2026-10-22 ~02:20 PT (see the last section). Waiting on approve.

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
- **FILLED (grok, 2026-10-22 01:02 PT, rule 8): the rule-6 screen recording** `refs/T-0034/descent.mp4` (14.2 s, 1280x800, encoded
  at 2x real time from 122 timestamped headless-Edge frames; real run 28.2 s). Branch served from this worktree on :5410 (stopped
  after), recorder `refs/T-0034/record.mjs` (bench lock held), per-frame state in `refs/T-0034/descent-frames.json` (time, inpage
  mode, altitude, menu). Flow: bare `http://127.0.0.1:5410/` -> rewritten to `?start=globe&stages=1&trees=v2`, globe at 14,016 km,
  menu closed in every frame -> 48 mouse-wheel notches -> band at 1.94 km (real 14.3 s) -> game at real 24.2 s -> 4 s on the ground.
  Stills: descent-00s-globe.jpg, descent-05s-blank-plain.jpg, descent-10s-band.jpg, descent-14s-landed.jpg (video times).
  Observed: (a) the globe shows with no start menu (HUD and footer Menu button only); (b) the landing has staged terrain, trees v2,
  boulders, logs and the wolf. Two things for grok-globe to look at: a 6.4 s stall at about 5 km altitude (real 7.5-13.8 s, no frame
  could be captured) during which the last frame is a blank tan plain under blue sky (descent-05s-blank-plain.jpg); and the camera
  goes from a horizon view (band, 1.9 km) to looking straight down at an island before landing (descent-10s-band.jpg).
  The 95 % reference comparison is still the owner's step.

## Follow-up after grok's recording (2026-10-22 01:02-01:55 PT, grok-globe)
- Claimed (d118bc7) after grok's approve-plan 00:55:41. Main fb396e4 merged (7263f5a).
- Causes found: (1) the landing's dry-land search (core/stages dryStart) ran synchronously in inpage prepare() AND again in descend(): up to 1.4 s per call at a lake point (node, seed 1400, (0, 1992)); (2) the in-page globe aimed at the horizon below 300 km whenever it had a heading (?at yaw from the game): an 85.3 deg pitch step in ONE frame at 300 km, then the band swung back down to the 45 deg glide; (3) the 'blank tan plain' is the globe's 2.5 km cloud shell (900 km cells) over home seen from above: with ?atmos=0 the same altitudes show the ground (refs/T-0034 alt stills).
- Fixes: 8904436 dryStartSteps/landSpawnSteps run 3 ms per frame, descend reuses the prepared spot; globePitch (straight down in orbit -> 45 deg glide at the band top, ascent top matches). Next commit: cloudClear (deck opens 300 km -> 20 km, in-page only).
- ffa36b2 cloudClear committed (the step above).

## Completion (2026-10-22 01:55-02:20 PT, grok-globe)
Commits after the claim: 0ff8abf descent test (failing first), 8904436 budgeted landing search + globePitch, e26f9d0 cloud-clear
test (failing first), ffa36b2 cloudClear, 7ed2fcd skill, 02cb0b3 refs (recording, stills, profiles). grok/music: `git merge-tree`
with this branch is clean (menu-btn and the music panel both kept), nothing to pre-resolve.

### Checks
- npm test 355 pass / 0 fail (367 tests incl. skips) at ffa36b2; `npx tsc --noEmit` clean; smoke-tiers PASS on :5182
  (Ultra 125 fps, 252 draws).
- In-page rAF profile (refs/T-0034/profile.mjs: logs every rAF dt, inpage mode, altitude, camera pitch, plus a CPU profile of the
  busiest 2 s; headless Edge, bench lock held). Thresholds: rAF gap <= 200 ms during the descent, pitch step <= 2 deg per frame.

| run | max rAF gap in descent | max pitch step / frame | file |
|---|---|---|---|
| before (7263f5a) | 103.7 ms (headless; grok's capture: 6.38 s stall, intermittent at a lake landing) | **85.3 deg** (-89.8 -> -4.6 at 300 km) | profile-before (json in %TEMP%) |
| after 8904436 headless x2 | 68.4 / 64.2 ms | 1.1 / 0.9 deg | |
| after 8904436 headed Edge | 83.2 ms (216.8 ms on the first orbit frame after load, before the descent) | 1.8 deg | profile-headed.log |
| after ffa36b2 headless | 142.8 ms (first orbit frame after load; descent below that) | 0.8 deg | profile-after4.log |
| after ffa36b2 headed (invalid) | 1000 ms every frame: the window was behind others and Edge throttled it to 1 Hz | 0.7 deg | profile-headed2.log |

  Calibration: grok's pre-fix recording (known bad: 6.38 s stall, 85 deg snap) fails both; the after runs pass. A contended run
  (another agent's bench in parallel) gave 549 ms band gaps, and a recording run during the T-0032 gate had a 5.16 s capture gap
  while the page's own altitude kept falling (1848 -> 109 m): the capture stalled, not the page. Retaken clean.
- Recording `refs/T-0034/descent.mp4` (20.6 s, real time, 1280x800, 159 headless-Edge frames, record.mjs, frames in
  descent-frames.json): bare load -> globe 14,016 km -> band at 7.3 s (1957 m) -> game at 15.6 s; max capture interval 0.27 s.
  Grok's pre-fix recording kept as descent-before.mp4 / descent-before-frames.json.

### Frame answers (rule 6)
- What I see (after-grid.jpg; after-globe, -175km, -17km, -5km, -band, -band-1km, -landed): the planet disc with clouds; at
  175 km a dark-green forested coast with lakes, seen steeply from above; at 17 km and 5.5 km the same lakes larger, lower
  pitch, haze; band at 1.96 km: lake shores and forest at the 45 deg glide; at 990 m a blue lake with a forested island; landed:
  the wolf on staged ground with trees v2, logs and boulders. No beige/blank frame, no jump from horizon to straight down.
- Natural? A descent from orbit sees the ground through the clouds, gets lower in pitch as you come down, and the horizon hazes
  (compare ISS/airliner descents). Reference: refs/T-0034/reference-oblique.jpg (generated, "boreal lakes from 1.5 km, 45 deg
  oblique, haze at the horizon"): it shows what to look for, it is not a certificate (rule 11).
- 95 % gate: **N/A** for the look (this task changes start flow, landing search and camera pitch; the globe and ground looks are
  their own tasks' gates). Substituted calibrated numeric checks: the rAF gap and pitch-step table above (known bad fails, after passes).

### Leftovers / risks
- Chunk build jobs (createChunk, rockGeometry; up to ~0.5 s total in the busiest 2 s) can still spike frames when the machine is
  contended; they are spread by runJobs but not budgeted per frame.
- The 140-220 ms first orbit frame right after load (shader compile/upload), before any input.
- stages=1 persistence and the HUD over the globe (above) are unchanged.
- The headed check after ffa36b2 needs a foreground window; the valid headed run is before ffa36b2 (cloudClear only changes a uniform).
