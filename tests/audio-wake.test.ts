/**
 * A blocked AudioContext is resumed once. An untrusted key (autoplay) must not start it,
 * and a suspended context must not call resume on every frame.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BorealSound } from '../src/audio/borealSound';

test('an untrusted key does not start audio, and resume is not retried every frame', async () => {
  const listeners = new Map<string, ((e: Event) => void)[]>();
  const g = globalThis as Record<string, unknown>;
  const prev = { add: g.addEventListener, remove: g.removeEventListener, Ctx: g.AudioContext, fetch: g.fetch };
  g.addEventListener = (type: string, fn: (e: Event) => void) => {
    const list = listeners.get(type) ?? [];
    list.push(fn);
    listeners.set(type, list);
  };
  g.removeEventListener = (type: string, fn: (e: Event) => void) => {
    listeners.set(type, (listeners.get(type) ?? []).filter(f => f !== fn));
  };
  const fire = (type: string, trusted: boolean) => {
    const ev = new Event(type);
    Object.defineProperty(ev, 'isTrusted', { value: trusted });
    if (type === 'keydown') Object.defineProperty(ev, 'key', { value: 'Enter' });
    for (const fn of listeners.get(type) ?? []) fn(ev);
  };
  let resumes = 0;
  const gain = () => ({ connect() {}, gain: { value: 1, setTargetAtTime() {} } });
  g.AudioContext = function (this: { state: string; currentTime: number; destination: object; listener: object; resume: () => Promise<never>; createDynamicsCompressor: () => unknown; createGain: () => unknown }) {
    this.state = 'suspended';
    this.currentTime = 0;
    this.destination = {};
    this.listener = { setPosition() {}, setOrientation() {} };
    this.resume = () => { resumes++; return Promise.reject(new Error('not allowed')); };
    this.createDynamicsCompressor = () => ({ threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 }, connect() {} });
    this.createGain = gain;
  };
  g.fetch = async () => { throw new Error('no clip'); };
  const sfx = new BorealSound();
  fire('keydown', false);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(sfx.started, false);
  assert.equal(resumes, 0);
  fire('keydown', true);
  await new Promise(r => setTimeout(r, 20));
  assert.equal(sfx.started, true);
  const once = resumes;
  assert.ok(once >= 1 && once <= 2, `first gesture resumed ${once} times`);
  const frame = { dt: 1 / 60, halted: false, x: 0, z: 0, yaw: 0, darkness: 0, hour: 12, day: 1, wolf: { motion: 'idle', phase: 0, speed: 0, gaitSpeed: 0 }, animals: [], mode: 'walk', exhausted: false, stamina: 1, maxStamina: 1, mass: 40, refMass: 40, groundAbsorb: 0, rush: 0 };
  for (let i = 0; i < 120; i++) sfx.update(frame);
  assert.equal(resumes, once, 'a suspended context must not resume again every frame');
  g.addEventListener = prev.add;
  g.removeEventListener = prev.remove;
  g.AudioContext = prev.Ctx;
  g.fetch = prev.fetch;
});
