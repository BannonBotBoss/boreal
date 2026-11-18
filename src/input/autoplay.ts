/**
 * Self-playing visit for screen recordings and the headless check.
 * On only for `?autoplay=1` (or `?autoplay=<name>`). A normal load does not call it.
 * It types, clicks, and sends pointer and keyboard events. It does not move the
 * player, skip the loading screen, or shorten the drop. No simulation lives here.
 */

const KEY = 'boreal.autoplay';
const SEED = '1400';
const PLAY_S = 20;
const WALK_S = 3.5;

export function autoplayScenario(search: string): string | null {
  const v = new URLSearchParams(search).get('autoplay');
  if (v == null) return null;
  const name = v.trim().toLowerCase();
  if (name === '0' || name === 'off' || name === 'false' || name === 'no') return null;
  if (name === '' || name === '1' || name === 'true' || name === 'yes' || name === 'matthew') return 'matthew';
  return name;
}

export function autoplayLine(step: number, message: string, seconds: number): string {
  return `AUTOPLAY step ${step}: ${message} t=${seconds.toFixed(1)}s`;
}

type Phase = 'boot' | 'options' | 'seed' | 'film' | 'orbit' | 'fall' | 'play' | 'done';

interface Run {
  scenario: string;
  phase: Phase;
  step: number;
  t0: number;
  phaseAt: number;
  inLoad?: boolean;
  notedFilm?: boolean;
  startedFilm?: boolean;
  notedLabel?: boolean;
  notedFall?: boolean;
  landAt?: number;
  glideAt?: number;
  playAt?: number;
  usedCentre?: boolean;
  embodied?: boolean;
  explored?: boolean;
  approached?: boolean;
  walked?: boolean;
  orbited?: boolean;
  fault?: boolean;
}

const held = new Set<string>();
let holdTimer = 0;

export function startAutoplay(): void {
  if (typeof window === 'undefined') return;
  const mark = window as Window & { __autoplayStarted?: boolean };
  if (mark.__autoplayStarted) return;
  const run = loadRun();
  if (!run) return;
  mark.__autoplayStarted = true;
  (window as Window & { __autoplayDone?: boolean }).__autoplayDone = false;
  allowPageMadePointers();
  holdTimer = window.setInterval(() => { for (const k of held) keydown(k); }, 100);
  void loop(run);
}

function loadRun(): Run | null {
  const fromUrl = autoplayScenario(location.search);
  const saved = read();
  if (fromUrl == null) return saved && saved.phase !== 'done' ? saved : null;
  if (saved && saved.phase !== 'done' && saved.scenario === fromUrl) return saved;
  const now = Date.now();
  const fresh: Run = { scenario: fromUrl, phase: 'boot', step: 0, t0: now, phaseAt: now };
  write(fresh);
  return fresh;
}

function read(): Run | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as Run;
    if (!run || typeof run.phase !== 'string' || typeof run.t0 !== 'number') return null;
    return run;
  } catch { return null; }
}

function write(run: Run) {
  try { sessionStorage.setItem(KEY, JSON.stringify(run)); } catch { /* this page still runs */ }
}

function note(run: Run, message: string) {
  run.step += 1;
  const line = autoplayLine(run.step, message, (Date.now() - run.t0) / 1000);
  console.log(line);
  const w = window as Window & { __autoplayLog?: string[] };
  (w.__autoplayLog ??= []).push(line);
}

function go(run: Run, phase: Phase) {
  run.phase = phase;
  run.phaseAt = Date.now();
  write(run);
}

async function loop(run: Run) {
  const cap = Date.now() + 14 * 60 * 1000;
  const phase = () => run.phase;
  while (phase() !== 'done' && Date.now() < cap) {
    if (!document.getElementById('loading') && stuck(run)) {
      note(run, `stopped: still in ${phase()}`);
      write(run);
      return;
    }
    try { await step(run); }
    catch {
      if (!run.fault) { run.fault = true; note(run, 'input step failed'); }
    }
    write(run);
    if (phase() === 'done') break;
    await wait(200);
  }
  if (phase() !== 'done' && !run.fault) note(run, 'stopped: the visit did not finish');
  window.clearInterval(holdTimer);
  for (const k of [...held]) release(k);
}

function stuck(run: Run): boolean {
  const age = Date.now() - run.phaseAt;
  if (run.phase === 'film') return age > 420_000;
  if (run.phase === 'fall') return age > 300_000;
  if (run.phase === 'play') return age > 45_000;
  if (run.phase === 'orbit') return age > 40_000;
  return age > 180_000;
}

async function step(run: Run) {
  if (document.getElementById('loading')) {
    if (!run.inLoad) { run.inLoad = true; note(run, 'waiting through loading'); }
    return;
  }
  run.inLoad = false;
  if (run.phase === 'boot') return boot(run);
  if (run.phase === 'options') return openOptions(run);
  if (run.phase === 'seed') return sendSeed(run);
  if (run.phase === 'film') return film(run);
  if (run.phase === 'orbit') return orbit(run);
  if (run.phase === 'fall') return fall(run);
  if (run.phase === 'play') return play(run);
}

function boot(run: Run) {
  if (document.getElementById('cine')) { go(run, 'film'); return; }
  if (document.body.classList.contains('on-globe') || prompt().includes('Double-click')) {
    note(run, 'globe is up');
    go(run, 'orbit');
    return;
  }
  if (menuButton(/^Universe options/)) {
    note(run, 'title menu is up');
    go(run, 'options');
  }
}

function openOptions(run: Run) {
  const b = menuButton(/^Universe options/);
  if (!b) return;
  b.click();
  go(run, 'seed');
}

function sendSeed(run: Run) {
  const input = document.querySelector('#start-menu input[aria-label="Universe seed"]');
  if (!(input instanceof HTMLInputElement)) return;
  fill(input, SEED);
  const gen = menuButton(/^Generate$/);
  if (!gen) return;
  note(run, `set universe seed ${SEED} and clicked Generate`);
  go(run, 'film');
  gen.click();
}

function film(run: Run) {
  const cine = document.getElementById('cine');
  if (cine) {
    const gate = cine.querySelector('.prompt');
    if (gate instanceof HTMLElement && !gate.hidden && !run.startedFilm) {
      run.startedFilm = true;
      tap('Enter');
      note(run, 'pressed a key to start the title film');
    }
    if (!run.notedFilm) { run.notedFilm = true; note(run, 'waiting through the title film'); }
    return;
  }
  if (prompt().includes('Double-click')) go(run, 'orbit');
}

async function orbit(run: Run) {
  if (!prompt().includes('Double-click')) return;
  const c = canvas();
  if (!c) return;
  note(run, 'rotating the globe');
  await drag(c, 6, 16);
  note(run, 'clicked a land spot');
  await landClick(c);
  clickExplore(run);
  go(run, 'fall');
  run.landAt = Date.now();
}

async function fall(run: Run) {
  clickExplore(run);
  watchLabel(run);
  const p = prompt();
  if (p.includes('Double-click') && run.landAt && Date.now() - run.landAt > 2500 && !run.usedCentre) {
    run.usedCentre = true;
    note(run, 'land click stayed on the globe, pressed G to drop on the centre');
    tap('g');
  }
  if ((p.includes('Easing down') || p.includes('Gliding')) && !run.notedFall) {
    run.notedFall = true;
    note(run, 'waiting through the drop and landing');
  }
  if (p.includes('Gliding')) {
    if (!run.glideAt) run.glideAt = Date.now();
    if (!run.embodied && Date.now() - (run.glideAt ?? 0) > 2000) {
      run.embodied = true;
      tap('g');
      note(run, 'pressed G to become the wolf');
    }
  }
  if (onGround()) {
    note(run, 'on the ground with the embodied animal');
    go(run, 'play');
    run.playAt = Date.now();
  }
}

function watchLabel(run: Run) {
  if (run.explored || run.notedLabel) return;
  const text = (document.getElementById('target')?.textContent ?? '').trim();
  if (!text || /explore/i.test(text)) return;
  run.notedLabel = true;
  note(run, `label reads ${text}`);
}

async function play(run: Run) {
  clickExplore(run);
  watchLabel(run);
  const act = document.getElementById('act');
  if (!run.approached && act instanceof HTMLButtonElement && !act.disabled && /approach/i.test(act.textContent ?? '')) {
    act.click();
    run.approached = true;
    note(run, 'clicked Approach as individual');
  }
  const elapsed = (Date.now() - (run.playAt ?? Date.now())) / 1000;
  if (elapsed < WALK_S) {
    if (!run.walked) { run.walked = true; note(run, 'walked with the movement key'); }
    hold('w');
    return;
  }
  release('w');
  if (!run.orbited) {
    run.orbited = true;
    const c = canvas();
    if (c) {
      note(run, 'orbited the camera');
      await drag(c, 28, 40);
    }
    return;
  }
  if (elapsed < PLAY_S) return;
  if (!run.explored) note(run, 'Explore label was not on screen');
  if (!run.approached) note(run, 'Approach as individual stayed disabled');
  release('w');
  note(run, 'finished the forest follow');
  go(run, 'done');
  (window as Window & { __autoplayDone?: boolean }).__autoplayDone = true;
}

function onGround(): boolean {
  if (document.getElementById('cine')) return false;
  if (document.getElementById('loading')) return false;
  if (document.body.classList.contains('on-globe')) return false;
  if (prompt()) return false;
  const menu = document.getElementById('start-menu');
  if (menu && !menu.hidden) return false;
  return !!document.getElementById('target');
}

function clickExplore(run: Run) {
  if (run.explored) return;
  const target = document.getElementById('target');
  if (!target || !/explore/i.test(target.textContent ?? '')) return;
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  run.explored = true;
  note(run, 'clicked Explore');
}

function prompt(): string {
  return document.getElementById('flight-prompt')?.textContent ?? '';
}

function canvas(): HTMLCanvasElement | null {
  const c = document.getElementById('world');
  return c instanceof HTMLCanvasElement ? c : null;
}

function menuButton(re: RegExp): HTMLButtonElement | null {
  const root = document.getElementById('start-menu');
  if (!root || root.hidden) return null;
  for (const b of Array.from(root.querySelectorAll('button'))) {
    if (b.disabled) continue;
    if (re.test((b.textContent ?? '').trim())) return b;
  }
  return null;
}

function fill(input: HTMLInputElement, seed: string) {
  input.focus();
  input.value = '';
  for (const ch of seed) {
    input.value += ch;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: 'insertText' }));
  }
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function drag(c: HTMLCanvasElement, steps: number, px: number) {
  const r = c.getBoundingClientRect();
  const y = r.top + r.height * 0.5;
  let x = r.left + r.width * 0.72;
  pointer(c, 'pointerdown', x, y, 1);
  for (let i = 0; i < steps; i++) {
    x -= px;
    pointer(c, 'pointermove', x, y, 1);
    await frame();
  }
  pointer(c, 'pointerup', x, y, 0);
  await frame();
}

async function landClick(c: HTMLCanvasElement) {
  const r = c.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const click = () => {
    pointer(c, 'pointerdown', x, y, 1);
    pointer(c, 'pointerup', x, y, 0);
  };
  click();
  await frame();
  pointer(c, 'pointerdown', x, y, 1);
  c.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  pointer(c, 'pointerup', x, y, 0);
  await frame();
}

function pointer(target: EventTarget, type: string, x: number, y: number, buttons: number) {
  target.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, clientX: x, clientY: y,
    button: 0, buttons, pointerId: 1, pointerType: 'mouse', isPrimary: true,
  }));
}

function keydown(key: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, code: codeOf(key), bubbles: true, cancelable: true }));
}

function keyup(key: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, code: codeOf(key), bubbles: true, cancelable: true }));
}

function codeOf(key: string): string {
  if (key === 'ArrowRight' || key === 'ArrowLeft' || key === 'ArrowUp' || key === 'ArrowDown') return key;
  if (key.length === 1) return 'Key' + key.toUpperCase();
  return key;
}

function tap(key: string) { keydown(key); keyup(key); }

function hold(key: string) {
  if (held.has(key)) return;
  held.add(key);
  keydown(key);
}

function release(key: string) {
  if (!held.delete(key)) return;
  keyup(key);
}

/** The page's own pointer handlers call setPointerCapture. A pointer the page created has no browser id, and that call throws before the handler can orbit. Real mice still capture. */
function allowPageMadePointers() {
  const proto = Element.prototype;
  const set = proto.setPointerCapture;
  const release = proto.releasePointerCapture;
  proto.setPointerCapture = function (this: Element, id: number) {
    try { set.call(this, id); } catch { /* page-made pointer */ }
  };
  proto.releasePointerCapture = function (this: Element, id: number) {
    try { release.call(this, id); } catch { /* page-made pointer */ }
  };
}

function wait(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function frame() { return new Promise(r => requestAnimationFrame(() => r(undefined))); }
