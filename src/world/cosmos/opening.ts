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
import { GLOBE_ERA, GLOBE_LAND, GLOBE_SKY } from '../globe/tile';
import { CINE, NARRATION, bangAt, bangFlash, cineStage, cosmicSeconds, flashLuma, formatClock, kickOffset, narrationEndFallback, panelFigure, pinHeld, plasmaLook, secondsToCycle, shellOnScreen, shellRadius, subtitleAt, titleDissolve, type CineStage } from './cineBeats';

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
body.cine-run header,body.cine-run #status,body.cine-run #interaction,body.cine-run footer,body.cine-run #notice,body.cine-run #data-panel,body.cine-run #data-panel-btn,body.cine-run #camera-panel,body.cine-run .wolf-senses,body.cine-run #flight-prompt{visibility:hidden}
#cine{position:fixed;inset:0;z-index:40;overflow:hidden;background:#000;color:#f4efe2;font:15px/1.5 system-ui,sans-serif}
#cine .veil{position:absolute;inset:0;background:#000}
#cine .pin{position:absolute;left:50%;top:50%;width:2px;height:2px;margin:-1px;border-radius:50%;background:#FFE8C0;box-shadow:0 0 4px 0 #FFE8C0;animation:cine-breathe 3.2s ease-in-out infinite}
#cine .pin.shrink{animation:none;transform:scale(.35);transition:transform .4s ease}
#cine .prompt{position:absolute;left:50%;bottom:11vh;transform:translateX(-50%);margin:0;letter-spacing:.04em;color:#FFE8C0;text-align:center;animation:cine-wait 3s ease-in-out infinite}
#cine .sub{position:absolute;left:50%;bottom:16vh;transform:translateX(-50%);margin:0;font:italic 22px Georgia,serif;letter-spacing:.02em;text-shadow:0 1px 8px #000}
#cine .title{position:absolute;left:50%;top:46%;width:max-content;max-width:none;margin:0;isolation:isolate;color:#fff6e4;font:700 6.05vw Georgia,serif;letter-spacing:.18em;white-space:nowrap;text-align:center;text-shadow:0 1px 0 #fff6,0 10px 22px #000c,0 0 28px #ffb45a88;transform:translate(-50%,-50%) perspective(700px) rotateX(5deg)}
#cine .title::before{content:"";position:absolute;left:50%;top:58%;width:145%;height:280%;transform:translate(-50%,-50%);background:radial-gradient(ellipse at center, rgba(36,14,6,.66) 0%, rgba(36,14,6,.3) 46%, rgba(36,14,6,0) 72%);z-index:-1;pointer-events:none}
#cine-plate{position:absolute;inset:-40px;width:calc(100% + 80px);height:calc(100% + 80px);pointer-events:none;z-index:1}
#cine .veil{z-index:1}
#cine .pin,#cine .prompt,#cine .sub,#cine .title,#cine-panel,#cine-ref,#cine .still{z-index:2}
#cine .hero-line{position:absolute;left:50%;bottom:22%;width:max-content;max-width:92vw;transform:translateX(-50%);margin:0;z-index:2;color:#fff1d4;font:700 5.25vw Georgia,serif;letter-spacing:.12em;text-align:center;white-space:nowrap;text-shadow:0 2px 18px #000c,0 0 24px #ffb45a55;display:none}
#cine-panel{position:absolute;top:36px;right:28px;width:min(560px,52vw);display:grid;gap:10px;padding:20px 24px 22px;background:rgba(12,7,4,.7);color:#f6efe4;border:1px solid rgba(255,220,170,.2);border-radius:18px;box-shadow:0 12px 40px #0006;backdrop-filter:blur(16px)}
#cine-panel[hidden]{display:none}
#cine-panel .x{position:absolute;top:6px;right:8px;background:none;border:0;color:#f6efe4aa;font:20px system-ui;padding:2px 8px}
#cine-panel .count{font:400 39px Georgia,serif;min-height:1.15em;overflow:hidden;text-shadow:0 1px 2px #000a}
#cine-panel .count .d{display:inline-block}
#cine-panel .count.roll .d{animation:cine-digit .5s linear both}
#cine-panel .count.roll .d:nth-child(2){animation-delay:.04s}
#cine-panel .count.roll .d:nth-child(3){animation-delay:.08s}
#cine-panel .count.roll .d:nth-child(4){animation-delay:.12s}
#cine-panel .count.roll .d:nth-child(5){animation-delay:.16s}
#cine-panel .fig{font:400 31px Georgia,serif;color:#ffffff;transform-origin:0 50%;text-shadow:0 1px 2px #000a}
#cine-panel .fig.roll{animation:cine-roll .5s linear both}
#cine-panel.pop{animation:cine-pop .35s cubic-bezier(.34,1.56,.64,1) both}
#cine-panel.out{animation:cine-out .4s ease forwards}
#cine-ref,#cine .still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none}
@keyframes cine-breathe{0%,100%{transform:scale(.75);opacity:.7}50%{transform:scale(1.2);opacity:1}}
@keyframes cine-wait{0%,100%{opacity:.5}50%{opacity:.8}}
@keyframes cine-pop{0%{opacity:0;transform:scale(.8)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}
@keyframes cine-roll{0%{opacity:1;transform:none}100%{opacity:1;transform:none}}
@keyframes cine-digit{0%{opacity:.2;transform:translateY(85%)}100%{opacity:1;transform:none}}
@keyframes cine-out{to{opacity:0;transform:scale(1.02)}}
`;

/**
 * The film replaces the old "click to skip to the planet" arc.
 * B0 fades to black, B0b waits for a click or a key (no gamepad, no audio),
 * then B1–B3 play. The slice holds at the end of B3. Arrival is a later beat.
 * `onBegin` starts the planet boot behind this picture.
 */
export function createOpening(onPlanet: () => void, onBegin?: () => void, earth?: { show: () => void; ready: () => Promise<void> }): Opening {
  ensureCss();
  document.body.classList.add('cine-run');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const refs = new URLSearchParams(location.search).get('cine-refs') === '1';
  const jump = new URLSearchParams(location.search).get('cine');
  const root = el('div'); root.id = 'cine';
  const plate = document.createElement('canvas'); plate.id = 'cine-plate';
  const ref = document.createElement('video'); ref.id = 'cine-ref'; ref.muted = true; ref.loop = true; ref.playsInline = true;
  const still = document.createElement('img'); still.className = 'still'; still.alt = '';
  const veil = el('div', 'veil');
  const pin = el('div', 'pin'); pin.hidden = true;
  const prompt = el('p', 'prompt', 'Click or press any key to begin.');
  const sub = el('p', 'sub');
  const title = el('h1', 'title', 'THE BIG BANG'); title.hidden = true;
  const heroLine = el('p', 'hero-line', '3 minutes');
  const panel = el('aside'); panel.id = 'cine-panel'; panel.hidden = true;
  const close = document.createElement('button'); close.className = 'x'; close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close');
  const count = el('div', 'count');
  const fig = el('div', 'fig');
  panel.append(close, count, fig);
  root.append(plate, ref, still, veil, pin, sub, title, heroLine, prompt, panel);
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
  let panelShown = false;
  let closed = false;
  let booted = false;
  let earthOn = false;
  let arrived = false;
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
    void earth?.ready().then(() => {
      booted = true;
      GLOBE_ERA.uEra.value.set(1, 0, 0, 0);
      GLOBE_SKY.hold = 1;
      GLOBE_SKY.warm = 0.55;
      GLOBE_SKY.steam = 0;
      GLOBE_SKY.clear = 1;
    });
    audio.begin();
    void narration.play().catch(() => {});
    sphere = new CosmosSphere(root);
    sphere.canvas.style.cssText = 'position:absolute;inset:-70px;width:calc(100% + 140px);height:calc(100% + 140px);z-index:0;pointer-events:none;opacity:0;background:#000';
    root.insertBefore(sphere.canvas, plate);
    sphere.setInputs(HOT);
    if (jump === 'shot') sphere.lockTier('low');
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
      const cap = CINE.b14End;
      if (pinned != null) elapsed = Math.min(cap, pinned);
      else if (!begun) elapsed = Math.min(CINE.fade, elapsed + Math.max(0, dt));
      else elapsed = Math.min(cap, elapsed + Math.max(0, dt));
      if (pinned == null && begun && !booted && elapsed >= CINE.b13End) elapsed = CINE.b13End - 0.05;
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
    const end = narrationEndedAt;
    const bang = end == null ? null : bangAt(end);
    const alive = stage === 'wait' || stage === 'b1' || stage === 'b2';
    pin.hidden = !(alive && pinHeld(elapsed, bang));
    pin.classList.toggle('shrink', stage === 'b2');
    prompt.hidden = stage !== 'wait';
    sub.textContent = begun ? subtitleAt(elapsed, narrationEndedAt) : '';
    const holdEnd = bang == null ? Infinity : bang + CINE.titleAfterBang + CINE.titleHold;
    const dissolve = bang == null ? 0 : titleDissolve(elapsed - holdEnd);
    const showTitle = bang != null && elapsed >= bang + CINE.titleAfterBang && dissolve < 1;
    title.hidden = !showTitle;
    title.style.opacity = showTitle ? String(1 - dissolve) : '0';
    const kick = bang == null ? { x: 0, y: 0 } : kickOffset(elapsed - bang - CINE.bangPeak, reduced);
    title.style.transform = `translate(calc(-50% + ${kick.x * 1.35}px), calc(-50% + ${kick.y * 1.35}px)) perspective(700px) rotateX(5deg)`;
    plate.style.transform = `translate(${kick.x}px, ${kick.y}px)`;
    const hazeOn = bang != null && elapsed >= bang + CINE.bangPeak - 0.02;
    veil.style.opacity = hazeOn ? '0' : '1';
    const arrival = stage === 'b14' || (stage === 'hold' && earthOn);
    const line = stage === 'b5' ? '3 minutes' : stage === 'b7' ? '380,000 years' : arrival ? 'Today · 13.8 billion years' : '';
    heroLine.textContent = line;
    heroLine.style.fontSize = line.length > 16 ? '3.2vw' : '';
    heroLine.style.bottom = arrival ? '1.6vh' : '';
    heroLine.style.textShadow = arrival ? '0 2px 10px #000, 0 8px 28px #000, 0 0 18px #000' : '';
    heroLine.style.display = line ? 'block' : 'none';
    const onEarth = stage === 'b11' || stage === 'b12' || stage === 'b13' || stage === 'b14' || (stage === 'hold' && earthOn);
    const bridge = booted && elapsed >= 83.2 && elapsed < 85.4;
    const showEarth = (onEarth || bridge) && booted;
    if (showEarth && !earthOn) {
      earthOn = true;
      earth?.show();
    }
    if (sphere) {
      const plasmaOn = !showEarth && bang != null && elapsed >= bang + CINE.bangPeak - 0.05;
      const cover = !showEarth ? (plasmaOn ? 1 : 0) : elapsed < 85.4 ? Math.max(0, 1 - (elapsed - 83.2) / 2.2) : 0;
      sphere.canvas.style.opacity = String(cover);
      sphere.canvas.style.transform = plate.style.transform;
      sphere.setPlasma(cover > 0.001, { time: elapsed, ...plasmaLook(Math.min(elapsed, 84.8)) });
    }
    paintPlate(bang, dissolve);
    showRef(stage);
    const figure = panelFigure(elapsed);
    const showPanel = begun && elapsed >= CINE.panelAt && elapsed <= CINE.b14End && !closed;
    if (showEarth) {
      root.style.background = 'transparent';
      plate.style.visibility = 'visible';
      tintGlobe(elapsed);
      driveFilm(elapsed);
      panel.style.top = '';
      panel.style.bottom = '';
      panel.style.right = '';
      panel.style.left = '';
      const panelOut = elapsed < 111.9 ? 1 : Math.max(0, 1 - (elapsed - 111.9) / 0.6);
      if (elapsed >= 111.9) { panel.style.animation = 'none'; panel.classList.remove('pop'); }
      panel.style.setProperty('opacity', String(panelOut), 'important');
    } else if (booted) {
      root.style.background = '#000';
      GLOBE_ERA.uEra.value.set(1, 0, 0, 0);
      GLOBE_SKY.hold = 1;
      GLOBE_SKY.warm = 0.55;
      GLOBE_SKY.clear = 1;
      GLOBE_SKY.steam = 0;
    }
    document.documentElement.dataset.cineEarth = earthOn ? '1' : '0';
    if (stage === 'b14' && earthOn && !arrived) {
      arrived = true;
      window.dispatchEvent(new Event('cinematic:complete'));
      const save = (window as unknown as { __borealSave?: { markBigBangSeen?: () => void } }).__borealSave;
      save?.markBigBangSeen?.();
      onPlanet();
    }
    if (showPanel && !panelShown) { panelShown = true; panel.classList.add('pop'); }
    panel.hidden = !showPanel;
    if (showPanel) {
      const clock = formatClock(elapsed);
      const years = clock.includes('year') || clock === 'Today';
      count.style.fontSize = years ? '26px' : '';
      count.style.opacity = '1';
      count.style.color = '#f6efe4';
      count.style.overflow = years ? 'visible' : '';
      panel.style.width = elapsed >= 82 ? 'min(820px, 78vw)' : '';
      if (years) setPlain(count, clock);
      else setRolling(count, clock);
      if (fig.dataset.v !== figure) {
        fig.dataset.v = figure;
        fig.textContent = figure;
        fig.classList.remove('roll');
      }
      const rowEnd = figure === '4.4 Gya oceans' ? 100 : figure === '2.4 Gya' ? 103 : figure === '470 Mya plants' ? 107.2 : 0;
      const fade = rowEnd > 0 && elapsed > rowEnd - 0.45 ? Math.max(0, (rowEnd - elapsed) / 0.45) : 1;
      fig.style.setProperty('color', '#ffffff', 'important');
      fig.style.setProperty('opacity', figure ? String(fade) : '1', 'important');
    }
    if (begun) audio.sync(elapsed, narrationEndedAt);
  }

  function showRef(stage: CineStage) {
    if (!refs) { ref.style.display = 'none'; still.style.display = 'none'; return; }
    const video = stage === 'b1' ? 'cinematic/refs/PLACEHOLDER_B1.mp4' : stage === 'b3' ? 'cinematic/refs/PLACEHOLDER_B3.mp4' : '';
    const jpg = stage === 'b4' ? 'cinematic/refs/PLACEHOLDER_B4.jpg' : stage === 'b5' ? 'cinematic/refs/PLACEHOLDER_B5.jpg' : stage === 'b6' || stage === 'b7' ? 'cinematic/refs/PLACEHOLDER_B6_B7.jpg' : stage === 'b8' || stage === 'b9' ? 'cinematic/refs/PLACEHOLDER_B8_B9.jpg' : stage === 'b10' ? 'cinematic/refs/PLACEHOLDER_B10.jpg' : '';
    if (video) {
      still.style.display = 'none';
      if (ref.dataset.file !== video) { ref.dataset.file = video; ref.src = video; void ref.play().catch(() => {}); }
      ref.style.display = 'block';
    } else ref.style.display = 'none';
    if (jpg) { if (still.dataset.file !== jpg) { still.dataset.file = jpg; still.src = jpg; } still.style.display = 'block'; }
    else still.style.display = 'none';
  }

  function tintGlobe(t: number) {
    const land = GLOBE_LAND.uLandTint.value;
    land.setRGB(1, 1, 1);
    const era = GLOBE_ERA.uEra.value;
    const ease = (u: number) => { const x = Math.min(1, Math.max(0, u)); return x * x * (3 - 2 * x); };
    GLOBE_SKY.hold = 1;
    if (t < 92) {
      era.set(1, 0, 0, 0);
      GLOBE_SKY.warm = 0.55;
      GLOBE_SKY.steam = 0;
      GLOBE_SKY.clear = 1;
    } else if (t < 97) {
      const s = ease((t - 92) / 5);
      era.set(1 + (0.045 - 1) * s, 0.625 * s, 0, 0);
      GLOBE_SKY.warm = 0.55 + (0.105 - 0.55) * s;
      GLOBE_SKY.steam = 0.625 * s;
      GLOBE_SKY.clear = 1 + (0.241 - 1) * s;
    } else if (t < 107) {
      const along = Math.min(1, (t - 97) / 11);
      const plants = t < 101 ? 0 : Math.min(1, (t - 101) / 5);
      era.set(0.045 * (1 - Math.min(1, (t - 97) / 8)), 0.625 + 0.375 * Math.min(1, (t - 97) / 7), plants, 0);
      GLOBE_SKY.warm = 0.105 * (1 - along);
      GLOBE_SKY.steam = 0.625 * (1 - 0.4 * along);
      GLOBE_SKY.clear = 0.241 * (1 - along);
    } else {
      const w = Math.min(1, (t - 107) / 4);
      era.set(0, 1, 1, w);
      GLOBE_SKY.warm = 0.0095 * (1 - w);
      GLOBE_SKY.steam = 0.397 * (1 - w);
      GLOBE_SKY.clear = 0.022 * (1 - w);
    }
  }

  function driveFilm(t: number) {
    const yaw = Math.max(0, 108 - t) * 2.6 * Math.PI / 180;
    const u = t <= 83.2 ? 0 : t >= 108 ? 1 : ((x: number) => x * x * (3 - 2 * x))(Math.min(1, (t - 83.2) / (108 - 83.2)));
    (window as unknown as { __inpage?: { setFilmDrive?: (yaw: number, radii: number, offset: number) => void } }).__inpage?.setFilmDrive?.(yaw, 4.5 + (3.7 - 4.5) * u, 0);
  }

  function setPlain(node: HTMLElement, text: string) {
    if (node.dataset.v === text) return;
    node.dataset.v = text;
    node.classList.remove('roll');
    node.textContent = text;
  }

  function setRolling(node: HTMLElement, text: string) {
    if (node.dataset.v === text) return;
    node.dataset.v = text;
    node.replaceChildren();
    let i = 0;
    for (const ch of text) {
      const s = document.createElement('span');
      s.textContent = ch;
      if (ch.trim()) { s.className = 'd'; s.style.animationDelay = `${i * 0.035}s`; i++; }
      node.append(s);
    }
    node.classList.remove('roll');
    void node.offsetWidth;
    node.classList.add('roll');
  }

  function paintPlate(bang: number | null, dissolve: number) {
    const w = plate.clientWidth || window.innerWidth, h = plate.clientHeight || window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (plate.width !== Math.floor(w * dpr) || plate.height !== Math.floor(h * dpr)) { plate.width = Math.floor(w * dpr); plate.height = Math.floor(h * dpr); }
    const ctx = plate.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, w, h);
    if (bang == null || elapsed < bang + CINE.bangPeak - 0.05) return;
    const amount = bangFlash(elapsed, bang - CINE.b2, reduced);
    if (amount > 0) {
      ctx.globalCompositeOperation = 'lighter';
      const cx = w / 2, cy = h / 2, reach = Math.hypot(w, h) / 2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach);
      for (const u of [0, 0.35, 0.7, 1]) {
        const luma = flashLuma(u, u * 0.15, amount);
        grad.addColorStop(u, `rgba(255,${Math.round(246 - u * 36)},${Math.round(214 - u * 70)},${luma})`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
    const since = elapsed - bang - CINE.bangPeak;
    if (!reduced && shellOnScreen(since)) {
      const rad = shellRadius(since);
      ctx.globalCompositeOperation = 'source-over';
      const corner = Math.hypot(w, h) / 2;
      const R = (rad / 1.41) * corner;
      ctx.beginPath(); ctx.arc(w / 2, h / 2, R, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,214,160,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(w / 2, h / 2, R + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150,210,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    if (dissolve > 0) {
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * Math.PI * 2 + elapsed;
        const dist = dissolve * Math.min(w, h) * (0.15 + (i % 5) * 0.04);
        const x = w / 2 + Math.cos(a) * dist, y = h * 0.46 + Math.sin(a) * dist * 0.55;
        ctx.fillStyle = `rgba(255,226,180,${1 - dissolve})`;
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    paintEarth(ctx, w, h);
  }

  function paintEarth(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const pad = 40, vh = Math.max(1, h - pad * 2);
    const cx = w / 2, cy = pad + vh * 0.6, R = vh * 0.3;
    if (elapsed >= CINE.b10End && elapsed < 89.2) {
      const halo = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.22);
      halo.addColorStop(0, 'rgba(255,120,30,0)');
      halo.addColorStop(0.55, 'rgba(255,100,24,0.22)');
      halo.addColorStop(1, 'rgba(255,80,16,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2); ctx.fill();
    }
    const hit = elapsed - 87.2;
    if (hit >= 0 && hit <= 2.2) {
      const u = hit / 3.2;
      const ang = -0.7;
      const hx = cx + Math.cos(ang) * R * 0.55;
      const hy = cy + Math.sin(ang) * R * 0.2;
      const approach = Math.max(0, 1 - u / 0.58);
      const tx = hx - approach * R * 1.35;
      const ty = hy - approach * R * 0.85;
      if (approach > 0.04) {
        const tr = R * 0.4;
        const body = ctx.createRadialGradient(tx, ty, tr * 0.15, tx, ty, tr);
        body.addColorStop(0, 'rgba(255,214,160,0.95)');
        body.addColorStop(0.45, 'rgba(176,52,16,0.85)');
        body.addColorStop(1, 'rgba(70,16,6,0)');
        ctx.fillStyle = body;
        ctx.beginPath(); ctx.arc(tx, ty, tr, 0, Math.PI * 2); ctx.fill();
      }
      const flash = Math.exp(-(((u - 0.42) / 0.09) ** 2));
      if (flash > 0.03) {
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * (0.12 + flash * 0.42));
        g.addColorStop(0, `rgba(255,248,230,${flash})`);
        g.addColorStop(0.22, `rgba(255,170,50,${flash * 0.75})`);
        g.addColorStop(1, 'rgba(255,70,16,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      const spray = Math.min(1, Math.max(0, (elapsed - 87.9) / 1.3));
      if (spray > 0) {
        const arcR = R * 1.15;
        for (let i = 0; i < 36; i++) {
          const a = -1.1 + (i / 35) * 1.95;
          const ex = cx + Math.cos(a) * arcR;
          const ey = cy + Math.sin(a) * arcR;
          const mx = (hx + ex) / 2 + Math.cos(a) * R * 0.42;
          const my = (hy + ey) / 2 + Math.sin(a) * R * 0.22;
          const p = Math.min(1, spray * (0.72 + ((i * 5) % 7) / 18));
          const o = 1 - p;
          const x = o * o * hx + 2 * o * p * mx + p * p * ex;
          const y = o * o * hy + 2 * o * p * my + p * p * ey;
          ctx.fillStyle = `rgba(255,${170 - (i % 5) * 12},60,${0.35 + p * 0.55})`;
          ctx.beginPath();
          ctx.arc(x, y, 1.3 + (i % 3) * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (elapsed >= 89.2 && elapsed < CINE.b11End) {
      const after = (elapsed - 89.2) / (CINE.b11End - 89.2);
      const arcR = R * (1.08 + after * 0.42);
      ctx.strokeStyle = `rgba(255,140,40,${Math.min(1, after / 0.55) * (0.18 + after * 0.22)})`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, -1.1, 0.85);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,210,120,${Math.min(1, after / 0.55) * (0.45 + after * 0.4)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, arcR, -1.1, 0.85);
      ctx.stroke();
      for (let i = 0; i < 22; i++) {
        const a = -1.1 + (i / 21) * 1.95;
        const rr = arcR + Math.sin(i * 2.1) * R * 0.06;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        ctx.fillStyle = `rgba(255,190,80,${0.35 + after * 0.45})`;
        ctx.beginPath(); ctx.arc(px, py, 1.5 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
      if (after > 0.28) {
        const m = (after - 0.28) / 0.72;
        const ang = -0.35 + m * 1.15;
        const dist = R * (1.45 + m * 0.2);
        const mx = cx + Math.cos(ang) * dist;
        const my = cy + Math.sin(ang) * dist * 0.72;
        const mr = R * 0.07 * (0.55 + m);
        const moon = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 2.2);
        moon.addColorStop(0, `rgba(255,236,210,${0.5 + m * 0.5})`);
        moon.addColorStop(0.45, `rgba(180,160,140,${0.45 + m * 0.35})`);
        moon.addColorStop(1, 'rgba(180,160,140,0)');
        ctx.fillStyle = moon;
        ctx.beginPath(); ctx.arc(mx, my, mr * 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (elapsed >= 83.2 && elapsed < CINE.b14End) {
      const yaw = Math.max(0, 108 - elapsed) * 2.6 * Math.PI / 180;
      const drift = yaw * Math.min(w, h) * 0.42;
      const guard = Math.min(w, h) * 0.34;
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 97) % 1000) / 1000;
        const sy = ((i * 53) % 1000) / 1000;
        const x = (sx * w + drift * (0.25 + (i % 5) * 0.16)) % w;
        const y = sy * h;
        const dx = x - w / 2, dy = y - h * 0.48;
        if (dx * dx + dy * dy < guard * guard) continue;
        ctx.fillStyle = `rgba(255,246,224,${0.45 + (i % 4) * 0.14})`;
        const s = i % 9 === 0 ? 2.2 : 1.2;
        ctx.fillRect(x, y, s, s);
      }
    }
    if (elapsed >= CINE.b11End && elapsed < CINE.b12End) {
      const u = (elapsed - CINE.b11End) / (CINE.b12End - CINE.b11End);
      const haze = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.35);
      haze.addColorStop(0, `rgba(230,226,220,${0.02 + u * 0.05})`);
      haze.addColorStop(0.6, `rgba(210,206,200,${0.08 + u * 0.12})`);
      haze.addColorStop(1, 'rgba(210,206,200,0)');
      ctx.fillStyle = haze;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2); ctx.fill();
    }
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
