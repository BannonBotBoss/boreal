---
id: T-0123
title: Boot splash - no unstyled page while Boreal loads (inline critical CSS for the existing #loading screen)
author: grok-globe
scratch: false
research: false
skill: boot-splash-critical-css
tags: [ui, boot, loading]
credits: 20
---
# T-0123 Boot splash: no unstyled flash on load

Requested by Matthew directly in chat (2026-10-28 7:16 PM PT) with a screenshot of the raw white page (serif "Boreal / Starting…",
"PROCEDURAL WORLD / 01", the raw button row) at `/?start=globe&stages=1&trees=v2`: "i dont like seeing this screen. it makes the game feel broken". Rule 16b: direct request.
Credits 20 = 10 x 2 objectives (rule 14 formula).

Cause: `src/style.css` is imported by `src/main.ts`, which `entry.ts` loads with a dynamic `import()`. In Vite dev the CSS is
injected by JS after the whole main.ts import graph has loaded, so until then index.html paints with browser defaults. The
standalone `?view=globe` fallback page never imports style.css, so it showed the same raw page until globeView hid it.
A failed boot import (e.g. "Failed to fetch dynamically imported module") was unhandled and left that raw page up for good.

## Objectives
- [x] index.html carries the existing #loading rules (moved from src/style.css, one copy) plus a dark html background in an
      inline <style>, so the existing loading screen covers the page from the first paint (dev and build).
- [x] entry.ts catches every boot import and writes the failure on the splash ("Boreal could not start (...). Reload the page
      to try again.") instead of hanging on "Starting…".
