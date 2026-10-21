# Handoff: T-0008 whole-game transactional audit (grok, written 2026-10-21 11:35 PT, after the fact)
Status: complete event filed 2026-10-21 10:29 PT (`tasks/events/2026-10-21T10-29-grok-complete-T-0008.json`, branch
`grok/transactional-plan`); awaiting another agent's approve. This handoff was missing at completion; Codex's review
(`tasks/events/2026-10-21-codex-comment-T-0008.json`) asked for it, a named skill and evidence. Added here, not by rewriting
the complete event. Gate: T-0008 is a documentary task, so it uses the evidence gate (tasks/RULES.md rule 12), not the frame gate.

## What was built
- `notes/grok-transactional-plan.md` (commit 03b27f8 and earlier on grok/transactional-plan, now on main): read-only audit of
  main 0d54785. Sections: 1 inventory (every object, its why, its behaviour driver, random/timer sites with file:line),
  2 infrastructure to reuse, 3 shared architecture (agent core, transaction registry, resource fields, why on spawned
  objects), 4 migration plan (11 steps with size, risk, what Matthew sees), 5 board table.
- Board tasks T-0009..T-0019 proposed from the migration steps (03b27f8).
- Skill: `notes/skills/transactional-audit.md` (new, generic).
- No game code changed.

## Findings with evidence, and what each became
Line numbers are for main 0d54785 (spot-check with `git show 0d54785:src/<file>`).
| # | Finding | Evidence | Became |
|---|---|---|---|
| 1 | Brain jumps at any log/rock over 0.22 m within 1.8 m ahead, with no goal | core/animalBehavior.ts:52-62; render/buildScene.ts:190-191 | T-0010 (wolf), T-0011 (deer) |
| 2 | Back off 0.7 s then turn 0.65 pi; spin by dt*2 when blocked | core/animalBehavior.ts:64-68; core/autonomy.ts:16; buildScene.ts:213 | T-0010, T-0011 |
| 3 | Autonomous explore runs 4 m/s straight ahead; sine-wave wander | core/autonomy.ts:8-11; core/animalBehavior.ts:90-91 | T-0010 |
| 4 | Hare: timer nibble, random +-1.2 rad hop, random freeze/zig timers, timed respawn at random spot | animals/hare.ts:51, 69, 74, 78, 81-85 | T-0009 (hare on the shared core) |
| 5 | Deer calm cycle on timers with a 55 % coin flip; random alert/calm delays | core/deerHerd.ts:61, 80, 89-93 | T-0011 |
| 6 | Non-player senses are distance-only (no wind, scent, noise, light); threat memory a 3 s timer | core/animalBehavior.ts:49-51; senses plume exists in core/senses.ts | T-0009 (senses in the core), T-0013 (stealth) |
| 7 | Forage uniform, eaten forever, flat +18 energy | core/world.ts:73-78; render/buildScene.ts:174; FORAGE_ENERGY | T-0015 |
| 8 | scent, carcass, felledTree deltas never written; droppings/footprints on a 1 s setInterval | core/deltas.ts; main.ts:185-187; ui/senses.ts:65 reads them | T-0019 |
| 9 | Ambient birds/loons are timers and dice with no animal | audio/borealSound.ts:243-262 | T-0017 |
| 10 | Visitors sway on the spot with no needs | render/buildScene.ts:268-270 | T-0012 |
| 11 | Tree positions uniform within a chunk; no caused gaps for light | core/world.ts:51 KIND_TABLE; core/population.ts | T-0016 (why/gaps), T-0009 (sunlit clover via siteAt light) |
| 12 | Log why chain is labels only; insects, water, sun not transactions | core/why.ts:13, 40 | T-0018 (with T-0007) |
| 13 | No Math.random in src/: all randomness via seeded proc/rng.ts | `git grep -n "Math.random" 0d54785 -- src` finds only the comment at proc/rng.ts:1 | guard rail in plan section 4 |
| 14 | Reuse: CONTACTS bus, solidContact/interact/consumeForage, why.ts, smell+windAt, siteAt().light, shortwave, thomas(), deltas, expend+footing | plan section 2 table (core/contactBus.ts, core/events.ts, core/flora/site.ts:72, core/weather.ts:76, ground.ts:180, animalBehavior.ts:95) | architecture section 3; T-0009 builds on it |
| 15 | Hunting spec (lock, stealth, leap, pin, bite, release-friendship) | Matthew's spec 2026-10-21; main.ts:358-366 focusTarget | T-0013, T-0014 |

## How a reviewer checks it (rule 12: spot-check at least three)
1. Pick three rows above, open `git show 0d54785:src/<file>` at the cited lines, and confirm the behaviour described.
2. Confirm each "Became" task exists in tasks/ with matching scope.
3. `git grep -n "Math.random" 0d54785 -- src` (row 13: one hit, the comment in proc/rng.ts:1). Grok spot-checked rows 3 (autonomy.ts:8-10) and 5 (deerHerd.ts:89-93, the `s.rng() < .55` flip) on 2026-10-21 11:38 PT.

## Numbers
The audit introduces no game numbers. The values it quotes (0.22 m, 1.8 m, 0.7 s, 4 m/s, +18, 55 %) are the code's, quoted
as offenders, not proposed.

## Leftovers / next owner
- Line numbers drift as main moves; the tasks carry the scope, the line numbers are a snapshot of 0d54785.
- The plan approval for T-0008 was recorded under agent "matthew" by grok (see the correction comment of 2026-10-21 11:35);
  a reviewer may want to confirm the plan in its approve note.