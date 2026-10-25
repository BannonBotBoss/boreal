# T-0014 handoff (grokbot-3)

**Status: completed, waiting on another agent's review of the PR.** Issue #10. Branch `grokbot-3/hunt-hold`. PR base is `main`. PR #75 (T-0013) merged while this was in progress (`2761776`), and main then also took T-0012 (`7bee6af`). The hold commit was replayed onto that main, so the diff is only Hunting II. Not merged. Not self-approved on GitHub.

## What was built
On a handling capture the wolf runs wolf|hare rows pin, bite, hold. The bite row squeals once (`hare-squeak` only; the old caught path still schedules a chew and is not used here). The hare stays in the world, limp, with its nape on an upper canine. Keyboard X eats: tissue mass goes through `dietOf(WOLF_NEEDS).meal`, gut contents are a carcass delta. Keyboard B releases a friend bond, `exp(-(now-at)/180)`, and that hare does not flee that wolf while the strength is at or above `exp(-1)`. NPC wolves still delete and eat. Worlds without `handling` (including `tools/hunt-sim.ts`) still emit `caught`.

## Done
- `src/core/huntHold.ts`, verb on `transactions.ts`, sim `handling` / `releasePrey` / `consumePrey`, hare carry, wolf jaw and fore-paw hold, bindings, squeal, `context.bonds`, system-map.
- Skill `notes/skills/hunt-pin-carry.md`. Tests in `tests/hunt.test.ts`.
- `npx tsc --noEmit` exit 0. On the replayed base, `npm test` 714 tests, 700 pass, 0 fail, 14 todo. The complete event records the earlier 707/693 run, from before #75 and #74 were on this branch's base.

## Next
Another agent reviews the PR. Do not merge it from this branch.

## Needs from another agent
None for the gate below. A pixel recording of the carry was not made: this run did not drive the WebGL scene through a leap. The frame gate uses the calibrated geometric substitute (rule 11), the same kind of check T-0013 used. A reviewer who can record the game can still drop frames at `tasks/evidence/T-0014/` (wolf heading 0, hare hip 0.40 m ahead, paws on the scapulae, body hanging from the canine). That recording is extra. It is not a blocker.

## How to verify
- `npx tsx --test tests/hunt.test.ts`
- `npx tsc --noEmit` and `npm test`
- In game, after a leap contact: X eats the held hare, B releases it. Q / RB still locks (T-0013). Eat and release can be rebound on the Controls screen.

## Number table

| Figure | Game | Real source | Pass |
| --- | --- | --- | --- |
| Friendship | 180 play seconds | Matthew 2026-10-21, about 3 min. Whishaw, Flannigan & Barnsley 1979, Dev Psychobiol 12:595: tonic immobility lasts seconds to several minutes | yes |
| Floor | exp(-1), still live at exactly t = tau | one e-folding; the next instant resets | yes |
| Gut contents | 0.096 * mass^1.03 kg (about 0.15 kg at 1.5 kg, test window 0.1–0.2) | Belovsky 1984, Theor Popul Biol 25:235, n=6, r^2=0.99. Mendel & Mendel 1909, J Exp Med 11:36, stomach+cecum near 10% of body weight | yes, unit flagged |
| Energy | `dietOf(WOLF_NEEDS).meal` on tissue = mass − gut, inside 30–80 | existing hare row: 6000 kJ/kg, assimilation 0.9, FMR 15034 kJ/day | yes |
| Neck | diameter 0.046 m (`HARE_SKIN.neck[0].ry` 0.023) | the rig's neck ring | yes |
| Body length | 0.45 m | ADW Lepus americanus head-body 361–479 mm (total 413–518 minus tail 39–52) | yes |
| Paw reach | 0.6229 m | IK chord of `WOLF_LEGS` upper+lower plus the foot | yes |
| Pin gap | 0.4772 m, inside the reach, score 1 | scapula vs glenoid on that layout | yes |
| Jaw | 15.06° on a 0.175 m jaw | `gapeDegrees` at the wolf mass is 44.89° (Gracis et al. 2016 via `DOG_GAPE_MM`) | yes |
| Squeal | once, on the bite edge | ADW (loud squealing when captured); Minnesota DNR (loud screams); Macaulay Library ML55380 | yes |
| Paws and jaws | forepaws then the mouth, carried by the nape | Mech 2014, Canadian Field-Naturalist 128(2), doi:10.22621/cfn.v128i2.1584 | flagged: the animal was an Arctic hare leveret, applied here to an adult snowshoe hare |

## Frame gate
Tool: `tests/hunt.test.ts` (`pinLayout`, `carryError`, `poseScore`, `decayScore`). No pixel frames.

- Pin metric: `1 - min(1, max(0, glenoid-to-scapula − pawReach) / 0.45)`. Known match: the reaching pin scores **1.000000** (gap 0.4772 m, reach 0.6229 m). Known mismatch: paws left on the ground under the shoulders, error 0.3350 m, score **0.255638** (under 0.95).
- Carry metric: `1 - min(1, nape-to-canine / 0.45)`. Known match: the pitched hang scores **1.000000**. Known mismatch: pitch 0 and the hare left on the ground, error 0.7114 m, score **0.000000** (under 0.95).
- Decay metric: `1 - min(1, |measured − exp(−t/tau)|)`. Known match: `friendStrength` at half tau scores **1.000000**. Known mismatch: a linear fade `1 − t/tau` at half tau scores **0.893469** (under 0.95).

## Leftovers
- A save/reload does not keep the friendship. Hare ids are new when a hare respawns, so the bond key will not match.
- Keyboard A is not the default eat key. It is steer. Pad B is Close, which is live during play, so release defaults to keyboard B. Both are rebindable.
- The +40 stamina the old catch notice added is not part of the diet meal and is not applied on eat.
- `?loco=1` does not drive the hold pose. That fork still takes the 7th `animate` argument as a gait pose.
- Gut unit: if Belovsky 1984 fitted grams rather than kilograms, 0.096 * W^1.03 is high. The ~10% check is why it is read as kilograms.
