---
id: T-0006
title: Solid contact - a shared contact bus (rising edge) and a solidContact transaction, plus a small "why" on every object; first case a log resting on the earth
author: grok
scratch: true
research: false
skill: solid-contact-why
---
# T-0006 Solid contact and the why behind every object

**Status: proposed by grok (2026-10-19 06:58 PT). Not claimed. Needs another agent's `approve-plan`.** Plan only: no game code
on this branch. Branch `grok/T-0006-solid-contact`, worktree `C:\dev\boreal-grok-contact`, off main 7d71892. Matthew merges.

## What Matthew asked (2026-10-19, omen)
- "transactions: they should be triggered whenever an object comes into contact with another object."
- "so the log is in contact with the earth. this triggers a transaction: solid object against solid object."
- "there should be a why behind every object's presence."

So: one shared signal for "two solid things are touching", one pure transaction that records it, and a small tagged reason
(`why`) on each object that says why it is where it is. The log on the earth is the first case. Contact is one of the ways a
`why` is written or updated; generation is the other.

## What exists today (main 7d71892, read-only check)
- **Transactions:** `src/core/events.ts`. `interact(context, player, target, action)` and `consumeForage(context, animal,
  plant)` are pure: they clone `EventContext`, update `records[key]` (`RecordEntry`) and return the next context; the caller
  persists it. `parseContext` validates every record field on load. Rule already in the code: autonomous actions must never
  promote a transient entity into the save (`consumeForage`, `playerRemembered`).
- **Objects:** `core/world.ts` `Entity { key, kind, seed, generatorVersion, x, z, rotation, scale, energy?, rollX?, rollZ? }`,
  generated per chunk (`KIND_TABLE`: 11 % logs). Only remembered objects are saved, as `RecordEntry` in `context.records`.
- **Per-kind reason already in data:** `core/catalog.ts` `purpose` (log: "Forest floor debris"). That is the kind-level why;
  the per-object why is new.
- **Generation trace:** `proc/trace.ts` `f()`/`choose()` already explain *how* each generated value came about (inspector).
  The why is not a second trace: it is one short tag per object, readable without running a trace.
- **Contacts that are noticed today, each on its own:** `core/rocks.ts` `pushContact` (snout on a small rock, used by the
  `move` transaction); `render/rocks.ts` `seatRock` (rock on ground, render only); `animals/locomotion/controller.ts` paw
  touchdowns (rising edge, listener with unsubscribe, also used by `audio/borealSound.ts`); `proc/physics.ts` `step(..., ground)`
  and `collide` (1-D, no events). There is no shared contact signal.
- **Logs:** placed at `render/buildScene.ts:111` (`heightAt` at the centre only). **T-0005** (grok-globe, approved, claimed,
  `grok-globe/log-grounding-bark`) adds `seatLog` (pitch, roll, seeded 20-35 % sink). Disposed with their chunk
  (`buildScene.ts:147-149`).
- **Pattern to copy for the bus:** `world/globe/originBus.ts` (`createOriginBus`, subscribe returns unsubscribe, one module
  singleton).

## Design (minimal, shared)
### 1. `src/core/contactBus.ts` (new, pure TypeScript, no three.js, no DOM)
```ts
export type Solid = string;                       // an entity key, or 'ground' for the earth
export interface Contact { a: Solid; b: Solid; at: [number, number, number]; normal: [number, number, number]; kind: 'solid-solid'; source: string }
export function createContactBus(): {
  begin(c: Contact): boolean;                    // true only on the rising edge (pair not already touching)
  end(a: Solid, b: Solid): boolean;              // true only on the falling edge
  onContact(fn: (c: Contact) => void): () => void;   // rising edges only; returns unsubscribe
  onSeparate(fn: (a: Solid, b: Solid) => void): () => void;
  touching(a: Solid, b?: Solid): Contact[];      // current pairs, so a late subscriber still sees contacts made at spawn
};
export const CONTACTS = createContactBus();
```
- Pair key is order-free (`a|b` sorted), so log-ground and ground-log are one pair.
- **Rising edge only** to listeners. Continuous contact is the stored pair (`touching`), not a per-frame event, so a log
  resting for an hour costs nothing per frame.
- Static contacts count: a log that is already resting on the ground when its chunk is built fires one `begin` then. When
  the chunk is disposed, `end` fires; when it is built again, `begin` fires again. That is a render-lifetime edge, not a
  world event, so listeners must treat it as "became known", and the transaction below is idempotent.

### 2. The why: `src/core/why.ts` (new, small)
```ts
export type WhyTag = 'resting' | 'embedded' | 'grew' | 'moved' | 'born' | 'wandered';
export interface Why { tag: WhyTag; on?: Solid; by?: string }   // e.g. { tag: 'resting', on: 'ground' }, { tag: 'moved', by: 'player' }
export function whyOf(e: Entity, record?: RecordEntry): Why;      // the record's why if it has one, else the generated default
export function whyText(w: Why): string;                          // "resting on the ground", "pushed by the wolf"
```
- Defaults are derived, not stored: log `resting on ground`, rock `embedded in ground`, spruce/plant/forage `grew here`,
  deer/person `wandered here`. Generated objects stay out of the save, exactly as today.
- A record stores `why` only when a transaction changes it (`RecordEntry.why?: Why`). Optional field: old saves still load,
  `schemaVersion` stays 1, `parseContext` validates the tag and the strings.
- One tag, two optional strings. Not a history and not a simulation.

### 3. The transaction: `solidContact` in `src/core/events.ts`
```ts
/** Pure transaction: the caller persists the complete next context before exposing it. */
export function solidContact(context: EventContext, c: { a: Entity | 'ground'; b: Entity | 'ground'; at: Vec3; normal: Vec3 }): EventContext;
```
- If neither side is a remembered entity (`context.records[key]` absent), it returns `context` unchanged (same object): a
  generated log meeting the earth does not write the save. Its why is already the derived default (`resting on ground`).
- If a side is remembered and its why differs from what this contact means (for example a moved rock that now rests), it
  returns a cloned context with that record's `why` updated. Idempotent: the same contact twice gives the same context.
- It never moves, sinks or rotates anything. Seating stays in the placement code (T-0005 for logs, `seatRock` for rocks).
- The existing `move` transaction (rock push) also sets `why = { tag: 'moved', by: 'player' }` on the pushed rock, so the
  why has a second writer on day one. No other change to `interact`.

### 4. First emitter: log on the earth
- At chunk build, after the log is placed, `buildScene` calls `CONTACTS.begin({ a: entity.key, b: 'ground', at, normal,
  kind: 'solid-solid', source: 'log-seat' })`; at chunk disposal it calls `CONTACTS.end(entity.key, 'ground')`.
- `at` and `normal` come from the placement itself. With T-0005 merged: from `seatLog`'s result (the seated centre and the
  ground normal it already samples). Before T-0005: the centre `heightAt` point and a normal from two `heightAt`
  differences. No extra ground sampling beyond that.
- One listener in `main.ts` (beside the existing transaction calls) runs `solidContact` and persists the result only when it
  returned a new context.

## Contract for T-0005 (grok-globe)
- T-0005 keeps sole ownership of how a log is seated (pitch, roll, sink). T-0006 does not sink, tilt or move logs: no double
  sinking.
- The one thing T-0006 asks of T-0005: `seatLog` returns (or exposes) `{ at: Vec3, normal: Vec3 }` for the seated log, or
  T-0006 reads them back from the transform it bakes. If T-0005 merges first, T-0006 calls that; if T-0006 merges first,
  T-0005 swaps the centre-point values for its own at the single `CONTACTS.begin` call. Either way it is one call site.
- T-0005 does not subscribe to the bus. Later consumers (dust, scuff marks, sound, flora around logs) subscribe; they do not
  re-detect contact.

## Objectives
- [ ] Handoff `tasks/handoffs/T-0006-<claimant>.md` and a dated entry in the claimant's `notes/<agent>.md`, committed before any code, with the T-0005 contract above restated and a one-line note to Claude and Codex that paw touchdowns could later feed the same bus (their call, not done here). Check: both files precede the first code commit.
- [ ] Tests first, `tests/contact.test.ts`, failing on main: `begin` returns true once per pair and false while touching; order-free pair; `end` then `begin` fires again; `touching` lists a contact made before a late subscriber; unsubscribe stops calls. Check: `npm test` (red before the next step, recorded in the handoff).
- [ ] `src/core/contactBus.ts` as designed (copying `originBus.ts`' subscribe/unsubscribe shape), `CONTACTS` singleton, no three.js or DOM imports. Check: the bus tests pass; `rg "three|document" src/core/contactBus.ts` is empty.
- [ ] `src/core/why.ts`: `Why`, `WhyTag`, `whyOf` with the per-kind defaults, `whyText`. Tests: every `Kind` in `catalog` has a default; a record's why wins over the default. Check: `npm test`.
- [ ] `solidContact` in `events.ts` plus optional `RecordEntry.why`, validated in `parseContext`. Tests: returns the same object for unremembered entities; updates only `why` for a remembered one; idempotent; never changes x, z, rotation, roll or scale; an old save without `why` still parses and a bad tag is rejected. Check: `npm test`.
- [ ] Rock push writes the why: the `move` branch of `interact` sets `why = { tag: 'moved', by: 'player' }`. Test: after one push, `whyOf` reads "moved by the player". Check: `npm test`; the existing push tests unchanged and green.
- [ ] First emitter: log on the earth at chunk build and the matching `end` at chunk disposal in `render/buildScene.ts`, using T-0005's seated values if merged (otherwise the centre point and a two-sample normal), and one listener in `main.ts` that runs `solidContact` and persists only on a new context. Check: with `?contacts=1` the console prints one `begin` per log in a fresh chunk and none per frame; walking away and back prints `end` then `begin`; the save file does not grow from logs alone.
- [ ] Why readout: the existing inspector (or a `?contacts=1` hover line if the inspector has no slot) shows `whyText` for the picked object, e.g. "Fallen wood - resting on the ground". Check: one screenshot of a log and one of a pushed rock.
- [ ] Budget and checks: no per-frame work when nothing begins or ends (no allocation in the frame loop; a bench of 1000 log `begin` calls at chunk build costs at most 0.01 ms per log); program and draw counts unchanged (no render change); `tsc --noEmit`, `npm test`, `npm run build` green; smoke-tiers on the branch with no new errors; a playable link for Matthew from the worktree's own port.

## Scope
- **Files:** new `src/core/contactBus.ts`, new `src/core/why.ts`, `src/core/events.ts` (one function, one optional field, the
  `move` why, `parseContext`), `render/buildScene.ts` (the begin/end calls only), `main.ts` (one listener), new tests,
  `tasks/`, notes.
- **Not touched:** T-0005's seating and bark code, `proc/physics.ts` (no dynamic collision solver here), Claude's animal files,
  Codex's wolf movement, `render/rocks.ts` (`seatRock` as an emitter is a follow-up), surface bands (visual only, separate).

## Risks
- **Save growth:** if `solidContact` ever wrote generated objects, every visited log would enter the save. Guarded by the
  "unchanged context for unremembered entities" test.
- **Chunk churn reads as world events:** `begin`/`end` follow chunk build and disposal. Listeners must not treat them as
  "the log just fell". The `Contact.source` field says where it came from; the docs say this plainly.
- **Merge order with T-0005:** both touch the log placement at `buildScene.ts:111`; one call site, small rebase either way.
- **Why sprawl:** the tag list is closed and short; adding a tag is a reviewed change, not free text.
- **Ownership:** `buildScene.ts` and `main.ts` are shared; the claimant keeps edits to the two calls and the listener.

## Open questions for Matthew (do not block the plan)
1. Should a solid-solid contact also drive effects later (a thud, dust, a scuff or flattened plants under a log), or only
   record the transaction and the why for now? The bus makes those later effects one subscriber each.
2. Rising edge only (this plan), or also a continuous "still touching" tick for things like a log slowly sinking or rotting
   over days?
3. Should animals' paws on the ground count as solid-solid too, or stay as the separate touchdown signal they are today?

## How a reviewer checks it
1. `npm test`: the contact, why and transaction tests pass; the save tests are unchanged.
2. Open the branch with `?contacts=1`, look at the console near the start: one begin per log, nothing per frame.
3. Inspect a log (why: resting on the ground) and push a small rock (why: moved by the player).
## Design update from Matthew (2026-10-19 06:59 PT, after approval): the why is a causal chain
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
