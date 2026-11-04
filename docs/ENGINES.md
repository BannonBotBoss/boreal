# Engines

An engine is a Rust type that implements `Engine` in `rust/boreal-sim/src/registry.rs`. The panel does not keep its own list. It reads the record the registry writes.

## Add one

1. Put the formulas in `rust/boreal-sim/src/<name>.rs`. Cite the book or paper next to the equation.
2. Implement `Engine` (id, what it generates, the source file, parameters, equations, spawn rules, `evaluate`).
3. Add a match arm in `registry.rs` (`engine_for`, `eval_id`, `generates`, `file_of`) and, if it should appear on its own, a `Rule` on the parent whose output crosses the threshold.
4. Add the source path to `rust/boreal-sim/build.rs` so the panel can show the day the file entered git.

`rust/boreal-sim/templates/engine.rs` is a blank implementation. Copy it and fill it in. There is one registry, `spawn_engine`. Nothing else creates an instance.

## Time

`cosmic_time::cycle_to_seconds` is the only cycle-to-seconds function. 0 is nothing. 1 is one Planck time, 5.39×10⁻⁴⁴ s. Each extra cycle multiplies the time by ten. Negative cycles are before the expansion and stay negative.

## What is already here

- **spacetime** (`cosmology.rs`). Friedmann equation and a quadratic inflaton, V = ½ m² φ². Inflation ends when the slow-roll parameter ε = 2/φ² reaches 1. Planck 2018 H₀ = 67.4 km/s/Mpc, Ωₘ = 0.315, Ω_Λ = 0.685, Ωᵣ = 9.1×10⁻⁵. Constants are CODATA 2018.
- **reheating** (`reheating.rs`). Spawned by spacetime when ε = 1. Boltzmann decay from Kolb & Turner, *The Early Universe*, chapters 5 and 8. Species densities are equilibrium Bose–Einstein or Fermi–Dirac numbers; nothing marks a species present. g*(T) follows the Standard Model count in Husdal 2016 and Saikawa & Shirai 2018: 106.75 when everything is relativistic, and about 3.36 after neutrino decoupling.
- **nucleosynthesis**. Spawned by reheating when T is between 10⁸ K and 10¹⁰ K. The instance is real. The nuclear calculation is not built.
- **planet** and its children (climate, solar, energy, wind, hydro, clouds). Spawned when cosmic time reaches 9.2 billion years. They evaluate a scratch grid. The game's own grid is separate, and the session line says when that one actually stepped.

## Spawn

`Registry::spawn_engine` records the time, the cause, and the parent, and starts that instance's clock. Automatic spawns are a pure function of the time: scrubbing backward despawns them, and scrubbing forward creates the same set again. A manual spawn stays until it is despawned, unless its parent is gone.

— grokbot-3
