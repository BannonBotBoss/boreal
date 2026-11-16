# Reference Figures — Music, Adaptive Stems, Psychoacoustics, Mixer & Big Bang Audio Audit (`T-0253`)

All four reference images are unmanipulated Public Domain or CC BY-SA figures retrieved from Wikimedia Commons:

1. **`ref-0.png`** — *WMAP 9-Year Cosmic Microwave Background Temperature Fluctuations (~380,000 yr Recombination Acoustic Horizon)*
   - **Source**: Wikimedia Commons, `File:WMAP_2012.png` (`https://commons.wikimedia.org/wiki/File:WMAP_2012.png`)
   - **Author**: NASA / WMAP Science Team
   - **Licence**: Public Domain (`PD-USGov-NASA`)
   - **Audit correspondence (`frame-0.png`)**: Cosmological recombination radiation surface (`~380 kyr`, `vo-b7-light.mp3` beat `B7`) preceding cosmic Dark Ages (`B8`, `60–66 s`, where `LATER_AUDIO.darkDb = -8 dB` specifies ducking `cue2-emergence.mp3`) and First Stars (`B9`, `66.5 s`), where all cinematic narration, beds, impacts, and star ticks must honour the user's master volume/mute bus and single-context lifecycle.

2. **`ref-1.png`** — *Power Spectral Density Slopes of the Colors of Noise ($1/f^\beta$: White $0\text{ dB/oct}$, Pink $-3\text{ dB/oct}$, Brown/Red $-6\text{ dB/oct}$)*
   - **Source**: Wikimedia Commons, `File:The_Colors_of_Noise.svg` (`https://commons.wikimedia.org/wiki/File:The_Colors_of_Noise.svg`)
   - **Author**: AkanoToE
   - **Licence**: CC BY-SA 4.0 (`https://creativecommons.org/licenses/by-sa/4.0/`)
   - **Audit correspondence (`frame-1.png`)**: Reference $1/f^2$ Brownian/red noise (`-6.02 dB/octave` across the full `20 Hz–20 kHz` audible band, Voss & Clarke 1978 *J. Acoust. Soc. Am.* 63:258) and $1/f$ pink noise (`-3.01 dB/octave`, Paul Kellet 1999) plus equal-power crossfading (`0.00 dB` constant power, Roads 1996) and unipolar `[0, 1]` isochronic gating (Oster 1973), contrasted against `music.ts` on `48 kHz` WASAPI (`f_c = 151.3 Hz` flattening `25–100 Hz` brown noise to `-0.58 dB/oct`, `4.0 s` wrap-around step clicks, `-3.01 dB` linear crossfade hole, negative-gain `Q = 1 dB` carrier bleed, and suspended-`AudioContext` silence on the Globe & `Menu -> Music` picker).

3. **`ref-2.jpg`** — *Snowshoe Hare (*Lepus americanus*) Alert Anti-Predator Vigilance in Boreal Habitat*
   - **Source**: Wikimedia Commons, `File:Lepus_americanus_5459_cropped.jpg` (`https://commons.wikimedia.org/wiki/File:Lepus_americanus_5459_cropped.jpg`)
   - **Author**: Walter Siegmund (`Wsiegmund`)
   - **Licence**: CC BY-SA 3.0 (`https://creativecommons.org/licenses/by-sa/3.0/`)
   - **Audit correspondence (`frame-2.png`)**: Real predator-prey encounter urgency when a snowshoe hare (*Lepus americanus*) or maternal den faces a stalking canid/vulpid predator (*Vulpes vulpes* / *Canis lupus*, Sheriff et al. 2009 *J. Anim. Ecol.* 78:1249; Issue `#309`), contrasted against `main.ts` passing only NPC hares and NPC deer into `encounterThreat` (`threat = 0.0000` when embodied prey flees a predator or `foxPlace()` stalks within `35 m`), `music.ts` ignoring `MUSIC.level` on `Adaptive stems`, and `BorealSound` spinning `music-day` + `music-night` `AudioBufferSourceNode`s forever while `builtInMusic = false`.

4. **`ref-3.jpg`** — *White-Tailed Deer (*Odocoileus virginianus*) Social Maternal & Intraspecific Contact in Nature*
   - **Source**: Wikimedia Commons, `File:White-tailed_deer_(Odocoileus_virginianus_nelsoni)_female_with_fawns_Orange_Walk.jpg` (`https://commons.wikimedia.org/wiki/File:White-tailed_deer_(Odocoileus_virginianus_nelsoni)_female_with_fawns_Orange_Walk.jpg`)
   - **Author**: Charles J. Sharp (Sharp Photography)
   - **Licence**: CC BY-SA 4.0 (`https://creativecommons.org/licenses/by-sa/4.0/`)
   - **Audit correspondence (`frame-3.png`)**: Species-authentic cervid intraspecific acoustic communication (soft contact grunts, bleats, and alarm snorts; Atkeson, Marchinton & Miller 1988 *Am. Midl. Nat.* 120:194–200) and clean speech-over-music ducking + ITU-R BS.1770-4 `-1 dBTP` true-peak headroom, contrasted against `main.ts` / `wolfVoice.ts` displaying `🐺 “...”` in human male English (`Adam`) when embodied as a White-tailed Deer (`?play=deer`), `friend-chime` firing at `700 ms` to clobber `playVoice` ducking mid-sentence, and `+16.8..+18.0 dB` `CLIP_TRIM_DB` boosts pushing `6` SFX clips up to `+18.0 dBFS` (`7.94x` linear clipping) above `-1 dBFS`.
