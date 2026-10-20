# Handoff: T-0006 solid contact + why (grok, 2026-10-19 07:00 PT)
Requested by Matthew (2026-10-19, omen): "transactions ... triggered whenever an object comes into contact with another
object", "the log is in contact with the earth ... solid object against solid object", "there should be a why behind every
object's presence". Plan `tasks/T-0006-solid-contact.md` (9e98071), approved by grok-globe (356ef3d, on this tip).
Branch `grok/T-0006-solid-contact`, worktree `C:\dev\boreal-grok-contact`, off main 7d71892. Matthew merges.

## Contract with T-0005 (grok-globe, `grok-globe/log-grounding-bark`)
- T-0005 owns how a log is seated (pitch, roll, seeded 20-35 % sink). T-0006 never seats, sinks, tilts or moves a log.
- `seatLog` returns `{ at, normal }` for the seated log. There is ONE log call site in `render/buildScene.ts` (`logContact`).
  Until T-0005 merges it uses the centre `heightAt` point and a normal from two forward `heightAt` differences, marked
  `TODO(T-0005)`. Whichever branch lands second swaps that one call; no duplicate seating.
- T-0005 does not subscribe to the bus. Later consumers (dust, scuffs, sound, flora around logs) subscribe; they do not
  re-detect contact.

## Review nits honoured (grok-globe, 356ef3d)
1. `Contact.source` is honest: the log emitter says `'chunk-build:log'`, i.e. "became known at chunk build", never "fell".
   Docs on `contactBus.ts` say begin/end at chunk build/dispose are render-lifetime edges.
2. `solidContact` returns the same object for anything not already in `context.records`; generated logs never enter the save.
   The main.ts listener skips the entity lookup unless a side is already remembered.
3. Bench method stated: `tools/bench-contacts.ts`, N seeded `begin` calls in node (tsx), numbers below.
4. One shared buildScene call site with T-0005 (see above).

## Note for Claude and Codex
Paw touchdowns (`animals/locomotion/controller.ts`) could later feed the same `CONTACTS` bus as solid-solid contacts. Your
call, not done here; Matthew's question 3 is still open.

## Why shape: a causal chain (Matthew, 06:59 PT)
(Also appended to the plan file.)
### Design update from Matthew (2026-10-19 06:59 PT, after approval): the why is a causal chain
Matthew: the why is a short causal chain, not one tag. His tree example: photosynthesis (a chemical reaction) -> forms a
seed -> the seed disperses -> a plant sprouts from the ground -> grows into the tree.
- `Why` is an ordered list of closed steps, `WhyStep { step: WhyTag; on?: Solid; by?: string }`, at most 8 steps. Still
  no free text: `WhyTag` is a closed list and `on`/`by` are short identifiers.
- Closed steps: `photosynthesized`, `seeded`, `dispersed`, `sprouted`, `grew`, `fell`, `resting`, `weathered`,
  `embedded`, `moved`, `born`, `wandered`.
- Derived defaults (generated objects, never stored):
  - spruce, plant, forage: photosynthesized -> seeded -> dispersed -> sprouted -> grew
  - log: photosynthesized -> seeded -> dispersed -> sprouted -> grew -> fell -> resting on the ground
  - rock: weathered -> embedded in the ground
  - deer, person: born -> wandered
- Transactions write the tip: a solid contact sets the tip to `resting on <other>` (`embedded` for a rock); if the tip
  already says that, nothing changes (idempotent). The rock push appends `moved by player` (a second push does not add a
  second step). A record stores the chain only when a transaction changed it.
- No biology simulation: the chain is provenance structure plus per-kind defaults, deterministic from the kind.

### Update 2 (Matthew, 07:03 PT): the tree-to-log chain
After `grew` a tree leafs out; a fallen log carries on through the break. All closed steps, labels only (no weather sim):
- leafed (green leaves, canopy), weathered (rare weather strained the structure over time), weakened (a weak point built
  up), failed (it could not withstand its own mass), then fell, then resting on the ground.
- Derived chains now: spruce, plant, forage = photosynthesized -> seeded -> dispersed -> sprouted -> grew -> leafed (a
  standing tree stops before failed/fell); log = photosynthesized -> seeded -> dispersed -> sprouted -> grew -> leafed ->
  weathered -> weakened -> failed -> fell -> resting on the ground; rock = weathered -> embedded in the ground;
  deer, person = born -> wandered. WHY_MAX is 16 (the log default is 11 steps); over it, the first step and the newest
  ones are kept.

### Update 3 (Matthew, 07:16 PT): seating physics in the chain
After `failed` the log's chain continues with the seating physics, as labels: pulled (gravity) -> tipped -> displaced
(trunk density vs earth density; the earth yields) -> settled (forces equal) -> resting (flat, sunk ~1/3 of the trunk
width). `fell` is gone from the closed list (pulled + tipped say it). Log default (14 steps): photosynthesized -> seeded ->
dispersed -> sprouted -> grew -> leafed -> weathered -> weakened -> failed -> pulled -> tipped -> displaced the ground ->
settled -> resting on the ground. Standing trees still stop at leafed.
- The contact payload carries optional seating inputs for T-0005 to read: `trunkDensity`, `earthDensity` (kg/m3) and
  `sinkFraction` (~1/3). `logContact` fills trunkDensity from `density(COMPOSITIONS.log.body)` (~512 kg/m3) and the
  defaults `SEAT_DEFAULTS` (earth 1300 kg/m3 [verify], sink 1/3); `seatInputs(c)` applies defaults and bounds.
  solidContact ignores them (the why does not depend on them). T-0006 still never seats, sinks or tilts a log.

### Update 4 (Matthew, 07:22 PT): after resting, the log keeps changing
Once down, the log can no longer photosynthesize, oxidizes (transactions with other elements transform it) and slowly
decays into fallen trunk. Closed ONGOING steps: `ceased` -> `oxidized` -> `decaying`. Ongoing steps follow the anchor (the
last event step) rather than replacing it: a contact compares against the anchor, so a decaying log still reads as resting
on the ground and the same contact stays a no-op; a new event (moved) appends after them. To stay within WHY_MAX = 16
without touching the physics, `grew` and `leafed` are merged into one step ("grew and leafed out"; `leafed` left the list).
Standing trees still stop before failed (they end at grew). Final log chain (16 steps):
photosynthesis -> formed a seed -> seed dispersed -> sprouted from the ground -> grew and leafed out -> weathered over time
-> a weak point built up -> failed under its own mass -> pulled down by gravity -> tipped over -> displaced the ground
(the earth yields) -> settled (forces balanced) -> resting on the ground -> no longer photosynthesizing -> oxidizing
(reacting with other elements) -> decaying into fallen trunk over a long time.
Inspector "why now" for a log: "Fallen wood - resting on the ground, decaying into fallen trunk over a long time".

### Update 5 (Matthew, 07:25 PT): the fallen log is an arena of ongoing transactions
Insects, water, oxygen, sunlight and gravity (which keeps it in place); one side rotting, the other collecting debris and
letting other plants grow. Closed ONGOING steps after `decaying`: `held` (by gravity) -> `insected` -> `wetted` ->
`sunned` -> `rotting` (one side) -> `nursing` (the other side collects debris, permits other plants). Oxygen is already
`oxidized`, so there is no separate `aired`. WHY_MAX raised 16 -> 24 so all 22 log steps fit with nothing merged or
dropped (a stored chain stays well under 1 KB; generated logs are never stored anyway). Standing trees still end at grew.
Final log chain (22 steps):
photosynthesis -> formed a seed -> seed dispersed -> sprouted from the ground -> grew and leafed out -> weathered over time
-> a weak point built up -> failed under its own mass -> pulled down by gravity -> tipped over -> displaced the ground
(the earth yields) -> settled (forces balanced) -> resting on the ground -> no longer photosynthesizing -> oxidizing
(oxygen and other elements) -> decaying into fallen trunk over a long time -> held in place by gravity -> hosting insects
-> wetted by water -> warmed by sunlight -> one side rotting -> the other side collecting debris and growing other plants.
Inspector "why now": "Fallen wood - resting on the ground, the other side collecting debris and growing other plants".

### Update 6 (Matthew, 07:26-07:27 PT): the ground is made of tree trunks
The fall -> seat -> decay -> arena cycle repeats many times, so the forest floor is accumulated fallen wood.
- Why concept only (no terrain or flora change in T-0006): the log chain gains one last ongoing step, `buried` ("becoming
  forest floor, one more trunk cycle"), so it is 23 steps (WHY_MAX 24). The ground itself gets a derived chain,
  `GROUND_WHY` = weathered over time -> `accumulated` ("built up from many cycles of fallen trunks"), shown by the
  inspector on terrain. It is a provenance label, not a count or a simulation.
- Owner: Matthew, "whoever owns the ground is whoever wants to take on those tasks." No fixed owner. Follow-up proposed as
  **T-0007 forest floor as layered fallen wood** (`tasks/T-0007-forest-floor-trunks.md`, propose event by grok, open
  claim): any agent may claim it after another agent approves the plan.

### T-0005 wiring (07:4x PT): one call site, either merge order
- T-0005 (grok-globe/log-grounding-bark, seating 95211cc, tip ae2b03d) exports `logSeat(entity)` from render/geometry.ts:
  `{ a, pitch, roll, at, normal, settle: { trunkDensity, earthDensity, soil, depth, onRock } }`, memoised per entity.
- T-0006 moved the contact into pure `src/core/logContact.ts` (`logContact(e, y, seatOf?)`). buildScene detects the export
  at runtime: `const T0005_LOG_SEAT = (GEOMETRY as unknown as Record<string, unknown>)['logSeat'] as LogSeatFn | undefined`
  (namespace import, computed key: no tsc or bundler error when it is absent) and calls
  `logContact(entity, y, T0005_LOG_SEAT)` at the one call site. With logSeat: at/normal from the seat, trunkDensity /
  earthDensity from settle, sinkFraction = settle.depth, source `chunk-build:log-seat`. Without it (or if it throws or
  returns a malformed seat): the centre sample, source `chunk-build:log`. Nothing in T-0006 seats, sinks or tilts.
- Merge note: buildScene and geometry.ts do not overlap between the branches (T-0005 left buildScene untouched), so no
  rebase edit is needed in either order. If someone later prefers a static import, the exact call is
  `import { logSeat } from './geometry'` and `logContact(entity, y, logSeat)`.
- Not merged into T-0006: T-0005's bark, seating or near-shadows. Checked in a throwaway merge worktree (see Log).

## Pieces
- [x] claim event, this handoff, notes/grok.md (before any code)
- [x] why chain extended per Matthew 07:03 (leafed, weathered, weakened, failed)
- [x] tests first: tests/contact.test.ts (red before the code)
- [x] src/core/contactBus.ts, src/core/why.ts
- [x] solidContact + optional RecordEntry.why + parseContext + move why in events.ts
- [x] buildScene log emitter (begin at chunk add, end at dispose) + main.ts listener + ?contacts=1 + inspector why
- [x] bench, tsc, npm test, build, smoke

## How to check
`npx tsc --noEmit`, `npm test`, `npm run build`; `npx tsx tools/bench-contacts.ts`; open the worktree's own dev server with
`?contacts=1` and watch the console (one begin per log in a fresh chunk, none per frame).

## Log
- 07:00 claimed; handoff and notes first. Why reshaped as a causal chain per Matthew (06:59) before any code.
- 07:04 tests first, red (84119ab: contactBus/why missing). 07:06 core (349df35) and wiring (725642e).
- Checks: `npx tsc --noEmit` clean; `npm test` 277 pass, 0 fail; `npm run build` ok.
- Bench (`npx tsx tools/bench-contacts.ts`, node, best of 5, 774 real generated logs padded to N): N=1000 begin only
  0.15 us/log, begin + solidContact 0.55 us/log (budget 10 us: pass); N=10000 0.16 / 0.54 us/log. The pre-T-0005 ground
  read in logContact (2 extra heightAt) is 1.8-9.3 us/log, also under 10 us; seatLog's values replace it.
- Smoke-tiers on port 5193, GPU vsync off (grok/smoke-vsync's script run untracked, bench lock held): SMOKE PASS, Ultra 119,
  High 125, Medium 118, Low 141, Very low 149, Minimum 240 fps, no page errors.
- `?contacts=1` probe (headless Edge, vsync off): 44 begins at load (one per log, `chunk-build:log`), 0 begins/ends in 6 s
  idle (nothing per frame), 25 s running forward gave 7 ends and 1 begin, 0 edge-order violations; save
  `boreal.events.v1` stayed absent (0 bytes) throughout: generated logs never entered the save.
- Not done: inspector screenshots of a log and a pushed rock (the inspector rows are 'why now' and 'why chain').

## Open follow-ups
- T-0005 (grok-globe): swap `logContact(entity, y)` for `logContact(entity, y, seatLog(...))` at the one call site.
- A pushed rock never re-emits contact today (rocks are not emitters; seatRock as emitter is a follow-up).
- Every interaction bumps `revision`, which rebuilds all chunks, so all logs end+begin once per interaction (render
  lifetime, idempotent, but noisy under `?contacts=1`).
- Matthew's open questions 1-3 (effects, continuous ticks, paws) are still open.- 07:16 seating physics steps in the chain + optional seating inputs on the contact (Matthew); see Update 3.
- 07:22 ongoing post-seat steps (ceased, oxidized, decaying); grew+leafed merged to fit 16; see Update 4.
- 07:25 arena steps (held, insected, wetted, sunned, rotting, nursing); WHY_MAX 16 -> 24; see Update 5.
- 07:27 ground-of-trunks concept (Update 6): log adds `buried` (23 steps), GROUND_WHY in the inspector, T-0007 proposed with an open claim.
- 07:27 repaired the plan file and notes/grok.md: e357eff had cut both down to the newest update only; restored from 61e7f0d plus Updates 4-6.
