/**
 * Target glow (Grok Bot, T-0035): a soft warm outline that traces the silhouette of the current interaction target.
 * Adopted: three r180 OutlinePass (examples/jsm/postprocessing, MIT): selection mask -> edge detect -> two-level separable
 * blur -> additive overlay. Not part of render/post's composer (bypassed in normal play; OutlinePass's depth prepass would
 * also redraw the whole world). It gets its own one-object scene holding a PROXY of the target, and its overlay is blended
 * straight onto the canvas after the frame is drawn (readBuffer = null), so the cost is one small mesh plus a few
 * half/quarter-resolution full-screen passes, and nothing at all while there is no target.
 *  - batched statics (plants, forage bushes, logs, rocks: one BatchedMesh per chunk, render/batch): generateGeometry(entity, 0),
 *    the exact geometry the batch flattens, placed at the entity;
 *  - live objects (deer rigs, person / pushed-rock LODs): meshes sharing the source geometry that copy its matrixWorld each frame.
 * The glow is drawn through occluders (grass, trunks), which keeps a low herb readable in the field layer.
 */
import * as THREE from 'three';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

/** Look (tuned on omen screenshots, 2026-10-22): a thin warm edge plus a wider soft glow, no pulse. */
export const TARGET_GLOW = { color: 0xffd89a, edgeStrength: 1.8, edgeGlow: 1.0, edgeThickness: 1.6 };

type Follow = { proxy: THREE.Mesh; source: THREE.Object3D };

/** Mirrors every visible mesh under `source` into `into`: shared geometry, own matrixWorld copied each frame. */
export function mirrorMeshes(source: THREE.Object3D, into: THREE.Object3D, material: THREE.Material): Follow[] {
  const out: Follow[] = [];
  source.updateMatrixWorld(true);
  source.traverseVisible(o => {
    const m = o as THREE.Mesh; if (!m.isMesh || (m as unknown as THREE.BatchedMesh).isBatchedMesh || (m as THREE.InstancedMesh).isInstancedMesh) return;
    const p = new THREE.Mesh(m.geometry, material); p.matrixAutoUpdate = false; p.matrixWorld.copy(m.matrixWorld); p.frustumCulled = false;
    into.add(p); out.push({ proxy: p, source: m });
  });
  return out;
}

export function createTargetGlow(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
  const scene = new THREE.Scene(), holder = new THREE.Group(); holder.matrixAutoUpdate = false; scene.add(holder);
  const material = new THREE.MeshBasicMaterial({ colorWrite: false }); // only the pass's override materials ever draw it
  let pass: OutlinePass | undefined, key: string | undefined, follow: Follow[] = [], owned: THREE.Object3D | undefined;
  const size = new THREE.Vector2(); let lastW = 0, lastH = 0;
  function clear() {
    holder.clear(); follow = [];
    if (owned) { owned.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); }); owned = undefined; }
    key = undefined;
  }
  return {
    /** Select the target: `live` = an object already in the world that moves (followed per frame); `make` = builds a static
     *  proxy once (owned and disposed here). Same key = nothing rebuilt. undefined = no glow. */
    set(nextKey: string | undefined, live?: THREE.Object3D, make?: () => THREE.Object3D) {
      if (nextKey === key && (follow.length || owned)) return;
      clear(); if (nextKey === undefined) return;
      if (live) follow = mirrorMeshes(live, holder, material);
      else if (make) { owned = make(); holder.add(owned); owned.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = material; m.frustumCulled = false; } }); owned.updateMatrixWorld(true); }
      key = nextKey;
    },
    get key() { return key; },
    /** After the frame is on the canvas: blend the glow over it. */
    render() {
      if (!key || (!follow.length && !owned)) return;
      for (const f of follow) f.proxy.matrixWorld.copy(f.source.matrixWorld);
      renderer.getDrawingBufferSize(size);
      if (!pass) {
        pass = new OutlinePass(size.clone(), scene, camera, [holder]);
        pass.visibleEdgeColor.set(TARGET_GLOW.color); pass.hiddenEdgeColor.set(TARGET_GLOW.color);
        pass.edgeStrength = TARGET_GLOW.edgeStrength; pass.edgeGlow = TARGET_GLOW.edgeGlow; pass.edgeThickness = TARGET_GLOW.edgeThickness; pass.pulsePeriod = 0;
      }
      if (size.x !== lastW || size.y !== lastH) pass.setSize(lastW = size.x, lastH = size.y);
      const target = renderer.getRenderTarget();
      pass.render(renderer, null as unknown as THREE.WebGLRenderTarget, null as unknown as THREE.WebGLRenderTarget, 0, false); // readBuffer null = the canvas
      renderer.setRenderTarget(target);
    },
    dispose() { clear(); pass?.dispose(); pass = undefined; },
  };
}