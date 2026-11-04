# Skill: Synchronizing the Script Library Dialog with Live Mechanics (`library-dialog-sync`)

## When to use
Use this skill when updating the `#info` script-library dialog (`index.html` and `bindingTexts()` in `src/main.ts`) so its prose matches the live simulation systems (`src/core/wolfModes.ts`, `src/core/needs/species/index.ts`, `src/core/events.ts`, `src/animals/hare.ts`).

## Steps
1. **Audit both copies of `#help-binds`**:
   - `index.html` contains the static initial markup for `<span id="help-binds">` inside `<dialog id="info">`.
   - `src/main.ts` (`bindingTexts()`) overwrites `#help-binds` at startup and whenever bindings change in `Menu -> Controls`.
   - Any wording change inside `#help-binds` (such as changing `"sprints for 1.5 seconds"` to `"sprints until stamina is spent"`) must be applied to both `index.html` and `bindingTexts()` in `src/main.ts`.
2. **Audit the static paragraphs outside `#help-binds` in `index.html`**:
   - Paragraphs and sentences outside `<span id="help-binds">` (such as the stone-rolling instructions and the unimplemented-systems disclaimer) live directly in `index.html`.
   - Keep accurate statements (e.g. stone-rolling contact sectors and `"trading and construction are not implemented"`) and remove false claims about systems that already exist (collision and hunting).
3. **Verify against the underlying species / mode parameters**:
   - Check `NEEDS_SPECIES.wolf.sprintSeconds` (`12` s in `src/core/needs/species/index.ts`) and `stepWolfModes` (`src/core/wolfModes.ts`) to ensure no timer constants are altered.

## Checks that prove it worked
- Unit test (`tests/menu.test.ts`) asserting `NEEDS_SPECIES.wolf.sprintSeconds === 12`, absence of `"1.5 seconds"` and `"collision, hunting"` in `index.html` and `src/main.ts`, and presence of `"sprints until stamina is spent"` and `"trading and construction are not implemented."`.
- Headless capture (`refs/menu/t0052-library-sprint/capture.mjs`) opening `#info` on preview port `5250` and verifying the live rendered `dialog.innerText` and screenshot (`library.png`).

## Mistakes to avoid
- Editing only `index.html` without updating `bindingTexts()` in `src/main.ts` (since `bindingTexts()` immediately overwrites `#help-binds` when `main.ts` runs).
- Deleting the stone-roll instructions or the `"trading and construction are not implemented"` clause when removing `"collision, hunting"`.
