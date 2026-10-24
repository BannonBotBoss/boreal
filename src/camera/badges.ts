/** Camera entitlements. Basic auto photos are always free; manual exposure and filters are badge-gated per control.
 *  TODO(badges): replace this stub with the badge entitlement API when it lands on main. Until then everything is allowed;
 *  ?unlockAll=1 (dev) forces allowed even after the real API is wired. */
export type CameraBadge = 'camera.exposure' | 'camera.filters';
export const FREE = ['camera.auto', 'camera.shutter'] as const;
export function hasBadge(id: CameraBadge | typeof FREE[number], search = typeof location === 'undefined' ? '' : location.search): boolean {
  if ((FREE as readonly string[]).includes(id)) return true;
  if (new URLSearchParams(search).get('unlockAll') === '1') return true;
  const api = (globalThis as { borealBadges?: { has(id: string): boolean } }).borealBadges; // the future API, if present
  return api ? api.has(id) : true; // stub default: allowed
}
