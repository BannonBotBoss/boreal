(async () => { const url = n => { const u = performance.getEntriesByType('resource').map(e => e.name).filter(x => x.includes(n)); return u[u.length - 1]; };
  const T = await import(url('/deps/three.js')), G = await import(url('/src/render/geometry.ts')), B = await import(url('/src/render/batch.ts'));
  const proto = T.BatchedMesh.prototype, base = proto.onBeforeShadow, rec = new Map(), cams = new Map();
  proto.onBeforeShadow = function (...a) { base.apply(this, a); const kind = this.material === G.LOG_MATERIAL ? 'log' : this.material === B.ROCK_MATERIAL ? 'rock' : this.material === B.PROP_MATERIAL ? 'prop' : 'other';
    const cam = a[3]; if (!cams.has(cam)) cams.set(cam, 'cam' + cams.size); const k = cams.get(cam) + ' ' + kind + (this.castShadow ? '' : '(nocast)'); const r = rec.get(k) ?? [0, 0]; r[0]++; r[1] += this._multiDrawCount; rec.set(k, r); };
  await new Promise(r => setTimeout(r, 1500)); proto.onBeforeShadow = base;
  return [...rec].sort().map(([k, [n, d]]) => `${k}: ${n} mesh-draws, ${d} instances drawn`).join(' ; '); })()
