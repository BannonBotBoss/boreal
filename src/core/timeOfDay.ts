/**
 * Game clock and sun position. One game hour passes every 5 real minutes (a full day takes 2 real hours).
 * The sun follows standard solar geometry for Northwest Ontario: declination (Cooper's formula) and hour angle
 * on local solar time. World axes: −z is north, +x is east, y is up.
 */
export const REAL_SECONDS_PER_GAME_HOUR: number = SYSTEM_PROPERTIES.clock.realSecondsPerGameHour;
/** Northwest Ontario (Thunder Bay 48.4°N, Kenora 49.8°N). */
export const LATITUDE: number = SYSTEM_PROPERTIES.clock.latitudeDeg;
/** Season: mid-August (day 227). Change to move the game through the year. */
export const DAY_OF_YEAR: number = SYSTEM_PROPERTIES.clock.dayOfYear;
export const START_HOUR: number = SYSTEM_PROPERTIES.clock.startHour;
const RAD = Math.PI / 180;
import { SYSTEM_PROPERTIES } from '../config/systemProperties';
import { solar } from './weather';

/** Hour of day (0–24) after `simTime` seconds of unpaused play. */
export function gameHour(simTime: number, startHour = START_HOUR) {
  return ((startHour + simTime / REAL_SECONDS_PER_GAME_HOUR) % 24 + 24) % 24;
}
/**
 * Runtime time of day (ui/chronometer; ?hour= sets the first value): hours added on top of the world clock, so the hour is
 * always gameHour(worldSec, START_HOUR + DAY.offset). Setting the hour turns the dial, never the world clock (age, growth
 * and seasons hold). The offset stays continuous (scrubbing past midnight moves the date with it) and is persisted.
 */
/** offset: chronometer hours. dayOffset: days added by ?day= / ?date= (and saved with the dial). year: calendar year for the sky. */
export const DAY = { key: 'boreal.hour.v1', offset: 0, dayOffset: 0, year: 2026 };
export const hourAt = (worldSec: number) => gameHour(worldSec, START_HOUR + DAY.offset);
/** Day of the year at world second `worldSec` (follows the dial past midnight, plus any date offset). */
export const dayAt = (worldSec: number) => DAY_OF_YEAR + DAY.dayOffset + Math.floor((START_HOUR + DAY.offset + worldSec / REAL_SECONDS_PER_GAME_HOUR) / 24);
/** UTC date of the clock's day, for the sky and the planets. */
export const clockDate = (worldSec: number) => new Date(Date.UTC(DAY.year, 0, dayAt(worldSec)));
/** Make it `hour` now, by the shortest turn of the dial (never more than 12 h either way). */
export function setHour(hour: number, worldSec: number) { DAY.offset += ((hour - hourAt(worldSec)) % 24 + 36) % 24 - 12; return hourAt(worldSec); }
/** Make today `day` (1–366) without moving the hour. */
export function setDay(day: number, worldSec: number) { DAY.dayOffset += day - dayAt(worldSec); return dayAt(worldSec); }
/** Saved dial: a bare number (older saves) or JSON `{offset, dayOffset, year}`. */
export function saveDay() { return JSON.stringify({ offset: DAY.offset, dayOffset: DAY.dayOffset, year: DAY.year }); }
function readSavedDay(saved: string | null) {
  DAY.offset = 0; DAY.dayOffset = 0; DAY.year = 2026;
  if (saved === null) return;
  const t = saved.trim();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as { offset?: number; dayOffset?: number; year?: number };
      if (Number.isFinite(j.offset)) DAY.offset = j.offset as number;
      if (Number.isFinite(j.dayOffset)) DAY.dayOffset = j.dayOffset as number;
      if (Number.isFinite(j.year)) DAY.year = j.year as number;
    } catch { /* keep the defaults */ }
    return;
  }
  const o = Number(saved); if (Number.isFinite(o)) DAY.offset = o;
}
/** Load the saved dial, then URL: ?hour= sets the hour, ?date=YYYY-MM-DD sets the year and day, ?day= sets the day. */
export function initDay(search: string, saved: string | null, worldSec: number) {
  readSavedDay(saved);
  const q = new URLSearchParams(search), h = Number(q.get('hour'));
  if (q.get('hour') && Number.isFinite(h) && h >= 0 && h < 24) setHour(h, worldSec);
  const date = q.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      DAY.year = d.getUTCFullYear();
      setDay(Math.floor((d.getTime() - Date.UTC(DAY.year, 0, 1)) / 864e5) + 1, worldSec);
    }
  }
  const day = Number(q.get('day'));
  if (q.get('day') && Number.isFinite(day) && day >= 1 && day <= 366) setDay(day, worldSec);
}
const MONTH_LEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MONTH_NAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Calendar label for a game day-of-year. The world year has 365 days (no leap day), matching core/weather. */
export function formatDate(dayOfYear: number) {
  let d = ((Math.floor(dayOfYear) - 1) % 365 + 365) % 365 + 1, m = 0;
  while (m < 11 && d > MONTH_LEN[m]) { d -= MONTH_LEN[m]; m++; }
  return { month: MONTH_NAME[m], day: d, text: `${d} ${MONTH_NAME[m]}` };
}
export function formatHour(hour: number) {
  const h = Math.floor(hour), m = Math.floor((hour - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
/** Solar declination (degrees) for a day of the year. */
/** Solar declination (degrees) at local noon: NOAA General Solar Position (Spencer 1971 series), shared with core/weather. */
export function declination(dayOfYear: number) { return solar(dayOfYear, 12).decl; }
/** Sun elevation and azimuth (degrees; azimuth clockwise from north) and a unit direction toward the sun. */
export function sunPosition(hour: number, dayOfYear = DAY_OF_YEAR, latitude = LATITUDE) {
  const d = declination(dayOfYear) * RAD, phi = latitude * RAD, h = 15 * (hour - 12) * RAD;
  const sinEl = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) + Math.PI;
  return {
    elevation: el / RAD, azimuth: ((az / RAD) % 360 + 360) % 360,
    direction: { x: Math.cos(el) * Math.sin(az), y: Math.sin(el), z: -Math.cos(el) * Math.cos(az) },
  };
}
import { smoothstep as smooth } from '../proc/math';
/** Lighting amounts for a sun elevation: daylight 0–1 (civil twilight blends from −6° to +8°), and a warm low-sun tint 0–1. */
export function lighting(elevation: number) {
  const day = smooth(-6, 8, elevation);
  const golden = smooth(-4, 2, elevation) * (1 - smooth(4, 20, elevation));
  return { day, golden, night: 1 - day };
}
