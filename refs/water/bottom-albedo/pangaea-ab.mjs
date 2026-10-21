// node refs/water/bottom-albedo/pangaea-ab.mjs <ds.txt> (ds.txt = curl "https://doi.pangaea.de/10.1594/PANGAEA.971518?format=textfile") : bottom albedo (irradiance reflectance = pi * Rrs, ESSD 17:1685 sec 2.2) at 610/550/466 nm (R, G, B of HUMIC.nm)
// for every non-vegetation target in Vahtmae et al. 2024 PANGAEA.971518, plus the vegetation group means.
import { readFileSync } from 'node:fs';
const txt = readFileSync(process.argv[2], 'utf8');
const lines = txt.slice(txt.indexOf('*/') + 2).trim().split(/\r?\n/);
const head = lines[0].split('\t'), col = n => head.indexOf(`Rrs_${n} [1/sr]`);
const iD = head.indexOf('Description (Target description)'), iS = head.indexOf('Scientific name (Target in Latin)');
const groups = {};
for (const l of lines.slice(1)) {
  const c = l.split('\t'), v = [610, 550, 466].map(n => Math.PI * +c[col(n)]);
  const d = c[iD];
  if (!/algae|plant|vegetation|seagrass/i.test(d)) console.log(d.padEnd(22), (c[iS] || '').padEnd(28), v.map(x => x.toFixed(3)).join(' '));
  (groups[d] ??= []).push(v);
}
for (const [g, a] of Object.entries(groups)) console.log('GROUP', g.padEnd(22), 'n', a.length, [0, 1, 2].map(i => (a.reduce((s, v) => s + v[i], 0) / a.length).toFixed(3)).join(' '));
