import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotRing, createSnapshotHub } from '../src/core/snapshot';

test('ring buffer keeps the newest items in order', () => {
  const r = new SnapshotRing<number>(3);
  for (let i = 1; i <= 5; i++) r.push(i);
  assert.equal(r.size, 3);
  assert.deepEqual([0, 1, 2].map(i => r.at(i)), [3, 4, 5]);
  assert.equal(r.at(3), undefined);
});

test('hub samples at ~10 Hz and restores every registered source', () => {
  const hub = createSnapshotHub(600); let a = 0, b = { x: 0 };
  hub.register('a', { capture: () => a, restore: v => { a = v; } });
  hub.register('b', { capture: () => ({ ...b }), restore: v => { b = { ...v }; } });
  for (let t = 0; t < 70; t += 1 / 30) { a = t; b.x = t * 2; hub.sample(t); }
  assert.equal(hub.ring.size, 600); // 60 s kept, older dropped
  const live = hub.capture(70), old = hub.ring.at(0)!;
  hub.restore(old); assert.ok(a < 11 && b.x === a * 2);
  hub.restore(live); assert.equal(a, live.parts.a);
});

test('store-only zip is readable by unzip', async () => {
  const { zipStore, crc32 } = await import('../src/photo/zip');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const { writeFileSync, mkdtempSync, readFileSync } = await import('node:fs'), { execFileSync } = await import('node:child_process'), { tmpdir } = await import('node:os'), { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'zip-')), file = join(dir, 't.zip');
  writeFileSync(file, zipStore([{ name: 'boreal_seq_0001.png', data: new Uint8Array([1, 2, 3]) }, { name: 'boreal_seq_0002.png', data: new TextEncoder().encode('hello') }]));
  try { execFileSync('unzip', ['-o', '-q', file, '-d', dir]); } catch (e: any) { if (e.code === 'ENOENT') return; throw e; } // unzip not installed (Windows): CRC check above still runs
  assert.equal(readFileSync(join(dir, 'boreal_seq_0002.png'), 'utf8'), 'hello');
});

test('capture framing: crop, presets, video clamp, tiles', async () => {
  const { cropRect, fitOutput, clampVideo, tiles } = await import('../src/photo/frame');
  assert.deepEqual(cropRect(1600, 900, 1), { x: 350, y: 0, w: 900, h: 900 });
  assert.deepEqual(cropRect(1600, 900, 21 / 9).w, 1600);
  assert.deepEqual(fitOutput({ w: 1600, h: 900 }, [3840, 2160], 1), { w: 3840, h: 2160 });
  assert.deepEqual(fitOutput({ w: 900, h: 1600 }, [3840, 2160], 1), { w: 2160, h: 3840 });
  assert.deepEqual(fitOutput({ w: 900, h: 900 }, null, 1.5), { w: 1350, h: 1350 });
  assert.deepEqual(clampVideo(3840, 2160), { w: 1920, h: 1080, clamped: true });
  const t = tiles(7680, 4320, 4096);
  assert.equal(t.length, 4); assert.equal(t.reduce((a, b) => a + b.w * b.h, 0), 7680 * 4320);
});
