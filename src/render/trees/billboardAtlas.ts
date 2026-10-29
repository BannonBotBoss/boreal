/**
 * Tree impostors for the mid-distance ring (issue #156).
 * Two sprites in one atlas: a conifer and a broadleaf. Drawn into pixels here so a test
 * can check the silhouette without a canvas. The game uploads that buffer as a texture.
 * Alpha is 0 outside the crown, so the material can alpha-test (and alpha-to-coverage)
 * instead of drawing a solid rectangle.
 */

export type TreeKind = 'conifer' | 'broadleaf';

const SIZE = 64;

function put(rgba: Uint8ClampedArray, size: number, x: number, y: number, r: number, g: number, b: number, a: number) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
}

/** One sprite. Origin is the top-left. The crown is lit from the left, the way a morning sun reads on a billboard. */
export function treeSprite(kind: TreeKind, size = SIZE): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const cx = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sun = 0.72 + 0.5 * (1 - x / (size - 1));
      // Pixel y = 0 is the bottom of the billboard (three's v = 0, DataTexture flipY off).
      const trunk = Math.abs(x - cx) <= size * 0.045 && y < size * 0.38;
      let crown = false;
      if (kind === 'conifer') {
        const fromTop = (size - 1 - y) / (size * 0.78);
        const half = (1 - fromTop) * size * 0.42;
        crown = fromTop > 0.02 && fromTop < 1 && Math.abs(x - cx) <= half;
      } else {
        const nx = (x - cx) / (size * 0.36);
        const ny = (y - size * 0.58) / (size * 0.30);
        crown = nx * nx + ny * ny <= 1;
      }
      if (trunk) put(rgba, size, x, y, Math.round(48 * sun), Math.round(32 * sun), Math.round(18 * sun), 255);
      else if (crown) {
        const shade = kind === 'conifer' ? [38, 72, 34] : [58, 92, 36];
        put(rgba, size, x, y, Math.min(255, Math.round(shade[0] * sun)), Math.min(255, Math.round(shade[1] * sun)), Math.min(255, Math.round(shade[2] * sun)), 255);
      }
    }
  }
  return rgba;
}

/** Conifer in the left half, broadleaf in the right. Width is twice the sprite. */
export function treeAtlas(size = SIZE) {
  const w = size * 2, h = size;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const conifer = treeSprite('conifer', size);
  const broad = treeSprite('broadleaf', size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = (y * size + x) * 4;
      const L = (y * w + x) * 4;
      const R = (y * w + x + size) * 4;
      rgba.set(conifer.subarray(s, s + 4), L);
      rgba.set(broad.subarray(s, s + 4), R);
    }
  }
  return { rgba, w, h, size };
}

/**
 * Top-down closed canopy. Crowns overlap so a repeat reads as forest, not a few dots.
 * The greens are the impostor leaf colour, not a grade of the satellite.
 */
export function canopyTile(size = 64): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(size * size * 4);
  const crowns: [number, number, number][] = [];
  for (let i = 0; i < 42; i++) {
    const cx = (i * 13) % size;
    const cy = (i * 23) % size;
    crowns.push([cx, cy, 8 + (i % 5)]);
  }
  for (const [cx, cy, rad] of crowns) {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = Math.min(Math.abs(x - cx), size - Math.abs(x - cx));
      const dy = Math.min(Math.abs(y - cy), size - Math.abs(y - cy));
      const d = Math.hypot(dx, dy) / rad;
      if (d > 1) continue;
      const a = Math.round(230 * (1 - d * d));
      const i = (y * size + x) * 4;
      if (rgba[i + 3] >= a) continue;
      const shade = 0.75 + 0.35 * (1 - d);
      rgba[i] = Math.round(46 * shade);
      rgba[i + 1] = Math.round(108 * shade);
      rgba[i + 2] = Math.round(42 * shade);
      rgba[i + 3] = a;
    }
  }
  return rgba;
}
