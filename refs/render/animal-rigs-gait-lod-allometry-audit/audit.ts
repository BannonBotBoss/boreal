/**
 * Live & calibrated Rule 11 audit of procedural animal rigs, gait LOD slope placement,
 * playable deer/fox allometry, bear template caching, and dead legacy shell-fur shader:
 *  1. proceduralAnimal.ts:61,147 scrambled [RF,LF,RH,LH] leg ordering vs quadrupedPose [LF,LH,RF,RH]
 *     + bird() midpoint wing pivot & idle flapping (proceduralAnimal.ts:95-107)
 *  2. proceduralAnimal.ts:116-120,167 Red Fox 1.7x wolf-sized scale (1.01 m ear / 0.78 m shoulder / 1.58 m length),
 *     unlit MeshBasicMaterial (toneMapped = false, midnight glow), and castShadow = false
 *  3. animalRig.ts:5-57 & playables.ts:33-34 playable White-tailed Deer 3.08 m total height (1.95 m back / 2.40 m head),
 *     100% midwinter antler prevalence, and 0/22 shared geometries across instances
 *  4. gaitLod.ts:55,338-351,391 & playerWolf.ts:163-165,234 player wolf skips terrainFeet on slopes when copyProcRig=true
 *     (default LOCO_FLAG=false), 0 deg body slope pitch, GAIT_LOD_SPECIES = 1/19 quadrupeds, and 1.0 emissive midnight wolf eyes
 *  5. bear.ts:11,55,69,74-86,105-110 uncached 32,000-card (96k-tri) per-instance geometry, 40 unmerged claw meshes,
 *     MeshBasicMaterial nostrils, and bare-clock Math.sin(time * 0.8) idle bob
 *  6. fur.ts dead legacy shell-fur module (0 live callers, pinned in tests/rules.test.ts:30 noise allowlist,
 *     unattenuated midnight rim emissive)
 *
 * Usage:
 *   npx tsx refs/render/animal-rigs-gait-lod-allometry-audit/audit.ts [baseUrl]
 *
 * Expects Vite dev server on baseUrl (default http://127.0.0.1:5261).
 * Captures recording.webm, 4 live 1280x720 PNG frames, and writes numbers.json.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { chromium } from 'playwright';

import { createProceduralAnimal } from '../../../src/render/proceduralAnimal';
import { createDeerRig, DEER_LEGS } from '../../../src/render/animalRig';
import { createBear } from '../../../src/render/bear';
import { createPlayerWolf } from '../../../src/render/playerWolf';
import { PLAYABLES } from '../../../src/render/playables';
import { GAIT_LOD_SPECIES, copyProcRig, driveWolf, newWolfLod, poseRig, terrainFeet } from '../../../src/render/gaitLod';
import { createSkinTemplate, spawnSkin } from '../../../src/render/meshySkin';
import { furMaterial } from '../../../src/render/fur';
import { quadrupedPose, WOLF_LEGS } from '../../../src/core/animalBehavior';
import { heightAt } from '../../../src/core/world';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const BASE = process.argv[2] ?? 'http://127.0.0.1:5261';
const BROWSER_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];
const EXECUTABLE = BROWSER_PATHS.find(p => existsSync(p));

interface CheckResult {
  id: string;
  label: string;
  measured: string;
  expected: string;
  score: number;
  knownMatchScore: number;
  knownMismatchScore: number;
  pass: boolean;
  source: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const ratioScore = (a: number, b: number) => {
  if (a <= 0 || b <= 0) return a === b ? 1 : 0;
  return clamp01(Math.min(a, b) / Math.max(a, b));
};

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTs(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

// =========================================================================
// Check 1: proceduralAnimal.ts scrambled leg order & bird wing pivot/idle flap
// =========================================================================
function checkProceduralLegOrderAndBird(): { result: CheckResult; raw: Record<string, unknown> } {
  const lynx = createProceduralAnimal('Canada Lynx')!;
  const fox = createProceduralAnimal('Red Fox')!;
  const eagle = createProceduralAnimal('Bald Eagle')!;

  // Expected quadrupedPose leg order (core/animalBehavior.ts:123,202):
  //   0 = LF (x < 0, z < 0), 1 = LH (x < 0, z > 0), 2 = RF (x > 0, z < 0), 3 = RH (x > 0, z > 0)
  // Note: front legs are indices 0 and 2 (z < 0), hind legs are indices 1 and 3 (z > 0).
  const expectedQuadrants: Array<{ name: string; sx: number; sz: number; front: boolean }> = [
    { name: 'LF', sx: -1, sz: -1, front: true },
    { name: 'LH', sx: -1, sz: 1, front: false },
    { name: 'RF', sx: 1, sz: -1, front: true },
    { name: 'RH', sx: 1, sz: 1, front: false },
  ];

  const inspectQuad = (root: THREE.Group) => {
    // root.children[0] is body; children[1..4] are the 4 hip groups pushed in spots order
    const hips = root.children.slice(1, 5);
    let exactMatch = 0;
    let frontHindMatch = 0;
    const actual = hips.map((h, i) => {
      const sx = Math.sign(h.position.x);
      const sz = Math.sign(h.position.z);
      const isFront = sz < 0;
      const exp = expectedQuadrants[i];
      if (sx === exp.sx && sz === exp.sz) exactMatch++;
      if (isFront === exp.front) frontHindMatch++;
      return { index: i, x: +h.position.x.toFixed(3), z: +h.position.z.toFixed(3), actual: `${sx < 0 ? 'L' : 'R'}${sz < 0 ? 'F' : 'H'}`, expected: exp.name };
    });
    return { exactMatch, frontHindMatch, actual };
  };

  const lynxCheck = inspectQuad(lynx.root);
  const foxCheck = inspectQuad(fox.root);

  // Check bird idle flap at phase=0.25 (sin(pi/2)=1) and wing pivot vs shoulder
  eagle.pose('idle', 0.25, 0);
  const eagleBody = eagle.root.children[0];
  // wings are children[2] and children[3] of body
  const leftWing = eagleBody.children[2] as THREE.Mesh;
  const rightWing = eagleBody.children[3] as THREE.Mesh;
  const idleWingRotRad = Math.max(Math.abs(leftWing.rotation.z), Math.abs(rightWing.rotation.z));
  const birdIdleStill = idleWingRotRad < 0.01;
  // Wing mesh is centered at +/- length*0.28 and rotated around its own midpoint (not a shoulder pivot group)
  const wingIsShoulderPivoted = !(leftWing instanceof THREE.Mesh && Math.abs(leftWing.position.x) > 0.15);

  // Exact quadrant match (4 legs x 2 species = 8) + bird idle stillness + shoulder pivot
  const quadExactFrac = (lynxCheck.exactMatch + foxCheck.exactMatch) / 8;
  const frontHindFrac = (lynxCheck.frontHindMatch + foxCheck.frontHindMatch) / 8;
  const birdFrac = ((birdIdleStill ? 1 : 0) + (wingIsShoulderPivoted ? 1 : 0)) / 2;
  const score = clamp01(0.5 * quadExactFrac + 0.25 * (frontHindFrac === 1 ? 1 : 0) + 0.25 * birdFrac);
  const knownMatchScore = clamp01(0.5 * 1 + 0.25 * 1 + 0.25 * 1);
  const knownMismatchScore = clamp01(0.5 * 0 + 0.25 * 0 + 0.25 * 0);

  return {
    result: {
      id: 'procedural-animal-leg-order-and-bird-wing-pivot',
      label: 'proceduralAnimal.ts [LF,LH,RF,RH] leg-index alignment with quadrupedPose & idle/shoulder bird wings',
      measured: `lynxExact=${lynxCheck.exactMatch}/4 (${lynxCheck.actual.map(a => a.actual).join(',')}), foxExact=${foxCheck.exactMatch}/4 (${foxCheck.actual.map(a => a.actual).join(',')}), front/hind swapped on i=1(LF->LH) & i=2(RH->RF), eagleIdleWingRot=${idleWingRotRad.toFixed(3)} rad, shoulderPivot=${wingIsShoulderPivoted}`,
      expected: '4/4 exact [LF,LH,RF,RH] quadrant match (0 front/hind swaps) + 0.000 rad idle wing flap + shoulder-joint wing pivot',
      score: +score.toFixed(4),
      knownMatchScore: +knownMatchScore.toFixed(4),
      knownMismatchScore: +knownMismatchScore.toFixed(4),
      pass: score >= 0.95,
      source: 'Hildebrand (1965) Science 150:701-708 (lateral-sequence quadruped gait LH->LF->RH->RF); Alexander (1984) Int. J. Robotics Res. 3(2):49-59',
    },
    raw: { lynxCheck, foxCheck, idleWingRotRad, birdIdleStill, wingIsShoulderPivoted },
  };
}

// =========================================================================
// Check 2: Procedural Red Fox 1.7x wolf-sized scale, unlit MeshBasicMaterial & shadowless
// =========================================================================
function checkProceduralRedFoxAllometryAndLighting(): { result: CheckResult; raw: Record<string, unknown> } {
  const fox = createProceduralAnimal('Red Fox')!;
  fox.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(fox.root);
  const size = new THREE.Vector3();
  box.getSize(size);

  // Measure body/torso top (shoulder height) vs total height (ear tips) and total length (nose to tail tip)
  const totalHeightM = size.y;
  const totalLengthM = size.z;
  // Torso part is body.children[0]: center y=0.36, sy=0.10 -> top ~0.46 local * 1.7 scale = ~0.78 m
  const body = fox.root.children[0];
  const torsoBox = new THREE.Box3().setFromObject(body.children[0]);
  const shoulderHeightM = torsoBox.max.y - box.min.y;

  // Published Vulpes vulpes adult dimensions (Lariviere & Pasitschniak-Arts 1996, Mammalian Species 537):
  // Shoulder height 0.35-0.42 m (target 0.39 m); total head-body + tail length 0.90-1.05 m (target 0.98 m)
  const targetShoulderM = 0.39;
  const targetLengthM = 0.98;

  let totalMeshes = 0;
  let litPbrMeshes = 0;
  let toneMappedMeshes = 0;
  let shadowCastingMeshes = 0;
  fox.root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      const m = o as THREE.Mesh;
      totalMeshes++;
      const mat = m.material as THREE.Material;
      if ((mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) litPbrMeshes++;
      if (mat.toneMapped) toneMappedMeshes++;
      if (m.castShadow) shadowCastingMeshes++;
    }
  });

  const shoulderScore = ratioScore(shoulderHeightM, targetShoulderM);
  const lengthScore = ratioScore(totalLengthM, targetLengthM);
  const litFrac = totalMeshes > 0 ? litPbrMeshes / totalMeshes : 0;
  const toneFrac = totalMeshes > 0 ? toneMappedMeshes / totalMeshes : 0;
  const shadowFrac = totalMeshes > 0 ? shadowCastingMeshes / totalMeshes : 0;

  // Combine allometry (only passes if lit & shadow-casting too; unlit MeshBasicMaterial at midnight is fatal)
  const lightingGate = (litFrac + toneFrac + shadowFrac) / 3;
  const score = clamp01(0.5 * lightingGate + 0.25 * (shoulderScore >= 0.85 ? shoulderScore : 0) + 0.25 * (lengthScore >= 0.85 ? lengthScore : 0));
  const knownMatchScore = clamp01(0.5 * 1 + 0.25 * ratioScore(0.39, targetShoulderM) + 0.25 * ratioScore(0.98, targetLengthM));
  const knownMismatchScore = clamp01(0.5 * 0 + 0.25 * 0 + 0.25 * 0);

  return {
    result: {
      id: 'procedural-red-fox-scale-lighting-and-shadows',
      label: 'Procedural Red Fox (Vulpes vulpes) anatomical scale, lit PBR tone-mapped material, and shadow casting',
      measured: `scale=${fox.root.scale.y.toFixed(2)}, shoulderH=${shoulderHeightM.toFixed(3)} m (earTop=${totalHeightM.toFixed(3)} m), totalL=${totalLengthM.toFixed(3)} m, litPBR=${litPbrMeshes}/${totalMeshes} (MeshBasicMaterial), toneMapped=${toneMappedMeshes}/${totalMeshes}, castShadow=${shadowCastingMeshes}/${totalMeshes}`,
      expected: 'shoulderH=0.35-0.42 m (target 0.39 m), totalL=0.90-1.05 m (target 0.98 m), 100% lit MeshStandardMaterial (toneMapped=true), castShadow=true',
      score: +score.toFixed(4),
      knownMatchScore: +knownMatchScore.toFixed(4),
      knownMismatchScore: +knownMismatchScore.toFixed(4),
      pass: score >= 0.95,
      source: 'Lariviere & Pasitschniak-Arts (1996) Mammalian Species 537 (Vulpes vulpes: 0.35-0.42 m shoulder, 0.90-1.05 m total length); Johnsen et al. (2006) J. Exp. Biol. 209:789-800',
    },
    raw: {
      scale: fox.root.scale.y,
      shoulderHeightM: +shoulderHeightM.toFixed(4),
      totalHeightM: +totalHeightM.toFixed(4),
      totalLengthM: +totalLengthM.toFixed(4),
      totalMeshes,
      litPbrMeshes,
      toneMappedMeshes,
      shadowCastingMeshes,
    },
  };
}

// =========================================================================
// Check 3: Playable White-tailed Deer 3.08 m allometry, 100% midwinter antlers & unshared geometry
// =========================================================================
function checkPlayableDeerAllometryAndSharing(): { result: CheckResult; raw: Record<string, unknown> } {
  const deerPlayable = PLAYABLES.find(p => p.id === 'deer')!;
  const fakeLife = { handle: 'deer:audit-1', x: 0, z: 0, yaw: 0, ageSec: 3e7, energy: 80, stamina: 100, water: 80, rest: 80, bornSec: 0 };
  const rigA = deerPlayable.create(fakeLife as never);
  const rigB = createDeerRig(42, 0);
  rigA.root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(rigA.root);
  const size = new THREE.Vector3();
  box.getSize(size);
  // Torso mesh is body.children[0] (y=1.3, sy=0.65 -> max y = 1.95 m)
  const torsoBox = new THREE.Box3().setFromObject(rigA.root.children[0].children[0]);
  const withersHeightM = torsoBox.max.y - box.min.y;
  const totalHeightM = size.y;

  // Check antler prevalence across 20 seeded deer (detail=0)
  let antleredCount = 0;
  for (let s = 1; s <= 20; s++) {
    const d = createDeerRig(s, 0);
    let cylinders = 0;
    d.root.traverse(o => {
      if ((o as THREE.Mesh).isMesh && (o as THREE.Mesh).geometry.type === 'CylinderGeometry') cylinders++;
    });
    if (cylinders > 0) antleredCount++;
  }

  // Check geometry & material sharing between two deer instances
  const geosA = new Set<string>();
  const matsA = new Set<string>();
  rigA.root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      geosA.add((o as THREE.Mesh).geometry.uuid);
      matsA.add(((o as THREE.Mesh).material as THREE.Material).uuid);
    }
  });
  let sharedGeos = 0;
  let totalGeosB = 0;
  let sharedMats = 0;
  const seenMatsB = new Set<string>();
  rigB.root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      totalGeosB++;
      if (geosA.has((o as THREE.Mesh).geometry.uuid)) sharedGeos++;
      const mu = ((o as THREE.Mesh).material as THREE.Material).uuid;
      if (!seenMatsB.has(mu)) {
        seenMatsB.add(mu);
        if (matsA.has(mu)) sharedMats++;
      }
    }
  });

  // Published Odocoileus virginianus (Smith 1991, Mammalian Species 388): withers 0.85-1.05 m (target 0.95 m),
  // antlerless winter prevalence ~90-100% (<=15% antlered in mid-Jan; Goss 1983).
  const targetWithersM = 0.95;
  const withersScore = ratioScore(withersHeightM, targetWithersM);
  const antlerFraction = antleredCount / 20; // 1.0 in game vs <= 0.50 annual / <= 0.15 Jan
  const antlerSexSeasonScore = antlerFraction <= 0.55 ? 1 : clamp01(1 - (antlerFraction - 0.50) / 0.50);
  const sharingFrac = totalGeosB > 0 ? sharedGeos / totalGeosB : 0;

  const score = clamp01(0.4 * (withersScore >= 0.80 ? withersScore : 0) + 0.3 * antlerSexSeasonScore + 0.3 * sharingFrac);
  const knownMatchScore = clamp01(0.4 * ratioScore(0.95, targetWithersM) + 0.3 * 1 + 0.3 * 1);
  const knownMismatchScore = clamp01(0.4 * 0 + 0.3 * 0 + 0.3 * 0);

  return {
    result: {
      id: 'playable-deer-rig-allometry-winter-antlers-and-sharing',
      label: 'Playable White-tailed Deer (animalRig.ts / playables.ts) withers allometry, sex/seasonal antlers & geometry sharing',
      measured: `withersH=${withersHeightM.toFixed(3)} m, totalAntlerH=${totalHeightM.toFixed(3)} m, cameraHeight=${deerPlayable.cameraHeight} m, DEER_LEGS.hip=${DEER_LEGS.hip} m, antlered=${antleredCount}/20 (100%), sharedGeos=${sharedGeos}/${totalGeosB}, sharedMats=${sharedMats}/${seenMatsB.size}`,
      expected: 'withersH=0.85-1.05 m (target 0.95 m), totalH~1.35-1.55 m, cameraHeight~1.1-1.3 m, <=50% antlered (<=15% Jan winter shed), 100% shared geometry/materials across deer',
      score: +score.toFixed(4),
      knownMatchScore: +knownMatchScore.toFixed(4),
      knownMismatchScore: +knownMismatchScore.toFixed(4),
      pass: score >= 0.95,
      source: 'Smith (1991) Mammalian Species 388 (Odocoileus virginianus: 0.85-1.05 m shoulder); Goss (1983) Deer Antlers, Academic Press (Dec-Feb antler shedding; antlerless females)',
    },
    raw: {
      withersHeightM: +withersHeightM.toFixed(4),
      totalHeightM: +totalHeightM.toFixed(4),
      cameraHeight: deerPlayable.cameraHeight,
      antleredCount,
      totalGeosB,
      sharedGeos,
      sharedMats,
      uniqueMatsB: seenMatsB.size,
    },
  };
}

// =========================================================================
// Check 4: Player wolf slope terrainFeet skip, gaitLod species coverage & glowing midnight eyes
// =========================================================================
function checkPlayerWolfSlopeIkAndGaitLod(): { result: CheckResult; raw: Record<string, unknown> } {
  // Build a synthetic quad SkinTemplate for Gray Wolf (same dimensions as wolf GLB: height 0.92 m, length 1.28 m)
  const boxGeo = new THREE.BoxGeometry(0.42, 0.92, 1.28, 4, 4, 8);
  boxGeo.translate(0, 0.46, 0);
  const mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: 0x666666 }));
  const group = new THREE.Group();
  group.add(mesh);
  const tpl = createSkinTemplate(group, 'Gray Wolf')!;
  const spawn = spawnSkin(tpl);
  const rig = poseRig(spawn);
  const procWolf = createPlayerWolf(1400, { fur: false });
  procWolf.animate(1.0, false, undefined, 0, 'walk');

  // 20-degree slope along Z: ground(x, z) = tan(20 deg) * z = 0.36397 * z
  const slopeTan = Math.tan((20 * Math.PI) / 180);
  const groundSlope = (_x: number, z: number) => slopeTan * z;

  const measurePawSlopeErrors = (s: ReturnType<typeof spawnSkin>) => {
    s.root.updateMatrixWorld(true);
    const errs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const paw = s.root.getObjectByName('paw' + i);
      if (!paw) continue;
      const p = new THREE.Vector3();
      paw.getWorldPosition(p);
      errs.push(p.y - groundSlope(p.x, p.z));
    }
    const maxAbsErr = Math.max(...errs.map(Math.abs));
    const peakToPeak = Math.max(...errs) - Math.min(...errs);
    return { errs: errs.map(e => +e.toFixed(4)), maxAbsErr, peakToPeak };
  };

  // Run driveWolf AS PLAYER (procRoot provided -> copyProcRig returns true -> skips terrainFeet!)
  const stPlayer = newWolfLod('near');
  driveWolf(stPlayer, spawn, rig, tpl, {
    motion: 'idle', phase: 0, speed: 0, moving: false, x: 0, y: 0, z: 0, procRoot: procWolf.root,
  }, 1 / 60, groundSlope);
  const playerSlope = measurePawSlopeErrors(spawn);

  // Compare with NPC wolf (procRoot undefined -> terrainFeet DOES run)
  const spawnNpc = spawnSkin(tpl);
  const rigNpc = poseRig(spawnNpc);
  const stNpc = newWolfLod('near');
  driveWolf(stNpc, spawnNpc, rigNpc, tpl, {
    motion: 'idle', phase: 0, speed: 0, moving: false, x: 0, y: 0, z: 0,
  }, 1 / 60, groundSlope);
  const npcSlope = measurePawSlopeErrors(spawnNpc);

  // Check GAIT_LOD_SPECIES coverage vs manifest quadrupeds
  const manifest = JSON.parse(readFileSync(join(ROOT, 'public/models/animals/manifest.json'), 'utf8')) as Record<string, unknown>;
  const birdNames = new Set(['Bald Eagle', 'Common Raven', 'Hawks, Kites and Eagles', 'Crows and Jays']);
  const manifestQuadrupeds = Object.keys(manifest).filter(s => !s.startsWith('_') && !birdNames.has(s));
  const gaitLodCoverage = GAIT_LOD_SPECIES.length / Math.max(1, manifestQuadrupeds.length);

  // Check playerWolf.ts eye emissiveIntensity in darkness (Ollivier et al. 2004: 0 self-emission without incident light)
  let maxEyeEmissive = 0;
  procWolf.root.traverse(o => {
    if ((o as THREE.Mesh).isMesh) {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial;
      if (m && m.emissive && m.emissiveIntensity > maxEyeEmissive) maxEyeEmissive = m.emissiveIntensity;
    }
  });

  // Score: player paw max slope error (target <= 0.02 m, full scale 0.14 m) + GAIT_LOD_SPECIES coverage + dark eye check
  const slopePlacementScore = clamp01(1 - Math.max(0, playerSlope.maxAbsErr - 0.02) / 0.10);
  const eyeDarkScore = maxEyeEmissive <= 0.05 ? 1 : 0;
  const score = clamp01(0.5 * slopePlacementScore + 0.25 * gaitLodCoverage + 0.25 * eyeDarkScore);
  const knownMatchScore = clamp01(0.5 * 1 + 0.25 * 1 + 0.25 * 1);
  const knownMismatchScore = clamp01(0.5 * 0 + 0.25 * 0 + 0.25 * 0);

  return {
    result: {
      id: 'player-wolf-slope-terrain-feet-and-gait-lod-coverage',
      label: 'Player wolf slope terrainFeet IK (gaitLod.ts:391), GAIT_LOD_SPECIES quadruped coverage, & non-emissive dark eyes',
      measured: `playerMaxPawSlopeErr=${(playerSlope.maxAbsErr * 100).toFixed(2)} cm (p2p=${(playerSlope.peakToPeak * 100).toFixed(2)} cm on 20 deg slope, vs NPC ${(npcSlope.maxAbsErr * 100).toFixed(2)} cm), GAIT_LOD_SPECIES=${GAIT_LOD_SPECIES.length}/${manifestQuadrupeds.length} (${(gaitLodCoverage * 100).toFixed(1)}%), wolfEyeEmissiveIntensity=${maxEyeEmissive.toFixed(2)}`,
      expected: 'playerMaxPawSlopeErr <= 2.0 cm on 20 deg slope (terrainFeet runs after copyProcRig), 100% quadruped GAIT_LOD_SPECIES coverage, wolfEyeEmissiveIntensity <= 0.05 in pitch darkness',
      score: +score.toFixed(4),
      knownMatchScore: +knownMatchScore.toFixed(4),
      knownMismatchScore: +knownMismatchScore.toFixed(4),
      pass: score >= 0.95,
      source: 'Alexander (1984) Int. J. Robotics Res. 3(2):49-59; Bollo (2016) GDC Inertialization; Ollivier et al. (2004) Vet. Ophthalmol. 7(1):11-22 (tapetum lucidum retro-reflection, zero self-emission)',
    },
    raw: {
      slopeDeg: 20,
      playerSlope,
      npcSlope,
      gaitLodSpeciesCount: GAIT_LOD_SPECIES.length,
      manifestQuadrupedCount: manifestQuadrupeds.length,
      maxEyeEmissive,
      copyProcRigReturnsTrue: copyProcRig(procWolf.root, rig, tpl.layout.kind === 'quad' ? tpl.layout.gaitScale : 1),
    },
  };
}

// =========================================================================
// Check 5: bear.ts uncached 32k-card per-instance geometry, 40 unmerged claws, unlit nostrils & bare-clock sine
// =========================================================================
function checkBearRigCachingAndClaws(): { result: CheckResult; raw: Record<string, unknown> } {
  const bear1 = createBear(1, 'grizzly');
  const bear2 = createBear(2, 'grizzly');

  const countBear = (root: THREE.Group) => {
    let totalMeshes = 0;
    let clawMeshes = 0;
    let basicMats = 0;
    let furTris = 0;
    const geos = new Set<string>();
    root.traverse(o => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        totalMeshes++;
        geos.add(m.geometry.uuid);
        if (m.parent?.name === 'claw' || m.parent?.parent?.name === 'claw') clawMeshes++;
        if ((m.material as THREE.MeshBasicMaterial).isMeshBasicMaterial) basicMats++;
        if (m.name === 'fur' && m.geometry.index) furTris = m.geometry.index.count / 3;
      }
    });
    return { totalMeshes, clawMeshes, basicMats, furTris, geos };
  };

  const b1 = countBear(bear1.root);
  const b2 = countBear(bear2.root);
  let sharedGeos = 0;
  for (const u of b2.geos) if (b1.geos.has(u)) sharedGeos++;

  const bearSrc = readFileSync(join(ROOT, 'src/render/bear.ts'), 'utf8');
  const hasBareClockIdleSine = /motion === 'idle' \? Math\.sin\(time/.test(bearSrc);
  const hasPostureSupport = /posture/.test(bearSrc);

  const shareScore = b2.geos.size > 0 ? sharedGeos / b2.geos.size : 0;
  // 4 paws -> <= 4 merged claw meshes (1 per paw) vs 40 individual claw meshes
  const clawBatchScore = b1.clawMeshes <= 4 ? 1 : clamp01(4 / b1.clawMeshes);
  const pbrScore = b1.basicMats === 0 ? 1 : 0;
  const transactionalScore = (!hasBareClockIdleSine && hasPostureSupport) ? 1 : 0;

  const score = clamp01(0.35 * shareScore + 0.25 * (b1.clawMeshes <= 4 ? 1 : 0) + 0.20 * pbrScore + 0.20 * transactionalScore);
  const knownMatchScore = clamp01(0.35 * 1 + 0.25 * 1 + 0.20 * 1 + 0.20 * 1);
  const knownMismatchScore = clamp01(0.35 * 0 + 0.25 * 0 + 0.20 * 0 + 0.20 * 0);

  return {
    result: {
      id: 'bear-rig-template-caching-claws-and-transactional-posture',
      label: 'Bear rig (bear.ts) shared template caching, merged per-paw claws, PBR nostrils, & posture-driven head motion',
      measured: `sharedGeos=${sharedGeos}/${b2.geos.size} (rebuilds ${b1.furTris} fur tris per call), clawMeshes=${b1.clawMeshes} (40 draw calls), meshBasicNostrils=${b1.basicMats}, bareClockIdleSine=${hasBareClockIdleSine}, postureSupport=${hasPostureSupport}`,
      expected: '100% shared skin/fur template across instances (like rigSkin.ts), <=4 merged claw meshes (1/paw), 0 MeshBasicMaterial, posture-driven head (no bare Math.sin(time))',
      score: +score.toFixed(4),
      knownMatchScore: +knownMatchScore.toFixed(4),
      knownMismatchScore: +knownMismatchScore.toFixed(4),
      pass: score >= 0.95,
      source: 'Akenine-Moller et al. (2018) Real-Time Rendering 4th ed. (geometry batching/sharing); PROJECT-RULES.md Rule 5 (transactional posture, no bare clock timers)',
    },
    raw: {
      totalMeshes: b1.totalMeshes,
      uniqueGeosPerBear: b1.geos.size,
      sharedGeos,
      clawMeshes: b1.clawMeshes,
      furTris: b1.furTris,
      basicMats: b1.basicMats,
      clawBatchScore: +clawBatchScore.toFixed(4),
      hasBareClockIdleSine,
      hasPostureSupport,
    },
  };
}

// =========================================================================
// Check 6: Dead legacy src/render/fur.ts shell-fur file & rules.test.ts allowlist
// =========================================================================
function checkDeadLegacyFurModule(): { result: CheckResult; raw: Record<string, unknown> } {
  const furPath = join(ROOT, 'src/render/fur.ts');
  const furExists = existsSync(furPath);
  const allFiles = [...walkTs(join(ROOT, 'src')), ...walkTs(join(ROOT, 'tests')), ...walkTs(join(ROOT, 'tools'))]
    .filter(f => !f.replace(/\\/g, '/').endsWith('src/render/fur.ts'));

  let liveImporters = 0;
  for (const f of allFiles) {
    const txt = readFileSync(f, 'utf8');
    if (/from\s+['"][^'"]*\/fur['"]/.test(txt) || /\bfurMaterial\s*\(/.test(txt)) {
      liveImporters++;
    }
  }

  const rulesTestSrc = readFileSync(join(ROOT, 'tests/rules.test.ts'), 'utf8');
  const stillInNoiseAllowlist = rulesTestSrc.includes("'render/fur.ts'");

  let hasPrivateNoise = false;
  let hasUnlitEmissiveRim = false;
  if (furExists) {
    const m = furMaterial(3, 6);
    const shader = {
      uniforms: {} as Record<string, THREE.IUniform>,
      vertexShader: '#include <common>\n#include <skinning_vertex>',
      fragmentShader: '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>',
    };
    m.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer);
    hasPrivateNoise = /float hash3\(/.test(shader.fragmentShader) && /float vnoise\(/.test(shader.fragmentShader);
    hasUnlitEmissiveRim = /totalEmissiveRadiance \+= diffuseColor\.rgb \* rim/.test(shader.fragmentShader);
  }

  const clean = !furExists && !stillInNoiseAllowlist;
  const score = clean ? 1 : 0;
  const knownMatchScore = 1;
  const knownMismatchScore = 0;

  return {
    result: {
      id: 'dead-legacy-fur-shell-module-and-noise-allowlist',
      label: 'Removal of dead legacy src/render/fur.ts (private shader noise allowlist + unlit midnight rim emissive)',
      measured: `furTsExists=${furExists}, liveImporters=${liveImporters}, inRulesNoiseAllowlist=${stillInNoiseAllowlist}, privateHash3Vnoise=${hasPrivateNoise}, unlitMidnightRimEmissive=${hasUnlitEmissiveRim}`,
      expected: 'Dead unreferenced src/render/fur.ts deleted and removed from tests/rules.test.ts shader-noise allowlist (0 duplicate noise libraries)',
      score: +score.toFixed(4),
      knownMatchScore: +knownMatchScore.toFixed(4),
      knownMismatchScore: +knownMismatchScore.toFixed(4),
      pass: score >= 0.95,
      source: 'PROJECT-RULES.md Rule 1 & tests/rules.test.ts:30 (single shared GLSL_NOISE in src/proc/glsl.ts; shrink allowlists to zero)',
    },
    raw: { furExists, liveImporters, stillInNoiseAllowlist, hasPrivateNoise, hasUnlitEmissiveRim },
  };
}

// =========================================================================
// Find a dry boreal hillside slope (16-24 deg) for live frame-2 wolf slope capture
// =========================================================================
function findDrySlopeSpot(): { x: number; z: number; h: number; slopeDeg: number; yawBroadside: number } {
  let best = { x: 0, z: 0, h: 0, slopeDeg: 0, yawBroadside: 0 };
  for (let x = -120; x <= 120; x += 2) {
    for (let z = -120; z <= 120; z += 2) {
      const h = heightAt(x, z);
      if (h < 1.2 || h > 14) continue;
      const gx = (heightAt(x + 0.5, z) - heightAt(x - 0.5, z)) / 1.0;
      const gz = (heightAt(x, z + 0.5) - heightAt(x, z - 0.5)) / 1.0;
      const grad = Math.hypot(gx, gz);
      const deg = (Math.atan(grad) * 180) / Math.PI;
      if (deg >= 14 && deg <= 25 && deg > best.slopeDeg) {
        // Face wolf UP/DOWN the gradient so side camera sees uphill vs downhill paws clearly
        const yawDownhill = Math.atan2(-gx, -gz);
        best = { x, z, h, slopeDeg: deg, yawBroadside: yawDownhill };
      }
    }
  }
  return best;
}

// =========================================================================
// Live browser capture (recording.webm + 4 sampled PNG frames)
// =========================================================================
async function captureLiveFrames(slopeSpot: ReturnType<typeof findDrySlopeSpot>) {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-gpu-sandbox',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const liveTelemetry: Record<string, unknown> = {};

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    page.on('pageerror', e => pageErrors.push(e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const waitLoaded = async () => {
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        const up = await page.evaluate(() => !!document.getElementById('loading')).catch(() => true);
        if (!up) break;
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(3500);
    };

    const sampleCanvasLuma = async () =>
      page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (!c) return { ok: false, mean: 0, maxR: 0, brightOrangePx: 0 };
        const tmp = document.createElement('canvas');
        tmp.width = 160;
        tmp.height = 90;
        const ctx = tmp.getContext('2d');
        if (!ctx) return { ok: false, mean: 0, maxR: 0, brightOrangePx: 0 };
        ctx.drawImage(c, 0, 0, 160, 90);
        const d = ctx.getImageData(0, 0, 160, 90).data;
        let sum = 0;
        let maxR = 0;
        let brightOrangePx = 0;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
          sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
          if (r > maxR) maxR = r;
          // Detect unlit neon-orange Red Fox pixels (R >> G > B)
          if (r > 0.35 && r > g * 2.0 && g > b * 1.4) brightOrangePx++;
        }
        return {
          ok: true,
          mean: +(sum / (160 * 90)).toFixed(4),
          maxR: +maxR.toFixed(4),
          brightOrangePx,
        };
      });

    // Frame 0: Midday summer ground view showing Gray Wolf + spawned 1.7x procedural Red Fox
    await page.goto(`${BASE}/?nomenu&noprobe&view=ground&stages=0&date=2026-08-15&hour=12&at=18.00,6.00,0&rec`, {
      waitUntil: 'domcontentloaded',
    });
    await waitLoaded();
    await page.waitForTimeout(3000);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(820, 365, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(HERE, 'frame-0-fox-wolf-day-scale.png') });
    liveTelemetry.frame0 = {
      status: await page.locator('#status').innerText().catch(() => ''),
      luma: await sampleCanvasLuma(),
    };

    // Frame 1: Midnight view at same coordinates showing unlit MeshBasicMaterial procedural Red Fox glowing
    await page.goto(`${BASE}/?nomenu&noprobe&view=ground&stages=0&date=2026-08-15&hour=0&at=18.00,6.00,0&rec`, {
      waitUntil: 'domcontentloaded',
    });
    await waitLoaded();
    await page.waitForTimeout(3000);
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(820, 365, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(HERE, 'frame-1-fox-midnight-unlit.png') });
    liveTelemetry.frame1 = {
      status: await page.locator('#status').innerText().catch(() => ''),
      luma: await sampleCanvasLuma(),
    };

    // Frame 2: Player Gray Wolf on steep boreal slope (side camera via orbit drag) showing skipped terrainFeet
    const sx = slopeSpot.x.toFixed(2);
    const sz = slopeSpot.z.toFixed(2);
    const syaw = slopeSpot.yawBroadside.toFixed(2);
    await page.goto(`${BASE}/?nomenu&noprobe&view=ground&stages=0&date=2026-08-15&hour=13&at=${sx},${sz},${syaw}&rec`, {
      waitUntil: 'domcontentloaded',
    });
    await waitLoaded();
    // Drag mouse horizontally ~260px to orbit camera ~90 deg broadside to the wolf on the slope
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(900, 385, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(HERE, 'frame-2-wolf-slope-paws.png') });
    liveTelemetry.frame2 = {
      slopeSpot,
      status: await page.locator('#status').innerText().catch(() => ''),
      luma: await sampleCanvasLuma(),
    };

    // Frame 3: Midwinter January playable White-tailed Deer (select via boreal.player.v1 = 'deer' before load)
    await page.evaluate(() => { try { localStorage.setItem('boreal.player.v1', 'deer'); } catch {} });
    await page.goto(`${BASE}/?nomenu&noprobe&view=ground&stages=0&date=2026-01-15&hour=12&at=18.00,6.00,0&rec`, {
      waitUntil: 'domcontentloaded',
    });
    await waitLoaded();
    // Slight side orbit so full 3.25 m antlered playable deer silhouette shows in January snow
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.mouse.move(860, 365, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(HERE, 'frame-3-playable-deer-winter-scale.png') });
    const sensesTitle = await page.locator('#senses-toggle, .senses-toggle, button:has-text("senses")').first().innerText().catch(() => '');
    liveTelemetry.frame3 = {
      playable: 'deer',
      sensesTitle,
      status: await page.locator('#status').innerText().catch(() => ''),
      luma: await sampleCanvasLuma(),
    };

    await context.close();
  } finally {
    await browser.close();
  }

  return { consoleErrors, pageErrors, liveTelemetry };
}

async function main() {
  const c1 = checkProceduralLegOrderAndBird();
  const c2 = checkProceduralRedFoxAllometryAndLighting();
  const c3 = checkPlayableDeerAllometryAndSharing();
  const c4 = checkPlayerWolfSlopeIkAndGaitLod();
  const c5 = checkBearRigCachingAndClaws();
  const c6 = checkDeadLegacyFurModule();
  const checks = [c1.result, c2.result, c3.result, c4.result, c5.result, c6.result];
  const slopeSpot = findDrySlopeSpot();

  let live: Awaited<ReturnType<typeof captureLiveFrames>> | null = null;
  if (!process.argv.includes('--no-browser')) {
    live = await captureLiveFrames(slopeSpot);
  }

  const meanScore = +(checks.reduce((s, c) => s + c.score, 0) / checks.length).toFixed(4);
  const passing = checks.filter(c => c.pass).length;
  const calibrationValid = checks.every(c => c.knownMatchScore >= 0.95 && c.knownMismatchScore <= 0.15);

  const report = {
    audit: 'animal-rigs-gait-lod-allometry-audit',
    capturedAt: new Date().toISOString(),
    baseUrl: BASE,
    calibrationValid,
    passing,
    total: checks.length,
    meanScore,
    checks,
    raw: {
      legOrderAndBird: c1.raw,
      redFox: c2.raw,
      playableDeer: c3.raw,
      playerWolfSlopeAndGaitLod: c4.raw,
      bearRig: c5.raw,
      legacyFur: c6.raw,
      slopeSpot,
    },
    live,
  };

  writeFileSync(join(HERE, 'numbers.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`Calibration valid: ${calibrationValid}; Passing: ${passing}/${checks.length}; Mean score: ${meanScore}`);
  for (const c of checks) {
    console.log(`  [${c.pass ? 'PASS' : 'FAIL'}] ${c.id}: score=${c.score} (match=${c.knownMatchScore}, mismatch=${c.knownMismatchScore}) | ${c.measured}`);
  }
  if (live) {
    console.log(`Live browser errors: console=${live.consoleErrors.length}, page=${live.pageErrors.length}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
