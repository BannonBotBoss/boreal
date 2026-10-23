# Skill: how a page load chooses its view (URL start flags)

When to use: a change to what a page load opens (globe vs ground, menus at load), or a new URL flag that must not break
agent test URLs.

Steps
1. Read the entry chain: index.html -> src/world/globe/entry.ts (routes ?view=globe, ?view=farlayer, ?tree, else main.ts)
   -> main.ts startup (`startup(...).then(prewarm).finally(...)`: the start menu / the start view).
2. Keep the rule pure and in one place (src/world/globe/startView.ts) and test it (tests/start-view.test.ts): every existing
   query keeps its old view; only a bare load changes. Explicit overrides: ?view=ground, ?at=, ?bench, ?nomenu.
3. Flags read at module load (e.g. ?trees=v2 in render/trees/game.ts, ?stages= in main.ts) must be in the URL before main.ts
   is imported: rewrite with history.replaceState in entry.ts (no reload).
4. Reuse the in-page globe (inpage.ts): `enter()` (no rise) or `ascend()` (rise); both fall back to the reload path
   (`toGlobe` / handoff.ts globeUrl) on Low tiers or low memory.
5. Verify: npm test, tsc --noEmit, smoke-tiers on a worktree port (it loads ?nomenu&hour=11, so it still tests the ground),
   and a CDP capture that logs location.search, `window.__inpage.mode`, globe altitude and the #start-menu state.

Mistakes to avoid
- Treating "any query" as globe: agents' capture URLs (?hour=, ?trees=v2, ...) expect the ground.
- The globe's own Esc handler runs on window keydown too: gate it (standalone only) before giving Esc another meaning.
- A trailing // comment after `{` swallows the rest of a one-line block.
Descent lessons (T-0034 follow-up)
- Never run a search (dry-land ring search, spawn search) synchronously on the descent: make it a generator (*Steps) and
  drain it under a per-frame budget (inpage stepSearch, 3 ms); keep the sync wrapper (drain) for tests and the reload path.
  Test: the generator's result equals the sync one (tests/descent.test.ts).
- Camera pitch over a mode change must come from one function of altitude (transition.ts globePitch: straight down in orbit
  -> the 45 deg glide at the band top) used by globe, band and ascent; test it is monotone and < 1 deg per 1 % altitude.
- A "blank plain" from above can be the cloud shell, not missing terrain: A/B with ?atmos=0 before touching terrain code.
  The in-page descent opens the deck with cloudClear (atmosphere uCloudClear, 1500 km -> 150 km, linear in log altitude, T-0041).
- Measure with a rAF log in the page (dt, mode, alt, pitch) plus a CPU profile of the busiest stretch, not capture intervals:
  CDP screenshot gaps also come from other agents' benches. A headed Edge window behind other windows is throttled to 1 Hz
  (dt ~1000 ms every frame): that run is invalid, not a freeze.

HUD over the globe (T-0039)
- Hide screen chrome per mode with ONE body class set from the single mode hook (inpage.ts setMode -> body.on-globe via
  src/world/globe/hud.ts), and one CSS line next to the existing body.photo-mode rule; keep #menu-btn (and Esc) reachable.
- Verify with a capture that logs which HUD elements have client rects in each mode (refs/T-0039/capture.mjs, cycle.mjs):
  globe, Esc menu, Menu button, band, landing, ascent back to the globe, a second landing.
- Worktree files are checked out CRLF (global autocrlf): before `git -c core.autocrlf=false add`, write edited files with LF
  and check `git -c core.autocrlf=false diff --stat` - otherwise every touched file shows as a whole-file rewrite. Add exact
  paths, never a whole folder. PowerShell's .NET calls ([IO.File]) do not follow `cd`: use absolute paths.

Cloud deck and landing view (T-0041)
- Never fade a cloud layer by threshold alone (the cell's density spans ~.1, so it snaps in a few frames) nor by alpha alone (a
  fully covered view thins as one flat sheet). Fade alpha over log altitude AND lift the threshold a little (CLOUDS.clearLift).
  Calibrate first: hold the fade and sweep the threshold in the browser (refs/T-0041/measure.mjs sweep), then bound the
  per-frame luminance change at the fastest recorded descent rate (<= 2 % per 60 fps frame).
- Cream-pixel counts are a bad cloud metric (a half-faded cloud is grey); use the mean luminance of a central crop.
- Landing view: clearViewSteps moves the spot (heading kept) until the follow camera -> wolf line clears trees (crown radius)
  and rocks/logs that stand taller than the line (core/ground treesAround / solidsAround). A centre raycast to the wolf misses
  leg occlusion: always look at the stills too.
- ?at=x,z,yaw spawns exactly (no dry search); use it to check computed spots in the browser. The ascend + zoomTo path from an ?at
  load does not descend, and a bare load always descends near home.

Globe drag inertia (T-0043)
- Time-based easing must be frame-rate independent: use three's `THREE.MathUtils.damp(x, target, lambda, dt)`, not a controls'
  per-frame `dampingFactor` (its tail halves at 2x fps and lags every drag) and never a hand-written decay. lambda = ln(1/rest)/sec.
- Read the drag in OrbitControls' own angles (`getAzimuthalAngle/getPolarAngle`, wrap the azimuth difference) per unit
  `rotateSpeed`, mark grab/release with its `start`/`end` events, and stop the coast on every other input path.
- Verify on any machine with a headless browser: log a dev getter (`globe.coasting`) and the camera direction every rAF, then
  compare speed ratios with the unit-tested damp curve; screenshots stall frames, so time the coast in a pass without them.
