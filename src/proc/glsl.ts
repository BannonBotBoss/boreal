/** Shared GLSL snippets (Grok Bot): the ONE shader hash; every shader that needs noise builds on it. */
export const GLSL_HASH = 'float hash2s(vec2 p, float s) { return fract(sin(dot(p, vec2(127.1, 311.7)) + s) * 43758.5453); }';
