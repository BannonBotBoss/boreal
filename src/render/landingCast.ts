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
import { sharedPlanetSim } from '../core/planetWeather';
import { SITE, siteDirection } from '../core/sitePhase';
import { isDryLand, WORLD_SEED, heightAt } from '../core/world';
import { PLANET, planetFor, toLatLon, vegetationWeight } from '../world/globe/planet';
import { coverKind } from '../world/globe/coverKind';
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
  /** Click from ?latlon=, when the descent was aimed at one. */
  clickLat: number | null;
  clickLon: number | null;
  census: { species: string; display: string; count: number }[];
  shown: { species: string; count: number; x: number; z: number }[];
  /** Simulation milliseconds since the previous paint (the draw dt). Wall-clock frame time is measured by the capture script. */
  frameMs: number;
  /** Set when the wasm list could not be read. The cast stays empty rather than inventing animals. */
  note: string;
}

const EMPTY: LandingReport = {
  ready: false, remote: false, lat: 0, lon: 0, elevM: 0, vegetation: 0, water: false, biome: '',
  clickLat: null, clickLon: null, census: [], shown: [], frameMs: 0, note: '',
};

/** Where the player is standing, in the same frame the landing bridge uses. */
export function landingContext(x: number, z: number) {
  const planet = planetFor(WORLD_SEED);
  const remote = Number.isFinite(SITE.latDeg);
  const dir = remote ? siteDirection(x, z, PLANET.radius) : planet.fromLocal(x, z);
  const ll = toLatLon(dir);
  const s = planet.sampleSurface(dir);
  const lat = ll.lat * 180 / Math.PI;
  const lon = ll.lon * 180 / Math.PI;
  const water = s.kind === 'ocean' || s.kind === 'lake' || s.h < 0;
  const elevM = Math.max(0, water ? 0 : s.h);
  const vegetation = vegetationWeight(s, dir);
  const biome = coverKind(lat, elevM, vegetation, water);
  return { lat, lon, elevM, vegetation, water, biome, remote };
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
      const pop = sim.landingPopulation(at.lat, at.lon, at.elevM, at.vegetation, at.water, LANDING_YEAR, LANDING_CENSUS_SIDE_M);
      key = asked;
      census = pop.map(row => ({ species: row.species, count: row.count }));
      clearBodies();
      const slots = pickLandingSlots(census);
      placed = placeLandingAnimals(slots, { x, z, yaw }, (px, pz) => isDryLand(px, pz));
      for (const animal of placed) {
        const proc = createProceduralAnimal(animal.display);
        if (!proc) continue;
        proc.root.userData.animalPicture = true;
        proc.root.userData.landingCast = true;
        proc.root.userData.species = animal.display;
        scene.add(proc.root);
        procs.set(`${animal.key}:${animal.index}`, proc);
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
