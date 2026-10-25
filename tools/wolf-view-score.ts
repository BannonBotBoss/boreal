/**
 * Wolf-view score (T-0075, issue #52).
 *
 * wolf-frame v1 — where the follow camera puts the wolf, compared with measurements on the issue image.
 *   Reference image 1024×559 (https://github.com/BannonBotBoss/boreal/issues/52, asset 026b54d0).
 *   Warm pixels (r > g+18 and r > b+25) centroid at image (0.52, 0.74): the tan of the lower body / ground contact.
 *   NDC (y up): x = 0.04, y = -0.48. That point is the score's body target, 0.55 m above the paws (between withers
 *   and elbow). A rear three-quarter is 25–45° off the tail (0° dead astern, 90° side-on).
 *   Score = mean of three clamped ratios (horizontal, vertical, bearing). 1 is the measured target.
 *
 * box-histogram v1 — intersection of 8³ sRGB histograms inside a frame box. Identical images score 1. A flat colour
 *   against the reference scores near 0. Used on the headless game frame versus the issue image; it does not pass
 *   the 0.95 gate unless the measured number does.
 */
import * as THREE from 'three';
import { execFileSync } from 'node:child_process';
import { heightAt } from '../src/core/world';
import { DEFAULT_PITCH, RIDER_FLANK, RIDER_HEIGHT, positionCamera } from '../src/render/math';

export const WOLF_FRAME = {
  /** image fraction of the warm-pixel centroid on issue #52 (x is 0.02 off centre; the follow view centres the animal) */
  imageX: 0.52, imageY: 0.74,
  /** body point the centroid stands for, metres above the paws */
  bodyM: 0.55,
  ndcX: 0, ndcY: -0.48,
  /** rear three-quarter band, degrees off the tail axis */
  bearingMin: 25, bearingMax: 45,
  fov: 48,
  aspect: 1024 / 559,
};

export interface FrameSample { ndcX: number; ndcY: number; bearingDeg: number; withersNdcY: number }

/** Project the body point through the live follow camera. */
export function frameSample(altitude = RIDER_HEIGHT, yaw = 0, pitch = DEFAULT_PITCH, aspect = WOLF_FRAME.aspect): FrameSample {
  const camera = new THREE.PerspectiveCamera(WOLF_FRAME.fov, aspect, .2, 700);
  positionCamera(camera, 0, 0, altitude, yaw, pitch, 0);
  const ground = Math.max(heightAt(0, 0), -.2);
  const body = new THREE.Vector3(0, ground + WOLF_FRAME.bodyM, 0).project(camera);
  const withers = new THREE.Vector3(0, ground + .82, 0).project(camera);
  const dx = camera.position.x, dz = camera.position.z;
  return { ndcX: body.x, ndcY: body.y, bearingDeg: Math.atan2(dx, dz) * 180 / Math.PI, withersNdcY: withers.y };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** wolf-frame v1. A sample that lands on the measured target scores 1. */
export function framingScore(s: FrameSample, target = WOLF_FRAME): number {
  const x = clamp01(1 - Math.abs(s.ndcX - target.ndcX) / .35);
  const y = clamp01(1 - Math.abs(s.ndcY - target.ndcY) / .35);
  const mid = (target.bearingMin + target.bearingMax) / 2, half = (target.bearingMax - target.bearingMin) / 2;
  const bearing = clamp01(1 - Math.max(0, Math.abs(s.bearingDeg - mid) - half) / 25);
  return (x + y + bearing) / 3;
}

/** The chase camera before T-0075: 1.6 m up, 3 m dead astern, 10° down. Known mismatch for wolf-frame v1. */
export function legacyFrame(aspect = WOLF_FRAME.aspect): FrameSample {
  const camera = new THREE.PerspectiveCamera(WOLF_FRAME.fov, aspect, .2, 700);
  const ground = Math.max(heightAt(0, 0), -.2), pitch = 10 * Math.PI / 180, back = 3, alt = 1.6;
  camera.position.set(0, ground + alt, back);
  camera.lookAt(0, ground + alt - Math.sin(pitch), back - Math.cos(pitch));
  camera.updateMatrixWorld(true);
  const body = new THREE.Vector3(0, ground + WOLF_FRAME.bodyM, 0).project(camera);
  const withers = new THREE.Vector3(0, ground + .82, 0).project(camera);
  return { ndcX: body.x, ndcY: body.y, bearingDeg: 0, withersNdcY: withers.y };
}

const BINS = 8;
/** box-histogram v1. `rgb` is tightly packed sRGB bytes. Returns a normalised histogram. */
export function histogram(rgb: Uint8Array, bins = BINS): Float64Array {
  const h = new Float64Array(bins ** 3); let n = 0;
  for (let i = 0; i + 2 < rgb.length; i += 3) {
    const r = Math.min(bins - 1, (rgb[i] * bins) >> 8), g = Math.min(bins - 1, (rgb[i + 1] * bins) >> 8), b = Math.min(bins - 1, (rgb[i + 2] * bins) >> 8);
    h[r + bins * (g + bins * b)]++; n++;
  }
  if (n) for (let i = 0; i < h.length; i++) h[i] /= n;
  return h;
}
/** Intersection of two normalised histograms. Identical histograms score 1. */
export function histogramIntersection(a: Float64Array, b: Float64Array): number {
  let s = 0; const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += Math.min(a[i], b[i]);
  return s;
}

/** Decode a PNG/JPEG to rgb24 via ffmpeg, then the histogram of one box (fractions of width and height). */
export function boxHistogram(path: string, box = { x0: .30, y0: .45, x1: .75, y1: .95 }): Float64Array {
  const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path], { encoding: 'utf8' }).trim();
  const [w, h] = probe.split(',').map(Number);
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: w * h * 3 + 1024 });
  const x0 = Math.floor(box.x0 * w), x1 = Math.floor(box.x1 * w), y0 = Math.floor(box.y0 * h), y1 = Math.floor(box.y1 * h);
  const crop = new Uint8Array((x1 - x0) * (y1 - y0) * 3);
  let o = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const i = (y * w + x) * 3; crop[o++] = raw[i]; crop[o++] = raw[i + 1]; crop[o++] = raw[i + 2];
  }
  return histogram(crop);
}

const cli = process.argv[1]?.endsWith('wolf-view-score.ts');
if (cli && process.argv.includes('--score')) {
  const box = { x0: .30, y0: .45, x1: .75, y1: .95 };
  const paths = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const live = frameSample();
  const rows = paths.map(p => ({ path: p, boxHistogram: histogramIntersection(boxHistogram(paths[0], box), boxHistogram(p, box)) }));
  console.log(JSON.stringify({
    metric: 'wolf-frame v1', sample: live, score: framingScore(live), legacy: framingScore(legacyFrame()),
    box, histogram: 'box-histogram v1', rows,
  }, null, 2));
}
