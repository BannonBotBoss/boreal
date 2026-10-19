(async () => { const url = n => { const u = performance.getEntriesByType('resource').map(e => e.name).filter(x => x.includes('/src/' + n)); return u[u.length - 1]; };
  const Q = await import(url('core/quality.ts')), G = Q.GOVERNOR; const wait = ms => new Promise(r => setTimeout(r, ms));
  G.capTier = 0; G.probeCap = 0; G.tier = 0; G.auto = true; if (Q.resetGovernor) Q.resetGovernor();
  const ch = []; let last = G.tier, frames = 0, sum = 0; const t0 = performance.now(), per = new Map();
  while (performance.now() - t0 < 150000) { const a = performance.now(); await new Promise(r => requestAnimationFrame(r)); const dt = performance.now() - a; frames++; sum += dt;
    const p = per.get(G.tier) ?? [0, 0]; p[0]++; p[1] += dt; per.set(G.tier, p);
    if (G.tier !== last) { ch.push(`${((performance.now() - t0) / 1000).toFixed(1)}s ${Q.LADDER[last].name}->${Q.LADDER[G.tier].name}`); last = G.tier; } }
  return `${ch.length} tier changes in 150 s: ${ch.join(', ') || 'none'} | final ${Q.LADDER[G.tier].name} | mean frame ${(sum / frames).toFixed(2)} ms | time per tier: ` + [...per].map(([t, [n, s]]) => `${Q.LADDER[t].name} ${(s / 1000).toFixed(0)} s @ ${(s / n).toFixed(2)} ms`).join(', '); })()
