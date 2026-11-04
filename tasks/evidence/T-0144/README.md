# T-0144 the drop lands on the forest

Matthew's check of the live #291 build (software graphics, `?v=291check`): Shift+G showed the round planet, then G stayed black for a long time, the glide was a low-detail green, and the second G took two or three minutes. The wolf then stood under a night sky on a black empty plane. Her grey ring showed. The body, the terrain, and the trees did not, even after walking. The clock read 22:32. No on-page error.

The mama was not under the ground. The camera comes back to the walking clip (near 0.2) about a metre above the soil. Two things made the picture empty:

- The seated fall is a 14 second ease, and the "give up and become the wolf" wait is 15 seconds, but both clocks only moved 0.1 seconds per frame. On software graphics a frame is about a second, so each of those waits stretched to a couple of minutes. The long black is the fall still up in space.
- When that wait expired, the landing was treated as ready even though the ground chunks were still queued. Chunk jobs then lost their place to flowers and grass. Walking did not bring the forest in, because those jobs never got back to the front. The grey ring is the senses halo. It is drawn unlit, so at night it shows when the wolf's body does not. 22:32 is the saved clock on that browser. The drop itself holds the clock, and this capture stayed in the morning.

G now becomes the wolf only once her own chunk is in the scene. Until the landing ring is in, those chunks stay ahead of the flowers and get a real slice of each frame. The fall and the climb advance with the wall clock, capped at half a second a frame, so a slow frame no longer stretches them tenfold. After she is the wolf, streaming uses her eye height again. A leftover glide height used to keep the wide disc.

## Frames

Captured in headless-off Chrome with SwiftShader, 1280×720, `?hour=10`, from a ground load: Shift+G, then G, then G. No headset.

- `sphere.png` — after Shift+G. The planet is a sphere. The prompt is the orbit prompt.
- `glide.png` — G from that sphere. The fall took 39 seconds of wall time on this software GPU (it used to take minutes). Green ground tiles are already in. The prompt says G becomes the wolf.
- `forest-edge.png` — G again. She is the wolf at the edge of the stand, daytime 10:23, snow 0.0 cm. Spruce are in front of her. The camera is behind her, near plane 0.2, about a metre above the ground. The grey ring is the senses halo around a visible wolf. The log is `drop.json`.
- `after-walk.png` — W for a few seconds. The trees stay. The clock moves to 10:25, not to night. More chunks finished while she walked.

## Not checked

This is software GL, not a Quest and not a desktop GPU. A fast machine should take the designed 14 seconds for the fall. The saved night hour on the live site was not replayed; `?hour=10` pins the daytime the contest landing needs.

— grokbot-3
