/**
 * Viewer-side consumer of the simulation's landing population (issue #192).
 *
 * `sharedPlanetSim().landingPopulation` is the wasm list (species id, whole animals
 * in a 5 km square). This file places a capped subset on the ground in front of the
 * player, asks the picture ladder for the Meshy model, and keeps a procedural body
 * until that model is skinned. It does not edit the Rust density table.
 */
import * as THREE from 'three';
import type { Motion } from '../core/animalBehavior';
import {
  LANDING_CENSUS_SIDE_M, LANDING_DISPLAY, LANDING_YEAR, pickLandingSlots, placeLandingAnimals,
  type CensusRow, type PlacedAnimal,
} from '../core/landingRoster';
import { liveCoastM, sharedPlanetSim } from '../core/planetWeather';
import { SITE, siteDirection, siteLatitude } from '../core/sitePhase';
import { SITE as SUN_HOME } from '../core/weather';
import { dayAt, hourAt, lighting, sunPosition } from '../core/timeOfDay';
import { worldSec } from '../core/worldClock';
import { isDryLand, WORLD_SEED, heightAt } from '../core/world';
import { PLANET, fromLatLon, planetFor, toLatLon, vegetationWeight } from '../world/globe/planet';
import { nearestShore } from '../core/landingShore';
import { coverKind } from '../world/globe/coverKind';
import { groundForCover, sampleDem, samplePhotoVegetation } from '../world/globe/openTiles';
import { createProceduralAnimal, type ProceduralAnimal } from './proceduralAnimal';
import type { PictureBody } from './animalPicture';

export interface LandingReport {
  ready: boolean;
  remote: boolean;
  /** Geographic point under the player, the point the census was asked for. */
  lat: number;
  lon: number;
  elevM: number;
  vegetation: number;
  water: boolean;
  biome: string;
  /** True when the player stands on water and elevM, vegetation, water and biome come from the nearest shore point (#192). */
  shore?: boolean;
  /** Click from ?latlon=, when the descent was aimed at one. */
  clickLat: number | null;
  clickLon: number | null;
  census: { species: string; display: string; count: number }[];
  shown: { species: string; count: number; x: number; z: number }[];
  /** Simulation milliseconds since the previous paint (the draw dt). Wall-clock frame time is measured by the capture script. */
  frameMs: number;
  /** Same sun the sky uses at this landing. A read of the clock, not a change to the sky. */
  lighting: LandingLight;
  /** Set when the wasm list could not be read. The cast stays empty rather than inventing animals. */
  note: string;
}

export interface LandingLight {
  hour: number;
  dayOfYear: number;
  latitude: number;
  sunElevation: number;
  day: number;
  golden: number;
  night: number;
  /** day, golden hour, twilight, or night. */
  state: 'day' | 'golden' | 'twilight' | 'night';
}

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Move the cast when the player walks off, or when the wolf turns far enough that the cast leaves the view. */
export function castShouldReplace(origin: { x: number; z: number; yaw: number }, x: number, z: number, yaw: number) {
  const moved = Math.hypot(x - origin.x, z - origin.z) > 12;
  const turn = Math.atan2(Math.sin(yaw - origin.yaw), Math.cos(yaw - origin.yaw));
  return moved || Math.abs(turn) > 0.35;
}

/** Sun at the landed site, using the sky's latitude rule (`siteLatitude` of the Kenora station). */
export function landingLight(sec = worldSec()): LandingLight {
  const hour = hourAt(sec);
  const dayOfYear = dayAt(sec);
  const latitude = siteLatitude(SUN_HOME.lat);
  const sun = sunPosition(hour, dayOfYear, latitude);
  const light = lighting(sun.elevation);
  const state: LandingLight['state'] = light.night > 0.8 ? 'night' : light.day < 0.35 ? 'twilight' : light.golden > 0.35 ? 'golden' : 'day';
  return {
    hour: round(hour), dayOfYear, latitude: round(latitude, 3), sunElevation: round(sun.elevation, 1),
    day: round(light.day), golden: round(light.golden), night: round(light.night), state,
  };
}

const EMPTY: LandingReport = {
  ready: false, remote: false, lat: 0, lon: 0, elevM: 0, vegetation: 0, water: false, biome: '',
  clickLat: null, clickLon: null, census: [], shown: [], frameMs: 0, lighting: landingLight(0), note: '',
};

/** Where the player is standing, in the same frame the landing bridge uses. */
export function landingContext(x: number, z: number) {
  const planet = planetFor(WORLD_SEED);
  const remote = Number.isFinite(SITE.latDeg);
  const dir = remote ? siteDirection(x, z, PLANET.radius) : planet.fromLocal(x, z);
  const ll = toLatLon(dir);
  const at = groundAt(planet, ll.lat * 180 / Math.PI, ll.lon * 180 / Math.PI, dir);
  // A lake or sea landing: census the nearest shore inside the same 5 km square instead of an empty list (#192).
  const shore = at.water ? nearestShore(at.lat, at.lon, (la, lo) => groundAt(planet, la, lo)) : null;
  const census = shore ?? at;
  return { ...census, lat: at.lat, lon: at.lon, censusLat: census.lat, censusLon: census.lon, shore: shore != null, remote };
}

/** Cover inputs at one geographic point: DEM height and land win over the seeded planet, a cached photo's vegetation wins. */
function groundAt(planet: ReturnType<typeof planetFor>, lat: number, lon: number, dir = fromLatLon(lat * Math.PI / 180, lon * Math.PI / 180)) {
  const s = planet.sampleSurface(dir);
  const { water, elevM } = groundForCover(s, sampleDem(lat, lon));
  // A cached satellite photo wins over the seeded planet's vegetation (#192 desert finding).
  const vegetation = samplePhotoVegetation(lat, lon) ?? vegetationWeight(s, dir);
  const biome = coverKind(lat, elevM, vegetation, water, liveCoastM(lat, lon)); // live coast distance (#235): continental interiors lift the tree line
  return { lat, lon, elevM, vegetation, water, biome };
}

function clickFromSearch() {
  if (typeof location === 'undefined') return { clickLat: null as number | null, clickLon: null as number | null };
  const raw = new URLSearchParams(location.search).get('latlon');
  if (!raw) return { clickLat: null, clickLon: null };
  const [a, b] = raw.split(',');
  const lat = Number(a), lon = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { clickLat: null, clickLon: null };
  return { clickLat: lat, clickLon: lon };
}

export function createLandingCast(scene: THREE.Scene) {
  const procs = new Map<string, ProceduralAnimal>();
  let report: LandingReport = { ...EMPTY };
  let key = '';
  let wanted = '';
  let placed: PlacedAnimal[] = [];
  let slots: ReturnType<typeof pickLandingSlots> = [];
  let origin = { x: 0, z: 0, yaw: 0 };
  let census: CensusRow[] = [];
  let loading = false;
  let lastTime = 0;

  function publish(note = report.note) {
    const click = clickFromSearch();
    const shownCount = new Map<string, number>();
    for (const animal of placed) shownCount.set(animal.display, (shownCount.get(animal.display) ?? 0) + 1);
    report = {
      ...report,
      ...click,
      ready: !loading && key !== '',
      census: census.filter(row => row.count > 0).map(row => ({
        species: row.species,
        display: LANDING_DISPLAY[row.species] ?? row.species,
        count: row.count,
      })),
      shown: placed.map(animal => ({ species: animal.display, count: shownCount.get(animal.display) ?? 1, x: animal.x, z: animal.z })),
      lighting: landingLight(),
      note,
    };
    (globalThis as { borealLanding?: () => LandingReport }).borealLanding = () => report;
  }

  function clearBodies() {
    for (const proc of procs.values()) {
      scene.remove(proc.root);
      proc.root.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        const mat = mesh.material as THREE.Material | undefined;
        if (mesh.isMesh && mat && !mat.userData.shared) mat.dispose();
      });
    }
    procs.clear();
    placed = [];
  }

  function anchor(ctx: ReturnType<typeof landingContext>, x: number, z: number, yaw: number) {
    const next = `${ctx.lat.toFixed(2)}:${ctx.lon.toFixed(2)}:${ctx.water ? 1 : 0}`;
    wanted = next;
    if (next === key || loading) return;
    loading = true;
    const asked = next;
    const at = ctx;
    void sharedPlanetSim().then(sim => {
      loading = false;
      if (wanted !== asked) return;
      if (!sim) {
        key = asked;
        census = [];
        clearBodies();
        report = { ...report, ...at, note: 'wasm landing_population unavailable' };
        publish(report.note);
        return;
      }
      const pop = sim.landingPopulation(at.censusLat, at.censusLon, at.elevM, at.vegetation, at.water, LANDING_YEAR, LANDING_CENSUS_SIDE_M);
      key = asked;
      census = pop.map(row => ({ species: row.species, count: row.count }));
      clearBodies();
      slots = pickLandingSlots(census);
      origin = { x, z, yaw };
      placed = [];
      for (const animal of placeLandingAnimals(slots, origin, (px, pz) => isDryLand(px, pz))) {
        const proc = createProceduralAnimal(animal.display);
        if (!proc) continue;
        proc.root.userData.animalPicture = true;
        proc.root.userData.landingCast = true;
        proc.root.userData.species = animal.display;
        scene.add(proc.root);
        procs.set(`${animal.key}:${animal.index}`, proc);
        placed.push(animal);
      }
      report = { ...report, ...at, note: '' };
      publish();
    }).catch(() => {
      loading = false;
      publish('wasm landing_population failed');
    });
  }

  return {
    report: () => report,
    /** Remote landings hide Kenora deer and hares the census does not include. Home is unchanged. */
    forbids(display: string) {
      if (!report.ready || !report.remote) return false;
      const keyName = Object.entries(LANDING_DISPLAY).find(([, name]) => name === display)?.[0];
      if (!keyName) return false;
      return !census.some(row => row.count > 0 && row.species === keyName);
    },
    sync(x: number, z: number, yaw: number, time: number): PictureBody[] {
      if (lastTime) report.frameMs = Math.max(0, time - lastTime) * 1000;
      lastTime = time;
      const ctx = landingContext(x, z);
      report = { ...report, ...ctx };
      anchor(ctx, x, z, yaw);
      // The glide carries the player, and the embody can turn the wolf after the list arrives.
      // Either one leaves the cast off to the side, where the picture drops it (farther than 8 m and outside the view).
      if (placed.length && castShouldReplace(origin, x, z, yaw)) {
        origin = { x, z, yaw };
        placed = placeLandingAnimals(slots, origin, (px, pz) => isDryLand(px, pz))
          .filter(animal => procs.has(`${animal.key}:${animal.index}`));
      }
      const motion: Motion = 'walk';
      const phase = (time * 0.65) % 1;
      const bodies: PictureBody[] = [];
      for (const animal of placed) {
        const proc = procs.get(`${animal.key}:${animal.index}`);
        if (!proc) continue;
        const y = heightAt(animal.x, animal.z);
        proc.pose(motion, phase, 1.2);
        proc.root.position.set(animal.x, y, animal.z);
        proc.root.rotation.y = animal.yaw;
        bodies.push({
          key: `landing:${animal.key}:${animal.index}`,
          species: animal.display,
          x: animal.x, y, z: animal.z,
          yaw: animal.yaw,
          moving: true,
          motion, phase, speed: 1.2,
          root: proc.root,
        });
      }
      publish();
      return bodies;
    },
  };
}
