/**
 * Earth from particles (T-0070 stage 6). Draws the baked parcels of rust/boreal-sim/src/formation.rs: equal-mass parcels drawn
 * from PREM's mass distribution and relaxed by SPH with self-gravity and spin until they stop moving. No sphere is placed; the
 * figure, radius and surface gravity in the readout are measured from the parcels (public/bake/earth-parcels.json).
 * Bake layout: per parcel x, y, z (m, from the centre of mass, spin axis +z), PREM layer, SPH density (kg/m^3), h (m); f32.
 * Render: one THREE.Points, a disc per parcel of radius h (its smoothing length), coloured by layer and shaded by density;
 * log depth and the axis clip plane so the cut shows the inside. 48k parcels x 24 B = 1.2 MB of VRAM (budget: < 1.5 GB).
 */
import * as THREE from 'three';
import { withLogDepth } from './logDepth';
import refFig from '../../../data/earth/reference-figure.json';

export interface ParcelBake { n: number; mass: number; r_vol: number; a?: number; c?: number; j2: number; f_clairaut?: number; inv_f?: number; f_shape?: number; moi: number; g_eq: number; g_pole: number; com_m: number; t_s: number; steps: number;
  /** Emergent boundaries (hot differentiation bakes, rust/boreal-sim/src/differentiation.rs). */
  separation?: number; cmb?: number; icb?: number; n_solid?: number; t_centre?: number; p_centre?: number; rho_centre?: number }
/** Default bake: the self-differentiated planet (bulk mix -> iron core, dunite mantle; no layer radii given). */
export const DEFAULT_BAKE = '/bake/earth-hot';
export const STRIDE = 6;
/** Sim frame (spin +z) to globe frame (spin +y), right-handed: (x, y, z) -> (x, z, -y). */
export function toGlobe(x: number, y: number, z: number): [number, number, number] { return [x, z, -y]; }
// PREM layers 0-4 (stage 6 bake), then the differentiation materials: 10 molten iron, 11 silicate (dunite), 12 solid iron
const RGB: Record<number, number[]> = { 0: [1, .85, .5], 1: [1, .55, .15], 2: [.75, .3, .15], 3: [.45, .38, .32], 4: [.1, .3, .7], 10: [1, .55, .15], 11: [.62, .42, .28], 12: [1, .9, .6] };

export function parcelPoints(buf: Float32Array, clip: THREE.Plane) {
  const n = buf.length / STRIDE, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
  for (let i = 0; i < n; i++) { const b = i * STRIDE, g = toGlobe(buf[b], buf[b + 1], buf[b + 2]); pos.set(g, i * 3);
    const c = RGB[buf[b + 3] | 0] ?? RGB[3], k = 0.75 + 0.25 * Math.min(1, buf[b + 4] / 13000); col.set([c[0] * k, c[1] * k, c[2] * k], i * 3); size[i] = buf[b + 5]; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('h', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ clipping: true, clippingPlanes: [clip], vertexColors: true, uniforms: { uH: { value: 450 } },
    vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
attribute float h; uniform float uH; varying vec3 vC; void main(){ vC = color; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
#include <clipping_planes_vertex>
 gl_Position = projectionMatrix * mvPosition; gl_PointSize = clamp(1.2 * h * projectionMatrix[1][1] * uH / -mvPosition.z, 1.5, 48.0); // a parcel's spacing ~1.2 h, projected (uH: half the drawing-buffer height)
#include <logdepthbuf_vertex>
}`,
    fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec3 vC; void main(){ vec2 d = gl_PointCoord - .5; float r = dot(d, d); if (r > .25) discard;
#include <clipping_planes_fragment>
 gl_FragColor = vec4(vC * (1.0 - 1.6 * r), 1.0);
#include <logdepthbuf_fragment>
}` });
  mat.onBeforeCompile = withLogDepth;
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; return pts;
}

export async function loadParcels(base = DEFAULT_BAKE): Promise<{ buf: Float32Array; meta: ParcelBake } | null> {
  try { const [b, j] = await Promise.all([fetch(base + '.bin'), fetch(base + '.json')]); if (!b.ok || !j.ok) return null;
    return { buf: new Float32Array(await b.arrayBuffer()), meta: await j.json() }; } catch { return null; }
}
/** Readout lines: measured vs real Earth (WGS84 / IERS 2010 / PREM). */
/** Measured Earth figure for comparison only (sources in the JSON). */
export const REAL = refFig;
export function parcelReadout(m: ParcelBake) { const pct = (x: number, r: number) => `${((x / r - 1) * 100).toFixed(2)} %`;
  return `parcels [${m.n} relaxed SPH parcels, ${(m.t_s / 3600).toFixed(1)} h settled]\n  M ${m.mass.toExponential(4)} kg (${pct(m.mass, REAL.mass)})  COM ${m.com_m.toExponential(1)} m` +
    `\n  R_vol ${(m.r_vol / 1e3).toFixed(1)} km (${pct(m.r_vol, REAL.rMean)})` + (m.a && m.c ? `  a ${(m.a / 1e3).toFixed(1)} c ${(m.c / 1e3).toFixed(1)} km` : '') +
    `\n  J2 ${m.j2.toExponential(3)} (${pct(m.j2, REAL.j2)})  1/f ${invF(m).toFixed(1)} (real ${REAL.invF})  C/MR² ${m.moi.toFixed(4)} (real ${REAL.moi})` +
    `\n  g eq ${m.g_eq.toFixed(3)} pole ${m.g_pole.toFixed(3)} m/s² (real ${REAL.gEq} / ${REAL.gPole})` +
    (m.cmb ? `\n  emerged: core-mantle ${(m.cmb / 1e3).toFixed(0)} km (PREM ${REAL.cmbKm})  inner core ${((m.icb ?? 0) / 1e3).toFixed(0)} km (PREM ${REAL.icbKm})  centre ${(m.t_centre ?? 0).toFixed(0)} K ${((m.p_centre ?? 0) / 1e9).toFixed(0)} GPa` : ''); }
export const invF = (m: ParcelBake) => m.inv_f ?? 1 / (m.f_clairaut ?? NaN);
