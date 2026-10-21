/**
 * ONE table of the game's input bindings (keyboard and standard-mapping gamepad), listed by the menu's Controls panel.
 * The handlers live where they act (main.ts, audio/borealSound, photo/photoMode, render/flora, ui/menu); keep this in step.
 */
export const BINDINGS: { action: string; keys: string; pad: string }[] = ([
  ['Move forward / back', 'W / S', 'Left stick up / down'],
  ['Steer', 'A / D', 'Left stick left / right'],
  ['Look around / tilt', 'Arrow keys · drag with mouse', 'Right stick'],
  ['Run', 'Shift', 'RT'],
  ['Stealth', 'C', 'LT'],
  ['Sprint (1.5 s)', 'Shift, then C', 'RT, then LT'],
  ['Super stealth (focus)', 'C, then Shift', 'LT, then RT'],
  ['Jump / pounce', 'Space', 'X'],
  ['Interact', 'E · click the action button', 'A'],
  ['Chronometer (time of day)', 'T', 'View'],
  ['Chronometer: scrub time', '← / → · drag the dial', 'D-pad ← / → · left stick'],
  ['Chronometer: close', 'T · Esc', 'B · View'],
  ['Pause menu', 'Esc', 'Menu'],
  ['Close panel', 'Esc', 'B'],
  ['Planet view', 'Shift+G', '—'],
  ['Photo mode', 'P (P / Esc leaves)', '—'],
  ['Photo mode keys', ', / . step · K play · L live · F photo · R record · B sequence · H panel', '—'],
  ['Generation inspector', 'I', '—'],
  ['Howl / growl', 'H / G', '—'],
  ['Mute', 'M', '—'],
  ['Sound volume', '[ / ]', '—'],
  ['Music on / off · volume', 'N · - / =', '—'],
  ['Flora patch view', 'V', '—'],
  ['Menus', '↑ / ↓ or Tab · Enter · Esc back', 'D-pad / left stick · A choose · B back'],
] as const).map(([action, keys, pad]) => ({ action, keys, pad }));

export function controlsPanel() {
  const table = document.createElement('table'); table.className = 'controls-table';
  const row = (cells: string[], tag: 'th' | 'td') => { const tr = table.insertRow(); for (const c of cells) tr.append(Object.assign(document.createElement(tag), { textContent: c })); };
  row(['Action', 'Keyboard / mouse', 'Gamepad'], 'th'); for (const b of BINDINGS) row([b.action, b.keys, b.pad], 'td');
  const wrap = document.createElement('div'); wrap.className = 'controls-wrap'; wrap.append(table); return wrap; // scrolls inside, so the title stays in view
}
