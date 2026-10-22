import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GLOBE_HUD_CLASS, hudHidden } from '../src/world/globe/hud';

test('globe HUD: hidden on the globe and in the band, back in game mode (landing)', () => {
  assert.equal(hudHidden('globe'), true);
  assert.equal(hudHidden('band'), true);
  assert.equal(hudHidden('game'), false);
  assert.equal(GLOBE_HUD_CLASS, 'on-globe');
});

test('globe HUD: inpage setMode toggles the body class, so every mode change (enter, ascend, descend, landing) updates it', () => {
  const src = readFileSync('src/world/globe/inpage.ts', 'utf8');
  const setMode = src.split('\n').find(l => l.includes('function setMode('))!;
  assert.match(setMode, /classList\.toggle\(GLOBE_HUD_CLASS, hudHidden\(m\)\)/);
});

test('globe HUD: CSS hides title, status, prompt, footer hint and buttons but keeps the Menu button', () => {
  const css = readFileSync('src/style.css', 'utf8');
  const rule = css.split('}').find(r => r.includes('body.on-globe header'));
  assert.ok(rule, 'a body.on-globe rule');
  for (const sel of ['body.on-globe header', 'body.on-globe #status', 'body.on-globe #interaction', 'body.on-globe footer>span',
    'body.on-globe footer div>button:not(#menu-btn)']) assert.ok(rule!.includes(sel), sel);
  assert.match(rule!, /display:none/);
  assert.ok(!/body\.on-globe[^{}]*#menu-btn\s*[,{]/.test(css), 'the Menu button itself is never hidden');
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<footer>.*<div><button id="menu-btn">Menu<\/button>/); // Menu sits in the footer's button row
});