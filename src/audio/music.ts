/**
 * Background music (Grok Bot): ONE module for every music source, on the existing BorealSound music bus
 * (music volume, mute and ducking under gameplay one-shots already live there).
 * Adopt-first: native Web Audio nodes only (OscillatorNode, GainNode, BiquadFilter, ChannelMerger, DynamicsCompressor,
 * MediaElementSource). Tone.js (MIT) was considered, but every generator here is 2–6 native nodes, so it would add ~150 kB
 * for nothing. Pink noise: Paul Kellet's refined filter (public domain, musicdsp.org); brown noise: leaky integrated white.
 * Sources: built-in day/night loops | isochronic tones | binaural beats | playlist (public/music/manifest.json).
 */
import { hash, random } from '../proc/rng';
export const PULSE_PRESETS: Record<string, number> = { 'Gamma 40 Hz': 40, 'Alpha 10 Hz': 10, 'Theta 6 Hz': 6, 'Delta 2 Hz': 2 };
export const MUSIC = {
  source: 'Built-in ambient' as 'Built-in ambient' | 'Isochronic tones' | 'Binaural beats' | 'Playlist' | 'Off',
  pulse: 40, carrier: 300, shape: 'Smooth' as 'Smooth' | 'Sharp', level: .35,
  bed: 'None' as 'None' | 'Brown noise' | 'Pink noise' | 'Drone', bedLevel: .25,
  shuffle: true, crossfade: 4, followWorld: false,
};
type Track = { file: string; title?: string; mood?: 'day' | 'night' | 'storm' | 'any' };

function noiseBuffer(ctx: AudioContext, kind: 'brown' | 'pink') {
  const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0; const r = random(hash(`noise:${kind}`)), white = () => r() * 2 - 1; // shared RNG
  for (let i = 0; i < n; i++) {
    const w = white();
    if (kind === 'brown') { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
    else { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856;
      b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; }
  }
  return b;
}

const shuffleRng = random(hash(`music:${Date.now()}`)); // per session (not world state)
export function createMusic(input: () => { ctx: AudioContext; node: AudioNode } | undefined, setBuiltIn: (on: boolean) => void) {
  let out: { ctx: AudioContext; master: GainNode } | undefined, nodes: AudioNode[] = [], stops: (() => void)[] = [];
  let tracks: Track[] = [], deck: { el: HTMLAudioElement; g: GainNode } | undefined, order: number[] = [], pos = 0, mood: Track['mood'] = 'day', key = '';
  /** Output chain: source gain → brick-wall-ish limiter (DynamicsCompressor −10 dBFS, 20:1) → music bus. */
  function ensure() {
    if (out) return out; const i = input(); if (!i) return undefined;
    const master = i.ctx.createGain(), lim = i.ctx.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .003; lim.release.value = .25;
    master.connect(lim); lim.connect(i.node); return out = { ctx: i.ctx, master };
  }
  function clear() { for (const s of stops) s(); stops = []; for (const n of nodes) n.disconnect(); nodes = []; }
  const keep = <T extends AudioNode>(n: T) => (nodes.push(n), n);
  function bed(ctx: AudioContext, to: AudioNode) {
    if (MUSIC.bed === 'None') return; const g = keep(ctx.createGain()); g.gain.value = MUSIC.bedLevel; g.connect(to);
    if (MUSIC.bed === 'Drone') { const lp = keep(ctx.createBiquadFilter()); lp.frequency.value = 600; lp.connect(g);
      for (const det of [-4, 4]) { const o = keep(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = MUSIC.carrier / 2; o.detune.value = det; const og = keep(ctx.createGain()); og.gain.value = .15; o.connect(og); og.connect(lp); o.start(); stops.push(() => o.stop()); }
      return; }
    const src = keep(ctx.createBufferSource()); src.buffer = noiseBuffer(ctx, MUSIC.bed === 'Brown noise' ? 'brown' : 'pink'); src.loop = true; src.connect(g); src.start(); stops.push(() => src.stop());
  }
  /** Isochronic: carrier × (amplitude envelope at the pulse rate). Smooth = raised sine; Sharp = square LFO low-passed at 6× rate (no clicks). */
  function isochronic(ctx: AudioContext, to: AudioNode) {
    const car = keep(ctx.createOscillator()), amp = keep(ctx.createGain()), lfo = keep(ctx.createOscillator()), depth = keep(ctx.createGain());
    car.frequency.value = MUSIC.carrier; amp.gain.value = .5; lfo.frequency.value = MUSIC.pulse; depth.gain.value = .5;
    lfo.type = MUSIC.shape === 'Sharp' ? 'square' : 'sine';
    if (MUSIC.shape === 'Sharp') { const lp = keep(ctx.createBiquadFilter()); lp.frequency.value = MUSIC.pulse * 6; lfo.connect(lp); lp.connect(depth); } else lfo.connect(depth);
    depth.connect(amp.gain); car.connect(amp); const g = keep(ctx.createGain()); g.gain.value = MUSIC.level; amp.connect(g); g.connect(to);
    car.start(); lfo.start(); stops.push(() => { car.stop(); lfo.stop(); });
  }
  /** Binaural: carrier ∓ beat/2 hard-panned L/R (needs headphones; the beat is perceived, not in the signal). */
  function binaural(ctx: AudioContext, to: AudioNode) {
    const m = keep(ctx.createChannelMerger(2)), g = keep(ctx.createGain()); g.gain.value = MUSIC.level; m.connect(g); g.connect(to);
    [-1, 1].forEach((s, ch) => { const o = keep(ctx.createOscillator()); o.frequency.value = MUSIC.carrier + s * MUSIC.pulse / 2; o.connect(m, 0, ch); o.start(); stops.push(() => o.stop()); });
  }
  async function loadManifest() { try { const r = await fetch('music/manifest.json'); if (r.ok) tracks = ((await r.json()).tracks ?? []) as Track[]; } catch { tracks = []; } }
  function pickOrder() {
    const pool = tracks.map((t, i) => [t, i] as const).filter(([t]) => !MUSIC.followWorld || !t.mood || t.mood === 'any' || t.mood === mood).map(([, i]) => i);
    const r = shuffleRng; order = MUSIC.shuffle ? pool.map(i => [r(), i] as const).sort((a, b) => a[0] - b[0]).map(x => x[1]) : pool; pos = 0; // presentation-only shuffle
  }
  /** Crossfading playlist: two decks; the next track fades in over `crossfade` s while the current fades out. */
  function playNext() {
    const o = out; if (!o) return; if (pos >= order.length) pickOrder(); if (!order.length) return;
    const t = tracks[order[pos++]], el = new Audio(`music/${t.file}`); el.crossOrigin = 'anonymous';
    const src = o.ctx.createMediaElementSource(el), g = o.ctx.createGain(), now = o.ctx.currentTime, xf = MUSIC.crossfade;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(1, now + xf); src.connect(g); g.connect(o.master);
    if (deck) { const d = deck; d.g.gain.cancelScheduledValues(now); d.g.gain.setValueAtTime(d.g.gain.value, now); d.g.gain.linearRampToValueAtTime(0, now + xf); setTimeout(() => { d.el.pause(); d.g.disconnect(); }, xf * 1000 + 100); }
    deck = { el, g }; let queued = false;
    el.ontimeupdate = () => { if (!queued && el.duration && el.currentTime > el.duration - xf) { queued = true; playNext(); } };
    el.onended = () => { if (!queued) playNext(); }; void el.play().catch(() => {});
  }
  function rebuild() {
    const o = ensure(); if (!o) return; clear(); setBuiltIn(MUSIC.source === 'Built-in ambient');
    o.master.gain.value = MUSIC.source === 'Playlist' ? MUSIC.level * 2 : 1; // playlist level; generators carry their own
    if (MUSIC.source !== 'Playlist' && deck) { deck.el.pause(); deck.g.disconnect(); deck = undefined; }
    if (MUSIC.source === 'Isochronic tones') { isochronic(o.ctx, o.master); bed(o.ctx, o.master); }
    else if (MUSIC.source === 'Binaural beats') { binaural(o.ctx, o.master); bed(o.ctx, o.master); }
    else if (MUSIC.source === 'Playlist') { void loadManifest().then(() => { pickOrder(); if (!deck) playNext(); }); }
  }
  return {
    /** Call after any MUSIC change. */
    apply() { key = ''; },
    skip() { if (MUSIC.source === 'Playlist') playNext(); },
    get tracks() { return tracks; },
    /** Per frame (cheap): lazily start once audio is up; 'follow world' re-targets mood / preset from darkness + rain. */
    update(darkness: number, rain: number) {
      if (MUSIC.followWorld) {
        const m: Track['mood'] = rain > .3 ? 'storm' : darkness > .5 ? 'night' : 'day';
        if (m !== mood) { mood = m; if (MUSIC.source === 'Playlist') { pickOrder(); playNext(); } else if (MUSIC.source !== 'Built-in ambient') { MUSIC.pulse = m === 'night' ? 6 : m === 'storm' ? 10 : MUSIC.pulse; key = ''; } }
      }
      const k = JSON.stringify(MUSIC); if (k !== key && input()) { key = k; rebuild(); }
    },
  };
}
export type Music = ReturnType<typeof createMusic>;
