/** Early-universe picture. Three.js only draws. Radius, brightness and colour come from `sphereLook`. */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { frameShiftX, sphereLook } from './look';
import { QUEST, TIERS, chooseTier, percentile, questProfileOn, stepTier, tierById, type Hysteresis, type Tier } from './lod';

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
    tint: { value: new THREE.Color(1, 0.78, 0.88) },
    disc: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float chromatic, grain, vignette, godrays, time, disc; uniform vec2 center; uniform vec3 tint; varying vec2 vUv;
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
      col += tint * rays * godrays;
      // The outer glow is a circle in screen space. Plasma turns it off so the sphere edge cannot survive as a ring.
      float glowD = length(vUv - center);
      float glow = smoothstep(0.62, 0.08, glowD) * disc;
      col += tint * glow * glow * 0.55;
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
    camLocal: { value: new THREE.Vector3(0, 0, 8) },
  },
  vertexShader: `varying vec3 vObj; void main(){ vObj = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform vec3 color; uniform float brightness, time, steps; uniform vec3 camLocal; varying vec3 vObj;
    float nse(vec3 p){ return sin(p.x * 12.3 + p.y * 4.7 + p.z * 8.1) * 0.5 + 0.5; }
    void main(){
      // The mesh is a coarse shell. The colour is the true sphere, so a hot white disc is a circle.
      // Fresnel stays in object space: the fragment shader has no modelViewMatrix.
      vec3 ro = camLocal;
      vec3 rd = normalize(vObj - camLocal);
      float b = dot(ro, rd);
      float h2 = b * b - (dot(ro, ro) - 1.0);
      if (h2 < 0.0) discard;
      vec3 hit = ro + rd * (-b - sqrt(h2));
      vec3 N = normalize(hit);
      vec3 V = normalize(camLocal - hit);
      float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);
      vec3 vP = hit;
      vec3 ray = normalize(hit - camLocal);
      float acc = 0.0;
      float n = max(steps, 1.0);
      for (int i = 0; i < 48; i++){
        if (float(i) >= n) break;
        float t = (float(i) + 0.5) / n;
        vec3 p = ray * t * 1.6;
        float g = nse(p * 3.0 + time);
        acc += g * (1.0 - t);
      }
      acc /= n;
      float plasma = 0.84 + 0.16 * sin(vP.x * 6.0 + time * 1.4) * sin(vP.y * 5.0 - time) * sin(vP.z * 4.0 + acc * 6.0);
      vec3 col = color * mix(1.15, 0.55, smoothstep(0.0, 0.9, fres));
      col *= brightness * plasma * mix(0.85, 0.4, fres);
      float peak = max(col.r, max(col.g, col.b));
      if (peak > 1.0) col *= 1.0 / peak;
      // The mesh edge is a polygon. Fade the last rim so the silhouette is the glow, not the facets.
      float edge = smoothstep(0.4, 0.86, fres);
      col *= 1.0 - edge;
      gl_FragColor = vec4(col, 1.0 - edge);
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
  /** One camera. The cinematic sets this; applyLook does not invent a second view. dolly 1 is the old distance. */
  framing = { dolly: 1 };
  setFraming(fov: number, dolly: number) { this.camera.fov = fov; this.framing.dolly = dolly; }
  private plasma: THREE.Mesh | null = null;
  private plasmaOn = false;
  /** Full-frame turbulent plasma on this same camera. The sphere mesh stays hidden so its edge cannot draw a circle. */
  setPlasma(on: boolean, u?: { time: number; heat: number; gain: number; clear: number; dark: number; stars: number; galaxy: number; sun: number; late: number }) {
    this.plasmaOn = on;
    if (!this.plasma) return;
    this.plasma.visible = on;
    this.core.visible = !on;
    this.halo.visible = !on;
    this.final.uniforms.disc.value = on ? 0 : 1;
    if (on) {
      this.bloom.threshold = 0.9;
      this.bloom.strength = u && u.sun > 0.15 ? 0.16 : 0.05;
      this.final.uniforms.godrays.value = 0;
      this.final.uniforms.vignette.value = 0;
    } else {
      this.bloom.threshold = 0.62;
      this.bloom.strength = 0.28;
      this.final.uniforms.godrays.value = Math.max(0.45, this.tier.godrays);
      this.final.uniforms.vignette.value = this.tier.vignette;
    }
    if (!on || !u) return;
    const mat = this.plasma.material as THREE.ShaderMaterial;
    mat.uniforms.time.value = u.time;
    mat.uniforms.heat.value = u.heat;
    mat.uniforms.gain.value = u.gain;
    mat.uniforms.clear.value = u.clear;
    mat.uniforms.dark.value = u.dark;
    mat.uniforms.stars.value = u.stars;
    mat.uniforms.galaxy.value = u.galaxy;
    mat.uniforms.sun.value = u.sun;
    mat.uniforms.late.value = u.late;
  }
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
  private camLocal = new THREE.Vector3();
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
    this.ray = new THREE.ShaderMaterial({ ...RAY, transparent: true, depthWrite: false });
    this.core = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), this.ray);
    this.core.renderOrder = 2;
    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(1, 0.78, 0.88) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec2 vUv; uniform float time; uniform vec3 color;
        void main(){
          vec2 p = vUv * 2.0 - 1.0;
          float d = length(p);
          float halo = smoothstep(1.0, 0.0, d);
          float fall = halo * halo * (1.0 + 0.0 * time);
          gl_FragColor = vec4(color * fall * 0.85, fall);
        }`,
    });
    this.halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), haloMat);
    this.halo.renderOrder = 1;
    this.scene.add(this.halo);
    this.scene.add(this.core);
    const plasmaMat = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        time: { value: 0 }, heat: { value: 0 }, gain: { value: 1 }, clear: { value: 0 }, dark: { value: 0 },
        stars: { value: 0 }, galaxy: { value: 0 }, sun: { value: 0 }, late: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time, heat, gain, clear, dark, stars, galaxy, sun, late;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){
          vec2 i = floor(p), f = fract(p);
          float a = hash(i), b = hash(i+vec2(1.0,0.0)), c = hash(i+vec2(0.0,1.0)), d = hash(i+vec2(1.0,1.0));
          vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
        }
        float fbm(vec2 p){
          float v = 0.0, a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p = mat2(1.62, 1.18, -1.18, 1.62) * p + vec2(1.7, 9.2); a *= 0.5; }
          return v;
        }
        float streak(vec2 uv, vec2 flow, float t){
          vec2 q = uv * 5.5 + flow * 1.4 + vec2(t * 0.65, t * 0.22);
          float lane = fract(q.x * 0.45 + q.y);
          float across = abs(fract(q.y * 2.2 - t * 0.15) - 0.5);
          float life = lane * clamp((0.38 - lane) / 0.2, 0.0, 1.0);
          float thin = exp(-across * across * 320.0);
          float gate = clamp((noise(q * 0.45) - 0.64) / 0.28, 0.0, 1.0);
          return life * thin * gate;
        }
        void main(){
          vec2 uv = (vUv - 0.5) * vec2(1.85, 1.15);
          vec2 q = vec2(fbm(uv + time * 0.045), fbm(uv + vec2(5.2, 1.3) - time * 0.036));
          vec2 r = vec2(fbm(uv + 1.8 * q + time * 0.028), fbm(uv + 1.8 * q.yx - time * 0.02));
          float base = fbm(uv * 1.15 + 2.2 * r);
          float fine = fbm(uv * 4.8 + r * 1.4 + vec2(time * 0.05, 0.0));
          float grain = fbm(uv * 11.0 - r + vec2(0.0, time * 0.07));
          float dust = fbm(uv * 22.0 + time * 0.04);
          float density = base * 0.52 + fine * 0.28 + grain * 0.14 + dust * 0.06;
          float h = clamp(heat, 0.0, 3.0);
          float redFog = clamp(h - 2.0, 0.0, 1.0) * (1.0 - clear);
          density = mix(density, 0.38 + 0.48 * density, redFog);
          float shaped = clamp((density - 0.28) / 0.55, 0.0, 1.0);
          float emit = pow(shaped, 1.35);
          float core = pow(shaped, 3.4);
          vec3 indigo = vec3(0.11, 0.045, 0.20);
          vec3 amber = vec3(0.20, 0.075, 0.028);
          vec3 deepRed = vec3(0.26, 0.055, 0.04);
          vec3 voids = h < 1.0 ? mix(indigo, amber, h) : h < 2.0 ? mix(amber, deepRed, h - 1.0) : deepRed;
          vec3 blue = vec3(0.50, 0.66, 0.98);
          vec3 gold = vec3(1.0, 0.74, 0.38);
          vec3 orange = vec3(0.95, 0.40, 0.10);
          vec3 red = vec3(0.72, 0.16, 0.07);
          vec3 hot = h < 1.0 ? mix(blue, gold, h) : h < 2.0 ? mix(gold, orange, h - 1.0) : mix(orange, red, h - 2.0);
          vec3 col = voids * (0.36 + 0.25 * emit);
          col += hot * pow(emit, 1.7) * 1.05;
          float tip = clamp((shaped - 0.62) / 0.38, 0.0, 1.0);
          col += vec3(1.0, 0.98, 0.94) * core * 0.45 + vec3(1.0, 0.99, 0.96) * pow(tip, 1.15);
          col += hot * (grain - 0.5) * 0.07 + hot * (dust - 0.5) * 0.045;
          float beforeStars = 1.0 - clamp(stars / 8.0, 0.0, 1.0);
          col += hot * streak(uv, r - q, time) * 0.42 * beforeStars;
          vec3 thick = deepRed * (0.5 + 0.4 * emit) + red * emit * 0.28;
          col = mix(col, thick, redFog);
          float webN = fbm(uv * 2.1 + r * 0.35);
          float web = pow(clamp(1.0 - abs(webN * 2.0 - 1.0), 0.0, 1.0), 1.7);
          vec3 webCol = vec3(0.012, 0.01, 0.025) + vec3(0.95, 0.88, 1.0) * pow(web, 3.2);
          float open = clear * beforeStars * (1.0 - clamp(galaxy + late, 0.0, 1.0));
          col = mix(col, webCol, open);
          col = mix(col, webCol * 0.42, dark);
          col *= gain;
          float clumps = fbm(uv * 4.6 + vec2(1.7, 0.4));
          float knot = pow(web, 1.6) * pow(clamp(clumps, 0.0, 1.0), 3.2);
          col = mix(col, webCol * 0.55, galaxy * 0.8);
          col += vec3(0.95, 0.88, 0.75) * knot * galaxy * 1.35;
          for (int i = 0; i < 8; i++) {
            float fi = float(i);
            float on = clamp((stars - fi) / 0.35, 0.0, 1.0) * (1.0 - sun);
            vec2 jitter = vec2(hash(vec2(fi + 2.0, 5.0)), hash(vec2(fi + 9.0, 3.0)));
            vec2 pos = mix(vec2(0.50, 0.48), vec2(0.34, 0.32) + jitter * vec2(0.32, 0.36), clamp(fi, 0.0, 1.0));
            float rr = dot(vUv - pos, vUv - pos);
            col += vec3(1.0, 0.98, 0.92) * exp(-rr * 5200.0) * on * 2.2;
            col += vec3(1.0, 0.86, 0.58) * exp(-rr * 980.0) * on * 0.22;
          }
          vec2 pc = (vUv - 0.5) * vec2(1.35, 0.9);
          float rad = length(pc);
          float ang = atan(pc.y, pc.x);
          float twist = sin(ang * 2.0 - log(rad + 0.08) * 4.6 + time * 0.08);
          float arm = pow(clamp(twist * 0.5 + 0.5, 0.0, 1.0), 1.2) * exp(-rad * rad * 2.4);
          vec3 neb = mix(vec3(0.05, 0.04, 0.07), vec3(0.42, 0.16, 0.06), arm);
          col = mix(col, col * 0.25 + neb * 0.7, clamp(late, 0.0, 1.0));
          col += vec3(1.0, 0.96, 0.72) * exp(-rad * rad * 220.0) * sun * 2.0;
          col += vec3(1.0, 0.55, 0.16) * exp(-rad * rad * 18.0) * sun * 0.18;
          gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
        }`,
    });
    plasmaMat.side = THREE.DoubleSide;
    this.plasma = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), plasmaMat);
    this.plasma.position.z = -0.45;
    this.plasma.visible = false;
    this.plasma.frustumCulled = false;
    this.plasma.renderOrder = 5;
    this.camera.add(this.plasma);
    this.scene.add(this.camera);
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
    this.bloom.strength = 0.28;
    this.bloom.radius = 0.4;
    this.bloom.threshold = 0.62;
    this.bloom.resolution.set(w / Math.max(1, 6 - tier.bloomMips), h / Math.max(1, 6 - tier.bloomMips));
    this.ray.uniforms.steps.value = Math.max(8, tier.raymarch || 8);
    this.final.uniforms.chromatic.value = tier.chromatic;
    this.final.uniforms.grain.value = tier.grain;
    this.final.uniforms.vignette.value = tier.vignette;
    this.final.uniforms.godrays.value = Math.max(0.45, tier.godrays);
    if (questProfileOn()) {
      this.bloom.strength = QUEST.bloom;
      this.bloom.radius = QUEST.bloomRadius;
      this.final.uniforms.godrays.value = QUEST.godrays;
      this.final.uniforms.chromatic.value = 0;
      this.final.uniforms.grain.value = 0;
    }
    this.core.geometry.dispose();
    // The tier's segment count is for cost. A screen-filling sphere at 32 segments shows flats, so the silhouette stays round.
    // The shell is a little larger than the unit sphere the shader draws, so the polygon never becomes the outline.
    const seg = Math.max(tier.segments, 192);
    this.core.geometry = new THREE.SphereGeometry(1.12, seg, Math.max(80, Math.round(seg / 2)));
    for (const s of this.shells) { s.removeFromParent(); s.geometry.dispose(); (s.material as THREE.Material).dispose(); }
    this.shells = [];
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
    this.camera.position.set(shift, 0, dist * this.framing.dolly);
    this.core.updateMatrixWorld(true);
    this.camLocal.copy(this.camera.position);
    this.core.worldToLocal(this.camLocal);
    this.ray.uniforms.camLocal.value.copy(this.camLocal);
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
    (this.final.uniforms.tint.value as THREE.Color).setRGB(look.color[0], look.color[1], look.color[2]);
    ((this.halo.material as THREE.ShaderMaterial).uniforms.color.value as THREE.Color).setRGB(look.color[0], look.color[1], look.color[2]);
    for (const shell of this.shells) (shell.material as THREE.MeshBasicMaterial).color.setRGB(look.color[0], look.color[1], look.color[2]);
    this.ray.uniforms.brightness.value = look.brightness;
    this.ray.uniforms.time.value = time;
    this.final.uniforms.time.value = time;
    if (this.plasmaOn && this.plasma) {
      this.core.visible = false;
      this.halo.visible = false;
      const pw = Math.min(1920, Math.max(640, Math.round(this.canvas.clientWidth || 1280)));
      const ph = Math.min(1080, Math.max(360, Math.round(this.canvas.clientHeight || 720)));
      if (this.renderer.domElement.width !== pw || this.renderer.domElement.height !== ph) {
        this.renderer.setPixelRatio(1);
        this.renderer.setSize(pw, ph, false);
        this.camera.aspect = pw / ph;
        this.composer.setSize(pw, ph);
      }
      this.camera.near = 0.02;
      this.camera.far = Math.max(40, dist + radius * 12);
      this.camera.updateProjectionMatrix();
      const distP = 0.45;
      this.plasma.position.set(0, 0, -distP);
      const cover = 2 * Math.tan(half) * distP;
      this.plasma.scale.set(cover * this.camera.aspect * 1.35, cover * 1.35, 1);
      this.final.uniforms.disc.value = 0;
      this.final.uniforms.godrays.value = 0;
    }
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
