/**
 * Boreal ambience + positional animal sound (Grok Bot).
 * Clips live in public/sounds/<id>.mp3 (served by Vite at /sounds/<id>.mp3).
 * Missing clips are skipped silently, so the game runs with or without them.
 * Keys: M mute all, [ / ] volume, N music on/off, - / = music volume, H howl, G growl.
 * Music (music-day/music-night) crossfades with darkness and ducks under one-shots.
 */
import { heightAt } from '../core/world';
import { LEVEL } from '../core/tuning';
import { RENDER } from '../core/renderSettings';

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
  mode?: string; exhausted?: boolean;
  animals: AudibleAnimal[];
}

/** One-shots loud/meaningful enough to dip the music (footsteps etc. don't). */
const DUCKERS = new Set<SoundId>(['wolf-howl', 'wolf-growl', 'deer-snort', 'wolf-whine', 'friend-chime', 'stone-roll', 'herb-pluck', 'loon', 'sprint-burst', 'dawn-chorus', 'owl']);
const VOLUME_KEY = 'boreal.audio.v1';

export class BorealSound {
  private ctx?: AudioContext;
  private master?: GainNode; private musicBus?: GainNode; private duck?: GainNode;
  private wolfMode = 'walk'; private wasExhausted = false; private prevDark = -1; private nextBird = 15; private nextPant = 0;
  private buffers = new Map<SoundId, AudioBuffer>();
  private loops = new Map<SoundId, GainNode>();
  private prev = new Map<string, { problem: string; motion: string; phase: number; nextChew: number }>();
  private wolfPrev = { motion: 'idle', phase: 0 };
  private nextLoon = 30; private time = 0; private waterAmount = 0; private waterCheck = 0;
  private haltedNow = false;
  volume = .8; muted = false; musicVolume = .7; musicOn = true;

  constructor() {
    try { const s = JSON.parse(localStorage.getItem(VOLUME_KEY) ?? '{}'); if (typeof s.volume === 'number') this.volume = s.volume; this.muted = !!s.muted; if (typeof s.musicVolume === 'number') this.musicVolume = s.musicVolume; if (typeof s.musicOn === 'boolean') this.musicOn = s.musicOn; } catch { /* defaults */ }
    const start = () => { void this.start(); };
    addEventListener('pointerdown', start, { once: true }); addEventListener('keydown', start, { once: true });
    addEventListener('keydown', e => {
      if (e.repeat || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (k === 'm') this.setMuted(!this.muted);
      else if (k === '[') this.setVolume(this.volume - .1);
      else if (k === ']') this.setVolume(this.volume + .1);
      else if (k === 'n') { this.musicOn = !this.musicOn; this.save(); this.applyVolume(); }
      else if (k === '-') { this.musicVolume = Math.max(0, Math.round((this.musicVolume - .1) * 10) / 10); this.musicOn = true; this.save(); this.applyVolume(); }
      else if (k === '=') { this.musicVolume = Math.min(1, Math.round((this.musicVolume + .1) * 10) / 10); this.musicOn = true; this.save(); this.applyVolume(); }
      else if (k === 'h') this.playAt('wolf-howl', undefined, MIX.howl);
      else if (k === 'g') this.playAt('wolf-growl', undefined, MIX.growl);
    });
    addEventListener('click', e => { if ((e.target as HTMLElement)?.closest?.('button')) this.playAt('ui-click', undefined, MIX.ui); });
  }

  get started() { return !!this.ctx; }

  async start() {
    if (this.ctx) return;
    const ctx = this.ctx = new AudioContext();
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.duck = ctx.createGain(); this.musicBus = ctx.createGain(); this.duck.connect(this.musicBus); this.musicBus.connect(this.master); this.applyVolume();
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

  setVolume(v: number) { this.volume = Math.min(1, Math.max(0, Math.round(v * 10) / 10)); this.muted = false; this.save(); this.applyVolume(); }
  setMuted(m: boolean) { this.muted = m; this.save(); this.applyVolume(); }
  private save() { try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: this.volume, muted: this.muted, musicVolume: this.musicVolume, musicOn: this.musicOn })); } catch { /* ignore */ } }
  private applyVolume() { if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, .05);
    if (this.ctx && this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicOn ? this.musicVolume : 0, this.ctx.currentTime, .3); }

  private startLoop(id: SoundId, bus?: AudioNode) {
    const ctx = this.ctx!, buffer = this.buffers.get(id); if (!buffer) return;
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buffer; src.loop = true; gain.gain.value = 0;
    src.connect(gain); gain.connect(bus ?? this.master!); src.start(ctx.currentTime, bus ? 0 : Math.random() * buffer.duration);
    this.loops.set(id, gain);
  }

  private setLoop(id: SoundId, level: number) {
    const g = this.loops.get(id); if (g && this.ctx) g.gain.setTargetAtTime(level, this.ctx.currentTime, MIX.crossfadeSeconds / 3);
  }

  /** One-shot; with a position it goes through an HRTF panner, otherwise it plays at the listener. */
  playAt(id: SoundId, at?: { x: number; z: number }, level = 1, rate = 1) {
    const ctx = this.ctx, buffer = this.buffers.get(id); if (!ctx || !buffer || ctx.state !== 'running') return;
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buffer; src.playbackRate.value = rate * (.94 + Math.random() * .12); gain.gain.value = level;
    let tail: AudioNode = gain; src.connect(gain);
    if (at) {
      const p = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 3, maxDistance: MIX.hearingDistance, rolloffFactor: 1.2,
        positionX: at.x, positionY: heightAt(at.x, at.z) + .8, positionZ: at.z });
      gain.connect(p); tail = p;
    }
    tail.connect(this.master!); src.start();
    if (this.duck && DUCKERS.has(id)) { const t = ctx.currentTime, g = this.duck.gain; g.cancelScheduledValues(t); g.setTargetAtTime(MIX.music.duck, t, .05); g.setTargetAtTime(1, t + buffer.duration * .6, MIX.music.duckRecoverSeconds); }
    src.onended = () => { src.disconnect(); gain.disconnect(); if (tail !== gain) tail.disconnect(); };
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
  /** Plays public/sounds/voice/<id>.mp3 through the master bus (mute/volume apply) and ducks music; resolves to its duration. */
  async playVoice(id: string): Promise<number | undefined> {
    const ctx = this.ctx; if (!ctx || !this.master) return undefined;
    if (!this.voices.has(id)) {
      try { const r = await fetch(`sounds/voice/${id}.mp3`); this.voices.set(id, r.ok && (r.headers.get('content-type') ?? '').includes('audio') ? await ctx.decodeAudioData(await r.arrayBuffer()) : null); }
      catch { this.voices.set(id, null); }
    }
    const buffer = this.voices.get(id); if (!buffer || ctx.state !== 'running') return undefined;
    const src = ctx.createBufferSource(), gain = ctx.createGain(); src.buffer = buffer; gain.gain.value = MIX.voice;
    src.connect(gain); gain.connect(this.master); src.start(); src.onended = () => { src.disconnect(); gain.disconnect(); };
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
  pauseCue() { this.playAt('ui-pause', undefined, MIX.pause); }

  update(f: SoundFrame) {
    const ctx = this.ctx; if (!ctx) return;
    if (f.halted) { if (ctx.state === 'running') setTimeout(() => { if (this.haltedNow) void ctx.suspend(); }, 400); this.haltedNow = true; return; }
    this.haltedNow = false;
    if (ctx.state === 'suspended') void ctx.resume();
    this.time += f.dt;

    // Listener follows the wolf; forward is -sin/-cos(yaw) like the movement code.
    const l = ctx.listener, y = heightAt(f.x, f.z) + .6, fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
    if (l.positionX) { l.positionX.value = f.x; l.positionY.value = y; l.positionZ.value = f.z; l.forwardX.value = fx; l.forwardY.value = 0; l.forwardZ.value = fz; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0; }
    else { l.setPosition(f.x, y, f.z); l.setOrientation(fx, 0, fz, 0, 1, 0); }

    // Ambience: day/night crossfade by darkness, water by nearby low ground.
    if ((this.waterCheck -= f.dt) <= 0) { this.waterCheck = .5; this.waterAmount = nearbyWater(f.x, f.z); }
    const d = Math.min(1, Math.max(0, f.darkness));
    this.setLoop('amb-day', MIX.ambience.day * (1 - d));
    this.setLoop('amb-night', MIX.ambience.night * d);
    this.setLoop('wind-pines', MIX.ambience.wind);
    this.setLoop('water', MIX.ambience.water * this.waterAmount);
    this.setLoop('music-day', MIX.music.day * (1 - d));
    this.setLoop('music-night', MIX.music.night * d);
    if (this.prevDark > .5 && d <= .5) this.playAt('dawn-chorus', undefined, MIX.dawn);
    this.prevDark = d;
    if (this.time > this.nextBird && RENDER.birdRate > 0) {
      this.nextBird = this.time + (MIX.birdEverySeconds[0] + Math.random() * (MIX.birdEverySeconds[1] - MIX.birdEverySeconds[0])) / RENDER.birdRate;
      const a = Math.random() * Math.PI * 2, r = 15 + Math.random() * 20, at = { x: f.x + Math.sin(a) * r, z: f.z + Math.cos(a) * r };
      this.playAt(d > .5 ? 'owl' : Math.random() < .5 ? 'raven' : 'woodpecker', at, MIX.birds);
    }
    if (f.mode && f.mode !== this.wolfMode) {
      if (f.mode === 'sprint') this.playAt('sprint-burst', undefined, MIX.sprint);
      else if (f.mode.includes('stealth')) this.playAt('stealth-rustle', undefined, MIX.stealth);
      this.wolfMode = f.mode;
    }
    if (f.exhausted && (!this.wasExhausted || this.time > this.nextPant)) { this.playAt('wolf-pant', undefined, MIX.pant); this.nextPant = this.time + 3.2; }
    this.wasExhausted = !!f.exhausted;
    if (this.time > this.nextLoon) {
      this.nextLoon = this.time + MIX.loonEverySeconds[0] + Math.random() * (MIX.loonEverySeconds[1] - MIX.loonEverySeconds[0]);
      if (d > .25 || this.waterAmount > .2) { const a = Math.random() * Math.PI * 2; this.playAt('loon', { x: f.x + Math.sin(a) * 30, z: f.z + Math.cos(a) * 30 }, MIX.loon); }
    }

    // Player wolf: a paw sound each half gait cycle (fore/hind pair), landing thud after a jump.
    const w = f.wolf, wp = this.wolfPrev;
    if (Math.floor(w.phase * 2) !== Math.floor(wp.phase * 2) && (w.motion === 'walk' || w.motion === 'run' || w.motion === 'back'))
      this.playAt(w.motion === 'run' ? 'paw-run' : 'paw-walk', undefined, MIX.wolfSteps);
    if (wp.motion === 'jump' && w.motion !== 'jump') this.playAt('land', undefined, MIX.land);
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
      if (a.problem === 'feed' && a.motion === 'idle' && this.time > p.nextChew) { this.playAt('chew', at, MIX.chew); p.nextChew = this.time + 2 + Math.random(); }
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
