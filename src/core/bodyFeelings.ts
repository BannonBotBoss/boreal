/**
 * Body feelings (T-0102, roadmap step 18). Issues #102, #103, and #106.
 *
 * The record lives on the step 12 store. Energy, water, and rest stay on
 * `Needs` and move only through `stepNeeds`. Age stays on `Age`. Stamina,
 * pain, health, air temperature, and the two body stresses are `BodyFeelings`.
 * Issue #106's physiology block is 32 bytes. This module packs that block so
 * step 19 can copy it to byte 64. It does not write the emotion block.
 *
 * Conflict 10: weight is not a field. The caller passes the kilograms
 * `rigMass` derived. That number is handed to `stepNeeds` for one call and
 * then dropped.
 *
 * Conflict 11: temperature stress and oxygen stress are the body stresses.
 * They are not a habitat term and they are not the emotion-block stress.
 *
 * Pain, health, and oxygen stress have no rate here (calibration). Pain and
 * oxygen stress stay at whatever the store already holds, which starts at 0.
 * Health stays at whatever the store holds, which starts full. A later
 * contact is what writes them. This step does not invent a coefficient.
 */
import { readFileSync } from 'node:fs';
import { createNeeds, heatFactor, staminaRates, stepNeeds, type NeedsState } from './needs/engine';
import type { SpeciesTemplate } from './needs/template';
import { PERCEPTION, type BodyFeelings as PhysiologyBlock } from './perceptionBuffer';
import { readStoredPack, type StoredRecord } from './storedAnimal';

export const FEELINGS_RECORD_BYTES = 32;
export const FEELINGS_HEADER_BYTES = 12;

/** The needs engine's full reserve. `createNeeds` starts here and `stepNeeds` clamps here. */
export const reserveFull = () => createNeeds().water;

export interface StoredFeelings {
  stamina: number;
  pain: number;
  health: number;
  /** Air temperature in °C, the same `tC` argument `stepNeeds` already takes. 0 means no sample yet. */
  temperatureC: number;
  /** `heatFactor(species, temperatureC) - 1`. Zero at or below the row's `heatAboveC`. */
  temperatureStress: number;
  /** Calibration: no oxygen-debt row on the species template. Starts at 0. No rate. */
  oxygenStress: number;
}

/** The joined feeling. Rest is the reserve `stepNeeds` already steps. Fatigue in the block is its unfilled share. */
export interface BodyRecord extends StoredFeelings {
  handle: string;
  energy: number;
  water: number;
  rest: number;
  ageYears: number;
}

export type BodyGait = 'still' | 'walk' | 'run' | 'sprint';

export interface BodyStep {
  dtGame: number;
  /** Real seconds. Stamina uses this clock, the same one `staminaRates` is quoted in. */
  dtReal: number;
  speed: number;
  tC: number;
  drinking?: boolean;
  gait: BodyGait;
  /**
   * Kilograms from the generated rig (`rigMass`). Required. Not written onto
   * the record. `stepNeeds` reads it for the Taylor term and the water-pool size.
   */
  generatedKg: number;
}

/** A species row whose Taylor mass and water-pool size are the generated kilograms. The row's cited FMR and turnover stay. */
export function speciesCarrying(sp: SpeciesTemplate, generatedKg: number): SpeciesTemplate {
  return { ...sp, body: { ...sp.body, massKg: { ...sp.body.massKg, v: generatedKg } } };
}

/**
 * Stamina percent after `dtReal` real seconds.
 * Run and sprint drain. Walk and still recover. That is the split `stepWolfModes`
 * already applies (`drain` is 0 for a walk, so the recovery rate runs).
 */
export function stepStamina(sp: SpeciesTemplate, stamina: number, gait: BodyGait, dtReal: number): number {
  const rates = staminaRates(sp);
  const drain = gait === 'sprint' ? rates.sprint : gait === 'run' ? rates.run : 0;
  const full = reserveFull();
  return Math.max(0, Math.min(full, stamina + (drain ? -drain : rates.recover) * dtReal));
}

/**
 * One step of the body. Water, energy, and rest come back from `stepNeeds`
 * and nowhere else. Temperature stress is the existing heat factor minus one.
 * Pain, health, and oxygen stress are not moved.
 */
export function stepBodyFeelings(
  sp: SpeciesTemplate,
  needs: NeedsState,
  energy: number,
  feelings: StoredFeelings,
  ageYears: number,
  step: BodyStep,
  handle = '',
): { needs: NeedsState; energy: number; feelings: StoredFeelings; record: BodyRecord; physiology: PhysiologyBlock } {
  if (!Number.isFinite(step.generatedKg) || step.generatedKg <= 0) {
    throw new Error('body feelings need the generated kilograms from the rig');
  }
  const carried = speciesCarrying(sp, step.generatedKg);
  const stepped = stepNeeds(carried, needs, {
    dtGame: step.dtGame, speed: step.speed, tC: step.tC, drinking: step.drinking, energy,
  });
  const next: StoredFeelings = {
    stamina: stepStamina(sp, feelings.stamina, step.gait, step.dtReal),
    pain: feelings.pain,
    health: feelings.health,
    temperatureC: step.tC,
    temperatureStress: heatFactor(sp, step.tC) - 1,
    oxygenStress: feelings.oxygenStress,
  };
  const record: BodyRecord = {
    handle,
    energy: stepped.energy,
    water: stepped.state.water,
    rest: stepped.state.rest,
    ageYears,
    ...next,
  };
  return { needs: stepped.state, energy: stepped.energy, feelings: next, record, physiology: physiologyOf(record) };
}

/**
 * Issue #106's eight floats. Hunger, thirst, and fatigue are the unfilled share
 * of the energy, water, and rest reserves on the needs percent scale. That is
 * a calibration label, not a second pool and not a new coefficient. The last
 * float stays 0 so age, health, and weight cannot hide in it.
 */
export function physiologyOf(record: Pick<BodyRecord, 'energy' | 'water' | 'rest' | 'pain' | 'temperatureStress' | 'oxygenStress' | 'stamina'>): PhysiologyBlock {
  const full = reserveFull();
  return {
    hunger: full - record.energy,
    thirst: full - record.water,
    fatigue: full - record.rest,
    pain: record.pain,
    temperatureStress: record.temperatureStress,
    oxygenStress: record.oxygenStress,
    stamina: record.stamina,
    reserved: 0,
  };
}

/** 32 little-endian bytes, the physiology block and nothing after it. */
export function packPhysiology(block: PhysiologyBlock): Uint8Array {
  if (PERCEPTION.physiologyBytes !== 32) throw new Error('physiology block is no longer 32 bytes');
  const out = new Uint8Array(PERCEPTION.physiologyBytes);
  const view = new DataView(out.buffer);
  const floats = [
    block.hunger, block.thirst, block.fatigue, block.pain,
    block.temperatureStress, block.oxygenStress, block.stamina, block.reserved,
  ];
  for (let i = 0; i < floats.length; i++) view.setFloat32(i * 4, floats[i], true);
  return out;
}

/**
 * A perception frame whose physiology bytes are `block` and whose other floats are 0.
 * Step 19 copies `packPhysiology` to `PERCEPTION.physiologyOffset` the same way.
 */
export function frameWithPhysiology(block: PhysiologyBlock): Uint8Array {
  const frame = new Uint8Array(PERCEPTION.fixedBytes);
  frame.set(packPhysiology(block), PERCEPTION.physiologyOffset);
  return frame;
}

class R {
  private view: DataView;
  private at = 0;
  constructor(src: ArrayBuffer | Uint8Array) {
    if (src instanceof Uint8Array) this.view = new DataView(src.buffer, src.byteOffset, src.byteLength);
    else this.view = new DataView(src);
  }
  private need(n: number) {
    if (this.at + n > this.view.byteLength) throw new Error(`feelings pack is short: need ${this.at + n}, have ${this.view.byteLength}`);
  }
  u32() { this.need(4); const v = this.view.getUint32(this.at, true); this.at += 4; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.at, true); this.at += 8; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.at, true); this.at += 4; return v; }
  bytes(n: number) { this.need(n); const v = new Uint8Array(this.view.buffer, this.view.byteOffset + this.at, n); this.at += n; return v; }
  get done() { return this.at; }
}

export interface FeelingsRow extends StoredFeelings { handle: string }

/** Read a `BDY1` pack the store wrote. Little-endian, version 1. */
export function readFeelingsPack(src: ArrayBuffer | Uint8Array): FeelingsRow[] {
  const r = new R(src);
  const magic = r.bytes(4);
  if (magic[0] !== 0x42 || magic[1] !== 0x44 || magic[2] !== 0x59 || magic[3] !== 0x31) throw new Error('feelings magic is not BDY1');
  const version = r.u32();
  if (version !== 1) throw new Error(`feelings version ${version}`);
  const count = r.u32();
  const out: FeelingsRow[] = [];
  for (let i = 0; i < count; i++) {
    const handle = r.u64();
    if (handle === 0n) throw new Error('feelings handle is zero');
    out.push({
      handle: handle.toString(),
      stamina: r.f32(), pain: r.f32(), health: r.f32(),
      temperatureC: r.f32(), temperatureStress: r.f32(), oxygenStress: r.f32(),
    });
  }
  if (r.done !== FEELINGS_HEADER_BYTES + count * FEELINGS_RECORD_BYTES) throw new Error('feelings pack length');
  return out;
}

/** Join the animal record and the feelings record on the handle. One feeling per animal. */
export function joinBodyRecords(stored: StoredRecord[], feelings: FeelingsRow[]): BodyRecord[] {
  return stored.map(animal => {
    const felt = feelings.find(row => row.handle === animal.handle);
    if (!felt) throw new Error(`no feelings for handle ${animal.handle}`);
    return {
      handle: animal.handle,
      energy: animal.energy, water: animal.water, rest: animal.rest, ageYears: animal.ageYears,
      stamina: felt.stamina, pain: felt.pain, health: felt.health,
      temperatureC: felt.temperatureC, temperatureStress: felt.temperatureStress, oxygenStress: felt.oxygenStress,
    };
  });
}

export function readFeelingsFixture(path = new URL('../../tests/fixtures/body-feelings.bin', import.meta.url)) {
  return readFeelingsPack(readFileSync(path));
}

export function readJoinedFixture(
  feelingsPath = new URL('../../tests/fixtures/body-feelings.bin', import.meta.url),
  animalsPath = new URL('../../tests/fixtures/stored-wolf-pack.bin', import.meta.url),
) {
  return joinBodyRecords(readStoredPack(readFileSync(animalsPath)), readFeelingsPack(readFileSync(feelingsPath)));
}
