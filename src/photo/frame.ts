/** Capture framing maths (pure): crop rectangle, output-size presets, video clamp and tiling. */
export const RESOLUTIONS: Record<string, [number, number] | null> = {
  'Native': null, '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160], '8K (stills only)': [7680, 4320],
};
export const ASPECTS: Record<string, number | null> = { 'Screen': null, '16:9': 16 / 9, '3:2': 3 / 2, '4:3': 4 / 3, '1:1': 1, '21:9': 21 / 9, '9:16': 9 / 16 };
/** MediaRecorder stays smooth up to about 1080p in browsers; larger video is scaled down to fit this box. */
export const VIDEO_MAX: [number, number] = [1920, 1080];

/** Largest rectangle of `aspect` centred in the screen (the crop frame drawn over the viewport). */
export function cropRect(sw: number, sh: number, aspect: number | null) {
  if (!aspect) return { x: 0, y: 0, w: sw, h: sh };
  const w = Math.min(sw, sh * aspect), h = w / aspect;
  return { x: (sw - w) / 2, y: (sh - h) / 2, w, h };
}
/** Output size: the crop fitted inside the preset box (rotated for portrait crops), native density, or custom w×h. */
export function fitOutput(crop: { w: number; h: number }, preset: [number, number] | null, nativeScale: number, custom?: [number, number]) {
  if (custom) return { w: Math.round(custom[0]), h: Math.round(custom[1]) };
  if (!preset) return { w: Math.round(crop.w * nativeScale), h: Math.round(crop.h * nativeScale) };
  const aspect = crop.w / crop.h, [bw, bh] = aspect >= 1 ? preset : [preset[1], preset[0]], w = Math.min(bw, bh * aspect);
  return { w: Math.round(w), h: Math.round(w / aspect) };
}
export function clampVideo(w: number, h: number, [mw, mh] = VIDEO_MAX) {
  const s = Math.min(1, Math.max(mw, mh) / Math.max(w, h), Math.min(mw, mh) / Math.min(w, h));
  // even sizes for encoders
  return { w: Math.round(w * s / 2) * 2, h: Math.round(h * s / 2) * 2, clamped: s < 1 };
}
/** Tiles covering w×h with no tile larger than `max` on a side. */
export function tiles(w: number, h: number, max: number) {
  const out: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < h; y += max) for (let x = 0; x < w; x += max) out.push({ x, y, w: Math.min(max, w - x), h: Math.min(max, h - y) });
  return out;
}
