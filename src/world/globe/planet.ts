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
/** Local surface of the playable area, game metres around LEVEL.waterSurface: a height (core/world heightAt; water is
 *  wherever it is below LEVEL.waterSurface) or { height, water } with the water surface (lakes, rivers) or null
 *  (core/stages/surfaceAt; see home.ts). */
export type LocalHeight = (x: number, z: number) => number | { height: number; water: number | null; soil?: string; wet?: number };
export interface Surface {
  /** Ground height above sea level (m). */
  h: number;
  /** Water surface height (m) or -Infinity when dry. Ocean = 0; home-region lakes = the game's water plane. */
  water: number;
  /** Reference water level here (m): sea level 0, or the game's water plane inside the home region. h − level is the
   *  signed land/water field the renderer contours per pixel. */
  level: number;
  /** 'ocean' | 'lake' | '' (dry). */
  kind: '' | 'ocean' | 'lake';
  /** Weight of the home region (1 = pure game terrain). */
  home: number;
  /** Game-local coordinates when inside the home region (m). */
  x: number; z: number;
  soil: string;  // home: stage-3 soil material ('' unknown / off-region)
  wet: number;   // home: site wetness 0..1 (-1 unknown)
  hill: number;  // off-region hill relief, -1 (hollow) .. 1 (ridge top); drives outcrops / wet hollows in the colour
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
  /** Kenora-scale hills (m) for land outside the playable region: ridged noise, wavelengths ~4 km down to ~125 m, about
   *  �40 m (staged home relief p1-p99 is ~80 m), so the far field keeps relief to the horizon. Off-region only. [game calibration] */
  function hills(dx: number, dy: number, dz: number) {
    let amp = 1, sum = 0, norm = 0, f = PLANET.radius / 4000;
    for (let o = 0; o < 6; o++) { const s = noise(dx * f + off[8 + o][0], dy * f + off[8 + o][1], dz * f + off[8 + o][2]); sum += (1 - Math.abs(s * 2 - 1)) ** 2 * amp; norm += amp; amp *= .5; f *= 2; }
    return (sum / norm - .33) * 120;
  }
  return { noise, relief, hills };
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
  const { relief, hills } = makeNoise(seed), R = PLANET.radius, H = PLANET.home;
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
  const out: Surface = { h: 0, water: -Infinity, level: 0, kind: '', home: 0, x: 0, z: 0, soil: '', wet: -1, hill: 0 };
  /** Height + water at a unit direction. Reuses one result object (copy what you keep). */
  function sampleSurface(d: Vec3): Surface {
    let h = toMetres(relief(d[0], d[1], d[2]));
    const c = dot(d, home), ang = Math.acos(Math.max(-1, Math.min(1, c)));
    h += lift * Math.exp(-((ang / liftRad) ** 2)); // home lift (Gaussian) so the region is land at the home elevation
    out.hill = 0; out.soil = ''; out.wet = -1;
    if (h > 0) { const hl = hills(d[0], d[1], d[2]); out.hill = Math.max(-1, Math.min(1, hl / 50)); h += hl * smoothstep(0, 80, h); } // far-field relief (kept off the coastline)
    out.water = h < 0 ? 0 : -Infinity; out.kind = h < 0 ? 'ocean' : ''; out.level = 0; out.home = 0; out.x = out.z = 0;
    if (c > 0 && ang * R < H.halfSize * 2) {
      const x = R * dot(d, east) / c, z = -R * dot(d, north) / c; // gnomonic: game +x = east, game -z = north (heading 0 faces -z)
      const w = 1 - smoothstep(H.halfSize - H.feather, H.halfSize, Math.max(Math.abs(x), Math.abs(z)));
      if (w > 0) {
        const L = local ? local(x, z) : 0, g = typeof L === 'number' ? L : L.height;
        const wl = typeof L === 'number' ? (g < LEVEL.waterSurface ? LEVEL.waterSurface : null) : L.water; // water surface here, if any
        h = h + (H.elevation + g - h) * w; out.home = w; out.x = x; out.z = z;
        if (typeof L !== 'number') { out.soil = L.soil ?? ''; out.wet = L.wet ?? -1; }
        if (w > .5) { const wet = wl !== null && g < wl; out.level = H.elevation + (wet ? wl : LEVEL.waterSurface); out.water = wet ? out.level : -Infinity; out.kind = wet ? 'lake' : ''; }
      }
    }
    out.h = h; return out;
  }
  /** Unit direction of a game-local point (inverse gnomonic). */
  function fromLocal(x: number, z: number): Vec3 { return norm([home[0] + (east[0] * x - north[0] * z) / R, home[1] + (east[1] * x - north[1] * z) / R, home[2] + (east[2] * x - north[2] * z) / R]); }
  return { seed, sampleSurface, fromLocal, home, east, north, sea, radius: R, relief, hills };
}

/** Surface colour (linear-ish sRGB 0..1): one boreal palette everywhere (home and far field), so the playable region
 *  and the land around it read as the same country. Traits from reference aerials/ISS photos of the Canadian Shield
 *  (see AGENT-NOTES globe reference bands): dark mottled spruce, lighter mixed stands, pink-grey bedrock outcrops on
 *  ridges, olive-brown bog and fen in wet hollows, pale sand only on outwash and beaches. [reference calibration]
 *  Inside the home region the colour follows the game's own data (stage-3 soil + wetness via surfaceAt); outside it
 *  follows the far-field hills (ridges ? outcrop, hollows ? wetland) and a fine per-point mottle. */
export const GLOBE_COLOURS = {
  deep: [.03, .12, .25], shallow: [.07, .3, .45], // water: shaded per pixel by depth (tile.ts globeMaterial)
  spruce: [.105, .17, .085], mixed: [.19, .27, .12], bog: [.30, .29, .17], rock: [.46, .42, .39], sand: [.62, .57, .42],
  temperate: [.24, .36, .16], tundra: [.45, .43, .33], snow: [.92, .93, .95], beach: [.70, .65, .48],
} as const;
type RGB = readonly [number, number, number];
const mix = (a: RGB, b: RGB, t: number, o: number[]) => { o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
const mixTo = (o: number[], b: RGB, t: number) => mix([o[0], o[1], o[2]], b, t, o);
/** Deterministic fine mottle 0..1 for a direction (~tens of metres: stand-to-stand variation). */
const mottle = (d: Vec3) => { const v = Math.sin(d[0] * 1.29898e6 + d[1] * 7.8233e6 + d[2] * 3.7719e6) * 43758.5453; return v - Math.floor(v); };
/** LAND colour (water is contoured and shaded per pixel by the material). */
export function surfaceColour(s: Surface, d: Vec3, o: number[] = [0, 0, 0]) {
  const C = GLOBE_COLOURS;
  const lat = Math.abs(Math.asin(Math.max(-1, Math.min(1, d[1])))) * 180 / Math.PI, m = mottle(d);
  // forest: spruce ? mixed stands by hill position and mottle; temperate south of 45�, tundra north of 62�
  mix(C.spruce, C.mixed, Math.max(0, Math.min(1, .35 + .3 * s.hill + .5 * (m - .5))), o);
  if (lat < 45) mixTo(o, C.temperate, smoothstep(45, 38, lat)); else if (lat > 60) mixTo(o, C.tundra, smoothstep(60, 66, lat));
  if (s.home < 1) { // far field: outcrops on ridge tops, wetlands in hollows, beaches on sea coasts
    const k = 1 - s.home;
    mixTo(o, C.rock, k * .75 * smoothstep(.45, .9, s.hill + .25 * (m - .5)));
    mixTo(o, C.bog, k * .55 * smoothstep(-.35, -.8, s.hill + .25 * (m - .5)));
    mixTo(o, C.beach, k * (1 - smoothstep(2, 25, s.h)));
  }
  if (s.home > 0 && s.soil) { // home: the game's soils
    const w = s.home, sc = s.soil === 'bedrock' ? C.rock : s.soil === 'peat' ? C.bog : s.soil === 'sand' ? C.sand : null;
    if (sc) mixTo(o, sc, w * (s.soil === 'bedrock' ? .8 : s.soil === 'peat' ? .75 : .55));
    if (s.wet >= 0) mixTo(o, C.bog, w * .45 * smoothstep(.6, .95, s.wet));
  }
  if (s.h > 1200) mixTo(o, C.rock, smoothstep(1200, 2600, s.h));
  const snowLine = 4200 - 3600 * smoothstep(40, 75, lat); // snow line falls with latitude [game calibration]
  if (s.h > snowLine - 400 || lat > 78) mixTo(o, C.snow, lat > 78 ? 1 : smoothstep(snowLine - 400, snowLine + 300, s.h));
  return o;
}
