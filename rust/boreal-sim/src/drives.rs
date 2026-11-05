//! Animal drives for one carnivore near a mother and her young.
//!
//! Reused, not rebuilt: `perception.rs` already names hunger, feed_drive, safety_drive,
//! scent, sight and hearing as fields on the perception packet. `animals.rs` and
//! `litter.rs` already know which young belong to which mother. This file does not
//! change that packet or that kinship.
//!
//! New, because the packet stores the names and not the rates: a shared hunger rate,
//! a hand-set diet, prey effort, the smell/sight/hearing radii, the danger balance,
//! and the protect drive that overrides the others once it commits.
//!
//! The same numbers are in src/core/drives.ts. A caller passes whoever is standing
//! there. Nothing here is a staged scene.

/// Hunger added per second. Hand-set. A fox burns through a meal faster than a wolf.
pub fn hunger_rate(species: &str) -> f64 {
    match species {
        "Red Fox" => 0.012,
        "Gray Wolf" => 0.006,
        "Snowshoe Hare" => 0.02,
        _ => 0.008,
    }
}

/// Hand-set diet. The fox is a carnivore. This is part of the hunger engine, not its own engine.
pub fn diet(species: &str) -> &'static str {
    match species {
        "Red Fox" | "Gray Wolf" | "Canada Lynx" | "Coyote" => "carnivore",
        "Snowshoe Hare" | "White-tailed Deer" | "Moose" => "herbivore",
        _ => "omnivore",
    }
}

pub fn body_kg(species: &str) -> f64 {
    match species {
        "Red Fox" => 5.0,
        "Gray Wolf" => 40.0,
        "pup" => 2.5,
        _ => 10.0,
    }
}

/// Effort of catching this prey. Quadratic while the prey is smaller than the
/// predator, then exponential once the prey is larger.
pub fn effort(pred_kg: f64, prey_kg: f64) -> f64 {
    let r = prey_kg / pred_kg.max(0.1);
    if r <= 1.0 { r * r } else { (4.0 * (r - 1.0)).exp() }
}

pub const SMELL_M: f64 = 40.0;
pub const SIGHT_M: f64 = 16.0;
pub const HEARING_M: f64 = 20.0;
pub const YIP_HEARING: f64 = 1.5;
pub const DANGER_M: f64 = 8.0;
pub const DANGER_PROTECT_M: f64 = 18.0;
pub const PROTECT_M: f64 = 12.0;
pub const STRAY_M: f64 = 6.0;
/// Protect rises while a threat stays inside PROTECT_M, and falls once it leaves.
pub const PROTECT_RISE: f64 = 0.22;
pub const PROTECT_FALL: f64 = 0.25;
/// At this value the mother overrides her other drives and the danger radius widens.
pub const PROTECT_COMMIT: f64 = 0.5;
/// He waits here, outside the 8 m danger disc.
pub const LINGER_RING: f64 = 11.0;
pub const FLEE_MPS: f64 = 9.0;

pub fn hunger_step(hunger: f64, species: &str, dt: f64) -> f64 {
    (hunger + hunger_rate(species) * dt.max(0.0)).clamp(0.0, 1.0)
}

pub fn protect_step(protect: f64, near: bool, dt: f64) -> f64 {
    let rate = if near { PROTECT_RISE } else { -PROTECT_FALL };
    (protect + rate * dt.max(0.0)).clamp(0.0, 1.0)
}

pub fn committed(protect: f64) -> bool { protect >= PROTECT_COMMIT }

/// Scent falls off with distance. Smell is the long sense.
pub fn scent(dist_m: f64) -> f64 {
    (-dist_m.max(0.0) / SMELL_M).exp()
}

/// A pup inside sight, or inside hearing (longer while it yips), is in focus.
pub fn in_focus(dist_m: f64, yipping: bool) -> bool {
    let hear = if yipping { HEARING_M * YIP_HEARING } else { HEARING_M };
    dist_m <= SIGHT_M || dist_m <= hear
}

pub fn danger(dist_mama_m: f64, protecting: bool) -> f64 {
    let radius = if protecting { DANGER_PROTECT_M } else { DANGER_M };
    if dist_mama_m > radius * 2.5 { 0.0 } else { (-dist_mama_m / radius).exp() }
}

/// Hunger pulls toward the chosen prey. Effort and a weak scent shrink the pull.
pub fn approach(hunger: f64, effort: f64, scent: f64) -> f64 {
    hunger.max(0.0) / (effort + 0.05) * scent.max(0.0)
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum FoxMode { None, Approach, Linger, Watch, Flee }

pub struct DriveNow {
    pub hunger: f64,
    pub effort_pup: f64,
    pub effort_mama: f64,
    pub scent: f64,
    pub danger: f64,
    pub protect: f64,
    pub threat: f64,
    pub approach: f64,
    pub mode: FoxMode,
    pub fox_x: f64,
    pub fox_z: f64,
    pub fox_yaw: f64,
    pub mama_x: f64,
    pub mama_z: f64,
    pub mama_yaw: f64,
}

fn hypot(x: f64, z: f64) -> f64 { (x * x + z * z).sqrt() }

/// One step of the fox and, once protect has committed, where the mother steps.
/// `pup` is the nearest pup. `yip` is whether a pup is calling. `protect` is the
/// value from the previous step.
pub fn step(
    hunger: f64, fox_x: f64, fox_z: f64, fox_yaw: f64,
    mama_x: f64, mama_z: f64, mama_yaw: f64,
    pup_x: f64, pup_z: f64, yip: bool, protect: f64, dt: f64,
) -> DriveNow {
    let _ = fox_yaw;
    let hunger = hunger_step(hunger, "Red Fox", dt);
    let pup_d = hypot(pup_x - fox_x, pup_z - fox_z);
    let mama_d = hypot(mama_x - fox_x, mama_z - fox_z);
    let pup_from_mama = hypot(pup_x - mama_x, pup_z - mama_z);
    let scent = scent(pup_d);
    let focused = in_focus(pup_d, yip);
    let effort_pup = effort(body_kg("Red Fox"), body_kg("pup"));
    let effort_mama = effort(body_kg("Red Fox"), body_kg("Gray Wolf"));
    let stray = pup_from_mama > STRAY_M;
    let near = mama_d < PROTECT_M || pup_d < PROTECT_M;
    let protect = protect_step(protect, near, dt);
    let guarding = committed(protect);
    let danger = danger(mama_d, guarding);
    let use_effort = if stray { effort_pup } else { effort_pup.max(0.35) };
    let approach = approach(hunger, use_effort, if focused { scent.max(0.35) } else { scent });
    let (mode, nx, nz, yaw, mx, mz, myaw) = if guarding {
        let face = toward(mama_x, mama_z, fox_x, fox_z);
        let (fx, fz) = push_out(fox_x, fox_z, mama_x, mama_z, mama_d + FLEE_MPS * dt.max(0.0));
        let room = (mama_d - 1.5).max(0.0);
        let (sx, sz) = forward(mama_x, mama_z, face, (3.4 * dt.max(0.0)).min(room));
        (FoxMode::Flee, fx, fz, away(fox_x, fox_z, mama_x, mama_z), sx, sz, face)
    } else if approach > danger && (focused || scent > 0.15) && stray && mama_d > LINGER_RING {
        let yaw = toward(fox_x, fox_z, pup_x, pup_z);
        let (fx, fz) = forward(fox_x, fox_z, yaw, (1.1 + hunger) * dt.max(0.0));
        (FoxMode::Approach, fx, fz, yaw, mama_x, mama_z, mama_yaw)
    } else if mama_d < LINGER_RING - 0.4 {
        let (fx, fz) = push_out(fox_x, fox_z, mama_x, mama_z, LINGER_RING);
        (FoxMode::Linger, fx, fz, toward(fx, fz, mama_x, mama_z), mama_x, mama_z, mama_yaw)
    } else if mama_d > LINGER_RING + 1.2 {
        let dist = (mama_d - 4.0 * dt.max(0.0)).max(LINGER_RING);
        let (fx, fz) = push_out(fox_x, fox_z, mama_x, mama_z, dist);
        (FoxMode::Watch, fx, fz, toward(fx, fz, mama_x, mama_z), mama_x, mama_z, mama_yaw)
    } else {
        let yaw = tangent(fox_x, fox_z, mama_x, mama_z);
        let (fx, fz) = forward(fox_x, fox_z, yaw, 0.8 * dt.max(0.0));
        let placed = push_out(fx, fz, mama_x, mama_z, LINGER_RING);
        (FoxMode::Linger, placed.0, placed.1, yaw, mama_x, mama_z, mama_yaw)
    };
    DriveNow {
        hunger, effort_pup, effort_mama, scent, danger, protect,
        threat: if near { 1.0 } else { 0.0 },
        approach, mode,
        fox_x: nx, fox_z: nz, fox_yaw: yaw, mama_x: mx, mama_z: mz, mama_yaw: myaw,
    }
}

fn toward(x: f64, z: f64, tx: f64, tz: f64) -> f64 { (tx - x).atan2(tz - z) }
fn away(x: f64, z: f64, tx: f64, tz: f64) -> f64 { toward(x, z, tx, tz) + std::f64::consts::PI }
fn tangent(x: f64, z: f64, tx: f64, tz: f64) -> f64 { toward(x, z, tx, tz) + std::f64::consts::FRAC_PI_2 }
fn push_out(fox_x: f64, fox_z: f64, mama_x: f64, mama_z: f64, dist: f64) -> (f64, f64) {
    let mut dx = fox_x - mama_x;
    let mut dz = fox_z - mama_z;
    let d = hypot(dx, dz);
    if d < 1e-4 { dx = 1.0; dz = 0.0; } else { dx /= d; dz /= d; }
    (mama_x + dx * dist, mama_z + dz * dist)
}

fn forward(x: f64, z: f64, yaw: f64, dist: f64) -> (f64, f64) {
    (x + yaw.sin() * dist, z + yaw.cos() * dist)
}

pub fn mode_name(mode: FoxMode) -> &'static str {
    match mode {
        FoxMode::None => "none",
        FoxMode::Approach => "approach",
        FoxMode::Linger => "linger",
        FoxMode::Watch => "watch",
        FoxMode::Flee => "flee",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fox_is_a_carnivore_and_a_hare_is_not() {
        assert_eq!(diet("Red Fox"), "carnivore");
        assert_eq!(diet("Snowshoe Hare"), "herbivore");
        assert!(hunger_rate("Red Fox") > hunger_rate("Gray Wolf"));
    }

    #[test]
    fn a_pup_is_cheap_and_the_mama_is_not() {
        let pup = effort(body_kg("Red Fox"), body_kg("pup"));
        let mama = effort(body_kg("Red Fox"), body_kg("Gray Wolf"));
        assert!(pup < 0.4, "pup effort {pup}");
        assert!(mama > 100.0, "mama effort {mama}");
    }

    #[test]
    fn smell_reaches_farther_than_sight_and_a_yip_extends_hearing() {
        assert!(SMELL_M > SIGHT_M && SMELL_M > HEARING_M);
        assert!(scent(5.0) > scent(30.0));
        assert!(!in_focus(25.0, false));
        assert!(in_focus(25.0, true));
    }

    #[test]
    fn on_the_ring_the_fox_circles_until_she_commits() {
        let now = step(0.85, 9.5, 0.0, 0.0, 0.0, 0.0, 0.0, 1.2, 0.2, true, 0.0, 0.2);
        assert_eq!(now.mode, FoxMode::Linger);
        assert!(now.protect < PROTECT_COMMIT);
        assert!(!committed(now.protect));
        assert!((now.mama_x - 0.0).abs() < 1e-9, "she has not charged yet");
    }

    #[test]
    fn inside_the_ring_the_fox_backs_out_before_she_charges() {
        let now = step(0.8, 4.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.2, false, 0.0, 0.5);
        assert_eq!(now.mode, FoxMode::Linger);
        assert!(now.fox_x > 4.0, "backed away, fox x {}", now.fox_x);
        assert!(now.protect < PROTECT_COMMIT);
    }

    #[test]
    fn once_she_commits_the_radius_widens_and_the_fox_flees() {
        let now = step(0.8, 9.5, 0.0, 0.0, 0.0, 0.0, 0.0, 1.2, 0.2, true, 1.0, 0.2);
        assert_eq!(now.mode, FoxMode::Flee);
        assert!(now.fox_x > 9.5, "fled outward, fox x {}", now.fox_x);
        assert!(now.mama_x > 0.0, "she stepped toward the fox");
        assert!(now.danger > danger(9.5, false));
        assert_eq!(now.threat, 1.0);
    }

    #[test]
    fn a_stray_pup_is_worth_approaching_and_the_mother_is_not() {
        let now = step(0.9, 20.0, 0.0, 0.0, 0.0, 0.0, 0.0, 8.0, 0.0, true, 0.0, 0.2);
        assert_eq!(now.mode, FoxMode::Approach);
        assert!(now.effort_mama > now.effort_pup * 100.0);
    }

    #[test]
    fn a_fox_against_her_is_pushed_back_out() {
        let mut now = step(0.8, 0.05, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.3, false, 1.0, 1.0 / 30.0);
        for _ in 0..30 {
            now = step(now.hunger, now.fox_x, now.fox_z, now.fox_yaw, now.mama_x, now.mama_z, now.mama_yaw, now.mama_x + 0.2, now.mama_z + 0.3, false, now.protect, 1.0 / 30.0);
        }
        let dist = hypot(now.fox_x - now.mama_x, now.fox_z - now.mama_z);
        assert!(dist > 1.5, "still against her at {dist}");
    }

    #[test]
    fn smell_leads_when_nothing_is_in_focus() {
        let now = step(0.8, 28.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.2, false, 0.0, 0.2);
        assert_eq!(now.mode, FoxMode::Watch);
        assert!(now.scent > 0.05);
        assert!(!in_focus(28.0, false));
    }
}
