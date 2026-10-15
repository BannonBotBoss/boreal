/**
 * Static guards for PROJECT-RULES.md. Cheap text checks over src/. Each allowlist names today's known exceptions and may
 * only SHRINK: a listed file that no longer violates fails the test until it is removed from the list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src');
const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(n) ? [p] : []; });
const all = files(ROOT).map(p => ({ path: relative(ROOT, p).split(sep).join('/'), text: readFileSync(p, 'utf8') }));
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); // ignore comments

function guard(name: string, violates: (text: string, path: string) => boolean, allowed: string[], home: string[] = []) {
  test(`rule: ${name}`, () => {
    const hits = all.filter(f => !home.includes(f.path) && violates(code(f.text), f.path)).map(f => f.path).sort();
    const fresh = hits.filter(h => !allowed.includes(h)), stale = allowed.filter(a => !hits.includes(a));
    assert.deepEqual(fresh, [], `${name}: new violation(s). See PROJECT-RULES.md.`);
    assert.deepEqual(stale, [], `${name}: fixed, so remove from the allowlist in tests/rules.test.ts (it only shrinks).`);
  });
}

// Rule 1: all randomness is seeded through proc/rng.ts.
guard('no Math.random outside proc/rng.ts', t => /Math\.random\s*\(/.test(t), [], ['proc/rng.ts']);
// Rule 2: one RNG/hash implementation (CPU) and one shader hash/noise library.
guard('no second CPU RNG/hash implementation', t => /Math\.imul\(|1664525|0x6d2b79f5|43758\.5453/i.test(t.replace(/`[\s\S]*?`/g, '')),
  ['core/bearBody.ts', 'core/body.ts'], ['proc/rng.ts', 'proc/glsl.ts']); // Claude's coat hashes -> proc/rng (proposal in AGENT-NOTES)
guard('no second shader hash/noise library', t => /float\s+(hash\w*|v?noise|fbm)\s*\(/.test(t) || /43758\.5453/.test(t.match(/`[\s\S]*?`/g)?.join('') ?? ''),
  ['render/fur.ts'], ['proc/glsl.ts']); // fur.ts: dead, awaiting Claude's OK to delete
// Rule 3: species are data. Species-named source files are legacy and may only disappear.
guard('no new species-specific source files', (_t, p) => /wolf|bear|deer|hare|elk|moose|fox|bird|owl|lynx|rabbit|animalRig/i.test(p),
  ['animals/hare.ts', 'audio/wolfVoice.ts', 'core/bearBody.ts', 'core/deerHerd.ts', 'core/wolfBody.ts', 'core/wolfModes.ts', 'render/animalRig.ts', 'render/bear.ts', 'render/playerWolf.ts']);
// Rule 2: one LOD/mesh path. Icosahedron "blob" builders and LOD assembly may only shrink.
guard('no new hand-built LOD or blob-geometry sites', t => /addLevel\(|IcosahedronGeometry/.test(t),
  ['animals/hare.ts', 'render/animalRig.ts', 'render/buildScene.ts', 'render/geometry.ts', 'render/rocks.ts', 'render/trees.ts']);
// Rule 4: gravity is derived from G, Earth mass and radius (proc/physics.ts). No literal g anywhere else.
guard('no literal gravity outside proc/physics.ts', t => /(^|[^\d.])9\.8\d*(?!\d)/m.test(t), ['core/animalBehavior.ts'], ['proc/physics.ts']); // Claude's Froude G = 9.81 (AGENT-NOTES)
// Rule 4b: masses are derived from composition x generated volume; no typed mass values in source.
guard('no literal mass values', t => /\bmass\w*\s*[:=]\s*[\d.]+\s*[,;}\n]/i.test(t) || /\bmass\(\s*[\d.]+\s*\)/.test(t), ['core/species.ts']); // Claude: massKg per archetype -> derive (AGENT-NOTES)
