//! Blank engine. Copy this file, rename the struct, and register it in `registry.rs`.
//! The panel picks it up from the registry. Do not add a second list in TypeScript.
//!
//! Spawn it from the parent that should create it:
//!   Rule { child: "my_engine", output: "some_output", above: 1.0, below: f64::INFINITY,
//!          cause: "why the number crossed the line", time_output: "" }

use std::collections::BTreeMap;
use crate::registry::{Engine, EqDef, Outcome, ParamDef, Rule, HEALTH_OK};

pub struct MyEngine;

impl Engine for MyEngine {
    fn id(&self) -> &'static str { "my_engine" }
    fn generates(&self) -> &'static str { "what a person would say this makes" }
    fn file(&self) -> &'static str { "rust/boreal-sim/src/my_engine.rs" }
    fn parameters(&self) -> &'static [ParamDef] { &[] }
    fn equations(&self) -> &'static [EqDef] { &[] }
    fn rules(&self) -> &'static [Rule] { &[] }
    fn evaluate(&self, _t: f64, _p: &BTreeMap<String, f64>) -> Outcome {
        Outcome { health: HEALTH_OK, reason: String::new(), vars: vec![], symbols: vec![], outputs: BTreeMap::new() }
    }
}
