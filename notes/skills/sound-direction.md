# Skill: a compass sound is a direction and an urgency

Use when a heard snap is shown to the player, or when a later sense wants the same compass line. T-0097, roadmap step 25. Issues #104, #105, and #106. #106 wins the bytes. The cue list is already `createSoundCues`. Do not build a second sound system.

## Steps
1. Keep cues on `createSoundCues` in `src/core/senses.ts`. `audio.onSpatialCue` is the only way a clip becomes a cue. Do not store a species name on the caption, and do not store a distance in metres.
2. Write one cue as the 28-byte sound entry from issue #106 (`cueSoundEntry`). The order is category `u16`, urgency `u16`, intensity `f32`, direction `f32` × 3, age `f32`, then 4 reserved bytes. `PERCEPTION.soundBytes` is 28. Category stays 0 here: the line says "something", not a species and not #105's category string.
3. Direction is a unit vector in the listener frame (x to the right, z forward). `bearingTo` already returns that angle. Urgency is a game-calibration word for the cue's existing 0–1 level, split in thirds: under 1/3 soft, under 2/3 clear, otherwise loud. It is not a hearing distance.
4. The caption is `soundCaption`, which calls `readSoundEntry`. That reader is the same one `readPerception` uses for each sound in the block. A slice that is not 28 bytes is refused. The words come from the direction vector and the urgency code. Changing intensity or category does not change the words.
5. The compass still drops a cue past `SENSES.range`. That value stays the wolf species row `hearing.rangeM` (40 m). The row is already labelled game calibration. Do not add a second range.
6. The listening line and each compass mark use the caption. Quiet stays "Quiet nearby". Scent cards are step 24. Leave them.

## Checks that prove it worked
- `tests/sound-caption.test.ts`: the known fixture's first sound (28 bytes, direction +x, urgency 2) reads "something, right, loud". The next sound, 28 bytes later, reads "something, ahead, loud". Neither string has a species or a digit.
- A cue whose id is `deer-snort` still sits on `createSoundCues`, and its caption does not contain "deer".
- `SENSES.range` equals `WOLF_NEEDS.senses.hearing.rangeM.v`, and the species file still says `game calibration` on that row.
- `src/ui/senses.ts` calls `createSoundCues` and `soundCaption(cueSoundEntry(`, and it no longer has `soundNames`.
- `npx tsc --noEmit` and `npm test` pass.

## Mistakes to avoid
- Printing the clip id with the hyphens turned into spaces. That puts "deer snort" and "wolf howl" back on the compass.
- Putting metres, or the hearing range, in the caption. A snap is not "40 m".
- A second cue list, or a TypeScript writer for the whole perception frame. One entry is packed for the caption. The frame writer stays in Rust.
- Treating #105's `"category": "BranchSnap"` as the line the player reads. #106 stores a `u16`, and step 25's line is "something".
- Editing the camera files on `grokbot-3/one-viewpoint`. This step does not touch them.
- Changing `SENSES.range` or the species hearing row to make the caption feel nearer.
