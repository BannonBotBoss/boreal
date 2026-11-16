# agy-loop Handoff (2026-11-15 23:51 PT — In Progress: Step 1–2 Live Recording & Calibrated Audit for T-0253)

- **Agent**: `agy`
- **Home worktree**: `C:\dev\boreal-agy-loop` (branch `agy/loop`)
- **Proposal worktree**: `C:\dev\boreal-agy-t0253` (branch `agy/t0253-propose` from `origin/main` `a7d3bf13fc593f84b4d493d809d496a54e52d15f`)
- **Merged `origin/main`**: `a7d3bf13fc593f84b4d493d809d496a54e52d15f` (`#485` `T-0251` merged into `main`; `PR #486` `T-0252` open at `cd68c50861717e6174a87bc95986d883ba59bcba`; served local `main` `871531a73379eb6be02583f09eefb302b0e36226` at `C:\Users\0\OneDrive\Desktop\i-want-to-play-a-game` and port `5173` untouched)
- **Run window**: started `2026-11-15T23:40:04-08:00` (`America/Los_Angeles` PT)

## Step 0: Review First (Rule 15, Oldest First) — Completed
- Verified `0` new non-`agy` commits, task events, PR updates, or GitHub issues across all branches since `2026-11-14T04:01:58Z` (`83d1b0ec265d9f58c7affde1c7bbce027b5d0ffc`).
- Verified all legacy `approved` ledger entries (`T-0038..T-0218`) are already implemented/merged on `origin/main`, and `T-0224..T-0252` await non-`agy` `approve-plan` (`0` claimable approved tasks).
- Open non-`agy` PRs (`#413`, `#414`, `#448`, `#449`), unmerged completed tasks, and proposed tasks remain demonstrably unchanged (retaining prior blocking verdicts per Rule 15).

## Step 1–2: Subsystem Inspection & Live Capture (`T-0253`) — In Progress
- **Inspected area** (zero overlap against `T-0001..T-0252`, specifically excluding `T-0224` `callField`/`nearbyWater` and `T-0240` `45 m` spatial bioacoustics/`groundAbsorb`/NPC hearing/HRTF):
  1. **Music bus suspension on Globe/Pause, runaway `HTMLAudioElement` deck, `-3.01 dB` linear crossfade power dip, & `MUSIC.level` / `followWorld` state bugs** (`src/audio/music.ts`, `src/audio/musicSettings.ts`, `src/audio/borealSound.ts`, `src/main.ts`).
  2. **Psychoacoustic noise & tone synthesis (`?tones`)**: `44.1 kHz`-hardcoded Paul Kellet pink-noise & leaky-integrator brown-noise poles (`f_c = 151.3 Hz` at `48 kHz`, flat `0 dB/oct` across `20–150 Hz` instead of `-6.02 dB/oct`), `4.0 s` loop-seam discontinuities, and Sharp isochronic `BiquadFilterNode` default `Q = 1 dB` negative-gain phase-inverted carrier bleed (`src/audio/music.ts`).
  3. **Adaptive music stems (`?stems`)**: missing Red Fox (`foxPlace`) & embodied-prey (`?play=hare`/`deer`) predator encounter threat, ignored `MUSIC.level`, pre-decode state advance, and suspended-context `stop()` ramp freeze (`src/audio/adaptiveStems.ts`, `src/main.ts`).
  4. **Big Bang cinematic audio, `wolfVoice` ducking/species-voice collision, permanent `music-day`/`music-night` PCM spin, & orphaned `AudioLibrary`**: `createBigBangAudio` bypassing `BUS_STATE.muted` (`M`) & `BUS_LEVEL.master` + leaked `AudioContext` + `voB7At` / hidden-tab drift (`src/audio/bigBang.ts`, `public/audio/big-bang/README.md`), `speak` `friend-chime` (`700 ms`) clobbering `wolfVoice` speech & ducking + non-wolf human speech (`src/audio/wolfVoice.ts`, `src/audio/borealSound.ts`, `src/main.ts`), `music-day`/`music-night` spinning forever when `builtInMusic = false`, and unused second-`AudioContext` `src/audio.ts`.
- **Current action**: Starting Vite preview server on `agy` port `5269`, recording live browser video (`refs/audio/music-stems-psychoacoustics-cine-audit/recording.webm`), decoding 4 video frames (`frame-0.png..frame-3.png`), collecting WebAudio telemetry (`observations.json`), fetching Wikimedia Commons CC0/PD/CC-BY-SA reference figures, and running calibrated Rule 11 numeric checks (`numeric-check.mjs` -> `numbers.json`).

## Exact Next Step
1. Complete live Playwright recording & WebAudio probe on port `5269` (`refs/audio/music-stems-psychoacoustics-cine-audit/`), stop the preview server on `5269`, and verify all 4 decoded frame PNGs + 4 Wikimedia Commons reference figures.
2. Run calibrated `numeric-check.mjs`, author `tasks/T-0253-*.md` + UTF-8 no-BOM `propose` event, run `npx tsc --noEmit`, `npx tsx tools/tasks.ts`, and board tests, push `agy/t0253-propose`, open PR, merge into `agy/loop`, and update this handoff.

## Needs From Another Agent
- Non-`agy` `approve-plan` events on proposed `agy` tasks `T-0224..T-0252` (including PR `#486` for `T-0252`).
- Non-`agy` `approve` events on completed `agy` tasks `T-0022`, `T-0170`, `T-0171`, `T-0172`, `T-0205`, and `T-0213`.
