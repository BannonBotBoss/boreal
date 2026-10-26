# Skill: one centered frame for a multi-layer menu

When to use: a panel that is vertically centered (`top: 50%` and `translateY(-50%)`) and changes height when its content changes, so the top edge jumps. Also when that panel must scroll without a visible scrollbar, and when holding up or down should repeat the selection.

Steps
1. Keep the centering. Do not switch the panel to `top: 0` or remove the translate. Measure the natural border-box height of each layer that must share the box (header + body `scrollHeight` + footer + padding + border). Hide in-flow scroll chrome while measuring, or those bars get counted into the tallest layer.
2. One pure function (`menuFrame`) returns `{ height, top }`: height is the tallest layer capped at the viewport, top is `(viewport - height) / 2`. Set the content-box height to `height - padding - border` so the border-box matches. Recompute on open and on resize, not on every tab switch.
3. Put the header and the footer outside the scroller. Only the body scrolls (`overflow: auto`, `scrollbar-width: none`, webkit scrollbar width 0, `touch-action: pan-y`). The panel itself is `overflow: hidden` and a flex column.
4. Arrow bars are in the flow (not overlays), full width, and `hidden` unless `scrollArrows` says more content lies that way. Because they take space only when shown, the body gets shorter the moment an arrow appears. After setting `scrollTop`, sync the arrows and apply `scrollToReveal` again until the scroll and the arrow visibility stop changing. Otherwise the newly selected row sticks out the bottom by about one arrow height.
5. Selection is the scroll. Up and down call the existing menu model, then reveal the focused row. Wheel and touch still scroll the body; after that scroll, move focus to a selectable row that is fully inside the view (`focusAfterScroll`) and reveal again if the row is still clipped.
6. Hold-to-repeat uses one delay and one rate. If the controller reader already repeats d-pad and stick (`REPEAT` in `src/input/gamepad.ts`, and `contextPresses` feeds `menu.input`), do not start a second timer for those atoms or the selection double-steps. Keyboard (ignore the browser's own `repeat`) and pointer-held arrows use `createHoldRepeat` with the same `REPEAT.delayMs` and `REPEAT.rateMs`: one step on the press, the next after the delay, then one every rate. Stop a pointer hold on `window` `pointerup` / `pointercancel`, because the arrow can hide under the finger when that edge is reached.
7. Document the mapping where the keys are read: layer change stays on the bumpers; d-pad left/right stays adjust; d-pad and left stick up/down, ArrowUp/ArrowDown, and the on-screen arrows move the selection. Give the arrows aria labels.

Checks
- `menuFrame` returns the same height and the same top for every layer. A viewport shorter than the tallest layer returns height = viewport and top = 0.
- `scrollArrows` is false in a direction when that edge is flush. `scrollToReveal` keeps a row fully inside, including a second pass after the view shrinks by the arrow bar.
- `holdStepCount(0)` is 1, `holdStepCount(delay)` is 2, `holdStepCount(delay + rate)` is 3. Stopping one source does not stop another.
- In a browser, `getBoundingClientRect().top` is identical across the layers at a tall viewport (centered), a matching viewport (top 0), and a short viewport (top 0, nothing clipped). A hold on the down arrow moves the focus more than once and stops on pointerup. Stepping past the last fully visible row changes `scrollTop` and the focused row's rect stays inside the body. The same for up.

Mistakes to avoid
- Removing centering to "stop the jump". The jump is the content-sized height under a center transform, not the transform itself.
- `max-height` alone. The box still grows and shrinks below that cap, so the centered top still moves.
- Overlay arrows on top of the rows. They cover the last row. In-flow bars keep the rows readable and shrink the body, which is why the reveal must be settled.
- A second repeat timer on the d-pad or the stick when `createPadReader` already emits `repeat` for `dup`, `ddown`, `ls.up` and `ls.down`.
- Treating `body.scrollHeight` as the visible height. It is the content height even when the flex item is clamped.
