# Skill: a sense is a picture, and strength is how solid it is

Use when the wolf senses panel should show a signal without naming what made it. T-0100. Matthew asked for simple pictures whose transparency is the strength, bubbling up and floating away. Issues #105 and #106. #106 wins the bytes. Hearing stays on `createSoundCues`.

## Steps
1. Read a heard snap with `signalFromSound(cueSoundEntry(...))`. That calls `readSoundEntry`. The picture uses intensity and the direction vector. It does not use the category, the clip id, or a distance.
2. Read a smell with `signalFromScent(hit, key)` on the hit `smell()` already returned. Copy the level and the bearing. The key is `scent:` plus the list index, not the body's kind. A close body can also offer `signalFromSight` from `perceive().sight`, with a `sight:` index key. That picture is an eye, not the body.
3. Map strength with `signalOpacity`. The floor is `SENSE_PICTURES.opacityFloor` (0.18) and the top is `opacityCeil` (0.94). Both are game calibration of "nearly see-through" and "nearly solid". A faint icon stays above the floor at birth, then fades to nothing as it floats away.
4. Offer the signal to `createSenseStream`. One key re-emits only after `SENSE_PICTURES.reemit` (six panel refreshes, 0.9 s). The live list never grows past `SENSE_PICTURES.cap`, which is `PERCEPTION.caps.sound` (8, issue #106). A life is `THOUGHT_RULES.fade` (1.75 s), the need-thought fade.
5. Draw with a DOM node and an inline SVG from `SENSE_GLYPH`: a ripple for sound, a wisp for scent, an eye for sight. Place it with `bubbleLook`: `side` and `tilt` follow the bearing, `ahead` keeps a behind signal lower. Set `opacity` and `transform` each frame. No new dependency.
6. The compass arrows stay. Their accessibility label may still be `soundCaption`. Do not put that sentence, a percent, or a species name in the panel text. `?sensepic=` is a screenshot hook only.

## Checks that prove it worked
- `tests/sense-pictures.test.ts`: opacity rises with strength, the ratio at one age matches `signalOpacity`, and a dead bubble is gone at `life`.
- Offering more than the cap leaves the list at the cap. The same key does not spawn again until the re-emit interval.
- A bearing of +π/2 sits to the right. −π/2 sits to the left.
- The known perception fixture becomes two sound pictures and one scent picture. Salience values 91 and 2 are not drawn. The cue id `deer-snort` and the hit key `hare:4` do not appear on the signal. Glyphs and aria labels have no species and no metres.
- `src/ui/senses.ts` has a `sense-stream` and no "Quiet nearby", "Listening", "strong scent", or species caption.
- `npx tsc --noEmit` and `npm test` pass.

## Mistakes to avoid
- Drawing the old scent cards (a deer, a hare, a person) or printing "Known friend". That names the animal.
- Using a category code or `sourceSpecies` as a picture. Those numbers are not a species the panel may show.
- Rescaling a salience of 91 into opacity. Only a 0..1 level already on the buffer is a strength.
- Spawning a bubble on every frame. The cap stops the flood, and the re-emit interval stops a steady signal from filling the cap in one moment.
- A second cue list, or a new perception writer. Pack the snap with `cueSoundEntry` and read it back.
- `Math.random` for the drift. The wobble is `sin` of age and id.
