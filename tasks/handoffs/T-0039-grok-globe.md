# T-0039 handoff (grok-globe)

- **Doing:** hide the game HUD on the in-page globe/band, back on landing (tasks/T-0039-globe-hud.md). Requested by Matthew via Grok Bot.
- **Branch:** grok-globe/globe-hud, worktree C:\dev\boreal-grok-globe-hud (from grok-globe/globe-default-view 28b9cf9).
- **Status:** proposed (d61d7cf); built and verified on the branch; NOT claimed or completed: waiting for the rule-16b approve-plan event from Grok (agent grok, for matthew), then claim, skill update, complete, PR.

## What was built (4d18001, test first da7866c)
- `src/world/globe/hud.ts`: `GLOBE_HUD_CLASS = 'on-globe'`, `hudHidden(mode)` = mode is globe or band.
- `inpage.ts` `setMode` (the single mode hook: enter, ascend, descend, landing) toggles the class on `document.body`.
- `style.css` (one line, like `body.photo-mode`): hides header, #status, #interaction, the footer hint and every footer
  button except `#menu-btn`. Esc still opens the start menu; the menu itself is untouched (grok/music).

## Checks (2026-10-22 02:25-02:39 PT)
- tests/globe-hud.test.ts 3/3; npm test 375 pass / 0 fail (388 incl. skips); `npx tsc --noEmit` clean;
  smoke-tiers PASS on :5183 (Ultra 212 fps 253 draws, Minimum 468 fps).
- `node refs/T-0039/capture.mjs <out> before=http://127.0.0.1:5182 after=http://127.0.0.1:5183` (bench lock; :5182 = the
  T-0034 branch, :5183 = this branch). Logged visible HUD elements (getClientRects):

| frame | before (T-0034) | after (T-0039) |
|---|---|---|
| globe 14,016 km | header, #status, #interaction, footer hint, all buttons | #menu-btn only (body.on-globe) |
| Esc -> start menu over the globe | menu open + full HUD | menu open + #menu-btn |
| band ~1.85 km | full HUD | #menu-btn only |
| landed (game, 5 s after) | full HUD | full HUD back (class off) |

- Stills: refs/T-0039/{before,after}-{globe,globe-menu,band,landed}.jpg.

## Frame answers (rule 6)
- What I see: after-globe: the planet disc on black with only a small "Menu" button bottom-left; after-band: the lakes and forest
  at the glide with only the Menu button; after-landed: the wolf on staged ground with the title, status card, sense panel,
  prompt and footer back, as in before-landed.
- 95 % gate: N/A (UI visibility, nothing natural to resemble); substituted check: the HUD element list per mode above
  (before = known mismatch, full HUD on the globe; after = only #menu-btn on globe/band, full HUD in game).

## Leftovers
- The sense panel (wolf senses, top-left) is created by the game in game mode only; not seen on the globe in either run.
- The standalone globe page (?view=globe) has no game HUD; unchanged.
