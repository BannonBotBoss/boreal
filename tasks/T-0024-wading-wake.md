---
id: T-0024
title: Wading wake - paws and legs in water make ripple rings and a V wake from contact, with sourced wave speeds
author: claude
scratch: true
research: true
skill: false
tags: [water, contact, animal, transactions]
credits: 54
---
# T-0024 Wading wake

**Status: proposed by claude (2026-10-21 11:32 PT). Open claim: no owner.** Needs another agent's `approve-plan` before a claim.

**Credits: 54** (= 10 x 3 objectives x (1 + 0.5 from scratch + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, claude/loop at 36b8a51 = main, port 5231)
Recording: `refs/water/shore-audit/noon-wade.webm` and `wade-0..5.png`, `wade-stop-0..1.png` (capture.mjs holds W for ~5 s
from `?at=30,0,1.571`, hour 12). The wolf walks off the grass into the open water. From wade-3 on its legs vanish at a hard
waterline; the surface around them stays exactly as it was before: the same slow fine noise ripples drift over the whole
lake, **no ring spreads from a paw, no V wake trails the body, no splash, no disturbed patch** where it walked, and it stays
flat after the wolf stops (wade-stop). `grep -i "ripple|wake|splash" src` finds no water-disturbance code (only the terrain
height layer named 'ripples' in core/world.ts:34). The water shader (render/water.ts) knows only a global time drift and the
river flow vector.

## Does it look natural? How I know
Anything moving through calm water disturbs it: each paw entering or leaving makes a ring of ripples that spreads and fades,
and a body moving at walking speed trails a V (Kelvin) wake that stays behind it for seconds. With no disturbance at all the
wolf reads as gliding over a painted floor. Generated reference: **not yet made** (outside my tools; see
`tasks/handoffs/claude-loop.md` "Needs from another agent"). The claimant needs it before the frame gate.

## Numbers (nature; the game has none of these)
| Quantity | Game | Nature (source) |
|---|---|---|
| Slowest ripple (capillary-gravity minimum) | none | 0.23 m/s at wavelength 1.7 cm (dispersion w^2 = g k + (sigma/rho) k^3, sigma = 0.072 N/m; Lighthill, *Waves in Fluids*, 1978) |
| Ring speed for 5-30 cm wavelengths | none | crests (phase) 0.30-0.69 m/s; the ring front (group speed) 0.18-0.35 m/s (same relation, computed: c = sqrt(g/k + sigma k/rho), cg = (g + 3 sigma k^2/rho) / 2w) |
| Wake half-angle behind a body | none | 19.47 deg (Kelvin) for hull Froude number U / sqrt(g L) below ~0.5; narrows above it (Rabaud & Moisy 2013, PRL 110:214503). Wolf walking 1.5 m/s, L ~1 m -> Fr ~0.48: Kelvin angle holds |
| Wolf shoulder height (wading vs swimming depth) | depth not checked against the body | 0.66-0.81 m (Mech 1970, *The Wolf*); deeper water than this means swimming, which the claimant should flag, not build here |

## Proposed implementation / scope (reuse first)
- Cause: a paw touchdown or liftoff below `LEVEL.waterSurface` (or a staged lake surface) is the transaction. Reuse the
  locomotion `onTouchdown` stream for per-paw rings (as footsteps/tracks do) and the T-0006 contact bus for one lasting
  `animal|water` pair (begin on the first paw in, end a stride after the last leaves), which sound and wetness can share.
- A small ring buffer of disturbance sources (x, z, t0, energy from paw speed and body mass) passed to the shared water
  shader as uniforms; each source adds a radial normal wave whose radius grows at the sourced group speed and whose
  amplitude decays with radius and time. The body's track (positions over the last seconds) gives the V wake at the sourced
  angle. One program key, no new material.
- Same code for every animal (deer, hare, people): species differ only by data (paw count, mass, speed).

## Objectives
- [ ] Contact-driven disturbance sources (touchdown in water -> ring; moving body -> wake), shared by all animals
- [ ] Shader rings and wake with the sourced speeds, angle and decay; budget measured
- [ ] Both gates: number table re-measured from new frames (ring radius vs time, wake angle), generated nature reference, >=95 % frame match without rounding; handoff and skill

## Acceptance
In the re-recorded wade, a ring appears at each paw that enters the water, its front grows at 0.18-0.35 m/s with crests running through it at 0.3-0.7 m/s, a V wake of
19.5 +/- 2 deg trails the walking wolf and fades within a few seconds after it stops; npm test and npx tsc --noEmit pass.

## Depends on
- T-0006 (contact bus, on main); looks best with T-0023 (the rings perturb the mirror), but does not need it
