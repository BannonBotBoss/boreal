/**
 * Overhead crowns (T-0217).
 *
 * Billboard fills of the spruce cards read as flat leaf sprites and do not
 * take the scene sun. These are instanced low-poly crowns (stacked cones for
 * spruce, a low dome for aspen) with MeshStandardMaterial, so the globe sun
 * lights one side and leaves the other dark. A soft decal, offset opposite
 * that sun, is the cast shadow. The ground is a procedural litter/moss shader
 * in world metres, not a repeated lattice.
 *
 * Crown diameter follows the stand spacing. At 52 N, 97 W the cover sample is
 * boreal, about 2439 stems/ha, so mean spacing is 100/sqrt(2439) = 2.0 m.
 * A closed crown wider than that spacing is a disc bigger than the tree.
 * Viereck & Johnston 1990 (Silvics, Picea mariana): the crown is a narrow
 * spire. Spruce diameters here are 1.6–3.2 m. The few aspen are 3.2–5.4 m.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FAR_TREES, farTreesInTile } from '../../core/flora/stands';
import { standAt } from '../../core/stand';
import { worldSec } from '../../core/worldClock';
import { dayAt, hourAt, sunPosition } from '../../core/timeOfDay';
import { GLSL_HASH, GLSL_NOISE } from '../../proc/glsl';
import { hash } from '../../proc/rng';
import { smoothstep } from '../../proc/math';
import { coverSampleLatLon } from '../../world/globe/coverSample';
import { PLANET, coverWeights, toLatLon, type Planet } from '../../world/globe/planet';
import { tangentFrame } from '../../world/globe/landingSite';
import { AERIAL } from '../../world/globe/aerialExemplar';

export const CROWN_CAP = 60000;

export interface CrownSpot { x: number; z: number; slot: number; scale: number; fade: number; group: number }

export function viewSpan(altM: number, fovDeg = 45, aspect = 16 / 9) {
  const hy = Math.max(30, altM) * Math.tan(fovDeg * Math.PI / 360);
  return { hx: hy * Math.max(0.6, aspect), hy };
}

/**
 * Thomas points across the ground the nadir camera can see. `scale` is the
 * crown diameter in metres. `fade` is 1 inside the view and falls with world
 * distance past the corner.
 */
export function collectCrowns(
  hx: number, hy: number,
  stems: (x: number, z: number) => number,
  dry: (x: number, z: number) => number = () => 1,
  cover: (x: number, z: number) => number = () => 1,
): CrownSpot[] {
  if (!(hx > 1) || !(hy > 1)) return [];
  const T = FAR_TREES.tile;
  const spots: CrownSpot[] = [];
  const corner = Math.hypot(hx, hy);
  const pad = 8;
  const tx0 = Math.floor((-hx - pad) / T) - 1, tx1 = Math.ceil((hx + pad) / T) + 1;
  const tz0 = Math.floor((-hy - pad) / T) - 1, tz1 = Math.ceil((hy + pad) / T) + 1;
  for (let tz = tz0; tz <= tz1; tz++) for (let tx = tx0; tx <= tx1; tx++) {
    for (const p of farTreesInTile(tx, tz, 1, stems, dry)) {
      const dist = Math.hypot(p.x, p.z);
      if (dist > corner * 1.15) continue;
      const c = Math.max(0, Math.min(1, cover(p.x, p.z)));
      if (c < 0.22) continue;
      const h = hash(`ov:${Math.round(p.x)}:${Math.round(p.z)}`);
      if ((h % 1000) / 1000 > c * 0.42) continue;
      const u = (h % 10000) / 10000;
      const aspen = c > 0.6 && h % 11 === 0;
      const group = aspen ? 2 : h % 5 === 0 ? 1 : 0;
      // Visible clumps in the Esri/NAIP frame are about 3–6 m. Stem spacing at
      // 2439/ha is 2.0 m, so these crowns overlap, which is a closed canopy.
      const base = aspen ? 4.5 + u * 2.5 : 3.0 + u * 2.4;
      const fade = 1 - smoothstep(corner * 1.02, corner * 1.15, dist);
      spots.push({ x: p.x, z: p.z, slot: h % 2, scale: base, fade, group });
    }
  }
  if (spots.length <= CROWN_CAP) return spots;
  const keep = CROWN_CAP / spots.length;
  const kept = spots.filter(s => (hash(`keep:${Math.round(s.x)}:${Math.round(s.z)}`) % 100000) / 100000 < keep);
  return kept.slice(0, CROWN_CAP);
}

/**
 * Closed-stand weight from `coverWeights`. Canopy near 1 and shore near 0 is
 * forest. Shore is capped at 0.30, so a whole ridge sits on that cap. The
 * stand mottle that already feeds the shore term (planet.ts, ~150 m) is what
 * still varies inside the cap: high mottle on that outcrop is a meadow,
 * hundreds of metres is not the whole ridge. Fen that has already lowered
 * canopy opens as well. `collectCrowns` drops a stem below 0.22.
 */
export function standDensity(canopy: number, shore: number, mottle = 0.5) {
  const outcrop = smoothstep(0.20, 0.28, shore) * smoothstep(0.58, 0.74, mottle);
  const closed = smoothstep(0.55, 0.92, canopy);
  return Math.max(0, Math.min(1, closed * (1 - outcrop)));
}

interface CoverCell { canopy: number; shore: number; mottle: number; density: number }

function coverField(planet: Planet, east: THREE.Vector3, north: THREE.Vector3, up: THREE.Vector3) {
  const cache = new Map<string, CoverCell>();
  const R = PLANET.radius;
  const p = new THREE.Vector3();
  return (x: number, z: number): CoverCell => {
    const key = `${Math.round(x / 12)}:${Math.round(z / 12)}`;
    const hit = cache.get(key);
    if (hit) return hit;
    p.copy(up).addScaledVector(east, x / R).addScaledVector(north, -z / R).normalize();
    const d = p.toArray() as [number, number, number];
    const s = planet.sampleSurface(d);
    const [canopy, , shore] = coverWeights(s, d);
    const cell: CoverCell = { canopy, shore, mottle: s.mottle, density: standDensity(canopy, shore, s.mottle) };
    cache.set(key, cell);
    return cell;
  };
}

function shadowAway(planet: Planet, east: THREE.Vector3, north: THREE.Vector3) {
  const d = sunPosition(hourAt(worldSec()), dayAt(worldSec())).direction;
  const sun = new THREE.Vector3(...planet.east).multiplyScalar(d.x)
    .addScaledVector(new THREE.Vector3(...planet.home), d.y)
    .addScaledVector(new THREE.Vector3(...planet.north), -d.z);
  let se = sun.dot(east), sn = sun.dot(north);
  const len = Math.hypot(se, sn);
  if (len < 1e-4) return { e: -1, n: 0 };
  return { e: -se / len, n: -sn / len };
}

/** Spruce: three whorls, radius 0.5 so an instance scale is the diameter in metres. Y-up, then laid on Z. */
function spruceGeometry() {
  const parts: THREE.BufferGeometry[] = [];
  const whorl: [number, number, number][] = [[0.50, 0.34, 0], [0.32, 0.28, 0.26], [0.16, 0.22, 0.48]];
  for (const [r, h, z] of whorl) {
    const c = new THREE.ConeGeometry(r, h, 8, 1);
    c.translate(0, z + h * 0.5, 0);
    parts.push(c);
  }
  const geo = mergeGeometries(parts)!;
  geo.rotateX(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function aspenGeometry() {
  const geo = new THREE.SphereGeometry(0.5, 8, 5);
  geo.scale(1, 1, 0.55);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, 0.12);
  geo.computeVertexNormals();
  return geo;
}

function shadowTexture() {
  const n = 64, data = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = (x + 0.5) / n * 2 - 1, v = (y + 0.5) / n * 2 - 1;
    const d = Math.sqrt(u * u * 0.65 + v * v);
    const a = Math.round(255 * Math.max(0, 1 - smoothstep(0.15, 1, d)) * 0.72);
    const i = (y * n + x) * 4;
    data[i] = 22; data[i + 1] = 30; data[i + 2] = 18; data[i + 3] = a;
  }
  const tex = new THREE.DataTexture(data, n, n);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const FLOOR_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * World-metre litter. `uCover` is canopy, shore, mottle from `coverWeights`
 * over the same ground as the crowns. A shore outcrop lightens toward meadow.
 * Nothing multiplies the colour down to black.
 */
const FLOOR_FRAG = `
varying vec2 vUv;
uniform vec2 uSize;
uniform sampler2D uCover;
${GLSL_NOISE}
void main() {
  vec2 m = (vUv - 0.5) * uSize;
  float fine = vnoise(m / 0.55, 1.7);
  float mid = vnoise(m / 2.1 + 4.0, 2.3);
  vec3 moss = vec3(0.20, 0.26, 0.16);
  vec3 litter = vec3(0.24, 0.30, 0.15);
  vec3 grass = vec3(0.28, 0.34, 0.17);
  vec3 c = mix(moss, litter, fine);
  c = mix(c, grass, smoothstep(0.45, 0.8, mid));
  c.r += 0.03 * (vnoise(m / 2.4, 3.1) - 0.5);
  c.b = mix(0.12, 0.22, vnoise(m / 3.1 + 2.0, 4.4));
  vec3 cov = texture2D(uCover, vUv).rgb;
  float canopy = cov.r;
  float shore = cov.g;
  float mottle = cov.b;
  float open = max(smoothstep(0.20, 0.28, shore) * smoothstep(0.58, 0.74, mottle), 1.0 - smoothstep(0.55, 0.90, canopy));
  vec3 meadow = vec3(0.22, 0.28, 0.15);
  c = mix(c, meadow, open * 0.85);
  float grain = hash2s(m, 7.0);
  c *= 0.78 + 0.44 * grain;
  gl_FragColor = vec4(c, 1.0);
}
`;

export interface OverheadCrowns {
  group: THREE.Group;
  update(dir: THREE.Vector3, altM: number, surfaceR: number, planet: Planet, aspect: number, fovDeg: number, camera: THREE.Camera): number;
  dispose(): void;
}

export function createOverheadCrowns(_renderer: THREE.WebGLRenderer): OverheadCrowns {
  const group = new THREE.Group();
  group.name = 'overhead-crowns';
  const COVER_N = 160;
  const coverData = new Uint8Array(COVER_N * COVER_N * 4);
  const coverTex = new THREE.DataTexture(coverData, COVER_N, COVER_N);
  coverTex.magFilter = THREE.LinearFilter;
  coverTex.minFilter = THREE.LinearFilter;
  coverTex.wrapS = THREE.ClampToEdgeWrapping;
  coverTex.wrapT = THREE.ClampToEdgeWrapping;
  coverTex.needsUpdate = true;
  const floorMat = new THREE.ShaderMaterial({
    uniforms: { uSize: { value: new THREE.Vector2(1, 1) }, uCover: { value: coverTex } },
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat);
  floor.name = 'overhead-floor';
  floor.renderOrder = 0.5;
  floor.frustumCulled = false;
  floor.visible = false;
  group.add(floor);

  const shadows = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: shadowTexture(), alphaTest: 0.2, transparent: false, depthWrite: false, depthTest: false, side: THREE.DoubleSide,
    }),
    CROWN_CAP,
  );
  shadows.name = 'overhead-shadows';
  shadows.renderOrder = 1;
  shadows.frustumCulled = false;
  shadows.count = 0;
  group.add(shadows);

  // Summer boreal conifer albedo is about 0.08 (Betts & Ball 1997, JGR 102, 28901).
  // Linear RGB, green a little above red and blue. A small sky-coloured emissive
  // holds the shade; the brighter side is still the scene sun.
  const spruceMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.05, 0.09, 0.05), roughness: 0.94, metalness: 0, emissive: new THREE.Color().setRGB(0.016, 0.028, 0.018), emissiveIntensity: 1, side: THREE.DoubleSide, depthTest: false });
  const aspenMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(0.07, 0.10, 0.045), roughness: 0.92, metalness: 0, emissive: new THREE.Color().setRGB(0.028, 0.036, 0.020), emissiveIntensity: 1, side: THREE.DoubleSide, depthTest: false });
  const grain = `
    float crownGrain = hash2s(gl_FragCoord.xy, 3.0);
    diffuseColor.rgb *= 0.45 + 0.55 * crownGrain;
  `;
  for (const mat of [spruceMat, aspenMat]) {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\n' + GLSL_HASH)
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + grain);
    };
  }
  const spruce = new THREE.InstancedMesh(spruceGeometry(), spruceMat, CROWN_CAP);
  const aspen = new THREE.InstancedMesh(aspenGeometry(), aspenMat, CROWN_CAP);
  for (const mesh of [spruce, aspen]) {
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CROWN_CAP * 3), 3);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  const pub = { count: 0, alt: 0 };
  (globalThis as { __crowns?: typeof pub }).__crowns = pub;
  const m4 = new THREE.Matrix4(), s = new THREE.Vector3();
  const east = new THREE.Vector3(), north = new THREE.Vector3(), up = new THREE.Vector3(), at = new THREE.Vector3();
  const ax = new THREE.Vector3(), ay = new THREE.Vector3();
  const flat = new THREE.Quaternion(), shQ = new THREE.Quaternion();
  let key = '';

  function update(dir: THREE.Vector3, altM: number, surfaceR: number, planet: Planet, aspect: number, fovDeg: number, camera: THREE.Camera) {
    pub.alt = altM;
    const show = altM > 180 && altM < 2200;
    if (!show) {
      AERIAL.uCrownFloor.value = 0;
      floor.visible = false; spruce.count = 0; aspen.count = 0; shadows.count = 0; pub.count = 0;
      return 0;
    }
    const ll = toLatLon([dir.x, dir.y, dir.z]);
    const lat = ll.lat * 180 / Math.PI, lon = ll.lon * 180 / Math.PI;
    const span = viewSpan(altM, fovDeg, aspect);
    const next = `${lat.toFixed(3)}:${lon.toFixed(3)}:${Math.round(altM / 40)}:${span.hx.toFixed(0)}`;
    if (next === key && spruce.count + aspen.count > 0) return pub.count;
    key = next;
    const cover = coverSampleLatLon(lat, lon);
    // Prairie and desert are grass. A 5% tree share still threw conifer cards
    // across the 2000 m frame, and the screen-space grain read as salt.
    // Stipa at the feet is steppeTuft, not these crowns.
    if (cover.water || cover.treeShare <= 0 || cover.biome === 'prairie' || cover.biome === 'desert') {
      AERIAL.uCrownFloor.value = 0;
      floor.visible = false; spruce.count = 0; aspen.count = 0; shadows.count = 0; pub.count = 0;
      return 0;
    }
    AERIAL.uCrownFloor.value = 1;
    const frame = tangentFrame([dir.x, dir.y, dir.z]);
    east.set(...frame.east); north.set(...frame.north); up.set(...frame.dir);
    flat.setFromRotationMatrix(new THREE.Matrix4().makeBasis(east, north, up));
    const field = coverField(planet, east, north, up);
    const spots = collectCrowns(span.hx, span.hy, (x, z) => standAt(x, z).stems * cover.treeShare, () => 1, (x, z) => field(x, z).density);
    const cam = camera.position;
    floor.visible = true;
    floor.quaternion.copy(flat);
    floor.position.copy(up).multiplyScalar(surfaceR).sub(cam);
    const sizeX = span.hx * 2.4, sizeY = span.hy * 2.4;
    floor.scale.set(sizeX, sizeY, 1);
    floorMat.uniforms.uSize.value.set(sizeX, sizeY);
    for (let j = 0; j < COVER_N; j++) {
      const v = (j + 0.5) / COVER_N;
      const z = (0.5 - v) * sizeY;
      for (let i = 0; i < COVER_N; i++) {
        const u = (i + 0.5) / COVER_N;
        const cell = field((u - 0.5) * sizeX, z);
        const o = (j * COVER_N + i) * 4;
        coverData[o] = Math.round(cell.canopy * 255);
        coverData[o + 1] = Math.round(cell.shore * 255);
        coverData[o + 2] = Math.round(cell.mottle * 255);
        coverData[o + 3] = 255;
      }
    }
    coverTex.needsUpdate = true;
    const away = shadowAway(planet, east, north);
    ax.copy(east).multiplyScalar(away.e).addScaledVector(north, away.n).normalize();
    ay.copy(up).cross(ax).normalize();
    shQ.setFromRotationMatrix(m4.makeBasis(ax, ay, up));
    let ns = 0, na = 0, nsh = 0;
    for (const spot of spots) {
      if (spot.fade < 0.04) continue;
      const mesh = spot.group === 2 ? aspen : spruce;
      const i = spot.group === 2 ? na++ : ns++;
      if (i >= CROWN_CAP) continue;
      at.copy(up).multiplyScalar(surfaceR).addScaledVector(east, spot.x).addScaledVector(north, -spot.z);
      at.setLength(surfaceR + 0.4);
      at.sub(cam);
      const d = spot.scale;
      m4.compose(at, flat, s.set(d, d, d * 1.6));
      mesh.setMatrixAt(i, m4);
      const jitter = 0.5 + (hash(`j:${spot.x}:${spot.z}`) % 50) / 100;
      const red = 0.65 + (hash(`r:${spot.x}:${spot.z}`) % 60) / 100;
      const blue = 0.3 + (hash(`b:${spot.x}:${spot.z}`) % 95) / 100;
      // Closed canopy (low shore) is the darker patch. An outcrop edge stays lighter.
      const cell = field(spot.x, spot.z);
      const shade = 0.88 + 0.12 * smoothstep(0.05, 0.28, cell.shore);
      mesh.instanceColor!.setXYZ(i, jitter * red * shade, jitter * shade, jitter * blue * shade);
      const sh = at.clone().addScaledVector(ax, d * 0.62);
      m4.compose(sh, shQ, s.set(d * 0.55, d * 0.38, 1));
      shadows.setMatrixAt(nsh, m4);
      nsh++;
    }
    spruce.count = ns; aspen.count = na; shadows.count = nsh;
    for (const mesh of [spruce, aspen, shadows]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    pub.count = ns + na;
    return pub.count;
  }

  return {
    group, update,
    dispose() {
      group.traverse(o => {
        const m = o as THREE.Mesh;
        if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      });
    },
  };
}
