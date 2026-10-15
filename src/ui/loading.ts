/**
 * Startup loading screen (Grok Bot): covers the first seconds while shaders compile (renderer.compileAsync), the sky/PMREM
 * bake, the first chunks and the resource probe run, then fades out, so the startup stutter happens behind it.
 * Cycles REMOTE videos listed in public/loading/manifest.json ({ "videos": [{ "src": "https://…/clip.mp4", "caption": "…" }] });
 * clips are hosted online, never bundled: only https URLs are used, preload=metadata, a clip that has not started playing
 * within LOADING.clipTimeoutMs is skipped. Offline, empty or all clips failing → it cycles info cards about boreal ecology. The overlay element lives in index.html so it paints first.
 */
export interface LoadingVideo { src: string; caption?: string }
/** Info cards (short, cited facts; shown over videos too). */
export const ECOLOGY_CARDS = [
  'Fire renews this forest. Around Kenora a stand burned on average about once a century before suppression, so most forest was younger than 150 years (Heinselman 1973; Van Wagner 1978).',
  'Jack pine cones are serotinous: resin seals them shut until fire heat (about 50 °C) opens them, seeding the burn.',
  'Black spruce grows in cold, wet peatlands. Its lowest branches root where moss buries them (layering), so clones ring the parent tree.',
  'Trembling aspen spreads by root suckers; one clone can hold thousands of stems that leaf out the same week.',
  'Beaver dams raise ponds that flood and kill trees, then drain into meadows: a cycle of decades across the Shield.',
  'Snowshoe hare numbers rise and crash on a roughly ten-year cycle, and lynx follow a year or two behind (Krebs et al. 2001).',
  'The Canadian Shield was scraped bare by ice that melted about 10,000 years ago; its lakes fill the hollows the glaciers left.',
  'Grey wolves here hunt deer, moose and beaver; a pack’s territory can span several hundred square kilometres.',
];
export const LOADING = { cardSeconds: 7, clipTimeoutMs: 3000, fadeMs: 900, manifest: '/loading/manifest.json' };

/** Pure: which item to show after `elapsed` seconds in a list of `n`. */
export const cardIndex = (elapsed: number, n: number, secs = LOADING.cardSeconds) => n ? Math.floor(elapsed / secs) % n : 0;

/** Pure: the usable clips of a manifest (remote https only; repo-bundled paths are ignored by design). */
export const remoteVideos = (m: { videos?: LoadingVideo[] }) => (m.videos ?? []).filter(v => typeof v?.src === 'string' && /^https:\/\//i.test(v.src));
export function createLoading(root = document.getElementById('loading') as HTMLElement) {
  const text = root.querySelector('.loading-card') as HTMLElement, stepEl = root.querySelector('.loading-step') as HTMLElement;
  const bar = root.querySelector('.loading-bar i') as HTMLElement, video = root.querySelector('video') as HTMLVideoElement;
  const start = performance.now(); let videos: LoadingVideo[] = [], vi = 0, done = false;
  const card = () => { if (!done) { text.textContent = ECOLOGY_CARDS[cardIndex((performance.now() - start) / 1000, ECOLOGY_CARDS.length)]; setTimeout(card, 1000); } };
  card();
  video.preload = 'metadata'; let timer: ReturnType<typeof setTimeout> | undefined;
  const drop = () => { clearTimeout(timer); videos.splice(vi % Math.max(1, videos.length), 1); if (videos.length && !done) play(); else { video.hidden = true; video.removeAttribute('src'); } };
  const play = () => { const v = videos[vi % videos.length]; video.hidden = true; video.src = v.src;
    clearTimeout(timer); timer = setTimeout(drop, LOADING.clipTimeoutMs); void video.play().catch(drop); };
  video.onplaying = () => { clearTimeout(timer); video.hidden = false; };
  video.onended = () => { vi++; play(); }; video.onerror = drop;
  if (navigator.onLine !== false) fetch(LOADING.manifest).then(r => r.ok ? r.json() : { videos: [] }).then((m: { videos?: LoadingVideo[] }) => { videos = remoteVideos(m); if (videos.length && !done) play(); }).catch(() => {});
  return {
    step(label: string, fraction: number) { stepEl.textContent = label; bar.style.width = `${Math.round(100 * Math.min(1, fraction))}%`; },
    async finish() { done = true; clearTimeout(timer); root.classList.add('fade'); await new Promise(r => setTimeout(r, LOADING.fadeMs)); video.pause(); video.removeAttribute('src'); root.remove(); },
  };
}
