// Post-fix calibrated numeric check for T-0170 against NOAA General Solar Position Calculations
// (Spencer 1971, https://gml.noaa.gov/grad/solcalc/solareqns.PDF) and Standish (1992) / Meeus (1998) eq. 12.4.
// Run from repository root: npx tsx refs/sky/chrono-season-fix/numeric-check.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { clearSite, setSite } from '../../../src/core/sitePhase.ts';
import { DAY, initDay, setDay, setHour, sunPosition } from '../../../src/core/timeOfDay.ts';
import { siteVenusSky, utOf, venusSky } from '../../../src/render/venusSky.ts';
import { chronoSunState } from '../../../src/ui/chronometer.ts';

const RAD = Math.PI / 180;

function noaaSolarElevationDeg(dayOfYear, solarHour, latDeg) {
  const d = (((Math.floor(dayOfYear) - 1) % 365) + 365) % 365 + 1;
  const gamma = ((2 * Math.PI) / 365) * (d - 1);
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

const cases = [
  { id: 'winter-solstice-noon-kenora', day: 355, hour: 12, remote: null, expectedGlyph: '☀' },
  { id: 'winter-solstice-1630-kenora', day: 355, hour: 16.5, remote: null, expectedGlyph: '☾' },
  { id: 'southern-solstice-noon-tropic', day: 355, hour: 12, remote: { lat: -23.44, lon: 15.0 }, expectedGlyph: '☀' },
  { id: 'august-baseline-noon-kenora', day: 227, hour: 12, remote: null, expectedGlyph: '☀' },
];

const solarResults = [];
try {
  initDay('?day=227&hour=12', null, 0);
  for (const c of cases) {
    if (c.remote) {
      setSite({
        latDeg: c.remote.lat,
        lonDeg: c.remote.lon,
        datumM: 0,
        salt: 1,
        dir: [0, 1, 0],
        east: [1, 0, 0],
        north: [0, 0, 1],
      });
    } else {
      clearSite();
    }
    setDay(c.day, 0);
    setHour(c.hour, 0);
    const post = chronoSunState(0);
    const preDeg = sunPosition(c.hour).elevation;
    const noaaDeg = noaaSolarElevationDeg(c.day, c.hour, post.lat);
    solarResults.push({
      id: c.id,
      day: c.day,
      hour: c.hour,
      latDeg: post.lat,
      preFixChronoDeg: preDeg,
      postFixChronoDeg: post.elevation,
      noaaReferenceDeg: noaaDeg,
      preFixAbsErrorDeg: Math.abs(preDeg - noaaDeg),
      postFixAbsErrorDeg: Math.abs(post.elevation - noaaDeg),
      postFixGlyph: post.glyph,
      expectedGlyph: c.expectedGlyph,
      postFixText: post.text,
      pass: Math.abs(post.elevation - noaaDeg) <= 0.05 && post.glyph === c.expectedGlyph,
    });
  }

  const date355 = new Date(Date.UTC(2026, 0, 355));
  clearSite();
  const preVenusAtRemote = venusSky(utOf(date355, 12)); // pre-fix: ignored setSite
  setSite({
    latDeg: -23.44,
    lonDeg: 15.0,
    datumM: 0,
    salt: 1,
    dir: [0, 1, 0],
    east: [1, 0, 0],
    north: [0, 0, 1],
  });
  const postVenusAtRemote = siteVenusSky(date355, 12);
  const refVenusAtRemote = venusSky(utOf(date355, 12, 15.0), -23.44, 15.0);

  const outDir = resolve('refs/sky/chrono-season-fix');
  mkdirSync(outDir, { recursive: true });
  const report = {
    source:
      'NOAA General Solar Position Calculations (Spencer 1971), https://gml.noaa.gov/grad/solcalc/solareqns.PDF; Standish (1992) JPL Keplerian elements & Meeus (1998) Astronomical Algorithms eq. 12.4',
    calibration: {
      metric: 'Absolute elevation angle error |game - reference| in degrees',
      knownMatchDeg: Math.abs(sunPosition(12, 355, 49.79).elevation - noaaSolarElevationDeg(355, 12, 49.79)),
      knownMismatchDeg: Math.abs(sunPosition(12).elevation - noaaSolarElevationDeg(355, 12, 49.79)),
      passThresholdDeg: 0.05,
    },
    solarResults,
    venusRemoteResult: {
      description: 'Day 355 (2026-12-21), 12:00 local solar time at landed site (-23.44°S, 15.0°E)',
      preFixVenusAltDeg: preVenusAtRemote.alt.elevation,
      postFixVenusAltDeg: postVenusAtRemote.alt.elevation,
      referenceVenusAltDeg: refVenusAtRemote.alt.elevation,
      preFixVenusAbsErrorDeg: Math.abs(preVenusAtRemote.alt.elevation - refVenusAtRemote.alt.elevation),
      postFixVenusAbsErrorDeg: Math.abs(postVenusAtRemote.alt.elevation - refVenusAtRemote.alt.elevation),
      preFixSunAltDeg: preVenusAtRemote.sunAlt,
      postFixSunAltDeg: postVenusAtRemote.sunAlt,
      referenceSunAltDeg: refVenusAtRemote.sunAlt,
      preFixSunAbsErrorDeg: Math.abs(preVenusAtRemote.sunAlt - refVenusAtRemote.sunAlt),
      postFixSunAbsErrorDeg: Math.abs(postVenusAtRemote.sunAlt - refVenusAtRemote.sunAlt),
      pass:
        Math.abs(postVenusAtRemote.alt.elevation - refVenusAtRemote.alt.elevation) <= 0.05 &&
        Math.abs(postVenusAtRemote.sunAlt - refVenusAtRemote.sunAlt) <= 0.05,
    },
  };
  writeFileSync(resolve(outDir, 'numbers.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  clearSite();
  DAY.offset = 0;
  DAY.dayOffset = 0;
  DAY.year = 2026;
}
