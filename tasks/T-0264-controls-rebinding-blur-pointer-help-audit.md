---
id: T-0264
title: Fix Gamepad Settings clash/swap/pointer bugs, blur key-stick deadlocks, F1 Help overlay Escape trap & coverage, and keyAction '+'/combo handling
author: agy
scratch: false
research: true
skill: controls-rebinding-ui
tags: [controls, ui, gamepad, accessibility]
credits: 52
---
# T-0264: Fix Gamepad Settings clash/swap/pointer bugs, blur key-stick deadlocks, F1 Help overlay Escape trap & coverage, and keyAction '+'/combo handling

## Why this task exists (live inspection on `origin/main` `6f8a7f0`)
Live headless Chromium (`1280x720`, SwiftShader, zero console errors) inspection of `tools/gamepad.html` (`src/ui/gamepadSettings.ts`), the in-game `PadMenu` (`src/ui/padMenu.ts`), the `F1` / `View` Controller Help overlay (`src/input/padRouter.ts`), the `Controls` screen (`src/ui/controls.ts`), and `src/input/gamepad.ts` against `src/core/bindings.ts` found **8 real, non-overlapping interactive defects** (distinct from `T-0241`'s deadzone/orbit/embodied-HUD audit and `T-0251`'s badge/camera-label/number-entry/3D-mesh audit).

Calibrated verification (`refs/controls/controls-rebinding-ui-audit/audit.ts` -> `refs/controls/controls-rebinding-ui-audit/numbers.json`, `calibrationValid = true`, known match `= 1.0000`, known mismatch `= 0.0000`): **`0 / 8` checks pass `0.95` (`meanScore = 0.0625`)**.

All fixes live strictly in the allowed draw/input directories (`src/ui/`, `src/input/`, `src/main.ts`, `tests/`) with **zero growth to `src/core/bindings.ts`** (`tests/sim-home.test.ts` compliant).

## Empirical findings, frames, and sources

| Check ID | Game behaviour (`6f8a7f0`) | Expected / source | Score | Evidence |
|---|---|---|---|---|
| `gs-clash-all-bindings` | `kbClashRowsFlagged = 0 / 2`, `secondaryPadFlagged = false` | Both keyboard clashes and `pad[1..n]` clashes flagged (`2 / 2`); `src/ui/gamepadSettings.ts:77` only tests `b[a.id].pad[0]`, ignoring `pad[1..n]` (12 multi-pad actions) and all `keys` | `0.0000` | `frame-2-gamepad-kb-clash-unflagged.png`, `numbers.json` |
| `gs-swap-prompt-side` | Keyboard rebind `Move forward: W -> S` displays `"S is already on Move back. (A) Swap (they get LS ↑) · (X) Keep both · (B) Cancel"` | Modal must display the side actually swapped by `swapAssign()` (`keys`: `"they get W"`), not hardcoded `.pad`; `src/ui/gamepadSettings.ts:82` vs `src/core/bindings.ts:216-221` | `0.0000` | `frame-1-gamepad-kb-swap-modal.png`, `numbers.json` |
| `gs-pointer-controls` | `tabClick = false`, `rowClick = false`, `modalBtns = 0`, `closeBtns = 0` | Mouse/pointer users can click tabs, rows, Swap/Keep/Cancel & Reset Yes/No modal buttons, and a Close/Back button (`4 / 4`); WAI-ARIA APG Dialog & Tabs, `src/ui/gamepadSettings.ts:68-84` | `0.0000` | `frame-0-gamepad-settings.png`, `frame-1-gamepad-kb-swap-modal.png` |
| `padmenu-row-click` | Clicking `"Gamepad settings (3D controller, rebinding)"` `.it` row does nothing (`gpsOpenedByRowClick = false`, `padMenuStillOpen = true`) | Clicking any selectable `.it` row focuses and activates it (parity with clickable tabs in `padMenu.ts:215` and scroll arrows in `padMenu.ts:195-214`) | `0.0000` | `frame-3-padmenu-click-dead.png`, `numbers.json` |
| `blur-key-release-guards` | `0 / 3` modules listen to `window.blur` / `visibilitychange`: `controls.ts` stays stuck on `"W: Move forward..."` and deadlocks capture on `"J + K"`, `gamepadSettings.ts` deadlocks capture on `"J"`, `padMenu.ts` drifts focus (`1 -> 3`) in infinite hold-repeat | All `3` modules clear held keys / hold-repeat on `blur` & `visibilitychange`, matching `src/main.ts:456-457` (`4 / 4` clean) | `0.0000` | `numbers.json` (`raw.gamepadSettings`, `raw.inGame`) |
| `help-overlay-escape-and-coverage` | `.padh` stays trapped visible after `Escape` while `#start-menu` (`Paused`) opens behind it (`stillVisibleAfterEsc = true`, `pauseBehind = true`, `closeBtns = 0`); table omits `Chronometer` & `Axis` (`6 / 8` contexts) | `Escape` or a clickable Close button closes `.padh` without opening Pause behind it; table includes `Chronometer` & `Axis` (plus keyboard reference); `src/input/padRouter.ts:22-30, 43-49, 114` | `0.0000` | `frame-4-help-overlay-trapped.png`, `frame-5-help-traps-escape.png` |
| `keyaction-plus-and-combo` | `keyAction(bPlus, '+', 'menu') === undefined` (`keyAtom('+')` is `'k:plus'` while `gamepad.ts:45` computes `'k:+'`); multi-atom keyboard combo `Shift+Tab` returns `undefined` | `keyAction()` reuses `keyAtom()` from `src/core/bindings.ts:156` and matches modifier combos (`2 / 2`); `src/input/gamepad.ts:44-47` | `0.0000` | `numbers.json` (`raw.deterministic`) |
| `controls-copy-and-title-hygiene` | `.ctl-screen .note` claims `"V flora view"` (`staleVFloraNote = true`) while `V` is `cameraMode` (`src/core/bindings.ts:67`); `tools/gamepad.html` title renders clean UTF-8 (`"Boreal · Gamepad settings"`) | Fixed-key copy in `src/ui/controls.ts:58` matches live bindings (`2 / 2`) | `0.5000` | `frame-6-controls-screen.png`, `numbers.json` |

### Sampled frames (1280x720, SwiftShader, `origin/main` `6f8a7f0`)
- `refs/controls/controls-rebinding-ui-audit/frame-0-gamepad-settings.png`: Initial `Gamepad settings` screen — 3D controller on left, 7 non-clickable `<span class="tab">` chips (`Game`..`Everywhere`) and non-clickable `.row` entries on right, zero close button.
- `refs/controls/controls-rebinding-ui-audit/frame-1-gamepad-kb-swap-modal.png`: Keyboard rebind `Move forward: W -> S` showing wrong swap target `"A Swap (they get LS ↑)"` instead of `"they get W"`, with zero clickable modal buttons.
- `refs/controls/controls-rebinding-ui-audit/frame-2-gamepad-kb-clash-unflagged.png`: After `Keep both`, `Move forward` and `Move back` both display keyboard `S` and status reads `"Kept both (⚠ clash with Move back)"`, yet neither row displays `⚠` or `.clash` styling.
- `refs/controls/controls-rebinding-ui-audit/frame-3-padmenu-click-dead.png`: `PadMenu` open on `Settings` tab; clicking the `"Gamepad settings"` `.it` row leaves the menu open and does not trigger the item.
- `refs/controls/controls-rebinding-ui-audit/frame-4-help-overlay-trapped.png`: `F1` Controller map (`.padh`) open with 6 context columns (`Chronometer` and `Axis` omitted) and no Close button.
- `refs/controls/controls-rebinding-ui-audit/frame-5-help-traps-escape.png`: Pressing `Escape` while `.padh` is open leaves `.padh` trapped on top while `#start-menu` (`Paused`) opens behind it.
- `refs/controls/controls-rebinding-ui-audit/frame-6-controls-screen.png`: `Controls` screen displaying stale `"V flora view"` copy in `.ctl-screen .note`.

## Objectives
- [ ] Fix clash detection, side-aware swap prompts, and full mouse/pointer support in `src/ui/gamepadSettings.ts` and `src/ui/padMenu.ts`: check every binding in both `b[a.id].keys` and `b[a.id].pad` (not only `pad[0]`) for `.clash` / `⚠` indicators, display the side actually swapped by `swapAssign()` (`keys` vs `pad`) in the clash modal, make `.tab`, `.row`, modal actions (`Swap`/`Keep both`/`Cancel`, `Reset Yes`/`No`), and a Close button clickable with pointer/mouse in `gamepadSettings.ts`, and wire pointer clicks on selectable `.it` rows in `src/ui/padMenu.ts` (clicking focuses & activates `action`/`toggle`, or focuses/adjusts `range`/`choice`).
- [ ] Add `window` `blur` and `document` `visibilitychange` release guards (and unmount cleanup) across `src/ui/controls.ts`, `src/ui/gamepadSettings.ts`, and `src/ui/padMenu.ts` so losing window focus never leaves `held`/`keys` stuck, never deadlocks rebind capture, and never leaves `PadMenu` auto-repeat drifting indefinitely.
- [ ] Fix the `F1` / `View` Controller Help overlay (`src/input/padRouter.ts`) and key suppression (`src/main.ts`): add keyboard `Escape` / `F1` dismissal (closing `.padh` before Pause can open behind it) and a clickable Close button, include `Chronometer` and `Axis` contexts (plus keyboard bindings) in `buttonMap()` / `.padh`, and call `event.preventDefault()` on `F1` and `Tab` in `src/main.ts` when handled in-game.
- [ ] Fix `keyAction()` in `src/input/gamepad.ts` to reuse `keyAtom()` from `src/core/bindings.ts` (so `'+'` -> `'k:plus'` works) and match modifier combos (e.g. `Shift+Tab`), update stale `"V flora view"` fixed-key copy in `src/ui/controls.ts:58` to match live bindings (plus optional per-row unbind parity), verify all 8 checks in `refs/controls/controls-rebinding-ui-audit/audit.ts` score `>= 0.95` with `npm test` & `npx tsc --noEmit` green, and document in `notes/skills/controls-rebinding-ui.md`.
