/**
 * Boreal ambience + positional animal sound (Grok Bot).
 * Clips live in public/sounds/<id>.mp3 (served by Vite at /sounds/<id>.mp3).
 * Missing clips are skipped silently, so the game runs with or without them.
 * Keys: M mute all, [ / ] volume, N music on/off, - / = music volume, H howl, G growl.
 * Music (music-day/music-night) crossfades with darkness and ducks under one-shots.
 * Mixing policy (buses, loudness trims, voice caps, distance culling, volume settings) lives in audio/mixer.ts.
 */
import { windAt } from '../core/weather';
import { stream } from '../proc/rng';
import { heightAt } from '../core/world';
import { LEVEL } from '../core/tuning';
import { RENDER } from '../core/renderSettings';
/** Sound variation is seeded too (PROJECT-RULES.md rule 1). */
const soundRng = stream(1400, 'borealSound-v1');

import { haptic, SOUND_HAPTICS } from '../ui/haptics';
import { jumpArc } from '../proc/physics';
import type { Touchdown } from '../animals/locomotion/signals';
/** Paw touchdown gaits that use the run clip (gallop family); walk/trot/pace use the walk clip. */
const RUN_GAITS = new Set(['canter', 'gallop', 'bound', 'pronk']);
import { BUSES, BUS_LEVEL, BUS_STATE, CULL_DISTANCE, VOICES, VOICE_TRIM_DB, admitVoice, busOf, createVolumeStore, onBusChange, priorityOf, trim, type ActiveVoice, type Bus } from './mixer';
/** Footstep clips hold several footfalls; each gait event plays ONE footfall slice (onsets measured from the clips). */
const STEP_SLICES: Partial<Record<string, { onsets: number[]; len: number }>> = { 'paw-walk': { onsets: [0, .61], len: .35 }, 'paw-run': { onsets: [.11, .23, .44, .73, 1.03, 1.34, 1.65], len: .2 } };
export const SOUND_IDS = ['amb-day', 'amb-night', 'wind-pines', 'water', 'loon', 'wolf-howl', 'wolf-growl',
  'paw-walk', 'paw-run', 'deer-snort', 'deer-hooves', 'chew', 'land',
  'wolf-whine', 'herb-pluck', 'stone-roll', 'ui-click', 'ui-pause', 'wolf-pant', 'sprint-burst', 'stealth-rustle',
  'owl', 'woodpecker', 'raven', 'visitor-steps', 'dawn-chorus', 'friend-chime', 'music-day', 'music-night', 'hare-hop', 'hare-squeak', 'pounce'] as const;
export type SoundId = typeof SOUND_IDS[number];

/** Tweak mix here. */
export const MIX = {
  ambience: { day: .5, night: .45, wind: .25, water: .5 },
  crossfadeSeconds: 2.5,
  wolfSteps: .35, deerSteps: .5, snort: .9, hooves: .8, chew: .6, land: .7, howl: .9, growl: .8, loon: .35,
  loonEverySeconds: [45, 110] as [number, number],
  hearingDistance: 40,
  music: { day: .35, night: .3, duck: .45, duckRecoverSeconds: .8 },
  ui: .35, pause: .5, whine: .8, pluck: .8, stoneRoll: .8, pant: .6, sprint: .6, stealth: .5, visitor: .7, friend: .6,
  voice: 1, hareHop: .6, hareSqueak: .6, pounce: .8,
  birds: .3, birdEverySeconds: [20, 50] as [number, number], dawn: .45,
};

export interface AudibleAnimal { key: string; motion: string; problem: string; x?: number; z?: number; phase?: number }
export interface SoundFrame {
  dt: number; halted: boolean; x: number; z: number; yaw: number; darkness: number;
  wolf: { motion: string; phase: number };
  mode?: string; exhausted?: boolean; /** player mass + the default wolf mass (landing impact scaling) */ mass?: number; refMass?: number; /** core/ground footing().absorb: soft ground = quieter thud, weaker haptic */ groundAbsorb?: number;
  animals: AudibleAnimal[];
}

/** One-shots loud/meaningful enough to dip the music (footsteps etc. don't). */
const DUCKERS = new Set<SoundId>(['wolf-howl', 'wolf-growl', 'deer-snort', 'wolf-whine', 'friend-chime', 'stone-roll', 'herb-pluck', 'loon', 'sprint-burst', 'dawn-chorus', 'owl']);

export class BorealSound {
  /** Transient accessibility cue for an admitted positional sound; never creates a save record. */
  onSpatialCue?: (id: SoundId, at: { x: number; z: number }, level: number) => void;
  private ctx?: AudioContext;
  private master?: GainNode; private duck?: GainNode; private bus = new Map<Bus, GainNode>();
  private active: (ActiveVoice & { stop(): void })[] = [];
  private voiceLine?: AudioBufferSourceNode; private haltTimer?: ReturnType<typeof setTimeout>;
  private loopLevel = new Map<SoundId, number>();
  /** Bus levels, mute and music on/off (persisted as boreal.volume.v1); the Sound panel and the keys both write here. */
  readonly volumeStore = createVolumeStore();
  private wolfMode = 'walk'; private wasExhausted = false; private prevDark = -1; private nextBird = 15; private nextPant = 0;
  private buffers = new Map<SoundId, AudioBuffer>();
  private loops = new Map<SoundId, GainNode>();
  private prev = new Map<string, { problem: string; motion: string; phase: number; nextChew: number }>();
  private wolfPrev = { motion: 'idle', phase: 0 }; private lastTouch = -1e9;
  private nextLoon = 30; private time = 0; private waterAmount = 0; private waterCheck = 0;
  private haltedNow = false;
  get volume() { return BUS_LEVEL.master; } get muted() { return BUS_STATE.muted; } get musicVolume() { return BUS_LEVEL.music; } get musicOn() { return BUS_STATE.musicOn; }
  /** false = the audio/music module's source replaces the built-in music-day/night loops. */
  builtInMusic = true;
  /** Shared music input (the duck node → music bus → master); audio/music plugs its sources in here. */
  musicInput() { return this.ctx && this.duck ? { ctx: this.ctx, node: this.duck as AudioNode } : undefined; }

  constructor() {
    onBusChange(() => this.applyVolume());
    // real paw touchdowns (?loco=1 locomotion) replace the half-stride footstep timer; loaded lazily (keeps node tests DOM/three-free)
    void import('../animals/locomotion/game').then(m => m.onPlayerTouchdown(t => this.touchdown(t))).catch(() => {});
    const start = () => { void this.start(); };
    addEventListener('pointerdown', start, { once: true }); addEventListener('keydown', start, { once: true });
    addEventListener('keydown', e => {
      if (e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'm') this.setMuted(!this.muted);
      else if (k === '[') this.setVolume(this.volume - .1);
      else if (k === ']') this.setVolume(this.volume + .1);
      else if (k === 'n') this.volumeStore.set('volume.musicOn', !this.musicOn);
      else if (k === '-' || k === '=') { this.volumeStore.set('volume.music', Math.min(1, Math.max(0, Math.round((this.musicVolume + (k === '=' ? .1 : -.1)) * 10) / 10))); this.volumeStore.set('volume.musicOn', true); }
      else if (k === 'h') this.playAt('wolf-howl', undefined, MIX.howl);
      else if (k === 'g' && !e.shiftKey) this.playAt('wolf-growl', undefined, MIX.growl);
    });
    addEventListener('click', e => { if ((e.target as HTMLElement)?.closest?.('button')) this.playAt('ui-click', undefined, MIX.ui); });
  }

  get started() { return !!this.ctx; }

  async start() {
    if (this.ctx) return;
    const ctx = this.ctx = new AudioContext();
    // buses → master → limiter → speakers (the limiter catches stacked one-shots; it used to clip)
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .15;
    this.master = ctx.createGain(); this.master.connect(lim); lim.connect(ctx.destination);
    for (const b of BUSES) { const g = ctx.createGain(); g.connect(this.master); this.bus.set(b, g); }
    this.duck = ctx.createGain(); this.duck.connect(this.bus.get('music')!); this.applyVolume();
    await ctx.resume().catch(() => {});
    await Promise.all(SOUND_IDS.map(async id => {
      try {
        const res = await fetch(`sounds/${id}.mp3`);
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('audio')) return;
        this.buffers.set(id, await ctx.decodeAudioData(await res.arrayBuffer()));
      } catch { /* clip missing or undecodable: stay silent */ }
    }));
    for (const id of ['amb-day', 'amb-night', 'wind-pines', 'water'] as SoundId[]) this.startLoop(id);
    this.startLoop('music-day', this.duck); this.startLoop('music-night', this.duck);
  }

  setVolume(v: number) { this.volumeStore.set('volume.master', Math.min(1, Math.max(0, Math.round(v * 10) / 10))); this.volumeStore.set('volume.muted', false); }
  setMuted(m: boolean) { this.volumeStore.set('volume.muted', m); }
  private applyVolume() {
    const ctx = this.ctx; if (!ctx || !this.master) return;
    this.master.gain.setTargetAtTime(BUS_STATE.muted ? 0 : BUS_LEVEL.master, ctx.currentTime, .05);
    for (const [b, g] of this.bus) g.gain.setTargetAtTime(b === 'music' ? (BUS_STATE.musicOn ? BUS_LEVEL.music : 0) : BUS_LEVEL[b], ctx.currentTime, b === 'music' ? .3 : .05);
  }
  /** Live one-shots (for the inspector / tests). */
  get voiceCount() { return this.active.length; }

  private startLoop(id: SoundId, bus?: AudioNode) {
    const ctx = this.ctx!, buffer = this.buffers.get(id); if (!buffer) return;
    const src = ctx.createBufferSource(), gain = ctx.createGain(), t = ctx.createGain();
    src.buffer = buffer; src.loop = true; gain.gain.value = 0; t.gain.value = trim(id);
    src.connect(t); t.connect(gain); gain.connect(bus ?? this.bus.get(busOf(id))!); src.start(ctx.currentTime, bus ? 0 : soundRng() * buffer.duration);
    this.loops.set(id, gain);
  }

  /** Per-frame loop level; only re-targets when it moved (was 6 new automation events every frame). */
  private setLoop(id: SoundId, level: number) {
    const g = this.loops.get(id), was = this.loopLevel.get(id); if (!g || !this.ctx || (was !== undefined && Math.abs(was - level) < .005)) return;
    this.loopLevel.set(id, level); g.gain.setTargetAtTime(level, this.ctx.currentTime, MIX.crossfadeSeconds / 3);
  }

  /** One-shot; with a position it goes through an HRTF panner, otherwise it plays at the listener. */
  private ear = { x: 0, z: 0 }; private wet = false;
  playAt(id: SoundId, at?: { x: number; z: number }, level = 1, rate = 1, feel = true) {
    if (feel && SOUND_HAPTICS[id]) haptic(SOUND_HAPTICS[id], at ? Math.hypot(at.x - this.ear.x, at.z - this.ear.z) : 0); // same event point as the sound
    const ctx = this.ctx, buffer = this.buffers.get(id); if (!ctx || !buffer || ctx.state !== 'running') return;
    if (at && Math.hypot(at.x - this.ear.x, at.z - this.ear.z) > CULL_DISTANCE) return; // distance culling: inaudible anyway, saves an HRTF panner
    const prio = priorityOf(id), adm = admitVoice(this.active, id, prio); if (!adm.ok) return;
    if (at && !this.haltedNow) this.onSpatialCue?.(id, at, level);
    if (adm.steal >= 0) { this.active[adm.steal].stop(); this.active.splice(adm.steal, 1); }
    const src = ctx.createBufferSource(), gain = ctx.createGain(), now = ctx.currentTime;
    src.buffer = buffer; src.playbackRate.value = rate * (.94 + soundRng() * .12); const g0 = level * trim(id); gain.gain.value = g0;
    let tail: AudioNode = gain; src.connect(gain);
    if (at) {
      const p = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 3, maxDistance: MIX.hearingDistance, rolloffFactor: 1.2,
        positionX: at.x, positionY: heightAt(at.x, at.z) + .8, positionZ: at.z });
      gain.connect(p); tail = p;
    }
    tail.connect(this.bus.get(busOf(id))!);
    const slice = STEP_SLICES[id];
    if (slice) { const off = slice.onsets[Math.floor(soundRng() * slice.onsets.length)], end = now + slice.len / src.playbackRate.value;
      src.start(now, off, slice.len); gain.gain.setValueAtTime(g0, end - .04); gain.gain.linearRampToValueAtTime(0, end); }
    else src.start();
    const voice = { id, priority: prio, start: now, stop: () => { try { gain.gain.setTargetAtTime(0, ctx.currentTime, VOICES.stealFadeSeconds / 3); src.stop(ctx.currentTime + VOICES.stealFadeSeconds); } catch { /* already stopped */ } } };
    this.active.push(voice);
    if (this.duck && DUCKERS.has(id)) { const t = ctx.currentTime, g = this.duck.gain; g.cancelScheduledValues(t); g.setTargetAtTime(MIX.music.duck, t, .05); g.setTargetAtTime(1, t + buffer.duration * .6, MIX.music.duckRecoverSeconds); }
    src.onended = () => { const i = this.active.indexOf(voice); if (i >= 0) this.active.splice(i, 1); src.disconnect(); gain.disconnect(); if (tail !== gain) tail.disconnect(); };
  }

  /** Player interaction sounds (hook from perform()). */
  action(kind: string, at?: { x: number; z: number; kind?: string }) {
    if (kind === 'move') this.playAt('stone-roll', at, MIX.stoneRoll);
    else if (kind === 'gather') this.playAt('herb-pluck', at, MIX.pluck);
    else if (kind === 'speak') {
      this.playAt('wolf-whine', undefined, MIX.whine);
      if (at?.kind === 'person') this.playAt('visitor-steps', at, MIX.visitor);
      setTimeout(() => this.playAt('friend-chime', undefined, MIX.friend), 700);
    }
  }
  private voices = new Map<string, AudioBuffer | null>();
  /** Plays public/sounds/voice/<id>.mp3 on the voice bus (one line at a time) and ducks music; resolves to its duration. */
  async playVoice(id: string): Promise<number | undefined> {
    const ctx = this.ctx; if (!ctx || !this.master) return undefined;
    if (!this.voices.has(id)) {
      try { const r = await fetch(`sounds/voice/${id}.mp3`); this.voices.set(id, r.ok && (r.headers.get('content-type') ?? '').includes('audio') ? await ctx.decodeAudioData(await r.arrayBuffer()) : null); }
      catch { this.voices.set(id, null); }
    }
    const buffer = this.voices.get(id); if (!buffer || ctx.state !== 'running') return undefined;
    try { this.voiceLine?.stop(); } catch { /* ended */ } // a new line replaces the one still talking
    const src = ctx.createBufferSource(), gain = ctx.createGain(); src.buffer = buffer; gain.gain.value = MIX.voice * 10 ** (VOICE_TRIM_DB / 20);
    src.connect(gain); gain.connect(this.bus.get('voice')!); src.start(); this.voiceLine = src; src.onended = () => { if (this.voiceLine === src) this.voiceLine = undefined; src.disconnect(); gain.disconnect(); };
    if (this.duck) { const t = ctx.currentTime, g = this.duck.gain; g.cancelScheduledValues(t); g.setTargetAtTime(MIX.music.duck * .6, t, .05); g.setTargetAtTime(1, t + buffer.duration, MIX.music.duckRecoverSeconds); }
    return buffer.duration;
  }
  /** Hare events from src/animals/hare.ts. */
  hare(type: 'caught' | 'bolt' | 'hop', at: { x: number; z: number }) {
    if (type === 'bolt') { this.playAt('hare-squeak', at, MIX.hareSqueak * .5); this.playAt('hare-hop', at, MIX.hareHop); }
    else if (type === 'hop') this.playAt('hare-hop', at, MIX.hareHop * .4);
    else { this.playAt('pounce', undefined, MIX.pounce); this.playAt('hare-squeak', at, MIX.hareSqueak); setTimeout(() => this.playAt('chew', undefined, MIX.chew), 500); }
  }
  /** Pause / resume cue; plays even though the context is about to suspend. */
  /** One player paw touchdown: clip by gait (walk/trot/pace vs canter/gallop/bound/pronk), level by strength (0.3 slow walk .. 1
   * gallop/landing). Jump landings keep the single impact-scaled thud in update() instead of four paw slices. */
  touchdown(t: Touchdown) {
    this.lastTouch = this.time; if (this.haltedNow || t.landing) return;
    this.playAt(RUN_GAITS.has(t.gait) ? 'paw-run' : 'paw-walk', undefined, MIX.wolfSteps * (.35 + .65 * Math.min(1, Math.max(0, t.strength))));
  }
  pauseCue() { this.playAt('ui-pause', undefined, MIX.pause); }

  update(f: SoundFrame) {
    const ctx = this.ctx; if (!ctx) return;
    if (f.halted) { if (ctx.state === 'running' && !this.haltTimer) this.haltTimer = setTimeout(() => { this.haltTimer = undefined; if (this.haltedNow) void ctx.suspend(); }, 400); this.haltedNow = true; return; } // one timer, not one per frame
    this.haltedNow = false;
    if (ctx.state === 'suspended') void ctx.resume();
    this.time += f.dt;

    // Listener follows the wolf; forward is -sin/-cos(yaw) like the movement code.
    this.ear = { x: f.x, z: f.z }; const wet = heightAt(f.x, f.z) < LEVEL.waterSurface; if (wet && !this.wet) haptic('water'); this.wet = wet;
    const l = ctx.listener, y = heightAt(f.x, f.z) + .6, fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
    if (l.positionX) { l.positionX.value = f.x; l.positionY.value = y; l.positionZ.value = f.z; l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(f.x, y, f.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }

    // Ambience: day/night crossfade by darkness, water by nearby low ground.
    if ((this.waterCheck -= f.dt) <= 0) { this.waterCheck = .5; this.waterAmount = nearbyWater(f.x, f.z); }
    const d = Math.min(1, Math.max(0, f.darkness));
    this.setLoop('amb-day', MIX.ambience.day * (1 - d));
    this.setLoop('amb-night', MIX.ambience.night * d);
    const wv = windAt(f.x, 10, f.z); this.setLoop('wind-pines', MIX.ambience.wind * Math.min(2, Math.hypot(wv.x, wv.z) / 4)); // shared wind field; 4 m/s = old level
    this.setLoop('water', MIX.ambience.water * this.waterAmount);
    this.setLoop('music-day', this.builtInMusic ? MIX.music.day * (1 - d) : 0);
    this.setLoop('music-night', this.builtInMusic ? MIX.music.night * d : 0);
    if (this.prevDark > .5 && d <= .5) this.playAt('dawn-chorus', undefined, MIX.dawn);
    this.prevDark = d;
    if (this.time > this.nextBird && RENDER.birdRate > 0) {
      this.nextBird = this.time + (MIX.birdEverySeconds[0] + soundRng() * (MIX.birdEverySeconds[1] - MIX.birdEverySeconds[0])) / RENDER.birdRate;
      const a = soundRng() * Math.PI * 2, r = 15 + soundRng() * 20, at = { x: f.x + Math.sin(a) * r, z: f.z + Math.cos(a) * r };
      this.playAt(d > .5 ? 'owl' : soundRng() < .5 ? 'raven' : 'woodpecker', at, MIX.birds);
    }
    if (f.mode && f.mode !== this.wolfMode) {
      if (f.mode === 'sprint') this.playAt('sprint-burst', undefined, MIX.sprint);
      else if (f.mode.includes('stealth')) this.playAt('stealth-rustle', undefined, MIX.stealth);
      this.wolfMode = f.mode;
    }
    if (f.exhausted && (!this.wasExhausted || this.time > this.nextPant)) { this.playAt('wolf-pant', undefined, MIX.pant); this.nextPant = this.time + 3.2; }
    this.wasExhausted = !!f.exhausted;
    if (this.time > this.nextLoon) {
      this.nextLoon = this.time + MIX.loonEverySeconds[0] + soundRng() * (MIX.loonEverySeconds[1] - MIX.loonEverySeconds[0]);
      if (d > .25 || this.waterAmount > .2) { const a = soundRng() * Math.PI * 2; this.playAt('loon', { x: f.x + Math.sin(a) * 30, z: f.z + Math.cos(a) * 30 }, MIX.loon); }
    }

    // Player wolf: one paw sound per real touchdown (touchdown(), when the locomotion layer sends them); otherwise a paw sound each
    // half gait cycle (fore/hind pair). Landing thud after a jump.
    const w = f.wolf, wp = this.wolfPrev;
    if (this.time - this.lastTouch > 1 && Math.floor(w.phase * 2) !== Math.floor(wp.phase * 2) && (w.motion === 'walk' || w.motion === 'run' || w.motion === 'back'))
      this.playAt(w.motion === 'run' ? 'paw-run' : 'paw-walk', undefined, MIX.wolfSteps);
    if (wp.motion === 'jump' && w.motion !== 'jump') { // landing thud + haptic scale with impact energy (½ m v², proc/physics)
      const k = Math.sqrt(jumpArc(f.mass ?? 1).energy / jumpArc(f.refMass ?? f.mass ?? 1).energy) * (f.groundAbsorb ?? 1);
      this.playAt('land', undefined, MIX.land * Math.min(2, Math.max(.4, k)), 1 / Math.min(1.4, Math.max(.7, Math.sqrt(k))), false); haptic('land', 0, Math.min(1.6, k)); }
    this.wolfPrev = { motion: w.motion, phase: w.phase };

    // Deer: alarm snort on flee start, hooves per gait cycle, chewing while feeding, thud on landing.
    const seen = new Set<string>();
    for (const a of f.animals) {
      if (a.x === undefined || a.z === undefined) continue;
      seen.add(a.key);
      const at = { x: a.x, z: a.z }, phase = a.phase ?? 0;
      const p = this.prev.get(a.key) ?? { problem: a.problem, motion: a.motion, phase, nextChew: 0 };
      if (a.problem === 'escape' && p.problem !== 'escape') this.playAt('deer-snort', at, MIX.snort);
      if (a.motion === 'run' && p.motion !== 'run') this.playAt('deer-hooves', at, MIX.hooves);
      else if (Math.floor(phase) !== Math.floor(p.phase) && a.motion === 'walk') this.playAt('paw-walk', at, MIX.deerSteps, .8);
      if (p.motion === 'jump' && a.motion !== 'jump') this.playAt('land', at, MIX.land, .85);
      if (a.problem === 'feed' && a.motion === 'idle' && this.time > p.nextChew) { this.playAt('chew', at, MIX.chew); p.nextChew = this.time + 2 + soundRng(); }
      this.prev.set(a.key, { ...p, problem: a.problem, motion: a.motion, phase });
    }
    for (const k of this.prev.keys()) if (!seen.has(k)) this.prev.delete(k);
  }
}

/** 0..1: share of sample points within ~25 m that sit at water level (LEVEL.deerWater, same rule the deer use). */
export function nearbyWater(x: number, z: number) {
  let wet = 0, n = 0;
  for (const r of [6, 14, 25]) for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; n++; if (heightAt(x + Math.sin(a) * r, z + Math.cos(a) * r) < LEVEL.deerWater) wet += 30 / (r + 5); }
  return Math.min(1, wet / n * 2);
}
