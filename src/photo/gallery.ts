/**
 * End-of-session gallery (Grok Bot). Captures are kept as recipes (snapshot + camera + post settings), not pixels, so
 * stills and sequences re-render at whatever resolution/format is chosen here. Video keeps its recorded pixels.
 */
import type { Snapshot } from '../core/snapshot';
import type { PhotoView } from '../render/buildScene';
import type { PhotoSettings } from '../render/post';
import { ASPECTS, RESOLUTIONS, clampVideo } from './frame';
import { zipStore } from './zip';

export interface Frame { snap: Snapshot; view: PhotoView }
export interface Capture {
  id: number; kind: 'photo' | 'sequence' | 'video'; frames: Frame[]; settings: PhotoSettings; aspect: string; thumb: string;
  video?: { blob: Blob; w: number; h: number }; selected: boolean;
  /** Set by the first edit, so the capture can be reverted. */
  original?: { settings: PhotoSettings; aspect: string; views: PhotoView[] };
}
export interface ExportOptions { resolution: string; aspect: string; custom: string; format: 'png' | 'jpeg'; quality: number; zip: boolean }
type Render = (c: Capture, f: Frame, o: ExportOptions) => Promise<Blob | null>;
interface Out { name: string; blob: Blob }

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const pad = (n: number) => String(n).padStart(4, '0');
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

export interface GalleryHooks { render: Render; /** reopen a capture in the photo-mode camera panel; resolves when saved or cancelled */ edit(c: Capture): Promise<void>; thumb(c: Capture): Promise<string> }
export function createGallery({ render, edit, thumb }: GalleryHooks, notice: (t: string) => void) {
  const captures: Capture[] = []; let nextId = 1;
  const opts: ExportOptions = { resolution: 'Native', aspect: 'As shot', custom: '', format: 'png', quality: .92, zip: true };
  const dlg = document.createElement('dialog'); dlg.id = 'photo-gallery'; document.body.append(dlg);
  let resolveClose: (() => void) | undefined;

  /** Every export/share goes through here: selected captures -> files (re-rendered) -> one bundle. */
  async function files(): Promise<Out[]> {
    const out: Out[] = [], ext = opts.format === 'jpeg' ? 'jpg' : 'png', chosen = captures.filter(c => c.selected);
    const seqs = chosen.filter(c => c.kind === 'sequence').length;
    for (const c of chosen) {
      if (c.video) { out.push({ name: `boreal_video_${c.id}.webm`, blob: c.video.blob }); continue; }
      for (let i = 0; i < c.frames.length; i++) {
        const blob = await render(c, c.frames[i], opts); if (!blob) continue;
        out.push({ name: c.kind === 'photo' ? `boreal_${c.id}.${ext}` : `${seqs > 1 ? `seq${c.id}/` : ''}boreal_seq_${pad(i + 1)}.${ext}`, blob });
      }
    }
    return out;
  }
  async function bundle(): Promise<Out[]> {
    const f = await files();
    if (f.length > 1 && opts.zip) return [{ name: `boreal_${stamp()}.zip`, blob: new Blob([zipStore(await Promise.all(f.map(async x => ({ name: x.name, data: new Uint8Array(await x.blob.arrayBuffer()) }))))] as BlobPart[], { type: 'application/zip' }) }];
    return f;
  }
  async function exportSel() {
    busy(true); try { const b = await bundle(); b.forEach((f, i) => setTimeout(() => download(f.blob, f.name), i * 250)); notice(`Exported ${b.length} file(s).`); } finally { busy(false); }
  }
  async function share() {
    busy(true);
    try {
      const b = await bundle(), shareFiles = b.map(f => new File([f.blob], f.name.replace('/', '_'), { type: f.blob.type }));
      if (navigator.canShare?.({ files: shareFiles })) { await navigator.share({ files: shareFiles, title: 'Boreal' }); return; }
      if (b.length === 1 && b[0].blob.type === 'image/png' && navigator.clipboard && 'ClipboardItem' in window) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': b[0].blob })]); notice('Sharing isn’t supported in this browser, so the image was copied to the clipboard.'); return;
      }
      notice('Sharing is not supported in this browser. Use Export instead.');
    } catch (e) { if ((e as Error).name !== 'AbortError') notice(`Share failed: ${String(e)}`); } finally { busy(false); }
  }
  function busy(on: boolean) { dlg.classList.toggle('busy', on); dlg.querySelectorAll('button').forEach(b => { b.disabled = on; }); }

  function draw() {
    const sel = (label: string, options: string[], value: string, on: (v: string) => void) =>
      `<label>${label}<select data-o="${label}">${options.map(o => `<option${o === value ? ' selected' : ''}>${o}</option>`).join('')}</select></label>`;
    dlg.innerHTML = `<h2>Photo session · ${captures.length} capture(s)</h2>
      <div class="grid">${captures.map(c => `<figure data-id="${c.id}" class="${c.selected ? 'on' : ''}"><img src="${c.thumb}" alt="">
        <figcaption><label><input type="checkbox" data-sel="${c.id}"${c.selected ? ' checked' : ''}> ${c.kind}${c.kind === 'sequence' ? ` (${c.frames.length})` : ''}${c.video ? ` ${c.video.w}×${c.video.h}` : ''}</label>
        <button data-prev="${c.id}">Preview</button>${c.video ? '' : `<button data-edit="${c.id}">Edit</button>`}${c.original ? `<button data-revert="${c.id}">Revert</button>` : ''}<button data-del="${c.id}">Delete</button></figcaption></figure>`).join('') || '<p>No captures this session.</p>'}</div>
      <div class="opts">${sel('Resolution', Object.keys(RESOLUTIONS), opts.resolution, () => {})}${sel('Aspect', ['As shot', ...Object.keys(ASPECTS)], opts.aspect, () => {})}
        <label>Custom W×H<input data-o="custom" value="${opts.custom}" placeholder="e.g. 5000x3000"></label>
        ${sel('Format', ['png', 'jpeg'], opts.format, () => {})}<label>JPEG quality<input data-o="quality" type="range" min=".5" max="1" step=".01" value="${opts.quality}"></label>
        <label><input data-o="zip" type="checkbox"${opts.zip ? ' checked' : ''}> Zip when several files</label>
        <p class="note">Stills and sequences re-render at this size and format. Videos keep the size they were recorded at (WebM, capped at ${clampVideo(1e5, 1e5).w > 0 ? '1080p' : ''}); 8K applies to stills only.</p></div>
      <div class="preview" hidden></div>
      <div class="actions"><button data-a="export">Export</button><button data-a="share">Share</button><button data-a="discard">Discard all</button><button data-a="done">Done</button></div>`;
  }
  dlg.addEventListener('change', e => {
    const t = e.target as HTMLInputElement & HTMLSelectElement;
    if (t.dataset.sel) { const c = captures.find(c => c.id === Number(t.dataset.sel))!; c.selected = t.checked; return; }
    const o = t.dataset.o; if (!o) return;
    if (o === 'Resolution') opts.resolution = t.value; else if (o === 'Aspect') opts.aspect = t.value; else if (o === 'Format') opts.format = t.value as 'png' | 'jpeg';
    else if (o === 'custom') opts.custom = t.value; else if (o === 'quality') opts.quality = Number(t.value); else if (o === 'zip') opts.zip = t.checked;
  });
  dlg.addEventListener('click', async e => {
    const t = e.target as HTMLElement, d = t.dataset;
    const byId = (id?: string) => captures.find(c => c.id === Number(id))!;
    if (d.edit) { const c = byId(d.edit); dlg.close(); await edit(c); await retouch(c); dlg.showModal(); draw(); return; }
    if (d.revert) { const c = byId(d.revert), o = c.original!; c.settings = o.settings; c.aspect = o.aspect; c.frames.forEach((f, i) => { f.view = o.views[i]; }); c.original = undefined; await retouch(c); draw(); return; }
    if (d.del) { const i = captures.findIndex(c => c.id === Number(d.del)); URL.revokeObjectURL(captures[i].thumb); captures.splice(i, 1); draw(); }
    else if (d.prev) {
      const c = captures.find(c => c.id === Number(d.prev))!, box = dlg.querySelector<HTMLElement>('.preview')!; box.hidden = false; box.textContent = 'Rendering…';
      if (c.video) { const v = document.createElement('video'); v.src = URL.createObjectURL(c.video.blob); v.controls = true; v.autoplay = true; box.replaceChildren(v); }
      else { const blob = await render(c, c.frames[0], { ...opts, resolution: 'Native', custom: '', format: 'jpeg', quality: .85 }); if (blob) { const i = new Image(); i.src = URL.createObjectURL(blob); box.replaceChildren(i); } }
      box.onclick = () => { box.hidden = true; };
    }
    else if (d.a === 'export') await exportSel();
    else if (d.a === 'share') await share();
    else if (d.a === 'discard') { if (captures.length && confirm(`Discard all ${captures.length} capture(s)? This can’t be undone.`)) { clear(); close(); } }
    else if (d.a === 'done') close();
  });
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(); });
  async function retouch(c: Capture) { const old = c.thumb; c.thumb = await thumb(c); URL.revokeObjectURL(old); }
  function clear() { for (const c of captures) URL.revokeObjectURL(c.thumb); captures.length = 0; }
  function close() { dlg.close(); const r = resolveClose; resolveClose = undefined; r?.(); }
  return {
    get count() { return captures.length; },
    add(c: Omit<Capture, 'id' | 'selected'>) { captures.push({ ...c, id: nextId++, selected: true }); return captures.length; },
    /** Shows the end-of-session menu; resolves when the user is done (kept captures stay for the next session). */
    review(): Promise<void> { draw(); dlg.showModal(); return new Promise(r => { resolveClose = r; }); },
  };
}
