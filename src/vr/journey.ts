/**
 * Seated, hands-only journey inside the IWSDK world.
 * A pinch or a held open palm starts time. The violet sphere uses the Rust spacetime numbers.
 * The panel shows the live equation and the time; a pinch drag scrubs the cycle.
 * The globe can be grabbed and turned. A pinch on it eases the player down to the ground.
 * On the ground, point and pinch to glide, and pinch the other hand to snap turn.
 * No controllers. No animals are placed.
 */
import {
  AmbientLight, CanvasTexture, Color, DirectionalLight, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  OneHandGrabbable, PlaneGeometry, Quaternion, SphereGeometry, Vector3, createSystem, type World,
} from '@iwsdk/core';
import { latestPlanetSim } from '../core/planetBudget';
import { decodeEngineReport } from '../core/engineReport';
import { sphereLook } from '../world/cosmos/look';
import { descentHeight, descentProgress } from '../world/globe/flight';
import { setQuestProfile } from '../world/cosmos/lod';

type Phase = 'dark' | 'sphere' | 'globe' | 'fall' | 'wolf';

const rayDir = new Vector3();
const rayOrigin = new Vector3();
const quat = new Quaternion();
const PLANET_YEAR = 9.2e9;
const worlds = new WeakMap<World, Journey>();

export function startJourney(world: World) {
    world.scene.background = new Color(0x071018);
  world.scene.add(new AmbientLight(0x241830, 0.45));
  const sun = new DirectionalLight(0xfff4e0, 1.2);
  sun.position.set(2, 4, 1);
  world.scene.add(sun);
  const state = new Journey(world);
  worlds.set(world, state);
  world.registerSystem(JourneySystem);
  world.onXRFrame((frame, delta) => state.frame(frame, delta));
  (window as unknown as { __borealJourney?: { phase: string; cycle: number } }).__borealJourney = state;
  return state;
}

const JourneyBase = createSystem();
class JourneySystem extends JourneyBase {
  update(delta: number) { worlds.get(this.world)?.tick(delta); }
}

class Journey {
  phase: Phase = 'dark';
  cycle = 1;
  palm = 0;
  fallT = 0;
  ms = 0;
  vignette: Mesh;
  sphere: Mesh;
  globe: Mesh;
  panel: Mesh;
  ground: Mesh;
  muzzle: Mesh;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: CanvasTexture;
  leftWas = false;
  rightWas = false;
  dragX: number | null = null;
  globeHold = 0;

  constructor(private world: World) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 256;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.sphere = new Mesh(new SphereGeometry(0.2, 48, 32), new MeshStandardMaterial({ color: 0x2a0848, emissive: 0x14041f, roughness: 0.4 }));
    this.sphere.position.set(0, 1.25, -0.8);
    this.sphere.visible = false;
    world.scene.add(this.sphere);
    this.globe = new Mesh(new SphereGeometry(0.22, 48, 32), new MeshStandardMaterial({ color: 0x2f6d4f, roughness: 0.7 }));
    this.globe.position.set(0, 1.05, -0.7);
    this.globe.visible = false;
    world.createTransformEntity(this.globe).addComponent(OneHandGrabbable, { rotate: true, translate: false });
    this.panel = new Mesh(new PlaneGeometry(0.5, 0.26), new MeshBasicMaterial({ map: this.tex, transparent: true }));
    this.panel.position.set(0.32, 1.35, -0.75);
    this.panel.visible = false;
    world.createTransformEntity(this.panel);
    this.ground = new Mesh(new PlaneGeometry(48, 48), new MeshStandardMaterial({ color: 0x3d5c3a, roughness: 1 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.visible = false;
    world.scene.add(this.ground);
    this.muzzle = new Mesh(new SphereGeometry(0.08, 16, 12), new MeshStandardMaterial({ color: 0xc8c2b4 }));
    this.muzzle.position.set(0, -0.14, -0.32);
    this.muzzle.visible = false;
    world.camera.add(this.muzzle);
    this.vignette = new Mesh(new PlaneGeometry(2.2, 2.2), new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false }));
    this.vignette.position.set(0, 0, -0.28);
    this.vignette.renderOrder = 20;
    world.camera.add(this.vignette);
    this.paint('Pinch, or hold an open palm, to start time.');
  }

  tick(dt: number) {
    this.ms += dt * 1000;
    if (this.phase === 'sphere' || this.phase === 'globe') this.cycle = Math.min(80, this.cycle + dt * 2);
    if (this.phase === 'sphere') this.inFront(this.sphere, 0.85, 0);
    if (this.phase === 'sphere' || this.phase === 'globe' || this.phase === 'wolf') this.inFront(this.panel, 0.7, 0.12);
    if (this.phase === 'globe') this.inFront(this.globe, 0.6, -0.05);
    if (this.phase === 'wolf') this.inFront(this.ground, 2.2, -0.9);
    this.draw();
  }

  /** Keep a seated object in front of the headset. The XR camera is not at the scene origin. */
  inFront(mesh: Mesh, distance: number, lift: number) {
    this.world.camera.getWorldPosition(rayOrigin);
    this.world.camera.getWorldDirection(rayDir);
    mesh.position.copy(rayOrigin).addScaledVector(rayDir, distance);
    mesh.position.y += lift;
    if (mesh !== this.ground) mesh.lookAt(rayOrigin);
  }

  frame(frame: XRFrame, dt: number) {
    const ref = this.world.xrReferenceSpace;
    const session = this.world.session;
    if (!ref || !session) return;
    setQuestProfile(true);
    const hands = [...session.inputSources].filter(s => s.hand);
    const right = hands.find(s => s.handedness === 'right') ?? hands[0];
    const left = hands.find(s => s.handedness === 'left' && s !== right);
    const rightPinch = right ? pinchOf(right) : 0;
    const leftPinch = left ? pinchOf(left) : 0;
    if (this.phase === 'dark') {
      this.palm = hands.some(h => palmOpen(frame, h, ref)) ? this.palm + dt : 0;
      if ((rightPinch > 0.9 && !this.rightWas) || this.palm > 0.5) this.begin();
    } else if (this.phase === 'sphere' || this.phase === 'globe') {
      this.scrub(frame, ref, right, rightPinch);
      if (this.phase === 'globe' && right && rightPinch > 0.9 && !this.hits(frame, ref, right, this.panel)) {
        this.globeHold += dt;
        if (this.globeHold > 0.3) this.beginFall();
      } else this.globeHold = 0;
    } else if (this.phase === 'fall') {
      this.fallT += dt;
      const p = descentProgress(this.fallT, 10);
      this.world.player.position.y = descentHeight(40, 0, p);
      this.cover(0.7 * Math.sin(Math.PI * Math.min(1, p)));
      if (p >= 1) this.beginWolf();
    } else this.wolf(frame, ref, dt, right, rightPinch, left, leftPinch);
    this.rightWas = rightPinch > 0.9;
    this.leftWas = leftPinch > 0.9;
  }

  begin() {
    this.phase = 'sphere';
    this.cycle = 1;
    this.sphere.visible = true;
    this.panel.visible = true;
  }

  beginFall() {
    this.phase = 'fall';
    this.fallT = 0;
    this.globe.visible = false;
    this.sphere.visible = false;
  }

  beginWolf() {
    this.phase = 'wolf';
    this.world.player.position.y = 0;
    this.ground.visible = true;
    this.panel.visible = true;
    this.muzzle.visible = true;
    this.cover(0);
    this.paint('Point and pinch to glide.\nPinch the other hand to snap turn.\nNo animals are placed in this room.');
  }

  scrub(frame: XRFrame, ref: XRReferenceSpace, hand: XRInputSource | undefined, pinch: number) {
    if (!hand || pinch < 0.9 || !this.hits(frame, ref, hand, this.panel)) { this.dragX = null; return; }
    const pose = frame.getPose(hand.targetRaySpace, ref);
    if (!pose) return;
    const x = pose.transform.position.x;
    if (this.dragX != null) this.cycle = Math.max(0, Math.min(80, this.cycle + (x - this.dragX) * 40));
    this.dragX = x;
  }

  wolf(frame: XRFrame, ref: XRReferenceSpace, dt: number, right: XRInputSource | undefined, rightPinch: number, left: XRInputSource | undefined, leftPinch: number) {
    let moving = false;
    if (right && rightPinch > 0.9) {
      const hit = groundPoint(frame, ref, right);
      if (hit) {
        const dx = hit.x - this.world.player.position.x;
        const dz = hit.z - this.world.player.position.z;
        const len = Math.hypot(dx, dz);
        if (len > 0.45) {
          moving = true;
          const step = Math.min(1.4 * dt, len);
          this.world.player.position.x += dx / len * step;
          this.world.player.position.z += dz / len * step;
          this.world.player.rotation.y = Math.atan2(dx, dz);
        }
      }
    }
    if (left && leftPinch > 0.9 && !this.leftWas) {
      const pose = frame.getPose(left.targetRaySpace, ref);
      const dir = pose && pose.transform.position.x < 0 ? 1 : -1;
      this.world.player.rotation.y += dir * (Math.PI / 6);
    }
    this.cover(moving ? 0.55 : 0);
  }

  hits(frame: XRFrame, ref: XRReferenceSpace, hand: XRInputSource, mesh: Mesh) {
    const pose = frame.getPose(hand.targetRaySpace, ref);
    if (!pose) return false;
    aim(pose, rayOrigin, rayDir);
    const toX = mesh.position.x - rayOrigin.x;
    const toY = mesh.position.y - rayOrigin.y;
    const toZ = mesh.position.z - rayOrigin.z;
    const along = toX * rayDir.x + toY * rayDir.y + toZ * rayDir.z;
    if (along < 0) return false;
    const cx = rayOrigin.x + rayDir.x * along - mesh.position.x;
    const cy = rayOrigin.y + rayDir.y * along - mesh.position.y;
    const cz = rayOrigin.z + rayDir.z * along - mesh.position.z;
    return Math.hypot(cx, cy, cz) < 0.3;
  }

  draw() {
    const sim = latestPlanetSim();
    sim?.setEngineNow(this.ms);
    sim?.setEngineCycle(this.cycle);
    const report = sim ? decodeEngineReport(sim.engineReport()) : null;
    const vars = report?.instances.flatMap(i => i.vars) ?? [];
    const look = sphereLook(num(vars, 'scale factor a', 1e-30), num(vars, 'Hubble rate', 0), num(vars, 'temperature', 1), num(vars, 'total density', 1));
    if (this.phase === 'sphere') {
      this.sphere.scale.setScalar(Math.max(0.25, Math.min(0.7, look.radius * 0.08)));
      const mat = this.sphere.material as MeshStandardMaterial;
      mat.color.setRGB(look.color[0], look.color[1], look.color[2]);
      mat.emissive.setRGB(look.color[0] * 0.85, look.color[1] * 0.85, look.color[2] * 0.85);
    }
    const planet = (report?.years ?? 0) >= PLANET_YEAR || this.cycle >= 62;
    if (planet && this.phase === 'sphere') { this.phase = 'globe'; this.globe.visible = true; this.sphere.visible = false; }
    if (this.phase === 'fall' || this.phase === 'wolf') return;
    const eq = report?.equations.find(e => /friedmann/i.test(e.title + e.latex)) ?? report?.equations[0];
    const sym = report?.instances.flatMap(i => i.symbols).slice(0, 3).map(s => `${s.name} ${fmt(s.value)} ${s.unit}`).join('   ') ?? '';
    const time = report ? `cycle ${fmt(report.cycle)}    ${fmt(report.seconds)} s    ${report.era}` : `cycle ${this.cycle.toFixed(2)}`;
    const hint = this.phase === 'globe' ? 'Pinch the globe to go down. Drag this panel to scrub time.' : this.phase === 'dark' ? 'Pinch, or hold an open palm, to start time.' : 'Drag this panel to scrub time.';
    this.paint([eq?.title || 'Equation', eq?.latex || '', time, sym, hint].filter(Boolean).join('\n'));
  }

  paint(text: string) {
    const g = this.ctx;
    g.fillStyle = '#120818';
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#f3e9ff';
    g.font = '18px sans-serif';
    text.split('\n').slice(0, 7).forEach((line, i) => g.fillText(line.slice(0, 64), 16, 32 + i * 28));
    this.tex.needsUpdate = true;
  }

  cover(amount: number) {
    (this.vignette.material as MeshBasicMaterial).opacity = Math.max(0, Math.min(0.85, amount));
  }
}

function pinchOf(source: XRInputSource) { return source.gamepad?.buttons[0]?.value ?? 0; }

function palmOpen(frame: XRFrame, source: XRInputSource, ref: XRReferenceSpace) {
  const hand = source.hand;
  if (!hand || pinchOf(source) > 0.2) return false;
  const wrist = hand.get('wrist');
  const index = hand.get('index-finger-tip');
  const thumb = hand.get('thumb-tip');
  if (!wrist || !index || !thumb || !frame.getJointPose) return false;
  const w = frame.getJointPose(wrist, ref);
  const i = frame.getJointPose(index, ref);
  const t = frame.getJointPose(thumb, ref);
  if (!w || !i || !t) return false;
  const gap = Math.hypot(i.transform.position.x - t.transform.position.x, i.transform.position.y - t.transform.position.y, i.transform.position.z - t.transform.position.z);
  return gap > 0.04 && i.transform.position.y - w.transform.position.y > 0.05;
}

function aim(pose: XRPose, origin: Vector3, dir: Vector3) {
  const p = pose.transform.position;
  const o = pose.transform.orientation;
  origin.set(p.x, p.y, p.z);
  quat.set(o.x, o.y, o.z, o.w);
  dir.set(0, 0, -1).applyQuaternion(quat);
}

function groundPoint(frame: XRFrame, ref: XRReferenceSpace, hand: XRInputSource) {
  const pose = frame.getPose(hand.targetRaySpace, ref);
  if (!pose) return null;
  aim(pose, rayOrigin, rayDir);
  if (rayDir.y > -0.05) return null;
  const t = -rayOrigin.y / rayDir.y;
  if (t < 0 || t > 12) return null;
  return { x: rayOrigin.x + rayDir.x * t, z: rayOrigin.z + rayDir.z * t };
}

function num(vars: { label: string; value: number }[], label: string, fallback: number) {
  const v = vars.find(x => x.label === label)?.value;
  return Number.isFinite(v) ? v! : fallback;
}
function fmt(n: number) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  return a !== 0 && (a < 0.01 || a >= 1000) ? n.toExponential(2) : n.toFixed(2);
}
