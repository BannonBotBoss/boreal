(async () => { const url = n => { const u = performance.getEntriesByType('resource').map(e => e.name).filter(x => x.includes(n)); return u[u.length - 1]; };
  const T = await import(url('/deps/three.js')), G = await import(url('/src/render/geometry.ts')), B = await import(url('/src/render/batch.ts'));
  const found = new Map(); let cam = null; const proto = T.BatchedMesh.prototype, base = proto.onBeforeRender;
  proto.onBeforeRender = function (r, s, c, ...a) { cam = c.position.clone(); if (this.material === G.LOG_MATERIAL || this.material === B.ROCK_MATERIAL) found.set(this, this.material === G.LOG_MATERIAL ? 'log' : 'rock'); return base.call(this, r, s, c, ...a); };
  await new Promise(r => setTimeout(r, 2000)); proto.onBeforeRender = base;
  const m = new T.Matrix4(), p = new T.Vector3(), out = [];
  for (const [bm, kind] of found) { const n = bm.instanceCount ?? bm._instanceInfo?.length ?? 0; for (let i = 0; i < n; i++) { try { if (bm.getVisibleAt && !bm.getVisibleAt(i)) continue; bm.getMatrixAt(i, m); p.setFromMatrixPosition(m).applyMatrix4(bm.matrixWorld); out.push([kind, +p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1), +Math.hypot(p.x - cam.x, p.z - cam.z).toFixed(1)]); } catch {} } }
  out.sort((a, b) => a[4] - b[4]);
  return 'cam ' + [cam.x, cam.y, cam.z].map(v => v.toFixed(1)).join(',') + ' | ' + JSON.stringify(out.filter(o => o[0] === 'log').slice(0, 6)) + ' | rocks ' + JSON.stringify(out.filter(o => o[0] === 'rock').slice(0, 3)); })()
