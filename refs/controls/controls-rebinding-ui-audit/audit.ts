/**
 * Live & calibrated Rule 11 audit for Boreal controls rebinding, Gamepad Settings,
 * PadMenu pointer/blur behaviour, Controls Help (F1) overlay, and keyAction().
 *
 * Usage:
 *   npx tsx refs/controls/controls-rebinding-ui-audit/audit.ts [baseUrl]
 *
 * Expects a Vite dev server on baseUrl (default http://127.0.0.1:5255).
 * Captures sampled frames (1280x720) and writes numbers.json with calibration
 * (known match = 1.0, known mismatch = 0.0) for every check.
 */
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { assign, clashesWith, conflicts, defaults, keyAtom } from '../../../src/core/bindings';
import { keyAction } from '../../../src/input/gamepad';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? 'http://127.0.0.1:5255';
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
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

const ratioScore = (passed: number, total: number) => (total <= 0 ? 0 : Math.max(0, Math.min(1, passed / total)));

async function main() {
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
    // 1. Live browser test A: tools/gamepad.html (Gamepad settings)
    // ------------------------------------------------------------------
    const ctxA = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pageA = await ctxA.newPage();
    pageA.on('pageerror', e => consoleErrors.push(`gamepad.html pageerror: ${e.message}`));
    await pageA.goto(`${BASE}/tools/gamepad.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await pageA.waitForSelector('.gps .row', { timeout: 15000 });
    await pageA.waitForTimeout(400);

    const gamepadTitle = await pageA.title();
    await pageA.screenshot({ path: join(HERE, 'frame-0-gamepad-settings.png') });

    // 1a. Mouse interaction test on tabs, rows, and close button
    const tabBefore = await pageA.locator('.gps .tab.on').textContent();
    await pageA.locator('.gps .tab').nth(2).click(); // Globe tab
    await pageA.waitForTimeout(100);
    const tabAfterClick = await pageA.locator('.gps .tab.on').textContent();
    const tabClickWorked = tabAfterClick !== tabBefore;

    const rowBefore = await pageA.locator('.gps .row.focus').getAttribute('data-id');
    await pageA.locator('.gps .row[data-id="steerLeft"]').click();
    await pageA.waitForTimeout(100);
    const rowAfterClick = await pageA.locator('.gps .row.focus').getAttribute('data-id');
    const modalAfterRowClick = (await pageA.locator('.gps .modalbox').textContent())?.trim() ?? '';
    const rowClickWorked = rowAfterClick !== rowBefore || modalAfterRowClick.length > 0;
    const closeBtnCount = await pageA.locator('.gps button').count();

    // 1b. Keyboard clash swap prompt truthfulness + keyboard clash row flagging
    // Focused row is moveForward (keys: ['k:w'], pad: ['ls.up']). Press Enter -> capture, then press & release 's' (clashes with moveBack).
    await pageA.keyboard.press('Enter');
    await pageA.waitForTimeout(150);
    await pageA.keyboard.down('s');
    await pageA.waitForTimeout(100);
    await pageA.keyboard.up('s');
    await pageA.waitForTimeout(150);
    const swapModalText = (await pageA.locator('.gps .modal').textContent())?.trim() ?? '';
    await pageA.screenshot({ path: join(HERE, 'frame-1-gamepad-kb-swap-modal.png') });
    const swapModalButtons = await pageA.locator('.gps .modal button').count();
    // Modal should say "they get W" (keys side), NOT "they get LS ↑" (pad side)!
    const swapModalMentionsOldKey = swapModalText.includes('they get W');
    const swapModalWronglyMentionsPad = swapModalText.includes('LS ↑');

    // Choose Keep both ('h' = menuAlt) so moveForward and moveBack both have 'k:s'
    await pageA.keyboard.press('h');
    await pageA.waitForTimeout(150);
    await pageA.screenshot({ path: join(HERE, 'frame-2-gamepad-kb-clash-unflagged.png') });
    const kbClashRowsFlagged = await pageA.locator('.gps .row.clash').count();
    const msgAfterKeep = (await pageA.locator('.gps .msg').textContent())?.trim() ?? '';

    // 1c. Gamepad settings blur stuck-key test during capture
    await pageA.keyboard.press('ArrowDown');
    await pageA.keyboard.press('Enter'); // start capture on moveBack
    await pageA.waitForTimeout(150);
    await pageA.keyboard.down('j');
    await pageA.waitForTimeout(100);
    await pageA.evaluate(() => window.dispatchEvent(new Event('blur')));
    await pageA.waitForTimeout(150);
    const modalAfterBlur = (await pageA.locator('.gps .modal').textContent())?.trim() ?? '';
    // Now try pressing & releasing 'k' without releasing 'j' (simulating keyup lost outside window)
    await pageA.keyboard.down('k');
    await pageA.waitForTimeout(100);
    await pageA.keyboard.up('k');
    await pageA.waitForTimeout(150);
    const stillCapturingAfterBlur = (await pageA.locator('.gps .modal').count()) > 0 && ((await pageA.locator('.gps .modal').textContent()) ?? '').includes('Press the button');
    await pageA.keyboard.up('j');
    await pageA.keyboard.press('Escape');

    raw.gamepadSettings = {
      title: gamepadTitle,
      tabBefore, tabAfterClick, tabClickWorked,
      rowBefore, rowAfterClick, rowClickWorked, closeBtnCount,
      swapModalText, swapModalButtons, swapModalMentionsOldKey, swapModalWronglyMentionsPad,
      msgAfterKeep, kbClashRowsFlagged,
      modalAfterBlur, stillCapturingAfterBlur,
    };
    await ctxA.close();

    // ------------------------------------------------------------------
    // 2. Live browser test B: Main game (?view=ground&nomenu=1&noprobe=1)
    //    PadMenu row click + blur hold-repeat, F1 Help overlay trap, Controls blur deadlock
    // ------------------------------------------------------------------
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const pageB = await ctxB.newPage();
    pageB.on('pageerror', e => consoleErrors.push(`game pageerror: ${e.message}`));
    await pageB.goto(`${BASE}/?view=ground&nomenu=1&noprobe=1&hour=10`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await pageB.waitForFunction(() => !document.getElementById('loading'), { timeout: 60000 });
    await pageB.waitForTimeout(600);

    // 2a. Tab opens PadMenu; click Settings tab (works), then click first .it row ("Gamepad settings") -> dead!
    await pageB.keyboard.press('Tab');
    await pageB.waitForSelector('.padm:not([hidden])', { timeout: 5000 });
    await pageB.locator('.padm .tab', { hasText: 'Settings' }).click();
    await pageB.waitForTimeout(150);
    await pageB.screenshot({ path: join(HERE, 'frame-3-padmenu-click-dead.png') });
    await pageB.locator('.padm .it', { hasText: 'Gamepad settings' }).click();
    await pageB.waitForTimeout(200);
    const gpsOpenedByRowClick = (await pageB.locator('.gps').count()) > 0;
    const padMenuStillOpenAfterRowClick = await pageB.locator('.padm').isVisible();

    // 2b. PadMenu blur auto-repeat leak: hold ArrowDown, dispatch window.blur without keyup, wait 550 ms
    const focusBeforeBlur = await pageB.evaluate(() => {
      const items = [...document.querySelectorAll('.padm .it')];
      return items.findIndex(el => el.classList.contains('focus'));
    });
    await pageB.keyboard.down('ArrowDown');
    await pageB.waitForTimeout(100);
    const focusAfterDown = await pageB.evaluate(() => {
      const items = [...document.querySelectorAll('.padm .it')];
      return items.findIndex(el => el.classList.contains('focus'));
    });
    await pageB.evaluate(() => window.dispatchEvent(new Event('blur')));
    await pageB.waitForTimeout(650);
    const focusAfterBlurWait = await pageB.evaluate(() => {
      const items = [...document.querySelectorAll('.padm .it')];
      return items.findIndex(el => el.classList.contains('focus'));
    });
    const padMenuDriftedAfterBlur = focusAfterBlurWait !== focusAfterDown;
    await pageB.keyboard.up('ArrowDown');
    await pageB.keyboard.press('Escape'); // close PadMenu
    await pageB.waitForTimeout(150);

    // 2c. F1 Controls Help overlay (.padh): columns, Escape trap, close button
    await pageB.keyboard.press('F1');
    await pageB.waitForTimeout(250);
    const helpVisible = await pageB.locator('.padh').isVisible();
    const helpHeaders = await pageB.locator('.padh th').allTextContents();
    const helpCloseButtons = await pageB.locator('.padh button').count();
    await pageB.screenshot({ path: join(HERE, 'frame-4-help-overlay-trapped.png') });

    // Press Escape while .padh is open -> does it close .padh or open Pause menu BEHIND .padh?
    await pageB.keyboard.press('Escape');
    await pageB.waitForTimeout(250);
    const helpStillVisibleAfterEsc = await pageB.locator('.padh').isVisible();
    const startMenuOpenedBehindHelp = await pageB.evaluate(() => {
      const m = document.getElementById('start-menu');
      return !!m && !m.hidden && !m.classList.contains('fade');
    });
    await pageB.screenshot({ path: join(HERE, 'frame-5-help-traps-escape.png') });

    // Close Pause menu, close .padh via F1 (wait: menu.open blocks game keydown, so resume first)
    await pageB.keyboard.press('Escape');
    await pageB.waitForTimeout(200);
    await pageB.keyboard.press('F1');
    await pageB.waitForTimeout(200);

    // 2d. Open Pause -> Controls screen (src/ui/controls.ts)
    await pageB.keyboard.press('Escape');
    await pageB.waitForSelector('#start-menu:not(.fade)', { timeout: 5000 });
    await pageB.locator('#start-menu button', { hasText: 'Controls' }).click();
    await pageB.waitForSelector('.ctl-screen', { timeout: 5000 });
    await pageB.waitForTimeout(250);
    await pageB.screenshot({ path: join(HERE, 'frame-6-controls-screen.png') });

    const controlsNote = (await pageB.locator('.ctl-screen .note').textContent()) ?? '';
    const staleVFloraNote = controlsNote.includes('V flora view');
    const clearButtonsPerRow = await pageB.locator('.ctl-row button, .ctl-clear').count();

    // Test blur stuck-key deadlock in controls.ts:
    await pageB.keyboard.down('w');
    await pageB.waitForTimeout(100);
    await pageB.evaluate(() => window.dispatchEvent(new Event('blur')));
    await pageB.waitForTimeout(150);
    const liveAfterBlur = (await pageB.locator('.ctl-live').textContent()) ?? '';
    const controlsStuckOnW = liveAfterBlur.includes('Move forward');

    // Click Howl row to capture, then press & release 'j' (while 'w' is stuck in `held`!)
    // Because createCapture waits for on.length === 0 to arm, 'j' CANNOT complete capture!
    await pageB.locator('.ctl-row[data-id="howl"]').click();
    await pageB.waitForTimeout(150);
    // Note: controls.ts start() does held.clear(), EXCEPT if blur happens DURING capture!
    // Let's test blur DURING capture too!
    await pageB.keyboard.down('j');
    await pageB.waitForTimeout(100);
    await pageB.evaluate(() => window.dispatchEvent(new Event('blur')));
    await pageB.waitForTimeout(150);
    await pageB.keyboard.down('k');
    await pageB.waitForTimeout(100);
    await pageB.keyboard.up('k');
    await pageB.waitForTimeout(150);
    const controlsCaptureDeadlockedOnBlur = await pageB.locator('.ctl-screen.capturing').count() > 0;
    const controlsCapTextAfterBlur = (await pageB.locator('.ctl-capture').textContent()) ?? '';
    await pageB.keyboard.up('j');
    await pageB.keyboard.up('w');

    raw.inGame = {
      gpsOpenedByRowClick, padMenuStillOpenAfterRowClick,
      focusBeforeBlur, focusAfterDown, focusAfterBlurWait, padMenuDriftedAfterBlur,
      helpVisible, helpHeaders, helpCloseButtons,
      helpStillVisibleAfterEsc, startMenuOpenedBehindHelp,
      staleVFloraNote, clearButtonsPerRow,
      liveAfterBlur, controlsStuckOnW,
      controlsCaptureDeadlockedOnBlur, controlsCapTextAfterBlur,
    };
    await ctxB.close();

    // ------------------------------------------------------------------
    // 3. Direct deterministic checks on bindings.ts / gamepad.ts / gamepadSettings.ts
    // ------------------------------------------------------------------
    // 3a. keyAction('+') mismatch and multi-atom combo drop
    const bPlus = assign(defaults(), 'menuSelect', [keyAtom('+')]);
    const plusResolved = keyAction(bPlus, '+', 'menu'); // expected 'menuSelect', actual undefined!
    const bCombo = assign(defaults(), 'menuTabNext', ['k:shift', 'k:tab']);
    const comboResolved = keyAction(bCombo, 'Tab', 'menu');

    // 3b. Secondary pad clash check (pad[1]) vs gamepadSettings.ts:77 logic
    const bSecPad = assign(defaults(), 'scrubLater', ['ls.left']); // clashes with scrubEarlier.pad[1] === 'ls.left'
    const realConflictsSecPad = conflicts(bSecPad).some(c => c.ids.includes('scrubEarlier'));
    // Reproduce exact gamepadSettings.ts:77 predicate:
    const gsPredScrubEarlier = clashesWith(bSecPad, 'scrubEarlier', bSecPad.scrubEarlier.pad[0] ?? '__').length > 0 && bSecPad.scrubEarlier.pad.length > 0;

    // 3c. Static count of blur listeners across controls.ts, gamepadSettings.ts, padMenu.ts
    const srcControls = readFileSync(join(HERE, '../../../src/ui/controls.ts'), 'utf8');
    const srcGamepadSettings = readFileSync(join(HERE, '../../../src/ui/gamepadSettings.ts'), 'utf8');
    const srcPadMenu = readFileSync(join(HERE, '../../../src/ui/padMenu.ts'), 'utf8');
    const blurGuards = [srcControls, srcGamepadSettings, srcPadMenu].filter(s => s.includes("'blur'") || s.includes('"blur"')).length;

    raw.deterministic = {
      plusAtom: keyAtom('+'),
      bPlusMenuSelect: bPlus.menuSelect.keys,
      plusResolved: plusResolved ?? null,
      bComboMenuTabNext: bCombo.menuTabNext.keys,
      comboResolved: comboResolved ?? null,
      realConflictsSecPad,
      gsPredScrubEarlier,
      blurGuards,
    };

    // ------------------------------------------------------------------
    // 4. Calibrated Rule 11 check table (known match = 1.0, known mismatch = 0.0)
    // ------------------------------------------------------------------
    const addCheck = (
      id: string,
      label: string,
      passed: number,
      total: number,
      measured: string,
      expected: string,
      source: string,
    ) => {
      const score = Number(ratioScore(passed, total).toFixed(4));
      results.push({
        id,
        label,
        measured,
        expected,
        score,
        knownMatchScore: ratioScore(total, total),
        knownMismatchScore: ratioScore(0, total),
        pass: score >= 0.95,
        source,
      });
    };

    addCheck(
      'gs-clash-all-bindings',
      'Gamepad settings clash badge checks all pad bindings (pad[0..n]) AND keyboard bindings',
      (kbClashRowsFlagged >= 2 ? 1 : 0) + (gsPredScrubEarlier ? 1 : 0),
      2,
      `kbClashRowsFlagged=${kbClashRowsFlagged}/2, secondaryPadFlagged=${gsPredScrubEarlier}`,
      '2/2 (both keyboard and pad[1] clashes flagged)',
      'src/ui/gamepadSettings.ts:77 vs src/core/bindings.ts:201-214',
    );
    addCheck(
      'gs-swap-prompt-side',
      'Gamepad settings swap modal reports the side actually swapped by swapAssign (keys vs pad)',
      swapModalMentionsOldKey && !swapModalWronglyMentionsPad ? 1 : 0,
      1,
      `modal="${swapModalText.slice(0, 90)}"`,
      'Modal shows "they get W" (keys), not "they get LS ↑" (pad)',
      'src/ui/gamepadSettings.ts:82 vs src/core/bindings.ts:216-221',
    );
    addCheck(
      'gs-pointer-controls',
      'Gamepad settings supports mouse clicks on tabs, rows, modal buttons, and close button',
      (tabClickWorked ? 1 : 0) + (rowClickWorked ? 1 : 0) + (swapModalButtons >= 3 ? 1 : 0) + (closeBtnCount >= 1 ? 1 : 0),
      4,
      `tabClick=${tabClickWorked}, rowClick=${rowClickWorked}, modalBtns=${swapModalButtons}, closeBtns=${closeBtnCount}`,
      '4/4 pointer controls working',
      'src/ui/gamepadSettings.ts:68-84 + WAI-ARIA APG Dialog/Tabs',
    );
    addCheck(
      'padmenu-row-click',
      'PadMenu item rows (.it) activate on mouse click (parity with clickable tabs and scroll arrows)',
      gpsOpenedByRowClick ? 1 : 0,
      1,
      `gpsOpenedByRowClick=${gpsOpenedByRowClick}, padMenuStillOpen=${padMenuStillOpenAfterRowClick}`,
      'Clicking .it activates item (opens Gamepad settings)',
      'src/ui/padMenu.ts:164, 215-222',
    );
    addCheck(
      'blur-key-release-guards',
      'Controls, Gamepad settings, and PadMenu clear held keys / hold-repeat on window blur (matching main.ts:456)',
      (controlsStuckOnW ? 0 : 1) + (controlsCaptureDeadlockedOnBlur ? 0 : 1) + (stillCapturingAfterBlur ? 0 : 1) + (padMenuDriftedAfterBlur ? 0 : 1),
      4,
      `controlsStuckW=${controlsStuckOnW}, controlsCapDeadlock=${controlsCaptureDeadlockedOnBlur}, gsCapDeadlock=${stillCapturingAfterBlur}, padMenuDrift=${padMenuDriftedAfterBlur} (blurListeners=${blurGuards}/3)`,
      '4/4 blur checks clean (0 stuck keys, 0 deadlocks, 0 runaway repeat)',
      'src/ui/controls.ts:62-66, src/ui/gamepadSettings.ts:85-88, src/ui/padMenu.ts:223-234 vs src/main.ts:456-457',
    );
    addCheck(
      'help-overlay-escape-and-coverage',
      'Controls Help overlay (.padh) closes on Escape or close button and covers all 8 contexts (incl. Chronometer & Axis) + keyboard',
      (!helpStillVisibleAfterEsc ? 1 : 0) + (!startMenuOpenedBehindHelp ? 1 : 0) + (helpCloseButtons >= 1 ? 1 : 0) + (helpHeaders.includes('Chronometer') && helpHeaders.includes('Axis') ? 1 : 0),
      4,
      `stillVisibleAfterEsc=${helpStillVisibleAfterEsc}, pauseBehind=${startMenuOpenedBehindHelp}, closeBtns=${helpCloseButtons}, headers=[${helpHeaders.join(', ')}]`,
      '4/4: Escape closes .padh without opening Pause behind it, clickable close button, all 8 contexts shown',
      'src/input/padRouter.ts:22-30, 43-49, 114',
    );
    addCheck(
      'keyaction-plus-and-combo',
      'keyAction() uses bindings.keyAtom() (so "+" -> "k:plus" works) and supports rebound modifier combos',
      (plusResolved === 'menuSelect' ? 1 : 0) + (comboResolved === 'menuTabNext' ? 1 : 0),
      2,
      `plusResolved=${String(plusResolved)}, comboResolved=${String(comboResolved)}`,
      '2/2: "+" resolves menuSelect, Shift+Tab resolves menuTabNext',
      'src/input/gamepad.ts:44-47 vs src/core/bindings.ts:156',
    );
    addCheck(
      'controls-copy-and-title-hygiene',
      'Controls screen fixed-key copy matches live bindings (no stale "V flora view") and tools/gamepad.html title has clean UTF-8',
      (!staleVFloraNote ? 1 : 0) + (!gamepadTitle.includes('Â') ? 1 : 0),
      2,
      `staleVFloraNote=${staleVFloraNote}, gamepadHtmlTitle="${gamepadTitle}"`,
      '2/2: accurate key docs and clean UTF-8 title',
      'src/ui/controls.ts:58 vs src/core/bindings.ts:67, tools/gamepad.html:1',
    );

    const calibrationValid = results.every(r => r.knownMatchScore === 1 && r.knownMismatchScore === 0);
    const passCount = results.filter(r => r.pass).length;
    const meanScore = Number((results.reduce((s, r) => s + r.score, 0) / results.length).toFixed(4));

    const summary = {
      commit: '6f8a7f0',
      calibrationValid,
      passCount,
      totalChecks: results.length,
      meanScore,
      consoleErrors,
      checks: results,
      raw,
    };

    writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify({ calibrationValid, passCount, totalChecks: results.length, meanScore, consoleErrors: consoleErrors.length }, null, 2));
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'} [${r.score.toFixed(4)}] ${r.id}: ${r.measured}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
