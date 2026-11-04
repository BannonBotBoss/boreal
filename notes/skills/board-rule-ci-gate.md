# Skill: turning a board rule into a CI gate

Use when a rule in tasks/RULES.md (or a rule an agent "saved to memory") must actually be enforced, so a break fails CI
instead of depending on an agent remembering it. First used for rule 19 (T-0124, gait evidence).

## Steps
1. Handoff first. Find the validator that already runs in CI: `tools/tasks.ts` (`ledger()`) is replayed by `tests/tasks.test.ts`,
   and `.github/workflows/ci.yml` runs `npm test` + `npx tsc --noEmit`. Extend it; do not write a second board tool.
2. Decide what the rule can see. The ledger sees task headers (`id`, `author`, `tags`, `credits`...) and event JSON. A rule that
   needs evidence must name event fields (e.g. `footage`, `side_by_side`, `sources`) and file paths that can be checked with
   `existsSync`. Things only written in handoff markdown cannot be counted reliably: make the rule require an event field.
3. Scope with an existing mechanism (the `tags:` header), not a new one.
4. Grandfather by date: check only events with `at` >= a constant cutoff, so append-only history (rule 10) stays as it is and
   main stays green.
5. Prefix every break with the rule number ("rule 19: ...") and add a dedicated test that asserts no such breaks on the live
   board. The general "every event follows RULES.md" test is a todo while legacy breaks exist, so breaks added only to
   `ledger().errors` would NOT fail CI.
6. Commit fixtures (tests/fixtures/<gate>/{good,bad}/tasks/...) and test both: the bad one must fail on each missing piece,
   the good one must replay with zero errors (give it a second open task so "the board is empty" does not fire).
7. Prove it bites: `npx tsx tools/tasks.ts tests/fixtures/<gate>/bad/tasks` (exit 1, lists the breaks); paste the output in the PR.

## Mistakes to avoid
- Relying on agent memory or a prose rule as "hardcoded". Only a failing check is enforcement.
- Putting the new breaks only into the todo'd legacy test.
- Resolving evidence paths against `process.cwd()`: resolve against the repo root of the tasks dir (`dirname(root)`), so fixtures work.
