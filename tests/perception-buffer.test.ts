// T-0083, issue #106. The Rust writer fills tests/fixtures/perception-*.bin.
// This reader must see the same frame, at the offsets the issue prints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERCEPTION, readPerception } from '../src/core/perceptionBuffer';

const empty = new Uint8Array(readFileSync(new URL('./fixtures/perception-empty.bin', import.meta.url)));
const known = new Uint8Array(readFileSync(new URL('./fixtures/perception-known.bin', import.meta.url)));
const viewOf = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

test('T-0083: embodied id is at byte 20, and the header reserved tail is 20 bytes', () => {
  assert.equal(PERCEPTION.embodiedIdOffset, 20);
  assert.equal(PERCEPTION.headerBytes, 64);
  assert.equal(PERCEPTION.soundBytes, 28);
  assert.equal(PERCEPTION.memoryBytes, 20);
  assert.equal(PERCEPTION.scentBytes, 32);
  assert.equal(PERCEPTION.visualBytes, 48);
  const raw = viewOf(known);
  assert.equal(raw.getUint32(16, true), 7); // species ends at byte 20, no pad
  assert.equal(raw.getBigUint64(20, true), 0x8877665544332211n);
  assert.equal(raw.getFloat64(8, true), 1728000.5);
  assert.equal(raw.getFloat32(64, true), 1); // hunger, the first body feeling
  assert.equal(raw.getFloat32(96, true), 9); // fear, the first emotion
  const frame = readPerception(known);
  assert.equal(frame.header.embodiedId, 0x8877665544332211n);
  assert.equal(frame.header.frameId, 0x0102030405060708n);
  assert.equal(frame.header.speciesId, 7);
  assert.equal(frame.header.reserved.length, 20);
  assert.equal(frame.header.reserved[0], 0xA0);
  assert.equal(frame.header.reserved[19], 0xB3);
  assert.equal(frame.body.hunger, 1);
  assert.equal(frame.emotions.fear, 9);
  assert.equal(frame.urges.feedDrive, 17);
});

test('T-0083: a sound entry is 28 bytes with 4 reserved, and a memory entry is 20', () => {
  const raw = viewOf(known);
  const soundAt = 160 + 2 * 48 + 32; // two visible things, one scent volume
  assert.equal(soundAt, 288);
  assert.equal(raw.getUint16(soundAt, true), 9);
  assert.deepEqual([raw.getUint8(soundAt + 24), raw.getUint8(soundAt + 25), raw.getUint8(soundAt + 26), raw.getUint8(soundAt + 27)], [0xAA, 0xBB, 0xCC, 0xDD]);
  assert.equal(raw.getUint16(soundAt + 28, true), 11); // next sound, not the reserved bytes
  const memoryAt = soundAt + 2 * 28;
  assert.equal(raw.getUint16(memoryAt, true), 1);
  assert.equal(raw.getUint16(memoryAt + 20, true), 7);
  const frame = readPerception(known);
  assert.equal(frame.visible.length, 2);
  assert.equal(frame.visible[0].id, 1001n);
  assert.equal(frame.visible[0].x, 120);
  assert.equal(frame.visible[0].certainty, 38);
  assert.equal(frame.visible[0].salience, 91);
  assert.equal(frame.visible[1].id, 1002n);
  assert.equal(frame.visible[1].flags, 0x01020304);
  assert.equal(frame.scents.length, 1);
  assert.deepEqual([...frame.scents[0].reserved], [0x51, 0x52, 0x53, 0x54]);
  assert.equal(frame.scents[0].directionY, 1);
  assert.equal(frame.scents[0].concentration, 0.125);
  assert.equal(frame.sounds.length, 2);
  assert.deepEqual([...frame.sounds[0].reserved], [0xAA, 0xBB, 0xCC, 0xDD]);
  assert.equal(frame.sounds[0].ageSeconds, 1.5);
  assert.equal(frame.sounds[1].category, 11);
  assert.equal(frame.sounds[1].directionZ, 1);
  assert.equal(frame.memories.length, 2);
  assert.equal(frame.memories[0].emotionalWeight, 0.75);
  assert.equal(frame.memories[0].z, -4);
  assert.equal(frame.memories[1].memoryType, 7);
  assert.equal(frame.memories[1].x, 20);
  assert.deepEqual([...frame.tail], [0xB0, 0xB1, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7]);
});

test('T-0083: counts may be zero, and the reserved tails are still in the block', () => {
  const raw = viewOf(empty);
  assert.equal(raw.getUint32(28, true), 0);
  assert.equal(raw.getUint32(32, true), 0);
  assert.equal(raw.getUint32(36, true), 0);
  assert.equal(raw.getUint32(40, true), 0);
  assert.equal(raw.getUint8(44), 0xE0);
  assert.equal(raw.getUint8(63), 0xF3);
  assert.equal(empty.length, 160 + 16);
  const frame = readPerception(empty);
  assert.deepEqual([frame.visible.length, frame.scents.length, frame.sounds.length, frame.memories.length], [0, 0, 0, 0]);
  assert.equal(frame.header.reserved.length, 20);
  assert.equal(frame.header.reserved[19], 0xF3);
  assert.equal(frame.body.reserved, 8);
  assert.equal(frame.emotions.reserved1, 15);
  assert.equal(frame.emotions.reserved2, 16);
  assert.equal(frame.tail.length, 16);
  assert.equal(frame.tail[0], 0xF0);
  assert.equal(frame.tail[15], 0xFF);
});

test('T-0083: a later tail does not move the embodied id, and a view into a larger buffer still reads', () => {
  const pad = new Uint8Array(16 + known.length);
  pad.set(known, 16);
  const frame = readPerception(pad.subarray(16));
  assert.equal(frame.header.embodiedId, 0x8877665544332211n);
  assert.equal(viewOf(pad.subarray(16)).getBigUint64(20, true), frame.header.embodiedId);
  assert.equal(frame.sounds[1].category, 11);
  assert.equal(frame.tail.length, 8);
});

test('T-0083: caps stay small, and a short slice is refused', () => {
  const over = new Uint8Array(empty);
  new DataView(over.buffer, over.byteOffset, over.byteLength).setUint32(28, 33, true);
  assert.throws(() => readPerception(over), /visible count 33 is over the cap 32/);
  assert.throws(() => readPerception(known.slice(0, 100)), /short/);
});

test('T-0083: no module serializes animal positions as JSON for the viewer', () => {
  const ts = readFileSync(new URL('../src/core/perceptionBuffer.ts', import.meta.url), 'utf8');
  const rust = readFileSync(new URL('../rust/boreal-sim/src/perception.rs', import.meta.url), 'utf8');
  assert.doesNotMatch(ts, /JSON\.stringify/);
  assert.doesNotMatch(rust, /serde_json|to_json|serde::/);
  const frame = readPerception(known);
  assert.equal(typeof frame.visible[0].x, 'number');
  assert.equal(typeof frame, 'object');
});
