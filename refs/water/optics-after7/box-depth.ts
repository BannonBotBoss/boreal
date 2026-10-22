// npx tsx refs/water/optics-after7/box-depth.ts : water depth under the T-0023 ruled box [300,262,900,285] in the noon-0 view
// (?at=30,0,1.571, wolf altitude 1.6, DEFAULT_PITCH; same camera as render/math positionCamera, fov 48, 1280x720).
import * as THREE from 'three';
import { heightAt } from '../../../src/core/world';
import { LEVEL } from '../../../src/core/tuning';
import { positionCamera } from '../../../src/render/math';
import { STAGES } from '../../../src/core/stages/elevation';
STAGES.on = true; // the app default (world.stagedTerrain.v2)
STAGES.on = true;
const cam = new THREE.PerspectiveCamera(48, 1280 / 720, .2, 700); positionCamera(cam, 30, 0, 1.6, 1.571);
const Y = LEVEL.waterSurface, rows: Record<string, unknown>[] = [];
for (const py of [262, 268, 274, 280, 285]) { const d: number[] = [], dist: number[] = [], cosA: number[] = [];
  for (let px = 300; px <= 900; px += 20) { const v = new THREE.Vector3(px / 640 - 1, 1 - py / 360, .5).unproject(cam).sub(cam.position).normalize();
    if (v.y >= 0) continue; const t = (Y - cam.position.y) / v.y, x = cam.position.x + v.x * t, z = cam.position.z + v.z * t;
    d.push(Y - heightAt(x, z)); dist.push(Math.hypot(x - cam.position.x, z - cam.position.z)); cosA.push(-v.y); }
  const q = (a: number[], f: number) => [...a].sort((p, r) => p - r)[Math.floor(f * (a.length - 1))];
  rows.push({ py, n: d.length, dist_med: +q(dist, .5).toFixed(1), depth_min: +q(d, 0).toFixed(2), depth_med: +q(d, .5).toFixed(2), depth_max: +q(d, 1).toFixed(2), dry: d.filter(v => v <= 0).length, cosAir_med: +q(cosA, .5).toFixed(3) }); }
console.log('camera', cam.position.toArray().map(v => +v.toFixed(2)), 'water', Y); console.table(rows);
