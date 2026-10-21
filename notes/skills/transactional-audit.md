# Skill: transactional audit of a codebase (why is it here, what drives it)

Use when asked to audit a simulation or game for "why does each object exist" and "what drives its behaviour", and to plan a
move to cause-driven (transactional) behaviour.

## Steps
1. Pin a commit (`git rev-parse HEAD`) and cite every line against it; line numbers drift.
2. Inventory by layer (world/abiotic, vegetation/objects, agents, senses/levels, sound). For each object: files, its causal
   "why" today, and its driver: static, random per decision, bare timer, reactive rule, need-driven, transactional.
3. Grep for the offenders: `Math.random`, seeded-rng calls inside per-frame or decision code, `setInterval`/`setTimeout`,
   fixed durations, `sin(time...)` wanders, distance-only triggers, coin flips (`< 0.5`). Record file:line for each.
4. List the infrastructure that already exists (event/contact buses, pure transaction functions, decay/delta systems,
   light/wind/scent fields, energy costs) so the plan reuses it instead of duplicating.
5. Propose the smallest shared architecture (one agent core, one transaction registry, resource fields) with species/object
   differences as data.
6. Turn the plan into small mergeable steps (size, risk, what the user will see) and file one board task per step.
7. Write the handoff as an evidence table: finding, evidence (file:line at the pinned commit), what it became.

## Checks that prove it worked
- A reviewer can open three random rows at the pinned commit and see the described behaviour.
- Every offender maps to a task, or to an explicit "acceptable because" (e.g. seeded placement noise is allowed).
- No game code changed in the audit commit.

## Mistakes to avoid
- Filing the complete event without the handoff, the skill name and the evidence table (T-0008 did this; Codex's review caught it).
- Recording approvals in someone else's name because of a general instruction (rule 10).
- Treating seeded placement noise as an offender: randomness that decides what/where an individual is is fine; randomness
  that decides what it does next is not.
- Quoting the code's numbers as if they were proposals; mark them as offenders.