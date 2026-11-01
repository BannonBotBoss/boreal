/**
 * Northwest Ontario fauna as skeleton plans. Species lists: Thunder Bay Field Naturalists mammal checklist (2018)
 * and bird checklist (2025). Introduced or post-1400 arrivals are listed separately and are not generated for the 1400s.
 * Sizes and proportions are approximate (provisional) unless a plan says otherwise; see SKELETON-RULES.md.
 */
import { buildBird, buildMammal, type BirdPlan, type MammalPlan, type Skeleton } from './skeleton';
import type { AgentSpecies, FoodSource } from './agent';
import { TRANSACTIONS } from './transactions';
import { activityFactor, agentLevels } from './needs/engine';
import { WOLF_NEEDS } from './needs/species';
import { REAL_SECONDS_PER_GAME_HOUR } from './timeOfDay';
import { browseCellKey, browseGrams, takePatch } from './fields';
import { DEER_TRACE_RANGE_M, WOLF_SCENT_RANGE_M } from './traces';

const M = (o: Omit<MammalPlan, 'kind' | 'provisional'> & { provisional?: boolean }): MammalPlan => ({ kind: 'mammal', provisional: true, ...o });
/** Mammal body plans. Ratios are to shoulder height. */
export const MAMMAL_PLANS = {
  canid: M({ archetype: 'canid', posture: 'digitigrade', withers: .74, massKg: 40, trunk: 1.0, neck: .38, skull: .36, snout: .45, tail: .6, tailCount: 20, width: .12,
    fore: [.28, .30, .33, .12, .09], hind: [.30, .33, .35, .17, .09], carnivore: true }),
  felid: M({ archetype: 'felid', posture: 'digitigrade', withers: .55, massKg: 10, trunk: 1.15, neck: .35, skull: .3, snout: .3, tail: .25, tailCount: 13, width: .13,
    fore: [.28, .3, .32, .1, .08], hind: [.3, .35, .36, .17, .08], carnivore: true }),
  mustelid: M({ archetype: 'mustelid', posture: 'plantigrade', withers: .15, massKg: 1, trunk: 2.4, neck: .7, skull: .55, snout: .35, tail: 1.4, tailCount: 18, width: .2,
    fore: [.3, .3, .3, .15, .1], hind: [.3, .32, .32, .18, .1], carnivore: true }),
  ursid: M({ archetype: 'ursid', posture: 'plantigrade', withers: .9, massKg: 100, trunk: 1.3, neck: .35, skull: .35, snout: .45, tail: .1, tailCount: 8, width: .2,
    fore: [.3, .35, .3, .15, .08], hind: [.3, .4, .33, .25, .08], carnivore: true }),
  procyonid: M({ archetype: 'procyonid', posture: 'plantigrade', withers: .3, massKg: 7, trunk: 1.6, neck: .45, skull: .45, snout: .4, tail: 1.0, tailCount: 20, width: .2,
    fore: [.3, .32, .32, .15, .08], hind: [.3, .35, .34, .22, .08], carnivore: true }),
  cervid: M({ archetype: 'cervid', posture: 'unguligrade', withers: 1.0, massKg: 70, trunk: 1.0, neck: .6, skull: .3, snout: .55, tail: .15, tailCount: 12, width: .12,
    fore: [.3, .25, .3, .25, .08], hind: [.3, .3, .33, .33, .08], carnivore: false }),
  leporid: M({ archetype: 'leporid', posture: 'plantigrade', withers: .22, massKg: 1.5, trunk: 1.6, neck: .35, skull: .55, snout: .4, tail: .2, tailCount: 15, width: .2,
    fore: [.3, .35, .4, .2, .1], hind: [.35, .55, .6, .55, .15], carnivore: false }),
  rodent: M({ archetype: 'rodent', posture: 'plantigrade', withers: .08, massKg: .2, trunk: 2.0, neck: .4, skull: .7, snout: .35, tail: 2.2, tailCount: 22, width: .25,
    fore: [.3, .3, .3, .15, .1], hind: [.3, .35, .35, .3, .12], carnivore: false }),
  'rodent-large': M({ archetype: 'rodent-large', posture: 'plantigrade', withers: .3, massKg: 20, trunk: 2.4, neck: .4, skull: .5, snout: .4, tail: 1.0, tailCount: 24, width: .3,
    fore: [.3, .3, .28, .15, .1], hind: [.3, .35, .32, .3, .12], carnivore: false }),
  insectivore: M({ archetype: 'insectivore', posture: 'plantigrade', withers: .03, massKg: .01, trunk: 2.5, neck: .4, skull: .9, snout: .5, tail: 1.5, tailCount: 18, width: .3,
    fore: [.3, .3, .3, .15, .1], hind: [.3, .32, .32, .25, .1], carnivore: false }),
  bat: M({ archetype: 'bat', posture: 'bat', withers: .03, massKg: .01, trunk: 1.6, neck: .4, skull: .6, snout: .35, tail: 1.2, tailCount: 10, width: .3,
    fore: [.4, 1.0, 1.5, .1, 1.3], hind: [.3, .5, .5, .25, .1], foreDigits: 4, carnivore: false }),
} satisfies Record<string, MammalPlan>;
export type MammalArchetype = keyof typeof MAMMAL_PLANS;

/**
 * Native mammals reachable from the globe landing but not on the Thunder Bay checklist (issue #162: the viewer
 * had the grizzly borrowing the black-bear row). Grizzly: shoulder hump about 1.05 m on all fours (see bearBody.ts);
 * adult mass 145 kg, the midpoint of interior adults: males average 190 kg, females about 100 kg (COSEWIC grizzly status report ch. 2, citing McLellan 1994).
 * Arctic fox (tundra landings, #192): shoulder about 0.28 m, adult mass about 3.5 kg (Audet et al. 2002, Mammalian Species 713) [verify].
 */
export const MAMMALS_BEYOND_CHECKLIST = ['Grizzly Bear', 'Arctic Fox'];
function MAMMALS_BEYOND_CHECKLIST_ROWS(): [string, 'ursid', number, number][] { return [['Grizzly Bear', 'ursid', 1.05, 145], ['Arctic Fox', 'canid', .28, 3.5]]; }

/** Native mammals of the Thunder Bay district checklist: [common name, plan, shoulder height m, mass kg, tail/withers override?]. */
export const MAMMALS: [string, MammalArchetype, number, number, number?][] = [
  ['Gray Wolf', 'canid', .74, 40], ['Coyote', 'canid', .55, 15], ['Red Fox', 'canid', .38, 5, 1.0], ['Gray Fox', 'canid', .36, 4.5, 1.0],
  ['Canada Lynx', 'felid', .55, 10], ['Bobcat', 'felid', .5, 9], ['Cougar', 'felid', .7, 55, 1.1],
  ['Striped Skunk', 'procyonid', .18, 3, 1.2], ['Northern Raccoon', 'procyonid', .3, 7],
  ['Wolverine', 'mustelid', .4, 15, .5], ['North American River Otter', 'mustelid', .25, 9, 1.6], ['American Marten', 'mustelid', .15, 1.1], ['Ermine', 'mustelid', .06, .2],
  ['American Mink', 'mustelid', .1, 1], ['Fisher', 'mustelid', .25, 4], ['American Badger', 'mustelid', .23, 8, .5],
  ['American Black Bear', 'ursid', .9, 100],
  ['Moose', 'cervid', 1.9, 450], ['Elk', 'cervid', 1.45, 300], ['White-tailed Deer', 'cervid', 1.0, 70], ['Woodland Caribou', 'cervid', 1.15, 120],
  ['Snowshoe Hare', 'leporid', .22, 1.5],
  ['Beaver', 'rodent-large', .3, 20, .9], ['Porcupine', 'rodent-large', .3, 9, .7], ['Woodchuck', 'rodent-large', .2, 4, .6], ['Muskrat', 'rodent-large', .12, 1.1, 1.5],
  ['Rock Vole', 'rodent', .03, .04, .9], ['Meadow Vole', 'rodent', .03, .04, .6], ['Southern Red-backed Vole', 'rodent', .03, .03, .7], ['Deer Mouse', 'rodent', .03, .02, 2.5],
  ['Eastern Heather Vole', 'rodent', .03, .03, .5], ['Southern Bog Lemming', 'rodent', .03, .03, .4], ['Woodland Jumping Mouse', 'rodent', .03, .02, 4], ['Meadow Jumping Mouse', 'rodent', .03, .02, 4],
  ['Northern Flying Squirrel', 'rodent', .06, .12], ['Least Chipmunk', 'rodent', .04, .05], ['Eastern Chipmunk', 'rodent', .05, .1], ['Eastern Gray Squirrel', 'rodent', .1, .5], ['Red Squirrel', 'rodent', .08, .2],
  ['Northern Short-tailed Shrew', 'insectivore', .03, .02, .6], ['Arctic Shrew', 'insectivore', .025, .01], ['Masked Shrew', 'insectivore', .02, .005], ['Smoky Shrew', 'insectivore', .02, .007],
  ['Pygmy Shrew', 'insectivore', .015, .003], ['Water Shrew', 'insectivore', .03, .015], ['Star-nosed Mole', 'insectivore', .03, .05, .8],
  ['Big Brown Bat', 'bat', .03, .02], ['Silver-haired Bat', 'bat', .025, .01], ['Eastern Red Bat', 'bat', .025, .012], ['Hoary Bat', 'bat', .03, .03], ['Little Brown Myotis', 'bat', .02, .008], ['Northern Myotis', 'bat', .02, .007],
  ...MAMMALS_BEYOND_CHECKLIST_ROWS(),
];
/** On the checklist but introduced after European arrival — not generated for a 1400s world. */
export const MAMMALS_POST_1400 = ['European Hare', 'House Mouse', 'Norway Rat', 'Nutria'];

const Bd = (o: Omit<BirdPlan, 'kind' | 'provisional' | 'flight' | 'caudals'> & { flight?: boolean; caudals?: number }): BirdPlan => ({ kind: 'bird', provisional: true, flight: true, caudals: 6, ...o });
/** Bird body plans. Ratios are to bill-to-tail length. Neck counts provisional except the owl (14). */
export const BIRD_PLANS = {
  songbird: Bd({ archetype: 'songbird', length: .15, neckCount: 14, neck: .14, skull: .12, beak: .07, body: .45, wing: [.18, .22, .25], leg: [.12, .2, .16, .1], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  corvid: Bd({ archetype: 'corvid', length: .5, neckCount: 14, neck: .14, skull: .11, beak: .1, body: .42, wing: [.18, .22, .24], leg: [.1, .17, .14, .08], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  raptor: Bd({ archetype: 'raptor', length: .55, neckCount: 14, neck: .14, skull: .1, beak: .06, body: .45, wing: [.25, .3, .3], leg: [.1, .17, .14, .09], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  owl: Bd({ archetype: 'owl', length: .55, neckCount: 14, neck: .12, skull: .14, beak: .04, body: .45, wing: [.25, .28, .28], leg: [.1, .17, .12, .08], toes: 'zygodactyl', headTwist: 270, neckAngle: 160 }),
  waterfowl: Bd({ archetype: 'waterfowl', length: .58, neckCount: 16, neck: .3, skull: .08, beak: .1, body: .45, wing: [.2, .22, .24], leg: [.08, .12, .07, .08], toes: 'anisodactyl', headTwist: 180, neckAngle: 140 }),
  swan: Bd({ archetype: 'swan', length: 1.4, neckCount: 25, neck: .45, skull: .06, beak: .08, body: .4, wing: [.2, .22, .22], leg: [.06, .1, .06, .07], toes: 'anisodactyl', headTwist: 180, neckAngle: 160 }),
  grouse: Bd({ archetype: 'grouse', length: .45, neckCount: 14, neck: .14, skull: .09, beak: .04, body: .5, wing: [.15, .16, .16], leg: [.1, .15, .1, .08], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  diver: Bd({ archetype: 'diver', length: .8, neckCount: 15, neck: .2, skull: .08, beak: .1, body: .5, wing: [.17, .18, .18], leg: [.06, .14, .1, .1], toes: 'anisodactyl', headTwist: 180, neckAngle: 130 }),
  wader: Bd({ archetype: 'wader', length: 1.15, neckCount: 19, neck: .35, skull: .06, beak: .13, body: .3, wing: [.22, .26, .24], leg: [.08, .28, .25, .1], toes: 'anisodactyl', headTwist: 180, neckAngle: 165 }),
  rail: Bd({ archetype: 'rail', length: .25, neckCount: 14, neck: .15, skull: .1, beak: .1, body: .45, wing: [.13, .14, .13], leg: [.1, .2, .17, .17], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  shorebird: Bd({ archetype: 'shorebird', length: .25, neckCount: 14, neck: .15, skull: .09, beak: .15, body: .4, wing: [.2, .24, .26], leg: [.1, .22, .2, .09], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  gull: Bd({ archetype: 'gull', length: .6, neckCount: 14, neck: .15, skull: .09, beak: .09, body: .42, wing: [.28, .32, .32], leg: [.08, .14, .1, .08], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  pelecaniform: Bd({ archetype: 'pelecaniform', length: .8, neckCount: 17, neck: .25, skull: .07, beak: .1, body: .4, wing: [.24, .28, .28], leg: [.07, .12, .08, .1], toes: 'anisodactyl', headTwist: 180, neckAngle: 145 }),
  pigeon: Bd({ archetype: 'pigeon', length: .3, neckCount: 12, neck: .13, skull: .09, beak: .05, body: .48, wing: [.18, .22, .25], leg: [.08, .14, .1, .08], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  cuckoo: Bd({ archetype: 'cuckoo', length: .3, neckCount: 13, neck: .12, skull: .08, beak: .07, body: .35, wing: [.15, .18, .2], leg: [.08, .12, .09, .07], toes: 'zygodactyl', headTwist: 180, neckAngle: 150 }),
  nightjar: Bd({ archetype: 'nightjar', length: .24, neckCount: 13, neck: .1, skull: .12, beak: .03, body: .4, wing: [.2, .26, .3], leg: [.05, .08, .05, .05], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  swift: Bd({ archetype: 'swift', length: .13, neckCount: 13, neck: .1, skull: .12, beak: .03, body: .45, wing: [.12, .2, .45], leg: [.04, .06, .04, .05], toes: 'pamprodactyl', headTwist: 180, neckAngle: 150 }),
  hummingbird: Bd({ archetype: 'hummingbird', length: .08, neckCount: 13, neck: .12, skull: .12, beak: .2, body: .4, wing: [.12, .18, .4], leg: [.04, .05, .03, .04], toes: 'anisodactyl', headTwist: 180, neckAngle: 150 }),
  kingfisher: Bd({ archetype: 'kingfisher', length: .32, neckCount: 13, neck: .1, skull: .12, beak: .17, body: .38, wing: [.15, .18, .2], leg: [.05, .07, .04, .06], toes: 'syndactyl', headTwist: 180, neckAngle: 150 }),
  woodpecker: Bd({ archetype: 'woodpecker', length: .25, neckCount: 14, neck: .13, skull: .11, beak: .1, body: .42, wing: [.16, .2, .22], leg: [.08, .12, .09, .08], toes: 'zygodactyl', headTwist: 180, neckAngle: 150 }),
} satisfies Record<string, BirdPlan>;
export type BirdArchetype = keyof typeof BIRD_PLANS;

/** Every group on the Thunder Bay bird checklist (376 species): [group, plan, representative species, length m, approx species count].
 *  Bald Eagle is split out of Hawks, Kites and Eagles as its own row (issue #162) because it is far longer than the red-tailed hawk:
 *  71-96 cm bill to tail (Cornell All About Birds), so 0.85 m; the hawk group keeps the other 12 species. */
export const BIRD_GROUPS: [string, BirdArchetype, string, number, number][] = [
  ['Ducks and Geese', 'waterfowl', 'Mallard', .58, 37], ['Swans', 'swan', 'Trumpeter Swan', 1.5, 3], ['Partridges, Grouse and Turkeys', 'grouse', 'Ruffed Grouse', .45, 8],
  ['Grebes', 'diver', 'Horned Grebe', .35, 5], ['Pigeons and Doves', 'pigeon', 'Mourning Dove', .3, 7], ['Cuckoos and Anis', 'cuckoo', 'Black-billed Cuckoo', .3, 3],
  ['Goatsuckers', 'nightjar', 'Common Nighthawk', .24, 3], ['Swifts', 'swift', 'Chimney Swift', .13, 2], ['Hummingbirds', 'hummingbird', 'Ruby-throated Hummingbird', .08, 2],
  ['Rails, Gallinules and Coots', 'rail', 'Sora', .22, 5], ['Cranes', 'wader', 'Sandhill Crane', 1.1, 1], ['Stilts and Avocets', 'shorebird', 'American Avocet', .45, 1],
  ['Plovers', 'shorebird', 'Killdeer', .25, 6], ['Sandpipers and Phalaropes', 'shorebird', 'Spotted Sandpiper', .19, 30], ['Jaegers', 'gull', 'Parasitic Jaeger', .45, 3],
  ['Alcids', 'diver', 'Ancient Murrelet', .25, 1], ['Gulls and Terns', 'gull', 'Herring Gull', .6, 21], ['Loons', 'diver', 'Common Loon', .8, 3],
  ['Shearwaters and Petrels', 'gull', 'Northern Fulmar', .47, 1], ['Cormorants and Pelicans', 'pelecaniform', 'Double-crested Cormorant', .8, 2], ['Herons and Bitterns', 'wader', 'Great Blue Heron', 1.15, 10],
  ['Vultures and Osprey', 'raptor', 'Osprey', .58, 3], ['Hawks, Kites and Eagles', 'raptor', 'Red-tailed Hawk', .55, 12], ['Bald Eagle', 'raptor', 'Bald Eagle', .85, 1], ['Owls', 'owl', 'Great Horned Owl', .55, 11],
  ['Kingfishers', 'kingfisher', 'Belted Kingfisher', .32, 1], ['Woodpeckers', 'woodpecker', 'Pileated Woodpecker', .42, 10], ['Caracaras and Falcons', 'raptor', 'Merlin', .27, 5],
  ['Tyrant Flycatchers', 'songbird', 'Eastern Kingbird', .2, 18], ['Shrikes', 'songbird', 'Northern Shrike', .24, 2], ['Vireos', 'songbird', 'Red-eyed Vireo', .14, 7],
  ['Crows and Jays', 'corvid', 'Common Raven', .6, 6], ['Larks', 'songbird', 'Horned Lark', .18, 1], ['Swallows', 'songbird', 'Tree Swallow', .14, 7],
  ['Chickadees, Nuthatches and Creepers', 'songbird', 'Black-capped Chickadee', .13, 5], ['Wrens', 'songbird', 'House Wren', .12, 7], ['Gnatcatchers and Kinglets', 'songbird', 'Ruby-crowned Kinglet', .1, 3],
  ['Old World Flycatchers', 'songbird', 'Northern Wheatear', .15, 1], ['Thrushes', 'songbird', 'American Robin', .25, 10], ['Mockingbirds and Thrashers', 'songbird', 'Gray Catbird', .22, 4],
  ['Waxwings', 'songbird', 'Cedar Waxwing', .17, 2], ['Pipits', 'songbird', 'American Pipit', .16, 2], ['Finches', 'songbird', 'Evening Grosbeak', .18, 10],
  ['Longspurs and Snow Buntings', 'songbird', 'Snow Bunting', .16, 4], ['New World Warblers', 'songbird', 'Ovenbird', .14, 35], ['New World Sparrows', 'songbird', 'Song Sparrow', .15, 26],
  ['Cardinals and Allies', 'songbird', 'Rose-breasted Grosbeak', .2, 11], ['New World Blackbirds', 'songbird', 'Red-winged Blackbird', .22, 13],
];
/** On the checklist but introduced after European arrival — not generated for a 1400s world. */
export const BIRDS_POST_1400 = ['European Starling', 'House Sparrow', 'Rock Pigeon'];

export function mammalSkeleton(name: string): Skeleton {
  const row = MAMMALS.find(r => r[0] === name); if (!row) throw new Error(`Unknown mammal ${name}`);
  const [, arch, withers, massKg, tail] = row, base = MAMMAL_PLANS[arch];
  return buildMammal(name, { ...base, withers, massKg, tail: tail ?? base.tail });
}
export function birdSkeleton(group: string): Skeleton {
  const row = BIRD_GROUPS.find(r => r[0] === group); if (!row) throw new Error(`Unknown bird group ${group}`);
  const [, arch, species, length] = row;
  return buildBird(species, { ...BIRD_PLANS[arch], length });
}

/** Snowshoe hare (Lepus americanus). Matthew's numbers are the calm, fed defaults: graze 3 s, head up 1 s, sprint 3 s, pause
 *  1 s; stamina emptied by 8 s of flight, refilled by 8 s of rest. Energy and diet are nature-checked (the numbers table in tasks/handoffs/T-0009-grokbot-3.md):
 *  energy 100 = one summer day's food, 167 g DM (captive snowshoe hares, Seeley Lake MT, UMT thesis); spent over a real day
 *  (100 per 86 400 s), x8 in flight [estimate: sprint vs daily-average metabolism, verify]. Clover (1 unit = 15 mg DM, core/fields):
 *  167 g = 11 133 units, so 111 units = +1 energy; cropping rate = 167 g over 8.7 h/day foraging x 26 % of it
 *  actually cropping (Belovsky 1984, Theor. Popul. Biol., doi:10.1016/0040-5809(84)90009-1) = 20.5 mg/s = 4.1 units per 3 s bite bout. Senses / mood bends are game calibration. Hares are crepuscular with
 *  large eyes (good dim-light vision: night floor .45) and very mobile ears [game calibration, verify]. */
export const HARE_AGENT: AgentSpecies = {
  id: 'hare',
  labels: { feed: 'graze', step: 'graze (next section)', approach: 'relax: trot to clover', seek: 'relax: seek sunlight', scan: 'scan', rest: 'relax: rest', alert: 'alert (head up)', flee: 'flight', pause: 'flight pause', hide: 'freeze (no stamina)', held: 'held', tame: 'tame' },
  senses: {
    sight: { range: 26, night: .45, motion: [.5, 2], presence: 4, crouched: .5, movingAt: .25 }, // .5 m/s = slow stealth: slower is not "moving"
    hearing: { range: 22, loud: [1.5, 7], movingAt: .08 },
    // range 2 m [verify: no Lepus detection distance found]. Same fine-scale cutoff as deer scat
    // (van Ginkel et al. 2019, PLoS ONE 14(11):e0223248, Kuijper "circa two meters").
    scent: { potency: .8, range: DEER_TRACE_RANGE_M },
  },
  // Droppings: 167 g DM/day and assimilation 0.36 give the faeces; 576 pellets/day summer (Rivera 2005, UMT thesis, 576±108).
  // One clover unit is 15 mg DM (CLOVER.mgPerUnit). Fresh clover ~17% DM, so unitsPerWetKg converts a sim bite (wet kg).
  traces: {
    response: { scent: -1, carcass: -1, droppings: 0 },
    droppings: { groupG: 167 * (1 - 0.36) / 576, fecesGPerUnit: 0.015 * (1 - 0.36), unitsPerWetKg: 0.17 / 0.015 * 1000 },
  },
  fear: { wolf: 1 },
  levels: {
    energy: { max: 100, start: 70, drain: 100 / 86400, fleeMult: 8, fed: 80, full: 97 },
    stamina: { max: 100, drainSeconds: 8, recoverSeconds: 8 },
    relaxation: { max: 100, threatDrop: 60, fleeDrop: 12, recover: 3, panic: .6 },
  },
  // alertTurn 0 (run 4): the freeze is motionless (same source), so the body does not swing round to the wolf.
  // react 1 s: snowshoe hares freeze first, relying on crypsis, and only then flee (Emmel 2024, UMT MSc thesis, "The Hare and
  // the Hawk"; Chapman & Flux 2008); the ~1 s hold is read from the reference video (refs/hare/graze-alert-flight attempt 4)
  // [estimate: no measured freeze duration found]. Inside flee.distance the hare bolts at once.
  // Sourcing check (grok, T-0009 run 12): a feeding leporid's head-up scan between bites lasts 3.6 s on average (subtle
  // vigilance, head above the shoulder in the feeding posture, still chewing; 95 per hour; overt upright vigilance 12.3 s,
  // 20 per hour: European rabbits, Monclus & Rodel 2008, Ethology 114:287, Fig. 2, read from the bars). Matthew's feed 3 s
  // and calm scanChance .1 give a mean interscan of ~30 s, inside that study's 26-38 s; his 1 s scan is shorter than the
  // sourced 3.6 s and is kept (his spec, pinned by tests/agent.test.ts) until he decides.
  timing: { feed: 3, scan: 1, alert: 1, alertMin: .3, react: 1, alertTurn: 0, flee: 3, pause: 1, rest: [2, 4], jitter: .15 },
  mood: { boutNerve: .6, boutHunger: 1, scanChance: [.1, .9], scanHunger: .4, scanNerve: 1.5, scanHungerShort: .3,
    notice: [.06, .3], noticeHunger: .6, bolt: [.55, .8], boltHunger: .2, fleeNerve: .3, fleeStaminaFull: 40, pauseNerve: .4, resume: .8, unhide: .25 },
  utility: { feedHere: .5, approach: .4, approachDistance: 60, rest: 1, restFull: .6, restBase: .05, scan: .8, seek: .7, seekBase: .05, noise: .05 },
  reach: { food: 20, seek: 10, step: [.25, .45], stepTurn: .5, giveUp: 25 },
  // accel 10 m/s^2: top flight speed in ~3 bounds (0.85 s at ~4 Hz) as in the reference video; below the cheetah's measured
  // 13 m/s^2 peak (Wilson et al. 2013, Nature 498:185) [estimate: no measured hare acceleration found; Williams et al. 2007
  // J Anat 210:472 describe the hare pelvic limb as specialised for acceleration without a value].
  speed: { feedStep: .35, approach: 1.2, flee: 8.5, fleeTired: 5, accel: 10 },
  // distance 3.7 m: mean flight initiation distance of radio-collared snowshoe hares approached on foot, 224 approaches,
  // 74 hares (Emmel 2024, UMT MSc thesis, Fig. 1: 3.97 m winter-brown, 3.02 m winter-white; less concealed hares flee earlier).
  flee: { burstSeconds: 2.5, zig: [.45, .9], zigAngle: .35, distance: 3.7 },
  diet: { clover: { eatUnits: 4.1, eatSeconds: 3, unitsPerEnergy: 111 } },
};

/** White-tailed deer (Odocoileus virginianus). Energy 100 = one day of food. Graze, head-up and herd alarm come from
 *  senses and levels (T-0011). The social row is what turns the shared pipeline off dice: bout lengths are herdBouts,
 *  alarm delay is sound travel plus attention, and a chew fires on bite mass. Numbers that are estimates are marked.
 *  The hare row has no social field and does not read these. */
export const DEER_AGENT: AgentSpecies = {
  id: 'deer',
  labels: { feed: 'graze', step: 'graze (next step)', approach: 'walk to browse', seek: 'seek cover', scan: 'head up', rest: 'bedded', alert: 'alert', flee: 'flight', pause: 'alert', hide: 'freeze (no stamina)', held: 'held', tame: 'tame' },
  senses: {
    // range 80 m [estimate: between Lingle & Wilson 2001 stalking alerts under 30 m and open alerts at 125-200 m].
    // night 0.35 [estimate]. presence 30 m [estimate].
    sight: { range: 80, night: .35, motion: [.4, 2], presence: 30, crouched: .5, movingAt: .3 },
    // range 60 m [estimate]. loud band is a walk-to-run footfall.
    hearing: { range: 60, loud: [1.2, 6], movingAt: .1 },
    // range 2 m: deer leave wolf scat within about 2 m (Kuijper, via van Ginkel et al. 2019, PLoS ONE 14(11):e0223248).
    // That paper's urine response was inside 0.5 m. One cutoff is the scat distance; urine uses the same 2 m.
    scent: { potency: .7, range: DEER_TRACE_RANGE_M },
  },
  // Pellet group: dry faeces = 70 kg * 0.022 * (1-0.55) per day (FAUNA, Ullrey et al. 1970 digestibility).
  // 34.4 groups/day, July-August, free-ranging Minnesota (Rogers 1987, J. Wildl. Manage. 51:330). Summer rate only.
  // fecesGPerUnit uses the 0.35 dry fraction already flagged on the diet row. FAUNA's penned-winter 12.7 is not this rate.
  traces: {
    response: { scent: -1, carcass: -1, droppings: 0 },
    droppings: { groupG: 70 * 0.022 * (1 - 0.55) * 1000 / 34.4, fecesGPerUnit: 0.35 * (1 - 0.55) },
  },
  fear: { wolf: 1 },
  levels: {
    // 100 energy = one day. Daily DM midpoint 3% of the 70 kg species row = 2.1 kg (MSU Extension / Prevention and
    // Control of Wildlife Damage: 2-4% of live weight; adult bucks in spring 2.0-2.9 kg air-dry/day).
    // fleeMult 8 [estimate, same order as the hare sprint multiplier; no deer factorial scope].
    energy: { max: 100, start: 70, drain: 100 / 86400, fleeMult: 8, fed: 80, full: 97 },
    // 45 s empties a gallop of a few hundred metres; 45 s refills it [estimate: not a timed trial]. burstSeconds is below.
    stamina: { max: 100, drainSeconds: 45, recoverSeconds: 45 },
    // recover 5/s: from 40, calmAt 70 is 6 s after the cue is gone. A steady cue holds the settle line (updateLevels).
    relaxation: { max: 100, threatDrop: 40, fleeDrop: 8, recover: 5, panic: .8 },
  },
  // scan 3 s [estimate: no white-tailed head-up duration found; elk bouts in Fortin et al. 2004 Oikos 107:172 are a few seconds].
  // feed 5.333 s is the lone calm bout (scan * 0.64/0.36); herdBouts recomputes it from the vigilance share.
  // jitter 0 and a huge zig so even a fall-through cannot roll a duration. react is unused on the social path.
  timing: { feed: 3 * .64 / .36, scan: 3, alert: 1, alertMin: .3, react: 0, alertTurn: 0, flee: 8, pause: 1, rest: [6, 12], jitter: 0 },
  mood: { boutNerve: .5, boutHunger: .8, scanChance: [0, 0], scanHunger: 0, scanNerve: .4, scanHungerShort: .2,
    notice: [.06, .18], noticeHunger: .4, bolt: [.35, .65], boltHunger: .15, fleeNerve: .2, fleeStaminaFull: 40, pauseNerve: .3, resume: .8, unhide: .3 },
  utility: { feedHere: .6, approach: .35, approachDistance: 40, rest: 1, restFull: .8, restBase: .05, scan: .5, seek: .3, seekBase: 0, noise: 0 },
  reach: { food: 12, seek: 16, step: [.3, .5], stepTurn: .4, giveUp: 20 },
  // flee 35 mph = 15.6464 m/s (SUNY ESF "White-tailed Deer", secondary natural-history page, not a timed trial).
  // fleeTired: Heglund & Taylor 1988 JEB 138:301 preferred gallop, 2.78 * mass^0.116.
  // feedStep 0.4 and approach 1.3 [estimate]. accel 6 m/s^2 [estimate: top speed in ~2.6 s].
  speed: { feedStep: .4, approach: 1.3, flee: 35 * .44704, fleeTired: 2.78 * 70 ** .116, accel: 6 },
  // distance 30 m: Lingle & Wilson 2001 Ethology 107:125, stalking attacks alerted under 30 m. zig is unused (social flight does not roll).
  flee: { burstSeconds: 6, zig: [1e6, 1e6], zigAngle: 0, distance: 30 },
  // 7.8 g fresh/min (Koerth & Stuth 1991 J Range Manage 44(6), stem elongation). 60 g fresh = +1 energy:
  // (2.1 kg DM / 0.35) / 100. The 0.35 dry fraction is an estimate; the fresh rate is not inflated to close the daily budget.
  diet: { browse: { eatUnits: 7.8, eatSeconds: 60, unitsPerEnergy: 60 } },
  social: {
    link: 60, // m [estimate: a mate at 50 m is linked; a wolf at 70 m is below calm notice on motion sight]
    loneVigilance: .36, // [estimate: Lashley 2014 Fig. 3 intercept is not in the text. Three steps of 0.07 stay inside 0..1 through group size 4]
    vigilancePerMate: .07, // Lashley et al. 2014 PLoS ONE 9:e90652: females +7 percentage points of feeding time per extra deer
    vigilanceCap: 4, // same paper: females do not gain past group size 4
    snort: 200, // m [estimate: Atkeson, Marchinton & Miller 1988, the snort is the alarm call; no measured audibility]
    sound: 343, // m/s, dry air near 20 C
    attend: .25, // s [estimate: no deer reaction-time constant; weaker cues take attend/cue]
    calmAt: 70,
    cohesionAt: 8, cohesion: .6, // [estimate: a few body lengths]
    biteG: 7.8 / 7.1, // g fresh. 7.1 bites/min is Yucatan females (scialert tasr.2006.105.112), a smaller subspecies [population mismatch]
    scatter: .4, // rad [estimate]
    turn: 4, // rad/s, the old herd flee turn
  },
};
/** Virtual browse (T-0011). The contact key stays `browse:ground`. The grazed delta is one 8 m cell (T-0015),
 *  so two deer on the same ground share the sward and a stripped cell comes back from sun hours.
 *  nearest returns nothing when the deer is already on this key, so it feeds here instead of trotting to an origin.
 *  `at` stashes the feet; `eat` runs in the same call and depletes that cell. */
let browseAt = { x: 0, z: 0 };
export const BROWSE: FoodSource = {
  at: (x, z) => {
    browseAt = { x, z };
    const units = browseGrams(x, z);
    return units > 1e-6 ? { key: 'browse:ground', x, z, r: 4, units } : undefined;
  },
  nearest: (x, z, _range, except) => {
    if (except === 'browse:ground') return undefined;
    browseAt = { x, z };
    const units = browseGrams(x, z);
    return units > 1e-6 ? { key: 'browse:ground', x, z, r: 4, units } : undefined;
  },
  eat: (key, units, by) => {
    const ran = TRANSACTIONS.run(by, key, units);
    if (!(ran > 0)) return 0;
    return takePatch({ key: browseCellKey(browseAt.x, browseAt.z), x: browseAt.x, z: browseAt.z, kind: 'browse', grams: ran, by });
  },
};
TRANSACTIONS.add({
  a: 'deer', b: 'browse', name: 'graze', needsContact: true,
  source: 'Koerth & Stuth 1991 J Range Manage 44(6): stem-elongation mean instantaneous intake 7.8 g fresh/min (range 2.6-16.6); methods weighed fresh branches',
  run: (grams: number) => grams,
});


/** Gray wolf (Canis lupus), the autonomous player (T-0010). Every rate that already lives on WOLF_NEEDS is read from there
 *  (one row, not a second copy). Mood bends, the 1.2 m lure hold and `full` are the shared pipeline's shape: game
 *  calibration, flagged, not a measured wolf ethogram. Water and bed-down stay on chooseGoal (core/needs/behaviour),
 *  which already steers the wolf when those drives win; this row is scent, forage, rest and travel. */
const WOLF_L = agentLevels(WOLF_NEEDS);
const WOLF_S = WOLF_NEEDS.senses;
export const WOLF_AGENT: AgentSpecies = {
  id: 'wolf',
  labels: { feed: 'feeding', step: 'feeding (next bite)', approach: 'travelling', seek: 'seeking', scan: 'watching', rest: 'resting', alert: 'alert', flee: 'fleeing', pause: 'checking back', hide: 'hiding', held: 'held', tame: 'tame' },
  senses: {
    sight: { range: WOLF_S.sight.rangeM.v, night: WOLF_S.sight.night.v, motion: WOLF_S.sight.motion.v, presence: WOLF_S.sight.presenceM.v, crouched: WOLF_S.sight.crouched.v, movingAt: .25 },
    hearing: { range: WOLF_S.hearing.rangeM.v, loud: WOLF_S.hearing.loud.v, movingAt: .08 },
    // range 2400 m: Mech 1970, The Wolf, the same ~2.4 km already on WOLF_NEEDS.senses.smell. Body odor stays on the HUD range.
    scent: { potency: WOLF_S.smell.potency.v, range: WOLF_SCENT_RANGE_M },
  },
  // A carcass is investigated (fear scale +1). Own marks and droppings are smelled and not followed. No wolf scat row:
  // a kill's gut is the carcass writer, and wolf faeces are not a separate delta.
  traces: { response: { carcass: 1, scent: 0, droppings: 0 } },
  fear: { person: 1 },
  levels: {
    energy: { max: 100, start: 70, drain: WOLF_L.energy.drain, fleeMult: activityFactor(WOLF_NEEDS, WOLF_NEEDS.body.speeds.sprint.v), fed: WOLF_NEEDS.behaviour.drives.energy.seekBelow.v, full: 90 },
    stamina: { max: WOLF_L.stamina.max, drainSeconds: WOLF_L.stamina.drainSeconds, recoverSeconds: WOLF_L.stamina.recoverSeconds },
    relaxation: { max: 100, threatDrop: 40, fleeDrop: 8, recover: 4, panic: .8 },
  },
  // feed 60 s is one mouthful at 7.8 g/min (the diet row). react is the needs head-up. Wolves orient (alertTurn);
  // they do not freeze. Rest [2, 5] s is how often a settled wolf re-checks, not the 1.02 h inactivity bout.
  timing: { feed: 60, scan: 2, alert: 1, alertMin: .3, react: WOLF_NEEDS.behaviour.alert.reactSeconds.v, alertTurn: 3, flee: 4, pause: 1, rest: [2, 5], jitter: .1 },
  mood: { boutNerve: .4, boutHunger: .6, scanChance: [.05, .4], scanHunger: .2, scanNerve: .5, scanHungerShort: .2,
    notice: [.08, .25], noticeHunger: .3, bolt: [.4, .7], boltHunger: .1, fleeNerve: .2, fleeStaminaFull: 40, pauseNerve: .3, resume: .7, unhide: .3 },
  utility: { feedHere: .8, approach: .6, approachDistance: 40, rest: 1, restFull: .4, restBase: .15, scan: .3, seek: .2, seekBase: 0, noise: .02, investigate: .5 },
  reach: { food: 40, seek: 20, step: [.4, .8], stepTurn: .4, giveUp: 30 },
  // approach is the sustained lope (Mech & Boitani 2003, 8–9 km/h, WOLF_NEEDS tiredSpeed), not the player's 4 m/s button.
  // flee is the game sprint (7 m/s), below the measured 15.5 m/s top, same citation as WOLF_NEEDS.body.speeds.sprint.
  speed: { feedStep: .8, approach: WOLF_NEEDS.behaviour.evasion.tiredSpeed.v, flee: WOLF_NEEDS.body.speeds.sprint.v, fleeTired: WOLF_NEEDS.behaviour.evasion.tiredSpeed.v },
  flee: { burstSeconds: 4, zig: [0, 0], zigAngle: 0, distance: WOLF_NEEDS.behaviour.flight.distanceM.v },
  // 7.8 g fresh/min is the deer mouthful (Koerth & Stuth 1991), shared so the bout is units / rate. Not a measured
  // wolf blueberry rate. unitsPerEnergy stays Infinity: berry joules are applied once in autonomousWolfStep
  // (WOLF_BERRY_G_PER_ENERGY), not a second time by the pipeline, and not the flat FORAGE_ENERGY of 18.
  diet: { forage: { eatUnits: 7.8, eatSeconds: 60, unitsPerEnergy: Infinity } },
};
TRANSACTIONS.add({
  a: 'wolf', b: 'forage', name: 'bite', needsContact: true,
  source: 'Koerth & Stuth 1991, 7.8 g fresh/min, shared mouthful. Berry joules: USDA FDC 171711, 57 kcal/100 g; 100 energy = WOLF_NEEDS fmrKjPerDay.',
  run: (grams: number) => grams,
});

/** One game day in real seconds (clock.realSecondsPerGameHour × 24). Visitor metabolism uses this clock,
 *  not a wall-clock day: a play session is one boreal day (systemProperties, design: 2 real hours). */
export const PERSON_DAY_S = 24 * REAL_SECONDS_PER_GAME_HOUR;
/** Comfortable gait, men in their 20s: 139.3 cm/s. Bohannon 1997, Age Ageing 26:15, doi:10.1093/ageing/26.1.15. */
export const PERSON_WALK_MPS = 1.393;
/** Maximum gait without running, same table, men in their 20s: 253.3 cm/s. A sprint is faster; this is the fast walk. */
export const PERSON_FAST_MPS = 2.533;
/** FDA Nutrition Facts reference diet. Not a measured visitor; the scale is 100 energy = this day. */
export const PERSON_KCAL_DAY = 2000;
/** Blueberries, raw, 57 kcal/100 g. USDA FoodData Central FDC 171711 (highbush; the mesh is lowbush, same order). */
export const PERSON_KCAL_PER_100G = 57;
/** USDA portion: 50 raw blueberries weigh 68 g, so one berry is 1.36 g. */
export const PERSON_BERRY_G = 68 / 50;
/** [estimate] one berry each second while the hand is in the patch. The gram weight is the USDA portion; the cadence is not. */
export const PERSON_PICK_PER_S = 1;
/** Thirst line on a meter where 100 = euhydrated and 0 = 10% of body mass lost as water.
 *  70 = a 3% body-mass deficit. Engell et al. 1987, Physiol. Behav. 40:229, thirst after 3, 5 and 7% losses. */
export const PERSON_WATER_SEEK = 70;
/** Grams of fresh berry per +1 energy: (kcal/day ÷ 100) / (kcal/g). */
export const PERSON_G_PER_ENERGY = (PERSON_KCAL_DAY / 100) / (PERSON_KCAL_PER_100G / 100);
/** Joules in one gram of raw blueberry, and grams of that fruit per +1 wolf energy (100 energy = one day of FMR). */
export const WOLF_BERRY_J_PER_G = PERSON_KCAL_PER_100G / 100 * 4184;
export const WOLF_BERRY_G_PER_ENERGY = WOLF_NEEDS.body.fmrKjPerDay.v * 1000 / 100 / WOLF_BERRY_J_PER_G;
/** [estimate] how long a pick bout lasts. The rate is PERSON_BERRY_G per second; the bout length only groups it. */
export const PERSON_PICK_BOUT_S = 8;

/** Visitor (a person). Same AgentSpecies as the hare and the wolf (T-0012). Hunger is energy, berries are the forage
 *  diet, water and a friend are lures (core/visitors.ts). Fear of the wolf is the stranger's reaction; a friend record
 *  is not passed as a threat. Mood bends, the 8 s pick bout, sight range and the 8 m step-back are flagged in visitors.ts. */
export const PERSON_AGENT: AgentSpecies = {
  id: 'person',
  labels: { feed: 'picking berries', step: 'next berries', approach: 'walking', seek: 'looking', scan: 'watching', rest: 'sitting', alert: 'watching the wolf', flee: 'stepping back', pause: 'checking', hide: 'still', held: 'held', tame: 'with a friend' },
  senses: {
    // range 40 m [estimate: a wolf-sized animal in the open, not a measured detection distance under canopy].
    // night 0.2 [estimate]. presence 8 m [estimate: a still wolf is noticed only when close].
    sight: { range: 40, night: .2, motion: [.4, 1.8], presence: 8, crouched: .5, movingAt: .3 },
    // range 30 m [estimate]. loud band is a walk-to-fast-walk footfall.
    hearing: { range: 30, loud: [1.2, 2.5], movingAt: .15 },
    // range 2 m [estimate: no measured human trace-avoidance distance; the deer scat cutoff, same fine scale].
    scent: { potency: .2, range: DEER_TRACE_RANGE_M }, // [estimate] people are poor at scent; sight does the noticing
  },
  traces: { response: { scent: -1, carcass: -1 } },
  fear: { wolf: 1 },
  levels: {
    // 100 energy = one reference day (PERSON_KCAL_DAY), spent over one game day (PERSON_DAY_S), not 86400 wall seconds.
    energy: { max: 100, start: 70, drain: 100 / PERSON_DAY_S, fleeMult: 2, fed: 80, full: 97 },
    // Fast-walk bursts are short. 30 s empties the meter [estimate: not a timed trial]. Comfortable gait does not spend it.
    stamina: { max: 100, drainSeconds: 30, recoverSeconds: 60 },
    relaxation: { max: 100, threatDrop: 35, fleeDrop: 6, recover: 4, panic: .8 },
  },
  // feed bout matches the diet. rest [8, 8] s is how often a seated visitor looks again [estimate], not a sleep.
  // jitter 0 and noise 0: the choice is the need. alertTurn 2.5 rad/s [estimate] finishes a quarter-turn inside a second.
  // react 30 s: the shared pipeline bolts a moving cue once `react` elapses. A visitor steps back from distance
  // (flee.distance), not from that timer, so the timer stays longer than a watch.
  timing: { feed: PERSON_PICK_BOUT_S, scan: 2, alert: 2, alertMin: .4, react: 30, alertTurn: 2.5, flee: 3, pause: 1, rest: [8, 8], jitter: 0 },
  mood: { boutNerve: .3, boutHunger: .4, scanChance: [0, .2], scanHunger: .1, scanNerve: .3, scanHungerShort: .1,
    notice: [.12, .28], noticeHunger: .1, bolt: [.72, .95], boltHunger: 0, fleeNerve: .15, fleeStaminaFull: 40, pauseNerve: .2, resume: .75, unhide: .4 },
  // approach base 0: only hunger walks them to berries. feedHere 0: only hunger keeps them picking.
  // investigate weights a water or friend lure. noise 0 so a gate can score the path.
  utility: { feedHere: 0, approach: 0, approachDistance: 40, rest: 1, restFull: .5, restBase: .08, scan: .15, seek: 0, seekBase: 0, noise: 0, investigate: .6 },
  reach: { food: 40, seek: 12, step: [.25, .4], stepTurn: .3, giveUp: 40 },
  // feedStep [estimate]: a shuffle in the patch. approach and flee are Bohannon 1997 (see the constants above).
  speed: { feedStep: .4, approach: PERSON_WALK_MPS, flee: PERSON_FAST_MPS, fleeTired: PERSON_WALK_MPS },
  // distance 8 m [estimate]: inside this a stranger steps back. Farther, they turn and watch. Yellowstone's 100-yard
  // wildlife rule is a park instruction not to approach, not a measured flight distance, so it is not this number.
  flee: { burstSeconds: 3, zig: [0, 0], zigAngle: 0, distance: 8 },
  diet: { forage: { eatUnits: PERSON_BERRY_G * PERSON_PICK_PER_S * PERSON_PICK_BOUT_S, eatSeconds: PERSON_PICK_BOUT_S, unitsPerEnergy: PERSON_G_PER_ENERGY } },
};

/** Behaviour rows. Deer is T-0011, the person row is T-0012: the same AgentSpecies, data only.
 *  The hare bound gait stays HARE_GAIT in core/needs/species (already on main) and is not copied here. */
export const BEHAVIOUR: { hare: AgentSpecies; deer: AgentSpecies; wolf: AgentSpecies; person: AgentSpecies } = { hare: HARE_AGENT, deer: DEER_AGENT, wolf: WOLF_AGENT, person: PERSON_AGENT };
