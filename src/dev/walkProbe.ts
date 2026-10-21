/**
 * ?walkprobe (Grok Bot, walk diagnosis): records what is drawn each frame (rendered body and camera, gait phase) and every
 * player footstep sound request, for tools/walk-probe.mjs. Off without the flag; nothing is saved.
 */
import type * as THREE from 'three';
export const WALK_PROBE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('walkprobe');
export interface WalkSample { t: number; sim: number; bx: number; by: number; bz: number; cx: number; cy: number; cz: number; phase: number; gait?: string; speed: number; cost: number }
export function installWalkProbe(player: () => THREE.Object3D | undefined, camera: THREE.Camera, sound: { playAt: (id: string, ...rest: never[]) => void }) {
  const frames: WalkSample[] = [], steps: { t: number; id: string; rate?: number; level?: number }[] = [];
  const play = sound.playAt.bind(sound) as (id: string, ...rest: unknown[]) => void;
  (sound as { playAt: unknown }).playAt = (id: string, ...rest: unknown[]) => { if (id.startsWith('paw-')) steps.push({ t: performance.now(), id, level: rest[1] as number }); play(id, ...rest); };
  let tilt: THREE.Object3D | undefined;
  const v = { x: 0, y: 0, z: 0 } as THREE.Vector3;
  (window as unknown as { walkProbe: unknown }).walkProbe = { frames, steps, clear: () => { frames.length = 0; steps.length = 0; } };
  return (sim: number, brain: { phase: number; gaitName?: string; gaitSpeed: number }, cost: number) => {
    const root = player(); if (tilt?.parent !== root) tilt = root?.getObjectByName('tilt'); if (!tilt) return;
    tilt.updateWorldMatrix(true, false); const e = tilt.matrixWorld.elements; v.x = e[12]; v.y = e[13]; v.z = e[14];
    frames.push({ t: performance.now(), sim, bx: v.x, by: v.y, bz: v.z, cx: camera.position.x, cy: camera.position.y, cz: camera.position.z, phase: brain.phase, gait: brain.gaitName, speed: brain.gaitSpeed, cost });
    if (frames.length > 20000) frames.splice(0, 10000);
  };
}
