
### Update 4 (Matthew, 07:22 PT): after resting, the log keeps changing
Once down, the log can no longer photosynthesize, oxidizes (transactions with other elements transform it) and slowly
decays into fallen trunk. Closed ONGOING steps: `ceased` -> `oxidized` -> `decaying`. Ongoing steps follow the anchor (the
last event step) rather than replacing it: a contact compares against the anchor, so a decaying log still reads as resting
on the ground and the same contact stays a no-op; a new event (moved) appends after them. To stay within WHY_MAX = 16
without touching the physics, `grew` and `leafed` are merged into one step ("grew and leafed out"; `leafed` left the list).
Standing trees still stop before failed (they end at grew). Final log chain (16 steps):
photosynthesis -> formed a seed -> seed dispersed -> sprouted from the ground -> grew and leafed out -> weathered over time
-> a weak point built up -> failed under its own mass -> pulled down by gravity -> tipped over -> displaced the ground
(the earth yields) -> settled (forces balanced) -> resting on the ground -> no longer photosynthesizing -> oxidizing
(reacting with other elements) -> decaying into fallen trunk over a long time.
Inspector "why now" for a log: "Fallen wood - resting on the ground, decaying into fallen trunk over a long time".
