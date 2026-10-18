// Bench lock for omen (Grok Bot): one bench or headless capture on the shared GPU at a time.
// %TEMP%\boreal-bench.lock, created atomically (O_EXCL). Line 1: '<name> <start ISO>' (what agents write by hand too);
// line 2 (helper only): JSON {"pid": holder node pid, "edge": [headless Edge pids it launched]}.
// - Max hold 10 min: the helper releases its own lock after 10 min (killing its Edge) and warns; split longer benches into holds.
// - A lock older than 10 min whose holder pid is dead is taken over; any lock older than 45 min is stale and taken over.
//   Taking over kills the Edge processes the dead holder listed.
// - release() kills every headless Edge the holder registered with track(pid), then deletes the lock. Ctrl+C / normal exit
//   of the holder process releases too.
//   node tools/bench-lock.mjs acquire "<agent: task>" [waitMin=60]   exit 0 = held, 1 = timed out (CLI: no pid, 45 min rule)
//   node tools/bench-lock.mjs release "<agent: task>"                 only the holder's name releases
//   node tools/bench-lock.mjs status
//   import { acquire, track, release } from './bench-lock.mjs'
//     if (await acquire(name)) try { const p = spawn(edge, ...); track(p.pid); ... } finally { release(name); }
import { openSync, writeSync, closeSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const LOCK = join(process.env.TEMP ?? tmpdir(), 'boreal-bench.lock'), STALE_MS = 45 * 60 * 1000, MAX_HOLD_MS = 10 * 60 * 1000;
const read = () => { let t; try { t = readFileSync(LOCK, 'utf8').trim(); } catch { return undefined; }
  try { const j = JSON.parse(t); if (j?.start) return { edge: [], ...j }; } catch {}
  const [first, second] = t.split(/\r?\n/); let extra = {}; try { extra = JSON.parse(second ?? '{}') ?? {}; } catch {}
  const m = /^(.*?)\s+(\d{4}-\d\d-\d\dT[\d:.]+Z?)\b/.exec(first); const base = m ? { name: m[1], start: m[2] } : (() => { try { return { name: first || '?', start: statSync(LOCK).mtime.toISOString() }; } catch { return undefined; } })();
  return base && { pid: extra.pid, edge: Array.isArray(extra.edge) ? extra.edge : [], ...base }; };
const age = l => Date.now() - Date.parse(l?.start ?? 0);
const alive = pid => { if (!pid) return undefined; try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const write = l => writeFileSync(LOCK, `${l.name} ${l.start}\n${JSON.stringify({ pid: l.pid, edge: l.edge })}\n`);
/** taskkill an Edge tree the holder launched (only if that pid is still an msedge.exe). */
function killEdge(pids) {
  for (const pid of pids ?? []) { try {
    if (process.platform === 'win32') { if (!/msedge\.exe/i.test(execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { encoding: 'utf8' }))) continue;
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' }); }
    else process.kill(pid, 'SIGKILL');
    console.log(`bench-lock: killed headless Edge ${pid}`); } catch {} }
}
let mine = null, timer = null, hooked = false;
export function tryAcquire(name, pid = process.pid) {
  const start = new Date().toISOString();
  try { const fd = openSync(LOCK, 'wx'); writeSync(fd, `${name} ${start}\n${JSON.stringify({ pid, edge: [] })}\n`); closeSync(fd); return true; }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
  const l = read(), a = age(l), dead = l && a > MAX_HOLD_MS && alive(l.pid) === false;
  if (l && (a > STALE_MS || dead)) { killEdge(l.edge); try { unlinkSync(LOCK); } catch {}
    console.log(`bench-lock: took over ${dead ? 'the dead holder' : 'stale lock'} ${l.name} (${Math.round(a / 60000)} min)`); return tryAcquire(name, pid); }
  return false;
}
/** Wait for the lock (poll), then hold it for this process: auto-release after MAX_HOLD_MS, release on exit/Ctrl+C. */
export async function acquire(name, { waitMs = 60 * 60 * 1000, pollMs = 5000, pid = process.pid } = {}) {
  const t0 = Date.now(); let said = '';
  while (!tryAcquire(name, pid)) {
    const l = read(), s = `${l?.name} since ${l?.start}`; if (s !== said) { console.log(`bench-lock: waiting for ${s}`); said = s; }
    if (Date.now() - t0 > waitMs) return false; await new Promise(r => setTimeout(r, pollMs));
  }
  if (pid === process.pid) { mine = name;
    timer = setTimeout(() => { console.log(`bench-lock: ${name} held ${MAX_HOLD_MS / 60000} min (max hold): released`); release(name); }, MAX_HOLD_MS); timer.unref();
    if (!hooked) { hooked = true; process.on('exit', () => mine && release(mine)); for (const s of ['SIGINT', 'SIGTERM', 'SIGBREAK']) process.on(s, () => { if (mine) release(mine); process.exit(130); }); } }
  return true;
}
/** Register a headless Edge (browser pid) this holder launched: release() and a takeover kill it. */
export function track(edgePid) { const l = read(); if (!l || l.name !== mine) return false; l.edge = [...new Set([...l.edge, edgePid])]; write(l); return true; }
export function release(name) {
  const l = read(); if (!l || l.name !== name) return false;
  killEdge(l.edge); try { unlinkSync(LOCK); } catch {} if (mine === name) { mine = null; clearTimeout(timer); } return true;
}
export const status = read;
if (process.argv[1] && resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase()) {
  const [cmd, name = 'unnamed', min] = process.argv.slice(2);
  if (cmd === 'acquire') { const ok = await acquire(name, { waitMs: Number(min ?? 60) * 60000, pid: 0 }); console.log(ok ? `bench-lock: held by ${name}` : 'bench-lock: timed out'); process.exit(ok ? 0 : 1); }
  else if (cmd === 'release') { console.log(release(name) ? 'bench-lock: released' : `bench-lock: not held by ${name} (${JSON.stringify(read())})`); }
  else console.log(JSON.stringify(read() ?? null));
}
