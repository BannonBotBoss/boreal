import { catalog, type Action } from './catalog';
import { GENERATOR_VERSION, WORLD_SEED, type Entity } from './world';
import { pushContact, rockDiameter } from './rocks';
import { ANIMAL_DEFAULT_ENERGY, FORAGE_ENERGY } from './animalBehavior';
import { isWhy, sameWhy, whyOf, withTip, type Why, type WhyStep } from './why';
import type { SeatInputs, Solid, Vec3 } from './contactBus';
import { friendLive } from './huntHold';
export interface Player { x: number; z: number; heading?: number; abilities: Action[] }
export interface RecordEntry { entity: Entity; relationship: 'friend' | null; removed: boolean; lastAction: Action; interactions: number; playerInteracted?: boolean;
  /** Causal chain (core/why), stored only once a transaction changed it; absent = the kind's derived chain. */ why?: Why }
export function playerRemembered(record: RecordEntry | undefined) {
  return !!record && (record.playerInteracted === true || record.relationship === 'friend' || record.lastAction !== 'forage');
}
/** A released prey's temporary friendship. `at` and the caller's `now` share one clock (play / sim seconds). */
export interface Bond { at: number; tau: number; species: string }
export interface EventContext { schemaVersion: 1; generatorVersion: number; worldSeed: number; records: Record<string, RecordEntry>; inventory: { herb: number }; bonds?: Record<string, Bond> }
export function createContext(): EventContext {
  return { schemaVersion: 1, generatorVersion: GENERATOR_VERSION, worldSeed: WORLD_SEED, records: {}, inventory: { herb: 0 }, bonds: {} };
}
/** Permanent friends, plus live bonds. Without `now`, every bond still counts (old callers pass one argument). */
export function friendCount(context: EventContext, now?: number) {
  const people = Object.values(context.records).filter(r => r.relationship === 'friend').length;
  const bonds = Object.values(context.bonds ?? {});
  const live = now === undefined ? bonds.length : bonds.filter(b => friendLive(b.at, now, b.tau)).length;
  return people + live;
}
/** Pure: the next context remembers this prey as a friend of the player. Hares are not catalog entities, so the bond sits beside records. */
export function rememberBond(context: EventContext, key: string, bond: Bond): EventContext {
  const next = structuredClone(context);
  next.bonds = { ...(next.bonds ?? {}), [key]: { at: bond.at, tau: bond.tau, species: bond.species } };
  return next;
}
export function availableActions(player: Player, target: Entity, context: EventContext): Action[] {
  if (context.records[target.key]?.removed || Math.hypot(player.x - target.x, player.z - target.z) > 6) return [];
  return (catalog[target.kind].interactions ?? []).filter(action => player.abilities.includes(action)
    && (action !== 'gather' || context.inventory.herb < 99)
    && (action !== 'move' || !!pushContact(player, target))
    && (action !== 'forage' || Math.hypot(player.x-target.x,player.z-target.z) <= 2.5));
}
/** Pure transaction: caller persists the complete next context before exposing it. */
export function interact(context: EventContext, player: Player, target: Entity, action: Action): EventContext {
  if (!availableActions(player, target, context).includes(action)) throw new Error('Action is unavailable.');
  const next = structuredClone(context);
  const previous = next.records[target.key];
  next.records[target.key] = {
    entity: structuredClone(target), playerInteracted: true, relationship: action === 'speak' ? 'friend' : previous?.relationship ?? null,
    removed: action === 'gather' || action === 'forage', lastAction: action, interactions: (previous?.interactions ?? 0) + 1,
  };
  if (previous?.why) next.records[target.key].why = previous.why;
  if (action === 'gather') next.inventory.herb++;
  if (action === 'move') {
    const push = pushContact(player, target)!;
    const e = next.records[target.key].entity, radius = rockDiameter(e) / 2;
    e.x += push.dx; e.z += push.dz;
    e.rollX = (e.rollX ?? 0) + push.dz / radius;
    e.rollZ = (e.rollZ ?? 0) - push.dx / radius;
    next.records[target.key].why = withTip(whyOf(target, previous), { step: 'moved', by: 'player' }); // T-0006: the why's second writer
  }
  return next;
}
export function consumeForage(context: EventContext, animal: Entity, plant: Entity): EventContext {
  if(catalog[animal.kind].objectType !== 'animal' || plant.kind !== 'forage') throw new Error('Not animal forage.');
  if (!availableActions({x:animal.x,z:animal.z,abilities:['forage']},plant,context).includes('forage')) throw new Error('Forage is unavailable.');
  // Autonomous actions must never promote a transient animal into the save.
  if (!playerRemembered(context.records[animal.key])) return context;
  const next=interact(context,{x:animal.x,z:animal.z,abilities:['forage']},plant,'forage');
  next.records[plant.key].playerInteracted = false;
  const previous=context.records[animal.key];
  next.records[animal.key]={entity:{...animal,energy:Math.min(100,(animal.energy??ANIMAL_DEFAULT_ENERGY)+FORAGE_ENERGY)},
    playerInteracted:true,relationship:previous?.relationship??null,removed:false,lastAction:'forage',interactions:(previous?.interactions??0)+1};
  return next;
}
/** What touching `other` means for `self`'s why tip: a rock is embedded in the ground; anything else rests on it. */
export function contactStep(self: Pick<Entity, 'kind'>, other: Solid): WhyStep {
  return { step: self.kind === 'rock' && other === 'ground' ? 'embedded' : 'resting', on: other };
}
/** Pure transaction (T-0006) for a solid-solid contact from core/contactBus; the caller persists the complete next
 *  context. Never moves, sinks or rotates anything (seating stays in the placement code: T-0005 seatLog, seatRock).
 *  Only records that already exist are touched: a generated log meeting the earth returns `context` itself (same object),
 *  so generated objects never enter the save. Idempotent: begin/end at chunk build/dispose are render-lifetime edges
 *  and may repeat; the same contact again gives the same context. Updates only `why` (the chain's tip). The optional
 *  seating inputs (trunkDensity, earthDensity, sinkFraction) ride along for T-0005 and do not change the result. */
export function solidContact(context: EventContext, c: { a: Solid | Entity; b: Solid | Entity; at?: Vec3; normal?: Vec3 } & SeatInputs): EventContext {
  const keyOf = (s: Solid | Entity) => typeof s === 'string' ? s : s.key;
  const a = keyOf(c.a), b = keyOf(c.b);
  let next: EventContext | undefined;
  for (const [self, other] of [[a, b], [b, a]]) {
    if (self === 'ground' || !Object.hasOwn(context.records, self)) continue;
    const record = context.records[self]; if (record.removed) continue;
    const before = whyOf(record.entity, record), after = withTip(before, contactStep(record.entity, other));
    if (sameWhy(before, after)) continue;
    next ??= structuredClone(context);
    next.records[self].why = after;
  }
  return next ?? context;
}
export function restoreEntities(generated: Entity[], context: EventContext, bounds: { minX: number; minZ: number; maxX: number; maxZ: number }): Entity[] {
  const pinned = Object.values(context.records).filter(r => !r.removed && r.entity.x >= bounds.minX && r.entity.x < bounds.maxX && r.entity.z >= bounds.minZ && r.entity.z < bounds.maxZ).map(r => r.entity);
  return [...generated.filter(e => !Object.hasOwn(context.records, e.key)
    && !pinned.some(p => p.kind !== 'rock' && e.kind !== 'rock' && e.kind !== 'forage' && Math.hypot(p.x - e.x, p.z - e.z) < 2)), ...pinned];
}
export function parseContext(text: string): EventContext {
  const data = JSON.parse(text) as EventContext;
  if (data.schemaVersion !== 1 || data.generatorVersion !== GENERATOR_VERSION || data.worldSeed !== WORLD_SEED
    || !data.records || typeof data.records !== 'object' || Array.isArray(data.records)
    || !Number.isInteger(data.inventory?.herb) || data.inventory.herb < 0 || data.inventory.herb > 99)
    throw new Error('Unsupported or damaged event context. Existing save was not replaced.');
  if (data.bonds === undefined) data.bonds = {};
  else if (!data.bonds || typeof data.bonds !== 'object' || Array.isArray(data.bonds)) throw new Error('Invalid friend bonds. Existing save was not replaced.');
  else for (const bond of Object.values(data.bonds)) {
    if (!bond || typeof bond.species !== 'string' || !bond.species || !Number.isFinite(bond.at) || !Number.isFinite(bond.tau) || bond.tau <= 0)
      throw new Error('Invalid friend bond. Existing save was not replaced.');
  }
  for (const [key, value] of Object.entries(data.records)) {
    const e = value?.entity;
    if (!e || e.key !== key || !Object.hasOwn(catalog, e.kind) || e.generatorVersion !== GENERATOR_VERSION
      || ![e.x, e.z, e.scale, e.rotation, e.seed].every(Number.isFinite) || e.scale <= 0
      || (e.energy !== undefined && (!Number.isFinite(e.energy) || e.energy < 0 || e.energy > 100))
      || ![e.rollX ?? 0, e.rollZ ?? 0].every(Number.isFinite)
      || !['speak', 'gather', 'move', 'forage'].includes(value.lastAction) || typeof value.removed !== 'boolean'
      || (value.relationship !== null && value.relationship !== 'friend') || !Number.isInteger(value.interactions) || value.interactions < 1
      || (value.why !== undefined && !isWhy(value.why)))
      throw new Error('Invalid individual record. Existing save was not replaced.');
  }
  // Legacy autonomous meals lacked player provenance; discard only those animal records.
  for (const [key, record] of Object.entries(data.records)) {
    if (catalog[record.entity.kind].objectType === 'animal' && !playerRemembered(record)) delete data.records[key];
  }
  return data;
}
