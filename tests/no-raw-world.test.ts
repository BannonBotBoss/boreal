// T-0095, roadmap step 15. Issues #101, #105, #106. #106 wins.
//
// The crossing from the Rust simulation to the Three.js viewer is numeric.
// rust/boreal-sim is the cdylib. src/core/planetBudget.ts instantiates it and
// reads Float64Array planes over wasm memory. extern "C" exports return
// numbers or *mut f64. The perception block (T-0083) is little-endian bytes:
// perception.rs writes them, perceptionBuffer.ts reads them. Issue #101's
// JSON list of animals was never built. This test keeps it unbuilt.
//
// Step 36's outside-body summary is not built and is not an exception. A
// summary that JSON-encodes animal positions or the raw world fails here.
//
// Allowlist: ALLOWLIST below. Empty. A path is listed only when this scanner
// hits it and the hit is still a legitimate save or evidence file. The list
// only shrinks: a listed path that no longer hits fails the test.
//
// Not hits, so not allowlisted:
// - tests/, tools/, tasks/, notes/, refs/, data/ are outside the scanner.
//   Assertions, evidence writers, board events, and tables are not the viewer.
// - Saves (saveWeather, saveClock, saveGround, saveDeltas, JSON.stringify of
//   the interaction context in main.ts) persist the clock, the near column,
//   the delta log, and remembered interactions. Their arguments are not an
//   animals list and not a raw-world value.
// - rust/boreal-sim/src/bin/form.rs and hot.rs write a figure JSON (n, mass,
//   j2) beside a bake .bin. They are scanned. They do not match this pattern.
//   They are not linked into the wasm the viewer loads.
// - formation.rs include_str! of data/earth/materials.json reads a materials
//   table. It does not emit animals.
// - In-memory animals: fields (SimWorld, SoundFrame, sfx.update) are the same
//   JavaScript heap, not a JSON payload.
//
// Limit: the scanner reads source text. It sees each JSON.stringify argument,
// one const/let initializer of a bare identifier, and a quoted "animals" key
// anywhere in the scanned file. A helper that returns positions under some
// other name, with no animals key and no JSON.stringify of world/entities,
// is not visible. The crossing modules below may not call JSON.stringify at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const rel = (p: string) => relative(ROOT, p).split(sep).join('/');
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Crossing modules. A JSON.stringify here is a new payload even without the animals key. */
const CROSSING_TS = ['src/core/planetBudget.ts', 'src/core/planetWeather.ts', 'src/core/perceptionBuffer.ts'];

/**
 * Paths the scanner hit that are still not a viewer payload.
 * Empty on this tree. Only shrinks.
 */
const ALLOWLIST: { path: string; why: string }[] = [];

const RAW = /^(?:animals|animalList|animalPositions|world|rawWorld|worldState|entityStore|entities)\b/;
const ANIMALS_PROP = /(?:["']animals["']|\banimals)\s*:/;
const SPECIES_PROP = /(?:["']species["']|\bspecies)\s*:/;
const POS_PROP = /(?:["'][xyz]["']|\b[xyz])\s*:/;
const DOT_POS = /\.\s*[xyz]\b/;

function stringifyArgs(code: string): string[] {
  const out: string[] = [];
  const needle = 'JSON.stringify';
  let i = 0;
  while (i < code.length) {
    const at = code.indexOf(needle, i);
    if (at < 0) break;
    let j = at + needle.length;
    while (j < code.length && /\s/.test(code[j])) j++;
    if (code[j] !== '(') { i = at + needle.length; continue; }
    j++;
    const start = j;
    let depth = 1;
    let quote: '"' | "'" | '`' | '' = '';
    while (j < code.length && depth > 0) {
      const c = code[j];
      if (quote) {
        if (c === '\\') { j += 2; continue; }
        if (c === quote) quote = '';
        j++;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; j++; continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) break; }
      j++;
    }
    out.push(code.slice(start, j));
    i = j + 1;
  }
  return out;
}

function expand(code: string, arg: string): string {
  const name = /^\s*([A-Za-z_$][\w$]*)\s*$/.exec(arg)?.[1];
  if (!name) return arg;
  const re = new RegExp(`(?:const|let|var)\\s+${name}\\s*=\\s*([^;]*);`, 'g');
  return [arg, ...[...code.matchAll(re)].map(m => m[1])].join('\n');
}

function classify(expr: string): string | null {
  const e = expr.trim();
  if (RAW.test(e)) return `serialized ${e.split(/[\s.(]/)[0]}`;
  // `{ animals }` is the shorthand that JSON.stringify turns into {"animals":[...]}.
  if (ANIMALS_PROP.test(e) || /\{\s*animals\s*[,}]/.test(e)) return 'animals list';
  if (/\{\s*(?:world|rawWorld|worldState|entityStore|entities)\s*[,}]/.test(e)) return 'serialized world';
  const species = SPECIES_PROP.test(e);
  const pos = POS_PROP.test(e) || DOT_POS.test(e);
  if (species && pos && /(?:["'](?:id|state)["']|\b(?:id|state))\s*:/.test(e)) return 'species position record';
  return null;
}

function wireKey(code: string): string | null {
  if (/(?:^|[^\\])"animals"\s*:/.test(code)) return 'JSON key "animals"';
  if (/'animals'\s*:/.test(code)) return "JSON key 'animals'";
  if (/\\"animals\\"\s*:/.test(code)) return 'escaped JSON key \\"animals\\"';
  return null;
}

function externReturns(code: string): { name: string; ret: string }[] {
  const out: { name: string; ret: string }[] = [];
  const re = /extern\s+"C"\s+fn\s+([A-Za-z0-9_]+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < code.length && depth > 0) {
      if (code[i] === '(') depth++;
      else if (code[i] === ')') depth--;
      i++;
    }
    const arrow = /^\s*->\s*([^{]+)/.exec(code.slice(i));
    out.push({ name: m[1], ret: (arrow ? arrow[1] : '()').trim() });
  }
  return out;
}

function returnAllowed(ret: string): boolean {
  if (ret === '()') return true;
  if (/^(?:[ui](?:8|16|32|64|128)|f32|f64|usize|isize)$/.test(ret)) return true;
  // *mut u8 / *const u8 is the perception block (bytes). *mut f64 is a plane.
  if (/^\*(?:mut|const)\s+(?:f32|f64|u8)$/.test(ret)) return true;
  return false;
}

/** Reasons this source would send animal positions or the raw world across as JSON. */
export function viewerJsonHits(code: string, kind: 'ts' | 'rs' | 'toml'): string[] {
  const src = kind === 'toml' ? code.replace(/(^|\s)#.*$/gm, '$1') : strip(code);
  const hits: string[] = [];
  const wire = wireKey(src);
  if (wire) hits.push(wire);
  if (kind === 'toml') {
    if (/^\s*(?:serde|serde_json|wasm-bindgen)\b/m.test(src)) hits.push('JSON or bindgen dependency');
    return hits;
  }
  if (kind === 'rs') {
    if (/\bserde_json\b|\bserde::Serialize\b|\bto_json\s*\(|\bjson!\s*\(/.test(src)) hits.push('serde JSON');
    if (/\bCString\b|\bc_char\b/.test(src)) hits.push('C string');
    if (/\bwasm_bindgen\b/.test(src)) hits.push('wasm_bindgen');
    for (const sig of externReturns(src)) if (!returnAllowed(sig.ret)) hits.push(`extern ${sig.name} returns ${sig.ret}`);
    return hits;
  }
  if (/JSON\.parse\s*\([\s\S]{0,400}?\)\s*\.animals\b/.test(src)) hits.push('parsed animals list');
  for (const arg of stringifyArgs(src)) {
    const why = classify(expand(src, arg));
    if (why) hits.push(why);
  }
  return hits;
}

function walk(dir: string, ext: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'target' || name === 'node_modules') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, ext, out);
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

function scanRepo(): { path: string; why: string }[] {
  const hits: { path: string; why: string }[] = [];
  const files = [
    ...walk(join(ROOT, 'src'), /\.ts$/),
    ...walk(join(ROOT, 'rust', 'boreal-sim'), /\.rs$/),
    join(ROOT, 'rust', 'boreal-sim', 'Cargo.toml'),
  ];
  for (const file of files) {
    const path = rel(file);
    const kind = path.endsWith('.rs') ? 'rs' : path.endsWith('.toml') ? 'toml' : 'ts';
    const code = readFileSync(file, 'utf8');
    for (const why of viewerJsonHits(code, kind)) hits.push({ path, why });
    if (CROSSING_TS.includes(path) && /JSON\.stringify\s*\(/.test(strip(code))) hits.push({ path, why: 'crossing module stringifies JSON' });
  }
  return hits;
}

const ISSUE_101 = `
const animals = [{ id: 455, species: "wolf", x: 152.4, y: 932.1, state: "hunting" }];
export const forViewer = () => JSON.stringify({ animals });
`;

test('T-0095: issue #101 JSON animal list is a hit, and legitimate JSON is not', () => {
  assert.ok(viewerJsonHits(ISSUE_101, 'ts').length > 0);
  assert.ok(viewerJsonHits('export const dump = (animals: unknown) => JSON.stringify(animals);', 'ts').includes('serialized animals'));
  assert.ok(viewerJsonHits('const world = { cells: [] }; JSON.stringify(world);', 'ts').includes('serialized world'));
  assert.ok(viewerJsonHits('const payload = { animals: rows.map(a => ({ species: a.species, x: a.x, y: a.y, state: a.state })) }; JSON.stringify(payload);', 'ts').some(h => /animals list/.test(h)));
  assert.ok(viewerJsonHits('const body = `{"animals":[{"id":1,"species":"wolf","x":1,"y":2}]}`;', 'ts').includes('JSON key "animals"'));
  assert.ok(viewerJsonHits('const list = JSON.parse(raw).animals;', 'ts').includes('parsed animals list'));
  assert.equal(viewerJsonHits('export const saveWeather = () => JSON.stringify({ w: { day: 1, hour: 2 }, g: {} });', 'ts').length, 0);
  assert.equal(viewerJsonHits('export const saveClock = () => JSON.stringify({ worldSec: 1, wallMs: 0, rate: 1, dial: 0 });', 'ts').length, 0);
  assert.equal(viewerJsonHits("localStorage.setItem(SAVE_KEY, JSON.stringify(context));", 'ts').length, 0);
  assert.equal(viewerJsonHits("export const saveDeltas = () => JSON.stringify(DELTAS.log);", 'ts').length, 0);
  assert.equal(viewerJsonHits("{ id: 'animals', label: 'Cambrian: animals with shells and eyes' }", 'ts').length, 0);
  assert.equal(viewerJsonHits('return { animals: [], food: [], events: [] };', 'ts').length, 0);
  assert.equal(viewerJsonHits('sfx.update({ x: player.x, z: player.z, animals: view.audibleAnimals() });', 'ts').length, 0);
  assert.equal(viewerJsonHits('hud.textContent = JSON.stringify(out);', 'ts').length, 0);
  assert.equal(viewerJsonHits('visible[0].x = 120;', 'ts').length, 0);
  const rustDump = 'fn dump(x: f32) -> String { format!("{{\\"animals\\":[{{\\"species\\":\\"wolf\\",\\"x\\":{x}}}]}}") }';
  assert.ok(viewerJsonHits(rustDump, 'rs').some(h => /animals/.test(h)));
  assert.ok(viewerJsonHits('serde_json::to_string(&animals).unwrap()', 'rs').includes('serde JSON'));
  assert.ok(viewerJsonHits('#[no_mangle] pub extern "C" fn world_json() -> *const c_char { std::ptr::null() }', 'rs').some(h => /c_char|returns/.test(h)));
  assert.equal(viewerJsonHits('#[no_mangle] pub extern "C" fn perception_ptr() -> *mut u8 { std::ptr::null_mut() }', 'rs').length, 0);
  assert.equal(viewerJsonHits('pub const MATERIALS_JSON: &str = include_str!("../../../data/earth/materials.json");', 'rs').length, 0);
  assert.equal(viewerJsonHits('[dependencies]\nhecs = "=0.10.5"\n', 'toml').length, 0);
  assert.ok(viewerJsonHits('[dependencies]\nserde_json = "1"\n', 'toml').includes('JSON or bindgen dependency'));
});

test('T-0095: no scanned module serializes animal positions or the raw world as JSON', () => {
  for (const path of CROSSING_TS) assert.equal(statSync(join(ROOT, path)).isFile(), true, path);
  const hits = scanRepo();
  const allowed = new Set(ALLOWLIST.map(a => a.path));
  const fresh = hits.filter(h => !allowed.has(h.path));
  const stale = ALLOWLIST.filter(a => !hits.some(h => h.path === a.path)).map(a => a.path);
  assert.deepEqual(fresh, [], 'new viewer JSON. Document a real save or evidence file in ALLOWLIST, or do not send it.');
  assert.deepEqual(stale, [], 'allowlist path no longer hits; remove it (the list only shrinks).');
});
