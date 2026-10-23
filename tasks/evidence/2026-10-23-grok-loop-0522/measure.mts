// Numeric checks beside the 05:22 PT frames. Not a gate by themselves.
import { gravity, jumpArc } from '../../../src/proc/physics.ts';
import { apexHeight } from '../../../src/animals/locomotion/jump.ts';
import { gaitPose } from '../../../src/core/animalBehavior.ts';
import { waterAt, nearestWater } from '../../../src/core/needs/water.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

STAGES.on = true;
const g = gravity();
const arc = jumpArc(40, 0.85, 1 / 240);
const bob = gaitPose('jump', 0, 0.85 * 0.5).bob;
const shore = { x: 200, z: 250 };
const drink = waterAt(shore.x, shore.z);
const near = nearestWater(shore.x, shore.z, 80);
const help = readFileSync(new URL('../../../src/main.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../../index.html', import.meta.url), 'utf8');
const sprintLine = help.split('\n').find(l => l.includes('1.5 seconds')) ?? '';
const notImpl = html.includes('collision, hunting, trading and construction are not implemented');
const out = {
  gravity: +g.toFixed(4),
  jumpArcApex: +arc.apex.toFixed(4),
  apexHeight: +apexHeight().toFixed(4),
  drawnBob: +bob.toFixed(4),
  waterAt_200_250: drink,
  nearestWater_200_250: near,
  sprintHelp: sprintLine.trim().slice(0, 240),
  librarySaysUnimplemented: notImpl,
};
const dir = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(dir, 'measure.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
