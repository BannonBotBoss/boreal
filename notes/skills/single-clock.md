# Skill: one clock

When to use: anything that advances, pauses, or displays simulated time (sky, weather, planet, water, animals, shaders, audio timing, ground years, a new HUD or menu control).

## The clock
`src/core/worldClock.ts` is the only integrator. The dial is a position from −1 (fastest rewind) through 0 (pause) to +1 (fastest forward). Outside a dead zone of 0.01 the target rate is `sign × 10^(|position| × 12)` sim seconds per real second (#109). Full deflection is 10^12×, about 30,000 years per real second. The first notch forward of pause is about 1.32×. Exact 1× is not a resting position: position 0 is pause.

The rate eases toward that target. The spring runs in decades (log10 of the rate) with inertia `1 + error²`, so a small nudge is quick and a full-scale jump takes a few seconds. Damping acts on the decade-velocity, so the rate rests on the target. Do not put back a linear 0.05–16 clamp.

Holds (`menu`, `photo`) freeze the integrator at once. In-game Pause sets the dial to 0 and the rate eases to a stop. Play puts the dial back. It is not a second hold.

- `gameSecondsPerWorldSecond` (3600 / 300) is the day-length conversion for needs, the weather step and ground years. It is not a second rate.
- `hourAt` / `dayAt` / `clockDate` are a phase of the same world second. A negative world second moves the hour backward. `clockDate` clamps the calendar so a geological jump does not hand Venus an Invalid Date. The epoch is `deepTimeAt(epochOffsetYr(worldSec))` in `src/core/deepTime.ts`, not a second timeline.
- `src/render/shaderClock.ts` `time` reads `worldSec()`. The setter is a no-op.
- `?timescale=` is `timescaleFrom` → `setClockRate` (snaps, for startup only), and only when the param is present. Negative is rewind. Zero or junk lands on the forward lip. The live bar never snaps: it calls `nudgeDial`.

## What follows the signed clock
Sky and the hour follow the signed world second, including backward. Ground years advance only (`groundWorldSec`): subtracting years would pretend decay ran backward. Animals, needs, physics, the weather grid and gameplay audio run only while the scale is still Immediate and time is going forward (`simWorldSec`). Above that they hold. Cloud drift drops a negative gap. Wiring other systems to the blend is a later task.

## Observation scale
`resolveObservation` / `observation()` return Immediate, Behavioral, Ecological, Seasonal, Generational, Evolutionary, Geological, Planetary. The discrete label waits for enter/exit (800 and 1200 are the #109 example). `blend` is a smoothstep between the two scales that bracket the rate, with no hysteresis, so a later crossfade does not flicker. Do not add a second scale enum.

## The control
`src/ui/timeHud.ts` `createTimeHud` is the only playback control. Holding − / + , comma / d-pad left, or period / d-pad right moves the dial (`DIAL_HOLD_PER_SEC`). A short press is one notch (`DIAL_NOTCH`). The label is `formatRate`: "1.32 sec / sec", "1 hour / sec", "1,000 years / sec". Past about a year the date line is the deep-time epoch.

| action | keyboard | Xbox | kind | context |
| --- | --- | --- | --- | --- |
| rewind | `,` | d-pad left | hold | play |
| forward | `.` | d-pad right | hold | play |
| pause or play | `;` | left-stick click | press | play |
| hour (chronometer) | `T` | d-pad up | press | any |

These stay off `[` `]` and `-` `=`. D-pad left/right are the chronometer's while that dial is open and the menu's while a menu is open. On the planet view, main does not move the dial from the d-pad, and the standalone page calls `bindTimeInputs({ padRate: false })`. The menu has no Time tab.

## Checks
- `tests/worldClock.test.ts`: the #109 samples (0.1 → ~15.8×, 0.5 → 10^6, 1 → 10^12), the spring does not jump, a big swing takes seconds, pause eases, rewind moves the hour, sim and ground limits, hysteresis at 800/1200, `formatRate`.
- `tests/single-clock.test.ts`: no second `timeScale`, `GROUND.speed`, `THREE.Clock` or `getDelta`. `performance.now` / `Date.now` outside `worldClock.ts` must be on the allowlist. The list only shrinks.
- `npm run system-map` after a `SYSTEM_MAP` edit. `./node_modules/.bin/tsc --noEmit` and `npm test`.

## Mistakes to avoid
- A second multiplier, or folding a saved ground speed into the dial.
- Snapping the live rate when the player moves the dial. `setClockRate` snaps for startup and tests only.
- Applying the spring to the raw rate. A 10^12 range will not both settle on the target and take a few seconds.
- Rewinding ground years, hunger, or the weather grid and calling it history.
- Letting the locomotion lab step the pose at a geological rate (the `while (acc >= DT)` loop will not return). It holds unless the scale is Immediate and the rate is forward.
- Putting the control back on the pad-menu Time tab. Another branch owns the menu container.
- Treating `?deep=` as a playback rate. The epoch is `deepTimeAt` of this clock's year offset.
