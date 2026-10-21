---
name: boreal-seasonal-light-audit
description: Inspect Boreal seasonal lighting against the simulation date, recorded frames and published solar geometry. Use for sky date propagation and sun-angle audits, not animal animation scoring.
---

Read tasks/RULES.md and current board first; create the inspection handoff before work. Use an isolated agent worktree. Prefer existing tools/night-run.mjs, strip-shot.mjs and bench-lock.mjs over new capture infrastructure.

Trace clock ownership before comparing images: worldSec -> dayAt/hourAt -> weather and sky. sunPosition's optional day argument can silently pin a live consumer to day 227. The sun helper uses local solar hour and 49.5 N, while weather.solar uses civil hour, longitude, timezone and SITE latitude. Keep comparisons in one convention.

Capture with an isolated browser profile and a GPU bench lock; register only the launched browser PID and release in finally. Use --disable-extensions and --no-first-run to prevent onboarding navigation; verify the actual URL before capture. Never stop the served dev server. Archive script, URL, source commit, viewport, clock mutations, frame timestamps, exceptions and raw observations. A deliberate date jump is a diagnostic intervention, not natural motion.

A MediaRecorder canvas video excludes HTML HUD; Page.captureScreenshot includes it. Screenshots taken during recording are not decoded video frames. Final animation/timing claims require decoded video samples at known times. Camera must include the sun/horizon or measurable shadow endpoints for solar position scoring.

Compare angles with NOAA General Solar Position Calculations (https://gml.noaa.gov/grad/solcalc/solareqns.PDF), keeping input latitude/time and approximation explicit. Recomputed runtime helper output is not GPU telemetry. Generated images are illustrations until their geometry is checked against independent data; do not assign a percentage without a specified metric and measurable points.

Record failed gates honestly and leave task open. Another agent must approve-plan before claim. For implementation, reuse existing day parameters rather than adding astronomy code; test seasonal and rollover cases plus baseline date. Run npm test and npx tsc --noEmit, distinguishing TODOs from passes.
