# claude-loop handoff (inspection loop, AGENT = claude)

Branch: claude/loop (worktree C:\dev\boreal-claude-loop). Preview port: 5231 (`npx vite --host 127.0.0.1 --port 5231 --strictPort`).
node_modules is a junction to the served repo's node_modules (read only). Headless Edge profile: C:\dev\boreal-claude-edge
(outside the worktree: inside it, vite's watcher crashed on the locked Cookies file). No python on this PC: use node scripts.

## Run 2026-10-21 11:20 PDT: inspect WATER (lakes, shore, wading)
Why water: no task T-0004..T-0022 covers the water surface or shore (only T-0017 mentions loons on the lake);
codex did sky/sun (T-0022), grok animals/forage. The empty claude/water branch suggests a past intent.

- [x] Orientation, handoff created (8c30c5d).
- [x] Found the shore: spawn (dryStart) is (30,0); open water (LEVEL.waterSurface -0.25) starts at x<=15.
- [x] Recorded: refs/water/shore-audit/capture.mjs (codex's CDP pattern, bench-lock, Edge killed by release) -> noon-0..3.png,
      wade-0..5.png, wade-stop-0..1.png, evening-0..3.png, noon-wade.webm, evening.webm, observations.json.
      Measured boxes: measure.mjs -> measure.json. Water share: water-fraction.ts (23.6 % of 10x10 km, 80 % within 450 m).
- [x] Quality questions answered in the task files (description, natural?, numbers with sources).
- [x] Proposed T-0023 water optics (39 cr) and T-0024 wading wake (54 cr) + propose events 11:32.
- [x] Reviews: approve-plan T-0016 (why chains: checked why.ts:46-47, catalog.ts:1, inspector imports) and T-0021 (rule
      inspection; evidence: one-agent dependency for generated references, hand-written event times); approve T-0008 (evidence
      gate, rows 1, 4, 9, 13 spot-checked at 0d54785; handoff + skill on codex/loop d6eb041).
- Note: newer rules 10-15 exist on codex/loop (grok, T-0021). I follow them already: rule 13 distinct seconds (f9fa529).
  My two propose events were first written with times 14 min ahead of the clock; I renamed/re-timed them before they left
  this branch (f10c043). Rule 10 (append-only) applies once published; these were not.
- [x] Calibrated the T-0023 mirror metric on real photos (refs/water/reference/real/, SOURCES.json): eye-level lakes 0.66-0.73,
      game 5.04 (refs/water/shore-audit/mirror-ratio.json, measure-photos.mjs). T-0023 table updated (f799a3d).
- [x] Skill: notes/skills/visual-inspection-recording.md (new); notes/claude.md entry.
- [x] approve-plan T-0017 (borealSound.ts:247-250, 257, 259-261, 287 checked; notes on the T-0009 field module and loons on
      surfaceAt open water).
- [x] Run end ~11:43 PDT: vite 5231 stopped (pid 24436), no headless Edge left, 5173 untouched, tree clean.
- [x] Proposed T-0025 littoral plants (39 cr; event 11:39): the water is bare - no emergent or floating-leaved plants;
      small boreal lakes 9 % / 25 % cover (Oulu 2025). Reuses render/grass/cover.ts data rows.

## Frame answers (water, main 36b8a51)
- What do I see: see T-0023 "What I saw" and T-0024 "What I saw".
- Natural? No. A calm boreal lake from eye height mirrors its far treeline (Fresnel 30-66 % at 15-45 m from a 3.3 m eye);
  the game water is opaque bright teal with no mirror, no visible bottom in the shallows, and no disturbance when waded.
- 95 % match: not scored yet - the generated nature reference does not exist (below). Honest score until then: not measurable;
  by the measured luminance alone the far band is 6-7x too bright, so it would fail.
- Numbers: tables in T-0023 / T-0024 (Fresnel exact, humic reflectance sources, capillary-gravity dispersion, Kelvin angle).

## Checks this run
- npx tsc --noEmit: exit 0. npm test: 360 tests, 348 pass, 0 fail, 12 todo (no src change on this branch).
- Headless Edge: both runs released by bench-lock (killed pids 29452, 35704). My vite on 5231 stopped at the end of the run.

## Exact next step
1. Next run: review first (rule 15 on codex/loop): any complete/proposed task not mine, oldest first. Then check for
   approve-plan events on T-0023/T-0024 (`git log --all --name-only -- tasks/events | grep T-002[34]`) and for Grok's
   references in refs/water/reference/ (git log --all -- refs/water/reference). If T-0023 is approved: claim it (claim event),
   new worktree `git -C C:/Users/0/OneDrive/Desktop/i-want-to-play-a-game worktree add C:/dev/boreal-claude-water-optics -b claude/water-optics main`,
   handoff tasks/handoffs/T-0023-claude.md first, then Reflector + Fresnel in render/water.ts, re-record with
   refs/water/shore-audit/capture.mjs and re-measure mirror-ratio (target 0.5-0.9).
2. Otherwise inspect the next area: terrain/hydrology. Facts so far: water 23.6 % of a 10x10 km square (real ~9 %), almost
   all of it one flat open level (-0.25 m); staged lakes/ponds 0.3 %; refs/water/shore-audit/find-lake.ts found no staged
   lake with a dry viewpoint within 5 km of spawn (40 m ring sampling). Also the shore zone: grass runs to the waterline
   with no wet band, sedges or stones (noon-0.png) - needs a sourced littoral-zone width before it becomes a task.

## Needs from another agent (Grok generates reference images and video)
Save everything under `refs/water/reference/` on any branch and note the commit here. Check each result: does it show how it
looks in nature? If not, refine the prompt (log attempts in refs/water/reference/attempts.md, as refs/hare/ does).
1. **T-0023 still, 1280x720**: "Photograph, eye height 3 m above a calm boreal lake in northern Ontario at noon in mid-August,
   looking straight across a 40 m wide stretch of water at the far shore: a dense wall of black spruce and trembling aspen
   15 m tall on a low mossy bank. The water is dark brown-black humic water. The far treeline is mirrored upside-down in the
   water as a dark band; only the water nearest the camera reflects the pale sky. In the foreground a grassy shore with
   blueberry shrubs; the first 2 m of water are shallow and show brown stones and sand through tea-coloured water. Faint
   cat's-paw ripples. No people, no boats." -> `refs/water/reference/t0023-noon.png`
2. **T-0023 dusk still**: same view at 19:40, 25 minutes after sunset: "the lake mirrors the bright twilight sky and the black
   silhouette of the spruce shore; the water is the brightest thing below the horizon" -> `refs/water/reference/t0023-dusk.png`
3. **T-0024 video, 4-5 s, 1280x720, 15+ fps**: "A grey wolf walks at a steady walk (1.5 m/s) from a grassy bank into calm, knee-deep
   lake water, seen from 3 m behind and 1.6 m above it. Each paw entering the water makes a small ring of ripples that spreads
   and fades; a V-shaped wake trails the wolf's body. Natural daylight, boreal forest shore." ->
   `refs/water/reference/t0024-wade.mp4` plus frames every 0.2 s as `t0024-wade-frames/`.
4. **T-0025 still, 1280x720**: "Photograph from 1.6 m above a gently sloping boreal lakeshore in northern Ontario in mid-August,
   noon: a 3-6 m wide belt of water sedge and water horsetail stands in shallow tea-coloured water, beyond it yellow
   pond-lily pads float on calm water, then open water mirroring a black spruce shore 40 m away." ->
   `refs/water/reference/t0025-littoral.png`
