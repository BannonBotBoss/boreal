# Challenges from biological math: design proposal (Grok Bot, 2026-10-15)

Rule 0: the game is about living the lives of different animals. Every challenge comes from **one shared, species-agnostic
system** that reads the species spec (Claude's `species.ts`, proposed `AnimalSpec`) and the simulated world (weather cells,
layered ground, deltas, density fields). **No hand-written per-species challenges.** A new species gets all of them by adding
a spec entry.

## Shape
`core/life.ts` (proposed): `LifeState` per animal = { energy J, fat kg, water kg, core °C, fatigue, age days, reproductive state }.
`stepLife(spec, state, env, dt)` is ONE function. `env` is sampled from the world (`weatherAt`, `windAt`, `column`/`footing`,
`DELTAS`, prey/predator density fields). Each model below is a pure term. Challenges are **thresholds on the state** (starving,
hypothermic, dehydrated, exhausted, hunted, in season, old) that the HUD, haptics, behaviour layers and the inspector all read.
Everything is traced through `proc/trace` so the inspector shows the math behind each challenge.

| Challenge | Model (cite in code) | Inputs from spec | Inputs from world |
|---|---|---|---|
| Energy budget / hunger | Kleiber 1932 BMR = 70 M^0.75 kcal/day; field metabolic rate ≈ 2–4 × BMR (Nagy 1987, Ecol. Monogr. 57:111; Nagy et al. 1999 allometries by taxon) | mass (from composition), taxon | activity (speed, gait), ground cost (Bekker) |
| Locomotion cost | Taylor, Heglund & Maloiy 1982 (J. Exp. Biol. 97:1): net cost of transport ∝ M^−0.32 | mass, leg length | slope, sinkage, snow depth |
| Thermoregulation | Scholander et al. 1950 heat-balance model: H = C (T_b − T_a) with conductance from fur depth/area (Gates 1980, Biophysical Ecology); lower critical temperature; wind chill via convective coefficient ∝ √(U/d) | fur depth/density, surface area (Meeh, A = k M^(2/3)), body temp | air T, wind, radiation (Rn), wet fur from rain/snow |
| Water balance | Evaporative + respiratory loss, drinking need ∝ M^0.88 (Calder 1984, Size, Function and Life History) | mass | temperature, humidity, lakes (water cells) |
| Speed and endurance | Max speed allometry (Hirt et al. 2017, Nat. Ecol. Evol. 1:1116, time-dependent acceleration); aerobic scope / VO2max ∝ M^0.87 (Weibel 2004); fatigue as an oxygen-debt integrator | mass, leg/limb plan | sinkage, slope, temperature |
| Predator–prey | Holling 1959 type II functional response; encounter rate from the ideal-gas model (Hutchinson & Waser 2007, Biol. Rev. 82:335): rate = 2 r v ρ | detection radius, speed, diet | density fields (far) / instantiated animals (near), scent and track deltas |
| Seasonal breeding | Photoperiod trigger from `solar()` day length; gestation ∝ M^0.25 (Blueweiss et al. 1978, Oecologia 37:257) | mass, breeding photoperiod | date, latitude |
| Ageing | Lifespan ∝ M^0.2 (Calder 1984); Gompertz mortality μ(t) = a e^(bt) (Gompertz 1825) | mass | age, condition (fat reserve) |

## Rules for the system
- Constants come from the cited papers (rule 5). Taxon-specific coefficients (e.g. Nagy's eutherian vs. bird FMR) are *table rows*, not code.
- Far animals are density fields: hunger and mortality act on the field in closed form (logistic or Lotka–Volterra on the density). Only instantiated animals step `stepLife` (rule 8).
- Deaths become `carcass` deltas (rule 9), feeding scavengers and the ground.
- The player's animal uses exactly the same `stepLife` as every NPC.

## Hooks needed from Claude's files (proposal only, see AGENT-NOTES)
1. `species.ts`: per-species `taxon` ('eutherian' | 'bird'), fur depth/density, body-temperature setpoint, diet, breeding photoperiod. Data only.
2. `animalBehavior.ts` `AnimalBrain`: read `LifeState` thresholds as drives (hunger → forage/hunt priority, cold → seek shelter, fatigue → caps gait), instead of the current fixed energy constants.
3. `expend()`: take its cost from the shared locomotion-cost term, so `brain.energy` becomes joules.
