import * as THREE from 'three';
import { windAt } from '../core/weather';
import { addCloudShadow, addTranslucency } from './pbr';
import { INTEREST } from '../core/interest';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { setTreeSource } from '../core/ground';
import { random } from '../core/random';
import { shaderClock } from './shaderClock';
import { heightAt, type Entity } from '../core/world';
import { RENDER } from '../core/renderSettings';
import { fireAt, standDbh, standStructure } from '../core/stand';
import { TREE_BY_ID, TREE_SPECIES, chapmanRichards, phenology, standTable } from '../core/treeSpecies';
import { hash, sample, type Dist } from '../proc/rng';
import { GLSL_NOISE } from '../proc/glsl';
import { LEVEL } from '../core/tuning';
import { STAGES } from '../core/stages/elevation';
import { soilAt } from '../core/stages/soils';
import { WEATHER } from '../core/weather';
import { f, choose, tracing, withTrace, type Trace } from '../proc/trace';
import { massOf, frustum, cone } from '../core/mass';
import { PHYS } from '../core/tuning';
import { icosphere } from './rocks';

/**
 * Stylized boreal forest (Grok Bot). Every 'spruce' entity becomes one of five species picked
 * deterministically from its seed. Geometry is merged per (species, variant, detail), shared by
 * all trees and never disposed, so each tree is one draw call with one shared wind-sway material.
 */
export type TreeSpecies = string; // an id in core/treeSpecies TREE_SPECIES
const VARIANTS = 6;
/** Species from the Kenora stand mix weighted by site wetness (low ground → black spruce/balsam poplar, dry sand → jack pine). */
export function treeSpecies(seed: number, x?: number, z?: number): TreeSpecies {
  const wet = x === undefined || z === undefined ? .5 : STAGES.on ? f('stand', 'site wetness (stage-3 soil)', soilAt(STAGES.seed, x, z).wet) : Math.min(1, Math.max(0, (LEVEL.shore + 2.5 - heightAt(x, z)) / 4));
  const age = x === undefined || z === undefined || !RENDER.standMap ? undefined : f('stand', 'stand age (yr since fire)', fireAt(x, z).age);
  return choose('tree', 'species', random(seed ^ 0x9e3779b9)(), standTable(wet, age));
}
/** Stand age class for the shared geometry cache (representative ages; core/stand drives the structure). */
const AGE_CLASSES = [20, 70, 140, 260];
const ageClass = (x?: number, z?: number) => { if (x === undefined || z === undefined || !RENDER.standMap) return 1; const a = fireAt(x, z).age; return a < 40 ? 0 : a < 100 ? 1 : a < 190 ? 2 : 3; };
/** Snag (standing dead) per tree: probability = snags/ha ÷ stems/ha of the stand (core/stand). */
const isSnag = (seed: number, x?: number, z?: number) => { if (x === undefined || z === undefined || !RENDER.standMap) return false; const st = standStructure(fireAt(x, z).age); return random(seed ^ 0x5a17)() < st.snags / (st.stems + st.snags); };

/** Bench hook: barkOff = true disables the near-tier bark shader (cost measurement). */
export const TREE_FX = { barkOff: false };
const barkFar = { value: 30 }, leafColour = { value: 0 }, leafOff = { value: 0 }, wind = { value: 0 }, windDir = { value: new THREE.Vector2(1, 0) }, windAmp = { value: 1 };
/** The trees' wind + phenology uniforms, shared as the SAME objects by other wind-driven shaders (render/grass). */
export const WIND_UNIFORMS = { uWind: wind, uWindDir: windDir, uWindAmp: windAmp, uColour: leafColour };
let material: THREE.MeshStandardMaterial | undefined;
/** Procedural bark for the near tier (one function, species = parameters). Approach after Lefebvre & Neyret 2002 ("Synthesizing
 * bark", EGWR: bark as fracture/strip patterns on the trunk's (angle, height) chart), with the feature set of Blender/Substance
 * birch graphs: chalky base, hashed horizontal lenticel rows, peeling strips showing inner bark (height → one-step parallax,
 * Kaneko et al. 2001), black fissures, chevron scars, rough dark base. All noise is proc/glsl (seeded). */
const BARK_GLSL = `
struct BarkSample { vec3 albedo; float rough; vec3 nrm; };
float barkH(vec2 uv, vec4 p) {               // height field of the bark surface (m-ish units, 0..1)
  float strips = fbm(vec2(uv.x * 3., uv.y * 2.2), 9.1);
  return p.y * smoothstep(.6, .66, strips) + p.z * .5 * (1. - abs(vnoise(vec2(uv.x * 9., uv.y * .8), 3.3) * 2. - 1.));
}
BarkSample barkSample(vec3 o, vec3 V, vec4 p, vec3 base, vec3 inner, vec3 len) {
  vec2 uv = vec2(atan(o.z, o.x) * 1.6, o.y);  // trunk chart: angle, height
  uv += V.xy * .015 * barkH(uv, p);          // parallax for the peeling strips (one step)
  vec3 c = base; float r = .85;
  // lenticels: hashed horizontal dashes in rows
  vec2 cell = floor(vec2(uv.x * 6., uv.y * 12.)); float hc = hash2s(cell, 5.7);
  float dash = step(1. - p.x, hc) * (1. - smoothstep(.06, .12, abs(fract(uv.y * 12.) - .5))) * step(.15, fract(uv.x * 6. + hc)) * step(fract(uv.x * 6. + hc), .9);
  c = mix(c, len, dash * .9);
  // peeling strips: inner bark showing at the strip edges, papery curl highlights
  float strips = fbm(vec2(uv.x * 3., uv.y * 2.2), 9.1), peel = p.y * smoothstep(.6, .66, strips);
  c = mix(c, inner, peel * (1. - smoothstep(.66, .72, strips))); c = mix(c, base * 1.06, peel * smoothstep(.66, .72, strips));
  // fissures + chevron scars at branch nodes (rows every ~1.4 m at hashed angles)
  float fis = p.z * (1. - smoothstep(.0, .06, abs(vnoise(vec2(uv.x * 9., uv.y * .8), 3.3) - .5))) ;
  float row = floor(o.y / 1.4), a0 = hash2s(vec2(row, 1.), 2.2) * 10. - 5., da = abs(uv.x - a0);
  float chev = step(hash2s(vec2(row, 3.), 2.2), .35) * step(da, .9) * (1. - smoothstep(.0, .05, abs(o.y - row * 1.4 - .7 - da * .25)));
  c = mix(c, vec3(.03, .028, .025), max(fis * .8, chev));
  // rough dark base up to the age/DBH-scaled height
  float b = 1. - smoothstep(p.w * .7, p.w * 1.3 + .01, o.y + (vnoise(uv * 4., 6.1) - .5) * .6);
  c = mix(c, c * .35, b); r = mix(r, .98, b) - .25 * peel;
  float e = .02, hx = barkH(uv + vec2(e, 0.), p) - barkH(uv - vec2(e, 0.), p), hy = barkH(uv + vec2(0., e), p) - barkH(uv - vec2(0., e), p);
  return BarkSample(c, r, vec3(-hx, -hy, 0.) * 6.);
}`;
function treeMaterial() {
  if (material) return material;
  material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
  material.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind; shader.uniforms.uWindDir = windDir; shader.uniforms.uWindAmp = windAmp; shader.uniforms.uColour = leafColour; shader.uniforms.uOff = leafOff;
    shader.defines = { ...(shader.defines ?? {}), TRANSLUCENCY_MASK: 'step(0.5, vLeaf)' }; addTranslucency(shader); addCloudShadow(shader);
    shader.vertexShader = 'uniform float uWind, uWindAmp;\nuniform vec2 uWindDir;\nattribute float aLeaf; attribute float aFlutter; attribute vec3 aFall; attribute vec4 aBark; attribute vec3 aInner; attribute vec3 aLen; attribute float aNear; varying float vLeaf; varying vec3 vFall; varying vec3 vObj; varying vec4 vBark; varying vec3 vInner; varying vec3 vLen; varying float vNear;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vLeaf = aLeaf; vFall = aFall; vObj = position; vBark = aBark; vInner = aInner; vLen = aLen; vNear = aNear;
      mat4 treeM = modelMatrix;
      #ifdef USE_BATCHING
        treeM = modelMatrix * batchingMatrix; // batched (render/batch): this instance's own placement
      #endif
      float windPhase = treeM[3].x * .11 + treeM[3].z * .07;
      float bend = max(position.y, 0.) * max(position.y, 0.) * .0016;
      float gust = (.6 + .4 * sin(uWind * .23 + windPhase * .3)) * uWindAmp;
      // the shared wind field (core/weather): lean + sway along the wind, in this tree's model space
      vec3 wl = transpose(mat3(treeM)) * vec3(uWindDir.x, 0., uWindDir.y); vec2 along = normalize(wl.xz + 1e-5), across = vec2(-along.y, along.x);
      transformed.xz += bend * gust * (along * (.8 + sin(uWind * 1.1 + windPhase) + .35 * sin(uWind * 2.7 + windPhase * 1.7)) + across * .6 * cos(uWind * .9 + windPhase * 1.3));
      // leaf flutter: per-species petiole factor (aspen's flattened petioles flutter most; Niklas 1991), driven by the shared wind
      transformed.xz += step(0.5, aLeaf) * aFlutter * .06 * uWindAmp * vec2(sin(uWind * 13. + position.y * 5. + position.x * 3.), cos(uWind * 11. + position.z * 4.));`);
    shader.uniforms.uBarkFar = barkFar;
    shader.fragmentShader = `uniform float uColour, uOff, uBarkFar; varying float vLeaf; varying vec3 vFall; varying vec3 vObj; varying vec4 vBark; varying vec3 vInner; varying vec3 vLen; varying float vNear;\n${GLSL_NOISE}\n${BARK_GLSL}\n` + shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float decid = step(1.5, vLeaf), nn = vnoise(vObj.xz * 3.1 + vObj.y * 1.7, 4.2);
        if (decid * uOff > nn) discard;                                            // leaf-off (phenology), patchy as leaves drop
        diffuseColor.rgb = mix(diffuseColor.rgb, vFall, decid * smoothstep(nn - .3, nn + .3, uColour)); // fall colour, crown by crown
        float isBark = 1. - step(0.5, vLeaf), barkN = isBark * vnoise(vec2(atan(vObj.z, vObj.x) * 6., vObj.y * 9.), 1.7);
        // near tier: full procedural bark, crossfading to the flat painted bark with distance (LOD ladder: uBarkFar)
        float barkFade = isBark * vNear * (1. - smoothstep(uBarkFar * .6, uBarkFar, length(vViewPosition)));
        BarkSample bk = BarkSample(diffuseColor.rgb, .95, vec3(0.)); if (barkFade > .001) bk = barkSample(vObj, normalize(vViewPosition), vBark, diffuseColor.rgb, vInner, vLen);
        diffuseColor.rgb = mix(diffuseColor.rgb * (1. - .25 * barkN), bk.albedo, barkFade);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(mix(0.95, bk.rough, barkFade), 0.55, step(0.5, vLeaf)); // bark matte, leaf cuticle waxy`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(normal + isBark * mix(.35 * vec3(barkN - .5, 0., .5 - barkN), bk.nrm, barkFade));`);
  };
  material.customProgramCacheKey = () => 'boreal-tree-spec';
  return material;
}

const cache = new Map<string, THREE.BufferGeometry>();
const tmpColor = new THREE.Color();
function painted(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, m: THREE.Matrix4, jitter = 0, rng?: () => number, bands?: (y: number) => number) {
  const geo = (g.index ? g.toNonIndexed() : g); geo.applyMatrix4(m);
  geo.deleteAttribute('uv');
  const pos = geo.getAttribute('position'), colors = new Float32Array(pos.count * 3), base = new THREE.Color(color);
  for (let i = 0; i < pos.count; i += 3) {
    const j = rng ? (rng() - .5) * jitter : 0;
    for (let k = 0; k < 3; k++) {
      tmpColor.copy(base).offsetHSL(0, 0, j);
      if (bands) tmpColor.multiplyScalar(bands(pos.getY(i + k)));
      colors.set([tmpColor.r, tmpColor.g, tmpColor.b], (i + k) * 3);
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}
const M = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

/** ONE builder; the crown FORM and every number come from the species spec (core/treeSpecies). Per-vertex attributes:
 * aLeaf (0 bark, 1 needle, 2 deciduous leaf), aFall (fall colour), aFlutter (petiole flutter) feed the shared tree shader. */
function build(id: TreeSpecies, variant: number, detail: number, cls = 1, snag = false) {
  const stand = standStructure(f('tree', 'stand age class (yr)', AGE_CLASSES[cls]));
  const sp = TREE_BY_ID[id] ?? TREE_SPECIES[0], rng = random(0x51ab + variant * 7919 + hash(id));
  const parts: THREE.BufferGeometry[] = [], seg = [8, 6, 4][detail];
  const tag = (g: THREE.BufferGeometry, leaf: number) => {
    const n = g.getAttribute('position').count, fall = new THREE.Color(sp.leaf.fall ?? sp.leaf.color), a = new Float32Array(n), fl = new Float32Array(n), fc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i] = leaf; fl[i] = leaf ? sp.leaf.flutter : 0; fc.set([fall.r, fall.g, fall.b], i * 3); }
    for (const [k, size] of [['aBark', 4], ['aInner', 3], ['aLen', 3], ['aNear', 1]] as const) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * size), size)); // overwritten on the stem
    g.setAttribute('aLeaf', new THREE.BufferAttribute(a, 1)); g.setAttribute('aFlutter', new THREE.BufferAttribute(fl, 1)); g.setAttribute('aFall', new THREE.BufferAttribute(fc, 3)); return g;
  };
  // Per-tree attributes: sampled from the species table (bounded distributions, proc/rng `sample`), traced to the inspector.
  const A = sp.attr, S = (name: string, d: Dist) => f('tree', name, sample(rng, d));
  const dbh = f('tree', 'DBH (cm)', standDbh(rng, A.dbh, stand)); f('tree', 'snag', snag ? 1 : 0);
  const h = f('tree', 'height', sample(rng, { mean: chapmanRichards(dbh, A.hd), sd: A.hd.sd, min: sp.height[0] * .5, max: sp.height[1] * 1.25, kind: 'lognormal' }));
  const crownBase = 1 - S('crown ratio', A.crownRatio), w = f('tree', 'crownWidth', h * sp.crownWidth / 2 * (.85 + rng() * .3));
  const r = f('tree', 'trunkRadius', dbh / 200 * 1.15); // DBH at 1.3 m → base radius (+15 % butt swell) [verify]
  const lean = f('tree', 'lean', (rng() - .5) * (sp.form === 'broadleaf' ? .15 : sp.form === 'open-pine' ? .12 : 0));
  const B = { spacing: S('whorl spacing (m)', A.whorlSpacing), per: Math.round(S('branches per whorl', A.perWhorl)), angle: S('branch angle (°)', A.angle) * Math.PI / 180,
    len: S('branch length ratio', A.lengthRatio), taper: S('Leonardo exponent Δ', A.taper), droop: S('droop (°)', A.droop) * Math.PI / 180,
    div: S('divergence (°)', A.divergence) * Math.PI / 180, dead: S('dead-branch zone', A.deadZone) };
  const marks = Array.from({ length: 24 }, () => rng());
  const bark = (y: number) => { const m = marks[Math.min(23, Math.max(0, Math.floor(y / h * 24)))];
    return y < h * sp.bark.baseFrac ? new THREE.Color(sp.bark.base).r / Math.max(.01, new THREE.Color(sp.bark.color).r) : sp.bark.lenticel && m < (sp.bark.lenticelShare ?? 0) ? new THREE.Color(sp.bark.lenticel).r / Math.max(.01, new THREE.Color(sp.bark.color).r) : 1; };
  const th = sp.form === 'spire' ? h * .96 : h;
  f('tree', 'trunkHeight', th);
  const stem = tag(painted(new THREE.CylinderGeometry(r * .45, r, th, seg + (detail === 0 ? 4 : 0), detail === 0 ? 12 : 2), sp.bark.color, M(0, th / 2, 0, 1, 1, 1, 0, 0, lean), .06, rng, bark), 0);
  { // near-tier bark parameters: (lenticel share, peel, fissure, base height m) + inner/lenticel colours + detail flag
    const n = stem.getAttribute('position').count, a = new Float32Array(n * 4), inner = new THREE.Color(sp.bark.inner ?? sp.bark.base), len = new THREE.Color(sp.bark.lenticel ?? sp.bark.base), cIn = new Float32Array(n * 3), cLen = new Float32Array(n * 3), near = new Float32Array(n);
    // older/thicker trees have more rough base: base height ∝ DBH (game mapping of 'rough bark climbs with age', Perala 1990) [verify]
    for (let i = 0; i < n; i++) { a.set([sp.bark.lenticelShare ?? 0, sp.bark.peel ?? 0, sp.bark.fissure ?? 0, h * sp.bark.baseFrac * (r / (sp.dbh[1] / 200))], i * 4); cIn.set([inner.r, inner.g, inner.b], i * 3); cLen.set([len.r, len.g, len.b], i * 3); near[i] = detail === 0 ? 1 : 0; }
    stem.setAttribute('aBark', new THREE.BufferAttribute(a, 4)); stem.setAttribute('aInner', new THREE.BufferAttribute(cIn, 3)); stem.setAttribute('aLen', new THREE.BufferAttribute(cLen, 3)); stem.setAttribute('aNear', new THREE.BufferAttribute(near, 1));
  }
  parts.push(stem);
  const leafKind = sp.leaf.deciduous ? 2 : 1, green = new THREE.Color(sp.leaf.color);
  const blob = (x: number, y: number, z: number, sx: number, sy: number, sz: number, c: THREE.Color) =>
    parts.push(tag(painted(icosphere(detail === 0 ? 1 : 0), c, M(x, y, z, sx, sy, sz, rng(), rng() * 6, rng()), .12, rng), leafKind));
  const limb = (y: number, az: number, len: number, rad: number, ang: number, color: number) => // one branch segment from the stem
    parts.push(tag(painted(new THREE.CylinderGeometry(rad * .5, rad, len, 4), color, M(Math.cos(az) * Math.sin(ang) * len / 2 - lean * y, y + Math.cos(ang) * len / 2, Math.sin(az) * Math.sin(ang) * len / 2, 1, 1, 1, 0, -az, -ang)), 0));
  const crownY0 = h * crownBase, nodes = Math.max(1, Math.floor(h * (1 - crownBase) / B.spacing));
  // self-pruned zone: dead branch stubs on the lower stem (conifers and aspen keep them; Silvics), full detail only
  if (detail === 0) { const deadTop = crownY0, deadFrom = crownY0 * (1 - B.dead), rows = Math.min(14, Math.floor((deadTop - deadFrom) / B.spacing));
    for (let i = 0; i < rows; i++) for (let k = 0; k < Math.min(B.per, 4); k++) limb(deadFrom + i * B.spacing + rng() * .1, k * 2 * Math.PI / B.per + i * B.div, w * .3 * (.5 + rng() * .5), r * .12, B.angle + B.droop * .5, 0x3a2e25); }
  const childR = r * Math.max(1, B.per) ** (-1 / B.taper) * .5; // pipe model: r^Δ = Σ r_i^Δ (half the stem radius at crown base)
  if (snag) { // standing dead: bare broken limbs only (crown shed), core/stand snag share
    for (let i = 0; i < Math.min(nodes * B.per, detail === 2 ? 0 : 8); i++) limb(h * (crownBase + rng() * (1 - crownBase) * .8), i * B.div, w * .35 * rng(), childR * .7, B.angle + B.droop, 0x4a3f36);
  } else if (sp.form === 'spire') { // excurrent conifer: one drooping cone tier per (group of) whorls
    const tiers = f('tree', 'tiers', Math.min(nodes, detail === 2 ? 2 : detail === 1 ? 5 : 10));
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers, y = h * (crownBase + (.96 - crownBase) * t), radius = Math.max(.3, w * B.len * (1 - t * .88) * (.85 + rng() * .3)), tall = h * (1 - crownBase) / tiers * 1.8 + h * (detail === 2 ? .2 : 0);
      parts.push(tag(painted(new THREE.ConeGeometry(radius, tall, seg + (detail === 0 ? 2 : 0)), green.clone().offsetHSL(0, 0, (t - .5) * .05),
        M((rng() - .5) * .12, y - Math.sin(B.droop) * radius * .3, (rng() - .5) * .12, 1, 1, 1, (rng() - .5) * .08, i * B.div, (rng() - .5) * .08), .07, rng), leafKind));
    }
  } else { // broadleaf / open pine: limbs at phyllotactic azimuths, foliage masses at drooping tips
    const n = f('tree', 'limbs', Math.min(nodes * B.per, detail === 2 ? 3 : detail === 1 ? 6 : sp.form === 'open-pine' ? 9 : 14)), flat = sp.form === 'open-pine' ? .5 : 1;
    for (let i = 0; i < n; i++) {
      const t = (i + rng() * .5) / n, y = h * (crownBase + t * (1 - crownBase) * .92), az = i * B.div, len = w * B.len * (1 - t * .55);
      const tipX = Math.cos(az) * Math.sin(B.angle) * len - lean * y, tipZ = Math.sin(az) * Math.sin(B.angle) * len, tipY = y + Math.cos(B.angle) * len - Math.sin(B.droop) * len * .5;
      if (detail === 0) limb(y, az, len, childR * (1 - t * .5), B.angle, sp.bark.color);
      const size = Math.max(.6, w * .45) * (.8 + rng() * .5);
      blob(tipX, tipY, tipZ, size, size * .8 * flat, size, green.clone().offsetHSL((rng() - .5) * .05, 0, (rng() - .5) * .08));
    }
  }
  const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
  merged.computeBoundingSphere(); return merged;
}

/** Per-frame tree uniforms (wind clock/field, phenology, bark range), shared by every tree material user. Called from the
 *  frame loop; with batching there is no per-mesh onBeforeRender any more (it used to run once per tree per pass). */
export function updateTreeUniforms() {
  wind.value = shaderClock.time; const w = windAt(INTEREST.x, 10, INTEREST.z), U = Math.hypot(w.x, w.z);
  windDir.value.set(w.x / (U || 1), w.z / (U || 1)); windAmp.value = Math.min(4, (U / 4) ** 2); const ph = phenology(WEATHER.day); barkFar.value = TREE_FX.barkOff ? 0 : INTEREST.near * .5; leafColour.value = ph.colour; leafOff.value = ph.off; // drag ∝ U² (4 m/s = the old look)
}
/** One LOD level of a tree: a single shared-geometry mesh, flagged so disposeObject skips it. */
export function treeGeometry(entity: Entity, detail: number): THREE.Group {
  const species = treeSpecies(entity.seed, entity.x, entity.z), variant = f('tree', 'variant', (entity.seed >>> 3) % VARIANTS), cls = ageClass(entity.x, entity.z), snag = isSnag(entity.seed, entity.x, entity.z), key = `${species}:${variant}:${cls}:${snag ? 1 : 0}:${detail}`;
  // Traced (inspector) builds bypass the shared cache so factors are reported and what-if overrides take effect.
  let geometry = tracing() ? build(species, variant, detail, cls, snag) : cache.get(key); if (!geometry) cache.set(key, geometry = build(species, variant, detail, cls, snag));
  const mesh = new THREE.Mesh(geometry, treeMaterial()); mesh.userData.shared = !tracing();
  const group = new THREE.Group(); group.add(mesh);
  const s = f('tree', 'heightJitter', random(entity.seed)());
  group.scale.set(entity.scale, entity.scale * (.9 + s * .2), entity.scale); group.rotation.y = entity.rotation;
  return group;
}

/** Generator dimensions for mass: the build's own traced factors (LOD 2), cached per species/variant. */
const dimsCache = new Map<string, Record<string, number>>();
export function treeDims(seed: number, x?: number, z?: number) {
  const species = treeSpecies(seed, x, z), variant = (seed >>> 3) % VARIANTS, cls = ageClass(x, z), key = `${species}:${variant}:${cls}`;
  let d = dimsCache.get(key);
  if (!d) { const t: Trace = { factors: [], overrides: {} }; withTrace(t, () => build(species, variant, 2, cls).dispose());
    d = Object.fromEntries(t.factors.filter(x => typeof x.value === 'number').map(x => [x.name, x.value as number])); dimsCache.set(key, d); }
  return { ...d, species } as Record<string, number> & { species: TreeSpecies };
}
/** Tree mass: trunk frustum (heartwood/sapwood/bark/water) + crown cone x fill (needles or leaves), at entity scale. */
export function treeMass(e: Entity) {
  const d = treeDims(e.seed, e.x, e.z), s = e.scale, sy = s * (.9 + random(e.seed)() * .2), w = d.crownWidth ?? 1.6, h = d.height ?? d.trunkHeight;
  const spec = TREE_BY_ID[d.species] ?? TREE_SPECIES[0], conifer = !spec.leaf.deciduous;
  return massOf('tree', [{ region: `trunk:${spec.wood}`, volume: frustum(d.trunkRadius * s, d.trunkRadius * .45 * s, d.trunkHeight * sy) },
    { region: conifer ? 'crownConifer' : 'crownBroadleaf', volume: cone(w * s, h * .8 * sy) * PHYS.crownFill }]);
}
// Ground litter input needs species + crown radius per tree (core/ground stays three.js-free).
setTreeSource((seed, x, z) => treeSpecies(seed, x, z), (seed, x, z) => treeDims(seed, x, z).crownWidth ?? 1.6);
