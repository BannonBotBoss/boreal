/**
 * T-0006 bench (budget: <= 0.01 ms per log begin at chunk build). Method: in node (npx tsx tools/bench-contacts.ts [N]),
 * N seeded log contacts (keys and positions of generateChunk's logs over a block of chunks, padded with seeded keys),
 * timed with performance.now(), best of 5: (1) N begin calls on a fresh bus with one no-op listener, (2) the same with a
 * listener that runs solidContact on an empty context (the generated-only path; main.ts even skips that), (3) logContact's
 * two extra heightAt samples (the ground read used until T-0005's seatLog supplies { at, normal }).
 */
import { createContactBus, type Contact } from '../src/core/contactBus';
import { createContext, solidContact } from '../src/core/events';
import { generateChunk, heightAt } from '../src/core/world';
const N = Number(process.argv[2] ?? 1000);
const logs = [] as { key: string; x: number; z: number }[];
for (let cx = -8; cx < 8 && logs.length < N; cx++) for (let cz = -8; cz < 8 && logs.length < N; cz++) for (const e of generateChunk(cx, cz)) if (e.kind === 'log') logs.push(e);
const real = Math.min(N, logs.length);
for (let i = logs.length; i < N; i++) logs.push({ key: `bench:${i}`, x: i * .37, z: -i * .23 });
const use = logs.slice(0, N);
const contacts: Contact[] = use.map(e => ({ a: e.key, b: 'ground', at: [e.x, 0, e.z], normal: [0, 1, 0], kind: 'solid-solid', source: 'chunk-build:log' }));
const best = (fn: () => void) => { let b = Infinity; for (let r = 0; r < 5; r++) { const t = performance.now(); fn(); b = Math.min(b, performance.now() - t); } return b; };
const ctx = createContext();
const begin = best(() => { const bus = createContactBus(); bus.onContact(() => {}); for (const c of contacts) bus.begin(c); });
const withTx = best(() => { const bus = createContactBus(); bus.onContact(c => { solidContact(ctx, c); }); for (const c of contacts) bus.begin(c); });
const ground = best(() => { let s = 0; for (const e of use) s += heightAt(e.x + .5, e.z) + heightAt(e.x, e.z + .5); if (!Number.isFinite(s)) throw new Error('nan'); });
const per = (ms: number) => (ms / N * 1000).toFixed(2) + ' us/log';
console.log(`N=${N} (${real} real generated logs)`);
console.log(`begin only:             ${begin.toFixed(3)} ms total, ${per(begin)}`);
console.log(`begin + solidContact:   ${withTx.toFixed(3)} ms total, ${per(withTx)}`);
console.log(`logContact ground read: ${ground.toFixed(3)} ms total, ${per(ground)} (2 heightAt; seatLog's values replace it with T-0005)`);
console.log(`budget 10 us/log (begin + solidContact): ${withTx / N <= .01 ? 'PASS' : 'FAIL'}`);
