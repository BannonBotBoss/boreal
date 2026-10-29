/**
 * Animals recorded in the step 11 store (T-0092, roadmap step 12).
 *
 * The Rust store (`rust/boreal-sim/src/animals.rs`) holds the components.
 * This module does not keep a list of entities. It reads one pack the store
 * wrote, and it builds the spawn request from the species rows that already
 * exist: `LIFESPAN`, `WOLF_NEEDS` / `HARE_NEEDS`, and the `MAMMALS` plan.
 * The deer has no needs row. Its age is `LIFESPAN.deer` and the count is one,
 * the animal you enter (T-0107). `AnimalBrain` mirrors one record until step 13.
 * It does not decide from it. The file read of the fixture lives in
 * `storedFixture.ts` so this module can load in the page.
 */
import { AnimalBrain, ANIMAL_DEFAULT_ENERGY, type StoredMirror } from './animalBehavior';
import { LIFESPAN } from './lifespan';
import { createNeeds } from './needs/engine';
import { NEEDS_SPECIES } from './needs/species';
import { MAMMALS } from './species';

export const STORED_SPECIES = { wolf: 1, hare: 2, deer: 3 } as const;
export const STORED_ARCHETYPE = { canid: 1, leporid: 2, cervid: 3 } as const;
export const ANIMAL_RECORD_BYTES = 76;
export const PACK_HEADER_BYTES = 12;

const SPECIES_NAME = { wolf: 'Gray Wolf', hare: 'Snowshoe Hare', deer: 'White-tailed Deer' } as const;
const CODE_SPECIES: Record<number, 'wolf' | 'hare' | 'deer'> = { 1: 'wolf', 2: 'hare', 3: 'deer' };
const CODE_ARCHETYPE: Record<number, 'canid' | 'leporid' | 'cervid'> = { 1: 'canid', 2: 'leporid', 3: 'cervid' };

export interface PackRequest {
  species: 'wolf' | 'hare' | 'deer';
  speciesCode: number;
  archetype: 'canid' | 'leporid' | 'cervid';
  archetypeCode: number;
  ageYears: number;
  count: number;
  spacingM: number;
  water: number;
  energy: number;
  rest: number;
  founder: true;
  places: { x: number; y: number; z: number }[];
}

/** Spawn arguments from the species rows. The count is the row's group-size minimum.
 *  The deer has no needs row: one animal, age from `LIFESPAN.deer`, no spacing. */
export function packRequest(species: 'wolf' | 'hare' | 'deer', origin: { x: number; y: number; z: number }): PackRequest {
  if (species === 'deer') {
    const life = LIFESPAN.deer;
    const needs = createNeeds();
    const row = MAMMALS.find(r => r[0] === SPECIES_NAME.deer);
    if (!row || !life) throw new Error('no deer row');
    return {
      species, speciesCode: STORED_SPECIES.deer, archetype: 'cervid', archetypeCode: STORED_ARCHETYPE.cervid,
      ageYears: life.startYears, count: 1, spacingM: 0, water: needs.water, energy: ANIMAL_DEFAULT_ENERGY, rest: needs.rest,
      founder: true, places: [{ ...origin }],
    };
  }
  const sp = NEEDS_SPECIES[species];
  const life = LIFESPAN[species];
  if (!sp || !life) throw new Error(`no species row for ${species}`);
  const count = sp.social.groupSize.v[0];
  const spacingM = sp.social.spacingM.v;
  const needs = createNeeds();
  const row = MAMMALS.find(r => r[0] === SPECIES_NAME[species]);
  if (!row) throw new Error(`no mammal row for ${species}`);
  const archetype = row[1];
  if (archetype !== 'canid' && archetype !== 'leporid' && archetype !== 'cervid') throw new Error(`plan ${archetype} is not a stored archetype`);
  const places = [];
  for (let i = 0; i < count; i++) places.push({ x: origin.x + i * spacingM, y: origin.y, z: origin.z });
  return {
    species, speciesCode: STORED_SPECIES[species], archetype, archetypeCode: STORED_ARCHETYPE[archetype],
    ageYears: life.startYears, count, spacingM, water: needs.water, energy: ANIMAL_DEFAULT_ENERGY, rest: needs.rest,
    founder: true, places,
  };
}

export interface StoredRecord extends StoredMirror {
  speciesCode: number;
  archetypeCode: number;
}

class R {
  private view: DataView;
  private at = 0;
  constructor(src: ArrayBuffer | Uint8Array) {
    if (src instanceof Uint8Array) this.view = new DataView(src.buffer, src.byteOffset, src.byteLength);
    else this.view = new DataView(src);
  }
  private need(n: number) {
    if (this.at + n > this.view.byteLength) throw new Error(`stored pack is short: need ${this.at + n}, have ${this.view.byteLength}`);
  }
  u8() { this.need(1); const v = this.view.getUint8(this.at); this.at += 1; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.at, true); this.at += 4; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.at, true); this.at += 8; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.at, true); this.at += 4; return v; }
  f64() { this.need(8); const v = this.view.getFloat64(this.at, true); this.at += 8; return v; }
  bytes(n: number) { this.need(n); const v = new Uint8Array(this.view.buffer, this.view.byteOffset + this.at, n); this.at += n; return v; }
  get done() { return this.at; }
}

/** Read a pack the Rust store wrote. Little-endian `ANM1`, version 1. */
export function readStoredPack(src: ArrayBuffer | Uint8Array): StoredRecord[] {
  const r = new R(src);
  const magic = r.bytes(4);
  if (magic[0] !== 0x41 || magic[1] !== 0x4e || magic[2] !== 0x4d || magic[3] !== 0x31) throw new Error('stored pack magic is not ANM1');
  const version = r.u32();
  if (version !== 1) throw new Error(`stored pack version ${version}`);
  const count = r.u32();
  const out: StoredRecord[] = [];
  for (let i = 0; i < count; i++) {
    const handle = r.u64();
    const speciesCode = r.u8();
    const archetypeCode = r.u8();
    const founder = r.u8();
    const pad = r.u8();
    const parent = r.u64();
    const territory = r.u64();
    const ageYears = r.f64();
    const x = r.f64();
    const y = r.f64();
    const z = r.f64();
    const water = r.f32();
    const energy = r.f32();
    const rest = r.f32();
    const tail = r.f32();
    if (pad !== 0 || tail !== 0) throw new Error('stored animal tail is not empty');
    if (founder !== 0 && founder !== 1) throw new Error('founder flag is not 0 or 1');
    const species = CODE_SPECIES[speciesCode];
    const archetype = CODE_ARCHETYPE[archetypeCode];
    if (!species || !archetype) throw new Error(`unknown species code ${speciesCode} or plan code ${archetypeCode}`);
    if (handle === 0n) throw new Error('handle is zero');
    out.push({
      handle: handle.toString(), species, archetype, speciesCode, archetypeCode,
      x, y, z, ageYears, water, energy, rest,
      founder: founder === 1, parent: parent === 0n ? null : parent.toString(), territory: territory.toString(),
    });
  }
  if (r.done !== PACK_HEADER_BYTES + count * ANIMAL_RECORD_BYTES) throw new Error('stored pack length');
  return out;
}

/** Copy one stored animal onto the brain. Does not append to a list. */
export function mirrorStoredAnimal(brain: AnimalBrain, animal: StoredMirror) {
  brain.energy = animal.energy;
  brain.stored = {
    handle: animal.handle, species: animal.species, archetype: animal.archetype,
    x: animal.x, y: animal.y, z: animal.z, ageYears: animal.ageYears,
    water: animal.water, energy: animal.energy, rest: animal.rest,
    founder: animal.founder, parent: animal.parent, territory: animal.territory,
  };
}

/** The evidence gate: a non-zero age, and a parent id or an explicit founder flag. */
export function recordedPast(animal: Pick<StoredMirror, 'ageYears' | 'founder' | 'parent'>) {
  return animal.ageYears > 0 && (animal.founder || animal.parent !== null);
}

