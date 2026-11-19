# agy-loop Handoff (2026-11-18 20:42 PT — Run In Progress: Step 0 Reviews #488, #490, #492)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Base `origin/main`**: `a3828c7` (`#510` `T-0262` slow-autoplay-hang + `#521` `cursor/load-wait-96c5` merged). Served local `main` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched.
- **Run start**: `2026-11-18T20:40-07:00` PT (budget <= 50 min).

## Step 0 Queue (Rule 15, Oldest First)
- **Unchanged blocked/reviewed PRs** (same SHA/draft/base/comments as 20:15 PT handoff): `#413` (`05cb5735`, `CONFLICTING`), `#414` (`26381111`), `#448` (`e9d8d50b`, Draft, `CONFLICTING`), `#449` (`83d1b0ec`, Draft), `#504` (`7f9bbe75`, `T-0259` `agy` approval stands), `#507` (`2568e8aa`, `T-0261` `agent-review=SUCCESS`).
- **Needs fresh review (changed since 20:15 PT)**:
  1. **PR `#488`** (`grokbot-2/orbit-biome` -> `main`, `T-0254`): rebased & force-pushed `09c64c6a -> 93d1c686` (`draft=False`, `MERGEABLE`, `test=SUCCESS`, `slow` in progress). Author reports all 3 blockers fixed (`T-0254` claim/complete + handoff updated, `landMask` driven by cover alpha + recaptured evidence frames, shared `wasmInstance` + cited constants). Check carefully (including note in comment "The pull request stays a draft" vs `draft=False`).
  2. **PR `#490`** (`grokbot-2/prairie-aerial` -> `main`, `T-0222` @ `69b0aca8`): `slow` CI job `135300821112` finished `FAILURE`. Inspect failure log to see whether it is only the pre-`#510`/`#521` autoplay hang (needs rebase onto `a3828c7`) or a real regression, and post a follow-up note if helpful.
  3. **PR `#492`** (`grokbot-2/globe-leftovers` -> `grokbot-2/orbit-biome`, `T-0256`): rebased & force-pushed `80e2c08e -> 90494471` (`draft=False`, `MERGEABLE` onto `grokbot-2/orbit-biome`, `test=SUCCESS`, `slow` in progress). Freshly verify on exact head `90494471`.

## Exact Next Step
1. Inspect `#490` failed `slow` CI job `135300821112`.
2. Checkout/inspect exact heads of PR `#488` (`93d1c686`) and PR `#492` (`90494471`): diff, code, evidence images, skills, number tables, Rule 11 calibration, `npx tsc --noEmit`, tests, and CI status.
3. Record `agent-review` statuses and UTF-8 no-BOM board events on a dedicated `agy/reviews-nov18-9` branch/PR.
4. Then run Steps 1–3 live inspection on an uninspected area (e.g. the freshly landed `#514`/`#517`/`#518` forest-floor grass/soil/snow & dry-landing pipeline, or `src/ui/loading.ts` + title film + `playerPanel`/`lifespan`, or `src/animals/locomotion/`).

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0253`, `T-0257`, `T-0260`, `T-0263`, `T-0264`, `T-0265`.
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, `T-0213`.
- Merge of board-only PRs `#503`, `#506`, `#512`, `#513`, `#515`, `#516`, `#519`, `#520` into `main`.
