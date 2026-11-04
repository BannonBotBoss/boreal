//! Cycle number ↔ cosmic time. One function, used by the panel and the tests.
//!
//! Matthew: 0 is nothing (no time has passed). 1 cycle is one Planck time, the instant of expansion.
//! Larger cycles walk a powers-of-ten axis: each extra cycle multiplies the time by ten.
//! Negative cycles are the same size of time before the expansion, and are outside the model.
//!
//! t(c) = 0                         if c = 0
//! t(c) = sign(c) · t_P · 10^(|c|−1) otherwise
//! t_P = 5.39×10⁻⁴⁴ s (the round figure used in the panel; CODATA 2022 is 5.391247×10⁻⁴⁴ s).

pub const PLANCK_S: f64 = 5.39e-44;
pub const YEAR_S: f64 = 365.25 * 86400.0;

/// Seconds from the expansion, for a cycle number. Does not clamp.
pub fn cycle_to_seconds(cycle: f64) -> f64 {
    if !cycle.is_finite() {
        return f64::NAN;
    }
    if cycle == 0.0 {
        return 0.0;
    }
    let mag = PLANCK_S * 10f64.powf(cycle.abs() - 1.0);
    if cycle < 0.0 { -mag } else { mag }
}

/// Inverse of [`cycle_to_seconds`]. 0 maps to 0. Non-finite input stays non-finite.
pub fn seconds_to_cycle(seconds: f64) -> f64 {
    if !seconds.is_finite() {
        return f64::NAN;
    }
    if seconds == 0.0 {
        return 0.0;
    }
    let c = seconds.abs().log10() - PLANCK_S.log10() + 1.0;
    if seconds < 0.0 { -c } else { c }
}

/// Era name from clock time alone. The spacetime engine also names the era from its own state.
pub fn era_of_seconds(seconds: f64) -> &'static str {
    if !seconds.is_finite() {
        return "outside model";
    }
    if seconds < 0.0 {
        return "outside model — before the expansion";
    }
    if seconds == 0.0 {
        return "nothing — no time has passed";
    }
    const YEAR: f64 = YEAR_S;
    if seconds <= 1e-43 {
        return "Planck";
    }
    if seconds < 1e-36 {
        return "early universe, after the Planck time";
    }
    if seconds <= 1e-32 {
        return "inflation";
    }
    if seconds < 1e-12 {
        return "electroweak";
    }
    if seconds < 1.0 {
        return "quark";
    }
    if seconds <= 20.0 * 60.0 {
        return "nucleosynthesis";
    }
    if seconds < 2.0e5 * YEAR {
        return "radiation era";
    }
    if seconds < 1.0e6 * YEAR {
        return "recombination";
    }
    if seconds < 1.0e8 * YEAR {
        return "dark ages";
    }
    if seconds < 1.0e9 * YEAR {
        return "first stars and galaxies";
    }
    let earth = 9.2e9 * YEAR;
    let today = 13.8e9 * YEAR;
    if seconds < earth {
        return "galaxies, before the Sun and Earth";
    }
    if (seconds - today).abs() < YEAR {
        return "today";
    }
    if seconds < today {
        return "Sun and Earth";
    }
    "planet time — seasons and days"
}

pub fn seconds_to_years(seconds: f64) -> f64 {
    seconds / YEAR_S
}

/// Day of year (1–365) and hour at a cosmic time after the Earth exists. Before that, both are NaN.
pub fn planet_clock(seconds: f64) -> (f64, f64) {
    let earth = 9.2e9 * YEAR_S;
    if !(seconds >= earth) {
        return (f64::NAN, f64::NAN);
    }
    let age = seconds - earth;
    let day = (age / 86400.0).rem_euclid(365.0) + 1.0;
    let hour = (age / 3600.0).rem_euclid(24.0);
    (day, hour)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_is_zero() {
        assert_eq!(cycle_to_seconds(0.0), 0.0);
        assert_eq!(seconds_to_cycle(0.0), 0.0);
    }

    #[test]
    fn one_is_the_planck_time() {
        assert_eq!(cycle_to_seconds(1.0), PLANCK_S);
    }

    #[test]
    fn monotonic_on_each_side_of_zero() {
        let mut prev = cycle_to_seconds(-5.0);
        for i in 0..40 {
            let c = -5.0 + i as f64 * 0.25;
            let t = cycle_to_seconds(c);
            assert!(t >= prev, "{c}");
            prev = t;
        }
        assert!(cycle_to_seconds(-0.1) < 0.0);
        assert!(cycle_to_seconds(0.1) > 0.0);
    }

    #[test]
    fn round_trips() {
        for c in [0.0, 1.0, 1.5, 2.0, 10.0, 44.2, 60.0, 61.5, -1.0, -3.25, 1e-3] {
            let back = seconds_to_cycle(cycle_to_seconds(c));
            assert!((back - c).abs() < 1e-9, "{c} -> {back}");
        }
    }

    #[test]
    fn negative_is_not_clamped() {
        let t = cycle_to_seconds(-2.0);
        assert!(t < 0.0 && t.is_finite());
        assert_eq!(era_of_seconds(t), "outside model — before the expansion");
    }

    #[test]
    fn named_eras() {
        assert_eq!(era_of_seconds(0.0), "nothing — no time has passed");
        assert_eq!(era_of_seconds(PLANCK_S), "Planck");
        assert_eq!(era_of_seconds(1e-34), "inflation");
        assert_eq!(era_of_seconds(10.0), "nucleosynthesis");
        assert_eq!(era_of_seconds(380_000.0 * YEAR_S), "recombination");
        assert_eq!(era_of_seconds(9.2e9 * YEAR_S), "Sun and Earth");
        assert_eq!(era_of_seconds(13.8e9 * YEAR_S), "today");
    }
}
