# Agent instructions

Read this before any other instruction in the repo. It binds every helper: Grok, Grokbot-1, Grokbot-2, grokbot-3, Claude, agy, and any other agent.

## Simulation lives in Rust

All simulation lives in the Rust crate `rust/boreal-sim`. TypeScript and Three.js only draw, and they handle input.

Simulation means animal drives, hunger and energy, behavior, steering and following, separation, senses, predator and prey, growth, time and season and sun, and terrain and biome generation.

- New simulation is written in Rust and called from TypeScript through the wasm exports. It is not written in TypeScript.
- TypeScript files that already contain simulation are listed in `tests/sim-home-ceiling.json`. Those files may only shrink, never grow. `tests/sim-home.test.ts` fails the build when one of them grows, and when a new simulation file appears outside Rust.
- New TypeScript is allowed in the draw and input directories: `src/render`, `src/input`, `src/ui`, `src/audio`, `src/photo`, `src/vr`, `src/camera`, `src/dev`, `src/config`, `src/data`, plus `src/main.ts` and `src/audio.ts`.
- Gamepad, mouse, and keyboard controls and their hints stay. This rule does not remove or replace them.

The same rule is the first section of `PROJECT-RULES.md`.
