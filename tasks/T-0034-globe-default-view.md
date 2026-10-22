---
id: T-0034
title: A bare page load opens the planet (globe) view; the start menu moves to Esc / a Menu button
author: grok-globe
scratch: false
research: false
skill: url-start-view
tags: [globe, ui, startup, url]
credits: 30
---
# T-0034 Bare load opens the globe

Matthew asked for it (relayed by Grok Bot, 2026-10-22 about 00:30 PT): the game is served at http://boreal.game; a bare
load shows the start menu over flat, unstaged ground. "it should load the global view please".
Branch: `grok-globe/globe-default-view` (worktree C:\dev\boreal-grok-globe-default, from main a436a9d).

## How it works now (main a436a9d)
- `world/globe/entry.ts`: `?view=globe` = standalone globe (reload path), anything else = the game (`main.ts`).
- `main.ts:401`: after the loading screen and the in-page globe prewarm, the start menu opens unless `?bench` / `?nomenu`.
- The in-page globe (`world/globe/inpage.ts`, default path) is reached only by `ascend()` (Shift+G), a rise from the ground.
- Trees v2 are read once from `?trees=v2` at module load (`render/trees/game.ts:18`); staged terrain from the setting, `?stages=`.

## Plan (reuse, minimal)
- One pure rule `startView(search)` (new `world/globe/startView.ts`): bare query or `?start=globe` = globe; `?view=ground`,
  `?at=`, `?bench` or any other query = ground (every existing test URL keeps the view it had).
- `entry.ts`: a bare load is rewritten in place (history.replaceState, no reload) to `?start=globe&stages=1&trees=v2`, so
  staged terrain (needed by the globe) and trees v2 are on for the descent.
- `inpage.ts`: `enter(alt)` = straight into globe mode at orbit altitude over the player (the existing `jumpTo`, governor
  hold and worker resume of `ascend`), no rise. Descending works as today (zoom in over home -> band -> game).
- `main.ts`: at load, globe start calls `inpage.enter`, else the existing reload path (`toGlobe`); the start menu is not
  shown. Esc on the in-page globe and a small footer `Menu` button open the start menu (contents unchanged: grok/music
  owns them). The globe's own Esc keeps leaving only in the standalone page.

## Objectives
- [ ] 1. Bare URL opens the globe at orbit with staged terrain and trees v2 for the descent; no menu over it
- [ ] 2. ?at=, ?view=ground, ?bench, ?transition= and every other explicit flag keep their view; ?view=globe unchanged
- [ ] 3. Start menu on Esc (globe) and a Menu button; tests (startView), tsc, smoke-tiers, screenshots, handoff, skill

## Numbers
| value | game number | real figure + source | resemble? |
|---|---|---|---|
| start altitude | 2.2 x planet radius (the standalone globe's existing default, globeView.ts) | Apollo-style full-disc Earth views are taken from about 2-6 Earth radii (NASA "Blue Marble" 1972 at about 29,000 km = 4.6 R) | yes (full disc in view) |