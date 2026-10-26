import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { body, step } from '../src/proc/physics';
import { FALL_END_M, ISO_BELOW_HORIZON, NADIR, fallEase, fallPitch, fallVelocity, fallYaw, flightPrompt, isDescentGesture } from '../src/world/globe/flight';
import { photoFlyMove, stepCarriedFly } from '../src/photo/fly';
import { MIX, RUSH_REF_MPS, rushLevel } from '../src/audio/borealSound';
import { layerPanelShown } from '../src/world/globe/layerPanel';

test('double-click or A starts the fall; a click, a drag and the wheel do not', () => {
  assert.equal(isDescentGesture('dblclick', false), true);
  assert.equal(isDescentGesture('dblclick', true), false, 'a drag is not a double-click');
  assert.equal(isDescentGesture('click'), false);
  assert.equal(isDescentGesture('drag'), false);
  assert.equal(isDescentGesture('wheel'), false);
  assert.equal(isDescentGesture('pad'), true);
  const view = readFileSync('src/world/globe/globeView.ts', 'utf8');
  const wheel = view.slice(view.indexOf("listen(canvas, 'wheel'"), view.indexOf('A drag is not a descent'));
  const dbl = view.slice(view.indexOf("listen(canvas, 'dblclick'"), view.indexOf("listen(window, 'keydown'"));
  assert.match(dbl, /beginFall\(hit\)/);
  assert.match(dbl, /thisMoved \|\| prevMoved/);
  assert.doesNotMatch(wheel, /beginFall/);
  assert.match(view, /land: \(\) => beginFall\(\)/);
  assert.match(view, /stepBody\(b, dt, \{\}, -Infinity\)/);
  assert.match(view, /camera\.rotateZ\(-lookAz/);
  assert.match(view, /camera\.rotateX\(fallPitch\(ease\) - NADIR\)/);
  assert.match(view, /Math\.sqrt\(Math\.max\(0, rad \* rad - R \* R\)\)/);
  const page = readFileSync('src/world/globe/inpage.ts', 'utf8');
  assert.doesNotMatch(page, /ENTRY_BEAT/);
  assert.doesNotMatch(page, /stepFlight\(/);
  assert.doesNotMatch(page, /autoEntry/);
});

test('the 180° spin and the isometric pitch both finish at 10,000 ft', () => {
  assert.equal(FALL_END_M, 10000 * 0.3048);
  const h0 = 12000;
  assert.equal(fallEase(h0, h0), 0);
  assert.equal(fallEase(h0, FALL_END_M), 1);
  assert.equal(fallEase(h0, FALL_END_M - 50), 1, 'past the threshold the ease stays finished');
  assert.equal(fallPitch(0), NADIR);
  assert.ok(Math.abs(fallPitch(1) - ISO_BELOW_HORIZON) < 1e-12);
  const below = -ISO_BELOW_HORIZON * 180 / Math.PI;
  assert.ok(below > 35 && below < 45, `pitch ends ${below.toFixed(2)}° below the horizon`);
  const yaw0 = 0.4;
  assert.ok(Math.abs(fallYaw(yaw0, 0) - yaw0) < 1e-12);
  assert.ok(Math.abs(fallYaw(yaw0, 1) - (yaw0 + Math.PI)) < 1e-12);
  const early = h0 - 0.1 * (h0 - FALL_END_M);
  assert.ok(fallEase(h0, early) < 0.05, 'the spin eases in');
  let prev = 0;
  for (let u = 0; u <= 1.0001; u += 0.05) {
    const e = fallEase(h0, h0 - u * (h0 - FALL_END_M));
    assert.ok(e + 1e-12 >= prev, 'ease only increases on the way down');
    prev = e;
  }
  const b = body(1, 0, h0, 0);
  while (b.y > FALL_END_M) step(b, 1 / 60, {}, -Infinity);
  assert.ok(b.y <= FALL_END_M && b.vy < 0, 'the integrator crosses 10,000 ft still moving');
  assert.equal(fallPitch(fallEase(h0, FALL_END_M)), ISO_BELOW_HORIZON);
  assert.ok(Math.abs(fallYaw(yaw0, fallEase(h0, FALL_END_M)) - (yaw0 + Math.PI)) < 1e-12);
});

test('velocity is continuous at the handoff, and zero input does not stop it', () => {
  const h0 = FALL_END_M + 400, dt = 1 / 60;
  const vy = fallVelocity(h0, FALL_END_M, dt);
  assert.ok(vy < -20, `fall speed ${vy}`);
  const cam = { x: 12, y: 9000, z: -7, yaw: 0.2, pitch: ISO_BELOW_HORIZON };
  const vel = { x: 0, y: vy, z: 0 };
  stepCarriedFly(cam, vel, dt, { f: 0, r: 0, u: 0, fast: false, yaw: 0, pitch: 0 }, -1e9);
  assert.ok(Math.abs(cam.y - (9000 + vy * dt)) < 1e-6, 'the next step moves by the fall speed');
  assert.equal(cam.x, 12);
  assert.equal(cam.z, -7);
  assert.equal(vel.y, vy, 'the handoff does not zero the velocity');
  const parked = { x: 1, y: 2, z: 3, yaw: 0, pitch: 0 };
  photoFlyMove(parked, 1, 0, 0, 0, false);
  assert.equal(parked.y, 2, 'photo fly with no input adds nothing, so the carried speed is the only motion');
});

test('the drone reuses photo mode free-fly', () => {
  const photo = readFileSync('src/photo/photoMode.ts', 'utf8');
  const page = readFileSync('src/world/globe/inpage.ts', 'utf8');
  const fly = readFileSync('src/photo/fly.ts', 'utf8');
  assert.match(photo, /photoFlyMove\(/);
  assert.match(fly, /export function photoFlyMove/);
  assert.match(page, /stepCarriedFly\(/);
  assert.match(page, /photoFlyFloor/);
  assert.doesNotMatch(page, /function stepFlight/);
  const moved = { x: 0, y: 100, z: 0, yaw: 0, pitch: 0 };
  photoFlyMove(moved, 1, 1, 0, 0, false);
  assert.ok(moved.z !== 0, 'W still steps the photo-mode camera');
});

test('the prompts name the double-click, the pad, and the photo-mode drone', () => {
  assert.match(flightPrompt('orbit', false), /Double-click/);
  assert.match(flightPrompt('orbit', false), /click does not drop/);
  assert.match(flightPrompt('orbit', true), /A drops on the centre/);
  assert.match(flightPrompt('fall', false), /10,000 ft/);
  assert.match(flightPrompt('drone', false), /WASD/);
  assert.match(flightPrompt('drone', false), /photo mode/);
  assert.match(flightPrompt('drone', true), /left stick/i);
  assert.match(flightPrompt('drone', true), /A become the wolf/);
  assert.equal(flightPrompt('game', false), '');
});

test('wind starts from the existing pine loop and scales with speed, capped', () => {
  assert.equal(rushLevel(0), 0);
  assert.ok(Math.abs(rushLevel(RUSH_REF_MPS) - MIX.ambience.wind) < 1e-12);
  assert.ok(Math.abs(rushLevel(1e6) - MIX.ambience.wind * 2) < 1e-12);
  const sound = readFileSync('src/audio/borealSound.ts', 'utf8');
  assert.match(sound, /wind-pines/);
  assert.match(sound, /rushLevel\(f\.rush\)/);
  const main = readFileSync('src/main.ts', 'utf8');
  assert.match(main, /airRush\(\)/);
  assert.match(main, /blocksGame\(\) && rush <= 0/);
  const page = readFileSync('src/world/globe/inpage.ts', 'utf8');
  assert.match(page, /airRush:/);
});

test('globe layer panel is hidden in game mode and shown on the globe and during the descent', () => {
  assert.equal(layerPanelShown('game'), false);
  assert.equal(layerPanelShown('globe'), true);
  assert.equal(layerPanelShown('band'), true);
  const src = readFileSync('src/world/globe/inpage.ts', 'utf8');
  assert.match(src, /setLayerPanel\(layerPanelShown\(m\)\)/);
});

test('controls hint wraps, and the controller legend sits above the button row', () => {
  const css = readFileSync('src/style.css', 'utf8');
  assert.match(css, /footer>span\{[^}]*overflow-wrap:anywhere/);
  assert.match(css, /@media\(max-width:900px\)\{footer\{[^}]*flex-direction:column/);
  const pad = readFileSync('src/ui/padMenu.ts', 'utf8');
  const rule = pad.match(/\.padx\{[^}]*\}/)?.[0] ?? '';
  const bottom = Number(/bottom:(\d+)px/.exec(rule)?.[1]);
  assert.ok(bottom >= 260, `pad legend bottom ${bottom}px clears the interaction line at ~750px`);
  const prompt = Number(/#flight-prompt\{[^}]*bottom:(\d+)px/.exec(css)?.[1]);
  assert.ok(prompt >= bottom + 40, `flight prompt bottom ${prompt}px sits above the legend (${bottom}px)`);
  assert.match(rule, /max-width:min\(560px/);
});
