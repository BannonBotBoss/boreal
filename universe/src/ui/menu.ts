/**
 * Start menu for Boreal Universe — Generate universe is the primary action.
 * Deliberately separate from the forest game's ui/menu.ts.
 */
import { mintUniverseSeed, normalizeUniverseSeed } from '../core/universeSeed';

export interface MenuHooks {
  universeSeed(): number;
  generateUniverse(o?: { seed?: number }): void;
  close(): void;
}

export function createMenu(hooks: MenuHooks) {
  const root = document.createElement('div');
  root.id = 'start-menu';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Menu');
  Object.assign(root.style, {
    position: 'fixed', inset: '0', zIndex: '40', display: 'grid',
    placeItems: 'center start',
    background: 'linear-gradient(100deg, #05070cee 0%, #05070c66 55%, #05070c00 100%)',
    transition: 'opacity .45s',
  } as CSSStyleDeclaration);

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    marginLeft: '7vw', display: 'grid', gap: '10px',
    minWidth: '280px', maxWidth: 'min(460px, 86vw)',
  } as CSSStyleDeclaration);
  root.append(panel);
  document.body.append(root);

  let open = false;
  let stack: (() => void)[] = [];

  const btn = (label: string, on: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, {
      textAlign: 'left', fontSize: '16px', padding: '12px 18px', cursor: 'pointer',
      fontFamily: '"Iowan Old Style", Palatino, Georgia, serif',
      background: '#121820e8', color: '#e8e4d4', border: '1px solid #3a4658',
    } as CSSStyleDeclaration);
    b.onmouseenter = () => { b.style.borderColor = '#c4a35a'; };
    b.onmouseleave = () => { b.style.borderColor = '#3a4658'; };
    b.onclick = on;
    return b;
  };

  const page = (title: string, ...nodes: Node[]) => {
    panel.replaceChildren();
    const h = document.createElement('h2');
    h.textContent = title;
    Object.assign(h.style, {
      font: '400 44px "Iowan Old Style", Palatino, Georgia, serif',
      margin: '0 0 10px', letterSpacing: '-1px', color: '#f0e6c8',
    } as CSSStyleDeclaration);
    panel.append(h, ...nodes);
    (panel.querySelector('button') as HTMLElement | null)?.focus();
  };

  const sub = (render: () => void) => { stack.push(render); render(); };
  const back = () => { stack.pop(); (stack[stack.length - 1] ?? main)(); };
  const backBtn = () => btn('Back', back);

  function main() {
    stack = [];
    page(
      'Boreal Universe',
      btn('Generate universe', () => { hooks.generateUniverse({}); hide(); }),
      btn('Universe options…', () => sub(options)),
      btn('Continue', () => { hide(); hooks.close(); }),
    );
  }

  function options() {
    const seed = Object.assign(document.createElement('input'), {
      type: 'number',
      value: String(hooks.universeSeed() || mintUniverseSeed()),
      min: '1',
      step: '1',
    });
    seed.setAttribute('aria-label', 'Universe seed');
    Object.assign(seed.style, {
      width: '100%', padding: '8px 10px', background: '#0b1018', color: '#e8e4d4',
      border: '1px solid #3a4658', font: '14px ui-monospace, monospace',
    } as CSSStyleDeclaration);
    const note = document.createElement('p');
    note.textContent = 'Same seed → same universe. Laws stay fixed; only the seed changes.';
    Object.assign(note.style, { font: '12px ui-sans-serif, system-ui', color: '#c9b87a', margin: '0' });
    const lab = document.createElement('label');
    lab.textContent = 'Universe seed';
    Object.assign(lab.style, { display: 'grid', gap: '6px', font: '13px ui-sans-serif, system-ui', color: '#c9d2c0' });
    lab.append(seed);
    page(
      'Universe seed',
      note,
      lab,
      btn('New seed', () => { seed.value = String(mintUniverseSeed()); }),
      btn('Generate', () => {
        const u = normalizeUniverseSeed(Number(seed.value)) || mintUniverseSeed();
        hooks.generateUniverse({ seed: u });
        hide();
      }),
      backBtn(),
    );
  }

  function show() {
    open = true;
    root.hidden = false;
    root.style.opacity = '1';
    root.style.pointerEvents = 'auto';
    main();
  }

  function hide() {
    if (!open) return;
    open = false;
    root.style.opacity = '0';
    root.style.pointerEvents = 'none';
    setTimeout(() => { if (!open) root.hidden = true; }, 450);
    hooks.close();
  }

  root.hidden = true;
  root.style.opacity = '0';
  root.style.pointerEvents = 'none';

  addEventListener('keydown', (e) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (stack.length) back();
      else hide();
    }
  });

  return { show, hide, get open() { return open; } };
}
