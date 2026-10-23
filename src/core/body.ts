/**
 * Procedural body skin. A body is a list of tubes (elliptical rings swept along a path). Each ring says which
 * bones move it and by how much, so neighbouring tubes blend smoothly at joints. This is the low-poly base mesh;
 * fur cards (core/furCards.ts) are laid over it. No THREE dependency, so the maths can be tested; render code
 * turns the arrays into a skinned mesh.
 */
export type Vec3 = [number, number, number];
export type RGB = [number, number, number];

export interface Ring {
  /** Centre in model space at the bind (straight) pose. */
  p: Vec3;
  /** Half-widths along the ring's side and up axes. */
  rx: number; ry: number;
  /** Bone influences [boneIndex, weight]; normalised on build, at most four. */
  w: Array<[number, number]>;
  /** 0–1 blend toward the tube's `dark` colour (nose, paws, tail tip, ear tips). */
  dark?: number;
  /** Fur length multiplier (1 = base coat). Ruff and tail are longer, face and paws shorter. */
  fur?: number;
  /** 0–1 push toward the pale (belly) colour all round: cheeks, muzzle sides, lower legs. */
  pale?: number;
  /** 0–1 push toward the dark colour on the upper surface only: the dark saddle along the back and tail. */
  saddle?: number;
  /** 0–1 blend toward the tube's `accent` colour (rust-tan brows, cheeks and bridge). */
  accent?: number;
  /** 0–1 blend toward the belly colour along the two side edges of the ring (|side| > .7): pale rims of flat ears. */
  rim?: number;
  /** 0–1 blend toward the tube's `lining` colour on the upper (top) or lower (under) surface: mouth roof, gums, jaw floor. */
  top?: number; under?: number;
  /** Squareness of the ring's cross-section: 2 is an ellipse, 3 a rounded box with a flat top (muzzle bridge). Default 2. */
  sq?: number;
}
export interface Tube {
  rings: Ring[];
  radial?: number;
  /** Extra rings between each pair, placed on a smooth curve (Catmull–Rom). Default 0. */
  smooth?: number;
  back: RGB; belly: RGB; dark: RGB; accent?: RGB; lining?: RGB;
  /** Direction the fur lies (projected onto the surface). Default toward the tail, +z. Legs lie downward, ears upward. */
  lay?: Vec3;
  /** Which way the ring's thin axis points (default up; vertical tubes use forward). Ears use it to face forward and outward. */
  ref?: Vec3;
  /** Round the ends so the tube is closed. Default true for both. */
  capStart?: boolean; capEnd?: boolean;
}
export interface BodyData {
  position: number[]; normal: number[]; color: number[]; rest: number[]; flow: number[]; furLen: number[]; lay: number[];
  /** Which tube (index in the input list) each vertex belongs to. */
  tube: number[];
  skinIndex: number[]; skinWeight: number[]; index: number[];
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: Vec3): Vec3 => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Adds round end rings: a slightly smaller ring just beyond the end, then a near-point ring. */
function capped(rings: Ring[], start: boolean, end: boolean): Ring[] {
  const out = rings.slice();
  const cap = (at: Ring, toward: Ring) => {
    const t = unit(sub(at.p, toward.p)), r = (at.rx + at.ry) / 2;
    return [{ ...at, p: [at.p[0] + t[0] * r * .3, at.p[1] + t[1] * r * .3, at.p[2] + t[2] * r * .3] as Vec3, rx: at.rx * .8, ry: at.ry * .8 },
      { ...at, p: [at.p[0] + t[0] * r * .55, at.p[1] + t[1] * r * .55, at.p[2] + t[2] * r * .55] as Vec3, rx: at.rx * .3, ry: at.ry * .3 },
      { ...at, p: [at.p[0] + t[0] * r * .62, at.p[1] + t[1] * r * .62, at.p[2] + t[2] * r * .62] as Vec3, rx: at.rx * .02, ry: at.ry * .02 }];
  };
  if (end && out.length > 1) out.push(...cap(out[out.length - 1], out[out.length - 2]));
  if (start && out.length > 1) out.unshift(...cap(out[0], out[1]).reverse());
  return out;
}

/** Catmull–Rom through p1 → p2 at t, with neighbours p0 and p3. */
const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) =>
  .5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

/** Adds `n` smooth rings between each pair: position, radii on a Catmull–Rom curve, everything else blended linearly. */
function smoothed(rings: Ring[], n: number): Ring[] {
  if (n <= 0 || rings.length < 2) return rings;
  const out: Ring[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1], p0 = rings[Math.max(0, i - 1)], p3 = rings[Math.min(rings.length - 1, i + 2)];
    for (let k = 0; k < n + 1; k++) {
      const t = k / (n + 1), lerp = (x?: number, y?: number) => mix(x ?? 0, y ?? 0, t);
      const weights = new Map<number, number>();
      for (const [bone, w] of a.w) weights.set(bone, (weights.get(bone) ?? 0) + w * (1 - t));
      for (const [bone, w] of b.w) weights.set(bone, (weights.get(bone) ?? 0) + w * t);
      out.push({
        p: [0, 1, 2].map(c => catmull(p0.p[c], a.p[c], b.p[c], p3.p[c], t)) as Vec3,
        rx: Math.max(1e-4, catmull(p0.rx, a.rx, b.rx, p3.rx, t)), ry: Math.max(1e-4, catmull(p0.ry, a.ry, b.ry, p3.ry, t)),
        w: [...weights.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4),
        dark: lerp(a.dark, b.dark), fur: mix(a.fur ?? 1, b.fur ?? 1, t), pale: lerp(a.pale, b.pale), saddle: lerp(a.saddle, b.saddle), accent: lerp(a.accent, b.accent), rim: lerp(a.rim, b.rim), top: lerp(a.top, b.top), under: lerp(a.under, b.under), sq: mix(a.sq ?? 2, b.sq ?? 2, t),
      });
    }
  }
  out.push(rings[rings.length - 1]);
  return out;
}

export function buildBody(tubes: Tube[]): BodyData {
  const d: BodyData = { position: [], normal: [], color: [], rest: [], flow: [], furLen: [], lay: [], tube: [], skinIndex: [], skinWeight: [], index: [] };
  tubes.forEach((tube, tubeIndex) => {
    const R = tube.radial ?? 10, rings = capped(smoothed(tube.rings, tube.smooth ?? 0), tube.capStart !== false, tube.capEnd !== false), base = d.position.length / 3;
    const lay = unit(tube.lay ?? [0, 0, 1]);
    rings.forEach((ring, i) => {
      const t = unit(sub(rings[Math.min(rings.length - 1, i + 1)].p, rings[Math.max(0, i - 1)].p));
      // Side/up frame. Vertical tubes (legs) use −z as the reference so their "up" faces forward.
      const ref: Vec3 = tube.ref ?? (Math.abs(t[1]) > .9 ? [0, 0, -1] : [0, 1, 0]);
      const side = unit(cross(t, ref)), up = cross(side, t);
      const ws = ring.w.slice(0, 4), total = ws.reduce((s, [, w]) => s + w, 0) || 1;
      for (let j = 0; j < R; j++) {
        const a = j / R * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
        const e = 2 / (ring.sq ?? 2), cc = Math.sign(c) * Math.abs(c) ** e, ss = Math.sign(s) * Math.abs(s) ** e;
        const dir: Vec3 = [side[0] * cc * ring.rx + up[0] * ss * ring.ry, side[1] * cc * ring.rx + up[1] * ss * ring.ry, side[2] * cc * ring.rx + up[2] * ss * ring.ry];
        const p: Vec3 = [ring.p[0] + dir[0], ring.p[1] + dir[1], ring.p[2] + dir[2]];
        d.position.push(...p); d.rest.push(...p);
        // Colour: back → belly by how far down the surface faces, then toward the dark colour.
        const n = unit(dir), down = clamp01(-n[1] * 1.4 + .1), upper = clamp01(n[1] * 1.3), dark = ring.dark ?? 0;
        for (let k = 0; k < 3; k++) {
          let col = mix(tube.back[k], tube.belly[k], down);
          col = mix(col, tube.belly[k], ring.pale ?? 0);
          col = mix(col, (tube.accent ?? tube.back)[k], ring.accent ?? 0);
          col = mix(col, tube.dark[k], (ring.saddle ?? 0) * upper * upper);
          if (ring.rim) col = mix(col, tube.belly[k], ring.rim * clamp01((Math.abs(c) - .7) / .3));
          if (tube.lining) col = mix(mix(col, tube.lining[k], (ring.top ?? 0) * upper * upper), tube.lining[k], (ring.under ?? 0) * down * down);
          d.color.push(mix(col, tube.dark[k], dark));
        }
        d.flow.push(Math.abs(t[1])); d.furLen.push(ring.fur ?? 1); d.tube.push(tubeIndex); d.lay.push(...lay);
        for (let k = 0; k < 4; k++) { d.skinIndex.push(ws[k] ? ws[k][0] : 0); d.skinWeight.push(ws[k] ? ws[k][1] / total : 0); }
      }
    });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < R; j++) {
      const a = base + i * R + j, b = base + i * R + (j + 1) % R, c = base + (i + 1) * R + j, e = base + (i + 1) * R + (j + 1) % R;
      d.index.push(a, c, b, b, c, e); // wound so faces point outward
    }
  });
  computeNormals(d);
  return d;
}

/** Smooth vertex normals from the triangles (area-weighted). */
export function computeNormals(d: BodyData) {
  const n = new Array(d.position.length).fill(0), P = (i: number): Vec3 => [d.position[i * 3], d.position[i * 3 + 1], d.position[i * 3 + 2]];
  for (let t = 0; t < d.index.length; t += 3) {
    const [a, b, c] = [d.index[t], d.index[t + 1], d.index[t + 2]], A = P(a), B = P(b), C = P(c), f = cross(sub(B, A), sub(C, A));
    for (const v of [a, b, c]) { n[v * 3] += f[0]; n[v * 3 + 1] += f[1]; n[v * 3 + 2] += f[2]; }
  }
  for (let v = 0; v < n.length / 3; v++) { const u = unit([n[v * 3], n[v * 3 + 1], n[v * 3 + 2]]); n[v * 3] = u[0]; n[v * 3 + 1] = u[1]; n[v * 3 + 2] = u[2]; }
  d.normal = n;
}

/**
 * Sculpts a dent into one tube: vertices within `radius` of `center` move along their normal by `depth`
 * (positive = inward, e.g. an eye socket; negative = outward, e.g. a brow ridge) with a smooth falloff.
 */
export function dent(d: BodyData, tubeIndex: number, center: Vec3, radius: number, depth: number) {
  for (let v = 0; v < d.tube.length; v++) {
    if (d.tube[v] !== tubeIndex) continue;
    const dist = Math.hypot(d.position[v * 3] - center[0], d.position[v * 3 + 1] - center[1], d.position[v * 3 + 2] - center[2]);
    if (dist >= radius) continue;
    const f = (1 - (dist / radius) ** 2) ** 2 * depth;
    for (let k = 0; k < 3; k++) { d.position[v * 3 + k] -= d.normal[v * 3 + k] * f; d.rest[v * 3 + k] = d.position[v * 3 + k]; }
  }
  computeNormals(d);
}

/** Moves the vertices of one tube within `radius` of `center` by `offset`, with a smooth falloff (pulls a brow shelf forward, etc.). */
export function push(d: BodyData, tubeIndex: number, center: Vec3, radius: number, offset: Vec3) {
  for (let v = 0; v < d.tube.length; v++) {
    if (d.tube[v] !== tubeIndex) continue;
    const dist = Math.hypot(d.position[v * 3] - center[0], d.position[v * 3 + 1] - center[1], d.position[v * 3 + 2] - center[2]);
    if (dist >= radius) continue;
    const f = (1 - (dist / radius) ** 2) ** 2;
    for (let k = 0; k < 3; k++) { d.position[v * 3 + k] += offset[k] * f; d.rest[v * 3 + k] = d.position[v * 3 + k]; }
  }
  computeNormals(d);
}

export type CoatName = 'timber grey' | 'golden tan' | 'black';
export const COAT_NAMES: CoatName[] = ['timber grey', 'golden tan', 'black'];
/** Individual wolf coat: timber grey (most common), golden tan or solid black, with small per-animal variation. Pure function of the seed. */
export function wolfCoat(seed: number): { name: CoatName; back: RGB; belly: RGB; dark: RGB; accent: RGB } {
  const h = (n: number) => { const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const kind = h(1), j = (n: number, a: number) => 1 + (h(n) - .5) * 2 * a;
  const archetype: { name: CoatName; back: RGB; belly: RGB; dark: RGB; accent: RGB } =
    kind < .55 ? { name: 'timber grey', back: [.42, .46, .48], belly: [.8, .79, .74], dark: [.12, .15, .18], accent: [.52, .42, .32] }
    : kind < .85 ? { name: 'golden tan', back: [.5, .42, .32], belly: [.82, .76, .65], dark: [.16, .13, .1], accent: [.62, .45, .26] }
    : { name: 'black', back: [.14, .15, .17], belly: [.3, .3, .32], dark: [.05, .05, .06], accent: [.2, .18, .17] };
  const scale = (c: RGB, f: number): RGB => [c[0] * f, c[1] * f, c[2] * f];
  return { name: archetype.name, back: scale(archetype.back, j(2, .12)), belly: scale(archetype.belly, j(3, .06)), dark: archetype.dark, accent: archetype.accent };
}
