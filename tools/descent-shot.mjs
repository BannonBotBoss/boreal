// Headless WebGL frames of ?view=globe at 1 km, 300 m and 40 m (gate 2 of #192). SwiftShader = software GL, so frame times are not GPU numbers.
// BASE=http://127.0.0.1:5173 PW=<playwright-core path> node tools/descent-shot.mjs   (writes /tmp/shots)
const { chromium } = await import(process.env.PW ?? 'playwright-core');
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
for (const alt of [1000, 300, 40]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${process.env.BASE ?? 'http://127.0.0.1:5173'}/?view=globe&alt=${alt}`); await p.waitForTimeout(12000);
  const ft = await p.evaluate(() => new Promise(r => { const t = []; let last = performance.now(); const f = n => { t.push(n - last); last = n; if (t.length < 30) requestAnimationFrame(f); else r(t.slice(5).sort((a,b)=>a-b)[12]); }; requestAnimationFrame(f); }));
  const gpu = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const d = g && g.getExtension('WEBGL_debug_renderer_info'); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
  const hud = await p.evaluate(() => [...document.querySelectorAll('div')].map(d => d.innerText).find(t => /alt|km|m\b/i.test(t || ''))?.slice(0, 300) ?? '');
  await p.screenshot({ path: `/tmp/shots/descent-${alt}m.png` });
  console.log(JSON.stringify({ alt, medianFrameMs: Math.round(ft), gpu, errs: errs.slice(0,3), hud: hud.replace(/\n/g,' | ') }));
  await p.close();
}
await b.close();
