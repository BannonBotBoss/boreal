/** Early-universe picture. Three.js only draws. Radius, brightness and colour come from `sphereLook`. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { frameShiftX, sphereLook } from './look';
import { TIERS, chooseTier, percentile, stepTier, tierById, type Hysteresis, type Tier } from './lod';

export interface SphereInputs { a: number; h: number; temperature: number; rho: number }
export interface GpuInfo { renderer: string; maxTexture: number; floatTarget: boolean; samples: number }

const FINAL = {
  uniforms: {
    tDiffuse: { value: null },
    chromatic: { value: 0 },
    grain: { value: 0 },
    vignette: { value: 0 },
    godrays: { value: 0.5 },
    time: { value: 0 },
    center: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float chromatic, grain, vignette, godrays, time; uniform vec2 center; varying vec2 vUv;
    void main(){
      vec2 d = vUv - 0.5;
      vec2 dir = d * chromatic;
      float r = texture2D(tDiffuse, vUv + dir).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - dir).b;
      vec3 col = vec3(r,g,b);
      vec2 to = center - vUv;
      float rays = 0.0;
      for (int i = 0; i < 12; i++) {
        float t = float(i) / 12.0;
        rays += texture2D(tDiffuse, vUv + to * t * 0.55).b;
      }
      rays /= 12.0;
      col += vec3(0.32, 0.06, 0.72) * rays * godrays;
      col += (sin(vUv.x * 180.0 + time * 13.0) * sin(vUv.y * 140.0 - time * 9.0) * 0.5) * grain;
      col *= 1.0 - vignette * dot(d,d) * 2.2;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const RAY = {
  uniforms: {
    color: { value: new THREE.Color(0.6, 0.3, 1) },
    brightness: { value: 1 },
    time: { value: 0 },
    steps: { value: 24 },
  },
  vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(normalMatrix * normal); vec4 w = modelViewMatrix * vec4(position,1.0); vP = w.xyz; gl_Position = projectionMatrix * w; }`,
  fragmentShader: `
    uniform vec3 color; uniform float brightness, time, steps; varying vec3 vN; varying vec3 vP;
    float nse(vec3 p){ return sin(p.x * 12.3 + p.y * 4.7 + p.z * 8.1) * 0.5 + 0.5; }
    void main(){
      vec3 N = normalize(vN);
      vec3 V = normalize(-vP);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
      vec3 rd = normalize(vP);
      vec3 ro = vec3(0.0);
      float acc = 0.0;
      float n = max(steps, 1.0);
      for (int i = 0; i < 48; i++){
        if (float(i) >= n) break;
        float t = (float(i) + 0.5) / n;
        vec3 p = ro + rd * t * 1.6;
        float g = nse(p * 3.0 + time);
        acc += g * (1.0 - t);
      }
      acc /= n;
      vec3 hot = vec3(0.72, 0.12, 1.0);
      vec3 edge = vec3(0.20, 0.02, 0.55);
      float plasma = 0.84 + 0.16 * sin(vP.x * 6.0 + time * 1.4) * sin(vP.y * 5.0 - time) * sin(vP.z * 4.0 + acc * 6.0);
      vec3 col = mix(hot, edge, smoothstep(0.0, 0.9, fres));
      col *= brightness * plasma * mix(0.85, 0.4, fres);
      float peak = max(col.r, max(col.g, col.b));
      if (peak > 1.0) col *= 1.0 / peak;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function readGpu(gl: WebGL2RenderingContext): GpuInfo {
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  let floatTarget = false;
  try { floatTarget = !!gl.getExtension('EXT_color_buffer_float'); } catch { floatTarget = false; }
  return { renderer, maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, floatTarget, samples: gl.getParameter(gl.MAX_SAMPLES) as number };
}

export class CosmosSphere {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100);
  private core: THREE.Mesh;
  private halo: THREE.Mesh;
  private shells: THREE.Mesh[] = [];
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private final: ShaderPass;
  private ray: THREE.ShaderMaterial;
  private tier: Tier;
  private lock: Tier['id'] | null = null;
  private hyst: Hysteresis = { tier: 'low', over: 0, under: 0 };
  private targetMs = 16.7;
  private inputs: SphereInputs = { a: 1e-40, h: 1, temperature: 1, rho: 1 };
  private raf = 0;
  private last = 0;
  private frames: number[] = [];
  private onTier: (why: string, fps: number, ms: number) => void = () => {};
  gpu: GpuInfo;
  bench: { id: string; p50: number; p95: number }[] = [];
  why = 'not tested yet';

  constructor(parent: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'cosmos-sphere';
    this.canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:25;background:#05010c;pointer-events:none';
    parent.appendChild(this.canvas);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    this.gpu = readGpu(gl);
    this.tier = tierById('low');
    this.camera.position.z = 12;
    this.ray = new THREE.ShaderMaterial({ ...RAY, transparent: false });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), this.ray);
    this.core.renderOrder = 2;
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float time;
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float d = length(p);
          float halo = smoothstep(1.0, 0.05, d);
          float ang = atan(p.y, p.x);
          float rays = pow(max(0.0, sin(ang * 7.0 + time * 0.5)), 6.0);
          vec3 violet = vec3(0.42, 0.04, 0.95);
          float ring = smoothstep(0.22, 0.48, d) * halo;
          vec3 col = violet * ring * 1.5 + violet * rays * ring * 0.85;
          gl_FragColor = vec4(col, clamp(halo, 0.0, 1.0));
        }`,
    });
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), haloMat);
    this.halo.renderOrder = 1;
    this.scene.add(this.halo);
    this.scene.add(this.core);
    this.scene.add(new THREE.AmbientLight(0x2a0848, 0.35));
    const key = new THREE.PointLight(0x6633cc, 2, 40);
    key.position.set(4, 3, 6);
    this.scene.add(key);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1280, 720), 1.4, 0.95, 0.2);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FINAL);
    this.composer.addPass(this.final);
    this.applyTier(this.tier);
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt, now / 1000);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setInputs(v: SphereInputs) { this.inputs = v; }
  setTargetMs(ms: number) { if (ms > 1 && ms < 200) this.targetMs = ms; }
  /** Manual lock. Pass null to follow the benchmark again. */
  lockTier(id: Tier['id'] | null) { this.lock = id; if (id) { this.tier = tierById(id); this.applyTier(this.tier); this.why = 'locked by hand'; } }
  onChange(fn: (why: string, fps: number, ms: number) => void) { this.onTier = fn; }

  private applyTier(tier: Tier) {
    this.tier = tier;
    const w = tier.width, h = tier.height;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.composer.setSize(w, h);
    this.bloom.enabled = true;
    this.bloom.strength = 0.72;
    this.bloom.radius = 0.95;
    this.bloom.threshold = 0.28;
    this.bloom.resolution.set(w / Math.max(1, 6 - tier.bloomMips), h / Math.max(1, 6 - tier.bloomMips));
    this.ray.uniforms.steps.value = Math.max(8, tier.raymarch || 8);
    this.final.uniforms.chromatic.value = tier.chromatic;
    this.final.uniforms.grain.value = tier.grain;
    this.final.uniforms.vignette.value = tier.vignette;
    this.final.uniforms.godrays.value = Math.max(0.45, tier.godrays);
    this.core.geometry.dispose();
    this.core.geometry = new THREE.SphereGeometry(1, tier.segments, Math.max(16, tier.segments / 2));
    for (const s of this.shells) { s.removeFromParent(); s.geometry.dispose(); (s.material as THREE.Material).dispose(); }
    this.shells = [];
    for (let i = 0; i < tier.shells; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1.08 + i * 0.12, 32, 24), new THREE.MeshBasicMaterial({ color: 0x5510aa, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.shells.push(m);
      this.core.add(m);
    }
  }

  private applyLook(time: number) {
    const look = sphereLook(this.inputs.a, this.inputs.h, this.inputs.temperature, this.inputs.rho);
    const radius = Math.max(0.35, look.radius);
    this.core.scale.setScalar(radius);
    const half = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const dist = radius / Math.tan(half) / 0.42;
    const panel = document.getElementById('data-panel');
    const panelW = panel && !panel.hidden ? panel.getBoundingClientRect().width : 0;
    const viewW = window.innerWidth || this.canvas.clientWidth || 1;
    const shift = frameShiftX(panelW / viewW, dist, this.camera.fov, this.camera.aspect);
    this.camera.position.set(shift, 0, dist);
    this.camera.rotation.set(0, 0, 0);
    this.camera.near = Math.max(0.01, dist * 0.02);
    this.camera.far = dist + radius * 12;
    this.camera.updateProjectionMatrix();
    this.halo.position.set(0, 0, 0);
    this.halo.quaternion.copy(this.camera.quaternion);
    this.halo.scale.setScalar(radius * 2.45);
    (this.halo.material as THREE.ShaderMaterial).uniforms.time.value = time;
    const ndc = new THREE.Vector3(0, 0, 0).project(this.camera);
    (this.final.uniforms.center.value as THREE.Vector2).set(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);
    (this.ray.uniforms.color.value as THREE.Color).setRGB(look.color[0], look.color[1], look.color[2]);
    this.ray.uniforms.brightness.value = look.brightness;
    this.ray.uniforms.time.value = time;
    this.final.uniforms.time.value = time;
  }

  private frame(dt: number, time: number) {
    this.applyLook(time);
    const t0 = performance.now();
    this.composer.render();
    this.renderer.getContext().finish();
    const ms = performance.now() - t0;
    this.frames.push(ms);
    if (this.frames.length > 90) this.frames.shift();
    const p95 = percentile(this.frames, 0.95);
    if (!this.lock && this.bench.length) {
      this.hyst = stepTier({ ...this.hyst, tier: this.tier.id }, p95, dt, this.targetMs);
      if (this.hyst.tier !== this.tier.id) {
        this.applyTier(tierById(this.hyst.tier));
        this.why = `runtime ${this.hyst.tier}: 95th percentile ${p95.toFixed(1)} ms, target ${this.targetMs} ms`;
      }
    }
    this.onTier(this.why, 1000 / Math.max(ms, 0.1), ms);
  }

  /** Timed pass over every tier. Picks the highest one that holds the target. */
  async benchmark() {
    const samples: { id: Tier['id']; p50: number; p95: number }[] = [];
    const saved = this.tier.id;
    for (const tier of TIERS) {
      this.applyTier(tier);
      const times: number[] = [];
      const tEnd = performance.now() + 1500;
      let frames = 0;
      while (performance.now() < tEnd && frames < 6) {
        const t0 = performance.now();
        this.composer.render();
        this.renderer.getContext().finish();
        times.push(performance.now() - t0);
        frames++;
        await new Promise(r => requestAnimationFrame(r));
      }
      samples.push({ id: tier.id, p50: percentile(times, 0.5), p95: percentile(times, 0.95) });
    }
    this.bench = samples;
    const id = this.lock ?? chooseTier(samples, this.targetMs);
    this.applyTier(tierById(id));
    this.hyst = { tier: id, over: 0, under: 0 };
    const row = samples.find(s => s.id === id);
    this.why = `benchmark chose ${id}: 95th ${row ? row.p95.toFixed(1) : '?'} ms, target ${this.targetMs} ms`;
    if (this.lock) this.applyTier(tierById(saved));
    return samples;
  }

  /** Always Ultra, whatever the live tier is. Returns a PNG data URL. */
  capture4k(): string {
    const prev = this.tier.id;
    this.applyTier(tierById('ultra'));
    this.applyLook(performance.now() / 1000);
    this.composer.render();
    this.renderer.getContext().finish();
    const url = this.canvas.toDataURL('image/png');
    this.applyTier(tierById(this.lock ?? prev));
    return url;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.composer.dispose();
    this.renderer.dispose();
    this.canvas.remove();
  }
}
