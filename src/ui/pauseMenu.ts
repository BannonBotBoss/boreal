/**
 * Pause menu (Grok Bot). A shell with fixed actions plus a panel registry, so later panels (world-gen settings,
 * player settings) slot in with one `addPanel` call and no menu changes.
 */
export interface PausePanel { id: string; title: string; build(): HTMLElement }
export function createPauseMenu(actions: { resume(): void; photo(): void }) {
  const root = document.createElement('div'); root.id = 'pause-menu'; root.hidden = true;
  root.innerHTML = '<h2>Paused</h2><nav><button data-a="resume">Resume</button><button data-a="photo">Photo mode (P)</button></nav><section class="panels"></section>';
  document.body.append(root);
  const nav = root.querySelector('nav')!, body = root.querySelector<HTMLElement>('.panels')!;
  root.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    if (t.dataset.a === 'resume') actions.resume(); else if (t.dataset.a === 'photo') actions.photo();
    else if (t.dataset.panel) { const p = panels.get(t.dataset.panel)!; body.replaceChildren(p.build()); }
  });
  const panels = new Map<string, PausePanel>();
  return {
    show(on: boolean) { root.hidden = !on; if (!on) body.replaceChildren(); },
    addPanel(p: PausePanel) {
      panels.set(p.id, p); const b = document.createElement('button'); b.dataset.panel = p.id; b.textContent = p.title; nav.append(b);
    },
  };
}
