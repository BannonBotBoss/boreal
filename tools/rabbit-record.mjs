// Rabbit + clover recording (Grok Bot, T-0009 animation gate): headless Edge, 1280x800, ~5 fps JPEG frames + per-frame state. node tools/rabbit-record.mjs <base> <outDir>
// Phase 1 finds a sunlit clover cluster near the start; phase 2 (plain) and 3 (?hare=debug) start the wolf 7 m from it,
// put one hare on the cluster's best patch (dev handle) and let the shared pipeline run before each screenshot.
import { spawn, execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const [base, outDir, mode] = process.argv.slice(2); const dbg = mode === 'plain' ? '' : '&hare=debug'; // 'plain': no debug labels mkdirSync(outDir, { recursive: true });
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
async function session(fn) {
  const port = 9300 + Math.floor(Math.random() * 90), profile = mkdtempSync(join(tmpdir(), 'grok-rabbit-'));
  const p = spawn(edge, ['--headless=new', '--disable-extensions', '--window-size=1280,800', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let id = 0; const pending = new Map(), errors = [];
  try {
    let t; for (let i = 0; i < 60; i++) { try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (t.find(x => x.type === 'page')) break; } catch {} await sleep(500); }
    const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d.result ?? d); pending.delete(d.id); }
      if (d.method === 'Runtime.exceptionThrown') errors.push((d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300)); };
    const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); }); globalThis.__cdp = cdp;
    const ev = async e => (await cdp('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value;
    const shot = async name => { const s = await cdp('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(outDir, name), Buffer.from(s.data, 'base64')); };
    await cdp('Runtime.enable'); await cdp('Page.enable'); await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
    const go = async q => { await cdp('Page.navigate', { url: `${base}/?nomenu${q}` });
      for (let i = 0; i < 180; i++) { await sleep(1000); if (await ev(`document.readyState === 'complete' && !document.getElementById('loading') && !!globalThis.borealHares`)) break; } await sleep(6000); };
    const r = await fn({ go, ev, shot }); ws.close(); return { ...r, errors: errors.slice(0, 5) };
  } finally { try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' }); } catch {} await sleep(1500); try { rmSync(profile, { recursive: true, force: true }); } catch {} }
}
const pickJs = `(() => { const ps = [...borealHares.clover.list()]; let best, bs = -1; for (const p of ps) { let s = 0; for (const q of ps) if (Math.hypot(p.x - q.x, p.z - q.z) < 6) s += q.r * q.r; if (s > bs) { bs = s; best = p; } }
  return { n: ps.length, best: best && { key: best.key, x: best.x, z: best.z, r: best.r, light: best.light }, near: best ? ps.filter(q => Math.hypot(best.x - q.x, best.z - q.z) < 6).length : 0 }; })()`;
const stageJs = p => `(() => { const h = borealHares.list()[0]; if (!h) return 'no hare'; h.agent.x = ${p.x} + .2; h.agent.z = ${p.z} + .2; h.agent.heading = 1.2; h.agent.action = 'rest'; h.agent.timer = 0; return h.agent.key; })()`;
const stateJs = `borealHares.list().map(h => ({ key: h.agent.key, action: h.agent.action, goal: h.agent.goal, x: +h.agent.x.toFixed(2), z: +h.agent.z.toFixed(2), E: +h.agent.energy.toFixed(2), S: +h.agent.stamina.toFixed(1), R: +h.agent.relaxation.toFixed(1), threat: +h.agent.sensed.level.toFixed(3), food: h.agent.food && borealHares.clover.get(h.agent.food)?.units }))`;
const res = {};
// phase 1: a forest clearing near the start (core/clover clearingAt, dry land, closed forest around it)
res.find = await session(async ({ go, ev }) => { await go('&hour=12&trees=v2'); return ev(`(async () => {
  const u = performance.getEntriesByType('resource').map(e => e.name), f = n => u.filter(x => x.includes(n)).pop();
  const C = await import(f('/src/core/clover.ts')), W = await import(f('/src/core/world.ts')), T = await import(f('/src/core/tuning.ts'));
  const w = borealHares.wolf(), out = [];
  for (let r = 20; r < 220; r += 6) for (let k = 0; k < Math.max(8, r / 3); k++) { const a = k / Math.max(8, r / 3) * Math.PI * 2, x = w.x + Math.sin(a) * r, z = w.z + Math.cos(a) * r;
    if (C.clearingAt(x, z) < .9 || W.heightAt(x, z) < T.LEVEL.shore + 1.5) continue;
    let forest = 0, dry = 0; for (let j = 0; j < 12; j++) { const b = j / 12 * Math.PI * 2, fx = x + Math.sin(b) * 26, fz = z + Math.cos(b) * 26; if (C.clearingAt(fx, fz) < .2) forest++; if (W.heightAt(fx, fz) > T.LEVEL.shore + .5) dry++; }
    if (forest >= 4 && dry >= 11) out.push({ x: +x.toFixed(1), z: +z.toFixed(1), r, forest }); if (out.length > 5) break; }
  return { wolf: { x: w.x, z: w.z }, spots: out };
})()`); });
console.log(JSON.stringify(res.find));
const spot = res.find.spots?.[0]; if (!spot) { console.log('no clearing found'); process.exit(1); }
res.patch = await session(async ({ go, ev }) => { await go(`&hour=12&trees=v2&at=${spot.x},${spot.z},0`); await sleep(8000); return ev(pickJs); });
console.log(JSON.stringify(res.patch));
const p = res.patch.best; if (!p) { console.log('no clover found'); process.exit(1); }
const at = `${(p.x - 2.5).toFixed(1)},${(p.z + 7.6).toFixed(1)},0`;
mkdirSync(join(outDir, 'frames'), { recursive: true });
res.record = await session(async ({ go, ev }) => {
  await go(`&hour=12&trees=v2&at=${at}${dbg}`); await sleep(6000);
  const pick = await ev(pickJs); const target = pick.best && Math.hypot(pick.best.x - p.x, pick.best.z - p.z) < 8 ? pick.best : p;
  // STAGED (stated in the handoff): the patch is set to 45 % so a part-grazed patch is on screen; at the real cropping rate
  // (20.5 mg DM/s) one hare takes ~6 h of cropping to graze a 1 m patch out, far beyond a 10 s clip.
  await ev(`(() => { const q = borealHares.clover.get(${JSON.stringify(target.key)}); return borealHares.clover.stage(q.key, q.max * .45).units; })()`);
  const staged = await ev(stageJs(target)); const frames = []; const t0 = Date.now();
  const cdpKey = async (type) => ev(`(() => { window.dispatchEvent(new KeyboardEvent('${type}', { key: 'w', code: 'KeyW', bubbles: true })); return 1; })()`);
  let k = 0, pressed = false, released = false;
  while (Date.now() - t0 < 11000) {
    const t = (Date.now() - t0) / 1000;
    if (!pressed && t > 5) { await cdpKey('keydown'); pressed = true; }
    if (pressed && !released && t > 7.5) { await cdpKey('keyup'); released = true; }
    const s = await (globalThis.__cdp)('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
    const name = `f${String(k++).padStart(3, '0')}.jpg`; writeFileSync(join(outDir, 'frames', name), Buffer.from(s.data, 'base64'));
    const st = (await ev(stateJs))[0], q = await ev(`(() => { const q = borealHares.clover.get(${JSON.stringify(target.key)}); return q && +(q.units / q.max).toFixed(4); })()`), w = await ev('(() => { const w = borealHares.wolf(); return w && { x: +w.x.toFixed(2), z: +w.z.toFixed(2) }; })()');
    frames.push({ name, t: +t.toFixed(2), hare: st, patchFraction: q, wolf: w, w: pressed && !released });
  }
  // clover time-lapse (STAGED): the hare is moved off and the same patch is set to 100 -> 0 % leaf, one still each
  await ev(`(() => { const h = borealHares.list()[0]; if (h) { h.agent.x += 30; } return 1; })()`); const lapse = [];
  for (const f of [1, .8, .6, .4, .2, 0]) { await ev(`(() => { const q = borealHares.clover.get(${JSON.stringify(target.key)}); return borealHares.clover.stage(q.key, q.max * ${f}).units; })()`);
    await sleep(1500); const s = await (globalThis.__cdp)('Page.captureScreenshot', { format: 'jpeg', quality: 80 }); const name = `lapse-${Math.round(f * 100)}.jpg`; writeFileSync(join(outDir, name), Buffer.from(s.data, 'base64')); lapse.push(name); }
  return { at, target, staged, frames, lapse };
});
writeFileSync(join(outDir, 'rabbit-record.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res.record.frames.map(f => [f.t, f.hare?.action, f.hare?.goal, f.patchFraction, f.wolf?.x, f.wolf?.z])));