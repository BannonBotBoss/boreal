---
id: T-0263
title: Rule 7 board rules & tooling audit — fix agent-review cursor/Draft/repo-slug bugs, ledger credits/skill/quote enforcement, post-grandfather CI gate, and Rule 10/13/17 clarity
author: agy
scratch: false
research: true
skill: board-rule-inspection
tags: [process, rules, tooling, audit]
credits: 52
---
# T-0263 Rule 7 Board Rules & Tooling Audit

Rule 7 requires re-inspecting `tasks/RULES.md` whenever rules are added or gate failures trace to a rule. The last inspection (`T-0021`, 2026-10-21..23) predates Rules 18, 19, the Rule 15 amendment, the `cursor` agent, and the repo move to `BannonBotBoss/boreal`. A calibrated Rule 11/12 audit (`refs/process/board-rules-tooling-audit/audit.ts` -> `numbers.json`, `origin/main` `65f2375`, `calibrationValid = true`, `0 / 12` checks pass `0.95`, `meanScore = 0.0000`) over all `216` live tasks, `874` events, `tasks/RULES.md`, `tools/tasks.ts`, `tools/agent-review.mjs`, `tools/board-github.ts`, `tests/tasks.test.ts`, and `.github/workflows/ci.yml` found four concrete failure groups causing repeated friction, cross-branch ID collisions (`T-0258` 3-way, `T-0259` 2-way), blocked PR reviews, and silent post-cutoff rule breaks (`11` in Nov 2026).

Credits `52 = 10 × 4 objectives × 1.3` (`scratch: false`, `research: true`: full live-board ledger replay across 216 tasks / 874 events, cross-branch collision forensics, and causal Rule 7 audit of Rules 4, 6, 10, 13, 14, 15, 16, 17).

This is a board/tooling/process task (Rule 12 evidence gate; zero simulation files touched, respects `tests/sim-home-ceiling.json`).

## Objectives

- [ ] **Fix `tools/agent-review.mjs` and `tools/board-github.ts` GitHub integration defects:** add `'cursor'` to `AGENTS` in `tools/agent-review.mjs:19` so non-author reviewers can record `agent-review` commit statuses on `cursor/*` PRs (currently crashes with exit 1 on `#413`, `#414`, `#448`, `#449`, `#497`, `#499`, `#501`, `#504`); query `isDraft` in `tools/agent-review.mjs:26` and refuse `verdict === 'approve'` on Draft PRs (with an explicit error); update default `REPO` from stale `Bannon-github/boreal` to `BannonBotBoss/boreal` in `tools/agent-review.mjs:18` and `tools/board-github.ts:17`; clean up the leaked `mkdtempSync('boreal-board-')` temp directory in `tools/board-github.ts:32` inside a `finally` block.
- [ ] **Bring `tools/tasks.ts` ledger enforcement in line with Rules 4, 6, 10, 14, and 16 (with a grandfather cutoff so legacy Oct-2026 events stay intact):** honor an explicit integer `credits:` front-matter override in `parseTask()` (`tools/tasks.ts:75-81`, Rule 14 — currently ignored on `18` of `209` live tasks with headers); parse named `skill: <skill-name>` headers as truthy (`skillName?: string`, `skill: Boolean(skillName && skillName !== 'false')`) instead of `get('skill') === 'true'` (`tools/tasks.ts:80`, currently `0 / 188` live named-skill tasks parse true, breaking `skill-approve`); for post-cutoff `complete` events, verify `e.skill` names an existing `notes/skills/<skill>.md` (Rule 4) and `tasks/handoffs/<task>-<agent>.md` exists (Rule 6); for post-cutoff `"for": "matthew"` events (`tools/tasks.ts:132-133`), require a quoted phrase and Pacific time in `note` (Rules 10/16) and reject non-veto `"agent": "matthew"` events written after the cutoff; add a `--next-id` CLI mode to `tools/tasks.ts` that scans `git log --all` + local `tasks/` so agents stop colliding on IDs.
- [ ] **Turn on post-grandfather CI enforcement in `tests/tasks.test.ts`:** replace the all-or-nothing `{ todo: real.errors.length ? ... : false }` bypass at `tests/tasks.test.ts:64` (which currently skips all `11` Nov-2026 rule breaks because `27` older Oct-2026 legacy breaks exist) with a strict assertion that zero NEW rule breaks occur on events dated at or after a `BOARD_RULE_FROM` cutoff (matching the proven `GAIT_RULE_FROM` pattern in `tests/gait-gate.test.ts`), plus unit tests covering `credits:` overrides, named `skill:` + `skill-approve`, post-cutoff `complete` skill/handoff checks, `for: matthew` quote checks, and `agent-review.mjs` `cursor/` + Draft guards.
- [ ] **Update `tasks/RULES.md` and `notes/skills/board-rule-inspection.md` for Rules 10, 13, 15, and 17:** update Rule 17 repo slug to `BannonBotBoss/boreal`, list `cursor` among branch prefixes in Rule 17(c), and name both actual `.github/workflows/ci.yml` check runs (`test` and `slow`) in Rule 17(d); clarify Rule 10 vs Rule 13 for unmerged-branch ID collisions (allowing event renames on an unmerged branch before hitting `main` while keeping `main` strictly append-only, resolving the opposite handling seen in PR `#504` vs PR `#507`); clarify Rule 15 re-checks on `completed` tasks (use `comment` for a re-check pass on an already-`completed` task, or have the reviewer issue `reject` to return the task to `claimed` before a new `complete`, preventing duplicate-`complete` ledger breaks like `T-0222` on PR `#490`).

## Evidence & Calibrated Numbers (Rule 11 & Rule 12)

- Verification script & output (`origin/main` `65f2375`): `refs/process/board-rules-tooling-audit/audit.ts` -> `refs/process/board-rules-tooling-audit/numbers.json` (`calibrationValid = true`, every check has `knownMatch = 1.0`, `knownMismatch = 0.0`, `0 / 12` pass `0.95`, `meanScore = 0.0000`).
- Live board snapshot (`origin/main` `65f2375`): `216` tasks (`53` proposed, `29` approved, `30` claimed, `72` completed, `32` done), `874` events, `38` total rule breaks (`11` in Nov 2026), `1` invalid-JSON warning.

| Check | Measured | Target | Source / Evidence | Score | Pass |
|---|---|---|---|---|---|
| `agent-review.mjs` recognizes `cursor/*` branch author | `0` | `1` | `tools/agent-review.mjs:19,27-28`; PRs `#413,#414,#448,#449,#497,#499,#501,#504` | `0.000` | no |
| Board tools/rules point to moved repo `BannonBotBoss/boreal` | `0 / 3` | `3 / 3` | `tools/agent-review.mjs:18`; `tools/board-github.ts:17`; `tasks/RULES.md:27` | `0.000` | no |
| `agent-review.mjs` queries `isDraft` & blocks Draft `approve` | `0` | `1` | `tools/agent-review.mjs:26-33`; Draft PRs `#490,#492,#507,#510` | `0.000` | no |
| Rule 14 `credits:` header override honored (`99` vs formula `20`) | `20` | `99` | `tasks/RULES.md:20` vs `tools/tasks.ts:72-81` (`18/209` live tasks differ) | `0.000` | no |
| Rule 4 named `skill: <name>` parsed as `skill = true` | `0 / 188` | `188 / 188` | `tasks/RULES.md:6` vs `tools/tasks.ts:80,147` (`skill-approve` rejects named skills) | `0.000` | no |
| Rule 4 `complete` validates `skill` + `notes/skills/<name>.md` | `0` | `1` | `tasks/RULES.md:6` vs `tools/tasks.ts:142` | `0.000` | no |
| Rule 6 `complete` validates `tasks/handoffs/<task>-<agent>.md` | `0` | `1` | `tasks/RULES.md:12` vs `tools/tasks.ts:142` | `0.000` | no |
| Rules 10/16 quote+time check on `for: matthew` & `agent: matthew` guard | `0.0` | `1.0` | `tasks/RULES.md:16,25-26` vs `tools/tasks.ts:119,132-133` | `0.000` | no |
| `tests/tasks.test.ts` fails CI on NEW post-grandfather breaks | `0` | `1` | `tests/tasks.test.ts:64` (`11` Nov-2026 breaks silently skipped by `todo`) | `0.000` | no |
| `tools/board-github.ts` cleans up `mkdtempSync` temp dir | `0` | `1` | `tools/board-github.ts:32` | `0.000` | no |
| Rule 13 `--next-id` helper & Rule 10/13 unmerged renumber clarity | `0.0` | `1.0` | `tasks/RULES.md:16,19`; collisions `T-0258` (3-way) & `T-0259` (2-way) | `0.000` | no |
| Rule 17 names actual CI jobs (`test`, `slow`) and `cursor` | `0.0` | `1.0` | `tasks/RULES.md:27` vs `.github/workflows/ci.yml` (`jobs: test, slow`) | `0.000` | no |

## How a Reviewer Can Spot-Check (Rule 12)
1. Run `npx tsx refs/process/board-rules-tooling-audit/audit.ts` on `origin/main` (`65f2375`) and inspect `refs/process/board-rules-tooling-audit/numbers.json` (`calibrationValid: true`, `0/12`, `namedSkillParsedTrue: 0/188`, `creditsHeaderMismatch: 18`, `nov2026RuleBreaks: 11`).
2. Inspect `tools/agent-review.mjs:18-19,26-28` (`REPO = 'Bannon-github/boreal'`, `AGENTS` omits `'cursor'`, `isDraft` not queried).
3. Inspect `tools/tasks.ts:75-81,132-133,142,147` (`get('credits')` never read, `skill: get('skill') === 'true'`, `complete` checks only `!e.branch`) and `tests/tasks.test.ts:64` (`todo: real.errors.length ? ... : false`).
