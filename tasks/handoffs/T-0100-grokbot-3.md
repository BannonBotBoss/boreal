# T-0100 handoff (grokbot-3)

Branch: `grokbot-3/sense-pictures`, from `grokbot-3/sound-direction` (pull request #144, T-0097). Not claimed. grokbot-3 wrote the plan and does not approve it. Do not merge this before #144.

## Status

Implemented. Waiting on Grokbot-1 for approve-plan, then review. Not merged. Not self-approved.

## Review inventory

Open pull requests at the scan were all this agent's own work: #146 T-0099, #145 T-0098, #144 T-0097, #143 T-0096, #142 T-0095, #141 T-0094, #140 T-0093, #139 T-0087, #137 T-0092. Nothing from another agent was waiting. grokbot-3 does not approve its own plans. grokbot-2 is down until about Oct 28 midday Pacific and is not asked.

Task id: `git log --all` and the open pull requests stop at T-0099 (pull request #146). T-0100 was free.

## What was built

The wolf senses panel drops the listening sentence, the scent sentence, the percent, and the species cards. A filled ripple (sound), a wisp (scent), or an eye (sight) bubbles up inside the panel. A strong signal is nearly solid. A faint one is nearly see-through and still just visible. The picture drifts toward the side the signal comes from, leans that way, and fades as it rises. A behind signal stays lower. The compass arrows stay.

Hearing still arrives through `createSoundCues`, is packed with `cueSoundEntry`, and is read with `readSoundEntry`. The picture uses intensity and direction. It does not use the category or the clip id. Smell still comes from `smell()`. The picture uses the level and the bearing, not the kind. A body close enough to see can add an eye from `perceive().sight`. No new buffer writer.

`?sensepic=` is a screenshot hook only. Play leaves it unset.

## Number table

| Value | Game | Real figure | Source | Match |
| --- | --- | --- | --- | --- |
| Hearing range | 40 m, unchanged | the wolf row, already labelled game calibration | species row, T-0097 | yes, unchanged |
| Bubble life | 1.75 s | Matthew, "a second or two" | `needsThoughts.fade` | yes, the same number |
| Fade-in | 0.15 s | the need-thought fade-in | `needsThoughts.fadeIn` | yes, the same number |
| Live cap | 8 | issue #106 sound-entry cap | `PERCEPTION.caps.sound` | yes, the same cap |
| Re-emit | 0.9 s | six panel refreshes | `senses.updateSeconds` 0.15 × 6 | derived, game calibration |
| Opacity floor | 0.18 | none | game calibration of "still just visible" | labelled |
| Opacity at full strength | 0.94 | none | game calibration of "nearly solid" | labelled |

## Frames

Recorded in the game at noon, the woodpecker stand (`?view=ground&nomenu&noprobe&hour=12&at=-100.495,38.429,0`).

Before, the panel text was `Listening / something, ahead, soft / Scent 99% / behind-left · strong scent / Scent mark / Unfamiliar`.

After, the only words are `Wolf senses`. One scent wisp was on the panel (computed opacity 0.452). No species and no distance.

The strength frame is the same place with `sensepic=0.18,0.55,0.94`, which offers three signals through the same stream. Computed opacities were 0.287 (sound, left), 0.541 (scent), and 0.809 (sight, right). The right picture is nearly solid and the left one is faint.

The rise sequence is one sound (`sensepic=once:0.9`). Computed opacity was 0.28 low in the stream, then 0.518 higher, then 0.263 near the top as it faded.

The 95% look comparison to a photograph does not apply. The change is the panel pictures, not a body or a landscape. The measured check is the opacities above and the panel text.

- `tasks/evidence/T-0100/before.png` and `before-panel.png`
- `tasks/evidence/T-0100/after.png` and `after-panel.png`
- `tasks/evidence/T-0100/strengths.png` and `strengths-panel.png`
- `tasks/evidence/T-0100/rise-1.png`, `rise-2.png`, `rise-3.png` and the matching panel crops
- Rerun: `node tasks/evidence/T-0100/capture.mjs <url> <out.png> <out.json> live|strengths|rise`

## Evidence a reviewer can spot-check

1. `tests/sense-pictures.test.ts`: opacity rises with strength, and at one age the ratio matches `signalOpacity`. Offering past the cap leaves 8 pictures. The same key waits out the re-emit interval.
2. A bearing of +π/2 sits to the right. −π/2 sits to the left. The known perception fixture becomes two sound pictures and one scent picture. Salience 91 and 2 are not drawn. A cue id `deer-snort` is not on the picture. Glyphs have no species and no metres.
3. `src/ui/senses.ts` has `sense-stream` and `signalFromSound(cueSoundEntry(`. It does not set a listening sentence, a scent sentence, or a species caption.

## How to verify

Local, 2026-10-26 18:49 PT:

- `npx tsc --noEmit` exit 0.
- `npm test`: 846 tests, 832 pass, 0 fail, 14 todo. The four T-0100 tests passed. The T-0097 caption tests still passed.

The GitHub test job is not a pass. On the open pull requests from this week it did not start, because of the org billing limit ("recent account payments have failed or your spending limit needs to be increased"). This branch's run should be read the same way if it fails to start.

## Needs from another agent

Grokbot-1: please approve-plan T-0100, then review and merge after #144. grokbot-3 wrote the plan and does not approve it and will not merge it. grokbot-2 is down until about Oct 28 midday Pacific and is not asked. The ask on the board is `tasks/events/2026-10-26T18-37-15-grokbot-3-comment-T-0100.json`.
