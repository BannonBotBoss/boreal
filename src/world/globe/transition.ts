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
import { smoothstep } from '../../proc/math';

export const TRANSITION = {
  bandTop: HANDOFF.alt,           // m above ground: the game patch starts fading in below this (and is gone above it)
  fadeFull: 600,                  // m above ground: patch fully faded in
  handover: 60,                   // m above ground: the rig camera takes over (descent ends) [game calibration]
  datum: PLANET.home.elevation,   // m: globe height = game height + datum inside the home region (the one constant offset)
  blendSec: 1,                    // s: transition pose -> rig pose at the end of the descent
};

export type TransitionMode = 'game' | 'band' | 'globe';
/** In-page globe camera elevation (radians, negative = below the horizon) by altitude above ground (T-0034): straight down in
 *  orbit, easing to the descent's 45-degree glide path (inpage glide) by the band top, so globe -> band -> game never swings
 *  the pitch (it used to snap from straight down to the horizon at 300 km, then swing back down in the band). */
export const GLOBE_PITCH = { orbitAlt: 3e5, glide: -Math.PI / 4, down: -Math.PI / 2 + .01 };
/** In-page globe cloud clearing by altitude (T-0034): the 2.5 km cloud shell (atmosphere CLOUDS, 900 km cells) can sit over
 *  the whole home region, so diving in looked into a flat lit cloud top from ~300 km to the band (the 'blank plain'). The deck
 *  opens from 300 km (orbit look kept) to none by 20 km, so the descent always sees the ground it lands on. */
export const cloudClear = (alt: number) => 1 - smoothstep(2e4, GLOBE_PITCH.orbitAlt, alt);
export function globePitch(alt: number) { return GLOBE_PITCH.down + (GLOBE_PITCH.glide - GLOBE_PITCH.down) * (1 - smoothstep(TRANSITION.bandTop, GLOBE_PITCH.orbitAlt, alt)); }
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
/** Game point (x east, y up = game height, z south) -> planet-frame metres. */
export function gameToPlanet(p: PlanetFrame, x: number, y: number, z: number): Vec3 {
  const d = p.fromLocal(x, z), r = p.radius + TRANSITION.datum + y; return [d[0] * r, d[1] * r, d[2] * r];
}
/** Inverse of gameToPlanet (exact inverse of planet.fromLocal's projection). */
export function planetToGame(p: PlanetFrame, v: Vec3) {
  const len = Math.hypot(v[0], v[1], v[2]), c = dot(v, p.home) / len;
  return { x: p.radius * dot(v, p.east) / len / c, y: len - p.radius - TRANSITION.datum, z: -p.radius * dot(v, p.north) / len / c };
}
/** Rotation taking game-frame vectors (x east, y up, z south) to planet-frame vectors at game point (x, z): home's
 *  east/north projected on the local tangent plane, the same convention as the globe heading (globeView headingYaw). */
export function gameBasis(p: PlanetFrame, x: number, z: number, out = new THREE.Matrix4()) {
  const up = new THREE.Vector3(...p.fromLocal(x, z)), e = new THREE.Vector3(...p.east), n = new THREE.Vector3(...p.north);
  e.addScaledVector(up, -e.dot(up)).normalize(); n.crossVectors(up, e); // right-handed: north = up x east
  return out.makeBasis(e, up, n.negate()); // game +z = south
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

export interface ModeInput { mode: TransitionMode; height: number; overHome: boolean; descending: boolean; chunksReady: boolean; ascend?: boolean; descend?: boolean }
/** One step of the mode machine. globe -> band: descending below bandTop over the home region (or descend requested);
 *  band -> game: below the handover height with the chunks ready; band -> globe: climbing back above bandTop;
 *  game -> band: ascend requested (Shift+G / pause menu). */
export function nextMode(s: ModeInput): TransitionMode {
  switch (s.mode) {
    case 'game': return s.ascend ? 'band' : 'game';
    case 'globe': return s.overHome && (s.descend || (s.descending && s.height < TRANSITION.bandTop)) ? 'band' : 'globe';
    case 'band':
      if (!s.descending && s.height >= TRANSITION.bandTop) return 'globe';
      if (s.descending && s.height <= TRANSITION.handover && s.chunksReady) return 'game';
      return 'band';
  }
}
/** Which keymap is live: only the active scene's. In band the camera is flown by the transition: the globe keys stay live
 *  on the way down (turn/zoom), none on the way up (the game has handed off). */
export const inputOwner = (mode: TransitionMode, descending: boolean): 'game' | 'globe' | 'none' => mode === 'game' ? 'game' : mode === 'globe' ? 'globe' : descending ? 'globe' : 'none';
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
