// Headless WebGL frames of a scripted fall on the in-page path (gate 2 of #192): load the game with ?transition=inpage,
// Continue from the menu, Shift+G up to the planet (ascend), then G (drop on the centre), then grab a frame + HUD text every STEP ms. SwiftShader = software GL.
// Oct 30 23:xx: waits for the Continue button (LOAD, default 240 s); under SwiftShader the menu appears ~133 s in.
// Oct 31 01:xx: the old blank planet + paused menu was the reload path: SwiftShader probes to Minimum, so ascend() fell back to
// location.search. &inpagelow (dev) keeps the in-page path; now Shift+G reaches the in-page globe and G drops into the drone glide.
// EMBODY=<n> presses G after the glide and grabs n landed frames.
// OUT= sets the screenshot directory (default /tmp/shots-fall). The landed step also logs window.borealLanding.
// BASE=http://127.0.0.1:5173 PW=<playwright-core path> node tools/fall-shot.mjs   (writes /tmp/shots-fall)
import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT ?? '/tmp/shots-fall';
mkdirSync(OUT, { recursive: true });
const pw = await import(process.env.PW ?? 'playwright-core'), chromium = pw.chromium ?? pw.default.chromium;
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173', STEP = +(process.env.STEP ?? 4000), N = +(process.env.N ?? 20);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
const noteErr = (text) => { const line = String(text).slice(0, 300); if (!errs.includes(line)) errs.push(line); };
p.on('pageerror', e => noteErr(e.message));
p.on('response', r => { if (r.status() >= 400) noteErr(`${r.status()} ${r.url().slice(0, 220)}`); });
p.on('console', m => {
  const text = m.text();
  if (m.type() === 'error' || /404|Failed to load|TypeError|WebGL/i.test(text)) noteErr(text);
  if (/^PROBE cap|INPAGE/.test(text)) console.log(text.slice(0, 160));
});
await p.goto(`${BASE}/?transition=inpage&inpagelow${process.env.Q ?? ''}`);
const tl = Date.now(); const cont = p.getByText('Continue', { exact: true }).first();
await cont.waitFor({ state: 'visible', timeout: +(process.env.LOAD ?? 240000) }).catch(() => {}); console.log(JSON.stringify({ loaded_s: (Date.now() - tl) / 1000, menu: await cont.isVisible() }));
await p.screenshot({ path: `${OUT}/game-start.png` }); await p.mouse.move(640, 360);
await cont.click().catch(() => {}); await p.waitForTimeout(+(process.env.PLAY ?? 30000));
await p.screenshot({ path: `${OUT}/game-play.png` }); await p.keyboard.press('Shift+KeyG');
const hud = () => p.evaluate(() => { const c = (window).__inpage, S = c?.STATS; return { txt: document.body.innerText.split('\n').filter(l => /(alt|altitude|fall|ft\b|km\b| m\b)/i.test(l)).join(' | ').slice(0, 160), mode: c?.mode, phase: c?.flightPhase, h: c ? Math.round(c.height) : null, sim: c ? +c.simT.toFixed(1) : null, fade: c ? +c.fade.toFixed(2) : null, ready: S?.ready, readyAt: S?.readyAt }; });
// Nov 1: a fixed 25 s climb was still in the band on this machine (SwiftShader frames cap the ascent dt).
// G during the climb is not a drop. Wait until the globe has input, then drop, then wait until the glide is low.
async function waitHud(label, pred, ms) {
  const t = Date.now(); let last = null, logged = -10;
  while (Date.now() - t < ms) {
    last = await hud();
    const s = +((Date.now() - t) / 1000).toFixed(1);
    if (pred(last) || s - logged >= 8) { console.log(JSON.stringify({ wait: label, s, hud: last })); logged = s; }
    if (pred(last)) return last;
    await p.waitForTimeout(1000);
  }
  console.log(JSON.stringify({ wait: label, timeout: true, hud: last }));
  return last;
}
const orbit = await waitHud('orbit', h => h.mode === 'globe', Math.max(+(process.env.UP ?? 25000), 90000));
console.log(JSON.stringify({ t: 0, hud: orbit })); await p.screenshot({ path: `${OUT}/fall-00.png` });
await p.keyboard.press(process.env.KEY ?? 'g'); const t0 = Date.now();
const glideAt = +(process.env.GLIDE ?? 650);
await waitHud('glide', h => h.mode === 'band' && h.h != null && h.h < glideAt, +(process.env.FALL ?? 150000));
for (let i = 1; i <= N; i++) {
  await p.waitForTimeout(STEP);
  const f = `${OUT}/fall-${String(i).padStart(2, '0')}.png`; await p.screenshot({ path: f });
  console.log(JSON.stringify({ i, s: +((Date.now() - t0) / 1000).toFixed(1), hud: await hud() }));
}
if (process.env.DIVE) { await p.keyboard.down('KeyQ'); for (let i = 1; i <= +(process.env.DIVE); i++) { await p.waitForTimeout(STEP); await p.screenshot({ path: `${OUT}/dive-${String(i).padStart(2, '0')}.png` }); console.log(JSON.stringify({ dive: i, hud: await hud() })); } await p.keyboard.up('KeyQ'); }
const landing = () => p.evaluate(() => {
  const read = globalThis.borealLanding;
  const cast = typeof read === 'function' ? read() : null;
  const pic = globalThis.borealPicture;
  const picture = typeof pic === 'function' ? pic() : null;
  const canvas = document.querySelector('canvas');
  let renderer = '';
  try {
    const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'));
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    }
  } catch { renderer = ''; }
  const mem = performance.memory;
  const time = document.querySelector('.time-hud b')?.textContent ?? '';
  const date = document.querySelector('.time-hud small')?.textContent ?? '';
  return new Promise(resolve => {
    const t = performance.now();
    requestAnimationFrame(() => resolve({
      cast, picture, renderer, time, date,
      heap: mem ? { used: mem.usedJSHeapSize, total: mem.totalJSHeapSize } : null,
      rafMs: +(performance.now() - t).toFixed(1),
    }));
  });
});
if (process.env.EMBODY) { // Oct 31 14:xx: G again in drone phase hands over to the game (embody), so these are true landed frames, not the glide
  await p.keyboard.press('g');
  await waitHud('game', h => h.mode === 'game', +(process.env.EMBODY_WAIT ?? 45000));
  for (let i = 1; i <= +(process.env.EMBODY); i++) { await p.waitForTimeout(STEP); await p.screenshot({ path: `${OUT}/landed-${String(i).padStart(2, '0')}.png` }); console.log(JSON.stringify({ landed: i, hud: await hud(), errs: errs.slice(0, 12), ...(await landing()) })); } }
console.log(JSON.stringify({ errs: errs.slice(0, 12) }));
await b.close();
