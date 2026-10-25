/**
 * The why behind every object (Grok Bot, T-0006): a short causal chain of closed steps, oldest first.
 * Matthew's tree: photosynthesis -> forms a seed -> the seed disperses -> sprouts from the ground -> grows into the tree
 * and leafs out (one step, 'grew', so the log chain fits WHY_MAX). His fallen log carries on: weathered (rare weather strained it over time) -> weakened (a weak point built
 * up) -> failed (could not hold its own mass). Then the seating physics, as labels (Matthew 07:16): pulled (gravity) ->
 * tipped -> displaced (trunk density vs earth density: the earth yields) -> settled (forces equal) -> resting (flat, sunk
 * ~1/3 of the trunk width). Once down it carries on with ONGOING steps (Matthew 07:22): ceased (no longer photosynthesizing)
 * -> oxidized (transactions with oxygen and other elements transform it) -> decaying (slowly becoming fallen trunk). Then
 * the log is an arena of ongoing transactions (Matthew 07:25): held (gravity keeps it in place) -> insected (hosts insects)
 * -> wetted (water) -> sunned (sunlight) -> rotting (one side) -> nursing (the other side collects debris and lets other
 * plants grow). Oxygen is the 'oxidized' step (no separate 'aired'). The cycle repeats many times, so the forest floor is
 * accumulated fallen wood (Matthew 07:26): the log ends with buried (becoming forest floor) and the ground has its own
 * derived chain, GROUND_WHY (weathered -> accumulated). Terrain and flora follow-ups: T-0007, open claim. The fall
 * steps are labels only: no weather, plant or seating sim here (T-0005 seats the log; see Contact.sinkFraction).
 * T-0016: a placed object names why it is at that point (stand age since fire, a sunlit gap, or the river channel),
 * and an agent carries a live doing step (goal and cause) that is never stored.
 * T-0018: a placed log fills oxidized, insected, wetted, sunned, rotting and decaying from the log arena
 * (src/core/logDecay.ts). The fall steps stay labels. The buried sentence stays the one the contact tests lock.
 *
 * - Closed vocabulary (WHY_TAGS); `on`/`by` are short identifiers (an entity key, 'ground', 'player'), never prose.
 * - Generated objects get a DERIVED chain from their kind and are never stored (no save growth).
 * - A record stores `why` only when a transaction changed it (core/events: solidContact, the rock push).
 * - At most WHY_MAX steps. Not a simulation: provenance structure plus per-kind defaults, deterministic.
 */
import type { Kind } from './catalog';
import { heightAt, LEGACY_RIVER_FOLD2, riverCenter, type Entity } from './world';
import { LEVEL } from './tuning';
import { STAGES } from './stages/elevation';
import { riverAt } from './stages/rivers';
import { CANOPY, siteAt } from './flora/site';
import { FIRE, standAt, standStructure } from './stand';
import { arenaOf, fallFraction, logYears } from './logDecay';
import { NEEDS_SPECIES } from './needs/species';
import type { Solid } from './contactBus';

export const WHY_TAGS = ['photosynthesized', 'seeded', 'dispersed', 'sprouted', 'grew', 'weakened', 'failed', 'pulled', 'tipped', 'displaced', 'settled', 'resting', 'weathered', 'embedded', 'moved', 'born', 'wandered', 'ceased', 'oxidized', 'decaying', 'held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing', 'buried', 'accumulated', 'grazing', 'fleeing', 'alerting', 'drinking', 'recovering', 'exploring', 'seeking', 'steered', 'grazed', 'regrew'] as const;
export type WhyTag = typeof WHY_TAGS[number];
/** Ongoing steps: slow processes that follow the anchor (the last event) instead of replacing it. A contact compares
 *  against the anchor, so a decaying log still reads as resting on the ground and the same contact stays a no-op. */
export const ONGOING: readonly WhyTag[] = ['ceased', 'oxidized', 'decaying', 'held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing', 'buried', 'accumulated', 'grazing', 'fleeing', 'alerting', 'drinking', 'recovering', 'exploring', 'seeking', 'steered'];
/** Live doing steps (T-0016). Ongoing, so they never become the anchor a contact compares, and withDoing never writes them to a record. */
export const DOING: readonly WhyTag[] = ['grazing', 'fleeing', 'alerting', 'drinking', 'recovering', 'exploring', 'seeking', 'steered'];
export type DoingGoal = typeof DOING[number];
export interface WhyStep { step: WhyTag; on?: Solid; by?: string }
export type Why = WhyStep[];
/** Cap on chain length. Raised 16 -> 24 (Matthew 07:25) so the fallen log's origin, break, seating physics, decay and
 *  arena steps all fit (22) without merging or dropping any of them; still tiny (a stored chain is < 1 KB). */
export const WHY_MAX = 24;
const ID_MAX = 64;

const GROWN: Why = [{ step: 'photosynthesized' }, { step: 'seeded' }, { step: 'dispersed' }, { step: 'sprouted' }, { step: 'grew' }]; // a standing tree or plant stops here, before failed
/** Derived chain per kind (never stored). Every catalog Kind has one. */
export const WHY_DEFAULTS: Record<Kind, Why> = {
  spruce: GROWN, plant: GROWN, forage: GROWN,
  log: [...GROWN, { step: 'weathered' }, { step: 'weakened' }, { step: 'failed' },
    { step: 'pulled' }, { step: 'tipped' }, { step: 'displaced', on: 'ground' }, { step: 'settled' }, { step: 'resting', on: 'ground' },
    { step: 'ceased' }, { step: 'oxidized' }, { step: 'decaying' },
    { step: 'held', by: 'gravity' }, { step: 'insected' }, { step: 'wetted' }, { step: 'sunned' }, { step: 'rotting' }, { step: 'nursing' },
    { step: 'buried', on: 'ground' }], // 23 steps
  rock: [{ step: 'weathered' }, { step: 'embedded', on: 'ground' }],
  deer: [{ step: 'born' }, { step: 'wandered' }],
  person: [{ step: 'born' }, { step: 'wandered' }], // live goal (drink, pick, sit, watch) is withDoing at inspect time, never stored (T-0012)
};
/** The ground's own derived chain (Solid 'ground' has no entity): bedrock weathered, then built up from many cycles of
 *  fallen trunks (fall -> seat -> decay -> arena -> buried). Provenance only; T-0007 owns any visual or ground-model work. */
export const GROUND_WHY: Why = [{ step: 'weathered' }, { step: 'accumulated', by: 'trunk-cycles' }];
const copy = (w: Why): Why => w.map(s => ({ ...s }));
export const groundWhy = (): Why => copy(GROUND_WHY);

/** Understorey light of a gap-phase old stand. stand.ts opens the canopy after 150 yr (Harper et al. 2002, the term
 *  already in standStructure) and site.ts shades the background by CANOPY.stand. A point at least this bright is a gap
 *  relative to that closed canopy, not a new threshold. */
export function gapLight(): number {
  return 1 - CANOPY.stand * standStructure(FIRE.maxAge, .5).canopy;
}
/** Inside the river channel: staged rivers use the water half-width (core/stages/rivers); the legacy river is the same
 *  gaussian heightAt carves, and only where that carve is below the water surface. Lakes are not flow. */
export function onFlow(x: number, z: number): boolean {
  if (STAGES.on) { const rv = riverAt(STAGES.seed, x, z); return !!rv && rv.d <= rv.half; }
  return (x - riverCenter(z)) ** 2 <= LEGACY_RIVER_FOLD2 && heightAt(x, z) < LEVEL.waterSurface + .03;
}
export interface Placement { cause: 'flow' | 'sunlit-gap' | 'stand'; age: number; light: number }
/** One placement cause at a point. Age is the stand's years since fire (standAt, Van Wagner 1978). Flow wins over light,
 *  and a sunlit gap wins over the closed-stand age, so the chain names the most specific reason the site model gives. */
export function placementCause(x: number, z: number): Placement {
  const site = siteAt(x, z), age = Math.round(standAt(x, z, site.wet).age);
  if (onFlow(x, z)) return { cause: 'flow', age, light: site.light };
  if (site.light >= gapLight()) return { cause: 'sunlit-gap', age, light: site.light };
  return { cause: 'stand', age, light: site.light };
}
function place(w: Why, kind: Kind, x: number, z: number, seed?: number): Why {
  const p = placementCause(x, z);
  if (kind === 'deer' || kind === 'person') return w.map(s => s.step === 'born' ? { ...s, by: 'birth' } : s.step === 'wandered' && p.cause === 'flow' ? { ...s, by: 'flow' } : { ...s });
  if (kind === 'rock') return p.cause === 'flow' ? w.map(s => s.step === 'embedded' ? { ...s, by: 'flow' } : { ...s }) : w;
  const by = p.cause === 'flow' ? 'flow' : p.cause === 'sunlit-gap' ? `sunlit-gap:${p.age}` : `stand:${p.age}`;
  const placed = w.map(s => s.step === 'grew' ? { ...s, by } : { ...s });
  if (kind !== 'log') return placed;
  // Arena rates (T-0018). No seed: the mean of the uniform fall draw (0.5 of the stand age). A placed log passes its seed.
  const site = siteAt(x, z, true, false), standAge = standAt(x, z, site.wet).age;
  const age = (seed === undefined ? 0.5 : fallFraction(seed)) * standAge + logYears();
  const d = arenaOf({ wet: site.wet, light: site.light, age });
  return placed.map(s => {
    switch (s.step) {
      case 'oxidized': return { ...s, by: `o2:${d.oxygen.toFixed(2)}` };
      case 'insected': return { ...s, by: `share:${d.insects.toFixed(2)}` };
      case 'wetted': return { ...s, by: `mc:${d.mc.toFixed(2)}` };
      case 'sunned': return { ...s, by: `light:${d.light.toFixed(2)}` };
      case 'rotting': return { ...s, by: `k:${d.k.toFixed(4)}` };
      case 'decaying': return { ...s, by: `class:${d.klass}` };
      default: return s;
    }
  });
}
/** Hare and wolf are not catalog Kinds. The cause is the one that actually places them today: the hare in the near
 *  interest ring (animals/hare.ts), the wolf with the player. Habitat spawn waits on T-0009. */
const AGENT_PLACE: Record<string, Why> = {
  hare: [{ step: 'born', by: 'birth' }, { step: 'wandered', by: 'interest-ring' }],
  wolf: [{ step: 'born', by: 'birth' }, { step: 'wandered', by: 'player' }],
};
export function agentWhy(species: string): Why {
  const w = AGENT_PLACE[species]; if (!w) throw new Error(`no why for ${species}`);
  return copy(w);
}
/** The record's chain if a transaction wrote one, else the derived chain. With x and z, the chain names the placement
 *  cause. Without them, the kind default (no site), so a caller that has no position cannot invent one. */
export function whyOf(e: Pick<Entity, 'kind'> & Partial<Pick<Entity, 'x' | 'z' | 'seed'>>, record?: { why?: Why }): Why {
  if (record?.why) return copy(record.why);
  const base = copy(WHY_DEFAULTS[e.kind]);
  return typeof e.x === 'number' && typeof e.z === 'number' ? place(base, e.kind, e.x, e.z, e.seed) : base;
}
/** Append the live goal. Replaces any previous doing step. Does not mutate `w` and is not written by transactions. */
export function withDoing(w: Why, goal: DoingGoal, because: string): Why {
  const by = (because || 'unspecified').replace(/\s+/g, ' ').slice(0, ID_MAX) || 'unspecified';
  const out = [...copy(w).filter(s => !(DOING as readonly string[]).includes(s.step)), { step: goal, by }];
  return out.length > WHY_MAX ? [out[0], ...out.slice(out.length - WHY_MAX + 1)] : out;
}
/** AnimalBrain.problem -> the doing step. `explore` says nothing was sensed: that is what the brain does today. */
export function doingFromProblem(problem: string, energy: number, targetKind?: string): { goal: DoingGoal; because: string } {
  const n = Math.round(energy);
  switch (problem) {
    case 'feed': return { goal: 'grazing', because: `energy ${n}%` };
    case 'escape': return { goal: 'fleeing', because: targetKind ?? 'threat' };
    case 'recover': return { goal: 'recovering', because: `energy ${n}%` };
    case 'avoid': return { goal: 'seeking', because: 'obstacle' };
    case 'player': return { goal: 'steered', because: 'player' };
    default: return { goal: 'exploring', because: 'nothing sensed' };
  }
}
/** Sim state -> the doing step. A graze bout above the hunger line says so, instead of claiming hunger. */
export function doingFromAgent(a: { species: string; state: string; energy: number; needs: { water: number; rest: number }; level: number }): { goal: DoingGoal; because: string } {
  const below = NEEDS_SPECIES[a.species]?.behaviour.drives.energy.seekBelow.v ?? 80, n = Math.round(a.energy);
  switch (a.state) {
    case 'graze':
    case 'eat': return { goal: 'grazing', because: a.energy < below ? `energy ${n}%` : `bout, energy ${n}%` };
    case 'drink': return { goal: 'drinking', because: `water ${Math.round(a.needs.water)}%` };
    case 'freeze': return { goal: 'alerting', because: `perceived ${a.level.toFixed(2)}` };
    case 'flee': return { goal: 'fleeing', because: `perceived ${a.level.toFixed(2)}` };
    case 'rest': return { goal: 'recovering', because: `rest ${Math.round(a.needs.rest)}%` };
    case 'stalk':
    case 'chase': return { goal: 'seeking', because: 'hunt' };
    default: return { goal: 'exploring', because: 'nothing sensed' };
  }
}
/** The two inspector lines. Same strings the panel prints. */
export function inspectWhy(w: Why, title: string): { now: string; chain: string } {
  return { now: `${title} - ${nowText(w)}`, chain: whyText(w) };
}
export const tip = (w: Why): WhyStep | undefined => w[w.length - 1];
const anchorIndex = (w: Why) => { for (let i = w.length - 1; i >= 0; i--) if (!ONGOING.includes(w[i].step)) return i; return -1; };
/** The last event step (skipping trailing ongoing steps): what a contact compares against. */
export const anchor = (w: Why): WhyStep | undefined => w[anchorIndex(w)];
const sameStep = (a?: WhyStep, b?: WhyStep) => !!a && !!b && a.step === b.step && a.on === b.on && a.by === b.by;
export const sameWhy = (a: Why, b: Why) => a.length === b.length && a.every((s, i) => sameStep(s, b[i]));
/** Set the anchor: unchanged if the anchor already says `s`; replaces an anchor of the same step in place, keeping the
 *  ongoing steps after it (resting on X -> resting on ground); otherwise appends `s` at the end. Over WHY_MAX, keeps the
 *  first step (the origin) and the most recent ones. */
export function withTip(w: Why, s: WhyStep): Why {
  const i = anchorIndex(w), a = w[i];
  if (sameStep(a, s)) return copy(w);
  const out = a?.step === s.step ? copy(w).map((x, k) => k === i ? { ...s } : x) : [...copy(w), { ...s }];
  return out.length > WHY_MAX ? [out[0], ...out.slice(out.length - WHY_MAX + 1)] : out;
}
const name = (id: string) => id === 'ground' ? 'the ground' : id === 'player' ? 'the player' : id;
/** Plain words for one step: "resting on the ground", "moved by the player". */
export function stepText(s: WhyStep): string {
  switch (s.step) {
    case 'resting': return `resting on ${name(s.on ?? 'ground')}`;
    case 'embedded': return s.by === 'flow' ? 'embedded in the channel' : `embedded in ${name(s.on ?? 'ground')}`;
    case 'moved': return s.by ? `moved by ${name(s.by)}` : 'moved';
    case 'grew': return s.by === 'flow' ? 'grew in the channel'
      : s.by?.startsWith('sunlit-gap:') ? `grew in a sunlit gap (stand ${s.by.slice(11)} years since fire)`
      : s.by?.startsWith('stand:') ? `grew in a stand ${s.by.slice(6)} years since fire`
      : 'grew and leafed out';
    case 'sprouted': return 'sprouted from the ground';
    case 'dispersed': return 'seed dispersed';
    case 'seeded': return 'formed a seed';
    case 'photosynthesized': return 'photosynthesis';
    case 'weathered': return 'weathered over time';
    case 'weakened': return 'a weak point built up';
    case 'failed': return 'failed under its own mass';
    case 'born': return 'born';
    case 'wandered': return s.by === 'flow' ? 'wandered into the flow' : s.by === 'interest-ring' ? 'wandered into the near ring' : s.by === 'player' ? 'here with the player' : 'wandered here';
    case 'grazing': return `grazing (${s.by ?? 'feeding'})`;
    case 'fleeing': return `fleeing (${s.by ?? 'threat'})`;
    case 'alerting': return `alert (${s.by ?? 'perceived'})`;
    case 'drinking': return `drinking (${s.by ?? 'water'})`;
    case 'recovering': return `recovering (${s.by ?? 'rest'})`;
    case 'exploring': return `moving (${s.by ?? 'nothing sensed'})`;
    case 'seeking': return `seeking (${s.by ?? 'a goal'})`;
    case 'steered': return `steered (${s.by ?? 'player'})`;
    case 'pulled': return 'pulled down by gravity';
    case 'tipped': return 'tipped over';
    case 'displaced': return `displaced ${name(s.on ?? 'ground')} (the earth yields)`;
    case 'settled': return 'settled (forces balanced)';
    case 'ceased': return 'no longer photosynthesizing';
    case 'oxidized': return s.by?.startsWith('o2:') ? `oxidizing (oxygen ${s.by.slice(3)} of the well-drained rate)` : 'oxidizing (oxygen and other elements)';
    case 'decaying': return s.by?.startsWith('class:') ? `decay class ${s.by.slice(6)}` : 'decaying into fallen trunk over a long time';
    case 'held': return 'held in place by gravity';
    case 'insected': return s.by?.startsWith('share:') ? (s.by === 'share:0.00' ? 'insects absent (too dry or airless)' : `hosting insects (${s.by.slice(6)} of early loss)`) : 'hosting insects';
    case 'wetted': return s.by?.startsWith('mc:') ? `wetted (moisture ${s.by.slice(3)} g/g)` : 'wetted by water';
    case 'sunned': return s.by?.startsWith('light:') ? `warmed by sunlight (light ${s.by.slice(6)})` : 'warmed by sunlight';
    case 'rotting': return s.by?.startsWith('k:') ? `rotting at ${s.by.slice(2)} /yr` : 'one side rotting';
    case 'nursing': return 'the other side collecting debris and growing other plants';
    case 'buried': return `becoming ${s.on === undefined || s.on === 'ground' ? 'forest floor' : name(s.on)} (one more trunk cycle)`;
    case 'accumulated': return 'built up from many cycles of fallen trunks';
    case 'grazed': return `grazed by ${name(s.by ?? 'an animal')}`;
    case 'regrew': return 'regrew from sunlight';
  }
}
/** What it is now: the anchor plus the latest ongoing step after it ("resting on the ground, decaying ..."). */
export function nowText(w: Why): string {
  const i = anchorIndex(w), a = w[i], last = w[w.length - 1];
  return [a && stepText(a), i < w.length - 1 && last ? stepText(last) : undefined].filter(Boolean).join(', ');
}
/** The whole chain: "photosynthesis -> formed a seed -> ... -> resting on the ground". */
export const whyText = (w: Why) => w.map(stepText).join(' \u2192 ');
/** Validates a stored chain (parseContext). */
export function isWhy(v: unknown): v is Why {
  if (!Array.isArray(v) || v.length < 1 || v.length > WHY_MAX) return false;
  const id = (x: unknown) => x === undefined || (typeof x === 'string' && x.length > 0 && x.length <= ID_MAX);
  return v.every(s => !!s && typeof s === 'object' && !Array.isArray(s) && (WHY_TAGS as readonly string[]).includes(s.step)
    && id(s.on) && id(s.by) && Object.keys(s).every(k => k === 'step' || k === 'on' || k === 'by'));
}
