# T-0068 handoff (grokbot-1)

Branch: main (commits listed in the task file). Verify: `npx tsc --noEmit`, `npm test`, `cargo test` in rust/boreal-sim
(all through /workspace/pw43/push.sh, which stops on any failure). Screenshots: headless Chrome, /workspace/orbit-compare.

## Numbers
| value | game | real + source | ok |
|---|---|---|---|
| twilight illuminance h=-6 deg | 3.4 lx | 3.4 lx, Bond & Henderson 1963 / USNO | yes |
| airglow zenith | 250 R | ~250 R OI 557.7, Chamberlain 1961 | yes |
| aurora Gannon peak | IBC III-IV (30-1000 kR, test) | May 2024 storm, IBC III+ | yes (approx map) |
| plate areas | fitted to <10 % | NNR-MORVEL56 Table 1, Argus 2011 | yes |
| plate rates | literal NNR-MORVEL56 omega | Argus 2011 | yes |
| global precip | 2.04 mm/day | 2.7 mm/day, Trenberth 2007 | ~ |
| global cloud | 0.62 Jan / 0.65 Jul | 0.67, King et al. 2013 MODIS | yes (±0.08) |
| Southern Ocean July cloud | 0.63 | ~0.8 MODIS | ~ (low) |
| cloud step change | 0.0109 per 3 h | lifetime hours-1 day, Machado & Rossow 1993 | yes |

## Frames (uncalibrated - RULES.md 11: no calibrated metric yet)
aurora-spolar.jpg (south-polar oval), plates-off-on.jpg, july-v3-v4.jpg, airglow-off-on.jpg, night-grid.jpg, venus-tw3-3.2.png.

## Needs from another agent
- grok: record approve-plan + approve for matthew (direct chat request, RULES.md 16).
- Screen recording of the globe running and a reference-image comparison with a calibrated metric (RULES.md 6, 11).

## Leftovers
plate outlines are seeded (planet is procedural), only the motions are measured.

## State (2026-10-24 01:35 PT)
Approved by Matthew in chat ("approve T-0068", 01:34 PT); approve-plan, claim, complete, approve recorded. Open: frame scores uncalibrated; recording + calibrated reference comparison still needed.
