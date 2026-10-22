/**
 * T-0036 capture-tuning sim: the headless core/sim hares (the same code animals/hare.ts renders) against a scripted
 * player wolf at 30 Hz. A "try" = one chase: from the bolt until a catch, the hare reaching safety, or 12 s of sprint.
 * Player styles: skilled = stalk in super-stealth, sprint on the bolt, steer (keys: 2.2 rad/s, main.ts), pounce at 3 m;
 * naive = walk straight in, sprint late, slow keyboard steering, pounce only at contact range.
 */
import { createAnimal, createWorld, nearbyAnimals, takeEvents, tick } from '../src/core/sim';
import { playerSpeed, pounceSpeed } from '../src/core/playerTuning';
import { WOLF_NEEDS } from '../src/core/needs/species';
import { stepForward } from '../src/proc/math';
export interface Style { approach: 'super-stealth' | 'stealth' | 'walk'; reaction: number; turnRate: number; pounceAt: number }
export const STYLES: Record<string, Style> = {
  skilled: { approach: 'super-stealth', reaction: .2, turnRate: 2.2, pounceAt: 3 },
  average: { approach: 'stealth', reaction: .3, turnRate: 2.2, pounceAt: 3 },
  naive: { approach: 'walk', reaction: .45, turnRate: 2.2, pounceAt: 1.6 },
};
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
export function simulateHunt(style: Style, tries: number, startX = 0, startZ = 0, maxSeconds = 4000) {
  const world = createWorld({ seed: 7, daylight: () => .3 }), dt = world.step, wolf = createAnimal(world, 'wolf', { x: startX, z: startZ }, { controlled: true });
  const spawnF = (n: number) => { for (let i = 0; i < n; i++) { const a = world.time * 7.3 + i * 2.4, d = 18 + (i * 9 + world.time) % 27; createAnimal(world, 'hare', { x: x + Math.sin(a) * d, z: z + Math.cos(a) * d }); } };
  let x = startX as number, z = startZ as number, heading = 0, t = 0, chase = -1, sprintLeft = WOLF_NEEDS.stamina.sprintSeconds.v, jump = 0, cool = 0, target = -1;
  let caught = 0, escaped = 0, ambush = 0, rest = 0; const gaps: number[] = [], when: number[] = []; const lag: { t: number; x: number; z: number }[] = [];
  while (caught + escaped < tries && t < maxSeconds) {
    t += dt; const list = nearbyAnimals(world, x, z, 70, 'hare'); if (list.length < 5) spawnF(5 - list.length); let h = list.find(a => a.id === target);
    if (!h) { h = list.filter(a => a.state !== 'flee').sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0]; target = h?.id ?? -1; } // stalk the nearest calm one
    let mode: string = style.approach, speed = 0;
    rest = Math.max(0, rest - dt);
    if (h && !rest) {
      lag.push({ t, x: h.x, z: h.z }); while (lag.length > 1 && lag[1].t <= t - style.reaction) lag.shift(); const seen = lag[0]; // reaction delay
      const d = Math.hypot(h.x - x, h.z - z);
      if (h.state === 'flee' && chase < 0) { chase = t; gaps.push(d); }
      const chasing = chase >= 0;
      const want = Math.atan2(seen.x - x, seen.z - z) + Math.PI, turn = wrap(want - heading);
      if (chasing && sprintLeft > 0) { mode = 'sprint'; sprintLeft -= dt; } else if (chasing) mode = 'run';
      const grip = style.turnRate; // the game does not grip-limit the player's turns (camera yaw = heading)
      if (!jump) heading = wrap(heading + Math.max(-grip * dt, Math.min(grip * dt, turn)));
      speed = playerSpeed(mode as never);
      if (!jump && !cool && d < style.pounceAt && (chasing || d < 2.5)) jump = .85;
      if (jump) { speed = pounceSpeed(speed); jump = Math.max(0, jump - dt); if (!jump) cool = 1.5; } else cool = Math.max(0, cool - dt);
      if (chasing && (h.state !== 'flee' && d > 30 || t - chase > 12 + 3)) { escaped++; chase = -1; target = -1; rest = 20; sprintLeft = WOLF_NEEDS.stamina.sprintSeconds.v; }
    }
    ({ x, z } = stepForward(x, z, heading, speed, dt));
    Object.assign(wolf, { x, z, heading, mode, speed, crouched: mode.includes('stealth'), pouncing: jump > 0 });
    for (const h of world.animals) if (h.species === 'hare' && Math.hypot(h.x - x, h.z - z) > 70) h.alive = false;
    world.animals = world.animals.filter(a => a.alive);
    tick(world, dt);
    for (const ev of takeEvents(world)) if (ev.type === 'caught') { caught++; if (chase < 0) ambush++; else when.push(t - chase); chase = -1; target = -1; rest = 20; sprintLeft = WOLF_NEEDS.stamina.sprintSeconds.v; }
  }
  return { when: when.sort((a, b) => a - b), gap: gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length), ambush, caught, escaped, tries: caught + escaped, rate: caught / Math.max(1, caught + escaped), seconds: t };
}
