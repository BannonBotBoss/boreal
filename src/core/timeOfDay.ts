/**
 * Game clock and sun position. One game hour passes every 5 real minutes (a full day takes 2 real hours).
 * The sun follows standard solar geometry for Northwest Ontario: declination (Cooper's formula) and hour angle
 * on local solar time. World axes: −z is north, +x is east, y is up.
 */
export const REAL_SECONDS_PER_GAME_HOUR = 300;
/** Northwest Ontario (Thunder Bay 48.4°N, Kenora 49.8°N). */
export const LATITUDE = 49.5;
/** Season: mid-August (day 227). Change to move the game through the year. */
export const DAY_OF_YEAR = 227;
export const START_HOUR = 8;
const RAD = Math.PI / 180;
import { solar } from './weather';

/** Hour of day (0–24) after `simTime` seconds of unpaused play. */
export function gameHour(simTime: number, startHour = START_HOUR) {
  return ((startHour + simTime / REAL_SECONDS_PER_GAME_HOUR) % 24 + 24) % 24;
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
