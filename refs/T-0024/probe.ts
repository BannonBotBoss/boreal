import { STAGES } from '../../src/core/stages/elevation';
import { heightAt } from '../../src/core/world';
import { LEVEL } from '../../src/core/tuning';
import { sampleSurface } from '../../src/core/waterWake';

STAGES.on = true;
STAGES.seed = 1400;
const rows: { x: number; z: number; ground: number; water?: number }[] = [];
for (let x = -40; x <= 80; x += 10) for (let z = -40; z <= 40; z += 10) {
  const s = sampleSurface(x, z);
  if (s.water !== undefined && s.ground < (s.water as number) - 0.02) rows.push({ x, z, ground: +s.ground.toFixed(3), water: +s.water.toFixed(3) });
}
const at = sampleSurface(30, 0);
const shore = [];
for (let x = 12; x <= 30; x += 2) for (let z = -20; z <= 10; z += 2) {
  const s = sampleSurface(x, z);
  const wet = s.water !== undefined && s.ground < s.water - 0.02;
  if (!wet) continue;
  const n = sampleSurface(x + 4, z);
  const dry = n.water === undefined || n.ground > (n.water ?? 0);
  if (dry) shore.push({ x, z, ground: +s.ground.toFixed(2), dryX: x + 4, dryH: +n.ground.toFixed(2) });
}
console.log(JSON.stringify({
  level: LEVEL.waterSurface,
  at30: { h: +heightAt(30, 0).toFixed(3), ground: +at.ground.toFixed(3), water: at.water },
  wetN: rows.length,
  shore: shore.slice(0, 12),
}, null, 2));
