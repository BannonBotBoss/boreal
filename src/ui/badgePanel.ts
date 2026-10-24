/** Debug-panel stub for control badges (core/badges.ts): pick a control, study, answer, hints, then grade. Not yet mounted
 *  in a menu; call `mountBadgePanel(document.body)` from the console or a dev hook. */
import { CONTROL, canUse, missingPrereqs, drawTest, submitTest, hint, balance, redeem, buy } from '../core/badges';
export function mountBadgePanel(parent: HTMLElement) {
  const box = document.createElement('div'); box.style.cssText = 'position:fixed;right:8px;top:8px;width:340px;max-height:90vh;overflow:auto;background:#111c;color:#eee;font:12px sans-serif;padding:8px;z-index:99';
  const render = () => {
    box.innerHTML = `<b>Badges</b> · credits ${balance()}`;
    for (const id of Object.keys(CONTROL)) {
      const row = document.createElement('div'), miss = missingPrereqs(id);
      row.innerHTML = `${canUse(id) ? '✅' : '🔒'} ${id} <i>${CONTROL[id].subject}</i> ${miss.length ? `(needs ${miss.length})` : ''} `;
      if (!canUse(id) && !miss.length) for (const [label, fn] of [['test', () => quiz(id)], ['credits ' + CONTROL[id].cost, () => { alert(JSON.stringify(redeem(id))); render(); }], ['buy', async () => { alert(JSON.stringify(await buy(id))); render(); }]] as const) {
        const b = document.createElement('button'); b.textContent = label; b.onclick = () => void fn(); row.append(b);
      }
      box.append(row);
    }
  };
  const quiz = (id: string) => {
    const qs = drawTest(id); if (!qs.length) { alert('No sourced test yet for this control (todo). Credits still work.'); return; }
    const used = qs.map(() => 0), ans = qs.map(q => { let a = NaN;
      for (;;) { const r = prompt(`${q.q}\n\nStudy: ${q.explainer}\n${q.learn}\n\nType a number, or "h" for a hint.`); if (r === null) break;
        if (r.trim() === 'h') { alert(hint(q, used[qs.indexOf(q)]++)); continue; } a = Number(r); break; }
      return a; });
    const res = submitTest(id, qs, ans, Date.now(), used); alert(`${res.message}\n\nRead more:\n${res.learn.join('\n')}`); render();
  };
  render(); parent.append(box); return box;
}
