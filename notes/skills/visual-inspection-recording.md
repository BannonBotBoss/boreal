# Skill: inspect one area of the game from recorded frames (record, describe, measure, compare with nature)

Use when the loop says "pick an area, record it, ask the quality questions" (tasks/RULES.md rule 6), or when a task needs
before/after frames. First written by claude for the water inspection (2026-10-21, refs/water/shore-audit/, T-0023/T-0024).

## Steps
1. **Find the spot in code, not by wandering.** Use the generator's own lookups to place the camera: e.g.
   `surfaceAt(x, z)` / `dryStart` (core/stages/surfaceAt.ts) for water and shore, then open the game at
   `?nomenu&bench&hour=HH&at=x,z,yaw` (main.ts:165; heading 0 = -z, pi/2 = -x, proc/math stepForward). Keep the probe
   script next to the frames (refs/<area>/<audit>/probe.ts) so a reviewer can rerun it.
2. **Serve your own branch** on your port (5210-5299): `npx vite --host 127.0.0.1 --port 52xx --strictPort` as a background
   job. A worktree without node_modules can use a junction to the served repo's node_modules (read only).
3. **Record headless** with the CDP pattern of refs/sky/season-audit/capture.mjs (codex) or refs/water/shore-audit/capture.mjs:
   bench-lock `acquire`/`track`/`release` (release kills the Edge it launched), `Page.captureScreenshot` stills at fixed
   gaps plus a `MediaRecorder(canvas.captureStream(15))` webm, `Input.dispatchKeyEvent` to hold W for walking shots.
   Write observations.json (URL, times, errors).
4. **Describe from the frames** (Read the PNGs): what is in front, colours, edges, what moves, what is missing. Write it as
   one paragraph a reader could draw.
5. **Measure, don't eyeball** (rule 11 on codex/loop): mean sRGB and relative luminance of fixed boxes with a no-dependency
   PNG decoder (refs/water/shore-audit/measure.mjs). Turn the look into a ratio that physics predicts (e.g. water under the
   far shore / the treeline it mirrors = Fresnel reflectance at that view angle).
6. **Calibrate the metric** on a known match and a known mismatch: decode sourced real photos in headless Edge (canvas
   `getImageData`, refs/water/shore-audit/measure-photos.mjs) and measure the same boxes. Photos from Wikimedia Commons via
   the API (`generator=search`, `prop=imageinfo`, `iiurlwidth=1280`), saved with SOURCES.json (title, page, author, licence).
   Only compare photos with the same geometry (eye height, what the water mirrors).
7. **Check every number against a source** in a table (game value, real value + source, yes/no). Compute physics yourself
   when it is exact (Fresnel, wave dispersion) and say so.
8. **Gaps become tasks** (next free id across all branches, credits formula, propose event named per rule 13 with the real
   clock time; two events in one minute get distinct seconds). Generated references go to "Needs from another agent" in the
   handoff with the exact prompt and save path.

## Checks that proved it worked
- The metric separated nature from the game: real eye-level lakes 0.66-0.73 vs game 5.04 (refs/water/shore-audit/mirror-ratio.json).
- Every script reruns from the worktree root and writes its output next to the frames.

## Mistakes to avoid
- Do not put the Edge `--user-data-dir` inside the worktree: vite watches it and crashes (EBUSY on the Cookies file). Use a
  folder outside it, e.g. C:\dev\boreal-<agent>-edge.
- There is no python on this PC; write measurement scripts in node.
- Event `at` times: take them from `date`, never type them; a hand-typed future time breaks the replay order.
- A box that catches sky between sparse trees, or a photo taken from above, measures a different thing: exclude it with the
  reason rather than averaging it in.
- Commons full-text search with OR/filetype filters returns scanned books; plain keyword queries work better.
- Git Bash here ignores `TZ=America/Los_Angeles` and prints UTC (no tz database): event names came out 7 h ahead. Plain
  `date` already gives Windows local time (Pacific); check against PowerShell `Get-Date -Format o` once per run.
- Files in this repo are mostly CRLF: a multi-line search string with `\n` silently misses (`String.replace` does not throw).
  Normalise (`.replace(/\r\n/g, '\n')`) or use the Edit tool, and check every replacement landed (`grep -c`).
- Preview ports are per agent (claude 5210-5229, codex 5230-5249, agy 5250-5269); check before you start a server.

## Re-measuring after a fix (T-0023)
- Give the capture script an output dir (`capture.mjs <port> <dir>`) so the before frames stay; record each step separately
  (refs/water/optics-after = first change, optics-after2 = second) to see which change moved which number.
- Cost: the game's own `?bench` ladder (refs/water/optics-after2/bench.mjs keeps the BENCH lines). To attribute a cost, bench
  once with the feature forced off (temporary one-line edit, reverted by `git checkout`): triangles are reliable on a
  shared GPU, ms are noisy. Print the applied tier in the BENCH line before trusting per-tier labels (it lagged by one
  sample and reported ibl 1 on Minimum, 2026-10-21).
- When a fix is physically right but the calibrated metric still fails, find what else the metric sees and report the fail
  with its cause; never round it to a pass. **Test a suspected cause before you blame it**: the open forest edge looked like
  the cause of T-0023's fail, but a calibrated sky-share metric (refs/forest-edge/edge-gap.mjs) put it at ~1 point over real
  mirrors. The real causes were a box that covered dry bank and a missing physics factor.
- **Crop the box before trusting it.** Split each measurement box into strips (refs/water/optics-after2/box-diag.mjs) and crop +
  enlarge any outlier strip (refs/water/optics-after2/crop.mjs, zlib-only PNG writer). A strip 3-4x off the others is usually
  the box catching something else (here the far bank curving down into the water box). Then ask a reviewer for a ruling with
  the crop as evidence. Do not change a gate box yourself after seeing the score.
- Keep the calibrated statistic: luminance of the box's mean sRGB and the mean of per-pixel linear luminance differ by up to
  3x on boxes with sky gaps (1.88 vs 5.11 on the same box).
- A "sky pixel" test needs a colour condition, not just brightness: sunlit autumn foliage passed a luminance-only test
  (0.17 false sky share); `blue >= green` plus luminance > 0.5 x sky q95 separated it (0.000).
- Render the physics a material actually needs: a Lambert material lights water like a matte surface (R E / pi); radiance
  leaving water also loses 1/n² (0.563; Lee et al. 2002: Rrs ~0.52 rrs). Look for such factors when a body is too bright.
- Stamp event times from the clock in the same script that writes the file (tasks/events, `new Date()` with the offset),
  not by typing them: two of mine were typed 3-48 s ahead and had to be re-stamped before committing.
