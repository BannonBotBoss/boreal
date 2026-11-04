# Skill: Resuming a Running World from the Start Menu (`start-menu-resume`)

## When to use
Use this skill when modifying `src/ui/menu.ts` or `src/main.ts` so the start page (`mode === 'start'`, opened by the footer `Menu` button or by pressing `Escape` on the globe) can return to an already-running world without requiring a saved game in `localStorage`.

## Steps
1. **Keep `Continue` gated on `hooks.hasSave()`**:
   - `btn('Continue', close, !hooks.hasSave())` remains the saved-world entry and stays disabled when no save exists.
   - Add `btn('Resume', close)` as the first button on the `Boreal` start page (`src/ui/menu.ts:48`) so clicking `Resume` or pressing `Enter` returns to the live world.
2. **Allow `Escape` and gamepad `B` / `Menu` to close the start menu at root stack**:
   - In `onKey` (`src/ui/menu.ts:89`), `if (stack.length) back(); else close();` dismisses the menu in both `'pause'` and `'start'` modes when not in a sub-page.
   - In `pad` (`src/ui/menu.ts:96`), `hit(1)` and `hit(9)` follow the same rule (`if (stack.length) back(); else close()`).
3. **Make `close()` hide `#start-menu` immediately**:
   - Because `#start-menu` uses `display: grid; transition: opacity .5s` and `#start-menu.fade` uses `opacity: 0; pointer-events: none` (`src/style.css:34`), setting `root.classList.add('fade'); root.hidden = true;` directly inside `close()` preserves the CSS fade while making `root.hidden === true` immediately without a 500 ms `setTimeout` race.
4. **Preserve Globe `Escape` behavior (`T-0034`)**:
   - `onKey` in `src/ui/menu.ts` is a capture-phase listener that returns early when `!open`. Thus when the menu is closed on the globe (`inpage?.mode === 'globe'`), pressing `Escape` reaches `src/main.ts:341` (`openStart()`) and opens the start page; pressing `Escape` a second time is handled by `onKey` (`open === true`) and closes the start page back to the globe.

## Checks that prove it worked
- Unit test (`tests/menu.test.ts`) verifying `Resume` button, `Continue` disabled predicate `!hooks.hasSave()`, immediate `root.hidden = true` on `close()`, and `Escape` closing at root stack.
- Browser capture (`refs/menu/t0051-start-menu-return/capture.mjs`) with cleared save keys verifying:
  - Clicking `#menu-btn` opens `#start-menu` with `Resume` enabled and `Continue` disabled (`continueDisabled === true`).
  - Pressing `Escape` sets `#start-menu.hidden === true` and `className === 'fade'`, keeps `#status` visible, and leaves the player at the same world coordinates.
  - On `?start=globe`, pressing `Escape` still opens the `Boreal` start page.

## Mistakes to avoid
- Enabling `Continue` when there is no save: `Continue` specifically communicates a saved world (`hooks.hasSave()`), whereas `Resume` returns to the currently running session.
- Leaving `setTimeout(() => { if (!open) root.hidden = true; }, 500)` in `close()`: any automated or quick check within 500 ms of pressing `Escape` sees `hidden === false`.
