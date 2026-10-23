# T-0042 evidence gate

Branch: codex/loop. Review baseline: b832878. Plan approval: original grok event in b9bef90, imported byte-for-byte; claim: 0b53cc1. Only rule/skill/task documentation changes; no runtime or ledger implementation changes.

## Findings checked

| Finding | Direct evidence checked this run | Disposition |
|---|---|---|
| T-0025 has repeated identical blocking reviews | Read 2026-10-21T22-31, 2026-10-22T02-35 and 12-34 codex comment events. Each names 01c4bbb and synthetic stripes scoring 0.987. Current full target: 01c4bbb145c12f5999d91b51eddb591a0988fbd7. Fresh probe output: littoral-probe.json, blue control 0 and stripe mismatch 0.987. | Rule 15 permits retaining a proven blocker when all relevant inputs are unchanged. No natural-resemblance pass. |
| T-0032 repeats missing evidence, not a newly failing implementation | Read 02-35 and 12-34 comments, number table, capture script and detailed T-0032-codex-review.md. Full target: 1e6477b26b2d81a38102d906c97729c404bbde72. No mp4/webm in its refs/forest-edge tree. Fresh twelve-frame replay in forest-gate.txt: trunk sky 0-0.0033. | Missing reflection integration, recording and cold-cache width cost remain blockers; amendment does not waive these. |
| Old rule 15 did not define reuse/invalidation | `git show b832878:tasks/RULES.md`, rule 15, versus this task's diff. Existing T-0021 is a broad audit; T-0042 adds only the bounded clarification. | Preserve every-run inventory, oldest-first order, non-author review and fresh gates for approval. |
| Scheduled prompt explicitly requires fresh checks | This run's user instructions, steps 0 and 7, plus T-0042's existing Verification section. No tracked scheduled prompt found by repository filename search. | Current run performed fresh tests. Provide owner-ready wording below; no system/prompt file changed. |
| Grok's plan approval requests GitHub-native review identity | 2026-10-22T13-16-grok-approve-plan-T-0042.json. GitHub docs checked 2026-10-22: [resolve reviews](https://docs.github.com/en/pull-requests/concepts/resolving-reviews), [required reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews). | Use PR head SHA and existing review/thread/status. Clarify that stale approval dismissal is conditional; a new push does not prove requested changes resolved. No separate cache. |

The GitHub sources describe reviews and settings, not this repository's live remote configuration. No remote review state was fetched or mutated. Local branch inventory is not a claim that remote PRs are unchanged.

## Evidence identities

Use `git ls-tree -r <target> -- <path>` to reproduce these identities:

| Target | Evidence path | Git blob |
|---|---|---|
| T-0025 | refs/water/littoral-audit/measure.mjs | acb240fef8db51ae9d8cdbd298cd806ea4a0e19d |
| T-0025 | refs/water/littoral-audit/littoral-close-0.png | 57de640f2bffad635de4831362647383d539670f |
| T-0025 | tasks/handoffs/T-0025-agy.md | a02ce933143a6f67127397fce35cd9a6597f6da1 |
| T-0032 | refs/forest-edge/gate/trunk-share.mjs | b7822b251b8109ca951dd4c5770869fa26a6354c |
| T-0032 | refs/forest-edge/gate/capture.mjs | 727eb1a7e6efe953a4bcff9d27a4d41eecd78693 |
| T-0032 | refs/forest-edge/gate/after2/b-v2-0.png | a40ccfa0c8cb20f4b7bfdd28b6b1f29418c049ce |

## Policy walkthrough (manual document verification)

These are hypothetical input changes evaluated against the amended text, not measured automation or a cached verdict for the current PRs.

| Case | Comparison | Required result under amendment | Checked |
|---|---|---|---|
| Unchanged blocked submission | Same full target/head and base, objectives, evidence blobs, rules, dependencies and relevant environment; no new completion/discussion | Cite prior blocker and comparison in handoff; no repeat full suite or duplicate event when run instructions permit | Yes: rule 15 first bullet requires all inputs; verdict stays blocked |
| New evidence, same head | Owner attaches a recording externally or posts corrected measurements in a PR thread | Reopen affected recording/metric checks despite unchanged head | Yes: second bullet explicitly includes discussion and evidence |
| New target | New head commit changes the scorer; or base changes integration behavior | Reopen affected checks; require fresh full gates before approval | Yes: second and third bullets |
| Unknown input | Remote PR state unavailable, dependencies unrecorded, or relevant environment unknown | Cannot assert unchanged; record limit and reopen affected checks | Yes: first/second bullets; no offline remote-freshness claim |
| New completion at same head | Owner resubmits without code changes | Review the new submission, retaining blockers unless actually resolved | Yes: explicit new-completion trigger |
| Explicit hourly prompt still requires tests | All inputs identical but this run's prompt has not been revised | Follow prompt and execute checks | Yes: third bullet; this run's branch logs |
| Approval requested | Previous result was blocking; repaired evidence now passes | Fresh gates, exact state, independent reviewer; no cached approval | Yes: third bullet and unchanged rule-15 opening |

## Numbers and frame gate

Rule 12 documentary task: no changed game appearance, biological constants or timing/position claims. Nature table and recording are N/A for this amendment. Existing review scores above are reproduced failure evidence, not new realism measurements. Credits remain 10 x 3 objectives = 30; no scratch/research multiplier changed. No performance/time-saving claim is made.

## Exact prompt wording for owner adoption

After independent task approval and owner authorization, append this to the scheduled prompt's review-first instructions, reconciling both step-0 copies and step 7:

> Every run still inventories pending work, oldest completed submission first, then plans. For a previously blocked submission, follow tasks/RULES.md rule 15: record the previous blocking review, full target SHA (PR head SHA and existing review/thread/status when a PR exists), base and evidence identities, and verify that objectives, evidence/discussion, rules, dependencies and relevant environment are unchanged. Only then may the prior blocker stand without another full suite or duplicate comment. New or unknown inputs, a new completion or a previously unexplained failure reopen affected checks. Approval always requires fresh applicable gates on the exact state and another agent's review. Never infer remote freshness from local refs.

This is a deliverable for the owner, not an applied prompt amendment. Grok's approval specifically reserves prompt changes for Matthew's agreement. The task's implementation scope is fulfilled by documenting this handoff; live scheduled-prompt rollout remains external.

## Reviewer reproduction

Spot-check at least three findings above; compare `git diff 0b53cc1 -- tasks/RULES.md notes/skills/board-rule-inspection.md`. Inspect all walkthrough rows. Review ledger-check.json from `npx tsx refs/reviews/codex-20261022-1830/check-board.mts`; it compares legacy errors with b832878 and verifies T-0042 ordering. Full loop tests and typecheck are recorded alongside this document after execution. No GitHub push, status write, PR creation, server or browser operation is part of this task.
