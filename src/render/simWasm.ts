/**
 * One boreal_sim.wasm for the page. The planet, the litter and the drives
 * share this instance, so they share one memory and one set of thread-locals.
 * A caller that passes bytes (a test or a worker) gets its own instance.
 */
let browser: Promise<WebAssembly.Instance | null> | null = null;

async function instantiate(bytes?: BufferSource): Promise<WebAssembly.Instance | null> {
  try {
    let buf = bytes;
    if (!buf) {
      const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
      const response = await fetch(`${base}wasm/boreal_sim.wasm`);
      if (!response.ok) return null;
      buf = await response.arrayBuffer();
    }
    const { instance } = await WebAssembly.instantiate(buf, {});
    return instance;
  } catch {
    return null;
  }
}

export function wasmInstance(bytes?: BufferSource): Promise<WebAssembly.Instance | null> {
  if (bytes) return instantiate(bytes);
  browser ??= instantiate();
  return browser;
}
