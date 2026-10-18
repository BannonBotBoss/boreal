/**
 * Planet globe, milestone 1 (Grok Bot): the seeded height and water function on the unit sphere. Pure maths, no three.js,
 * so tests and any renderer can call it. Every value is a function of (seed, unit direction) only, so every LOD level and
 * every visit sample the same surface from the same seed.
 *
 * Layers (one function, `sampleSurface`):
 *  1. Planet relief: ridged multifractal (Musgrave 1989) + broad fBm basins on 3D value noise, the SAME formula family as
 *     core/stages/elevation `base()` (ridged multifractal + low basins), here evaluated on the sphere so it has no seams.
 *     Lattice values come from proc/rng (rule 1); no second hash.
 *  2. Sea level by hypsometry: the seed's noise is sampled once on a Fibonacci sphere (González 2010) and sea level is set
 *     so the land share matches Earth's.
 *  3. Home region: the live game's playable area is one region of the planet. Around a seeded home direction the relief is
 *     lifted to the home elevation, and inside the region the game's own height function (core/world heightAt, passed in)
 *     is sampled through a gnomonic tangent-plane projection, so the ground there IS the playable terrain.
 */
import { hash, random } from '../../proc/rng';
import { smoothstep } from '../../proc/math';
import { LEVEL, PHYS } from '../../core/tuning';

export const PLANET = {
  radius: PHYS.EARTH_RADIUS,     // m: IUGG mean Earth radius (core/tuning PHYS, Moritz 2000)
  landShare: .292,               // Earth's land share of the surface, 29.2 % (ETOPO1 hypsometry, Eakins & Sharman 2012) [verify]
  maxLand: 6000,                 // m at the top of the seed's land distribution [game calibration; Everest is 8849 m]
  maxDepth: 5500,                // m at the bottom of the seed's ocean distribution [game calibration; mean ocean depth 3682 m, Charette & Smith 2010]
  octaves: 16,                   // fixed octave count: identical at every LOD level (no level-dependent popping); top octave ≈ 1 km
  baseFreq: 1.6,                 // lattice cells per radius for the first octave [game calibration: a handful of continents]
  home: {
    latDeg: 49.77,               // Kenora, Ontario (Lake of the Woods), where the game's boreal forest is set
    elevation: 370,              // m: Kenora town ≈ 370 m a.s.l. (Lake of the Woods 323 m, Canadian Hydrographic Service) [verify]
    liftKm: 450,                 // km: e-folding radius of the lift that guarantees land around home [game calibration]
    halfSize: 3840,              // m: half the region side = one tile of the stage-1 periodic grid (ELEV.n × ELEV.cell / 2)
    feather: 1200,               // m: blend from the game terrain into the planet relief at the region edge [game calibration]
  },
};

export type Vec3 = [number, number, number];
/** Local height of the playable area, in game metres around LEVEL.waterSurface (core/world heightAt). */
export type LocalHeight = (x: number, z: number) => number;
export interface Surface {
  /** Ground height above sea level (m). */
  h: number;
  /** Water surface height (m) or -Infinity when dry. Ocean = 0; home-region lakes = the game's water plane. */
  water: number;
  /** 'ocean' | 'lake' | '' (dry). */
  kind: '' | 'ocean' | 'lake';
  /** Weight of the home region (1 = pure game terrain). */
  home: number;
  /** Game-local coordinates when inside the home region (m). */
  x: number; z: number;
}

/** 3D value noise over a 256-entry permutation and value table drawn from proc/rng (Perlin 1985 lattice indexing,
 *  quintic fade of Perlin 2002). Per-octave offsets decorrelate octaves so the 256-cell period never lines up. */
function makeNoise(seed: number) {
  const r = random(hash(`globe-v1:${seed}`)), P = new Uint8Array(512), V = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } // Fisher–Yates
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  for (let i = 0; i < 256; i++) V[i] = r();
  const off = Array.from({ length: 24 }, () => [r() * 256, r() * 256, r() * 256]);
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10), l = (a: number, b: number, t: number) => a + (b - a) * t;
  function noise(x: number, y: number, z: number) {
    const xf = Math.floor(x), yf = Math.floor(y), zf = Math.floor(z), X = xf & 255, Y = yf & 255, Z = zf & 255;
    const u = fade(x - xf), v = fade(y - yf), w = fade(z - zf);
    const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return l(l(l(V[P[AA]], V[P[BA]], u), l(V[P[AB]], V[P[BB]], u), v),
      l(l(V[P[AA + 1]], V[P[BA + 1]], u), l(V[P[AB + 1]], V[P[BB + 1]], u), v), w);
  }
  /** Raw relief in noise units for a unit direction: ridged multifractal (as stages/elevation base) + broad basins. */
  function relief(dx: number, dy: number, dz: number, octaves = PLANET.octaves) {
    let amp = 1, sum = 0, norm = 0, weight = 1, f = PLANET.baseFreq * 2;
    for (let o = 0; o < octaves; o++) {
      const s = noise(dx * f + off[o][0], dy * f + off[o][1], dz * f + off[o][2]);
      const ridge = (1 - Math.abs(s * 2 - 1)) ** 2; sum += ridge * amp * weight; weight = Math.min(1, ridge * 1.6); norm += amp; amp *= .5; f *= 2;
    }
    let basins = 0, ba = .5, bf = PLANET.baseFreq; // continents: 4 octaves of plain fBm
    for (let o = 0; o < 4; o++) { basins += ba * noise(dx * bf + off[20 + o][0], dy * bf + off[20 + o][1], dz * bf + off[20 + o][2]); ba *= .5; bf *= 2; }
    return sum / norm * .45 + basins / .9375 * 1.1;
  }
  return { noise, relief };
}

/** Fibonacci sphere point k of n (González 2010, "Measurement of areas on a sphere using Fibonacci and latitude–longitude lattices"). */
export function fibonacci(k: number, n: number): Vec3 {
  const y = 1 - (2 * k + 1) / n, r = Math.sqrt(1 - y * y), phi = k * Math.PI * (3 - Math.sqrt(5));
  return [Math.cos(phi) * r, y, Math.sin(phi) * r];
}
/** Unit direction from latitude/longitude (radians); +Y is the north pole. */
export function fromLatLon(lat: number, lon: number): Vec3 { const c = Math.cos(lat); return [c * Math.cos(lon), Math.sin(lat), c * Math.sin(lon)]; }
export function toLatLon([x, y, z]: Vec3) { return { lat: Math.asin(Math.max(-1, Math.min(1, y))), lon: Math.atan2(z, x) }; }
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export type Planet = ReturnType<typeof createPlanet>;
const planets = new Map<string, Planet>();
/** The planet for a seed (cached per seed + local function). `local` is the game's height function for the home region. */
export function planetFor(seed: number, local?: LocalHeight, key = '') {
  const k = `${seed}:${key}`; let p = planets.get(k); if (!p) planets.set(k, p = createPlanet(seed, local)); return p;
}
export function createPlanet(seed: number, local?: LocalHeight) {
  const { relief } = makeNoise(seed), R = PLANET.radius, H = PLANET.home;
  // Hypsometry: sea level so `landShare` of the surface is above it (low octaves suffice for the distribution).
  const N = 6000, samples = new Float32Array(N);
  for (let k = 0; k < N; k++) { const [x, y, z] = fibonacci(k, N); samples[k] = relief(x, y, z, 8); }
  const sorted = Float32Array.from(samples).sort(), sea = sorted[Math.floor(N * (1 - PLANET.landShare))];
  const top = sorted[Math.floor(N * .995)], bottom = sorted[Math.floor(N * .005)];
  const toMetres = (n: number) => n >= sea ? (n - sea) / (top - sea) * PLANET.maxLand : (n - sea) / (sea - bottom) * PLANET.maxDepth;
  // Home: seeded longitude at Kenora's latitude; a local frame (east, north, up) for the gnomonic projection.
  const home = fromLatLon(H.latDeg * Math.PI / 180, (random(hash(`globe-home-v1:${seed}`))() * 2 - 1) * Math.PI);
  const east = norm(cross([0, 1, 0], home)), north = cross(home, east);
  const homeRaw = toMetres(relief(home[0], home[1], home[2])), lift = H.elevation - homeRaw, liftRad = H.liftKm * 1000 / R;
  const out: Surface = { h: 0, water: -Infinity, kind: '', home: 0, x: 0, z: 0 };
  /** Height + water at a unit direction. Reuses one result object (copy what you keep). */
  function sampleSurface(d: Vec3): Surface {
    let h = toMetres(relief(d[0], d[1], d[2]));
    const c = dot(d, home), ang = Math.acos(Math.max(-1, Math.min(1, c)));
    h += lift * Math.exp(-((ang / liftRad) ** 2)); // home lift (Gaussian) so the region is land at the home elevation
    out.water = h < 0 ? 0 : -Infinity; out.kind = h < 0 ? 'ocean' : ''; out.home = 0; out.x = out.z = 0;
    if (c > 0 && ang * R < H.halfSize * 2) {
      const x = R * dot(d, east) / c, z = -R * dot(d, north) / c; // gnomonic: game +x = east, game -z = north (heading 0 faces -z)
      const w = 1 - smoothstep(H.halfSize - H.feather, H.halfSize, Math.max(Math.abs(x), Math.abs(z)));
      if (w > 0) {
        const g = local ? local(x, z) : 0;
        h = h + (H.elevation + g - h) * w; out.home = w; out.x = x; out.z = z;
        if (w > .5 && g < LEVEL.waterSurface) { out.water = H.elevation + LEVEL.waterSurface; out.kind = 'lake'; }
      }
    }
    out.h = h; return out;
  }
  /** Unit direction of a game-local point (inverse gnomonic). */
  function fromLocal(x: number, z: number): Vec3 { return norm([home[0] + (east[0] * x - north[0] * z) / R, home[1] + (east[1] * x - north[1] * z) / R, home[2] + (east[2] * x - north[2] * z) / R]); }
  return { seed, sampleSurface, fromLocal, home, east, north, sea, radius: R, relief };
}

/** Surface colour (linear-ish sRGB 0..1) for a sample: a data table, game band colours inside the home region. */
export const GLOBE_COLOURS = {
  deep: [.03, .12, .25], shallow: [.07, .3, .45], lake: [.14, .3, .34],
  // home region: the game's terrain band colours (render/math BAND_COLOR: shore 0x929771, forest 0x788e60, upland 0x8d9582)
  shore: [.573, .592, .443], forest: [.471, .557, .376], upland: [.553, .584, .510],
  temperate: [.30, .45, .22], boreal: [.20, .32, .17], tundra: [.47, .46, .36], rock: [.45, .42, .38], snow: [.92, .93, .95], beach: [.75, .7, .52],
} as const;
type RGB = readonly [number, number, number];
const mix = (a: RGB, b: RGB, t: number, o: number[]) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
/** Biome colour by water depth, elevation and latitude [game calibration bands]; the game's bands inside the home region. */
export function surfaceColour(s: Surface, d: Vec3, o: number[] = [0, 0, 0]) {
  const C = GLOBE_COLOURS;
  if (s.kind === 'ocean') return mix(C.shallow, C.deep, smoothstep(0, 2000, -s.h), o);
  if (s.kind === 'lake') return mix(C.lake, C.lake, 0, o);
  const lat = Math.abs(Math.asin(Math.max(-1, Math.min(1, d[1])))) * 180 / Math.PI;
  const veg = lat < 45 ? C.temperate : lat < 62 ? C.boreal : C.tundra;
  mix(C.beach, veg, smoothstep(2, 40, s.h), o);
  if (s.h > 1200) mix(o as unknown as RGB, C.rock, smoothstep(1200, 2600, s.h), o);
  const snowLine = 4200 - 3600 * smoothstep(40, 75, lat); // snow line falls with latitude [game calibration]
  if (s.h > snowLine - 400 || lat > 78) mix(o as unknown as RGB, C.snow, lat > 78 ? 1 : smoothstep(snowLine - 400, snowLine + 300, s.h), o);
  if (s.home > 0) { // inside the playable region: the game's own band colours, blended at the feather
    const g = s.h - PLANET.home.elevation, band = g < LEVEL.shore ? C.shore : g > LEVEL.upland ? C.upland : C.forest;
    const t = [o[0], o[1], o[2]] as const; mix(t, band, s.home, o);
  }
  return o;
}
