/**
 * Procedural conifer (Grok Bot), milestone 1: black spruce from a seed and an age, in four levels of detail.
 *  - near: Weber & Penn skeleton (render/trees/weberPenn) -> bark tubes for trunk, limbs and laterals + needle-spray cards
 *    on every lateral and the outer limb (cross-quads, seeded procedural needle atlas, crown-normal shading, baked AO);
 *  - mid: trunk + limbs only (fewer rings/sides) with one wide spray card per limb;
 *  - crown: a trunkless ~40-triangle spire whose ring radii are the near tree's own foliage envelope (far ring, instanced);
 *  - impostor: render/trees/impostor bakes the near mesh into an octahedral atlas (farthest ring).
 * Everything comes from core/flora/trees/forms (data) and proc/rng; no stored models or images.
 */
import * as THREE from 'three';
import { hash, random } from '../../proc/rng';
import { GLSL_NOISE } from '../../proc/glsl';
import { TREE_BY_ID } from '../../core/treeSpecies';
import { TREE_FORMS, dbhAt, heightAt, type TreeForm } from '../../core/flora/trees/forms';
import { generateSkeleton, type Skeleton, type Stem } from './weberPenn';
import { tubes } from './tube';

export interface ConiferLods { near: THREE.Group; mid: THREE.Group; crown: THREE.BufferGeometry; skeleton: Skeleton; height: number; dbh: number; stats: { buildMs: number; tris: { near: number; mid: number; crown: number }; stems: number; cards: number } }

// ---------- shared materials (one program each; flagged shared so disposeObject skips them) ----------
let needleTex: THREE.DataTexture | undefined, barkMat: THREE.MeshStandardMaterial | undefined, leafMat: THREE.MeshStandardMaterial | undefined, crownMat: THREE.MeshStandardMaterial | undefined;
/** Needle-spray atlas: left half a plain shoot, right half a club shoot with persistent cones. Seeded, drawn once. */
export function needleAtlas(form: TreeForm = TREE_FORMS['black-spruce']) {
  if (needleTex) return needleTex;
  const W = 256, H = 512, cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H;
  const g = cv.getContext('2d')!, rnd = random(hash(`needles:${form.id}`)), c = form.colour;
  const hex = (n: number, k = 1) => new THREE.Color(n).multiplyScalar(k).getStyle(); // sRGB css (THREE.Color holds linear)
  const twig = (x0: number, y0: number, x1: number, y1: number, w: number) => { g.strokeStyle = hex(c.twig); g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  // 4-angled needles all round the twig (6-15 mm; the spray card is ~.16 m wide over 256 px, so 10-24 px) seen as strokes.
  // A dark underpaint along each twig keeps the coarse mips opaque (needles overlap densely in a real shoot).
  const needles = (x0: number, y0: number, x1: number, y1: number, len: number) => {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    g.strokeStyle = hex(c.shade, .8); g.lineWidth = len * 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1 - ux * len * .3, y1 - uy * len * .3); g.stroke();
    for (let i = 0, n = Math.floor(L / 1.1); i < n; i++) {
      const t = i / n, px = x0 + ux * L * t, py = y0 + uy * L * t, a = .5 + rnd() * .9, side = i % 2 ? -1 : 1, l = len * (.7 + rnd() * .45) * (1 - .3 * t);
      const dx = ux * Math.cos(a) - uy * Math.sin(a) * side, dy = uy * Math.cos(a) + ux * Math.sin(a) * side;
      const k = .85 + rnd() * .55; g.strokeStyle = rnd() < .15 ? hex(0x8fa49a, k * .85) /* glaucous stomatal lines */ : hex(rnd() < .55 ? c.needle : c.shade, k);
      g.lineWidth = 2.2 + rnd() * 1.4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + dx * l, py + dy * l); g.stroke();
    }
  };
  for (let half = 0; half < 2; half++) {
    const ox = half * W, cx = ox + W / 2;
    for (let k = 0; k < 12; k++) { // alternate side shoots in the spray plane, longest near the base
      const y = H - 30 - k * (H - 70) / 12, side = k % 2 ? 1 : -1, len = (W / 2 - 22) * (1 - k / 15) * (.8 + rnd() * .25), ang = .8 + rnd() * .3;
      const x1 = cx + side * Math.sin(ang) * len, y1 = y - Math.cos(ang) * len; twig(cx, y, x1, y1, 2.4); needles(cx, y, x1, y1, 20);
    }
    twig(cx, H - 2, cx, 8, 4.5); needles(cx, H - 2, cx, 8, 24);
    if (half) for (let k = 0; k < 7; k++) { // persistent semi-serotinous cones, 1.5-2.5 cm, clustered (Taylor 1993)
      const x = cx + (rnd() - .5) * W * .6, y = 30 + rnd() * H * .45, rx = 11 + rnd() * 5, ry = rx * 1.6;
      g.fillStyle = hex(c.cone, .8 + rnd() * .4); g.beginPath(); g.ellipse(x, y, rx, ry, (rnd() - .5) * .8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hex(c.cone, .55); g.lineWidth = 1.2; for (let s = -2; s <= 2; s++) { g.beginPath(); g.moveTo(x - rx * .8, y + s * ry * .3); g.lineTo(x + rx * .8, y + s * ry * .3 - 3); g.stroke(); }
    }
  }
  // Transparent texels carry the shade colour (canvas stores them as black), so coarse mips average to foliage, not to a
  // dark halo; rows are flipped so v = 0 is the shoot base.
  const src = g.getImageData(0, 0, W * 2, H).data, data = new Uint8Array(src.length), sh = new THREE.Color(c.shade).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace), row = W * 2 * 4;
  for (let y = 0; y < H; y++) for (let x = 0; x < W * 2; x++) {
    const i = (H - 1 - y) * row + x * 4, o = y * row + x * 4, a = src[i + 3];
    data[o] = a ? src[i] : sh.r * 255; data[o + 1] = a ? src[i + 1] : sh.g * 255; data[o + 2] = a ? src[i + 2] : sh.b * 255; data[o + 3] = a;
  }
  needleTex = new THREE.DataTexture(data, W * 2, H); needleTex.colorSpace = THREE.SRGBColorSpace; needleTex.anisotropy = 4; needleTex.generateMipmaps = true;
  needleTex.minFilter = THREE.LinearMipmapLinearFilter; needleTex.magFilter = THREE.LinearFilter; needleTex.needsUpdate = true;
  return needleTex;
}
export function barkMaterial() {
  if (barkMat) return barkMat;
  barkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95 }); barkMat.userData.shared = true;
  // thin scaly bark (Taylor 1993): plates from proc/glsl value noise on the trunk chart (u around, v along, 0.5 m tiles)
  barkMat.onBeforeCompile = s => {
    s.vertexShader = 'varying vec2 vBarkUv;\n' + s.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\nvBarkUv = uv;');
    s.fragmentShader = `varying vec2 vBarkUv;\n${GLSL_NOISE}\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float pl = vnoise(vBarkUv * vec2(9., 14.), 3.1), cr = smoothstep(.08, .0, abs(fract(pl * 3.) - .5) - .38);
      diffuseColor.rgb *= (.78 + .45 * pl) * (1. - .45 * cr);`);
  };
  barkMat.customProgramCacheKey = () => 'boreal-tree-bark-v1';
  return barkMat;
}
/** Alpha-tested foliage loses coverage in coarse mips (averaged alpha < cutoff): scale alpha up with the mip level
 *  (Ben Golus 2017, "Anti-aliased Alpha Test: The Esoteric Alpha To Coverage"); the atlas is 512 px high. */
export const MIP_ALPHA = `#include <map_fragment>
  #ifdef USE_MAP
    diffuseColor.a *= 1. + max(0., log2(max(fwidth(vMapUv.x * 512.), fwidth(vMapUv.y * 512.)))) * .35;
  #endif`;
export function foliageMaterial() {
  if (leafMat) return leafMat;
  leafMat = new THREE.MeshStandardMaterial({ map: needleAtlas(), vertexColors: true, alphaTest: .4, alphaToCoverage: true, side: THREE.DoubleSide, roughness: .7 }); leafMat.userData.shared = true;
  leafMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', MIP_ALPHA); };
  leafMat.customProgramCacheKey = () => 'boreal-tree-leaf-v1';
  return leafMat;
}
/** Far crowns: per-instance colour from a curated palette grouped by low-frequency noise of the instance position, plus a
 *  fake vertical AO gradient mix(.25, 1.15, localY). Uniforms only: no defines change with the tier. */
export const CROWN_UNIFORMS = { uPalette: { value: TREE_FORMS['black-spruce'].colour.palette.map(c => new THREE.Color(c)) }, uAO: { value: new THREE.Vector2(.25, 1.15) }, uNormalUp: { value: 0 }, uTint: { value: .36 } }; // uTint: photo medians include sunlight; .36 matches the near LOD's render in the viewer [game calibration]
export function crownMaterial() {
  if (crownMat) return crownMat;
  crownMat = new THREE.MeshStandardMaterial({ roughness: .85, flatShading: false }); crownMat.userData.shared = true;
  crownMat.onBeforeCompile = s => {
    Object.assign(s.uniforms, CROWN_UNIFORMS);
    s.vertexShader = `attribute float aY; varying float vY; varying vec3 vPal; uniform vec3 uPalette[5]; uniform float uNormalUp;\n${GLSL_NOISE}\n` + s.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(objectNormal + vec3(0., uNormalUp, 0.)); // upward-bent normals (broadleaf crowns)')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vY = aY; vec3 wp = vec3(0.);
        #ifdef USE_INSTANCING
          wp = (modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.)).xyz;
        #endif
        float g = vnoiseU(wp.xz / 70., 4.7) * 4.999, j = hash2u(floor(wp.xz * 3.), 1.3);
        int i0 = int(g); vPal = mix(uPalette[i0], uPalette[min(i0 + 1, 4)], smoothstep(.3, .7, fract(g))) * (.88 + .24 * j);`);
    s.fragmentShader = 'uniform vec2 uAO; uniform float uTint; varying float vY; varying vec3 vPal;\n' + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb = vPal * uTint * mix(uAO.x, uAO.y, vY);`);
  };
  crownMat.customProgramCacheKey = () => 'boreal-tree-crown-v1';
  return crownMat;
}

// ---------- geometry ----------
interface Card { a: THREE.Vector3; b: THREE.Vector3; w: number; club: boolean }
function cardGeometry(cards: Card[], h: number, crownR: (y: number) => number, form: TreeForm, rnd: () => number, quads: number, gain = 1) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const d = new THREE.Vector3(), s = new THREE.Vector3(), cn = new THREE.Vector3(), out = new THREE.Vector3(), q = new THREE.Quaternion(), n = new THREE.Vector3(), tint = new THREE.Color();
  for (const c of cards) {
    d.subVectors(c.b, c.a); const L = d.length(); if (L < .01) continue; d.divideScalar(L);
    s.crossVectors(d, new THREE.Vector3(0, 1, 0)); if (s.lengthSq() < 1e-6) s.set(1, 0, 0); s.normalize();
    const mid = c.a.clone().lerp(c.b, .5), r = Math.hypot(mid.x, mid.z), radial = Math.min(1, r / Math.max(.15, crownR(mid.y)));
    // baked AO: inner crown and lower crown darker [game calibration, matches the fake gradient of the far crowns]
    const ao = gain * (.55 + .45 * radial) * (.72 + .28 * Math.min(1, mid.y / h)), jit = .85 + rnd() * .3;
    tint.setRGB(ao * jit, ao * jit * (.97 + rnd() * .06), ao * jit);
    out.set(mid.x, 0, mid.z).normalize().multiplyScalar(.7).add(new THREE.Vector3(0, .5, 0)).normalize(); // crown normal: radial + up
    const u0 = c.club ? .5 : 0;
    for (let k = 0; k < quads; k++) {
      q.setFromAxisAngle(d, (k / quads) * Math.PI + (rnd() - .5) * .4 - Math.PI / 4); const side = s.clone().applyQuaternion(q).multiplyScalar(c.w / 2);
      cn.crossVectors(d, side).normalize(); n.copy(cn).multiplyScalar(cn.dot(out) < 0 ? -.35 : .35).add(out).normalize();
      const v0 = pos.length / 3;
      for (const [p, uu, vv] of [[c.a.clone().sub(side), 0, 0], [c.a.clone().add(side), 1, 0], [c.b.clone().add(side), 1, 1], [c.b.clone().sub(side), 0, 1]] as [THREE.Vector3, number, number][]) {
        pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(u0 + uu * .5, vv); col.push(tint.r, tint.g, tint.b);
      }
      idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}
/** Trunkless far crown: 5-sided rings at the foliage envelope + apex + base cap (38 triangles). aY = height / H. */
function crownGeometry(env: (y: number) => number, y0: number, h: number, rnd: () => number) {
  const fr = [0, .3, .62, .88], sides = 5, pos: number[] = [], ys: number[] = [], idx: number[] = [];
  fr.forEach((f, i) => { const y = y0 + (h - y0) * f, r = env(y) * .8 /* foliage is sparse at the envelope edge [game calibration] */, off = (i % 2) * Math.PI / sides; for (let j = 0; j < sides; j++) { const a = off + j / sides * Math.PI * 2, rr = r * (.92 + rnd() * .16); pos.push(Math.cos(a) * rr, y, Math.sin(a) * rr); ys.push(y / h); } });
  const apex = pos.length / 3; pos.push(0, h, 0); ys.push(1);
  for (let i = 0; i < fr.length - 1; i++) for (let j = 0; j < sides; j++) { const a = i * sides + j, b = i * sides + (j + 1) % sides, c = a + sides, d = b + sides; idx.push(a, c, b, b, c, d); }
  const top = (fr.length - 1) * sides; for (let j = 0; j < sides; j++) idx.push(top + j, apex, top + (j + 1) % sides);
  for (let j = 1; j < sides - 1; j++) idx.push(0, j, j + 1);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aY', new THREE.Float32BufferAttribute(ys, 1)); g.setIndex(idx);
  g.computeVertexNormals(); const nr = g.getAttribute('normal'); for (let i = 0; i < nr.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(nr, i); v.y += .35; v.normalize(); nr.setXYZ(i, v.x, v.y, v.z); }
  return g;
}
const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

/** Build one tree of `formId` from (seed, age years). Deterministic: the same arguments give the same geometry. */
export function buildConifer(formId: string, seed: number, age: number): ConiferLods {
  const t0 = performance.now(), form = TREE_FORMS[formId], spec = TREE_BY_ID[formId], rnd = random(hash(`tree:${formId}:${seed}`));
  const h = heightAt(form, age) * (.9 + rnd() * .2), dbh = dbhAt(formId, h), r0 = Math.max(.012, dbh / 200 * 1.15); // +15 % butt swell (core trees.ts) [verify]
  const whorl = spec.attr.whorlSpacing.mean * (.85 + rnd() * .3) * Math.min(1, .35 + h / 12); // young trees: shorter internodes [verify]
  const wp = { ...form.wp, branches: [...form.wp.branches] }; wp.branches[1] = Math.max(5, Math.round(h * (1 - wp.baseSize) / whorl) * wp.whorlSize[1]);
  const sk = generateSkeleton(wp, h, r0, rnd);
  const live = sk.stems.filter(s => !s.dead && s.level > 0);
  // foliage envelope: max radial distance per 0.5 m band, from limb tips (smoothed); the far crown and AO use it
  const bands = Math.ceil(h / .5) + 1, env = new Float32Array(bands);
  for (const s of live) for (const p of s.points) { const b = Math.min(bands - 1, Math.floor(p.y / .5)); env[b] = Math.max(env[b], Math.hypot(p.x, p.z) + form.spray.width * .4); }
  for (let i = bands - 2; i >= 0; i--) env[i] = Math.max(env[i], env[i + 1] * .97); // monotone below the tip (cone)
  const crownR = (y: number) => env[Math.max(0, Math.min(bands - 1, Math.floor(y / .5)))] || .2;
  const c = form.colour, bark = new THREE.Color(c.bark), twigC = new THREE.Color(c.twig), deadC = new THREE.Color(0x6f675e) /* grey dead limbs [game calibration] */;
  const colour = (s: Stem) => s.dead ? deadC : s.level === 0 ? bark : twigC;
  const clubY = h * (1 - (wp.club?.frac ?? 0) * 1.4);
  // near: every live L2 lateral carries a cross-card; the outer part of each live L1 limb too
  const cards: Card[] = [];
  for (const s of live) {
    if (s.level === sk.stems[0].maxLevel) cards.push({ a: s.points[0], b: s.points[s.points.length - 1], w: form.spray.width * (.8 + rnd() * .4), club: s.points[0].y > clubY && rnd() < .5 });
    else for (let i = Math.floor((s.points.length - 1) * (1 - form.spray.outer)); i < s.points.length - 1; i++) cards.push({ a: s.points[i], b: s.points[i + 1], w: form.spray.width * 1.2, club: false });
  }
  const nearBark = tubes(sk.stems, { colour, keep: s => s.level < 2 || s.length > .12 }), nearLeaf = cardGeometry(cards, h, crownR, form, rnd, 2);
  // mid: trunk + limbs, one wide spray card per limb (its laterals' spread)
  const midCards: Card[] = live.filter(s => s.level === 1).map(s => ({ a: s.points[0], b: s.points[s.points.length - 1], w: Math.max(.25, s.length * wp.length[2] * 1.6), club: s.points[0].y > clubY }));
  const midBark = tubes(sk.stems, { colour, radialScale: .6, ringStride: 2, keep: s => s.level === 0 || (s.level === 1 && !s.dead && s.length > .3) }), midLeaf = cardGeometry(midCards, h, crownR, form, rnd, 2, 1.9); // gain 1.9: limb-long cards start at the trunk (dark AO) and are sparser; matches the near LOD's rendered median [game calibration]
  const crown = crownGeometry(crownR, h * wp.baseSize * .8, h, rnd);
  const group = (b: THREE.BufferGeometry, l: THREE.BufferGeometry) => { const g = new THREE.Group(); const mb = new THREE.Mesh(b, barkMaterial()), ml = new THREE.Mesh(l, foliageMaterial()); mb.castShadow = ml.castShadow = true; mb.receiveShadow = ml.receiveShadow = true; g.add(mb, ml); return g; };
  const near = group(nearBark, nearLeaf), mid = group(midBark, midLeaf);
  return { near, mid, crown, skeleton: sk, height: h, dbh,
    stats: { buildMs: performance.now() - t0, tris: { near: tris(nearBark) + tris(nearLeaf), mid: tris(midBark) + tris(midLeaf), crown: tris(crown) }, stems: sk.stems.length, cards: cards.length } };
}
