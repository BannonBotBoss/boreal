/**
 * The contest opening on the flat page. A bare load shows the hot sphere, the Rust
 * temperature cools it to deep blue-violet, and then the planet takes the screen.
 * Three.js only draws. The cycle is the same count the VR journey uses.
 */
import { latestPlanetSim, type PlanetSim } from '../../core/planetBudget';
import { sharedPlanetSim } from '../../core/planetWeather';
import { decodeEngineReport, type EngineReport } from '../../core/engineReport';
import { CosmosSphere, type SphereInputs } from './sphere';

/** Cycle 1 is the pink-white bath. Cycle 62 is the planet, same hand-off as the VR journey. */
export const OPENING = { from: 1, planetAt: 62, perSec: 2 } as const;

const HOT: SphereInputs = { a: 1e-40, h: 1, temperature: 1e22, rho: 1 };

export function stepOpening(cycle: number, dt: number, planetAt = OPENING.planetAt, perSec = OPENING.perSec) {
  const next = Math.min(planetAt, Math.max(OPENING.from, cycle) + Math.max(0, dt) * perSec);
  return { cycle: next, planet: next >= planetAt };
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
  stop(): void;
}

/** Full-screen sphere until the planet cycle. `onPlanet` is the existing globe entry. */
export function createOpening(onPlanet: () => void): Opening {
  const sphere = new CosmosSphere(document.body);
  sphere.setInputs(HOT);
  let cycle: number = OPENING.from;
  let phase: Opening['phase'] = 'sphere';
  let sim: PlanetSim | null = latestPlanetSim();
  let busy = false;
  const api: Opening = {
    get cycle() { return cycle; },
    get phase() { return phase; },
    step(dt: number) {
      if (phase === 'planet') return;
      const next = stepOpening(cycle, dt);
      cycle = next.cycle;
      if (next.planet) { finish(); return; }
      if (!busy) {
        busy = true;
        void paint().finally(() => { busy = false; });
      }
    },
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
    sphere.dispose();
    onPlanet();
  }
}
