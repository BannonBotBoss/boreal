/**
 * Where a page load opens. A bare URL is the contest journey: the hot sphere cools, then the planet,
 * then the drop to the mama. entry.ts rewrites it in place to SPHERE_START so staged terrain and trees v2
 * are in the query before those modules read it. ?start=globe is the shortcut that skips the sphere and
 * opens the planet. Any other explicit query keeps the ground view: ?view=ground, ?at=, ?bench, and the
 * test flags. ?view=globe stays the standalone globe page (entry.ts).
 */
export const GLOBE_START = 'start=globe&stages=1&trees=v2';
export const SPHERE_START = 'start=sphere&stages=1&trees=v2';
export type StartView = 'sphere' | 'globe' | 'ground';
export function startView(search: string): StartView {
  const q = new URLSearchParams(search);
  if (q.get('view') === 'ground' || q.has('at') || q.has('bench')) return 'ground';
  if (q.get('start') === 'globe') return 'globe';
  if (q.get('start') === 'sphere' || ![...q.keys()].length) return 'sphere';
  return 'ground';
}
/** entry.ts: the in-place URL for a bare load, else null (any query is left alone) */
export const bareStart = (search: string) => [...new URLSearchParams(search).keys()].length ? null : `?${SPHERE_START}`;