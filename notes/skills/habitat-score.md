# Skill: a place scores food, water, and shelter

Use when a cell must carry food, water, shelter, vegetation, competition, and predator pressure, and a quality score. Roadmap step 9. Issues #100 and #101. Conflict 11: #101's sum wins. #100's environmental stress is not in it. #106 puts that stress on the body.

## Steps
1. Read `notes/design-roadmap.md` step 9 and conflict rows 9 and 11. The relationship is `food + water + shelter − competition − predator pressure`. The issue's 0–100 scale, the `temperature / 25` growth sketch, and the cutoff ladder (fear 90, hunger 80, habitat 25) are not game numbers.
2. Do not edit the open weather, precipitation, or camera files. Snow depth, the climate-class name, and the entity store are other changes. This cell only reads.
3. Food and vegetation are the browse crop already in `src/core/fields.ts` (`browseGrams` / `BROWSE_CELL_MAX_G`, regrowth T-0015). One crop, two names. A bite lowers both. Do not add `Vegetation.update`.
4. Water is 1 on open water (`siteAt().water`). Otherwise it is `weatherAt().soil`, the Manabe bucket fill already returned as a share of field capacity. Do not add a moisture-debt accumulator here. That is step 6.
5. Shelter is `standAt().canopy`, the closure already in `src/core/stand.ts`. Do not rescale it.
6. Competition is herbivores on the cell divided by the hare peak already cited on `HARE_NEEDS` (10 per hectare, Keith 1990, the high end of 5–10). Predator pressure is wolves on the cell divided by 40 per 1,000 km² (Fuller, Mech & Cochrane 2003: mainland midwinter densities rarely exceeded that). Clamp each share to 0..1. Counts default to 0. Step 14's field is `src/core/coarse.ts`; pass its deer and wolf counts when the caller has folded animals.
7. `habitatQuality` adds those five shares with weight 1. It takes no stress, snow, or climate-class argument. Animals do not read a class name.
8. The picture does not change. The frame gate is N/A. The check is two fixture cells, plus a grazed browse cell against the same cell ungrazed.

## Checks that prove it worked
- `npx tsx --test tests/habitat-score.test.ts`
- Ungrazed food is 1. After a bite of half the crop, food is near one half, vegetation matches food, shelter is unchanged, and the score drops by the food drop alone.
- Half the hare peak is competition 0.5. One wolf on the cell is predator pressure 1.
- `habitat.ts`, `agent.ts`, and `animalBehavior.ts` do not contain `climateClass`, `temperate forest`, or `choose_action`.

## Mistakes to avoid
- Subtracting temperature, snow, or "environmental stress" a second time. Step 18 carries stress. Snow's cost on movement is steps 10 and 23.
- Porting #101's `choose_action` cutoffs. That ladder loses to step 10.
- A second growth equation, a second snow depth, or a second bucket.
- Editing `weather.ts`, `precipitation.rs`, the grass drawer, the inspector, or the globe camera while those files are on an open change.
- Treating the issue's 0 and 100 as the digits. The sum of shares is the score.
- Wiring the score into `agent.ts` from this step. Step 10 reads the cell through `winningUrge` (`notes/skills/strongest-urge.md`). It does not add the cutoff ladder.
