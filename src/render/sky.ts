import { createVenus, dayOfYearOf, skyDate } from './venusSky';
import { SITE as VENUS_SITE } from '../core/weather'; // the Sun and the planets share the observer (Kenora) so twilight and Venus agree
import { GLSL_NOISE } from '../proc/glsl';
import { hash, random } from '../proc/rng';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WORLD_SEED } from '../core/world';
import { DAY_OF_YEAR, lighting, sunPosition } from '../core/timeOfDay';
import { WEATHER, shortwave, weatherAt } from '../core/weather';
import { LUX, SYNODIC, darkAdapted, exposureFor, moonAge, moonLux, nightKey, nightSkyLight, sunColour, wolfEyes } from '../core/light';
import { LIGHTING } from './pbr';

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
${GLSL_NOISE}
#define hash(p) hash2s(p, uSeed)
void main() {
  vec3 d = normalize(vDir);
  if (d.y <= 0.0) discard;
  // Project onto a flat cloud layer so clouds shrink toward the horizon; wind drifts them east.
  vec2 uv = d.xz / (d.y + 0.08) * 1.6 + uDrift; // drift = integrated wind of the top weather layer
  float n = fbm(uv, uSeed) * 0.75 + fbm(uv * 3.1 + 5.0, uSeed) * 0.25;
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
  const search = typeof location === 'undefined' ? '' : location.search, hasDate = new URLSearchParams(search).has('date');
  const date = skyDate(search, DAY_OF_YEAR), doy = hasDate ? dayOfYearOf(date) : DAY_OF_YEAR, venus = createVenus(scene, search); // ?date= moves the Sun and the planets together
  const sky = new Sky(); sky.scale.setScalar(600); sky.layers.enable(1); scene.add(sky); // layer 1 = GI probe capture
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
  const tmp = new THREE.Color(), tmpV = new THREE.Vector3(), keyDir = new THREE.Vector3();
  // Precipitation: one Points cloud around the camera (only drawn while it rains/snows), fall speed from Kessler V_t / snow ~1 m/s.
  const N = 1500, P = new Float32Array(N * 3), rnd = random(hash(`precip:${WORLD_SEED}`));
  for (let i = 0; i < N * 3; i++) P[i] = (rnd() - .5) * 40;
  const precipGeo = new THREE.BufferGeometry(); precipGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const precipMat = new THREE.PointsMaterial({ color: 0xc8d4e0, size: .06, transparent: true, opacity: .6, depthWrite: false });
  const precip = new THREE.Points(precipGeo, precipMat); precip.frustumCulled = false; scene.add(precip);
  const drift = new THREE.Vector2(); let lastTime = 0; const fogFar = (scene.fog as THREE.Fog).far, fogNear = (scene.fog as THREE.Fog).near;
  return {
    sky, sunLight, hemi,
    /** Moves the sun and recolours sky, light and fog for the hour; the sky follows the camera. */
    update(hour: number, time: number, camera: THREE.Camera, focus: THREE.Vector3) {
      const sun = sunPosition(hour, doy, VENUS_SITE.lat), light = lighting(sun.elevation), dir = new THREE.Vector3(sun.direction.x, sun.direction.y, sun.direction.z);
      sky.position.copy(camera.position); clouds.position.copy(camera.position);
      u.sunPosition.value.copy(dir);
      // Physical light (core/light): sun colour from spectral transmittance, illuminance in lux, adaptive exposure.
      const cosZ = Math.sin(sun.elevation * Math.PI / 180), wq = weatherAt(focus.x, focus.z), haze = (u.turbidity.value as number) / 2.5;
      const sc = sunColour(cosZ, haze), age = moonAge(WEATHER.day), moon = sunPosition(hour - age / SYNODIC * 24); // moon transits ~0.8 h later per day of age
      const Esun = shortwave(cosZ, WEATHER.on ? wq.cloud : 0) * LUX.efficacy, Emoon = moonLux(age, Math.sin(moon.elevation * Math.PI / 180)) * (1 - .75 * (WEATHER.on ? wq.cloud : 0));
      LIGHTING.lux = Esun + Emoon + LUX.nightSky; LIGHTING.gain = exposureFor(LIGHTING.lux) * wolfEyes(LIGHTING.lux); LIGHTING.moonAge = age; LIGHTING.Esun = Esun; LIGHTING.Emoon = Emoon;
      sunLight.color.setRGB(sc.r, sc.g, sc.b);
      sunLight.intensity = 3 * Esun / LUX.ref * LIGHTING.gain; sunLight.position.copy(focus).addScaledVector(dir, 80); sunLight.target.position.copy(focus);
      // Moon, or with the moon down/thin an overhead skylight key from behind the viewer (core/light NIGHT.key): reuses this light so no shader recompiles.
      const night = 1 - light.day, key = nightKey(LIGHTING.gain) * night, Emoon3 = 3 * Emoon / LUX.ref * LIGHTING.gain, wk = key / (key + Emoon3 || 1);
      moonLight.intensity = Emoon3 + key;
      tmpV.set(moon.direction.x, moon.direction.y, moon.direction.z).multiplyScalar(1 - wk);
      if (wk > 0) { camera.getWorldDirection(keyDir); keyDir.y = 0; if (keyDir.lengthSq() < 1e-6) keyDir.set(0, 0, -1); keyDir.normalize().multiplyScalar(-1); keyDir.y = .75; tmpV.addScaledVector(keyDir.normalize(), wk); }
      moonLight.position.copy(focus).add(tmpV.normalize().multiplyScalar(80)); moonLight.target.position.copy(focus);
      hemi.intensity = 2.7 * light.day + (1 - light.day) * Math.max(.35, nightSkyLight(Emoon, LIGHTING.gain));
      hemi.userData.night = (1 - light.day) * darkAdapted(LIGHTING.lux); // photoreal: the dark-adapted night sky is not in the IBL map, so keep this share unreduced
      hemi.color.setRGB(.25, .3, .45).lerp(tmp.set(0xf1f5dd), light.day);
      hemi.groundColor.setRGB(.05, .06, .09).lerp(tmp.set(0x526753), light.day);
      const fog = (scene.fog as THREE.Fog).color;
      fog.copy(fogNight).lerp(fogDay, light.day).lerp(fogGolden, light.golden * .5);
      const cu = (clouds.material as THREE.ShaderMaterial).uniforms;
      cu.uTime.value = time; cu.uDay.value = light.day; cu.uGolden.value = light.golden;
      // Weather (core/weather): cloud cover, drift, fog and precipitation come from the cell under the viewer.
      const w = weatherAt(focus.x, focus.z), dt = Math.max(0, Math.min(.2, time - lastTime)); lastTime = time; let fogV = Infinity;
      if (WEATHER.on) {
        cu.uCover.value = .62 - .4 * Math.max(w.cloud, Math.max(0, w.rh - .6)); // more condensate → lower noise threshold → more cover
        drift.x += w.wind.x * dt * 2e-4; drift.y += w.wind.z * dt * 2e-4; cu.uDrift.value.copy(drift);
        // Aerial perspective: Koschmieder visibility V = 3.912/β (Koschmieder 1924). β = clear air 3.912/30 km + fog
        // 144.7·LWC^0.88 km⁻¹ (Kunkel 1984, J. Clim. Appl. Meteorol. 23:34; LWC g/m³) + rain 0.25·R^0.63 km⁻¹ [verify].
        const lwc = w.fog * .3, beta = 3.912 / 30 + 144.7 * lwc ** .88 + .25 * w.rainMmH ** .63, V = 3912 / beta; // m
        fogV = V;
        u.turbidity.value = 2 + 6 * Math.max(w.cloud, w.rh * .5) + 4 * w.fog; // hazier with humidity/cloud (Preetham turbidity 2–10)
        const falling = w.rainMmH > .05; precip.visible = falling;
        if (falling) {
          const speed = w.snow ? 1 : 6, a = precipGeo.attributes.position as THREE.BufferAttribute;
          precipMat.size = w.snow ? .12 : .05; precipMat.opacity = Math.min(.8, .2 + w.rainMmH / 5); precip.position.copy(camera.position);
          for (let i = 0; i < N; i++) { let y = a.getY(i) - speed * dt; if (y < -20) y += 40; a.setXYZ(i, a.getX(i) + w.wind.x * dt * (w.snow ? .5 : .1), y, a.getZ(i) + w.wind.z * dt * (w.snow ? .5 : .1));
            if (Math.abs(a.getX(i)) > 20) a.setX(i, -Math.sign(a.getX(i)) * 20); if (Math.abs(a.getZ(i)) > 20) a.setZ(i, -Math.sign(a.getZ(i)) * 20); }
          a.needsUpdate = true;
        }
      } else { precip.visible = false; cu.uDrift.value.set(time * .004, time * .0015); }
      // Fog distances start at the ground below the camera: the 200-480 m linear fog stands for horizontal haze (and hides the
      // streaming edge); a raised camera (photo mode, top-down) looks down through that much less boundary-layer haze, so the
      // fog is offset by the camera's height above the focus [game calibration]. At eye height the offset is ~2 m (no change).
      { const f = scene.fog as THREE.Fog, alt = Math.max(0, camera.position.y - focus.y); f.far = Math.min(fogFar, fogV) + alt; f.near = Math.min(fogNear, fogV * .1) + alt; }
      cu.uSunDir.value.copy(dir); cu.uSunColor.value.copy(sunLight.color);
      venus.update(date, hour, camera.position, camera);
      return { sun, light, dir };
    },
  };
}
