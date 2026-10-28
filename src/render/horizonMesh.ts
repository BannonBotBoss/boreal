/**
 * The horizon skirt as one mesh in the game scene (world/globe/horizonSkirt.ts).
 * Rebuilt when the camera crosses a snap cell. One draw call. The material is not
 * on the patch-fade path: the skirt is what remains after the chunks dither out.
 */
import * as THREE from 'three';
import { surfaceDetail } from '../core/surface';
import { heightAt } from '../core/world';
import { SITE } from '../core/sitePhase';
import { smoothstep } from '../proc/math';
import { PLANET, type Planet } from '../world/globe/planet';
import { HORIZON_SKIRT, buildSkirtMesh, skirtLatLon, skirtOrigin, skirtSample, type SkirtOrigin } from '../world/globe/horizonSkirt';
import { PATCH_FAR } from './fade';
import { blendDem, blendPhoto, demSlope, globeMatch, openTileGeneration, sampleDem, samplePhoto, warmDemTiles, warmPhotoTiles } from '../world/globe/openTiles';
import { canopyTile } from './trees/billboardAtlas';

/** Daylight horizon the ground fades toward. Brighter than the old grey so aerial perspective
 *  reads as sky, not a soot band. [game calibration] against the Wasson Lake aerial. */
const HAZE = new THREE.Color(0.78, 0.86, 0.98);
const CANOPY = new THREE.DataTexture(canopyTile(), 32, 32);
CANOPY.wrapS = CANOPY.wrapT = THREE.RepeatWrapping;
CANOPY.magFilter = THREE.LinearFilter;
CANOPY.needsUpdate = true;

function skirtMaterial() {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0 });
  material.polygonOffset = true;
  material.polygonOffsetFactor = 1;
  material.polygonOffsetUnits = 1;
  const haze = { value: new THREE.Vector3(800, 8000, 0) };
  const hazeColor = { value: HAZE.clone() };
  const cam = { value: new THREE.Vector2() };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSkirtHaze = haze;
    shader.uniforms.uSkirtHazeColor = hazeColor;
    shader.uniforms.uSkirtCam = cam;
    shader.uniforms.uCanopy = { value: CANOPY };
    Object.assign(shader.uniforms, PATCH_FAR);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFade;\nattribute float aWater;\nattribute float aPhoto;\nvarying float vSkirtFade;\nvarying float vSkirtDist;\nvarying float vSkirtWater;\nvarying float vSkirtPhoto;\nvarying vec3 vSkirtWorld;\nvarying vec4 vSkirtClip;\nuniform vec2 uSkirtCam;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkirtFade = aFade;\nvSkirtWater = aWater;\nvSkirtPhoto = aPhoto;\nvSkirtDist = distance(position.xz, uSkirtCam);\nvSkirtWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSkirtClip = gl_Position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSkirtHaze;\nuniform vec3 uSkirtHazeColor;\nuniform sampler2D uFarColor;\nuniform sampler2D uFarDepth;\nuniform sampler2D uCanopy;\nuniform vec4 uFarMix;\nvarying float vSkirtFade;\nvarying float vSkirtDist;\nvarying float vSkirtWater;\nvarying float vSkirtPhoto;\nvarying vec3 vSkirtWorld;\nvarying vec4 vSkirtClip;')
      .replace('#include <dithering_fragment>', `
        if (vSkirtPhoto < 0.5 && uFarMix.w > 0.5) {
          vec2 fuv = clamp(vSkirtClip.xy / vSkirtClip.w * 0.5 + 0.5, 0.0, 1.0);
          float fd = textureLod(uFarDepth, fuv, 0.0).r;
          vec3 globe = textureLod(uFarColor, fuv, 0.0).rgb * max(uFarMix.y, 1.0);
          float luma = max(globe.r, max(globe.g, globe.b));
          // The far clear is ~0 and must not paint a hole. Lit canopy in that same buffer
          // is only a few percent (MODIS boreal albedo), so the old 0.04 gate left the gap
          // black. Take the globe texel whenever the far layer actually drew something.
          if (fd < 0.999 && luma > 0.008) gl_FragColor.rgb = globe;
        }
        float canopy = smoothstep(420.0, 900.0, vSkirtDist) * (1.0 - vSkirtWater) * (1.0 - smoothstep(8000.0, 16000.0, vSkirtDist));
        if (canopy > 0.001) {
          vec4 crowns = texture2D(uCanopy, fract(vSkirtWorld.xz * 0.01));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, crowns.rgb, canopy * crowns.a * 0.55);
        }
        float hf = smoothstep(uSkirtHaze.x, uSkirtHaze.y, vSkirtDist);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uSkirtHazeColor, hf);
        if (vSkirtWater > 0.5) {
          vec3 V = normalize(cameraPosition - vSkirtWorld);
          float ndv = clamp(V.y, 0.0, 1.0);
          float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uSkirtHazeColor, clamp(F, 0.0, 0.85));
        }
        if (vSkirtFade < 0.999) {
          int bx = int(gl_FragCoord.x) & 3, by = int(gl_FragCoord.y) & 3, bxy = bx ^ by;
          int bayer = ((bxy & 1) << 3) | ((by & 1) << 2) | (((bxy >> 1) & 1) << 1) | ((by >> 1) & 1);
          if ((float(bayer) + 0.5) / 16.0 > vSkirtFade) discard;
        }
        #include <dithering_fragment>`);
  };
  material.customProgramCacheKey = () => 'horizon-skirt-canopy';
  return { material, haze, hazeColor, cam };
}

export interface HorizonSkirt {
  mesh: THREE.Mesh;
  /** True when this call rebuilt the geometry. */
  update(planet: Planet, cx: number, cz: number, eyeM: number, forwardX: number, forwardZ: number): boolean;
  /** Aerial perspective: start and end metres, and the horizon colour the lit ground fades toward. */
  setHaze(startM: number, endM: number, color: THREE.Color): void;
  dispose(): void;
}

export function createHorizonSkirt(): HorizonSkirt {
  const made = skirtMaterial();
  const geometry = new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(geometry, made.material);
  mesh.name = 'horizon-skirt';
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData.horizonSkirt = true;
  let key = '';
  let origin: SkirtOrigin | null = null;
  let originKey = '';
  let geo = geometry;

  function update(planet: Planet, cx: number, cz: number, eyeM: number, forwardX: number, forwardZ: number) {
    const oKey = `${SITE.remote ? 1 : 0}:${Number.isFinite(SITE.latDeg) ? SITE.latDeg.toFixed(3) : 'home'}:${Math.round(heightAt(0, 0) * 10)}`;
    if (!origin || originKey !== oKey) {
      origin = skirtOrigin(planet, heightAt(0, 0));
      originKey = oKey;
      key = '';
    }
    const hereLL = skirtLatLon(planet, cx, cz, SITE.remote);
    warmDemTiles(hereLL.latDeg, hereLL.lonDeg);
    warmPhotoTiles(hereLL.latDeg, hereLL.lonDeg);
    const snap = HORIZON_SKIRT.snapM;
    const next = `${originKey}:${Math.round(cx / snap)}:${Math.round(cz / snap)}:${Math.round(Math.log2(Math.max(1, eyeM)) * 8)}:${Math.round(Math.atan2(forwardZ, forwardX) * 4)}:${openTileGeneration()}`;
    made.cam.value.set(cx, cz);
    if (next === key) return false;
    key = next;
    const here = origin;
    const detail0 = here.remote ? surfaceDetail(0, 0) : 0;
    const fl = Math.hypot(forwardX, forwardZ) || 1;
    const fx = forwardX / fl, fz = forwardZ / fl;
    const data = buildSkirtMesh(cx, cz, Math.max(1, eyeM), (x, z) => {
      const far = skirtSample(planet, x, z, here);
      const dist = Math.hypot(x - cx, z - cz);
      let y = far.y;
      if (here.remote) {
        // The landing height adds the same micro-relief as heightAt. Fade it out so the far rings stay the globe.
        y += (surfaceDetail(x, z) - detail0) * 0.5 * (1 - smoothstep(400, 2000, dist));
      }
      const ll = skirtLatLon(planet, x, z, here.remote);
      const dem = sampleDem(ll.latDeg, ll.lonDeg);
      if (dem != null) y = blendDem(y, (dem - here.asl) + here.gameY, dist, far.water);
      const picture = samplePhoto(ll.latDeg, ll.lonDeg);
      let rgb = far.rgb;
      const finite = (c: readonly number[]) => c.length === 3 && c.every(Number.isFinite);
      const ok = !!picture && finite(picture);
      if (ok && picture && !far.water) {
        const grain = 0.78 + 0.28 * Math.sin(x * 0.41 + z * 0.17) * Math.sin(x * 0.13 - z * 0.29);
        rgb = blendPhoto(picture, dist, grain);
      } else if (ok && picture && far.water) rgb = picture;
      else rgb = globeMatch(far.rgb);
      if (!finite(rgb)) rgb = [0.12, 0.16, 0.08];
      const slope = demSlope(ll.latDeg, ll.lonDeg);
      const lit = smoothstep(200, 1600, dist);
      const normal: [number, number, number] = slope
        ? [slope[0] * lit, slope[1] * lit + (1 - lit), slope[2] * lit]
        : [0, 1, 0];
      return { y, rgb, water: far.water, photo: ok, normal };
    }, PLANET.radius, (x, z, ringR) => {
      // The pad under the camera stays whole. Farther out, drop quads that reach behind the eye.
      if (ringR < Math.max(80, eyeM * 0.35)) return true;
      const dx = x - cx, dz = z - cz, len = Math.hypot(dx, dz) || 1;
      return (dx * fx + dz * fz) / len > -0.15;
    });
    geo.dispose();
    geo = new THREE.BufferGeometry();
    mesh.geometry = geo;
    geo.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(data.color, 3));
    geo.setAttribute('aFade', new THREE.BufferAttribute(data.fade, 1));
    geo.setAttribute('aWater', new THREE.BufferAttribute(data.water, 1));
    geo.setAttribute('aPhoto', new THREE.BufferAttribute(data.photo, 1));
    geo.setIndex(new THREE.BufferAttribute(data.index, 1));
    geo.computeBoundingSphere();
    made.haze.value.set(Math.max(200, data.outerM * 0.06), Math.max(800, data.outerM * 0.72), 0);
    let painted = 0, sum = 0, maxC = 0, dark = 0;
    for (let i = 0; i < data.photo.length; i++) {
      if (data.photo[i] > 0.5) painted++;
      const m = Math.max(data.color[i * 3], data.color[i * 3 + 1], data.color[i * 3 + 2]);
      sum += m; if (m > maxC) maxC = m; if (m < 0.02) dark++;
    }
    const n = data.photo.length || 1;
    mesh.userData.photoShare = painted / n;
    mesh.userData.colorMean = sum / n;
    mesh.userData.colorMax = maxC;
    mesh.userData.colorDark = dark / n;
    mesh.userData.triangles = data.triangles;
    mesh.userData.outerM = data.outerM;
    return true;
  }

  return {
    mesh,
    update,
    setHaze(startM, endM, color) { made.haze.value.set(startM, endM, 0); made.hazeColor.value.copy(color); },
    dispose() { geo.dispose(); made.material.dispose(); },
  };
}
