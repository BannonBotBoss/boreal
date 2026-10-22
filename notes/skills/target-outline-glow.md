# Skill: target-outline-glow

Highlight one object with a soft glow that traces its silhouette, cheaply, in a scene where most objects are batched.

## Steps
1. Reuse three's `OutlinePass` (examples/jsm/postprocessing). Do NOT add it to the main composer if that composer is
   bypassed in normal play, and never give it the world scene: its first step re-renders `renderScene` with a depth material.
2. Give it a private one-object scene holding a PROXY of the target (render/targetGlow.ts):
   - batched / instanced statics: rebuild the object's own LOD-0 geometry (`generateGeometry(entity, 0)`), placed at the entity;
   - live objects (rigs, LODs): meshes sharing the source geometry, `matrixAutoUpdate = false`, matrixWorld copied each frame.
3. After the frame is on the canvas, call `pass.render(renderer, null, null, 0, false)`: readBuffer null = the overlay is
   blended additively onto the canvas. Track the drawing-buffer size yourself (`setSize` does not update `pass.resolution`).
4. Put the look (colour, edgeStrength, edgeGlow, edgeThickness) in src/config/systemProperties.ts (`targetGlow`).

## Checks that proved it
- Headless shot of the target (tools/outline-shot.mjs, `?nomenu&at=x,z,yaw`; tools/find-targets.ts lists herb/deer/person
  positions with stages on): the glow follows leaves and flower stalks, not a ring.
- A/B frame time with `?glow=0` at the same spot (same server, back to back).

## Mistakes to avoid
- A second Vite on a worktree whose node_modules is a junction shares `node_modules/.vite` with the main server; give it its
  own `cacheDir` (`--config` with cacheDir) or it re-optimizes the shared deps.
- The wolf body hides a target straight ahead of a chase camera: stand the player offset to one side for shots.
- Run shots on the box or headless with `--window-position=-32000,-32000`; close every browser you start.