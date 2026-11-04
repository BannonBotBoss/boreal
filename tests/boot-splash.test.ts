import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// T-0123: the boot splash is styled by an inline <style> in index.html, so the first paint is never the raw page
// (in dev, Vite injects src/style.css from JS only after main.ts and its imports load).
test('boot splash: index.html carries the critical #loading CSS inline, before the module script', () => {
  const html = readFileSync('index.html', 'utf8');
  const style = html.match(/<head>[\s\S]*<style>([\s\S]*?)<\/style>[\s\S]*<\/head>/)?.[1];
  assert.ok(style, 'an inline <style> in <head>');
  assert.match(style!, /html\{background:#16241d\}/);
  assert.match(style!, /#loading\{position:fixed;inset:0;z-index:50;background:#16241d/);
  assert.match(style!, /#loading\.fade\{opacity:0/);
  assert.ok(html.indexOf('<style>') < html.indexOf('<script type="module"'));
  assert.ok(!/^#loading\{/m.test(readFileSync('src/style.css', 'utf8')), 'one copy of the #loading rules (moved, not duplicated)');
});

test('boot splash: every boot import in entry.ts reports a failure on the splash', () => {
  const entry = readFileSync('src/world/globe/entry.ts', 'utf8');
  const imports = entry.split('\n').filter(l => /^\s*(if|else)\b.*void import\(/.test(l));
  assert.equal(imports.length, 4);
  for (const l of imports) assert.match(l, /\.catch\(bootFailed\)/, l);
});
