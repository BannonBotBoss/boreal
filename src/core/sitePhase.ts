/**
 * Where the forest's local origin sits on the planet (issue #156, bridge lane).
 *
 * The playable world is one local frame. At home that frame is Kenora and every
 * field below stays at its default, so the wolf's ground does not move. A
 * double-click off that square fills the frame from the clicked direction.
 * Weather, the tree line and the chunk salt then read this frame. The landscape
 * generators themselves stay the ones already in the repo.
 */
export type SiteVec = [number, number, number];

export const SITE = {
  remote: false,
  latDeg: Number.NaN,
  lonDeg: Number.NaN,
  /** Metres above sea level of game height 0. NaN means the home datum. */
  datumM: Number.NaN,
  /** Mixed into chunk seeds only when remote, so the home digest does not change. */
  salt: 0,
  dir: [0, 1, 0] as SiteVec,
  east: [1, 0, 0] as SiteVec,
  north: [0, 0, 1] as SiteVec,
};

export function siteLatitude(homeLat: number) {
  return Number.isFinite(SITE.latDeg) ? SITE.latDeg : homeLat;
}
export function siteDatum(homeDatum: number) {
  return Number.isFinite(SITE.datumM) ? SITE.datumM : homeDatum;
}
export function siteSalt() { return SITE.remote ? SITE.salt : 0; }

export function clearSite() {
  SITE.remote = false;
  SITE.latDeg = Number.NaN;
  SITE.lonDeg = Number.NaN;
  SITE.datumM = Number.NaN;
  SITE.salt = 0;
}

export function setSite(s: { latDeg: number; lonDeg: number; datumM: number; salt: number; dir: SiteVec; east: SiteVec; north: SiteVec }) {
  SITE.remote = true;
  SITE.latDeg = s.latDeg;
  SITE.lonDeg = s.lonDeg;
  SITE.datumM = s.datumM;
  SITE.salt = s.salt >>> 0;
  SITE.dir = s.dir;
  SITE.east = s.east;
  SITE.north = s.north;
}

/** Gnomonic, same construction as planet.fromLocal: game +x east, game −z north. */
export function siteDirection(x: number, z: number, radius: number): SiteVec {
  const d = SITE.dir, e = SITE.east, n = SITE.north;
  const x0 = d[0] + (e[0] * x - n[0] * z) / radius;
  const y0 = d[1] + (e[1] * x - n[1] * z) / radius;
  const z0 = d[2] + (e[2] * x - n[2] * z) / radius;
  const l = Math.hypot(x0, y0, z0) || 1;
  return [x0 / l, y0 / l, z0 / l];
}
