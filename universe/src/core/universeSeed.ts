/**
 * Universe seed for Generate universe. Laws stay fixed; each Generate mints a new seed
 * so growth fields and particle noise differ. Child streams use Boreal's proc/rng.
 */
import { hash, stream } from '@boreal/proc/rng';

export const UNIVERSE_SEED_KEY = 'boreal.universe.app.seed.v1';

export function mintUniverseSeed(random = Math.random, now = Date.now): number {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const n = buf[0] >>> 0;
    return n === 0 ? 1 : n;
  } catch {
    const n = ((Math.floor(random() * 0x100000000) ^ (now() >>> 0)) >>> 0);
    return n === 0 ? 1 : n;
  }
}

export function normalizeUniverseSeed(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw) >>> 0 || 1;
}

export function worldSeedFromUniverse(universeSeed: number): number {
  const u = normalizeUniverseSeed(universeSeed) || 1;
  const n = hash(`world:${u}`);
  return n === 0 ? 1 : n;
}

export const universeStream = (universeSeed: number, label: string) =>
  stream(normalizeUniverseSeed(universeSeed) || 1, label);

export function readUniverseSeed(storage: Storage | null = defaultStorage()): number {
  if (!storage) return 0;
  try {
    return normalizeUniverseSeed(Number(storage.getItem(UNIVERSE_SEED_KEY)));
  } catch {
    return 0;
  }
}

export function writeUniverseSeed(seed: number, storage: Storage | null = defaultStorage()): void {
  const u = normalizeUniverseSeed(seed);
  if (!u || !storage) return;
  try {
    storage.setItem(UNIVERSE_SEED_KEY, String(u));
  } catch { /* blocked */ }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
