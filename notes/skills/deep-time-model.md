# Skill: deep time (the long time axis), core/deepTime.ts

When to use: anything that must answer "what is the planet like N years from now/ago" (time-control UI, globe look at a deep offset,
the microscopic start-of-life world, end-of-Earth view).

Steps
1. Read `core/deepTime.ts`; do not add a second brightening/temperature model (T-0057 is today's budget, it forbids a zonal EBM).
2. Offsets are signed years from now (negative = past). `deepTimeAt(y)` is the one readout: stage, text, luminosity, S, Te, embodiable scale.
   `deepTimeAt(0)` stays the present. Do not move the stage boundaries onto a second timeline.
3. A new milestone is ONE row in `MILESTONES` with a dating paper or the ICS chart in `src`; a new stage boundary is a `DEEP` figure
   with a citation, never a literal in a reader.
4. The #108 line is the existing `dialToYears` / `yearsToDial` pair (log scale; one drag still spans a day to billions). It returns
   years since solar-system formation. Time 0 is formation. Slider position 0 is the present, at `DEEP.solarSystemAgeYr`
   (Connelly et al. 2012, 4567.30 ± 0.16 Ma, the T-0065 `nebula_sun` mean). Subtract that age before `deepTimeAt`. Earth's age
   (`DEEP.earthAgeYr`, Dalrymple 2001) is the span from Earth-formation to the present on that line, not a second zero.
   `epochOffsetYr` is session seconds. It is not this line. Do not add a second epoch function, a second clock, or a second wheel.
5. Checks that proved it: Te now 254.0 K (NASA Earth fact sheet), young Sun 0.714 at birth (Feulner 2012), +1 %/110 Myr (Wolf & Toon 2015),
   flux thresholds -> 1.27 / 1.98 Gyr; stages monotone over a 5 Myr sweep; dial round trip. Time 0 is no planet and the present is
   living Earth at 254 K, with `dialToYears(0)` equal to the CAI age and Earth's age equal to the span from Earth-formation to that
   present. `epochOffsetYr` still divides session seconds by the Julian year. `tools/deep-time.html?t=<years from now>` shows the same labels.
Mistakes to avoid: reading Te as surface temperature (faint young Sun paradox: Te was ~237 K at 3.7 Ga yet oceans were liquid); using the Gough
ratio past +5 Gyr (it is flagged `extrapolated`; the page shows "not modelled"); treating the 3.7 Ga life date as settled (it is the oldest
widely discussed evidence, older and younger claims exist). Using issue #108's round "4.5 billion years" as the present. Using Gough's
`sunAgeYr` (4.57 Gyr) as the formation date: that t0 stays the luminosity fit. Putting time zero at Earth's formation: that instant is
Hadean, and the globe already exists. The CAI age is older, so the state at time 0 is no planet. Changing `deepTimeAt(0)` away from now.
Passing `epochOffsetYr` in as years since formation.
