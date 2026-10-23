// Headless Chrome for the 2026-10-23 06:20 PT loop. Sound starts and animal frames.
// Vite on 127.0.0.1:5173. ?bench skips the GPU probe. ?rec exposes __boreal.
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const base = process.env.PREVIEW ?? 'http://127.0.0.1:5173/';
const errors = [];

const hook = `
(() => {
  const events = [];
  const bufId = new WeakMap();
  const abUrl = new WeakMap();
  window.__soundLog = events;
  const origAB = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = async function () {
    const buf = await origAB.call(this);
    try { if (this.url && this.url.includes('/sounds/')) abUrl.set(buf, this.url.split('/').pop().replace('.mp3', '')); } catch {}
    return buf;
  };
  const origDec = AudioContext.prototype.decodeAudioData;
  AudioContext.prototype.decodeAudioData = function (data) {
    const id = abUrl.get(data);
    const p = origDec.apply(this, arguments);
    return Promise.resolve(p).then(audio => { if (id && audio) bufId.set(audio, id); return audio; });
  };
  const origCreate = AudioContext.prototype.createBufferSource;
  AudioContext.prototype.createBufferSource = function () {
    const src = origCreate.call(this);
    let buf = null;
    try {
      Object.defineProperty(src, 'buffer', {
        configurable: true,
        get() { return buf; },
        set(v) { buf = v; src.__id = (v && bufId.get(v)) || src.__id || null; },
      });
    } catch {}
    return src;
  };
  const levelOf = new WeakMap();
  const isLevel = new WeakSet();
  const origConnect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest) {
    try {
      if (this instanceof AudioBufferSourceNode && dest instanceof GainNode && this.__id) levelOf.set(dest, this.__id);
      if (this instanceof GainNode && dest instanceof GainNode && levelOf.has(this) && !isLevel.has(this) && !levelOf.has(dest)) {
        levelOf.set(dest, levelOf.get(this)); isLevel.add(dest);
      }
    } catch {}
    return origConnect.apply(this, arguments);
  };
  const origTarget = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (value, time, tc) {
    try {
      const node = this._node || this;
      // AudioParam default value writes; the loop gain is the parent GainNode.
    } catch {}
    const ret = origTarget.apply(this, arguments);
    try {
      const gain = this.cancelAndHoldAtTime ? null : null;
      void gain;
      const owner = this.__owner;
      if (owner && isLevel.has(owner)) events.push({ t: performance.now(), kind: 'level', id: levelOf.get(owner), value: Math.round(value * 1000) / 1000 });
    } catch {}
    return ret;
  };
  const origCreateGain = AudioContext.prototype.createGain;
  AudioContext.prototype.createGain = function () {
    const g = origCreateGain.call(this);
    try { g.gain.__owner = g; } catch {}
    return g;
  };
  const origStart = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    events.push({ t: Math.round(performance.now()), kind: 'start', id: this.__id || null, loop: !!this.loop, offset: offset ?? null, duration: duration ?? null });
    return origStart.apply(this, arguments);
  };
  const NativePanner = window.PannerNode;
  function WrappedPanner(ctx, opts) {
    const p = new NativePanner(ctx, opts);
    events.push({ t: Math.round(performance.now()), kind: 'pan', x: opts && opts.positionX, z: opts && opts.positionZ });
    return p;
  }
  WrappedPanner.prototype = NativePanner.prototype;
  window.PannerNode = WrappedPanner;
  let frames = 0; const t0 = performance.now();
  const pump = () => { frames++; requestAnimationFrame(pump); };
  requestAnimationFrame(pump);
  window.__fps = () => frames / Math.max(0.001, (performance.now() - t0) / 1000);
})();
`;

const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/usr/local/bin/google-chrome',
  headless: true,
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--no-sandbox',
    '--disable-extensions', '--no-first-run', '--autoplay-policy=no-user-gesture-required',
  ],
});
const context = await browser.newContext({
  viewport: { width: 960, height: 540 },
  recordVideo: { dir, size: { width: 960, height: 540 } },
});
await context.addInitScript(hook);
const page = await context.newPage();
page.on('pageerror', e => errors.push(String(e).slice(0, 400)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

const shots = [];
async function shot(name) {
  const file = join(dir, name + '.png');
  await page.screenshot({ path: file });
  shots.push(name);
  console.log('shot', name);
}

async function settle(url) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#loading', { state: 'detached', timeout: 120000 });
  await page.waitForTimeout(8000);
  await page.mouse.click(480, 270);
  await page.waitForTimeout(500);
}

async function probe() {
  return page.evaluate(() => {
    const player = window.__boreal?.player?.() ?? null;
    const list = window.borealHares?.list?.() ?? [];
    const px = player?.x ?? 0, pz = player?.z ?? 0;
    const hares = list.map(h => ({
      id: h.id, state: h.state, sim: h.sim?.state, timer: Math.round((h.sim?.timer ?? 0) * 100) / 100,
      level: Math.round((h.sim?.level ?? 0) * 1000) / 1000, speed: Math.round((h.sim?.speed ?? 0) * 100) / 100,
      energy: Math.round(h.sim?.energy ?? 0),
      d: Math.round(Math.hypot(h.x - px, h.z - pz) * 100) / 100,
      x: Math.round(h.x * 10) / 10, z: Math.round(h.z * 10) / 10,
    }));
    const log = window.__soundLog ?? [];
    return {
      player, hares, fps: Math.round((window.__fps?.() ?? 0) * 10) / 10,
      starts: log.filter(e => e.kind === 'start').slice(-30),
      levels: log.filter(e => e.kind === 'level').slice(-40),
      pans: log.filter(e => e.kind === 'pan').slice(-15),
      href: location.href,
      status: document.querySelector('#status')?.textContent ?? '',
    };
  });
}

const pages = {};
try {
  const noon = `${base}?nomenu&bench&hour=12&rec&stages=1&at=200,250,-1.553`;
  await settle(noon);
  const fps = await page.evaluate(() => window.__fps?.() ?? 0);
  console.log('fps', fps);
  await page.waitForTimeout(3000);
  pages.noon = await probe();
  console.log('noon hares', JSON.stringify(pages.noon.hares));
  console.log('noon levels', JSON.stringify(pages.noon.levels));
  await shot('noon-shore');

  // Face the nearest hare and walk until it bolts, or 75 s.
  const t0 = Date.now();
  let bolted = null;
  while (Date.now() - t0 < 75000) {
    const snap = await page.evaluate(() => {
      const p = window.__boreal?.player?.();
      const list = window.borealHares?.list?.() ?? [];
      if (!p || !list.length) return null;
      let best = null;
      for (const h of list) {
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if (!best || d < best.d) best = { id: h.id, x: h.x, z: h.z, d, state: h.state, sim: h.sim?.state, level: h.sim?.level, yaw: p.yaw };
      }
      return best;
    });
    if (!snap) { await page.waitForTimeout(400); continue; }
    const live = await page.evaluate(() => {
      const p = window.__boreal.player();
      const list = window.borealHares.list();
      let best = null;
      for (const h of list) {
        const d = Math.hypot(h.x - p.x, h.z - p.z);
        if (!best || d < best.d) best = h;
      }
      if (!best) return null;
      const desired = Math.atan2(-(best.x - p.x), -(best.z - p.z));
      const err = Math.atan2(Math.sin(desired - p.yaw), Math.cos(desired - p.yaw));
      return { id: best.id, d: Math.hypot(best.x - p.x, best.z - p.z), state: best.state, sim: best.sim.state, level: best.sim.level, err, x: p.x, z: p.z };
    });
    if (!live) break;
    if (live.sim === 'flee' || live.state === 'flee') { bolted = live; break; }
    if (live.err > 0.25) { await page.keyboard.up('d'); await page.keyboard.down('a'); await page.keyboard.up('w'); }
    else if (live.err < -0.25) { await page.keyboard.up('a'); await page.keyboard.down('d'); await page.keyboard.up('w'); }
    else { await page.keyboard.up('a'); await page.keyboard.up('d'); await page.keyboard.down('w'); }
    if (Math.round((Date.now() - t0) / 1000) % 5 === 0) console.log('approach', JSON.stringify({ ...live, d: Math.round(live.d * 10) / 10, level: Math.round(live.level * 100) / 100 }));
    await page.waitForTimeout(250);
    if (live.d < 4 && live.sim !== 'flee') await shot('hare-close');
  }
  await page.keyboard.up('w'); await page.keyboard.up('a'); await page.keyboard.up('d');
  pages.approach = { bolted, ...(await probe()) };
  console.log('bolted', JSON.stringify(bolted));
  await shot(bolted ? 'hare-bolt' : 'hare-approach');

  // Night, same shore, loop levels only.
  await page.keyboard.up('w');
  const night = `${base}?nomenu&bench&hour=22&rec&stages=1&at=200,250,-1.553`;
  await settle(night);
  await page.waitForTimeout(2000);
  pages.night = await probe();
  console.log('night levels', JSON.stringify(pages.night.levels));
  await shot('night-shore');

  const inland = `${base}?nomenu&bench&hour=12&rec&stages=1&at=148,64,0`;
  await settle(inland);
  await page.waitForTimeout(2000);
  pages.inland = await probe();
  console.log('inland levels', JSON.stringify(pages.inland.levels));
  await shot('noon-inland');

  const deerUrl = `${base}?nomenu&bench&hour=12&rec&stages=1&at=66.27,27,0`;
  await settle(deerUrl);
  pages.deerSpot = await probe();
  console.log('deer spot hares', JSON.stringify(pages.deerSpot.hares));
  await shot('deer-spot');

  await context.addInitScript(() => localStorage.setItem('boreal.player.v1', 'deer'));
  const asDeer = `${base}?nomenu&bench&hour=12&rec&stages=1&at=200,250,0`;
  await settle(asDeer);
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(1200);
  await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(400);
  pages.asDeer = await probe();
  await shot('deer-playable');
} finally {
  const video = page.video();
  await browser.close();
  if (video) {
    const saved = await video.path();
    console.log('video', saved);
    pages.video = saved;
  }
}

writeFileSync(join(dir, 'capture.json'), JSON.stringify({
  commit: process.env.CAPTURE_COMMIT ?? '',
  viewport: [960, 540], shots, pages, errors: errors.slice(0, 40),
}, null, 2));
console.log('wrote', shots.join(','), 'errors', errors.length);
