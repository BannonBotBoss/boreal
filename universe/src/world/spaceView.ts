/**
 * Expanding-space drawer. Pattern borrowed from Boreal's cosmos sphere:
 * physics numbers arrive from the time engine; Three.js only draws.
 */
import * as THREE from 'three';
import { R_OBS_M } from '../core/cosmicTime';
import type { UniverseSnapshot } from '../core/timeEngine';
import { universeStream } from '../core/universeSeed';

export class SpaceView {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly shell: THREE.Mesh;
  private readonly glow: THREE.Mesh;
  private readonly axes: THREE.AxesHelper;
  private readonly minusAxes: THREE.AxesHelper;
  private readonly points: THREE.Points;
  private axesOn = true;
  private seed = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(0x05070c, 1);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 500);
    this.camera.position.set(0, 0.35, 12);

    const geo = new THREE.SphereGeometry(1, 64, 48);
    this.shell = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xf0e6c8, transparent: true, opacity: 0.92 }),
    );
    this.glow = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0x7a8cff, transparent: true, opacity: 0.18, side: THREE.BackSide }),
    );
    this.glow.scale.setScalar(1.18);
    this.axes = new THREE.AxesHelper(1);
    this.minusAxes = new THREE.AxesHelper(1);
    this.minusAxes.visible = false;
    // Dim the minus triad (G pole) — visible only after polarity split when axes are on.
    const minusMat = this.minusAxes.material as THREE.Material | THREE.Material[];
    for (const m of Array.isArray(minusMat) ? minusMat : [minusMat]) {
      m.transparent = true;
      m.opacity = 0.35;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 1200), 3));
    this.points = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0xd7c4ff, size: 0.035, transparent: true, opacity: 0.85, sizeAttenuation: true }),
    );
    this.points.visible = false;

    this.scene.add(this.shell, this.glow, this.axes, this.minusAxes, this.points);
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  setSeed(seed: number) {
    this.seed = seed || 1;
    this.scatter();
  }

  setAxesVisible(on: boolean) {
    this.axesOn = on;
    this.axes.visible = on;
    if (!on) this.minusAxes.visible = false;
  }

  axesVisible() {
    return this.axesOn;
  }

  private scatter() {
    const rnd = universeStream(this.seed, 'shell-points');
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const u = rnd();
      const v = rnd();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 0.82 + 0.18 * rnd();
      pos.setXYZ(i, r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    }
    pos.needsUpdate = true;
  }

  /** Display radius from R_space: 0 at t=0, ~7.4 at R_obs (matches old look span without the 0.4 floor). */
  private displayRadius(R: number): number {
    if (!(R > 0)) return 0;
    const u = Math.min(1, Math.max(0, R / R_OBS_M));
    // log compress so early growth is readable
    const logU = Math.log10(1 + 99 * u) / 2; // 0..1
    return 7.4 * logU;
  }

  apply(s: UniverseSnapshot) {
    const radius = this.displayRadius(s.R);
    const hot = Math.min(1, Math.max(0, 1 - Math.log10(Math.max(s.seconds, 1e-44) + 1e-44) / 60));
    const mat = this.shell.material as THREE.MeshBasicMaterial;
    mat.color.setRGB(0.95 - 0.55 * (1 - hot), 0.9 - 0.7 * (1 - hot), 0.78 + 0.1 * (1 - hot));
    mat.opacity = s.seconds <= 0 ? 0 : 0.55 + 0.4 * hot;
    this.shell.visible = radius > 0;
    this.glow.visible = radius > 0;
    this.shell.scale.setScalar(Math.max(1e-4, radius));
    this.glow.scale.setScalar(Math.max(1e-4, radius) * 1.18);
    this.axes.scale.setScalar(Math.max(1e-4, radius));
    this.minusAxes.scale.setScalar(Math.max(1e-4, radius));
    this.axes.visible = this.axesOn && radius > 0;
    this.minusAxes.visible = this.axesOn && s.polaritySplit && radius > 0;
    this.points.visible = s.polaritySplit && radius > 0;
    this.points.scale.setScalar(Math.max(1e-4, radius));

    const dist = Math.max(4, radius * 1.85 + 2.5);
    this.camera.position.set(0, radius * 0.08, dist);
    this.camera.lookAt(0, 0, 0);
  }

  resize() {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
