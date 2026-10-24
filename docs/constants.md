# Constants and control badges

**One source of truth:** `src/data/constants.json`, read by `src/core/constants.ts` (live `K.name`) and generated into
`rust/boreal-sim/src/constants.rs` by `npx tsx tools/gen-constants.ts` (a test fails if it is stale). `tests/rules.test.ts`
fails on literal copies of known constants (6.674e-11, 5.67e-8, 299792458, 1361, 3.14159 ...) anywhere else.

## A derivation graph, not a list
Only **base inputs** are stored; everything else is computed by formula (`derived`), in order.
- SI 2019 exact defining constants: c, h, e, k_B, N_A, Δν_Cs, K_cd.
- Measured: α, R∞, m_e/m_p, **G**. IAU 2015 / WGS84 / IERS nominal values: GM_sun, R_sun, L_sun, TSI, Teff, AU, GM_earth, radii, ω, J2, Julian year, J2000.
- Derived: ħ = h/2π, R = N_A k_B, F = N_A e, σ = 2π⁵k_B⁴/(15h³c²), Wien b = hc/(k_B x) with x the root of x = 5(1−e⁻ˣ),
  ε₀ = e²/(2αhc), μ₀ = 1/(ε₀c²), m_e = 2R∞h/(cα²), m_p = m_e/(m_e/m_p), Planck units, M_sun = GM_sun/G, M_earth = GM_earth/G.
- Maths: π, τ, e, φ, √2, ln2, degree/arcsecond, golden angle 137.5077°.

Tests check every derived value against CODATA 2018 within its stated uncertainty, and c = 1/√(μ₀ε₀).

Which constants count as "base" is an **SI convention** (since 2019 c, h, e, k_B, N_A are fixed by definition), not a fact
of nature. **G is the one we cannot derive**: no theory predicts it, so it is taken as measured (CODATA 2018, ±22 ppm).

## Locked constants and what is held fixed
Base constants are locked by default (CODATA value always used). G becomes adjustable (range 6.0–7.4e-11) only with the
`constant.G` badge. Planetary orbits measure the **product** GM to ~1e-10, far better than G alone, so **GM_sun and
GM_earth are held fixed**: changing G changes the implied masses (M = GM/G), not orbits or surface gravity. Holding M
fixed instead would change every orbit. Code reads `K.G` / `PHYS.G` / `ORBIT.GM_sun` live (getters); nothing caches it.

## Control badges (core/badges.ts, data/controls.json)
"Only what you understand shall you have control." Each gated control has its own test about the physics it governs,
prerequisites (understanding builds), and a credit cost. One gate: `canUse(id)`. Three ways to get a badge, all of which
need every prerequisite badge first: pass the test, redeem credits (append-only ledger), or a `PlatformStore` purchase
(hook only; `NoopStore` declines). `constant.G` is the capstone: its prereqs are every other control.
- Tests: draw without repeats (seen ids per control, reset when exhausted), pass ≈70%, numbers ±8%, MC second try for half
  credit, no penalty for failing. 3 tiered hints per question (nudge, clue, walkthrough); each hint lowers answer credits
  by 1 (min 1); opening the walkthrough means that question can't count toward the pass.
- Credits: look 1, toggle 1, answer 5, minute played 2; caps per minute 6/6/60/2 (anti-farm).
- Dev: `?unlockAll=1` in dev builds only.
- Pools: `constant.G` = 27 problems adapted from OpenStax University Physics Vol. 1 ch. 13 (CC BY 4.0, attribution in the file).
  Other controls are **todo**: no sourced pool yet (to come from OpenStax High School Physics / Astronomy 2e). Never invent questions.
