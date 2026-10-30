/**
 * Globe -> landscape seam baseline (sprint #192, Oct 29). Headless: no renderer, no network.
 * For ten globe clicks it engages the landing exactly as the in-page drop does (engageLanding), then measures
 *  - coordinate agreement: SITE lat/lon vs the clicked lat/lon,
 *  - landing height: local heightAt(0,0) vs the horizon skirt's height for the same point,
 *  - seam: |local heightAt - skirt height| on rings where the chunk patch hands over to the skirt,
 *  - relief: local height range vs the planet's own height range over the same 600 m disc,
 *  - load errors: any throw or non-finite height.
 * DEM / photo tiles are fetched in the browser only, so here sampleDem is null and the planet function is the whole story.
 * Run: npx tsx tools/globe-seam-baseline.ts [--json]
 */
import { engageLanding, clearLanding } from '../src/world/globe/landingSite';
import { heightAt, WORLD_SEED } from '../src/core/world';
import { SITE, siteDirection } from '../src/core/sitePhase';
import { surfaceDetail } from '../src/core/surface';
import { fromLatLon, planetFor, PLANET } from '../src/world/globe/planet';
import { skirtOrigin, skirtSample } from '../src/world/globe/horizonSkirt';

/**
 * Ten Earth-named clicks. The globe's height is the seeded planet (planet.ts), not Earth, so most Earth coordinates are
 * ocean or lake there. Each entry therefore also carries a test on the planet sample, and pickSite walks a 1 degree grid
 * outward from the Earth coordinate to the nearest point that passes it (a real landing for that kind of site).
 */
type Probe = { lat: number; h: number; kind: '' | 'ocean' | 'lake'; oceanNear: boolean };
const dry = (p: Probe) => p.kind === '' && p.h > 0;
export const SEAM_LOCATIONS: readonly { name: string; lat: number; lon: number; ok: (p: Probe) => boolean }[] = [
  { name: 'boreal forest', lat: 50.0, lon: -94.0, ok: p => dry(p) && p.lat > 48 && p.lat < 62 && p.h < 600 },
  { name: 'tundra', lat: 68.5, lon: -133.7, ok: p => dry(p) && p.lat > 64 && p.lat < 74 },
  { name: 'alpine', lat: 46.5, lon: 8.0, ok: p => dry(p) && p.h > 1800 },
  { name: 'coast', lat: 49.3, lon: -123.2, ok: p => dry(p) && p.oceanNear },
  { name: 'desert', lat: 23.4, lon: 25.7, ok: p => dry(p) && Math.abs(p.lat) > 15 && Math.abs(p.lat) < 32 },
  { name: 'tropics', lat: -3.1, lon: -60.0, ok: p => dry(p) && Math.abs(p.lat) < 10 },
  { name: 'ocean edge', lat: 36.6, lon: -121.9, ok: p => p.kind === 'ocean' && !p.oceanNear },
  { name: 'polar', lat: 78.2, lon: 15.6, ok: p => dry(p) && Math.abs(p.lat) > 74 },
  { name: 'prairie', lat: 51.0, lon: -106.0, ok: p => dry(p) && p.lat > 44 && p.lat < 56 && p.h > 400 && p.h < 900 },
  { name: 'wetland (lake)', lat: 25.9, lon: -80.9, ok: p => p.kind === 'lake' },
];
const D2R = Math.PI / 180;
function probe(lat: number, lon: number): Probe {
  const planet = planetFor(WORLD_SEED);
  const s = planet.sampleSurface(fromLatLon(lat * D2R, lon * D2R));
  const out = { lat, h: s.h, kind: s.kind, oceanNear: false };
  // "near" = a 0.1 degree ring (about 11 km) touches the other side of the shoreline
  for (let i = 0; i < 8 && !out.oceanNear; i++) {
    const a = i / 8 * Math.PI * 2, n = planet.sampleSurface(fromLatLon((lat + 0.1 * Math.sin(a)) * D2R, (lon + 0.1 * Math.cos(a)) * D2R));
    out.oceanNear = out.kind === 'ocean' ? n.kind !== 'ocean' : n.kind === 'ocean';
  }
  return out;
}
export function pickSite(loc: (typeof SEAM_LOCATIONS)[number]) {
  for (let r = 0; r <= 60; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const lat = loc.lat + dy, lon = ((loc.lon + dx + 540) % 360) - 180;
    if (Math.abs(lat) > 85) continue;
    if (loc.ok(probe(lat, lon))) return { lat, lon, movedDeg: r };
  }
  return null;
}
export const SEAM_RINGS_M = [28, 100, 300, 600];
const BEARINGS = 16;

export function measureSeam(lat: number, lon: number) {
  const planet = planetFor(WORLD_SEED);
  const errors: string[] = [];
  try {
    if (!engageLanding(fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180), 0)) errors.push('landing did not engage');
    const dLat = Math.abs(SITE.latDeg - lat), dLon = Math.abs(((SITE.lonDeg - lon + 540) % 360) - 180);
    const y0 = heightAt(0, 0);
    const origin = skirtOrigin(planet, y0), detail0 = surfaceDetail(0, 0);
    const skirtY = (x: number, z: number) => skirtSample(planet, x, z, origin).y + (surfaceDetail(x, z) - detail0) * 0.5;
    const ring: Record<number, number> = {};
    let localMin = Infinity, localMax = -Infinity, planetMin = Infinity, planetMax = -Infinity, nonFinite = 0;
    for (const r of SEAM_RINGS_M) {
      let worst = 0;
      for (let i = 0; i < BEARINGS; i++) {
        const a = i / BEARINGS * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r;
        const local = heightAt(x, z), far = skirtY(x, z);
        if (!Number.isFinite(local) || !Number.isFinite(far)) { nonFinite++; continue; }
        worst = Math.max(worst, Math.abs(local - far));
        localMin = Math.min(localMin, local); localMax = Math.max(localMax, local);
        const ph = planet.sampleSurface(siteDirection(x, z, PLANET.radius)).h;
        planetMin = Math.min(planetMin, ph); planetMax = Math.max(planetMax, ph);
      }
      ring[r] = Math.round(worst * 100) / 100;
    }
    if (nonFinite) errors.push(`${nonFinite} non-finite heights`);
    const r2 = (v: number) => Math.round(v * 100) / 100;
    return { lat, lon, dLatDeg: r2(dLat), dLonDeg: r2(dLon), datumM: r2(SITE.datumM), landingDeltaM: r2(Math.abs(y0 - skirtY(0, 0))),
      seamMaxM: ring, localReliefM: r2(localMax - localMin), planetReliefM: r2(Math.max(0, planetMax) - Math.max(0, planetMin)), errors };
  } catch (e) {
    errors.push(String(e));
    return { lat, lon, errors };
  } finally { clearLanding(); }
}

if (process.argv[1]?.endsWith('globe-seam-baseline.ts')) {
  const rows = SEAM_LOCATIONS.map(l => { const p = pickSite(l); return p ? { name: l.name, movedDeg: p.movedDeg, ...measureSeam(p.lat, p.lon) } : { name: l.name, errors: ['no matching planet site within 60 degrees'] }; });
  if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
  else for (const r of rows) console.log(JSON.stringify(r));
}
