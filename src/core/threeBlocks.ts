/**
 * Three blocks (T-0105, roadmap step 19). Issues #102, #103, #105, and #106.
 *
 * Conflict 12: #106 wins. #102's one mind and #103's one instinct list are not
 * built. Hunger and thirst stay the physiology block T-0102 already packs.
 * Fear and curiosity are the emotion block. The pull to feed, flee, mate, or
 * move is the urge block.
 *
 * The feed, drink, flee, and move magnitudes are step 10's product
 * (`urgeWeights`, `urgeScores`). No new coefficient. Mating is the fifth urge
 * float. It is not an emotion field. This step has no mating weight, so that
 * float stays 0 (calibration). The cutoff ladder from #101 is not used.
 *
 * Nothing here is drawn. The reader in `perceptionBuffer.ts` is unchanged.
 */
import { strongestUrge, urgeScores, urgeWeights, type AgentSpecies, type UrgeName } from './agent';
import { packPhysiology } from './bodyFeelings';
import { PERCEPTION, type BodyFeelings, type Emotions, type Urges } from './perceptionBuffer';

/** Step 10 severities and opportunities. Hunger here is 0..1, not the body percent. */
export interface DriveSeverity {
  hunger: number;
  thirst: number;
  fatigue: number;
  food: number;
  water: number;
  leave: number;
}

export interface ThreeBlocks {
  body: BodyFeelings;
  emotions: Emotions;
  urges: Urges;
  weights: ReturnType<typeof urgeWeights>;
  scores: Record<UrgeName, number>;
  /** Includes rest. Rest has no slot in issue #106, so it is not packed. */
  winner: UrgeName;
}

/**
 * Fear and curiosity are feelings. The other emotion floats have no rate in
 * this step (calibration). Emotion stress is not the body's temperature stress.
 * Hunger is not an argument: it cannot be written here.
 */
export function feelingsOf(fear: number, curiosity = 0): Emotions {
  return {
    fear,
    stress: 0,
    confidence: 0,
    curiosity,
    aggression: 0,
    socialAttachment: 0,
    reserved1: 0,
    reserved2: 0,
  };
}

/**
 * Split one moment into the three blocks. `body` is the physiology block from
 * `physiologyOf`. `fear` is the sensed cue step 10 already uses. Curiosity, when
 * omitted, stays 0 (calibration: no curiosity rate on the species row).
 */
export function threeBlocks(
  utility: AgentSpecies['utility'],
  body: BodyFeelings,
  feeling: { fear: number; curiosity?: number },
  severity: DriveSeverity,
): ThreeBlocks {
  const weights = urgeWeights(utility);
  const scores = urgeScores(weights, {
    hunger: severity.hunger,
    thirst: severity.thirst,
    fear: feeling.fear,
    fatigue: severity.fatigue,
    food: severity.food,
    water: severity.water,
    leave: severity.leave,
  });
  const emotions = feelingsOf(feeling.fear, feeling.curiosity ?? 0);
  const urges: Urges = {
    feedDrive: scores.feed,
    drinkDrive: scores.drink,
    safetyDrive: scores.flee,
    explorationDrive: scores.move,
    matingDrive: 0,
    migrationDrive: 0,
    territorialDrive: 0,
    socialDrive: 0,
  };
  return { body, emotions, urges, weights, scores, winner: strongestUrge(scores) };
}

function packFloats(values: number[], bytes: number): Uint8Array {
  if (values.length * 4 !== bytes) throw new Error(`block is ${values.length * 4} bytes, not ${bytes}`);
  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer);
  for (let i = 0; i < values.length; i++) view.setFloat32(i * 4, values[i], true);
  return out;
}

/** 32 little-endian bytes. Issue #106's emotion order. Hunger is not in the list. */
export function packEmotions(block: Emotions): Uint8Array {
  return packFloats([
    block.fear, block.stress, block.confidence, block.curiosity,
    block.aggression, block.socialAttachment, block.reserved1, block.reserved2,
  ], PERCEPTION.emotionBytes);
}

/**
 * 32 little-endian bytes. Issue #106's instinct order. Mating is the fifth
 * float. The step 10 rest score is not one of these eight.
 */
export function packUrges(block: Urges): Uint8Array {
  return packFloats([
    block.feedDrive, block.drinkDrive, block.safetyDrive, block.explorationDrive,
    block.matingDrive, block.migrationDrive, block.territorialDrive, block.socialDrive,
  ], PERCEPTION.instinctBytes);
}

/**
 * One perception frame whose three fixed blocks are these slices.
 * Body at byte 64, emotions at byte 96, urges at byte 128. Counts stay 0.
 */
export function frameWithBlocks(blocks: Pick<ThreeBlocks, 'body' | 'emotions' | 'urges'>): Uint8Array {
  const frame = new Uint8Array(PERCEPTION.fixedBytes);
  frame.set(packPhysiology(blocks.body), PERCEPTION.physiologyOffset);
  frame.set(packEmotions(blocks.emotions), PERCEPTION.emotionOffset);
  frame.set(packUrges(blocks.urges), PERCEPTION.urgeOffset);
  return frame;
}
