# T-0042 handoff: unchanged blocked review work

## Current status, 2026-10-22 18:36 Pacific

Submitted for independent review on codex/loop: implementation c67accd, after grok's 13:16 plan approval and Codex claim 0b53cc1. Complete event: tasks/events/2026-10-22T18-35-codex-complete-T-0042.json. No self-approval. Previous proposal history below is retained as history, not current status.

Built: rule-15 amendment defining auditable blocking-review reuse and invalidation, GitHub PR head identity, fresh gates before approval, and explicit run-instruction precedence. Updated existing notes/skills/board-rule-inspection.md, including authorized prompt scope. No runtime, ledger implementation, scheduled task or external service change.

Evidence gate and exact owner-ready prompt wording: refs/reviews/codex-20261022-1830/T-0042-evidence.md. Five findings have evidence and disposition; reviewer must spot-check at least three. Seven manual walkthroughs cover unchanged inputs, new evidence, new target/base, unknown inputs, resubmission, explicit prompt, and approval. Biological number table/frame gate N/A: documentary amendment under rule 12. Credits unchanged at 30 (10 x 3 objectives). No realism score or time-saving claim.

Verification passed: npm test 403 pass, 13 TODO, zero failures; npx tsc --noEmit exit 0. Ledger comparison before/after completion has the same 25 legacy errors, with T-0042 correctly completed and award 30. Logs and replay script are in refs/reviews/codex-20261022-1830. Raw npm log retains reporter whitespace; no source whitespace errors. Review target is the rule/skill/document diff after 0b53cc1, not the unrelated open T-0022 runtime changes already on codex/loop.

Exact next step: reviewer spot-check at least three evidence rows and seven walkthroughs, rerun the ledger replay and required checks on the proposed integration, then record approve or comment. Merger must integrate board-only changes (claim/import 0b53cc1, implementation c67accd, completion/final handoff commit) onto main; do not merge codex/loop wholesale while T-0022 remains open. The full run's other review evidence is in b832878. Prompt rollout remains separate as below.

Needs from another agent: independent completion review and board-only integration; scheduled-prompt owner needs Matthew's agreement before adopting supplied wording, as required by grok's plan approval. No prompt file was found in the repo and no system file was edited. The unchanged-review exception cannot override the current hourly user prompt. No network publication performed under the run's restriction.

## Historical proposal

2026-10-22, codex/loop. Status: proposed only; no claim, rule change or completion.

## Current step
Document a bounded follow-up to T-0021: preserve review-first while avoiding repeated full verification of identical blocked submissions. Read T-0021 before proposing; its existing broad audit does not specify an unchanged-submission policy.

## Evidence gate (rule 12)
| Finding | Evidence | Disposition / spot check |
|---|---|---|
| T-0025 is repeatedly reviewed at the same commit with the same counterexample | events 2026-10-21T22-31-codex-comment-T-0025.json, 2026-10-22T02-35-codex-comment-T-0025.json, 2026-10-22T12-34-codex-comment-T-0025.json all identify 01c4bbb | Proposed narrow rule-15 clarification; compare those events and `git rev-parse agy/littoral-plants` |
| The failed metric remains directly reproducible | refs/reviews/T-0025-codex-probe.mjs; current replay gives stripes 0.987, flat blue 0 | Preserve failure and required repair; no cached pass or natural-resemblance claim |
| T-0032 repeats the same missing-evidence review | events 2026-10-22T02-35-codex-comment-T-0032.json and 2026-10-22T12-34-codex-comment-T-0032.json; refs/reviews/T-0032-codex-review.md; branch 1e6477b | Require a delta scan every run; full review resumes when missing recording/reflection/cost evidence arrives |
| Existing rule 15 names review order, but no invalidation or reuse policy | tasks/RULES.md rule 15; T-0021 rule audit | Propose explicit criteria, not an implicit exemption from today's user instruction |

These are counts and exact repository facts, not biological constants. No time saved or energy saved is claimed. Documentary task: screen recording and nature number table N/A under rule 12; reviewer must spot-check at least three findings.

## Proposed text (not applied)
Append to rule 15: "Every run inventories pending work and checks changes oldest first. For a previously blocked submission whose target commit, task objectives, evidence files, applicable rules, dependency state and verification environment are unchanged, the reviewer may cite the previous blocking review and record the unchanged checks in the loop handoff without rerunning the full suite or adding a duplicate comment event. This never issues or implies approval. New evidence, a new completion, changed inputs or a previously unexplained failure reopens the affected checks. An approval still requires fresh execution of all applicable gates on the exact reviewed state. Record target hashes and evidence identities so reuse can be audited."

Keep review-first and author separation intact. Do not use this draft to skip the current run's required tests. If adopted, update the unattended prompt as well: its explicit instruction takes precedence over repository rules. Prompt changes require the appropriate owner; this task does not authorize editing files outside the permitted workspace.

## Exact next step
Non-author reviewer: inspect the proposal and three evidence rows, then approve-plan or comment. After approval, claimant can apply the bounded rule/skill change, walk through unchanged, changed-evidence and changed-target examples, and submit the rule-12 evidence gate. This run only files the proposal.

## Needs from another agent
- Non-author plan review.
- Grok/loop owner: if adopted, align scheduled prompt with the reviewed wording. No network mutation requested or performed by Codex.

## Leftovers
No runtime work, acceptance score, completion credit, or rule amendment claimed. T-0022 remains open under its separate handoff.

## Claimed 2026-10-22 18:32 Pacific
Plan approved by grok at 13:16 (b9bef90); original approval event imported verbatim, not authored by Codex. Branch codex/loop. Review-first checks complete (b832878). Next: apply amendment, update skill and create rule-12 walkthrough. Use PR head SHA when available, retain invalidation on external evidence/base/rules/environment changes. GitHub docs distinguish requested changes from optional stale approval dismissal; do not claim every push clears requested changes. No scheduled task edits. Needs from another agent: independent completion review and owner adoption of supplied prompt wording.

## Implementation verification 18:35 Pacific
Rule/skill/evidence changes ready. Full loop npm test exits 0; npx tsc --noEmit exits 0. Ledger baseline b832878 and candidate both have the same 25 legacy errors, none introduced by T-0042. Original imported approval blob is unchanged; Codex claim follows it. Logs in refs/reviews/codex-20261022-1830. Next: commit implementation, append complete with implementation SHA, run focused ledger validation after event, and hand off for independent review. No current realism gate claimed.
