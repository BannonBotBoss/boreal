import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOVER, CLOVER_STATE, cloverStateJSON, loadCloverState, createCloverField, regrowTransaction, sunSeconds, unitsAt, type CloverSite } from '../src/core/clover';
import { TRANSACTIONS } from '../src/core/transactions';
import { CONTACTS } from '../src/core/contactBus';
import { hourAt, dayAt, lighting, sunPosition, REAL_SECONDS_PER_GAME_HOUR } from '../src/core/timeOfDay';
import { climate } from '../src/core/weather';
import { createAgent } from '../src/core/agent/pipeline';
import { HARE_AGENT } from '../src/core/agent/species';
import { untagged } from '../src/core/stateFields';
import { stream } from '../src/proc/rng';

const sunny = (): CloverSite => ({ water: false, light: 1, wet: 0, rock: 0, slopeDeg: 0 });
const GAME_DAY = 24 * REAL_SECONDS_PER_GAME_HOUR;
function field() { let t = 1000; const f = createCloverField(sunny, undefined, 7, () => t); f.ensure(8, 8, 4, 9); return { f, set: (v: number) => { t = v; }, get t() { return t; } }; }

test('lazy regrowth (closed form over sun tables) matches stepping the regrow transaction on the game clock', () => {
  const { f } = field(); const p = [...f.list()][0]; assert.ok(p, 'a sunny tile has patches');
  const w0 = 1000, w1 = w0 + 3 * GAME_DAY; // three game days
  const stepped = { ...p, units: 0 }; const dt = 15;
  for (let w = w0; w < w1; w += dt) { const h = hourAt(w + dt / 2), d = dayAt(w + dt / 2);
    regrowTransaction(stepped, dt, lighting(sunPosition(h, d).elevation).day, climate(d, h).tC, d); }
  const lazy = unitsAt({ ...p, units: 0, at: w0 }, w1);
  assert.ok(lazy > 0, 'grows'); assert.ok(Math.abs(lazy - stepped.units) / stepped.units < .03, `lazy ${lazy.toFixed(1)} vs stepped ${stepped.units.toFixed(1)}`);
  const mid = w0 + 1.37 * GAME_DAY, a = unitsAt({ ...p, units: 0, at: w0 }, mid), b = unitsAt({ ...p, units: a, at: mid }, w1);
  assert.ok(Math.abs(a + 0 - a) < 1e-9 && Math.abs(b - lazy) < 1e-6, 'settling half way changes nothing (additive)');
  assert.equal(sunSeconds(w0, w0), 0); assert.ok(sunSeconds(w0, w0 + GAME_DAY) > 0);
  const far = unitsAt({ ...p, units: 0, at: w0 }, w0 + 1e7); assert.equal(far, p.max, 'a long absence refills exactly to max (capped loop)');
});

test('graze and regrow are transaction rows; graze needs the feed contact; the grazed delta is saved and re-applied', () => {
  CLOVER_STATE.clear(); const F = field(); const p = [...F.f.list()][0];
  assert.equal(TRANSACTIONS.get('clover', 'sun')?.name, 'regrow');
  assert.equal(F.f.eat(p.key, 50, 'hare:91'), 0, 'no contact, no graze'); assert.equal(TRANSACTIONS.get('hare', 'clover')?.name, 'graze');
  CONTACTS.begin({ a: 'hare:91', b: p.key, at: [0, 0, 0], normal: [0, 1, 0], kind: 'feed', source: 'agent:feed' });
  assert.equal(F.f.eat(p.key, 50, 'hare:91'), 50); CONTACTS.end('hare:91', p.key);
  assert.equal(F.f.eat(p.key, 50, 'hare:91'), 0, 'contact ended');
  const d = CLOVER_STATE.get(p.key)!; assert.equal(d.units, p.max - 50); assert.equal(d.at, 1000);
  const json = cloverStateJSON(); loadCloverState(null); assert.equal(CLOVER_STATE.size, 0); loadCloverState(json);
  const G = field(); const q = G.f.get(p.key)!; assert.equal(q.units, p.max - 50, 'a rebuilt tile keeps the graze');
  G.set(1000 + 2 * GAME_DAY); assert.ok(G.f.unitsOf(q) > p.max - 50, 'and regrows from it lazily');
  CLOVER_STATE.clear(); G.f.reload(); assert.equal(G.f.get(p.key)!.units, p.max, 'rewind to before the graze: full again');
  assert.ok(CLOVER.unitsPerM2 > 0);
});

test('every agent and clover patch field is tagged in STATE_FIELDS', () => {
  const a = createAgent(HARE_AGENT, 'hare:1', 0, 0, stream(1, 't')); a.target = { x: 0, z: 0 }; a.food = 'clover:x'; a.contact = 'clover:x';
  assert.deepEqual(untagged('agent', a), []);
  const F = field(); assert.deepEqual(untagged('cloverPatch', [...F.f.list()][0]), []);
});