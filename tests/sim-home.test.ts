/**
 * Simulation lives in rust/boreal-sim. TypeScript draws and takes input.
 * tests/sim-home-ceiling.json is the line count of every existing simulation
 * file under src/. Those files may shrink. A larger file, or a new file
 * outside the draw/input allowlist, fails this test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SRC = join(import.meta.dirname, '..', 'src');
const ceiling = JSON.parse(readFileSync(join(import.meta.dirname, 'sim-home-ceiling.json'), 'utf8')) as Record<string, number>;

/** Draw, input, and the page shell. New TypeScript is allowed here. */
const ALLOW = /^(render|input|ui|audio|photo|vr|camera|dev|config|data)\//;
const allow = (path: string) => ALLOW.test(path) || path === 'main.ts' || path === 'audio.ts';

const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : name.endsWith('.ts') ? [path] : [];
});

function listed() {
  return files(SRC).map(abs => relative(SRC, abs).split(sep).join('/')).filter(path => !allow(path)).sort();
}

test('simulation files outside Rust may only shrink', () => {
  const have = listed();
  const grown = have.filter(path => ceiling[path] != null && readFileSync(join(SRC, path), 'utf8').split('\n').length > ceiling[path]);
  const added = have.filter(path => ceiling[path] == null);
  assert.deepEqual(grown, [], `simulation grew in TypeScript (ceiling is tests/sim-home-ceiling.json): ${grown.join(', ')}`);
  assert.deepEqual(added, [], `new simulation file outside Rust: ${added.join(', ')}. Write it in rust/boreal-sim and call it from TypeScript.`);
});

test('the draw and input directories are the only place new TypeScript may appear', () => {
  const rules = readFileSync(join(import.meta.dirname, '..', 'PROJECT-RULES.md'), 'utf8');
  const agents = readFileSync(join(import.meta.dirname, '..', 'AGENTS.md'), 'utf8');
  for (const text of [rules, agents]) {
    assert.match(text, /Simulation lives in Rust/);
    assert.match(text, /rust\/boreal-sim/);
    assert.match(text, /may only shrink/);
    assert.match(text, /gamepad, mouse, and keyboard/i);
  }
  assert.ok(Object.keys(ceiling).length > 100, 'the ceiling lost the existing simulation files');
  for (const path of Object.keys(ceiling)) assert.equal(allow(path), false, `${path} is draw or input and does not belong on the simulation ceiling`);
});
