// Zero-dependency calibrated PNG measurement script for boreal littoral macrophytes (T-0025, Rule 11):
// emergent sedge/horsetail/bulrush cover in shallow water, floating-leaved pond-lily cover, vertical culm structure (dX/dY), and open-water presence.
// Usage: node refs/water/littoral-audit/measure.mjs
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

const clamp01 = x => Math.max(0, Math.min(1, x));

function measureLittoralFrame(path, opts = {}) {
  const img = decodePng(path);
  const { w, h, bpp, rows } = img;
  // Water & littoral ROI boxes:
  // emergentBox covers the shallow near-shore water zone where emergent sedge/horsetail/bulrush stems stand in water
  // floatingBox covers the outer littoral water band where Nuphar variegata lily pads float on open water
  const emergentBox = opts.emergentBox ?? [260, 275, 1180, 365];
  const floatingBox = opts.floatingBox ?? [260, 238, 1180, 320];
  const lakeBox = opts.lakeBox ?? [260, 225, 1180, 365];
  const wolfBox = opts.wolfBox === undefined ? [510, 315, 765, 720] : opts.wolfBox;

  const inWolf = (x, y) => wolfBox && x >= wolfBox[0] && x <= wolfBox[2] && y >= wolfBox[1] && y <= wolfBox[3];
  const lumaAt = (x, y) => {
    const cx = Math.max(0, Math.min(w - 1, x)), cy = Math.max(0, Math.min(h - 1, y));
    return (rows[cy][cx * bpp] + rows[cy][cx * bpp + 1] + rows[cy][cx * bpp + 2]) / 3;
  };
  const isPlantPixel = (r, g, b) => {
    const mean = (r + g + b) / 3;
    // Vascular emergent stems/leaves or floating lily pads / yellow Nuphar flowers: green > blue and green >= red*0.88, or golden yellow cup
    const isGreenMacrophyte = g > b + 5 && g >= r * 0.88 && mean >= 20 && mean <= 215;
    const isYellowLilyFlower = r > 145 && g > 120 && b < 95;
    return isGreenMacrophyte || isYellowLilyFlower;
  };
  const isOpenWaterPixel = (r, g, b) => {
    const mean = (r + g + b) / 3;
    // Sky-reflecting teal/blue lake water (B >= G && B > R + 12) or dark mirror lake water in nature reference photo
    const isBlueTealWater = b >= g && b > r + 12 && mean >= 40 && mean <= 220;
    const isDarkMirrorWater = opts.allowMirrorWater && !isPlantPixel(r, g, b) && b >= r && g <= b + 5 && mean >= 20 && mean <= 165;
    return isBlueTealWater || Boolean(isDarkMirrorWater);
  };

  let emValid = 0, emPlant = 0, gxSum = 0, gySum = 0;
  for (let y = emergentBox[1]; y <= emergentBox[3]; y += 2) {
    for (let x = emergentBox[0]; x <= emergentBox[2]; x += 2) {
      if (inWolf(x, y)) continue;
      emValid++;
      const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
      if (isPlantPixel(r, g, b)) {
        emPlant++;
        gxSum += Math.abs(lumaAt(x + 2, y) - lumaAt(x - 2, y));
        gySum += Math.abs(lumaAt(x, y + 2) - lumaAt(x, y - 2));
      }
    }
  }

  let flValid = 0, flPlant = 0, yellowFlowers = 0;
  for (let y = floatingBox[1]; y <= floatingBox[3]; y += 2) {
    for (let x = floatingBox[0]; x <= floatingBox[2]; x += 2) {
      if (inWolf(x, y)) continue;
      flValid++;
      const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
      if (isPlantPixel(r, g, b)) flPlant++;
      if (r > 145 && g > 120 && b < 95) yellowFlowers++;
    }
  }

  let lkValid = 0, lkWater = 0;
  for (let y = lakeBox[1]; y <= lakeBox[3]; y += 2) {
    for (let x = lakeBox[0]; x <= lakeBox[2]; x += 2) {
      if (inWolf(x, y)) continue;
      lkValid++;
      const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
      if (isOpenWaterPixel(r, g, b)) lkWater++;
    }
  }

  // Column-wise water+macrophyte interleaving inside lakeBox:
  // A true littoral stand has emergent culms and floating pads interleaved with water in the same vertical columns,
  // whereas dry land next to bare water (or bare open water) has near-zero column co-occurrence.
  let waterCols = 0, interleavedCols = 0;
  for (let x = lakeBox[0]; x <= lakeBox[2]; x += 4) {
    let colWater = 0, colPlant = 0;
    for (let y = lakeBox[1]; y <= lakeBox[3]; y += 2) {
      if (inWolf(x, y)) continue;
      const r = rows[y][x * bpp], g = rows[y][x * bpp + 1], b = rows[y][x * bpp + 2];
      if (isOpenWaterPixel(r, g, b)) colWater++;
      else if (isPlantPixel(r, g, b)) colPlant++;
    }
    if (colWater >= 3) {
      waterCols++;
      if (colPlant >= 2) interleavedCols++;
    }
  }

  const emergentCoverShare = +(emPlant / Math.max(1, emValid)).toFixed(4);
  const floatingCoverShare = +(flPlant / Math.max(1, flValid)).toFixed(4);
  const openWaterShare = +(lkWater / Math.max(1, lkValid)).toFixed(4);
  const interleavedColumnShare = waterCols >= 10 ? +(interleavedCols / waterCols).toFixed(4) : 0;
  const verticalCulmRatio = emPlant >= 20 ? +(gxSum / Math.max(1, gySum)).toFixed(3) : 0;

  // Calibrated 4-part littoral macrophyte score (0..1):
  // 1) emergentCoverSubscore (0.30): 1.0 when >= 40% of the shallow littoral belt has emergent sedge/horsetail/bulrush stems (Mäkelä et al. 2004: 35-75%)
  // 2) floatingCoverSubscore (0.25): 1.0 when >= 16% of the outer littoral water band has floating lily pads / emergent tops (Mäkelä et al. 2004: 15-55%)
  // 3) interleavedWaterSubscore (0.25): 1.0 when >= 85% of water-bearing vertical columns also contain macrophyte pixels
  // 4) verticalCulmSubscore (0.20): 1.0 when upright emergent stems produce horizontal/vertical gradient ratio dX/dY >= 1.05
  const openWaterGate = clamp01((openWaterShare - 0.08) / 0.08);
  const emergentCoverSubscore = clamp01(emergentCoverShare / 0.40);
  const floatingCoverSubscore = clamp01(floatingCoverShare / 0.16);
  const interleavedWaterSubscore = clamp01(interleavedColumnShare / 0.85);
  const verticalCulmSubscore = emPlant >= 20 ? clamp01((verticalCulmRatio - 0.45) / 0.60) : 0;
  const rawScore = 0.30 * emergentCoverSubscore + 0.25 * floatingCoverSubscore + 0.25 * interleavedWaterSubscore + 0.20 * verticalCulmSubscore;
  const calibratedScore = +(openWaterGate * rawScore).toFixed(3);

  return {
    emergentCoverShare,
    floatingCoverShare,
    openWaterShare,
    interleavedColumnShare,
    verticalCulmRatio,
    yellowFlowerCells: yellowFlowers,
    emergentCoverSubscore: +emergentCoverSubscore.toFixed(3),
    floatingCoverSubscore: +floatingCoverSubscore.toFixed(3),
    interleavedWaterSubscore: +interleavedWaterSubscore.toFixed(3),
    verticalCulmSubscore: +verticalCulmSubscore.toFixed(3),
    calibratedScore,
  };
}

const results = {
  metric: 'littoralMacrophyteScore = openWaterGate * (0.30 * emergentCoverSubscore + 0.25 * floatingCoverSubscore + 0.25 * interleavedWaterSubscore + 0.20 * verticalCulmSubscore)',
  calibration: {
    knownMatch_natureReference: measureLittoralFrame('refs/water/reference/t0025-littoral.png', {
      emergentBox: [80, 360, 1200, 620],
      floatingBox: [80, 260, 1200, 380],
      lakeBox: [80, 190, 1200, 520],
      wolfBox: null,
      allowMirrorWater: true,
    }),
    knownMismatch_preFixBareWaterNoon0: measureLittoralFrame('refs/water/shore-audit/noon-0.png', {
      emergentBox: [260, 305, 1180, 350],
      floatingBox: [260, 285, 1180, 315],
      lakeBox: [260, 280, 1180, 350],
    }),
    knownMismatch_preFixBareWaterWade2: measureLittoralFrame('refs/water/shore-audit/wade-2.png', {
      emergentBox: [260, 300, 1180, 380],
      floatingBox: [260, 275, 1180, 320],
      lakeBox: [260, 275, 1180, 380],
    }),
    knownMismatch_inlandUplandRidge: measureLittoralFrame('refs/rocks/shield-audit/upland-ridge-0.png', {
      emergentBox: [260, 305, 1180, 350],
      floatingBox: [260, 285, 1180, 315],
      lakeBox: [260, 280, 1180, 350],
    }),
  },
  gameLittoral_noon0: measureLittoralFrame('refs/water/littoral-audit/noon-0.png', {
    emergentBox: [260, 305, 1180, 350],
    floatingBox: [260, 285, 1180, 315],
    lakeBox: [260, 280, 1180, 350],
  }),
  gameLittoral_wade2: measureLittoralFrame('refs/water/littoral-audit/wade-2.png', {
    emergentBox: [260, 300, 1180, 380],
    floatingBox: [260, 275, 1180, 320],
    lakeBox: [260, 275, 1180, 380],
  }),
  gameLittoral_wade4: measureLittoralFrame('refs/water/littoral-audit/wade-4.png', {
    emergentBox: [260, 300, 1180, 440],
    floatingBox: [260, 275, 1180, 350],
    lakeBox: [260, 275, 1180, 440],
  }),
  gameLittoral_wadeStop0: measureLittoralFrame('refs/water/littoral-audit/wade-stop-0.png', {
    emergentBox: [260, 290, 1180, 520],
    floatingBox: [260, 275, 1180, 480],
    lakeBox: [260, 275, 1180, 520],
  }),
  gameLittoral_littoralClose0: measureLittoralFrame('refs/water/littoral-audit/littoral-close-0.png', {
    emergentBox: [260, 295, 1180, 420],
    floatingBox: [260, 275, 1180, 335],
    lakeBox: [260, 275, 1180, 420],
  }),
};

writeFileSync('refs/water/littoral-audit/measure.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
