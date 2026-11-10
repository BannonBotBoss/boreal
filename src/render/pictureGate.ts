/**
 * Installs the cover sample as the home tree gate. The chunk-digest test never loads this
 * module, so its generator stays at a full stand. The game loads it with the scene.
 */
import { setPictureFit } from '../core/world';
import { coverSampleAt } from '../world/globe/coverSample';

export function installPictureGate() {
  setPictureFit((x, z) => {
    const s = coverSampleAt(x, z);
    return { share: s.treeShare, scaleMul: s.scaleMul };
  });
}
