# Skill: a rising-edge contact and a why chain

Use when two solid things touching should cause one shared transaction, and every object needs a short reason it is where it is. The first case is a generated log resting on the earth.

## Steps
1. Search before adding a bus. `src/world/globe/originBus.ts` is the subscribe shape (subscribe returns unsubscribe, one module singleton). `src/core/events.ts` `interact` is the pure-transaction shape: clone the context, return the next one, let the caller persist it.
2. Put the bus in `src/core/contactBus.ts`. No three.js and no DOM. Pair keys are order-free. `begin` is true only on the rising edge, `end` only on the falling edge. `touching()` keeps the current pairs so a late subscriber still sees a contact made at spawn. Listeners must read `Contact.source`: a chunk build/dispose edge means "became known", not "just fell".
3. Put the why in `src/core/why.ts` as an ordered list of closed steps (`WhyTag`), not free text. Generated objects get a derived chain from their kind and are not stored. `WHY_MAX` caps a stored chain. Ongoing steps (`ONGOING`) follow the anchor, so a repeat contact against an anchor that already says the same thing is a no-op.
4. Add one pure function, `solidContact`, in `src/core/events.ts`. If neither side is already in `context.records`, return the same object. If a remembered side's anchor changes, clone and write only `why`. Never move, sink or rotate. Validate the optional `RecordEntry.why` in `parseContext` and reject a bad tag.
5. Emit from the placement that already knows the contact. Logs: one call, `logContact(entity, y, logSeat)` in `render/buildScene.ts`, `CONTACTS.begin` when the chunk is added and `CONTACTS.end` when it is disposed. Do not seat the log here. A second writer (the rock `move` branch) appends `{ step: 'moved', by: 'player' }` through `withTip`, once.
6. One listener persists `solidContact` only when it returns a new context. Skip the lookup when neither side is remembered, so a generated log never enters the save.
7. Show `whyText` / `nowText` in the existing inspector. Do not add a second panel.

## Checks that prove it worked
- `tests/contact.test.ts`: one begin per pair, order-free, end then begin, late `touching()`, unsubscribe, derived chain per kind, record chain wins, `solidContact` returns the same object for a generated entity, updates only `why`, idempotent, old saves still parse, a bad tag is rejected.
- `npx tsx tools/bench-contacts.ts`: 1000 `begin` calls plus `solidContact` stay under 0.01 ms per log.
- `npx tsx tasks/evidence/T-0006/measure.mjs`: mean position score at least 0.95. The scorer in `tools/contact-gate.ts` gives 1 to a contact on the ground and 0 to the same point lifted 1 m.
- `?contacts=1`: one `[contacts] begin` per log when the chunk appears, and none while the view is idle. `boreal.events.v1` stays empty until something is remembered.

## Mistakes to avoid
- Writing a generated object into the save because it touched the ground. That grows the save with every visited log.
- Treating a chunk rebuild as "the log just fell". The transaction has to be idempotent, and `source` has to say `chunk-build`.
- Seating the log in the contact code. Pitch, roll and sink belong to `logSeat` / `seatLog`.
- A per-frame "still touching" event. The stored pair is the continuous contact. Paw touchdowns stay on `onTouchdown`; a gallop would flap the bus.
- A second why string beside the chain. One closed vocabulary, read back with `whyOf` (the record if a transaction wrote one, otherwise the kind default).
