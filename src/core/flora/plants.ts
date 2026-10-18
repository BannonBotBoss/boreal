/**
 * Boreal ground flora (Grok Bot): flowers and shrubs of the Kenora / Lake of the Woods area as DATA rows for ONE plant generator
 * (render/flora/plant.ts) and ONE placement process (core/flora/site: niche suitability + Thomas clusters). Rule 2/3: a new
 * plant = a new row.
 * Sources (dimensions, organ counts, phyllotaxis, bloom): Flora of North America (FNA, efloras.org) treatments; habitats:
 * Baldwin & Sims 1997 (Field Guide to the Common Forest Plants in Northwestern Ontario, OMNR) and the NWO FEC ordination
 * (Sims et al. 1997); bloom windows: Ontario/Manitoba iNaturalist phenology (research-grade, NW Ontario) [verify];
 * colours sampled from CC-licensed reference photos (Wikimedia Commons, list in AGENT-NOTES) - tuning only, never shipped.
 * Values from memory of those treatments are tagged [verify] until checked line by line.
 */
import type { Dist } from '../../proc/rng';
import type { Cluster, Niche } from './site';

export type LeafShape = 'lanceolate' | 'ovate' | 'elliptic' | 'linear' | 'round' | 'needle' | 'trifoliate';
export type Arrangement = 'alternate' | 'opposite' | 'whorled' | 'basal';
export type Inflorescence = 'solitary' | 'raceme' | 'umbel' | 'cyme' | 'corymb' | 'pair';
export interface FloraSpec {
  id: string; latin: string; form: 'herb' | 'shrub'; evergreen?: boolean;
  height: Dist;                     // m, mature
  stems: number; branching: number; // shrubs: stems from the base, side branches per stem (0 = unbranched herb)
  stemColour: string; stemRadius: number;
  leaf: { shape: LeafShape; arrangement: Arrangement; perNode: number; nodes: number; length: number; width: number; colour: string; fall?: string; droop: number };
  flower?: { kind: Inflorescence; count: number; petals: number; petalLength: number; petalWidth: number; open: number; nod: number; cup: number; colour: string; centre: string; bloom: [number, number] };
  niche: Niche; cluster: Cluster;
}
const HERB = { stems: 1, branching: 0 };
/** κ per m² (clusters), μ plants per cluster, σ m [game calibration, verify against plot data]. */
export const FLORA: FloraSpec[] = [
  // Fireweed: 4 petals 10-20 mm, raceme of ~15-50, stem 0.5-2 m, alternate lanceolate leaves 5-20 cm; Jul-Aug; burns/openings (FNA vol. 10) [verify]
  { id: 'fireweed', latin: 'Chamerion angustifolium', form: 'herb', ...HERB, height: { mean: 1.1, sd: .3, min: .5, max: 1.8 }, stemColour: '#7a3b4a', stemRadius: .004,
    leaf: { shape: 'lanceolate', arrangement: 'alternate', perNode: 1, nodes: 22, length: .12, width: .018, colour: '#3f6b2e', fall: '#a3342b', droop: .5 },
    flower: { kind: 'raceme', count: 18, petals: 4, petalLength: .016, petalWidth: .012, open: 1.2, nod: 0, cup: .002, colour: '#c8408f', centre: '#e8d0e0', bloom: [190, 245] },
    niche: { wet: [.5, .3], light: [1, .35], rock: .2 }, cluster: { kappa: .0012, mu: 9, sigma: 1.4 } },
  // Twinflower: paired nodding pink bells 8-15 mm on a forked peduncle 5-10 cm; creeping, opposite round leaves 1-2 cm; Jun-Jul; mossy conifer shade (FNA vol. 18) [verify]
  { id: 'twinflower', latin: 'Linnaea borealis', form: 'herb', ...HERB, evergreen: true, height: { mean: .08, sd: .02, min: .05, max: .12 }, stemColour: '#6b4a32', stemRadius: .0008,
    leaf: { shape: 'round', arrangement: 'opposite', perNode: 2, nodes: 3, length: .014, width: .012, colour: '#355e2a', droop: .9 },
    flower: { kind: 'pair', count: 2, petals: 5, petalLength: .011, petalWidth: .006, open: .35, nod: 2.2, cup: .002, colour: '#f2b3c6', centre: '#f7e6ea', bloom: [165, 200] },
    niche: { wet: [.55, .25], light: [.3, .3], rock: .1 }, cluster: { kappa: .008, mu: 25, sigma: .5 } },
  // Bunchberry: 4 white petal-like bracts 1-2.5 cm, whorl of 4-6 leaves 2-8 cm, 10-20 cm tall; Jun-Jul; moist conifer/mixedwood (FNA vol. 12) [verify]
  { id: 'bunchberry', latin: 'Cornus canadensis', form: 'herb', ...HERB, height: { mean: .14, sd: .03, min: .08, max: .22 }, stemColour: '#4f6a35', stemRadius: .0015,
    leaf: { shape: 'ovate', arrangement: 'whorled', perNode: 6, nodes: 1, length: .06, width: .03, colour: '#3c6a2c', fall: '#8a2e3a', droop: .15 },
    flower: { kind: 'solitary', count: 1, petals: 4, petalLength: .017, petalWidth: .013, open: 1.45, nod: 0, cup: .002, colour: '#f3f1e4', centre: '#7d8a4a', bloom: [155, 190] },
    niche: { wet: [.5, .25], light: [.4, .35], rock: .1 }, cluster: { kappa: .01, mu: 30, sigma: .6 } },
  // Prickly wild rose: 5 pink petals, flowers 4-6 cm across; shrub 0.3-1.2 m, pinnate leaves (drawn as ovate leaflets); Jun-Jul; open forest, edges (FNA vol. 9) [verify]
  { id: 'rose', latin: 'Rosa acicularis', form: 'shrub', height: { mean: .7, sd: .2, min: .3, max: 1.2 }, stems: 3, branching: 3, stemColour: '#6e3b2c', stemRadius: .004,
    leaf: { shape: 'ovate', arrangement: 'alternate', perNode: 5, nodes: 8, length: .03, width: .018, colour: '#41672f', fall: '#b5452a', droop: .4 },
    flower: { kind: 'solitary', count: 4, petals: 5, petalLength: .025, petalWidth: .024, open: 1.35, nod: 0, cup: .004, colour: '#de5f8e', centre: '#f0c63a', bloom: [160, 195] },
    niche: { wet: [.35, .25], light: [.75, .3], rock: .3 }, cluster: { kappa: .002, mu: 4, sigma: 1.2 } },
  // Wood lily: one (-3) upright orange-red cup of 6 tepals 5-8 cm; stem 30-60 cm with whorled lanceolate leaves; late Jun-Jul; dry open sand/rock (FNA vol. 26) [verify]
  { id: 'woodlily', latin: 'Lilium philadelphicum', form: 'herb', ...HERB, height: { mean: .45, sd: .1, min: .3, max: .65 }, stemColour: '#4d6b33', stemRadius: .003,
    leaf: { shape: 'lanceolate', arrangement: 'whorled', perNode: 6, nodes: 3, length: .07, width: .012, colour: '#46733a', droop: .4 },
    flower: { kind: 'solitary', count: 1, petals: 6, petalLength: .06, petalWidth: .022, open: .75, nod: 0, cup: .01, colour: '#e3521f', centre: '#f0a023', bloom: [175, 205] },
    niche: { wet: [.2, .2], light: [.9, .3], rock: .7 }, cluster: { kappa: .0008, mu: 3, sigma: 2 } },
  // Bluebead lily: 3-8 nodding yellow-green bells (tepals 1.5-2 cm) in an umbel on a 15-40 cm scape; 2-3 basal leaves 15-30 cm; Jun; moist shade (FNA vol. 26) [verify]
  { id: 'bluebead', latin: 'Clintonia borealis', form: 'herb', ...HERB, height: { mean: .28, sd: .06, min: .15, max: .4 }, stemColour: '#5b7a3a', stemRadius: .002,
    leaf: { shape: 'elliptic', arrangement: 'basal', perNode: 3, nodes: 1, length: .2, width: .06, colour: '#2f6a2a', droop: .9 },
    flower: { kind: 'umbel', count: 5, petals: 6, petalLength: .017, petalWidth: .006, open: .3, nod: 2.4, cup: .003, colour: '#d9d66e', centre: '#c9c25a', bloom: [150, 180] },
    niche: { wet: [.6, .25], light: [.3, .3], rock: 0 }, cluster: { kappa: .004, mu: 12, sigma: .8 } },
  // Wild strawberry: 5 white petals, flowers 1.5-2.5 cm in a cyme; trifoliate basal leaves; 5-15 cm; May-Jun; open, dry-fresh (FNA vol. 9) [verify]
  { id: 'strawberry', latin: 'Fragaria virginiana', form: 'herb', ...HERB, height: { mean: .1, sd: .03, min: .05, max: .16 }, stemColour: '#6a7a40', stemRadius: .001,
    leaf: { shape: 'trifoliate', arrangement: 'basal', perNode: 4, nodes: 1, length: .05, width: .03, colour: '#3d6e30', fall: '#9c2f2a', droop: .7 },
    flower: { kind: 'cyme', count: 4, petals: 5, petalLength: .008, petalWidth: .008, open: 1.45, nod: 0, cup: .001, colour: '#f6f5ee', centre: '#e5c42b', bloom: [140, 172] },
    niche: { wet: [.3, .25], light: [.85, .3], rock: .4 }, cluster: { kappa: .004, mu: 15, sigma: .9 } },
  // Pearly everlasting: corymb of many white heads 5-10 mm (yellow centres); 20-80 cm; alternate linear grey-green leaves; Jul-Sep; dry open (FNA vol. 19) [verify]
  { id: 'everlasting', latin: 'Anaphalis margaritacea', form: 'herb', ...HERB, height: { mean: .45, sd: .12, min: .2, max: .8 }, stemColour: '#9aa38a', stemRadius: .0025,
    leaf: { shape: 'linear', arrangement: 'alternate', perNode: 1, nodes: 16, length: .07, width: .008, colour: '#6f8263', droop: .3 },
    flower: { kind: 'corymb', count: 14, petals: 10, petalLength: .004, petalWidth: .002, open: 1.1, nod: 0, cup: .0005, colour: '#f4f2e7', centre: '#d8b54a', bloom: [200, 260] },
    niche: { wet: [.2, .2], light: [.95, .3], rock: .6 }, cluster: { kappa: .0015, mu: 7, sigma: 1.5 } },
  // Lowbush blueberry: 5-60 cm, branched, alternate elliptic leaves 1.5-3.5 cm, red in fall; jack pine / outcrops (FNA vol. 8) [verify]
  { id: 'blueberry', latin: 'Vaccinium angustifolium', form: 'shrub', height: { mean: .25, sd: .08, min: .1, max: .45 }, stems: 4, branching: 4, stemColour: '#7a3d2a', stemRadius: .002,
    leaf: { shape: 'elliptic', arrangement: 'alternate', perNode: 1, nodes: 10, length: .025, width: .01, colour: '#3f6c2c', fall: '#a82a22', droop: .3 },
    niche: { wet: [.3, .2], light: [.7, .35], rock: .7 }, cluster: { kappa: .006, mu: 10, sigma: .9 } },
  // Labrador tea: 30-100 cm, evergreen, alternate revolute leaves 2-5 cm, rusty beneath; black spruce / peat (FNA vol. 8) [verify]
  { id: 'labradortea', latin: 'Rhododendron groenlandicum', form: 'shrub', evergreen: true, height: { mean: .55, sd: .15, min: .3, max: .9 }, stems: 3, branching: 3, stemColour: '#6a4a33', stemRadius: .003,
    leaf: { shape: 'linear', arrangement: 'alternate', perNode: 1, nodes: 12, length: .04, width: .009, colour: '#34572a', droop: .6 },
    niche: { wet: [.85, .15], light: [.5, .35], rock: 0, soils: { peat: 2, sand: .3 } }, cluster: { kappa: .004, mu: 8, sigma: 1 } },
  // Speckled alder: multi-stemmed 2-5 m, alternate ovate doubly-serrate leaves 5-10 cm; shores, swamps (FNA vol. 3, Alnus incana ssp. rugosa) [verify]
  { id: 'alder', latin: 'Alnus incana ssp. rugosa', form: 'shrub', height: { mean: 2.8, sd: .7, min: 1.5, max: 4.5 }, stems: 5, branching: 5, stemColour: '#5d5650', stemRadius: .025,
    leaf: { shape: 'ovate', arrangement: 'alternate', perNode: 1, nodes: 14, length: .08, width: .055, colour: '#3c6630', fall: '#7a7a2e', droop: .4 },
    niche: { wet: [.9, .15], light: [.7, .3], rock: 0 }, cluster: { kappa: .0006, mu: 3, sigma: 2 } },
  // Willows (Salix bebbiana / S. discolor): 1-4 m, alternate elliptic-lanceolate leaves 3-8 cm; wet openings, shores (FNA vol. 7) [verify]
  { id: 'willow', latin: 'Salix bebbiana / S. discolor', form: 'shrub', height: { mean: 2.2, sd: .6, min: 1, max: 4 }, stems: 4, branching: 4, stemColour: '#6b5a3c', stemRadius: .018,
    leaf: { shape: 'lanceolate', arrangement: 'alternate', perNode: 1, nodes: 14, length: .06, width: .018, colour: '#55753c', fall: '#b8a03a', droop: .3 },
    niche: { wet: [.8, .2], light: [.85, .3], rock: .1 }, cluster: { kappa: .0005, mu: 3, sigma: 2.5 } },
  // Common juniper: low spreading mats 0.3-1 m, awl leaves 8-15 mm in whorls of 3; rock outcrops, dry open (FNA vol. 2) [verify]
  { id: 'juniper', latin: 'Juniperus communis var. depressa', form: 'shrub', evergreen: true, height: { mean: .5, sd: .15, min: .25, max: .9 }, stems: 6, branching: 4, stemColour: '#6a4b36', stemRadius: .006,
    leaf: { shape: 'needle', arrangement: 'whorled', perNode: 3, nodes: 9, length: .012, width: .0015, colour: '#3f5f43', droop: .2 },
    niche: { wet: [.15, .2], light: [.9, .3], rock: 1.2, soils: { bedrock: 1.5, sand: 1.2 } }, cluster: { kappa: .0008, mu: 2, sigma: 1.5 } },
];
export const FLORA_BY_ID = Object.fromEntries(FLORA.map(f => [f.id, f])) as Record<string, FloraSpec>;
