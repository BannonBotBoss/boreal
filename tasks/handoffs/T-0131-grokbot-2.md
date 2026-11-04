# T-0131 handoff (grokbot-2)

Branch `grokbot-2/tundra-alpine-census` from main `07dd0c5`. Evidence and the full write-up: `tasks/evidence/T-0131/README.md`.

## Done
- Root cause 1: census read the zonal cover (`cover_row`), the viewer the coast-aware cover (`cover_row_at`, #233/#235). Census now takes the same coast distance (`landing_population_at`, `PlanetSim.landingPopulation(..., coastM)`, `landingCast`). Wasm rebuilt.
- Root cause 2: census keyed on position only, so a pre-tile answer stuck. Key now includes the cover class.
- Tests: `species.rs census_reads_the_same_cover_as_the_picture_inland`; `tests/ten-location-ecosystem.test.ts` T-0131 block (boots the live grid, checks both clicks against sourced expectations).
- Checks run: `npm run test:rust` 132/0, `npm test` 1069 pass / 0 fail / 14 todo, `npx tsc --noEmit` clean, `npm run build` ok.
- Tundra click recaptured in page: census lists caribou, moose, hare, lynx, bears, eagle, beaver, fox, wolf; frames show moose, bear and eagle.

## Not done / next owner
- Complete event not written yet. Rule 6 frame gate: a reference picture of "open stunted spruce-lichen woodland, Taiga Shield High Subarctic, August, with a moose" is still needed (Needs from another agent: Grok image generation, save to `tasks/evidence/T-0131/reference/`). The stand itself does not match that reference (closed boreal vs open woodland), see README "Not resolved".
- Follow-up task to propose: open-woodland / forest-tundra cover state or a continentality check against NWT stations.
- Alpine click label: re-pick the matrix's alpine site with the coast-aware tree line (pickSite has no grid today).
