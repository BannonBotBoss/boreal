---
id: T-0023
title: Water optics - the lake mirrors its shore and sky by Fresnel, its body is dark humic water, and the shallows show the bottom
author: claude
scratch: false
research: true
skill: false
tags: [water, light, render]
credits: 39
---
# T-0023 Water optics

**Status: proposed by claude (2026-10-21 11:32 PT). Open claim: no owner.** Needs another agent's `approve-plan` before a claim.

**Credits: 39** (= 10 x 3 objectives x (1 + 0.3 research)). Matthew can change it.

## What I saw (recorded 2026-10-21, claude/loop at 36b8a51 = main, port 5231)
Recording: `refs/water/shore-audit/` (capture.mjs, noon-0..3.png, wade-0..5.png, evening-0..3.png, noon-wade.webm, evening.webm,
measure.mjs -> measure.json). Spawn shore `?at=30,0,1.571` (facing west across the open water), hour 12 and 19.5, day 227.

Description (noon-0): third-person view behind the grey wolf on a dark green grassy shore with blueberry clumps. About 15 m
ahead an open water band ~40 m wide crosses the frame. Its surface is one flat pale turquoise (near band sRGB 109,156,168),
a little darker toward the far side (92,126,129), with faint fine noise ripples drifting slowly. Beyond it a dark strip of
forest floor and a dense wall of dark spruce cones and bright green aspen crowns rise to the top of the frame. The water
meets both shores at a hard cut: no dark wet band, no stones or sedges, no tint change in the shallows, no visible bottom.
**Nothing is mirrored**: the far spruce wall, its dark trunks and the sky do not appear in the water. Evening (19:36, after
sunset): the band is a uniform dark blue (13,43,58), still lighter than everything around it and still with no mirror image
of the treeline. Wading (wade-0..5): the wolf walks in and the surface stays flat and opaque around its legs (the wake is
T-0024's).

## Does it look natural? How I know
A calm boreal lake seen from a shore at eye height is mostly a **mirror**: at grazing angles water reflects 30-73 % of the
light (Fresnel, below), so the band under the far shore shows an upside-down dark spruce wall, and only the water close to
the feet (steep reflected rays) shows bright sky. The light that comes *out of* humic boreal water is tiny, so the water
itself is dark brown-black where it reflects something dark. In the shallows (< ~1 m) you see the stones/sand/organic bottom
through brown-tinted water. The game shows the opposite: a bright, opaque, self-coloured surface with no mirror.

Generated reference: **not yet made** (outside my tools; see the handoff `tasks/handoffs/claude-loop.md`, "Needs from
another agent"). The claimant must have it before the frame gate.

## Numbers (game vs nature)
Camera: wolf cameraHeight 1.6 m on ground 1.48 m at x = 30 -> eye ~3.3 m above the water (-0.25 m).

| Quantity | Game | Nature (source) | Resembles? |
|---|---|---|---|
| Reflectance at normal incidence | `metalness .1, roughness .32`, no environment mirror of the shore | 2.0 % (n = 1.333; Fresnel, Hecht *Optics*; three.js Water2.js default `reflectivity 0.02`) | no mirror at all |
| Reflectance at 15 / 30 / 45 m from a 3 m eye (78.7 / 84.3 / 86.2 deg) | ~0 (no reflected image) | 30.5 / 54.1 / 66.2 % (exact Fresnel, unpolarised, n = 1.333; computed in this task's handoff) | no |
| Water band under the far treeline, relative luminance | 0.188 (measure.json `water_far`), 5.0x the treeline it should mirror (0.037) | ~0.66 x 0.037 + water-leaving ~0.001-0.005 = ~0.025-0.03, i.e. *darker* than the treeline | no (6-7x too bright) |
| Body colour (light leaving the water) | base `0x578d91` (87,141,145) lit like an opaque diffuse surface | humic boreal lakes: water-leaving signal very low, CDOM absorbs blue first (Menken & Brezonik 2006, Lake Reserv. Manage. 22:179-190); in extremely brown lakes it is negligible across the visible (Kutser, Paavel & Kauer, EGU2015-13460) | no (bright teal, not dark brown) |
| Shallow-water transparency | opaque everywhere | boreal lake Secchi depth typically ~1-4 m (claimant: cite a regional survey, e.g. Finnish/Ontario lake monitoring) | no (bottom never visible) |
| Water share of the land (context, not this task's fix) | 23.6 % of a 10 x 10 km square around spawn (refs/water/shore-audit/water-fraction.ts), 80 % within 450 m; staged lakes/ponds only 0.3 %, the rest is one flat 'open' level | ~9 % freshwater (Canada, Messager et al. 2016, Nat. Commun. 7:13603 HydroLAKES; Finland ~9 %, FAO) | no: left for a terrain/hydrology inspection, not claimed here |

## Proposed implementation / scope (reuse first)
- Reuse three.js `examples/jsm/objects/Reflector.js` (MIT, r180, already installed; Water2.js which `render/water.ts` already
  cites uses it) for the single open-water level `LEVEL.waterSurface`: one planar mirror render, at reduced resolution and
  gated by the photoreal tier like IBL, then blend in the existing `waterMaterial()` shader with Schlick
  `F = 0.02 + 0.98 (1 - cos t)^5` (Water2.js line 363). Staged lakes at other levels may fall back to the IBL environment.
- Body colour from absorption, not a picked colour: Beer-Lambert over the water depth (`surface - heightAt`, already known
  per vertex or from the depth buffer) with humic attenuation per channel (blue absorbed first), over the existing ground
  colour, so the shallows show the bottom and deep water goes dark.
- Keep the flow-map ripples (Vlachos 2010) as the normal perturbation that wobbles the mirror; one program key.
- Why chain: water is here because the staged terrain sits below the lake level; its look is generated by light transactions
  (sky + shore radiance in, Fresnel split, absorption over depth), no hand-tuned tint.

## Objectives
- [ ] Fresnel mirror of sky and shore on the water (reuse Reflector + the Water2 Fresnel), tier-gated, budget measured
- [ ] Humic body colour and shallow transparency from depth absorption (sourced attenuation coefficients)
- [ ] Both gates: number table re-measured on new frames from the same capture.mjs views, generated nature reference, >=95 % frame match without rounding; handoff and skill

## Acceptance
Water band under the far shore darker than the treeline it mirrors (luminance ratio 0.5-0.9), near-foot water shows the sky,
shallows (< 0.5 m) show the bottom, evening water brighter than the dark forest only where it mirrors the twilight sky;
npm test and npx tsc --noEmit pass; GPU cost reported per tier.

## Depends on
- none (T-0022's dated sun changes the sky the water mirrors, so re-check after it lands)
