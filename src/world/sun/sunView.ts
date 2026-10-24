/** Sun view (T-0067): the disc rendered per pixel from spectrum.ts / bands.ts / sunspots.ts, metered by render/exposure.ts,
 *  tone mapped with three's ACESFilmicToneMapping and veiling glare from three's UnrealBloomPass (both three r180, MIT).
 *  Real SDO images are references only; nothing here is a texture of the Sun. URL: ?date=YYYY-MM-DD&band=&elev=<deg|space>
 *  &auto=0&N=&t=&iso=&nd=&focal=&comp=  (elev = solar elevation for the air path; 'space' = above the atmosphere). */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SUN, angularRadius, discXYZ, xyzToRgb, limbAlpha, limbMean, contrast } from './spectrum';
import { band, quietBrightness, scaleHeight } from './bands';
import { SPOT, groupsOn, parseSilso, radiusFrac, isoDay, type Group } from './sunspots';
import { adapt, cameraEV, exposureFromEV100, fovFromFocal, logAverage, pixelsFor, targetEV, ev100FromLuminance } from '../../render/exposure';
import { mountCameraPanel, stateFromSearch } from '../../ui/cameraPanel';

const MAXG = 48, SEGS = 8, LOOPS = 3, BAND_SCALE = 2e4; // BAND_SCALE: non-visible bands in relative units x this, so the meter works the same way
const FRAG = /* glsl */`
precision highp float; varying vec2 vUv;
uniform vec2 uRes; uniform float uPxRho, uExpo, uSkyL, uLimbR, uLimbG, uLimbB, uThin, uQuiet, uLimbMax, uH, uSpotK, uArK, uUmbra, uPen, uAlphaBand;
uniform vec3 uDisc, uBandCol; uniform vec2 uAim; uniform int uN, uNseg; uniform sampler2D uSpots, uSegs; uniform float uSegOn;
void main(){
  vec2 p = ((vUv - .5) * uRes) / uPxRho + uAim; float rho = length(p);
  vec3 col; float ar = 0., dark = 1., darkP = 1.;
  float mu = sqrt(max(0., 1. - rho*rho)); vec3 n = vec3(p, mu);
  for (int i = 0; i < ${MAXG * 2}; i++) { if (i >= uN) break; vec4 s = texture2D(uSpots, vec2((float(i)+.5)/${MAXG * 2}., .5)); // xyz normal, w radius (R_sun)
    float d = rho < 1. ? acos(clamp(dot(n, s.xyz), -1., 1.)) : length(p - s.xy) ;
    if (rho < 1. && s.w * uPxRho >= 1.) { float ru = s.w * ${Math.sqrt(SPOT.umbraFrac).toFixed(4)}; dark = min(dark, mix(uUmbra, 1., smoothstep(ru*.8, ru, d))); darkP = min(darkP, mix(uPen, 1., smoothstep(s.w*.9, s.w, d))); }
    ar += exp(-d*d / (s.w*s.w*9. + 1e-5)) ; }
  float spot = min(dark, darkP);
  if (uThin < .5) { // optically thick: photosphere / chromosphere
    if (rho > 1.) col = vec3(0.); else {
      vec3 lim = vec3(pow(mu, uLimbR), pow(mu, uLimbG), pow(mu, uLimbB));
      col = (uAlphaBand > 0. ? vec3(pow(mu, uAlphaBand)) * uBandCol : lim * uDisc) * mix(1., spot, uSpotK) * (1. + uArK * ar * .3); }
  } else { // optically thin corona: limb-brightened disc, hydrostatic off-limb, active regions ~ n^2
    float q = rho > 1. ? uLimbMax * exp(-2. * (rho - 1.) / uH) : min(1. / max(mu, 1e-3), uLimbMax);
    float loops = 0.; if (uSegOn > .5) for (int j = 0; j < ${MAXG * LOOPS * SEGS}; j++) { if (j >= uNseg) break;
      vec4 g = texture2D(uSegs, vec2((float(j)+.5)/${MAXG * LOOPS * SEGS}., .25)); vec4 w = texture2D(uSegs, vec2((float(j)+.5)/${MAXG * LOOPS * SEGS}., .75));
      vec2 a = g.xy, b = g.zw, ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-9), 0., 1.); float dd = length(p - a - ab * t);
      loops += w.x * exp(-dd*dd / (w.y*w.y)); }
    col = uBandCol * (uQuiet * q + uArK * (ar * .15 * (rho < 1. ? 1. : exp(-(rho-1.)/uH)) + loops)); }
  col += uSkyL;
  gl_FragColor = vec4(min(col * uExpo, vec3(6e4)), 1.); // half-float target: clamp so a blown frame stays white, not inf/NaN
}`;

export async function startSunView(root: HTMLElement, search = location.search) {
  const q = new URLSearchParams(search), st = stateFromSearch(search);
  const date = new Date((q.get('date') ?? isoDay(new Date(Date.now() - 30 * 864e5))) + 'T12:00:00Z'), elevQ = q.get('elev') ?? '60', space = elevQ === 'space';
  const cosZ = space ? null : Math.sin(Number(elevQ) * Math.PI / 180), distAU = Number(q.get('au') ?? 1);
  const silso = parseSilso(await (await fetch(new URL('../../../public/data/silso/SN_d_tot_V2.0.csv', import.meta.url))).text());
  const groups = groupsOn(date, silso), R = silso.get(isoDay(date));
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1; root.append(renderer.domElement);
  const scene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const spotTex = new THREE.DataTexture(new Float32Array(MAXG * 2 * 4), MAXG * 2, 1, THREE.RGBAFormat, THREE.FloatType);
  const segTex = new THREE.DataTexture(new Float32Array(MAXG * LOOPS * SEGS * 4 * 2), MAXG * LOOPS * SEGS, 2, THREE.RGBAFormat, THREE.FloatType);
  const u: Record<string, { value: any }> = { uRes: { value: new THREE.Vector2() }, uPxRho: { value: 1 }, uExpo: { value: 1 }, uSkyL: { value: 0 }, uLimbR: { value: limbAlpha(610) }, uLimbG: { value: limbAlpha(550) }, uLimbB: { value: limbAlpha(465) },
    uThin: { value: 0 }, uQuiet: { value: 1 }, uLimbMax: { value: 1 }, uH: { value: .07 }, uSpotK: { value: 1 }, uArK: { value: 0 }, uUmbra: { value: contrast(SPOT.umbraT) }, uPen: { value: contrast(SPOT.penumbraT) }, uAlphaBand: { value: 0 },
    uDisc: { value: new THREE.Vector3() }, uBandCol: { value: new THREE.Vector3() }, uAim: { value: new THREE.Vector2() }, uN: { value: 0 }, uNseg: { value: 0 }, uSpots: { value: spotTex }, uSegs: { value: segTex }, uSegOn: { value: 0 } };
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: u, fragmentShader: FRAG, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }' })));
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  composer.addPass(new RenderPass(scene, cam)); const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .12, .4, 1.2) // veiling glare: a few % of the source spread wide (Spencer et al. 1995); composer.addPass(bloom); composer.addPass(new OutputPass());
  composer.setSize(innerWidth, innerHeight);

  // disc colour in cd/m^2 at disc centre (disc mean / limb mean), through air if any
  const XYZ = discXYZ(cosZ), rgb = xyzToRgb(XYZ).map(c => Math.max(0, c) / limbMean(550)), Lcentre = XYZ[1] / limbMean(550);
  const skyL = space ? 0 : 6000 * Math.min(1, Math.max(0, (cosZ ?? 0) * 4)); // clear daytime sky near the Sun ~ 3-8e3 cd/m^2 (CIE 2003 standard clear sky magnitude)
  const sunR = angularRadius(SUN.AU * distAU);
  // spots: leading 60% / trailing 40% of group area (leading spot larger; van Driel-Gesztelyi & Green 2015), bipole along the Joy tilt
  const spots: { v: THREE.Vector3; r: number; pol: number }[] = [];
  const dir = (lat: number, lon: number) => { const a = lat * Math.PI / 180, o = lon * Math.PI / 180; return new THREE.Vector3(Math.cos(a) * Math.sin(o), Math.sin(a), Math.cos(a) * Math.cos(o)); };
  for (const g of groups.slice(0, MAXG)) { const r = radiusFrac(g.areaMSH), sep = (4 * r + .02) * 180 / Math.PI, t = g.tilt * Math.PI / 180;
    spots.push({ v: dir(g.lat - sep / 2 * Math.sin(t), g.lon + sep / 2 * Math.cos(t)), r: r * Math.sqrt(.6), pol: g.polarity });
    spots.push({ v: dir(g.lat + sep / 2 * Math.sin(t), g.lon - sep / 2 * Math.cos(t)), r: r * Math.sqrt(.4), pol: -g.polarity }); }
  spots.forEach((s, i) => spotTex.image.data.set([s.v.x, s.v.y, s.v.z, s.r], i * 4)); spotTex.needsUpdate = true; u.uN.value = spots.length;
  // coronal loops: dipole-like semicircles joining each pair, apex height ~ half the footpoint separation, 3 nested (heights 0.5,0.8,1.1)
  let ns = 0; const sd = segTex.image.data as Float32Array, rowB = MAXG * LOOPS * SEGS * 4;
  for (let i = 0; i + 1 < spots.length; i += 2) { const A = spots[i].v, B = spots[i + 1].v, sepR = A.distanceTo(B);
    for (let l = 0; l < LOOPS; l++) { const hgt = sepR * (.5 + .3 * l), shrink = .3 * l / LOOPS; let prev: THREE.Vector3 | null = null;
      for (let k = 0; k <= SEGS; k++) { const s = shrink + (1 - 2 * shrink) * k / SEGS, base = A.clone().lerp(B, s), h = hgt * Math.sin(Math.PI * k / SEGS), pt = base.normalize().multiplyScalar(1 + h);
        if (prev && (pt.z > 0 || Math.hypot(pt.x, pt.y) > 1)) { sd.set([prev.x, prev.y, pt.x, pt.y], ns * 4); sd.set([1, Math.max(.004, sepR * .06), 0, 0], rowB + ns * 4); ns++; } prev = pt; } } }
  segTex.needsUpdate = true; u.uNseg.value = ns;

  let ev = NaN, last = performance.now(), info = '';
  const panel = mountCameraPanel(st, () => {}, () => info);
  function frame(now: number) {
    const dt = Math.min(.1, (now - last) / 1000); last = now; const W = innerWidth, Hh = innerHeight, fov = fovFromFocal(st.cam.focalMm), b = band(st.band);
    const pxRho = pixelsFor(sunR, fov, Hh); u.uRes.value.set(W, Hh); u.uPxRho.value = pxRho;
    const thin = b.thin ? 1 : 0, H = scaleHeight(b.T), vis = b.id === 'visible', k = vis ? 1 : BAND_SCALE * (cosZ === null || b.nm > 300 ? 1 : 0); // EUV/X-ray never reach the ground
    u.uThin.value = thin; u.uH.value = H; u.uLimbMax.value = 2 * Math.sqrt(Math.PI / H); u.uQuiet.value = b.quiet; u.uSpotK.value = b.spot; u.uArK.value = b.ar; u.uAlphaBand.value = vis ? 0 : Math.max(.05, limbAlpha(Math.max(b.nm, 300)));
    u.uDisc.value.set(rgb[0], rgb[1], rgb[2]); u.uBandCol.value.set(b.colour[0] * k, b.colour[1] * k, b.colour[2] * k); u.uSkyL.value = vis || b.id === 'halpha' ? skyL : 0;
    u.uSegOn.value = thin && groups.length ? 1 : 0;
    // meter: fractions of the frame covered by disc / corona / sky (analytic, same numbers the shader draws)
    const discFrac = Math.min(1, Math.PI * pxRho * pxRho / (W * Hh)), Ldisc = vis ? Lcentre * limbMean(550) : k * (thin ? b.quiet * 2 + b.ar * .3 * Math.min(1, groups.length / 5) : 1), Lpeak = vis ? Lcentre : k * (thin ? b.quiet * 2 * Math.sqrt(Math.PI / H) + b.ar : 1.3);
    const Lavg = logAverage([[discFrac, Ldisc], [1 - discFrac, u.uSkyL.value + (thin ? k * b.quiet * .05 : 0) + 1e-3]]);
    const target = targetEV(Lavg, Lpeak, st.cam.comp); ev = Number.isNaN(ev) ? (q.has('settled') ? target : ev100FromLuminance(Lavg)) : adapt(ev, target, dt, st.cam.adaptSpeed);
    const evUsed = cameraEV(st.cam, ev); u.uExpo.value = exposureFromEV100(evUsed);
    const spotPx = groups.length ? Math.max(...groups.map(g => 2 * radiusFrac(g.areaMSH))) * pxRho : 0;
    info = `${isoDay(date)}  SILSO R=${R ?? '-'}  groups=${groups.length} (R/12.08=${R === undefined ? '-' : (R / 12.08).toFixed(1)})\n${b.label}: ${b.source}\n${space ? 'above the atmosphere' : `sun elevation ${elevQ} deg`}  disc ${(2 * pxRho).toFixed(0)} px\nlargest spot ${spotPx.toFixed(1)} px ${spotPx < 2 ? '(< 2 px: not resolved)' : ''}\nL disc centre ${Lcentre.toExponential(2)} cd/m2\nEV100 ${evUsed.toFixed(1)} ${st.cam.auto ? `(auto, target ${target.toFixed(1)})` : '(manual)'}`;
    panel.update(); (window as any).__sun = { ev: evUsed, target, Lavg, Lpeak, groups: groups.length, R, spotPx, discPx: 2 * pxRho };
    composer.render(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
