/**
 * Universe seed for "Generate universe" (v2 menu). Laws stay fixed; each Generate mints a new
 * seed so growth fields, particle noise, and the eventual living world differ. Child streams use
 * the same hash RNG as the rest of the game (proc/rng).
 */
import { hash, stream } from '../proc/rng';

export const UNIVERSE_SEED_KEY = 'boreal.universe.seed.v1';
/** Terrain / stages seed still written to the existing key so globe and ground keep working. */
export const WORLD_SEED_KEY = 'boreal.seed.v1';

/** Mint a non-zero u32. Prefer crypto; fall back to time+Math.random when crypto is missing. */
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

/** Clamp a user/URL value to a usable u32 seed (0 means “mint me”). */
export function normalizeUniverseSeed(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.floor(raw) >>> 0 || 1;
}

/** Living-world / staged terrain seed derived from the universe seed (stable for a given universe). */
export function worldSeedFromUniverse(universeSeed: number): number {
  const u = normalizeUniverseSeed(universeSeed) || 1;
  const n = hash(`world:${u}`);
  return n === 0 ? 1 : n;
}

/** Named child stream for later cosmic subsystems (dark-ages grid, ionization, …). */
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
    storage.setItem(WORLD_SEED_KEY, String(worldSeedFromUniverse(u)));
  } catch { /* blocked */ }
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
