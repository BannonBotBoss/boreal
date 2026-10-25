// T-0062 / issue #46: the crate source tree is planet_fundamentals, and each formula lives in one file.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const src = join(import.meta.dirname, '..', 'rust', 'boreal-sim', 'src');
const root = join(src, 'planet_fundamentals');
const files = [
  'energy/solar_budget.rs', 'energy/albedo.rs', 'energy/longwave.rs', 'energy/energy_update.rs',
  'hydrosphere/evaporation.rs', 'hydrosphere/precipitation.rs', 'hydrosphere/humidity_column.rs',
  'hydrosphere/sst.rs', 'hydrosphere/soil_moisture.rs', 'hydrosphere/ice_fraction.rs',
  'atmosphere/pressure.rs', 'atmosphere/wind.rs', 'atmosphere/instability.rs',
  'atmosphere/cloud_fraction.rs', 'atmosphere/cloud_optical_depth.rs',
  'surface/land_sea_mask.rs', 'surface/heat_capacity.rs', 'surface/roughness.rs',
  'surface/elevation.rs', 'surface/vegetation_fraction.rs',
  'climate_seed.rs', 'planet_initialization.rs', 'planet_update.rs',
];
const removed = ['solar_budget.rs', 'surface_budget.rs', 'hydrosphere_budget.rs', 'atmosphere_budget.rs',
  'climate_seed.rs', 'update_energy.rs', 'update_moisture.rs', 'update_clouds.rs', 'update_wind.rs'];

test('issue #46 tree is present and the flat budget files are gone', () => {
  for (const f of files) assert.equal(existsSync(join(root, f)), true, f);
  for (const f of removed) assert.equal(existsSync(join(src, f)), false, f);
});

test('vegetation fraction is the later stub and does not define a fraction', () => {
  const text = readFileSync(join(root, 'surface/vegetation_fraction.rs'), 'utf8');
  assert.equal(text.includes('pub fn'), false);
  assert.match(text, /later/);
});

test('wasm export names and layout version stay', () => {
  const lib = readFileSync(join(src, 'lib.rs'), 'utf8');
  assert.match(lib, /fn grid_init\(/);
  assert.match(lib, /fn grid_seed\(/);
  assert.match(lib, /fn grid_step\(/);
  assert.match(lib, /fn layout_version\(\) -> u32 \{ 3 \}/);
});

function rustFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...rustFiles(p));
    else if (name.endsWith('.rs')) out.push(p);
  }
  return out;
}

test('solar, the bucket and surface pressure are each defined once', () => {
  const hits = (name: string) => rustFiles(src).filter(p => new RegExp(`^pub fn ${name}\\(`, 'm').test(readFileSync(p, 'utf8')));
  const rel = (ps: string[]) => ps.map(p => p.slice(p.indexOf('rust/boreal-sim'))).sort();
  assert.deepEqual(rel(hits('solar')), ['rust/boreal-sim/src/planet_fundamentals/energy/solar_budget.rs']);
  assert.deepEqual(rel(hits('bucket_step')), ['rust/boreal-sim/src/planet_fundamentals/hydrosphere/soil_moisture.rs']);
  assert.deepEqual(rel(hits('surface_pressure')), ['rust/boreal-sim/src/planet_fundamentals/atmosphere/pressure.rs']);
});
