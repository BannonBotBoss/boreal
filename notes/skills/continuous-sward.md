# Skill: keep the far ground on the near ground

Use when the glide or the landed view shows a grass shelf floating over the prairie, or a white gap at the chunk edge.

## Search before writing

1. The far ground is the horizon skirt (`src/world/globe/horizonSkirt.ts`, drawn by `src/render/horizonMesh.ts`).
2. `gameY` passed to `skirtOrigin` is `heightAt(0, 0)`, the ground. On a lake that is the bed.
3. `shownAsl` lifts a lake to its surface. Using that as the datum shifts every land vertex down by the same gap, and the skirt no longer meets the chunks.

## Steps

1. At home the origin datum is `s.h`, the bed, the same surface as `heightAt`. A remote landing keeps `shownAsl`, because its `heightAt` is already the water surface the skirt should meet. Lake vertices still use `shownAsl`, so the water stays on the water plane.
2. Do not paint the near skirt with a coarse crown repeat or a green gain. Those turn large triangles into a striped shelf. A clump-scale grain (`vnoiseU`) is the sward. Crowns start far enough out that a tree reads as a tree.

## Checks

- `tests/horizon-skirt.test.ts`: with staged terrain on, the skirt at (30, 0) matches `heightAt` within 0.25 m, and a dry local height of 4 m is unchanged.
- A ground frame at the home mark: the dark ground runs out to the lake with no white crack and no floating checker.

## Mistakes to avoid

- Do not sample `heightAt` out to the horizon. The staged grid repeats. Only the datum has to match; the far rings stay the planet sample.
- Do not multiply the finished skirt colour by a large gain. Coarse triangles become neon facets.
