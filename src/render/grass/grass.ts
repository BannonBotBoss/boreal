/**
 * Procedural grass blades (Grok Bot). PORT of simondevyoutube/Quick_Grass (MIT, @6b56164; baseline in vendor/quick-grass),
 * itself after "Procedural Grass in Ghost of Tsushima" (Eric Wohllaib, GDC 2021). Kept from upstream (names in comments):
 * blade built in the vertex shader from a vertex ID (vertIndex, front + back faces, FrontSide), two blade LODs (segHigh /
 * segLow) with the far half of the high LOD flattening its profile (highLODOut), per-blade lean + curve (rotateX on the
 * height), noise wind lean around a wind axis, player push, rounded normals (two normals rotated ±0.3π, blended across the
 * blade) mixed toward up (skyFadeIn), base-to-tip colour with base darkening (ao), and the view-space thickening hack.
 * Changed for Boreal:
 *  - MeshStandardMaterial via onBeforeCompile (CSM shadows, IBL, fog, cloud shadows, pbr translucency) instead of upstream's
 *    own Phong lighting model; shared hash/noise from proc/glsl (vnoise) instead of upstream murmurHash/noise12.
 *  - Per-blade data (root, angle, length, lean, keep hash, species) comes from the CPU (render/grass/cover: seeded rng,
 *    density field, real species), not a GPU hash over a heightmap texture. Species shape/colour are uniform rows.
 *  - Wind = the shared wind field + clock used by the trees (render/trees WIND_UNIFORMS: same uniform objects); the fall
 *    colour follows the same phenology uniform.
 *  - Tiles (GRASS.tile, aligned to chunks) are built as interest jobs; distance thinning by instanceCount on keep-sorted
 *    instances (keepAt) with width compensation, scaled by the LADDER `foliage` knob. Upstream used fixed 10 m patches.
 *  - Triangle budget (perf audit: ~2.5 M grass triangles at Ultra): one face drawn DoubleSide instead of upstream's front + back
 *    faces; three blade LODs (6 / 3 / 1 segments, the far one a single quad card); thinning, LOD and view-cone culling per
 *    2.5 m cell (GRASS.sub) instead of per 10 m tile, so a tile touching the camera no longer draws all its blades at full detail.
 */
import * as THREE from 'three';
import { GLSL_NOISE } from '../../proc/glsl';
import { addCloudShadow, addTranslucency } from '../pbr';
import { addPatchFade } from '../fade';
import { WIND_UNIFORMS } from '../trees';
import { enqueue, cancel, pending } from '../../core/interest';
import { RENDER } from '../../core/renderSettings';
import { COVER_SPECIES, GRASS, bladesJob, keepAt, type Blades } from './cover';
import { MOSS_GLSL, MOSS_UNIFORMS } from '../flora/moss';

export const GRASS_FX = { off: false }; // bench hook (cost measurement), like TREE_FX
export const GRASS_INFO = { tiles: 0, blades: 0, drawn: 0, culled: 0, tris: 0, lods: [0, 0, 0], sliceMaxMs: 0, packMaxMs: 0, packs: 0 };
(globalThis as { borealGrass?: unknown }).borealGrass = { info: GRASS_INFO, fx: GRASS_FX }; // dev/bench handle (survives Vite HMR module copies)
const K = COVER_SPECIES.length;
const U = {
  uGrass: { value: new THREE.Vector4(GRASS.lodDist, GRASS.full, GRASS.radius, 1) }, // lodDist, full, radius, foliage
  uPlayer: { value: new THREE.Vector3() }, uCamFwd: { value: new THREE.Vector3(0, 0, -1) }, uPx: { value: .001 }, // pixel footprint per metre of distance (2·tan(fov/2) / screen height)
  uShape: { value: COVER_SPECIES.map(s => new THREE.Vector4(s.width, s.profile, s.stem, s.stiff)) },
  uBase: { value: COVER_SPECIES.map(s => new THREE.Vector3(...s.base)) }, uTip: { value: COVER_SPECIES.map(s => new THREE.Vector3(...s.tip)) }, uFall: { value: COVER_SPECIES.map(s => new THREE.Vector3(...s.fall)) },
};
const VERT_HEAD = `#define GRASS_K ${K}
attribute float vertIndex; attribute vec4 aBlade; attribute float aKind;
uniform float uWind, uWindAmp, uColour; uniform vec2 uWindDir; uniform vec4 uGrass; uniform vec3 uPlayer, uCamFwd; uniform float uPx;
uniform vec4 uShape[GRASS_K]; uniform vec3 uBase[GRASS_K]; uniform vec3 uTip[GRASS_K]; uniform vec3 uFall[GRASS_K];
varying vec3 vGrassColour;
${GLSL_NOISE}
${MOSS_GLSL}
float easeOutG(float x, float t) { return 1.0 - pow(1.0 - x, t); }
float easeInG(float x, float t) { return pow(x, t); }
mat3 rotateXG(float t) { float c = cos(t), s = sin(t); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotateYG(float t) { float c = cos(t), s = sin(t); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
vec3 rotA(vec3 v, vec3 a, float t) { return v * cos(t) + cross(a, v) * sin(t) + a * dot(a, v) * (1.0 - cos(t)); } // Rodrigues (upstream rotateAxis)
`;
// Upstream main(), ported. "position" = the blade root (instanced), as upstream (grassOffset).
const VERT_BODY = `
  vec3 root = position;
  float dist = distance(cameraPosition, root);
  float keep = (dist <= uGrass.y ? 1.0 : pow(uGrass.y / dist, 2.0)) * (1.0 - smoothstep(uGrass.z * 0.8, uGrass.z, dist)) * uGrass.w; // cover.keepAt × foliage
  keep *= max(step(dist, 3.0), step(-0.35, dot(root - cameraPosition, uCamFwd) / max(dist, 1e-3))); // one field mesh, no per-tile culling: blades well behind the view collapse
  float alive = step(aBlade.w, keep);
  float highLODOut = smoothstep(uGrass.x * 0.5, uGrass.x, dist);
  int k = int(aKind + 0.5); vec4 sh = uShape[k];
  float GRASS_VERTICES = (GRASS_SEGMENTS + 1.0) * 2.0;
  float vertID = mod(vertIndex, GRASS_VERTICES);
  float zSide = -(floor(vertIndex / GRASS_VERTICES) * 2.0 - 1.0); // 1 = front, -1 = back
  float xSide = mod(vertID, 2.0);
  float heightPercent = (vertID - xSide) / (GRASS_SEGMENTS * 2.0);
  // width profile per species (upstream: grass only, easeOut(1 - h, 2) near / linear far)
  float prof = sh.y < 0.5 ? mix(easeOutG(1.0 - heightPercent, 2.0), 1.0 - heightPercent, highLODOut)
             : sh.y < 1.5 ? 1.0 - heightPercent * 0.9
             : GRASS_SEGMENTS < 3.0 ? 0.6 * (1.0 - heightPercent * 0.8)
             : heightPercent < sh.z ? 0.15 : pow(max(sin(3.14159 * (heightPercent - sh.z) / (1.0 - sh.z)), 0.0), 0.7);
  float grassTotalHeight = aBlade.y * alive * (1.0 - 0.6 * smoothstep(uGrass.z * 0.6, uGrass.z, dist)); // blades settle toward the radius (no rim where the field ends)
  float grassTotalWidth = max(sh.x, 1.5 * uPx * dist) * prof * alive * min(3.0, inversesqrt(max(keep, 0.05))); // ≥ 1.5 px wide (real widths alias away), thinned blades widen to keep the coverage
  float x = (xSide - 0.5) * grassTotalWidth, y = heightPercent * grassTotalHeight;
  // wind: shared field direction + upstream's noise gusts; strength from the shared drag amplitude (trees: (U/4)²)
  float windDir = atan(uWindDir.y, uWindDir.x) + (vnoise(root.xz * 0.05 + 0.05 * uWind, 7.0) - 0.5) * 1.2;
  float windNoiseSample = vnoise(root.xz * 0.25 + uWind, 3.0) * 2.0 - 1.0;
  float windLeanAngle = easeInG(mix(0.25, 1.0, windNoiseSample * 0.5 + 0.5), 2.0) * 1.25 * min(uWindAmp, 1.5) * (1.0 - sh.w) * heightPercent;
  vec3 wd = vec3(cos(windDir), 0.0, sin(windDir)), windAxis = vec3(wd.z, 0.0, -wd.x); // rotA(up, windAxis, +θ) leans along wd
  float distToPlayer = distance(root.xz, uPlayer.xz);
  float playerLeanAngle = 0.6 * smoothstep(1.2, 0.3, distToPlayer) * step(abs(root.y - uPlayer.y), 1.5) * heightPercent; // upstream 0.2 rad over 2.5 m; wolf-sized [game calibration]
  vec2 away = normalize(root.xz - uPlayer.xz + 1e-4); vec3 playerAxis = vec3(away.y, 0.0, -away.x);
  float randomLean = aBlade.z + (vnoise(vec2(uWind * 0.35) + root.xz * 13.7, 5.0) - 0.5) * 0.2; // + leanAnimation
  float easedHeight = mix(easeInG(heightPercent, 2.0), 1.0, highLODOut);
  float curveAmount = -randomLean * easedHeight;
  mat3 face = rotateYG(aBlade.x);
  vec3 p = face * (rotateXG(curveAmount) * vec3(x, y, 0.0));
  p = rotA(rotA(p, windAxis, windLeanAngle), playerAxis, playerLeanAngle);
  vec3 n0 = rotateXG(curveAmount) * vec3(0.0, 0.0, 1.0);
  vec3 nb = face * (rotateYG(3.14159 * 0.3 * (xSide * 2.0 - 1.0) * zSide) * n0) * zSide; // rounded normal (upstream normal1/normal2)
  nb = rotA(rotA(nb, windAxis, windLeanAngle), playerAxis, playerLeanAngle);
  float skyFadeIn = (1.0 - highLODOut) * 0.25; // upstream SKY_RATIO: normals mostly up, so the field shades like the ground
  objectNormal = normalize(mix(vec3(0.0, 1.0, 0.0), nb, skyFadeIn));
  // colour: species base → tip (easeIn 4), seeded shade, fall colour (shared phenology), base darkening (upstream ao)
  float hs = fract(aBlade.w * 91.7), shade = mix(0.75, 1.0, fract(aBlade.w * 37.3));
  float fallT = smoothstep(hs - 0.3, hs + 0.3, uColour);
  vec3 tip = mix(uTip[k], uFall[k], fallT), base = mix(uBase[k], uFall[k] * 0.6, fallT * 0.5);
  float tipMix = sh.y > 1.5 ? step(sh.z, heightPercent) : easeInG(heightPercent, 4.0);
  vGrassColour = mix(base, tip, mix(tipMix, heightPercent, highLODOut)) * shade * mix(0.35, 1.0, easeInG(heightPercent, 2.0));
  float toGround = smoothstep(uGrass.z * 0.5, uGrass.z * 0.85, dist) * step(-0.22, root.y); if (toGround > 0.0) vGrassColour = mix(vGrassColour, groundLayer(soilGround(root.xz), root.xz), toGround); // toward the grass radius land blades take the terrain's soil colour + moss layer; emergent littoral blades in water keep their foliage colour
  vec3 grassPos = root + p;
  float viewDotNormal = clamp(abs(dot(face * vec3(0.0, 0.0, 1.0), normalize(vec3(cameraPosition.x - root.x, 0.0, cameraPosition.z - root.z)))), 0.0, 1.0); // one face, seen from both sides
  float viewSpaceThickenFactor = easeOutG(1.0 - viewDotNormal, 4.0) * smoothstep(0.0, 0.2, viewDotNormal);
`;
const materials = new Map<number, THREE.MeshStandardMaterial>();
function grassMaterial(segments: number) {
  let m = materials.get(segments); if (m) return m;
  m = new THREE.MeshStandardMaterial({ roughness: .9, side: THREE.DoubleSide }); m.userData.shared = true; // one face (template): three flips the normal on the back
  (m as unknown as { defines: Record<string, string> }).defines = { GRASS_SEGMENTS: segments.toFixed(1), TRANSLUCENCY_MASK: '1.0' };
  m.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, U, MOSS_UNIFORMS, { uWind: WIND_UNIFORMS.uWind, uWindDir: WIND_UNIFORMS.uWindDir, uWindAmp: WIND_UNIFORMS.uWindAmp, uColour: WIND_UNIFORMS.uColour });
    addTranslucency(shader); addCloudShadow(shader);
    addPatchFade(shader); m!.userData.patchFade = true; // render/fade (in-page transition): uniform only, same key; BEFORE the project_vertex swap below so its world-xz line follows the custom projection
    shader.vertexShader = VERT_HEAD + shader.vertexShader
      .replace('#include <beginnormal_vertex>', `vec3 objectNormal; ${VERT_BODY}`)
      .replace('#include <begin_vertex>', 'vec3 transformed = grassPos;')
      .replace('#include <project_vertex>', `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
        mvPosition.x += viewSpaceThickenFactor * (xSide - 0.5) * grassTotalWidth * 0.5 * zSide; // upstream "HACK"
        gl_Position = projectionMatrix * mvPosition;`);
    shader.fragmentShader = 'varying vec3 vGrassColour;\n' + shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = vGrassColour;');
  };
  m.customProgramCacheKey = () => `boreal-grass-${segments}`;
  materials.set(segments, m); return m;
}
/** Blade template: vertex IDs + index for ONE face (upstream #CreateGeometry_ built front + back faces for FrontSide; drawn
 * DoubleSide here, which halves triangles and vertex work; zSide in the shader is then always 1). */
const templates = new Map<number, { id: THREE.BufferAttribute; index: THREE.BufferAttribute }>();
function template(segments: number) {
  let t = templates.get(segments); if (t) return t;
  const V = (segments + 1) * 2, idx: number[] = [];
  for (let i = 0; i < segments; i++) { const vi = i * 2; idx.push(vi, vi + 1, vi + 2, vi + 2, vi + 1, vi + 3); }
  t = { id: new THREE.BufferAttribute(Float32Array.from({ length: V }, (_, i) => i), 1), index: new THREE.BufferAttribute(new Uint16Array(idx), 1) };
  templates.set(segments, t); return t;
}
/** ONE instanced mesh per blade LOD for the whole field (perf audit: was 2 meshes per 10 m tile, ~92 objects): kept blades of
 * every tile are packed into one interleaved instance buffer [root xyz, angle, length, lean, keep, species]. Repacked only when
 * a tile's quantised keep count or LOD changes (4 Hz at most), uploading just the used range. */
function fieldMesh(segments: number) {
  const mesh = new THREE.Mesh(new THREE.InstancedBufferGeometry(), grassMaterial(segments)); mesh.name = `grass-${segments}`;
  Object.assign(mesh, { frustumCulled: false, castShadow: false, receiveShadow: true, matrixAutoUpdate: false }); mesh.userData.shadowSet = true; // photoreal: no grass shadow casters (upstream castShadow = false)
  let buf: THREE.InstancedInterleavedBuffer | undefined;
  return { mesh, pack(parts: Float32Array[], total: number) {
    let g = mesh.geometry as THREE.InstancedBufferGeometry;
    if (!buf || buf.count < total) { // grow ×2: a new geometry, so the old GL buffers are released
      g.dispose(); g = new THREE.InstancedBufferGeometry(); const t = template(segments); g.setIndex(t.index); g.setAttribute('vertIndex', t.id);
      buf = new THREE.InstancedInterleavedBuffer(new Float32Array(Math.max(4096, 2 ** Math.ceil(Math.log2(total))) * 8), 8); buf.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(buf, 3, 0)); g.setAttribute('aBlade', new THREE.InterleavedBufferAttribute(buf, 4, 3)); g.setAttribute('aKind', new THREE.InterleavedBufferAttribute(buf, 1, 7));
      mesh.geometry = g; }
    let o = 0; for (const p of parts) { buf.array.set(p, o); o += p.length; }
    buf.clearUpdateRanges(); buf.addUpdateRange(0, o); buf.needsUpdate = true; g.instanceCount = total; mesh.visible = total > 0;
  } };
}
/** Keep share quantised to ~√2 steps, so moving does not repack every update. */
const quant = (k: number) => k >= 1 ? 1 : k <= .01 ? 0 : Math.SQRT2 ** Math.ceil(Math.log(k) / Math.log(Math.SQRT2));

/** The grass field around the camera: tiles within the radius, built by interest jobs, thinned with distance. */
export function createGrass(scene: THREE.Scene) {
  const group = new THREE.Group(); group.name = 'grass'; scene.add(group);
  const tiles = new Map<string, { tx: number; tz: number; b: Blades; id: number }>(), jobs = new Set<string>();
  const SEG = [GRASS.segHigh, GRASS.segMid, GRASS.segLow], lods = SEG.map(fieldMesh); group.add(...lods.map(l => l.mesh));
  const sigS: number[][] = [[], [], []], sigN: number[][] = [[], [], []]; let segs = RENDER.terrainSegments, lastPack = 0, dirty = true, ids = 0;
  function update(camera: THREE.Camera, player: THREE.Vector3, foliage: number, nearRadius: number) {
    const T = GRASS.tile, cx = camera.position.x, cz = camera.position.z, R = Math.min(GRASS.radius * (.68 + .32 * Math.sqrt(foliage)), nearRadius); // never beyond full-res terrain (interest near tier)
    group.visible = !GRASS_FX.off && foliage > 0;
    if (segs !== RENDER.terrainSegments) { segs = RENDER.terrainSegments; tiles.clear(); } // roots follow the terrain lattice
    U.uGrass.value.set(GRASS.lodDist, GRASS.full, R, foliage); U.uPlayer.value.copy(player); const fov = (camera as THREE.PerspectiveCamera).fov ?? 48; U.uPx.value = 2 * Math.tan(fov * Math.PI / 360) / Math.max(1, globalThis.innerHeight ?? 900);
    camera.getWorldDirection(U.uCamFwd.value);
    const sq = (tx: number, tz: number) => Math.hypot(Math.max(tx * T - cx, 0, cx - tx * T - T), Math.max(tz * T - cz, 0, cz - tz * T - T));
    const r = Math.ceil(R / T) + 1, ox = Math.floor(cx / T), oz = Math.floor(cz / T), want = new Set<string>();
    for (let a = ox - r; a <= ox + r; a++) for (let b = oz - r; b <= oz + r; b++) { const d = sq(a, b), key = `${a}:${b}`; if (d > R + T / 2) continue; want.add(key); // keep a half-tile margin (no flicker at the edge)
      if (d <= R && !tiles.has(key) && !pending(`grass:${key}`)) { jobs.add(key); enqueue(`grass:${key}`, d + 5, timedGrass(bladesJob(a, b)), (bl: Blades) => { jobs.delete(key); tiles.set(key, { tx: a, tz: b, b: bl, id: ids++ }); dirty = true; }); } }
    for (const key of [...tiles.keys()]) if (!want.has(key)) { tiles.delete(key); dirty = true; }
    for (const key of [...jobs]) if (!want.has(key)) { cancel(`grass:${key}`); jobs.delete(key); }
    // per 2.5 m cell: distance thinning (keepAt on the cell's nearest point), blade LOD, and a horizontal view cone (half FOV + margin;
    // off when looking steeply down). Cells within 3 m always draw (the player's own patch, camera swings).
    const S = GRASS.sub, C = T / S, f = U.uCamFwd.value, fl = Math.hypot(f.x, f.z), aspect = (camera as THREE.PerspectiveCamera).aspect ?? 16 / 9;
    const cone = fl > .6 ? Math.atan(Math.tan(fov * Math.PI / 360) * aspect) + .35 : Infinity;
    let blades = 0, drawn = 0, culled = 0; const parts: Float32Array[][] = [[], [], []], cnt = [0, 0, 0], hs: number[][] = [[], [], []], hn: number[][] = [[], [], []];
    for (const t of tiles.values()) { const bl = t.b; if (!bl.count) continue; blades += bl.count;
      for (let c = 0; c < S * S; c++) { const a = bl.sub[c], e = bl.sub[c + 1]; if (a === e) continue;
        const bx = t.tx * T + (c % S) * C, bz = t.tz * T + Math.floor(c / S) * C, d = Math.hypot(Math.max(bx - cx, 0, cx - bx - C), Math.max(bz - cz, 0, cz - bz - C));
        if (d > 3 && cone < 4) { const ox = bx + C / 2 - cx, oz = bz + C / 2 - cz, oc = Math.hypot(ox, oz);
          if (Math.acos(Math.max(-1, Math.min(1, (ox * f.x + oz * f.z) / (oc * fl)))) - Math.asin(Math.min(1, C * .75 / oc)) > cone) { culled += e - a; continue; } }
        const n = Math.min(e - a, Math.ceil((e - a) * quant(keepAt(d, R) * foliage))); if (!n) continue;
        const l = d < GRASS.lodNear ? 0 : d < GRASS.lodDist ? 1 : 2; parts[l].push(bl.data.subarray(a * 8, (a + n) * 8)); cnt[l] += n; drawn += n;
        hs[l].push(t.id * 64 + c); hn[l].push(n); } } // per-LOD signatures: which cells, and how many blades of each
    // a LOD mesh repacks at once when its set of cells changes (tiles in/out, LOD or cone crossings), thinning-only changes at most 4×/s
    const tn = performance.now(), thin = tn - lastPack > 250; let packed = false;
    const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
    for (let l = 0; l < 3; l++) if (dirty || !same(hs[l], sigS[l]) || (thin && !same(hn[l], sigN[l]))) { sigS[l] = hs[l]; sigN[l] = hn[l]; lods[l].pack(parts[l], cnt[l]); packed = true; GRASS_INFO.lods[l] = cnt[l]; }
    if (packed) { lastPack = tn; dirty = false; GRASS_INFO.packMaxMs = Math.max(GRASS_INFO.packMaxMs, performance.now() - tn); GRASS_INFO.packs++; GRASS_INFO.tris = GRASS_INFO.lods.reduce((s, n, l) => s + n * SEG[l] * 2, 0); }
    Object.assign(GRASS_INFO, { tiles: tiles.size, blades, drawn, culled });
  }
  return { group, update, tiles: () => tiles.size };
}
/** Slice timer for the perf audit (GRASS_INFO.sliceMaxMs). */
function* timedGrass<T>(g: Generator<unknown, T>): Generator<unknown, T> { for (;;) { const t = performance.now(), r = g.next(); GRASS_INFO.sliceMaxMs = Math.max(GRASS_INFO.sliceMaxMs, performance.now() - t); if (r.done) return r.value; yield; } }
