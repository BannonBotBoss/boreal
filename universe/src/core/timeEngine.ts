/**
 * Time engine facade: cycle continuum first, then derived space / ξ.
 * Playback rate is decades of cosmic time per real second while playing.
 */
import {
  ALPHA_STAR,
  TODAY_YR,
  YEAR_S,
  cycleToSeconds,
  eraOfSeconds,
  expansionRate,
  expansionRatio,
  formatLength,
  formatSeconds,
  scaleFactor,
  secondsToCycle,
  spaceExtent,
} from './cosmicTime';

/** Cycle at “today” — playback soft-caps here so the lab does not run off to Infinity. */
export const CYCLE_TODAY = secondsToCycle(TODAY_YR * YEAR_S);

export interface UniverseSnapshot {
  seed: number;
  cycle: number;
  seconds: number;
  era: string;
  a: number;
  H: number;
  R: number;
  xi: number;
  polaritySplit: boolean;
  tStar: number | null;
  playing: boolean;
  rateDecadesPerSec: number;
}

export class TimeEngine {
  seed = 0;
  /** Continuous cycle coordinate (0 = nothing). */
  cycle = 0;
  playing = false;
  /** How many cycle decades to advance per real second while playing (~25 s Planck→today). */
  rateDecadesPerSec = 2.4;
  private tStar: number | null = null;
  private lastReal = 0;

  reset(seed: number) {
    this.seed = seed;
    this.cycle = 0;
    this.tStar = null;
    this.playing = false;
    this.lastReal = performance.now();
  }

  play() {
    this.playing = true;
    this.lastReal = performance.now();
  }

  pause() {
    this.playing = false;
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  step(now = performance.now()) {
    if (!this.playing) {
      this.lastReal = now;
      return this.snapshot();
    }
    const dt = Math.min(0.05, Math.max(0, (now - this.lastReal) / 1000));
    this.lastReal = now;
    // From cycle 0, first play enters Planck (cycle 1), then climbs decades up to today.
    if (this.cycle < 1) this.cycle = Math.min(1, this.cycle + dt * this.rateDecadesPerSec);
    else this.cycle = Math.min(CYCLE_TODAY, this.cycle + dt * this.rateDecadesPerSec);
    if (this.cycle >= CYCLE_TODAY) this.playing = false;

    const seconds = cycleToSeconds(this.cycle);
    const xi = expansionRatio(seconds);
    if (this.tStar === null && Number.isFinite(xi) && xi >= ALPHA_STAR) this.tStar = seconds;
    return this.snapshot();
  }

  snapshot(): UniverseSnapshot {
    const seconds = cycleToSeconds(this.cycle);
    const xi = expansionRatio(seconds);
    return {
      seed: this.seed,
      cycle: this.cycle,
      seconds,
      era: eraOfSeconds(seconds),
      a: scaleFactor(seconds),
      H: expansionRate(seconds),
      R: spaceExtent(seconds),
      xi,
      polaritySplit: this.tStar !== null,
      tStar: this.tStar,
      playing: this.playing,
      rateDecadesPerSec: this.rateDecadesPerSec,
    };
  }

  readout(s = this.snapshot()): string {
    const lines = [
      `<strong>seed</strong> ${s.seed || '—'}`,
      `<strong>cycle</strong> ${s.cycle.toFixed(3)}`,
      `<strong>t</strong> ${formatSeconds(s.seconds)}`,
      `<strong>era</strong> ${s.era}`,
      `<strong>a</strong> ${s.a.toExponential(3)}`,
      `<strong>H</strong> ${Number.isFinite(s.H) ? s.H.toExponential(3) + ' /s' : '∞'}`,
      `<strong>R_space</strong> ${formatLength(s.R)}`,
      `<strong>ξ = R·H/c</strong> ${s.xi.toExponential(3)}  (α★ = ${(1 / 137).toFixed(6)})`,
      `<strong>polarity</strong> ${s.polaritySplit ? `split @ t★ = ${formatSeconds(s.tStar!)}` : 'not yet'}`,
    ];
    return lines.join('<br>');
  }
}

export { secondsToCycle, cycleToSeconds };
