/** Generic pause-menu panel for any settings schema (Grok Bot). */
import type { SettingDef, createSettingsStore } from '../core/renderSettings';
type Store = ReturnType<typeof createSettingsStore>;

export function settingsPanel(schema: SettingDef[], store: Store, onRegen: () => void) {
  return () => {
    const form = document.createElement('form'); form.className = 'settings';
    const note = document.createElement('p'); note.className = 'note';
    const flag = (regen: boolean) => { if (regen) { onRegen(); note.textContent = 'Some changes rebuild the world: they apply when you resume.'; } };
    let group = '';
    for (const d of schema) {
      if (d.group !== group) { const h = document.createElement('h3'); h.textContent = group = d.group; form.append(h); }
      const label = document.createElement('label'); label.textContent = d.label + (d.regen ? ' *' : '');
      const v = store.get(d.id);
      let input: HTMLInputElement | HTMLSelectElement;
      if (d.type === 'select') { input = document.createElement('select'); for (const o of d.options!) input.add(new Option(o, o, false, o === v)); }
      else { input = document.createElement('input'); input.type = d.type === 'toggle' ? 'checkbox' : 'range';
        if (d.type === 'toggle') input.checked = !!v; else Object.assign(input, { min: d.min, max: d.max, step: d.step, value: v }); }
      const out = document.createElement('output'); if (d.type === 'slider') out.textContent = String(v);
      input.addEventListener('input', () => {
        const val = d.type === 'toggle' ? (input as HTMLInputElement).checked : d.type === 'slider' ? Number(input.value) : input.value;
        out.textContent = d.type === 'slider' ? String(val) : ''; flag(store.set(d.id, val));
      });
      label.append(input, out); form.append(label);
    }
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset to defaults';
    reset.onclick = () => { flag(store.reset()); form.replaceWith(settingsPanel(schema, store, onRegen)()); };
    const legend = document.createElement('p'); legend.textContent = '* applies when you resume (the world regenerates).';
    form.append(legend, note, reset);
    return form;
  };
}
