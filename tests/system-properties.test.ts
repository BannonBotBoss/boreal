/** T-0037 systems properties file: moved figures keep their pre-move values (no behaviour change), the wiring is
 *  consistent, every reader really reads its group, every linked table exists and docs/system-map.md is not stale. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PENDING_GROUPS, PROPERTY_META, SYSTEM_MAP, SYSTEM_PROPERTIES, type SystemId } from '../src/config/systemProperties';
import { DOC, renderSystemMap } from '../tools/system-map';
import { DEFAULT_PITCH, LOOK_PITCH_RANGE, RIDER_DISTANCE, RIDER_FLANK, RIDER_HEIGHT, clampPitch, springLookPitch } from '../src/render/math';
import { PLAYER } from '../src/core/playerTuning';
import { JUMP } from '../src/animals/locomotion/jump';
import { CHRONO } from '../src/ui/chronometer';
import { LOADING } from '../src/ui/loading';
import { FEEL } from '../src/ui/haptics';
import { PAW } from '../src/audio/footsteps';
import { SENSES } from '../src/core/senses';
import { HALO } from '../src/core/senseBeacons';
import { ANIMAL_DEFAULT_ENERGY, FEED_DURATION, FEED_REACH, FORAGE_ENERGY, PLAYER_HEARING_RADIUS, SENSE_RADII, THREAT_MEMORY } from '../src/core/animalBehavior';
import { DAY_OF_YEAR, LATITUDE, REAL_SECONDS_PER_GAME_HOUR, START_HOUR } from '../src/core/timeOfDay';
import { CLOCK } from '../src/core/worldClock';
import { GOVERNOR } from '../src/core/quality';
import { RENDER_SETTINGS } from '../src/core/renderSettings';

const deg = Math.PI / 180;
test('values lock: every moved figure equals its value before T-0037, except the T-0101 follow camera', () => {
  assert.equal(DEFAULT_PITCH, -5 * deg); assert.equal(LOOK_PITCH_RANGE, 30 * deg); assert.equal(RIDER_HEIGHT, 1.05); assert.equal(RIDER_DISTANCE, 3.6); assert.equal(RIDER_FLANK, 0);
  assert.equal(clampPitch(-10), -Math.PI * 80 / 180); assert.equal(clampPitch(10), Math.PI * 89 / 180);
  assert.equal(springLookPitch(0, 0, .1), DEFAULT_PITCH + (0 - DEFAULT_PITCH) * Math.exp(-14 * .1));
  assert.deepEqual(PLAYER.speedScale, { walk: 1, run: 1.5, sprint: 1.5, stealth: 1, 'super-stealth': 1 });
  assert.equal(PLAYER.pounceSpeed, 8); assert.equal(PLAYER.pounceCarry, 1.15);
  assert.deepEqual(JUMP, { crouch: .18, flight: .65, land: .17, depth: .15, reach: .35 });
  assert.deepEqual(CHRONO, { rate: 3, ease: 8 });
  assert.deepEqual(LOADING, { cardSeconds: 7, fadeMs: 900, manifest: '/loading/manifest.json' });
  const feel = Object.fromEntries(RENDER_SETTINGS.filter(d => d.id.startsWith('feel.') && d.id !== 'feel.gameplay' && d.id !== 'feel.ui' && d.id !== 'feel.editor').map(d => [d.id, d.default]));
  assert.deepEqual(feel, { 'feel.haptics': true, 'feel.intensity': .6, 'feel.sound': true }); assert.equal(FEEL.intensity, .6);
  assert.deepEqual(PAW, { minGap: .09, pitchJitter: .05, gainJitter: .25, foreRate: .96, hindRate: 1.04, pairBoost: .2 });
  assert.deepEqual(SENSES, { range: 40, threshold: .025, cueLife: 3, cueCap: 6, thoughtCap: 3, updateSeconds: .15 });
  assert.deepEqual(HALO, { radius: .62, maxBeacons: 9, fadeFrom: .9, fadeTo: 4, speedEase: .35 });
  assert.deepEqual([ANIMAL_DEFAULT_ENERGY, FORAGE_ENERGY, PLAYER_HEARING_RADIUS, FEED_DURATION, FEED_REACH, THREAT_MEMORY], [75, 18, 40, 2, 1, 3]);
  assert.deepEqual([...SENSE_RADII], [3, 10, 24]);
  assert.deepEqual([REAL_SECONDS_PER_GAME_HOUR, LATITUDE, DAY_OF_YEAR, START_HOUR, CLOCK.maxOfflineSec], [300, 49.5, 227, 8, 3 * 86400]);
  const g = GOVERNOR;
  assert.deepEqual([g.targetFps, g.ms, g.iterations, g.threshold, g.flipflops, g.lower, g.upper, g.cooldownMs, g.upHoldMs, g.rememberMs, g.worldHoldMs],
    [60, 250, 10, .75, 6, .92, 1.35, 10000, 30000, 60000, 20000]);
});

const groups = Object.keys(SYSTEM_PROPERTIES) as (keyof typeof SYSTEM_PROPERTIES)[];
const ids = Object.keys(SYSTEM_MAP) as SystemId[];
test('every figure has units and a source; every group lists readers that really read it', () => {
  for (const g of groups) {
    const meta = PROPERTY_META[g]; assert.ok(meta, `PROPERTY_META.${g} missing`);
    for (const k of Object.keys(SYSTEM_PROPERTIES[g])) { const m = meta.keys[k]; assert.ok(m && m[0] && m[1], `${g}.${k}: units and source (or 'estimate') needed`); }
    for (const k of Object.keys(meta.keys)) assert.ok(k in SYSTEM_PROPERTIES[g], `PROPERTY_META.${g}.${k} has no figure`);
    assert.ok(meta.readers.length, `${g}: no readers`);
    for (const r of meta.readers) assert.ok(readFileSync(r, 'utf8').includes(`SYSTEM_PROPERTIES.${g}`), `${r} does not read SYSTEM_PROPERTIES.${g}`);
  }
  for (const g of Object.keys(PROPERTY_META)) assert.ok(g in SYSTEM_PROPERTIES || g in PENDING_GROUPS, `PROPERTY_META.${g}: unknown group`);
});

test('wiring: each group belongs to one system, dependencies are known systems, modules and linked tables exist', () => {
  const owner = new Map<string, string>();
  for (const id of ids) for (const g of SYSTEM_MAP[id].groups) {
    assert.ok(!owner.has(g), `${g} claimed by ${owner.get(g)} and ${id}`); owner.set(g, id);
    assert.ok(g in SYSTEM_PROPERTIES || g in PENDING_GROUPS, `${id}: group ${g} neither present nor pending`);
  }
  for (const g of groups) assert.ok(owner.has(g), `group ${g} belongs to no system in SYSTEM_MAP`);
  for (const id of ids) {
    const s = SYSTEM_MAP[id];
    for (const d of s.dependsOn) { assert.ok(d in SYSTEM_MAP, `${id} depends on unknown ${d}`); assert.notEqual(d, id); }
    for (const m of s.modules) assert.ok(existsSync(m), `${id}: module ${m} missing`);
    for (const t of Object.keys(s.tables)) {
      const [p, e] = t.split('#'); assert.ok(existsSync(p), `${id}: ${p} missing`);
      assert.match(readFileSync(p, 'utf8'), new RegExp(`export (function ${e}\\b|(const|let) [^;]*\\b${e}\\s*[:=])`), `${id}: ${p} has no export ${e}`);
    }
  }
});

test('docs/system-map.md is up to date (npm run system-map)', () => {
  assert.ok(existsSync(DOC), 'run npm run system-map');
  assert.equal(readFileSync(DOC, 'utf8').replace(/\r\n/g, '\n'), renderSystemMap(), 'stale: run npm run system-map and commit docs/system-map.md');
});
