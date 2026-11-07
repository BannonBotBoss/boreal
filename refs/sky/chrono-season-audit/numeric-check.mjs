// Reproduce numbers.json independently from NOAA General Solar Position Calculations
// (https://gml.noaa.gov/grad/solcalc/solareqns.PDF) and Standish (1992) / Meeus (1998) eq. 12.4.
// Run from repository root: node refs/sky/chrono-season-audit/numeric-check.mjs
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sunPosition } from '../../../src/core/timeOfDay.ts';
import { utOf, venusSky } from '../../../src/render/venusSky.ts';

const RAD = Math.PI / 180;

// Independent NOAA Spencer (1971) solar declination + local solar elevation (solareqns.PDF p. 1-2)
function noaaSolarElevationDeg(dayOfYear, solarHour, latDeg) {
  const d = ((Math.floor(dayOfYear) - 1) % 365 + 365) % 365 + 1;
  const gamma = (2 * Math.PI / 365) * (d - 1);
  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const phi = latDeg * RAD;
  const ha = (solarHour - 12) * 15 * RAD;
  const sinEl = Math.sin(phi) * Math.sin(declRad) + Math.cos(phi) * Math.cos(declRad) * Math.cos(ha);
  return Math.asin(Math.max(-1, Math.min(1, sinEl))) / RAD;
}

const checks = [
  {
    id: 'winter-solstice-noon-kenora',
    description: 'Day 355 (Dec 21), 12:00 local solar time at Kenora home site (49.79°N)',
    day: 355,
    hour: 12,
    lat: 49.79,
    chronoGameDeg: sunPosition(12).elevation, // what chronometer.ts currently calls: sunPosition(h) -> day 227, lat 49.5
    datedGameDeg: sunPosition(12, 355, 49.79).elevation,
    noaaReferenceDeg: noaaSolarElevationDeg(355, 12, 49.79),
  },
  {
    id: 'winter-solstice-1630-kenora',
    description: 'Day 355 (Dec 21), 16:30 local solar time at Kenora home site (49.79°N)',
    day: 355,
    hour: 16.5,
    lat: 49.79,
    chronoGameDeg: sunPosition(16.5).elevation, // +25.38° (sun glyph ☀ shown after sunset!)
    datedGameDeg: sunPosition(16.5, 355, 49.79).elevation, // -4.40° (below horizon, moon glyph ☾)
    noaaReferenceDeg: noaaSolarElevationDeg(355, 16.5, 49.79),
  },
  {
    id: 'southern-solstice-noon-tropic',
    description: 'Day 355 (Dec 21), 12:00 local solar time at remote Tropic of Capricorn landing (-23.44°S, 15.0°E)',
    day: 355,
    hour: 12,
    lat: -23.44,
    chronoGameDeg: sunPosition(12).elevation, // +54.80° (fixed August 49.5°N)
    datedGameDeg: sunPosition(12, 355, -23.44).elevation, // +89.96° (near zenith)
    noaaReferenceDeg: noaaSolarElevationDeg(355, 12, -23.44),
  },
  {
    id: 'august-baseline-noon-kenora',
    description: 'Day 227 (Aug 15), 12:00 local solar time at Kenora home site (49.79°N)',
    day: 227,
    hour: 12,
    lat: 49.79,
    chronoGameDeg: sunPosition(12).elevation, // +54.80° (49.5°N default)
    datedGameDeg: sunPosition(12, 227, 49.79).elevation, // +54.51° (49.79°N site)
    noaaReferenceDeg: noaaSolarElevationDeg(227, 12, 49.79),
  },
];

for (const c of checks) {
  c.chronoErrorVsNoaaDeg = c.chronoGameDeg - c.noaaReferenceDeg;
  c.datedErrorVsNoaaDeg = c.datedGameDeg - c.noaaReferenceDeg;
}

const date355 = new Date(Date.UTC(2026, 0, 355));
const venusHomeAtRemote = venusSky(utOf(date355, 12)); // current venusSky.ts line 26: uses Kenora SITE.lat=49.79, SITE.lon=-94.36
const venusSiteAtRemote = venusSky(utOf(date355, 12, 15.0), -23.44, 15.0); // landed site -23.44°S, 15.0°E

const out = {
  source: 'NOAA General Solar Position Calculations (Spencer 1971), https://gml.noaa.gov/grad/solcalc/solareqns.PDF; Standish (1992) JPL Keplerian elements & Meeus (1998) Astronomical Algorithms eq. 12.4',
  calibration: {
    metric: 'Absolute solar/planetary elevation error |game - reference| in degrees',
    knownMatchDeg: Math.abs(sunPosition(12, 355, 49.79).elevation - noaaSolarElevationDeg(355, 12, 49.79)),
    knownMismatchDeg: Math.abs(sunPosition(12).elevation - noaaSolarElevationDeg(355, 12, 49.79)),
    passThresholdDeg: 0.05,
  },
  solarChecks: checks,
  venusRemoteCheck: {
    description: 'Day 355 (2026-12-21), 12:00 local solar time at landed site (-23.44°S, 15.0°E)',
    currentVenusSkyAltDeg: venusHomeAtRemote.alt.elevation,
    currentVenusSkySunAltDeg: venusHomeAtRemote.sunAlt,
    landedSiteReferenceVenusAltDeg: venusSiteAtRemote.alt.elevation,
    landedSiteReferenceSunAltDeg: venusSiteAtRemote.sunAlt,
    venusAltErrorDeg: venusHomeAtRemote.alt.elevation - venusSiteAtRemote.alt.elevation,
    venusSunAltErrorDeg: venusHomeAtRemote.sunAlt - venusSiteAtRemote.sunAlt,
  },
};

writeFileSync(resolve('refs/sky/chrono-season-audit/numbers.json'), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
