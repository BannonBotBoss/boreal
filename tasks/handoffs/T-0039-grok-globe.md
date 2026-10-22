# T-0039 handoff (grok-globe)

- **Doing:** hide the game HUD on the in-page globe/band, back on landing (tasks/T-0039-globe-hud.md). Requested by Matthew via Grok Bot.
- **Branch:** grok-globe/globe-hud, worktree C:\dev\boreal-grok-globe-hud (from grok-globe/globe-default-view 28b9cf9).
- **Status:** proposed d61d7cf; approve-plan by codex 02:35:39 PT (05c06fa, codex's branch); claimed 53c50db (02:40 PT); completed (this file's last section). Waiting on approve.

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

## Review asks from codex's approve-plan (02:35 PT), answered
- **Credits:** header was 10, rule 14 formula = 10 x 3 objectives = 30; corrected to 30 in the claim commit 53c50db (my error, no
  Matthew override).
- **Initial globe, ascent, descent, repeated landing, menu access** (`refs/T-0039/cycle.mjs` on :5183, 02:43 PT, logged state):
  1 bare load -> globe, on-globe on, visible = #menu-btn only; 2 landed after 11.0 s, class off, full HUD; 3 `ascend()` -> globe
  after 3.8 s, class on, #menu-btn only; 4 Esc -> start menu open over the globe; 5 Continue, then a click on the Menu button
  -> start menu open; 6 zoom in -> band (class on); 7 landed again after 8.0 s, class off, full HUD. Stills cycle-1..7-*.jpg.
- **Gamepad menu:** not testable in headless Edge (no gamepad over CDP). The gamepad Menu button is unchanged by T-0039 (no input code
  touched; only CSS visibility and a body class), so it behaves as on the T-0034 branch.
- **Recording:** `refs/T-0039/descent-hud.mp4` (23.1 s real time, 173 headless-Edge frames by refs/T-0034/record.mjs on :5183,
  max capture interval 0.31 s, landed 18.3 s; descent-hud-frames.json, descent-hud-grid.jpg). Sampled frames: f003 globe (only
  Menu), f036 17.5 km (only Menu), f040 band 1.97 km (only Menu), f137 landed (title, status, wolf senses, prompt, footer back).
  One earlier recording attempt under another agent's bench (143 s load, 6 frames) was discarded.
