/**
 * One loader for stored animal models (Matthew, 2026-10-28, issues #156, #160, #162).
 * The manifest is keyed by the common names in src/core/species.ts. A name that is not
 * a row uses `as` for the row that owns its size (grizzly → black bear, eagle → the
 * raptor group, raven → the corvid group). A missing file leaves that species on the
 * procedural body. Files are meshopt-compressed; the loader enables the three.js decoder.
 * Only species asked for (the ones nearby) are fetched.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { BIRD_GROUPS, MAMMALS } from '../core/species';
import { createSkinTemplate, type SkinTemplate } from './meshySkin';

export const MODEL_MANIFEST_URL = '/models/animals/manifest.json';

export interface ModelEntry { full?: string; low?: string; /** Species or bird-group row that owns the size. */ as?: string }

/** Mammals: shoulder height. Birds: the row's bill-to-tail length, the one size that row stores. */
export function bodyMetres(name: string): number | null {
  const mammal = MAMMALS.find(row => row[0] === name);
  if (mammal) return mammal[2];
  const bird = BIRD_GROUPS.find(row => row[0] === name);
  return bird ? bird[3] : null;
}

export type FitMode = 'shoulder' | 'length';

export function fitModeFor(name: string): FitMode {
  return BIRD_GROUPS.some(row => row[0] === name) ? 'length' : 'shoulder';
}

/**
 * Share of the file's vertical extent that is the shoulder, on the wolf side view
 * (ears above the withers). [game calibration]
 */
export const WITHERS_SHARE = 0.62;

/**
 * Feet on y = 0, body centred on x and z, head (−X in the file) toward game forward (−Z).
 * Mammals match shoulder height. Birds match bill-to-tail length along Z.
 */
export function fitAnimalModel(root: THREE.Object3D, sizeM: number, mode: FitMode = 'shoulder') {
  root.rotation.set(0, -Math.PI / 2, 0);
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const span = mode === 'shoulder'
    ? Math.max(1e-4, box.max.y - box.min.y) * WITHERS_SHARE
    : Math.max(1e-4, box.max.z - box.min.z);
  root.scale.setScalar(sizeM / span);
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.y -= fitted.min.y;
  root.position.x -= (fitted.min.x + fitted.max.x) / 2;
  root.position.z -= (fitted.min.z + fitted.max.z) / 2;
  root.updateMatrixWorld(true);
  return root;
}

export interface LoadedAnimal {
  skin: SkinTemplate | null;
  shoulderM: number;
  fullTris: number;
  /** Mid tier is one shared camera-facing quad, not a second mesh. */
  lowTris: number;
}

const cache = new Map<string, LoadedAnimal>();
const pending = new Map<string, Promise<void>>();
let manifest: Record<string, ModelEntry> | null = null;
let manifestPromise: Promise<Record<string, ModelEntry>> | null = null;

export function animalModel(name: string) { return cache.get(name) ?? null; }
export function animalModelsReady() { return cache; }

/** Manifest rows a picture should fetch for these species names. Alias targets count too. */
export function entriesFor(table: Record<string, ModelEntry>, names: readonly string[]) {
  const want = new Set(names);
  const out: [string, ModelEntry][] = [];
  for (const [name, entry] of Object.entries(table)) {
    if (!entry || typeof entry.full !== 'string') continue;
    if (want.has(name) || (entry.as && want.has(entry.as))) out.push([name, entry]);
  }
  return out;
}

function loader() {
  const gltfLoader = new GLTFLoader();
  gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  return gltfLoader;
}

async function readManifest(url: string) {
  if (manifest) return manifest;
  if (!manifestPromise) {
    manifestPromise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return {};
        return await res.json() as Record<string, ModelEntry>;
      } catch {
        return {};
      }
    })();
  }
  manifest = await manifestPromise;
  return manifest;
}

function remember(name: string, entry: ModelEntry, loaded: LoadedAnimal) {
  cache.set(name, loaded);
  if (entry.as && !cache.has(entry.as)) cache.set(entry.as, loaded);
}

/** Parse one GLB the manifest names. Used by the browser fetch and by tests. */
export async function loadAnimalBuffer(buffer: ArrayBuffer, name: string, entry: ModelEntry = {}): Promise<LoadedAnimal | null> {
  const plan = entry.as ?? name;
  const shoulderM = bodyMetres(plan);
  if (!shoulderM) return null;
  await MeshoptDecoder.ready;
  const gltf = await loader().parseAsync(buffer, '');
  fitAnimalModel(gltf.scene, shoulderM, fitModeFor(plan));
  const skin = createSkinTemplate(gltf.scene, plan);
  const loaded: LoadedAnimal = { skin, shoulderM, fullTris: skin?.tris ?? 0, lowTris: skin ? 2 : 0 };
  remember(name, entry, loaded);
  return loaded;
}

async function loadNamed(name: string, entry: ModelEntry) {
  if (cache.has(name) || !entry.full) return;
  const file = entry.full.startsWith('/') ? entry.full : `/models/animals/${entry.full}`;
  try {
    const res = await fetch(file);
    if (!res.ok) return;
    await loadAnimalBuffer(await res.arrayBuffer(), name, entry);
  } catch { /* this species stays procedural */ }
}

/** Fetch just these species. Safe to call every frame: a species already loaded or in flight is skipped. */
export function ensureAnimalModels(names: readonly string[], url = MODEL_MANIFEST_URL) {
  void (async () => {
    const table = await readManifest(url);
    for (const [name, entry] of entriesFor(table, names)) {
      if (cache.has(name) || pending.has(name)) continue;
      const job = loadNamed(name, entry).finally(() => pending.delete(name));
      pending.set(name, job);
    }
  })();
}

/** Test hook and the first frame: read the manifest, do not fetch every species. */
export function loadAnimalModels(url = MODEL_MANIFEST_URL) {
  return readManifest(url);
}

export function resetAnimalModels() {
  cache.clear();
  pending.clear();
  manifest = null;
  manifestPromise = null;
}
