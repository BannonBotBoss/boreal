/**
 * Per-material logarithmic depth for the globe (Grok Bot). three's `logarithmicDepthBuffer` (and r180's
 * `reversedDepthBuffer`) are RENDERER-wide flags: turning either on for the shared renderer would recompile every game
 * program and change the depth the game's SUNFX / GTAO passes read. So the globe materials switch three's own log-depth
 * chunks on themselves (`USE_LOGARITHMIC_DEPTH_BUFFER`) and feed the constant from one shared uniform, set from the globe
 * camera's far plane before each globe render. Works the same on a renderer with or without the flag.
 */
/** three's constant (WebGLRenderer: logDepthBufFC = 2 / log2(far + 1)). */
export const logDepthFC = (far: number) => 2 / (Math.log(far + 1) / Math.LN2);
export const LOG_DEPTH = { uniform: { value: logDepthFC(1e9) } };
export function setLogDepthFar(far: number) { LOG_DEPTH.uniform.value = logDepthFC(far); }
/** Prepended to both stages; `logDepthBufFC` (the name in three's chunks) is mapped onto our own uniform, which three
 *  never sets, so a renderer flag cannot fight over it. */
export const LOG_DEPTH_PREFIX = '#ifndef USE_LOGARITHMIC_DEPTH_BUFFER\n#define USE_LOGARITHMIC_DEPTH_BUFFER\n#endif\n#define logDepthBufFC uGlobeLogDepthFC\n';
export function withLogDepth(sh: { vertexShader: string; fragmentShader: string; uniforms: Record<string, unknown> }) {
  if (!sh.vertexShader.startsWith(LOG_DEPTH_PREFIX)) sh.vertexShader = LOG_DEPTH_PREFIX + sh.vertexShader;
  if (!sh.fragmentShader.startsWith(LOG_DEPTH_PREFIX)) sh.fragmentShader = LOG_DEPTH_PREFIX + sh.fragmentShader;
  sh.uniforms.uGlobeLogDepthFC = LOG_DEPTH.uniform;
}
