import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { NOT_IN_RUST } from '../src/data/notInRust';
import { decodeEngineReport, parseCycle } from '../src/core/engineReport';
import { frameShiftX, sphereLook } from '../src/world/cosmos/look';
import { loadPlanetSim } from '../src/core/planetBudget';

test('the not-in-Rust list names files that exist, and not-built rows have no file', () => {
  for (const row of NOT_IN_RUST) {
    if (row.kind === 'typescript') assert.ok(existsSync(new URL('../' + row.file, import.meta.url)), row.file);
    else { assert.equal(row.file, ''); assert.equal(row.kind, 'not-built'); }
  }
  assert.ok(NOT_IN_RUST.some(r => r.file.endsWith('planet.ts')));
  assert.ok(NOT_IN_RUST.some(r => r.file.endsWith('weather.ts')));
  assert.ok(NOT_IN_RUST.some(r => r.file.endsWith('altitudeZones.ts')));
  assert.ok(NOT_IN_RUST.some(r => r.what.includes('step') || r.file.endsWith('engine.ts')));
});

test('a cycle is accepted as written and is never clamped', () => {
  assert.equal(parseCycle('0'), 0);
  assert.equal(parseCycle('1'), 1);
  assert.equal(parseCycle('1e-3'), 0.001);
  assert.equal(parseCycle('-2.5'), -2.5);
  assert.equal(parseCycle('1e'), null);
  assert.equal(parseCycle('abc'), null);
});

test('the engine record decodes', () => {
  const text = [
    'v3',
    'TIME\t1\t5.39e-44\t1.7e-51\tPlanck',
    'INST\t1\tspacetime\t0\t\troot\t5.39e-44\t00:00:01\t1\tinflation\t2026-11-04\tthe expansion',
    'VAR\t1\tscale factor a\t\t0.001\t0.001\t0.001\t1',
    'SYM\t1\tfriedmann\tH\tH\t1/s\t10',
    'PAR\tspacetime\tG\tNewton\tm3\t6.67e-11\t6.67e-11',
    'EQ\tspacetime\tfriedmann\tFriedmann\tH^2',
    'LOG\tspawn\t1e-32\tε=1\tspacetime\treheating',
    'RULE\tspacetime\treheating\tinflation_ended\tε=1',
    'SESS\tgrid step\t3\t00:01:00\t12.5\t80\t15',
  ].join('\n');
  const r = decodeEngineReport(text);
  assert.equal(r.cycle, 1);
  assert.equal(r.instances[0].type, 'spacetime');
  assert.equal(r.instances[0].health, 1);
  assert.equal(r.instances[0].vars[0].value, 0.001);
  assert.equal(r.instances[0].symbols[0].name, 'H');
  assert.equal(r.log[0].child, 'reheating');
  assert.equal(r.sessions[0].calls, 3);
});

test('sphere radius and brightness follow the Rust outputs', () => {
  const dim = sphereLook(1e-40, 1e20, 1e3, 1);
  const bright = sphereLook(1e-10, 1e20, 1e12, 1e20);
  assert.ok(bright.radius > dim.radius);
  assert.ok(bright.brightness > dim.brightness);
  const hotter = sphereLook(1e-10, 1, 1e20, 1);
  const cooler = sphereLook(1e-10, 1, 10, 1);
  assert.notDeepEqual(hotter.color, cooler.color);
  for (const look of [dim, bright, hotter, cooler]) {
    assert.ok(look.color[2] > look.color[0] && look.color[2] > look.color[1] * 2, `violet ${look.color}`);
  }
  assert.equal(frameShiftX(0, 10, 40, 16 / 9), 0);
  assert.ok(frameShiftX(0.4, 10, 40, 16 / 9) > 0);
});

const wasmPath = new URL('../public/wasm/boreal_sim.wasm', import.meta.url);
const wasm = existsSync(wasmPath) ? readFileSync(wasmPath) : null;
const sim = wasm ? await loadPlanetSim(wasm) : null;
const skip = sim?.engineReport ? false : 'wasm has no engine registry yet';

test('wasm registry counts, decodes, and a parameter change moves the sphere', { skip }, () => {
  assert.ok(sim);
  sim!.setEngineCycle(1);
  const planck = decodeEngineReport(sim!.engineReport());
  assert.equal(planck.cycle, 1);
  assert.ok(planck.instances.some(i => i.type === 'spacetime'));
  assert.ok(!planck.instances.some(i => i.type === 'reheating'));
  const rho0 = planck.instances.find(i => i.type === 'spacetime')!.vars.find(v => v.label === 'total density')!.value;
  const g = planck.params.find(p => p.key === 'G')!.value;
  sim!.setEngineParam('G', g * 2);
  const changed = decodeEngineReport(sim!.engineReport());
  const rho1 = changed.instances.find(i => i.type === 'spacetime')!.vars.find(v => v.label === 'total density')!.value;
  assert.notEqual(sphereLook(1, 1, 1, rho0).brightness, sphereLook(1, 1, 1, rho1).brightness);
  sim!.resetEngines();
  const end = decodeEngineReport(sim!.engineReport());
  // Move to just after inflation by using a cycle large enough that reheating exists, then back.
  sim!.setEngineCycle(20);
  const later = decodeEngineReport(sim!.engineReport());
  assert.ok(later.instances.some(i => i.type === 'reheating'), later.log.map(l => l.child).join(','));
  assert.ok(later.log.some(l => l.child === 'reheating' && l.cause.includes('=')));
  sim!.setEngineCycle(1);
  const back = decodeEngineReport(sim!.engineReport());
  assert.ok(!back.instances.some(i => i.type === 'reheating'));
  void end;
});
