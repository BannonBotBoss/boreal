/**
 * Why a drop from the planet was landing on an empty black plane (issue #291, live check).
 *
 * The seated fall is a 14 s ease. The frame clock was capped at 0.1 s, so a slow frame
 * (software GL) advanced the fall by a tenth of a second and the black part of the drop
 * ran for minutes. G then waited on that same capped clock. When the wait expired, the
 * patch was marked ready even though the chunks were still queued, chunk jobs lost their
 * place in line, and flora (priority −1) ran instead. Walking never brought the ground in.
 * The drone height also stayed on the streaming call after the wolf was back, so the disc
 * stayed the glide disc.
 */
import { DESCENT } from './flight';

/** Wall seconds one frame may add to the seated drop. A multi-second software frame still
 *  moves the ease, so the vacuum-skipped fall can finish inside about 20 s. */
export const DESCENT_FRAME_CAP = 3;

export function descentFrameDt(wallSec: number, cap = DESCENT_FRAME_CAP) {
  if (!(wallSec > 0)) return 0;
  return Math.min(cap, wallSec);
}

/** How many 1 s frames the orbit-to-glide ease takes when each frame is capped. The old 0.1 s cap took about 140. */
export function descentFramesAt(frameSec: number, sec = DESCENT.sec, cap = DESCENT_FRAME_CAP) {
  const step = descentFrameDt(frameSec, cap);
  if (!(step > 0)) return Infinity;
  return Math.ceil(sec / step);
}

/**
 * Altitude the chunk disc is built from. Drone height counts only while the drop still owns
 * the camera. Afterwards the walk uses the eye height, or a leftover glide height keeps the wide disc.
 */
export function streamAltitude(playAlt: number, droneAlt: number, inFlight: boolean) {
  if (!inFlight) return playAlt;
  return Math.max(playAlt, Number.isFinite(droneAlt) ? droneAlt : 0);
}

/** Chunk radius (chunks) for an altitude. Above 85 m the disc opens toward the ground in view, capped at 360 m. */
export function chunkRadius(altitude: number, mid: number, chunk: number) {
  const viewM = altitude > 85 ? Math.min(360, altitude * Math.tan(24 * Math.PI / 180)) : 0;
  const reach = Math.max(altitude > 85 ? mid * 1.5 : mid, viewM);
  return Math.ceil(reach / Math.max(chunk, 1));
}

/**
 * The landing ring is ready only when every cell is in the scene and none of those jobs are still queued.
 * A cell that was never started is not ready: `pending` is false for those too.
 */
export function landingPatchReady(
  cx: number, cz: number, ring: number,
  pending: (key: string) => boolean,
  built: (a: number, b: number) => boolean,
) {
  for (let a = cx - ring; a <= cx + ring; a++) for (let b = cz - ring; b <= cz + ring; b++) {
    if (pending(`chunk:${a}:${b}`) || !built(a, b)) return false;
  }
  return true;
}

/** Chunk jobs stay ahead of grass and flora until that ring is actually in the scene, including after G. */
export function landingChunkPriority(patchReady: boolean, dropStarted: boolean) {
  return dropStarted && !patchReady;
}

/** Milliseconds of chunk work per frame while the landing ring is still missing. Not shrunk by a slow draw.
 *  Large enough that the chunk under her can finish during the shortened fall. */
export const LANDING_JOB_MS = 160;

export function landingJobBudget(patchReady: boolean, dropStarted: boolean) {
  return landingChunkPriority(patchReady, dropStarted) ? LANDING_JOB_MS : undefined;
}

/** G becomes the wolf only when her own chunk is already in the scene. */
export function canEmbody(centreBuilt: boolean, asked: boolean) {
  return asked && centreBuilt;
}
