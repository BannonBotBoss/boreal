---
id: T-0001
title: Earth-Sun clock - a small 3D Earth lit by the Sun, with a "you are here" marker, so the player can read the time of day
author: claude
scratch: true
research: true
skill: false
---
# T-0001 Earth-Sun clock

**Asked by Matthew (2026-10-18 16:23 PT):** a 3D model of the Earth and the Sun that shows where the Sun is relative to the
Earth, with an indicator for our place on it, so a player can see what time of day it is.

## What the player sees
A small round inset (bottom-left, ~140 px, toggled with a key and in the pause menu) showing the Earth from space. The half
facing the Sun is lit, the other half is night, with a soft twilight band along the terminator. A small Sun disc sits in
the inset's sky in the true direction. A pulsing marker shows the player's position (Kenora, 49.5° N, 94.5° W). The marker sits
in daylight at noon, crosses the terminator at sunrise and sunset, and is deep on the night side at midnight. Drag to turn
the view; by default the camera follows the marker so the player always sees their own side. Under it: the game clock
(`formatHour`), the sun elevation, and "sunrise in 2 h 10 min" or "sunset in 40 min".

## Existing work to reuse (checked before planning)
- **Sun geometry already exists.** `core/timeOfDay` `sunPosition` / `declination` (NOAA/Spencer) and `core/celestial`
  `localSiderealHours` / `LONGITUDE` give everything needed. Subsolar point: latitude = declination(day), longitude =
  LONGITUDE − 15 × (hour − 12). Do **not** write a second solar formula.
- **A planet renderer already exists**, Grok Bot's `?view=globe` (`src/world/globe`: tiles, workers, atmosphere). It is far too
  heavy for an inset: tile workers, LOD, about 100 draw calls. Reuse its **look**, not its renderer. That means
  `planet.ts` `createPlanet(seed)` plus `surfaceColour` for land, sea and ice, so the inset Earth is the same planet the
  globe view flies over. Also reuse the atmosphere's rim colour. Ask the Globe Builder before importing anything.
- **Cheaper than a 3D scene?** A flat 2D day/night world map (an equirectangular image with a terminator curve) is cheaper
  still and reads well. The task picks 3D because Matthew asked for it, but the plan reviewer may choose 2D.
- Rule 1 (procedural): no NASA Blue Marble texture. The surface comes from the game's seeded planet. This matters because the
  game's planet is not real Earth geography. Mark the player's position wherever `home.ts` places Kenora on that planet.

## Design
- One `THREE.Scene` + `PerspectiveCamera`, rendered into a scissored corner of the main canvas after `post.render`.
  Use no second WebGL context. That costs 3 draw calls: Earth, rim glow and marker, plus the Sun sprite.
- Earth: an `IcosahedronGeometry` is banned (rules.test). Use `SphereGeometry(1, 64, 32)`. Bake its surface colour once
  into a 512×256 `DataTexture` from `createPlanet(WORLD_SEED)` + `surfaceColour`. That texture is the only one: generated,
  never loaded. The day/night shading happens in the shader: `day = smoothstep(-0.1, 0.1, dot(n, sunDir))`, with
  night lights off (no cities). The twilight band is warm (`sunColour` at low elevation from core/light).
- Sun direction in Earth-fixed coordinates, from the subsolar point. It updates every frame from the same `hour` and day
  as `render/sky`, so the inset can never disagree with the sky.
- Marker: a small ring that always faces the camera, at the player's lat/lon, pulsing at 1 Hz. A thin line to the Sun is
  optional.
- Cost knob: the inset is off on Minimum and in XR (a `clock` column in the quality LADDER, or simply skipped when
  `tier.name === 'Minimum'`).

## Objectives
- [ ] Handoff file `tasks/handoffs/T-0001-<agent>.md` committed before any code
- [ ] `core/earthClock.ts` (pure): subsolar point, sun direction in Earth-fixed axes, player lat/lon → unit vector, time to next sunrise/sunset (reusing core/timeOfDay)
- [ ] `tests/earthClock.test.ts`: noon puts the subsolar longitude on the player's meridian; at the equinox the terminator passes through the poles; June solstice subsolar latitude ≈ +23.44°; sunrise/sunset times match `sunPosition` crossing −0.833°
- [ ] Bake the planet's surface colour into one 512×256 DataTexture from `createPlanet` + `surfaceColour` (check with the Globe Builder that this import is fine)
- [ ] `render/earthClock.ts`: inset scene (Earth with day/night/twilight shader, rim glow, Sun sprite, pulsing marker), drawn in a scissored corner after `post.render`
- [ ] Camera follows the marker; dragging the inset turns the view; it returns to following after 5 s
- [ ] Text under the inset: clock, sun elevation, time to next sunrise/sunset
- [ ] Toggle key + pause-menu switch (ask the menu owner; remember the choice like the other settings)
- [ ] Off on the Minimum tier and in XR; measured cost ≤ 0.3 ms GPU and 3-4 draw calls (bench numbers in the handoff)
- [ ] Screenshots at 06:00, 12:00, 18:00 and 00:00 in the notes; `tsc`, `npm test`, build green; playable link for Matthew

## How a reviewer checks it
Open the game with `?hour=12`: the marker is in the middle of the lit half. `?hour=0`: on the night side, opposite the Sun.
`?hour=` at sunrise (the sky's sun at 0°): the marker sits on the terminator. Change `WEATHER.day` to 172 (June): the lit
cap reaches over the North Pole. Then check the GPU and draw-call numbers against the objectives.
