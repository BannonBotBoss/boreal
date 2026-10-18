// Bench lock for omen (Grok Bot): one bench or headless capture on the shared GPU at a time.
// The lock is %TEMP%\boreal-bench.lock, created atomically (O_EXCL) holding '<name> <start ISO>'; a lock older than 45 min is
// stale and taken over. Wait while it exists.
//   node tools/bench-lock.mjs acquire "<agent: task>" [waitMin=60]   exit 0 = held (by <name>), 1 = timed out
//   node tools/bench-lock.mjs release "<agent: task>"                 removes it only if <name> holds it
//   node tools/bench-lock.mjs status
//   import { acquire, release } from './bench-lock.mjs'   await acquire(name, { waitMs }); ... release(name)
import { openSync, writeSync, closeSync, readFileSync, unlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const LOCK = join(process.env.TEMP ?? tmpdir(), 'boreal-bench.lock'), STALE_MS = 45 * 60 * 1000;
// Content: one line '<name> <start ISO time>' (plain text, what other agents write by hand too); JSON {name, start} is read as well.
const read = () => { let t; try { t = readFileSync(LOCK, 'utf8').trim(); } catch { return undefined; }
  try { const j = JSON.parse(t); if (j?.start) return j; } catch {}
  const m = /^(.*?)\s+(\d{4}-\d\d-\d\dT[\d:.]+Z?)\b/.exec(t); if (m) return { name: m[1], start: m[2] };
  try { return { name: t || '?', start: statSync(LOCK).mtime.toISOString() }; } catch { return undefined; } };
const age = l => Date.now() - Date.parse(l?.start ?? 0);
export function tryAcquire(name) {
  try { const fd = openSync(LOCK, 'wx'); writeSync(fd, `${name} ${new Date().toISOString()}\n`); closeSync(fd); return true; }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  const l = read(); if (l && age(l) > STALE_MS) { try { unlinkSync(LOCK); } catch {} console.log(`bench-lock: removed stale lock of ${l.name} (${Math.round(age(l) / 60000)} min)`); return tryAcquire(name); }
  return false;
}
export async function acquire(name, { waitMs = 60 * 60 * 1000, pollMs = 5000 } = {}) {
  const t0 = Date.now(); let said = '';
  while (!tryAcquire(name)) {
    const l = read(), s = `${l?.name} since ${l?.start}`; if (s !== said) { console.log(`bench-lock: waiting for ${s}`); said = s; }
    if (Date.now() - t0 > waitMs) return false; await new Promise(r => setTimeout(r, pollMs));
  }
  return true;
}
export function release(name) { const l = read(); if (l && l.name === name) { try { unlinkSync(LOCK); } catch {} return true; } return false; }
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase()) {
  const [cmd, name = 'unnamed', min] = process.argv.slice(2);
  if (cmd === 'acquire') { const ok = await acquire(name, { waitMs: Number(min ?? 60) * 60000 }); console.log(ok ? `bench-lock: held by ${name}` : 'bench-lock: timed out'); process.exit(ok ? 0 : 1); }
  else if (cmd === 'release') { console.log(release(name) ? 'bench-lock: released' : `bench-lock: not held by ${name} (${JSON.stringify(read())})`); }
  else console.log(JSON.stringify(read() ?? null));
}
