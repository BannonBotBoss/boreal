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

## Pieces
- [x] claim event, this handoff, notes/grok.md (before any code)
- [x] why chain extended per Matthew 07:03 (leafed, weathered, weakened, failed)
- [ ] tests first: tests/contact.test.ts (red before the code)
- [ ] src/core/contactBus.ts, src/core/why.ts
- [ ] solidContact + optional RecordEntry.why + parseContext + move why in events.ts
- [ ] buildScene log emitter (begin at chunk add, end at dispose) + main.ts listener + ?contacts=1 + inspector why
- [ ] bench, tsc, npm test, build, smoke

## How to check
`npx tsc --noEmit`, `npm test`, `npm run build`; `npx tsx tools/bench-contacts.ts`; open the worktree's own dev server with
`?contacts=1` and watch the console (one begin per log in a fresh chunk, none per frame).

## Log
- 07:00 claimed; handoff and notes first. Why reshaped as a causal chain per Matthew (06:59) before any code.
