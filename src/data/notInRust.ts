/** Simulation work that is still outside the Rust engines.
 *  `typescript` rows name a file that still computes the thing.
 *  `not-built` rows are engines nobody has written. They are never given fake numbers.
 */
export interface SimGap {
  kind: 'typescript' | 'not-built';
  file: string;
  what: string;
}

export const NOT_IN_RUST: readonly SimGap[] = [
  { kind: 'typescript', file: 'src/world/globe/planet.ts', what: 'Builds the continents, the height of the land, and where the sea sits.' },
  { kind: 'typescript', file: 'src/core/weather.ts', what: 'Steps the air around the player: rain, snow, soil water, and the near wind.' },
  { kind: 'typescript', file: 'src/core/altitudeZones.ts', what: 'Decides the tree line and the ice line from latitude.' },
  { kind: 'typescript', file: 'src/world/globe/coverKind.ts', what: 'The picture still classifies ground cover in TypeScript, a copy of the Rust cover rule.' },
  { kind: 'typescript', file: 'src/core/needs/engine.ts', what: 'Steps an animal\'s water, energy, and rest.' },
  { kind: 'typescript', file: 'src/core/animalBehavior.ts', what: 'Chooses how deer and wolves move: gaits, foraging, and fleeing.' },
  { kind: 'typescript', file: 'src/core/sim/index.ts', what: 'Runs the herd: each animal\'s needs, senses, and what it does next.' },
  { kind: 'typescript', file: 'src/core/needs/behaviour.ts', what: 'Picks an animal\'s goal from what it feels.' },
  { kind: 'typescript', file: 'src/core/needs/senses.ts', what: 'Decides what an animal can see and hear.' },
  { kind: 'typescript', file: 'src/core/perceptionBuffer.ts', what: 'Packs what an animal perceives. The game does not call the Rust packer.' },
  { kind: 'typescript', file: 'src/core/world.ts', what: 'The playable forest\'s ground height.' },
  { kind: 'typescript', file: 'src/core/stages/elevation.ts', what: 'Shapes the staged terrain the player walks on.' },
  { kind: 'typescript', file: 'src/core/stages/rivers.ts', what: 'Cuts the rivers and sets how fast they flow.' },
  { kind: 'typescript', file: 'src/core/stages/flow.ts', what: 'Sends rainfall downhill into channels.' },
  { kind: 'typescript', file: 'src/core/stages/soils.ts', what: 'Picks the soil under each place.' },
  { kind: 'typescript', file: 'src/core/stand.ts', what: 'Counts the trees in a stand.' },
  { kind: 'typescript', file: 'src/world/globe/plates.ts', what: 'Lays tectonic plates on the procedural planet.' },
  { kind: 'not-built', file: '', what: 'Nucleosynthesis — light-element abundances. The stub spawns, but it does not calculate them.' },
  { kind: 'not-built', file: '', what: 'Electroweak epoch — no engine.' },
  { kind: 'not-built', file: '', what: 'Quark-gluon plasma — no engine. Reheating only flags the 150 MeV threshold.' },
  { kind: 'not-built', file: '', what: 'Recombination microphysics — redshift is known, the Saha solver is not.' },
  { kind: 'not-built', file: '', what: 'First stars and galaxies — no engine.' },
];
