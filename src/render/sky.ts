import { GLSL_NOISE } from '../proc/glsl';
import { hash, random } from '../proc/rng';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WORLD_SEED } from '../core/world';
import { lighting, sunPosition } from '../core/timeOfDay';
import { WEATHER, shortwave, weatherAt } from '../core/weather';
import { LUX, SYNODIC, exposureFor, moonAge, moonLux, sunColour } from '../core/light';
import { LIGHTING } from './pbr';
import { createStars, skyUniforms } from './stars';
import { NIGHT_SKY, equatorialToWorld, galacticRows, limitingMagnitude, localSiderealHours, moonIllumination } from '../core/celestial';
import { smoothstep } from '../proc/math';

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
/** The cloud field, shared by the dome and by the stars and meteors (render/stars), so clouds hide what is behind them. */
export const SKY_CLOUD = /* glsl */`
uniform float uSeed, uCover; uniform vec2 uDrift;
float skyCloudNoise(vec3 d) { // project onto a flat cloud layer so clouds shrink toward the horizon; wind drifts them east
  vec2 uv = d.xz / (max(d.y, 0.0) + 0.08) * 1.6 + uDrift; // drift = integrated wind of the top weather layer
  return fbm(uv, uSeed) * 0.75 + fbm(uv * 3.1 + 5.0, uSeed) * 0.25;
}
float skyCloudAlpha(vec3 d) { return d.y <= 0.0 ? 0.0 : smoothstep(uCover, uCover + 0.18, skyCloudNoise(d)) * smoothstep(0.0, 0.15, d.y) * 0.95; }`;
const CLOUD_FRAG = /* glsl */`
uniform float uTime, uDay, uGolden, uMilky, uK;
uniform vec3 uSunDir, uSunColor;
uniform mat3 uWorldToGal;
varying vec3 vDir;
${GLSL_NOISE}
${SKY_CLOUD}
// The Milky Way in galactic coordinates: a band widening into the bulge toward Sagittarius, mottled star clouds, and the dust
// of the Great Rift from Cygnus to Sagittarius splitting it (overhead at midnight in August at Kenora).
vec3 milkyWay(vec3 d) {
  vec3 g = uWorldToGal * d; float b = asin(clamp(g.z, -1.0, 1.0)), l = atan(g.y, g.x);
  float width = 0.1 + 0.08 * exp(-l * l / 0.6);
  float band = exp(-b * b / (width * width)) * (0.25 + 0.75 * (0.5 + 0.5 * cos(l)));
  float bulge = exp(-(l * l / 0.09 + b * b / 0.025)) * 1.3;
  vec2 q = vec2(l * 7.0, b * 18.0);
  float big = fbm(q, uSeed + 3.0), fine = fbm(q * 3.7 + 11.0, uSeed + 7.0);
  float lum = (band + bulge) * (0.3 + 1.2 * big * (0.55 + 0.45 * fine));
  float rift = exp(-pow((b - 0.03 - 0.02 * sin(l * 3.0)) / (0.024 + 0.012 * fine), 2.0)) * smoothstep(1.15, 0.75, abs(l - 0.75));
  lum *= 1.0 - 0.8 * rift * smoothstep(0.3, 0.6, big + 0.2);
  return mix(vec3(0.72, 0.8, 1.0), vec3(1.0, 0.85, 0.66), exp(-l * l / 0.5)) * lum;
}
void main() {
  vec3 d = normalize(vDir);
  if (d.y <= 0.0) discard;
  float n = skyCloudNoise(d);
  float cloud = smoothstep(uCover, uCover + 0.18, n) * smoothstep(0.0, 0.15, d.y);
  // Lit from the sun side, warm at sunrise/sunset, faint moonlit grey at night; denser cores are darker.
  float facing = 0.5 + 0.5 * dot(d, uSunDir);
  vec3 dayCol = mix(vec3(0.78, 0.8, 0.86), vec3(1.0), facing);
  vec3 col = mix(vec3(0.16, 0.17, 0.22), dayCol, uDay);
  col = mix(col, uSunColor * (0.75 + 0.45 * facing), uGolden * 0.55);
  col *= mix(1.0, 0.82, smoothstep(0.6, 0.95, n));
  // Layers, back to front: night darkening over the scattering sky, then the Milky Way (emission), then clouds.
  // The stars themselves are their own draw (render/stars), after this dome, dimmed there by the same clouds.
  float night = 1.0 - uDay;
  vec3 c = vec3(0.015, 0.025, 0.06); float a = night * 0.9; c *= a;
  if (uMilky > 0.0) { // extinction as for the stars: k (X - 1) mag, Kasten & Young air mass
    float cz = d.y, z = degrees(acos(clamp(cz, 0.0, 1.0))), X = z >= 89.9 ? 40.0 : 1.0 / (cz + 0.50572 * pow(96.07995 - z, -1.6364));
    c += milkyWay(d) * uMilky * pow(10.0, -0.4 * uK * (X - 1.0)) * smoothstep(0.0, 0.12, d.y);
  }
  float ca = cloud * 0.95;
  c = col * ca + c * (1.0 - ca); a = ca + a * (1.0 - ca);
  gl_FragColor = vec4(c / max(a, 1e-4), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky(scene: THREE.Scene) {
  const sky = new Sky(); sky.scale.setScalar(600); sky.layers.enable(1); scene.add(sky); // layer 1 = GI probe capture
  const u = sky.material.uniforms;
  u.turbidity.value = 2.5; u.rayleigh.value = 2.2; u.mieCoefficient.value = .004; u.mieDirectionalG.value = .8;
  // Cloud uniforms are shared objects: the dome, the stars and the meteors read the same values.
  const cloudU = { uSeed: { value: (WORLD_SEED % 997) * .37 }, uCover: { value: .47 }, uDrift: { value: new THREE.Vector2() } };
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(550, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { ...cloudU, uTime: { value: 0 }, uDay: { value: 1 }, uGolden: { value: 0 }, uMilky: { value: 0 }, uK: { value: NIGHT_SKY.extinction },
      uWorldToGal: { value: new THREE.Matrix3() }, uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() } },
  }));
  clouds.renderOrder = -1; sky.renderOrder = -2; scene.add(clouds);
  const starU = skyUniforms(cloudU), stars = createStars(scene, SKY_CLOUD, starU);
  const G = new THREE.Matrix3().set(...galacticRows().flat() as [number, number, number, number, number, number, number, number, number]), tmpM = new THREE.Matrix3();
  let adapt = 0; const fwd = new THREE.Vector3();
  const sunLight = new THREE.DirectionalLight(0xffebc3, 3); scene.add(sunLight, sunLight.target);
  const moonLight = new THREE.DirectionalLight(0x9fb4e6, .35); scene.add(moonLight, moonLight.target);
  const hemi = new THREE.HemisphereLight(0xf1f5dd, 0x526753, 2.7); scene.add(hemi);
  const fogDay = new THREE.Color(0xc4d4c8), fogGolden = new THREE.Color(0xd9a47c), fogNight = new THREE.Color(0x0d1422);
  const tmp = new THREE.Color(), tmpV = new THREE.Vector3();
  // Precipitation: one Points cloud around the camera (only drawn while it rains/snows), fall speed from Kessler V_t / snow ~1 m/s.
  const N = 1500, P = new Float32Array(N * 3), rnd = random(hash(`precip:${WORLD_SEED}`));
  for (let i = 0; i < N * 3; i++) P[i] = (rnd() - .5) * 40;
  const precipGeo = new THREE.BufferGeometry(); precipGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const precipMat = new THREE.PointsMaterial({ color: 0xc8d4e0, size: .06, transparent: true, opacity: .6, depthWrite: false });
  const precip = new THREE.Points(precipGeo, precipMat); precip.frustumCulled = false; scene.add(precip);
  const drift = new THREE.Vector2(); let lastTime = 0; const fogFar = (scene.fog as THREE.Fog).far, fogNear = (scene.fog as THREE.Fog).near;
  return {
    sky, sunLight, hemi, stars,
    /** Moves the sun and recolours sky, light and fog for the hour; the sky follows the camera. */
    update(hour: number, time: number, camera: THREE.Camera, focus: THREE.Vector3) {
      const sun = sunPosition(hour), light = lighting(sun.elevation), dir = new THREE.Vector3(sun.direction.x, sun.direction.y, sun.direction.z);
      sky.position.copy(camera.position); clouds.position.copy(camera.position);
      u.sunPosition.value.copy(dir);
      // Physical light (core/light): sun colour from spectral transmittance, illuminance in lux, adaptive exposure.
      const cosZ = Math.sin(sun.elevation * Math.PI / 180), wq = weatherAt(focus.x, focus.z), haze = (u.turbidity.value as number) / 2.5;
      const sc = sunColour(cosZ, haze), age = moonAge(WEATHER.day), moon = sunPosition(hour - age / SYNODIC * 24); // moon transits ~0.8 h later per day of age
      const Esun = shortwave(cosZ, WEATHER.on ? wq.cloud : 0) * LUX.efficacy, Emoon = moonLux(age, Math.sin(moon.elevation * Math.PI / 180)) * (1 - .75 * (WEATHER.on ? wq.cloud : 0));
      LIGHTING.lux = Esun + Emoon + LUX.nightSky; LIGHTING.gain = exposureFor(LIGHTING.lux); LIGHTING.moonAge = age; LIGHTING.Esun = Esun; LIGHTING.Emoon = Emoon;
      sunLight.color.setRGB(sc.r, sc.g, sc.b);
      sunLight.intensity = 3 * Esun / LUX.ref * LIGHTING.gain; sunLight.position.copy(focus).addScaledVector(dir, 80); sunLight.target.position.copy(focus);
      moonLight.intensity = 3 * Emoon / LUX.ref * LIGHTING.gain; moonLight.position.copy(focus).add(tmpV.set(moon.direction.x, moon.direction.y, moon.direction.z).multiplyScalar(80)); moonLight.target.position.copy(focus);
      hemi.intensity = .35 + 2.35 * light.day;
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
      // Night sky (core/celestial): the sphere turns with sidereal time; twilight, moonlight and haze set the limiting magnitude;
      // looking up adapts the eye (fainter stars and the Milky Way come out, everything brightens).
      camera.getWorldDirection(fwd);
      const look = NIGHT_SKY.look, target = smoothstep(Math.sin(look.from * Math.PI / 180), Math.sin(look.to * Math.PI / 180), fwd.y);
      adapt += (target - adapt) * (1 - Math.exp(-dt / (target > adapt ? look.rise : look.fall)));
      const lst = localSiderealHours(WEATHER.day, hour), skyHaze = Math.max(0, Math.min(1, ((u.turbidity.value as number) - 2) / 8));
      const lm = limitingMagnitude(sun.elevation, moonIllumination(age), moon.elevation, skyHaze, adapt), gain = 1 + look.gain * adapt;
      stars.update(time, WEATHER.day, hour, lst, lm, gain);
      starU.uSeeing.value = 1 + .05 * Math.hypot(w.wind.x, w.wind.z); // windier upper air, deeper twinkling [game calibration]
      tmpM.fromArray(equatorialToWorld(lst)).transpose(); cu.uWorldToGal.value.multiplyMatrices(G, tmpM);
      cu.uMilky.value = smoothstep(4.6, 6.8, lm) * .055 * (1 + 1.2 * adapt) * (1 - light.day);
      return { sun, light, dir };
    },
  };
}
