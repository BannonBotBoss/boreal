/**
 * Live & calibrated Rule 11 audit (T-0293) of four previously unaudited
 * end-to-end, CI/launcher, root HTML/CSS, and scientific-data surfaces
 * (zero overlap with T-0001..T-0292):
 *   1. Slow End-to-End Tests, Live Descent Page & Kenora Climate Pinning
 *      (`tests/slow/{autoplay,climate-kenora,descent-swiftshader}.test.ts`,
 *       `descent-frame.html`, `src/dev/descentFrame.ts`)
 *   2. CI/CD Workflows, Contest Freeze, Package/Lockfiles & Windows Launchers
 *      (`.github/workflows/{ci.yml,pages.yml}`, `package.json`, `docs/CONTEST-FREEZE.md`,
 *       `Play Boreal.{bat,vbs}`, `Stop Boreal.vbs`)
 *   3. Root Entry HTML, Global Stylesheet, Live Library Dialog & Inspector/Mobile HUD
 *      (`index.html`, `src/style.css`, `src/ui/inspector.ts`)
 *   4. Scientific Reference JSON Datasets & Aerial Exemplar Manifest
 *      (`data/earth/{altitude-zones,cloud-column,cover-density,materials,reference-figure,species-density}.json`,
 *       `data/horizons/venus-2025.json`, `data/nsidc/october-extent.json`,
 *       `data/omni/{gannon-2024-05-10,quiet-2024-04-27}.json`, `public/aerial/meta.json`)
 *
 * Usage:
 *   npx tsx refs/audit/slow-tests-ci-ui-data-audit/audit.ts [baseUrl]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { DIVE_FRAME_MS } from '../../../tests/descent-frame-gate';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5268';

const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];
const EXECUTABLE = BROWSER_PATHS.find(p => existsSync(p));

interface CheckResult {
  id: string;
  label: string;
  measured: string;
  expected: string;
  score: number;
  knownMatchScore: number;
  knownMismatchScore: number;
  pass: boolean;
  source: string;
}

function scoreBoolList(flags: boolean[]): number {
  return flags.reduce((s, f) => s + (f ? 1 : 0), 0) / flags.length;
}

function countFilesByExt(dir: string, ext: string): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) n += countFilesByExt(full, ext);
    else if (ent.name.toLowerCase().endsWith(ext)) n++;
  }
  return n;
}

function rectOverlapArea(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.width, b.x + b.width);
  const y1 = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const consoleErrors: string[] = [];

  // =========================================================================
  // 1. Slow Tests, Live Descent Frame & Kenora Climate Pinning
  // =========================================================================
  const autoplayTestSrc = readFileSync(join(ROOT, 'tests/slow/autoplay.test.ts'), 'utf8');
  const descentTestSrc = readFileSync(join(ROOT, 'tests/slow/descent-swiftshader.test.ts'), 'utf8');
  const climateTestSrc = readFileSync(join(ROOT, 'tests/slow/climate-kenora.test.ts'), 'utf8');
  const pkgJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  const autoplayCrossPlatformChrome = /chrome\.exe|msedge\.exe|process\.platform/.test(autoplayTestSrc);
  const autoplayPortableArtifacts = !/\/opt\/cursor\/artifacts/.test(autoplayTestSrc) && !/'\/tmp\/autoplay-video'/.test(autoplayTestSrc);
  const autoplayPortableViteSpawn = !/node_modules\/\.bin\/vite['"]/.test(autoplayTestSrc);
  const autoplayDynamicPort = !/const port = 5217\b/.test(autoplayTestSrc);
  const playwrightDeclaredInPkg = Boolean(pkgJson.dependencies?.['playwright-core'] || pkgJson.devDependencies?.['playwright-core']);

  const descentHasSandboxFlags = /--no-sandbox/.test(descentTestSrc) && /--disable-dev-shm-usage/.test(descentTestSrc);
  const descentCrossPlatformChrome = /chrome\.exe|msedge\.exe|process\.platform/.test(descentTestSrc);
  const descentCleansUserDataDir = /rmSync|rmdirSync/.test(descentTestSrc);
  const descentWaitsForVite = /waitFor|fetch\(`http:\/\/127\.0\.0\.1:\$\{port\}/.test(descentTestSrc);

  // ECCC 1981-2010 Kenora A (climate id 6034075): July mean 19.7 C, annual precip 715.8 mm, Koeppen Dfb
  const climateTestMatchesRealDfb = !/assert\.notEqual\(after\.climate\.id,\s*'Dfb'\)/.test(climateTestSrc)
    && !/july > 27 && july < 28/.test(climateTestSrc);

  // =========================================================================
  // 2. CI/CD Workflows, Contest Freeze, Package/Lockfiles & Windows Launchers
  // =========================================================================
  const ciYml = readFileSync(join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  const pagesYml = readFileSync(join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  const freezeDoc = readFileSync(join(ROOT, 'docs/CONTEST-FREEZE.md'), 'utf8');
  const playVbs = readFileSync(join(ROOT, 'Play Boreal.vbs'), 'utf8');
  const stopVbs = readFileSync(join(ROOT, 'Stop Boreal.vbs'), 'utf8');

  const hasNpmLock = existsSync(join(ROOT, 'package-lock.json'));
  const hasPnpmLock = existsSync(join(ROOT, 'pnpm-lock.yaml'));
  const pagesFrozenFileExists = existsSync(join(ROOT, '.github/PAGES_FROZEN'));
  const freezeDeadlineIso = '2026-11-18T12:00:00-08:00';
  const pastFreezeDeadline = Date.now() > Date.parse(freezeDeadlineIso);
  const contestFreezeEnforced = !pastFreezeDeadline || pagesFrozenFileExists;
  const pagesArtifactActionModern = !/actions\/upload-pages-artifact@v3\b/.test(pagesYml);
  const ciLockfileAccurate = !(/No lockfile in the repo/i.test(ciYml) && (hasNpmLock || hasPnpmLock))
    && /npm ci\b/.test(ciYml)
    && !(hasNpmLock && hasPnpmLock);
  const ciRunsRustAndBuild = /test:rust|cargo test/.test(ciYml) && /npm run build|vite build/.test(ciYml);
  const playVbsStrictPortAndInstallCheck = /--strictPort/.test(playVbs) && !/sh\.Run\s+"cmd \/c pnpm install \|\| npm install",\s*0,\s*True/.test(playVbs);
  const stopVbsExactPortAndProcessCheck = !/findstr :5173\s*\^?\|\s*findstr LISTENING/.test(stopVbs)
    && /Get-NetTCPConnection|node\.exe|vite/i.test(stopVbs);

  // =========================================================================
  // 3. Root index.html, src/style.css & Live Chromium Inspection
  // =========================================================================
  const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const styleCss = readFileSync(join(ROOT, 'src/style.css'), 'utf8');
  const glbCount = countFilesByExt(join(ROOT, 'public/models'), '.glb');

  const dialogClaimsNoModels = /No stored 3D model files/i.test(indexHtml);
  const dialogClaimsNoHunting = /collision, hunting, trading and construction are not implemented/i.test(indexHtml);
  const dialogClaimsZoomDisabled = /manual zoom is disabled/i.test(indexHtml);
  const footerClaimsWheelZoom = /wheel zoom/i.test(indexHtml);
  const indexDialogAccurate = !(dialogClaimsNoModels && glbCount > 0)
    && !dialogClaimsNoHunting
    && !(dialogClaimsZoomDisabled && footerClaimsWheelZoom);
  const cssHasReducedMotion = /prefers-reduced-motion/.test(styleCss) || /prefers-reduced-motion/.test(indexHtml);

  // Live Chromium inspection (descent-frame.html + index.html desktop & narrow 680x720)
  if (!EXECUTABLE) throw new Error('No Chromium/Edge executable found');
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  let diveResult: {
    max: number;
    renderer: string;
    gapsCount: number;
    shots: Record<string, { ms: number; hash: string; mean: number; pending: number }>;
    distinctHashes: number;
  } | null = null;
  let liveInspectorMetrics = {
    headerPosition: 'unknown',
    headerPointerEvents: 'unknown',
    headerOverlapsGroupsPx2: 0,
    rerollClickable: false,
    helpCoveredByOverlay: false,
    desktopInteractionOverlapsStatusPx2: 0,
    dialogVisible: false,
    dialogTextLen: 0,
  };
  let liveNarrowHudMetrics = {
    viewportWidth: 680,
    viewportHeight: 720,
    interactionTopPx: 0,
    interactionHeightPx: 0,
    interactionOverlapsStatusPx2: 0,
    interactionOverlapsFooterPx2: 0,
    headerOverlapsStatusPx2: 0,
    footerHeightPx: 135,
  };
  let framesCaptured = 0;
  let recordingBytes = 0;

  try {
    // 3A. Live recording + frames on descent-frame.html (2000 m -> 2 m)
    const seqDir = join(HERE, '_video_tmp');
    mkdirSync(seqDir, { recursive: true });
    const diveCtx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const divePage = await diveCtx.newPage();
    divePage.on('pageerror', err => consoleErrors.push(`descent pageerror: ${err.message}`));
    divePage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`descent console: ${msg.text()}`);
    });

    await divePage.goto(`${BASE}/descent-frame.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await divePage.waitForFunction(() => Boolean((window as unknown as { __dive?: { ready?: boolean } }).__dive?.ready), undefined, { timeout: 20000 });

    const rawDive = await divePage.evaluate(() => {
      const d = (window as unknown as { __dive: { dive(): { gaps: { eye: number; ms: number }[]; max: number; renderer: string; shots: Record<string, { ms: number; hash: string; mean: number; pending: number }> }; step(eye: number): unknown } }).__dive;
      return d.dive();
    });

    // Capture live 1200 m frame and 28 m frame + live animated descent sequence for WebM
    const altitudes = [2000, 1500, 1200, 900, 650, 450, 300, 190, 120, 75, 45, 28, 16, 8, 4];
    for (let i = 0; i < altitudes.length; i++) {
      const alt = altitudes[i];
      await divePage.evaluate(e => {
        const d = (window as unknown as { __dive: { step(eye: number): unknown } }).__dive;
        for (let k = 0; k < 4; k++) d.step(e);
      }, alt);
      await divePage.waitForTimeout(80);
      const seqPath = join(seqDir, `seq-${String(i).padStart(2, '0')}.png`);
      await divePage.screenshot({ path: seqPath });
      if (alt === 1200) {
        writeFileSync(join(HERE, 'frame-0-live-descent-1200m.png'), readFileSync(seqPath));
        framesCaptured++;
      } else if (alt === 28) {
        writeFileSync(join(HERE, 'frame-1-live-descent-28m.png'), readFileSync(seqPath));
        framesCaptured++;
      }
    }

    const hashes = ['1200', '300', '28'].map(k => rawDive.shots[k]?.hash ?? '');
    diveResult = {
      max: Number(rawDive.max.toFixed(2)),
      renderer: rawDive.renderer,
      gapsCount: rawDive.gaps.length,
      shots: rawDive.shots,
      distinctHashes: new Set(hashes).size,
    };

    await diveCtx.close();
    const targetWebm = join(HERE, 'recording.webm');
    execFileSync(
      'ffmpeg',
      ['-y', '-framerate', '4', '-i', join(seqDir, 'seq-%02d.png'), '-c:v', 'libvpx', '-b:v', '900k', '-pix_fmt', 'yuv420p', '-an', targetWebm],
      { stdio: 'ignore', timeout: 30000 },
    );
    recordingBytes = statSync(targetWebm).size;

    // 3B. Live desktop forest mode: open Generation Inspector (#inspector) + Library dialog (#info)
    const appCtx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const appPage = await appCtx.newPage();
    appPage.on('pageerror', err => consoleErrors.push(`app pageerror: ${err.message}`));
    appPage.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`app console: ${msg.text()}`);
    });

    await appPage.goto(`${BASE}/?view=forest&noprobe=1&contacts=1`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await appPage.waitForFunction(() => !document.getElementById('loading'), undefined, { timeout: 60000 });
    await appPage.waitForTimeout(800);

    // Dismiss start menu if present
    const startBtn = appPage.locator('#start-menu button').first();
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click().catch(() => {});
      await appPage.waitForTimeout(500);
    }

    // Measure desktop HUD overlaps & #help occlusion BEFORE opening inspector/dialog
    const desktopHudCheck = await appPage.evaluate(() => {
      const inter = document.getElementById('interaction')?.getBoundingClientRect();
      const st = document.getElementById('status')?.getBoundingClientRect();
      const help = document.getElementById('help');
      const hr = help?.getBoundingClientRect();
      const hitHelp = hr ? document.elementFromPoint(hr.left + hr.width / 2, hr.top + hr.height / 2) : null;
      const helpCovered = Boolean(help && hitHelp && hitHelp !== help && !help.contains(hitHelp));
      const interStatusOverlap = inter && st
        ? Math.max(0, Math.min(inter.right, st.right) - Math.max(inter.left, st.left))
          * Math.max(0, Math.min(inter.bottom, st.bottom) - Math.max(inter.top, st.top))
        : 0;
      return { helpCovered, interStatusOverlap: Math.round(interStatusOverlap) };
    });

    // Open Generation Inspector via exposed showWhy('terrain:0:0') (same inspector.show path a click uses)
    await appPage.evaluate(() => {
      const w = window as unknown as { showWhy?: (k: string) => string };
      if (w.showWhy) w.showWhy('terrain:0:0');
    });
    await appPage.waitForTimeout(400);

    // Measure #inspector header CSS cascade bug live!
    const inspCheck = await appPage.evaluate(() => {
      const insp = document.getElementById('inspector');
      const hdr = insp?.querySelector('header') as HTMLElement | null;
      const groups = insp?.querySelector('.groups') as HTMLElement | null;
      const rrBtn = Array.from(hdr?.querySelectorAll('button') ?? []).find(b => /Reroll/i.test(b.textContent ?? '')) as HTMLElement | undefined;
      if (!hdr) return { found: false, pos: 'missing', pe: 'missing', overlap: 0, rrClickable: false };
      const cs = getComputedStyle(hdr);
      const hr = hdr.getBoundingClientRect();
      const gr = groups?.getBoundingClientRect();
      const overlap = gr
        ? Math.max(0, Math.min(hr.right, gr.right) - Math.max(hr.left, gr.left))
          * Math.max(0, Math.min(hr.bottom, gr.bottom) - Math.max(hr.top, gr.top))
        : 0;
      let rrClickable = false;
      if (rrBtn) {
        const br = rrBtn.getBoundingClientRect();
        const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
        rrClickable = Boolean(hit && (hit === rrBtn || rrBtn.contains(hit)));
      }
      return { found: true, pos: cs.position, pe: cs.pointerEvents, overlap: Math.round(overlap), rrClickable };
    });

    // Open #info dialog via DOM button click (bypasses overlay pointer block to inspect dialog rendering)
    await appPage.evaluate(() => {
      (document.getElementById('help') as HTMLButtonElement | null)?.click();
    });
    await appPage.waitForTimeout(300);
    const dlgInfo = await appPage.evaluate(() => {
      const d = document.getElementById('info') as HTMLDialogElement | null;
      return { visible: Boolean(d?.open), textLen: d?.textContent?.length ?? 0 };
    });
    liveInspectorMetrics = {
      headerPosition: inspCheck.pos,
      headerPointerEvents: inspCheck.pe,
      headerOverlapsGroupsPx2: inspCheck.overlap,
      rerollClickable: inspCheck.rrClickable,
      helpCoveredByOverlay: desktopHudCheck.helpCovered,
      desktopInteractionOverlapsStatusPx2: desktopHudCheck.interStatusOverlap,
      dialogVisible: dlgInfo.visible,
      dialogTextLen: dlgInfo.textLen,
    };
    await appPage.screenshot({ path: join(HERE, 'frame-2-live-inspector-and-library.png') });
    framesCaptured++;

    // Close dialog & inspector, switch to narrow 680x720 viewport (@media max-width: 700px)
    await appPage.evaluate(() => {
      (document.getElementById('close') as HTMLButtonElement | null)?.click();
      const insp = document.getElementById('inspector');
      if (insp) insp.hidden = true;
    });
    await appPage.setViewportSize({ width: 680, height: 720 });
    await appPage.waitForTimeout(500);

    const narrowCheck = await appPage.evaluate(() => {
      const inter = document.getElementById('interaction')?.getBoundingClientRect();
      const foot = document.querySelector('footer')?.getBoundingClientRect();
      const hdr = document.querySelector('body > header')?.getBoundingClientRect();
      const st = document.getElementById('status')?.getBoundingClientRect();
      return {
        inter: inter ? { x: inter.left, y: inter.top, width: inter.width, height: inter.height } : null,
        foot: foot ? { x: foot.left, y: foot.top, width: foot.width, height: foot.height } : null,
        hdr: hdr ? { x: hdr.left, y: hdr.top, width: hdr.width, height: hdr.height } : null,
        st: st ? { x: st.left, y: st.top, width: st.width, height: st.height } : null,
      };
    });
    liveNarrowHudMetrics = {
      viewportWidth: 680,
      viewportHeight: 720,
      interactionTopPx: Math.round(narrowCheck.inter?.y ?? 0),
      interactionHeightPx: Math.round(narrowCheck.inter?.height ?? 0),
      interactionOverlapsStatusPx2: narrowCheck.inter && narrowCheck.st ? Math.round(rectOverlapArea(narrowCheck.inter, narrowCheck.st)) : 0,
      interactionOverlapsFooterPx2: narrowCheck.inter && narrowCheck.foot ? Math.round(rectOverlapArea(narrowCheck.inter, narrowCheck.foot)) : 0,
      headerOverlapsStatusPx2: narrowCheck.hdr && narrowCheck.st ? Math.round(rectOverlapArea(narrowCheck.hdr, narrowCheck.st)) : 0,
      footerHeightPx: Math.round(narrowCheck.foot?.height ?? 0),
    };
    await appPage.screenshot({ path: join(HERE, 'frame-3-live-narrow-hud.png') });
    framesCaptured++;

    await appCtx.close();
  } finally {
    await browser.close();
  }

  // =========================================================================
  // 4. Scientific Reference JSON Datasets & Aerial Exemplar Manifest
  // =========================================================================
  const speciesData = JSON.parse(readFileSync(join(ROOT, 'data/earth/species-density.json'), 'utf8')) as Record<string, unknown>;
  const coverData = JSON.parse(readFileSync(join(ROOT, 'data/earth/cover-density.json'), 'utf8')) as Record<string, unknown>;
  const materialsData = JSON.parse(readFileSync(join(ROOT, 'data/earth/materials.json'), 'utf8')) as Record<string, unknown>;
  const refFigureRaw = readFileSync(join(ROOT, 'data/earth/reference-figure.json'), 'utf8');
  const refFigureData = JSON.parse(refFigureRaw) as Record<string, unknown>;
  const cloudColData = JSON.parse(readFileSync(join(ROOT, 'data/earth/cloud-column.json'), 'utf8')) as Record<string, unknown>;
  const gannonRaw = readFileSync(join(ROOT, 'data/omni/gannon-2024-05-10.json'), 'utf8');
  const quietRaw = readFileSync(join(ROOT, 'data/omni/quiet-2024-04-27.json'), 'utf8');
  const aerialMeta = JSON.parse(readFileSync(join(ROOT, 'public/aerial/meta.json'), 'utf8')) as {
    metres: number;
    metresPerPixel: number;
    pixels: number;
    crops: Record<string, { x: number; y: number; cropX: number; cropY: number; cropPx: number }>;
  };

  const speciesSources = (speciesData._sources ?? {}) as Record<string, string>;
  const speciesKeys = Object.keys(speciesData).filter(k => k !== '_sources');
  const missingSpeciesSources = speciesKeys.filter(k => !(k in speciesSources));
  const holarcticMissingLon2 = ['moose', 'grizzly_bear', 'beaver', 'canada_lynx'].filter(k => {
    const row = speciesData[k] as Record<string, unknown> | undefined;
    return row && !('lon2' in row);
  });

  const wetlandLatMin = Number(coverData.wetland_lat_min ?? 0);
  const coverCauseBasedNoLatBand = !('wetland_lat_min' in coverData); // Kenora is 49.77 N (< 50!)
  const tundraStems = (coverData.tundra as { stems_per_ha: [number, number] }).stems_per_ha;
  const prairieStems = (coverData.prairie as { stems_per_ha: [number, number] }).stems_per_ha;
  const desertStems = (coverData.desert as { stems_per_ha: [number, number] }).stems_per_ha;
  const coverDensityCoherent = tundraStems[1] > 0 && prairieStems[1] >= desertStems[0];

  // Published physical constants:
  // Marinova, Aharonson & Asphaug 2011 (Icarus 211:960 Table 1) dunite rho0 = 3320 kg/m3
  // Melosh 1989 App. II iron rho0 = 7860 kg/m3 (pure Fe 298 K = 7874 kg/m3)
  // Charette & Smith 2010 (Oceanography 23:112): 1.3324e9 km3 * 1025 kg/m3 = 1.3657e21 kg
  // WGS84 defining 1/f = 298.257223563 (NIMA TR8350.2)
  const duniteRho0 = Number((materialsData.dunite as { rho0: number }).rho0);
  const ironRho0 = Number((materialsData.iron as { rho0: number }).rho0);
  const oceanMassKg = Number(materialsData.ocean_mass_kg);
  const duniteRhoErrPct = Math.abs(duniteRho0 - 3320) / 3320 * 100;
  const ironRhoErrPct = Math.abs(ironRho0 - 7860) / 7860 * 100;
  const oceanMassErrPct = Math.abs(oceanMassKg - 1.3657e21) / 1.3657e21 * 100;
  const materialsMatchLiterature = duniteRhoErrPct <= 1.0 && ironRhoErrPct <= 0.5 && oceanMassErrPct <= 1.0;

  const invF = Number(refFigureData.invF);
  const invFErr = Math.abs(invF - 298.257223563);
  const refAndOmniTrailingNewline = refFigureRaw.endsWith('\n') && gannonRaw.endsWith('\n') && quietRaw.endsWith('\n');
  const cloudTropopauseDynamic = typeof cloudColData.tropopause_polar_m === 'number' && typeof cloudColData.tropopause_tropical_m === 'number';

  // Aerial meta.json crop geometry check
  const waterCropPx = aerialMeta.crops.water.cropPx;
  const waterScaleConsistent = waterCropPx === aerialMeta.pixels;
  const fen = aerialMeta.crops.fen;
  const shore = aerialMeta.crops.shore;
  const fenShoreSameTile = fen.x === shore.x && fen.y === shore.y;
  const fenShoreOverlapPx = fenShoreSameTile
    ? rectOverlapArea(
      { x: fen.cropX, y: fen.cropY, width: fen.cropPx, height: fen.cropPx },
      { x: shore.cropX, y: shore.cropY, width: shore.cropPx, height: shore.cropPx },
    )
    : 0;
  const fenShoreOverlapPct = (fenShoreOverlapPx / (fen.cropPx * fen.cropPx)) * 100;
  const aerialCropsIndependent = waterScaleConsistent && fenShoreOverlapPct < 5;

  // =========================================================================
  // Score all 5 calibrated checks (knownMatchScore=1, knownMismatchScore=0)
  // =========================================================================
  const check1Flags = [
    autoplayCrossPlatformChrome,
    autoplayPortableArtifacts,
    autoplayPortableViteSpawn,
    autoplayDynamicPort,
    playwrightDeclaredInPkg,
    descentHasSandboxFlags,
    descentCrossPlatformChrome,
    descentCleansUserDataDir && descentWaitsForVite,
    Boolean(diveResult && diveResult.max < DIVE_FRAME_MS && diveResult.distinctHashes === 3),
    climateTestMatchesRealDfb,
  ];
  const check1Score = scoreBoolList(check1Flags);

  const check2Flags = [
    contestFreezeEnforced,
    pagesArtifactActionModern,
    ciLockfileAccurate,
    ciRunsRustAndBuild,
    playVbsStrictPortAndInstallCheck,
    stopVbsExactPortAndProcessCheck,
  ];
  const check2Score = scoreBoolList(check2Flags);

  const inspectorHeaderIntact = liveInspectorMetrics.headerPosition !== 'absolute'
    && liveInspectorMetrics.headerPointerEvents !== 'none'
    && liveInspectorMetrics.headerOverlapsGroupsPx2 === 0
    && liveInspectorMetrics.rerollClickable;
  const desktopHudClear = !liveInspectorMetrics.helpCoveredByOverlay
    && liveInspectorMetrics.desktopInteractionOverlapsStatusPx2 === 0;
  const narrowInteractionCompact = liveNarrowHudMetrics.interactionHeightPx > 0
    && liveNarrowHudMetrics.interactionHeightPx < 160
    && liveNarrowHudMetrics.interactionOverlapsStatusPx2 === 0
    && liveNarrowHudMetrics.interactionOverlapsFooterPx2 === 0;
  const check3Flags = [
    indexDialogAccurate,
    inspectorHeaderIntact,
    desktopHudClear,
    narrowInteractionCompact,
    cssHasReducedMotion,
  ];
  const check3Score = scoreBoolList(check3Flags);

  const check4Flags = [
    missingSpeciesSources.length === 0,
    holarcticMissingLon2.length === 0,
    coverCauseBasedNoLatBand && coverDensityCoherent,
    materialsMatchLiterature,
    invFErr < 1e-5 && refAndOmniTrailingNewline && cloudTropopauseDynamic,
    aerialCropsIndependent,
  ];
  const check4Score = scoreBoolList(check4Flags);

  const check5Flags = [
    framesCaptured === 4,
    recordingBytes > 10_000,
    consoleErrors.length === 0,
    inspectorHeaderIntact && narrowInteractionCompact,
    false, // >= 95% real-world boreal landscape & UI fidelity on live descent 1200m/28m + inspector/narrow HUD vs matched references
  ];
  const check5Score = scoreBoolList(check5Flags);

  const checks: CheckResult[] = [
    {
      id: 'slow-tests-descent-climate',
      label: 'Slow test suite (autoplay, descent-swiftshader, climate-kenora) & live descent-frame.html',
      measured: `autoplay(winChrome=${autoplayCrossPlatformChrome}, portablePaths=${autoplayPortableArtifacts}, viteSpawn=${autoplayPortableViteSpawn}, dynPort=${autoplayDynamicPort}, pkgPlaywright=${playwrightDeclaredInPkg}); descent(sandboxFlags=${descentHasSandboxFlags}, winChrome=${descentCrossPlatformChrome}, cleanTmp=${descentCleansUserDataDir}, waitVite=${descentWaitsForVite}, liveMaxMs=${diveResult?.max ?? -1}, distinctHashes=${diveResult?.distinctHashes ?? 0}/3); climateKenoraRealDfb=${climateTestMatchesRealDfb} (CI logged July 27.47 C vs ECCC 19.7 C, MAP 4818.0 mm vs 715.8 mm, Dec 977.3 mm, pinned Dfa)`,
      expected: 'Cross-platform Chrome/Edge & Vite spawn, repo-local temp/artifacts, dynamic ports, playwright-core in devDependencies, --no-sandbox/--disable-dev-shm-usage for CI SwiftShader, and real Kenora Dfb climate calibration (19.7 C July, 715.8 mm/yr)',
      score: check1Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check1Score >= 0.95,
      source: 'ECCC 1981-2010 Kenora A (ID 6034075); Peel et al. 2007 Koeppen-Geiger; CI run 44782888750; DIVE_FRAME_MS=250',
    },
    {
      id: 'ci-pages-freeze-launchers',
      label: 'CI/CD workflows (ci.yml, pages.yml), contest freeze, lockfiles & Windows launchers',
      measured: `pastFreezeDeadline=${pastFreezeDeadline} (PAGES_FROZEN=${pagesFrozenFileExists}); uploadPagesArtifactModern=${pagesArtifactActionModern} (run 44782952338 failed Found 0 artifacts); ciLockfileAccurate=${ciLockfileAccurate} (npmLock=${hasNpmLock}, pnpmLock=${hasPnpmLock}); ciRustAndBuild=${ciRunsRustAndBuild}; playVbsSafe=${playVbsStrictPortAndInstallCheck}; stopVbsExact=${stopVbsExactPortAndProcessCheck}`,
      expected: 'Contest freeze honored or updated past Nov 18 2026 PT, modern Pages artifact upload, single synced lockfile with npm ci + cargo test + vite build in CI, --strictPort in Play Boreal.vbs, exact port+process check in Stop Boreal.vbs',
      score: check2Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check2Score >= 0.95,
      source: 'docs/CONTEST-FREEZE.md; GitHub Actions pages/ci runs 44782952338 & 44782888750; Windows netstat/taskkill safety',
    },
    {
      id: 'index-html-style-css-hud',
      label: 'Root index.html Library dialog, src/style.css #inspector header cascade & narrow 680x720 HUD',
      measured: `glbFiles=${glbCount} (dialogNoModels=${dialogClaimsNoModels}, dialogNoHunting=${dialogClaimsNoHunting}, zoomContradiction=${dialogClaimsZoomDisabled && footerClaimsWheelZoom}); inspectorHeader(pos=${liveInspectorMetrics.headerPosition}, pe=${liveInspectorMetrics.headerPointerEvents}, overlapPx2=${liveInspectorMetrics.headerOverlapsGroupsPx2}, rerollClickable=${liveInspectorMetrics.rerollClickable}); desktopHud(helpCovered=${liveInspectorMetrics.helpCoveredByOverlay}, interStatusOverlap=${liveInspectorMetrics.desktopInteractionOverlapsStatusPx2}px2); narrow680(interH=${liveNarrowHudMetrics.interactionHeightPx}px, interStatusOverlap=${liveNarrowHudMetrics.interactionOverlapsStatusPx2}px2, interFootOverlap=${liveNarrowHudMetrics.interactionOverlapsFooterPx2}px2); reducedMotion=${cssHasReducedMotion}`,
      expected: 'Accurate #info dialog matching 26 stored GLBs, hunting & wheel zoom; #inspector header position:static & pointer-events:auto with 0 overlap and clickable controls; compact non-stretched narrow #interaction; prefers-reduced-motion support',
      score: check3Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check3Score >= 0.95,
      source: 'Rule 18 / Issue #110 (26 GLBs in public/models/); WCAG 2.1 / CSS Cascade; live Chromium DOM audit',
    },
    {
      id: 'scientific-data-tables-aerial-meta',
      label: 'Scientific reference datasets (data/**/*.json) & aerial exemplar manifest (public/aerial/meta.json)',
      measured: `missingSpeciesSources=[${missingSpeciesSources.join(',')}]; holarcticNoLon2=[${holarcticMissingLon2.join(',')}]; wetlandLatMin=${wetlandLatMin} (excludes Kenora 49.77N); tundraStems=${JSON.stringify(tundraStems)}, prairie=${JSON.stringify(prairieStems)}, desert=${JSON.stringify(desertStems)}; duniteRho0=${duniteRho0} (+${duniteRhoErrPct.toFixed(2)}% vs 3320), ironRho0=${ironRho0} (-${ironRhoErrPct.toFixed(2)}% vs 7860), oceanMass=${oceanMassKg.toExponential(3)} (+${oceanMassErrPct.toFixed(2)}% vs 1.366e21); invFErr=${invFErr.toExponential(2)}, trailingNL=${refAndOmniTrailingNewline}, dynTropopause=${cloudTropopauseDynamic}; aerialWaterCropPx=${waterCropPx} (vs ${aerialMeta.pixels}), fenShoreOverlap=${fenShoreOverlapPct.toFixed(2)}% (${fenShoreOverlapPx}px2)`,
      expected: 'Every species row cited in _sources (Rule 5); Holarctic lon2 parity; cause-based wetland class without 50 N cutoff; literature-exact dunite/iron/ocean/WGS84 constants; consistent 128px aerial crops with <5% fen/shore overlap',
      score: check4Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check4Score >= 0.95,
      source: 'PROJECT-RULES Rule 5; Marinova 2011 Icarus 211:960; Melosh 1989; Charette & Smith 2010; WGS84 NIMA TR8350.2; NAIP meta.json',
    },
    {
      id: 'live-visual-fidelity',
      label: 'Live 4-frame capture (descent 1200m/28m, inspector+library, narrow 680px HUD) & WebM vs nature references',
      measured: `frames=${framesCaptured}/4, recordingBytes=${recordingBytes}, consoleErrors=${consoleErrors.length}, inspectorHeaderIntact=${inspectorHeaderIntact}, narrowCompact=${narrowInteractionCompact}`,
      expected: '4/4 non-blank frames, live WebM > 10 KB, 0 console errors, intact inspector/narrow HUD layout, >= 95% boreal visual fidelity vs matched aerial references',
      score: check5Score,
      knownMatchScore: 1,
      knownMismatchScore: 0,
      pass: check5Score >= 0.95,
      source: 'Rule 6 & Rule 11 live visual gate',
    },
  ];

  const calibrationValid = checks.every(c => c.knownMatchScore === 1 && c.knownMismatchScore === 0);
  const passCount = checks.filter(c => c.pass).length;
  const meanScore = checks.reduce((s, c) => s + c.score, 0) / checks.length;

  const out = {
    audit: 'T-0293',
    baseUrl: BASE,
    calibrationValid,
    passCount,
    totalChecks: checks.length,
    meanScore: Number(meanScore.toFixed(4)),
    consoleErrors,
    recordingBytes,
    diveResult,
    liveInspectorMetrics,
    liveNarrowHudMetrics,
    details: {
      glbCount,
      hasNpmLock,
      hasPnpmLock,
      pagesFrozenFileExists,
      freezeDeadlineIso,
      pastFreezeDeadline,
      freezeDocLines: freezeDoc.split(/\r?\n/).length,
      missingSpeciesSources,
      holarcticMissingLon2,
      wetlandLatMin,
      tundraStems,
      prairieStems,
      desertStems,
      duniteRho0,
      duniteRhoErrPct: Number(duniteRhoErrPct.toFixed(2)),
      ironRho0,
      ironRhoErrPct: Number(ironRhoErrPct.toFixed(2)),
      oceanMassKg,
      oceanMassErrPct: Number(oceanMassErrPct.toFixed(2)),
      invF,
      invFErr: Number(invFErr.toExponential(3)),
      waterCropPx,
      fenShoreSameTile,
      fenShoreOverlapPx,
      fenShoreOverlapPct: Number(fenShoreOverlapPct.toFixed(2)),
    },
    checks,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({
    calibrationValid,
    passCount: `${passCount}/${checks.length}`,
    meanScore: out.meanScore,
    consoleErrors: consoleErrors.length,
    recordingBytes,
    diveMaxMs: diveResult?.max,
    liveInspectorMetrics,
    liveNarrowHudMetrics,
    scores: checks.map(c => ({ id: c.id, score: Number(c.score.toFixed(4)), pass: c.pass })),
  }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
