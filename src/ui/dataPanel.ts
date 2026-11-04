/** Data panel. Rust is the source of the numbers, the equations, and the spawn log. */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { latestPlanetSim, type PlanetSim } from '../core/planetBudget';
import { sharedPlanetSim } from '../core/planetWeather';
import { decodeEngineReport, healthColor, healthWord, parseCycle, type EngineInst, type EngineReport } from '../core/engineReport';
import { NOT_IN_RUST } from '../data/notInRust';
import { TIERS, tierById } from '../world/cosmos/lod';
import { CosmosSphere } from '../world/cosmos/sphere';
import { sphereLook } from '../world/cosmos/look';

const EARTH_S = 9.2e9 * 365.25 * 86400;
let root: HTMLElement | null = null;
let open = false;
let sphere: CosmosSphere | null = null;
let timer = 0;
let lastToggle = 0;
const expanded = new Set<string>();

function el(tag: string, text?: string, css?: string) {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (css) n.style.cssText = css;
  return n;
}

export function dataPanelOpen() { return open; }

export function toggleDataPanel(force?: boolean) {
  if (force == null && lastToggle) return;
  lastToggle = 1;
  queueMicrotask(() => { lastToggle = 0; });
  ensure();
  open = force ?? !open;
  if (root) root.hidden = !open;
  if (open) { void refresh(); if (!timer) timer = window.setInterval(() => void refresh(), 500); }
  else if (timer) { clearInterval(timer); timer = 0; hideSphere(); }
}

function ensure() {
  if (root) return;
  root = el('aside');
  root.id = 'data-panel';
  root.hidden = true;
  root.style.cssText = 'position:fixed;top:8px;right:8px;z-index:70;width:min(560px,94vw);max-height:92vh;overflow:auto;background:#0d1712f2;color:#f4efe2;font:18px/1.45 system-ui,sans-serif;padding:14px 16px 20px;border-radius:12px;box-shadow:0 8px 40px #000a';
  document.body.appendChild(root);
  const btn = el('button', 'Data (U)');
  btn.id = 'data-panel-btn';
  btn.style.cssText = 'position:fixed;top:8px;left:8px;z-index:70;font:16px system-ui;padding:6px 10px;border-radius:8px;background:#1c2c24;color:#f4efe2;border:1px solid #3d5a4c';
  btn.onclick = () => toggleDataPanel();
  document.body.appendChild(btn);
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input,textarea,select'))) return;
    if (e.key === 'u' || e.key === 'U' || e.key === 'F2') toggleDataPanel();
  });
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
      const s = await sim();
      const n = parseCycle(text);
      if (s && n != null) s.setEngineCycle(n);
      const input = document.querySelector<HTMLInputElement>('#cycle-input');
      if (input) input.value = text;
      await refresh();
    },
    expand(id: string) { expanded.add(id); },
    refresh: () => refresh(),
    capture: () => sphere?.capture4k() ?? '',
    bench: () => sphere?.benchmark() ?? Promise.resolve([]),
    text: () => root?.innerText ?? '',
    look: () => {
      const t = root?.innerText ?? '';
      return t;
    },
  };
  (window as unknown as { borealData?: typeof api }).borealData = api;
  if (new URLSearchParams(location.search).has('data')) toggleDataPanel(true);
}

async function sim(): Promise<PlanetSim | null> {
  return latestPlanetSim() ?? await sharedPlanetSim();
}

async function refresh() {
  if (!root || !open) return;
  const keep = root.querySelector<HTMLInputElement>('#cycle-input');
  const typing = keep && document.activeElement === keep;
  const cycleText = keep?.value ?? '';
  const s = await sim();
  if (!s || !s.engineReport()) {
    root.replaceChildren(el('h2', 'Data'), el('p', 'The Rust simulation is not loaded, so there is nothing to report yet.'));
    return;
  }
  if (!typing && cycleText && parseCycle(cycleText) != null) s.setEngineCycle(parseCycle(cycleText)!);
  const report = decodeEngineReport(s.engineReport());
  paint(root, report, s, typing ? cycleText : String(report.cycle));
  const early = report.seconds > 0 && report.seconds < EARTH_S;
  if (early) showSphere(report, s);
  else hideSphere();
}

function paint(host: HTMLElement, report: EngineReport, s: PlanetSim, cycleText: string) {
  const scroll = host.scrollTop;
  host.replaceChildren();
  host.append(el('h2', 'What is running', 'margin:0 0 8px;font:600 26px system-ui'));
  host.append(el('p', 'Green is healthy. Yellow needs a look. Red is an error or outside the model. Grey has not been called, or is not active at this time.', 'margin:0 0 10px;font-size:16px;color:#d9d0c0'));
  const time = el('label', '', 'display:block;margin:8px 0');
  time.append(el('div', 'Time (cycles)', 'font-weight:600'));
  const input = document.createElement('input');
  input.id = 'cycle-input';
  input.value = cycleText;
  input.style.cssText = 'width:100%;font:20px ui-monospace,monospace;padding:6px 8px;border-radius:8px;border:1px solid #3d5a4c;background:#08110d;color:#fff';
  input.oninput = () => {
    const n = parseCycle(input.value);
    const note = input.nextElementSibling as HTMLElement;
    if (n == null) { note.textContent = 'That is not a finished number yet. Nothing was changed.'; return; }
    s.setEngineCycle(n);
    void refresh();
  };
  time.append(input);
  const years = Number.isFinite(report.years) ? report.years.toExponential(3) : '—';
  const seconds = Number.isFinite(report.seconds) ? report.seconds.toExponential(3) : '—';
  time.append(el('div', `${report.cycle} cycles = ${seconds} seconds = ${years} years. ${report.era}`, 'margin-top:6px'));
  host.append(time);

  host.append(section('Spawn log'));
  const log = el('div', '', 'font-size:16px');
  if (!report.log.length) log.append(el('div', 'No spawns yet.'));
  for (const row of report.log) {
    const who = row.parent ? `${row.parent} → ${row.child}` : row.child;
    log.append(el('div', `${row.kind} ${who} at t=${row.t.toExponential(3)} s — ${row.cause}`));
  }
  host.append(log);

  host.append(section('Dependency tree'));
  const tree = el('div', '', 'font-size:16px');
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
  host.append(tree);

  const spawnRow = el('div', '', 'display:flex;gap:8px;margin:10px 0;flex-wrap:wrap');
  const pick = document.createElement('select');
  pick.style.cssText = 'font:16px system-ui;padding:4px';
  for (const id of ['spacetime', 'reheating', 'nucleosynthesis', 'planet', 'climate', 'solar', 'energy', 'wind', 'hydro', 'clouds']) pick.add(new Option(id, id));
  const spawn = el('button', 'Spawn engine') as HTMLButtonElement;
  spawn.onclick = () => { s.spawnEngine(pick.value); void refresh(); };
  const reset = el('button', 'Reset all inputs') as HTMLButtonElement;
  reset.onclick = () => { s.resetEngines(); void refresh(); };
  spawnRow.append(pick, spawn, reset);
  host.append(spawnRow);

  for (const inst of report.instances) host.append(engineBlock(inst, report, s));

  host.append(section('Not in Rust'));
  for (const gap of NOT_IN_RUST) {
    const line = el('div', '', 'margin:6px 0;padding-left:18px');
    const dot = el('span', '● ', `color:${gap.kind === 'not-built' ? '#e15b64' : '#e15b64'}`);
    line.append(dot, el('b', gap.kind === 'not-built' ? 'NOT BUILT' : 'NOT IN RUST'), el('span', gap.file ? ` ${gap.file}` : ''));
    line.append(el('div', gap.what, 'font-size:16px;color:#d9d0c0'));
    host.append(line);
  }

  const space = report.instances.find(i => i.type === 'spacetime');
  const heat = report.instances.find(i => i.type === 'reheating');
  if (space) {
    host.append(section('Expansion'));
    const plot = document.createElement('canvas');
    plot.width = 520; plot.height = 180; plot.style.cssText = 'width:100%;background:#08110d;border-radius:8px';
    host.append(plot);
    drawPlot(plot, s.cosmosTable());
    if (heat) {
      host.append(section('Reheating'));
      const plot2 = document.createElement('canvas');
      plot2.width = 520; plot2.height = 180; plot2.style.cssText = 'width:100%;background:#08110d;border-radius:8px';
      host.append(plot2);
      drawReheat(plot2, s.reheatTable());
    }
  }
  host.append(sphereControls(report, s));
  host.scrollTop = scroll;
}

function section(title: string) {
  return el('h3', title, 'margin:14px 0 6px;font:600 20px system-ui');
}

function engineBlock(inst: EngineInst, report: EngineReport, s: PlanetSim) {
  const box = el('section', '', 'margin:10px 0;padding:8px;border:1px solid #2a4036;border-radius:10px');
  const head = el('button', '', 'all:unset;cursor:pointer;display:flex;gap:8px;align-items:flex-start;width:100%');
  head.append(el('span', '●', `color:${healthColor(inst.health)};font-size:22px`));
  const title = el('div');
  title.append(el('div', inst.type, 'font:600 20px system-ui'));
  title.append(el('div', `Generates: ${inst.generates}`, 'font-size:16px'));
  const word = healthWord(inst.health);
  if (inst.health !== 1) title.append(el('div', `${word}. ${inst.reason}`, 'font-size:16px'));
  else title.append(el('div', word, 'font-size:16px;color:#b7c4bb'));
  title.append(el('div', `Online ${inst.online}. Spawned because ${inst.cause}. Added ${inst.born}.`, 'font-size:15px;color:#c9bfae'));
  head.append(title);
  head.onclick = () => { expanded.has(inst.type) ? expanded.delete(inst.type) : expanded.add(inst.type); void refresh(); };
  box.append(head);
  const session = report.sessions.find(x => x.type === inst.type || (inst.type === 'planet' && x.type === 'grid step'));
  if (session) box.append(el('div', `This game session has called it ${session.calls} times. Last call ${session.lastMs.toFixed(1)} ms.`, 'font-size:15px;margin-top:4px'));
  if (!expanded.has(inst.type)) return box;
  const body = el('div', '', 'max-height:280px;overflow:auto;margin-top:8px');
  for (const variable of inst.vars) {
    const range = variable.n > 1 ? ` (min ${fmt(variable.min)}, mean ${fmt(variable.value)}, max ${fmt(variable.max)}, ${variable.n} cells)` : '';
    body.append(el('div', `${variable.label}: ${fmt(variable.value)} ${variable.unit}${range}`, 'font-size:16px'));
  }
  box.append(body);
  for (const eq of report.equations.filter(e => e.type === inst.type)) {
    const math = el('div', '', 'margin:8px 0;overflow:auto');
    try { katex.render(eq.latex, math, { throwOnError: false, displayMode: true }); }
    catch { math.textContent = eq.latex; }
    box.append(el('div', eq.title, 'font-weight:600;margin-top:8px'), math);
    for (const sym of inst.symbols.filter(sy => sy.equation === eq.id)) {
      const row = el('div', '', 'font-size:16px');
      const bit = el('span');
      try { katex.render(sym.latex, bit, { throwOnError: false }); } catch { bit.textContent = sym.name; }
      row.append(bit, el('span', ` = ${fmt(sym.value)} ${sym.unit}`));
      box.append(row);
    }
  }
  const mine = report.params.filter(p => p.type === inst.type || (inst.type !== 'planet' && inst.type !== 'spacetime' && inst.type !== 'reheating' && p.type === 'planet'));
  if (mine.length) {
    box.append(el('div', 'Inputs', 'font-weight:600;margin-top:8px'));
    for (const p of mine) {
      const row = el('label', '', 'display:flex;justify-content:space-between;gap:8px;font-size:16px;margin:4px 0');
      row.append(el('span', `${p.label} (${p.unit})`));
      const field = document.createElement('input');
      field.value = String(p.value);
      field.style.cssText = 'width:140px;font:15px ui-monospace,monospace;background:#08110d;color:#fff;border:1px solid #3d5a4c;border-radius:6px;padding:2px 6px';
      field.onchange = () => {
        const n = Number(field.value);
        if (!Number.isFinite(n)) return;
        s.setEngineParam(p.key, n);
        void refresh();
      };
      row.append(field);
      box.append(row);
    }
    const reset = el('button', 'Reset this engine') as HTMLButtonElement;
    reset.onclick = () => { s.resetEngine(inst.type); void refresh(); };
    box.append(reset);
  }
  const despawn = el('button', 'Despawn') as HTMLButtonElement;
  despawn.onclick = () => { s.despawnEngine(inst.type); void refresh(); };
  box.append(despawn);
  return box;
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

function sphereControls(report: EngineReport, _s: PlanetSim) {
  const box = el('div');
  box.append(section('Early-universe picture'));
  const space = report.instances.find(i => i.type === 'spacetime');
  const heat = report.instances.find(i => i.type === 'reheating');
  const a = space?.vars.find(v => v.label.startsWith('scale'))?.value ?? 0;
  const h = space?.vars.find(v => v.label.startsWith('Hubble'))?.value ?? 0;
  const temp = heat?.vars.find(v => v.label === 'temperature')?.value ?? space?.vars.find(v => v.label === 'temperature')?.value ?? 0;
  const rho = heat?.vars.find(v => v.label === 'radiation density')?.value ?? space?.vars.find(v => v.label === 'total density')?.value ?? 0;
  const look = sphereLook(a, h, temp, rho);
  box.append(el('div', look.radiusRule, 'font-size:15px'));
  box.append(el('div', `Right now the sphere radius is ${look.radius.toFixed(2)} and the brightness is ${look.brightness.toFixed(2)}.`, 'font-size:16px'));
  if (!sphere) return box;
  box.append(el('div', `Tier ${sphere['tier'] ? '' : ''}${document.querySelector('#cosmos-tier')?.textContent ?? ''}`, 'font-size:16px'));
  const why = el('div'); why.id = 'cosmos-tier'; why.textContent = sphere.why;
  box.append(why);
  const live = el('div'); live.id = 'cosmos-fps';
  box.append(live);
  sphere.onChange((text, fps, ms) => { why.textContent = text; live.textContent = `${fps.toFixed(0)} fps, this frame ${ms.toFixed(1)} ms`; });
  const row = el('div', '', 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px');
  const test = el('button', 'Test this computer') as HTMLButtonElement;
  test.onclick = () => { void sphere?.benchmark().then(() => void refresh()); };
  const cap = el('button', 'Capture 4K still') as HTMLButtonElement;
  cap.onclick = () => {
    const url = sphere?.capture4k();
    if (!url) return;
    const aLink = document.createElement('a');
    aLink.href = url; aLink.download = 'boreal-cosmos-4k.png'; aLink.click();
  };
  row.append(test, cap);
  box.append(row);
  const target = document.createElement('input');
  target.value = '16.7';
  target.style.cssText = 'width:80px;font:15px monospace';
  target.onchange = () => sphere?.setTargetMs(Number(target.value));
  const lab = el('label', 'Target frame time (ms) ');
  lab.append(target);
  box.append(lab);
  const lock = document.createElement('select');
  lock.add(new Option('automatic tier', ''));
  for (const tier of TIERS) lock.add(new Option(`${tier.label} ${tier.width}×${tier.height}`, tier.id));
  lock.onchange = () => sphere?.lockTier((lock.value || null) as 'ultra' | 'high' | 'medium' | 'low' | null);
  box.append(lock);
  box.append(el('div', `GPU ${sphere.gpu.renderer}. Max texture ${sphere.gpu.maxTexture}. Float targets ${sphere.gpu.floatTarget ? 'yes' : 'no'}. MSAA samples ${sphere.gpu.samples}.`, 'font-size:14px;margin-top:6px'));
  if (sphere.bench.length) {
    for (const b of sphere.bench) box.append(el('div', `${b.id}: median ${b.p50.toFixed(1)} ms, 95th ${b.p95.toFixed(1)} ms`, 'font-size:14px'));
  }
  const _tier = tierById('low');
  void _tier;
  return box;
}

function showSphere(report: EngineReport, _s: PlanetSim) {
  if (!sphere) sphere = new CosmosSphere(document.body);
  const space = report.instances.find(i => i.type === 'spacetime');
  const heat = report.instances.find(i => i.type === 'reheating');
  sphere.setInputs({
    a: space?.vars.find(v => v.label.startsWith('scale'))?.value ?? 1e-40,
    h: space?.vars.find(v => v.label.startsWith('Hubble'))?.value ?? 1,
    temperature: heat?.vars.find(v => v.label === 'temperature')?.value ?? space?.vars.find(v => v.label === 'temperature')?.value ?? 1,
    rho: (heat?.vars.find(v => v.label === 'radiation density')?.value || space?.vars.find(v => v.label === 'total density')?.value) ?? 1,
  });
}

function hideSphere() { sphere?.dispose(); sphere = null; }

ensure();
