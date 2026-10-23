# Handoff: T-0021 inspect the board rules (grok, 2026-10-21 11:45 PT)
Requested by Matthew (2026-10-21, omen): "even the rules need to be inspected" and "a review of the rules should be made in case
there are some important changes needed". Codex's review input: tasks/events/2026-10-21-codex-comment-T-0021.json.
Branch `grok/transactional-plan`, worktree `C:\dev\boreal-grok-plan`.

## Status
CLAIMED by grok 2026-10-23 00:31 PT (event 2026-10-23T00-31-grok-claim-T-0021.json). Not submitted. The 2026-10-21 table
below stops at rule 15. Rules 16, 16b and 17 were added after it and are not in that table yet, so this is not a complete
event. Next step: add those three rows (cause, what happened, verdict) with file:line or event evidence, then the rule-12
handoff can be submitted for a non-grok-family review. D1-D6 still need Matthew.

## Done
- Step 1: handoff created (7f529d5), updated after each step (808b691, this commit).
- Step 2: evidence gathered: git log --all -- tasks/, every event on every branch, handoffs, C:\dev\boreal-agents\prompt.md,
  and the ledger tools/tasks.ts (claude/tasks-crlf-comment 426e732) run against the board (copy in %TEMP%\boreal-ledger).
- Step 3: rule changes applied (9dce12c) and the unattended prompt updated (C:\dev\boreal-agents\prompt.md, not in git;
  backup C:\dev\boreal-agents\prompt.before-T-0021.md; 12 __AGENT__ placeholders kept).
- Step 4: T-0008 follow-up (Codex's review): handoff tasks/handoffs/T-0008-grok.md, skill notes/skills/transactional-audit.md,
  comment event 2026-10-21T11-35-grok-comment-T-0008.json; correction comments for the matthew-named approve-plans
  (2026-10-21T11-36-grok-comment-T-0008.json, ...-T-0009.json) (bce86af, 245e7ad).
- Step 5: skill notes/skills/board-rule-inspection.md.
- Ledger rule breaks on this branch went from 9 to 7 (T-0021 steps and T-0022's missing task file fixed by the main merge).

## Causal chain of each rule (why it is here) and how it held up
| Rule | Added by | Why (request) | What actually happened | Verdict |
|---|---|---|---|---|
| README board (propose, approve-plan, claim, complete, approve, credits, status, weekly award, never-empty) | 1e3b86c (claude, 10-18, inbox/claude/task-board) | Matthew's 10-18 credits/board rules | README and tools/tasks.ts are **not on main** (only on claude/tasks-crlf-comment, grok-gait/*, inbox/claude/task-board), so agents on main read RULES.md without the event table, and nothing enforces anything. README says "Matthew merges only what he likes", which conflicts with rule 3 (auto-merge). | Needs landing (decision D1) |
| 1 propose + notify, no review before adding | 5f1844f (10-21 10:49) | "no, just go ahead and add them to the board" | Followed (T-0008..T-0022 proposed). | Holds |
| 2 claim needs approve-plan; done needs another agent's approve | 5f1844f, from README | review by a second agent | Grok wrote approve-plan in Matthew's name for T-0008/T-0009 (10-25, 10-50) to satisfy it; T-0006 and T-0009 claims share the minute/`at` of their approve-plan, so the ledger replays claim first ("task is proposed, not approved"). **No `approve` event exists on any branch**, so nothing has ever been done/merged through rule 3. | Clarified (claim `at` after approve-plan); bottleneck addressed by rule 15 |
| 3 auto-merge approved tasks | 5f1844f | "all tasks, once completed and approved by another agent, should automatically be merged" | Board-only commits (proposals, evidence) are fast-forwarded to main by Grok's loop (17e3c46) without any approve; that is needed for a visible board but was not written down. | Clarified: board-only files may land any time, game code only via an approved task |
| 4 every completed task makes a skill | 5f1844f | "a successfully completed task should create a skill" | T-0008 completed without one (Codex comment). Header `skill:` is boolean in the ledger, but T-0020/21/22 write a skill name, which the ledger reads as false. Skills live in two places: notes/skills/ (rabbit, prompt) and .agents/skills/<name>/SKILL.md (codex, T-0022). Wording said "before approving" for the author's check. | Clarified: notes/skills/<name>.md, `skill: <name>`, checked before submit |
| 5 transactional rule | 5f1844f | "what gives? why is this object here?" | Followed in plans. | Holds |
| 6 numbers + recording + frame questions, 95% | 0016353 (11:06) | "screen recordings ... analyzed using those quality inspection questions" | Unmeasurable cases: Codex T-0022 (no sun disc or measurable shadow in frames); T-0009's scores are estimates ("about 45%") with no calibrated metric, so 95% is neither measured nor calibrated. Documentary tasks (T-0008, T-0021) have nothing to record. Rule 6 and 7 had no line breaks (5., 6., 7., 8., 9. ran together). | Kept; rules 11 (measured, N/A) and 12 (evidence gate) added; formatting fixed |
| 7 rules are inspected | a6cea6d (11:07) | "even the rules need to be inspected" | "re-inspect whenever a task fails a gate" would trigger a rules review on every ordinary failure (loop/waste). | Narrowed to rule additions and gate failures traced to a rule |
| 8 handoffs carry steps you can't do | 89a287a (11:12) | "well thats why the handoff file exists" | Codex T-0022 handoff used it. | Holds |
| 9 handoff first, update every step | 6f2dcc3 (11:17) | "as long as the handoff file exists, if their usage runs out, then its ok" | T-0008 had none; T-0009, T-0022, grok-loop do. | Holds |
| Event naming | README (1e3b86c) "<ISO time>-<agent>-<event>-<task>.json" | unique files, no conflicts | Codex writes 2026-10-21-codex-propose-T-0022.json (no HH-MM; three same-name-pattern files with identical `at` to 7 decimals); grok's loop wrote a duplicate T-0022 approve-plan and had to delete it (c488370). | Rule 13 fixes the format |
| Task ids "next free" | README | no reuse | No collision yet, but T-0022 existed only on codex/sky-audit while main had an approve-plan for it (unknown task on main); with three hourly agents, parallel proposals will collide. | Rule 13: check all branches; second to land is renumbered |
| Credits header | grok's task files (03b27f8) | Matthew wants to adjust credits to prioritise | The ledger ignores `credits:`; it computes 10 x steps x (...). T-0021 had numbered objectives, so it computed 0 credits. "matthew" became Agent of the Week (4 cr) from the approve-plans grok wrote in his name. | Rule 14 (header is the override, only Matthew changes it); ledger change pending (D1) |
| Who writes in whose name | none | - | Grok wrote approve-plan T-0008/T-0009 and three T-0020 comments as "matthew". Comments relay his words (harmless); approvals claimed a decision he didn't make. README reserves agent "matthew" for veto. | Rule 10; correction comments recorded |
| Unattended prompt | C:\dev\boreal-agents\prompt.md (11:16) | hourly claude/codex/agy, full auto-approve | Consistent with RULES 1-9, but: shared port range 5210-5299 (two agents can pick the same port), no review-first step (so nobody approves), all commits carry Matthew's git identity (agent not visible in `git log`). | Per-agent port ranges, step 0 review first, commit subject prefix, rules 10-15 mirrored |

## Changes applied
- 9dce12c tasks/RULES.md: rules 2, 3, 4, 7 clarified; rules 10-15 added; line breaks restored; T-0021 objectives as `- [ ]`.
- prompt.md (outside git): per-agent ports, step 0 review first, event filename format, measured/N/A/evidence gate line,
  own-name rule, no editing events, commit subject prefix `__AGENT__:`.
- bce86af, 245e7ad: T-0008 handoff, skill, comment; correction comments for T-0008/T-0009.

## Needs Matthew's decision (not applied)
- D1. Land the ledger on main (cherry-pick 426e732 + tasks/README.md + tests/tasks.test.ts) and make it read the `credits:`
  header and `skill: <name>`. Risk: tests/tasks.test.ts fails on any rule break, and main has 7 today (T-0007 has no steps;
  T-0002/T-0003 events reference task files that never reached main; two claims replay before their approvals). Landing it
  would make `npm test` red for every agent until those are fixed or grandfathered. Recommend: land it with a grandfather
  list for events before 2026-10-21 12:00 PT.
- D2. Rule 11 means no animation score can pass until T-0020 delivers a calibrated metric (every current score is an
  estimate). Is that the intended strictness, or may an uncalibrated score pass with a reviewer's agreement in the meantime?
- D3. Should Matthew-relayed plan approvals be allowed at all (agent "grok" with "for": "matthew"), or does every plan need
  another agent's review? Rule 10 currently says a general instruction is not an approval.
- D4. README "Matthew merges only what he likes" vs rule 3 auto-merge: rule 3 is the newer instruction; confirm README should
  be updated when it lands.
- D5. Commit identity: all agents commit as "Matthew James Bannon". Applied only a subject prefix; setting per-agent
  `user.name` would be clearer but changes how history is attributed.
- D6. T-0007 is still a sketch with two open questions for Matthew (visual first or ground model first; nurse-log seedlings in
  scope?), so it has no steps and cannot be claimed.

## Proposed but not done (low priority)
- Normalise skill locations: Codex's .agents/skills/boreal-seasonal-light-audit/SKILL.md vs notes/skills/ (not moved: another agent's files).
- A board check script (filename format, `at` order, unknown tasks, own-name) run by the hourly loop.

## Needs from another agent
- Review (rule 12/15): spot-check at least three rows of the table above against the cited commits/events and comment.

## How to verify
- `git show 9dce12c -- tasks/RULES.md`; `git log --all --format="%h %s" -- tasks/events`; run the ledger:
  `git show claude/tasks-crlf-comment:tools/tasks.ts > %TEMP%\boreal-ledger\tasks.ts` then `npx tsx %TEMP%\boreal-ledger\tasks.ts` in a worktree.
- `Compare-Object (gc C:\dev\boreal-agents\prompt.before-T-0021.md) (gc C:\dev\boreal-agents\prompt.md)`.

## Diff: tasks/RULES.md (6f2dcc3..9dce12c)
```diff
diff --git a/tasks/RULES.md b/tasks/RULES.md
index 28bb66e..1af8254 100644
--- a/tasks/RULES.md
+++ b/tasks/RULES.md
@@ -1,11 +1,21 @@
 # Task board rules
 
 1. Propose a task as tasks/T-XXXX-<slug>.md plus a propose event. Matthew is notified of every new task and can comment or change its credits; no review is needed before adding.
-2. Claiming needs an approve-plan event. A task counts as done (and pays out) only after another agent's approve.
-3. Completed and approved tasks are merged into main automatically by Grok, who tells Matthew what landed.
-4. **Every successfully completed task creates a skill.** Before approving, check whether a skill already covers that kind of work. If none does, write one (a generic, reusable how-to: the steps, the tools and files used, the checks that proved it worked, and the mistakes to avoid). If one exists, update it with what this task taught. The complete event names the skill, and approve checks it is there.
-5. Every behaviour follows the transactional rule: why is this object here, and how is its behaviour generated from contact, senses, energy and needs? No random actions or bare timers.6. **Every task, including tasks generated while inspecting and testing the game, is verified the same way before it is submitted:**
+2. **Plan approval, then claim.** A task can be claimed only after an approve-plan by an agent other than its author (Matthew may also approve). The claim's `at` must be later than the approve-plan's (the ledger replays by `at`). A task counts as done (and pays out) only after another agent's approve.
+3. Completed and approved tasks are merged into main automatically by Grok, who tells Matthew what landed. Board-only changes (tasks/**, notes/skills/**, refs/** evidence) may reach main at any time so the board stays visible; game code reaches main only through an approved task.
+4. **Every successfully completed task creates a skill.** Before submitting (the complete event), check whether a skill already covers that kind of work. If none does, write one at notes/skills/<skill-name>.md (a generic, reusable how-to: the steps, the tools and files used, the checks that proved it worked, and the mistakes to avoid). If one exists, update it with what this task taught. The task header says `skill: <skill-name>`, the complete event names the skill, and approve checks it is there.
+5. Every behaviour follows the transactional rule: why is this object here, and how is its behaviour generated from contact, senses, energy and needs? No random actions or bare timers.
+6. **Every task, including tasks generated while inspecting and testing the game, is verified the same way before it is submitted:**
    - **Numbers:** for every rate, timing, density and size ask "do my numbers resemble nature?" and check it against a real source. List them in a table (value, game number, real figure + source, yes/no).
    - **Screen recording:** record the change running in game and sample its frames.
    - **Quality questions on the frames:** What do I see here? (a complete description from the frames) Does that look natural as described, and how do I know? Get a reference with the same description (prompt-generated frames, or a 3-5 s generated video's frames as fallback). Does this reference show how it looks in nature? No: reconsider the prompt. Yes: does what I see in the game resemble it to 95%, in timing and position?
-   - **Submit only if both pass:** write the complete event and a handoff file tasks/handoffs/T-XXXX-<owner agent>.md (what was built, branch/commit, how to verify, the number table, the frame answers with recording and reference paths, leftovers, what the next owner needs). If either fails, the task stays open with the failing items noted.7. **The rules are inspected too.** Each rule is asked the same questions as game objects: Why is this rule here (what problem caused it)? Does it hold up in practice: what do I see happening when agents follow it? Does it produce work that resembles nature and passes the gates, or does it cause waste, loops or false passes? A rule that fails is revised through a board task, with the evidence in its handoff. Rules are re-inspected whenever a task fails a gate or a rule is added.8. **Handoffs carry the steps an agent can't do itself.** If a step is outside an agent's tools (e.g. generating reference images or video, screen recording, a sign-in), it writes that step into its handoff file under "Needs from another agent": exactly what is needed (the description/prompt, frame times, where to save the result) and who can do it. The task stays open, not submitted, until that step is done. Any agent with the capability picks it up from the handoff (Grok generates reference images and videos), saves the result where the handoff says, and notes it in the handoff. The original owner then finishes the gate and submits.9. **Handoff first, then keep it current.** Any agent working on a task creates its handoff file (tasks/handoffs/T-XXXX-<agent>.md, or tasks/handoffs/<agent>-loop.md for inspection-only runs) at the start of its work and updates and commits it after every step: what it is doing, what is done, the exact next step, and any "Needs from another agent" items. A run cut off by usage limits, a crash or a reboot is fine as long as its handoff exists; the next run or any other agent continues from it.
\ No newline at end of file
+   - **Submit only if both pass:** write the complete event and a handoff file tasks/handoffs/T-XXXX-<owner agent>.md (what was built, branch/commit, how to verify, the number table, the frame answers with recording and reference paths, leftovers, what the next owner needs). If either fails, the task stays open with the failing items noted.
+7. **The rules are inspected too.** Each rule is asked the same questions as game objects: Why is this rule here (what problem caused it)? Does it hold up in practice: what do I see happening when agents follow it? Does it produce work that resembles nature and passes the gates, or does it cause waste, loops or false passes? A rule that fails is revised through a board task, with the evidence in its handoff. Rules are re-inspected whenever a rule is added or a gate failure is traced to a rule.
+8. **Handoffs carry the steps an agent can't do itself.** If a step is outside an agent's tools (e.g. generating reference images or video, screen recording, a sign-in), it writes that step into its handoff file under "Needs from another agent": exactly what is needed (the description/prompt, frame times, where to save the result) and who can do it. The task stays open, not submitted, until that step is done. Any agent with the capability picks it up from the handoff (Grok generates reference images and videos), saves the result where the handoff says, and notes it in the handoff. The original owner then finishes the gate and submits.
+9. **Handoff first, then keep it current.** Any agent working on a task creates its handoff file (tasks/handoffs/T-XXXX-<agent>.md, or tasks/handoffs/<agent>-loop.md for inspection-only runs) at the start of its work and updates and commits it after every step: what it is doing, what is done, the exact next step, and any "Needs from another agent" items. A run cut off by usage limits, a crash or a reboot is fine as long as its handoff exists; the next run or any other agent continues from it.
+10. **Write only in your own name.** An event's `agent` is the agent that wrote the file. Only Matthew writes events with `"agent": "matthew"`. An agent relaying Matthew's words or decision writes in its own name, adds `"for": "matthew"`, and quotes him with the time in its `note`. A general instruction from Matthew (such as "no review step") is not an approval of a specific task: the plan still needs another agent's approve-plan. Board history is append-only: a wrong event is corrected by a new comment event, never by editing or deleting the old one.
+11. **Measured, not eyeballed.** A gate score counts only when the handoff names how it was measured: the metric, the tool or script, and its calibration (the score it gives a known match and a known mismatch). An estimate without that is reported as "uncalibrated" and cannot pass a gate. If a gate cannot be measured or does not apply (e.g. the frames show neither the sun nor a measurable shadow), write "N/A" or "unmeasurable" with the reason, and substitute an independently calibrated numeric check against a published source (e.g. NOAA solar equations). A generated picture is a reference for what to look for, not a certificate of position.
+12. **Documentary and process tasks (audits, plans, rule reviews) use an evidence gate instead of the frame gate.** Their handoff lists every finding with its evidence (file:line, commit, event or source), what each finding became (a task, a rule change, nothing, and why), and how a reviewer can spot-check it. The reviewer checks at least three findings against the evidence before approving. The numbers gate applies to any number they introduce.
+13. **Names and ids.** Event files are tasks/events/YYYY-MM-DDTHH-MM-<agent>-<type>-<task>.json in Pacific local time, matching the `at` field (ISO with offset); two events in the same minute use distinct seconds in `at`, in causal order. Task objectives are `- [ ]` lines under `## Objectives` (the ledger counts them). Take the next free task id across all branches (`git log --all --name-only -- "tasks/T-*"`). If two branches still collide, the task that reaches main second is renumbered by whoever merges it, with a comment event naming the old id.
+14. **Credits.** A task's `credits:` header starts at the board formula (10 x objectives x (1 + 0.5 if from scratch + 0.3 if research)). Only Matthew changes it, or an agent on his explicit instruction for that task, with a comment event quoting him; the changed header is what the task pays (tools/tasks.ts must read the header once the ledger lands on main; until then it computes the formula).
+15. **Review first.** Every agent run starts by reviewing what waits on review and was not written by itself, oldest first: completed tasks (approve, reject or comment) and proposed plans (approve-plan, reject-plan or comment). A review states what was checked. Never approve your own work.
\ No newline at end of file
```n
## Diff: C:\dev\boreal-agents\prompt.md
```diff
diff --git a/C:/dev/boreal-agents/prompt.before-T-0021.md b/C:/dev/boreal-agents/prompt.md
index b55c12a..63dcb27 100644
--- a/C:/dev/boreal-agents/prompt.before-T-0021.md
+++ b/C:/dev/boreal-agents/prompt.md
@@ -5,7 +5,7 @@ Served repo: C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game (main branch, dev
 Your home worktree for this loop: C:\dev\boreal-__AGENT__-loop (branch __AGENT__/loop). Pull main into it at the start (git merge main).
 
 House rules (non-negotiable):
-- Never edit the served folder and never kill the 5173 dev server or any other dev server you did not start. Work only on branches named __AGENT__/<topic> in worktrees under C:\dev (git -C C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game worktree add C:\dev\boreal-__AGENT__-<topic> -b __AGENT__/<topic> main). Use your own preview port in 5210-5299, never 5173-5209.
+- Never edit the served folder and never kill the 5173 dev server or any other dev server you did not start. Work only on branches named __AGENT__/<topic> in worktrees under C:\dev (git -C C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game worktree add C:\dev\boreal-__AGENT__-<topic> -b __AGENT__/<topic> main). Use a preview port from your own range (claude 5210-5229, codex 5230-5249, agy 5250-5269, anyone else 5270-5299), never 5173-5209, and stop any server you started before you finish.
 - Use git reset --keep, never --hard. Never force-push, never delete other agents' branches or worktrees. Kill any headless browser you start after every run.
 - Only touch files inside C:\dev and the repo. No installs outside the repo, no system settings, no network actions other than research and package installs the repo needs.
 - Tests: npm test (tsx --test) and npx tsc --noEmit. The trace test 'f allocates when off' is known to fail now and then.
@@ -16,6 +16,8 @@ Usage limits: your run may be cut off at any moment when your usage runs out, an
 
 Read first: tasks/RULES.md on main, AGENT-NOTES.md, notes/grok-transactional-plan.md, the existing tasks/T-*.md, tasks/events/*.json and tasks/handoffs/*.md (check other branches too: git log --all -- tasks/), and your own previous handoffs so you continue where you left off.
 
+0. Review first (rule 15): before new work, review everything waiting on review that you did not write, oldest first: completed tasks (approve, reject or comment) and proposed plans (approve-plan, reject-plan or comment). State what you checked.
+
 Your loop, repeated until the honest answer to 'Does this game resemble the real world? How do I know?' leaves nothing to improve:
 0. Every run, before anything else, ask: are there any merges to be made? Find tasks that have a complete event but no approve event from an agent other than the author (check all branches: git log --all -- tasks/events). Review each one you did not author with the same gates (number table, recorded frames vs reference, tests on its branch) and write an approve event if it passes, or a comment event listing exactly what fails. Do this first, because nothing reaches main until another agent approves it. Also write approve-plan events for proposed tasks you have checked, so their authors can claim them.
 1. Inspect: pick an area of the game no one has inspected recently (animals, plants, terrain, light and sky, sound, physics, controls, UI). Make a screen recording of it running and sample its frames.
@@ -24,11 +26,12 @@ Your loop, repeated until the honest answer to 'Does this game resemble the real
    - Does that look natural as described? How do I know? Compare with the real version that has the same description: turn the description into an image prompt and generate a frame-by-frame reference sequence. If it does not show how it looks in nature, reconsider the prompt and try again. If images do not get there, generate a 3-5 second video of the activity and use its frames as the reference.
    - Does what I see in the game resemble the reference to 95%, in both timing and position?
    - Do my numbers (rates, timings, sizes, densities) resemble nature? Check each against a real source.
-3. Turn every real gap into a board task: tasks/T-XXXX-<slug>.md (same header format as existing tasks, next free id across all branches, credits = 10 x objectives x (1 + 0.5 if from scratch + 0.3 if research)) plus a propose event in tasks/events/. Cite the frames and sources. Do not duplicate existing tasks and do not invent problems.
+   - Measured, not eyeballed (rule 11): a score counts only with its metric, script and calibration (score on a known match and a known mismatch); otherwise report it as 'uncalibrated', which cannot pass. If a gate cannot be measured or does not apply, write N/A or unmeasurable with the reason and substitute an independently calibrated numeric check against a published source. Documentary and process tasks (audits, plans, rule reviews) use the evidence gate of rule 12 instead of the frame gate.
+3. Turn every real gap into a board task: tasks/T-XXXX-<slug>.md (same header format as existing tasks, next free id across all branches, credits = 10 x objectives x (1 + 0.5 if from scratch + 0.3 if research)) plus a propose event in tasks/events/YYYY-MM-DDTHH-MM-__AGENT__-<type>-<task>.json (Pacific local time, matching the 'at' field; objectives as '- [ ]' lines; header 'skill: <skill-name>'). Cite the frames and sources. Do not duplicate existing tasks and do not invent problems.
 4. Claim a task (it needs an approve-plan by another agent, then your claim event), do it on your __AGENT__/<topic> branch, and verify it with the same gates: a nature-checked number table plus recorded frames that pass the questions above.
 5. Submit only if both gates pass: a complete event, a handoff file tasks/handoffs/T-XXXX-__AGENT__.md (what you built, branch and commit, how to verify, the number table, frame answers with recording and reference paths, leftovers, what the next owner needs), and a reusable skill for that kind of work (create one under notes/skills/ if none exists, otherwise update it).
 6. If a step is outside your tools (e.g. generating reference images or video), do not skip it: write it in your handoff under 'Needs from another agent' with the exact description, prompt and save path, leave the task open, and finish the gate once another agent has filled it in.
 7. Review other agents' completed tasks with the same questions and write an approve or comment event (approve-plan for proposed tasks you have checked). Never approve your own work. Grok merges approved tasks into main.
 8. Inspect the rules too: if a rule in tasks/RULES.md causes waste, loops or false passes, propose a task to revise it with evidence.
 
-Write JSON event files as UTF-8 without a BOM. Never write events in anyone else's name. Report honest scores, not rounded passes. Commit your work on your own branches before you stop.
\ No newline at end of file
+Write JSON event files as UTF-8 without a BOM. Never write events in anyone else's name: only Matthew writes agent 'matthew'; relaying his words, use your own name with "for": "matthew" and quote him (rule 10). Never edit or delete existing events; correct them with a new comment event. Start every commit subject with '__AGENT__:'. Report honest scores, not rounded passes. Commit your work on your own branches before you stop.
\ No newline at end of file
```n
## 2026-10-23 00:31 PT claim (in progress, not a submission)

Rules 16, 16b and 17 are in tasks/RULES.md and are not in the table above. Started, not finished:

| Rule | Where it shows up | What this run saw | Not done |
|---|---|---|---|
| 16 | tasks/events/2026-10-22T23-48-grok-approve-plan-T-0043.json (`agent` grok, `for` matthew, verbatim quote) | A named chat request was recorded as approve-plan. A general remark still approves nothing. | Full pass over every `for: matthew` event since 2026-10-22 01:30 PT |
| 16b | same event, plus the sentence from 2026-10-22 01:52 PT quoted in the note | T-0043's plan is approved. The branch grok-globe/globe-inertia eb11755 (23:45 PT) has code before the claim. The task is not complete. | Whether code-before-claim is what 16b allows, written against rule 2 |
| 17 | .github/workflows/ci.yml (job name `test` only); PR #38 commit statuses empty | The merger did not treat a green `test` job as `agent-review`. No `rule-gates` check exists. | Whether rule 17(d)'s name `ci` matches the workflow job name `test` |

Exact next step: finish these three rows with a verdict (holds / revise), spot-check three evidence lines, then write the complete event. Do not approve from the grok family.
