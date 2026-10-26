/**
 * One clock (T-0077). The in-game control drives core/worldClock, and a second time source fails this file.
 * performance.now / Date.now on the allowlists are frame budgets, input timestamps, profiling or wall-clock
 * stamps (badges, probes, the music shuffle seed, the real SDO date). They are not a second simulation clock.
 * The allowlist only shrinks: a listed file that no longer calls the function fails until it is removed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { K } from '../src/core/constants';
import { GROUND, tickGround } from '../src/core/ground';
import { WEATHER } from '../src/core/weather';
import { RENDER_SETTINGS } from '../src/core/renderSettings';
import { buildTabs } from '../src/ui/padMenu';
import { ACTION, conflicts, defaults } from '../src/core/bindings';

const ROOT = join(import.meta.dirname, '..', 'src');
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(n) ? [p] : []; });
const all = files(ROOT).map(p => ({ path: relative(ROOT, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));
/** Comments and quoted strings go. Template text goes too, but ${expressions} stay, so a clock call inside one still counts. */
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/'(?:\\'|[^'])*'/g, '').replace(/"(?:\\"|[^"])*"/g, '').replace(/`(?:\\`|[^`$]|\$\{(?:[^{}]|\{[^{}]*\})*\})*`/g, m => [...m.matchAll(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g)].map(x => x[1]).join(';'));

function guard(name: string, violates: (text: string) => boolean, allowed: string[], home: string[] = []) {
  test(`one clock: ${name}`, () => {
    const hits = all.filter(f => !home.includes(f.path) && violates(code(f.text))).map(f => f.path).sort();
    const fresh = hits.filter(h => !allowed.includes(h)), stale = allowed.filter(a => !hits.includes(a));
    assert.deepEqual(fresh, [], `${name}: a second time source. Route it through core/worldClock, or justify it on the allowlist.`);
    assert.deepEqual(stale, [], `${name}: no longer present, so remove it from the allowlist in tests/single-clock.test.ts.`);
  });
}

const FRAME = [
  'animals/hare.ts', 'animals/locomotion/lab.ts', 'core/interest.ts', 'core/stages/elevation.ts', 'core/stages/flow.ts', 'core/stages/rivers.ts', 'core/stages/soils.ts', 'core/weather.ts',
  'dev/walkProbe.ts', 'input/padRouter.ts', 'main.ts', 'render/batch.ts', 'render/flora/fartrees.ts', 'render/flora/flora.ts', 'render/flora/moss.ts', 'render/grass/grass.ts',
  'render/math.ts', 'render/photoreal.ts', 'render/startup.ts', 'render/trees/conifer.ts', 'render/trees/game.ts', 'render/trees/viewer.ts',
  'ui/controls.ts', 'ui/gamepadSettings.ts', 'ui/haptics.ts', 'ui/loading.ts', 'ui/shapeTools.ts',
  'world/globe/globeView.ts', 'world/globe/home.ts', 'world/globe/inpage.ts', 'world/globe/tile.ts', 'world/sun/sunView.ts',
];
const WALL = [
  'audio/music.ts', 'core/badges.ts', 'core/genome.ts', 'core/probe.ts', 'core/stages/elevation.ts', 'core/stages/flow.ts', 'core/stages/rivers.ts', 'core/stages/soils.ts',
  'render/startup.ts', 'ui/badgePanel.ts', 'ui/padMenu.ts', 'world/sun/sunView.ts',
];

guard('no performance.now outside the clock and frame budgets', t => /performance\.now\s*\(/.test(t), FRAME, ['core/worldClock.ts']);
guard('no Date.now outside the clock and wall-clock stamps', t => /Date\.now\s*\(/.test(t), WALL, ['core/worldClock.ts']);
guard('no THREE.Clock or getDelta', t => /\.getDelta\s*\(|new\s+THREE\.Clock\b/.test(t), []);
guard('no timeScale and no ground speed multiplier', t => /\btimeScale\b|GROUND\.speed\b/.test(t), []);

test('one user-facing time control: the menu has no Time tab and the settings have no rate slider', () => {
  const host = { act() {}, shutter() {}, settings() {}, help() {}, close() {}, notice() {} };
  assert.deepEqual(buildTabs(host, () => {}).map(t => t.id), ['layers', 'camera', 'badges', 'gallery', 'settings']);
  assert.equal(RENDER_SETTINGS.some(d => d.id === 'world.groundSpeed' || d.id === 'weather.timeScale'), false);
  assert.equal('timeScale' in WEATHER, false);
  assert.equal('speed' in GROUND, false);
  assert.deepEqual(conflicts(defaults()), [], 'the clock bindings do not clash with the defaults');
  assert.equal(ACTION.timePause.pad[0], 'ls.click');
});

test('ground years advance by the clock game-seconds, with no extra multiplier', () => {
  const y = GROUND.years;
  tickGround(K.julian_year_s);
  assert.equal(GROUND.years, y + 1);
  GROUND.years = y;
});
