# Boreal exploration game — research and foundation

Research date: 2026-09-24. Status: research/design only; no playable build or downloaded assets yet.

## User requirements

3D bird's-eye exploration using an Xbox controller. North America in the 1400s, before European settlement in the chosen region. Canadian Shield and boreal landscape with rivers, lakes, rock outcrops, cliffs and wetlands. Adjustable camera altitude and multiple model resolutions. Indigenous warrior player; medicine and pelt gathering; village-to-village barter; wigwam building, canoe construction, fishing, hunting, tool acquisition and repair. Cartoon art initially. Sound library from the first playable build. Develop incrementally while preserving a working game and existing saves.

Required wildlife: moose, deer, rabbit, eagle, hawk, black bear, badger. Every object must be indexed with title, purpose, visual description, separate model files by resolution, parent group, type, animation status, sound, interactions and affected values, and categories including inventory.

Unresolved: specific region and nation; final sentence about skills/memories was cut off. No cultural identity has been selected on the user's behalf.

## Verified resource shortlist

| Resource | Use | Evidence and remaining work |
|---|---|---|
| [Red Blob drainage exploration](https://www.redblobgames.com/x/1723-procedural-river-growing/) | Design connected drainage and derive compatible elevation | Author describes drainage-first terrain and designer constraints. Adapt concepts to our grid. |
| [Mapgen4 source](https://github.com/redblobgames/mapgen4) | Elevation, rainfall, rivers, worker separation | Apache-2.0 for author's code; dependencies have their own licenses. A reference implementation, not a ready-made 3D game. |
| [Three.js LOD](https://threejs.org/docs/pages/LOD.html) | Near/mid/far model switching | Distance-based LOD and hysteresis documented. Screen-size and chunk policies still need implementation. |
| [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html) | Repeated trees and rocks | Reduces draw calls for shared geometry/materials. Keep persistent entity IDs independent of render instance indices. |
| [MDN Gamepad](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad) | Xbox controller axes/buttons | Features vary by controller/platform. Hardware validation remains required. |
| [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | Prototype trees, rocks and foliage | Publisher lists 330 files, 3D, CC0. No assumption that these are 330 unique models or include our LOD variants. |
| [Quaternius Ultimate Animated Animal Pack](https://quaternius.com/packs/ultimateanimatedanimals.html) | Animated wildlife starting point | Publisher lists 12 animals, more than 12 animations each, CC0, glTF/Blend/FBX/OBJ. Catalog tags include deer/stag. Exact archive contents, clip quality and LODs not inspected. |
| [Freesound license FAQ](https://freesound.org/help/faq/) | Candidate environment, animal and action recordings | File-specific licenses vary. Prefer CC0 or CC BY; retain source/author/license with every admitted file. No recordings selected yet. |
| [NRCan forest classification](https://natural-resources.canada.ca/forests-forestry/sustainable-forest-management/forest-classification) | Boreal vegetation palette | Includes spruce, balsam fir, jack pine, white birch, aspen, tamarack and willow. Modern ecological reference, not proof of local 1400s distribution. |
| [NRCan boreal zone resources](https://natural-resources.canada.ca/forests-forestry/sustainable-forest-management/boreal-forest) | Regional reference maps/shapefiles | Guide biome boundaries; do not import modern settlements or assume historical accuracy. |
| [Canadian Canoe Museum](https://canoemuseum.ca/) | Canoe craft reference and research leads | Collection and Indigenous artisan work; specific designs need region/date research. |
| [Parks Canada: Mi'kmaw birchbark canoes](https://www.parcs.canada.ca/pn-np/ns/kejimkujik/culture/autochtone-indigenous/canot-canoe) | Nation-specific construction reference | A useful example of why traditions must be attributed specifically; not evidence for all Shield nations. |
| [Ontario badger recovery strategy](https://www.ontario.ca/page/american-badger-recovery-strategy) | Habitat placement | Badgers favor open grassland and related habitats. Include an appropriate transition habitat rather than distribute them across dense wet forest. Modern reference, not a historical range reconstruction. |

Asset gaps: moose, rabbit/hare, eagle, hawk, black bear and badger need individually verified models or original production. Deer is a candidate, not an imported/validated asset. Every model needs consistent scale, pivots, animation inspection and separate LOD exports. Eagle/hawk species and rabbit versus hare depend on the region.

## Proposed architecture

Default proposal: local browser game using TypeScript, Vite and vanilla Three.js, GLB shipping models, controller-first DOM menus. This is a proposal, not a user-selected engine. A Windows executable can be assessed after the playable foundation.

Use meters, Y-up, consistent model forward direction, fixed simulation ticks with interpolated rendering, and a seeded/versioned generator. Keep simulation, renderer, input, audio, UI, content registry and persistence separate.

Generate a bounded first region: proposed 1 km square, 64 m streaming chunks with partial edge chunks. Use a coarse world grid for elevation/geology/drainage and finer local samples for terrain. Resolve hydrology globally before subdividing into chunks. Adjacent chunks sample identical border coordinates; stitch terrain LOD edges. Generation must not depend on chunk load order.

Generation order: seed and region constraints; Shield bedrock/elevation; drainage/lake basins/outlets; wetlands and soil moisture; slope and cliff masks; vegetation; habitat-weighted wildlife; villages and connected foot/canoe/portage routes; resource distribution; reachability checks. Preserve real depressions selected as lakes while routing their spill outlets. The Canadian Shield is a geological region/layer, not a single rock object.

Use cartoon silhouettes, limited shared materials and species-readable shapes. Tree density should form patches and openings. Maintain passable routes without requiring vegetation to form a visible tiled grid.

Camera proposal: roughly 12–300 m altitude, orbit/tilt limits, smooth follow and manual survey mode. Model LOD0/LOD1/LOD2 use different GLB files. Terrain uses separately generated mesh resolutions cached per chunk. At very high altitude, aggregate forest canopy and reduce individual detail. Switch based on projected size where useful, with hysteresis. Camera zoom must never reset harvested plants, repair tools, respawn animals or change gameplay state.

## Object contract

Definitions and instances are separate. A definition describes a species or tool. Ordinary generated trees have temporary runtime handles and are forgotten when their area is released. A tree receives a durable identity only when a registered event requires that particular tree. Persistent gameplay objects such as owned tools retain durable IDs. Render indices are never save IDs.

Required definition fields:

- `id`, `schemaVersion`, `title`, `purpose`, `visualDescription`.
- `parentGroup`, `objectType`, `categories`, `tags`.
- `motionType`: static or animated; animation clip/action mapping separately recorded.
- `models`: separate `lod0`, `lod1`, `lod2` paths; bounds, scale and collision proxy.
- `audio`: event-to-sound-ID map or explicit null for silent objects.
- `interactions`: null or action definitions with conditions, duration, animation, sound and state effects.
- `inventory`: null or weight, stack limit, durability and applicable categories.
- `spawnRules`: biome, slope, moisture, density, spacing and season constraints.
- `provenance`: author, source URL, license, acquisition date and modification record.
- `status`: planned, placeholder, verified or shipped. Planned paths must not imply existing files.

Required live instance fields: runtime handle, definition ID, parent instance/chunk ID and transform, plus applicable gameplay state. Event-retained instances additionally carry a stable instance ID, event references, recorded state and save revision. Ordinary scenery instances have no per-instance save record.

## Tree generation and event persistence — user correction, 2026-09-24

Scope clarification: the user applies this rule to ALL static objects suitable for random existence, not just trees. The tree examples below describe the general scenery lifecycle. Suitable candidates include loose rocks, shrubs, decorative plants, fallen branches, fallen logs and ground debris. Each definition must declare its persistence policy: procedural scenery, event-retained instance, or persistent landmark/gameplay object. Suitability is explicit per definition; being static alone does not imply random placement.

Ordinary procedural static scenery is generated on demand from terrain-conditioned randomness and discarded when its area unloads, without per-instance save records. Its indexed definition remains available. Applicable event records override background generation and retain the identity, placement and state of specific objects as needed. The proposed spatially seeded default reconstructs scenery without storing instances; active scenery stays stable through camera movement and LOD changes.

Fixed geography, village layouts, established structures and other objects whose continuity is required are governed by their world or gameplay records. Their placement may be procedural initially without being freely re-randomized. Collecting, moving, damaging, consuming or building with a scenery object must register any lasting consequence before unloading, including removal/depletion records where needed to prevent duplicate resources. The subsequent user clarification below extends the transient-instance rule to animals and individual people as well.

## Animals, people and capability-based interactions — user rule, 2026-09-24

The on-demand generation and forgetting rule also applies to animals and individual people. They have temporary runtime state while active, including movement and behavior, but acquire persistent individual records only when an interaction occurs. Merely encountering, seeing, highlighting or selecting an individual does not serialize it. Applicable records from previous interactions govern restoration when its area is needed again. Shared species/character definitions stay indexed independently of individual persistence.

Required example: when the player encounters an animal, compare the animal's supported interaction methods with the player's abilities. If both support `speak` and its current conditions are satisfied, refresh the actionable list and show the text hint `speak`. A subtle glow around the animal is an optional affordance. Do not infer that every animal supports speech; support is supplied by the animal definition and the player's abilities.

Action availability = target-supported methods intersected with player abilities, filtered by current conditions such as range and target state. Refresh when the target, proximity, abilities or relevant conditions change. Remove stale hints when the target leaves range or the action becomes unavailable. Recheck conditions when the action is invoked.

On a successful interaction, apply its defined value changes (for example, friend count), assign a persistent identity if needed, and serialize the individual's relevant data into the events context together with the interaction and its outcome. This must be one logical committed transaction so reloading or retrying cannot duplicate the effect. A repeated conversation must not add the same friend again; a friendship counter changes when the relationship is newly established, according to the action's rules.

Proposed event-context payload: event ID, time, action ID, player ID, target persistent ID, target definition ID/version, location and orientation, relevant appearance/behavior reconstruction data, relationship state, relevant health/inventory state, and recorded effects. Serialize plain data, not executable methods, animation mixers or renderer objects. Resolve methods and models from the indexed definition when restoring the individual. Restore recorded outcomes without replaying their rewards. Exact payload/schema remains an implementation task.

Validation additions: encountering a compatible animal reveals `speak` without creating a persistent record; incompatible abilities reveal no such action; an invoked successful action updates the intended value and records the target exactly once; save/load restores the same individual and relationship; repeated speech or event restoration does not inflate friend count. Use the same availability and persistence pipeline for individual people.

The trailing text `kmmmqooq` has no assigned design meaning; the explicit interaction rule above is preserved without interpreting it.

Ordinary trees spawn procedurally when an area is needed and are completely forgotten when released. No background simulation of individual unseen trees falling is required. A newly visited forest can contain standing trees, fallen trunks and stumps generated as scenery without a history of how each arrived there.

A registered event can retain a particular tree. When the event's tree condition is true and the relevant area is demanded by the view, generation must include that tree with the recorded identity, location and state. Merely looking at an ordinary tree does not make it persistent. The shared indexed tree definition still supplies its title, purpose, visuals, LOD files, sounds and interaction rules.

Proposed implementation: query spatially indexed applicable event records before scattering ordinary trees; reserve their occupied areas; generate background vegetation around them; materialize retained trees at the required visual detail. Recorded removals suppress conflicting background placement rather than recreating the removed tree. Check conditions from event/game state, not from whether a render mesh currently exists. Apply overlapping events in a defined order and include each retained identity only once.

Proposed lifecycle safeguard: keep generated scenery stable while its area is active, including a small camera margin. Changing LOD or briefly looking away must not reshuffle trees beside the player. Release ordinary instance data when the area is actually unloaded. A gameplay interaction that requires continuity registers its event before the temporary tree can be released. Persistent depletion/removal records prevent unloading from undoing a player action.

Retain a tree record while a quest, construction, depletion rule or other continuing consequence needs it. When no continuing condition needs it, its instance can return to ordinary generation; event history may remain if required by other gameplay. Exact event condition and expiry rules are still to be specified.

User clarification: otherwise, world generation follows "a random equation of sorts." Ordinary vegetation therefore uses rule-based procedural randomness, constrained by habitat and overridden by applicable event records.

Proposed default equation: for each candidate location, spawn a tree when a reproducible pseudorandom value derived from world seed, cell coordinates and candidate index is below a probability determined by biome, soil moisture, slope, spacing and forest patch density. Use separate random samples for species, size, orientation and standing/fallen/dead state. Exclude water, reserved routes and event-owned footprints before placement. Parameters and probabilities are design values to tune, not researched ecological measurements.

Default proposal: seed randomness by location so revisiting reconstructs a familiar forest without retaining individual tree data. This is an implementation recommendation, not an explicit user requirement for identical revisits. If later requested, a region/time epoch can vary background vegetation when an area is unloaded; active scenes and event-required objects remain stable. Stable underlying terrain and hydrology remain the current proposal.

Validation additions: ordinary trees leave no per-instance save records; generated fallen scenery requires no simulated fall; a true event condition restores its tree once at the correct location/state; false conditions do not force it into the scene; recorded removals are respected; LOD changes preserve active instances; save/load preserves applicable events without storing the entire forest.

Interactions are authoritative transactions. Example: gathering a fictional medicine plant checks range, availability and inventory capacity; plays a gather animation and rustle; adds one item and marks the plant harvested exactly once. Consuming that item is a separate interaction affecting health. Animation cancellation cannot duplicate rewards. Barter checks both inventories and commits all transfers together. Repair consumes specified materials and raises durability up to a cap.

Static does not mean non-interactive: a plant may be stationary and harvestable. Animated does not mean collectible: an eagle may only be observed. Values and effects live in simulation, not animation callbacks.

## Sound library from first playable

Sound events: forest wind, shoreline lap, stream loop, ground/rock/shallow-water footsteps, foliage gathering, inventory selection, trade completion, bow draw/release, impact, wood working, paddle stroke and wildlife calls. Start with original temporary effects or individually verified recordings; mark placeholders clearly. Species calls must be identified rather than reused indiscriminately.

Each audio entry records ID, title, event, source, author, license, master and runtime paths, duration, looping boundaries, gain, spatial range, variants and status. Preserve lossless masters; derive runtime encodings. Provide music/ambience/effects volume controls, sound activation on initial user gesture, voice limits and distance attenuation. Associate listening with the player so zooming out does not mute the world unintentionally.

## Input proposal

Left stick move; right stick orbit; triggers camera altitude; A interact/confirm; B cancel; X equipped tool; Y inventory; bumpers cycle tools; Menu pause. All menus must be usable without a mouse. Remap actions centrally, with dead zones and sensitivity settings. Pause on controller disconnection; support reconnect. Keyboard/mouse fallback helps development but is not evidence of Xbox hardware compatibility.

## First playable acceptance target

One stable seeded region, two villages, a lake/river route, cliffs/outcrops/wetlands, simple animated wildlife, medicine gathering, inventory, barter, one repair recipe, sound from the start, adjustable camera and genuine model LODs. A ten-minute loop: leave village, gather, encounter wildlife, reach second village, trade, repair, save and resume. Add hunting/fishing, then canoe construction/travel, then wigwam construction and broader progression in subsequent working increments. All requested animals remain on the backlog even when only a subset ships first.

Proposed failure state: exhaustion/incapacitation returns the player to a known camp with a clearly specified limited cost; tune with the user. Craft skills unlock through learn/practice/use steps; don't invent culturally specific teachings before the setting is chosen. Medicine effects are fictional gameplay values until researched, not real treatment instructions.

## Persistence and continuing work

Persist seed, generator version, content version, player position/stats, inventories, tool condition, learned recipes, village stock, discovered places, time and interaction/event-required world state. Do not save individual instances of ordinary procedural scenery or animals and people that have had no interaction. Use local durable browser storage plus explicit export/import and backups. Keep generated base data separate from recorded consequences. Pin generator versions for existing saves and migrate deliberately; never silently replace an existing world's terrain after an update. Location-seeded reconstruction is the proposed default for ordinary scenery as specified above.

Maintain this document as the requirement/research record; add decision log, content registry, sound registry, save-format document and playtest log during implementation. Distinguish player craft skills from development instructions. Do not claim a persistent assistant memory or custom skill exists merely because this project document exists.

Validation gates: same seed/version reproduces terrain; rivers/lakes match across chunk borders; foot/canoe routes are reachable; every shipped definition resolves its LOD and sound files; zooming preserves state; gather/trade/repair cannot duplicate items; save round-trip preserves changes; all menus work with Xbox controller on the user's machine; audio responds correctly to pause/volume; frame timings are measured at low and high altitude. Proposed target is 60 fps, subject to actual hardware measurement.

## Next implementation step

Build the controller-driven world exploration slice with registry validation, terrain, real LOD assets, audio events and save/export before expanding content. Historical specificity remains provisional pending region/nation selection. This research deliverable does not claim a playable state has already been achieved.
