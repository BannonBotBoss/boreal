/**
 * Game wiring behind ?loco=1 (Grok Bot / Gait Builder). render/playables.ts asks `createLocoPlayer()` for the player
 * body only when the flag is in the URL; without it this module is imported but never called, so the game is unchanged.
 * The player body is the player wolf rig (render/playerWolf.ts, hooks 1+2). buildScene still places root at the player's
 * ground point and heading before animate(); we read them back, run the locomotion layer on the same terrain function
 * (core/world heightAt, clamped like buildScene) and hand the pose to the rig through hook 2.
 */
import { heightAt } from '../../core/world';
import type { AnimateFrame, PlayerRig } from '../../render/playables';
import { createLocomotion, type Locomotion } from './controller';
import { createPlayerWolf } from '../../render/playerWolf';
import type { LegLayout, TerrainFn, Touchdown } from './signals';

export const LOCO_FLAG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('loco');
/** Same ground the player stands on in buildScene.draw: max(heightAt, −0.2). */
export const gameGround: TerrainFn = (x, z) => Math.max(heightAt(x, z), -.2);
/** A jump in one frame larger than this (m) is a teleport (home button, ?at=, rewind): restart the feet there. */
const TELEPORT = 2;
const touchListeners = new Set<(t: Touchdown) => void>();
/** Player paw touchdowns under ?loco=1 (footstep audio etc.); survives the controller restarting on a teleport. Returns unsubscribe. */
export function onPlayerTouchdown(fn: (t: Touchdown) => void): () => void { touchListeners.add(fn); return () => { touchListeners.delete(fn); }; }

export function createLocoPlayer(): PlayerRig {
  const w = createPlayerWolf();
  const layout: LegLayout = { legs: w.loco.legs, hips: w.loco.chains.map(c => c.hipXZ) };
  let loco: Locomotion | undefined, last = { x: NaN, z: NaN }, wasJumping = false;
  return {
    root: w.root, brain: w.brain, sensor: w.sensor,
    animate(f: AnimateFrame) {
      const r = w.root, b = w.brain, x = r.position.x, z = r.position.z, heading = r.rotation.y;
      if (!loco || !(Math.hypot(x - last.x, z - last.z) < TELEPORT)) loco = createLocomotion(layout, gameGround, { x, z, heading });
      last = { x, z };
      const speed = b.motion === 'idle' ? 0 : (b.motion === 'back' ? -1 : 1) * b.gaitSpeed;
      // the brain's jump (main.ts: Space / X, launched at pounceSpeed) hands its intent (hook 3) to the layer on its first frame
      const jumping = b.motion === 'jump', intent = jumping && !wasJumping ? (b.intent ?? { kind: 'pounce' as const }) : undefined; wasJumping = jumping;
      const pose = loco.update({ x, z, heading, speed, intent }, f.dt, 'near');
      for (const t of pose.touchdowns) touchListeners.forEach(fn => fn(t));
      w.animate(f.time, f.moving, f.action, f.elapsed, f.mode, f.push, pose);
    },
  };
}
