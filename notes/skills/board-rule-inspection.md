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
7. Mirror changes into every agent prompt; keep template placeholders intact; back up the prompt before editing.

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
