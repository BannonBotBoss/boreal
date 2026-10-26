/**
 * Pad target registry (Grok Bot): systems owned elsewhere (the globe camera, the camera panel, the game) register a small
 * set of verbs here with ONE hook line; the pad router (input/padRouter) drives them. Nothing registered = a stub.
 */
export interface GlobeTarget { orbit(dx: number, dy: number): void; zoom(f: number): void; turn(d: number): void; home(): void; land(): void; active(): boolean; axis?(): { on: boolean; toggle(v?: boolean): void; aim(dLat: number, dLon: number): void; move(f: number): void; gas(v?: boolean): void; layers(v?: boolean): void; rt(v?: boolean): void; bodies(): void; parcels?(v?: boolean): void } }
/** Forest drone (inpage band): sticks and triggers, not the menu buttons. */
export interface DroneTarget { active(): boolean; move(forward: number, strafe: number): void; look(yaw: number, pitch: number): void; climb(v: number): void; embody(): void; cancel(): void }
export interface GameTarget { act(id: string): void; mode(): 'play' | 'globe'; notice?(t: string): void }
interface Targets { globe?: GlobeTarget; drone?: DroneTarget; game?: GameTarget }
const T: Targets = {};
export function registerPadTarget<K extends keyof Targets>(k: K, t: Targets[K]) { T[k] = t; return () => { if (T[k] === t) delete T[k]; }; }
export const padTarget = <K extends keyof Targets>(k: K): Targets[K] => T[k];
