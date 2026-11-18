# Skill: standing sky shows the reported cloud fraction

Use when the player is on the ground under a clear blue sky while the weather cell reports a cloud fraction well above zero.

## Search before writing

1. The standing clouds are the cirrus dome in `src/render/sky.ts` (`CLOUD_FRAG`, `domeCoverThreshold`). The three.js Sky cloud layer stays off (`u.cloudCoverage = 0`) because it was a pale sheet.
2. The globe's shell uses the same idea: a noise threshold whose exceedance is the cover (`src/world/globe/cloudCover.ts`).
3. In the descent band the dome is hidden (`hideForBand`, render order below 0). `restoreScene` puts it back in game mode. Do not un-hide it in the band: a 600 m dome covers the horizon.

## Steps

1. Sample the cirrus field (sheet 0.38 + fibers 0.40 + lace 0.22 of 5-octave fBm). Its mean is about 0.49 and it barely exceeds 0.74.
2. Set the threshold so the share of directions with a visible veil is about the reported fraction. `0.56 - 0.44·C` does that: clear stays under 3 percent, 0.32 is about a third, overcast is most of the sky.
3. Keep the humidity term `max(cloud, rh - 0.6)`. It was already there.

## Checks

- `tests/ground-sky-cloud.test.ts` resamples the field. It fails the old `0.62 - 0.4·C` line at cloud 0.32 (about 6 percent visible) and fails if the dome stops calling `domeCoverThreshold`.
- Same camera before and after: `?nomenu&stages=1&trees=v2&at=65.4,-18.6,2.054&hour=8`. The sky band goes from a clear blue to streaky cirrus. Frames in `tasks/evidence/T-0258/`.

## Mistakes to avoid

- Do not add a second cloud shader. This dome is the one the ground already draws.
- Do not treat a SwiftShader orbit screenshot timeout as a missing cloud. Copy the canvas instead.
- Prairie overhead salt, fox, pups, and gait are other tasks. This skill is only the standing dome.
