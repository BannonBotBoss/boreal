# grok-globe notes

## 2026-10-19 T-0005 fallen logs (grounding + bark), branch grok-globe/log-grounding-bark
- Matthew asked for it (06:37 PT): logs settled into the ground, procedural bark shader. Plan approved by grok (664d2a8).
  07:17 PT physics: gravity vs a yielding earth (trunk density vs earth density), flat against the earth, pressed in ~1/3 of the
  width. core/settle.ts: buoyant equilibrium from core/materials + core/ground + soilAt (no new constants); clay 0.34, till 0.36.
  T-0006 (grok/T-0006-solid-contact) fires the one log-on-earth contact from seatLog's { at, normal, settle }; it never seats.
- **Note to the props/flora owners:** fallen logs are now pitched, rolled and partly sunk to the terrain (`seatLog`,
  render/geometry.ts) and drawn with a bark shader on `LOG_MATERIAL`; the ground-plant footprint (render/flora/flora.ts:61,
  2.25 x 0.45 m along x, not turned with the log's yaw) and the log mass (render/mass.ts:18) are unchanged, so they still
  describe a level log.
- Merge order: perf6/near-shadows, grok/surface-bands, this branch.- 08:15 PT done on the branch: 95211cc seating, 4c7e4a9 bark. Programs: +1 key = +2 links per tier (two post routes), one over the plan's +1; logSeat 0.020 ms/log; smoke PASS 60 fps. Headless smoke on omen sometimes drops into a 2 fps vsync mode (main too): compare tiers with --disable-gpu-vsync.
- 2026-10-19 11:05 PT: Matthew accepted T-0005's +2 shader programs (target was <= +1); smooth bark kept as built, no code change. Merge order unchanged: near-shadows, surface-bands, log-grounding-bark.
- 2026-10-22 00:50 PT T-0034 (branch grok-globe/globe-default-view): a bare load opens the in-page globe at 2.2 R (`?start=globe&stages=1&trees=v2`); `?view=ground` / `?at=` / any flag keep the ground; Esc on the globe and the footer Menu button open the start menu. Waiting on an approve-plan.
- 2026-10-22 02:17 PT T-0034 completed: descent stall = sync dry-land search (now generator, 3 ms/frame), pitch snap = horizon aim below 300 km (now globePitch), blank plain = cloud deck (cloudClear). Measure with rAF logs, not capture gaps; headed Edge behind other windows runs at 1 Hz.
- 2026-10-23 04:05 PT T-0043 (branch grok-globe/globe-inertia, done on the box: omen offline): the globe coasts ~3 s after a drag with
  three's `MathUtils.damp` (https://threejs.org/docs/#api/en/math/MathUtils.damp), OrbitControls damping off (1:1 drag). Config
  `GLOBE_COAST` in transition.ts; stops on grab/click/H/descent/auto handoff/detach. camera-controls (yomotsu) considered, not a
  dependency. Box captures: Playwright-core + /usr/bin/google-chrome with SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`),
  `window.__globe` is the standalone handle; page ready = `__globe.stats().drawn > 0 && queued === 0` (~2 s). Handoff:
  tasks/handoffs/T-0043-grok-globe.md.
- 2026-10-28 T-0089 (branch grok-globe/env-record-impl): environment record `ENV` / `ENV_UNIFORMS` (src/render/environment.ts) from
  weatherAt / weatherAtLatLon; globe cloud drift = sub-point u / (R cos lat) on sim seconds, held above Behavioral via worldClock
  SCALE_BOUNDS; Mie x Hanel f(RH) capped at 0.95. Use `clockRate()`, not `observationRecord().rate` (still 0/1 on main). Full
  npm test on the box takes ~22 min (climate-class.test.ts runs the wasm grid for ~17 min). Skill notes/skills/environment-record.md.

## 2026-11-05 T-0166 Big Bang opening (B0–B3), branch grok-globe/big-bang-cinematic
- After the loading card the screen is black until a click or a key. Narration and the bed start then. The impact flash is the peak of bang-impact, 0.37 s after it starts. The title is THE BIG BANG. The film holds there. Cue 2 and the later voices are on disk and stay quiet until their times. No save.

## 2026-11-06 01:16 PT T-0169 globe close-up realism (proposed only)
- Matthew's brief via Grok Bot: billow/Worley clouds + small-scale wind warp, warm soft terminator, deep ocean #030b1e-#051330 with Fresnel, glint on the existing MeshStandardMaterial (roughness 0.15-0.2, metalness 0.1-0.2, simplex chop), glint and diffuse hidden under cloud shadows. Refs: refs/T-0169/.
- Where it lives: clouds are the analytic shell in atmosphere.ts cloudDensity (the liquid bands come from the single 2600 km warp + zonalStretch over smooth value fBm); the ocean is tile.ts globeMaterial (Cox-Munk roughness 0.444, metalness 0); the cloud shadow is analytic cs in atmosphere.ts patch() (no receiveShadow: the clouds are not a mesh). Implementation branch later: grok-globe/globe-closeup-realism.
