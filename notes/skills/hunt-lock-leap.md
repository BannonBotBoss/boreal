# Skill: lock a prey by holding aim, then steer the leap onto it

Use when the player holds a rebindable aim and a leap should curve onto that body until a contact begins.
The prey's notice stays on the shared agent (`perceive`, `notices`). This skill is the player's aim and the turn, not a new species row.

## Steps
1. Read `src/core/hunt.ts`, `src/core/agent.ts` (`perceive`, `notices`), `src/core/bindings.ts`, and `AnimalBrain.decide` in `src/core/animalBehavior.ts`.
   `decide` returns immediately while `motion === 'jump'` and `jumpTime < PHYS.jumpSeconds` (0.85 s). Heading written inside `decide` during that window is ignored.
   Steer after `decide` returns, by writing `brain.heading` before `steerWolf`.
2. Numbers come from `SYSTEM_PROPERTIES.hunt` and are cited there. Do not invent a second copy.
   - Dwell is the measured saccade latency (0.2 s), not a doubled one.
   - The half-angle is half of the published binocular overlap, not a new cone.
   - The lock radius is a stalking distance. Say which species it was measured on.
   - Lateral acceleration is a ceiling. If the only measured figure is another species, say so and do not call it a wolf measurement.
3. `stepLock` locks only while the aim binding is held, only after the same body has stayed inside the cone and the radius for the dwell, and drops when the aim leaves or the button is up. A held lock is not stolen by a nearer body.
4. Prey awareness: `perceive` already combines sight, hearing and scent. Cover multiplies sight only (`1 - cover`). Sound and scent still carry. `notices` compares the level with `modulators().noticeAt`, which rises as the animal calms.
   Live hares tick in `core/sim`, not `stepAgent`. For the embodied wolf against a hare, `threatLevel` must use that perceive and, on a calm miss, return 0 so the sim's 0.25 threshold cannot override it. Other pairs stay on the template perceive.
   Deer already call `stepAgent`. Pass crouched and cover on the wolf `Other`, or a stealth wolf is treated as upright in the open. One `siteAt` per frame at the wolf, not per deer.
5. The leap aims at the prey plus its velocity times the time still left (capped by distance / wolf speed). Turn rate is `grip / speed`. `huntTouch` begins a `kind: 'hunt'` contact inside `HUNT.catchPounce`. End the pair when the leap ends so the next leap can rise again. The solid-contact listener ignores `hunt` (and `feed`). Pin, bite and eating are a later task.
6. The lock pip is a ring-local point from `lockPoint`. It stays visible when speed fade or focus-hide turns the cue ring off. It is not the scent colour and not the sound colour.
7. The binding is a `play` hold action. `conflicts(defaults())` must stay empty. Same key in another context is not a conflict.
8. Tests name the metric, the tool and both calibrations. Position: `leapScore = 1 - minDist / startDist`, closest approach of the two motion segments (not samples). Known match: a segment through the prey scores 1. Known mismatch: frozen heading, prey off that line, scores under 0.95. Timing: `lockTimingScore = 1 - |acquiredAt - dwell| / dwell`. A 0.2 s dwell is 6 steps of 1/30 and scores 1. A lock on step 1 scores under 0.95.

## Checks that proved it worked
- `npx tsc --noEmit` clean. `npm test` green. `npm run system-map` committed when `hunt` gained keys.
- `tests/hunt.test.ts` prints the timing score and the leap scores (steered, frozen, moving).
- The halo test shows the pip while the ring is hidden, and nothing when there is no lock.

## Mistakes to avoid
- Steering inside `decide` during the leap. The early return throws the heading away.
- Treating the cheetah's 13 m/s² as a wolf measurement.
- Letting `cover: 0` change an existing perceive test. Cover defaults to open ground.
- Eating, pinning or squealing on the hunt contact. That is the next task.
- Leaving a `hunt` pair on the `CONTACTS` singleton. Later tests see a contact they did not begin.
- Hiding the lock pip on the same fade that hides the cue ring. The leap is faster than that fade.
- Returning the raw percept level on a calm miss in `core/sim`. The 0.25 gate would still scare the hare.
