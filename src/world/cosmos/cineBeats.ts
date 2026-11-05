/**
 * Big Bang film timings (Spielberg beat sheet v1 + addendum). One table so a retiming
 * does not hunt through the player. Pre-Sun seconds use the same map as
 * rust/boreal-sim/src/cosmic_time.rs (cycle ↔ seconds). Post-Sun years are
 * cosmicAgeYr − 13.8e9, which is what deepTimeAt reads. deepTimeAt(0) stays now.
 * This is not a second clock and it does not touch epochOffsetYr.
 */
import { DEEP, MILESTONES, deepTimeAt } from '../../core/deepTime';

/** Julian year, the same 365.25 × 86400 s figure cosmic_time.rs uses. */
export const YEAR_S = 365.25 * 86400;
/** Round cosmic age the sheet calls "today". deepTimeAt(0) is this instant, from now. */
export const TODAY_YR = 13.8e9;
/** Planck time in the Rust file. The sheet's first keyframe is the round 1e-43 s. */
export const PLANCK_S = 5.39e-44;

export const CINE = {
  /** B0 black fade, then the clock waits. */
  fade: 1.5,
  /** B1 starts here, on the click. Narration and the bed start with it. */
  b1: 3,
  /** Warm pinpoint during B1. */
  pinpoint: 5,
  /** Slim panel and the counter stay hidden until here. */
  panelAt: 23,
  /** Bang picture hands into the plasma at 0:26. This slice holds at the end of B6. */
  b3End: 26,
  b4End: 36,
  b5End: 44,
  b6End: 54,
  /** B2 inhale after narration `ended`. */
  b2: 0.8,
  /** Bed eases from −6 dB to −18 dB across this, then on toward 0 dB. */
  bedRamp: 0.4,
  bedB1: -6,
  bedB2: -18,
  bedFullBy: 22,
  /** Title lands this long after the impact file starts. Holds 3 s. */
  titleAfterBang: 1.7,
  titleHold: 3,
  /** bang-impact.mp3 peak. The white flash is this far after play(). */
  bangPeak: 0.37,
  /** One flash, 120 ms wide. */
  flashHalf: 0.06,
  flash: 0.7,
  flashReduced: 0.4,
  /** ?cine=B7 review jump. */
  b7: 54,
} as const;

/**
 * Current narration file (measured). It speaks stage directions; a clean take
 * replaces the file. B2 and B3 key off the element's `ended`, not this number.
 * The number is only the timing the tests and the fallback use.
 */
export const NARRATION = {
  file: 'audio/big-bang/narration.mp3',
  seconds: 14.471837,
} as const;

/** Later cues. Not played in the B0–B3 slice. Alts are on disk and unused. */
export const LATER_AUDIO = {
  bed: 'audio/big-bang/bed.mp3',
  bang: 'audio/big-bang/bang-impact.mp3',
  cue2: 'audio/big-bang/cue2-emergence.mp3',
  cue2At: 42,
  cue2Fade: 4,
  voB7: 'audio/big-bang/vo-b7-light.mp3',
  voB7At: 57,
  voB7Seconds: 2.82,
  voB9: 'audio/big-bang/vo-b9-stars.mp3',
  voB9At: 67,
  voB9Seconds: 1.25,
  voB14: 'audio/big-bang/vo-b14-home.mp3',
  voB14At: 112.3,
  voB14Seconds: 2.4,
  duckDb: -6,
  duckAttack: 0.3,
  duckRelease: 0.6,
  darkFrom: 60,
  darkTo: 66,
  darkRamp: 1,
  darkDb: -8,
} as const;

/**
 * Panel lines only. Not milestones: do not add them to MILESTONES.
 * Oceans: Wilde et al. 2001, Nature 409:175 (liquid water by 4.4 Ga).
 * Plants: Wellman, Osterloff & Mohiuddin 2003, Nature 425:282 (~470 Ma).
 */
export const PANEL_COPY = { oceansGya: 4.4, plantsMya: 470 } as const;

/** Wall second → cosmic seconds since the bang. Log10 until the Sun keyframe, then linear years. */
export const KEYFRAMES: { t: number; seconds: number }[] = [
  { t: 18.67, seconds: 1e-43 },
  { t: 26, seconds: 1e-32 },
  { t: 36, seconds: 1e-6 },
  { t: 44, seconds: 1200 },
  { t: 54, seconds: 1.2e13 },
  { t: 60, seconds: 1.3e13 },
  { t: 66, seconds: 3.16e15 },
  { t: 74, seconds: 3.16e16 },
  { t: 82, seconds: 9.2e9 * YEAR_S },
  { t: 92, seconds: 9.4e9 * YEAR_S },
  { t: 102, seconds: 10.1e9 * YEAR_S },
  { t: 112, seconds: TODAY_YR * YEAR_S },
];
const SUN_T = 82;

/** cosmic_time.rs cycle_to_seconds / seconds_to_cycle. */
export function cycleToSeconds(cycle: number): number {
  if (!Number.isFinite(cycle)) return NaN;
  if (cycle === 0) return 0;
  const mag = PLANCK_S * 10 ** (Math.abs(cycle) - 1);
  return cycle < 0 ? -mag : mag;
}
export function secondsToCycle(seconds: number): number {
  if (!Number.isFinite(seconds)) return NaN;
  if (seconds === 0) return 0;
  const c = Math.log10(Math.abs(seconds)) - Math.log10(PLANCK_S) + 1;
  return seconds < 0 ? -c : c;
}

/** Era names from cosmic_time.rs era_of_seconds. Same thresholds. */
export function eraOfSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return 'outside model';
  if (seconds < 0) return 'outside model — before the expansion';
  if (seconds === 0) return 'nothing — no time has passed';
  if (seconds <= 1e-43) return 'Planck';
  if (seconds < 1e-36) return 'early universe, after the Planck time';
  if (seconds <= 1e-32) return 'inflation';
  if (seconds < 1e-12) return 'electroweak';
  if (seconds < 1) return 'quark';
  if (seconds <= 20 * 60) return 'nucleosynthesis';
  if (seconds < 2e5 * YEAR_S) return 'radiation era';
  if (seconds < 1e6 * YEAR_S) return 'recombination';
  if (seconds < 1e8 * YEAR_S) return 'dark ages';
  if (seconds < 1e9 * YEAR_S) return 'first stars and galaxies';
  const earth = 9.2e9 * YEAR_S;
  const today = TODAY_YR * YEAR_S;
  if (seconds < earth) return 'galaxies, before the Sun and Earth';
  if (Math.abs(seconds - today) < YEAR_S) return 'today';
  if (seconds < today) return 'Sun and Earth';
  return 'planet time — seasons and days';
}

export function cosmicSeconds(t: number): number {
  const k = KEYFRAMES;
  if (t <= k[0].t) return k[0].seconds;
  const last = k[k.length - 1];
  if (t >= last.t) return last.seconds;
  let i = 0;
  while (i < k.length - 2 && t > k[i + 1].t) i++;
  const a = k[i], b = k[i + 1];
  const u = (t - a.t) / (b.t - a.t);
  if (u <= 0) return a.seconds;
  if (u >= 1) return b.seconds;
  if (b.t <= SUN_T) {
    const log = Math.log10(a.seconds) + u * (Math.log10(b.seconds) - Math.log10(a.seconds));
    return 10 ** log;
  }
  return a.seconds + u * (b.seconds - a.seconds);
}

export const cosmicAgeYr = (seconds: number) => seconds / YEAR_S;
/** Years from now. Today is 0, which is deepTimeAt(0). */
export const offsetYr = (seconds: number) => cosmicAgeYr(seconds) - TODAY_YR;

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number) => [...String(n)].map(c => c === '-' ? '⁻' : c === '+' ? '' : SUP[+c] ?? c).join('');
/** Superscript scientific seconds. The chronometer's formatHour is the hour face; this is the cosmic counter. */
export function formatCosmicSeconds(seconds: number): string {
  if (!(seconds > 0) || !Number.isFinite(seconds)) return '0 s';
  const e = Math.floor(Math.log10(seconds));
  const m = seconds / 10 ** e;
  const head = Math.abs(m - 1) < 0.05 ? '' : `${(Math.round(m * 10) / 10).toFixed(1)} × `;
  return `${head}10${sup(e)} s`;
}

export function narrationEndFallback(): number {
  return CINE.b1 + NARRATION.seconds;
}
export function bangAt(narrationEndedAt: number): number {
  return narrationEndedAt + CINE.b2;
}

/** 0 outside a 120 ms window centred on the impact peak. Cap is 70%, or 40% when motion is reduced. */
export function bangFlash(t: number, narrationEndedAt: number, reduced: boolean): number {
  const peak = bangAt(narrationEndedAt) + CINE.bangPeak;
  const x = Math.abs(t - peak);
  if (x > CINE.flashHalf) return 0;
  const cap = reduced ? CINE.flashReduced / CINE.flash : 1;
  return cap * (1 - x / CINE.flashHalf);
}

export type CineStage = 'fade' | 'wait' | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'hold';
export function cineStage(t: number, begun: boolean, narrationEndedAt: number | null): CineStage {
  if (!begun) return t < CINE.fade ? 'fade' : 'wait';
  const end = narrationEndedAt ?? Number.POSITIVE_INFINITY;
  if (t < end) return 'b1';
  if (t < bangAt(end)) return 'b2';
  if (t < CINE.b3End) return 'b3';
  if (t < CINE.b4End) return 'b4';
  if (t < CINE.b5End) return 'b5';
  if (t < CINE.b6End) return 'b6';
  return 'hold';
}

/**
 * Radial flash, not a flat veil. nx and ny run −1..1 across the frame.
 * Amount 1 is 100% white-gold at the core and averages about 0.70 over the frame.
 */
export function flashLuma(nx: number, ny: number, amount: number): number {
  const r2 = nx * nx + ny * ny;
  const g = Math.exp(-r2 * 0.9);
  return Math.max(0, Math.min(1, amount * (0.34 + 0.66 * g)));
}

/** How far the shell has travelled, in the same −1..1 frame. It passes the corner (~1.4) by 0.6 s. */
export function shellRadius(dt: number): number {
  if (dt <= 0) return 0;
  const u = Math.min(1, dt / 0.6);
  return u * u * 1.45;
}

/** Pixels of the one-camera jolt. It hits during the bright flash and is gone by 0.18 s. */
export function kickOffset(dt: number, reduced: boolean): { x: number; y: number } {
  if (reduced || dt < 0 || dt > 0.18) return { x: 0, y: 0 };
  const s = dt < 0.035 ? dt / 0.035 : Math.max(0, 1 - (dt - 0.035) / 0.145);
  return { x: 34 * s, y: 48 * s };
}

/** The pinpoint is the core once the flash starts. No leftover dot. */
export function pinHeld(t: number, bang: number | null): boolean {
  if (bang == null) return true;
  return t < bang + CINE.bangPeak - 0.02;
}

/** One figure at a time, gone when its beat ends. The clock row is separate. “3 minutes” is not a panel row. */
export function panelFigure(t: number): string {
  if (t >= CINE.b3End && t < CINE.b3End + 5) return 'Temperature 10²⁷ K';
  if (t >= CINE.b3End + 5 && t < CINE.b4End) return 'Energy ≈ 100 GeV per particle';
  if (t >= CINE.b4End && t < CINE.b5End) return 'Hydrogen 75% · Helium 25%';
  if (t >= CINE.b5End && t < CINE.b6End) return 'Light still trapped';
  return '';
}

/** The shock ring is on its way out. By 0.75 s it has passed the corner and must not be drawn again. */
export function shellOnScreen(dt: number): boolean {
  return dt > 0.02 && dt < 0.75;
}

/** 0 blue-white, 1 gold, 2 amber, 3 deep red. B4, B5, then B6, each hotter in hue and darker in body. */
export function plasmaHeat(t: number): number {
  if (t <= CINE.b3End) return 0;
  if (t < CINE.b4End) return (t - CINE.b3End) / (CINE.b4End - CINE.b3End);
  if (t < CINE.b5End) return 1 + (t - CINE.b4End) / (CINE.b5End - CINE.b4End);
  return 2 + Math.min(1, Math.max(0, (t - CINE.b5End) / (CINE.b6End - CINE.b5End)));
}

/** Each stage is dimmer than the one before it. Filaments carry the light; the body stays dark. */
export function plasmaGain(t: number): number {
  if (t < CINE.b4End) return 1.85;
  if (t < CINE.b5End) return 1.55;
  return 1.32;
}

/** 0 while the title holds, then 1 once it has broken into the haze. */
export function titleDissolve(dtAfterHold: number): number {
  if (dtAfterHold <= 0) return 0;
  return Math.min(1, dtAfterHold / 1.3);
}

/** B1 subtitles, split across the file that is actually playing. Not the spoken stage directions. */
export function subtitleAt(t: number, narrationEndedAt: number | null): string {
  if (t < CINE.b1) return '';
  const end = narrationEndedAt ?? narrationEndFallback();
  if (t >= end) return '';
  const u = (t - CINE.b1) / Math.max(0.001, end - CINE.b1);
  if (u < 1 / 3) return 'In the beginning…';
  if (u < 2 / 3) return 'there was an event…';
  return 'It was called…';
}

/** The only four hero lines. Empty until the panel is allowed on screen. */
export function heroAt(t: number): string {
  if (t < CINE.panelAt) return '';
  if (t < 36) return 'THE BIG BANG';
  if (t < 54) return '3 minutes';
  if (t < 112) return '380,000 years';
  return 'Today · 13.8 billion years';
}

/** Bed level in dB. Silent before the click's B1. Stays at −6 dB until narration ends. Cue 2 takes over at 0:42; there is no 20–45 s loop. */
export function bedDb(t: number, narrationEndedAt: number | null): number {
  if (t < CINE.b1) return -80;
  if (narrationEndedAt == null) return CINE.bedB1;
  const b2 = narrationEndedAt;
  const ramped = b2 + CINE.bedRamp;
  if (t < b2) return CINE.bedB1;
  if (t < ramped) return CINE.bedB1 + (CINE.bedB2 - CINE.bedB1) * ((t - b2) / CINE.bedRamp);
  if (t < CINE.bedFullBy) return CINE.bedB2 * (1 - (t - ramped) / (CINE.bedFullBy - ramped));
  if (t < LATER_AUDIO.cue2At) return 0;
  if (t >= LATER_AUDIO.cue2At + LATER_AUDIO.cue2Fade) return -80;
  return -80 * ((t - LATER_AUDIO.cue2At) / LATER_AUDIO.cue2Fade);
}

/** Cue 2 level in dB. Dark-ages duck is −8 dB from 1:00–1:06 with 1 s ramps. */
export function cue2Db(t: number): number {
  if (t < LATER_AUDIO.cue2At) return -80;
  const u = Math.min(1, (t - LATER_AUDIO.cue2At) / LATER_AUDIO.cue2Fade);
  let db = -80 * (1 - u);
  const a = LATER_AUDIO.darkFrom, b = LATER_AUDIO.darkTo, r = LATER_AUDIO.darkRamp, d = LATER_AUDIO.darkDb;
  if (t >= a && t < a + r) db += d * ((t - a) / r);
  else if (t >= a + r && t < b - r) db += d;
  else if (t >= b - r && t < b) db += d * (1 - (t - (b - r)) / r);
  return db;
}

/** Extra music duck under a VO line. 300 ms attack, 600 ms release, −6 dB. */
export function voDuckDb(t: number): number {
  const lines: [number, number][] = [
    [LATER_AUDIO.voB7At, LATER_AUDIO.voB7Seconds],
    [LATER_AUDIO.voB9At, LATER_AUDIO.voB9Seconds],
    [LATER_AUDIO.voB14At, LATER_AUDIO.voB14Seconds],
  ];
  for (const [at, dur] of lines) {
    const attack = LATER_AUDIO.duckAttack, release = LATER_AUDIO.duckRelease, db = LATER_AUDIO.duckDb;
    if (t < at || t >= at + dur + release) continue;
    if (t < at + attack) return db * ((t - at) / attack);
    if (t < at + dur) return db;
    return db * (1 - (t - at - dur) / release);
  }
  return 0;
}

export const dbToGain = (db: number) => db <= -80 ? 0 : Math.min(1, 10 ** (db / 20));

/** Sun keyframe as years-from-now, checked against the milestone table without editing it. */
export function sunKeyframeCheck() {
  const seconds = KEYFRAMES.find(k => k.t === SUN_T)!.seconds;
  const age = cosmicAgeYr(seconds);
  const fromNow = age - TODAY_YR;
  const sunGapYr = -fromNow - DEEP.solarSystemAgeYr;
  const earthGapYr = -fromNow - DEEP.earthAgeYr;
  return { age, fromNow, sunGapYr, earthGapYr, now: deepTimeAt(0), milestones: MILESTONES.map(m => m.id) };
}
