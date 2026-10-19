/**
 * The why behind every object (Grok Bot, T-0006): a short causal chain of closed steps, oldest first.
 * Matthew's tree: photosynthesis -> forms a seed -> the seed disperses -> sprouts from the ground -> grows into the tree
 * -> leafs out. His fallen log carries on: weathered (rare weather strained it over time) -> weakened (a weak point built
 * up) -> failed (could not hold its own mass). Then the seating physics, as labels (Matthew 07:16): pulled (gravity) ->
 * tipped -> displaced (trunk density vs earth density: the earth yields) -> settled (forces equal) -> resting (flat, sunk
 * ~1/3 of the trunk width). Labels only: no weather, plant or seating sim here (T-0005 seats the log; see Contact.sinkFraction).
 *
 * - Closed vocabulary (WHY_TAGS); `on`/`by` are short identifiers (an entity key, 'ground', 'player'), never prose.
 * - Generated objects get a DERIVED chain from their kind and are never stored (no save growth).
 * - A record stores `why` only when a transaction changed it (core/events: solidContact, the rock push).
 * - At most WHY_MAX steps. Not a simulation: provenance structure plus per-kind defaults, deterministic.
 */
import type { Kind } from './catalog';
import type { Entity } from './world';
import type { Solid } from './contactBus';

export const WHY_TAGS = ['photosynthesized', 'seeded', 'dispersed', 'sprouted', 'grew', 'leafed', 'weakened', 'failed', 'pulled', 'tipped', 'displaced', 'settled', 'resting', 'weathered', 'embedded', 'moved', 'born', 'wandered'] as const;
export type WhyTag = typeof WHY_TAGS[number];
export interface WhyStep { step: WhyTag; on?: Solid; by?: string }
export type Why = WhyStep[];
export const WHY_MAX = 16;
const ID_MAX = 64;

const GROWN: Why = [{ step: 'photosynthesized' }, { step: 'seeded' }, { step: 'dispersed' }, { step: 'sprouted' }, { step: 'grew' }, { step: 'leafed' }]; // a standing tree or plant stops here
/** Derived chain per kind (never stored). Every catalog Kind has one. */
export const WHY_DEFAULTS: Record<Kind, Why> = {
  spruce: GROWN, plant: GROWN, forage: GROWN,
  log: [...GROWN, { step: 'weathered' }, { step: 'weakened' }, { step: 'failed' },
    { step: 'pulled' }, { step: 'tipped' }, { step: 'displaced', on: 'ground' }, { step: 'settled' }, { step: 'resting', on: 'ground' }],
  rock: [{ step: 'weathered' }, { step: 'embedded', on: 'ground' }],
  deer: [{ step: 'born' }, { step: 'wandered' }],
  person: [{ step: 'born' }, { step: 'wandered' }],
};
const copy = (w: Why): Why => w.map(s => ({ ...s }));
/** The record's chain if a transaction wrote one, else the derived default for the kind. */
export function whyOf(e: Pick<Entity, 'kind'>, record?: { why?: Why }): Why { return copy(record?.why ?? WHY_DEFAULTS[e.kind]); }
export const tip = (w: Why): WhyStep | undefined => w[w.length - 1];
const sameStep = (a?: WhyStep, b?: WhyStep) => !!a && !!b && a.step === b.step && a.on === b.on && a.by === b.by;
export const sameWhy = (a: Why, b: Why) => a.length === b.length && a.every((s, i) => sameStep(s, b[i]));
/** Set the tip: unchanged if the tip already says `s`; replaces a tip of the same step (e.g. resting on X -> resting on
 *  ground); otherwise appends. Over WHY_MAX, keeps the first step (the origin) and the most recent ones. */
export function withTip(w: Why, s: WhyStep): Why {
  if (sameStep(tip(w), s)) return copy(w);
  const out = tip(w)?.step === s.step ? [...copy(w.slice(0, -1)), { ...s }] : [...copy(w), { ...s }];
  return out.length > WHY_MAX ? [out[0], ...out.slice(out.length - WHY_MAX + 1)] : out;
}
const name = (id: string) => id === 'ground' ? 'the ground' : id === 'player' ? 'the player' : id;
/** Plain words for one step: "resting on the ground", "moved by the player". */
export function stepText(s: WhyStep): string {
  switch (s.step) {
    case 'resting': return `resting on ${name(s.on ?? 'ground')}`;
    case 'embedded': return `embedded in ${name(s.on ?? 'ground')}`;
    case 'moved': return s.by ? `moved by ${name(s.by)}` : 'moved';
    case 'grew': return 'grew here';
    case 'sprouted': return 'sprouted from the ground';
    case 'dispersed': return 'seed dispersed';
    case 'seeded': return 'formed a seed';
    case 'photosynthesized': return 'photosynthesis';
    case 'leafed': return 'leafed out';
    case 'weathered': return 'weathered over time';
    case 'weakened': return 'a weak point built up';
    case 'failed': return 'failed under its own mass';
    case 'born': return 'born';
    case 'wandered': return 'wandered here';
    case 'pulled': return 'pulled down by gravity';
    case 'tipped': return 'tipped over';
    case 'displaced': return `displaced ${name(s.on ?? 'ground')} (the earth yields)`;
    case 'settled': return 'settled (forces balanced)';
  }
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
