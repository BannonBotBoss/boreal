/**
 * Calibrated Rule 11 numeric verification for T-0258:
 * Viewfinder/Camera Optics, Physical Filters, Photo Mode DoF/Autofocus/Tiling,
 * Gallery/EXR/Metadata, and PNG/ZIP Encoding Audit.
 *
 * Run: npx tsx refs/photo/viewfinder-photo-gallery-post-audit/numeric-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const clamp01 = x => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const ratioScore = (a, b) => {
  if (!(a > 0) || !(b > 0)) return 0;
  return clamp01(Math.min(a, b) / Math.max(a, b));
};
const deltaScore = (measured, target, fullScale) => {
  if (!(fullScale > 0) || !Number.isFinite(measured) || !Number.isFinite(target)) return 0;
  return clamp01(1 - Math.abs(measured - target) / fullScale);
};

// Load repo modules directly
const { FILTERS, filter, filterStops, applyFilter } = await import(new URL('../../../src/camera/filters.ts', import.meta.url).href);
const { addTextChunks, readTextChunks, crc32: pngCrc32 } = await import(new URL('../../../src/camera/png.ts', import.meta.url).href);
const { zipStore, crc32: zipCrc32 } = await import(new URL('../../../src/photo/zip.ts', import.meta.url).href);
const { ev100FromLuminance, targetEV, fovFromFocal } = await import(new URL('../../../src/render/exposure.ts', import.meta.url).href);
const { tiles } = await import(new URL('../../../src/photo/frame.ts', import.meta.url).href);

const obs = JSON.parse(fs.readFileSync(path.join(__dirname, 'observations.json'), 'utf8'));
const srcGameCam = fs.readFileSync(path.join(REPO_ROOT, 'src/camera/gameCamera.ts'), 'utf8');
const srcBuild = fs.readFileSync(path.join(REPO_ROOT, 'src/render/buildScene.ts'), 'utf8');
const srcGlobe = fs.readFileSync(path.join(REPO_ROOT, 'src/world/globe/globeView.ts'), 'utf8');
const srcMain = fs.readFileSync(path.join(REPO_ROOT, 'src/main.ts'), 'utf8');
const srcPost = fs.readFileSync(path.join(REPO_ROOT, 'src/render/post.ts'), 'utf8');
const srcGallery = fs.readFileSync(path.join(REPO_ROOT, 'src/photo/gallery.ts'), 'utf8');
const srcStore = fs.readFileSync(path.join(REPO_ROOT, 'src/photo/store.ts'), 'utf8');
const srcPng = fs.readFileSync(path.join(REPO_ROOT, 'src/camera/png.ts'), 'utf8');
const srcZip = fs.readFileSync(path.join(REPO_ROOT, 'src/photo/zip.ts'), 'utf8');

// Calibration: known match must score >= 0.99, known mismatch must score <= 0.10
const calibration = {
  knownMatch: {
    ratioExact: ratioScore(12.208, 12.208),
    deltaExact: deltaScore(3.792, 3.792, 3.792),
    mean: (ratioScore(12.208, 12.208) + deltaScore(3.792, 3.792, 3.792)) / 2,
  },
  knownMismatch: {
    ratioOff100x: ratioScore(0.01, 1.0),
    deltaOffFull: deltaScore(0.0, 3.792, 3.792),
    mean: (ratioScore(0.01, 1.0) + deltaScore(0.0, 3.792, 3.792)) / 2,
  },
};
const calibrationValid = calibration.knownMatch.mean >= 0.99 && calibration.knownMismatch.mean <= 0.10;

const checks = [];

// 1. Focal mm & Adapt speed wiring (game + globe views)
{
  const buildStoresVf = /(const|let|var)\s+\w+\s*=\s*mountViewfinder\s*\(/.test(srcBuild);
  const globeStoresVf = /(const|let|var)\s+\w+\s*=\s*mountViewfinder\s*\(/.test(srcGlobe);
  const wiredCount = (buildStoresVf ? 1 : 0) + (globeStoresVf ? 1 : 0);
  const fov50 = fovFromFocal(50);
  const fov400 = fovFromFocal(400);
  checks.push({
    id: 'focal_mm_wired_to_camera_fov',
    measured: `${wiredCount}/2 views wire mountViewfinder().fov() (50mm=${fov50.toFixed(2)}deg vs 400mm=${fov400.toFixed(2)}deg)`,
    reference: '2/2 views (game & globe) apply full-frame 36x24 mm pinhole vFOV = 2*atan(12/f)',
    source: 'ISO 12232 / thin-lens pinhole projection; src/render/buildScene.ts:98, src/world/globe/globeView.ts:104',
    score: wiredCount / 2,
    pass: wiredCount === 2,
  });
}

// 2. Band filter photopic attenuation & H-alpha normalization
{
  const blueStops = filterStops(filter('blue'));
  const refBlueStops = -Math.log2(0.0722); // IEC 61966-2-1 sRGB B luminance weight = 0.0722 -> 3.7919 stops
  const ha = filter('halpha');
  const haY = applyFilter(ha, [1, 1, 1]).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const haMatMean = ha.m.reduce((s, v) => s + v, 0) / 3;
  const haGainRatio = haY / haMatMean; // 0.7743 instead of 1.000
  const deadBranch = /st\.cam\.auto\s*\?\s*1\s*\/\s*y\s*:\s*1\s*\/\s*y\s*\*\s*1/.test(srcGameCam);
  const blueScore = deltaScore(blueStops, refBlueStops, refBlueStops);
  const haScore = deadBranch ? 0 : ratioScore(haY, haMatMean);
  checks.push({
    id: 'band_filter_photopic_attenuation',
    measured: `blue=${blueStops.toFixed(3)} stops; halpha Y/mean=${haGainRatio.toFixed(4)}; deadBranch=${deadBranch}`,
    reference: `blue=${refBlueStops.toFixed(3)} stops (-log2(0.0722)); halpha photopic normalization=1.0000; no dead branch`,
    source: 'IEC 61966-2-1 sRGB Y = 0.2126R + 0.7152G + 0.0722B; src/camera/filters.ts:17-29, src/camera/gameCamera.ts:56',
    score: (blueScore + haScore) / 2,
    pass: blueScore >= 0.95 && haScore >= 0.95,
  });
}

// 3. Game & globe autoEV missing (hardcoded EV_CALIB = 15.0 even at midnight)
{
  const buildHasAutoEV = /mountViewfinder\([^)]*autoEV/.test(srcBuild);
  const globeHasAutoEV = /mountViewfinder\([^)]*autoEV/.test(srcGlobe);
  // Starlight 0.001 lx with 18% reflectance -> L_avg = 0.001 * 0.18 / pi = 5.73e-5 cd/m^2
  const nightL = (0.001 * 0.18) / Math.PI;
  const nightEV = ev100FromLuminance(nightL); // ~ -11.09 EV100
  const hardcodedEV = 15.0;
  const stopErr = Math.abs(hardcodedEV - nightEV);
  const score = (buildHasAutoEV && globeHasAutoEV) ? 1 : deltaScore(hardcodedEV, nightEV, 15.0);
  checks.push({
    id: 'game_view_autoEV_night_calibration',
    measured: `gameAutoEV=${buildHasAutoEV}, globeAutoEV=${globeHasAutoEV}, starlight error=${stopErr.toFixed(2)} stops (15.0 vs ${nightEV.toFixed(2)})`,
    reference: `Live metered EV100 within <=0.5 stops across day (+15) to starlight (${nightEV.toFixed(2)})`,
    source: 'Lagarde & de Rousiers 2014 (Moving Frostbite to PBR §4.5, K=12.5); src/camera/gameCamera.ts:45,66',
    score,
    pass: score >= 0.95,
  });
}

// 4. Globe viewfinder metadata seed/gameTime & Camera panel Shift+C / CapsLock toggle
{
  const globeHardcodesSeed = /mountViewfinder\([\s\S]{0,220}seed:\s*WORLD_SEED/.test(srcGlobe);
  const globeHardcodesWallDate = /mountViewfinder\([\s\S]{0,220}gameTime:\s*new Date\(\)/.test(srcGlobe);
  const srcCamPanel = fs.readFileSync(path.join(REPO_ROOT, 'src/ui/cameraPanel.ts'), 'utf8');
  const caseInsensitiveC = /e\.key\.toLowerCase\(\)\s*===\s*'c'|e\.key\s*===\s*'c'\s*\|\|\s*e\.key\s*===\s*'C'/.test(srcCamPanel);
  const score = ((!globeHardcodesSeed ? 1 : 0) + (!globeHardcodesWallDate ? 1 : 0) + (caseInsensitiveC ? 1 : 0)) / 3;
  checks.push({
    id: 'globe_meta_and_camera_panel_hotkey',
    measured: `globeHardcodesWORLD_SEED=${globeHardcodesSeed}, globeWallDate=${globeHardcodesWallDate}, cameraPanelCaseInsensitiveC=${caseInsensitiveC}`,
    reference: 'Globe viewfinder writes live STAGES.seed & sim date; Camera panel C toggle handles both c and C',
    source: 'src/world/globe/globeView.ts:101,104; src/ui/cameraPanel.ts:25',
    score,
    pass: score >= 0.95,
  });
}

// 5. Thin-lens BokehPass aperture ignores focus distance s (hyperfocal f/22 blur check)
{
  const fMm = 50, N = 22, s = 100, d = 200;
  // Exact formula from src/render/post.ts:105
  const gameAperture = (fMm / 1000) ** 2 / N * 10;
  const gameBlurUv = Math.abs(d - s) * gameAperture; // BokehShader: factor * aperture
  // Physical Potmesil & Chakravarty 1981 CoC fraction of 24 mm sensor height: c/h = (f^2 / (N*(s-f)*h)) * |d-s|/d
  const f = fMm / 1000, h = 0.024;
  const physCocUv = ((f * f) / (N * (s - f) * h)) * (Math.abs(d - s) / d);
  const score = ratioScore(gameBlurUv, physCocUv);
  checks.push({
    id: 'bokeh_thin_lens_hyperfocal_coc',
    measured: `50mm f/22 focus=100m d=200m: blur=${gameBlurUv.toFixed(5)} (5.7x over maxblur 0.02)`,
    reference: `Physical thin-lens CoC fraction=${physCocUv.toFixed(6)} (sharp landscape at hyperfocal distance)`,
    source: 'Potmesil & Chakravarty 1981 (SIGGRAPH); src/render/post.ts:105',
    score,
    pass: score >= 0.95,
  });
}

// 6. Photo Mode distanceAt() raycast coverage (omits terrain + all animals)
{
  const distFn = srcBuild.match(/function distanceAt\([\s\S]*?\n\s*\}/)?.[0] ?? '';
  const targets = ['terrain', 'wolf', 'litter', 'animals', 'hares', 'landingCast'];
  const covered = targets.filter(t => distFn.includes(t)).length;
  checks.push({
    id: 'autofocus_raycast_coverage',
    measured: `${covered}/${targets.length} primary scene targets in distanceAt() (only chunks.values())`,
    reference: '6/6 primary scene targets (terrain, wolf, litter, animals, hares, landingCast) raycasted for autofocus/click-to-focus',
    source: 'src/render/buildScene.ts:642-646 vs buildScene.ts:105-106 (chunk ground meshes removed)',
    score: covered / targets.length,
    pass: covered === targets.length,
  });
}

// 7. Photo Mode view.capture() drops GTAO/SUNFX & vignettes per tile at 8K
{
  const cropCall = srcBuild.match(/function renderCrop[\s\S]*?\n\s*\}/)?.[0] ?? '';
  const passesAoAndFx = /post\.render\s*\(\s*true\s*,\s*focalMm\s*,\s*[^,)]+,\s*[^)]+\)/.test(cropCall);
  const t8k = tiles(7680, 4320, 4096);
  const gradeAwareOfTiles = /tileOffset|uTile|fullUv/i.test(srcPost);
  const score = ((passesAoAndFx ? 1 : 0) + (gradeAwareOfTiles ? 1 : 0)) / 2;
  checks.push({
    id: 'photo_capture_ao_sunfx_and_tile_vignette',
    measured: `passesAoAndFx=${passesAoAndFx}, tileAwareGrade=${gradeAwareOfTiles} (8K splits into ${t8k.length} tiles)`,
    reference: 'Capture passes active GTAO/SUNFX and uses full-frame UV for vignette/grain across 4 tiles at 8K',
    source: 'src/render/buildScene.ts:623-638, src/render/post.ts:62-74,164',
    score,
    pass: score >= 0.95,
  });
}

// 8. Photo Panel focalLength default=0 < min=12 + GRADE runs post-OutputPass (sRGB)
{
  const flMatch = srcPost.match(/key:\s*'focalLength'[^}]*min:\s*([\d.]+)[^}]*max:\s*([\d.]+)[^}]*value:\s*([\d.]+)/);
  const flParam = flMatch ? { min: Number(flMatch[1]), max: Number(flMatch[2]), value: Number(flMatch[3]) } : null;
  const inBounds = !!flParam && flParam.value >= flParam.min && flParam.value <= flParam.max;
  const liveClamped = obs.stages?.stage3_photo_mode?.initial?.focalLengthDomValue;
  const idxOut = srcPost.indexOf('new OutputPass()');
  const idxGrade = srcPost.indexOf('grade = new ShaderPass(GRADE)');
  const gradeBeforeOutput = idxGrade >= 0 && idxOut >= 0 && idxGrade < idxOut;
  const score = ((inBounds ? 1 : 0) + (gradeBeforeOutput ? 1 : 0)) / 2;
  checks.push({
    id: 'photo_panel_focal_bounds_and_linear_grade',
    measured: `focalLength default=${flParam?.value} min=${flParam?.min} (live DOM=${liveClamped}); gradeBeforeOutput=${gradeBeforeOutput}`,
    reference: 'Default within [min,max] and colour grade/luma applied in scene-linear space before OutputPass',
    source: 'IEC 61966-2-1 linear luminance; src/render/post.ts:22,128-129',
    score,
    pass: score >= 0.95,
  });
}

// 9. Game view Shift+P EXR mismatch (readout promises Shift+P photo+EXR, main.ts calls vf.shoot() with no hdr arg)
{
  const idbPhotos = obs.stages?.stage2_gallery_and_idb?.idbPhotos ?? [];
  const shiftPProducedExr = idbPhotos.some(p => p.hasExr === true && p.exrBytes > 0);
  const mainPassesShiftHdr = /vf\.shoot\s*\(\s*[^)\s]+/.test(srcMain);
  const score = (shiftPProducedExr && mainPassesShiftHdr) ? 1 : 0;
  checks.push({
    id: 'viewfinder_game_shift_p_exr',
    measured: `live Shift+P hasExr=${shiftPProducedExr} (${idbPhotos.length} IDB shots), mainPassesHdr=${mainPassesShiftHdr}`,
    reference: 'Shift+P in game view saves linear OpenEXR alongside PNG as advertised by readout',
    source: 'src/camera/gameCamera.ts:82,86, src/main.ts:392',
    score,
    pass: score >= 0.95,
  });
}

// 10. Frozen gameTime=hourAt(0) in PNG metadata & Gallery default selected=false
{
  const hardcodedZero = /formatHour\s*\(\s*hourAt\s*\(\s*0\s*\)\s*\)/.test(srcBuild);
  const shotCheckboxes = obs.stages?.stage2_gallery_and_idb?.galleryInfo?.shotCheckboxes ?? [];
  const allSelected = shotCheckboxes.length > 0 && shotCheckboxes.every(c => c.checked === true);
  const score = ((!hardcodedZero ? 1 : 0) + (allSelected ? 1 : 0)) / 2;
  checks.push({
    id: 'viewfinder_gametime_and_gallery_selection',
    measured: `hardcodedHourAt0=${hardcodedZero}, liveGalleryCheckboxes=${JSON.stringify(shotCheckboxes)}`,
    reference: 'Metadata records live worldSec() game time and newly taken viewfinder shots default to selected=true',
    source: 'src/render/buildScene.ts:98, src/photo/gallery.ts:127',
    score,
    pass: score >= 0.95,
  });
}

// 11. Duplicate CRC-32 & readTextChunks spread-overflow / missing-NUL safety
{
  const pngHasCrcTable = /0xedb88320/.test(srcPng);
  const zipHasCrcTable = /0xedb88320/.test(srcZip);
  const crcCopies = (pngHasCrcTable ? 1 : 0) + (zipHasCrcTable ? 1 : 0);
  const crcMatch = pngCrc32(new TextEncoder().encode('123456789')) === 0xcbf43926 && zipCrc32(new TextEncoder().encode('123456789')) === 0xcbf43926;
  // Test readTextChunks with 150 KB tEXt value (triggers spread stack overflow)
  const PNG1x1 = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNgAAAAAgABSK+kcQAAAABJRU5ErkJggg==', 'base64'));
  let largeTextOk = false;
  try {
    const big = addTextChunks(PNG1x1, { Huge: 'A'.repeat(150000) });
    const parsed = readTextChunks(big);
    largeTextOk = parsed.Huge?.length === 150000;
  } catch {
    largeTextOk = false;
  }
  const score = ((crcCopies === 1 ? 1 : 0) + (largeTextOk ? 1 : 0)) / 2;
  checks.push({
    id: 'shared_crc32_and_png_text_safety',
    measured: `crc32 copies=${crcCopies} (IEEE check=${crcMatch}), 150KB tEXt roundtrip=${largeTextOk}`,
    reference: '1 shared CRC-32 implementation (Rule 2) and stack-safe PNG 1.2 tEXt decoding',
    source: 'ISO/IEC 15948 (PNG 1.2 §11.3.4.3); PROJECT-RULES.md Rule 2; src/camera/png.ts:2,17, src/photo/zip.ts:2',
    score,
    pass: score >= 0.95,
  });
}

// 12. ZIP MS-DOS timestamp + IndexedDB/ObjectURL/setInterval lifecycle leaks
{
  const z = zipStore([{ name: 'a.txt', data: new TextEncoder().encode('hi') }]);
  const dv = new DataView(z.buffer, z.byteOffset);
  const dosTime = dv.getUint16(10, true);
  const dosDate = dv.getUint16(12, true); // 0x0021 = 1980-01-01
  const realDate = dosDate !== 0x0021 || dosTime !== 0;
  const closesIdb = /\.close\s*\(\s*\)/.test(srcStore);
  const prevBlock = srcGallery.match(/else if \(d\.prev\) \{[\s\S]*?\n\s*\}/)?.[0] ?? '';
  const revokesPreviewUrl = /revokeObjectURL/.test(prevBlock);
  const leaksInterval = /setInterval\s*\(\s*\(\)\s*=>\s*panel\.update/.test(srcGameCam) && !/clearInterval/.test(srcGameCam);
  const score = ((realDate ? 1 : 0) + (closesIdb ? 1 : 0) + (revokesPreviewUrl ? 1 : 0) + (!leaksInterval ? 1 : 0)) / 4;
  checks.push({
    id: 'zip_dos_timestamp_and_resource_leaks',
    measured: `zipDosDate=0x${dosDate.toString(16)} (1980-01-01), closesIdb=${closesIdb}, revokesPreviewUrl=${revokesPreviewUrl}, uncleanedInterval=${leaksInterval}`,
    reference: 'Current MS-DOS local timestamp (PKWARE APPNOTE §4.4.6), IDB closed, preview URLs revoked, no orphaned setInterval',
    source: 'PKWARE APPNOTE 6.3.10 §4.4.6; src/photo/zip.ts:10-12, src/photo/store.ts:4-5, src/photo/gallery.ts:113-115, src/camera/gameCamera.ts:89',
    score,
    pass: score >= 0.95,
  });
}

const passed = checks.filter(c => c.pass).length;
const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

const report = {
  task: 'T-0258',
  generatedAt: new Date().toISOString(),
  calibration,
  calibrationValid,
  summary: {
    passed,
    total: checks.length,
    meanScore: +meanScore.toFixed(4),
  },
  checks,
};

fs.writeFileSync(path.join(__dirname, 'numbers.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
for (const c of checks) {
  console.log(`${c.pass ? 'PASS' : 'FAIL'} [${c.score.toFixed(3)}] ${c.id}: ${c.measured}`);
}
if (!calibrationValid) process.exit(2);
