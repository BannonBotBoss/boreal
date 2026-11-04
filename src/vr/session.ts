/**
 * Meta Immersive Web SDK session for the contest entry.
 * The VR view is an IWSDK World (@iwsdk/core). It uses the same Three.js module as the rest of the game
 * (super-three, one copy). The Rust/wasm sim is unchanged. Hands are required. A controller is not a way in.
 */
import {
  Mesh, MeshStandardMaterial, OneHandGrabbable, ReferenceSpaceType, SessionMode, SphereGeometry, TurningMethod, World,
  buildSessionInit, type XROptions,
} from '@iwsdk/core';

/** Seated immersive VR. hand-tracking is required, so the session does not open without hands. */
export const HANDS_ONLY: XROptions = {
  sessionMode: SessionMode.ImmersiveVR,
  referenceSpace: { type: ReferenceSpaceType.LocalFloor, fallbackOrder: [ReferenceSpaceType.Local, ReferenceSpaceType.Viewer] },
  features: { handTracking: { required: true } },
};

let world: World | null = null;
let starting = false;

export function mountEnterVr(notice: (message: string) => void) {
  const button = document.getElementById('vr-btn');
  if (!(button instanceof HTMLButtonElement)) return;
  button.addEventListener('click', () => { void enterVr(notice); });
  (window as unknown as { __borealVr?: boolean }).__borealVr = true;
}

/** Enter VR. The session request starts inside the click. The world is Meta's IWSDK World. */
export async function enterVr(notice: (message: string) => void) {
  if (world) { world.launchXR(); return; }
  if (starting) return;
  starting = true;
  const xr = navigator.xr;
  const requested = xr
    ? xr.requestSession(SessionMode.ImmersiveVR, buildSessionInit(HANDS_ONLY)).catch((error: unknown) => { console.warn('vr session', error); return null; })
    : Promise.resolve(null);
  try {
    const container = vrContainer();
    world = await World.create(container, {
      xr: { ...HANDS_ONLY, offer: 'none' },
      render: { fov: 50, near: 0.1, far: 80, camera: { position: [0, 1.3, 0.2] } },
      features: {
        grabbing: { useHandPinchForGrab: true },
        locomotion: { turningMethod: TurningMethod.SnapTurn, enableJumping: false, comfortAssistLevel: 0.65 },
      },
    });
    seatMarker(world);
    const session = await requested;
    if (!session) {
      world.destroy();
      world = null;
      notice('Enter VR needs a Quest browser and hands. This browser did not open an immersive session. Controllers are not a substitute.');
      return;
    }
    await world.renderer.xr.setSession(session);
    world.session = session;
    container.hidden = false;
  } catch (error) {
    console.warn('vr', error);
    if (world) { world.destroy(); world = null; }
    notice('Enter VR did not start. The page is still the ordinary game.');
  } finally {
    starting = false;
  }
}

function vrContainer() {
  let el = document.getElementById('iwsdk-root');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'iwsdk-root';
  el.hidden = true;
  Object.assign(el.style, { position: 'fixed', inset: '0', zIndex: '80' });
  document.body.append(el);
  return el;
}

/** A pinchable violet sphere in front of a seated player, so the IWSDK world is not an empty room. */
function seatMarker(host: World) {
  const mesh = new Mesh(new SphereGeometry(0.18, 48, 32), new MeshStandardMaterial({ color: 0x6a2cc4, emissive: 0x3a1578, roughness: 0.35 }));
  const entity = host.createTransformEntity(mesh);
  entity.object3D!.position.set(0, 1.2, -0.8);
  entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
}
