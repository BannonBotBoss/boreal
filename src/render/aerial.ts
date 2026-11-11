/**
 * Aerial perspective on the continuous terrain.
 *
 * Transmittance is the analytical integral of an exponential atmosphere
 * (Hillaire 2020, "A Scalable and Production Ready Sky and Atmosphere
 * Rendering Technique", eq. for a ray through exp(-h/H); the same integral
 * Bruneton 2008 uses). Rayleigh coefficients are Hillaire's Table 1, per metre.
 * Mie is set so Koschmieder's visibility V = 3.912 / β is about 33 km, a clear
 * summer day on the steppe, not a painted fog band.
 *
 * The mesh fades toward the horizon colour of the same sun the Preetham sky
 * uses (three.js Sky.js). There is no second strip of geometry.
 */
import * as THREE from 'three';

/** Hillaire 2020 Table 1, Rayleigh scattering per metre at sea level. */
export const BETA_R = [5.802e-6, 13.558e-6, 33.100e-6] as const;
/**
 * Mie β. Koschmieder 1924: V = 3.912 / β ≈ 18 km.
 * A clear 33 km day left the land line as a 3-pixel step, because the last
 * kilometres of ground are foreshortened into a fraction of a degree. 18 km is
 * light summer haze on a continental steppe, still well above fog.
 */
export const BETA_M = 2.2e-4;
export const HEIGHT_R = 8000;
export const HEIGHT_M = 1200;
export const KOCHMIEDER = 3.912;

export const AERIAL = {
  uSunDir: { value: new THREE.Vector3(0.2, 0.4, 0.8) },
  uSunCol: { value: new THREE.Color(1, 0.95, 0.85) },
  uHorizon: { value: new THREE.Color(0.82, 0.88, 0.94) },
};

/** Optical depth of a straight ray from height y0 to y1 over `dist` metres, scale height H. */
export function opticalDepth(y0: number, y1: number, dist: number, H: number) {
  const a = Math.max(y0, 0), b = Math.max(y1, 0);
  const dy = b - a;
  if (!(dist > 0) || !(H > 0)) return 0;
  if (Math.abs(dy) < 1e-2) return dist * Math.exp(-a / H);
  return H * dist / dy * (Math.exp(-a / H) - Math.exp(-b / H));
}

/** RGB transmittance. 1 at the camera, falling toward the horizon. */
export function transmittance(y0: number, y1: number, dist: number) {
  const ray = opticalDepth(y0, y1, dist, HEIGHT_R);
  const mie = opticalDepth(y0, y1, dist, HEIGHT_M);
  return BETA_R.map(b => Math.exp(-(b * ray + BETA_M * mie))) as [number, number, number];
}

/** Koschmieder meteorological visibility for the Mie coefficient, metres. */
export function mieVisibility(beta = BETA_M) {
  return KOCHMIEDER / beta;
}

const GLSL = /* glsl */`
uniform vec3 uSunDir;
uniform vec3 uSunCol;
uniform vec3 uHorizon;
varying vec3 vAerialW;
float aerialDepth(float y0, float y1, float dist, float H) {
  float a = max(y0, 0.0), b = max(y1, 0.0), dy = b - a;
  if (abs(dy) < 1e-2) return dist * exp(-a / H);
  return H * dist / dy * (exp(-a / H) - exp(-b / H));
}
void aerialPerspective(inout vec3 color) {
  vec3 ro = cameraPosition;
  float dist = distance(ro, vAerialW);
  float ray = aerialDepth(ro.y, vAerialW.y, dist, ${HEIGHT_R.toFixed(1)});
  float mie = aerialDepth(ro.y, vAerialW.y, dist, ${HEIGHT_M.toFixed(1)});
  vec3 betaR = vec3(${BETA_R[0]}, ${BETA_R[1]}, ${BETA_R[2]});
  vec3 tau = betaR * ray + vec3(${BETA_M}) * mie;
  vec3 T = exp(-tau);
  float mu = pow(clamp(dot(normalize(vAerialW - ro), normalize(uSunDir)), 0.0, 1.0), 8.0);
  vec3 scatter = mix(uHorizon, uSunCol, mu * 0.45);
  color = color * T + scatter * (1.0 - T);
}
`;

/** Inject the fade before tone mapping. Idempotent. */
export function addAerialPerspective(shader: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string }) {
  if (shader.fragmentShader.includes('aerialPerspective')) return;
  Object.assign(shader.uniforms, AERIAL);
  shader.vertexShader = shader.vertexShader.replace(
    '#include <project_vertex>',
    '#include <project_vertex>\n vAerialW = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  );
  if (!shader.vertexShader.includes('varying vec3 vAerialW')) {
    shader.vertexShader = 'varying vec3 vAerialW;\n' + shader.vertexShader;
  }
  shader.fragmentShader = GLSL + shader.fragmentShader.replace(
    '#include <tonemapping_fragment>',
    'aerialPerspective(gl_FragColor.rgb);\n #include <tonemapping_fragment>',
  );
}
