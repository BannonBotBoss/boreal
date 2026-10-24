/** Sunspots from the solar cycle (T-0067), driven by real SILSO daily sunspot numbers (V2.0, public/data/silso, CC BY-NC 4.0,
 *  SILSO World Data Center, Royal Observatory of Belgium). Causal chain: cycle phase -> latitude band -> bipolar group
 *  (tilt, polarity) -> area -> lifetime -> rotation across the disc.
 *  - Group count: R_G = 12.08 G (Hoyt & Schatten 1998, Sol. Phys. 179, 189) -> G = R/12.08 visible groups.
 *  - Spoerer/butterfly: mean latitude 28 deg * exp(-t/90 months) from cycle start, spread ~7 deg (Hathaway 2011, Sol. Phys. 273, 221).
 *  - Joy's law: tilt = 32.1 deg * sin(lat) (Stenflo & Kosovichev 2012, ApJ 745, 129).
 *  - Hale's law: leading polarity flips each cycle and between hemispheres (cycle 25 north leading +).
 *  - Areas: lognormal, median 62 MSH, geometric sigma 2.45 (Baumann & Solanki 2005, A&A 443, 1061).
 *  - Lifetime: Gnevyshev-Waldmeier A_max = W*T, W = 10 MSH/day (Petrovay & van Driel-Gesztelyi 1997, Sol. Phys. 176, 249).
 *  - Differential rotation (sidereal, deg/day): 14.713 - 2.396 sin^2 - 1.787 sin^4 (Howard et al. 1990; SunPy default, numbers only).
 *  - Umbra ~3900 K, penumbra ~5450 K, umbra ~20% of spot area (Solanki 2003, A&ARv 11, 153).
 *  - Cycle minima (SILSO 13-month smoothed): 1996.6 (C23), 2008.9 (C24), 2019.9 (C25). */
export const CYCLE_MINIMA: [number, number][] = [[23, 1996.6], [24, 2008.9], [25, 2019.9]];
export const SPOT = { umbraT: 3900, penumbraT: 5450, umbraFrac: .2, medianMSH: 62, sigmaG: 2.45, W: 10, groupsPerR: 1 / 12.08 };

export interface SilsoDay { year: number; R: number }
export function parseSilso(csv: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const line of csv.split('\n')) { const f = line.split(';'); if (f.length < 5) continue; const R = Number(f[4]); if (R >= 0) m.set(`${f[0]}-${f[1].padStart(2, '0')}-${f[2].trim().padStart(2, '0')}`, R); }
  return m;
}
export const isoDay = (d: Date) => d.toISOString().slice(0, 10);
export const decimalYear = (d: Date) => d.getUTCFullYear() + (d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / (365.25 * 864e5);
export function cycleAt(year: number) { let c = CYCLE_MINIMA[0]; for (const m of CYCLE_MINIMA) if (year >= m[1]) c = m; return { cycle: c[0], months: (year - c[1]) * 12 }; }
export const meanLatitude = (months: number) => 28 * Math.exp(-Math.max(0, months) / 90);
export const joyTilt = (latDeg: number) => 32.1 * Math.sin(latDeg * Math.PI / 180);
/** sign of the leading spot's polarity */
export const halePolarity = (cycle: number, north: boolean) => (cycle % 2 ? 1 : -1) * (north ? 1 : -1);
export const omega = (latDeg: number) => { const s2 = Math.sin(latDeg * Math.PI / 180) ** 2; return 14.713 - 2.396 * s2 - 1.787 * s2 * s2; };
/** synodic rate seen from Earth: subtract Earth's orbital 0.9856 deg/day */
export const omegaSynodic = (latDeg: number) => omega(latDeg) - .9856;
/** spot radius as a fraction of R_sun for an area in millionths of the hemisphere (MSH) */
export const radiusFrac = (msh: number) => Math.sqrt(2e-6 * msh);

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const normal = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

export interface Group { lat: number; lon: number; tilt: number; polarity: number; areaMSH: number; ageDays: number; lifeDays: number; born: string }
/** mean group lifetime implied by the area law (days), used to turn the visible count into a birth rate */
export const MEAN_LIFE = (() => { let s = 0; const r = rng(7); for (let i = 0; i < 4000; i++) s += Math.min(60, Math.max(1, SPOT.medianMSH * Math.exp(Math.log(SPOT.sigmaG) * normal(r)) / SPOT.W)); return s / 4000; })();

/** Groups on the Earth-facing hemisphere on a date. lon = Stonyhurst longitude (0 = disc centre, +west). Deterministic:
 *  each birth day has its own seed, so scrubbing the date moves the same groups across the disc. */
export function groupsOn(date: Date, silso: Map<string, number>): Group[] {
  const out: Group[] = [], maxBack = 60;
  for (let k = 0; k <= maxBack; k++) {
    const bd = new Date(date.getTime() - k * 864e5), key = isoDay(bd), R = silso.get(key); if (R === undefined) continue;
    const { cycle, months } = cycleAt(decimalYear(bd)), rate = R * SPOT.groupsPerR * 2 / MEAN_LIFE; // x2: half the births are on the far side
    const r = rng(Number(key.replace(/-/g, '')) * 2654435761); let n = 0; for (let L = Math.exp(-rate), p = r(); p > L; p *= r()) n++; // Poisson(rate)
    for (let i = 0; i < n; i++) {
      const north = r() < .5, lat = (north ? 1 : -1) * Math.max(2, meanLatitude(months) + 7 * normal(r)), area = SPOT.medianMSH * Math.exp(Math.log(SPOT.sigmaG) * normal(r));
      const life = Math.min(maxBack, Math.max(1, area / SPOT.W)), lon0 = r() * 360 - 180;
      if (k > life) continue;
      const lon = ((lon0 + omegaSynodic(Math.abs(lat)) * k + 540) % 360) - 180; if (Math.abs(lon) > 90) continue;
      const grow = Math.min(1, (k + .5) / Math.max(1, life * .2)), decay = Math.max(0, 1 - Math.max(0, k - life * .2) / (life * .8)); // fast growth, linear decay
      out.push({ lat, lon, tilt: joyTilt(lat), polarity: halePolarity(cycle, north), areaMSH: area * Math.min(grow, decay || 1e-3), ageDays: k, lifeDays: life, born: key });
    }
  }
  return out;
}
