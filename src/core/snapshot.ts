/**
 * Generic world snapshots (Grok Bot). Any system registers a source once (capture/restore of its own small state);
 * photo-mode rewind then records and replays every system the same way, without per-system code here.
 */
export interface SnapshotSource<T = unknown> { capture(): T; restore(state: T): void }
export type Snapshot = { time: number; parts: Record<string, unknown> };

/** Fixed-capacity ring buffer: pushing past capacity overwrites the oldest entry. Index 0 = oldest. */
export class SnapshotRing<T> {
  private items: T[] = []; private start = 0;
  constructor(readonly capacity: number) {}
  get size() { return this.items.length; }
  push(item: T) {
    if (this.items.length < this.capacity) this.items.push(item);
    else { this.items[this.start] = item; this.start = (this.start + 1) % this.capacity; }
  }
  at(index: number): T | undefined {
    if (index < 0 || index >= this.items.length) return undefined;
    return this.items[(this.start + index) % this.items.length];
  }
  clear() { this.items = []; this.start = 0; }
}

export function createSnapshotHub(capacity = 600) {
  const sources = new Map<string, SnapshotSource<any>>(), ring = new SnapshotRing<Snapshot>(capacity);
  let last = -Infinity;
  const capture = (time: number): Snapshot => ({ time, parts: Object.fromEntries([...sources].map(([k, s]) => [k, s.capture()])) });
  return {
    ring,
    register<T>(key: string, source: SnapshotSource<T>) { sources.set(key, source); },
    capture,
    restore(s: Snapshot) { for (const [k, v] of Object.entries(s.parts)) sources.get(k)?.restore(v); },
    /** Records at most every `interval` seconds of sim time; a backwards jump in time resets the history. */
    sample(time: number, interval = .1) {
      if (time < last) { ring.clear(); last = -Infinity; }
      if (time - last >= interval - 1e-6) { ring.push(capture(time)); last = time; }
    },
  };
}
export type SnapshotHub = ReturnType<typeof createSnapshotHub>;
