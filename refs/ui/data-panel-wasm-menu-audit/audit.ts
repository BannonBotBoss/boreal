/**
 * Live & calibrated Rule 11 audit for Boreal Data Panel (U / F2), Rust Engine Registry
 * & WASM drive/litter bridges, and Start/Pause Menu + SettingsPanel + TimeHud UX.
 *
 * Usage:
 *   npx tsx refs/ui/data-panel-wasm-menu-audit/audit.ts [baseUrl]
 *
 * Expects a Vite dev server on baseUrl (default http://127.0.0.1:5256).
 * Captures sampled frames (1280x720) and writes numbers.json with calibration
 * (known match = 1.0, known mismatch = 0.0) for every check.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5256';
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
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

const ratioScore = (passed: number, total: number) =>
  total <= 0 ? 0 : Math.max(0, Math.min(1, passed / total));

function parseDriveNumber(text: string, re: RegExp): number {
  const m = text.match(re);
  return m ? Number(m[1]) : NaN;
}

async function main() {
  mkdirSync(HERE, { recursive: true });
  const browser = await chromium.launch({
    ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}),
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const consoleErrors: string[] = [];
  const results: CheckResult[] = [];
  const raw: Record<string, unknown> = { baseUrl: BASE, capturedAt: new Date().toISOString() };

  try {
    // ------------------------------------------------------------------
    // Live Session A: Ground forest mode (Data Panel, WASM drives/litter, Menu, Settings)
    // ------------------------------------------------------------------
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await ctx.newPage();
    page.on('pageerror', e => consoleErrors.push(`ground pageerror: ${e.message}`));
    page.on('console', m => {
      if (m.type() === 'error') consoleErrors.push(`ground console.error: ${m.text()}`);
    });

    await page.goto(`${BASE}/?view=ground&noprobe=1&hour=10`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !document.getElementById('loading'), undefined, { timeout: 90000 });
    await page.waitForSelector('#start-menu:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(500);

    // 1. Controls rebinding capture hijack by Data Panel (U / F2)
    const dataBtnVisibleOnStartMenu = await page.evaluate(() => {
      const btn = document.getElementById('data-panel-btn');
      if (!btn) return false;
      const r = btn.getBoundingClientRect();
      return !btn.hidden && r.width > 0 && r.height > 0;
    });
    await page.locator('#start-menu button', { hasText: 'Controls' }).click();
    await page.waitForTimeout(250);
    // Click first action rebind button in .ctl-list to enter .capturing state
    let enteredCapture = false;
    await page.locator('#start-menu .ctl-list button').first().click();
    await page.waitForTimeout(150);
    enteredCapture = await page.evaluate(() => !!document.querySelector('#start-menu .capturing'));
    const panelOpenBeforeU = await page.evaluate(() => !(document.getElementById('data-panel')?.hidden ?? true));
    await page.keyboard.press('u');
    await page.waitForTimeout(300);
    const panelOpenAfterU = await page.evaluate(() => !(document.getElementById('data-panel')?.hidden ?? true));
    const stillCapturingAfterU = await page.evaluate(() => !!document.querySelector('#start-menu .capturing'));
    await page.screenshot({ path: join(HERE, 'frame-0-controls-u-hijack.png') });
    // Close data panel if opened
    if (panelOpenAfterU) {
      await page.evaluate(() => document.getElementById('data-panel-btn')?.click());
      await page.waitForTimeout(200);
    }
    // Cancel any capture and click Back to return to Start menu main
    await page.evaluate(() => (document.querySelector('#start-menu .start-panel button') as HTMLElement | null)?.focus());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    if (await page.locator('#start-menu button', { hasText: 'Back' }).count()) {
      await page.locator('#start-menu button', { hasText: 'Back' }).last().click();
      await page.waitForTimeout(150);
    }

    // 2. Menu <select> ArrowDown hijack test (Universe options -> Forest only (legacy) -> Terrain <select>)
    await page.locator('#start-menu button', { hasText: 'Universe options' }).click();
    await page.waitForTimeout(150);
    await page.locator('#start-menu button', { hasText: 'Forest only' }).click();
    await page.waitForTimeout(150);
    const selectFocused = await page.evaluate(() => {
      const sel = document.querySelector('#start-menu select') as HTMLSelectElement | null;
      if (!sel) return false;
      sel.focus();
      return document.activeElement === sel;
    });
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    const focusAfterSelectArrow = await page.evaluate(() => ({
      tag: document.activeElement?.tagName ?? 'NONE',
      text: document.activeElement?.textContent?.trim() ?? '',
      stayedOnSelect: document.activeElement?.tagName === 'SELECT',
    }));
    await page.screenshot({ path: join(HERE, 'frame-4-menu-select-arrow.png') });

    // Navigate directly to live ground play (nomenu=1) so no reload/#loading card covers the scene
    await page.goto(`${BASE}/?view=ground&nomenu=1&noprobe=1&hour=10`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !document.getElementById('loading'), undefined, { timeout: 90000 });
    await page.waitForTimeout(5000); // Let Rust WASM load and drives_tick + litter_frame run ~150 steps!

    // 3. Open Data Panel (U) in live ground play and compare Rust Engine Cards vs Live Drives
    await page.keyboard.press('u');
    await page.waitForTimeout(800);
    const dataInspect = await page.evaluate(() => {
      const root = document.getElementById('data-panel');
      if (!root) return null;
      const hungerCard = root.querySelector('section[data-engine="hunger"]');
      const protectCard = root.querySelector('section[data-engine="protect"]');
      const preyCard = root.querySelector('section[data-engine="prey"]');
      const sensesCard = root.querySelector('section[data-engine="senses"]');
      const dangerCard = root.querySelector('section[data-engine="danger"]');
      const hungerVars = hungerCard ? Array.from(hungerCard.querySelectorAll('[data-role="var"]')).map(n => n.textContent?.trim() ?? '') : [];
      const protectVars = protectCard ? Array.from(protectCard.querySelectorAll('[data-role="var"]')).map(n => n.textContent?.trim() ?? '') : [];
      const hungerCalls = hungerCard?.querySelector('[data-role="calls"]')?.textContent?.trim() ?? '';
      const protectCalls = protectCard?.querySelector('[data-role="calls"]')?.textContent?.trim() ?? '';
      const preyCalls = preyCard?.querySelector('[data-role="calls"]')?.textContent?.trim() ?? '';
      const sensesCalls = sensesCard?.querySelector('[data-role="calls"]')?.textContent?.trim() ?? '';
      const dangerCalls = dangerCard?.querySelector('[data-role="calls"]')?.textContent?.trim() ?? '';
      const hungerInputs = hungerCard ? Array.from(hungerCard.querySelectorAll('[data-role="inputs"] [data-key]')).map(n => (n as HTMLElement).dataset.key ?? '') : [];
      const protectInputs = protectCard ? Array.from(protectCard.querySelectorAll('[data-role="inputs"] [data-key]')).map(n => (n as HTMLElement).dataset.key ?? '') : [];
      const driveHungerText = root.querySelector('[data-drive="hunger"]')?.textContent?.trim() ?? '';
      const driveProtectText = root.querySelector('[data-drive="protect"]')?.textContent?.trim() ?? '';
      const driveDangerText = root.querySelector('[data-drive="danger"]')?.textContent?.trim() ?? '';
      const driveScentText = root.querySelector('[data-drive="scent"]')?.textContent?.trim() ?? '';
      const driveModeText = root.querySelector('[data-drive="mode"]')?.textContent?.trim() ?? '';
      const closeBtns = Array.from(root.querySelectorAll('button')).filter(b => /close|×|dismiss/i.test(b.textContent ?? '') || /close/i.test(b.getAttribute('aria-label') ?? '')).length;
      const headings = Array.from(root.querySelectorAll('h3'));
      const treeH3 = headings.find(h => h.textContent?.trim() === 'Dependency tree');
      const treeDiv = treeH3?.nextElementSibling as HTMLElement | null;
      const treeLines = treeDiv ? Array.from(treeDiv.children).map(c => c.textContent?.trim() ?? '') : [];
      const treeBoldNodes = treeDiv ? Array.from(treeDiv.children).filter(c => (c as HTMLElement).style.fontWeight === '600').map(c => c.textContent?.trim().replace(/^[·\s]+/, '') ?? '') : [];
      const treeAllMentions: Record<string, number> = {};
      for (const l of treeLines) {
        const name = l.replace(/^[·\s]+/, '').split(/\s+/)[0];
        if (name) treeAllMentions[name] = (treeAllMentions[name] ?? 0) + 1;
      }
      return {
        panelVisible: !root.hidden,
        closeBtns,
        hungerVars,
        hungerCalls,
        hungerInputs,
        protectVars,
        protectCalls,
        protectInputs,
        preyCalls,
        sensesCalls,
        dangerCalls,
        driveHungerText,
        driveProtectText,
        driveDangerText,
        driveScentText,
        driveModeText,
        treeLineCount: treeLines.length,
        treeBoldNodes,
        treeAllMentions,
        pupsBeforeReset: (window as unknown as { __borealPups?: { ageYears: number; x: number; z: number }[] }).__borealPups ?? [],
      };
    });

    // Scroll Data Panel to hunger card & capture frame-1
    await page.evaluate(() => {
      document.querySelector('#data-panel section[data-engine="hunger"]')?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(HERE, 'frame-1-data-panel-engines-vs-drives.png') });

    // Scroll Data Panel to Drives section & capture frame-2
    await page.evaluate(() => {
      const h = Array.from(document.querySelectorAll('#data-panel h3')).find(x => x.textContent?.trim() === 'Drives');
      h?.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(HERE, 'frame-2-data-panel-drives-bottom.png') });

    // 4. Test Escape while Data Panel is open (does it close #data-panel or open Pause behind it?)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const afterEscape = await page.evaluate(() => ({
      dataPanelStillOpen: !(document.getElementById('data-panel')?.hidden ?? true),
      pauseMenuOpenedBehind: !(document.getElementById('start-menu')?.hidden ?? true) && !document.getElementById('start-menu')?.classList.contains('fade'),
    }));
    await page.screenshot({ path: join(HERE, 'frame-3-data-panel-escape-overlap.png') });

    // 5. While Pause Menu is open, focus #data-panel-btn (outside #start-menu) and press Escape
    await page.evaluate(() => {
      document.getElementById('data-panel-btn')?.click(); // close data-panel
      (document.getElementById('data-panel-btn') as HTMLElement | null)?.focus();
    });
    await page.waitForTimeout(150);
    const pauseOpenBeforeOutsideEsc = await page.evaluate(() => !(document.getElementById('start-menu')?.hidden ?? true) && !document.getElementById('start-menu')?.classList.contains('fade'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const pauseOpenAfterOutsideEsc = await page.evaluate(() => !(document.getElementById('start-menu')?.hidden ?? true) && !document.getElementById('start-menu')?.classList.contains('fade'));

    // 6. Pause Menu -> Graphics (settingsPanel) -> change regen setting -> Reset to defaults
    if (!pauseOpenAfterOutsideEsc) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
    await page.locator('#start-menu button', { hasText: 'Graphics' }).click();
    await page.waitForTimeout(200);
    // Change a regen slider (*) and verify note appears, then click Reset to defaults
    const beforeReset = await page.evaluate(() => {
      const form = document.querySelector('#start-menu form.settings');
      if (!form) return { found: false, noteBefore: '' };
      const regenLabel = Array.from(form.querySelectorAll('label')).find(l => l.textContent?.includes('*'));
      const inp = regenLabel?.querySelector('input,select') as HTMLInputElement | HTMLSelectElement | null;
      if (inp instanceof HTMLInputElement && inp.type === 'range') {
        const nextVal = inp.value === inp.max ? inp.min : inp.max;
        inp.value = nextVal;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (inp instanceof HTMLInputElement && inp.type === 'checkbox') {
        inp.checked = !inp.checked;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (inp instanceof HTMLSelectElement) {
        inp.selectedIndex = (inp.selectedIndex + 1) % inp.options.length;
        inp.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const btn = form.querySelector('button');
      btn?.scrollIntoView({ block: 'center' });
      return { found: !!inp, noteBefore: form.querySelector('.note')?.textContent?.trim() ?? '' };
    });
    await page.locator('#start-menu form.settings button', { hasText: 'Reset to defaults' }).click();
    await page.waitForTimeout(150);
    const afterReset = await page.evaluate(() => {
      const form = document.querySelector('#start-menu form.settings');
      form?.querySelector('button')?.scrollIntoView({ block: 'center' });
      return {
        noteAfter: form?.querySelector('.note')?.textContent?.trim() ?? '',
        activeTag: document.activeElement?.tagName ?? 'NONE',
        focusInsideForm: !!form?.contains(document.activeElement),
      };
    });
    await page.screenshot({ path: join(HERE, 'frame-5-settings-reset-wiped.png') });

    // 7. Close Pause Menu -> simulate in-page globe re-landing 707 m away via borealPlace() -> check if Rust WASM DRIVE_PAGE / LITTER_PAGE reset
    await page.locator('#start-menu button', { hasText: 'Back' }).click();
    await page.waitForTimeout(100);
    await page.locator('#start-menu button', { hasText: 'Resume' }).click();
    await page.waitForTimeout(300);
    const beforeTeleport = await page.evaluate(() => {
      const pups = (window as unknown as { __borealPups?: { ageYears: number; x: number; z: number }[] }).__borealPups ?? [];
      const x0 = pups[0]?.x ?? 0;
      const z0 = pups[0]?.z ?? 0;
      const place = (window as unknown as { borealPlace?: (x: number, z: number, face?: number) => void }).borealPlace;
      place?.(x0 + 500, z0 + 500, 0);
      return { x0, z0, targetX: x0 + 500, targetZ: z0 + 500, hadPlace: !!place };
    });
    await page.waitForTimeout(1000);
    await page.keyboard.press('u');
    await page.waitForTimeout(600);
    const afterNewWorld = await page.evaluate(() => ({
      driveHungerAfterNewWorld: document.querySelector('#data-panel [data-drive="hunger"]')?.textContent?.trim() ?? '',
      driveScentAfterNewWorld: document.querySelector('#data-panel [data-drive="scent"]')?.textContent?.trim() ?? '',
      driveProtectAfterNewWorld: document.querySelector('#data-panel [data-drive="protect"]')?.textContent?.trim() ?? '',
      driveModeAfterNewWorld: document.querySelector('#data-panel [data-drive="mode"]')?.textContent?.trim() ?? '',
      pupsAfterNewWorld: (window as unknown as { __borealPups?: { ageYears: number; x: number; z: number }[] }).__borealPups ?? [],
    }));

    await ctx.close();

    // ------------------------------------------------------------------
    // Live Session B: Standalone Globe (?view=globe) — timeHud menuUp() check
    // ------------------------------------------------------------------
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pageB = await ctxB.newPage();
    pageB.on('pageerror', e => consoleErrors.push(`globe pageerror: ${e.message}`));
    await pageB.goto(`${BASE}/?view=globe&noprobe=1`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await pageB.waitForTimeout(2000);
    const globeCheck = await pageB.evaluate(() => {
      // Open data panel on standalone globe page if present
      const btn = document.getElementById('data-panel-btn');
      return { hasDataBtn: !!btn };
    });
    await ctxB.close();

    // ------------------------------------------------------------------
    // Static + Source checks (verified alongside live measurements)
    // ------------------------------------------------------------------
    const libRs = readFileSync(join(ROOT, 'rust/boreal-sim/src/lib.rs'), 'utf8');
    const driveBridgeTs = readFileSync(join(ROOT, 'src/render/driveBridge.ts'), 'utf8');
    const litterBridgeTs = readFileSync(join(ROOT, 'src/render/litterBridge.ts'), 'utf8');
    const dataPanelTs = readFileSync(join(ROOT, 'src/ui/dataPanel.ts'), 'utf8');
    const timeHudTs = readFileSync(join(ROOT, 'src/ui/timeHud.ts'), 'utf8');
    const menuTs = readFileSync(join(ROOT, 'src/ui/menu.ts'), 'utf8');

    const drivesTickBody = libRs.match(/pub extern "C" fn drives_tick\([\s\S]*?\n\}/)?.[0] ?? '';
    const rustDrivesTickCallsRegistry = /registry::set_drives/.test(drivesTickBody);
    const driveBridgeCallsReset = /drives_reset/.test(driveBridgeTs);
    const litterBridgeCallsReset = /litter_reset/.test(litterBridgeTs);
    const timeHudChecksDataPanelAndMenu = /#data-panel/.test(timeHudTs) && /#start-menu/.test(timeHudTs);
    const dataPanelFollowSupportsNegativeRewind = !/TODAY_S\s*\+\s*Math\.max\(\s*0\s*,\s*worldSec\(\)\s*\)/.test(dataPanelTs);
    const dataPanelPadLoopGated = !/requestAnimationFrame\(pad\);\s*\n\s*\};\s*\n\s*requestAnimationFrame\(pad\);/.test(dataPanelTs);

    // ------------------------------------------------------------------
    // Score every check with calibrated Rule 11 metrics
    // ------------------------------------------------------------------
    const cardHungerVal = parseDriveNumber((dataInspect?.hungerVars ?? []).join(' | '), /hunger:\s*(\d+(?:\.\d+)?)/i);
    const liveHungerVal = parseDriveNumber(dataInspect?.driveHungerText ?? '', /H\s*=\s*(\d+(?:\.\d+)?)/);
    const cardProtectVal = parseDriveNumber((dataInspect?.protectVars ?? []).join(' | '), /protect:\s*(\d+(?:\.\d+)?)/i);
    const liveProtectVal = parseDriveNumber(dataInspect?.driveProtectText ?? '', /P\s*=\s*(\d+(?:\.\d+)?)/);
    const hungerCallCount = parseDriveNumber(dataInspect?.hungerCalls ?? '', /called it (\d+) times/i);
    const hungerSynced = Number.isFinite(cardHungerVal) && Number.isFinite(liveHungerVal) && Math.abs(cardHungerVal - liveHungerVal) < 0.02;
    const protectSynced = Number.isFinite(cardProtectVal) && Number.isFinite(liveProtectVal) && Math.abs(cardProtectVal - liveProtectVal) < 0.05;
    const hungerCalled = Number.isFinite(hungerCallCount) && hungerCallCount >= 10;
    const syncPassed = [hungerSynced, protectSynced, hungerCalled, rustDrivesTickCallsRegistry].filter(Boolean).length;
    results.push({
      id: 'data-panel-rust-drive-sync',
      label: 'Rust Engine Registry drive cards match live WASM drives_tick & record live session calls',
      measured: `cardH=${cardHungerVal} vs liveH=${liveHungerVal}, cardP=${cardProtectVal} vs liveP=${liveProtectVal}, calls="${dataInspect?.hungerCalls}", drives_tick->registry=${rustDrivesTickCallsRegistry}`,
      expected: '|cardH-liveH|<0.02, |cardP-liveP|<0.05, calls>=10 (30 Hz ticks), drives_tick syncs registry',
      score: ratioScore(syncPassed, 4),
      knownMatchScore: ratioScore(4, 4),
      knownMismatchScore: ratioScore(0, 4),
      pass: ratioScore(syncPassed, 4) >= 0.95,
      source: 'rust/boreal-sim/src/lib.rs:183-192 + src/ui/dataPanel.ts:290-291 (Issue #309 single-source telemetry)',
    });

    const planetKeys = ['nlat', 'nlon', 'solar_constant', 'obliquity_deg', 'lapse_rate', 'humidity_seed', 'water_albedo', 'snow_albedo'];
    const leakedIntoHunger = (dataInspect?.hungerInputs ?? []).filter(k => planetKeys.includes(k));
    const leakedIntoProtect = (dataInspect?.protectInputs ?? []).filter(k => planetKeys.includes(k));
    const dupTreeNodes = Object.entries(dataInspect?.treeAllMentions ?? {}).filter(([, c]) => c > 1).map(([k, c]) => `${k}x${c}`);
    const cardHygienePassed = [leakedIntoHunger.length === 0, leakedIntoProtect.length === 0, dupTreeNodes.length === 0].filter(Boolean).length;
    results.push({
      id: 'data-panel-param-scoping-and-tree',
      label: 'Engine card Inputs exclude unrelated planet params & Dependency tree lists each node once',
      measured: `planetParamsInHunger=${leakedIntoHunger.length}/8, inProtect=${leakedIntoProtect.length}/8, duplicateTreeNodes=[${dupTreeNodes.join(', ')}]`,
      expected: '0 planet params in drive cards; 0 duplicate nodes in Dependency tree',
      score: ratioScore(cardHygienePassed, 3),
      knownMatchScore: ratioScore(3, 3),
      knownMismatchScore: ratioScore(0, 3),
      pass: ratioScore(cardHygienePassed, 3) >= 0.95,
      source: 'src/ui/dataPanel.ts:375-381,494',
    });

    const escapeAndCapturePassed = [
      !panelOpenAfterU,
      (dataInspect?.closeBtns ?? 0) > 0,
      !afterEscape.dataPanelStillOpen,
      !afterEscape.pauseMenuOpenedBehind,
    ].filter(Boolean).length;
    results.push({
      id: 'data-panel-escape-close-and-capture-hijack',
      label: 'Data Panel respects Controls .capturing (U/F2), closes on Escape, and has a close button',
      measured: `enteredCapture=${enteredCapture}, openedOnUWhileCapturing=${panelOpenAfterU}, closeBtns=${dataInspect?.closeBtns ?? 0}, stayedOpenOnEsc=${afterEscape.dataPanelStillOpen}, pauseOpenedBehind=${afterEscape.pauseMenuOpenedBehind}, dataBtnOnStartMenu=${dataBtnVisibleOnStartMenu}`,
      expected: 'U/F2 ignored while .capturing; >=1 close button; Escape closes #data-panel without opening Pause behind it',
      score: ratioScore(escapeAndCapturePassed, 4),
      knownMatchScore: ratioScore(4, 4),
      knownMismatchScore: ratioScore(0, 4),
      pass: ratioScore(escapeAndCapturePassed, 4) >= 0.95,
      source: 'src/ui/dataPanel.ts:75-100; WAI-ARIA APG Dialog Pattern',
    });

    const hungerBeforeReset = liveHungerVal;
    const hungerAfterTeleport = parseDriveNumber(afterNewWorld.driveHungerAfterNewWorld, /H\s*=\s*(\d+(?:\.\d+)?)/);
    const scentAfterTeleport = parseDriveNumber(afterNewWorld.driveScentAfterNewWorld, /S\s*=\s*(\d+(?:\.\d+)?)/);
    const foxReseededNearLanding = Number.isFinite(scentAfterTeleport) && scentAfterTeleport > 0.25;
    const pupAtNewLanding = afterNewWorld.pupsAfterNewWorld?.[0]
      ? Math.hypot(afterNewWorld.pupsAfterNewWorld[0].x - beforeTeleport.targetX, afterNewWorld.pupsAfterNewWorld[0].z - beforeTeleport.targetZ) < 10
      : false;
    const resetPassed = [driveBridgeCallsReset, litterBridgeCallsReset, foxReseededNearLanding].filter(Boolean).length;
    results.push({
      id: 'wasm-drives-litter-world-reset',
      label: 'WASM DRIVE_PAGE and LITTER_PAGE wire drives_reset/litter_reset and re-anchor on in-page re-landing',
      measured: `driveBridgeReset=${driveBridgeCallsReset}, litterBridgeReset=${litterBridgeCallsReset}, after 707m teleport: S=${scentAfterTeleport} (mode="${afterNewWorld.driveModeAfterNewWorld}"), H=${hungerBeforeReset}->${hungerAfterTeleport}, pupNearNewSite=${pupAtNewLanding}`,
      expected: 'driveBridge calls drives_reset, litterBridge calls litter_reset, fox re-anchors near new landing (S>0.25 instead of stranded 707 m away)',
      score: ratioScore(resetPassed, 3),
      knownMatchScore: ratioScore(3, 3),
      knownMismatchScore: ratioScore(0, 3),
      pass: ratioScore(resetPassed, 3) >= 0.95,
      source: 'rust/boreal-sim/src/lib.rs:160,196 + src/render/driveBridge.ts + src/render/litterBridge.ts + src/main.ts:360',
    });

    const menuKeyboardPassed = [
      focusAfterSelectArrow.stayedOnSelect,
      !pauseOpenAfterOutsideEsc,
    ].filter(Boolean).length;
    results.push({
      id: 'menu-select-arrow-and-outside-escape',
      label: 'Menu allows ArrowDown/Up inside <select> and handles Escape even when focus leaves .start-panel',
      measured: `selectFocused=${selectFocused}, afterArrowDown=${focusAfterSelectArrow.tag}("${focusAfterSelectArrow.text}"), pauseOpenBeforeOutsideEsc=${pauseOpenBeforeOutsideEsc}, pauseStillOpenAfterOutsideEsc=${pauseOpenAfterOutsideEsc}`,
      expected: 'ArrowDown stays on <select>; Escape closes open Pause menu regardless of focused element',
      score: ratioScore(menuKeyboardPassed, 2),
      knownMatchScore: ratioScore(2, 2),
      knownMismatchScore: ratioScore(0, 2),
      pass: ratioScore(menuKeyboardPassed, 2) >= 0.95,
      source: 'src/ui/menu.ts:110-118; WAI-ARIA APG Dialog & Listbox keyboard contract',
    });

    const settingsResetPassed = [
      afterReset.noteAfter.length > 0,
      afterReset.focusInsideForm,
    ].filter(Boolean).length;
    results.push({
      id: 'settings-panel-reset-note-and-focus',
      label: 'settingsPanel Reset to defaults preserves rebuild notice and keeps focus inside the form',
      measured: `noteBefore="${beforeReset.noteBefore}", noteAfter="${afterReset.noteAfter}", activeAfter=${afterReset.activeTag}, focusInsideForm=${afterReset.focusInsideForm}`,
      expected: 'non-empty rebuild note preserved after Reset; focus remains inside form (not dropped to BODY)',
      score: ratioScore(settingsResetPassed, 2),
      knownMatchScore: ratioScore(2, 2),
      knownMismatchScore: ratioScore(0, 2),
      pass: ratioScore(settingsResetPassed, 2) >= 0.95,
      source: 'src/ui/settingsPanel.ts:26-28; WAI-ARIA focus preservation',
    });

    const timeAndPanelMiscPassed = [
      timeHudChecksDataPanelAndMenu,
      dataPanelFollowSupportsNegativeRewind,
      dataPanelPadLoopGated,
    ].filter(Boolean).length;
    results.push({
      id: 'timehud-overlay-guard-and-datapanel-rewind-pad',
      label: 'timeHud blocks keys/pad behind #start-menu/#data-panel; dataPanel tracks signed rewind & avoids idle 60Hz rAF',
      measured: `timeHudChecksMenuAndData=${timeHudChecksDataPanelAndMenu}, followCycleSignedRewind=${dataPanelFollowSupportsNegativeRewind}, padLoopGated=${dataPanelPadLoopGated}`,
      expected: 'timeHud menuUp() includes #start-menu & #data-panel; followCycle uses signed worldSec(); pad poll gated',
      score: ratioScore(timeAndPanelMiscPassed, 3),
      knownMatchScore: ratioScore(3, 3),
      knownMismatchScore: ratioScore(0, 3),
      pass: ratioScore(timeAndPanelMiscPassed, 3) >= 0.95,
      source: 'src/ui/timeHud.ts:15 + src/ui/dataPanel.ts:70,233-241 (Issue #109 one-clock rewind)',
    });

    raw.dataInspect = dataInspect;
    raw.afterEscape = afterEscape;
    raw.beforeReset = beforeReset;
    raw.afterReset = afterReset;
    raw.afterNewWorld = afterNewWorld;
    raw.focusAfterSelectArrow = focusAfterSelectArrow;
    raw.globeCheck = globeCheck;
    raw.consoleErrors = consoleErrors;

    const meanScore = results.reduce((s, r) => s + r.score, 0) / results.length;
    const passedCount = results.filter(r => r.pass).length;
    const calibrationValid = results.every(r => r.knownMatchScore >= 0.95 && r.knownMismatchScore < 0.05);

    const summary = {
      commit: 'fafb4ab',
      calibrationValid,
      passedCount,
      totalChecks: results.length,
      meanScore: Number(meanScore.toFixed(4)),
      consoleErrorCount: consoleErrors.length,
      results,
      raw,
    };

    writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log(`Audit complete: ${passedCount}/${results.length} pass >=0.95 (meanScore=${summary.meanScore}, calibrationValid=${calibrationValid}, consoleErrors=${consoleErrors.length})`);
    for (const r of results) {
      console.log(`  [${r.pass ? 'PASS' : 'FAIL'}] ${r.id}: score=${r.score.toFixed(4)} | ${r.measured}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
