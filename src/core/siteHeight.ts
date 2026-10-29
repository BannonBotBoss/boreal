/**
 * Off-home ground height. The forest calls this from heightAt. Nothing is
 * registered at home, so the Kenora stage grid is unchanged. The globe landing
 * registers a reader that samples the planet function already used by the tiles.
 */
let reader: ((x: number, z: number) => number | null) | null = null;

export function setRemoteHeight(fn: typeof reader) { reader = fn; }
export function remoteGameHeight(x: number, z: number): number | null {
  return reader ? reader(x, z) : null;
}
