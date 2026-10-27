# Skill: one clock

When to use: anything that advances, pauses, or displays simulated time (sky, weather, planet, water, animals, shaders, audio timing, ground years, a new HUD or menu control).

## The clock
`src/core/worldClock.ts` is the only integrator. The dial is a position from −1 (fastest rewind) through 0 (pause) to +1 (fastest forward). #109's dead zone is unchanged: |position| below 0.01 is pause. #109's literal `10^(|position| × 12)` puts 1× on that pause mark, so real time cannot be selected. The curve is shifted, same twelve decades: `magnitude = 10^(((|position| − 0.01) / 0.99) × 12)`. The edge is exactly 1×. Full deflection is still 10^12×, about 30,000 years per real second. Ordinary play rests there: `1 sec / sec`.

The rate eases toward that target. The spring runs in decades with inertia `1 + error²`, so a small nudge is quick and a full-scale jump takes a few seconds. The coordinate is shifted so 0 is pause and ±1 is exactly ±1×. Damping acts on the decade-velocity, so the rate rests on the target. Do not put back a linear 0.05–16 clamp, and do not put 1× back on position 0.

Holds (`menu`, `photo`) freeze the integrator at once. In-game Pause sets the dial to 0 and the rate eases to a stop. Play sets the dial to +1×. A nudge that crosses ±1× stops on it until the gesture ends (a zero delta). It is not a second hold.

- `gameSecondsPerWorldSecond` (3600 / 300) is the day-length conversion for needs, the weather step and ground years. It is not a second rate.
- `hourAt` / `dayAt` / `clockDate` are a phase of the same world second. A negative world second moves the hour backward. `clockDate` clamps the calendar so a geological jump does not hand Venus an Invalid Date. The epoch is `deepTimeAt(epochOffsetYr(worldSec))` in `src/core/deepTime.ts`, not a second timeline.
- `src/render/shaderClock.ts` `time` reads `worldSec()`. The setter is a no-op.
- `?timescale=` is `timescaleFrom` → `setClockRate` (snaps, for startup only), and only when the param is present. Negative is rewind. 1 is exactly 1×. Zero, junk, or anything slower than 1× lands on forward real time. The live bar eases: it calls `nudgeDial`. The dial position catches on ±1×; the rate still does not jump.

## What follows the signed clock
Sky and the hour follow the signed world second, including backward. Ground years advance only (`groundWorldSec`): subtracting years would pretend decay ran backward. Animals, needs, physics, the weather grid and gameplay audio run only while the scale is still Immediate and time is going forward (`simWorldSec`). Above that they hold. Cloud drift drops a negative gap. Wiring other systems to the blend is a later task.

## Observation scale
`resolveObservation` / `observation()` return Immediate, Behavioral, Ecological, Seasonal, Generational, Evolutionary, Geological, Planetary. The discrete label waits for enter/exit (800 and 1200 are the #109 example). `blend` is a smoothstep between the two scales that bracket the rate, with no hysteresis, so a later crossfade does not flicker. Do not add a second scale enum.

## The control
`src/ui/timeHud.ts` `createTimeHud` is the only playback control. Holding − / + , comma / d-pad left, or period / d-pad right moves the dial (`DIAL_HOLD_PER_SEC`). A short press is one notch (`DIAL_NOTCH`). Letting go ends the gesture (`nudgeDial(0)`), which is what lets the next nudge leave the 1× detent. The label is `formatRate`: "1 sec / sec", "1 hour / sec", "1,000 years / sec". Past about a year the date line is the deep-time epoch.

| action | keyboard | Xbox | kind | context |
| --- | --- | --- | --- | --- |
| rewind | `,` | d-pad left | hold | play |
| forward | `.` | d-pad right | hold | play |
| pause or play | `;` | left-stick click | press | play |
| hour (chronometer) | `T` | d-pad up | press | any |

These stay off `[` `]` and `-` `=`. D-pad left/right are the chronometer's while that dial is open and the menu's while a menu is open. On the planet view, main does not move the dial from the d-pad, and the standalone page calls `bindTimeInputs({ padRate: false })`. The menu has no Time tab.

## Checks
- `tests/worldClock.test.ts`: the shifted curve (edge = 1×, full = 10^12×, dead zone still 0.01), the 1× detent, the spring does not jump, a big swing takes seconds, pause eases, play returns to 1×, rewind moves the hour, sim and ground limits, hysteresis at 800/1200, `formatRate`.
- `tests/single-clock.test.ts`: no second `timeScale`, `GROUND.speed`, `THREE.Clock` or `getDelta`. `performance.now` / `Date.now` outside `worldClock.ts` must be on the allowlist. The list only shrinks.
- `npm run system-map` after a `SYSTEM_MAP` edit. `./node_modules/.bin/tsc --noEmit` and `npm test`.

## Mistakes to avoid
- A second multiplier, or folding a saved ground speed into the dial.
- Snapping the live rate when the player moves the dial. `setClockRate` snaps for startup and tests only.
- Applying the spring to the raw rate. A 10^12 range will not both settle on the target and take a few seconds.
- Rewinding ground years, hunger, or the weather grid and calling it history.
- Letting the locomotion lab step the pose at a geological rate (the `while (acc >= DT)` loop will not return). It holds unless the scale is Immediate and the rate is forward.
- Putting the control back on the pad-menu Time tab. Another branch owns the menu container.
- Treating `?deep=` as a playback rate. The readout is `deepTimeAt` of this clock's year offset, and that offset is still years from now.
- Treating `epochOffsetYr` as the geological zero. It is session seconds divided by the Julian year. The #108 line is `dialToYears` in `deepTime.ts` (years since solar-system formation). Do not add a second epoch beside it.

## Board ids
The one clock and the in-game bar are T-0090. The dial on that clock is T-0091. Both name this skill `single-clock`. Files that still say T-0077 and T-0078 are the pad menu and the render plan. Those ids are not this work.
