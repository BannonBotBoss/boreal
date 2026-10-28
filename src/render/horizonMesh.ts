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
import { HORIZON_SKIRT, buildSkirtMesh, skirtOrigin, skirtSample, type SkirtOrigin } from '../world/globe/horizonSkirt';

const HAZE = new THREE.Color(0.55, 0.62, 0.68);

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
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aFade;\nvarying float vSkirtFade;\nvarying float vSkirtDist;\nuniform vec2 uSkirtCam;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSkirtFade = aFade;\nvSkirtDist = distance(position.xz, uSkirtCam);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSkirtHaze;\nuniform vec3 uSkirtHazeColor;\nvarying float vSkirtFade;\nvarying float vSkirtDist;')
      .replace('#include <dithering_fragment>', `
        float hf = smoothstep(uSkirtHaze.x, uSkirtHaze.y, vSkirtDist);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uSkirtHazeColor, hf);
        if (vSkirtFade < 0.999) {
          int bx = int(gl_FragCoord.x) & 3, by = int(gl_FragCoord.y) & 3, bxy = bx ^ by;
          int bayer = ((bxy & 1) << 3) | ((by & 1) << 2) | (((bxy >> 1) & 1) << 1) | ((by >> 1) & 1);
          if ((float(bayer) + 0.5) / 16.0 > vSkirtFade) discard;
        }
        #include <dithering_fragment>`);
  };
  material.customProgramCacheKey = () => 'horizon-skirt';
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
    const snap = HORIZON_SKIRT.snapM;
    const next = `${originKey}:${Math.round(cx / snap)}:${Math.round(cz / snap)}:${Math.round(Math.log2(Math.max(1, eyeM)) * 8)}:${Math.round(Math.atan2(forwardZ, forwardX) * 4)}`;
    made.cam.value.set(cx, cz);
    if (next === key) return false;
    key = next;
    const here = origin;
    const detail0 = here.remote ? surfaceDetail(0, 0) : 0;
    const fl = Math.hypot(forwardX, forwardZ) || 1;
    const fx = forwardX / fl, fz = forwardZ / fl;
    const data = buildSkirtMesh(cx, cz, Math.max(1, eyeM), (x, z) => {
      const far = skirtSample(planet, x, z, here);
      let y = far.y;
      if (here.remote) {
        // The landing height adds the same micro-relief as heightAt. Fade it out so the far rings stay the globe.
        const dist = Math.hypot(x - cx, z - cz);
        y += (surfaceDetail(x, z) - detail0) * 0.5 * (1 - smoothstep(400, 2000, dist));
      }
      return { y, rgb: far.rgb };
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
    geo.setIndex(new THREE.BufferAttribute(data.index, 1));
    geo.computeBoundingSphere();
    made.haze.value.set(Math.max(200, data.outerM * 0.06), Math.max(800, data.outerM * 0.72), 0);
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
