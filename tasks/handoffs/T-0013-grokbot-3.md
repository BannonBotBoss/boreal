# T-0013 handoff — grokbot-3

Agent: grokbot-3. Branch: `grokbot-3/hunt-lock`. Issue #9. Clock: America/Vancouver (Pacific).

## What was built
Hold the Lock binding (Q / RB, rebindable on Controls) and keep a prey inside a 30° half-angle for 0.2 s. A green pip sits on the senses ring and stays there when the ring fades or hides. Releasing the button, or aiming outside the cone or past 30 m, drops the lock. Nothing locks without the button.

A calm, fed hare does not notice a crouched wolf at 0.35 m/s, 8–10 m, downwind, in the open. A walk at 2 m/s or a run at 4 m/s is noticed. Canopy closure (`1 - siteAt().light`) multiplies sight only. Live hares read that percept through `threatLevel`; a calm miss is level 0 so the sim's 0.25 gate cannot override it. Deer on `stepAgent` receive the wolf's crouched flag, absolute speed and the same cover.

While the lock is held and the wolf is jumping, `decide`'s frozen heading is overwritten after it returns. The leap turns at no more than `leapGrip / speed` toward the prey's lead point until the bodies are inside `HUNT.catchPounce`. That edge is a `hunt` contact on `CONTACTS`. The solid why-tip ignores it. Pin, bite and the meal stay T-0014. The existing sim catch, if a pounce lands inside the old reach, is unchanged.

## Why this issue
First open candidate an agent could finish. #8 (T-0012) has open PR #74. #1, #3, #4, #5, #6, #7, #12, #20 and #52 are already closed. #2 (T-0005) is still claimed by grok-globe. T-0013 already had agy's approve-plan (2026-10-21T11:45:44-07:00). T-0009 and T-0010 are on main. No earlier claim of T-0013.

## Doing
- [x] Handoff and claim
- [x] Lock (aim cone, dwell, drop when aim leaves, no lock without the aim button)
- [x] Prey awareness: agent `perceive` plus relaxation threshold; cover on sight
- [x] Steered leap and `CONTACTS` kind `hunt`
- [x] Rebindable lock action on the Controls screen
- [x] Marker on the senses ring
- [x] Tests with a calibrated position and timing score
- [x] `npx tsc --noEmit`, `npm test`

## How to verify
Hold Q (or RB) on a hare for a fifth of a second. The status line says "aiming", then "Lock on", and a green pip sits on the ring even while sprinting or while Focus hides the ring. Crawl in super-stealth: the hare keeps grazing. Jump: the wolf curves onto the hare and a `hunt` contact begins inside the pounce reach. Rebind Lock under Pause → Controls.

Headless: `npx tsx --test tests/hunt.test.ts`.

## Number table
| Game number | Real figure | Source | Resembles nature? |
| --- | --- | --- | --- |
| lock dwell 0.2 s | regular saccade latency ~200 ms | Fischer & Ramsperger 1984, Exp Brain Res 57:191 | Yes. Not doubled. |
| half-angle 30° | dog binocular overlap 30–60°; half of the upper end | Miller & Murphy 1995, JAVMA 207:1623 | Flagged. Dog figure used for the wolf's aim cone. |
| radius 30 m | stalking alerts of white-tailed deer under 30 m | Lingle & Wilson 2001, Ethology 107:125 | Flagged. Deer stalking distance applied to every prey. |
| leap grip 13 m/s² | cheetah lateral acceleration often above 13 m/s² below 17 m/s | Wilson et al. 2013, Nature 498:185 | Flagged. Ceiling only. No wolf lateral acceleration was found. A wolf is not allowed to turn harder than that. |
| cover = 1 − site light | canopy closure at the body | `siteAt().light` (drawn crowns and stand closure) | Flagged. Sight falls in proportion. Not a Beer-Lambert path. |

## Frame gate
Metric, tool and both calibrations are in `tests/hunt.test.ts` and `tasks/evidence/T-0013/scores.json`.

- Timing. Tool: `stepLock` at 1/30 s. Score `1 - |acquiredAt - 0.2| / 0.2`. Measured acquiredAt 0.200 s, score **1.000**. Known mismatch: a lock on the first step scores 0.833, under 0.95.
- Position. Tool: closest approach of the wolf's step segment and the prey's step segment. Score `1 - minDist / startDist`. Known match: a segment through the prey scores 1. Steered leap onto a prey at (2, −4) m, speed 8 m/s, 0.85 s: minDist 0, score **1.000**. Moving prey (1.6, −6) m, heading −π/2, 1.4 m/s: minDist 0.0002 m, score **0.999971**. Known mismatch: the same stationary prey with heading frozen at 0 scores **0.552786**, under 0.95.

No pixel recording of the ring was made in this run. The pip test checks that the marker stays in the scene graph when the ring is hidden or the wolf is fast, and that it is absent when there is no lock. That is not a 95% match to a photograph.

## Leftovers
- T-0014 owns pin, bite, squeal, eating and release. This task only begins the hunt contact.
- The sim's existing pounce catch can still remove a hare that the leap reaches. That meal path was already there.
- Lock radius and the 13 m/s² ceiling are flagged transfers, not wolf measurements.

## What the next owner needs
T-0014 can listen for `kind: 'hunt'` and must not treat it as a solid why-tip. The lock key is `hare:<id>` for a live hare. The binding id is `lock`.
