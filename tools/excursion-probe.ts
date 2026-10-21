import { quadrupedPose, gaitFor, WOLF_LEGS } from '../src/core/animalBehavior';
const v = Number(process.argv[2] ?? 6), g = gaitFor('run', v, WOLF_LEGS, 'gallop')!;
const ex = [0,1,2,3].map(() => [Infinity, -Infinity]); let bob = [Infinity,-Infinity], pitch=[Infinity,-Infinity];
for (let k = 0; k < 400; k++) { const p = quadrupedPose('run', k / 400, 0, WOLF_LEGS, v, 'gallop');
  p.feet.forEach((f, i) => { const j = p.joints[i], a = Math.atan2(-(f.z - j.z), j.y - f.y) * 180 / Math.PI; ex[i][0] = Math.min(ex[i][0], a); ex[i][1] = Math.max(ex[i][1], a); });
  bob = [Math.min(bob[0], p.bob), Math.max(bob[1], p.bob)]; pitch=[Math.min(pitch[0],p.pitch),Math.max(pitch[1],p.pitch)]; }
console.log(JSON.stringify({ v, hz: +(v / g.cycle).toFixed(2), stride: +g.cycle.toFixed(2), duty: +g.duty.toFixed(3), excursionDeg: ex.map(([a, b]) => [+a.toFixed(0), +b.toFixed(0), +(b - a).toFixed(0)]), bob: bob.map(x=>+x.toFixed(3)), pitchDeg: pitch.map(x=>+(x*57.3).toFixed(1)) }));
