/**
 * The contest opening on the flat page. A bare load shows the hot sphere, the Rust
 * temperature cools it to deep blue-violet, and then the planet takes the screen.
 * Three.js only draws. The cycle is the same count the VR journey uses.
 */
import { latestPlanetSim, type PlanetSim } from '../../core/planetBudget';
import { sharedPlanetSim } from '../../core/planetWeather';
import { decodeEngineReport, type EngineReport } from '../../core/engineReport';
import { createBigBangAudio } from '../../audio/bigBang';
import { CosmosSphere, type SphereInputs } from './sphere';
import { CINE, NARRATION, bangAt, bangFlash, cineStage, cosmicSeconds, eraOfSeconds, formatCosmicSeconds, heroAt, narrationEndFallback, secondsToCycle, subtitleAt, type CineStage } from './cineBeats';

/**
 * Cycle 1 is the pink-white bath. Cycle 58 is already the deep blue-violet (the Rust bath
 * is only tens of kelvin). Cycle 62 is the planet. The cycle is not advanced at a constant
 * rate: the colour arc takes `arcSec`, then the deep blue-violet holds for `holdSec`, then the planet.
 * A click or a pinch skips the rest.
 */
export const OPENING = { from: 1, violetAt: 58, planetAt: 62, arcSec: 32, holdSec: 12 } as const;

const HOT: SphereInputs = { a: 1e-40, h: 1, temperature: 1e22, rho: 1 };

const smooth = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };

/** Where the opening is after `elapsed` seconds. The colour is still whatever Rust reports at that cycle. */
export function openingCycle(elapsed: number, pace = OPENING) {
  const t = Math.max(0, elapsed);
  const total = pace.arcSec + pace.holdSec;
  if (t >= total) return { cycle: pace.planetAt, planet: true, violet: false };
  if (t >= pace.arcSec) return { cycle: pace.violetAt, planet: false, violet: true };
  const cycle = pace.from + (pace.violetAt - pace.from) * smooth(t / pace.arcSec);
  return { cycle, planet: false, violet: false };
}

export function sphereInputs(report: EngineReport | null): SphereInputs {
  if (!report) return HOT;
  const space = report.instances.find(i => i.type === 'spacetime');
  const heat = report.instances.find(i => i.type === 'reheating');
  const temperature = heat?.vars.find(v => v.label === 'temperature')?.value
    ?? space?.vars.find(v => v.label === 'temperature')?.value
    ?? 0;
  if (!(temperature > 0)) return HOT;
  const rho = heat?.vars.find(v => v.label === 'radiation density')?.value
    || space?.vars.find(v => v.label === 'total density')?.value
    || HOT.rho;
  return {
    a: space?.vars.find(v => v.label.startsWith('scale'))?.value ?? HOT.a,
    h: space?.vars.find(v => v.label.startsWith('Hubble'))?.value ?? HOT.h,
    temperature,
    rho,
  };
}

export interface Opening {
  readonly cycle: number;
  readonly phase: 'sphere' | 'planet';
  step(dt: number): void;
  /** First visit does not skip. Kept so older callers still compile. */
  skip(): void;
  stop(): void;
}

const CINE_CSS = `
body.cine-run,body.cine-run *{cursor:none}
body.cine-run header,body.cine-run #status,body.cine-run #interaction,body.cine-run footer,body.cine-run #notice,body.cine-run #data-panel,body.cine-run #data-panel-btn,body.cine-run #camera-panel{visibility:hidden}
#cine{position:fixed;inset:0;z-index:40;color:#f4efe2;font:15px/1.5 system-ui,sans-serif}
#cine .veil{position:absolute;inset:0;background:#000;transition:opacity .8s linear}
#cine .pin{position:absolute;left:50%;top:50%;width:2px;height:2px;margin:-1px;border-radius:50%;background:#f3d7b0;box-shadow:0 0 6px 1px #e7b56a;transform:scale(1);animation:cine-breathe 3.2s ease-in-out infinite}
#cine .pin.shrink{animation:none;transform:scale(.35);transition:transform .4s ease}
#cine .prompt{position:absolute;left:50%;bottom:11vh;transform:translateX(-50%);margin:0;letter-spacing:.04em;color:#e7dcc8;text-align:center}
#cine .sub{position:absolute;left:50%;bottom:16vh;transform:translateX(-50%);margin:0;font:italic 22px Georgia,serif;letter-spacing:.02em;text-shadow:0 1px 8px #000}
#cine .title{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);margin:0;font:700 clamp(42px,8vw,92px) Georgia,serif;letter-spacing:.18em;text-align:center}
#cine .title.show{animation:cine-title .7s cubic-bezier(.2,.8,.2,1) both}
#cine .title.out{opacity:0;transition:opacity .8s ease}
#cine .flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
#cine .ring{position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px;border:1px solid #fff8;border-radius:50%;opacity:0}
#cine .ring.go{animation:cine-ring .7s ease-out both}
#cine.kick{animation:cine-kick .12s ease-out}
#cine-panel{position:absolute;top:28px;right:26px;width:min(280px,40vw);display:grid;gap:6px;padding:14px 16px 16px;background:#0d1712f2;color:#f4efe2;border-radius:12px;box-shadow:0 8px 40px #000a}
#cine-panel[hidden]{display:none}
#cine-panel .x{position:absolute;top:6px;right:8px;background:none;border:0;color:#f4efe2;font:18px system-ui;padding:4px 8px}
#cine-panel h2{margin:0;font:400 22px Georgia,serif;letter-spacing:.12em}
#cine-panel .count{font:400 28px Georgia,serif}
#cine-panel .era{font-size:13px;color:#d9d0c0}
#cine-panel.pop{animation:cine-pop .35s cubic-bezier(.34,1.56,.64,1) both}
#cine-panel.out{animation:cine-out .4s ease forwards}
#cine-ref{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}
@keyframes cine-breathe{0%,100%{transform:scale(.7);opacity:.55}50%{transform:scale(1.35);opacity:1}}
@keyframes cine-title{from{opacity:0;letter-spacing:.45em}to{opacity:1;letter-spacing:.18em}}
@keyframes cine-ring{from{transform:scale(1);opacity:.8}to{transform:scale(40);opacity:0}}
@keyframes cine-kick{0%{transform:translateY(0)}40%{transform:translateY(6px)}100%{transform:translateY(0)}}
@keyframes cine-pop{0%{opacity:0;transform:scale(.8)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
@keyframes cine-out{to{opacity:0;transform:scale(1.02)}}
`;

/**
 * The film replaces the old "click to skip to the planet" arc.
 * B0 fades to black, B0b waits for a click or a key (no gamepad, no audio),
 * then B1–B3 play. The slice holds at the end of B3. Arrival is a later beat.
 * `onBegin` starts the planet boot behind this picture.
 */
export function createOpening(onPlanet: () => void, onBegin?: () => void): Opening {
  ensureCss();
  document.body.classList.add('cine-run');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const refs = new URLSearchParams(location.search).get('cine-refs') === '1';
  const jump = new URLSearchParams(location.search).get('cine');
  const root = el('div'); root.id = 'cine';
  const ref = document.createElement('video'); ref.id = 'cine-ref'; ref.muted = true; ref.loop = true; ref.playsInline = true;
  const veil = el('div', 'veil');
  const pin = el('div', 'pin'); pin.hidden = true;
  const prompt = el('p', 'prompt', 'Click or press any key to begin.');
  const sub = el('p', 'sub');
  const title = el('h1', 'title', 'THE BIG BANG'); title.hidden = true;
  const flash = el('div', 'flash');
  const ring = el('div', 'ring');
  const panel = el('aside'); panel.id = 'cine-panel'; panel.hidden = true;
  const close = document.createElement('button'); close.className = 'x'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close');
  const hero = el('h2', '', '');
  const count = el('div', 'count');
  const era = el('div', 'era');
  panel.append(close, hero, count, era);
  root.append(ref, veil, pin, sub, title, flash, ring, prompt, panel);
  document.body.append(root);

  let sphere: CosmosSphere | null = null;
  let elapsed = 0;
  let pinned: number | null = null;
  let begun = false;
  let narrationEndedAt: number | null = null;
  let cycle: number = OPENING.from;
  let phase: Opening['phase'] = 'sphere';
  let sim: PlanetSim | null = latestPlanetSim();
  let busy = false;
  let heroStamp = -10;
  let countStamp = -10;
  let panelShown = false;
  let closed = false;
  try { closed = localStorage.getItem(PANEL_KEY) === 'closed'; } catch { /* private mode */ }
  const audio = createBigBangAudio();
  const narration = new Audio(NARRATION.file);
  narration.preload = 'auto';
  narration.onended = () => {
    const d = narration.duration;
    if (Number.isFinite(d) && d < 2) return;
    if (narrationEndedAt == null) narrationEndedAt = elapsed;
  };

  if (jump === 'B7') { begun = true; elapsed = CINE.b7; narrationEndedAt = 0; prompt.hidden = true; }
  void onPlanet;
  const debug = jump === 'shot' || jump === 'B7';

  const begin = () => {
    if (begun) return;
    begun = true;
    elapsed = CINE.b1;
    prompt.hidden = true;
    root.style.pointerEvents = 'none';
    panel.style.pointerEvents = 'auto';
    onBegin?.();
    audio.begin();
    void narration.play().catch(() => {});
    sphere = new CosmosSphere(document.body);
    sphere.canvas.style.opacity = '0';
    sphere.setInputs(HOT);
  };
  const onPointer = (e: PointerEvent) => {
    const t = e.target;
    if (t instanceof Element && t.closest('button,a,input,textarea,select,dialog,#loading')) return;
    if (!begun) begin();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.target instanceof HTMLElement && (e.target.isContentEditable || e.target.matches('input,textarea,select'))) return;
    const k = e.key.toLowerCase();
    if (begun && (k === 'i' || k === 'x' || e.key === 'Escape') && !panel.hidden) {
      e.preventDefault(); e.stopImmediatePropagation(); shutPanel(); return;
    }
    if (!begun) { e.preventDefault(); e.stopPropagation(); begin(); }
  };
  close.onclick = () => shutPanel();
  window.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', onKey, true);

  const api: Opening = {
    get cycle() { return cycle; },
    get phase() { return phase; },
    step(dt: number) {
      const cap = jump === 'B7' ? 200 : CINE.b3End;
      if (pinned != null) elapsed = pinned;
      else if (!begun) elapsed = Math.min(CINE.fade, elapsed + Math.max(0, dt));
      else elapsed = Math.min(cap, elapsed + Math.max(0, dt));
      if (begun && narrationEndedAt == null && narration.ended && !(Number.isFinite(narration.duration) && narration.duration < 2)) narrationEndedAt = elapsed;
      if (begun && narrationEndedAt == null && elapsed >= narrationEndFallback() + 1 && !(narration.duration > 2)) narrationEndedAt = narrationEndFallback();
      paintDom();
      if (!begun || !sphere) return;
      cycle = secondsToCycle(cosmicSeconds(elapsed));
      const end = narrationEndedAt ?? narrationEndFallback();
      const u = end > CINE.b1 ? Math.min(1, Math.max(0, (elapsed - CINE.b1) / (end - CINE.b1))) : 1;
      sphere.setFraming(50 + (46 - 50) * u, reduced ? 1 : 1 + Math.max(0, Math.min(1, (elapsed - bangAt(end)) / 1.2)) * 0.18);
      if (!busy) { busy = true; void paintSim().finally(() => { busy = false; }); }
    },
    skip() { /* first visit does not skip */ },
    stop() { /* the film holds; B14 will dismiss it */ },
  };
  const probe = api as Opening & { begin: () => void; seek: (t: number) => void; elapsed: number };
  probe.begin = begin;
  probe.seek = (t: number) => {
    if (!debug) return;
    if (!begun) begin();
    if (narrationEndedAt == null && t >= narrationEndFallback()) narrationEndedAt = narrationEndFallback();
    pinned = t;
    elapsed = t;
  };
  Object.defineProperty(probe, 'elapsed', { get: () => elapsed });
  (window as unknown as { __borealOpening?: typeof probe }).__borealOpening = probe;
  return api;

  function shutPanel() {
    if (panel.hidden) return;
    panel.classList.add('out');
    closed = true;
    try { localStorage.setItem(PANEL_KEY, 'closed'); } catch { /* blocked */ }
    window.setTimeout(() => { panel.hidden = true; }, 400);
  }

  function paintDom() {
    const stage = cineStage(elapsed, begun, narrationEndedAt);
    pin.hidden = !(stage === 'wait' || stage === 'b1' || stage === 'b2' || stage === 'b3');
    pin.classList.toggle('shrink', stage === 'b2' || stage === 'b3');
    prompt.hidden = stage !== 'wait';
    sub.textContent = begun ? subtitleAt(elapsed, narrationEndedAt) : '';
    const end = narrationEndedAt;
    const showTitle = end != null && elapsed >= bangAt(end) + CINE.titleAfterBang && elapsed < CINE.b3End + 2;
    title.hidden = !showTitle;
    title.classList.toggle('show', showTitle && elapsed < bangAt(end!) + CINE.titleAfterBang + CINE.titleHold);
    title.classList.toggle('out', showTitle && elapsed >= bangAt(end!) + CINE.titleAfterBang + CINE.titleHold);
    const flashN = end != null && begun ? bangFlash(elapsed, end, reduced) : 0;
    flash.style.opacity = String(flashN);
    if (!reduced && end != null && elapsed >= bangAt(end) && elapsed < bangAt(end) + 0.2) {
      ring.classList.add('go');
      root.classList.add('kick');
    }
    const veilOut = end != null && elapsed >= bangAt(end) + CINE.titleAfterBang + CINE.titleHold;
    veil.style.opacity = veilOut ? '0.15' : '1';
    if (sphere) sphere.canvas.style.opacity = veilOut ? '1' : '0';
    showRef(stage);
    const heroText = heroAt(elapsed);
    const showPanel = begun && elapsed >= CINE.panelAt && !closed && heroText !== '';
    if (showPanel && !panelShown) { panelShown = true; panel.hidden = false; panel.classList.add('pop'); }
    if (showPanel) {
      if (hero.textContent !== heroText && elapsed - heroStamp >= 2.5) { hero.textContent = heroText; heroStamp = elapsed; }
      if (elapsed - countStamp >= 2.5 || count.textContent === '') {
        count.textContent = formatCosmicSeconds(cosmicSeconds(elapsed));
        era.textContent = eraOfSeconds(cosmicSeconds(elapsed));
        countStamp = elapsed;
      }
    }
    if (begun) audio.sync(elapsed, narrationEndedAt);
  }

  function showRef(stage: CineStage) {
    if (!refs) { ref.style.display = 'none'; return; }
    const file = stage === 'b1' ? 'cinematic/refs/PLACEHOLDER_B1.mp4' : stage === 'b3' || stage === 'hold' ? 'cinematic/refs/PLACEHOLDER_B3.mp4' : '';
    if (!file) { ref.style.display = 'none'; return; }
    if (ref.dataset.file !== file) { ref.dataset.file = file; ref.src = file; void ref.play().catch(() => {}); }
    ref.style.display = 'block';
  }

  async function paintSim() {
    sim ??= latestPlanetSim() ?? await sharedPlanetSim();
    if (!sim || !sphere) return;
    sim.setEngineCycle(cycle);
    const text = sim.engineReport();
    sphere.setInputs(text ? sphereInputs(decodeEngineReport(text)) : HOT);
  }
}

const PANEL_KEY = 'boreal.cine.panel';
function ensureCss() {
  if (document.getElementById('cine-style')) return;
  const style = document.createElement('style');
  style.id = 'cine-style';
  style.textContent = CINE_CSS;
  document.head.append(style);
}
function el(tag: string, cls?: string, text?: string) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
