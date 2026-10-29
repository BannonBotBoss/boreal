/**
 * Impostors baked from the CC0 Kenney trees in public/models/trees.
 * One card per model (albedo and view-space normals). The cover instances
 * those cards. The source meshes are a few hundred triangles; drawing one
 * per tree out to the horizon would blow the budget.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const CC0_TREES = [
  { url: '/models/trees/pine-a.glb', broadleaf: false },
  { url: '/models/trees/pine-b.glb', broadleaf: false },
  { url: '/models/trees/pine-c.glb', broadleaf: false },
  { url: '/models/trees/oak.glb', broadleaf: true },
  { url: '/models/trees/broadleaf.glb', broadleaf: true },
] as const;

export const TREE_CARD = { w: 128, h: 192 };

const LEAF = new THREE.Color(0.18, 0.42, 0.14);
const BARK = new THREE.Color(0.32, 0.18, 0.09);

function recolour(root: THREE.Object3D) {
  root.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      const mat = m as THREE.MeshStandardMaterial;
      if (!mat.isMeshStandardMaterial) continue;
      const leaf = /leaf|foliage/i.test(mat.name);
      mat.color.copy(leaf ? LEAF : BARK);
      mat.metalness = 0;
      mat.roughness = leaf ? 0.75 : 0.9;
      mat.side = THREE.DoubleSide;
    }
  });
}

function frame(root: THREE.Object3D, cam: THREE.PerspectiveCamera) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.sub(center);
  root.position.y += size.y * 0.5;
  const dist = Math.max(size.x, size.y) * 1.35;
  cam.position.set(dist * 0.35, size.y * 0.42, dist);
  cam.lookAt(0, size.y * 0.38, 0);
  cam.updateProjectionMatrix();
}

/**
 * Render every model into one atlas. Returns null when there is no loader
 * (tests, no document). The caller keeps the procedural cards until this lands.
 */
export async function bakeTreeAtlas(renderer: THREE.WebGLRenderer): Promise<{ albedo: THREE.DataTexture; normal: THREE.DataTexture; cols: number } | null> {
  if (typeof document === 'undefined') return null;
  const loader = new GLTFLoader();
  const { w, h } = TREE_CARD;
  const cols = CC0_TREES.length;
  const albedoPx = new Uint8Array(w * cols * h * 4);
  const normalPx = new Uint8Array(w * cols * h * 4);
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: true });
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, w / h, 0.05, 40);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.4);
  sun.position.set(-2.5, 3.2, 2.2);
  scene.add(sun, new THREE.HemisphereLight(0xc5d4ee, 0x3d4a32, 0.9));
  const prev = {
    target: renderer.getRenderTarget(),
    tone: renderer.toneMapping,
    clear: renderer.getClearColor(new THREE.Color()),
    alpha: renderer.getClearAlpha(),
  };
  const buf = new Uint8Array(w * h * 4);
  const copy = (dst: Uint8Array, col: number) => {
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf);
    for (let y = 0; y < h; y++) {
      const src = y * w * 4;
      const row = (y * cols * w + col * w) * 4;
      dst.set(buf.subarray(src, src + w * 4), row);
    }
  };
  try {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    for (let i = 0; i < cols; i++) {
      const gltf = await loader.loadAsync(CC0_TREES[i].url);
      const root = gltf.scene;
      recolour(root);
      frame(root, cam);
      scene.add(root);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      copy(albedoPx, i);
      const saved: THREE.Material[] = [];
      root.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        saved.push(mesh.material as THREE.Material);
        mesh.material = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
      });
      renderer.clear();
      renderer.render(scene, cam);
      copy(normalPx, i);
      let k = 0;
      root.traverse(o => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        (mesh.material as THREE.Material).dispose();
        mesh.material = saved[k++];
      });
      scene.remove(root);
    }
  } catch {
    rt.dispose();
    renderer.setRenderTarget(prev.target);
    renderer.toneMapping = prev.tone;
    renderer.setClearColor(prev.clear, prev.alpha);
    return null;
  }
  rt.dispose();
  renderer.setRenderTarget(prev.target);
  renderer.toneMapping = prev.tone;
  renderer.setClearColor(prev.clear, prev.alpha);
  const albedo = new THREE.DataTexture(albedoPx, w * cols, h);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.magFilter = THREE.LinearFilter;
  albedo.minFilter = THREE.LinearMipmapLinearFilter;
  albedo.generateMipmaps = true;
  albedo.needsUpdate = true;
  const normal = new THREE.DataTexture(normalPx, w * cols, h);
  normal.colorSpace = THREE.NoColorSpace;
  normal.magFilter = THREE.LinearFilter;
  normal.minFilter = THREE.LinearFilter;
  normal.needsUpdate = true;
  return { albedo, normal, cols };
}
