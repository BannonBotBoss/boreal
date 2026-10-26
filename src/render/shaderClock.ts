import { worldSec } from '../core/worldClock';
/** Shader phase (wind, water). It is the world clock; there is no second accumulator. */
export const shaderClock = {
  get time() { return worldSec(); },
  set time(_t: number) { /* a snapshot may still assign the old sample; the live phase stays the clock */ },
};
