import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { random } from '../core/random';
import type { Entity } from '../core/world';

/**
 * Stylized boreal forest (Grok Bot). Every 'spruce' entity becomes one of five species picked
 * deterministically from its seed. Geometry is merged per (species, variant, detail), shared by
 * all trees and never disposed, so each tree is one draw call with one shared wind-sway material.
 */
export type TreeSpecies = 'black-spruce' | 'white-spruce' | 'jack-pine' | 'paper-birch' | 'aspen';
const VARIANTS = 6;
export function treeSpecies(seed: number): TreeSpecies {
  const r = random(seed ^ 0x9e3779b9)();
  return r < .30 ? 'black-spruce' : r < .55 ? 'white-spruce' : r < .72 ? 'jack-pine' : r < .87 ? 'paper-birch' : 'aspen';
}

const wind = { value: 0 };
let material: THREE.MeshStandardMaterial | undefined;
function treeMaterial() {
  if (material) return material;
  material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, flatShading: true });
  material.onBeforeCompile = shader => {
    shader.uniforms.uWind = wind;
    shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float windPhase = modelMatrix[3].x * .11 + modelMatrix[3].z * .07;
      float bend = max(position.y, 0.) * max(position.y, 0.) * .0016;
      float gust = .6 + .4 * sin(uWind * .23 + windPhase * .3);
      transformed.x += bend * gust * (sin(uWind * 1.1 + windPhase) + .35 * sin(uWind * 2.7 + windPhase * 1.7));
      transformed.z += bend * gust * .6 * cos(uWind * .9 + windPhase * 1.3);
      // leaf flutter on the crown (birch/aspen get extra via colour-free height term)
      transformed.xz += .025 * bend * 6. * vec2(sin(uWind * 7. + position.y * 3.), cos(uWind * 6.3 + position.x * 4.));`);
  };
  material.customProgramCacheKey = () => 'boreal-tree-wind';
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

function build(species: TreeSpecies, variant: number, detail: number) {
  const rng = random(0x51ab + variant * 7919 + species.length * 104729);
  const parts: THREE.BufferGeometry[] = [], seg = [8, 6, 4][detail];
  const trunk = (h: number, r: number, color: number, bands?: (y: number) => number, lean = 0) =>
    parts.push(painted(new THREE.CylinderGeometry(r * .45, r, h, seg, detail === 0 && bands ? 10 : 1), color, M(0, h / 2, 0, 1, 1, 1, 0, 0, lean), .06, rng, bands));
  const blob = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: THREE.ColorRepresentation) =>
    parts.push(painted(new THREE.IcosahedronGeometry(1, detail === 0 ? 1 : 0), color, M(x, y, z, sx, sy, sz, rng(), rng() * 6, rng()), .12, rng));
  if (species === 'black-spruce' || species === 'white-spruce') {
    const black = species === 'black-spruce';
    const h = black ? 8 + rng() * 5 : 10 + rng() * 6, w = black ? .9 + rng() * .4 : 1.9 + rng() * .8;
    const green = black ? new THREE.Color(0x1f3b2f) : new THREE.Color(0x2e5a4a).offsetHSL((rng() - .5) * .03, 0, 0);
    trunk(h * .96, black ? .16 : .26, 0x4e3a2c);
    const tiers = detail === 2 ? 2 : detail === 1 ? 5 : black ? 11 : 9;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers, y = h * (.16 + .8 * t), radius = w * (1 - t * .88) * (.85 + rng() * .3);
      const tall = h * (detail === 2 ? .5 : black ? .2 : .24);
      // drooping skirts: cone with an offset so tiers overlap like layered boughs
      parts.push(painted(new THREE.ConeGeometry(radius, tall, seg + (detail === 0 ? 2 : 0)), green.clone().offsetHSL(0, 0, (t - .5) * .05),
        M((rng() - .5) * .12, y, (rng() - .5) * .12, 1, 1, 1, (rng() - .5) * .08, rng() * 6, (rng() - .5) * .08), .07, rng));
    }
    if (black && detail < 2) blob(0, h * .97, 0, .38, .7, .38, green.clone().offsetHSL(0, 0, -.02)); // club top
  } else if (species === 'jack-pine') {
    const h = 9 + rng() * 5, lean = (rng() - .5) * .12;
    trunk(h, .22, 0x6a4a35, undefined, lean);
    const clumps = detail === 2 ? 3 : detail === 1 ? 5 : 8;
    for (let i = 0; i < clumps; i++) {
      const a = rng() * Math.PI * 2, y = h * (.55 + rng() * .42), d = .4 + rng() * 1.2;
      const cx = Math.cos(a) * d - lean * y, cz = Math.sin(a) * d;
      if (detail === 0) parts.push(painted(new THREE.CylinderGeometry(.04, .07, d, 4), 0x5c4130, M(cx / 2, y - .2, cz / 2, 1, 1, 1, 0, -a, Math.PI / 2 - .3)));
      blob(cx, y, cz, .9 + rng() * .6, .45 + rng() * .25, .9 + rng() * .6, new THREE.Color(0x3d5e33).offsetHSL((rng() - .5) * .04, 0, 0));
    }
  } else {
    const birch = species === 'paper-birch';
    const h = birch ? 8 + rng() * 4 : 9 + rng() * 5, lean = (rng() - .5) * (birch ? .2 : .06);
    const marks = Array.from({ length: 12 }, () => rng());
    const bands = (y: number) => { const m = marks[Math.min(11, Math.max(0, Math.floor(y / h * 12)))]; return y < .4 ? .55 : m < (birch ? .35 : .2) ? (birch ? .28 : .7) : 1; };
    trunk(h, birch ? .17 : .15, birch ? 0xe8e4da : 0xb9c2a8, bands, lean);
    const leaf = birch ? 0x6f9a3c : 0x8cab3e;
    const n = detail === 2 ? 3 : detail === 1 ? 6 : 11;
    for (let i = 0; i < n; i++) {
      const t = rng(), y = h * (birch ? .5 : .55) + t * h * .45, spread = (birch ? 1.6 : 1.0) * (1 - t * .5);
      const a = rng() * Math.PI * 2;
      blob(Math.cos(a) * spread * rng() - lean * y, y, Math.sin(a) * spread * rng(), .9 + rng() * .5, .8 + rng() * .5, .9 + rng() * .5,
        new THREE.Color(leaf).offsetHSL((rng() - .5) * .05, 0, (rng() - .5) * .08));
    }
  }
  const merged = mergeGeometries(parts)!; parts.forEach(p => p.dispose());
  merged.computeBoundingSphere(); return merged;
}

/** One LOD level of a tree: a single shared-geometry mesh, flagged so disposeObject skips it. */
export function treeGeometry(entity: Entity, detail: number): THREE.Group {
  const species = treeSpecies(entity.seed), variant = (entity.seed >>> 3) % VARIANTS, key = `${species}:${variant}:${detail}`;
  let geometry = cache.get(key); if (!geometry) cache.set(key, geometry = build(species, variant, detail));
  const mesh = new THREE.Mesh(geometry, treeMaterial()); mesh.userData.shared = true;
  mesh.onBeforeRender = () => { wind.value = performance.now() / 1000; };
  const group = new THREE.Group(); group.add(mesh);
  const s = random(entity.seed)();
  group.scale.set(entity.scale, entity.scale * (.9 + s * .2), entity.scale); group.rotation.y = entity.rotation;
  return group;
}
