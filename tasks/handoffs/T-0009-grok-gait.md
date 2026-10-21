# Handoff: T-0009 Gait Builder pickup — lagomorph rig on the locomotion controller (grok-gait, 2026-10-21 12:20 PT)
Owner agent: grok-gait (picking up grok's rule-8 "Needs from another agent – Gait Builder" item in T-0009-grok.md).
Branch `grok-gait/T-0009-hare-skeleton` off `grok/rabbit-clover` bf42625, worktree `C:\dev\boreal-grok-hare`.
Task owner is grok (T-0009 stays grok's; this file is only the Gait Builder part). Not submitted.

## Status (rule 9: kept current)
- [x] Read: T-0009-grok.md (Needs a-e), tasks/RULES.md, SKELETON-RULES.md, bound.ts, HARE_BODY / HARE_AGENT.gait, gaits.ts GAIT_TABLE.
- [x] Ownership: GAIT_TABLE is Codex's (gaits.ts), bound.ts / hare.ts / species.ts are grok's; neither handoff clears me to
  edit them, so they are untouched and the changes are contract notes below.
- [x] Code: new data-driven files (no species words) src/animals/locomotion/bodyPlan.ts, bounding.ts, boundScore.ts;
  tests/bound.test.ts; tools/bound-lab.html/.ts, bound-score.ts, bound-plans.ts.
- [ ] Captures under the bench lock at 0.25x and 1x, frame answers, score in this file.
- [ ] Final note appended to T-0009-grok.md.
Exact next step: captures (tools/bench-lock.mjs, lab served from this worktree on a free port).
