/**
 * Shared ground-flora ecology (Grok Bot): ONE site description and ONE placement process for every ground plant (grass blades,
 * flowers, shrubs, and littoral macrophytes). Pure functions of (seed, x, z); nothing stored.
 *  - Site: water (lakes, river channels: stages 2b/2c), waterDepth & waterSurface, slope, wetness (TWI, Beven & Kirkby 1979; stage 2a),
 *    bedrock share, light under the canopy, depth to bedrock and the material from stage-3 soils (core/stages/soils).
 *  - Niche suitability: Gaussian response on each gradient (Whittaker 1967 gradient analysis; Austin 1985 niche curves),
 *    with littoral water-depth and bed-slope response for emergent and floating-leaved macrophytes (Mäkelä et al. 2004; Duarte & Kalff 1986).
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
import { standAt } from '../stand';
import { hash, random } from '../../proc/rng';
import { clamp01, smoothstep } from '../../proc/math';

export type Soil = SoilKind;
export interface Site {
  water: boolean;
  /** Calm littoral water depth (m) below LEVEL.waterSurface (0 on dry land, in river channels, or in >12 m kettle pits). */
  waterDepth?: number;
  /** Water surface elevation (m) at (x, z). */
  waterSurface?: number;
  /** Active river channel indicator (> 0 in river bed + inner bank, 0 in calm lakes and on land). */
  flow?: number;
  slopeDeg: number;
  wet: number;
  rock: number;
  depth: number;
  h: number;
  light: number;
  soil?: Soil;
}
/** Canopy hook (render/flora registers the trees): crown cover 0..1 at a point. Fallback: open ground. */
let canopyOf: ((x: number, z: number) => number) | undefined;
/** Share of the stand model's canopy closure used as background shade (0 = drawn crowns only). */
export const CANOPY = { stand: .75 };
export function setCanopySource(fn?: (x: number, z: number) => number) { canopyOf = fn; }

/** Ground footprints of rocks, logs, trunks and props, so ground plants never grow through them (render/flora registers the
 * same entities the scene draws). Circle (hx = 0, radius r) or box with half extents hx, hz (a log: axis along x, as drawn). */
export interface Footprint { x: number; z: number; r: number; hx: number; hz: number }
let footprintOf: ((x0: number, z0: number, x1: number, z1: number) => Footprint[]) | undefined;
export function setFootprintSource(fn?: (x0: number, z0: number, x1: number, z1: number) => Footprint[]) { footprintOf = fn; }
/** Footprints overlapping the box [x0, x1] × [z0, z1] (fetch once per tile, then test points with `covered`). */
export const footprintsIn = (x0: number, z0: number, x1: number, z1: number) => footprintOf?.(x0, z0, x1, z1) ?? [];
/** Point (grown out by `pad` m, e.g. a plant's crown radius) inside any footprint. */
export function covered(list: Footprint[], x: number, z: number, pad = 0) {
  for (const f of list) { const dx = x - f.x, dz = z - f.z;
    if (f.hx ? Math.abs(dx) < f.hx + pad && Math.abs(dz) < f.hz + pad : dx * dx + dz * dz < (f.r + pad) ** 2) return true; }
  return false;
}

/** Area prefetch hook (render/flora registers it): builds the per-chunk caches the canopy and footprint hooks read, in
 * budgeted slices, so a tile job never builds them synchronously inside one slice (perf audit: 35-50 ms stalls). */
let prefetchOf: ((x0: number, z0: number, x1: number, z1: number) => Generator<unknown, void>) | undefined;
export function setAreaPrefetch(fn?: (x0: number, z0: number, x1: number, z1: number) => Generator<unknown, void>) { prefetchOf = fn; }
export function* prepareArea(x0: number, z0: number, x1: number, z1: number): Generator<unknown, void> { if (prefetchOf) yield* prefetchOf(x0, z0, x1, z1); }

/** The site at a point. Staged: stage-3 soils (core/stages/soils soilAt, the same fields core/ground and the tree mix use):
 * wetness, bedrock share and depth to bedrock are bilinear between the 4 grid nodes (values sit on nodes, i·cell), the material
 * is the nearest node's. Bedrock counts .85 rock (NOEGTS RN: 'bare or thin patchy drift', so soil pockets remain). Unstaged: height above the shore, as render/trees and core/ground do. */
export function siteAt(x: number, z: number, withLight = true): Site {
  const h = heightAt(x, z), e = 1, gx = (heightAt(x + e, z) - heightAt(x - e, z)) / (2 * e), gz = (heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  const slopeDeg = Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI;
  let water = h < LEVEL.waterSurface + .03, waterSurface = LEVEL.waterSurface, flow = 0, perched = false, wet: number, rock: number, depth: number, soil: Soil | undefined;
  if (STAGES.on) {
    const lk = lakeAt(STAGES.seed, x, z), rv = riverAt(STAGES.seed, x, z);
    if (lk) { perched = true; waterSurface = lk.surface; }
    if (rv && rv.d < rv.half + rv.bank * .5) flow = rv.order || 1;
    water ||= perched || flow > 0; // lakes, river bed + inner bank
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
  // Understorey light = 1 - max(drawn crown score, stand closure). The scene draws a capped SUBSAMPLE of the stems (core/population:
  // ~130-290 trees/ha vs 650-1500/ha in the stand model), so the stand's canopy closure (core/stand, Harper et al. 2002) is the
  // background shade, thinned on rock / steep faces and halved on saturated peat (open black spruce muskeg) [game calibration .75].
  const closure = water || !withLight ? 0 : CANOPY.stand * standAt(x, z, wet).canopy * (1 - rock) * (wet > .85 ? .5 : 1);
  const waterDepth = water && !perched && flow === 0 ? Math.max(0, waterSurface - h) : 0;
  return { water, waterDepth, waterSurface, flow, slopeDeg, wet, rock, depth, h, light: withLight ? 1 - clamp01(Math.max(canopyOf?.(x, z) ?? 0, closure)) : 1, soil };
}

/** Niche on the site gradients: optimum ± tolerance (Gaussian), with affinities for rock pockets, soils, and littoral water depth. */
export interface Niche {
  wet: [number, number];
  light: [number, number];
  rock: number;
  soils?: Partial<Record<Soil, number>>;
  /** Littoral water-depth niche [minDepth, maxDepth] in m of calm standing water (Mäkelä et al. 2004, Aquatic Botany 80:253-269;
   *  Toivonen & Huttunen 1995, Ann. Bot. Fennici 32:1-14). Omitted for terrestrial species (suitability 0 when s.water is true). */
  waterDepth?: [number, number];
  /** Maximum bed slope (deg) for rooted littoral macrophytes (Duarte & Kalff 1986, Limnol. Oceanogr. 31:1072: biomass -> 0 above 12-15 deg). */
  maxSlopeDeg?: number;
}
export function suitability(n: Niche, s: Site) {
  const g = (x: number, [o, t]: [number, number]) => Math.exp(-(((x - o) / t) ** 2));
  if (n.waterDepth) {
    const [d0, d1] = n.waterDepth, maxSlope = n.maxSlopeDeg ?? 14, wd = s.waterDepth ?? 0, ws = s.waterSurface ?? LEVEL.waterSurface, fl = s.flow ?? 0;
    if (fl > 0 || (s.water && wd === 0 && s.h < ws - .03)) return 0; // no macrophytes in river channels or deep kettle pits
    if (!s.water) { if (d0 > 0 || s.h > ws + .08) return 0; } // obligate aquatics stay in water; emergents reach the saturated waterline
    else if (wd < d0 || wd > d1) return 0;
    const dm = d0 + (d1 - d0) * .38, dh = Math.max(.12, (d1 - d0) * .48);
    const depthSuit = g(wd, [dm, dh]) * (d0 > 0 ? smoothstep(d0, d0 + .12, wd) : 1) * (1 - smoothstep(d0 + (d1 - d0) * .72, d1, wd));
    const slopeSuit = 1 - smoothstep(maxSlope * .65, maxSlope, s.slopeDeg);
    return depthSuit * slopeSuit * g(s.light, n.light) * (1 - s.rock * .85);
  }
  if (s.water) return 0;
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
