import { GLSL_HASH } from '../proc/glsl';
import { hash, random } from '../proc/rng';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WORLD_SEED } from '../core/world';
import { lighting, sunPosition } from '../core/timeOfDay';
import { WEATHER, weatherAt } from '../core/weather';

/**
 * Procedural sky: three.js's physically based Sky (Preetham scattering) driven by the real sun position,
 * plus one cloud-and-star dome drawn by a noise shader (no textures, one extra draw call).
 */
const CLOUD_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // always at the far plane, behind the world
}`;
const CLOUD_FRAG = /* glsl */`
uniform float uTime, uSeed, uCover, uDay, uGolden;
uniform vec2 uDrift;
uniform vec3 uSunDir, uSunColor;
varying vec3 vDir;
${GLSL_HASH}
float hash(vec2 p) { return hash2s(p, uSeed); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  if (d.y <= 0.0) discard;
  // Project onto a flat cloud layer so clouds shrink toward the horizon; wind drifts them east.
  vec2 uv = d.xz / (d.y + 0.08) * 1.6 + uDrift; // drift = integrated wind of the top weather layer
  float n = fbm(uv) * 0.75 + fbm(uv * 3.1 + 5.0) * 0.25;
  float cloud = smoothstep(uCover, uCover + 0.18, n) * smoothstep(0.0, 0.15, d.y);
  // Lit from the sun side, warm at sunrise/sunset, faint moonlit grey at night; denser cores are darker.
  float facing = 0.5 + 0.5 * dot(d, uSunDir);
  vec3 dayCol = mix(vec3(0.78, 0.8, 0.86), vec3(1.0), facing);
  vec3 col = mix(vec3(0.16, 0.17, 0.22), dayCol, uDay);
  col = mix(col, uSunColor * (0.75 + 0.45 * facing), uGolden * 0.55);
  col *= mix(1.0, 0.82, smoothstep(0.6, 0.95, n));
  // Stars: hashed cells, only at night and where the sky is clear.
  vec3 s = d * 380.0; vec2 cell = floor(s.xz / max(d.y, 0.2)) + floor(s.y);
  float star = step(0.9972, hash(cell)) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(cell + 3.0) * 40.0));
  // Layers, back to front: night darkening over the scattering sky, then stars, then clouds.
  float night = 1.0 - uDay;
  vec3 c = vec3(0.015, 0.025, 0.06); float a = night * 0.9;
  float sa = star * night * smoothstep(0.05, 0.3, d.y);
  c = mix(c * a, vec3(0.92, 0.94, 1.0), sa); a = sa + a * (1.0 - sa);
  float ca = cloud * 0.95;
  c = col * ca + c * (1.0 - ca); a = ca + a * (1.0 - ca);
  gl_FragColor = vec4(c / max(a, 1e-4), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky(scene: THREE.Scene) {
  const sky = new Sky(); sky.scale.setScalar(600); scene.add(sky);
  const u = sky.material.uniforms;
  u.turbidity.value = 2.5; u.rayleigh.value = 2.2; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .8;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(550, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uSeed: { value: (WORLD_SEED % 997) * .37 }, uCover: { value: .47 }, uDrift: { value: new THREE.Vector2() }, uDay: { value: 1 }, uGolden: { value: 0 },
      uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() } },
  }));
  clouds.renderOrder = -1; sky.renderOrder = -2; scene.add(clouds);
  const sunLight = new THREE.DirectionalLight(0xffebc3, 3); scene.add(sunLight, sunLight.target);
  const moonLight = new THREE.DirectionalLight(0x9fb4e6, .35); scene.add(moonLight, moonLight.target);
  const hemi = new THREE.HemisphereLight(0xf1f5dd, 0x526753, 2.7); scene.add(hemi);
  const fogDay = new THREE.Color(0xc4d4c8), fogGolden = new THREE.Color(0xd9a47c), fogNight = new THREE.Color(0x0d1422);
  const sunWarm = new THREE.Color(0xff9a52), sunWhite = new THREE.Color(0xffebc3), tmp = new THREE.Color();
  // Precipitation: one Points cloud around the camera (only drawn while it rains/snows), fall speed from Kessler V_t / snow ~1 m/s.
  const N = 1500, P = new Float32Array(N * 3), rnd = random(hash(`precip:${WORLD_SEED}`));
  for (let i = 0; i < N * 3; i++) P[i] = (rnd() - .5) * 40;
  const precipGeo = new THREE.BufferGeometry(); precipGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const precipMat = new THREE.PointsMaterial({ color: 0xc8d4e0, size: .06, transparent: true, opacity: .6, depthWrite: false });
  const precip = new THREE.Points(precipGeo, precipMat); precip.frustumCulled = false; scene.add(precip);
  const drift = new THREE.Vector2(); let lastTime = 0;
  return {
    /** Moves the sun and recolours sky, light and fog for the hour; the sky follows the camera. */
    update(hour: number, time: number, camera: THREE.Camera, focus: THREE.Vector3) {
      const sun = sunPosition(hour), light = lighting(sun.elevation), dir = new THREE.Vector3(sun.direction.x, sun.direction.y, sun.direction.z);
      sky.position.copy(camera.position); clouds.position.copy(camera.position);
      u.sunPosition.value.copy(dir);
      sunLight.color.copy(sunWhite).lerp(sunWarm, light.golden);
      sunLight.intensity = 3 * light.day; sunLight.position.copy(focus).addScaledVector(dir, 80); sunLight.target.position.copy(focus);
      moonLight.intensity = .35 * light.night; moonLight.position.copy(focus).addScaledVector(dir, -80).setY(focus.y + 60); moonLight.target.position.copy(focus);
      hemi.intensity = .35 + 2.35 * light.day;
      hemi.color.setRGB(.25, .3, .45).lerp(tmp.set(0xf1f5dd), light.day);
      hemi.groundColor.setRGB(.05, .06, .09).lerp(tmp.set(0x526753), light.day);
      const fog = (scene.fog as THREE.Fog).color;
      fog.copy(fogNight).lerp(fogDay, light.day).lerp(fogGolden, light.golden * .5);
      const cu = (clouds.material as THREE.ShaderMaterial).uniforms;
      cu.uTime.value = time; cu.uDay.value = light.day; cu.uGolden.value = light.golden;
      // Weather (core/weather): cloud cover, drift, fog and precipitation come from the cell under the viewer.
      const w = weatherAt(focus.x, focus.z), dt = Math.max(0, Math.min(.2, time - lastTime)); lastTime = time;
      if (WEATHER.on) {
        cu.uCover.value = .62 - .4 * Math.max(w.cloud, Math.max(0, w.rh - .6)); // more condensate → lower noise threshold → more cover
        drift.x += w.wind.x * dt * 2e-4; drift.y += w.wind.z * dt * 2e-4; cu.uDrift.value.copy(drift);
        const f = scene.fog as THREE.Fog; f.far = 260 - 200 * w.fog - 60 * Math.min(1, w.rainMmH / 4);
        const falling = w.rainMmH > .05; precip.visible = falling;
        if (falling) {
          const speed = w.snow ? 1 : 6, a = precipGeo.attributes.position as THREE.BufferAttribute;
          precipMat.size = w.snow ? .12 : .05; precipMat.opacity = Math.min(.8, .2 + w.rainMmH / 5); precip.position.copy(camera.position);
          for (let i = 0; i < N; i++) { let y = a.getY(i) - speed * dt; if (y < -20) y += 40; a.setXYZ(i, a.getX(i) + w.wind.x * dt * (w.snow ? .5 : .1), y, a.getZ(i) + w.wind.z * dt * (w.snow ? .5 : .1));
            if (Math.abs(a.getX(i)) > 20) a.setX(i, -Math.sign(a.getX(i)) * 20); if (Math.abs(a.getZ(i)) > 20) a.setZ(i, -Math.sign(a.getZ(i)) * 20); }
          a.needsUpdate = true;
        }
        sunLight.intensity *= 1 - .7 * w.cloud;
      } else { precip.visible = false; cu.uDrift.value.set(time * .004, time * .0015); }
      cu.uSunDir.value.copy(dir); cu.uSunColor.value.copy(sunLight.color);
      return { sun, light };
    },
  };
}
