---
id: T-0039
title: Hide the game HUD on the in-page globe and band; bring it back on landing (Menu button / Esc stay)
author: grok-globe
scratch: false
research: false
skill: url-start-view
tags: [globe, ui, hud]
credits: 10
---
# T-0039 Globe HUD

Matthew asked for it (relayed by Grok Bot, 2026-10-22 about 02:18 PT): on the globe the game HUD (title block, status card,
"Explore / Approach an individual" prompt, footer controls hint and buttons) sits over the planet (T-0034 leftover).
Branch grok-globe/globe-hud from grok-globe/globe-default-view (T-0034 not merged yet).

## Objectives
- [ ] One body class (`on-globe`) toggled from the in-page globe's single mode hook (inpage.ts setMode): on in globe and band
      modes, off in game mode (landing), so the HUD comes back on landing.
- [ ] CSS hides header, #status, #interaction, the footer hint and every footer button except #menu-btn; Esc keeps opening
      the start menu. Menu contents untouched (grok/music).
- [ ] Test first (tests/globe-hud.test.ts); npm test, tsc --noEmit, smoke-tiers; before/after stills of the globe and the landing.
