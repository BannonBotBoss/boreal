/**
 * The mama's litter, drawn from the same rules as the Rust store.
 * They stand on the trail beside her. A drop that leaves them behind puts them back on it.
 * The meshes are the wolf skin without the fur cards, scaled to a four-week pup.
 */
import * as THREE from 'three';
import { ageAfter, besideMother, followStep, growthStage, pupCall, pupGap, pupScale, PUP_VOICE, stepHz, walkMps, type PupCall, type PupPlace } from '../core/litter';
import { livingRoster } from '../core/enterLiving';
import { heightAt } from '../core/world';
import { createPlayerWolf } from '../render/playerWolf';

export interface LivePup extends PupPlace { handle: string; parent: string; stage: ReturnType<typeof growthStage> }
export interface PupMood { hungry: boolean; tired: boolean; nudge: boolean }
export interface PupHeard { slot: number; kind: PupCall; x: number; z: number; ageYears: number }

export function bornLitter(x = 0, z = 0, yaw = 0): LivePup[] {
  const roster = livingRoster();
  const mama = roster.find(a => a.species === 'wolf' && a.territory === a.handle) ?? roster.find(a => a.species === 'wolf');
  return besideMother(x, z, yaw).map(p => ({
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
  const nextVoice = new Map<number, number>();
  const ensure = (x: number, z: number, motherYaw: number) => {
    if (rows) return rows;
    rows = bornLitter(x, z, motherYaw).map(p => {
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
    pups: () => rows?.map(w => w.pup) ?? [],
    step(dt: number, gameSeconds: number, motherX: number, motherZ: number, motherYaw: number, mood: PupMood = { hungry: false, tired: false, nudge: false }): PupHeard[] {
      yaw = motherYaw;
      clock += Math.max(0, dt);
      const heard: PupHeard[] = [];
      const live = ensure(motherX, motherZ, motherYaw);
      let huffSlot = -1;
      if (mood.nudge) {
        let best: number = PUP_VOICE.nudgeM;
        for (const row of live) {
          const d = Math.hypot(row.pup.x - motherX, row.pup.z - motherZ);
          if (d <= best) { best = d; huffSlot = row.pup.slot; }
        }
      }
      for (const row of live) {
        row.pup.ageYears = ageAfter(row.pup.ageYears, gameSeconds);
        row.pup.stage = growthStage(row.pup.ageYears);
        row.holder.scale.setScalar(pupScale(row.pup.ageYears));
        const prevX = row.pup.x, prevZ = row.pup.z;
        const dist = Math.hypot(prevX - motherX, prevZ - motherZ);
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
        const kind = pupCall({ distM: dist, moving: moved, ageYears: row.pup.ageYears, hungry: mood.hungry, tired: mood.tired, nudged: row.pup.slot === huffSlot });
        const due = nextVoice.get(row.pup.slot) ?? row.pup.slot * 1.1;
        if (kind && clock >= due) {
          heard.push({ slot: row.pup.slot, kind, x: row.pup.x, z: row.pup.z, ageYears: row.pup.ageYears });
          nextVoice.set(row.pup.slot, clock + pupGap(kind));
        }
      }
      publish();
      return heard;
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
