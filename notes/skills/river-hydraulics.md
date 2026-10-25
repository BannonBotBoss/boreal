# Skill: river hydraulics

Use this when a channel's speed or whitewater is wrong (T-0030). One Manning n paints every steep reach white. The fix is the slope in `roughnessN`, boulders from the existing rock sizes, and foam only where water meets those boulders.

## Steps

1. Speed stays in `src/core/stages/rivers.ts`. `roughnessN` is Chow 1959 Table 5-6 n = 0.035 below S = 0.002, and Jarrett 1984 `n = 0.39 S^0.38 R_ft^-0.16` at and above it. `R_ft = depth / 0.3048`. `channelSpeed` is Manning with R ~ depth. Do not put the 3 m/s cap back; nothing in Jarrett sets it.
2. Steps live in `src/core/stages/channelRough.ts`. Only S > 0.02 (the audit's Montgomery & Buffington step-pool cut). Diameter is `ROCK_SIZES[9]` (0.95 m) or, above S = 0.08, `ROCK_SIZES[10]` (1.65 m). Spacing is `L = H / S`, the Abrahams, Li & Atkinson 1995 lower bound `(H/L)/S = 1`. Centres are spawned from `stepsInRect` inside `generateChunk` only while `STAGES.on` is set, so the pinned chunk digest does not move.
3. A step's why chain is `exposed -> scoured`, both `by: 'flow'`. Other rocks stay `weathered -> embedded`.
4. Foam is the `water | rock` transaction verb `aerate`. It returns 0 outside the lee and Wood 1983 Y90 = 0.9 inside it. The roughness Froude number is Boes & Hager 2003, `F* = q / sqrt(g sinθ k^3)`, `k = H cosθ`, `g` from `gravity()`. Depth-mean air is Matos 2000a, `C = 0.163 F*^0.154` (USBR HL-2005-06 eq. 19). That ~0.2 figure is a steep spillway. A Shield boulder in a shallow stream has F* below 1 and a lower C. The sheet still draws Y90, because a low F* means the roughness is large next to the discharge and the lee is already the aerated surface (Kim 2015: behind the trailing edge).
5. `aFlow.xy` is direction times speed. `aFlow.z` is the aeration, not the speed. The 1.3 on the noise sample and on the time shift cancel, so the pattern moves at `length(aFlow.xy)` metres per second. The 0.75 grain floor is game calibration so the lee is broken white and still clears the audit pixel cut. Do not bring back `smoothstep` on speed.
6. The water vertex grid is 1.25 m near the player (40 m / 32). The physical lee is smaller than a cell, so `surfaceAeration` takes half a cell diagonal as `sample`. `sample = 0` is the physical lee. A glide with no step stays 0.

## Checks

- `tests/channel-rough.test.ts`. Known match for locality is 1. Uniform white on a 2/5 lee scores 0.4. Advection of the model speed scores 1; twice that scores 0. Clear albedo is not a foam pixel; Y90 times 0.75 is.
- `npx tsx refs/water/river-audit/slopes.ts`. Step-pool and cascade medians match Jarrett. The old 9.6% share pegged at 3 m/s goes to 0. Flat fills stay Chow (they are T-0029's ponds).
- Pixel foam share is `refs/water/river-audit/measure.mjs`: luminance > 0.45 and saturation < 0.18. Calm boxes <= 0.03. A reach box stays below the cascade photos (0.65–0.90) except a box on a drawn step.
- `npx tsc --noEmit` and `npm test`.

## Mistakes

- Do not mix this speed with `weather.solar`. This path is the channel, not the sky.
- Do not size a new boulder. `ROCK_SIZES` is the Shield table.
- Do not spawn the steps when `STAGES.on` is false. `tests/proc.test.ts` pins that chunk digest.
- Jarrett's fit is S 0.002–0.04 and R about 0.15–2.1 m. Steeper cells still use his equation; say they are outside the fit instead of inventing another n.
- Overwriting `refs/water/river-audit/fast1/` destroys the before frames. Write after frames beside them.
