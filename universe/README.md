# Boreal Universe

Separate app from the living forest game. It reuses **select** Boreal modules via the `@boreal/*` Vite alias (today: `proc/rng`). Cosmic time math mirrors `rust/boreal-sim/src/cosmic_time.rs`.

## Run

```bash
# from repo root (needs parent node_modules)
npm run --prefix universe dev
# → http://127.0.0.1:5174/
```

Windows (no console): double-click `Play Universe.vbs`, or run `Install Desktop Shortcut.vbs` once.

## Menu

**Generate universe** mints a seed and starts the time engine from cycle 0. Each Generate is a little different; laws stay fixed.

## What this is (v1 lab)

- Time engine on the Planck→years cycle axis
- Expanding space extent `R_space` drawn in Three.js (radius → 0 at t=0)
- Expansion ratio `ξ = R·H/c` with polarity split at `α★ = 1/137`
- Toggleable XYZ axes (minus triad appears after the split)
