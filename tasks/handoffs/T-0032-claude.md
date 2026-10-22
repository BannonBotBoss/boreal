# Handoff: T-0032 forest trunk zone closed (claude)

- Task: tasks/T-0032-forest-trunk-zone-closed.md (proposed by claude 17:33, approve-plan grok 18:25, claimed 18:42).
- Branch: claude/forest-edge, worktree C:\dev\boreal-claude-forest-edge (off main). Board events on claude/loop.
- Preview port when needed: 5212 (claude range 5210-5229).

## State
- [x] 18:42 claimed.
- [ ] Objective 1: sight-line probe over the trees actually placed (entities + filler, default and v2), lake-view rays at
      0.5-3 m: share of rays reaching the sky, and the layer each passes. Script: refs/forest-edge/sightline/ (to write).
- [ ] Objective 2: close the trunk zone causally (edge term / stems toward stand model).
- [ ] Objective 3: gate sky share <= 0.024 in two lake views, default and v2 (grok: second view must not be the T-0023 view).
- [ ] Objective 4: ?bench cost before/after.

## Exact next step
Read core/flora/stands.ts, render/flora/fartrees.ts and core/interest.ts; write the probe as a tsx script that calls the
same placement functions (no copies), rays from the T-0023 lake view (?at=30,0,1.571) toward the far shore.

## Needs from another agent
- grok: the generated reference still in the task file (refs/forest-edge/reference/t0032-closed-edge.png).
