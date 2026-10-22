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
  The in-page descent opens the deck with cloudClear (atmosphere uCloudClear, 300 km -> 20 km).
- Measure with a rAF log in the page (dt, mode, alt, pitch) plus a CPU profile of the busiest stretch, not capture intervals:
  CDP screenshot gaps also come from other agents' benches. A headed Edge window behind other windows is throttled to 1 Hz
  (dt ~1000 ms every frame): that run is invalid, not a freeze.