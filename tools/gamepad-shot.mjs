// Headless shot of tools/gamepad.html with a mocked standard pad (A, Y, LB, RT 0.7, LT 0.3, D-pad up, LS tilted, RS clicked).
// node tools/gamepad-shot.mjs <url> <out.png> [playwright-core path]
const [url = 'http://127.0.0.1:5199/tools/gamepad.html', out = 'gamepad-settings.png', pw = 'playwright-core'] = process.argv.slice(2);
const { chromium } = await import(pw);
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.addInitScript(() => {
  const v = { 0: 1, 3: 1, 4: 1, 6: .3, 7: .7, 11: 1, 12: 1 };
  const pad = { id: 'mock', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [-.7, -.5, 0, 0], buttons: Array.from({ length: 17 }, (_, i) => ({ value: v[i] ?? 0, pressed: (v[i] ?? 0) > .1, touched: false })) };
  const idle = { ...pad, axes: [0, 0, 0, 0], buttons: pad.buttons.map(() => ({ value: 0, pressed: false, touched: false })) };
  navigator.getGamepads = () => [window.__pressed ? pad : idle];
});
p.on('pageerror', e => console.log('pageerror', e.message));
// presses start after load (edges fire once, before auto-repeat), so the shot shows them lit
await p.goto(url); await new Promise(r => setTimeout(r, 1500)); await p.evaluate(() => { window.__pressed = true; }); await new Promise(r => setTimeout(r, 150)); await p.screenshot({ path: out }); await b.close(); console.log('wrote', out);
