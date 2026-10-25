//! Land/sea mask is an input (T-0062, issue #46). `src/world/globe/planet.ts` `sampleSurface`
//! (Musgrave 1989 ridged multifractal plus fBm, land share 0.292, ETOPO1, Eakins & Sharman 2012)
//! is written through `PlanetSim.setLand`. This file does not generate a second mask.
pub use crate::grid::LAND as LAND_PLANE;
