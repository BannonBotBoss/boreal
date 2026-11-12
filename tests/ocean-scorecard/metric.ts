/**
 * Rough first ocean scorecard.
 *
 * Each element is scored on its own, from 0 to 100. An element passes only at
 * 75 or above. The average of the elements is written down for information.
 * That average never decides a pass.
 *
 * TODO: a vision model should later judge whether these pictures look like the
 * reference photos. This file only measures colour distance, how much of the
 * disc reads as ocean, and how strong the bright glint tail is.
 */

export const PASS_MARK = 75;

/** A difference of 20 CIEDE2000 units between average ocean colours scores 0. */
export const COLOR_DE_RANGE = 20;

export type RgbaImage = { width: number; height: number; rgba: Uint8Array };

export type Rgb = { r: number; g: number; b: number };

export type ElementId = 'ocean-color-orbit' | 'ocean-fraction' | 'sunglint' | 'open-water-color';

export type ElementScore = {
  id: ElementId;
  name: string;
  /** Null when the pictures needed for this element were not available. */
  score: number | null;
  pass: boolean;
  rule: string;
  /** Plain-language reading of the number. */
  summary: string;
  detail: Record<string, number | string | boolean | null>;
};

export type Scorecard = {
  title: string;
  roughFirstMetric: true;
  visionModel: 'TODO';
  passMark: number;
  passRule: string;
  passed: boolean;
  /** Informational only. Never a pass by itself. */
  composite: number | null;
  compositeNote: string;
  elements: ElementScore[];
  calibration: { knownMatch: number; knownMismatch: number; note: string };
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

export function luminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function at(img: RgbaImage, x: number, y: number): Rgb {
  const i = (y * img.width + x) * 4;
  return { r: img.rgba[i], g: img.rgba[i + 1], b: img.rgba[i + 2] };
}

/** A photo of a planet in black space has dark corners. A sea photo fills the frame. */
export function framedInSpace(img: RgbaImage) {
  const pts: [number, number][] = [[0, 0], [img.width - 1, 0], [0, img.height - 1], [img.width - 1, img.height - 1]];
  let dark = 0;
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
    const p = at(img, x, y);
    if (luminance(p.r, p.g, p.b) < 14) dark++;
  }
  return dark >= 3;
}

/** Centre and radius of the lit planet. Radius 0 means the picture is not a disc in space. */
export function fitDisc(img: RgbaImage) {
  if (!framedInSpace(img)) return { cx: img.width / 2, cy: img.height / 2, r: 0, disc: false };
  let n = 0, sx = 0, sy = 0, maxR = 0;
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const p = at(img, x, y);
    if (luminance(p.r, p.g, p.b) > 16) { n++; sx += x; sy += y; xs.push(x); ys.push(y); }
  }
  if (n < 40) return { cx: img.width / 2, cy: img.height / 2, r: 0, disc: false };
  const cx = sx / n, cy = sy / n;
  for (let k = 0; k < xs.length; k++) maxR = Math.max(maxR, Math.hypot(xs[k] - cx, ys[k] - cy));
  // Stay inside the bright atmospheric rim so the rim is not counted as ocean.
  return { cx, cy, r: maxR * 0.92, disc: true };
}

type Kind = 'space' | 'night' | 'cloud' | 'ocean' | 'land';

function kindOf(p: Rgb, inside: boolean): Kind {
  if (!inside) return 'space';
  const L = luminance(p.r, p.g, p.b);
  if (L >= 175 && saturation(p.r, p.g, p.b) < 0.28) return 'cloud';
  const blue = p.b > p.r + 4 && p.b + 12 >= p.g && p.b > 14 && L >= 6 && L < 210;
  const greenLand = p.g > p.b + 12 && p.g > p.r;
  const brown = p.r > p.b + 18 && p.r > 50 && p.g > p.b;
  if (blue && !greenLand && !brown) return 'ocean';
  if (L < 10) return 'night';
  return 'land';
}

export type OceanRead = {
  disc: boolean;
  pixels: number;
  ocean: number;
  /** Ocean pixels divided by pixels on the disc (or in the frame). Clouds stay in the denominator. */
  oceanShare: number;
  mean: Rgb | null;
  /** Bright-tail strength inside the water. About 1 when the water is even. Higher when a glint or another bright streak is present. */
  glintStrength: number;
};

export function readOcean(img: RgbaImage, band?: { y0: number; y1: number }): OceanRead {
  const disc = fitDisc(img);
  const y0 = Math.floor((band?.y0 ?? 0) * img.height);
  const y1 = Math.ceil((band?.y1 ?? 1) * img.height);
  let pixels = 0, ocean = 0;
  let sr = 0, sg = 0, sb = 0, sunlit = 0, sunR = 0, sunG = 0, sunB = 0;
  const waterL: number[] = [];
  const glintL: number[] = [];
  for (let y = y0; y < y1; y++) for (let x = 0; x < img.width; x++) {
    const inside = !disc.disc || Math.hypot(x - disc.cx, y - disc.cy) <= disc.r;
    if (!inside) continue;
    pixels++;
    const p = at(img, x, y);
    const k = kindOf(p, true);
    const L = luminance(p.r, p.g, p.b);
    if (k === 'ocean') {
      ocean++;
      sr += p.r; sg += p.g; sb += p.b;
      waterL.push(L);
      if (L >= 25) { sunlit++; sunR += p.r; sunG += p.g; sunB += p.b; }
    } else if (L >= 145 && saturation(p.r, p.g, p.b) < 0.45 && p.b + 20 >= p.r && p.b + 20 >= p.g) {
      glintL.push(L);
    }
  }
  const useSun = sunlit >= 30;
  const mean = ocean === 0 ? null : useSun
    ? { r: sunR / sunlit, g: sunG / sunlit, b: sunB / sunlit }
    : { r: sr / ocean, g: sg / ocean, b: sb / ocean };
  waterL.sort((a, b) => a - b);
  const pool = waterL.concat(glintL).sort((a, b) => a - b);
  const med = percentile(waterL, 0.5);
  const p98 = percentile(pool, 0.98);
  const glintStrength = waterL.length < 20 ? 0 : p98 / Math.max(med, 1);
  return {
    disc: disc.disc,
    pixels,
    ocean,
    oceanShare: pixels ? ocean / pixels : 0,
    mean,
    glintStrength,
  };
}

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function srgbToLinear(c: number) {
  const u = c / 255;
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
}

/** CIE Lab, D65. Channels are 0–255 sRGB. */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const x = R * 0.4124564 + G * 0.3575761 + B * 0.1804375;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;
  const Xn = 0.95047, Yn = 1, Zn = 1.08883;
  const f = (t: number) => t > 216 / 24389 ? Math.cbrt(t) : t * (841 / 108) + 4 / 29;
  const fx = f(x / Xn), fy = f(y / Yn), fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/**
 * CIEDE2000 colour difference (Sharma, Wu, Dalal 2005).
 * About 1 is a just-noticeable difference. Larger means the colours disagree more.
 */
export function ciede2000(lab1: [number, number, number], lab2: [number, number, number]) {
  const [L1, a1, b1] = lab1, [L2, a2, b2] = lab2;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const C7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (ap: number, b: number, C: number) => {
    if (C < 1e-8) return 0;
    let h = Math.atan2(b, ap) * 180 / Math.PI;
    if (h < 0) h += 360;
    return h;
  };
  const h1 = hp(a1p, b1, C1p), h2 = hp(a2p, b2, C2p);
  const dL = L2 - L1, dC = C2p - C1p;
  let dh = 0;
  if (C1p > 1e-8 && C2p > 1e-8) {
    dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
  }
  const dH = 2 * Math.sqrt(C1p * C2p) * Math.sin((dh * Math.PI / 180) / 2);
  const Lbar = (L1 + L2) / 2, Cp = (C1p + C2p) / 2;
  let Hbar = h1 + h2;
  if (C1p < 1e-8 || C2p < 1e-8) Hbar = h1 + h2;
  else if (Math.abs(h1 - h2) > 180) Hbar = h1 + h2 < 360 ? (h1 + h2 + 360) / 2 : (h1 + h2 - 360) / 2;
  else Hbar = (h1 + h2) / 2;
  const T = 1 - 0.17 * Math.cos((Hbar - 30) * Math.PI / 180) + 0.24 * Math.cos((2 * Hbar) * Math.PI / 180)
    + 0.32 * Math.cos((3 * Hbar + 6) * Math.PI / 180) - 0.20 * Math.cos((4 * Hbar - 63) * Math.PI / 180);
  const dTheta = 30 * Math.exp(-(((Hbar - 275) / 25) ** 2));
  const Cp7 = Cp ** 7;
  const Rc = 2 * Math.sqrt(Cp7 / (Cp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cp;
  const Sh = 1 + 0.015 * Cp * T;
  const Rt = -Math.sin(2 * dTheta * Math.PI / 180) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

export function colorDistance(a: Rgb, b: Rgb) {
  return ciede2000(rgbToLab(a.r, a.g, a.b), rgbToLab(b.r, b.g, b.b));
}

/** 100 when the average ocean colours match. 0 when they are COLOR_DE_RANGE apart. */
export function scoreColorDistance(deltaE: number) {
  return round1(clamp(100 * (1 - deltaE / COLOR_DE_RANGE), 0, 100));
}

/** 100 when the shares match. The pass line is a share within 25% of the reference share. */
export function scoreShare(game: number, ref: number) {
  return round1(clamp(100 * (1 - Math.abs(game - ref) / Math.max(ref, 0.05)), 0, 100));
}

/** 100 when the glint strengths match. */
export function scoreGlint(game: number, ref: number) {
  return round1(clamp(100 * (1 - Math.abs(game - ref) / Math.max(ref, 0.25)), 0, 100));
}

function paint(width: number, height: number, fill: (x: number, y: number) => Rgb): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = fill(x, y);
    const i = (y * width + x) * 4;
    rgba[i] = p.r; rgba[i + 1] = p.g; rgba[i + 2] = p.b; rgba[i + 3] = 255;
  }
  return { width, height, rgba };
}

/** A known match (the same picture twice) and a known mismatch (blue water against brown). */
export function calibrate() {
  const ocean = paint(32, 32, (x, y) => (x < 2 || y < 2 || x > 29 || y > 29) ? { r: 0, g: 0, b: 0 } : { r: 20, g: 70, b: 140 });
  const a = readOcean(ocean);
  const blue = a.mean ?? { r: 20, g: 70, b: 140 };
  const match = scoreColorDistance(colorDistance(blue, blue));
  // Brown is not an ocean colour, so compare the blue average to that brown directly.
  const mismatch = scoreColorDistance(colorDistance(blue, { r: 140, g: 90, b: 40 }));
  return {
    knownMatch: match,
    knownMismatch: mismatch,
    note: 'Calibration uses made-up pictures, not the game. The same blue disc scores 100 against itself. A brown disc against that blue scores low. A real photo is not a perfect score by itself.',
  };
}

const RULE = `Each element passes on its own at ${PASS_MARK}% or higher. The average never passes anything.`;

function colorElement(id: ElementId, name: string, game: OceanRead | null, refs: { label: string; read: OceanRead }[], what: string): ElementScore {
  const means = refs.map(r => r.read.mean).filter((m): m is Rgb => m != null);
  if (!game || means.length === 0) {
    return { id, name, score: null, pass: false, rule: RULE, summary: 'Not measured. A picture was missing.', detail: { measured: false } };
  }
  if (!game.mean) {
    return { id, name, score: 0, pass: false, rule: RULE, summary: `${what} No ocean-coloured pixels were found in the game picture, so this scores 0. This is a rough first metric.`, detail: { measured: true, oceanPixels: game.ocean, deltaE: null } };
  }
  const distances = refs.filter(r => r.read.mean).map(r => ({
    label: r.label,
    deltaE: round1(colorDistance(game.mean!, r.read.mean!)),
  }));
  const deltaE = distances.reduce((s, d) => s + d.deltaE, 0) / distances.length;
  const score = scoreColorDistance(deltaE);
  const gameMean = `${Math.round(game.mean.r)}, ${Math.round(game.mean.g)}, ${Math.round(game.mean.b)}`;
  return {
    id, name, score, pass: score >= PASS_MARK, rule: RULE,
    summary: `${what} The average ocean colour in the game is RGB ${gameMean}. The colour distance (CIEDE2000) is ${round1(deltaE)}. A distance of 0 would score 100. A distance of ${COLOR_DE_RANGE} scores 0. This is a rough first metric.`,
    detail: {
      deltaE: round1(deltaE),
      gameR: round1(game.mean.r), gameG: round1(game.mean.g), gameB: round1(game.mean.b),
      comparisons: distances.map(d => `${d.label} ΔE ${d.deltaE}`).join('; '),
      roughFirstMetric: true,
    },
  };
}

export type ScoreInputs = {
  orbit?: RgbaImage | null;
  /** Apollo 17 full disc. Ocean colour and ocean share. */
  apollo?: RgbaImage | null;
  /** Western-hemisphere Blue Marble. Ocean colour. */
  pacific?: RgbaImage | null;
  /** Regional view that might show sunglint. */
  glintView?: RgbaImage | null;
  sunglint?: RgbaImage | null;
  /** Closer look at open water. */
  close?: RgbaImage | null;
  caribbean?: RgbaImage | null;
};

export function buildScorecard(input: ScoreInputs): Scorecard {
  const orbit = input.orbit ? readOcean(input.orbit) : null;
  const apollo = input.apollo ? readOcean(input.apollo) : null;
  const pacific = input.pacific ? readOcean(input.pacific) : null;
  const glintView = input.glintView ? readOcean(input.glintView) : null;
  const sunglint = input.sunglint ? readOcean(input.sunglint) : null;
  // The Caribbean frame is open water under a band of sky. Use the lower part.
  const close = input.close ? readOcean(input.close, { y0: 0.35, y1: 1 }) : null;
  const caribbean = input.caribbean ? readOcean(input.caribbean, { y0: 0.42, y1: 1 }) : null;

  const colorRefs = [
    apollo ? { label: 'Apollo 17', read: apollo } : null,
    pacific ? { label: 'Blue Marble Pacific', read: pacific } : null,
  ].filter((x): x is { label: string; read: OceanRead } => x != null);

  const color = colorElement(
    'ocean-color-orbit',
    'Ocean colour from orbit',
    orbit,
    colorRefs,
    'Compared with the Apollo 17 Blue Marble and the Pacific Blue Marble.',
  );

  let fraction: ElementScore;
  if (!orbit || !apollo || apollo.oceanShare <= 0) {
    fraction = { id: 'ocean-fraction', name: 'Ocean share of the full disc', score: null, pass: false, rule: RULE, summary: 'Not measured. The orbital picture or the Apollo reference was missing.', detail: { measured: false } };
  } else {
    const score = scoreShare(orbit.oceanShare, apollo.oceanShare);
    fraction = {
      id: 'ocean-fraction',
      name: 'Ocean share of the full disc',
      score, pass: score >= PASS_MARK, rule: RULE,
      summary: `In the game picture, ${round1(orbit.oceanShare * 100)}% of the disc reads as ocean. In the Apollo 17 photo, ${round1(apollo.oceanShare * 100)}% does. Clouds count as part of the disc, so this is lower than the whole-Earth ocean share of about 71%. Earth's land is about 29.2% (ETOPO1). This is a rough first metric.`,
      detail: {
        gameShare: round1(orbit.oceanShare),
        apolloShare: round1(apollo.oceanShare),
        pacificShare: pacific ? round1(pacific.oceanShare) : null,
        earthOceanShare: 0.708,
        gameOceanPixels: orbit.ocean,
        gameDiscPixels: orbit.pixels,
        roughFirstMetric: true,
      },
    };
  }

  let glint: ElementScore;
  if (!glintView || !sunglint || sunglint.glintStrength <= 0) {
    glint = { id: 'sunglint', name: 'Sunglint', score: null, pass: false, rule: RULE, summary: 'Not measured. The glint view or the Aegean reference was missing.', detail: { measured: false } };
  } else {
    const score = scoreGlint(glintView.glintStrength, sunglint.glintStrength);
    glint = {
      id: 'sunglint',
      name: 'Sunglint',
      score, pass: score >= PASS_MARK, rule: RULE,
      summary: `Sunglint strength in the game view is ${round1(glintView.glintStrength)}. In the Aegean NASA photo it is ${round1(sunglint.glintStrength)}. Strength is the bright end of the water divided by the typical water brightness. About 1 means flat water. Higher means a bright streak. Clouds and the printed labels on the NASA photo can raise the same number. This is a rough first metric.`,
      detail: {
        gameStrength: round1(glintView.glintStrength),
        referenceStrength: round1(sunglint.glintStrength),
        roughFirstMetric: true,
        labelsCanInflateReference: true,
      },
    };
  }

  const surface = colorElement(
    'open-water-color',
    'Open-water surface colour',
    close,
    caribbean ? [{ label: 'Caribbean open water', read: caribbean }] : [],
    'Compared with the Caribbean deep-blue open-water photo, using the lower part of that photo so the sky is left out.',
  );

  const elements = [color, fraction, glint, surface];
  const nums = elements.map(e => e.score).filter((s): s is number => s != null);
  const composite = nums.length ? round1(nums.reduce((s, n) => s + n, 0) / nums.length) : null;
  return {
    title: 'Boreal ocean scorecard (rough first metric)',
    roughFirstMetric: true,
    visionModel: 'TODO',
    passMark: PASS_MARK,
    passRule: RULE,
    passed: elements.every(e => e.pass),
    composite,
    compositeNote: 'The average is for information only. It cannot pass the scorecard. Every element has to reach 75 on its own.',
    elements,
    calibration: calibrate(),
  };
}
