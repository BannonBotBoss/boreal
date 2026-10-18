/**
 * Far layer of the in-page transition (Grok Bot): the globe renders into this target (its own MSAA colour + depth, with
 * per-material log depth, logDepth.ts) and the game scene shows it as `scene.background`. The game pass then has its own,
 * cleared depth buffer, so the two depth conventions never meet: game objects are always nearer than the globe tiles
 * beyond the loaded patch. Linear colour: three tone-maps a linear background in the game's final pass (ACES, like the
 * standalone globe), so the globe is tone-mapped exactly once.
 */
import * as THREE from 'three';
export interface FarLayerOptions { scale?: number; samples?: number }
export function createFarLayer({ scale = 1, samples = 4 }: FarLayerOptions = {}) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples, depthBuffer: true, stencilBuffer: false });
  target.texture.colorSpace = THREE.LinearSRGBColorSpace; target.texture.generateMipmaps = false;
  return {
    target, texture: target.texture, scale,
    /** Follow the drawing buffer (call before rendering); `scale` < 1 renders the far layer at reduced resolution. */
    resize(w: number, h: number) { const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale)); if (target.width !== W || target.height !== H) target.setSize(W, H); },
    /** GPU bytes: half-float RGBA resolve texture + (with MSAA) multisampled colour and 32-bit depth per sample. */
    bytes() { const px = target.width * target.height, s = Math.max(1, samples); return px * 8 + (samples > 1 ? px * s * (8 + 4) : px * 4); },
    dispose() { target.dispose(); },
  };
}
