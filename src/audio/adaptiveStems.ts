/**
 * Adaptive music stems (Grok Bot / Music): four seamlessly looping stems that crossfade with the world.
 * night (dark drone) | day (warm pad) | weather (muted swell) | tension (soft 6 Hz-grid gated pulse).
 * Rendered offline from Matt's sample-lab skill chains (original synthesis; see public/music/stems/manifest.json),
 * all in A minor pentatonic at 90 BPM, so any two stems are consonant. Each loop is exactly 32 bars = 3,763,200 frames
 * @ 44.1 kHz (85.333 s), so the loop point lies on a bar line and an Ogg Vorbis decode is sample-exact.
 * Playback: each stem is decoded once to an AudioBuffer and looped by an AudioBufferSourceNode (gapless; no MP3 padding,
 * no HTMLAudioElement). Native Web Audio only. The pure functions below hold all the logic and are unit-tested;
 * everything that touches an AudioContext is in `startStems`.
 * All constants here are game calibration (taste + headroom), not measurements: there is no published model for them.
 */
export const STEM_IDS = ['night', 'day', 'weather', 'tension'] as const;
export type StemId = typeof STEM_IDS[number];
export type StemWeights = Record<StemId, number>;
export const STEM_FILES: Record<StemId, string> = { night: 'boreal-night.ogg', day: 'boreal-day.ogg', weather: 'boreal-weather.ogg', tension: 'boreal-tension.ogg' };
/** 32 bars at 90 BPM, 44.1 kHz: the exact decoded length of every stem. */
export const STEM_FRAMES = 3_763_200, STEM_RATE = 44100, STEM_SECONDS = STEM_FRAMES / STEM_RATE;
/** Headroom: each stem peaks near -6 dBFS (true peak -5.9 .. -7.3 dBTP) and the music chain's limiter (music.ts) starts at -10 dBFS (.316).
 * The stem output gain times the summed stem gains times the loudest stem peak (.5) stays at or under that threshold: .6 * 1 * .5 = .3. */
export const STEM_MASTER = .6, STEM_SUM_CAP = 1;
/** Crossfade time constants in seconds (the full move takes about 3x). Up = the stem gets louder, down = quieter. */
export const STEM_TAU: Record<StemId, { up: number; down: number }> = { night: { up: 6, down: 6 }, day: { up: 6, down: 6 }, weather: { up: 5, down: 8 }, tension: { up: .8, down: 3 } };
/** Threat hysteresis: tension turns on at THREAT_ON, off below THREAT_OFF, and once on stays at least THREAT_HOLD seconds. */
export const THREAT_ON = .5, THREAT_OFF = .25, THREAT_HOLD = 12;

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
export const smoothstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Target gain for each stem from view.darkness() (0 day .. 1 night), rain (0..1, as music.update gets it) and threat (0..1).
 * Night/day are equal-power around dusk; rain brings the weather stem in and ducks day/night; threat brings tension in and ducks the bed.
 * The sum is capped at STEM_SUM_CAP so layered stems stay under the music limiter's threshold. */
export function stemWeights(darkness: number, rain: number, threat = 0): StemWeights {
  const s = smoothstep(.35, .65, darkness), w = smoothstep(.15, .6, rain), th = clamp01(threat), duck = (1 - .5 * w) * (1 - .3 * th);
  const raw: StemWeights = { night: Math.sin(Math.PI / 2 * s) * duck, day: Math.cos(Math.PI / 2 * s) * duck, weather: .8 * w, tension: .6 * th };
  const sum = raw.night + raw.day + raw.weather + raw.tension, k = sum > STEM_SUM_CAP ? STEM_SUM_CAP / sum : 1;
  return { night: raw.night * k, day: raw.day * k, weather: raw.weather * k, tension: raw.tension * k };
}

/** One step of an exponential approach (the same curve as AudioParam.setTargetAtTime): after `tau` seconds 63 % of the gap is closed. */
export const stepToward = (cur: number, target: number, dt: number, tau: number) => target + (cur - target) * Math.exp(-Math.max(0, dt) / Math.max(1e-6, tau));
export const stemTau = (id: StemId, rising: boolean) => rising ? STEM_TAU[id].up : STEM_TAU[id].down;

export interface ThreatState { on: boolean; since: number }
/** Schmitt trigger with a minimum on-time. Returns the new state and the threat level to use (0 while off; at least THREAT_ON while on). */
export function threatStep(s: ThreatState, threat: number, t: number): { state: ThreatState; level: number } {
  const x = clamp01(threat); let on = s.on, since = s.since;
  if (!on && x >= THREAT_ON) { on = true; since = t; }
  else if (on && x < THREAT_OFF && t - since >= THREAT_HOLD) on = false;
  return { state: on === s.on && since === s.since ? s : { on, since }, level: on ? Math.max(x, THREAT_ON) : 0 };
}

/** Loop points for a decoded buffer: the whole stem. A decoder that trims a few frames still gets a loop that ends at its own end. */
export function loopPoints(durationSec: number): { loopStart: number; loopEnd: number } {
  return { loopStart: 0, loopEnd: Math.min(STEM_SECONDS, durationSec > 0 ? durationSec : STEM_SECONDS) };
}

const cache = new Map<StemId, AudioBuffer>();
async function load(ctx: AudioContext, id: StemId, base: string): Promise<AudioBuffer | undefined> {
  const hit = cache.get(id); if (hit && hit.sampleRate === ctx.sampleRate) return hit;
  try {
    const res = await fetch(`${base}${STEM_FILES[id]}`); if (!res.ok) return undefined;
    const buf = await ctx.decodeAudioData(await res.arrayBuffer()); cache.set(id, buf); return buf;
  } catch { return undefined; /* missing or undecodable: that stem stays silent, like the sound clips */ }
}

/** Start the four stems on `to` (the music master). Call only once the AudioContext exists (after the player's first gesture, as BorealSound does).
 * Stems start together on one clock so they stay phase-aligned. Memory: four decoded stereo buffers, about 30 MB each at 44.1 kHz. */
export function startStems(ctx: AudioContext, to: AudioNode, base = 'music/stems/') {
  const out = ctx.createGain(), gains = {} as Record<StemId, GainNode>, cur = {} as Partial<StemWeights>;
  const sources: AudioBufferSourceNode[] = []; let dead = false, last = ctx.currentTime, threatState: ThreatState = { on: false, since: -1e9 };
  out.gain.value = 0; out.gain.setTargetAtTime(STEM_MASTER, ctx.currentTime, 1.5); out.connect(to);
  for (const id of STEM_IDS) { const g = ctx.createGain(); g.gain.value = 0; g.connect(out); gains[id] = g; }
  void Promise.all(STEM_IDS.map(id => load(ctx, id, base))).then(bufs => {
    if (dead) return; const t0 = ctx.currentTime + .15;
    bufs.forEach((b, i) => {
      if (!b) return; const src = ctx.createBufferSource(), p = loopPoints(b.duration);
      src.buffer = b; src.loop = true; src.loopStart = p.loopStart; src.loopEnd = p.loopEnd; src.connect(gains[STEM_IDS[i]]); src.start(t0); sources.push(src);
    });
  });
  return {
    /** Per frame (cheap). threat is 0..1 and optional; nothing in the game feeds it yet. */
    update(darkness: number, rain: number, threat = 0) {
      if (dead) return; const now = ctx.currentTime, dt = Math.min(.5, now - last); last = now;
      const th = threatStep(threatState, threat, now); threatState = th.state;
      const target = stemWeights(darkness, rain, th.level);
      for (const id of STEM_IDS) {
        const c = cur[id] === undefined ? target[id] : stepToward(cur[id]!, target[id], dt, stemTau(id, target[id] > cur[id]!)); cur[id] = c;
        gains[id].gain.setTargetAtTime(c, now, .05);
      }
    },
    /** Fade out over `fade` s, then stop and free the sources (the decoded buffers stay cached for a quick restart). */
    stop(fade = 2) {
      if (dead) return; dead = true; const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(out.gain.value, now); out.gain.linearRampToValueAtTime(0, now + fade);
      setTimeout(() => { for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } s.disconnect(); } for (const id of STEM_IDS) gains[id].disconnect(); out.disconnect(); }, fade * 1000 + 100);
    },
  };
}
export type Stems = ReturnType<typeof startStems>;
