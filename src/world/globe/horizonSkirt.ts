/**
 * Horizon skirt (issue #156). Concentric rings around the drone, from just under the
 * chunk patch out to the geometric horizon, in the game's tangent frame.
 *
 * The height and the colour are the planet the globe tiles already sample
 * (planet.sampleSurface, surfaceColour). Earth curvature drops the rings below the
 * tangent plane so the horizon sits at eye level. The chunk terrain keeps the near
 * ground; these rings are what shows once that patch dithers out, and the outer ring
 * dithers back into the globe.
 *
 * Horizon distance is the line-of-sight length to the tangent point,
 * sqrt((R+h)^2 − R^2) = sqrt(2 R h + h^2) (straight-line, equal to the gnomonic
 * radius of that point). The drop of the sphere below the tangent plane at gnomonic
 * distance r is R − R^2 / sqrt(R^2 + r^2). At r = horizon(h) that drop is h R / (R+h),
 * which is h within a metre for any drone height.
 */
import { SITE, siteDirection } from '../../core/sitePhase';
import { smoothstep } from '../../proc/math';
import { GLOBE_COLOURS, PLANET, surfaceColour, toLatLon, type Planet, type Vec3 } from './planet';

export const HORIZON_SKIRT = {
  /** Metres. Inside this the chunk meshes own the ground. The first ring starts here so the dither has something under it. */
  innerM: 28,
  /** Around each ring. The draw cap below shrinks this if a tall eye would pass the budget. */
  segments: 64,
  /** Radial steps between each doubling of the radius. */
  radials: 2,
  /**
   * Triangles for the whole skirt. Ultra globe tiles are 160 × 48² × 2 ≈ 737k
   * (GLOBE_LOD). Quest guidance in core/quality is about 750k triangles an eye.
   * The skirt is one extra draw in the game pass, on top of those tiles in the far layer.
   */
  maxTriangles: 6000,
  /** Rebuild when the camera crosses this many metres, or the eye height changes a band. */
  snapM: 40,
  /** The chunk fade disc is this times the loaded radius, so the square corners fall inside the dither. */
  discCover: 1.5,
};

/** Line-of-sight metres to the horizon from an eye `eyeM` above the surface. */
export function horizonMetres(eyeM: number, radius = PLANET.radius) {
  const h = Math.max(0, eyeM);
  return Math.sqrt(Math.max(0, 2 * radius * h + h * h));
}

/** Drop of the sphere below the tangent plane at gnomonic distance `r` (m). 0 at the origin. */
export function curvatureDrop(r: number, radius = PLANET.radius) {
  const R = radius;
  const d = Math.max(0, r);
  return R - (R * R) / Math.sqrt(R * R + d * d);
}

export interface SkirtRing { r0: number; r1: number }

/** Doubling rings from `innerM` out past the horizon. The last radius is the horizon plus a little, so a ridge still meets the sky. */
export function skirtRings(eyeM: number, radius = PLANET.radius): SkirtRing[] {
  const horizon = horizonMetres(eyeM, radius);
  const outer = Math.max(HORIZON_SKIRT.innerM * 4, horizon * 1.08);
  const rings: SkirtRing[] = [];
  let r = HORIZON_SKIRT.innerM;
  while (r < outer - 0.5 && rings.length < 24) {
    const r1 = Math.min(outer, r * 2);
    rings.push({ r0: r, r1 });
    if (r1 <= r) break;
    r = r1;
  }
  return rings;
}

/** Unique radii, shared boundaries included once. */
export function skirtRadii(rings: readonly SkirtRing[], radials = HORIZON_SKIRT.radials): number[] {
  if (!rings.length) return [];
  const out = [rings[0].r0];
  for (const ring of rings) {
    for (let k = 1; k <= radials; k++) out.push(ring.r0 + (ring.r1 - ring.r0) * (k / radials));
  }
  return out;
}

export function skirtTriangles(rows: number, segments: number) {
  return Math.max(0, rows - 1) * segments * 2;
}

/** Segment count that stays inside the triangle cap. Never below 24. */
export function skirtSegments(rows: number, want = HORIZON_SKIRT.segments, cap = HORIZON_SKIRT.maxTriangles) {
  let segments = want;
  while (skirtTriangles(rows, segments) > cap && segments > 24) segments -= 4;
  return segments;
}

export interface SkirtPlace { y: number; rgb: [number, number, number]; fade: number }

export interface SkirtMeshData {
  position: Float32Array;
  normal: Float32Array;
  color: Float32Array;
  fade: Float32Array;
  index: Uint32Array;
  triangles: number;
  rows: number;
  segments: number;
  outerM: number;
}

/**
 * Build the ring mesh centred on (cx, cz). `place` returns the tangent-plane height
 * (no curvature) and the linear albedo. This function subtracts the sphere drop and
 * sets the outer fade so the last band can dither into the globe.
 */
export function buildSkirtMesh(
  cx: number, cz: number, eyeM: number,
  place: (x: number, z: number) => { y: number; rgb: [number, number, number] },
  radius = PLANET.radius,
  /** Drop a quad when this returns false. Used to omit the ground behind the camera: a ring
   *  triangle that straddles the near plane smears across the sky. */
  keep: (x: number, z: number, ringR: number) => boolean = () => true,
): SkirtMeshData {
  const rings = skirtRings(eyeM, radius);
  const radii = skirtRadii(rings);
  const rows = radii.length;
  const segments = skirtSegments(rows);
  const outer = radii[rows - 1] ?? HORIZON_SKIRT.innerM;
  const count = rows * segments;
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const fade = new Float32Array(count);
  const fade0 = outer * 0.9;
  for (let row = 0; row < rows; row++) {
    const rr = radii[row];
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const x = cx + Math.cos(theta) * rr;
      const z = cz + Math.sin(theta) * rr;
      const p = place(x, z);
      const i = row * segments + s;
      position[i * 3] = x;
      position[i * 3 + 1] = p.y - curvatureDrop(Math.hypot(x, z), radius);
      position[i * 3 + 2] = z;
      color[i * 3] = p.rgb[0]; color[i * 3 + 1] = p.rgb[1]; color[i * 3 + 2] = p.rgb[2];
      const dist = Math.hypot(x - cx, z - cz);
      fade[i] = 1 - smoothstep(fade0, outer, dist);
    }
  }
  // Coarse rings lie about their slope: a chord across a few kilometres tilts the
  // geometric normal and the sun paints wedges. The planet up is the lighting normal.
  // Relief still shows in the vertex colour and in the silhouette against the sky.
  const normal = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) normal[i * 3 + 1] = 1;
  const used: number[] = [];
  for (let row = 0; row < rows - 1; row++) {
    const ringR = radii[row + 1];
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      const a = row * segments + s;
      const b = row * segments + s1;
      const d = (row + 1) * segments + s;
      const c = (row + 1) * segments + s1;
      const corners = [a, b, c, d];
      if (corners.some(v => !keep(position[v * 3], position[v * 3 + 2], ringR))) continue;
      // A (inner) -> B (inner, next angle) -> C (outer, next) is CCW from +Y.
      used.push(a, b, c, a, c, d);
    }
  }
  const index = new Uint32Array(used);
  return { position, normal, color, fade, index, triangles: used.length / 3, rows, segments, outerM: outer };
}

export interface SkirtOrigin { asl: number; gameY: number; remote: boolean }

/** Copy what sampleSurface returns. The planet reuses one result object. */
function shownAsl(h: number, water: number) {
  return water > -1e8 ? Math.max(h, water) : h;
}

/**
 * Tangent-plane height and linear albedo at a game (x, z).
 * `origin.asl` is the planet height the game's Y = origin.gameY sits on.
 * At home this matches heightAt inside the home square, because the planet samples that function.
 */
export function skirtSample(planet: Planet, x: number, z: number, origin: SkirtOrigin): { y: number; rgb: [number, number, number]; water: boolean } {
  const dir: Vec3 = origin.remote ? siteDirection(x, z, PLANET.radius) : planet.fromLocal(x, z);
  const s = planet.sampleSurface(dir);
  const asl = shownAsl(s.h, s.water);
  const water = s.kind === 'ocean' || s.kind === 'lake' || s.h < s.level;
  const rgb: [number, number, number] = [0, 0, 0];
  if (water) {
    const c = s.kind === 'ocean' ? GLOBE_COLOURS.shallow : GLOBE_COLOURS.lakeShallow;
    rgb[0] = c[0]; rgb[1] = c[1]; rgb[2] = c[2];
  } else surfaceColour(s, dir, rgb);
  const y = (asl - origin.asl) + origin.gameY;
  return { y, rgb, water };
}

export function skirtOrigin(planet: Planet, gameY: number): SkirtOrigin {
  const dir: Vec3 = SITE.remote ? SITE.dir : planet.home;
  const s = planet.sampleSurface(dir);
  return { asl: shownAsl(s.h, s.water), gameY, remote: SITE.remote };
}

/** Latitude and longitude of a skirt vertex, for a later elevation or imagery sample. */
export function skirtLatLon(planet: Planet, x: number, z: number, remote: boolean) {
  const dir: Vec3 = remote ? siteDirection(x, z, PLANET.radius) : planet.fromLocal(x, z);
  const ll = toLatLon(dir);
  return { latDeg: ll.lat * 180 / Math.PI, lonDeg: ll.lon * 180 / Math.PI, dir };
}

/** How far the chunk dither disc should reach so its circle covers the loaded square. */
export function patchDiscRadius(loadedM: number) {
  return Math.max(HORIZON_SKIRT.innerM, loadedM) * HORIZON_SKIRT.discCover;
}
