// T-0041 measure (grok-globe): node refs/T-0041/measure.mjs <out> clouds|land label=url ... (holds the bench lock).
// clouds: jumpTo through 1200 -> 150 km (36 geometric steps), cream-pixel fraction and mean luminance (0-255) of the central crop per still.
// land: the bare-load descent landing (still, spot, line of sight). seeds: spawn at each raw / chosen landing spot of seeds.json
// (node: landSpawn without / with the heading), still + raycast from the game camera to the wolf. sweep: label s300 = jump to 300 km,
// hold the cloud fade at 0 and step the coverage threshold (deck density calibration). Holds the bench lock.
import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquire, track, release } from 'file:///C:/dev/boreal-grok-descent-polish/tools/bench-lock.mjs';
const outDir = process.argv[2], what = process.argv[3], bases = process.argv.slice(4).map(a => a.split('=')), name = 'grok-globe: T-0041 measure ' + process.argv[3], port = 9800 + Math.floor(Math.random() * 90);
if (!await acquire(name)) { console.log('lock busy'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', profile = mkdtempSync(join(tmpdir(), 't0041-edge-'));
const proc = spawn(edge, ['--disable-gpu-vsync', '--disable-frame-rate-limit', '--headless=new', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-gpu-sandbox', '--hide-scrollbars', '--window-size=1280,800',
  '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
track(proc.pid); const errors = [];
try {
  let t; for (let k = 0; k < 60 && !t; k++) { await sleep(500); try { t = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch {} }
  const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map();
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300)); };
  const cdp = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async e => { const r = await cdp('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Page.bringToFront'); await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  const state = () => ev(`JSON.stringify({ search: location.search, mode: window.__inpage?.mode ?? 'no inpage', alt: Math.round(window.__inpage?.globe?.altitude ?? -1), menu: !!document.getElementById('start-menu') && !document.getElementById('start-menu').hidden && !document.getElementById('start-menu').classList.contains('fade'), hud: document.body.classList.contains('on-globe'), shown: ['header', '#status', '#interaction', 'footer>span', '#act', '#home', '#menu-btn'].filter(s => { const e = document.querySelector(s); return e && e.getClientRects().length > 0; }) })`);
  const shot = async f => { const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 85 }); writeFileSync(join(outDir, f), Buffer.from(r.result.data, 'base64')); console.log('saved ' + f + ' ' + await state()); };
  const load = async url => { const t0 = Date.now(); await cdp('Page.navigate', { url }); await sleep(3000);
    while (!(await ev(`document.readyState === 'complete' && !document.getElementById('loading')`))) { if (Date.now() - t0 > 240000) throw new Error('loading screen up after 240 s: ' + url); await sleep(1000); }
    console.log(`loaded ${url} in ${((Date.now() - t0) / 1000).toFixed(0)} s`); };
  const key = async k => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: k, code: k, windowsVirtualKeyCode: k === 'Escape' ? 27 : 0 }); };
  const results = {};
  const until = async (want, max = 120) => { for (let k = 0; k < max * 4; k++) { await sleep(250); const s = JSON.parse(await state()); if (s.mode === want) return (k / 4).toFixed(1); } throw new Error('no ' + want); };
  const cream = async b64 => ev(`new Promise(res => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const x0 = Math.round(im.width * .2), y0 = Math.round(im.height * .15), w = Math.round(im.width * .6), h = Math.round(im.height * .6), d = g.getImageData(x0, y0, w, h).data; let n = 0, l = 0;
    for (let i = 0; i < d.length; i += 4) { const r = d[i], gg = d[i + 1], b = d[i + 2]; l += .2126 * r + .7152 * gg + .0722 * b; if (Math.min(r, gg, b) > 165 && Math.max(r, gg, b) - Math.min(r, gg, b) < 45) n++; } res([n / (w * h), l / (w * h)]); }; im.src = 'data:image/jpeg;base64,${b64}'; })`);
  const snap = async () => (await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 80 })).result.data;
  // line of sight from the game's own camera to the wolf (player spot, 0.5 m up) against every visible scene mesh; a hit more
  // than 0.6 m before the wolf counts as blocked. Needs the dev hook __inpage.view/player (T-0041 branch).
  const los = async () => JSON.parse(await ev(`(async () => { const u = performance.getEntriesByType('resource').map(e => e.name).find(n => /\\/deps\\/three\\.js/.test(n)); const T = await import(u);
    const ip = window.__inpage, cam = ip.view.camera, sc = ip.view.scene, pl = ip.player(), wolf = new T.Vector3(pl.x, ip.groundAt(pl.x, pl.z) + .5, pl.z);
    const from = cam.getWorldPosition(new T.Vector3()), dir = wolf.clone().sub(from), L = dir.length(); dir.normalize(); const rc = new T.Raycaster(from, dir, 0, L - .6);
    const seen = new Set(); const hits = rc.intersectObjects(sc.children, true).filter(hh => { let o = hh.object; for (; o; o = o.parent) if (o.visible === false) return false; return true; });
    return JSON.stringify({ camDist: +L.toFixed(2), blocked: hits.length > 0, hits: hits.filter(hh => !seen.has(hh.object.uuid) && seen.add(hh.object.uuid)).slice(0, 5).map(hh => ({ d: +hh.distance.toFixed(2), type: hh.object.type, name: hh.object.name, mat: (Array.isArray(hh.object.material) ? hh.object.material[0] : hh.object.material)?.name ?? '' })) }); })()`));  for (const [label, base] of bases) {
    if (what === 'sweep') { // the deck's density at one altitude: hold clear at 0 and raise the coverage threshold (uCloudEdge.x) step by step
      const alt = +label.slice(1) * 1000; /* label s300 = 300 km */ await load(`${base}/`); await sleep(6000); await ev(`window.__inpage.globe.jumpTo(${alt})`); await sleep(1500);
      await ev(`(() => { const d = window.__inpage.globe.scene.children.find(o => o.material?.uniforms?.uCloudClear); window.__dome = d.material.uniforms;
        Object.defineProperty(d.material.uniforms.uCloudClear, 'value', { get: () => window.__clear ?? 0, set: () => {} }); return true; })()`);
      const rows = []; for (const e of [null, .60, .613, .62, .63, .64, .65, .66, .67, .68, .69, .70, .71, .72, .74, .78, .9]) {
        if (e === null) await ev('window.__clear = 1'); else await ev(`window.__clear = 0; window.__dome.uCloudEdge.value.x = ${e}`); await sleep(700);
        const b = await snap(), [fr, lum] = await cream(b); rows.push({ edge: e, lum: +lum.toFixed(2) }); writeFileSync(join(outDir, `${label}-sweep-${e ?? 'clear'}.jpg`), Buffer.from(b, 'base64')); }
      results[label] = rows; console.log(label + ' sweep ' + JSON.stringify(rows));
    } else if (what === 'clouds') {
      await load(`${base}/`); await sleep(6000); const rows = [];
      for (let k = 0; k < 36; k++) { const a = 1.2e6 * Math.pow(1.5e5 / 1.2e6, k / 35); await ev(`window.__inpage.globe.jumpTo(${a})`); await sleep(700);
        const b = await snap(), [f, lum] = await cream(b), alt = JSON.parse(await state()).alt; rows.push({ target: Math.round(a), alt, cream: +f.toFixed(4), lum: +lum.toFixed(2) });
        writeFileSync(join(outDir, `${label}-cloud-${String(Math.round(a / 1000)).padStart(4, '0')}km.jpg`), Buffer.from(b, 'base64')); }
      results[label] = rows; console.log(label + ' clouds ' + JSON.stringify(rows.map(r => [Math.round(r.alt / 1000), r.cream, r.lum])));
    } else if (what === 'land') { // the bare-load descent (the reviewed landing): still 5 s after landing, land spot, LOS from the real camera
      await load(`${base}/`); await sleep(6000); await ev(`window.__inpage.globe.zoomTo(1000)`); const t = await until('game'); await sleep(5000);
      const b = await snap(); writeFileSync(join(outDir, `${label}-descent-land.jpg`), Buffer.from(b, 'base64'));
      results[label] = { landedAfter: +t, land: await ev(`window.__inpage.land`), los: await ev(`window.__inpage.view ? true : null`) ? await los() : 'no dev hook on this branch' };
      console.log(label + ' land ' + JSON.stringify(results[label]));
    } else { // seeds: spawn at each spot (?at=x,z,yaw: exact spot and heading) -> still + LOS from the real camera
      const seeds = JSON.parse(readFileSync(join(outDir, 'seeds.json'), 'utf8')); const rows = [];
      for (const sd of seeds) for (const k of ['raw', 'chosen']) { const p = sd[k];
        await load(`${base}/?at=${p.x},${p.z},${sd.yaw}&stages=1&trees=v2&nomenu&hour=11`); await sleep(7000);
        const b = await snap(); writeFileSync(join(outDir, `${label}-seed${sd.i}-${k}.jpg`), Buffer.from(b, 'base64'));
        const r = { i: sd.i, k, spot: p, yaw: sd.yaw, ...(await los()) }; rows.push(r); console.log(label + ' seed ' + JSON.stringify(r)); }
      results[label] = rows;
    }
  }
  writeFileSync(join(outDir, `${what}-${bases.map(b => b[0]).join('-')}.json`), JSON.stringify(results, null, 1));
  ws.close();
} catch (e) { errors.push('capture: ' + (e.stack ?? e)); }
finally { try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { proc.kill(); } await sleep(1000); try { rmSync(profile, { recursive: true, force: true }); } catch {} release(name); }
for (const e of errors) console.log('ERR ' + e); console.log('done');