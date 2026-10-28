/**
 * Sense pictures (T-0100). Matthew: the wolf's senses are a stream of simple pictures.
 * The strength of a signal is how solid the picture is. Each one bubbles up, drifts, and fades.
 * A picture is generic for that sense. A sound's category and a scent's source species are not drawn.
 * Issues #105 and #106. #106 wins the bytes. Hearing still arrives through createSoundCues.
 */
import { PERCEPTION, readSoundEntry, type HeardSound, type PerceptionFrame, type ScentVolume, type VisibleThing } from './perceptionBuffer';
import { THOUGHT_RULES } from './needs/thoughts';
import { SYSTEM_PROPERTIES } from '../config/systemProperties';

export type SensePictureKind = 'sound' | 'scent' | 'sight';

/**
 * Game calibration of the picture, not a wolf measurement.
 * life and fadeIn are the need-thought timings Matthew already set ("a second or two", a short fade-in).
 * The cap is the sound-entry cap in issue #106, so the stream cannot outgrow that block.
 * reemit is six panel refreshes: a steady signal keeps emitting, gently, and does not flood.
 * opacityFloor / opacityCeil: a faint signal stays just visible, a full one is nearly solid.
 */
export const SENSE_PICTURES = {
  opacityFloor: 0.18,
  opacityCeil: 0.94,
  life: THOUGHT_RULES.fade,
  fadeIn: THOUGHT_RULES.fadeIn,
  reemit: SYSTEM_PROPERTIES.senses.updateSeconds * 6,
  cap: PERCEPTION.caps.sound,
} as const;

export interface SenseSignal {
  key: string;
  kind: SensePictureKind;
  strength: number;
  bearing: number;
}
export interface SenseBubble {
  id: number;
  kind: SensePictureKind;
  strength: number;
  bearing: number;
  age: number;
}
export interface BubbleLook {
  opacity: number;
  /** 0 just born, 1 at the end of the rise. */
  rise: number;
  /** Negative is left, positive is right, including the outward drift. */
  side: number;
  /** Radians. The picture leans toward the side the signal comes from. */
  tilt: number;
  /** 1 ahead, -1 behind. */
  ahead: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

/** Peak opacity for a signal. Floating away multiplies this down to nothing. */
export function signalOpacity(strength: number): number {
  const s = clamp01(strength);
  return SENSE_PICTURES.opacityFloor + (SENSE_PICTURES.opacityCeil - SENSE_PICTURES.opacityFloor) * s;
}

export function bubbleLook(b: Pick<SenseBubble, 'id' | 'strength' | 'bearing' | 'age'>): BubbleLook | undefined {
  const life = SENSE_PICTURES.life;
  if (!(b.age >= 0) || b.age >= life || !(life > 0)) return undefined;
  const k = b.age / life;
  const fadeIn = Math.min(1, b.age / Math.max(1e-6, SENSE_PICTURES.fadeIn));
  const side = Math.sin(b.bearing);
  const wobble = Math.sin(b.age * 3 + b.id) * 0.06;
  return {
    opacity: signalOpacity(b.strength) * fadeIn * (1 - k),
    rise: Math.sqrt(k),
    side: side * (0.42 + 0.58 * k) + wobble,
    tilt: side * 0.4,
    ahead: Math.cos(b.bearing),
  };
}

function bearingOf(x: number, z: number): number {
  const horizontal = Math.hypot(x, z);
  return horizontal < 1e-4 ? 0 : Math.atan2(x, z);
}

/** One 28-byte sound entry. Category is not copied onto the picture. */
export function signalFromSound(entry: ArrayBuffer | ArrayBufferView, key: string): SenseSignal | undefined {
  const sound = readSoundEntry(entry);
  if (!(sound.intensity > 0)) return undefined;
  return { key, kind: 'sound', strength: clamp01(sound.intensity), bearing: bearingOf(sound.directionX, sound.directionZ) };
}

/** A smell() hit. The caller passes a key with no species name. The hit's kind is not copied. */
export function signalFromScent(hit: { level: number; bearing: number }, key: string): SenseSignal | undefined {
  if (!key || !(hit.level > 0) || !Number.isFinite(hit.bearing)) return undefined;
  return { key, kind: 'scent', strength: clamp01(hit.level), bearing: hit.bearing };
}

/** Sight from perceive(), already a 0..1 level. The key must not name a species. */
export function signalFromSight(key: string, sight: number, bearing: number): SenseSignal | undefined {
  if (!key || !(sight > 0) || !Number.isFinite(bearing)) return undefined;
  return { key, kind: 'sight', strength: clamp01(sight), bearing };
}

function pushSound(out: SenseSignal[], sound: HeardSound, key: string) {
  if (!(sound.intensity > 0)) return;
  out.push({ key, kind: 'sound', strength: clamp01(sound.intensity), bearing: bearingOf(sound.directionX, sound.directionZ) });
}
function pushScent(out: SenseSignal[], scent: ScentVolume, key: string) {
  if (!(scent.strength > 0)) return;
  out.push({ key, kind: 'scent', strength: clamp01(scent.strength), bearing: bearingOf(scent.directionX, scent.directionZ) });
}
/** Salience is a picture strength only when the buffer already stored a 0..1 level. Other numbers are not rescaled. */
function pushSight(out: SenseSignal[], thing: VisibleThing, key: string) {
  if (!(thing.salience >= 0 && thing.salience <= 1)) return;
  out.push({ key, kind: 'sight', strength: thing.salience, bearing: bearingOf(thing.x, thing.z) });
}

/** Pictures from one perception block. Species ids and distances are not on the signal. */
export function signalsFromFrame(frame: PerceptionFrame): SenseSignal[] {
  const out: SenseSignal[] = [];
  frame.sounds.forEach((sound, i) => pushSound(out, sound, `sound:${i}`));
  frame.scents.forEach((scent, i) => pushScent(out, scent, `scent:${i}`));
  frame.visible.forEach((thing, i) => pushSight(out, thing, `sight:${i}`));
  return out;
}

export function createSenseStream() {
  let bubbles: SenseBubble[] = [];
  let nextId = 1;
  let time = 0;
  const last = new Map<string, number>();
  return {
    step(dt: number) {
      const d = Math.max(0, Number.isFinite(dt) ? dt : 0);
      time += d;
      for (const b of bubbles) b.age += d;
      bubbles = bubbles.filter(b => b.age < SENSE_PICTURES.life);
      if (last.size > 64) for (const [k, t] of last) if (time - t > SENSE_PICTURES.reemit) last.delete(k);
    },
    offer(signal: SenseSignal): boolean {
      if (!signal?.key || !(signal.strength > 0) || !Number.isFinite(signal.bearing)) return false;
      const prev = last.get(signal.key);
      if (prev !== undefined && time < prev + SENSE_PICTURES.reemit) return false;
      if (bubbles.length >= SENSE_PICTURES.cap) return false;
      last.set(signal.key, time);
      bubbles.push({ id: nextId++, kind: signal.kind, strength: clamp01(signal.strength), bearing: signal.bearing, age: 0 });
      return true;
    },
    list: () => bubbles as readonly SenseBubble[],
    clear() { bubbles = []; last.clear(); },
  };
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

/** Flat silhouettes. One per sense. No animal. Filled so the strength reads as solid or ghostly. */
export const SENSE_GLYPH: Record<SensePictureKind, string> = {
  sound: svg('<path fill="currentColor" d="M14 26h10l12-10v32L24 38H14z"/><path fill="currentColor" d="M42 22c7 5 7 15 0 20-2-4-3-7-3-10s1-6 3-10z"/><path fill="currentColor" opacity=".75" d="M50 14c10 8 10 28 0 36-3-7-5-12-5-18s2-11 5-18z"/>'),
  scent: svg('<path fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" d="M20 54q-14-12 0-24t0-20m12 44q-14-12 0-24t0-20m12 44q-14-12 0-24t0-20"/>'),
  sight: svg('<path fill="currentColor" fill-rule="evenodd" d="M6 32c8-14 44-14 52 0-8 14-44 14-52 0zm20 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0z"/>'),
};

export const SENSE_ARIA: Record<SensePictureKind, string> = {
  sound: 'sound',
  scent: 'scent',
  sight: 'sight',
};

/** Screenshot query `sensepic`. Not a sense, and play leaves it unset. */
export function demoSenseSignals(query: string | null): { signals: SenseSignal[]; once: boolean; replace: boolean } {
  if (!query) return { signals: [], once: false, replace: false };
  if (query.startsWith('once:')) {
    const strength = Number(query.slice(5));
    if (!(strength > 0)) return { signals: [], once: true, replace: true };
    return {
      signals: [{ key: 'demo-once', kind: 'sound', strength: Math.min(1, strength), bearing: 0.45 }],
      once: true,
      replace: true,
    };
  }
  const parts = query.split(',').map(s => Number(s.trim())).filter(n => n > 0);
  const kinds: SensePictureKind[] = ['sound', 'scent', 'sight'];
  const bearings = [-1.05, 0.12, 1.05];
  const signals = parts.map((strength, i) => ({
    key: `demo-${i}`,
    kind: kinds[i % 3],
    strength: Math.min(1, strength),
    bearing: bearings[i % 3],
  }));
  return { signals, once: false, replace: signals.length > 0 };
}
