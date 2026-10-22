// node refs/terrain/water-cover/fetch.mjs : water share of Ontario's Shield ecoregions from the National Ecological Framework
// for Canada (AAFC, open.canada.ca dataset f4d1abbe-e36d-45ba-b83e-c1591638604f, ESRI REST layer 3 "Land and water area (ha) by
// province/territory and ecoregion", names from layer 0). Compare: game 23.6 % of a 10x10 km square around spawn
// (refs/water/shore-audit/water-fraction.ts on claude/loop, staged terrain).
import { writeFileSync } from 'node:fs';
const B = 'https://services.arcgis.com/lGOekm0RsNxYnT3j/ArcGIS/rest/services/National_ecological_framework_of_Canada_ecoregions/FeatureServer';
const q = async (layer, where, fields) => (await (await fetch(`${B}/${layer}/query?where=${encodeURIComponent(where)}&outFields=${fields}&returnGeometry=false&f=json`)).json()).features.map(f => f.attributes);
const area = await q(3, "PROVINCE_ID='ON'", 'ECOREGION_ID,TOTAL_AREA,LAND_AREA,WATER_AREA');
const names = Object.fromEntries((await q(0, `ECOREGION_ID IN (${[...new Set(area.map(a => a.ECOREGION_ID))]})`, 'ECOREGION_ID,ECOREGION_NAME_EN')).map(a => [a.ECOREGION_ID, a.ECOREGION_NAME_EN]));
const rows = [...new Map(area.map(a => [a.ECOREGION_ID, a])).values()].map(a => ({ id: a.ECOREGION_ID, name: names[a.ECOREGION_ID], total_ha: Math.round(a.TOTAL_AREA), water_pct: +(a.WATER_AREA / a.TOTAL_AREA * 100).toFixed(1) })).sort((a, b) => a.id - b.id);
writeFileSync(new URL('./ontario-ecoregions.json', import.meta.url), JSON.stringify({ fetched: new Date().toISOString(), source: B + '/3', rows }, null, 1)); console.table(rows);
