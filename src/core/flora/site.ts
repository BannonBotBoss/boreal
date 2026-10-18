/**
 * Shared ground-flora ecology (Grok Bot): ONE site description and ONE placement process for every ground plant (grass blades,
 * flowers, shrubs). Pure functions of (seed, x, z); nothing stored.
 *  - Site: water (lakes, river channels: stages 2b/2c), slope, wetness (TWI, Beven & Kirkby 1979; stage 2a), bedrock share,
 *    light under the canopy, depth to bedrock and the material from stage-3 soils (core/stages/soils).
 *  - Niche suitability: Gaussian response on each gradient (Whittaker 1967 gradient analysis; Austin 1985 niche curves).
 *  - Clustering: Thomas cluster process (Thomas 1949, Biometrika 36:18): Poisson parents (intensity κ), Poisson(μ) offspring,
 *    isotropic Gaussian displacement σ. The standard model for clonal/seed-shadow clumping of understorey herbs
 *    (e.g. Wiegand & Moloney 2014, Handbook of Spatial Point-Pattern Analysis in Ecology, ch. 4). spatstat rThomas (R, GPL)
 *    was read for the definition only; this is written from the paper.
 */
import { heightAt, WORLD_SEED } from '../world';
import { LEVEL } from '../tuning';
import { STAGES, lakeAt } from '../stages/elevation';
import { riverAt } from '../stages/rivers';
import { soilAt, soilGrid, type SoilKind } from '../stages/soils';
import { hash, random } from '../../proc/rng';
import { clamp01, smoothstep } from '../../proc/math';

export type Soil = SoilKind;
export interface Site { water: boolean; slopeDeg: number; wet: number; rock: number; depth: number; h: number; light: number; soil?: Soil }
/** Canopy hook (render/flora registers the trees): crown cover 0..1 at a point. Fallback: open ground. */
let canopyOf: ((x: number, z: number) => number) | undefined;
export function setCanopySource(fn?: (x: number, z: number) => number) { canopyOf = fn; }

/** The site at a point. Staged: stage-3 soils (core/stages/soils soilAt, the same fields core/ground and the tree mix use):
 * wetness, bedrock share and depth to bedrock are bilinear between the 4 grid nodes (values sit on nodes, i·cell), the material
 * is the nearest node's. Bedrock counts .85 rock (NOEGTS RN: 'bare or thin patchy drift', so soil pockets remain). Unstaged: height above the shore, as render/trees and core/ground do. */
export function siteAt(x: number, z: number): Site {
  const h = heightAt(x, z), e = 1, gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  const slopeDeg = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
  let water = h < LEVEL.waterSurface + .03, wet: number, rock: number, depth: number, soil: Soil | undefined;
  if (STAGES.on) {
    const rv = riverAt(STAGES.seed, x, z); water ||= !!lakeAt(STAGES.seed, x, z) || (!!rv && rv.d < rv.half + rv.bank * .5); // lakes, river bed + inner bank
    const cell = soilGrid(STAGES.seed).cell, fx = x / cell, fz = z / cell, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    wet = rock = depth = 0; let best = -1;
    for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const w = (di ? u : 1 - u) * (dj ? v : 1 - v), so = soilAt(STAGES.seed, (i + di) * cell, (j + dj) * cell);
      wet += w * so.wet; rock += w * (so.kind === 'bedrock' ? .85 : 0); depth += w * (so.depth[0] + so.depth[1]) / 2; if (w > best && so.kind !== 'water') { best = w; soil = so.kind; } }
  } else {
    wet = clamp01((LEVEL.shore + 2.5 - h) / 4);
    rock = smoothstep(LEVEL.upland - .4, LEVEL.upland + 1.2, h); depth = 1.5 - rock; // Shield ridges (upland band)
  }
  wet = Math.max(wet, 1 - smoothstep(0, 1.2, h - LEVEL.waterSurface)); // shoreline: saturated within ~1 m above water
  rock = Math.max(rock, smoothstep(28, 38, slopeDeg)); // steep faces shed till (repose ≈ 35°, Selby 1993 Hillslope Materials) [verify]
  return { water, slopeDeg, wet, rock, depth, h, light: 1 - clamp01(canopyOf?.(x, z) ?? 0), soil };
}

/** Niche on the site gradients: optimum ± tolerance (Gaussian), with affinities for rock pockets and soils. */
export interface Niche { wet: [number, number]; light: [number, number]; rock: number; soils?: Partial<Record<Soil, number>> }
export function suitability(n: Niche, s: Site) {
  if (s.water) return 0;
  const g = (x: number, [o, t]: [number, number]) => Math.exp(-(((x - o) / t) ** 2));
  return g(s.wet, n.wet) * g(s.light, n.light) * (1 - s.rock + s.rock * n.rock) * (s.soil && n.soils ? n.soils[s.soil] ?? 1 : 1) * (1 - smoothstep(32, 42, s.slopeDeg));
}

/** Thomas cluster process over one square tile: parents ~ Poisson(κ · area · suitability at the parent), each with
 * Poisson(μ) offspring at N(parent, σ²). Offspring are kept with the suitability where they land (thinning), so a cluster
 * never spills into water. Deterministic per (seed, tile, label). Units: κ per m², σ in m. */
export interface Cluster { kappa: number; mu: number; sigma: number }
export function thomas(label: string, tx: number, tz: number, size: number, c: Cluster, suit: (x: number, z: number) => number, seed = WORLD_SEED) {
  const r = random(hash(`thomas:${label}:${seed}:${tx}:${tz}`)), out: { x: number; z: number; r: number }[] = [];
  const poisson = (lam: number) => { let k = 0, p = Math.exp(-lam), s = p, u = r(); while (u > s && k < 500) { k++; p *= lam / k; s += p; } return k; }; // inversion (Knuth 1969)
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); // Box & Muller 1958
  const parents = poisson(c.kappa * size * size);
  for (let p = 0; p < parents; p++) {
    const px = (tx + r()) * size, pz = (tz + r()) * size;
    if (r() >= suit(px, pz)) { r(); continue; }
    const kids = poisson(c.mu);
    for (let k = 0; k < kids; k++) { const x = px + gauss() * c.sigma, z = pz + gauss() * c.sigma, keep = r(); if (keep < suit(x, z)) out.push({ x, z, r: r() }); }
  }
  return out;
}
