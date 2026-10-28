/**
 * One loader for stored animal models (Matthew, 2026-10-28, issue #156).
 * The manifest is keyed by the common names in src/core/species.ts.
 * A missing file leaves that species on the procedural body.
 * The proof model is the Meshy wolf: head along −X, not to scale.
 * GLTFLoader ships with three 0.180. No new package.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BIRD_GROUPS, MAMMALS } from '../core/species';

export const MODEL_MANIFEST_URL = '/models/animals/manifest.json';

export interface ModelEntry { full?: string; low?: string }

/** Mammals: shoulder height. Birds: the row's bill-to-tail length, the one size that row stores. */
export function bodyMetres(name: string): number | null {
  const mammal = MAMMALS.find(row => row[0] === name);
  if (mammal) return mammal[2];
  const bird = BIRD_GROUPS.find(row => row[0] === name);
  return bird ? bird[3] : null;
}

/**
 * Share of the file's vertical extent that is the shoulder, on the attached
 * wolf side view (ears above the withers). [game calibration]
 */
export const WITHERS_SHARE = 0.62;

/** Feet on y = 0, head (−X in the file) toward game forward (−Z), height matched to the species row. */
export function fitAnimalModel(root: THREE.Object3D, shoulderM: number) {
  root.rotation.set(0, -Math.PI / 2, 0);
  root.scale.set(1, 1, 1);
  root.position.set(0, 0, 0);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const height = Math.max(1e-4, box.max.y - box.min.y);
  root.scale.setScalar(shoulderM / (height * WITHERS_SHARE));
  root.updateMatrixWorld(true);
  const fitted = new THREE.Box3().setFromObject(root);
  root.position.y -= fitted.min.y;
  root.updateMatrixWorld(true);
  return root;
}

export interface LoadedAnimal {
  full: THREE.Object3D | null;
  low: THREE.Object3D | null;
  shoulderM: number;
  fullTris: number;
  lowTris: number;
}

const cache = new Map<string, LoadedAnimal>();
let pending: Promise<Map<string, LoadedAnimal>> | null = null;

function triangles(root: THREE.Object3D) {
  let n = 0;
  root.traverse(obj => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry;
    n += geo.index ? geo.index.count / 3 : (geo.getAttribute('position')?.count ?? 0) / 3;
  });
  return n;
}

export function animalModel(name: string) { return cache.get(name) ?? null; }
export function animalModelsReady() { return cache; }

export function loadAnimalModels(url = MODEL_MANIFEST_URL) {
  if (pending) return pending;
  const loader = new GLTFLoader();
  pending = (async () => {
    let manifest: Record<string, ModelEntry> = {};
    try {
      const res = await fetch(url);
      if (res.ok) manifest = await res.json() as Record<string, ModelEntry>;
    } catch { /* no manifest: every species stays procedural */ }
    await Promise.all(Object.entries(manifest).map(async ([name, entry]) => {
      const shoulderM = bodyMetres(name);
      if (!shoulderM) return;
      const load = async (file?: string) => {
        if (!file) return null;
        try {
          const gltf = await loader.loadAsync(file.startsWith('/') ? file : `/models/animals/${file}`);
          return fitAnimalModel(gltf.scene, shoulderM);
        } catch { return null; }
      };
      const full = await load(entry.full);
      const low = await load(entry.low);
      cache.set(name, { full, low, shoulderM, fullTris: full ? triangles(full) : 0, lowTris: low ? triangles(low) : 0 });
    }));
    return cache;
  })();
  return pending;
}

export function resetAnimalModels() { cache.clear(); pending = null; }
