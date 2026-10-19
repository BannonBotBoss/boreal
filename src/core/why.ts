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
 * derived chain, GROUND_WHY (weathered -> accumulated). Terrain and flora follow-ups: T-0007, open claim. Labels only: no weather, plant or seating sim here (T-0005 seats the log; see Contact.sinkFraction).
 *
 * - Closed vocabulary (WHY_TAGS); `on`/`by` are short identifiers (an entity key, 'ground', 'player'), never prose.
 * - Generated objects get a DERIVED chain from their kind and are never stored (no save growth).
 * - A record stores `why` only when a transaction changed it (core/events: solidContact, the rock push).
 * - At most WHY_MAX steps. Not a simulation: provenance structure plus per-kind defaults, deterministic.
 */
import type { Kind } from './catalog';
import type { Entity } from './world';
import type { Solid } from './contactBus';

export const WHY_TAGS = ['photosynthesized', 'seeded', 'dispersed', 'sprouted', 'grew', 'weakened', 'failed', 'pulled', 'tipped', 'displaced', 'settled', 'resting', 'weathered', 'embedded', 'moved', 'born', 'wandered', 'ceased', 'oxidized', 'decaying', 'held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing', 'buried', 'accumulated'] as const;
export type WhyTag = typeof WHY_TAGS[number];
/** Ongoing steps: slow processes that follow the anchor (the last event) instead of replacing it. A contact compares
 *  against the anchor, so a decaying log still reads as resting on the ground and the same contact stays a no-op. */
export const ONGOING: readonly WhyTag[] = ['ceased', 'oxidized', 'decaying', 'held', 'insected', 'wetted', 'sunned', 'rotting', 'nursing', 'buried', 'accumulated'];
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
  person: [{ step: 'born' }, { step: 'wandered' }],
};
/** The ground's own derived chain (Solid 'ground' has no entity): bedrock weathered, then built up from many cycles of
 *  fallen trunks (fall -> seat -> decay -> arena -> buried). Provenance only; T-0007 owns any visual or ground-model work. */
export const GROUND_WHY: Why = [{ step: 'weathered' }, { step: 'accumulated', by: 'trunk-cycles' }];
const copy = (w: Why): Why => w.map(s => ({ ...s }));
export const groundWhy = (): Why => copy(GROUND_WHY);
/** The record's chain if a transaction wrote one, else the derived default for the kind. */
export function whyOf(e: Pick<Entity, 'kind'>, record?: { why?: Why }): Why { return copy(record?.why ?? WHY_DEFAULTS[e.kind]); }
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
    case 'embedded': return `embedded in ${name(s.on ?? 'ground')}`;
    case 'moved': return s.by ? `moved by ${name(s.by)}` : 'moved';
    case 'grew': return 'grew and leafed out';
    case 'sprouted': return 'sprouted from the ground';
    case 'dispersed': return 'seed dispersed';
    case 'seeded': return 'formed a seed';
    case 'photosynthesized': return 'photosynthesis';
    case 'weathered': return 'weathered over time';
    case 'weakened': return 'a weak point built up';
    case 'failed': return 'failed under its own mass';
    case 'born': return 'born';
    case 'wandered': return 'wandered here';
    case 'pulled': return 'pulled down by gravity';
    case 'tipped': return 'tipped over';
    case 'displaced': return `displaced ${name(s.on ?? 'ground')} (the earth yields)`;
    case 'settled': return 'settled (forces balanced)';
    case 'ceased': return 'no longer photosynthesizing';
    case 'oxidized': return 'oxidizing (oxygen and other elements)';
    case 'decaying': return 'decaying into fallen trunk over a long time';
    case 'held': return 'held in place by gravity';
    case 'insected': return 'hosting insects';
    case 'wetted': return 'wetted by water';
    case 'sunned': return 'warmed by sunlight';
    case 'rotting': return 'one side rotting';
    case 'nursing': return 'the other side collecting debris and growing other plants';
    case 'buried': return `becoming ${s.on === undefined || s.on === 'ground' ? 'forest floor' : name(s.on)} (one more trunk cycle)`;
    case 'accumulated': return 'built up from many cycles of fallen trunks';
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
