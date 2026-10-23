/**
 * Headless behaviour numbers for the 2026-10-23 06:20 PT loop.
 * Same modules the game calls: core/sim tick (hares) and deerHerd.shapeDeer.
 * Not a second model. Distances are metres, times are sim seconds.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnimalBrain } from '../../../src/core/animalBehavior.ts';
import { HERD, shapeDeer, type DeerView } from '../../../src/core/deerHerd.ts';
import { createAnimal, createWorld, takeEvents, tick } from '../../../src/core/sim/index.ts';
import { boltDistance } from '../../../src/core/needs/diet.ts';
import { HARE_NEEDS } from '../../../src/core/needs/species/index.ts';
import { stepForward } from '../../../src/proc/math.ts';

const dir = dirname(fileURLToPath(import.meta.url));

function wrap(a: number) { return Math.atan2(Math.sin(a), Math.cos(a)); }

function deerTrial(dist: number, seconds = 12) {
  const brain = new AnimalBrain(7);
  const me: DeerView = { key: `deer-${dist}`, x: 0, z: 0, brain };
  const rows: { t: number; posture: string; speed: number; motion: string; d: number }[] = [];
  let posture = '';
  const dt = 1 / 30;
  for (let i = 0, t = 0; t < seconds; i++, t += dt) {
    brain.sense({ x: me.x, y: 1.2, z: me.z }, [{ key: 'player', x: 0, y: 1, z: dist, kind: 'threat' }]);
    brain.decide({ x: me.x, y: 1.2, z: me.z }, dt);
    const next = shapeDeer(me, [me], dt);
    const n = stepForward(me.x, me.z, brain.heading, brain.speed, dt);
    me.x = n.x; me.z = n.z;
    const d = Math.hypot(me.x, me.z - dist);
    if (next !== posture || (rows.length && Math.abs(brain.speed - rows[rows.length - 1].speed) > 0.2)) {
      rows.push({ t: Math.round(t * 1000) / 1000, posture: next, speed: Math.round(brain.speed * 100) / 100, motion: brain.motion, d: Math.round(d * 100) / 100 });
      posture = next;
    }
  }
  return { dist, fleeSpeedCap: HERD.fleeSpeed, senseDrop: 24, rows };
}

function calmDeer(seconds = 45) {
  const brain = new AnimalBrain(3);
  const me: DeerView = { key: 'deer-calm', x: 0, z: 0, brain };
  const bouts: { posture: string; t0: number; t1: number }[] = [];
  let posture = '';
  let t0 = 0;
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) {
    brain.sense({ x: 0, y: 1.2, z: 0 }, []);
    brain.decide({ x: me.x, y: 1.2, z: me.z }, dt);
    const next = shapeDeer(me, [me], dt);
    const n = stepForward(me.x, me.z, brain.heading, brain.speed, dt);
    me.x = n.x; me.z = n.z;
    if (next !== posture) {
      if (posture) bouts.push({ posture, t0: Math.round(t0 * 100) / 100, t1: Math.round(t * 100) / 100 });
      posture = next; t0 = t;
    }
  }
  if (posture) bouts.push({ posture, t0: Math.round(t0 * 100) / 100, t1: seconds });
  return { grazeBand: HERD.graze, scanBand: HERD.scan, walkBand: HERD.walk, bouts };
}

function hareTrial(label: string, wolf: { x: number; z: number; speed: number; crouched?: boolean }, hareAt: { x: number; z: number }, seconds: number) {
  const w = createWorld({ seed: 1400, passable: () => true, daylight: () => 1, wind: () => ({ x: 0.2, z: 0.1 }), hour: () => 12 });
  const predator = createAnimal(w, 'wolf', { x: wolf.x, z: wolf.z }, { controlled: true });
  predator.speed = wolf.speed; predator.crouched = !!wolf.crouched; predator.mode = wolf.speed > 1.5 ? 'walk' : 'idle';
  const hare = createAnimal(w, 'hare', hareAt, { energy: 70 });
  const rows: { t: number; state: string; d: number; level: number; speed: number; timer: number }[] = [];
  let state = '';
  const dt = 1 / 30;
  for (let t = 0; t < seconds; t += dt) {
    tick(w, dt);
    takeEvents(w);
    const d = Math.hypot(hare.x - predator.x, hare.z - predator.z);
    if (hare.state !== state) {
      rows.push({
        t: Math.round(t * 1000) / 1000, state: hare.state, d: Math.round(d * 100) / 100,
        level: Math.round(hare.level * 1000) / 1000, speed: Math.round(hare.speed * 100) / 100,
        timer: Math.round(hare.timer * 1000) / 1000,
      });
      state = hare.state;
    }
  }
  return { label, rows };
}

const sp = HARE_NEEDS;
const fid = [0, 0.25, 0.5, 1].map(level => ({ level, m: Math.round(boltDistance(sp, level) * 1000) / 1000 }));

const out = {
  hareFlight: {
    publishedMeanM: 3.7,
    source: 'Emmel 2024, UMT MSc, Fig. 1, mean of 224 approaches (already HARE_NEEDS.behaviour.flight.distanceM)',
    boltDistance: fid,
    note: 'boltDistance = 3.7 * (0.5 + 1.5 * perception). Perception 1 bolts at 7.4 m.',
  },
  hareStillFar: hareTrial('wolf still at 15 m', { x: 0, z: 0, speed: 0 }, { x: 0, z: 15 }, 8),
  hareWalk15: hareTrial('wolf walk 2 m/s at 15 m', { x: 0, z: 0, speed: 2 }, { x: 0, z: 15 }, 8),
  hareStill3: hareTrial('wolf still at 3 m', { x: 0, z: 0, speed: 0 }, { x: 0, z: 3 }, 6),
  hareGraze: hareTrial('wolf 80 m still, graze cycle', { x: 0, z: 0, speed: 0 }, { x: 0, z: 80 }, 40),
  deer: {
    at40: deerTrial(40, 8),
    at20: deerTrial(20, 8),
    at8: deerTrial(8, 6),
    calm: calmDeer(40),
    publishedFid: {
      medianM: 69.1, rangeM: [0, 368.1],
      source: 'Blackwell, Seamans, DeVault, Lima, Pfeiffer, Fernandez-Juricic 2014, PLOS ONE 9(10):e109988, white-tailed deer FID to a vehicle, n=63 approaches, median 69.1 m',
    },
  },
};

writeFileSync(join(dir, 'measure.json'), JSON.stringify(out, null, 2));
console.log('hareWalk15', JSON.stringify(out.hareWalk15.rows));
console.log('hareStill3', JSON.stringify(out.hareStill3.rows));
console.log('hareStillFar', JSON.stringify(out.hareStillFar.rows));
console.log('graze states', out.hareGraze.rows.map(r => `${r.t}:${r.state}`).join(' '));
console.log('deer20', JSON.stringify(out.deer.at20.rows));
console.log('deer40', JSON.stringify(out.deer.at40.rows));
console.log('deer8', JSON.stringify(out.deer.at8.rows));
console.log('calm', out.deer.calm.bouts.map(b => `${b.posture} ${b.t1 - b.t0}`).join(' | '));
console.log('fid', JSON.stringify(fid));
void wrap;
