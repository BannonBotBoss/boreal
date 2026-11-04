/** Decoder for the Rust engine record. The panel does not invent these fields. */

export interface EngineVar { label: string; unit: string; value: number; min: number; max: number; n: number }
export interface EngineSym { equation: string; name: string; latex: string; unit: string; value: number }
export interface EngineInst {
  uid: number; type: string; parent: number; parentType: string; cause: string; spawnedAt: number;
  online: string; health: number; reason: string; born: string; generates: string;
  vars: EngineVar[]; symbols: EngineSym[];
}
export interface EngineParam { type: string; key: string; label: string; unit: string; value: number; def: number }
export interface EngineEq { type: string; id: string; title: string; latex: string }
export interface EngineLog { kind: string; t: number; cause: string; parent: string; child: string }
export interface EngineRule { parent: string; child: string; output: string; cause: string }
export interface EngineSession { type: string; calls: number; online: string; lastMs: number; day: number; hour: number; vars: EngineVar[] }
export interface EngineReport {
  version: string;
  cycle: number; seconds: number; years: number; era: string;
  instances: EngineInst[];
  params: EngineParam[];
  equations: EngineEq[];
  log: EngineLog[];
  rules: EngineRule[];
  sessions: EngineSession[];
}

const HEALTH = ['not called', 'healthy', 'check', 'error', 'not active at this time', 'outside model', 'nothing exists', 'NOT BUILT'];
export function healthWord(code: number) { return HEALTH[code] ?? 'unknown'; }
export function healthColor(code: number) {
  if (code === 1) return '#3dd68c';
  if (code === 2) return '#e6c04a';
  if (code === 3 || code === 5 || code === 7) return '#e15b64';
  return '#9aa3ad';
}

function num(s: string) { const n = Number(s); return Number.isFinite(n) ? n : NaN; }

export function decodeEngineReport(text: string): EngineReport {
  const report: EngineReport = {
    version: '', cycle: NaN, seconds: NaN, years: NaN, era: '',
    instances: [], params: [], equations: [], log: [], rules: [], sessions: [],
  };
  const byUid = new Map<number, EngineInst>();
  const sessions = new Map<string, EngineSession>();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const c = line.split('\t');
    if (c[0] === 'v3' || c[0] === 'v2' || c[0] === 'v1') { report.version = c[0]; continue; }
    if (c[0] === 'TIME') { report.cycle = num(c[1]); report.seconds = num(c[2]); report.years = num(c[3]); report.era = c[4] ?? ''; continue; }
    if (c[0] === 'INST') {
      const inst: EngineInst = {
        uid: num(c[1]), type: c[2] ?? '', parent: num(c[3]), parentType: c[4] ?? '', cause: c[5] ?? '',
        spawnedAt: num(c[6]), online: c[7] ?? '', health: num(c[8]), reason: c[9] ?? '', born: c[10] ?? '',
        generates: c[11] ?? '', vars: [], symbols: [],
      };
      report.instances.push(inst);
      byUid.set(inst.uid, inst);
      continue;
    }
    if (c[0] === 'VAR') {
      byUid.get(num(c[1]))?.vars.push({ label: c[2] ?? '', unit: c[3] ?? '', value: num(c[4]), min: num(c[5]), max: num(c[6]), n: num(c[7]) });
      continue;
    }
    if (c[0] === 'SYM') {
      byUid.get(num(c[1]))?.symbols.push({ equation: c[2] ?? '', name: c[3] ?? '', latex: c[4] ?? '', unit: c[5] ?? '', value: num(c[6]) });
      continue;
    }
    if (c[0] === 'PAR') {
      report.params.push({ type: c[1] ?? '', key: c[2] ?? '', label: c[3] ?? '', unit: c[4] ?? '', value: num(c[5]), def: num(c[6]) });
      continue;
    }
    if (c[0] === 'EQ') { report.equations.push({ type: c[1] ?? '', id: c[2] ?? '', title: c[3] ?? '', latex: c[4] ?? '' }); continue; }
    if (c[0] === 'LOG') { report.log.push({ kind: c[1] ?? '', t: num(c[2]), cause: c[3] ?? '', parent: c[4] ?? '', child: c[5] ?? '' }); continue; }
    if (c[0] === 'RULE') { report.rules.push({ parent: c[1] ?? '', child: c[2] ?? '', output: c[3] ?? '', cause: c[4] ?? '' }); continue; }
    if (c[0] === 'SESS') {
      const s: EngineSession = { type: c[1] ?? '', calls: num(c[2]), online: c[3] ?? '', lastMs: num(c[4]), day: num(c[5]), hour: num(c[6]), vars: [] };
      report.sessions.push(s);
      sessions.set(s.type, s);
      continue;
    }
    if (c[0] === 'SVAR') {
      sessions.get(c[1] ?? '')?.vars.push({ label: c[2] ?? '', unit: c[3] ?? '', value: num(c[4]), min: num(c[5]), max: num(c[6]), n: num(c[7]) });
    }
  }
  return report;
}

/** Parse a cycle the way the panel does. Does not clamp. Incomplete text is not a number. */
export function parseCycle(text: string): number | null {
  const t = text.trim();
  if (!t || /[eE]$/.test(t) || /[eE][+-]?$/.test(t)) return null;
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** One plain sentence per log row, e.g. "reheating spawned by spacetime at t=1.000e-32 s, because ε=1." */
export function logSentence(row: EngineLog): string {
  const verb = row.kind === 'despawn' ? 'despawned' : row.kind === 'spawn' ? 'spawned' : row.kind;
  const by = row.parent ? ` by ${row.parent}` : '';
  const at = Number.isFinite(row.t) ? ` at t=${row.t.toExponential(3)} s` : '';
  const why = row.cause ? `, because ${row.cause}` : '';
  return `${row.child} ${verb}${by}${at}${why}.`;
}
