//! Elevation is an input (T-0062, issue #46). The same `sampleSurface` call that writes the land mask
//! writes height. This file does not add a second noise planet.
pub use crate::grid::ELEV as ELEV_PLANE;
