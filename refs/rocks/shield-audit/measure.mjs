// Zero-dependency calibrated PNG measurement script for Canadian Shield rock outcrops, boulders, shape aspect, and lichen/mineral texture (Rule 11).
// Usage: node refs/rocks/shield-audit/measure.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decodePng(path) {
  const d = readFileSync(path);
  let i = 8, w = 0, h = 0, ct = 0;
  const idat = [];
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
  const rows = [];
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

function measureShieldFrame(path, opts = {}) {
  const img = decodePng(path);
  const { bpp, rows } = img;
  const step = 2;
  const x0 = 240, x1 = 1220, y0 = 400, y1 = 636;
  const wolfBox = opts.wolfBox ?? [535, 350, 695, 720];
  const ringBox = opts.ringBox === undefined ? [385, 350, 790, 435] : opts.ringBox;
  const hudBox = opts.hudBox === undefined ? [420, 560, 760, 640] : opts.hudBox;
  const wolfHeightPx = opts.wolfHeightPx ?? 215;

  const gw = Math.floor((x1 - x0) / step);
  const gh = Math.floor((y1 - y0) / step);
  const grid = new Uint8Array(gw * gh);
  let validCells = 0, rockCells = 0;
  let lumSum = 0, lumSqSum = 0;

  for (let gy = 0; gy < gh; gy++) {
    const y = y0 + gy * step;
    for (let gx = 0; gx < gw; gx++) {
      const x = x0 + gx * step;
      if (x >= wolfBox[0] && x <= wolfBox[2] && y >= wolfBox[1] && y <= wolfBox[3]) continue;
      if (ringBox && x >= ringBox[0] && x <= ringBox[2] && y >= ringBox[1] && y <= ringBox[3]) continue;
      if (hudBox && x >= hudBox[0] && x <= hudBox[2] && y >= hudBox[1] && y <= hudBox[3]) continue;
      validCells++;
      const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
      const mean = (r + g + b) / 3;
      // Mineral grey / Canadian Shield pink-grey granite & crustose grey-sage lichen (sunlit or skylight-shadowed):
      // Green foliage/moss has green strictly dominant over both red and blue; mineral rock has either warm sunlight (r >= g - 8) or skylight shadow (b >= g - 2).
      const isFoliageOrMoss = (g > r + 8 && g > b + 4) || (g > b + 10 && r < 140);
      const isPaleSky = r > 215 && g > 215 && b > 205;
      const isMineralOrCrustose = (r >= g - 8 || b >= g - 2) && b - r <= 28 && r - b <= 38 && Math.abs(g - b) <= 24;
      const isRock = !isFoliageOrMoss && !isPaleSky && isMineralOrCrustose && mean >= 96;
      if (isRock) {
        grid[gy * gw + gx] = 1;
        rockCells++;
        lumSum += mean;
        lumSqSum += mean * mean;
      }
    }
  }

  // 8-connected components on grid
  const visited = new Uint8Array(gw * gh);
  const widthsPx = [];
  let maxAreaPx2 = 0, bestBox = null, bestAspect = 0;
  for (let i = 0; i < gw * gh; i++) {
    if (!grid[i] || visited[i]) continue;
    const q = [i];
    visited[i] = 1;
    let minX = gw, maxX = 0, minY = gh, maxY = 0, count = 0;
    while (q.length) {
      const cur = q.pop();
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
            if (grid[ni] && !visited[ni]) {
              visited[ni] = 1;
              q.push(ni);
            }
          }
        }
      }
    }
    if (count >= 2) {
      const wPx = (maxX - minX + 1) * step;
      const hPx = Math.max(step, (maxY - minY + 1) * step);
      widthsPx.push(wPx);
      const areaPx2 = count * step * step;
      if (areaPx2 > maxAreaPx2) {
        maxAreaPx2 = areaPx2;
        bestBox = [x0 + minX * step, y0 + minY * step, x0 + maxX * step, y0 + maxY * step];
        bestAspect = +(wPx / hPx).toFixed(2);
      }
    }
  }
  widthsPx.sort((a, b) => a - b);
  const maxW = widthsPx.length ? widthsPx[widthsPx.length - 1] : 0;
  const medW = widthsPx.length ? widthsPx[Math.floor(widthsPx.length / 2)] : 0;
  const rockCoverShare = +(rockCells / Math.max(1, validCells)).toFixed(4);
  const largestRatioToWolf = +(maxW / wolfHeightPx).toFixed(3);
  const lumMean = rockCells ? lumSum / rockCells : 0;
  const mineralLichenStdDev = rockCells > 2 ? +Math.sqrt(Math.max(0, lumSqSum / rockCells - lumMean * lumMean)).toFixed(2) : 0;

  // Calibrated Shield bedrock-ridge score (0..1):
  // 1) coverSubscore (0.4): 1.0 when exposed rock cover >= 16% of ground ROI (NW Ontario FEC V30/V12 bedrock ridge)
  // 2) scaleSubscore (0.35): 1.0 when largest contiguous outcrop/boulder span >= 1.0x wolf withers height (~0.75 m)
  // 3) shapeAndTextureSubscore (0.25): low-relief glacially scoured whaleback aspect ratio (w/h >= 1.8) + mineral/lichen internal texture stdDev (>= 8.0), rejecting a monochrome spherical/cubic grey blob
  const coverSubscore = Math.min(1, rockCoverShare / 0.16);
  const scaleSubscore = Math.min(1, largestRatioToWolf / 1.0);
  const shapeAndTextureSubscore = 0.5 * Math.min(1, bestAspect / 1.8) + 0.5 * Math.min(1, mineralLichenStdDev / 8.0);
  const calibratedScore = +(0.4 * coverSubscore + 0.35 * scaleSubscore + 0.25 * shapeAndTextureSubscore).toFixed(3);

  return {
    rockCoverShare,
    componentCount: widthsPx.length,
    largestFeatureWidthPx: maxW,
    medianFeatureWidthPx: medW,
    largestFeatureAreaPx2: maxAreaPx2,
    largestFeatureBox: bestBox,
    largestAspectWidthToHeight: bestAspect,
    mineralLichenStdDev,
    largestRatioToWolfWithers: largestRatioToWolf,
    coverSubscore: +coverSubscore.toFixed(3),
    scaleSubscore: +scaleSubscore.toFixed(3),
    shapeAndTextureSubscore: +shapeAndTextureSubscore.toFixed(3),
    calibratedScore,
  };
}

const results = {
  metric: 'shieldOutcropScore = 0.40 * min(1, rockCoverShare / 0.16) + 0.35 * min(1, (largestFeatureWidthPx / wolfWithersHeightPx) / 1.0) + 0.25 * (0.5 * min(1, aspectWH / 1.8) + 0.5 * min(1, mineralLichenStdDev / 8.0))',
  calibration: {
    knownMatch_natureReference: measureShieldFrame('refs/rocks/reference/shield-ridge-ref.png', {
      wolfBox: [460, 185, 650, 565],
      ringBox: null,
      hudBox: null,
      wolfHeightPx: 260,
    }),
    knownMismatch_forestFloorGame: measureShieldFrame('refs/rocks/shield-audit/forest-floor-0.png'),
  },
  gameBedrockRidge_uplandRidge0: measureShieldFrame('refs/rocks/shield-audit/upland-ridge-0.png', {
    wolfBox: [515, 315, 780, 720],
  }),
  gameBedrockRidge_uplandWalk0: measureShieldFrame('refs/rocks/shield-audit/upland-walk-0.png', {
    wolfBox: [515, 315, 780, 720],
  }),
  gameBedrockRidge_uplandWalk1: measureShieldFrame('refs/rocks/shield-audit/upland-walk-1.png', {
    wolfBox: [515, 315, 780, 720],
  }),
};

writeFileSync('refs/rocks/shield-audit/measure.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
