(async () => { const url = n => { const u = performance.getEntriesByType('resource').map(e => e.name).filter(x => x.includes('/src/' + n)); return u[u.length - 1]; };
  const Q = await import(url('core/quality.ts')), G = Q.GOVERNOR;
  const P = WebGL2RenderingContext.prototype; let calls = 0;
  for (const k of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) { const f = P[k]; P[k] = function (...a) { calls++; return f.apply(this, a); }; }
  for (const c of document.querySelectorAll('canvas')) { const md = c.getContext('webgl2')?.getExtension('WEBGL_multi_draw');
    if (md && !md.__wrapped) { md.__wrapped = true; for (const k of ['multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']) { const f = md[k]; if (f) md[k] = function (...a) { calls++; return f.apply(this, a); }; } } }
  const raf = () => new Promise(r => requestAnimationFrame(r)), wait = ms => new Promise(r => setTimeout(r, ms));
  const meas = async () => { const ws = [], cs = [], gs = []; let last = performance.now(); const t = last; while (performance.now() - t < 5000) { calls = 0; await raf(); const n = performance.now(); ws.push(n - last); cs.push(calls); last = n; if (G.gpuMs !== undefined) gs.push(G.gpuMs); }
    const avg = a => +(a.reduce((p, c) => p + c, 0) / a.length).toFixed(2); const s = [...ws].sort((a, b) => a - b); return { frame: avg(ws), p95: +s[Math.floor(s.length * .95)].toFixed(1), draws: Math.round(avg(cs)), gpu: gs.length ? avg(gs) : null }; };
  const med0 = { ...Q.LADDER[2] }, res = {}; const early = {};
  const V = [['High',1,null],['Medium',2,{}],['Low',3,null],['High-2',1,null],['Medium-2',2,{}],['Low-2',3,null]];
  G.auto = false; G.capTier = 0; G.probeCap = 0;
  for (const [name, t, v] of V) { Object.assign(Q.LADDER[2], med0, v ?? {}); G.tier = t; await wait(8000); early[name] = await meas(); await wait(12000); res[name] = await meas(); }
  Object.assign(Q.LADDER[2], med0);
  return Object.entries(res).map(([k, r]) => `${k.padEnd(16)} frame ${r.frame} ms p95 ${r.p95} gpu ${r.gpu} draws ${r.draws} | at 8 s: frame ${early[k].frame} draws ${early[k].draws} gpu ${early[k].gpu}`).join('\n'); })()
