/**
 * Hand the immersive session from the IWSDK renderer to the game renderer
 * so the seated ground step is the real forest, not a second room.
 * One WebGL context can present the session. The IWSDK loop is stopped first.
 */
import type { WebGLRenderer } from 'three';
import { Quaternion, Vector3 } from 'three';
import { GOVERNOR } from '../core/quality';
import { forestLanding } from '../world/globe/forestLanding';
import { setQuestProfile } from '../world/cosmos/lod';
import { groundAhead, headingToward, refToWorld, snapYaw } from './forestHands';

export interface ForestHooks {
  renderer: () => WebGLRenderer;
  place: (x: number, z: number, yaw: number) => void;
  showGame: (at: { x: number; z: number; yaw: number }) => void;
  drive: (time: number) => void;
  /** Stop the page's own animation loop before the headset loop takes it. */
  hold: () => void;
  resume: () => void;
}

let presenting = false;
let moving = false;
let leftWas = false;
let driveYaw: number | null = null;
let driveForward = false;
const quat = new Quaternion();
const dir = new Vector3();

export function forestHandsOn() { return presenting; }
export function forestMoving() { return moving; }
export function forestDrive() { return { yaw: driveYaw, forward: driveForward }; }

/** Stop the old renderer's XR frame chain without ending the session, then present on the game renderer. */
async function takeSession(from: WebGLRenderer, to: WebGLRenderer, drive: (time: number) => void) {
  const session = from.xr.getSession();
  if (!session) return false;
  from.setAnimationLoop(null);
  const native = session.requestAnimationFrame.bind(session);
  const cancel = session.cancelAnimationFrame.bind(session);
  session.requestAnimationFrame = (cb: XRFrameRequestCallback) => { const id = native(cb); cancel(id); return id; };
  await new Promise(resolve => setTimeout(resolve, 80));
  session.requestAnimationFrame = native;
  to.xr.enabled = true;
  to.xr.setReferenceSpaceType('local-floor');
  to.setAnimationLoop(drive);
  await to.xr.setSession(session);
  return true;
}

export async function enterForest(from: WebGLRenderer, hooks: ForestHooks) {
  if (presenting) return true;
  hooks.hold();
  const spot = forestLanding();
  const at = { x: spot.land.x, z: spot.land.z, yaw: spot.land.yaw };
  hooks.showGame(at);
  hooks.place(at.x, at.z, at.yaw);
  presenting = true;
  GOVERNOR.xr = true;
  setQuestProfile(true);
  const root = document.getElementById('iwsdk-root');
  if (root) root.style.display = 'none';
  const to = hooks.renderer();
  const ok = await takeSession(from, to, hooks.drive);
  if (!ok) { presenting = false; GOVERNOR.xr = false; hooks.resume(); return false; }
  to.xr.addEventListener('sessionend', () => {
    presenting = false; moving = false; driveForward = false; driveYaw = null;
    GOVERNOR.xr = false; setQuestProfile(false);
    to.xr.enabled = false;
    hooks.resume();
  });
  (window as unknown as { __borealForest?: { presenting: boolean; x: number; z: number; yaw: number } }).__borealForest = { presenting: true, ...at };
  return true;
}

/** Read the live hands. Called from the game frame, which is the XR frame while presenting. */
export function readForestHands(renderer: WebGLRenderer, at: { x: number; z: number; yaw: number }, floorY: number) {
  driveYaw = null; driveForward = false; moving = false;
  if (!presenting) return forestDrive();
  const frame = renderer.xr.getFrame();
  const ref = renderer.xr.getReferenceSpace();
  const session = renderer.xr.getSession();
  if (!frame || !ref || !session) return forestDrive();
  const hands = [...session.inputSources].filter(s => s.hand);
  const right = hands.find(s => s.handedness === 'right') ?? hands[0];
  const left = hands.find(s => s.handedness === 'left' && s !== right);
  const pinch = (s?: XRInputSource) => s?.gamepad?.buttons[0]?.value ?? 0;
  if (right && pinch(right) > 0.9 && right.targetRaySpace) {
    const pose = frame.getPose(right.targetRaySpace, ref);
    if (pose) {
      const p = pose.transform.position, o = pose.transform.orientation;
      quat.set(o.x, o.y, o.z, o.w);
      dir.set(0, 0, -1).applyQuaternion(quat);
      const origin = refToWorld({ ...at, y: floorY }, p.x, p.y, p.z);
      const worldDir = refToWorld({ x: 0, z: 0, yaw: at.yaw }, dir.x, dir.y, dir.z);
      const hit = groundAhead(origin, worldDir, floorY);
      const yaw = hit ? headingToward(at, hit) : null;
      if (yaw != null) { driveYaw = yaw; driveForward = true; moving = true; }
    }
  }
  const leftPinch = pinch(left);
  if (left && leftPinch > 0.9 && !leftWas && left.targetRaySpace) {
    const pose = frame.getPose(left.targetRaySpace, ref);
    const side: -1 | 1 = pose && pose.transform.position.x < 0 ? 1 : -1;
    driveYaw = snapYaw(at.yaw, side);
  }
  leftWas = leftPinch > 0.9;
  return forestDrive();
}
