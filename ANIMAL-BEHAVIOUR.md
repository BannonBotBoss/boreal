# Procedural animal behaviour

Current animals: deer and player wolf. Both have a head-sensor Object3D containing an AnimalBrain with a sense method. Observations use 3, 10 and 24 metre radii from the head's world position. Deer solve escape, avoidance, feeding, fatigue and exploration problems. Controller intentions enter the wolf's motion state.

Only deer within 40 metres of the player's ears advance behaviour, motion and energy, including behind the camera. Others freeze without catch-up costs. New entities receive 75 energy before mesh creation. Remembered animals retain their last interaction snapshot. Ordinary animals remain transient. Pause stops simulation.

Energy costs in gameplay units: 0.003 per second, 0.08 per metre walking/backing, 0.18 running, 0.22 jumping plus 1.5 at take-off. Actual displacement determines travel cost. Rest restores 1 per second. These are tunable game values, not biological measurements.

## Forage

Forage berry patches are procedurally scattered (22 candidates per chunk from their own seeded stream, land only). They are the only thing animals sense as food. An animal below 85 energy walks to the nearest patch, stops within 1 metre, and eats for 2 seconds; it then gains 18 energy and the patch is removed. Autonomous feeding does not create persistent animal records. For an unremembered animal, energy and depleted forage remain in loaded-chunk memory only. Animals already interacted with by the player may update their saved state. Practice herbs are neither food nor obstacles to animals.

Threat memory: a sensed threat is remembered for 3 seconds after leaving the senses. Without it, an animal at the 24-metre edge flips between fleeing and feeding every frame.

Animal roots are independent scene actors. Four hips and lower-leg joints share a phase controller. Legs (deer and wolf) are posed by procedural IK: each foot follows a computed path (planted during stance, arcing forward in swing), and an analytic two-bone solver finds the hip and knee angles that reach it. Front joints point forward (carpus), hind joints back (hock); wolf paws stay level.

Gait timing is research-based (dynamic similarity, Alexander 1976; Alexander & Jayes 1983). Froude number Fr = v²/(g·hip height) chooses the gait (walk below 0.5, trot to 2.5, gallop above) and stride length (2.3 × hip × Fr^0.3). Duty factors: walk 0.65, trot 0.45, gallop 0.3 falling to 0.2 at speed, which produces a second, gathered flight like a canid rotary gallop. Phase advances by distance ÷ stride, so planted feet never slide; when a stride would need more leg than the animal has, cadence rises instead. Backing up always walks.

The player wolf is real size (WOLF_SCALE 2: ~0.74 m shoulder, ears ~1 m); the camera stays at human eye height, 3 m behind. `tools/gait-sheet.html` renders each motion as a strip of still frames for review. Rear tail pivots remain attached, swing at most 0.09 radians and settle to rest. X/Space commands the player jump.

## Research

- [Interlimb coordination and speed-dependent gait expression](https://pmc.ncbi.nlm.nih.gov/articles/PMC5134391/): coordinated phases and speed-dependent gaits.
- [Dog muscles at walk, trot and gallop](https://journals.biologists.com/jeb/article/215/2/287/11087/Activity-of-extrinsic-limb-muscles-in-dogs-at-walk): distinct walking and running coordination.
- [Limb dynamics in dog jumps](https://journals.biologists.com/jeb/article/223/7/jeb202119/223704/Limb-dynamics-in-agility-jumps-of-beginner-and): hindlimb propulsion and forelimb landing stages.
- [Backward quadrupedal walking](https://pubmed.ncbi.nlm.nih.gov/2230922/): reciprocal swing and stance coordination. Reversing our stride trajectories is a stylized approximation.

This is cartoon procedural animation, not a musculoskeletal physics model. Deer share the quadruped controller rather than species-specific biomechanics. Avoidance is local, not full pathfinding. Earshot uses distance, not acoustic propagation.

## World generation

Everything in the world comes from the world seed. There are no hand-placed individuals or objects; the player starts at the origin.

## Terrain

Non-movable rocks have their vertical midpoint at ground level; movable rocks remain surface-seated. Triangular depression cells have three neighbouring sides. Branching formations contain 1–12 cells, favouring middle counts. Neighbour depth variation is capped at 2.5 cm. Fine terrain uses a half-metre mesh grid. Twelve denotes cells, not metres.

## Autonomous wolf mode

Click Autonomous: Off / On on the screen to toggle. The wolf runs while exploring, walks when stamina is low, seeks forage and rests when exhausted. Movement keys or the left stick take back control. Pause freezes autonomous movement. Forage consumed by the autonomous wolf is transient. No new animal save records are created by this mode.
