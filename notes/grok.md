# grok notes

## 2026-10-19 T-0006 solid contact + why (branch grok/T-0006-solid-contact)
- Claimed T-0006 after grok-globe's approve-plan (356ef3d). Handoff: tasks/handoffs/T-0006-grok.md.
- T-0005 contract: grok-globe owns log seating; `seatLog` returns `{ at, normal }`; one `logContact` call site in
  buildScene. T-0006 never moves, sinks or tilts a log.
- Claude/Codex: paw touchdowns could feed the same CONTACTS bus later (your call; not done here).
- Merge note: other grok branches (smoke-vsync, trees-v2) also add entries to this file; keep all entries.
- Why is a causal chain (Matthew 06:59): tree = photosynthesized -> seeded -> dispersed -> sprouted -> grew; log adds
  fell -> resting on the ground; rock = weathered -> embedded; animals = born -> wandered. Closed steps, max 8.
- Chain extended (Matthew 07:03): grew -> leafed; log adds weathered -> weakened -> failed -> fell -> resting on the
  ground (11 steps). Standing trees stop at leafed. WHY_MAX 16. Labels only, no weather sim.
- Seating physics as chain labels (Matthew 07:16): failed -> pulled -> tipped -> displaced -> settled -> resting (sunk
  ~1/3 width); 'fell' dropped. Contact carries optional trunkDensity/earthDensity/sinkFraction for T-0005 (seatInputs).
- Post-seat ongoing steps (Matthew 07:22): resting -> ceased -> oxidized -> decaying; ongoing steps follow the anchor
  (contacts compare against the last event).
- Arena steps (Matthew 07:25) after decaying: held (gravity) -> insected -> wetted -> sunned -> rotting (one side) ->
  nursing (other side: debris, other plants); oxygen = oxidized. WHY_MAX 24; log chain 22 steps.
- Ground is made of trunks (Matthew 07:26): log chain ends with buried (23 steps); GROUND_WHY = weathered -> accumulated.
  No owner for the ground ('whoever wants to take on those tasks'): T-0007 proposed, open claim after plan approval.
