/** Venus in the ground-view sky (sky.ts): a point light whose place (planets.ts, Kepler + JPL elements), brightness (Mallama &
 *  Hilton 2018) and visibility (skyVisibility.ts: extinction + Schaefer twilight sky vs the eye's threshold) are all computed.
 *  Date: ?date=YYYY-MM-DD (default: the game's day of year in 2026); the game hour is local solar time at SITE. ?hide=venus or the
 *  globe layer panel's stored choice turns it off. */
import * as THREE from 'three';
import { venusAt, sunAt, altAz } from '../core/planets';
import { visibility } from '../core/skyVisibility';
import { SITE } from '../core/weather';
import { parseHidden, STORE_KEY } from '../world/globe/layerPanel';

export function skyDate(search: string, dayOfYear: number) { const q = new URLSearchParams(search).get('date'); const d = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(`${q}T00:00:00Z`) : new Date(Date.UTC(2026, 0, dayOfYear)); return d; }
export const dayOfYearOf = (d: Date) => Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5) + 1;
/** UT instant for a local solar hour at SITE.lon on that date */
export const utOf = (d: Date, hour: number, lon = SITE.lon) => new Date(d.getTime() + (hour - lon / 15) * 3600e3);
export function venusSky(t: Date, lat = SITE.lat, lon = SITE.lon) {
  const v = venusAt(t), s = sunAt(t), a = altAz(v.ra, v.dec, t, lat, lon), b = altAz(s.ra, s.dec, t, lat, lon);
  return { venus: v, alt: a, sunAlt: b.elevation, vis: visibility(v.mag, 90 - a.elevation, b.elevation, v.elong) };
}
export function createVenus(scene: THREE.Scene, search = typeof location === 'undefined' ? '' : location.search) {
  let stored: string | null = null; try { stored = localStorage.getItem(STORE_KEY); } catch { /* none */ }
  const on = !parseHidden(search, stored).has('venus');
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const m = new THREE.PointsMaterial({ color: 0xfffbea, size: 3, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 1000; pts.visible = false; scene.add(pts); // after the sky domes, depth-tested so trees still occlude
  return { points: pts, update(date: Date, hour: number, camPos: THREE.Vector3, cam?: THREE.Camera) {
    if (!on) return null; const r = venusSky(utOf(date, hour)), d = r.alt.direction;
    // seen only when the source beats the threshold: opacity rises over 0..+0.7 dex of (I / I_th); size from apparent brightness
    const k = Math.max(0, Math.min(1, Math.log10(Math.max(1e-9, r.vis.ratio)) / 0.7));
    pts.visible = k > 0 && r.alt.elevation > 0; m.opacity = k; m.size = 2 + Math.max(0, -r.vis.mObs - 2);
    pts.position.set(camPos.x + d.x * 500, camPos.y + d.y * 500, camPos.z + d.z * 500);
    if (typeof window !== 'undefined' && search.includes('rec')) (window as unknown as Record<string, unknown>).__venus = { alt: r.alt.elevation, az: r.alt.azimuth, sunAlt: r.sunAlt, ratio: r.vis.ratio, mObs: r.vis.mObs, visible: pts.visible, opacity: m.opacity, size: m.size, ndc: cam ? pts.position.clone().project(cam).toArray() : null };
    return r; } };
}
