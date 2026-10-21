// Zero-dependency calibrated PNG + geometry measurement script for T-0027 (botanical forage & herb geometry, Rule 11).
// Usage: npx tsx refs/forage/t0027-audit/measure.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three';
import { generateChunk, type Entity } from '../../../src/core/world';
import { generateGeometry, disposeObject } from '../../../src/render/geometry';

function decodePng(path: string) {
  const d = readFileSync(path);
  let i = 8, w = 0, h = 0, ct = 0;
  const idat: Buffer[] = [];
  while (i < d.length) {
    const n = d.readUInt32BE(i);
    const t = d.toString('latin1', i + 4, i + 8);
    const c = d.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = c.readUInt32BE(0); h = c.readUInt32BE(4); ct = c[9]; }
    if (t === 'IDAT') idat.push(c);
    i += 12 + n;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const bpp = ct === 6 ? 4 : 3;
  const stride = w * bpp;
  const rows: Uint8Array[] = [];
  let prev = new Uint8Array(stride), p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p];
    const line = Uint8Array.from(raw.subarray(p + 1, p + 1 + stride));
    p += 1 + stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      if (f === 1) line[x] = (line[x] + a) & 255;
      else if (f === 2) line[x] = (line[x] + b) & 255;
      else if (f === 3) line[x] = (line[x] + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        line[x] = (line[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255;
      }
    }
    rows.push(line);
    prev = line;
  }
  return { w, h, bpp, rows };
}

/**
 * Calibrated image metric on the foreground ground ROI (Rule 11):
 * Measures:
 *  1) maxBerryBlobPx: largest contiguous bright-blue berry sphere span (px) in the ground ROI (x in [240, 1260], y in [390, 636], excluding wolf & HUD).
 *     In nature (`shield-ridge-ref.png`), individual *Vaccinium angustifolium* berries (6-12 mm) and terminal clusters subtend 2-7 px;
 *     pre-T-0027 grapefruit spheres (78-120 mm) subtended 12-16 px.
 *  2) giantOchreHeadPixels: pixels of oversized yellow-ochre icosahedron herb flower spheres (R >= 165, G in [125, 190], B in [65, 125], R - B >= 70, R - G >= 25, G - B >= 35)
 *     in the upper-herb zone (x in [500, 730], y in [315, 445], excluding wolf body box).
 *     Pre-T-0027 `upland-ridge-0.png` had 4,543 px of giant yellow-ochre faceted spheres crowning the 1.02 m herb above the wolf's head;
 *     natural low understorey herbs (`bunchberry`, `bluebead`) stay below y=450 (0 px in the upper zone).
 *  botanicalPropScore = min(berryScaleSubscore, herbProportionSubscore) so ANY cartoon oversized organ fails the gate (< 0.95).
 */
function measurePropFrame(path: string, opts: { wolfBox?: [number, number, number, number] } = {}) {
  const { bpp, rows } = decodePng(path);
  const wolfBox = opts.wolfBox ?? [535, 350, 695, 720];
  const ringBox = [385, 345, 790, 435];
  const hudBox = [420, 560, 760, 640];

  // 1) Measure giant ochre herb-sphere pixels above wolf withers (x in [500, 730], y in [315, 445])
  let giantOchreHeadPixels = 0;
  for (let y = 315; y <= 445; y++) {
    for (let x = 500; x <= 730; x++) {
      // Skip the wolf's own body box
      if (x >= wolfBox[0] && x <= wolfBox[2] && y >= wolfBox[1] && y <= wolfBox[3]) continue;
      const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
      // Giant ochre sphere head (0xd9a15c under sun/sky lighting): R in [165, 235], G in [125, 190], B in [65, 125]
      const isOchreSphere = r >= 165 && g >= 125 && g <= 190 && b >= 65 && b <= 125 && (r - b) >= 70 && (r - g) >= 25 && (g - b) >= 35;
      if (isOchreSphere) giantOchreHeadPixels++;
    }
  }

  // 2) Measure contiguous bright-blue berry blob width (px) across ground ROI (x in [240, 1260], y in [445, 636])
  const x0 = 240, x1 = 1260, y0 = 445, y1 = 636;
  const gw = x1 - x0, gh = y1 - y0;
  const blueGrid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    const y = y0 + gy;
    for (let gx = 0; gx < gw; gx++) {
      const x = x0 + gx;
      if (x >= wolfBox[0] && x <= wolfBox[2] && y >= wolfBox[1] && y <= wolfBox[3]) continue;
      if (x >= ringBox[0] && x <= ringBox[2] && y >= ringBox[1] && y <= ringBox[3]) continue;
      if (x >= hudBox[0] && x <= hudBox[2] && y >= hudBox[1] && y <= hudBox[3]) continue;
      const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
      if (b > 115 && b - r > 32 && b - g > 15) blueGrid[gy * gw + gx] = 1;
    }
  }
  const visited = new Uint8Array(gw * gh);
  let maxBerryBlobPx = 0, berryBlobCount = 0;
  for (let i = 0; i < gw * gh; i++) {
    if (!blueGrid[i] || visited[i]) continue;
    const q = [i];
    visited[i] = 1;
    let minX = gw, maxX = 0, minY = gh, maxY = 0, count = 0;
    while (q.length) {
      const cur = q.pop()!;
      count++;
      const cx = cur % gw, cy = (cur / gw) | 0;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy < minY) minY = cy;
      if (cy > maxY) maxY = cy;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) {
            const ni = ny * gw + nx;
            if (blueGrid[ni] && !visited[ni]) {
              visited[ni] = 1;
              q.push(ni);
            }
          }
        }
      }
    }
    if (count >= 2) {
      berryBlobCount++;
      const span = Math.max(maxX - minX + 1, maxY - minY + 1);
      if (span > maxBerryBlobPx) maxBerryBlobPx = span;
    }
  }

  // Subscores:
  // berryScaleSubscore = 1.0 when maxBerryBlobPx <= 7 px (real 6-12 mm berries / terminal corymbs), 0.0 when >= 12 px (78-120 mm grapefruit spheres)
  const berryScaleSubscore = Math.max(0, Math.min(1, 1 - Math.max(0, maxBerryBlobPx - 7) / 5));
  // herbProportionSubscore = 1.0 when giantOchreHeadPixels <= 15 px, 0.0 when >= 600 px (giant 292 px cactus herb in front of wolf)
  const herbProportionSubscore = Math.max(0, Math.min(1, 1 - Math.max(0, giantOchreHeadPixels - 15) / 585));
  const calibratedScore = +Math.min(berryScaleSubscore, herbProportionSubscore).toFixed(3);

  return {
    giantOchreHeadPixels,
    maxBerryBlobPx,
    berryBlobCount,
    berryScaleSubscore: +berryScaleSubscore.toFixed(3),
    herbProportionSubscore: +herbProportionSubscore.toFixed(3),
    calibratedScore,
  };
}

// 3) Measure 3D generated geometry bounds & organ dimensions across chunks (0,0)..(2,2)
const forageHeights: number[] = [], forageRadii: number[] = [];
const herbHeights: number[] = [], herbRadii: number[] = [];
for (let cx = 0; cx < 3; cx++) {
  for (let cz = 0; cz < 3; cz++) {
    for (const e of generateChunk(cx, cz)) {
      if (e.kind !== 'forage' && e.kind !== 'plant') continue;
      const g = generateGeometry(e, 0);
      g.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(g, true);
      const sz = box.getSize(new THREE.Vector3());
      if (e.kind === 'forage') {
        forageHeights.push(+sz.y.toFixed(3));
        forageRadii.push(+(Math.max(sz.x, sz.z) / 2).toFixed(3));
      } else {
        herbHeights.push(+sz.y.toFixed(3));
        herbRadii.push(+(Math.max(sz.x, sz.z) / 2).toFixed(3));
      }
      disposeObject(g);
    }
  }
}
const stats = (arr: number[]) => {
  const s = [...arr].sort((a, b) => a - b);
  return {
    count: s.length,
    min: s[0],
    median: s[s.length >> 1],
    max: s[s.length - 1],
  };
};

const out = {
  metric: 'botanicalPropScore = min(clamp01(1 - (maxBerryBlobPx - 7)/5), clamp01(1 - (giantOchreHeadPixels - 15)/585))',
  calibration: {
    knownMatch_natureReference: measurePropFrame('refs/rocks/reference/shield-ridge-ref.png', { wolfBox: [460, 185, 650, 565] }),
    knownMismatch_preT0027UplandRidge0: measurePropFrame('refs/rocks/shield-audit/upland-ridge-0.png'),
    knownMismatch_preT0027ForestFloor0: measurePropFrame('refs/rocks/shield-audit/forest-floor-0.png'),
  },
  afterT0027: {
    uplandRidge0: measurePropFrame('refs/forage/t0027-audit/upland-ridge-0.png'),
    uplandWalk2: measurePropFrame('refs/forage/t0027-audit/upland-walk-2.png'),
    forestFloor0: measurePropFrame('refs/forage/t0027-audit/forest-floor-0.png'),
    forestWalk2: measurePropFrame('refs/forage/t0027-audit/forest-walk-2.png'),
  },
  geometryStatsMeters: {
    forageHeightM: stats(forageHeights),
    forageRadiusM: stats(forageRadii),
    herbHeightM: stats(herbHeights),
    herbRadiusM: stats(herbRadii),
  },
};

writeFileSync('refs/forage/t0027-audit/measure.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
