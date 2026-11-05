/**
 * T-0164 (#192): continentality at 64.5 N, 119.7 W against NWT warm-season temperatures.
 *
 * The metric is the existing warm-quarter air temperature, seaLevelZoneSeasonAtC minus the lapse rate times
 * elevation. The tool is that function (and siteMaritimeWeight / continentalityRatio / treeLineAtM / coverKind).
 * Calibration: a known match is the warmest-quarter helper at zone_season_fraction against seaLevelZoneSeasonAtC
 * (difference under 1e-9). A known mismatch is the same helper at one month (fraction 1/12), which must sit warmer
 * than the quarter and must not be treated as the 6.4 C root-zone line.
 *
 * Station June-August means are Environment and Climate Change Canada 1981-2010 daily averages, copied in
 * tasks/evidence/T-0164/stations.json. The Taiga Shield High Subarctic bracket is the GNWT 2008 modelled July
 * range, not a station and not the growing-season soil line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Z from '../data/earth/altitude-zones.json' with { type: 'json' };
import {
  continentalityRatio, oceanDecayLengthM, seaLevelAnnualC, seaLevelZoneSeasonAtC, siteMaritimeWeight, treeLineAtM,
} from '../src/core/altitudeZones';
import { coverKind, coverRow } from '../src/world/globe/coverKind';

type Station = {
  name: string; climate_id: string; lat_dms: number[]; lon_dms: number[]; elev_m: number;
  member: 'continental' | 'shore' | 'distance_to_tuktoyaktuk';
  jun_C: number; jul_C: number; aug_C: number; source: string;
};
const table = JSON.parse(readFileSync('tasks/evidence/T-0164/stations.json', 'utf8')) as {
  click: { lat: number; lon: number; elev_m: number; coast_m: number; vegetation: number };
  gnwt_taiga_shield_hs: { july_C: number[] };
  stations: Station[];
};

const dms = (parts: number[]) => Math.sign(parts[0] || 1) * (Math.abs(parts[0]) + Math.abs(parts[1]) / 60 + Math.abs(parts[2]) / 3600);
/** Same sine as altitude-zones.json zone_season: annual mean plus amplitude * sin(pi f) / (pi f), then the lapse. */
function warmestFractionC(latDeg: number, maritimeW: number, fraction: number, elevM: number): number {
  const amp = Z.seasonal_half_range_pole_K * Math.abs(Math.sin(latDeg * Math.PI / 180)) * continentalityRatio(maritimeW);
  const f = Math.PI * fraction;
  return seaLevelAnnualC(latDeg) + Math.sin(f) / f * amp - Z.lapse_K_per_m * Math.max(0, elevM);
}
function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6_371_000, p = Math.PI / 180;
  const dlat = (lat2 - lat1) * p, dlon = (lon2 - lon1) * p;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * Math.sin(dlon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

test('T-0164: warm-quarter helper matches the tree-line season and July does not', () => {
  const { lat, coast_m: coast } = table.click;
  const w = siteMaritimeWeight(coast)!;
  const quarter = warmestFractionC(lat, w, Z.zone_season_fraction, 0);
  assert.ok(Math.abs(quarter - seaLevelZoneSeasonAtC(lat, w)) < 1e-9, `helper ${quarter} vs seaLevelZoneSeasonAtC ${seaLevelZoneSeasonAtC(lat, w)}`);
  const july = warmestFractionC(lat, w, 1 / 12, table.click.elev_m);
  const wq = seaLevelZoneSeasonAtC(lat, w) - Z.lapse_K_per_m * table.click.elev_m;
  assert.ok(july > wq + 1, `July-equivalent ${july} should be warmer than the warm quarter ${wq}`);
  assert.ok(Math.abs(july - Z.tree_line_growing_season_C) > 2, 'July air is not the 6.4 C root-zone line');
  assert.equal(Z.tree_line_growing_season_C, 6.4);
  assert.equal(Z.lapse_K_per_m, 0.0065);
});

test('T-0164: NWT stations are warmer than the existing continental summer, so the click stays closed boreal', () => {
  const click = table.click;
  const wClick = siteMaritimeWeight(click.coast_m)!;
  assert.ok(wClick > 0 && wClick < 0.01, `156 km is the continental end member, weight ${wClick}`);
  assert.ok(siteMaritimeWeight(195_000)! < 0.01, 'the live-grid upper distance, 195 km, is the same end member');
  assert.equal(siteMaritimeWeight(0), 1);
  const decayKm = oceanDecayLengthM() / 1000;
  assert.ok(decayKm > 10 && decayKm < 80, `decay length ${decayKm} km`);

  const tuk = table.stations.find(s => s.name.startsWith('Tuktoyaktuk'))!;
  const tukLat = dms(tuk.lat_dms), tukLon = dms(tuk.lon_dms);
  const lines: string[] = [];
  for (const s of table.stations) {
    const lat = dms(s.lat_dms);
    const maritime = s.member === 'shore' ? 1
      : s.member === 'distance_to_tuktoyaktuk' ? siteMaritimeWeight(haversineM(lat, dms(s.lon_dms), tukLat, tukLon))!
      : 0;
    if (s.member === 'distance_to_tuktoyaktuk') {
      const km = haversineM(lat, dms(s.lon_dms), tukLat, tukLon) / 1000;
      assert.ok(km > 100 && km < 160, `Inuvik to Tuktoyaktuk ${km} km`);
    }
    const jja = (s.jun_C + s.jul_C + s.aug_C) / 3;
    const model = seaLevelZoneSeasonAtC(lat, maritime) - Z.lapse_K_per_m * s.elev_m;
    lines.push(`${s.name} (${s.climate_id}): model warm quarter ${model.toFixed(2)} C, station JJA ${jja.toFixed(2)} C, July ${s.jul_C.toFixed(1)} C, weight ${maritime.toFixed(4)}`);
    assert.ok(model < jja, `${s.name}: model ${model} C is not warmer than station JJA ${jja} C (${s.source})`);
  }

  const wq = seaLevelZoneSeasonAtC(click.lat, wClick) - Z.lapse_K_per_m * click.elev_m;
  const july = warmestFractionC(click.lat, wClick, 1 / 12, click.elev_m);
  const tree = treeLineAtM(click.lat, wClick);
  const kind = coverKind(click.lat, click.elev_m, click.vegetation, false, click.coast_m);
  const row = coverRow(click.lat, click.lon, click.elev_m, click.vegetation, false, click.coast_m);
  lines.push(`click 64.5,-119.7: weight ${wClick.toFixed(6)}, ratio ${continentalityRatio(wClick).toFixed(4)}, warm quarter ${wq.toFixed(2)} C, July-equivalent ${july.toFixed(2)} C, tree line ${tree.toFixed(1)} m, cover ${kind}, stems ${row.stemsPerHa}`);
  console.log(lines.join('\n'));

  assert.ok(wq - Z.tree_line_growing_season_C > 2, `376 m is ${wq} C, still above 6.4 C by more than the 2 K ecotone`);
  assert.ok(july < table.gnwt_taiga_shield_hs.july_C[0], `July-equivalent ${july} C is below the GNWT modelled July floor, not above the bracket`);
  assert.ok(Z.seasonal_half_range_pole_K >= 15.5, 'the stations do not justify a smaller polar half-range');
  assert.ok(Z.zonal_land_fraction <= 0.7, 'a higher land fraction would cool the inland summer further');
  assert.equal(kind, 'boreal', 'above the 6.4 C line the existing rule is closed boreal');
  assert.equal(row.kind, kind);
  assert.ok(row.stemsPerHa >= 1000 && row.stemsPerHa <= 3000, `closed boreal stems ${row.stemsPerHa}`);
  assert.ok(tree > click.elev_m);
});
