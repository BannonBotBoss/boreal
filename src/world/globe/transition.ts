/**
 * In-page globe <-> game transition: the pure core (Grok Bot). Step 2 of the AGENT-NOTES plan (2026-10-18 08:30 PT).
 * Not wired into main.ts / buildScene.ts yet; this file holds only what those touch points will call:
 *  - the flag (in-page vs the reload fallback),
 *  - the mode machine game <-> band <-> globe,
 *  - the frame mapping between game coordinates and the planet, with ONE constant height datum
 *    (inside the home region the globe surface is exactly PLANET.home.elevation + the game's height, planet.ts),
 *  - the patch fade (dither starts only once the chunks under the camera are ready; the globe stays opaque until then),
 *  - the governor hold for the whole descent (auto off, world knobs frozen),
 *  - mode-scoped input (only the active scene's keymap is live).
 * Lead decisions: the world clock keeps running on the globe; the player and animals are frozen there.
 */
import * as THREE from 'three';
import { PLANET, type Vec3 } from './planet';
import { HANDOFF } from './handoff';
import { figureRadius } from './figure';
import { ISO_BELOW_HORIZON } from './flight';
import { clamp, smoothstep } from '../../proc/math';

export const TRANSITION = {
  bandTop: HANDOFF.alt,           // m above ground: the game patch starts fading in below this (and is gone above it)
  fadeFull: 600,                  // m above ground: patch fully faded in
  handover: 60,                   // m above ground: the rig camera takes over (descent ends) [game calibration]
  datum: PLANET.home.elevation,   // m: globe height = game height + datum inside the home region (the one constant offset)
  blendSec: 1,                    // unused. One viewpoint, so the old 60 m blend of two cameras is a no-op (handoverBlend). The number stays; it is not applied.
};

export type TransitionMode = 'game' | 'band' | 'globe';
/** In-page camera elevation (radians, negative = below the horizon) by altitude (Matthew 2026-10-25: the view tilts toward
 *  the horizon as the straight-down descent gets low, instead of holding the old 45° glide). Straight down in orbit,
 *  log-smoothed so the tilt happens on the way into the forest and is level with the horizon at the floor. */
export const HORIZON_TILT = { highAlt: 3e5, floorAlt: 8, down: -Math.PI / 2 + .01, horizon: -0.18 };
/** In-page globe cloud clearing by altitude (T-0034): the 2.5 km cloud shell (atmosphere CLOUDS, 900 km cells) can sit over
 *  the whole home region, so diving in looked into a flat lit cloud top from ~300 km to the band (the 'blank plain'). The deck
 *  opens from 1500 km (orbit look kept) to none by 150 km (CLOUD_OPEN, T-0041), so the descent always sees the ground it lands on. */
/** T-0041: the in-page descent fades the cloud cover out between these altitudes (m), linearly in log altitude (a constant
 *  rate on the descent's near-exponential fall; a smoothstep peaks 1.5x steeper): about 1 s on the fastest recorded descent,
 *  < 2 % cover per 60 fps frame (< 4 % at 30 fps). A wider range (2500 -> 25 km) left a long uniform haze (T-0041 stills);
 *  T-0034's coverage-threshold switch snapped from solid cloud to clear ground in ~3 frames. The shader also lifts the threshold
 *  a little with the fade (atmosphere CLOUDS.clearLift), so the deck breaks up instead of thinning as one flat sheet. */
export const CLOUD_OPEN = { top: 1.5e6, bottom: 1.5e5 };
export const cloudClear = (alt: number) => Math.min(1, Math.max(0, Math.log(CLOUD_OPEN.top / Math.max(alt, 1)) / Math.log(CLOUD_OPEN.top / CLOUD_OPEN.bottom)));
/** Globe drag release coast (T-0043; Matthew 2026-10-22 23:37 PT: "allow it to continue rolling a bit, say, for 3 seconds"),
 *  run in globeView with three's frame-rate-independent MathUtils.damp (https://threejs.org/docs/#api/en/math/MathUtils.damp):
 *  the drag's rate falls to `rest` of the release speed at `sec` s, where the coast stops. While dragging, the rate is
 *  damp-smoothed with time constant `track` s (mouse events and frames do not line up). [game calibration: Matthew's 3 s] */
export const GLOBE_COAST = { sec: 3, rest: .02, track: .05 };
/** MathUtils.damp lambda (1/s) for the coast: e^(-lambda sec) = rest */
export const coastLambda = Math.log(1 / GLOBE_COAST.rest) / GLOBE_COAST.sec;
export function globePitch(alt: number) {
  const t = 1 - smoothstep(Math.log(HORIZON_TILT.floorAlt), Math.log(HORIZON_TILT.highAlt), Math.log(Math.max(alt, 1)));
  return HORIZON_TILT.down + (HORIZON_TILT.horizon - HORIZON_TILT.down) * t;
}
/** The drone keeps the isometric pitch the fall finished with. That aim looks into the ground in the last
 *  tens of metres. Open only the drawn pose toward the horizon between `high` and the floor. The stored
 *  stick pitch is unchanged, so the climb (`globePitch`) and a later stick input do not inherit this ease.
 *  100 m stays isometric. Roll stays 0 in viewpointPose. [game calibration] */
export const FLOOR_LOOK = { high: 48, low: HORIZON_TILT.floorAlt };
export function descentPitch(height: number, pitch: number) {
  const t = 1 - smoothstep(Math.log(FLOOR_LOOK.low), Math.log(FLOOR_LOOK.high), Math.log(Math.max(height, 1)));
  return pitch + (HORIZON_TILT.horizon - ISO_BELOW_HORIZON) * t;
}
/** In-page (the default since the r18 check) or the reload fallback. ?transition=reload | inpage forces it; low-memory
 *  machines (deviceMemory <= 4 GB) and probe caps of Low or worse always reload (inpage.ascend also falls back to the
 *  reload when the player or the probe has the game on Low or below at that moment). */
export function transitionPath(search: string, env: { deviceMemory?: number; probeCap?: number } = {}, fallbackDefault: 'inpage' | 'reload' = 'inpage') {
  const q = new URLSearchParams(search).get('transition');
  if (q === 'reload') return 'reload';
  if ((env.deviceMemory ?? 8) <= 4 || (env.probeCap ?? 0) >= 3) return 'reload';
  return q === 'inpage' ? 'inpage' : fallbackDefault;
}

type PlanetFrame = { home: Vec3; east: Vec3; north: Vec3; radius: number; fromLocal(x: number, z: number): Vec3 };
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Game point (x east, y up = game height, z south) -> planet-frame metres.
 *  The radius is the hydrostatic figure (figure.ts), the same surface the tiles use.
 *  The mean sphere sits kilometres off that figure, so a camera placed on it reads as too high
 *  and the descent never reaches the detail and near-split distances. East/north stay on the mean
 *  radius: that is the gnomonic scale planet.fromLocal already uses. */
export function gameToPlanet(p: PlanetFrame, x: number, y: number, z: number): Vec3 {
  const d = p.fromLocal(x, z), r = figureRadius(d) + TRANSITION.datum + y; return [d[0] * r, d[1] * r, d[2] * r];
}
/** Inverse of gameToPlanet (exact inverse of planet.fromLocal's projection). */
export function planetToGame(p: PlanetFrame, v: Vec3) {
  const len = Math.hypot(v[0], v[1], v[2]), c = dot(v, p.home) / len;
  const u: Vec3 = [v[0] / len, v[1] / len, v[2] / len];
  return { x: p.radius * dot(v, p.east) / len / c, y: len - figureRadius(u) - TRANSITION.datum, z: -p.radius * dot(v, p.north) / len / c };
}
/** Rotation taking game-frame vectors (x east, y up, z south) to planet-frame vectors at game point (x, z): home's
 *  east/north projected on the local tangent plane, the same convention as the globe heading (globeView headingYaw). */
export function gameBasis(p: PlanetFrame, x: number, z: number, out = new THREE.Matrix4()) {
  const up = new THREE.Vector3(...p.fromLocal(x, z)), e = new THREE.Vector3(...p.east), n = new THREE.Vector3(...p.north);
  e.addScaledVector(up, -e.dot(up)).normalize(); n.crossVectors(up, e); // right-handed: north = up x east
  return out.makeBasis(e, up, n.negate()); // game +z = south
}
/** The one viewpoint, in game metres. This is the band pose the descent already flew:
 *  position above the ground point, orientation Euler(pitch, yaw, YXZ). Orbit, the fall,
 *  the drone and the climb all write this pose onto the forest camera. */
export function viewpointPose(
  x: number, z: number, groundY: number, height: number, yaw: number, pitch: number,
  out: { position: THREE.Vector3; quaternion: THREE.Quaternion },
) {
  out.position.set(x, groundY + height, z);
  out.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  return out;
}
/** The old handover mixed a transition camera into the rig camera over blendSec.
 *  One camera means the pose is unchanged. The rig pose and the blend fraction are ignored. */
export function handoverBlend<T>(pose: T, _rig: unknown, _t: number): T {
  return pose;
}
/** Near and far (m) at altitude. The same clip the planet camera already used: near is
 *  altitude × 0.02 clamped to 0.5 m … 100 km, far is the limb past the mean sphere.
 *  The radical is clamped so a camera inside that sphere does not get a NaN projection. */
export function orbitClip(alt: number, radius: number, radialGround: number) {
  const rad = radius + radialGround + alt;
  return {
    near: clamp(alt * 0.02, 0.5, 1e5),
    far: Math.sqrt(Math.max(0, rad * rad - radius * radius)) + radius * 2,
  };
}
/** Inverse of globeCameraFrom. False when the point is not on the home-facing hemisphere,
 *  where the gnomonic frame blows up. The caller then keeps the planet camera as it is. */
export function forestFromPlanet(
  p: PlanetFrame,
  planetCam: { position: THREE.Vector3; quaternion: THREE.Quaternion },
  out: { position: THREE.Vector3; quaternion: THREE.Quaternion },
) {
  const v = planetCam.position, len = Math.hypot(v.x, v.y, v.z);
  if (!(len > 0)) return false;
  const c = (v.x * p.home[0] + v.y * p.home[1] + v.z * p.home[2]) / len;
  if (!(c > 0.25)) return false;
  const g = planetToGame(p, [v.x, v.y, v.z]);
  if (!Number.isFinite(g.x) || !Number.isFinite(g.y) || !Number.isFinite(g.z)) return false;
  out.position.set(g.x, g.y, g.z);
  out.quaternion.copy(planetCam.quaternion).premultiply(new THREE.Quaternion().setFromRotationMatrix(gameBasis(p, g.x, g.z)).invert());
  return true;
}
/** The globe camera for a game camera (position in game coordinates, orientation in the game frame). */
export function globeCameraFrom(p: PlanetFrame, gameCam: { position: THREE.Vector3; quaternion: THREE.Quaternion }, out: { position: THREE.Vector3; quaternion: THREE.Quaternion }) {
  const g = gameCam.position, w = gameToPlanet(p, g.x, g.y, g.z);
  out.position.set(w[0], w[1], w[2]);
  out.quaternion.setFromRotationMatrix(gameBasis(p, g.x, g.z)).multiply(gameCam.quaternion);
  return out;
}

/** Patch opacity (dither threshold) from the camera height above ground. 0 until the chunks under the camera are ready. */
export function patchFade(heightAboveGround: number, chunksReady: boolean) {
  return chunksReady ? smoothstep(TRANSITION.bandTop, TRANSITION.fadeFull, heightAboveGround) : 0;
}

export interface ModeInput { mode: TransitionMode; height: number; overHome: boolean; descending: boolean; chunksReady: boolean; ascend?: boolean; descend?: boolean; embody?: boolean }
/** One step of the mode machine. globe -> band: only an explicit drop (double-click, A, or G). A zoom, a drag and a
 *  click do not enter, on or off home. band -> game: the player asks to become the animal, near the floor, with the
 *  chunks ready (the fall itself stops at the drone and does not take the body); band -> globe: climbing back above
 *  bandTop; game -> band: ascend requested (Shift+G / pause menu). */
export function nextMode(s: ModeInput): TransitionMode {
  switch (s.mode) {
    case 'game': return s.ascend ? 'band' : 'game';
    case 'globe': return s.descend ? 'band' : 'globe';
    case 'band':
      if (!s.descending && s.height >= TRANSITION.bandTop) return 'globe';
      if (s.embody && s.height <= HORIZON_TILT.floorAlt && s.chunksReady) return 'game';
      return 'band';
  }
}
/** Which keymap is live. The band descent and the drone use the drone map; the climb back to the planet takes none. */
export const inputOwner = (mode: TransitionMode, descending: boolean): 'game' | 'globe' | 'drone' | 'none' => mode === 'game' ? 'game' : mode === 'globe' ? 'globe' : descending ? 'drone' : 'none';
/** What runs per mode (lead decision: the world clock always runs; the sim only in game mode). */
export const simRuns = (mode: TransitionMode) => mode === 'game';

/** Hold the governor for the whole transition: no tier steps, world knobs frozen at the current tier; on release the
 *  governor resumes with a fresh window and its cooldown (as render/startup does after loading). */
export function createGovernorHold(g: { auto: boolean; worldTier: number; tier: number; cool: number; cooldownMs: number }, reset: () => void) {
  let saved: { auto: boolean } | null = null;
  return {
    get held() { return saved !== null; },
    hold() { if (saved) return; saved = { auto: g.auto }; g.auto = false; g.worldTier = g.tier; },
    release() { if (!saved) return; const a = saved.auto; saved = null; reset(); g.auto = a; g.cool = g.cooldownMs; },
  };
}
