# Skill: boot splash with critical inline CSS (no unstyled flash)

When to use: the page shows raw HTML (white page, serif text, default buttons) before the game is ready, or a boot step can fail and leave the page on "Starting…".

Steps
1. Find where the page CSS comes from. In this repo `src/style.css` is imported by `src/main.ts`, which `src/world/globe/entry.ts` loads with a dynamic `import()`. In Vite dev, imported CSS is injected by JS (https://vite.dev/guide/features.html#css), so nothing is styled until main.ts's whole import graph has loaded. Other entry paths (`?view=globe`, `?tree`) never import it.
2. Reuse the existing loading UI (`#loading` in index.html, driven by `src/ui/loading.ts`). Do not add a second splash.
3. Move (do not copy) the `#loading` rules from `src/style.css` into an inline `<style>` in index.html's `<head>`, plus `html{background:#16241d}body{margin:0;overflow:hidden}`. The splash is fixed, opaque and z-index 50, so it hides the unstyled chrome behind it. `:root` in style.css overrides the html background once it loads. Critical CSS guidance: https://web.dev/articles/extract-critical-css
4. Catch every boot `import()` in entry.ts and write the error into `#loading .loading-step`, so a failed fetch says so instead of hanging.

Checks
- `tests/boot-splash.test.ts` (inline style in head before the module script, one copy of #loading, every boot import has `.catch(bootFailed)`).
- Headless Chrome against `npx vite --port <p>` with CPU throttle 4x, 120 ms latency, cache off; screenshot every ~100 ms until the globe; count frames that are >50 % near-white (refs/T-0123/tools/capture.mjs). Before: 97/128; after: 0/125.
- Abort `/src/main.ts` with request interception (refs/T-0123/tools/failcheck.mjs) and confirm the splash shows the error.
- `npx vite build --outDir /tmp/x` and grep the built index.html for the inline style; `npm test`, `npx tsc --noEmit`.

Mistakes to avoid
- Setting a dark background on `body` too: style.css styles `:root`, so a body colour would linger behind pages that expect it transparent.
- An inline splash on paths that never remove it: check each entry path hides or removes `#loading` (globeView and farLayerDemo hide it; the tree viewer clears the body).
- Treating the standalone `?view=globe` reload (when the in-page globe cannot enter, e.g. software GL) as a separate bug: it is the same flash and the same fix covers it.
