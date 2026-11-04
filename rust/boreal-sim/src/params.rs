//! Editable engine inputs. While the store is inactive, every read returns the caller's
//! constant, so the game's default numbers do not move. The panel activates the store
//! only for a scratch evaluation.

use std::cell::{Cell, RefCell};
use std::collections::BTreeMap;

thread_local! {
    static ACTIVE: Cell<bool> = const { Cell::new(false) };
    static MAP: RefCell<BTreeMap<String, f64>> = RefCell::new(BTreeMap::new());
}

/// The value the panel set, or `default` when the store is off or has no entry.
#[inline]
pub fn get(key: &str, default: f64) -> f64 {
    if !ACTIVE.with(|a| a.get()) {
        return default;
    }
    MAP.with(|m| m.borrow().get(key).copied().unwrap_or(default))
}

pub struct Guard {
    prev_active: bool,
    prev: BTreeMap<String, f64>,
}

impl Drop for Guard {
    fn drop(&mut self) {
        ACTIVE.with(|a| a.set(self.prev_active));
        let prev = std::mem::take(&mut self.prev);
        MAP.with(|m| *m.borrow_mut() = prev);
    }
}

/// Turn the store on for the current thread. Restores the previous store when dropped.
pub fn activate(values: BTreeMap<String, f64>) -> Guard {
    let prev_active = ACTIVE.with(|a| a.replace(true));
    let prev = MAP.with(|m| std::mem::replace(&mut *m.borrow_mut(), values));
    Guard { prev_active, prev }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn inactive_store_returns_the_constant() {
        assert_eq!(get("solar_constant", 1361.0), 1361.0);
    }

    #[test]
    fn active_store_overrides_and_then_restores() {
        {
            let mut m = BTreeMap::new();
            m.insert("solar_constant".into(), 2000.0);
            let _g = activate(m);
            assert_eq!(get("solar_constant", 1361.0), 2000.0);
            assert_eq!(get("lapse_rate", 0.0065), 0.0065);
        }
        assert_eq!(get("solar_constant", 1361.0), 1361.0);
    }
}
