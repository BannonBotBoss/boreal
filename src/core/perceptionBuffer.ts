/**
 * Perception block reader (T-0083, roadmap step 16). Issues #105 and #106.
 *
 * One contiguous little-endian block of what the embodied animal perceives.
 * #106 wins the packing. The order is header, body feelings, emotions, urges,
 * visible things, scent volumes, sounds, memory marks, then a tail a later
 * sense may append. Counts may be zero. This module does not draw and does
 * not turn positions into JSON.
 *
 * The embodied id is at byte 20. A C-style layout would pad it to byte 24
 * (roadmap conflict 19). A sound entry is 28 bytes, with 4 reserved. A scent
 * entry is 32 bytes, with 4 reserved. A memory entry is 20 bytes.
 * Header bytes 44 through 63 stay reserved so echo, heat, or ultraviolet can
 * arrive later without a new version.
 *
 * `bytes` may be a view of WebAssembly memory, or any other slice the Rust
 * writer filled.
 */
export const PERCEPTION = {
  headerBytes: 64,
  embodiedIdOffset: 20,
  headerReservedOffset: 44,
  headerReservedBytes: 20,
  physiologyBytes: 32,
  emotionBytes: 32,
  instinctBytes: 32,
  fixedBytes: 160,
  physiologyOffset: 64,
  emotionOffset: 96,
  urgeOffset: 128,
  visibleOffset: 160,
  visualBytes: 48,
  scentBytes: 32,
  soundBytes: 28,
  memoryBytes: 20,
  caps: { visible: 32, scent: 16, sound: 8, memory: 12 },
} as const;

export interface PerceptionHeader {
  frameId: bigint;
  timestamp: number;
  speciesId: number;
  embodiedId: bigint;
  visualCount: number;
  scentCount: number;
  soundCount: number;
  memoryCount: number;
  /** Header bytes 44..64. Always 20 bytes, even when every count is zero. */
  reserved: Uint8Array;
}
export interface BodyFeelings {
  hunger: number; thirst: number; fatigue: number; pain: number;
  temperatureStress: number; oxygenStress: number; stamina: number; reserved: number;
}
export interface Emotions {
  fear: number; stress: number; confidence: number; curiosity: number;
  aggression: number; socialAttachment: number; reserved1: number; reserved2: number;
}
export interface Urges {
  feedDrive: number; drinkDrive: number; safetyDrive: number; explorationDrive: number;
  matingDrive: number; migrationDrive: number; territorialDrive: number; socialDrive: number;
}
export interface VisibleThing {
  id: bigint; objectType: number; classification: number; certainty: number; salience: number;
  x: number; y: number; z: number; velocityX: number; velocityY: number; velocityZ: number; flags: number;
}
export interface ScentVolume {
  scentType: number; sourceSpecies: number; strength: number; freshness: number;
  directionX: number; directionY: number; directionZ: number; concentration: number;
  /** Four bytes. The listed fields sum to 28 and the issue states 32. */
  reserved: Uint8Array;
}
export interface HeardSound {
  category: number; urgency: number; intensity: number;
  directionX: number; directionY: number; directionZ: number; ageSeconds: number;
  /** Four bytes. The listed fields sum to 24 and the issue states 28. */
  reserved: Uint8Array;
}
export interface MemoryMark {
  memoryType: number; emotionType: number; emotionalWeight: number; x: number; y: number; z: number;
}
export interface PerceptionFrame {
  header: PerceptionHeader;
  body: BodyFeelings;
  emotions: Emotions;
  urges: Urges;
  visible: VisibleThing[];
  scents: ScentVolume[];
  sounds: HeardSound[];
  memories: MemoryMark[];
  /** Bytes after the memory marks. Empty until a later sense appends them. */
  tail: Uint8Array;
}

class R {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private at = 0;
  constructor(src: ArrayBuffer | ArrayBufferView) {
    if (src instanceof ArrayBuffer) {
      this.view = new DataView(src);
      this.bytes = new Uint8Array(src);
    } else {
      this.view = new DataView(src.buffer, src.byteOffset, src.byteLength);
      this.bytes = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
    }
  }
  private need(n: number) {
    if (this.at + n > this.bytes.byteLength) throw new Error(`perception block is short: need ${this.at + n} bytes, have ${this.bytes.byteLength}`);
  }
  u16() { this.need(2); const v = this.view.getUint16(this.at, true); this.at += 2; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.at, true); this.at += 4; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.at, true); this.at += 8; return v; }
  f32() { this.need(4); const v = this.view.getFloat32(this.at, true); this.at += 4; return v; }
  f64() { this.need(8); const v = this.view.getFloat64(this.at, true); this.at += 8; return v; }
  raw(n: number) { this.need(n); const v = this.bytes.slice(this.at, this.at + n); this.at += n; return v; }
  rest() { return this.bytes.slice(this.at); }
}

function cap(name: string, count: number, max: number) {
  if (count > max) throw new Error(`${name} count ${count} is over the cap ${max}`);
}

/** One sound entry. Issue #106 states 28 bytes. A shorter or longer slice is not that entry. */
export function readSoundEntry(src: ArrayBuffer | ArrayBufferView): HeardSound {
  const r = new R(src);
  const bytes = src instanceof ArrayBuffer ? src.byteLength : src.byteLength;
  if (bytes !== PERCEPTION.soundBytes) throw new Error(`sound entry is ${bytes} bytes, not ${PERCEPTION.soundBytes}`);
  return {
    category: r.u16(), urgency: r.u16(), intensity: r.f32(),
    directionX: r.f32(), directionY: r.f32(), directionZ: r.f32(), ageSeconds: r.f32(), reserved: r.raw(4),
  };
}

/** Walk one perception block. Little-endian. Rejects a count above the issue's caps, and a slice shorter than those counts require. Bytes past the memory marks are the tail. */
export function readPerception(src: ArrayBuffer | ArrayBufferView): PerceptionFrame {
  const r = new R(src);
  const frameId = r.u64();
  const timestamp = r.f64();
  const speciesId = r.u32();
  const embodiedId = r.u64();
  const visualCount = r.u32();
  const scentCount = r.u32();
  const soundCount = r.u32();
  const memoryCount = r.u32();
  cap('visible', visualCount, PERCEPTION.caps.visible);
  cap('scent', scentCount, PERCEPTION.caps.scent);
  cap('sound', soundCount, PERCEPTION.caps.sound);
  cap('memory', memoryCount, PERCEPTION.caps.memory);
  const reserved = r.raw(PERCEPTION.headerReservedBytes);
  const body: BodyFeelings = {
    hunger: r.f32(), thirst: r.f32(), fatigue: r.f32(), pain: r.f32(),
    temperatureStress: r.f32(), oxygenStress: r.f32(), stamina: r.f32(), reserved: r.f32(),
  };
  const emotions: Emotions = {
    fear: r.f32(), stress: r.f32(), confidence: r.f32(), curiosity: r.f32(),
    aggression: r.f32(), socialAttachment: r.f32(), reserved1: r.f32(), reserved2: r.f32(),
  };
  const urges: Urges = {
    feedDrive: r.f32(), drinkDrive: r.f32(), safetyDrive: r.f32(), explorationDrive: r.f32(),
    matingDrive: r.f32(), migrationDrive: r.f32(), territorialDrive: r.f32(), socialDrive: r.f32(),
  };
  const visible: VisibleThing[] = [];
  for (let i = 0; i < visualCount; i++) visible.push({
    id: r.u64(), objectType: r.u16(), classification: r.u16(), certainty: r.f32(), salience: r.f32(),
    x: r.f32(), y: r.f32(), z: r.f32(), velocityX: r.f32(), velocityY: r.f32(), velocityZ: r.f32(), flags: r.u32(),
  });
  const scents: ScentVolume[] = [];
  for (let i = 0; i < scentCount; i++) scents.push({
    scentType: r.u16(), sourceSpecies: r.u16(), strength: r.f32(), freshness: r.f32(),
    directionX: r.f32(), directionY: r.f32(), directionZ: r.f32(), concentration: r.f32(), reserved: r.raw(4),
  });
  const sounds: HeardSound[] = [];
  for (let i = 0; i < soundCount; i++) sounds.push(readSoundEntry(r.raw(PERCEPTION.soundBytes)));
  const memories: MemoryMark[] = [];
  for (let i = 0; i < memoryCount; i++) memories.push({
    memoryType: r.u16(), emotionType: r.u16(), emotionalWeight: r.f32(), x: r.f32(), y: r.f32(), z: r.f32(),
  });
  const tail = r.rest();
  return {
    header: { frameId, timestamp, speciesId, embodiedId, visualCount, scentCount, soundCount, memoryCount, reserved },
    body, emotions, urges, visible, scents, sounds, memories, tail,
  };
}
