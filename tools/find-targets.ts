import { dryStart } from '../src/core/stages/surfaceAt';
import { STAGES } from '../src/core/stages/elevation';
STAGES.on = process.argv[2] !== '0';
import { generateChunk, heightAt, isDryLand } from '../src/core/world';
import { applyPopulation } from '../src/core/population';
const want = ['plant', 'forage', 'deer', 'rock', 'person'], found: Record<string, any[]> = {};
const [ox, oz] = process.argv[3] ? process.argv[3].split(',').map(Number) : dryStart(0, 0), C = 40;
for (let cx = Math.floor(ox / C) - 2; cx <= Math.floor(ox / C) + 2; cx++) for (let cz = Math.floor(oz / C) - 2; cz <= Math.floor(oz / C) + 2; cz++) {
  for (const e of applyPopulation(generateChunk(cx, cz), cx, cz)) if (want.includes(e.kind) && isDryLand(e.x, e.z)) (found[e.kind] ??= []).push({ x: +e.x.toFixed(2), z: +e.z.toFixed(2), key: e.key, d: +Math.hypot(e.x - ox, e.z - oz).toFixed(1) });
}
for (const k of want) console.log(k, JSON.stringify((found[k] ?? []).sort((a, b) => a.d - b.d).slice(0, 4)));console.log('origin', ox, oz);
