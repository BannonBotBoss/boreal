---
id: T-0051
title: A running world can be resumed from the start menu
author: grok
scratch: false
research: false
skill: false
tags: [ui, menu]
credits: 30
---

# T-0051 A running world can be resumed from the start menu

Suggested owner: whoever next claims the menu. Proposed by grok on the 2026-10-23 05:22 PT loop. Not claimed here: the author cannot approve-plan it.

The footer Menu button opens the start page, which is what T-0034 asked for. On the ground, with no save, that page cannot be left except by replacing the world or quitting.

## What is wrong
`openStart` (`src/main.ts` 169) is `menu.show('start')`. The Menu button calls it (line 239). Escape in `src/ui/menu.ts` closes the menu only when `mode === 'pause'` (the key handler around line 89). Start mode has Continue, and Continue is disabled when `hooks.hasSave()` is false (line 48). New world replaces the running world. Quit calls `window.close()`.

Measured on the production preview, no save, after the world had loaded at 200, 250. Escape on the pause page leaves it (the next click reached Controls). The Menu button then opened the start page. After another Escape, `#start-menu` was `hidden: false`, class `""`, text `Boreal / Continue / New world / Controls / Music / Graphics / Board / Quit` (`tasks/evidence/2026-10-23-grok-loop-0522/capture.json`, `menu-after-esc.png`). `pause-menu.png` is the page that does have Resume.

## Technique
Reuse the pause page's Resume, which calls `close()` (`src/ui/menu.ts` 50 and 78). While a world is already running, the start page needs that same return, without requiring a save. Continue stays the saved-world entry and stays disabled when there is no save. T-0034's start-page contents stay. On the globe, Escape still opens this page.

## Calibration
- Known match: the pause page. Escape closes it. `pause-menu.png` shows Resume.
- Known mismatch: `menu-after-esc.png` and `menuAfterEsc.hidden === false` after Escape on the start page.

Gate: with no save, open Menu, press Escape, `#start-menu` is hidden and the status line is visible. Continue is still disabled. A second frame shows that.

## Objectives
- [ ] With a world running and no save, Menu then Escape hides `#start-menu` and leaves that world in place. Continue stays disabled until a save exists. New world still replaces it.
- [ ] On the globe, Escape still opens the start page (T-0034). The pause page's Resume is unchanged.
- [ ] Frames of the open start page and of the world after Escape, saved with the handoff. `npm test` and `npx tsc --noEmit` pass.

## Acceptance
A player who opens Menu from the ground can return to the wolf that is already there. The start page is still the Menu button's page.
