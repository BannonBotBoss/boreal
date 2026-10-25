# T-0011 handoff (grokbot-3)

**Task:** T-0011 Deer on the shared agent core. Issue #7.
**Branch:** `grokbot-3/deer-agent-core` (off main).
**Agent:** grokbot-3. Not self-approved as author. Claim sits on agy's approve-plan (2026-10-21 11:45 PT). Matthew's 2026-10-24 17:10 PT chat asked to take an open issue; the approve of the finished work is a rule 16 relay, written after the tests, and it is not a second approve-plan.

## What this is

White-tailed deer leave `AnimalBrain.decide` and `deerHerd.ts` (rolled graze/scan/walk timers, a coin flip, a sine zig, a dice alert delay, an opening jump). They use the same `stepAgent` pipeline as the hare. The hare path is unchanged: every new branch is gated on `AgentSpecies.social`, which the hare row does not set.

A deer grazes while hungry, on a virtual browse contact (`deer` | `browse`). Head-down and head-up bouts come from the vigilance share (Lashley's feeding-time slope), hunger and relaxation. A wolf inside 30 m bolts on the step it is noticed. A mate's flee, alert, pause or snort is a percept. The delay is sound-travel time when the acoustic cue leads, plus attention time `attend / cue`. Calm-down is relaxation climbing back to `calmAt` after the cue is gone. No `rng` call on the social path.

## How to verify

- `npx tsc --noEmit` — exit 0 (2026-10-25).
- `npm test` — 692 tests, 678 pass, 0 fail, 14 todo. Deer cases are in `tests/agent.test.ts`. The live-trace case is in `tests/trace.test.ts`.
- `src/core/deerHerd.ts` is deleted. `buildScene.ts` does not call `shapeDeer` or `brain.decide`.

## Numbers

Filled in as the row landed. See the table below. Estimates are marked. Frame gate: not a pixel match until a capture exists; the numeric checks are the substitute.

| Value | Game number | Real figure + source | Resembles nature? |
|---|---|---|---|
| Flight initiation distance | 30 m | Lingle & Wilson 2001, Ethology 107:125. White-tails alerted under 30 m in seven stalking attacks, and at 125–200 m in three other attacks. The medians sit in a figure that was not numerically extracted. | yes, stalking band |
| Top flight speed | 15.6464 m/s (35 mph) | SUNY ESF "White-tailed Deer" natural-history page: up to 35 mph. Secondary source, not a timed trial. | estimate |
| Tired gallop | 2.78 * 70^0.116 m/s | Heglund & Taylor 1988, JEB 138:301, preferred-gallop allometry. Same formula the hare uses. | yes |
| Fresh intake | 7.8 g/min | Koerth & Stuth 1991, J Range Manage 44(6): stem-elongation mean IIR 7.8 g/min (new leaf 7.0, mature 9.2; range 2.6–16.6). Methods weighed fresh branches. | yes |
| Daily dry matter | 2.1 kg/day = 3% of 70 kg | MSU Extension / Prevention and Control of Wildlife Damage: 2–4% of live body weight; adult bucks in spring 2.0–2.9 kg air-dry/day. Midpoint 3% of the species row. | yes as a daily budget |
| Fresh per energy point | 60 g | (2100 g DM / 0.35) / 100 energy. The 0.35 dry-matter fraction is an estimate. Koerth did not report fresh-to-dry of the intake weighings. At 35% DM the measured fresh rate does not fill 2.1 kg DM in a short foraging window. The rate is not inflated. | estimate (the mapping) |
| Bite interval | 60/7.1 s | Yucatan white-tailed females 7.1 bites/min (scialert tasr.2006.105.112). Smaller subspecies. `biteG` = 7.8/7.1 g fresh so the sound interval matches the bite rate while the mass rate stays Koerth. | estimate (population mismatch) |
| Vigilance slope | +0.07 feeding share per extra deer, cap at group size 4 | Lashley et al. 2014, PLoS ONE 9:e90652. Females +7 percentage points of feeding time per extra deer, no further gain past group size 4. Table 1 group-size coefficient 0.321, odds ratio 1.378. | yes |
| Lone vigilance share | 0.36 | The figure-3 intercept is not in the text. 0.36 is chosen so three steps of 0.07 land at feeding share 0.85 (vigilance 0.15) at group size 4, inside 0–1. | estimate |
| Head-up bout | 3 s | No white-tailed head-up duration in the sources. Elk bouts in Fortin et al. 2004, Oikos 107:172, are "a few seconds". Lone calm feed bout is 3 * 0.64/0.36 s. Group of 4 is 17 s. | estimate |
| Sound speed | 343 m/s | Dry air near 20 °C (331.3 + 0.606*20). | yes |
| Attention time | 0.25 s | No deer reaction-time constant found. Minimum orient; a weaker cue takes `attend / cue`. | estimate |
| Snort range | 200 m | Atkeson, Marchinton & Miller 1988: the snort is the alarm call. No measured audibility. | estimate |
| Sight range | 80 m | Between Lingle's stalking alerts (under 30 m) and the open alerts (125–200 m). | estimate |
| Link distance | 60 m | A mate at 50 m is linked; a wolf at 70 m is below the calm notice threshold on motion sight. | estimate |
| Stamina | 45 s drain and recover, 6 s burst | Order of a few hundred metres of gallop and PCr recovery. Not a timed trial. | estimate |
| Acceleration | 6 m/s² | Reaches the ESF top speed in about 2.6 s. | estimate |

## Frame gate

Unmeasurable as a pixel match. Chrome is on this machine, and the deer rig is still dropped before the chunk commits (T-0047), so a screenshot would not show a body whose timing and position could be scored against a reference. That parenting bug is a separate task and was not changed here. The calibrated substitute, checked in `tests/agent.test.ts`:

- Group vigilance falls by 0.07 per extra mate through group size 4 and then holds (known match: the Lashley slope).
- `alarmDelay(90) - alarmDelay(40)` at the same heard cue equals `50/343`. With `heard` false the two distances are equal.
- Intake while biting is 7.8 g fresh per minute (Koerth & Stuth 1991).

No 95% pixel score is claimed.

## Left for later

- T-0015 forest browse depletion and regrowth. Deer graze a virtual `browse:ground` patch so the contact and the intake rate exist.
- T-0047 deer rigs parented to the chunk. Behaviour can be tested headlessly; the body still may not stay on screen.
- T-0010 wolf autonomy is a different PR. This branch does not import it.
- Absolute lone vigilance intercept, dry-matter fraction, snort range, attend time, sight and hearing ranges, stamina, acceleration and the ESF top speed are estimates, listed above.
