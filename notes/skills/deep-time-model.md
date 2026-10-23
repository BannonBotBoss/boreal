# Skill: deep time (the long time axis), core/deepTime.ts

When to use: anything that must answer "what is the planet like N years from now/ago" (time-control UI, globe look at a deep offset,
the microscopic start-of-life world, end-of-Earth view).

Steps
1. Read `core/deepTime.ts`; do not add a second brightening/temperature model (T-0057 is today's budget, it forbids a zonal EBM).
2. Offsets are signed years from now (negative = past). `deepTimeAt(y)` is the one readout: stage, text, luminosity, S, Te, embodiable scale.
3. A new milestone is ONE row in `MILESTONES` with a dating paper or the ICS chart in `src`; a new stage boundary is a `DEEP` figure
   with a citation, never a literal in a reader.
4. Wire UI through `dialToYears` / `yearsToDial` (log scale); do not make a linear slider (one drag must span a year to billions).
5. Checks that proved it: Te now 254.0 K (NASA Earth fact sheet), young Sun 0.714 at birth (Feulner 2012), +1 %/110 Myr (Wolf & Toon 2015),
   flux thresholds -> 1.27 / 1.98 Gyr; stages monotone over a 5 Myr sweep; dial round trip. `tools/deep-time.html?t=<years>` shows it.
Mistakes to avoid: reading Te as surface temperature (faint young Sun paradox: Te was ~237 K at 3.7 Ga yet oceans were liquid); using the Gough
ratio past +5 Gyr (it is flagged `extrapolated`; the page shows "not modelled"); treating the 3.7 Ga life date as settled (it is the oldest
widely discussed evidence, older and younger claims exist).
