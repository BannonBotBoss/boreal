// Review page for the planet budgets: one equirectangular map per layer, drawn from the wasm grid (TypeScript fallback: solar layer only).
// ?layer=<plane>&day=<1..365>&steps=<days to run after the seed>&res=<nlat> (nlon = 2 nlat). Sets document.title to "ready" when drawn.
import { PLANE_INFO, PLANE_NAMES, loadPlanetSim, solarLayerFallback, type PlaneName } from '../src/core/planetBudget';
import { fromLatLon, planetFor } from '../src/world/globe/planet';

const q = new URLSearchParams(location.search), $ = (id: string) => document.getElementById(id)!;
const layer = $('layer') as HTMLSelectElement, dayIn = $('day') as HTMLInputElement, status = $('status'), info = $('info'), cv = $('map') as HTMLCanvasElement;
const nlat = Number(q.get('res')) || 90, nlon = nlat * 2; cv.width = nlon; cv.height = nlat;
const names = PLANE_NAMES.filter(n => PLANE_INFO[n].budget !== 'input' || n === 'land' || n === 'elev');
for (const n of names) layer.add(new Option(`${PLANE_INFO[n].budget}: ${PLANE_INFO[n].label} (${PLANE_INFO[n].unit})`, n));
layer.value = q.get('layer') ?? 'qabs'; dayIn.value = q.get('day') ?? '172';
const sim = await loadPlanetSim();
const planet = planetFor(1400);
function reseed() {
  if (!sim) return;
  sim.init(nlat, nlon).setLand((lat, lon) => { const s = planet.sampleSurface(fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180)); return { land: s.h > 0 ? 1 : 0, elev: Math.max(0, s.h) }; }).seed(Number(dayIn.value), 0);
  for (let i = 0; i < Number(q.get('steps') ?? 0) * 8; i++) sim.step(3 * 3600);
}
// diverging/sequential ramp: dark blue → teal → yellow → white
const stops = [[8, 12, 60], [20, 90, 140], [60, 170, 120], [240, 220, 80], [255, 255, 255]];
const ramp = (t: number) => { const x = Math.min(.9999, Math.max(0, t)) * (stops.length - 1), i = Math.floor(x), f = x - i; return stops[i].map((a, k) => a + (stops[i + 1][k] - a) * f); };
function draw() {
  const name = layer.value as PlaneName; let data: Float64Array;
  if (sim) data = sim.plane(name); else if (name === 'qabs') data = solarLayerFallback(nlat, nlon, Number(dayIn.value), 0); else { status.textContent = 'wasm not built: only the solar layer (TypeScript fallback)'; return; }
  let lo = Infinity, hi = -Infinity; for (const v of data) if (v > -900) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const g = cv.getContext('2d')!, im = g.createImageData(nlon, nlat);
  for (let r = 0; r < nlat; r++) for (let c = 0; c < nlon; c++) {
    const v = data[r * nlon + c], k = ((nlat - 1 - r) * nlon + c) * 4, col = v <= -900 ? [30, 30, 30] : ramp((v - lo) / (hi - lo || 1));
    im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  const i = PLANE_INFO[name]; info.textContent = `${i.label}: ${lo.toPrecision(4)} … ${hi.toPrecision(4)} ${i.unit} · day ${sim ? sim.day.toFixed(0) : dayIn.value} · ${sim ? 'rust/wasm' : 'TypeScript fallback'} · ${nlon}×${nlat} cells`;
  document.title = 'ready';
}
layer.onchange = draw; $('step').onclick = () => { for (let i = 0; i < 8; i++) sim?.step(3 * 3600); draw(); };
$('reseed').onclick = () => { reseed(); draw(); }; dayIn.onchange = () => { reseed(); draw(); };
reseed(); draw();
