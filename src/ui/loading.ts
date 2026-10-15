/**
 * Startup loading screen (Grok Bot): covers shader warm-up (renderer.compileAsync), the sky/PMREM bake, the first chunks
 * and the resource probe, then fades out, so the startup stutter happens behind it.
 * Cards come from public/loading/manifest.json: { "cards": [{ "image": "/loading/cards/x.webp", "fact": "…", "source": "…",
 * "video"?: "https://…" }] }. The image is background art only (no text baked in); the fact is an HTML overlay with its
 * source. `video` is schema-only for now (not played). Without a manifest the built-in facts show on a plain background.
 */
export interface LoadingCard { image?: string; fact: string; source?: string; video?: string }
/** Fallback when the manifest is missing/offline (same facts as the shipped manifest's first cards). */
export const FALLBACK_CARDS: LoadingCard[] = [
  { fact: 'Before fire suppression, forests in the Kenora region burned on average about once a century, so most stands were younger than about 150 years.', source: 'Heinselman 1973, Quaternary Research 3:329; Van Wagner 1978, Can. J. For. Res. 8:220' },
  { fact: 'Jack pine cones are sealed with resin that melts at about 50 °C, so a fire opens them and seeds the burn.', source: 'Rudolph & Laidly 1990, Silvics of North America (USDA Agric. Handb. 654)' },
];
export const LOADING = { cardSeconds: 7, fadeMs: 900, manifest: '/loading/manifest.json' };

/** Pure: which item to show after `elapsed` seconds in a list of `n`. */
export const cardIndex = (elapsed: number, n: number, secs = LOADING.cardSeconds) => n ? Math.floor(elapsed / secs) % n : 0;

/** Pure: valid cards of a manifest (a fact is required; images must be local /loading/cards/ art). */
export const manifestCards = (m: { cards?: LoadingCard[] } | null | undefined) => (m?.cards ?? []).filter(c => typeof c?.fact === 'string' && c.fact.length > 0 && (c.image === undefined || /^\/loading\/cards\/[\w-]+\.webp$/.test(c.image)));
export function createLoading(root = document.getElementById('loading') as HTMLElement) {
  const text = root.querySelector('.loading-card') as HTMLElement, src = root.querySelector('.loading-source') as HTMLElement, stepEl = root.querySelector('.loading-step') as HTMLElement;
  const bar = root.querySelector('.loading-bar i') as HTMLElement, art = root.querySelector('.loading-art') as HTMLElement;
  const start = performance.now(); let cards = FALLBACK_CARDS, shown = -1, done = false;
  const tick = () => { if (done) return; const i = cardIndex((performance.now() - start) / 1000, cards.length);
    if (i !== shown) { shown = i; const c = cards[i]; text.textContent = c.fact; src.textContent = c.source ? `Source: ${c.source}` : '';
      art.style.backgroundImage = c.image ? `url("${c.image}")` : 'none'; const next = cards[(i + 1) % cards.length]; if (next.image) new Image().src = next.image; } // preload the next card
    setTimeout(tick, 500); };
  fetch(LOADING.manifest).then(r => r.ok ? r.json() : null).then(m => { const c = manifestCards(m); if (c.length) { cards = c; shown = -1; } }).catch(() => {}).finally(tick);
  return {
    step(label: string, fraction: number) { stepEl.textContent = label; bar.style.width = `${Math.round(100 * Math.min(1, fraction))}%`; },
    async finish() { done = true; root.classList.add('fade'); await new Promise(r => setTimeout(r, LOADING.fadeMs)); root.remove(); },
  };
}
