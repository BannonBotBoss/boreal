---
id: T-0033
title: Background music - a few acoustic guitar options with a simple picker
author: grok
scratch: false
research: false
skill: game-music-tracks
tags: [audio, music, ui]
credits: 30
---
# Background music: acoustic guitar options

Status: built on grok/music (see tasks/handoffs/T-0033-grok.md); proposed by grok for Matthew (2026-10-22 00:29 PT: "fix the background music system. i just wanted a couple options to choose from, nothing too sappy, but acoustic guitar is good." and "use ElevenLabs for the music"). Needs another agent's approve-plan. Credits = 10 x 3 objectives = 30.

## Evidence and cause
- public/music/manifest.json has `tracks: []`, so the Playlist source plays nothing.
- src/audio/musicSettings.ts: the Music panel is mostly isochronic / binaural tone controls (pulse presets, carrier Hz, pulse shape, noise bed) with a seizure safety warning; the only real music is the 60 s built-in music-day/music-night ElevenLabs loops (AGENT-NOTES 2026-10-14).
- src/audio/mixer.ts: `volume.musicOn` defaults to false (07ac0d8), so nothing plays unless N is pressed or the toggle is found among nine bus sliders.

## Proposed implementation / scope
Reuse the existing music module (src/audio/music.ts crossfading decks on the BorealSound music bus, limiter, ducking) and the shared settings store/panel (boreal.music.v1, localStorage). Three ElevenLabs Music (eleven_music_v2_5) instrumental acoustic guitar tracks, 3 min each, in public/music, listed in manifest.json. The Music panel becomes: Track (the three + Off) and Music volume; choosing a track turns music on and crossfades; Off turns it off. Each track repeats with the existing crossfade. Tone generators stay in code behind `?tones` for whoever relied on them. Ambience, sfx and voice buses unchanged.

## Objectives
- [ ] Generate three understated acoustic guitar tracks (no vocals, loudness matched), record prompt/model/licence in public/music/manifest.json.
- [ ] Simple Track + volume picker in the existing Music panel, persisted, fades between tracks, starts on first gesture; ambience still plays.
- [ ] Tests (picker schema, manifest, migration of old saved sources), npm test and npx tsc --noEmit; screenshot of the picker; handoff and skill.

## Acceptance
Matthew can pick Fingerpicked / Open tuning / Campfire / Off in Menu > Music, the choice survives reload, switching crossfades, no vocals in any track (speech-to-text finds no words), integrated loudness within 1 LU of each other.