import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DAY, DAY_OF_YEAR, dayAt, hourAt, sunPosition } from '../src/core/timeOfDay';
import { createSky } from '../src/render/sky';

// Independent transcription of NOAA solareqns.PDF, p1 (accessed 2026-10-21).
// Declination at noon, matching the game's 365-day/local-solar-hour convention.
// Angular tolerance is a numerical regression threshold, not field accuracy.
const rad = Math.PI / 180;
function reference(day: number, hour: number) {
  const g = 2 * Math.PI * (day - 1) / 365;
  const dec = .006918 - .399912 * Math.cos(g) + .070257 * Math.sin(g)
    - .006758 * Math.cos(2 * g) + .000907 * Math.sin(2 * g)
    - .002697 * Math.cos(3 * g) + .00148 * Math.sin(3 * g);
  const lat = 49.5 * rad, ha = (hour - 12) * 15 * rad;
  // East, up, south: spherical astronomy expanded into world coordinates.
  return new THREE.Vector3(-Math.cos(dec) * Math.sin(ha),
    Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha),
    Math.sin(lat) * Math.cos(dec) * Math.cos(ha) - Math.cos(lat) * Math.sin(dec));
}
const errorDegrees = (a: THREE.Vector3, b: THREE.Vector3) =>
  Math.atan2(a.clone().cross(b).length(), a.dot(b)) / rad;

test('rendered solar uniform and directional light follow date, dial and year rollover', t => {
  const offset = DAY.offset, scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 200, 480);
  const sky = createSky(scene), camera = new THREE.PerspectiveCamera(), focus = new THREE.Vector3(3, 2, 1);
  try {
    for (const day of [227, 355, 365, 366, 1, 0]) {
      // Set date with the chronometer offset, not the weather singleton.
      DAY.offset = (day - DAY_OF_YEAR) * 24 + 4;
      assert.equal(dayAt(0), day);
      assert.equal(hourAt(0), 12);
      for (const hour of [6, 12, 18]) {
        sky.update(hour, 0, camera, focus); // photo-hour overrides retain the world date
        const expected = reference(day, hour);
        assert.ok(errorDegrees(sky.sky.material.uniforms.sunPosition.value, expected) < 1e-8);
        assert.ok(errorDegrees(sky.sunLight.position.clone().sub(focus).normalize(), expected) < 1e-8);
        if (hour === 12) t.diagnostic(JSON.stringify({ day, hour, elevation: Math.asin(sky.sky.material.uniforms.sunPosition.value.y) / rad,
          noaaElevation: Math.asin(expected.y) / rad, angularError: errorDegrees(sky.sky.material.uniforms.sunPosition.value, expected) }));
      }
    }
    DAY.offset = 0;
    const worldSec = ((355 - DAY_OF_YEAR) * 24 + 4) * 300;
    sky.update(hourAt(worldSec), worldSec, camera, focus);
    assert.ok(errorDegrees(sky.sky.material.uniforms.sunPosition.value, reference(355, 12)) < 1e-8,
      'elapsed world time must advance the season without a dial offset');
    assert.ok(errorDegrees(reference(366, 12), reference(1, 12)) < 1e-8, '365-day periodic year');
    assert.deepEqual(sunPosition(12), sunPosition(12, 227), 'fixed-date public helper stays compatible');
  } finally {
    DAY.offset = offset;
    scene.traverse(obj => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose();
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    });
  }
});

test('solar angular metric calibration rejects the old fixed-August winter sun', t => {
  const winter = reference(355, 12), match = reference(355, 12);
  const old = sunPosition(12).direction;
  assert.equal(errorDegrees(winter, match), 0);
  const mismatch = errorDegrees(winter, new THREE.Vector3(old.x, old.y, old.z));
  t.diagnostic(JSON.stringify({ knownMatchDegrees: errorDegrees(winter, match), knownMismatchDegrees: mismatch, thresholdDegrees: 1e-8 }));
  assert.ok(mismatch > 37 && mismatch < 38, `known mismatch: ${mismatch} degrees`);
});
