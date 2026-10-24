// Headless shots of the pad menu, help overlay and filter wheel with a mocked standard pad (Grok Bot).
// node tools/padmenu-shot.mjs <base url of tools/padmenu.html> <out dir> <playwright-core index.mjs>
const [, , url, out, pwPath] = process.argv; const { chromium } = await import(pwPath);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shoot = async (q, name, steps) => {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.addInitScript(() => { const st = { buttons: Array.from({ length: 17 }, () => ({ value: 0, pressed: false, touched: false })), axes: [0, 0, 0, 0] };
    const pad = { id: 'Mock Xbox', index: 0, connected: true, mapping: 'standard', timestamp: 0, ...st }; window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
    window.__set = (i, v) => { pad.buttons[i] = { value: v, pressed: v > .1, touched: v > 0 }; }; window.__axes = a => { pad.axes = a; }; });
  await p.goto(url + q); await p.waitForTimeout(1500);
  const tap = async (i, ms = 120) => { await p.evaluate(i => window.__set(i, 1), i); await p.waitForTimeout(ms); await p.evaluate(i => window.__set(i, 0), i); await p.waitForTimeout(150); };
  await steps(p, tap); await p.screenshot({ path: `${out}/${name}.png` }); await p.close();
};
await shoot('', 'pad-menu', async (p, tap) => { await tap(9); await tap(13); await tap(13); });
await shoot('?unlockAll=1', 'pad-menu-camera', async (p, tap) => { await tap(9); await tap(5); await tap(13); });
await shoot('?unlockAll=1', 'pad-radial', async p => { await p.evaluate(() => window.__set(3, 1)); await p.waitForTimeout(600); await p.evaluate(() => window.__axes([0, 0, .95, .3])); await p.waitForTimeout(300); });
await shoot('', 'pad-help', async (p, tap) => { await tap(8); });
await b.close();
