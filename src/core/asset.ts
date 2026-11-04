/** Resolve a root path ('/models/x.glb') under Vite's base, so GitHub Pages (/boreal/) finds public/ files. Absolute URLs pass through. */
export const BASE: string = ((import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/').replace(/\/?$/, '/');
export const asset = (p: string) => /^[a-z]+:|^\/\//i.test(p) ? p : BASE + p.replace(/^\.?\//, '');
