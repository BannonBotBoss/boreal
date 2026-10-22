# T-0033 handoff (grok)

Branch grok/music, worktree C:\dev\boreal-grok-music (from main a436a9d). Preview Vite: http://127.0.0.1:5233/ (serving this worktree).

## Status
Done and approved. Matthew approved in chat at 01:30 PT (i can approve work, then Approve the music picker as finished (T-0033)), recorded per rule 16. Events: 01-30 approve-plan, 01-31 claim, 01-32 complete, 01-32 approve. Merged to main by grok.

## What was wrong
- public/music/manifest.json had no tracks, so the Playlist source was silent.
- The Music panel was mostly isochronic/binaural tone controls with a seizure warning. The only real music was the 60 s built-in music-day/night loops.
- volume.musicOn defaulted to false (07ac0d8), so no music played unless N was pressed.

## What was built
- public/music/guitar-{fingerpicked,opentuning,campfire}.mp3: ElevenLabs Music eleven_music_v2_5, 180 s each, 96 kb/s, 2.16 MB each. Prompts, ids and licence are in manifest.json.
- src/audio/music.ts: GUITAR_TRACKS. A picked track repeats on the existing two-deck 4 s crossfade, switching track or choosing Off fades it out, and a level change does not restart the track.
- src/audio/musicSettings.ts: the Track select offers Fingerpicked / Open tuning / Campfire / Off and is saved in boreal.music.v1. Old saved sources ('Built-in ambient' etc.) fall back to Fingerpicked. Tones, playlist, built-in loops and the safety note only appear with ?tones.
- src/main.ts musicPanel shows Track, then the Volume sliders (Music slider = music volume). Picking a track sets volume.musicOn true; Off sets it false.
- src/audio/mixer.ts: musicOn default true.
- tools/music-shot.mjs: headless proof script. tests/music.test.ts: picker, persistence and migration, manifest/file checks.

## How to verify
Menu > Music: pick a track and hear it crossfade. Reload: the pick is kept. Run `node tools/music-shot.mjs http://127.0.0.1:5233/?trees=v2 refs/music/T-0033`.
Evidence: refs/music/T-0033-picker.png, refs/music/T-0033-campfire.png. The script output showed amb-day, amb-night, wind-pines and water plus guitar-fingerpicked requested after the first gesture, guitar-campfire after switching, the saved boreal.music.v1 source = Campfire, and no page errors.

## Numbers
| value | game | real / reference | ok |
|---|---|---|---|
| loudness | -19.6 / -20.5 / -20.0 LUFS | -20 LUFS mixer clip convention (src/audio/mixer.ts, measured with ffmpeg ebur128) | yes, within 1 LU |
| true peak | <= -5.5 dBFS | <= -1 dBTP (EBU R128 / ITU-R BS.1770) | yes |
| track length | 180 s | brief: several minutes per loop | yes |
| crossfade | 4 s (existing MUSIC.crossfade) | unchanged | yes |
| file size | 2.16 MB each | brief: compressed, small | yes |

## Gates (rule 11)
The frame gate does not apply to audio, so measured substitutes are used:
- Vocals: faster-whisper small, 10 s windows. All three tracks have no segment with no_speech < 0.45. Calibration: known match (a real voice line at -6 dB over guitar) = 0.04, detected; the clean guitar-only tracks are the known mismatch.
- Picker presence: DOM read plus screenshot (above).
- "Not sappy" is Matthew's call. Matthew should listen and say if any track should be regenerated.

## Tests
npm test: 353 pass, 0 fail (an earlier run hit the known timing flake in surfaceAt; it passes alone). npx tsc --noEmit is clean.

## Needs from another agent
- None. Optional: Matthew listens and asks for any track to be regenerated.