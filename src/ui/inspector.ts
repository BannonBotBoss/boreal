/**
 * Generation inspector (Grok Bot). Click anything to see the factors that generated it or drive it right now.
 * Generic: every view is a list of traced factors (proc/trace.ts) from the generators' own code, plus a few observed
 * values for systems without trace hooks yet. One panel renderer, one gizmo set, one what-if path (overrides by name).
 */
import * as THREE from 'three';
import { GROUND, column } from '../core/ground';
import { WEATHER, qsat, shortwave, solar, surfaceBalance, weatherAt, type SurfaceKind } from '../core/weather';
import { DELTA_KINDS, near as nearDeltas } from '../core/deltas';
import { GOVERNOR, applied } from '../core/quality';
const c2s = (c: ReturnType<typeof column>): SurfaceKind => c.layers[0]?.id === 'water' ? 'water' : c.layers[0]?.id === 'snow' ? 'snow' : c.cover ? 'forest' : 'moss';
import { withTrace, setLiveTrace, scope, type Factor, type Trace, type Value } from '../proc/trace';
import { stream } from '../proc/rng';
import { CHUNK_SIZE, WORLD_SEED, chunkSeed, generateChunk, heightAt, terrainBand } from '../core/world';
import { applyPopulation } from '../core/population';
import { catalog } from '../core/catalog';
import { SENSE_RADII } from '../core/animalBehavior';
import { HERD } from '../core/deerHerd';
import { nearbyWater } from '../audio/borealSound';
import { generateGeometry } from '../render/geometry';
import { terrainGeometry } from '../render/math';
import type { buildScene } from '../render/buildScene';
import { appearancePanel, type DirectTools } from './appearancePanel';

type View = ReturnType<typeof buildScene>;
type Target = { type: string; key: string; point: THREE.Vector3 };
type Found = NonNullable<ReturnType<View['lookup']>>;
const obs = (group: string, name: string, value: Value): Factor => ({ group, name, value, scope: '' });
const LIVE = new Set(['deer', 'hare', 'player']);
const chunkOf = (key: string, p: THREE.Vector3) => { const m = key.match(/(-?\d+):(-?\d+)(:\d+)?$/);
  return m && !key.startsWith('hare') ? [+m[1], +m[2]] : [Math.floor(p.x / CHUNK_SIZE), Math.floor(p.z / CHUNK_SIZE)]; };
const freeGeometry = (o: THREE.Object3D) => o.traverse(c => { if (c instanceof THREE.Mesh) c.geometry.dispose(); });

/** Re-run the chunk generator (+ placement layer and geometry) for one entity key, with overrides. Same code as the world. */
function regenerate(key: string, cx: number, cz: number, overrides: Record<string, Value>, withMesh: boolean) {
  const trace: Trace = { factors: [], filter: key, overrides };
  const result = withTrace(trace, () => {
    const e = applyPopulation(generateChunk(cx, cz), cx, cz).find(x => x.key === key);
    scope(key); const mesh = e && withMesh && catalog[e.kind].objectType !== 'animal' ? generateGeometry(e, 0) : undefined; scope('');
    return { e, mesh };
  });
  return { ...result, factors: trace.factors };
}

export function createInspector(view: View, canvas: HTMLCanvasElement, handles?: DirectTools['handles']) {
  const shell = document.createElement('aside'); shell.id = 'inspector'; shell.hidden = true; document.body.append(shell);
  const root = document.createElement('div'), looks = document.createElement('div'); shell.append(root, looks);
  const gizmos = new THREE.Group(); gizmos.renderOrder = 999; view.scene.add(gizmos);
  const show = { vectors: true, radii: true, herd: true, chunks: true };
  const history = new Map<string, number[]>(), reroll = stream(WORLD_SEED, 'inspector-reroll');
  let on = false, sel: Target | undefined, overrides: Record<string, Value> = {}, live: Trace | undefined;
  let preview: { object: THREE.Object3D; restore(): void } | undefined, lastFactors: Factor[] = [], fields: Record<string, number[]> = {}, tick = 0;

  function clearPreview() { if (preview) { preview.restore(); preview = undefined; } }
  /** Builds the factor list for the selection; for static things also previews what-if overrides in the world. */
  function describe(found: Found): Factor[] {
    const s = sel!, [cx, cz] = chunkOf(s.key, s.point), out: Factor[] = [];
    out.push(...withTrace({ factors: [] }, () => { chunkSeed(cx, cz); return [] as Factor[]; }) as Factor[]);
    const seedTrace: Trace = { factors: [] }; withTrace(seedTrace, () => chunkSeed(cx, cz)); out.push(...seedTrace.factors, obs('chunk', 'chunk', `${cx}, ${cz}`));
    { const q = applied(); out.push(obs('render', 'quality tier', `${q.name} (${GOVERNOR.auto ? 'Auto' : 'Manual'}${GOVERNOR.locked ? ', locked after flip-flops' : ''}) · target ${GOVERNOR.targetFps} fps · measured ${GOVERNOR.fps.toFixed(0)} fps work${GOVERNOR.gpuMs !== undefined ? ` · GPU ${GOVERNOR.gpuMs.toFixed(2)} ms` : ' · GPU timer n/a'} · ${GOVERNOR.gpu}`),
      obs('render', 'tier knobs', `res ×${q.resScale} · shadows ${q.shadows} · AO ${q.ssao} · IBL ${q.ibl} · LOD ×${q.lod} · radii ${q.near}/${q.mid} m · trees ×${q.trees} · foliage ×${q.foliage} · weather ${q.weather}²`)); }
    clearPreview();
    if (s.type === 'terrain') {
      const t: Trace = { factors: [] }; withTrace(t, () => terrainBand(heightAt(s.point.x, s.point.z)));
      out.push(...t.factors, obs('terrain', 'height', heightAt(s.point.x, s.point.z)), obs('sound', 'nearbyWater', nearbyWater(s.point.x, s.point.z)));
      const gt: Trace = { factors: [] }, col = withTrace(gt, () => column(s.point.x, s.point.z)); out.push(...gt.factors, obs('ground', 'cell', col.cell), obs('ground', 'game years elapsed', GROUND.years));
      for (const l of col.layers) out.push(obs('layers', `${(l.top * 100).toFixed(1)} cm ${l.label}`, `${(l.thickness * 100).toFixed(1)} cm · ${l.kg.toFixed(2)} kg/m² · ρ ${l.bulk} kg/m³${l.moisture !== undefined ? ` · moisture ${Math.round(l.moisture * 100)}%` : ''}${l.age ? ` · ${l.age}` : ''} — ${l.source}`));
      // Weather cell above this point (core/weather) and the persistent deltas near it (core/deltas).
      const wt: Trace = { factors: [] }, w = weatherAt(s.point.x, s.point.z), sun = solar(WEATHER.day, WEATHER.hour);
      const sb = withTrace(wt, () => surfaceBalance(c2s(col), shortwave(sun.cosZ, w.cloud), w.tC, w.rh * qsat(w.tC, 96000), 96000, Math.hypot(w.wind.x, w.wind.z), w.cloud, Math.min(1, w.soil / .75)));
      out.push(...wt.factors, obs('weather', 'date', `day ${WEATHER.day} ${WEATHER.hour.toFixed(2)} h`), obs('weather', 'sun zenith ° (NOAA)', +sun.zenith.toFixed(2)), obs('weather', 'TOA W/m² (S0 1361)', +sun.toa.toFixed(0)),
        obs('weather', 'air °C', +w.tC.toFixed(1)), obs('weather', 'RH', +w.rh.toFixed(2)), obs('weather', 'cloud fraction', +w.cloud.toFixed(2)), obs('weather', 'rain mm/h (Kessler)', +w.rainMmH.toFixed(2)),
        obs('weather', 'wind 10 m (m/s)', `${w.wind.x.toFixed(1)}, ${w.wind.y.toFixed(2)}, ${w.wind.z.toFixed(1)}`), obs('weather', 'soil bucket (Manabe)', +w.soil.toFixed(2)), obs('weather', 'snow SWE mm', +w.sweMm.toFixed(1)),
        obs('energy', 'Rn W/m²', +sb.Rn.toFixed(0)), obs('energy', 'λE Penman–Monteith', +sb.LE.toFixed(0)), obs('energy', 'H (residual)', +sb.H.toFixed(0)), obs('energy', 'G', +sb.G.toFixed(0)));
      for (const d of nearDeltas(s.point.x, s.point.z)) out.push(obs('deltas', `${d.kind} @ ${d.x.toFixed(1)}, ${d.z.toFixed(1)}`, `strength ${(d.strength * 100).toFixed(0)}% · m ${d.m.toFixed(3)} — ${DELTA_KINDS[d.kind]?.source ?? ''}`));
      fields = {}; // 24x24 noise layer previews, 40 m around the point
      for (let j = 0; j < 24; j++) for (let i = 0; i < 24; i++) {
        const g: Trace = { factors: [] }; withTrace(g, () => heightAt(s.point.x + (i - 12) * 40 / 24, s.point.z + (j - 12) * 40 / 24));
        for (const fa of g.factors) if (typeof fa.value === 'number' && !fa.name.startsWith('amp.')) (fields[fa.name] ??= [])[j * 24 + i] = fa.value;
      }
      const mesh = found.object as THREE.Mesh;
      if (Object.keys(overrides).length && mesh) {
        const old = mesh.geometry; mesh.geometry = withTrace({ factors: [], record: false, overrides }, () => terrainGeometry(cx, cz));
        preview = { object: mesh, restore: () => { mesh.geometry.dispose(); mesh.geometry = old; } };
      }
      return out;
    }
    fields = {};
    if (found.entity) {
      const r = regenerate(s.key, cx, cz, overrides, s.type === 'entity');
      const pm: Trace = { factors: [] }; withTrace(pm, () => view.massOf(s.key));
      out.push(...r.factors.filter(fa => fa.group !== 'terrain'), ...pm.factors, obs('entity', 'kind', found.entity.kind), obs('entity', 'title', catalog[found.entity.kind].title));
      const lod = found.object as THREE.LOD | undefined;
      if (lod?.isLOD) out.push(obs('render', 'lodLevel', lod.getCurrentLevel()), obs('render', 'lodLevels', lod.levels.length));
      if (r.mesh && lod && Object.keys(overrides).length) {
        r.mesh.position.copy(lod.position); if (r.e) r.mesh.position.set(r.e.x, heightAt(r.e.x, r.e.z), r.e.z);
        lod.visible = false; view.scene.add(r.mesh); const m = r.mesh;
        preview = { object: m, restore: () => { view.scene.remove(m); freeGeometry(m); lod.visible = true; } };
      } else if (r.mesh) freeGeometry(r.mesh);
    }
    return out;
  }
  /** Observed (not yet traced) live values: AnimalBrain is Claude's file, so it is read from outside. */
  function observed(found: Found): Factor[] {
    const b = found.brain, out: Factor[] = [];
    if (b) out.push(obs('brain', 'problem', b.problem), obs('brain', 'motion', b.motion), obs('brain', 'speed', b.speed), obs('brain', 'heading', b.heading),
      obs('brain', 'energy', b.energy), obs('brain', 'alarm', b.alarm), obs('brain', 'gaitPhase', b.phase), obs('brain', 'gaitSpeed', b.gaitSpeed),
      obs('senses', 'near (3 m)', b.near.length), obs('senses', 'middle (10 m)', b.middle.length), obs('senses', 'far (24 m)', b.far.length),
      obs('senses', 'target', b.target ? `${b.target.kind} ${b.target.key}` : '-'), obs('brain', 'seed', b.seed));
    if (found.audible) out.push(obs('sound', 'audible', true), obs('sound', 'voice', `${found.audible.motion}/${found.audible.problem}`));
    else if (found.brain && sel?.type === 'deer') out.push(obs('sound', 'audible', false));
    { const t: Trace = { factors: [] }; withTrace(t, () => view.massOf(sel!.key)); out.push(...t.factors); }
    if (found.hare) out.push(obs('hare', 'id', found.hare.id), obs('hare', 'rng stream', `hare-v1:${found.hare.id}`), obs('hare', 'heading', found.hare.heading));
    return out;
  }

  // ---- generic panel renderer -------------------------------------------------------------------------------
  const el = (tag: string, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
  const fmt = (v: Value) => typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(3)) : String(v);
  function spark(values: number[]) {
    const c = document.createElement('canvas'); c.width = 90; c.height = 18; const g = c.getContext('2d')!;
    const lo = Math.min(...values), hi = Math.max(...values), k = hi > lo ? 16 / (hi - lo) : 0;
    g.strokeStyle = '#e4b65b'; g.beginPath(); values.forEach((v, i) => g.lineTo(i * 90 / Math.max(1, values.length - 1), 17 - (v - lo) * k)); g.stroke(); return c;
  }
  function heatmap(values: number[]) {
    const c = document.createElement('canvas'); c.width = c.height = 24; const g = c.getContext('2d')!, img = g.createImageData(24, 24);
    const lo = Math.min(...values), hi = Math.max(...values);
    values.forEach((v, i) => { const t = hi > lo ? (v - lo) / (hi - lo) : .5; img.data.set([40 + t * 200, 70 + t * 170, 60 + t * 120, 255], i * 4); });
    g.putImageData(img, 0, 0); c.title = `${lo.toFixed(2)} .. ${hi.toFixed(2)}`; return c;
  }
  function render() {
    if (!sel) { root.replaceChildren(el('p', 'hint', 'Click anything in the world: tree, rock, prop, ground, deer, hare or yourself. I closes.')); return; }
    const head = el('header'); head.append(el('b', '', `${sel.type}  ${sel.key}`));
    const tools = el('div', 'tools');
    for (const k of Object.keys(show) as (keyof typeof show)[]) {
      const l = el('label', '', k), c = document.createElement('input'); c.type = 'checkbox'; c.checked = show[k]; c.onchange = () => { show[k] = c.checked; }; l.prepend(c); tools.append(l);
    }
    const rr = el('button', '', 'Reroll seed'); rr.onclick = () => { overrides.seed = Math.floor(reroll() * 0xffffffff); refresh(); };
    const rs = el('button', '', 'Reset'); rs.onclick = () => { overrides = {}; if (live) live.overrides = overrides; refresh(); };
    tools.append(rr, rs); head.append(tools);
    const body = el('div', 'groups'), seen = new Set<string>(), groups = new Map<string, HTMLElement>();
    for (const fa of lastFactors) {
      const id = `${fa.group}.${fa.name}`; if (seen.has(id)) continue; seen.add(id);
      let g = groups.get(fa.group); if (!g) { g = el('section'); g.append(el('h4', '', fa.group)); groups.set(fa.group, g); body.append(g); }
      const row = el('div', 'row' + (fa.name in overrides ? ' changed' : '')); row.append(el('span', 'name', fa.name));
      if (fa.table) { // weighted pick: one bar per option, the roll as a marker, the chosen option highlighted
        const bars = el('div', 'weights'); let lo = 0;
        for (const [label, upTo] of fa.table) { const b = el('i', label === fa.value ? 'on' : '', label); b.style.flex = String(upTo - lo); b.title = `${label}: ${((upTo - lo) * 100).toFixed(1)}%`; lo = upTo; bars.append(b); }
        const mark = el('u'); mark.style.left = `${(fa.roll ?? 0) * 100}%`; mark.title = `roll ${fa.roll?.toFixed(4)}`; bars.append(mark);
        const sel2 = document.createElement('select'); for (const [label] of fa.table) sel2.add(new Option(label, label, false, label === fa.value));
        sel2.onchange = () => { overrides[fa.name] = sel2.value; refresh(); }; row.append(bars, sel2);
      } else if (typeof fa.value === 'number' && fa.scope !== '' || (typeof fa.value === 'number' && (sel.type === 'terrain' || fa.group === 'chunk'))) {
        const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.value = fmt(fa.value);
        input.onchange = () => { overrides[fa.name] = Number(input.value); refresh(); }; row.append(input);
      } else row.append(el('span', 'val', fmt(fa.value)));
      const h = history.get(id); if (h && h.length > 2) row.append(spark(h));
      if (fields[fa.name]) row.append(heatmap(fields[fa.name]));
      g.append(row);
    }
    root.replaceChildren(head, body, el('p', 'hint', LIVE.has(sel.type) ? 'Live values; edits apply to this animal only until Reset. Brain internals are observed from outside (no trace hooks in AnimalBrain yet).' : 'Edit a value or reroll: the generator re-runs with your change as a preview. Reset restores it.'));
  }
  function refresh() {
    if (!sel) { render(); return; }
    const found = view.lookup(sel.key); if (!found) { select(undefined); return; }
    if (live) { live.overrides = overrides; lastFactors = [...live.factors, ...observed(found)]; live.factors.length = 0; }
    else lastFactors = describe(found);
    for (const fa of lastFactors) if (typeof fa.value === 'number' && LIVE.has(sel.type)) { const id = `${fa.group}.${fa.name}`, h = history.get(id) ?? []; h.push(fa.value); if (h.length > 120) h.shift(); history.set(id, h); }
    render();
  }
  function select(t?: Target) {
    clearPreview(); sel = t; overrides = {}; history.clear(); fields = {}; looks.replaceChildren();
    if (t && (t.type === 'deer' || t.type === 'player')) { // appearance editor: same what-if idea, persistent + logged
      let all = false;
      const key = () => t.type === 'player' ? view.playerLookKey : all ? 'species:deer' : t.key;
      const allBox = () => { const l = document.createElement('label'), c = document.createElement('input'); c.type = 'checkbox'; c.checked = all;
        c.onchange = () => { all = c.checked; looks.replaceChildren(panel()); }; l.append(c, ' apply to all deer'); return l; };
      const panel = appearancePanel(key, (k, g) => view.setAppearance(k, g), t.type === 'deer' ? allBox : undefined, handles && { root: () => view.lookup(t.key)?.object, handles });
      const open = document.createElement('button'); open.textContent = 'Edit appearance'; open.onclick = () => looks.replaceChildren(panel()); looks.append(open);
    }
    live = t && LIVE.has(t.type) ? { factors: [], filter: t.key, overrides } : undefined; setLiveTrace(on ? live : undefined);
    refresh();
  }

  // ---- in-world gizmos ------------------------------------------------------------------------------------
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffd36b, depthTest: false, transparent: true });
  const ring = (r: number, color: number) => { const pts = Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.sin(i / 48 * Math.PI * 2) * r, .15, Math.cos(i / 48 * Math.PI * 2) * r));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: .8 })); };
  const arrow = (heading: number, len: number, color: number) => new THREE.ArrowHelper(new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading)), new THREE.Vector3(0, .6, 0), Math.max(.2, len), color);
  function drawGizmos() {
    gizmos.children.forEach(c => c.traverse(o => { if (o instanceof THREE.Line || o instanceof THREE.Mesh) o.geometry.dispose(); })); gizmos.clear();
    if (!sel) return; const found = view.lookup(sel.key); if (!found?.object) return;
    const at = new THREE.Vector3(); found.object.getWorldPosition(at);
    const value = (n: string) => lastFactors.find(f => f.name === n)?.value;
    const local = new THREE.Group(); local.position.copy(at); gizmos.add(local);
    if (show.chunks) {
      const [cx, cz] = chunkOf(sel.key, sel.type === 'terrain' || sel.type === 'entity' ? sel.point : at), y = heightAt((cx + .5) * CHUNK_SIZE, (cz + .5) * CHUNK_SIZE);
      const box = new THREE.Box3(new THREE.Vector3(cx * CHUNK_SIZE, y - 6, cz * CHUNK_SIZE), new THREE.Vector3((cx + 1) * CHUNK_SIZE, y + 10, (cz + 1) * CHUNK_SIZE));
      gizmos.add(new THREE.Box3Helper(box, 0x9fe0ff));
    }
    if (!sel.type.match(/terrain/) && sel.type !== 'player') gizmos.add(new THREE.BoxHelper(found.object, 0xffffff));
    const b = found.brain, h = found.hare;
    if (show.vectors && b) local.add(arrow(b.heading, b.speed, 0xff6b4a));
    if (show.vectors && h) local.add(arrow(h.heading, Number(value('speed') ?? 0), 0xff6b4a));
    if (show.vectors && typeof value('toCentre') === 'number') local.add(arrow(value('toCentre') as number, 2, 0x6bff9a));
    if (show.radii && b) SENSE_RADII.forEach((r, i) => local.add(ring(r, [0xff8080, 0xffd080, 0x80c0ff][i])));
    if (show.radii && h) for (const [n, c] of [['noticeAt', 0xffd080], ['boltAt', 0xff8080]] as const) { const r = value(n); if (typeof r === 'number') local.add(ring(r, c)); }
    if (show.herd && sel.type === 'deer') {
      if (show.radii) local.add(ring(HERD.radius, 0x6bff9a));
      const pts: THREE.Vector3[] = [];
      for (const a of view.audibleAnimals()) if (a.key !== sel.key && Math.hypot(a.x - at.x, a.z - at.z) < HERD.radius) pts.push(at.clone().setY(at.y + 1.5), new THREE.Vector3(a.x, heightAt(a.x, a.z) + 1.5, a.z));
      if (pts.length) gizmos.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    gizmos.traverse(o => { o.renderOrder = 999; });
  }

  // ---- picking ----------------------------------------------------------------------------------------------
  let down: { x: number; y: number } | undefined;
  canvas.addEventListener('pointerdown', e => { if (on) down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!on || !down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; down = undefined;
    const r = canvas.getBoundingClientRect(), hit = view.pick((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    select(hit);
  });

  return {
    get active() { return on; },
    toggle(force = !on) {
      on = force; shell.hidden = !on; document.body.classList.toggle('inspecting', on);
      if (!on) { clearPreview(); setLiveTrace(undefined); gizmos.clear(); sel = undefined; } else select(sel);
    },
    /** Once per frame after drawing: live values at ~6 Hz, gizmos every frame. */
    update() { if (!on) return; if (sel && LIVE.has(sel.type) && ++tick % 10 === 0) refresh(); drawGizmos(); },
  };
}
