# Skill: game-music-tracks

Adding or replacing background music tracks in Boreal (first used by T-0033).

## Steps
1. Read src/audio/music.ts (one music module on the BorealSound music bus: limiter, ducking, two-deck crossfade) and src/audio/musicSettings.ts (schema for the shared settings store/panel, saved as boreal.music.v1). Do not add a second player.
2. Generate with ElevenLabs Music (MCP user-Elevenlabs, creative_generate_in_flow, node_type music, model eleven_music_v2_5, generations_count 1, about $0.16 each for 180 s). The prompt describes sound only: genre, instrument, tempo in bpm, mood, "no vocals", "no build-up or climax, even energy for 3 minutes so it can loop". Estimate first with estimate_only.
3. Download the content_url (signed, expires in 2 h) and process with ffmpeg: `loudnorm=I=-20:TP=-3:LRA=11:linear=true`, `afade=t=in:d=1.5`, `afade=t=out:st=<len-5>:d=5`, libmp3lame 96k. Check `ebur128=peak=true`: all tracks within 1 LU of -20 LUFS (the mixer's clip convention in src/audio/mixer.ts).
4. Vocal check (the "Instrumental" flag reads False in the flow even with "no vocals"): faster-whisper small in a venv, decode with ffmpeg to 16 kHz mono numpy (PyAV in the wheel rejects file paths), 10 s windows, vad_filter off. Pass = no segment with no_speech_prob < 0.45. Calibrate: a real voice line mixed at -6 dB over the guitar scores ~0.04. Whisper hallucinates "Thank you for watching!" on music at no_speech 0.7-0.8; that is not a vocal.
5. Put files in public/music, list them in public/music/manifest.json (file, title, source with flow and generation id, licence, prompt, processing, vocalCheck) and in GUITAR_TRACKS in music.ts; tests/music.test.ts keeps the two in step and caps file size.
6. Getting files onto the PC: CopyFromBox drops the file in C:\Users\0 under its basename whatever the destination says, so give staged files a unique prefix and Move-Item them into the worktree. CopyToBox only reads under C:\Users\0, so copy PC outputs there first.
7. Proof: tools/music-shot.mjs <url> <outPrefix> (headless Edge, CDP, killed in finally). It opens Menu > Music with real input events (the first gesture), screenshots the picker, switches track, and lists audio requests through the CDP Network domain. performance.getEntriesByType('resource') stops at 250 entries under Vite dev, so it misses the mp3s.

## Mistakes to avoid
- A level change must not restart the track: rebuild() only calls play() when the deck's file differs.
- Clear ontimeupdate/onended on a deck that is fading out, or it can queue a stray track.
- The panel nests the Volume settings form: drop its legend and Reset button, or they show up twice.
- tsconfig has no DOM.Iterable: use Array.from(NodeList), not spread.