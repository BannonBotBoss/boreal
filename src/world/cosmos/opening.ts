/**
 * The contest opening on the flat page. A bare load shows the hot sphere, the Rust
 * temperature cools it to deep blue-violet, and then the planet takes the screen.
 * Three.js only draws. The cycle is the same count the VR journey uses.
 */
import { latestPlanetSim, type PlanetSim } from '../../core/planetBudget';
import { sharedPlanetSim } from '../../core/planetWeather';
import { decodeEngineReport, type EngineReport } from '../../core/engineReport';
import { CosmosSphere, type SphereInputs } from './sphere';

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
  skip(): void;
  stop(): void;
}

/** Full-screen sphere until the planet cycle. `onPlanet` is the existing globe entry. */
export function createOpening(onPlanet: () => void): Opening {
  const sphere = new CosmosSphere(document.body);
  sphere.setInputs(HOT);
  let elapsed = 0;
  let cycle: number = OPENING.from;
  let phase: Opening['phase'] = 'sphere';
  let sim: PlanetSim | null = latestPlanetSim();
  let busy = false;
  const hint = document.createElement('div');
  hint.textContent = 'Click, or pinch, to skip to the planet.';
  hint.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:26;color:#f4efe2;font:15px system-ui;pointer-events:none;text-shadow:0 1px 4px #000';
  document.body.appendChild(hint);
  const onPointer = (e: PointerEvent) => {
    const t = e.target;
    if (t instanceof Element && t.closest('button,a,input,textarea,select,dialog,#loading')) return;
    api.skip();
  };
  window.addEventListener('pointerdown', onPointer);
  const api: Opening = {
    get cycle() { return cycle; },
    get phase() { return phase; },
    step(dt: number) {
      if (phase === 'planet') return;
      elapsed += Math.max(0, dt);
      const next = openingCycle(elapsed);
      cycle = next.cycle;
      if (next.planet) { finish(); return; }
      if (!busy) {
        busy = true;
        void paint().finally(() => { busy = false; });
      }
    },
    skip() { finish(); },
    stop() { finish(); },
  };
  (window as unknown as { __borealOpening?: Opening }).__borealOpening = api;
  return api;

  async function paint() {
    sim ??= latestPlanetSim() ?? await sharedPlanetSim();
    if (phase === 'planet' || !sim) return;
    sim.setEngineCycle(cycle);
    const text = sim.engineReport();
    sphere.setInputs(text ? sphereInputs(decodeEngineReport(text)) : HOT);
  }

  function finish() {
    if (phase === 'planet') return;
    phase = 'planet';
    window.removeEventListener('pointerdown', onPointer);
    hint.remove();
    sphere.dispose();
    onPlanet();
  }
}
