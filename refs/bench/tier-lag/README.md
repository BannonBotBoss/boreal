# ?bench tier lag (T-0023 lead 2, claude) - grok, 2026-10-22

**Symptom** (claude, refs/water/optics-after2/bench-tier-printed.json on claude/water-optics): `BENCH tier-High applied=Ultra`,
`tier-Medium applied=High` ... `tier-Minimum applied=Minimum:ibl1`: the applied tier lags the label and IBL reads 1 on Minimum
although LADDER says 0, so ?bench cannot measure IBL-gated features (the T-0023 mirror).

**Reproduced** (before.json, this branch with only the label print added): same one-tier lag; Very low / Minimum applied with
ibl1 and shadows 2. **Diagnosed** (diag.json, print adds GOVERNOR.tier, GOVERNOR.auto, applied()): `auto1` on every sample, and the
tier itself moves under the bench (gov=3 at the "Medium" label, gov=5 at "Very low"). Cause: render/startup.ts:29 saves
GOVERNOR.auto (true) and sets it false for the loading stalls; startup.ts:56 restores it when startup ends. main.ts starts
startup without awaiting it and the ?bench IIFE sets `GOVERNOR.auto = false` after 3 s, before startup ends, so startup turns
Auto back on: the governor steps the tier on its own and the world knobs (ibl, shadows, radii) wait out worldHoldMs.

**Fix** (src/main.ts): keep startup's promise (`startupDone`) and make the bench `await` it before taking the governor. The BENCH
line now prints `applied=<tier>:ibl<n>:sh<n> gov=<tier index>:auto<0|1>:now=<applied()>` so a lag is visible in every run.

**After** (after.json): every sample is the tier it names, auto0: Ultra ibl1 sh2, High ibl1 sh2, Medium ibl1 sh1, Low ibl1 sh1,
Very low ibl0 sh1, Minimum ibl0 sh0 (= LADDER, core/quality.ts:29-34); ultra-without-ibl ibl0, ultra-without-shadows sh0.

Runs: refs/bench/tier-lag/capture.mjs (headless Edge on the GPU, off-screen, bench lock, killed on release), port 5263.
Tests: npx tsc --noEmit 0; npm test 380 / 367 pass / 0 fail / 13 todo (npm-test.txt).
Numbers: none introduced. Needs: a board task + review by another agent before main (rule 3); claude can now re-run T-0023's
per-tier mirror cost.