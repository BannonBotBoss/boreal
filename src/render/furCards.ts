import * as THREE from 'three';
import type { BodyData, Vec3 } from '../core/body';
import { mulberry32, sampleSurface } from '../core/surfaceSampler';

/**
 * Fur as hair cards: thousands of tiny tapered strips (five vertices, three triangles) scattered over the base skin by an
 * area-weighted seeded sampler. Each card starts at its sample point, rises a little, then bends over to lie along the
 * surface in the direction the fur grows (head → tail on the body, down the legs, up the ears), so it reads as a coat
 * and not as quills. Length and width scale with the skin's per-vertex fur multiplier: short on the muzzle and paws, long on
 * the neck ruff and tail. Each card copies the bone weights of the skin vertex it grows from, so all cards are merged into
 * one SkinnedMesh that deforms with the body. (THREE.InstancedMesh cannot be skinned, hence the merge.)
 */
export interface FurOptions {
  count: number; length: number; width: number; seed: number;
  /** Keep fur off these spheres (eyes). */
  clear?: Array<{ center: Vec3; radius: number }>;
  /** Only grow fur where this is true (portrait: head and neck only). */
  keep?: (p: Vec3) => boolean;
  /** Per-card filter with the bind-pose surface normal and the tube the card grows from (e.g. no fur on the soles). */
  keepCard?: (p: Vec3, n: Vec3, tube: number) => boolean;
  /** Fur size multiplier at a point (0–1). Lets fur shrink gradually toward the edge of the furred region instead of stopping at a line. */
  scaleAt?: (p: Vec3) => number;
  /** How far strands lean out of the skin (1 = game default; lower lies flatter). */
  lean?: number;
  /** Per-point tip tint: strand tips (and partly the middles) blend toward this colour — e.g. a bear's grizzled, silver-blond tips. */
  tipTint?: (p: Vec3) => { color: [number, number, number]; amount: number } | undefined;
  /** Per-point comb: a lay direction and lean that override the skin's (e.g. muzzle fur combed forward, flat). */
  comb?: (p: Vec3) => { lay: Vec3; lean: number } | undefined;
  /** Strand-to-strand brightness variation (default .24). */
  tone?: number;
}
const Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);

/** The two directions a card's segments point: leaning out from the skin at the root, then lying nearly flat toward `lay`. */
export function cardDirections(normal: THREE.Vector3, lay: THREE.Vector3, rand: () => number, lean = 1) {
  const N = normal.clone().normalize();
  let T = lay.clone().addScaledVector(N, -lay.dot(N));
  if (T.lengthSq() < .1) { // surface faces along the fur direction (throat, chest): let the fur fall downward rather than fan out
    const down = new THREE.Vector3(0, -1, 0); T = down.addScaledVector(N, -down.dot(N));
    if (T.lengthSq() < .04) T = new THREE.Vector3().crossVectors(N, X);
  }
  T.normalize().applyAxisAngle(N, (rand() - .5) * .35); // strands are never perfectly parallel
  const e1 = (.5 + .25 * rand()) * lean, e2 = (.1 + .1 * rand()) * lean;
  return {
    tangent: T,
    d1: T.clone().multiplyScalar(Math.cos(e1)).addScaledVector(N, Math.sin(e1)),
    d2: T.clone().multiplyScalar(Math.cos(e2)).addScaledVector(N, Math.sin(e2)),
  };
}

/** Orientation that maps a card's +Y onto `dir` (setFromUnitVectors), then rolls it about `dir` so its face looks out along `normal`. */
function cardFrame(dir: THREE.Vector3, normal: THREE.Vector3) {
  const q = new THREE.Quaternion().setFromUnitVectors(Y, dir);
  const face = Z.clone().applyQuaternion(q), want = normal.clone().addScaledVector(dir, -normal.dot(dir));
  if (want.lengthSq() > 1e-8) {
    want.normalize();
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, Math.atan2(dir.dot(new THREE.Vector3().crossVectors(face, want)), face.dot(want))));
  }
  return q;
}

export function buildFurCards(body: BodyData, o: FurOptions) {
  // Only the triangles inside the region receive fur, so the card budget isn't wasted on the rest of the wolf.
  let tris = body.index;
  if (o.keep || o.scaleAt) {
    const kept: number[] = [];
    for (let t = 0; t < body.index.length; t += 3) {
      const c = [0, 1, 2].map(k => (body.position[body.index[t] * 3 + k] + body.position[body.index[t + 1] * 3 + k] + body.position[body.index[t + 2] * 3 + k]) / 3);
      if ((!o.keep || o.keep([c[0], c[1], c[2]])) && (!o.scaleAt || o.scaleAt([c[0], c[1], c[2]]) > .05)) kept.push(body.index[t], body.index[t + 1], body.index[t + 2]);
    }
    tris = kept;
  }
  // Short fur needs more strands to cover the skin, so triangles with short fur get proportionally more of the cards.
  const weight: number[] = [];
  for (let t = 0; t < tris.length; t += 3) {
    const c = [0, 1, 2].map(k => (body.position[tris[t] * 3 + k] + body.position[tris[t + 1] * 3 + k] + body.position[tris[t + 2] * 3 + k]) / 3);
    const size = Math.max(.15, (body.furLen[tris[t]] + body.furLen[tris[t + 1]] + body.furLen[tris[t + 2]]) / 3 * (o.scaleAt ? o.scaleAt([c[0], c[1], c[2]]) : 1));
    const bare = (body.furLen[tris[t]] + body.furLen[tris[t + 1]] + body.furLen[tris[t + 2]]) / 3 < .03; // lips, tongue, mouth seal: no cards at all
    weight.push(bare ? 0 : 1 / size ** 1.6); // consistent coverage: shorter fur needs more strands per area
  }
  const rand = mulberry32(o.seed), samples = sampleSurface(body.position, tris, o.count, rand, weight), triIndex = tris;
  const uv: number[] = [], sourceTris: number[] = [];
  const position: number[] = [], normal: number[] = [], color: number[] = [], skinIndex: number[] = [], skinWeight: number[] = [], index: number[] = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3(), LAY = new THREE.Vector3(), tmp = new THREE.Vector3();
  const at = (arr: number[], v: number, k: number) => arr[v * 3 + k];
  for (const s of samples) {
    const tri = [triIndex[s.tri * 3], triIndex[s.tri * 3 + 1], triIndex[s.tri * 3 + 2]], bary = [s.u, s.v, s.w];
    P.set(0, 0, 0); N.set(0, 0, 0); LAY.set(0, 0, 0);
    const col = [0, 0, 0]; let furLen = 0, nearest = tri[0], best = -1;
    tri.forEach((v, k) => {
      for (const [target, arr] of [[P, body.position], [N, body.normal], [LAY, body.lay]] as Array<[THREE.Vector3, number[]]>) target.add(tmp.set(at(arr, v, 0), at(arr, v, 1), at(arr, v, 2)).multiplyScalar(bary[k]));
      for (let c = 0; c < 3; c++) col[c] += body.color[v * 3 + c] * bary[k];
      furLen += body.furLen[v] * bary[k];
      if (bary[k] > best) { best = bary[k]; nearest = v; }
    });
    if (o.keep && !o.keep([P.x, P.y, P.z])) continue;
    if (o.keepCard) { const n = N.clone().normalize(); if (!o.keepCard([P.x, P.y, P.z], [n.x, n.y, n.z], body.tube[nearest])) continue; }
    const fade = o.scaleAt ? o.scaleAt([P.x, P.y, P.z]) : 1;
    if (furLen < .03 || fade < .05) continue; // bare skin: nose pad, tongue
    if (o.clear?.some(z => Math.hypot(P.x - z.center[0], P.y - z.center[1], P.z - z.center[2]) < z.radius)) continue;
    N.normalize();
    const combed = o.comb?.([P.x, P.y, P.z]);
    if (combed) LAY.set(...combed.lay);
    const { d1, d2 } = cardDirections(N, LAY, rand, combed ? combed.lean : o.lean ?? 1);
    const L = o.length * furLen * fade * (.8 + .4 * rand()), w = o.width * (.3 + .7 * Math.min(1.3, furLen)) * (.5 + .5 * fade) * (.8 + .4 * rand());
    const q1 = cardFrame(d1, N), q2 = cardFrame(d2, N), s1 = X.clone().applyQuaternion(q1), s2 = X.clone().applyQuaternion(q2);
    const root = P.clone().addScaledVector(N, -.002), mid = root.clone().addScaledVector(d1, L * .5), tip = mid.clone().addScaledVector(d2, L * .5);
    const verts: Array<[THREE.Vector3, number]> = [
      [root.clone().addScaledVector(s1, -w / 2), .55], [root.clone().addScaledVector(s1, w / 2), .55],
      [mid.clone().addScaledVector(s2, -w * .4), .95], [mid.clone().addScaledVector(s2, w * .4), .95],
      [tip, 1.18],
    ];
    const tr = o.tone ?? .24, tone = 1 - tr / 2 + tr * rand(), base = position.length / 3;
    uv.push(0, 0, 1, 0, .1, .5, .9, .5, .5, 1); // strand texture: roots along the bottom, tips meeting at the top
    sourceTris.push(s.tri);
    const tint = o.tipTint?.([P.x, P.y, P.z]), tintAmount = tint ? Math.min(1, tint.amount * (.4 + 1.2 * rand())) : 0;
    for (const [v, shade] of verts) {
      position.push(v.x, v.y, v.z); normal.push(N.x, N.y, N.z);
      const t = tint ? tintAmount * (shade > 1 ? 1 : shade > .9 ? .35 : 0) : 0; // tip fully, middle a little, root never
      for (let c = 0; c < 3; c++) color.push(Math.min(1, col[c] * shade * tone * (1 - t) + (tint ? tint.color[c] * tone * t : 0)));
      for (let k = 0; k < 4; k++) { skinIndex.push(body.skinIndex[nearest * 4 + k]); skinWeight.push(body.skinWeight[nearest * 4 + k]); }
    }
    index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(color, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  geometry.userData.sourceTris = sourceTris; geometry.userData.tris = tris; // which skin triangle each card grew from (tests)
  return geometry;
}

/**
 * Procedural 256×256 strand-clump alpha map: four tapered hairs rising from a shared root, slightly wavy, converging toward the tip.
 * Used with alphaTest (no blending, no sorting), so each card's solid edges break into separate feathered strands.
 */
let strandTexture: THREE.DataTexture | undefined;
export function strandAlpha(size = 256) {
  if (strandTexture) return strandTexture;
  const data = new Uint8Array(size * size * 4), rand = mulberry32(77);
  const strands = [.16, .38, .62, .84].map(u => ({ u: u + (rand() - .5) * .06, phase: rand() * 6, len: .85 + .15 * rand() }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    let a = v < .06 ? 1 : 0; // a solid band at the root so the clump stays attached to the skin
    for (const s of strands) {
      if (v > s.len) continue;
      const centre = s.u + (.5 - s.u) * v * .75 + Math.sin(v * 9 + s.phase) * .012, width = .1 * (1 - v / s.len) ** .7 + .004;
      a = Math.max(a, 1 - Math.abs(u - centre) / width);
    }
    const value = Math.round(Math.max(0, Math.min(1, a * 2.2)) * 255), i = (y * size + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = data[i + 3] = value;
  }
  strandTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  strandTexture.magFilter = THREE.LinearFilter; strandTexture.minFilter = THREE.LinearMipmapLinearFilter; strandTexture.generateMipmaps = true;
  strandTexture.needsUpdate = true;
  return strandTexture;
}

/** Cards are lit with the skin's normal on both faces (no darkened backs), so the coat shades smoothly like a single surface.
 *  Alpha-tested strands: opaque pass with depth writes, so no sorting or blending cost. */
export function furCardMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0, side: THREE.DoubleSide, alphaMap: strandAlpha(), alphaTest: .5, transparent: false, depthWrite: true });
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
  };
  material.customProgramCacheKey = () => 'fur-cards';
  return material;
}
