import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('the page names an icon that exists, so the browser does not 404 /favicon.ico', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /rel="icon" href="\/favicon\.svg"/);
  assert.match(html, /rel="icon" href="\/favicon\.ico"/);
  assert.ok(existsSync('public/favicon.svg'));
  assert.ok(existsSync('public/favicon.ico'));
  const ico = readFileSync('public/favicon.ico');
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
});
