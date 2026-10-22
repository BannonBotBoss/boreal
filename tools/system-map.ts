/**
 * System map generator (T-0037): renders docs/system-map.md from src/config/systemProperties.ts so Matthew can see how every
 * system is rigged up: a mermaid wiring diagram, a summary table, then per system its figures (value, units, what, source,
 * read by), URL flags, linked data tables and what is still at its call site.
 * Run: `npm run system-map`. tests/system-properties.test.ts fails when the committed doc differs from renderSystemMap().
 * The one-line comment of each figure is read from the source file's JSDoc (TypeScript parser), so it is written once.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PENDING_GROUPS, PROPERTY_META, SYSTEM_MAP, SYSTEM_PROPERTIES, type SystemId } from '../src/config/systemProperties';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const SOURCE = 'src/config/systemProperties.ts', DOC = 'docs/system-map.md';

/** group -> key -> one-line comment (a key without its own comment shares the previous key's, as in `/** limits *\/ a: 1, b: 2`). */
export function propertyComments(text = readFileSync(resolve(ROOT, SOURCE), 'utf8')) {
  const sf = ts.createSourceFile(SOURCE, text, ts.ScriptTarget.ES2022, true), out: Record<string, Record<string, string>> = {};
  const name = (p: ts.ObjectLiteralElementLike) => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : '';
  const doc = (p: ts.Node) => (ts.getLeadingCommentRanges(text, p.getFullStart()) ?? []).map(r => text.slice(r.pos, r.end))
    .filter(c => c.startsWith('/**')).map(c => c.replace(/^\/\*\*|\*\/$/g, '').split(/\r?\n/).map(l => l.replace(/^\s*\*\s?/, '').trim()).join(' ').trim()).pop() ?? '';
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'SYSTEM_PROPERTIES' && n.initializer) {
      let init = n.initializer; while (ts.isAsExpression(init) || ts.isSatisfiesExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init)) for (const g of init.properties) {
        if (!ts.isPropertyAssignment(g) || !ts.isObjectLiteralExpression(g.initializer)) continue;
        const keys: Record<string, string> = out[name(g)] = {}; let last = '';
        for (const k of g.initializer.properties) { const d = doc(k) || last; keys[name(k)] = last = d; }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf); return out;
}

/** systems that read each system's output (the reverse of dependsOn) */
export function feedsOf(): Record<SystemId, SystemId[]> {
  const ids = Object.keys(SYSTEM_MAP) as SystemId[], out = Object.fromEntries(ids.map(i => [i, [] as SystemId[]])) as Record<SystemId, SystemId[]>;
  for (const id of ids) for (const d of SYSTEM_MAP[id].dependsOn) out[d].push(id);
  for (const id of ids) out[id].sort();
  return out;
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const fmt = (v: unknown) => typeof v === 'string' ? `'${v}'` : JSON.stringify(v).replace(/,/g, ', ').replace(/:/g, ': ');
const props = SYSTEM_PROPERTIES as unknown as Record<string, Record<string, unknown>>;

export function renderSystemMap(text?: string) {
  const comments = propertyComments(text), feeds = feedsOf(), ids = (Object.keys(SYSTEM_MAP) as SystemId[]).sort();
  const L: string[] = [];
  L.push('# Boreal system map', '', `Generated from \`${SOURCE}\` by \`npm run system-map\` (tools/system-map.ts). Do not edit by hand:`,
    'change the properties file and regenerate; `npm test` fails when this page is stale. How to add a system or a figure:',
    '`notes/skills/system-properties.md`.', '',
    'Arrows point from a system to the systems that read its output ("feeds"). Dashed boxes are systems whose figures are still',
    'all at their call sites (see each section\'s links and "still in code").', '', '```mermaid', 'flowchart LR');
  for (const id of ids) { const s = SYSTEM_MAP[id], own = s.groups.some(g => g in props); L.push(`  ${id}${own ? `["${s.title}"]` : `("${s.title}")`}`); }
  for (const id of ids) for (const f of feeds[id]) L.push(`  ${id} --> ${f}`);
  for (const id of ids) if (!SYSTEM_MAP[id].groups.some(g => g in props)) L.push(`  style ${id} stroke-dasharray: 4 3`);
  L.push('```', '', '## Systems', '', '| System | What it does | Groups in the file | Depends on | Feeds | URL flags |', '|---|---|---|---|---|---|');
  for (const id of ids) { const s = SYSTEM_MAP[id];
    L.push(`| [${s.title}](#${id}) | ${cell(s.what)} | ${s.groups.map(g => g in props ? `\`${g}\`` : `\`${g}\` (pending)`).join(', ') || '-'} | ${s.dependsOn.join(', ') || '-'} | ${feeds[id].join(', ') || '-'} | ${Object.keys(s.flags).length || '-'} |`); }
  for (const id of ids) {
    const s = SYSTEM_MAP[id];
    L.push('', `<a id="${id}"></a>`, `## ${s.title} (\`${id}\`)`, '', s.what, '',
      `- Depends on: ${s.dependsOn.join(', ') || 'nothing (a root)'}`, `- Feeds: ${feeds[id].join(', ') || 'nothing (a leaf)'}`,
      `- Modules: ${s.modules.map(m => `\`${m}\``).join(', ')}`);
    for (const g of s.groups) {
      if (!(g in props)) { L.push('', `### \`${g}\` (pending: arrives with ${PENDING_GROUPS[g] ?? 'another branch'})`); continue; }
      const meta = PROPERTY_META[g];
      L.push('', `### \`SYSTEM_PROPERTIES.${g}\``, '', `Read by: ${meta?.readers.map(r => `\`${r}\``).join(', ') ?? '(missing)'}`, '',
        '| Figure | Value | Units | What | Source |', '|---|---|---|---|---|');
      for (const [k, v] of Object.entries(props[g])) { const [u, src] = meta?.keys[k] ?? ['?', '(missing)'];
        L.push(`| \`${k}\` | ${cell(fmt(v))} | ${cell(u)} | ${cell(comments[g]?.[k] ?? '')} | ${cell(src)} |`); }
    }
    const flags = Object.entries(s.flags), tables = Object.entries(s.tables);
    if (flags.length) { L.push('', '**URL flags**', '', '| Flag | Effect |', '|---|---|'); for (const [f, d] of flags) L.push(`| \`?${f}\` | ${cell(d)} |`); }
    if (tables.length) { L.push('', '**Linked data tables** (kept in their own module)', ''); for (const [t, d] of tables) { const [p, e] = t.split('#'); L.push(`- \`${e}\` in \`${p}\`: ${d}`); } }
    if (s.remaining.length) { L.push('', '**Still in code** (not moved yet)', ''); for (const r of s.remaining) L.push(`- ${r}`); }
  }
  const allFlags = ids.flatMap(id => Object.entries(SYSTEM_MAP[id].flags).map(([f, d]) => [f, id, d] as const)).sort((a, b) => a[0].localeCompare(b[0]));
  L.push('', '## All URL flags', '', '| Flag | System | Effect |', '|---|---|---|');
  for (const [f, id, d] of allFlags) L.push(`| \`?${f}\` | ${id} | ${cell(d)} |`);
  return L.join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(resolve(ROOT, 'docs'), { recursive: true });
  writeFileSync(resolve(ROOT, DOC), renderSystemMap());
  console.log(`wrote ${DOC}`);
}
