/**
 * Pad menu model (Grok Bot): tabs of items, a page stack, focus that skips info rows, the badge gate. Pure (tests drive it
 * with menu events); ui/padMenu draws it. Matt: "only what you understand shall you have control": an item with a
 * `control` that canUse() refuses shows a lock, ignores left/right, and A opens that control's badge page instead.
 */
export type MenuEvent = 'menuUp' | 'menuDown' | 'menuLeft' | 'menuRight' | 'menuSelect' | 'menuBack' | 'menuTabPrev' | 'menuTabNext' | 'menuAlt' | 'menuAlt2';
export interface Item {
  label: string; kind: 'action' | 'toggle' | 'range' | 'choice' | 'info';
  control?: string; value?(): string; act?(): void; adjust?(dir: number): void; alt?(): void; alt2?(): void; hint?: string;
}
export interface Page { title: string; items(): Item[]; /** page owns LB/RB (e.g. number entry) */ onEvent?(e: MenuEvent): boolean }
export interface Tab { id: string; label: string; items(): Item[] }
export interface Gate { canUse(id: string): boolean; badgePage(control: string): Page }
const selectable = (i: Item) => i.kind !== 'info';

export function createMenuModel(tabs: Tab[], gate: Gate) {
  const st = { open: false, tab: 0, focus: 0, stack: [] as Page[] };
  const items = () => st.stack.length ? st.stack[st.stack.length - 1].items() : tabs[st.tab].items();
  const locked = (i: Item) => !!i.control && !gate.canUse(i.control);
  const fix = (d = 1) => { const it = items(), n = it.length; if (!n) { st.focus = 0; return; } st.focus = ((st.focus % n) + n) % n;
    for (let k = 0; k < n && !selectable(it[st.focus]); k++) st.focus = (st.focus + d + n) % n; };
  const m = {
    st, items, locked, tabs,
    open(tabId?: string) { st.open = true; st.stack = []; if (tabId) { const i = tabs.findIndex(t => t.id === tabId); if (i >= 0) st.tab = i; } st.focus = 0; fix(); },
    close() { st.open = false; st.stack = []; },
    push(p: Page) { st.stack.push(p); st.focus = 0; fix(); },
    current: () => items()[st.focus] as Item | undefined,
    title: () => st.stack.length ? st.stack[st.stack.length - 1].title : tabs[st.tab].label,
    input(e: MenuEvent) {
      if (!st.open) return;
      const page = st.stack[st.stack.length - 1]; if (page?.onEvent?.(e)) { fix(); return; }
      const it = items(), cur = it[st.focus];
      if (e === 'menuUp' || e === 'menuDown') { const d = e === 'menuUp' ? -1 : 1; if (it.length) { st.focus = (st.focus + d + it.length) % it.length; fix(d); } }
      else if ((e === 'menuTabPrev' || e === 'menuTabNext') && !st.stack.length) { st.tab = (st.tab + (e === 'menuTabPrev' ? -1 : 1) + tabs.length) % tabs.length; st.focus = 0; fix(); }
      else if (e === 'menuLeft' || e === 'menuRight') { if (cur && !locked(cur)) cur.adjust?.(e === 'menuLeft' ? -1 : 1); }
      else if (e === 'menuSelect') { if (!cur || cur.kind === 'info') return; if (locked(cur)) { m.push(gate.badgePage(cur.control!)); return; } if (cur.act) cur.act(); else cur.adjust?.(1); }
      else if (e === 'menuAlt') { if (cur && !locked(cur)) cur.alt?.(); }
      else if (e === 'menuAlt2') { if (cur && !locked(cur)) cur.alt2?.(); }
      else if (e === 'menuBack') { if (st.stack.length) { st.stack.pop(); st.focus = 0; fix(); } else m.close(); }
    },
  };
  return m;
}

/** Radial: which of n slices (slice 0 centred straight up, clockwise) a stick points at; -1 inside the dead zone. */
export function radialSlice(x: number, y: number, n: number, dead = .5) {
  if (Math.hypot(x, y) < dead || n <= 0) return -1;
  const a = (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI); return Math.round(a / (2 * Math.PI / n)) % n;
}

/** Pad number entry for numeric test answers: mantissa ± (d-pad), exponent (LB/RB), sign (X). value = m × 10^e. */
export function createNumberEntry(m0 = 1, e0 = 0) {
  const s = { m: m0, e: e0 };
  const round = (x: number) => Math.round(x * 100) / 100;
  return {
    s, value: () => s.m * 10 ** s.e, text: () => `${s.m.toFixed(2)} × 10^${s.e}`,
    input(ev: MenuEvent): boolean {
      if (ev === 'menuUp') s.m = round(s.m + .1); else if (ev === 'menuDown') s.m = round(s.m - .1);
      else if (ev === 'menuRight') s.m = round(s.m + .01); else if (ev === 'menuLeft') s.m = round(s.m - .01);
      else if (ev === 'menuTabNext') s.e++; else if (ev === 'menuTabPrev') s.e--;
      else return false;
      if (Math.abs(s.m) >= 10) { s.m = round(s.m / 10); s.e++; } else if (s.m !== 0 && Math.abs(s.m) < 1) { s.m = round(s.m * 10); s.e--; }
      return true;
    },
  };
}
