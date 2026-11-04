/** Data panel. Rust is the source of the numbers, the equations, and the spawn log.
 *  The nodes are created once and updated in place, so a time field the user is
 *  typing in is never detached. */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { latestPlanetSim, type PlanetSim } from '../core/planetBudget';
import { sharedPlanetSim } from '../core/planetWeather';
import { decodeEngineReport, healthColor, healthWord, parseCycle, type EngineInst, type EngineReport } from '../core/engineReport';
import { NOT_IN_RUST } from '../data/notInRust';
import { TIERS } from '../world/cosmos/lod';
import { CosmosSphere } from '../world/cosmos/sphere';
import { sphereLook } from '../world/cosmos/look';
import { worldSec } from '../core/worldClock';

const EARTH_S = 9.2e9 * 365.25 * 86400;
const YEAR_S = 365.25 * 86400;
const PLANCK_S = 5.39e-44;
const TODAY_S = 13.8e9 * YEAR_S;

let root: HTMLElement | null = null;
let open = false;
let sphere: CosmosSphere | null = null;
let timer = 0;
let manual = false;
let menuConcealed = false;
let generation = 0;
let synced = NaN;
let simRef: PlanetSim | null = null;

const nodes = {
  readout: null as HTMLElement | null,
  mode: null as HTMLElement | null,
  input: null as HTMLInputElement | null,
  log: null as HTMLElement | null,
  tree: null as HTMLElement | null,
  cards: null as HTMLElement | null,
  plotA: null as HTMLCanvasElement | null,
  plotB: null as HTMLCanvasElement | null,
  look: null as HTMLElement | null,
  tier: null as HTMLElement | null,
  fps: null as HTMLElement | null,
  bench: null as HTMLElement | null,
  gpu: null as HTMLElement | null,
  lock: null as HTMLSelectElement | null,
};

const cards = new Map<string, HTMLElement>();

function el(tag: string, text?: string, css?: string) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (css) n.style.cssText = css;
  return n;
}

export function dataPanelOpen() { return open; }

export function toggleDataPanel(force?: boolean) {
  ensure();
  open = force ?? !open;
  if (root) root.hidden = !open;
  if (open) { void refresh(); if (!timer) timer = window.setInterval(() => void refresh(), 500); }
  else if (timer) { clearInterval(timer); timer = 0; hideSphere(); }
}

function followCycle() {
  const seconds = TODAY_S + Math.max(0, worldSec());
  if (!(seconds > 0)) return 0;
  return Math.log10(seconds / PLANCK_S) + 1;
}

function ensure() {
  if (root) return;
  root = el('aside');
  root.id = 'data-panel';
  root.hidden = true;
  root.style.cssText = 'position:fixed;top:8px;right:8px;z-index:70;width:min(640px,94vw);max-height:92vh;overflow:auto;background:#0d1712f2;color:#f4efe2;font:18px/1.45 system-ui,sans-serif;padding:14px 16px 20px;border-radius:12px;box-shadow:0 8px 40px #000a';
  document.body.appendChild(root);
  const btn = el('button', 'Data (U)');
  btn.id = 'data-panel-btn';
  btn.style.cssText = 'position:fixed;top:8px;left:8px;z-index:70;font:16px system-ui;padding:6px 10px;border-radius:8px;background:#1c2c24;color:#f4efe2;border:1px solid #3d5a4c';
  btn.onclick = () => toggleDataPanel();
  document.body.appendChild(btn);
  // Capture phase, and stop the key, so the game binding cannot toggle the
  // panel a second time or open the menu on the same press.
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input,textarea,select'))) return;
    if (e.key === 'u' || e.key === 'U' || e.key === 'F2') {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleDataPanel();
    }
  }, true);

  root.append(el('h2', 'What is running', 'margin:0 0 8px;font:600 26px system-ui'));
  root.append(el('p', 'Green is healthy. Yellow needs a look. Red is an error or outside the model. Grey has not been called, or is not active at this time.', 'margin:0 0 10px;font-size:16px;color:#d9d0c0'));

  const time = el('label', '', 'display:block;margin:8px 0');
  time.append(el('div', 'Time (cycles)', 'font-weight:600'));
  const input = document.createElement('input');
  input.id = 'cycle-input';
  input.style.cssText = 'width:100%;font:20px ui-monospace,monospace;padding:6px 8px;border-radius:8px;border:1px solid #3d5a4c;background:#08110d;color:#fff';
  input.oninput = () => {
    manual = true;
    const n = parseCycle(input.value);
    if (nodes.mode) nodes.mode.textContent = n == null
      ? 'That is not a finished number yet. Nothing was changed.'
      : 'Manual time. The engines stay here until you follow the game clock.';
    if (n != null && simRef) { simRef.setEngineCycle(n); void refresh(); }
  };
  time.append(input);
  nodes.input = input;
  nodes.readout = el('div', '', 'margin-top:6px');
  nodes.mode = el('div', 'Following the game clock.', 'font-size:15px;color:#d9d0c0');
  time.append(nodes.readout, nodes.mode);
  const follow = el('button', 'Follow game clock') as HTMLButtonElement;
  follow.id = 'follow-clock';
  follow.style.cssText = 'margin-top:6px;font:16px system-ui;padding:4px 8px';
  follow.onclick = () => {
    manual = false;
    const n = followCycle();
    if (nodes.input && document.activeElement !== nodes.input) nodes.input.value = String(n);
    if (nodes.mode) nodes.mode.textContent = 'Following the game clock.';
    simRef?.setEngineCycle(n);
    hideSphere();
    void refresh();
  };
  time.append(follow);
  root.append(time);

  root.append(section('Spawn log'));
  nodes.log = el('div', '', 'font-size:16px');
  root.append(nodes.log);
  root.append(section('Dependency tree'));
  nodes.tree = el('div', '', 'font-size:16px');
  root.append(nodes.tree);

  const spawnRow = el('div', '', 'display:flex;gap:8px;margin:10px 0;flex-wrap:wrap');
  const pick = document.createElement('select');
  pick.style.cssText = 'font:16px system-ui;padding:4px';
  for (const id of ['spacetime', 'reheating', 'nucleosynthesis', 'planet', 'climate', 'solar', 'energy', 'wind', 'hydro', 'clouds']) pick.add(new Option(id, id));
  const spawn = el('button', 'Spawn engine') as HTMLButtonElement;
  spawn.onclick = () => { simRef?.spawnEngine(pick.value); void refresh(); };
  const reset = el('button', 'Reset all inputs') as HTMLButtonElement;
  reset.onclick = () => { simRef?.resetEngines(); void refresh(); };
  spawnRow.append(pick, spawn, reset);
  root.append(spawnRow);

  nodes.cards = el('div');
  root.append(nodes.cards);

  root.append(section('Not in Rust'));
  for (const gap of NOT_IN_RUST) {
    const line = el('div', '', 'margin:6px 0;padding-left:18px');
    line.append(el('span', '● ', 'color:#e15b64'), el('b', gap.kind === 'not-built' ? 'NOT BUILT' : 'NOT IN RUST'), el('span', gap.file ? ` ${gap.file}` : ''));
    line.append(el('div', gap.what, 'font-size:16px;color:#d9d0c0'));
    root.append(line);
  }

  root.append(section('Expansion'));
  nodes.plotA = document.createElement('canvas');
  nodes.plotA.width = 520; nodes.plotA.height = 180;
  nodes.plotA.style.cssText = 'width:100%;background:#08110d;border-radius:8px';
  root.append(nodes.plotA);
  root.append(section('Reheating'));
  nodes.plotB = document.createElement('canvas');
  nodes.plotB.width = 520; nodes.plotB.height = 180;
  nodes.plotB.style.cssText = 'width:100%;background:#08110d;border-radius:8px';
  root.append(nodes.plotB);

  root.append(section('Early-universe picture'));
  nodes.look = el('div', '', 'font-size:16px');
  root.append(nodes.look);
  const view = el('button', 'View early universe') as HTMLButtonElement;
  view.id = 'view-early';
  view.style.cssText = 'margin:6px 8px 6px 0;font:16px system-ui;padding:4px 8px';
  view.onclick = () => {
    manual = true;
    if (nodes.input) nodes.input.value = '1';
    if (nodes.mode) nodes.mode.textContent = 'Manual time. The engines stay here until you follow the game clock.';
    simRef?.setEngineCycle(1);
    void refresh();
  };
  const test = el('button', 'Test this computer') as HTMLButtonElement;
  test.id = 'bench-tier';
  test.onclick = () => { void ensureSphere().then(() => sphere?.benchmark().then(() => refresh())); };
  const cap = el('button', 'Capture 4K') as HTMLButtonElement;
  cap.id = 'capture-4k';
  cap.onclick = () => {
    void ensureSphere().then(() => {
      const url = sphere?.capture4k();
      if (!url) return;
      const aLink = document.createElement('a');
      aLink.href = url; aLink.download = 'boreal-cosmos-4k.png'; aLink.click();
    });
  };
  const row = el('div', '', 'display:flex;gap:8px;flex-wrap:wrap;margin:8px 0');
  row.append(view, test, cap);
  root.append(row);
  nodes.tier = el('div', 'Tier: not tested yet.', 'font-size:16px');
  nodes.tier.id = 'cosmos-tier';
  nodes.fps = el('div', '', 'font-size:16px');
  nodes.fps.id = 'cosmos-fps';
  nodes.bench = el('div', '', 'font-size:14px');
  nodes.gpu = el('div', '', 'font-size:14px;margin-top:6px');
  root.append(nodes.tier, nodes.fps, nodes.bench, nodes.gpu);
  const lock = document.createElement('select');
  lock.id = 'tier-lock';
  lock.add(new Option('automatic tier', ''));
  for (const tier of TIERS) lock.add(new Option(`${tier.label} ${tier.width}×${tier.height}`, tier.id));
  lock.onchange = () => sphere?.lockTier((lock.value || null) as 'ultra' | 'high' | 'medium' | 'low' | null);
  nodes.lock = lock;
  const lab = el('label', 'Level of detail ');
  lab.append(lock);
  root.append(lab);
  const target = document.createElement('input');
  target.id = 'tier-target';
  target.value = '16.7';
  target.style.cssText = 'width:80px;font:15px monospace';
  target.onchange = () => sphere?.setTargetMs(Number(target.value));
  const tlab = el('label', 'Target frame time (ms) ');
  tlab.append(target);
  root.append(tlab);

  let padWas = false;
  const pad = () => {
    const pads = navigator.getGamepads?.() ?? [];
    let down = false;
    for (const p of pads) if (p && p.buttons[16]?.pressed) down = true;
    if (down && !padWas) toggleDataPanel();
    padWas = down;
    requestAnimationFrame(pad);
  };
  requestAnimationFrame(pad);

  const api = {
    open: () => toggleDataPanel(true),
    async setCycle(text: string) {
      toggleDataPanel(true);
      manual = true;
      const s = await sim();
      const n = parseCycle(text);
      if (s && n != null) s.setEngineCycle(n);
      if (nodes.input) nodes.input.value = text;
      if (nodes.mode) nodes.mode.textContent = 'Manual time. The engines stay here until you follow the game clock.';
      await refresh();
    },
    expand(_id: string) { /* cards stay open */ },
    refresh: () => refresh(),
    capture: () => sphere?.capture4k() ?? '',
    bench: () => sphere?.benchmark() ?? Promise.resolve([]),
    text: () => root?.innerText ?? '',
    follow() {
      (document.getElementById('follow-clock') as HTMLButtonElement | null)?.click();
    },
  };
  (window as unknown as { borealData?: typeof api }).borealData = api;
  if (new URLSearchParams(location.search).has('data')) toggleDataPanel(true);
}

async function sim(): Promise<PlanetSim | null> {
  return latestPlanetSim() ?? await sharedPlanetSim();
}

async function ensureSphere() {
  if (!sphere) sphere = new CosmosSphere(document.body);
  if (sphere) {
    sphere.onChange((text, fps, ms) => {
      if (nodes.tier) nodes.tier.textContent = `Tier: ${text}`;
      if (nodes.fps) nodes.fps.textContent = `${fps.toFixed(0)} fps, this frame ${ms.toFixed(1)} ms`;
    });
    if (nodes.gpu) nodes.gpu.textContent = `GPU ${sphere.gpu.renderer}. Max texture ${sphere.gpu.maxTexture}. Float targets ${sphere.gpu.floatTarget ? 'yes' : 'no'}. MSAA samples ${sphere.gpu.samples}.`;
  }
}

async function refresh() {
  if (!root || !open) return;
  const gen = ++generation;
  const s = await sim();
  if (gen !== generation || !s || !root) return;
  simRef = s;
  if (!s.engineReport()) {
    if (nodes.readout) nodes.readout.textContent = 'The Rust simulation is not loaded, so there is nothing to report yet.';
    return;
  }
  if (!manual) {
    const n = followCycle();
    if (nodes.input && document.activeElement !== nodes.input) nodes.input.value = String(n);
    if (!(Math.abs(n - synced) < 1e-4)) { s.setEngineCycle(n); synced = n; }
  }
  const report = decodeEngineReport(s.engineReport());
  if (gen !== generation) return;
  if (nodes.readout) {
    const years = Number.isFinite(report.years) ? report.years.toExponential(3) : '—';
    const seconds = Number.isFinite(report.seconds) ? report.seconds.toExponential(3) : '—';
    nodes.readout.textContent = `${report.cycle} cycles = ${seconds} seconds = ${years} years. ${report.era}`;
  }
  paintLog(report);
  paintTree(report);
  paintCards(report, s);
  if (nodes.plotA) drawPlot(nodes.plotA, s.cosmosTable());
  if (nodes.plotB) drawReheat(nodes.plotB, s.reheatTable());
  const early = report.seconds > 0 && report.seconds < EARTH_S;
  if (early) { await ensureSphere(); showSphere(report); }
  else hideSphere();
  paintLook(report);
}

function section(title: string) {
  return el('h3', title, 'margin:14px 0 6px;font:600 20px system-ui');
}

function paintLog(report: EngineReport) {
  const log = nodes.log; if (!log) return;
  log.replaceChildren();
  if (!report.log.length) log.append(el('div', 'No spawns yet.'));
  for (const row of report.log) {
    const who = row.parent ? `${row.parent} → ${row.child}` : row.child;
    log.append(el('div', `${row.kind} ${who} at t=${row.t.toExponential(3)} s — ${row.cause}`));
  }
}

function paintTree(report: EngineReport) {
  const tree = nodes.tree; if (!tree) return;
  tree.replaceChildren();
  const kids = new Map<string, string[]>();
  for (const rule of report.rules) {
    const list = kids.get(rule.parent) ?? [];
    list.push(`${rule.child} when ${rule.output} (${rule.cause})`);
    kids.set(rule.parent, list);
  }
  const draw = (id: string, depth: number) => {
    tree.append(el('div', `${'· '.repeat(depth)}${id}`, 'font-weight:600'));
    for (const child of kids.get(id) ?? []) tree.append(el('div', `${'· '.repeat(depth + 1)}${child}`));
  };
  draw('spacetime', 0);
  for (const id of kids.keys()) if (id !== 'spacetime') draw(id, 1);
}

function callsFor(type: string, report: EngineReport) {
  const names = type === 'planet' ? ['planet', 'grid step'] : [type];
  return report.sessions.filter(s => names.includes(s.type)).reduce((sum, s) => sum + (Number.isFinite(s.calls) ? s.calls : 0), 0);
}

function paintCards(report: EngineReport, s: PlanetSim) {
  const host = nodes.cards; if (!host) return;
  const seen = new Set<string>();
  for (const inst of report.instances) {
    seen.add(inst.type);
    let card = cards.get(inst.type);
    if (!card) { card = buildCard(inst.type); cards.set(inst.type, card); host.append(card); }
    fillCard(card, inst, report, s);
  }
  for (const [type, card] of cards) if (!seen.has(type)) { card.remove(); cards.delete(type); }
}

function buildCard(type: string) {
  const box = el('section', '', 'margin:10px 0;padding:8px;border:1px solid #2a4036;border-radius:10px');
  box.dataset.engine = type;
  const head = el('div', '', 'display:flex;gap:8px;align-items:flex-start');
  const dot = el('span', '●', 'font-size:22px'); dot.dataset.role = 'dot';
  const title = el('div');
  title.append(el('div', type, 'font:600 20px system-ui'));
  const generates = el('div', '', 'font-size:16px'); generates.dataset.role = 'generates';
  const status = el('div', '', 'font-size:16px'); status.dataset.role = 'status';
  const meta = el('div', '', 'font-size:15px;color:#c9bfae'); meta.dataset.role = 'meta';
  title.append(generates, status, meta);
  head.append(dot, title);
  const calls = el('div', '', 'font-size:15px;margin-top:4px'); calls.dataset.role = 'calls';
  const vars = el('div', '', 'margin-top:8px'); vars.dataset.role = 'vars';
  const eqs = el('div'); eqs.dataset.role = 'eqs';
  const inputs = el('div'); inputs.dataset.role = 'inputs';
  box.append(head, calls, vars, eqs, inputs);
  return box;
}

function fillCard(card: HTMLElement, inst: EngineInst, report: EngineReport, s: PlanetSim) {
  const dot = card.querySelector<HTMLElement>('[data-role="dot"]');
  if (dot) dot.style.color = healthColor(inst.health);
  const generates = card.querySelector<HTMLElement>('[data-role="generates"]');
  if (generates) generates.textContent = `Generates: ${inst.generates}`;
  const status = card.querySelector<HTMLElement>('[data-role="status"]');
  if (status) {
    const word = healthWord(inst.health);
    status.textContent = inst.health === 1 ? word : `${word}. ${inst.reason}`;
    status.style.color = inst.health === 1 ? '#b7c4bb' : '';
  }
  const meta = card.querySelector<HTMLElement>('[data-role="meta"]');
  if (meta) meta.textContent = `Online ${inst.online}. Spawned because ${inst.cause}. Added ${inst.born}.`;
  const calls = card.querySelector<HTMLElement>('[data-role="calls"]');
  const n = callsFor(inst.type, report);
  const session = report.sessions.find(x => x.type === inst.type || (inst.type === 'planet' && x.type === 'grid step'));
  if (calls) calls.textContent = `This game session has called it ${n} times.${session ? ` Last call ${session.lastMs.toFixed(1)} ms.` : ''}`;

  const vars = card.querySelector<HTMLElement>('[data-role="vars"]');
  if (vars) {
    const lines = Array.from(vars.querySelectorAll<HTMLElement>('[data-role="var"]'));
    if (lines.length !== inst.vars.length) {
      vars.replaceChildren();
      for (const variable of inst.vars) vars.append(el('div', '', 'font-size:16px'));
      for (const node of Array.from(vars.querySelectorAll<HTMLElement>('div'))) node.dataset.role = 'var';
    }
    const rows = Array.from(vars.querySelectorAll<HTMLElement>('[data-role="var"]'));
    inst.vars.forEach((variable, i) => {
      const range = variable.n > 1 ? ` (min ${fmt(variable.min)}, mean ${fmt(variable.value)}, max ${fmt(variable.max)}, ${variable.n} cells)` : '';
      if (rows[i]) rows[i].textContent = `${variable.label}: ${fmt(variable.value)} ${variable.unit}${range}`;
    });
  }

  const eqs = card.querySelector<HTMLElement>('[data-role="eqs"]');
  const mineEq = report.equations.filter(e => e.type === inst.type);
  if (eqs && eqs.childElementCount !== mineEq.length) {
    eqs.replaceChildren();
    for (const eq of mineEq) {
      const block = el('div');
      block.dataset.eq = eq.id;
      block.append(el('div', eq.title, 'font-weight:600;margin-top:8px'));
      const math = el('div', '', 'margin:8px 0;overflow:auto');
      try { katex.render(eq.latex, math, { throwOnError: false, displayMode: true }); }
      catch { math.textContent = eq.latex; }
      const symbols = el('div'); symbols.dataset.role = 'symbols';
      block.append(math, symbols);
      eqs.append(block);
    }
  }
  if (eqs) {
    for (const eq of mineEq) {
      const symbols = eqs.querySelector<HTMLElement>(`[data-eq="${eq.id}"] [data-role="symbols"]`);
      if (!symbols) continue;
      const mine = inst.symbols.filter(sy => sy.equation === eq.id);
      if (symbols.childElementCount !== mine.length) {
        symbols.replaceChildren();
        for (const sym of mine) {
          const row = el('div', '', 'font-size:16px');
          row.dataset.sym = sym.name;
          const bit = el('span');
          try { katex.render(sym.latex, bit, { throwOnError: false }); } catch { bit.textContent = sym.name; }
          const value = el('span'); value.dataset.role = 'symval';
          row.append(bit, value);
          symbols.append(row);
        }
      }
      for (const sym of mine) {
        const value = symbols.querySelector<HTMLElement>(`[data-sym="${sym.name}"] [data-role="symval"]`);
        if (value) value.textContent = ` = ${fmt(sym.value)} ${sym.unit}`;
      }
    }
  }

  const inputs = card.querySelector<HTMLElement>('[data-role="inputs"]');
  const mine = report.params.filter(p => p.type === inst.type || (inst.type !== 'planet' && inst.type !== 'spacetime' && inst.type !== 'reheating' && p.type === 'planet'));
  if (!inputs) return;
  if (!mine.length) { inputs.replaceChildren(); return; }
  if (!inputs.querySelector('[data-role="input-title"]')) {
    inputs.replaceChildren(el('div', 'Inputs', 'font-weight:600;margin-top:8px'));
    inputs.firstElementChild?.setAttribute('data-role', 'input-title');
  }
  for (const p of mine) {
    let row = inputs.querySelector<HTMLLabelElement>(`[data-key="${p.key}"]`);
    if (!row) {
      row = el('label', '', 'display:flex;justify-content:space-between;gap:8px;font-size:16px;margin:4px 0') as HTMLLabelElement;
      row.dataset.key = p.key;
      row.append(el('span', `${p.label} (${p.unit})`));
      const field = document.createElement('input');
      field.dataset.role = 'field';
      field.value = String(p.value);
      field.style.cssText = 'width:180px;font:15px ui-monospace,monospace;background:#08110d;color:#fff;border:1px solid #3d5a4c;border-radius:6px;padding:2px 6px';
      field.onchange = () => {
        const n = Number(field.value);
        if (!Number.isFinite(n)) return;
        s.setEngineParam(p.key, n);
        void refresh();
      };
      row.append(field);
      inputs.append(row);
    }
    const field = row.querySelector<HTMLInputElement>('[data-role="field"]');
    if (field && document.activeElement !== field) field.value = String(p.value);
  }
  if (!inputs.querySelector('[data-role="reset"]')) {
    const reset = el('button', 'Reset this engine') as HTMLButtonElement;
    reset.dataset.role = 'reset';
    reset.onclick = () => { s.resetEngine(inst.type); void refresh(); };
    inputs.append(reset);
  }
}

function fmt(n: number) {
  if (!Number.isFinite(n)) return String(n);
  const a = Math.abs(n);
  if (a !== 0 && (a < 1e-3 || a >= 1e5)) return n.toExponential(3);
  return String(Math.round(n * 1000) / 1000);
}

function drawPlot(canvas: HTMLCanvasElement, table: Float64Array) {
  const g = canvas.getContext('2d'); if (!g || table.length < 10) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  const n = table.length / 5;
  const xs: number[] = [], ys: number[] = [], ts: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = table[i * 5], a = table[i * 5 + 1], temp = table[i * 5 + 3];
    if (t > 0 && a > 0) { xs.push(Math.log10(t)); ys.push(Math.log10(a)); ts.push(Math.log10(Math.max(temp, 1e-6))); }
  }
  stroke(g, xs, ys, '#7d5cff', canvas);
  stroke(g, xs, ts, '#e6c04a', canvas);
  g.fillStyle = '#f4efe2'; g.font = '14px system-ui';
  g.fillText('violet log a(t)    gold log T(t)', 8, 18);
}

function drawReheat(canvas: HTMLCanvasElement, table: Float64Array) {
  const g = canvas.getContext('2d'); if (!g || table.length < 8) return;
  g.clearRect(0, 0, canvas.width, canvas.height);
  const n = table.length / 4;
  const xs: number[] = [], t: number[] = [], phi: number[] = [], rad: number[] = [];
  for (let i = 0; i < n; i++) {
    const time = table[i * 4];
    if (!(time > 0)) continue;
    xs.push(Math.log10(time));
    t.push(Math.log10(Math.max(table[i * 4 + 1], 1e-6)));
    phi.push(Math.log10(Math.max(table[i * 4 + 2], 1)));
    rad.push(Math.log10(Math.max(table[i * 4 + 3], 1)));
  }
  stroke(g, xs, t, '#e6c04a', canvas);
  stroke(g, xs, phi, '#e15b64', canvas);
  stroke(g, xs, rad, '#3dd68c', canvas);
  g.fillStyle = '#f4efe2'; g.font = '14px system-ui';
  g.fillText('gold log T    red log ρφ    green log ρr', 8, 18);
}

function stroke(g: CanvasRenderingContext2D, xs: number[], ys: number[], color: string, canvas: HTMLCanvasElement) {
  if (xs.length < 2) return;
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  g.strokeStyle = color; g.lineWidth = 2; g.beginPath();
  xs.forEach((x, i) => {
    const px = 8 + (x - minX) / (maxX - minX || 1) * (canvas.width - 16);
    const py = canvas.height - 8 - (ys[i] - minY) / (maxY - minY || 1) * (canvas.height - 28);
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  });
  g.stroke();
}

function paintLook(report: EngineReport) {
  const space = report.instances.find(i => i.type === 'spacetime');
  const heat = report.instances.find(i => i.type === 'reheating');
  const a = space?.vars.find(v => v.label.startsWith('scale'))?.value ?? 0;
  const h = space?.vars.find(v => v.label.startsWith('Hubble'))?.value ?? 0;
  const temp = heat?.vars.find(v => v.label === 'temperature')?.value ?? space?.vars.find(v => v.label === 'temperature')?.value ?? 0;
  const rho = heat?.vars.find(v => v.label === 'radiation density')?.value ?? space?.vars.find(v => v.label === 'total density')?.value ?? 0;
  const look = sphereLook(a, h, temp, rho);
  if (nodes.look) nodes.look.textContent = `${look.radiusRule} Right now the sphere radius is ${look.radius.toFixed(2)} and the brightness is ${look.brightness.toFixed(2)}.`;
  if (sphere && nodes.bench) {
    nodes.bench.replaceChildren();
    const chosen = sphere.bench.length ? sphere.why : 'Benchmark has not been run.';
    nodes.bench.append(el('div', chosen));
    for (const b of sphere.bench) nodes.bench.append(el('div', `${b.id}: median ${b.p50.toFixed(1)} ms, 95th ${b.p95.toFixed(1)} ms`));
  }
}

function concealStartMenu() {
  const menu = document.getElementById('start-menu');
  if (!menu || menu.hidden || menu.classList.contains('fade')) return;
  menuConcealed = true;
  menu.style.visibility = 'hidden';
}

function revealStartMenu() {
  const menu = document.getElementById('start-menu');
  if (!menu || !menuConcealed) return;
  menuConcealed = false;
  menu.style.visibility = '';
}

function showSphere(report: EngineReport) {
  if (!sphere) return;
  concealStartMenu();
  const space = report.instances.find(i => i.type === 'spacetime');
  const heat = report.instances.find(i => i.type === 'reheating');
  sphere.setInputs({
    a: space?.vars.find(v => v.label.startsWith('scale'))?.value ?? 1e-40,
    h: space?.vars.find(v => v.label.startsWith('Hubble'))?.value ?? 1,
    temperature: heat?.vars.find(v => v.label === 'temperature')?.value ?? space?.vars.find(v => v.label === 'temperature')?.value ?? 1,
    rho: (heat?.vars.find(v => v.label === 'radiation density')?.value || space?.vars.find(v => v.label === 'total density')?.value) ?? 1,
  });
}

function hideSphere() {
  sphere?.dispose();
  sphere = null;
  revealStartMenu();
}

ensure();
