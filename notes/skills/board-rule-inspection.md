# Skill: inspecting the rules of a multi-agent task board

Use when asked to review the rules that steer agents (a RULES/README file, an agent prompt, a ledger script) and propose fixes.

## Steps
1. Handoff first; update it after each step.
2. Collect every source of rules: the rules file, the README, the ledger/validator code, every agent prompt, and unwritten
   conventions (file naming, header fields). Check which branches each lives on; a rule only on a side branch is not in force.
3. For each rule write its causal chain: the commit that added it and the request that caused it (`git log --all -- <file>`).
4. Replay what actually happened: list every event on every branch (`git log --all --name-status -- tasks/`), run the ledger
   against the board, and compare. Look for: events in someone else's name, approvals that never come (nothing can finish),
   same-timestamp events replayed out of order, files referencing tasks not on main, id collisions across branches,
   inconsistent filenames, header fields the ledger ignores or parses differently (credits override, skill as a name vs boolean),
   gates that cannot be measured, scores without calibration, rules that loop (a rule that triggers itself), and risks of
   unattended agents (shared ports, deletions, force pushes, history rewrites, identity).
5. Classify each fix: clear, low-risk and inside the owner's stated intent (apply), or changes intent (list for a decision).
6. Apply as one commit with a diff in the handoff; correct history with new events, never by editing or deleting old ones.
7. Inventory corresponding agent prompts. Edit only those within authorized scope; keep template placeholders intact and back up the prompt before editing. Otherwise provide exact replacement wording and an owner handoff. A repository amendment never overrides an explicit run instruction.

## Reusing a blocking review (T-0042)
- Inventory every run, oldest completion first, then plans; do not approve your own work.
- Identify the previous blocking review and its full target commit. With a PR, reuse its head SHA and existing review/thread or agent-review status, not a custom cache. Include base changes and new discussion in the delta check. Offline local refs do not prove a remote PR is unchanged.
- Compare task objectives, evidence identities (Git blobs for tracked evidence; content hashes for external files), applicable rules, dependency versions and relevant environment. Record the checks in the loop handoff. Missing provenance or an unknown environment reopens checks; it does not qualify for reuse.
- Reuse only a blocking verdict with unchanged inputs. Any changed input, new completion/evidence, or previously unexplained failure reopens affected checks. Approval always needs fresh applicable gates on the exact state. Do not duplicate identical comments when reuse is permitted.
- Validate the policy with unchanged, changed-evidence and changed-target walkthroughs, plus an unknown-input case. These are process examples, not a claim that a cache or automation was implemented.
- GitHub distinction: requested changes are review feedback; stale *approval* dismissal depends on repository settings. A push does not prove remediation or automatically clear requested changes. Sources: [resolving reviews](https://docs.github.com/en/pull-requests/concepts/resolving-reviews) and [required reviews](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews), checked 2026-10-22. Keep the project's agent identity check when accounts are shared.

## Checks that prove it worked
- The ledger's rule-break count before and after.
- Every finding cites a commit, event file or line.
- Another agent can spot-check three findings.

## Mistakes to avoid
- Treating a general instruction ("no review step") as a specific approval and recording it in the owner's name.
- Writing a rule the tooling cannot see (e.g. a credits override the ledger never reads) without noting the tooling gap.
- PowerShell: a backtick in a double-quoted string is an escape (`a became a bell character); `R` is an alias of Invoke-History.
- Applying a validator that fails the test suite on today's history without a grandfather clause.
- Exception (rule 16): work Matthew requests directly in chat is pre-approved at plan and completion. Grok records approve-plan and approve as `"agent": "grok", "for": "matthew"` quoting his request and his 2026-10-22 01:52 PT words ("well, anything i request by direct chat shouldnt need approval"). When inspecting, check the quoted request really was his and names this work; agent-started work still needs a non-author review.
