import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createPlanet, PLANET } from '../src/world/globe/planet';
import { figureRadius } from '../src/world/globe/figure';
import { NADIR, fallPitch } from '../src/world/globe/flight';
import {
  TRANSITION, globePitch, viewpointPose, handoverBlend, orbitClip, forestFromPlanet, globeCameraFrom, gameToPlanet, planetToGame,
} from '../src/world/globe/transition';

const read = (p: string) => readFileSync(p, 'utf8');

test('at 2 km the viewpoint matches the old band pose within a centimetre', () => {
  // Historical band pose, inpage camera before this phase:
  //   cam.p.set(spotX, groundY + h, spotZ)
  //   cam.q.setFromEuler(new Euler(pitch, yaw, 0, 'YXZ'))
  const x = 120, z = -340, groundY = 186.4, h = TRANSITION.bandTop, yaw = 0.8, pitch = globePitch(h);
  assert.equal(h, 2000);
  const out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  viewpointPose(x, z, groundY, h, yaw, pitch, out);
  const old = new THREE.Vector3(x, groundY + h, z);
  const gap = out.position.distanceTo(old);
  assert.ok(gap < 0.01, `position gap ${gap} m`);
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  assert.ok(out.quaternion.angleTo(q) < 1e-8);
  const p = createPlanet(1400);
  const planet = globeCameraFrom(p, out, { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() });
  const back = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  assert.equal(forestFromPlanet(p, planet, back), true);
  const backGap = back.position.distanceTo(out.position);
  assert.ok(backGap < 0.01, `round trip ${backGap} m`);
  assert.ok(back.quaternion.angleTo(out.quaternion) < 1e-6);
});

test('the driven camera sits on the hydrostatic figure, not the mean sphere', () => {
  const p = createPlanet(1400);
  const y = TRANSITION.bandTop;
  const v = gameToPlanet(p, 0, y, 0);
  const len = Math.hypot(v[0], v[1], v[2]);
  const fig = figureRadius(p.fromLocal(0, 0));
  const offFigure = Math.abs(len - (fig + TRANSITION.datum + y));
  assert.ok(offFigure < 0.01, `radius is ${offFigure} m off the figure`);
  const offMean = Math.abs(len - (p.radius + TRANSITION.datum + y));
  assert.ok(offMean > 1000, `camera is only ${offMean} m off the mean sphere`);
  const back = planetToGame(p, v);
  assert.ok(Math.abs(back.y - y) < 1e-4 && Math.abs(back.x) < 1e-4 && Math.abs(back.z) < 1e-4);
});

test('the handover blend is a no-op because there is one camera', () => {
  const pose = {
    position: new THREE.Vector3(4, 60, -2),
    quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0.3, 0, 'YXZ')),
  };
  const rig = { position: new THREE.Vector3(9, 1.6, 1), quaternion: new THREE.Quaternion() };
  const kept = pose.position.clone();
  assert.equal(handoverBlend(pose, rig, 0), pose);
  assert.equal(handoverBlend(pose, rig, 0.5), pose);
  assert.equal(handoverBlend(pose, rig, 1), pose);
  assert.ok(pose.position.distanceTo(kept) < 1e-12);
  assert.equal(TRANSITION.blendSec, 1, 'the old duration stays on the record and is not applied');
  const page = read('src/world/globe/inpage.ts');
  assert.match(page, /handoverBlend\(cam, end, blend\)/);
  assert.match(page, /viewpointPose\(/);
  assert.match(page, /attachViewpoint\(view\.camera\)/);
  assert.doesNotMatch(page, /TRANSITION\.blendSec/);
  assert.doesNotMatch(page, /\.lerp\(/);
  assert.match(page, /globe\.step\(null\)/);
  assert.match(page, /globe\.step\(far\.target\)/);
  const view = read('src/world/globe/globeView.ts');
  assert.match(view, /camera\.rotateZ\(-lookAz/);
  assert.match(view, /camera\.rotateX\(fallPitch\(ease\) - NADIR\)/);
  assert.match(view, /forestFromPlanet\(planet, camera, forestPose\)/);
  assert.match(view, /atmos\.update\([\s\S]*?R \+ ground\)/);
  assert.match(view, /radius: surf/);
  assert.doesNotMatch(view, /requestAnimationFrame\(tick\)[\s\S]{0,40}requestAnimationFrame\(tick\)/);
});

test('orbit clip is the planet camera clip, and a nadir aim round-trips within a centimetre', () => {
  const R = PLANET.radius, alt = R * 2.2, radial = 370;
  const clip = orbitClip(alt, R, radial);
  assert.equal(clip.near, Math.min(1e5, Math.max(0.5, alt * 0.02)));
  const rad = R + radial + alt;
  assert.equal(clip.far, Math.sqrt(Math.max(0, rad * rad - R * R)) + R * 2);
  const low = orbitClip(100, R, -200);
  assert.ok(Number.isFinite(low.far) && low.far > 0, 'inside the mean sphere the far plane stays finite');
  const p = createPlanet(1400);
  const cam = new THREE.PerspectiveCamera(45, 16 / 9, 1, 1e9);
  const dir = new THREE.Vector3(...p.home);
  const ground = figureRadius(p.home) - R;
  cam.position.copy(dir).multiplyScalar(R + ground + 5000);
  cam.up.set(0, 1, 0);
  cam.lookAt(0, 0, 0);
  cam.rotateZ(-0.4);
  cam.rotateX(fallPitch(0.35) - NADIR);
  const out = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };
  assert.equal(forestFromPlanet(p, cam, out), true);
  const back = globeCameraFrom(p, out, { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() });
  const gap = back.position.distanceTo(cam.position);
  const ang = back.quaternion.angleTo(cam.quaternion);
  assert.ok(gap < 0.01, `fall aim position ${gap} m`);
  assert.ok(ang < 1e-4, `fall aim angle ${ang} rad`);
  cam.position.copy(dir).multiplyScalar(-(R + 2e6));
  assert.equal(forestFromPlanet(p, cam, out), false, 'the far side does not invent a game-frame pose');
});
