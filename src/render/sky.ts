import { createVenus } from './venusSky';
import { siteLatitude } from '../core/sitePhase';
import { SITE as VENUS_SITE } from '../core/weather'; // the Sun and the planets share the observer (Kenora) so twilight and Venus agree
import { SKY, TWILIGHT_B0, skyLuminance, twilightIlluminance } from '../core/skyVisibility';
import { GLSL_NOISE } from '../proc/glsl';
import { hash, random } from '../proc/rng';
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { WORLD_SEED } from '../core/world';
import { clockDate, dayAt, lighting, sunPosition } from '../core/timeOfDay';
import { WEATHER, shortwave, weatherAt } from '../core/weather';
import { LUX, SYNODIC, darkAdapted, exposureFor, moonAge, moonLux, nightKey, nightSkyLight, sceneFill, sunColour, wolfEyes } from '../core/light';
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
uniform float uTime, uSeed, uCover, uDay, uGolden, uSunAlt, uTwB0, uTwK, uTwGain, uBoxK, uBoxSin;
uniform vec3 uTwTint;
uniform vec2 uDrift;
uniform vec3 uSunDir, uSunColor;
varying vec3 vDir;
${GLSL_NOISE}
#define hash(p) hash2s(p, uSeed)
// Budget cirrus: anisotropic fibratus + uncinus hooks on a foreshortened layer (ground-sky audit GCUR-3).
float cirrusField(vec2 uv, vec2 fiber, float seed, float along, float across) {
  vec2 perp = vec2(-fiber.y, fiber.x);
  vec2 q = vec2(dot(uv, fiber) * along, dot(uv, perp) * across);
  float hook = fbm(uv * 0.65 + 1.7, seed) - 0.5;
  q.x += hook * 1.55 * q.y; // mares'-tail shear
  q += 0.35 * (vec2(fbm(q * 0.45 + 2.3, seed), fbm(q * 0.45 + 6.8, seed)) - 0.5);
  float sheet = fbm(q * 0.5, seed);
  float fibers = fbm(vec2(q.x * 0.85, q.y * 4.8) + 3.4, seed);
  float lace = fbm(vec2(q.x * 1.55 + hook * 1.2, q.y * 7.2) + 9.1, seed);
  return sheet * 0.38 + fibers * 0.40 + lace * 0.22;
}
void main() {
  vec3 d = normalize(vDir);
  if (d.y <= 0.0) discard;
  float elev = d.y;
  // Horizon packing: compress UV toward the horizon so streaks foreshorten instead of tiling as equal bands.
  float pack = mix(3.1, 1.05, smoothstep(0.02, 0.62, elev));
  vec2 uv = d.xz / (elev + 0.055) * pack + uDrift;
  // Wind-aware fiber axes (drift direction + a crossed sheet for overlapping altitude).
  vec2 wind = length(uDrift) > 1e-5 ? normalize(uDrift) : vec2(1.0, 0.12);
  vec2 f0 = normalize(wind + 0.28 * (vec2(fbm(uv * 0.2 + 0.4, uSeed), fbm(uv * 0.2 + 4.1, uSeed)) - 0.5));
  vec2 f1 = normalize(vec2(f0.y, -f0.x) * 0.55 + f0 * 0.45 + vec2(0.15, 0.35));
  float n0 = cirrusField(uv, f0, uSeed, 0.9, 3.4);
  float n1 = cirrusField(uv * 1.15 + 5.5, f1, uSeed + 17.0, 0.75, 3.9);
  float n = max(n0 * 0.72 + n1 * 0.48, n0 * 0.55); // overlapping sheets with clear holes between
  // Soft veil + denser ice cores (lace with bright patches, not one flat sheet).
  float veil = smoothstep(uCover - 0.06, uCover + 0.34, n);
  float core = smoothstep(uCover + 0.14, uCover + 0.46, n);
  float cloud = mix(veil * 0.38, 1.0, core);
  cloud *= smoothstep(0.0, 0.07, elev);
  // Aerial merge: thin and soften into horizon haze (cuts the hard sticker-on-fog read).
  float haze = smoothstep(0.02, 0.22, elev);
  cloud *= mix(0.35, 1.0, haze);
  cloud *= 1.0 - uBoxK * smoothstep(uBoxSin * 0.8, uBoxSin * 1.25, elev); // issue #202 (1)
  // Bright sun-lit ice; subtle thickness in cores — no embossed normals.
  float facing = 0.58 + 0.42 * dot(d, uSunDir);
  vec3 dayCol = mix(vec3(0.90, 0.92, 0.96), vec3(1.0), facing);
  dayCol = mix(dayCol, vec3(0.82, 0.84, 0.88), core * (1.0 - facing) * 0.28);
  vec3 col = mix(vec3(0.16, 0.17, 0.22), dayCol, uDay);
  col = mix(col, uSunColor * (0.82 + 0.38 * facing), uGolden * 0.55);
  // Stars: hashed cells, only at night and where the sky is clear.
  vec3 s = d * 380.0; vec2 cell = floor(s.xz / max(elev, 0.2)) + floor(s.y);
  float star = step(0.9972, hash(cell)) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(cell + 3.0) * 40.0));
  // Layers, back to front: night darkening over the scattering sky, then stars, then clouds.
  float night = 1.0 - uDay;
  // Twilight glow: the same Schaefer (1993) sky luminance the Venus threshold uses (core/skyVisibility skyLuminance, h <= 0),
  // cd/m² -> scene units by the lights' scale (3 per LUX.ref lux, Lambert 1/pi folded: L = E/pi) and the eye's gain.
  float zd = degrees(acos(clamp(elev, 0.0, 1.0))), rho = max(1.0, degrees(acos(clamp(dot(d, uSunDir), -1.0, 1.0))));
  float X = 1.0 / (cos(radians(min(zd, 90.0))) + 0.025 * exp(-11.0 * cos(radians(min(zd, 90.0)))));
  float L = uTwB0 * pow(10.0, 0.4 * (min(uSunAlt, 0.0) + zd / (360.0 * uTwK))) * (100.0 / rho) * (1.0 - pow(10.0, -0.4 * uTwK * X));
  // colour: reddened toward the Sun's horizon (sunlight's grazing transmittance), ozone-blue (Chappuis band, Hulburt 1953) overhead [approx]
  vec3 tint = mix(vec3(0.62, 0.74, 1.0), uTwTint, exp(-rho / 40.0) * (1.0 - elev)); tint /= dot(tint, vec3(0.2126, 0.7152, 0.0722));
  vec3 c = tint * L * uTwGain; float a = uSunAlt < 0.0 ? 1.0 : night * 0.9;
  float sa = star * night * smoothstep(0.05, 0.3, elev);
  c = mix(c * a, vec3(0.92, 0.94, 1.0), sa); a = sa + a * (1.0 - sa);
  float ca = cloud * mix(0.18, 0.40, core); // a clear morning keeps the Preetham blue; cores stay the bright ice
  c = col * ca + c * (1.0 - ca); a = ca + a * (1.0 - ca);
  gl_FragColor = vec4(c / max(a, 1e-4), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createSky(scene: THREE.Scene) {
  const search = typeof location === 'undefined' ? '' : location.search, venus = createVenus(scene, search); // the date is the clock's (initDay applies ?date= after this is built)
  const sky = new Sky(); sky.scale.setScalar(600); sky.layers.enable(1); sky.userData.physicalSky = true; scene.add(sky); // layer 1 = GI probe capture
  const skyMat = sky.material as THREE.ShaderMaterial;
  skyMat.depthWrite = false;
  skyMat.fog = false;
  // three.js Sky.js uses toneMappingExposure as the sky brightness. The ground stays at
  // EXPOSURE.base 0.5 (core/light). This scale is that exposure knob for the sky alone:
  // without it the Preetham radiance clips to white under ACES at 10° above the horizon.
  skyMat.fragmentShader = skyMat.fragmentShader.replace(
    'gl_FragColor = vec4( texColor, 1.0 );',
    'vec3 graded = texColor * 0.29; float skyUp = clamp(normalize(vWorldPosition - cameraPosition).y, 0.0, 1.0); float low = 1.0 - smoothstep(0.04, 0.22, skyUp); graded.r *= mix(1.0, 0.78, low); graded.b += low * 0.06; gl_FragColor = vec4(graded, 1.0);',
  );
  const u = sky.material.uniforms;
  // Preetham, Shirley and Smits 1999, via three.js examples/jsm/objects/Sky.js.
  // Turbidity 2 is their clear day. Rayleigh 2 is the Sky.js example's blue without the extra
  // brightness that ACES clips to white at about 10° above the horizon. Mie 0.005 is the example.
  u.turbidity.value = 1.6; u.rayleigh.value = 3.2; u.mieCoefficient.value = .003; u.mieDirectionalG.value = .6;
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(550, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uSeed: { value: (WORLD_SEED % 997) * .37 }, uCover: { value: .47 }, uDrift: { value: new THREE.Vector2() }, uDay: { value: 1 }, uGolden: { value: 0 },
      uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() },
      uSunAlt: { value: 0 }, uBoxK: { value: 0 }, uBoxSin: { value: 1 }, uTwB0: { value: TWILIGHT_B0 }, uTwK: { value: SKY.k }, uTwGain: { value: 0 }, uTwTint: { value: new THREE.Color(1, .55, .3) } },
  }));
  clouds.renderOrder = -1; sky.renderOrder = -2; clouds.userData.cloudDome = true; scene.add(clouds);
  const sunLight = new THREE.DirectionalLight(0xffebc3, 3); scene.add(sunLight, sunLight.target);
  const moonLight = new THREE.DirectionalLight(0x9fb4e6, .35); scene.add(moonLight, moonLight.target);
  const hemi = new THREE.HemisphereLight(0xf1f5dd, 0x526753, 2.7); scene.add(hemi);
  const rimLight = new THREE.DirectionalLight(0xb7c4d6, 0.16); scene.add(rimLight, rimLight.target);
  // Aerial perspective takes the Preetham horizon, a blue-grey, not the old low-chroma grey.
  // That grey, fully mixed by 480 m, was the flat band on dry ground (Koschmieder 1924: the
  // fade follows the visible range, it does not finish while the land is still close).
  const fogDay = new THREE.Color(0x7eb4e4), fogGolden = new THREE.Color(0xd9a47c), fogNight = new THREE.Color(0x0d1422);
  const tmp = new THREE.Color(), tmpV = new THREE.Vector3(), keyDir = new THREE.Vector3();
  // Precipitation: one Points cloud around the camera (only drawn while it rains/snows), fall speed from Kessler V_t / snow ~1 m/s.
  const N = 1500, P = new Float32Array(N * 3), rnd = random(hash(`precip:${WORLD_SEED}`));
  for (let i = 0; i < N * 3; i++) P[i] = (rnd() - .5) * 40;
  const precipGeo = new THREE.BufferGeometry(); precipGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const precipMat = new THREE.PointsMaterial({ color: 0xc8d4e0, size: .06, transparent: true, opacity: .6, depthWrite: false });
  const precip = new THREE.Points(precipGeo, precipMat); precip.frustumCulled = false; scene.add(precip);
  const drift = new THREE.Vector2(); let lastTime = 0;
  return {
    sky, sunLight, hemi,
    /** Moves the sun and recolours sky, light and fog for the hour; the sky follows the camera. */
    update(hour: number, time: number, camera: THREE.Camera, focus: THREE.Vector3) {
      const doy = dayAt(time), date = clockDate(time);
      const sun = sunPosition(hour, doy, siteLatitude(VENUS_SITE.lat)), light = lighting(sun.elevation), dir = new THREE.Vector3(sun.direction.x, sun.direction.y, sun.direction.z);
      sky.position.copy(camera.position); clouds.position.copy(camera.position);
      u.sunPosition.value.copy(dir);
      // Physical light (core/light): sun colour from spectral transmittance, illuminance in lux, adaptive exposure.
      const cosZ = Math.sin(sun.elevation * Math.PI / 180), wq = weatherAt(focus.x, focus.z), haze = (u.turbidity.value as number) / 2.5;
      const sc = sunColour(cosZ, haze), age = moonAge(WEATHER.day), moon = sunPosition(hour - age / SYNODIC * 24, doy); // moon transits ~0.8 h later per day of age; same day as the sun
      const Esun = shortwave(cosZ, WEATHER.on ? wq.cloud : 0) * LUX.efficacy, Emoon = moonLux(age, Math.sin(moon.elevation * Math.PI / 180)) * (1 - .75 * (WEATHER.on ? wq.cloud : 0));
      const Etw = sun.elevation < 0 ? twilightIlluminance(sun.elevation) : 0; // diffuse sky after sunset (core/skyVisibility), so the eye adapts to it
      LIGHTING.lux = Esun + Emoon + Etw + LUX.nightSky; LIGHTING.gain = exposureFor(LIGHTING.lux) * wolfEyes(LIGHTING.lux); LIGHTING.moonAge = age; LIGHTING.Esun = Esun; LIGHTING.Emoon = Emoon;
      sunLight.color.setRGB(sc.r, sc.g, sc.b);
      sunLight.intensity = 3 * Esun / LUX.ref * LIGHTING.gain; sunLight.position.copy(focus).addScaledVector(dir, 80); sunLight.target.position.copy(focus);
      // Moon, or with the moon down/thin an overhead skylight key from behind the viewer (core/light NIGHT.key): reuses this light so no shader recompiles.
      const night = 1 - light.day, key = nightKey(LIGHTING.gain) * night, Emoon3 = 3 * Emoon / LUX.ref * LIGHTING.gain, wk = key / (key + Emoon3 || 1);
      moonLight.intensity = Emoon3 + key;
      tmpV.set(moon.direction.x, moon.direction.y, moon.direction.z).multiplyScalar(1 - wk);
      if (wk > 0) { camera.getWorldDirection(keyDir); keyDir.y = 0; if (keyDir.lengthSq() < 1e-6) keyDir.set(0, 0, -1); keyDir.normalize().multiplyScalar(-1); keyDir.y = .75; tmpV.addScaledVector(keyDir.normalize(), wk); }
      moonLight.position.copy(focus).add(tmpV.normalize().multiplyScalar(80)); moonLight.target.position.copy(focus);
      hemi.intensity = 2.7 * light.day + (1 - light.day) * Math.max(.35, nightSkyLight(Emoon, LIGHTING.gain)) + (1 - light.day) * 3 * Etw / LUX.ref * LIGHTING.gain; // + the twilight sky's own diffuse light on the ground (same units as the sun: 3 per LUX.ref lux)
      const fill = sceneFill({ elevation: sun.elevation, rawHemi: hemi.intensity, rawKey: moonLight.intensity, dark: (1 - light.day) * darkAdapted(LIGHTING.lux) });
      hemi.intensity = fill.hemi; moonLight.intensity = fill.key;
      hemi.userData.night = fill.keep; // photoreal: do not crush this fill with the daylight IBL scale
      camera.getWorldDirection(keyDir); keyDir.y = 0.2; if (keyDir.lengthSq() < 1e-4) keyDir.set(0, 0.2, -1); keyDir.normalize();
      rimLight.position.copy(focus).addScaledVector(keyDir, -24).setY(focus.y + 4);
      rimLight.target.position.copy(focus);
      rimLight.intensity = 0.2 * light.day + 0.14 * (1 - light.day);
      hemi.color.setRGB(.25, .3, .45).lerp(tmp.set(0xf1f5dd), light.day);
      hemi.groundColor.setRGB(.05, .06, .09).lerp(tmp.set(0x526753), light.day);
      const fog = (scene.fog as THREE.Fog).color;
      fog.copy(fogNight).lerp(fogDay, light.day).lerp(fogGolden, light.golden * .5);
      if (sun.elevation < 0) { // twilight: haze takes the horizon sky's own luminance (skyLuminance at Z = 88 deg, 90 deg from the Sun), not a fixed night blue
        const Lh = skyLuminance(sun.elevation, 88, 90) * 3 / LUX.ref * LIGHTING.gain, g = sunColour(.01, haze);
        tmp.setRGB(.5 * (.62 + g.r), .5 * (.74 + g.g), .5 * (1 + g.b)); tmp.multiplyScalar(Lh / (.2126 * tmp.r + .7152 * tmp.g + .0722 * tmp.b));
        if (tmp.r + tmp.g + tmp.b > fog.r + fog.g + fog.b) fog.copy(tmp); }
      const cu = (clouds.material as THREE.ShaderMaterial).uniforms;
      cu.uTime.value = time; cu.uDay.value = light.day; cu.uSunAlt.value = sun.elevation; cu.uTwGain.value = 3 / LUX.ref * LIGHTING.gain; // scene radiance = (3 / LUX.ref) x real luminance (Lambert: L = aE/pi on both sides)
      { const g = sunColour(.01, haze); (cu.uTwTint.value as THREE.Color).setRGB(g.r, g.g, g.b); } cu.uGolden.value = light.golden;
      // Weather (core/weather): cloud cover, drift, fog and precipitation come from the cell under the viewer.
      const w = weatherAt(focus.x, focus.z), dt = Math.max(0, Math.min(.2, time - lastTime)); lastTime = time; let fogV = Infinity; // a rewind drops this gap: cloud drift does not run backward. The sun still does, because the hour comes from the clock.
      if (WEATHER.on) {
        cu.uCover.value = .62 - .4 * Math.max(w.cloud, Math.max(0, w.rh - .6)); // more condensate → lower noise threshold → more cover
        drift.x += w.wind.x * dt * 2e-4; drift.y += w.wind.z * dt * 2e-4; cu.uDrift.value.copy(drift);
        // Aerial perspective: Koschmieder visibility V = 3.912/β (Koschmieder 1924). β = clear air 3.912/30 km + fog
        // 144.7·LWC^0.88 km⁻¹ (Kunkel 1984, J. Clim. Appl. Meteorol. 23:34; LWC g/m³) + rain 0.25·R^0.63 km⁻¹ [verify].
        const lwc = w.fog * .3, beta = 3.912 / 30 + 144.7 * lwc ** .88 + .25 * w.rainMmH ** .63, V = 3912 / beta; // m
        fogV = V;
        // Preetham turbidity stays near 2 on a clear morning. The old 2+6·rh term sat near 4
        // here and the low sky clipped white. Cloud and fog still move it toward 10.
        u.turbidity.value = 2 + 6 * Math.max(w.cloud, w.fog);
        const falling = w.rainMmH > .05; precip.visible = falling;
        if (falling) {
          const speed = w.snow ? 1 : 6, a = precipGeo.attributes.position as THREE.BufferAttribute;
          precipMat.size = w.snow ? .12 : .05; precipMat.opacity = Math.min(.8, .2 + w.rainMmH / 5); precip.position.copy(camera.position);
          for (let i = 0; i < N; i++) { let y = a.getY(i) - speed * dt; if (y < -20) y += 40; a.setXYZ(i, a.getX(i) + w.wind.x * dt * (w.snow ? .5 : .1), y, a.getZ(i) + w.wind.z * dt * (w.snow ? .5 : .1));
            if (Math.abs(a.getX(i)) > 20) a.setX(i, -Math.sign(a.getX(i)) * 20); if (Math.abs(a.getZ(i)) > 20) a.setZ(i, -Math.sign(a.getZ(i)) * 20); }
          a.needsUpdate = true;
        }
      } else { precip.visible = false; cu.uDrift.value.set(time * .004, time * .0015); }
      // Koschmieder 1924: contrast falls to 2% at V. A clear morning is tens of kilometres, so the
      // old 200–480 m fog was already opaque while the prairie was still in view. Cap V so a
      // crystal day still meets the sky inside the far plane. A real fog bank keeps the short V.
      { const f = scene.fog as THREE.Fog, alt = Math.max(0, camera.position.y - focus.y);
        // The standing view compresses 40 m to the horizon into a few bins. The fade has to
        // start there, or the step from white sky to dark thatch stays a cliff.
        const far = Math.min(fogV, 6000); f.far = far + alt; f.near = 700 + alt; }
      cu.uSunDir.value.copy(dir); cu.uSunColor.value.copy(sunLight.color);
      venus.update(date, hour, camera.position, camera);
      return { sun, light, dir };
    },
  };
}
