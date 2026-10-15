import * as THREE from 'three';
import { generateGeometry, disposeObject } from './geometry';
import { CHUNK_SIZE, generateChunk, heightAt, type Entity } from '../core/world';
import { restoreEntities, type EventContext } from '../core/events';
import { positionCamera, terrainGeometry } from './math';
import { createPlayerWolf } from './playerWolf';
import { WOLF_SCALE, type WolfMode } from '../core/wolfModes';
import { pushProgress, rockDiameter } from '../core/rocks';
import { createDeerRig } from './animalRig';
import { ANIMAL_DEFAULT_ENERGY, FORAGE_ENERGY, withinEarshot, type SenseItem } from '../core/animalBehavior';
import { catalog } from '../core/catalog';
import { seatRock } from './rocks';
import { createSky } from './sky';
import { shapeDeer, forgetDeer } from '../core/deerHerd';
import { createHares } from '../animals/hare';
import { formatHour, gameHour, START_HOUR } from '../core/timeOfDay';
import { LEVEL, BLOCK } from '../core/tuning';
import { stepForward } from '../proc/math';

/** Scene entry point: assembles generated terrain, streamed objects, light and camera. */
/** Commits an animal eating a forage patch; returns the animal's new energy, or undefined if not committed. */
export type ForageHandler = (animal: Entity, plant: Entity) => number | undefined;
export function buildScene(canvas: HTMLCanvasElement, onForage?: ForageHandler) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0xc4d4c8);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xc4d4c8, 200, 480);
  const sky = createSky(scene); // sun, moon, sky colour, clouds, stars and fog follow the game clock
  // Optional ?hour=HH in the page address starts the clock at that hour (for reviewing day and night).
  const startParam = Number(new URLSearchParams(location.search).get('hour'));
  const startHour = Number.isFinite(startParam) && startParam >= 0 && startParam < 24 && location.search.includes('hour=') ? startParam : START_HOUR;
  let clock = formatHour(gameHour(0, startHour)), darkness = 0;
  const camera = new THREE.PerspectiveCamera(48, 1, .2, 700);
  const chunks = new Map<string, { root: THREE.Group; entities: Entity[]; objects: Map<string, THREE.LOD> }>();
  const animals = new Map<string, { rig: ReturnType<typeof createDeerRig>; entity: Entity }>();
  const eatenForage = new Map<string, string>(); // plant key -> loaded chunk; never serialized
  let activeContext: EventContext;
  const wolf = createPlayerWolf(); scene.add(wolf.root);
  const hares = createHares(scene); // src/animals/hare.ts
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a1, side: THREE.DoubleSide, transparent: true, opacity: .7, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.visible = false; scene.add(halo);
  let centerKey = '', radius = -1, revision = -1;
  function createChunk(cx: number, cz: number, context: EventContext) {
    const root = new THREE.Group(), objects = new Map<string, THREE.LOD>();
    const geometry = terrainGeometry(cx, cz);
    root.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE), new THREE.MeshStandardMaterial({ color: 0x578d91, roughness: .32, metalness: .1 }));
    water.rotation.x = -Math.PI / 2; water.position.set((cx + .5) * CHUNK_SIZE, LEVEL.waterSurface, (cz + .5) * CHUNK_SIZE); root.add(water);
    const entities = structuredClone(restoreEntities(generateChunk(cx, cz), context, { minX: cx * CHUNK_SIZE, minZ: cz * CHUNK_SIZE, maxX: (cx + 1) * CHUNK_SIZE, maxZ: (cz + 1) * CHUNK_SIZE })).filter(e => !eatenForage.has(e.key));
    for (const entity of entities) {
      if (catalog[entity.kind].objectType === 'animal') {
        const previous = animals.get(entity.key);
        if (previous) { entity.x = previous.entity.x; entity.z = previous.entity.z; entity.rotation = previous.entity.rotation; entity.energy = previous.rig.brain.energy; previous.entity = entity; }
        else { const rig = createDeerRig(entity.seed, 0); rig.root.scale.setScalar(entity.scale); rig.brain.heading = entity.rotation; rig.brain.energy = entity.energy ?? ANIMAL_DEFAULT_ENERGY; scene.add(rig.root); animals.set(entity.key, {rig, entity}); }
        continue;
      }
      const lod = new THREE.LOD();
      for (let detail = 0; detail < 3; detail++) lod.addLevel(generateGeometry(entity, detail), (entity.kind === 'rock' ? [0, 10, 24] : [0, 55, 115])[detail], .12);
      if (entity.kind === 'rock') lod.addLevel(new THREE.Group(), 45, .12);
      lod.position.set(entity.x, heightAt(entity.x, entity.z), entity.z); root.add(lod); objects.set(entity.key, lod);
    }
    scene.add(root); return { root, entities, objects };
  }
  function sync(x: number, z: number, altitude: number, context: EventContext, eventRevision: number) {
    activeContext = context;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE), nextRadius = altitude > 85 ? 3 : 2;
    if (centerKey === `${cx}:${cz}` && radius === nextRadius && revision === eventRevision) return;
    const changed = revision !== eventRevision;
    centerKey = `${cx}:${cz}`; radius = nextRadius; revision = eventRevision;
    const needed = new Set<string>();
    for (let a = cx - radius; a <= cx + radius; a++) for (let b = cz - radius; b <= cz + radius; b++) needed.add(`${a}:${b}`);
    for (const [plantKey, chunkKey] of eatenForage) if (!needed.has(chunkKey)) eatenForage.delete(plantKey);
    for (const [key, chunk] of chunks) if (changed || !needed.has(key)) {
      scene.remove(chunk.root); disposeObject(chunk.root); chunks.delete(key);
    }
    for (const key of needed) if (!chunks.has(key)) {
      const [a, b] = key.split(':').map(Number); chunks.set(key, createChunk(a, b, context));
    }
  }
  function eat(animal: { rig: ReturnType<typeof createDeerRig>; entity: Entity }, plantKey: string) {
    for (const chunk of chunks.values()) {
      const index = chunk.entities.findIndex(e => e.key === plantKey);
      if (index < 0) continue;
      const plant = chunk.entities[index];
      const energy = onForage?.({ ...animal.entity, energy: animal.rig.brain.energy }, plant);
      if (energy === undefined) return;
      eatenForage.set(plantKey, `${Math.floor(plant.x / CHUNK_SIZE)}:${Math.floor(plant.z / CHUNK_SIZE)}`);
      chunk.entities.splice(index, 1);
      const lod = chunk.objects.get(plantKey);
      if (lod) { chunk.root.remove(lod); disposeObject(lod); chunk.objects.delete(plantKey); }
      animal.rig.brain.energy = energy; animal.entity.energy = energy;
      return;
    }
  }
  let previousTime = 0;
  const headPoint = new THREE.Vector3();
  const audibleAnimals: {key:string; energy:number; motion:string; problem:string; x:number; z:number; phase:number}[] = [];
  function simulateAnimals(dt:number, x:number,z:number) {
    audibleAnimals.length=0;
    scene.updateMatrixWorld(true);
    const entities=[...chunks.values()].flatMap(c=>c.entities), keys=new Set(entities.map(e=>e.key));
    // Only forage patches are food; low herbs are neither food nor obstacles.
    const observations:SenseItem[]=entities.filter(e=>e.kind!=='plant'&&(e.kind!=='rock'||rockDiameter(e)>.22)).map(e=>({key:e.key,x:e.x,y:heightAt(e.x,e.z)+ (e.kind==='deer'?1:0),z:e.z,
      kind:e.kind==='forage'?'food':e.kind==='deer'?'animal':'obstacle',low:e.kind==='log'||e.kind==='rock'}));
    wolf.root.updateMatrixWorld(true);wolf.sensor.getWorldPosition(headPoint);wolf.brain.sense(headPoint,observations);
    const herd=[...animals].map(([key,a])=>({key,x:a.entity.x,z:a.entity.z,brain:a.rig.brain}));
    for(const [key,animal] of animals) {
      if(!keys.has(key)) {scene.remove(animal.rig.root);disposeObject(animal.rig.root);animals.delete(key);forgetDeer(key);continue;}
      const {rig,entity:e}=animal;
      rig.root.position.set(e.x,heightAt(e.x,e.z),e.z);rig.root.rotation.y=rig.brain.heading;rig.root.updateMatrixWorld(true);
      rig.sensor.getWorldPosition(headPoint);
      if(!withinEarshot({x,y:heightAt(x,z)+.45*WOLF_SCALE,z},headPoint))continue;
      const senses=observations.filter(i=>i.key!==key);
      if(activeContext.records[key]?.relationship!=='friend') senses.push({key:'player',x,y:heightAt(x,z)+.3*WOLF_SCALE,z,kind:'threat'});
      rig.brain.sense(headPoint,senses);
      if(dt>0) {
        rig.brain.decide(headPoint,dt);
        rig.root.userData.posture=shapeDeer({key,x:e.x,z:e.z,brain:rig.brain},herd,dt); // src/core/deerHerd.ts
        if(rig.brain.meal) eat(animal, rig.brain.meal.key);
        const oldX=e.x,oldZ=e.z;
        const {x:nextX,z:nextZ}=stepForward(e.x,e.z,rig.brain.heading,rig.brain.speed,dt);
        // Avoid deep water, steep slopes and solid trunks; low obstacles can be jumped.
        const blocked=heightAt(nextX,nextZ)<LEVEL.deerWater || Math.abs(heightAt(nextX,nextZ)-heightAt(e.x,e.z))>BLOCK.deer.step || entities.some(o=>o.kind==='spruce'&&Math.hypot(o.x-nextX,o.z-nextZ)<BLOCK.deer.trunk);
        if(!blocked) {e.x=nextX;e.z=nextZ;} else {rig.brain.heading+=dt*2;rig.brain.speed=0;}
        rig.brain.expend(dt,Math.hypot(e.x-oldX,e.z-oldZ));e.energy=rig.brain.energy;e.rotation=rig.brain.heading;
      }
      rig.root.position.set(e.x,heightAt(e.x,e.z),e.z);rig.root.rotation.y=rig.brain.heading;rig.animate(dt);
      audibleAnimals.push({key,energy:rig.brain.energy,motion:rig.brain.motion,problem:rig.brain.problem,x:e.x,z:e.z,phase:rig.brain.phase});
    }
  }
  function draw(x: number, z: number, altitude: number, yaw: number, time: number, target?: Entity, pitch?: number,
    moving = false, action?: 'speak' | 'gather' | 'move', actionElapsed = 0, lookYaw = 0, mode: WolfMode = 'walk', focus?: Entity, pushFrom?: Entity) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    const ground = Math.max(heightAt(x, z), -.2);
    wolf.root.position.set(x, ground, z); wolf.root.rotation.y = yaw;
    const pushed = pushFrom && [...chunks.values()].flatMap(c => c.entities).find(e => e.key === pushFrom.key);
    const pushVector = pushed && pushFrom ? { x: pushed.x - pushFrom.x, z: pushed.z - pushFrom.z, yaw } : undefined;
    wolf.animate(time, moving, action, actionElapsed, mode, pushVector);
    positionCamera(camera, x, z, altitude, yaw, pitch, lookYaw);
    const focused = mode === 'super-stealth' ? focus : undefined;
    const dt = Math.max(0, Math.min(.1, time - previousTime)); previousTime = time;
    camera.fov += ((focused ? 30 : 48) - camera.fov) * (1 - Math.exp(-8 * dt));
    camera.updateProjectionMatrix();
    if (focused) camera.lookAt(focused.x, heightAt(focused.x, focused.z) + (focused.kind === 'deer' ? 1.5 : 1), focused.z);
    const highlighted = focused ?? target;
    halo.visible = !!highlighted;
    if (highlighted) {
      halo.position.set(highlighted.x, heightAt(highlighted.x, highlighted.z) + .02, highlighted.z);
      halo.scale.setScalar(highlighted.kind === 'rock' ? (rockDiameter(highlighted) / 2 + .05) / 1.6 : 1);
    }
    for (const chunk of chunks.values()) for (const entity of chunk.entities) {
      if (entity.kind === 'rock' && pushFrom?.key === entity.key) {
        const t = pushProgress(actionElapsed), lod = chunk.objects.get(entity.key)!;
        const pose = { ...entity, x: pushFrom.x + (entity.x - pushFrom.x) * t, z: pushFrom.z + (entity.z - pushFrom.z) * t,
          rollX: (pushFrom.rollX ?? 0) + ((entity.rollX ?? 0) - (pushFrom.rollX ?? 0)) * t,
          rollZ: (pushFrom.rollZ ?? 0) + ((entity.rollZ ?? 0) - (pushFrom.rollZ ?? 0)) * t };
        lod.position.set(pose.x, heightAt(pose.x, pose.z), pose.z);
        for (const level of lod.levels) if (level.object.children.length) seatRock(level.object, pose);
      }
      if (entity.kind !== 'person') continue;
      const lod = chunk.objects.get(entity.key)!;
      lod.rotation.y = Math.sin(time * .7 + entity.seed) * .07;
    }
    simulateAnimals(dt, x, z);
    const hour = gameHour(time, startHour); clock = formatHour(hour);
    darkness = sky.update(hour, time, camera, wolf.root.position).light.night;
    renderer.render(scene, camera);
  }
  function forageWolf(plantKey: string) {
    for(const chunk of chunks.values()) {
      const index=chunk.entities.findIndex(e=>e.key===plantKey && e.kind==='forage');
      if(index<0) continue;
      const plant=chunk.entities[index];
      if(Math.hypot(plant.x-wolf.root.position.x,plant.z-wolf.root.position.z)>2.5)return;
      eatenForage.set(plantKey,`${Math.floor(plant.x/CHUNK_SIZE)}:${Math.floor(plant.z/CHUNK_SIZE)}`);
      chunk.entities.splice(index,1);const lod=chunk.objects.get(plantKey);
      if(lod){chunk.root.remove(lod);disposeObject(lod);chunk.objects.delete(plantKey);}
      wolf.brain.energy=Math.min(100,wolf.brain.energy+FORAGE_ENERGY);wolf.brain.meal=undefined;
      return;
    }
  }
  return { sync, draw, forageWolf, hares, playerBrain: wolf.brain, clock: () => clock, darkness: () => darkness, audibleAnimals: () => audibleAnimals,
    entities: () => [...chunks.values()].flatMap(c => c.entities),
    stats: () => ({ chunks: chunks.size, entities: [...chunks.values()].reduce((n, c) => n + c.entities.length, 0), triangles: renderer.info.render.triangles }),
  };
}
