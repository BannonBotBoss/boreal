/**
 * Pad target registry (Grok Bot): systems owned elsewhere (the globe camera, the camera panel, the game) register a small
 * set of verbs here with ONE hook line; the pad router (input/padRouter) drives them. Nothing registered = a stub.
 */
export interface GlobeTarget { orbit(dx: number, dy: number): void; zoom(f: number): void; turn(d: number): void; home(): void; land(): void; active(): boolean; axis?(): { on: boolean; toggle(v?: boolean): void; aim(dLat: number, dLon: number): void; move(f: number): void } }
export interface GameTarget { act(id: string): void; mode(): 'play' | 'globe'; notice?(t: string): void }
interface Targets { globe?: GlobeTarget; game?: GameTarget }
const T: Targets = {};
export function registerPadTarget<K extends keyof Targets>(k: K, t: Targets[K]) { T[k] = t; return () => { if (T[k] === t) delete T[k]; }; }
export const padTarget = <K extends keyof Targets>(k: K): Targets[K] => T[k];
