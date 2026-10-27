/**
 * Far layer of the in-page transition (Grok Bot): the globe renders into this target (its own MSAA colour + depth, with
 * per-material log depth, logDepth.ts) and the game scene shows it as `scene.background`. The game pass then has its own,
 * cleared depth buffer, so the two depth conventions never meet: game objects are always nearer than the globe tiles
 * beyond the loaded patch. Linear colour: three tone-maps a linear background in the game's final pass (ACES, like the
 * standalone globe), so the globe is tone-mapped exactly once.
 */
import * as THREE from 'three';
export interface FarLayerOptions { scale?: number; samples?: number }
/** Defaults from the step-0 budget (2026-10-18): half resolution, 2x MSAA = 32 B per far-layer pixel, ~26 MB at 2400x1350
 *  (full resolution with 4x MSAA measured 82 MB at 1600x900, ~180 MB at 1.5 DPR: over the shared-mode budget). */
export function createFarLayer({ scale = .5, samples = 2 }: FarLayerOptions = {}) {
  let res = scale;
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace; target.texture.generateMipmaps = false;
  target.depthTexture = new THREE.DepthTexture(1, 1); // resolved globe depth (log): the game patch tests against it (render/fade occlusion)
  return {
    target, texture: target.texture, get scale() { return res; },
    /** 1 while the far layer is the whole frame (above the patch). The budget default stays a half. */
    setScale(next: number) { res = next; },
    /** Follow the drawing buffer (call before rendering); `scale` < 1 renders the far layer at reduced resolution. */
    resize(w: number, h: number) { const W = Math.max(1, Math.round(w * res)), H = Math.max(1, Math.round(h * res)); if (target.width !== W || target.height !== H) target.setSize(W, H); },
    /** GPU bytes: half-float RGBA resolve texture + (with MSAA) multisampled colour and 32-bit depth per sample. */
    bytes() { const px = target.width * target.height, s = Math.max(1, samples); return px * 8 + px * 4 + (samples > 1 ? px * s * (8 + 4) : 0); }, // + the resolved depth texture
    dispose() { target.dispose(); },
  };
}
