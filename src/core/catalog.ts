export type Kind = 'spruce' | 'rock' | 'log' | 'plant' | 'forage' | 'deer' | 'person';
export type Action = 'speak' | 'gather' | 'move' | 'forage';
export interface Definition {
  id: Kind; title: string; purpose: string; visualDescription: string;
  parentGroup: string; objectType: 'scenery' | 'resource' | 'animal' | 'person';
  motionType: 'static' | 'animated'; categories: string[];
  generator: { id: Kind; version: 1; levels: readonly number[] };
  interactions: Action[] | null; audio: string | null;
  inventory: { item: string; stackLimit: number } | null;
  /** Composition plan in core/materials.ts COMPOSITIONS. */ material: string;
}
const entry = (id: Kind, title: string, purpose: string, visualDescription: string,
  parentGroup: string, objectType: Definition['objectType'], interactions: Action[] | null): Definition => ({
  id, title, purpose, visualDescription, parentGroup, objectType,
  motionType: objectType === 'animal' || objectType === 'person' ? 'animated' : 'static',
  categories: [parentGroup, objectType], generator: { id, version: 1, levels: [0, 1, 2] },
  interactions, audio: id === 'rock' ? 'stone-roll' : interactions?.includes('speak') ? 'friend-chime' : interactions ? 'gather-rustle' : null,
  inventory: id === 'plant' ? { item: 'herb', stackLimit: 99 } : null,
  material: ({ spruce: 'tree', rock: 'rock', log: 'log', plant: 'plant', forage: 'plant', deer: 'cervid', person: 'human' } as Record<string, string>)[id] ?? 'human',
});
export const catalog: Record<Kind, Definition> = {
  forage: entry('forage', 'Forage berry patch', 'Restore animal energy; fictional edible plant', 'Low broad green leaves with clusters of blue berries', 'vegetation', 'resource', ['forage']),
  spruce: entry('spruce', 'Spruce', 'Forest cover', 'Layered green crown and tapered brown trunk', 'vegetation', 'scenery', null),
  rock: entry('rock', 'Shield stone', 'Ground detail; small stones can be snout-pushed', 'Nine angular shapes and nine sizes, pixelated grey mineral gradients', 'geology', 'scenery', ['move']),
  log: entry('log', 'Fallen wood', 'Forest floor debris', 'Horizontal trunk with pale cut ends', 'vegetation', 'scenery', null),
  plant: entry('plant', 'Practice herb', 'Demonstrate gathering; fictional plant', 'Orange-tipped low plant', 'vegetation', 'resource', ['gather']),
  deer: entry('deer', 'Woodland deer', 'Demonstrate shared speak capability', 'Tan quadruped with cream muzzle and branching antlers', 'wildlife', 'animal', ['speak']),
  person: entry('person', 'Visitor', 'Demonstrate individual relationship persistence', 'Simple neutral clay-colored figure', 'inhabitants', 'person', ['speak']), // motion is BEHAVIOUR.person (core/visitors), not a sway
};

