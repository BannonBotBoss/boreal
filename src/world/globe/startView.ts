/**
 * Where a page load opens (grok-globe, T-0034; Matthew 2026-10-22: "it should load the global view please"). A bare URL
 * opens the planet: entry.ts rewrites it in place to GLOBE_START (staged terrain, which the globe needs, and trees v2 for
 * the descent; both are read from the query at load) and main.ts goes straight into the in-page globe (inpage.enter).
 * Any explicit query keeps the ground view it always had: ?view=ground, ?at= (the globe's own handoff back), ?bench, and
 * every test flag. ?view=globe stays the standalone globe page (entry.ts).
 */
export const GLOBE_START = 'start=globe&stages=1&trees=v2';
export function startView(search: string): 'globe' | 'ground' {
  const q = new URLSearchParams(search);
  if (q.get('view') === 'ground' || q.has('at') || q.has('bench')) return 'ground';
  return q.get('start') === 'globe' || ![...q.keys()].length ? 'globe' : 'ground';
}
/** entry.ts: the in-place URL for a bare load, else null (any query is left alone) */
export const bareStart = (search: string) => [...new URLSearchParams(search).keys()].length ? null : `?${GLOBE_START}`;