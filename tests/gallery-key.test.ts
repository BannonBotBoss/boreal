import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// #211: G is the planet drop (globeView, in-page globe). The viewfinder's G-gallery key must not fire there too.
test('the G gallery key is gated off the globe', () => {
  const src = readFileSync(new URL('../src/camera/gameCamera.ts', import.meta.url), 'utf8');
  assert.match(src, /galleryKey = \(\) => view === 'game' && !document\.body\.classList\.contains\('on-globe'\)/);
  assert.match(src, /e\.key === 'g' && galleryKey\(\)/);
});
