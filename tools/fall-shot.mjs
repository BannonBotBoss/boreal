// Headless WebGL frames of a scripted fall on the in-page path (gate 2 of #192): load the game with ?transition=inpage,
// Continue from the menu, Shift+G up to the planet (ascend), then G (drop on the centre), then grab a frame + HUD text every STEP ms. SwiftShader = software GL.
// WIP (Oct 30): under SwiftShader the game is still on its loading screen ~55 s in, so Continue misses and G / Shift+G open the
// gallery. Raise LOAD (ms) until game-play.png shows the world before trusting the fall frames.
// BASE=http://127.0.0.1:5173 PW=<playwright-core path> node tools/fall-shot.mjs   (writes /tmp/shots-fall)
const pw = await import(process.env.PW ?? 'playwright-core'), chromium = pw.chromium ?? pw.default.chromium;
const BASE = process.env.BASE ?? 'http://127.0.0.1:5173', STEP = +(process.env.STEP ?? 4000), N = +(process.env.N ?? 20);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`${BASE}/?transition=inpage${process.env.Q ?? ''}`); await p.waitForTimeout(+(process.env.LOAD ?? 25000));
await p.screenshot({ path: '/tmp/shots-fall/game-start.png' }); await p.mouse.move(640, 360);
await p.getByText('Continue', { exact: true }).first().click().catch(() => {}); await p.waitForTimeout(8000);
await p.screenshot({ path: '/tmp/shots-fall/game-play.png' }); await p.keyboard.press('Shift+KeyG'); await p.waitForTimeout(+(process.env.UP ?? 25000));
const hud = () => p.evaluate(() => (document.body.innerText.split('\n').filter(l => /(alt|altitude|fall|ft\b|km\b| m\b)/i.test(l)).join(' | ')).slice(0, 240));
console.log(JSON.stringify({ t: 0, hud: await hud() })); await p.screenshot({ path: '/tmp/shots-fall/fall-00.png' });
await p.keyboard.press(process.env.KEY ?? 'g'); const t0 = Date.now();
for (let i = 1; i <= N; i++) {
  await p.waitForTimeout(STEP);
  const f = `/tmp/shots-fall/fall-${String(i).padStart(2, '0')}.png`; await p.screenshot({ path: f });
  console.log(JSON.stringify({ i, s: +((Date.now() - t0) / 1000).toFixed(1), hud: await hud() }));
}
console.log(JSON.stringify({ errs: errs.slice(0, 5) }));
await b.close();
