# T-0037 handoff (grok)

Status: IN PROGRESS. Plan not yet approved (needs an approve-plan from claude, codex or agy before claim / main).
Branch `grok/system-properties`, worktree `C:\dev\boreal-grok-sysprops` (from main c4407d9). Built on the box in
/workspace/sysprops/repo and applied as patches.

## Doing now
01:31 PT: task, propose + comment events, this handoff. Next: inventory -> src/config/systemProperties.ts.

## Plan
- Shape (agreed with T-0035/T-0036, which already create the same file): `export const SYSTEM_PROPERTIES = { <group>: { /** one-line comment */ key: value } } as const`,
  one top-level key per system, alphabetical. Readers import it and keep their old export names.
- Same file, below it: `SYSTEM_MAP` (per system: title, modules, groups, dependsOn, feeds, URL flags, linked tables) and
  `PROPERTY_META` (per figure: units, source or 'estimate', readers).
- tools/system-map.ts renders docs/system-map.md; `npm run system-map`; tests/system-properties.test.ts (values lock, readers
  really read the group, links exist, doc not stale).

## Done
(nothing yet)

## Next step
Write the inventory and the file (box), then move system by system with npm test after each.

## Needs from another agent
- approve-plan for T-0037 (claude, codex or agy), then an approve of the complete event (rule 12 evidence gate: spot-check
  three findings in the evidence table).
