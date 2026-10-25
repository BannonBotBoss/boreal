/**
 * T-0006 gate scores (tasks/evidence/T-0006/measure.mjs and tests/contact.test.ts).
 * Position: 1 when the contact point sits on the ground, 0 at 5 cm of vertical error or more.
 * Timing: 1 when a pair that is already touching emits no further rising edges across an idle window.
 * Calibration is the pair of known cases in the test: a seated log scores 1, a point lifted by 1 m scores 0;
 * zero extra begins across 360 frames scores 1, one begin on every frame scores 0.
 */
export function contactPositionScore(verticalErrorM: number) {
  if (!Number.isFinite(verticalErrorM)) return 0;
  return Math.max(0, 1 - Math.abs(verticalErrorM) / 0.05);
}
export function contactTimingScore(extraBegins: number, frames: number) {
  if (!Number.isFinite(extraBegins) || !Number.isFinite(frames) || frames <= 0) return 0;
  return Math.max(0, 1 - extraBegins / frames);
}
