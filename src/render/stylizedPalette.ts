/**
 * One stylized coat and a readable fill for the landed view (issue #192, Oct 31: 75% target,
 * cartoon is enough). The key light stays in render/sky.ts. These colours only lift animals
 * and vegetation enough to read when that light is dim. Hues stay the species coats already
 * used by the picture; nothing here is a photograph.
 */
import type * as THREE from 'three';

/** Linear RGB added as emissive so a body or a blade stays visible on a dark landing. */
export const STYLIZED = {
  grassLift: [0.045, 0.068, 0.03] as const,
  foliageLift: [0.028, 0.042, 0.018] as const,
  barkLift: [0.032, 0.02, 0.012] as const,
  /** Floor so a near-black coat (bear, raven) still has a warm fill. */
  fillFloor: [0.14, 0.11, 0.07] as const,
  fillMix: 0.4,
} as const;

/** Species coats. Same hues as the picture tints, lightened just enough to separate neighbours. */
export const COAT: Record<string, [number, number, number]> = {
  'Gray Wolf': [0.52, 0.53, 0.56],
  'Coyote': [0.62, 0.52, 0.34],
  'Red Fox': [0.78, 0.42, 0.18],
  'Gray Fox': [0.58, 0.50, 0.34],
  'Cougar': [0.68, 0.52, 0.30],
  'Striped Skunk': [0.22, 0.22, 0.22],
  'Northern Raccoon': [0.50, 0.46, 0.40],
  'Wolverine': [0.36, 0.28, 0.18],
  'North American River Otter': [0.32, 0.24, 0.16],
  'Ermine': [0.62, 0.48, 0.32],
  'American Mink': [0.30, 0.18, 0.12],
  'American Black Bear': [0.22, 0.16, 0.12],
  'Grizzly Bear': [0.48, 0.34, 0.18],
  'Arctic Fox': [0.86, 0.84, 0.80],
  'Moose': [0.38, 0.28, 0.18],
  'Elk': [0.52, 0.38, 0.24],
  'White-tailed Deer': [0.68, 0.52, 0.32],
  'Woodland Caribou': [0.56, 0.48, 0.38],
  'Snowshoe Hare': [0.62, 0.46, 0.30],
  'Beaver': [0.40, 0.28, 0.16],
  'Canada Lynx': [0.58, 0.52, 0.38],
  'Bald Eagle': [0.42, 0.32, 0.22],
  'Hawks, Kites and Eagles': [0.42, 0.32, 0.22],
  'Common Raven': [0.18, 0.18, 0.20],
  'Crows and Jays': [0.18, 0.18, 0.20],
};

export function coatOf(species: string): [number, number, number] {
  return COAT[species] ?? [0.55, 0.48, 0.34];
}

/** Warm fill from a coat or an albedo, so the shape reads without a second sun. */
export function stylizedFill(rgb: readonly [number, number, number]): [number, number, number] {
  const f = STYLIZED.fillFloor, k = STYLIZED.fillMix;
  return [rgb[0] * k + f[0], rgb[1] * k + f[1], rgb[2] * k + f[2]];
}

/**
 * MeshStandard (and anything with emissive). A stored mesh keeps its albedo map and lights that
 * map from the emissive slot, so the animal still reads when the key light is dim. A flat coat
 * (no map) gets a warm fill from `rgb` or the material colour.
 */
export function applyStylizedFill(material: THREE.Material, rgb?: readonly [number, number, number]) {
  const m = material as THREE.MeshStandardMaterial;
  if (!m.emissive || !m.color) return;
  // The landed key light can leave a standard material black. Skip tone mapping so the fill is the colour on screen.
  m.toneMapped = false;
  if (m.map && !rgb) {
    // Stored albedos are a few percent reflectance. Without the key light they need a strong lift to read.
    m.emissiveMap = m.map;
    m.emissive.setRGB(1, 0.94, 0.82);
    m.emissiveIntensity = 14;
  } else {
    const src = rgb ?? [m.color.r, m.color.g, m.color.b] as [number, number, number];
    const fill = stylizedFill(src);
    m.emissive.setRGB(fill[0], fill[1], fill[2]);
    m.emissiveIntensity = 1.15;
  }
  m.userData.stylized = true;
}
