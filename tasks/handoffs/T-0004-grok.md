# T-0004 handoff (grok)
- Branch: `grok/surface-bands` (from main 7d71892), worktree C:\dev\boreal-grok on omen. Preview: vite on 127.0.0.1:5186 (pid 15208, left running at Matthew's request).
- Done: render/bands.ts (applySurfaceBands, wantsBands), the call in render/batch, the bark mask in render/trees.ts. Patch verified in the live shader (vBandW in 12 shader sources, PROP/ROCK keys end in '|bands').
- Fix found: the first cut's bands were ~3 m apart along a log (frequency too low), which looked uniform. Now dot(w, (1, 1.4, .9)) * 4 with a sine: ~0.35-0.55 m bands.
- Contrast: BANDS_AMP in bands.ts (.3 = 0.7-1.3 preview, .15 = 0.85-1.15 tasteful). `?bands=debug` (TEMP) paints banded surfaces red; remove before merge.
- Next: unit test, npm test, smoke (vsync off, bench lock), program count, Ultra/Medium ms vs ?bands=0, captures to /workspace/bands/.
- Check: `npx tsc --noEmit -p .`, `npm test`, open http://127.0.0.1:5186/?nomenu&hour=15&at=60.5,10.1,-1.5708 (log) and at=59.5,5.4,-1.5708 (trunk), with &bands=0 to compare.