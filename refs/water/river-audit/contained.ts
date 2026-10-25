// Share of river length whose water surface is NOT contained by its banks: 1 m beyond the drawn sheet (half + bank + 1 m),
// on either side, the ground is lower than the river surface, so the sheet ends in an edge standing above dry ground.
// Sampled at the midpoint of every drawn D8 segment. npx tsx refs/water/river-audit/contained.ts
import { riverContainment } from '../../../src/core/stages/riverContain';

console.log(JSON.stringify(riverContainment(), null, 1));
