# Curved river centrelines

Use this when a channel is a polyline of 30 m and 42 m D8 segments that turns 45° or 90° at a point. The network graph stays. The centreline the carve, the banks and the flow vector follow does not.

## Steps

1. Measure the raw polyline before changing it. `npx tsx refs/water/river-audit/kinks.ts` prints the D8 turn shares and `planformReport`: samples whose osculating radius is under 2 channel widths. A 90° corner with 0.5 m legs has circumradius 0.3536 m (a known miss). Three points on a circle of radius 2.43 × 4 m recover that radius (a known match).
2. Keep the D8 graph. At each surviving bend, put a circular fillet at Rc/W = 2.43 (Williams 1986, J. Hydrol. 88:147-164, geometric mean of 79 sites; the modal bin is 2–3). Drop a vertex when that fillet will not fit on the two chords. A confluence stays.
3. On a pool-riffle reach, add a meander lobe. Leopold & Wolman 1960 (GSA Bull. 71:769-793): λ/W = 10.9 and belt A/W = 2.7, so the crest is 1.35 W. The lobe is a half-wave of that sine between two fillets of radius 2.43 W, which is what lets the crest meet the valley tangent. The sine coefficient is smaller than 1.35 W because the fillet already stands off the chord; the crest, not the coefficient, is A/2. One lobe needs about 7.9 W of free chord. A longer chord takes 3, 5, … half-waves. Reaches shorter than one lobe stay straight apart from the valley fillet.
4. Split reaches on slope, not on a second map. Montgomery & Buffington 1997 (GSA Bull. 109:596-611): below 0.015 is pool-riffle. Steeper stays on the valley line plus the fillet. The reach slope is the chord across a dropped vertex, not the steeper of the two 30 m steps. A 45° D8 step is the grid staircase (D8 only turns 0°, 45° or 90°); drop those on a gentle chord. A 90° step keeps its fillet.
5. Size the lobe to the wider end. Width grows downstream, so the local width never exceeds it, and a radius of 2.43 of the wider end stays at or above 2 local widths. Store the pieces relative to a grid cell and copy them along the curve so a query within two cells still hits the centreline.
6. Point `riverAt`, the carve and the breach cap at that curve. The flow vector is the unit tangent. Do not retune Manning or the 3 m/s cap here.

## Files

- `src/core/stages/riverPlanform.ts` — fillets, lobes, `planformReport`, `queryPlan`.
- `src/core/stages/rivers.ts` — `riverAt` reads the plan. `breachUnconfined` caps the curved centreline.
- `src/core/stages/riverContain.ts` — containment samples are centreline points, not D8 midpoints.
- `refs/water/river-audit/kinks.ts` — D8 shares plus the curved report.

## Checks

- `planformReport` on seeds 1400 and 7: `under2` is 0, `minRcOverW` is at least 2, `steepMeanderPieces` is 0, median λ/W is 10.9 and median half-amplitude/W is 1.35. The D8 sharp share stays above 0; that polyline is the known mismatch, not the centreline.
- Every centreline sample has `riverAt` distance under 0.05 m, and `(dirX, dirZ)` is a unit tangent. `carve` only lowers.
- `riverContainment` open share stays 0.
- Adjacent `terrainCore` borders match in height and normal. World-chunk digest moves only if entity placement moved; fur digests do not. Do not bump `GENERATOR_VERSION`.
- `npx tsc --noEmit` and `npm test`.

## Mistakes

- A short taper on a Leopold sine (a quarter of the edge, or a few widths) spikes the curvature. The samples then fall under 2 W even though a pure sine of λ/W = 10.9 and crest 1.35 W has apex radius 2.23 W.
- Taking the circumradius of the three D8 nodes scores a 90° corner as a large circle. Sample the curve, or use the turn angle for the polyline. Dense samples of a kink are the small radius.
- Classifying each 30 m step as its own reach leaves no chord long enough for one lobe. The published split is a reach slope.
- Sizing the wave to the narrow end makes the wide end tighter than 2 local widths.
- Apex widening was not applied. The plan's "claimant: cite" cell has no ratio checked against a paper here.
- Bumping `GENERATOR_VERSION` reshuffles chunk seeds and rejects forage records stored as version 1.
