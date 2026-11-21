# Reference Sources — T-0298 Live Hunting Carry, Pause Menu `More`, Rock/Herb Interactions & Chronometer/Photo Audit

1. **`ref-0-wolf-carrying-prey-above-ground.jpg`** (matches `frame-0-hunting-pin-carry.png` & `recording.webm`):
   - **Source**: Denali National Park and Preserve / U.S. National Park Service (`File:Wolf with Caribou Hindquarter.jpg`, Wikimedia Commons, Public Domain — reused from `refs/hunt/predator-prey-agent-audit/reference/ref-1-wolf-carrying-prey-in-jaws.jpg`).
   - **What it verifies**: A walking gray wolf (*Canis lupus*) carries prey elevated in its jaws above the ground surface (`y_prey ≈ y_ground + 0.55–0.85 m`, aligned with the wolf's head and heading), never buried `-1.85 m` underground beneath its paws (`hare.ts:387` omitting `heightAt(wolf.x, wolf.z)`) and never rolled sideways by `61.3°` via mismatched `'XYZ'` vs `'YXZ'` Euler rotation order (`hare.ts:388` vs `huntHold.ts:200`).

2. **`ref-1-boreal-forest-floor-cobbles-herbs.jpg`** (matches `frame-3-rock-herb-interactions.png`):
   - **Source**: Generated documentary nature reference (`image-generator`, 2026-11-20) of a sunlit Canadian Shield boreal forest floor with loose glacial granite pebbles/cobbles (`6–20 cm` diameter, Wentworth 1922 *J. Geol.* 30:377; Dredge & Cowan 1989 GSC Paper 89-18) alongside a bunchberry (*Cornus canadensis*) herb clump on spruce needle duff and feather moss.
   - **What it verifies**: Real Canadian Shield forest floors contain loose pushable surface cobbles (`<= 0.22 m`, not `0 / 56` due to disjoint inequalities in `rocks.ts:69–70` vs `rocks.ts:78`), and harvesting an entire herbaceous shoot removes the plant biomass until substantial seasonal regrowth (`>= 50–100%` of one shoot, not `0.0003%` after `0.43 s` awarding another full `+1` herb!).
