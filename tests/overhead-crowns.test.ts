/** Overhead crowns: the existing stand placement, top-down, with gaps. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectCrowns, crownSprite, CROWN_CAP, CROWN_MAX_M, CROWN_MIN_M, nadirRadius, spaceCrowns } from '../src/render/trees/overheadCrowns';

test('a crown sprite is a disc with a transparent outside, not a solid square', () => {
  const rgba = crownSprite(0);
  const size = Math.sqrt(rgba.length / 4);
  let ink = 0, clear = 0;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] > 200) ink++;
    else if (rgba[i] === 0) clear++;
  }
  assert.ok(clear > size * size * 0.3, `clear ${clear}`);
  assert.ok(ink > size * size * 0.15, `ink ${ink}`);
  // A corner is outside the disc.
  assert.equal(rgba[3], 0);
});

test('crowns come from the stand placement, stay inside the view, and leave gaps', () => {
  const radius = nadirRadius(400);
  assert.ok(radius > 140 && radius < 220, `radius ${radius}`);
  const raw = collectCrowns(radius, 1, () => 1500);
  const spots = spaceCrowns(raw, 14);
  assert.ok(raw.length > spots.length, 'spacing drops stems so crowns do not fuse');
  assert.ok(spots.length > 80, `count ${spots.length}`);
  assert.ok(spots.length <= CROWN_CAP);
  let minX = Infinity, maxX = -Infinity;
  const slots = new Set<number>();
  for (const s of spots) {
    assert.ok(s.x * s.x + s.z * s.z <= radius * radius + 1);
    assert.ok(s.metres >= CROWN_MIN_M && s.metres <= CROWN_MAX_M);
    slots.add(s.slot);
    minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x);
  }
  assert.ok(slots.size >= 3, 'more than one crown shape');
  assert.ok(maxX - minX > radius, 'the crowns span the view, not one clump');
  let nearest = Infinity;
  const sample = spots.filter((_, i) => i % 11 === 0);
  for (const s of sample) {
    let best = Infinity;
    for (const o of spots) {
      if (o === s) continue;
      const d = (s.x - o.x) ** 2 + (s.z - o.z) ** 2;
      if (d < best) best = d;
    }
    nearest = Math.min(nearest, Math.sqrt(best));
  }
  assert.ok(nearest >= 13.5, `nearest crown ${nearest} m`);
});
