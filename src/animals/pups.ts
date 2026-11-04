/**
 * The mama's litter, drawn from the same rules as the Rust store.
 * They are born on the den ring and each frame walk toward the trail behind her.
 * The meshes are the wolf skin without the fur cards, scaled to a four-week pup.
 */
import * as THREE from 'three';
import { ageAfter, birthPlaces, followStep, growthStage, pupScale, stepHz, walkMps, type PupPlace } from '../core/litter';
import { livingRoster } from '../core/enterLiving';
import { forestLanding } from '../world/globe/forestLanding';
import { heightAt } from '../core/world';
import { createPlayerWolf } from '../render/playerWolf';

export interface LivePup extends PupPlace { handle: string; parent: string; stage: ReturnType<typeof growthStage> }

export function bornLitter(): LivePup[] {
  const roster = livingRoster();
  const mama = roster.find(a => a.species === 'wolf' && a.territory === a.handle) ?? roster.find(a => a.species === 'wolf');
  const den = forestLanding(mama ? { x: mama.x, z: mama.z } : { x: 0, z: 0 }).den;
  return birthPlaces(den.x, den.z).map(p => ({
    ...p,
    handle: `pup:${p.slot}`,
    parent: mama?.handle ?? '0',
    stage: growthStage(p.ageYears),
  }));
}

export function createLitter(scene: THREE.Scene) {
  let rows: { pup: LivePup; holder: THREE.Group; wolf: ReturnType<typeof createPlayerWolf> }[] | null = null;
  let yaw = 0;
  let clock = 0;
  const ensure = () => {
    if (rows) return rows;
    rows = bornLitter().map(p => {
      const wolf = createPlayerWolf(1400 + p.slot, { fur: false });
      const holder = new THREE.Group();
      holder.name = p.handle;
      holder.scale.setScalar(pupScale(p.ageYears));
      holder.add(wolf.root);
      scene.add(holder);
      return { pup: p, holder, wolf };
    });
    return rows;
  };
  const publish = () => {
    if (!rows) return;
    (window as unknown as { __borealPups?: LivePup[] }).__borealPups = rows.map(w => ({ ...w.pup }));
  };
  return {
    pups: () => ensure().map(w => w.pup),
    step(dt: number, gameSeconds: number, motherX: number, motherZ: number, motherYaw: number) {
      yaw = motherYaw;
      clock += Math.max(0, dt);
      for (const row of ensure()) {
        row.pup.ageYears = ageAfter(row.pup.ageYears, gameSeconds);
        row.pup.stage = growthStage(row.pup.ageYears);
        row.holder.scale.setScalar(pupScale(row.pup.ageYears));
        const prevX = row.pup.x, prevZ = row.pup.z;
        const next = followStep(row.pup.x, row.pup.z, row.pup.slot, motherX, motherZ, motherYaw, dt, row.pup.ageYears);
        row.pup.x = next.x;
        row.pup.z = next.z;
        const moved = Math.hypot(next.x - prevX, next.z - prevZ) > 1e-4;
        const speed = walkMps(row.pup.ageYears);
        row.wolf.brain.motion = moved ? 'walk' : 'idle';
        row.wolf.brain.speed = moved ? speed : 0;
        row.wolf.brain.gaitSpeed = moved ? speed : 0;
        row.wolf.brain.prevPhase = row.wolf.brain.phase;
        row.wolf.brain.phase = (row.wolf.brain.phase + stepHz(row.pup.ageYears) * Math.max(0, dt)) % 1;
      }
      publish();
    },
    place() {
      if (!rows) return;
      for (const row of rows) {
        row.holder.position.set(row.pup.x, Math.max(heightAt(row.pup.x, row.pup.z), -0.2), row.pup.z);
        row.holder.rotation.y = yaw;
        row.wolf.animate(clock, row.wolf.brain.motion === 'walk', undefined, 0, 'walk');
      }
    },
  };
}
