/** "Play as" panel (Grok Bot): lists every Playable; unavailable ones show as 'coming soon'. Choice applies on resume. */
import { PLAYABLES } from '../render/playables';

export function playerPanel(get: () => string, choose: (id: string) => void) {
  return () => {
    const form = document.createElement('form'); form.className = 'settings';
    const h = document.createElement('h3'); h.textContent = 'Play as'; form.append(h);
    for (const p of PLAYABLES) {
      const label = document.createElement('label'); label.className = 'radio';
      const input = document.createElement('input'); input.type = 'radio'; input.name = 'playable'; input.value = p.id;
      input.checked = p.id === get(); input.disabled = !p.available; input.onchange = () => choose(p.id);
      label.append(input, ` ${p.label}${p.available ? '' : ` (${p.note ?? 'coming soon'})`}`); form.append(label);
    }
    const note = document.createElement('p'); note.textContent = 'Switching happens when you resume, at your current position.'; form.append(note);
    return form;
  };
}
