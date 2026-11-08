import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { CINE, bedDb } from '../src/world/cosmos/cineBeats';

/** Integrated loudness and true peak from ffmpeg's loudnorm meter. */
function loudness(file: string): { i: number; tp: number } {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  assert.equal(run.error, undefined, 'ffmpeg is required to measure the opening voice');
  const text = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
  const start = text.lastIndexOf('{');
  const end = text.lastIndexOf('}');
  assert.ok(start >= 0 && end > start, `no loudnorm json for ${file}`);
  const data = JSON.parse(text.slice(start, end + 1)) as { input_i: string; input_tp: string };
  return { i: Number(data.input_i), tp: Number(data.input_tp) };
}

test('the opening voices sit near -16 LUFS with the peak under -1.5 dBTP', () => {
  for (const file of ['public/audio/big-bang/narration.mp3', 'public/audio/big-bang/vo-b7-light.mp3', 'public/audio/big-bang/vo-b9-stars.mp3']) {
    const { i, tp } = loudness(file);
    assert.ok(i <= -15.2 && i >= -17.6, `${file} integrated ${i} LUFS`);
    assert.ok(tp <= -1.4, `${file} true peak ${tp} dBTP`);
  }
});

test('narration plays once, and the bed stays ducked only while that voice is on', () => {
  const opening = readFileSync('src/world/cosmos/opening.ts', 'utf8');
  const audio = readFileSync('src/audio/bigBang.ts', 'utf8');
  assert.equal(opening.includes('narration.play'), false);
  assert.equal(opening.includes('new Audio'), false);
  assert.equal((audio.match(/narration\.play\(\)/g) ?? []).length, 1);
  assert.match(audio, /narration\.loop = false/);
  assert.equal(CINE.bedB1, -18);
  assert.equal(bedDb(10, null), -18);
  const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', 'public/audio/big-bang/narration.mp3'], { encoding: 'utf8' });
  assert.equal(dur.error, undefined, 'ffprobe is required');
  assert.ok(Math.abs(Number(dur.stdout) - 5.851429) < 1e-4, `duration ${dur.stdout}`);
});
