/**
 * Pad menu (Grok Bot, Matt: "all of these need to be accessible through the xbox gamepad"). Menu opens it; LB/RB switch
 * tabs (Layers, Camera, Time, Badges, Gallery, Settings); d-pad / LS move with auto-repeat; A select; ←/→ adjust; B back.
 * Tabs read the live panels owned elsewhere through the DOM (globe layer panel, camera panel) so they never fork their
 * state. Gated items (core/badges canUse) show a lock and open their badge page: study link, pad-friendly test (hints on X,
 * number entry on the d-pad, retry with fresh questions), redeem credits, or buy.
 */
import { CONTROL, balance, buy, canUse, drawTest, hint, missingPrereqs, redeem, submitTest, type Question } from '../core/badges';
import { createMenuModel, createNumberEntry, type Item, type MenuEvent, type Page, type Tab } from './padNav';
import { glyph } from './gamepadSettings';

export interface PadMenuHost { act(id: string): void; shutter(): void; settings(): void; help(): void; close(): void; notice(t: string): void }
const q = (s: string) => document.querySelector(s);
const labelOf = (el: Element) => (el.closest('label')?.textContent ?? el.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
const fire = (el: HTMLElement, type: string) => el.dispatchEvent(new Event(type, { bubbles: true }));

/** Range / checkbox / select inside a live panel as menu items (labels from the panel, disabled = locked). */
export function domItems(root: Element | null, controlFor: (el: HTMLInputElement | HTMLSelectElement, label: string) => string | undefined): Item[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll('input,select')).map(n => n as HTMLInputElement | HTMLSelectElement).filter(el => !(el instanceof HTMLInputElement) || ['range', 'checkbox'].includes(el.type)).map(el => {
    const label = labelOf(el).replace(/\s*[-\d.]+$/, '') || el.id || 'setting', control = controlFor(el, label);
    if (el instanceof HTMLSelectElement) return { label, kind: 'choice', control, value: () => el.selectedOptions[0]?.text ?? '',
      adjust(d) { if (el.disabled) return; const o = Array.from(el.options), n = o.length; let i = el.selectedIndex; for (let k = 0; k < n; k++) { i = (i + d + n) % n; if (!o[i].disabled) break; } el.selectedIndex = i; fire(el, 'change'); } } as Item;
    if (el.type === 'checkbox') return { label, kind: 'toggle', control, value: () => el.disabled ? '—' : el.checked ? 'On' : 'Off', act() { if (!el.disabled) el.click(); }, adjust() { if (!el.disabled) el.click(); } } as Item;
    return { label, kind: 'range', control, value: () => (el.nextElementSibling?.textContent || el.value),
      adjust(d) { if (el.disabled) return; const st = Number(el.step) || 1; el.value = String(Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + d * st))); fire(el, 'input'); fire(el, 'change'); } } as Item;
  });
}
const has = (id: string) => id in CONTROL ? id : undefined;
export const layerControl = (layer: string) => has(`layer.${layer === 'fieldLines' ? 'magnetosphere' : layer}`);
export const cameraControl = (el: Element) => el instanceof HTMLSelectElement ? 'camera.filters' : 'camera.exposure';
const reloadWith = (k: string, v: string) => { const u = new URL(location.href); u.searchParams.set(k, v); location.href = u.toString(); };

export function quizPage(id: string, done: () => void): Page {
  let qs: Question[] = drawTest(id), i = 0, answers: number[] = [], hints: number[] = [], shown = '', result: ReturnType<typeof submitTest> | undefined, entry = createNumberEntry();
  const restart = () => { qs = drawTest(id); i = 0; answers = []; hints = []; shown = ''; result = undefined; entry = createNumberEntry(); };
  const answer = (a: number) => { answers[i] = a; i++; shown = ''; entry = createNumberEntry(); if (i >= qs.length) { result = submitTest(id, qs, answers, Date.now(), hints); if (result.passed) done(); } };
  const page: Page = {
    title: `Test · ${CONTROL[id].subject}`,
    items() {
      if (!qs.length) return [{ label: 'No sourced questions for this control yet. Credits still unlock it.', kind: 'info' }];
      if (result) return [{ label: result.message, kind: 'info' }, ...result.learn.slice(0, 3).map(u => ({ label: `Read: ${u}`, kind: 'action', act: () => open(u, '_blank') }) as Item),
        { label: 'Try again with new questions', kind: 'action', act: restart, hint: 'Y' }];
      const cur = qs[i], items: Item[] = [{ label: `Question ${i + 1} of ${qs.length}: ${cur.q}`, kind: 'info' }];
      if (cur.explainer) items.push({ label: `Study: ${cur.explainer}`, kind: 'info' });
      if (shown) items.push({ label: `Hint: ${shown}`, kind: 'info' });
      if (cur.choices) cur.choices.forEach((c, k) => items.push({ label: c, kind: 'action', act: () => answer(k) }));
      else items.push({ label: 'Your answer', kind: 'range', value: () => entry.text(), act: () => answer(entry.value()), hint: '↕ ±0.1 · ↔ ±0.01 · LB/RB ×10 · A submit' });
      items.push({ label: 'Hint (fewer credits, still passes)', kind: 'action', act: () => { shown = hint(cur, hints[i] ?? 0); hints[i] = (hints[i] ?? 0) + 1; }, hint: 'X' });
      items.push({ label: 'Read the textbook page', kind: 'action', act: () => open(cur.learn, '_blank') });
      return items;
    },
    onEvent(e: MenuEvent) {
      if (result) { if (e === 'menuAlt2') { restart(); return true; } return false; }
      const cur = qs[i]; if (!cur) return false;
      if (e === 'menuAlt') { shown = hint(cur, hints[i] ?? 0); hints[i] = (hints[i] ?? 0) + 1; return true; }
      if (!cur.choices && ['menuUp', 'menuDown', 'menuLeft', 'menuRight', 'menuTabPrev', 'menuTabNext'].includes(e)) return entry.input(e);
      if (!cur.choices && e === 'menuSelect') { answer(entry.value()); return true; }
      return false;
    },
  };
  return page;
}
export function badgePage(id: string, push: (p: Page) => void, notice: (t: string) => void): Page {
  return { title: `Badge · ${CONTROL[id]?.subject ?? id}`, items() {
    if (!CONTROL[id]) return [{ label: 'No badge set up for this control yet.', kind: 'info' }];
    const c = CONTROL[id], miss = missingPrereqs(id), out: Item[] = [{ label: canUse(id) ? '✅ Unlocked' : `🔒 Locked · you have ${balance()} credits`, kind: 'info' }];
    if (canUse(id)) return out;
    if (miss.length) out.push({ label: `First earn: ${miss.map(m => CONTROL[m]?.subject ?? m).join(', ')}`, kind: 'info' }, ...miss.slice(0, 4).map(m => ({ label: `Go to: ${CONTROL[m]?.subject ?? m}`, kind: 'action', act: () => push(badgePage(m, push, notice)) }) as Item));
    out.push({ label: 'Study first (opens the free textbook page)', kind: 'action', act: () => open(c.learn, '_blank') });
    if (!miss.length) out.push({ label: 'Take the test (70% passes, hints allowed)', kind: 'action', act: () => push(quizPage(id, () => notice('Badge earned.'))) },
      { label: `Redeem ${c.cost} credits`, kind: 'action', act: () => { const r = redeem(id); notice(r.ok ? 'Badge unlocked with credits.' : `Not yet: ${r.why}`); } },
      { label: 'Buy (when the game is on a store)', kind: 'action', act: () => void buy(id).then(r => notice(r.ok ? 'Badge bought.' : `Not yet: ${r.why}`)) });
    return out; } };
}

export function buildTabs(host: PadMenuHost, push: (p: Page) => void): Tab[] {
  const info = (label: string): Item => ({ label, kind: 'info' });
  let rate = 1, deep = 0; const RATES = [.05, .1, .25, .5, 1], DEEP = [0, -1e6, -6.6e7, -2.5e8, -5.4e8, -1e9, -2.5e9, -4e9, -4.5e9];
  const yrs = (y: number) => y === 0 ? 'Today' : `${(-y / 1e6).toLocaleString()} million years ago`;
  return [
    { id: 'layers', label: 'Layers', items: () => { const it = domItems(q('#globe-layers'), el => layerControl((el as HTMLElement).dataset.layer ?? ''));
      return it.length ? it : [info('Layer switches live on the planet view.'), { label: 'Go to the planet view', kind: 'action', act: () => { host.close(); host.act('planet'); } }]; } },
    { id: 'camera', label: 'Camera', items: () => [{ label: 'Take a photo', kind: 'action', act: () => { host.close(); host.shutter(); }, hint: 'RS click' },
      ...(domItems(q('#camera-panel'), cameraControl).length ? domItems(q('#camera-panel'), cameraControl) : [info('The camera panel is not on screen here yet (the Sun viewer has it).')])] },
    { id: 'time', label: 'Time', items: () => [
      { label: 'Time of day (chronometer)', kind: 'action', act: () => { host.close(); host.act('chrono'); }, hint: 'D-pad ↑' },
      { label: 'Slow motion', kind: 'choice', control: has('time.rate'), value: () => `×${RATES[rate === 1 ? RATES.length - 1 : RATES.indexOf(rate)] ?? rate} (A applies)`, adjust: d => { const i = Math.max(0, RATES.indexOf(rate)); rate = RATES[Math.min(RATES.length - 1, Math.max(0, i + d))]; }, act: () => reloadWith('timescale', String(rate)) },
      { label: 'Deep time', kind: 'choice', control: has('deeptime.seed'), value: () => `${yrs(deep)} (A applies)`, adjust: d => { const i = Math.max(0, DEEP.indexOf(deep)); deep = DEEP[Math.min(DEEP.length - 1, Math.max(0, i + d))]; }, act: () => reloadWith('deep', String(deep)) }] },
    { id: 'badges', label: 'Badges', items: () => [info(`Credits: ${balance()}`), ...Object.keys(CONTROL).map(id => ({ label: `${canUse(id) ? '✅' : '🔒'} ${CONTROL[id].subject}`, kind: 'action', act: () => push(badgePage(id, push, host.notice)) }) as Item)] },
    { id: 'gallery', label: 'Gallery', items: () => [{ label: 'Photo mode (free camera, rewind)', kind: 'action', act: () => { host.close(); host.act('photo'); } },
      { label: 'Take a photo', kind: 'action', act: () => { host.close(); host.shutter(); } }, info('Leaving photo mode opens the gallery: d-pad moves, A picks, B closes.')] },
    { id: 'settings', label: 'Settings', items: () => [{ label: 'Gamepad settings (3D controller, rebinding)', kind: 'action', act: () => { host.close(); host.settings(); } },
      { label: 'Controls help', kind: 'action', act: () => { host.close(); host.help(); }, hint: 'View' },
      { label: 'Debug HUD', kind: 'action', act: () => host.act('inspector'), hint: 'D-pad ↓' },
      { label: 'Planet view', kind: 'action', act: () => { host.close(); host.act('planet'); } },
      { label: 'Pause menu (save, music, graphics, quit)', kind: 'action', act: () => { host.close(); host.act('pause'); } }] },
  ];
}

export const PAD_CSS = `.padm{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:70;width:min(980px,92vw);max-height:86vh;overflow:auto;background:#0d131ef2;color:#eef2f8;font:22px/1.35 system-ui;border-radius:16px;padding:18px 22px;box-shadow:0 10px 40px #000a}
.padm .tabs{display:flex;gap:8px;align-items:center;margin-bottom:12px}.padm .tab{padding:6px 14px;border-radius:10px;background:#1c2433;color:#9aa6b8}.padm .tab.on{background:#2d6cdf;color:#fff}
.padm h3{margin:4px 0 10px;font-size:24px}.padm .it{display:flex;justify-content:space-between;gap:14px;padding:10px 14px;border:3px solid transparent;border-radius:12px;margin:3px 0}
.padm .it.info{color:#b8c2d4;font-size:19px}.padm .it.focus{border-color:#ffd54a;background:#1f2a3d;box-shadow:0 0 0 4px #ffd54a40}.padm .it .v{color:#9fe}.padm .it.lock{color:#889}.padm .it.lock .v{color:#fc6}
.padm .foot{margin-top:12px;font-size:18px;color:#ccd}.padm .g,.padh .g,.padx .g{display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;height:1.6em;padding:0 .3em;border-radius:1em;font-weight:700;font-size:.85em;color:#000;margin:0 .15em}
.gA{background:#3c3}.gB{background:#e44}.gX{background:#47f;color:#fff!important}.gY{background:#eb2}.gS{background:#ccd;border-radius:.4em!important}
.padh{position:fixed;inset:5vh 6vw;z-index:71;background:#0d131ef5;color:#eef2f8;font:19px/1.35 system-ui;border-radius:16px;padding:18px 24px;overflow:auto}.padh table{border-collapse:collapse;width:100%}.padh td,.padh th{padding:5px 10px;border-bottom:1px solid #2a3344;text-align:left;vertical-align:top}
.padx{position:fixed;left:16px;bottom:280px;z-index:65;max-width:min(560px,calc(100vw - 32px));background:#0009;color:#eef;font:17px/1.35 system-ui;padding:6px 10px;border-radius:10px}
.padr{position:fixed;left:50%;top:50%;width:520px;height:520px;margin:-260px 0 0 -260px;z-index:72;border-radius:50%;background:radial-gradient(#0d131ef0 30%,#0d131ec0);color:#fff;font:18px system-ui}
.padr .s{position:absolute;width:150px;margin-left:-75px;text-align:center;padding:8px;border-radius:12px;border:3px solid transparent}.padr .s.focus{border-color:#ffd54a;background:#1f2a3d}.padr .s.lock{color:#889}.padr .c{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);text-align:center;width:180px}
.pad-focus{outline:4px solid #ffd54a!important;outline-offset:2px}`;
export function ensureCss() { if (!document.getElementById('padm-css')) { const s = document.createElement('style'); s.id = 'padm-css'; s.textContent = PAD_CSS; document.head.append(s); } }

export function createPadMenu(host: PadMenuHost) {
  ensureCss();
  let model: ReturnType<typeof createMenuModel>;
  const tabs = buildTabs({ ...host, close: () => { model.close(); render(); host.close(); } }, p => model.push(p));
  model = createMenuModel(tabs, { canUse, badgePage: id => badgePage(id, p => model.push(p), host.notice) });
  const root = document.createElement('div'); root.className = 'padm'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Pad menu'); document.body.append(root);
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  function render() {
    root.hidden = !model.st.open; if (!model.st.open) return;
    const its = model.items(), st = model.st;
    root.innerHTML = `<div class="tabs">${st.stack.length ? '' : glyph('LB')}${tabs.map((t, i) => `<span class="tab${i === st.tab ? ' on' : ''}">${t.label}</span>`).join('')}${st.stack.length ? '' : glyph('RB')}</div><h3>${esc(model.title())}</h3>` +
      its.map((it, i) => { const lk = model.locked(it); return `<div class="it ${it.kind}${i === st.focus ? ' focus' : ''}${lk ? ' lock' : ''}"><span>${lk ? '🔒 ' : ''}${esc(it.label)}${it.hint ? ` <small style="color:#99a">${esc(it.hint)}</small>` : ''}</span><span class="v">${lk ? 'A: unlock' : esc(it.value?.() ?? (it.kind === 'action' ? '›' : ''))}</span></div>`; }).join('') +
      `<div class="foot">${glyph('↕')} move · ${glyph('↔')} adjust · ${glyph('A')} select · ${glyph('X')} hint · ${glyph('Y')} retry · ${glyph('B')} back</div>`;
    root.querySelector('.focus')?.scrollIntoView({ block: 'nearest' });
  }
  return { model, root, render, open(tab?: string) { model.open(tab); render(); }, close() { model.close(); render(); }, get isOpen() { return model.st.open; },
    input(e: MenuEvent) { model.input(e); render(); } };
}
