# Skill: do not splice a shadow assignment in front of a uniform

Use when a MeshStandardMaterial logs that `shadow` is undeclared, or when a soft-shadow helper is patched into three's shadow chunk.

## What broke

`src/render/photoreal.ts` used to replace the first `#if defined( SHADOWMAP_TYPE_PCF )` in `ShaderChunk.shadowmap_pars_fragment` with an assignment `shadow = pcssShadow(...)`. In three 0.185 that first test is the sampler uniform (`sampler2DShadow directionalShadowMap`), above `float shadow = 1.0` inside `getShadow`. High and Ultra set the `PCSS` define, so those programs compiled the assignment where `shadow` does not exist.

The helper also called `unpackRGBAToDepth` and `texture2DCompare`. This chunk no longer has them. A `sampler2DShadow` compare does not return blocker depth, so a PCSS blocker search cannot be dropped in there.

## What to do

Leave soft shadows on three's built-in `getShadow` (Vogel disk, hardware PCF). Do not write the chunk back. `tests/shadow-compile.test.ts` fails if the splice returns, and it shows that the old replace lands before `float shadow` is declared.

## Mistakes to avoid

- Do not retarget the replace at a later copy of the same `#if` without checking the sampler type. The old helper's `sampler2D` and depth unpack do not match `sampler2DShadow`.
