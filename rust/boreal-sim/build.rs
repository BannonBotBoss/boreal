//! Birth dates of engine sources, from git, so the panel does not invent them.
use std::process::Command;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=build.rs");
    let manifest = Path::new(&std::env::var("CARGO_MANIFEST_DIR").unwrap()).join("../..");
    let files = [
        "rust/boreal-sim/src/cosmology.rs",
        "rust/boreal-sim/src/reheating.rs",
        "rust/boreal-sim/src/grid.rs",
        "rust/boreal-sim/src/planet_fundamentals/climate_seed.rs",
        "rust/boreal-sim/src/planet_fundamentals/energy/solar_budget.rs",
        "rust/boreal-sim/src/planet_fundamentals/energy/energy_update.rs",
        "rust/boreal-sim/src/planet_fundamentals/atmosphere/wind.rs",
        "rust/boreal-sim/src/planet_fundamentals/hydrosphere/precipitation.rs",
        "rust/boreal-sim/src/planet_fundamentals/atmosphere/cloud_fraction.rs",
        "rust/boreal-sim/src/cover.rs",
        "rust/boreal-sim/src/species.rs",
        "rust/boreal-sim/src/animals.rs",
        "rust/boreal-sim/src/perception.rs",
        "rust/boreal-sim/src/formation.rs",
        "rust/boreal-sim/src/differentiation.rs",
        "rust/boreal-sim/src/interior.rs",
        "rust/boreal-sim/src/gas.rs",
    ];
    let shallow = Command::new("git").args(["rev-parse", "--is-shallow-repository"]).current_dir(&manifest).output().ok().map(|o| String::from_utf8_lossy(&o.stdout).trim() == "true").unwrap_or(true);
    let mut arms = String::new();
    for f in files {
        let date = if shallow {
            "unknown".into()
        } else {
            let out = Command::new("git").args(["log", "--follow", "--format=%aI", "--", f]).current_dir(&manifest).output();
            match out {
                Ok(o) if o.status.success() => {
                    let text = String::from_utf8_lossy(&o.stdout);
                    text.lines().last().map(|s| s.get(..10).unwrap_or(s).to_string()).filter(|s| !s.is_empty()).unwrap_or_else(|| "uncommitted".into())
                }
                _ => "uncommitted".into(),
            }
        };
        arms.push_str(&format!("        \"{f}\" => \"{date}\",\n"));
    }
    let body = format!("pub fn born(file: &str) -> &'static str {{\n    match file {{\n{arms}        _ => \"unknown\",\n    }}\n}}\n");
    let dest = Path::new(&std::env::var("OUT_DIR").unwrap()).join("engine_born.rs");
    std::fs::write(dest, body).unwrap();
}
