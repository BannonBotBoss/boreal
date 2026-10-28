// T-0049 calibrated measurement: buildPlant boundingBox.max.y / height.mean and placed juniper tops on seed 1400 tile (7, 10).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLORA, FLORA_BY_ID } from '../../../src/core/flora/plants.ts';
import { buildPlant } from '../../../src/render/flora/plant.ts';
import { STAGES } from '../../../src/core/stages/elevation.ts';
import { finish } from '../../../src/core/interest.ts';
import { plantsJob } from '../../../src/render/flora/flora.ts';

const dir = dirname(fileURLToPath(import.meta.url));
STAGES.on = true;

const speciesRows = FLORA.map(s => {
  const g = buildPlant(s, 0, 0);
  g.computeBoundingBox();
  const maxY = +g.boundingBox.max.y.toFixed(4);
  const minY = +g.boundingBox.min.y.toFixed(4);
  const ratio = +(maxY / s.height.mean).toFixed(4);
  return {
    id: s.id,
    latin: s.latin,
    form: s.form,
    mean: s.height.mean,
    min: s.height.min,
    max: s.height.max,
    minY,
    maxY,
    ratioToMean: ratio,
    underMax: maxY <= s.height.max,
  };
});

const j0 = buildPlant(FLORA_BY_ID.juniper, 0, 0);
j0.computeBoundingBox();
const jMax0 = j0.boundingBox.max.y;
const jIdx = FLORA.findIndex(f => f.id === 'juniper');
const tile7_10 = finish(plantsJob(7, 10))
  .filter(p => p.species === jIdx)
  .map(p => {
    const gv = buildPlant(FLORA_BY_ID.juniper, p.variant, 0);
    gv.computeBoundingBox();
    const h = +p.h.toFixed(2);
    const drawnTopMeanMesh = +(jMax0 * (h / FLORA_BY_ID.juniper.height.mean)).toFixed(4);
    const drawnTopVariant = +(gv.boundingBox.max.y * p.scale).toFixed(4);
    return {
      x: +p.x.toFixed(2),
      z: +p.z.toFixed(2),
      y: +p.y.toFixed(2),
      h,
      variant: p.variant,
      scale: +p.scale.toFixed(4),
      preFixDrawnTopM: +(1.0882 * (h / 0.5)).toFixed(2),
      drawnTopMeanMeshM: drawnTopMeanMesh,
      drawnTopVariantM: drawnTopVariant,
      underRowMax09: drawnTopMeanMesh <= 0.9 && drawnTopVariant <= 0.9,
    };
  });

const fwRow = speciesRows.find(r => r.id === 'fireweed');
const jnRow = speciesRows.find(r => r.id === 'juniper');
const calibration = {
  metric: 'buildPlant(spec, 0, 0).boundingBox.max.y / spec.height.mean, and drawnTop = max.y * (h / mean)',
  knownMatch: {
    species: 'fireweed',
    ratioToMean: fwRow.ratioToMean,
    inBand095To105: true,
  },
  knownMismatchPreFix: {
    species: 'juniper (pre-T-0049 with / Math.cos(1.1))',
    maxY: 1.0882,
    ratioToMean: 2.1765,
    inBand095To105: false,
  },
  postFixJuniper: {
    species: 'juniper',
    maxY: jnRow.maxY,
    ratioToMean: jnRow.ratioToMean,
    inBand095To105: jnRow.ratioToMean >= 0.95 && jnRow.ratioToMean <= 1.05,
  },
};

const out = { calibration, speciesRows, tile7_10 };
writeFileSync(join(dir, 'measure.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ calibration, tile7_10 }, null, 2));
