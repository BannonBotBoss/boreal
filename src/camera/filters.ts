/** Physical filters for rendered (RGB) views. A filter is a linear operation on scene-linear light BEFORE tone mapping,
 *  so it acts on light, not on a graded image. Where the renderer has no spectrum, the filter says so instead of faking it.
 *  - Channels: sRGB primaries (IEC 61966-2-1) ~ broad R/G/B bands. Luminance: Y = 0.2126 R + 0.7152 G + 0.0722 B (photopic V).
 *  - H-alpha 656.3 nm sits inside the R band only: rendered as the R channel times the narrowband fraction (0.07 nm FWHM /
 *    ~100 nm R band, solar-filter class) - auto exposure brings it back up, as on a real narrowband camera.
 *  - UV <300 nm, EUV, X-ray: absorbed by ozone/air above ~30-100 km (Hartley band; Seinfeld & Pandis 2016 ch. 4): black at
 *    the ground. From orbit the renderer has no UV/X spectrum for Earth yet -> unavailable (TODO).
 *  - TODO polarizer: needs Stokes vectors from Rayleigh scattering (degree of polarization sin^2/(1+cos^2)) carried through
 *    the sky shader; not computed causally yet. TODO infrared: needs per-material IR reflectance (vegetation red edge) and
 *    thermal emission; not in the material model yet. Neither is offered until they are. */
export type FilterId = 'visible' | 'red' | 'green' | 'blue' | 'luminance' | 'halpha' | 'uv' | 'euv' | 'xray';
export interface PhysFilter { id: FilterId; label: string; m: number[]; groundReach: boolean; note: string }
const Y = [.2126, .7152, .0722], HA = .07 / 100;
const mono = (w: number[], tint: number[]) => tint.flatMap(t => w.map(x => x * t)); // 3x3 row-major: out_i = tint_i * (w . rgb)
export const FILTERS: PhysFilter[] = [
  { id: 'visible', label: 'Visible (no filter)', m: [1, 0, 0, 0, 1, 0, 0, 0, 1], groundReach: true, note: '' },
  { id: 'red', label: 'Red channel', m: mono([1, 0, 0], [1, 1, 1]), groundReach: true, note: 'sRGB R primary' },
  { id: 'green', label: 'Green channel', m: mono([0, 1, 0], [1, 1, 1]), groundReach: true, note: 'sRGB G primary' },
  { id: 'blue', label: 'Blue channel', m: mono([0, 0, 1], [1, 1, 1]), groundReach: true, note: 'sRGB B primary' },
  { id: 'luminance', label: 'Luminance (photopic)', m: mono(Y, [1, 1, 1]), groundReach: true, note: 'CIE V(lambda) via sRGB Y' },
  { id: 'halpha', label: 'H-alpha 656.3 nm', m: mono([HA, 0, 0], [1, .12, .05]), groundReach: true, note: 'R band x 0.07 nm / 100 nm' },
  { id: 'uv', label: 'UV 160-170 nm', m: Array(9).fill(0), groundReach: false, note: 'absorbed by O2/O3 above ~50 km' },
  { id: 'euv', label: 'EUV 17-30 nm', m: Array(9).fill(0), groundReach: false, note: 'absorbed in the thermosphere' },
  { id: 'xray', label: 'X-ray 0.1-0.8 nm', m: Array(9).fill(0), groundReach: false, note: 'absorbed above ~70 km' },
];
export const filter = (id: FilterId) => FILTERS.find(f => f.id === id) ?? FILTERS[0];
export const applyFilter = (f: PhysFilter, rgb: number[]) => [0, 1, 2].map(i => f.m[i * 3] * rgb[0] + f.m[i * 3 + 1] * rgb[1] + f.m[i * 3 + 2] * rgb[2]);
/** stops of light the filter removes from a neutral (grey) scene: what auto exposure adds back */
export const filterStops = (f: PhysFilter) => { const y = applyFilter(f, [1, 1, 1]).reduce((s, v, i) => s + v * Y[i], 0); return y > 0 ? -Math.log2(y) : Infinity; };
/** view is above the air (orbit / sun viewer from space) */
export const reaches = (f: PhysFilter, aboveAir: boolean) => aboveAir ? f.groundReach /* no Earth UV/X spectrum yet */ : f.groundReach;
