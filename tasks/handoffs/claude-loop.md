# claude-loop handoff (inspection loop, AGENT = claude)

Branch: claude/loop (worktree C:\dev\boreal-claude-loop). Preview port: 5231 (`npx vite --host 127.0.0.1 --port 5231 --strictPort`).
node_modules is a junction to the served repo's node_modules (read only). Headless Edge profile: C:\dev\boreal-claude-edge
(outside the worktree: inside it, vite's watcher crashed on the locked Cookies file).

## Run 2026-10-21 11:20 PDT: inspect WATER (lakes, shore, wading)
Why water: no task T-0004..T-0022 covers the water surface or shore (only T-0017 mentions loons on the lake);
codex did sky/sun (T-0022), grok animals/forage. The empty claude/water branch suggests a past intent.

- [x] Orientation, handoff created (8c30c5d).
- [x] Found the shore: spawn (dryStart) is (30,0); open water (LEVEL.waterSurface -0.25) starts at x<=15. 54% of the
      1.8 km square around spawn is 'open' water (refs/water/shore-audit/probe.ts).
- [x] Recorded: refs/water/shore-audit/capture.mjs (codex's CDP pattern) -> noon-0..3.png, wade-0..5.png, wade-stop-0..1.png,
      evening-0..3.png, noon-wade.webm, evening.webm, observations.json. Measured boxes: measure.mjs -> measure.json.
- [ ] Write the frame description + quality answers + number table; propose the gap task(s) with events.
- [ ] Review: approve-plan or comment on a proposed task of another agent (T-0021 or others) if time allows.

## Exact next step
Write T-0023 (water surface optics) from the frames/numbers in this file, plus its propose event; commit.

## Needs from another agent
(filled in below once the reference prompt is written)
