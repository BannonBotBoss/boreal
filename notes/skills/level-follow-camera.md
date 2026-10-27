# Skill: keep the follow camera level and straight ahead

Use when the third-person view looks tilted, or when the wolf is no longer in front of the lens. The forest follow view is one function, `positionCamera` in `src/render/math.ts`. Do not add a second camera.

## Steps
1. Measure before changing anything. Call `positionCamera` at the reported stand and read three numbers: roll (`asin` of the camera's right-vector y; 0 is level), pitch (`asin` of the forward y), and heading offset (the angle between the horizontal look direction and the wolf's forward, `(-sin yaw, -cos yaw)`). Also fit the sky-to-ground line in a screenshot of that same stand. A level far horizon with a large heading offset means the lens is beside the animal, not that the camera is rolled.
2. Check git history on `positionCamera` and `SYSTEM_PROPERTIES.camera.flank`. T-0075 (`4ae9f46`, 2026-10-25) set flank to 2.25 m, which aims 32° off the tail. Snow, weather, and coat changes can make a diagonal shore easier to see. They are not a camera change unless the diff touches `positionCamera`.
3. Fix it inside `positionCamera`. Set `camera.up` to `(0, 1, 0)` on every call, before `lookAt`. Three.js rolls the view when `camera.up` follows the ground. Sit the lens on the tail line (`flank` 0) and aim along `yaw + lookYaw`. Keep the existing pitch (near level, currently −5°). Leave the wolf's tilt group alone. The animal may lean with the slope.
4. If another branch drives the forest floor from a planet camera, carry the same rule across. Set the forest camera's up to world Y and look along the heading, or keep calling `positionCamera`. Do not copy a globe up-vector or a terrain normal into the embodied view. A pose that already writes Euler roll 0 can stay.
5. Lock it with a test on a real sloped dry cell: a caller that sets `camera.up` to the ground gradient, then `positionCamera`, must come out with roll under 0.5°, a world-horizontal line under 0.5° on screen, pitch near level, and the lens straight behind the heading.

## Checks that prove it worked
- The slope test in `tests/render-math.test.ts` passes. Known failure before the up-vector reset: about −10° of roll on a 12° slope.
- `frameSample()` bearing is within 0.5° of 0. The issue #52 scorer still gives 1 to a 32° rear three-quarter and under 0.95 to dead astern. That scorer records the old framing. It is not the live aim.
- Same place, same clock, before and after: Kenora, day 15, hour 12. The far horizon fit on the straight-ahead frame stays within 0.5°. A diagonal shoreline may still slope. That is the ground, and the camera must not roll to hide it.

## Mistakes to avoid
- Adding a second camera, or editing another agent's viewpoint branch to "put the fix where the new camera will be." Put it in `positionCamera`. Say in the pull request what to copy if a later pose stops calling that function.
- Zeroing the wolf's body roll. The lean belongs to the animal.
- Treating a diagonal lake edge as camera roll when the far sky line is already level. Read the heading offset first.
- Leaving `camera.up` for the caller to reset. `lookAt` uses whatever up it finds. The reset has to live in `positionCamera` or the next caller that banks the camera brings the tilt back.
