import * as THREE from 'three';
import { generateGeometry, disposeObject } from './geometry';
import * as GEOMETRY from './geometry';
import { CHUNK_SIZE, generateChunk, heightAt, isDryLand, type Entity } from '../core/world';
import { restoreEntities, type EventContext } from '../core/events';
import { CONTACTS, type Contact } from '../core/contactBus';
import { logContact, type LogSeatFn } from '../core/logContact';
import { chunkTerrainJob, positionCamera } from './math';
import { warmTerrainWorkers } from './terrainPool';
import { terrainMaterial } from './pbr';
import { createPhotoreal } from './photoreal';
import { INTEREST, WAIT, cancel, enqueue, pending, setInterestCentre, squareDistance } from '../core/interest';
import { playable, type PlayerRig } from './playables';
import { RENDER } from '../core/renderSettings';
import { applyPopulation } from '../core/population';
import { WOLF_SCALE, type WolfMode } from '../core/wolfModes';
import { pushProgress, rockDiameter } from '../core/rocks';
import { createDeerRig } from './animalRig';
import { ANIMAL_DEFAULT_ENERGY, FORAGE_ENERGY, withinEarshot, type SenseItem } from '../core/animalBehavior';
import { catalog } from '../core/catalog';
import { seatRock } from './rocks';
import { createSky } from './sky';
import { shapeDeer, forgetDeer } from '../core/deerHerd';
import { createHares } from '../animals/hare';
import { formatHour, hourAt } from '../core/timeOfDay';
import { LEVEL, BLOCK } from '../core/tuning';
import { stepForward } from '../proc/math';
import type { SnapshotSource } from '../core/snapshot';
import { createPost } from './post';
import { createChunkBatch } from './batch';
import { STAGES, lakeAt } from '../core/stages/elevation';
import { updateTreeUniforms } from './trees';
import { createGrass } from './grass/grass';
import { createFlora } from './flora/flora';
import { riverAt } from '../core/stages/rivers';
import { waterMaterial, updateWaterUniforms, createWaterMirror, openWaterGeometry } from './water';
import { tiles } from '../photo/frame';
import { applyGenome } from './appearance';
import { entityMass, rigMass } from './mass';
import { RIG_BODY_PLAN } from '../core/materials';
import { body, step, collide, gravity, type Body } from '../proc/physics';
import { defaultGenome as defaultLook, type Genome } from '../core/genome';
import { bandBackground, bandCamera, bandFx } from '../world/globe/inpage';

/** Scene entry point: assembles generated terrain, streamed objects, light and camera. */
/** Commits an animal eating a forage patch; returns the animal's new energy, or undefined if not committed. */
/** Photo mode: a free camera and an optional sun-hour override; the world is drawn frozen. */
export interface PhotoView { cam: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; fov: number }; hour?: number; focalMm: number; /** false while a live sequence lets the world run */ frozen?: boolean }
export type ForageHandler = (animal: Entity, plant: Entity) => number | undefined;
/** T-0005 adapter (T-0006): grok-globe/log-grounding-bark's render/geometry.ts exports `logSeat(entity)`. Detected at
 *  runtime through the module namespace (a computed key, so neither tsc nor the bundler needs the export), so either merge
 *  order works: after T-0005 merges, the contact carries the seated { at, normal } and settle; before, core/logContact's
 *  centre sample. Nothing here seats, sinks or tilts a log. */
const T0005_LOG_SEAT = (GEOMETRY as unknown as Record<string, unknown>)['logSeat'] as LogSeatFn | undefined;
export function buildScene(canvas: HTMLCanvasElement, onForage?: ForageHandler) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); // hybrid laptops: ask for the discrete GPU
  const BASE_RATIO = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(BASE_RATIO);
  renderer.setClearColor(0xc4d4c8);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xc4d4c8, 200, 480);
  const sky = createSky(scene); // sun, moon, sky colour, clouds, stars and fog follow the game clock
  // Time of day: core/timeOfDay hourAt (world clock + the chronometer's dial; ?hour=HH sets the first value, initDay in main).
  let clock = formatHour(hourAt(0)), darkness = 0;
  let worldTime: number | undefined; // set by main from core/worldClock
  const camera = new THREE.PerspectiveCamera(48, 1, .2, 700);
  const post = createPost(renderer, scene, camera);
  const photoreal = createPhotoreal(renderer, scene, camera, sky, BASE_RATIO); // PBR lighting, CSM, IBL, GTAO + quality governor
  const ratio = () => Math.min(BASE_RATIO, 1.5) * photoreal.tier.resScale;
  const waterMirror = createWaterMirror(renderer); // T-0023: the open water mirrors shore and sky (tiers with IBL)
  const chunks = new Map<string, { root: THREE.Group; entities: Entity[]; objects: Map<string, THREE.Object3D>; near: boolean; batch: import('./batch').ChunkBatch; contacts: Contact[] }>();
  const animals = new Map<string, { rig: ReturnType<typeof createDeerRig>; entity: Entity }>();
  const eatenForage = new Map<string, string>(); // plant key -> loaded chunk; never serialized
  let activeContext: EventContext;
  let current = playable('wolf'), wolf: PlayerRig = current.create(); scene.add(wolf.root);
  /** Appearance genomes: 'player:<playable>', 'species:deer' (all deer) or an entity key (one animal). */
  const looks = new Map<string, Genome>();
  const lookOf = (key: string, species: string) => looks.get(key) ?? looks.get(`species:${species}`);
  const WOLF_MASS = rigMass(wolf.root, 'canid');
  const planOf = () => RIG_BODY_PLAN[current.id] ?? 'canid'; // reference for force calibration (default wolf)
  const PLAYER_TAG = { type: 'player', key: 'player' }; wolf.root.userData.inspect = PLAYER_TAG;
  /** Swap the controlled animal in place (keeps position, heading and energy). */
  function setPlayable(id: string) {
    const next = playable(id); if (next.id === current.id) return current;
    const old = wolf; wolf = next.create(); current = next; scene.remove(old.root); disposeObject(old.root);
    wolf.brain.heading = old.brain.heading; wolf.brain.energy = old.brain.energy; wolf.root.userData.inspect = PLAYER_TAG; const g = looks.get(`player:${id}`); if (g) applyGenome(wolf.root, g); scene.add(wolf.root); return current;
  }
  const hares = createHares(scene); // src/animals/hare.ts
  const grass = createGrass(scene); // render/grass: procedural blades around the camera
  const flora = createFlora(scene); // render/flora: flowers + shrubs (shared ecology with the grass)
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a1, side: THREE.DoubleSide, transparent: true, opacity: .7, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.visible = false; scene.add(halo);
  let lastBatchLod = -1;
  let centerKey = '', radius = -1, revision = -1; const chunkJobs = new Set<string>();
  const CHUNK_ADDS_PER_FRAME = 2; let frameNo = 0; const adds = { frame: -1, n: 0 }; // upload pacing (see createChunk)
  warmTerrainWorkers(); // stage grids in each terrain worker, behind the loading screen
  /** Instantiates a chunk from the math layers as a sliced job (core/interest): near = full, mid = coarse terrain + far LODs. */
  function* createChunk(cx: number, cz: number, context: EventContext, near: boolean) {
    const root = new THREE.Group(), objects = new Map<string, THREE.Object3D>(), batch = createChunkBatch(), contacts: Contact[] = []; // contacts begin only once the chunk is in the scene (a cancelled build fires nothing)
    // heights, normals, world-space positions and the water sheet come from a terrain worker (render/terrainPool); WAIT until then
    const t = yield* chunkTerrainJob(cx, cz, near ? RENDER.terrainSegments : Math.max(10, RENDER.terrainSegments >> 3), near, STAGES.on ? (near ? 32 : 8) : 0, { worker: true, wanted: () => chunkJobs.has(`${cx}:${cz}`) });
    const ground = new THREE.Mesh(t.terrain, terrainMaterial()); ground.receiveShadow = true;
    ground.userData.inspect = { type: 'terrain', key: `chunk:${cx}:${cz}` }; ground.layers.enable(1); root.add(ground); // layer 1 = GI probe capture
    const sheet = openWaterGeometry(t.terrain); if (sheet) root.add(new THREE.Mesh(sheet, waterMaterial())); // T-0023: terrain grid at the water level, depth per vertex; none on dry chunks
    if (t.water) { const lake = new THREE.Mesh(t.water, waterMaterial()); lake.userData.inspect = { type: 'terrain', key: `water:${cx}:${cz}` }; root.add(lake); } // stages 2b/2c: lake level / river surface sheet
    const generated = applyPopulation(generateChunk(cx, cz), cx, cz); yield; // chunk build steps stay within the 4 ms job budget
    // Old remembered people bypass generation's land test. Hide invalid placements without
    // deleting their relationship/event records or inventing a new location for them.
    const entities = structuredClone(restoreEntities(generated, context, { minX: cx * CHUNK_SIZE, minZ: cz * CHUNK_SIZE, maxX: (cx + 1) * CHUNK_SIZE, maxZ: (cz + 1) * CHUNK_SIZE })).filter(e => !eatenForage.has(e.key) && (e.kind !== 'person' || isDryLand(e.x, e.z)));
    for (const entity of entities) {
      if (catalog[entity.kind].objectType === 'animal') {
        const previous = animals.get(entity.key);
        if (previous) { entity.x = previous.entity.x; entity.z = previous.entity.z; entity.rotation = previous.entity.rotation; entity.energy = previous.rig.brain.energy; previous.entity = entity; }
        else { const rig = createDeerRig(entity.seed, 0); rig.root.scale.setScalar(entity.scale); rig.brain.heading = entity.rotation; rig.brain.energy = entity.energy ?? ANIMAL_DEFAULT_ENERGY; rig.root.userData.inspect = { type: 'deer', key: entity.key }; const g = lookOf(entity.key, 'deer'); if (g) applyGenome(rig.root, g); scene.add(rig.root); animals.set(entity.key, {rig, entity}); }
        continue;
      }
      const ranges = (entity.kind === 'rock' ? [0, 10, 24] : [0, 55, 115]).map(r => r * RENDER.lod[entity.kind === 'rock' ? 'rocks' : entity.kind === 'spruce' ? 'trees' : 'props']);
      const y = heightAt(entity.x, entity.z);
      if (entity.kind === 'log') contacts.push(logContact(entity, y, T0005_LOG_SEAT)); // T-0006: the one call site; T-0005's logSeat when present
      if (entity.kind !== 'person') { // static: batched per chunk + material (render/batch); a pushed rock becomes a live LOD (see draw)
        const levels: THREE.Object3D[] = []; for (let d = 0; d < 3; d++) { levels.push(generateGeometry(entity, d)); if (d < 2) yield; } // one LOD per step
        batch.add(entity.key, new THREE.Vector3(entity.x, y, entity.z), levels, entity.kind === 'rock' ? [...ranges, 45 * RENDER.lod.rocks] : ranges);
        const proxy = new THREE.Object3D(); proxy.position.set(entity.x, y, entity.z); proxy.userData.inspect = { type: 'entity', key: entity.key }; objects.set(entity.key, proxy);
        yield; continue;
      }
      const lod = new THREE.LOD();
      for (let detail = 0; detail < 3; detail++) lod.addLevel(generateGeometry(entity, detail), ranges[detail], .12);
      // (rocks are batched; only persons reach this live-LOD path)
      lod.position.set(entity.x, y, entity.z); lod.userData.inspect = { type: 'entity', key: entity.key }; root.add(lod); objects.set(entity.key, lod);
      yield;
    }
    for (const m of yield* batch.buildJob()) root.add(m); // sliced per material / few instances
    yield;
    // GPU uploads happen on a mesh's first draw: add at most CHUNK_ADDS_PER_FRAME chunk roots per frame, so uploads spread out
    while (adds.frame === frameNo && adds.n >= CHUNK_ADDS_PER_FRAME) yield WAIT;
    if (adds.frame !== frameNo) { adds.frame = frameNo; adds.n = 0; } adds.n++;
    scene.add(root); for (const c of contacts) CONTACTS.begin(c); // T-0006: rising edge per log; ends at disposal
    return { root, entities, objects, near, batch, contacts };
  }
  /** `also`: a second streaming centre (the photo-mode camera); the player's own chunks always stay loaded. */
  function sync(x: number, z: number, altitude: number, context: EventContext, eventRevision: number, also?: { x: number; z: number }) {
    activeContext = context;
    setInterestCentre(also?.x ?? x, also?.z ?? z); // photo mode: the free camera is the centre
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE), nextRadius = Math.ceil((altitude > 85 ? INTEREST.mid * 1.5 : INTEREST.mid) / CHUNK_SIZE);
    const ax = also ? Math.floor(also.x / CHUNK_SIZE) : cx, az = also ? Math.floor(also.z / CHUNK_SIZE) : cz;
    const tierKey = `${cx}:${cz}:${ax}:${az}:${INTEREST.near}:${INTEREST.mid}`;
    if (centerKey === tierKey && radius === nextRadius && revision === eventRevision) return;
    const changed = revision !== eventRevision;
    centerKey = tierKey; radius = nextRadius; revision = eventRevision;
    const needed = new Map<string, boolean>(); // chunk key -> near tier
    for (const [ox, oz] of [[cx, cz], [ax, az]]) for (let a = ox - radius; a <= ox + radius; a++) for (let b = oz - radius; b <= oz + radius; b++) {
      const d = squareDistance(a * CHUNK_SIZE, b * CHUNK_SIZE, CHUNK_SIZE), own = a === cx && b === cz;
      if (d <= INTEREST.mid || own) needed.set(`${a}:${b}`, (needed.get(`${a}:${b}`) ?? false) || d <= INTEREST.near || own);
    }
    for (const [plantKey, chunkKey] of eatenForage) if (!needed.has(chunkKey)) eatenForage.delete(plantKey);
    // Far = math only: dispose everything outside the radius (and re-instantiate when a chunk changes tier).
    for (const [key, chunk] of chunks) if (changed || !needed.has(key) || needed.get(key) !== chunk.near) {
      scene.remove(chunk.root); disposeObject(chunk.root); for (const c of chunk.contacts) CONTACTS.end(c.a, c.b); chunks.delete(key);
    }
    for (const key of [...chunkJobs]) if (!needed.has(key)) { cancel(`chunk:${key}`); chunkJobs.delete(key); }
    for (const [key, near] of needed) if (!chunks.has(key) && !pending(`chunk:${key}`)) {
      const [a, b] = key.split(':').map(Number); chunkJobs.add(key);
      enqueue(`chunk:${key}`, squareDistance(a * CHUNK_SIZE, b * CHUNK_SIZE, CHUNK_SIZE), createChunk(a, b, context, near), c => { chunkJobs.delete(key); chunks.set(key, c); });
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
      if (lod) { chunk.root.remove(lod); disposeObject(lod); chunk.objects.delete(plantKey); chunk.batch.hide(plantKey); }
      animal.rig.brain.energy = energy; animal.entity.energy = energy;
      return;
    }
  }
  let previousTime = 0;
  const headPoint = new THREE.Vector3();
  const audibleAnimals: {key:string; energy:number; motion:string; problem:string; x:number; z:number; phase:number}[] = [];
  function simulateAnimals(dt:number, x:number,z:number, frozen=false) {
    audibleAnimals.length=0;
    scene.updateMatrixWorld(true);
    const entities=[...chunks.values()].flatMap(c=>c.entities), keys=new Set(entities.map(e=>e.key));
    // Only forage patches are food; low herbs are neither food nor obstacles.
    const observations:SenseItem[]=entities.filter(e=>e.kind!=='plant'&&(e.kind!=='rock'||rockDiameter(e)>.22)).map(e=>({key:e.key,x:e.x,y:heightAt(e.x,e.z)+ (e.kind==='deer'?1:0),z:e.z,
      kind:e.kind==='forage'?'food':e.kind==='deer'?'animal':'obstacle',low:e.kind==='log'||e.kind==='rock'}));
    wolf.root.updateMatrixWorld(true);wolf.sensor.getWorldPosition(headPoint);if(!frozen)wolf.brain.sense(headPoint,observations);
    const herd=[...animals].map(([key,a])=>({key,x:a.entity.x,z:a.entity.z,brain:a.rig.brain}));
    for(const [key,animal] of animals) {
      if(!keys.has(key)) {scene.remove(animal.rig.root);disposeObject(animal.rig.root);animals.delete(key);forgetDeer(key);continue;}
      const {rig,entity:e}=animal;
      rig.root.position.set(e.x,heightAt(e.x,e.z),e.z);rig.root.rotation.y=rig.brain.heading;rig.root.updateMatrixWorld(true);
      rig.sensor.getWorldPosition(headPoint);
      if(!withinEarshot({x,y:heightAt(x,z)+.45*WOLF_SCALE,z},headPoint))continue;
      rig.root.visible=Math.hypot(e.x-x,e.z-z)<RENDER.animalDistance;
      if(frozen){rig.animate(0);continue;} // photo mode: pose from the (possibly rewound) brain state, no simulation
      const senses=observations.filter(i=>i.key!==key);
      if(activeContext.records[key]?.relationship!=='friend') senses.push({key:'player',x,y:heightAt(x,z)+.3*WOLF_SCALE,z,kind:current.threat?'threat':'animal'});
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
        // Momentum contact with the player (one integrator): knock velocity decays by ground friction.
        const ddx=e.x-x,ddz=e.z-z,dist=Math.hypot(ddx,ddz);
        if(dist<1.3&&dist>1e-3){const nx=ddx/dist,nz=ddz/dist,mp=rigMass(wolf.root,planOf()),md=rigMass(rig.root,'cervid'),vp=wolf.brain.speed*(-Math.sin(wolf.brain.heading)*nx-Math.cos(wolf.brain.heading)*nz);
          const kb:Body=rig.root.userData.kb??=body(md),vd=kb.vx*nx+kb.vz*nz,[,vd2]=collide(mp,vp,md,vd);if(vd2>vd){kb.vx+=(vd2-vd)*nx;kb.vz+=(vd2-vd)*nz;}}
        const kb:Body|undefined=rig.root.userData.kb;
        if(kb&&Math.hypot(kb.vx,kb.vz)>.01){const v=Math.hypot(kb.vx,kb.vz),fr=Math.min(.6*kb.mass*gravity(),kb.mass*v/dt);kb.x=e.x;kb.z=e.z;kb.y=0;step(kb,dt,{x:-kb.vx/v*fr,z:-kb.vz/v*fr,y:kb.mass*gravity()},-1);
          if(heightAt(kb.x,kb.z)>=LEVEL.deerWater){e.x=kb.x;e.z=kb.z;}else{kb.vx=0;kb.vz=0;}}
        rig.brain.expend(dt,Math.hypot(e.x-oldX,e.z-oldZ));e.energy=rig.brain.energy;e.rotation=rig.brain.heading;
      }
      rig.root.position.set(e.x,heightAt(e.x,e.z),e.z);rig.root.rotation.y=rig.brain.heading;rig.animate(dt);
      audibleAnimals.push({key,energy:rig.brain.energy,motion:rig.brain.motion,problem:rig.brain.problem,x:e.x,z:e.z,phase:rig.brain.phase});
    }
  }
  function draw(x: number, z: number, altitude: number, yaw: number, time: number, target?: Entity, pitch?: number,
    moving = false, action?: 'speak' | 'gather' | 'move', actionElapsed = 0, lookYaw = 0, mode: WolfMode = 'walk', focus?: Entity, pushFrom?: Entity, photo?: PhotoView) {
    frameNo++;
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (output) { if (canvas.width !== output.w || canvas.height !== output.h) { renderer.setPixelRatio(1); renderer.setSize(output.w, output.h, false); } }
    else if (renderer.getPixelRatio() !== ratio() || canvas.width !== Math.floor(width * ratio()) || canvas.height !== Math.floor(height * ratio())) {
      renderer.setPixelRatio(ratio()); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    }
    const ground = Math.max(heightAt(x, z), -.2);
    wolf.root.position.set(x, ground, z); wolf.root.rotation.y = yaw;
    const pushed = pushFrom && [...chunks.values()].flatMap(c => c.entities).find(e => e.key === pushFrom.key);
    const pushVector = pushed && pushFrom ? { x: pushed.x - pushFrom.x, z: pushed.z - pushFrom.z, yaw } : undefined;
    wolf.animate({ time, dt: photo && photo.frozen !== false ? 0 : Math.max(0, Math.min(.1, time - previousTime)), moving, action, elapsed: actionElapsed, mode, push: pushVector });
    positionCamera(camera, x, z, altitude, yaw, pitch, lookYaw);
    const focused = mode === 'super-stealth' && !photo ? focus : undefined;
    const frozen = !!photo && photo.frozen !== false;
    const dt = frozen ? 0 : Math.max(0, Math.min(.1, time - previousTime)); if (!frozen) previousTime = time;
    camera.fov += ((focused ? 30 : 48) - camera.fov) * (1 - Math.exp(-8 * dt));
    if (photo) { const c = photo.cam; camera.position.set(c.x, c.y, c.z); camera.rotation.set(c.pitch, c.yaw, c.roll, 'YXZ'); camera.fov = c.fov; camera.updateMatrixWorld(true); }
    bandCamera(camera); // world/globe/inpage: the in-page transition flies the camera in the band (no-op otherwise)
    camera.updateProjectionMatrix();
    if (focused) camera.lookAt(focused.x, heightAt(focused.x, focused.z) + (focused.kind === 'deer' ? 1.5 : 1), focused.z);
    const highlighted = focused ?? target;
    halo.visible = !!highlighted && !photo;
    if (highlighted) {
      halo.position.set(highlighted.x, heightAt(highlighted.x, highlighted.z) + .02, highlighted.z);
      halo.scale.setScalar(highlighted.kind === 'rock' ? (rockDiameter(highlighted) / 2 + .05) / 1.6 : 1);
    }
    for (const chunk of chunks.values()) for (const entity of chunk.entities) {
      if (entity.kind === 'rock' && pushFrom?.key === entity.key) {
        let lod = chunk.objects.get(entity.key) as THREE.LOD;
        if (!lod.isLOD) { // first push: take this rock out of the batch and give it its own LOD so it can roll
          lod = new THREE.LOD(); [0, 10, 24].forEach((r, d) => lod.addLevel(generateGeometry(entity, d), r * RENDER.lod.rocks, .12)); lod.addLevel(new THREE.Group(), 45 * RENDER.lod.rocks, .12);
          lod.userData.inspect = { type: 'entity', key: entity.key }; chunk.root.add(lod); chunk.objects.set(entity.key, lod); chunk.batch.hide(entity.key); }
        const t = pushProgress(actionElapsed);
        const pose = { ...entity, x: pushFrom.x + (entity.x - pushFrom.x) * t, z: pushFrom.z + (entity.z - pushFrom.z) * t,
          rollX: (pushFrom.rollX ?? 0) + ((entity.rollX ?? 0) - (pushFrom.rollX ?? 0)) * t,
          rollZ: (pushFrom.rollZ ?? 0) + ((entity.rollZ ?? 0) - (pushFrom.rollZ ?? 0)) * t };
        lod.position.set(pose.x, heightAt(pose.x, pose.z), pose.z);
        for (const level of lod.levels) if (level.object.children.length) seatRock(level.object, pose);
      }
      if (entity.kind !== 'person') continue;
      const lod = chunk.objects.get(entity.key)! as THREE.LOD;
      lod.rotation.y = Math.sin(time * .7 + entity.seed) * .07;
    }
    if (time - lastBatchLod > .25 || time < lastBatchLod) { lastBatchLod = time; for (const c of chunks.values()) c.batch.update(camera.position, 1); }
    updateTreeUniforms(); updateWaterUniforms(); flora.update(camera, photoreal.tier.foliage, INTEREST.near); grass.update(camera, wolf.root.position, photoreal.tier.foliage, INTEREST.near);
    simulateAnimals(dt, x, z, frozen);
    const tod = worldTime ?? time; // time of day / seasons are 'clock' fields (core/stateFields): world clock, also during pause
    const hour = photo?.hour ?? hourAt(tod); clock = formatHour(hour);
    const lit = sky.update(hour, tod, camera, wolf.root.position); darkness = lit.light.night;
    bandBackground(scene, camera); // world/globe/inpage: band = globe far layer as the background + patch fade (no-op otherwise)
    photoreal.before(lit.dir, time);
    if (output) { const s = output.w / output.crop.w; camera.aspect = output.w / output.h; camera.setViewOffset(width * s, height * s, output.crop.x * s, output.crop.y * s, output.w, output.h); }
    else if (camera.view?.enabled) { camera.clearViewOffset(); camera.aspect = width / height; camera.updateProjectionMatrix(); }
    const fx = bandFx(photoreal.tier); // world/globe/inpage: no god rays over the far layer, AO once the patch is in (= tier otherwise)
    for (const f of beforeRender) f(time, !!photo); // overlays that follow the posed wolf (render/sensesHalo)
    waterMirror.update(scene, camera, !!photoreal.tier.ibl);
    post.render(!!photo, photo?.focalMm ?? 0, fx.ssao, { contact: fx.contact, rays: fx.rays, sunDir: lit.dir, sunCol: sky.sunLight.color });
  }
  function forageWolf(plantKey: string) {
    for(const chunk of chunks.values()) {
      const index=chunk.entities.findIndex(e=>e.key===plantKey && e.kind==='forage');
      if(index<0) continue;
      const plant=chunk.entities[index];
      if(Math.hypot(plant.x-wolf.root.position.x,plant.z-wolf.root.position.z)>2.5)return;
      eatenForage.set(plantKey,`${Math.floor(plant.x/CHUNK_SIZE)}:${Math.floor(plant.z/CHUNK_SIZE)}`);
      chunk.entities.splice(index,1);const lod=chunk.objects.get(plantKey);
      if(lod){chunk.root.remove(lod);disposeObject(lod);chunk.objects.delete(plantKey);chunk.batch.hide(plantKey);}
      wolf.brain.energy=Math.min(100,wolf.brain.energy+FORAGE_ENERGY);wolf.brain.meal=undefined;
      return;
    }
  }
  type DeerShot = [string, number, number, number, number, string, number, number, number, number, string | undefined][];
  /** Rewind sources (see core/snapshot.ts): only the state that is visible in a frozen frame. */
  const snapshotSources: Record<string, SnapshotSource<any>> = {
    wolf: {
      capture: () => { const b = wolf.brain; return [b.motion, b.phase, b.jumpTime, b.gaitSpeed, b.speed, b.heading]; },
      restore: (s: any[]) => { const b = wolf.brain; [b.motion, b.phase, b.jumpTime, b.gaitSpeed, b.speed, b.heading] = s; },
    } as SnapshotSource<any[]>,
    deer: {
      capture: () => [...animals].map(([k, { rig: { brain: b, root }, entity: e }]) => [k, e.x, e.z, e.rotation, b.heading, b.motion, b.phase, b.jumpTime, b.gaitSpeed, b.speed, root.userData.posture]),
      restore: shot => { for (const s of shot) { const a = animals.get(s[0]); if (!a) continue; const b = a.rig.brain, e = a.entity;
        [, e.x, e.z, e.rotation, b.heading, b.motion as string, b.phase, b.jumpTime, b.gaitSpeed, b.speed, a.rig.root.userData.posture] = s; } },
    } as SnapshotSource<DeerShot>,
    hares: hares.snapshot,
  };
  /** Crop (screen px) + output size (px) for the video stream; undefined = normal full-screen rendering. */
  const beforeRender: ((time: number, photo: boolean) => void)[] = [];
  let output: { crop: { x: number; y: number; w: number; h: number }; w: number; h: number } | undefined;
  /** Renders `crop` of the current view into an exact w×h output, tiled when it exceeds the GPU's limits. */
  function renderCrop(crop: { x: number; y: number; w: number; h: number }, w: number, h: number, focalMm: number, tile: { x: number; y: number; w: number; h: number }) {
    const s = w / crop.w;
    renderer.setPixelRatio(1); renderer.setSize(tile.w, tile.h, false);
    camera.aspect = tile.w / tile.h;
    camera.setViewOffset(canvas.clientWidth * s, canvas.clientHeight * s, crop.x * s + tile.x, crop.y * s + tile.y, tile.w, tile.h);
    post.render(true, focalMm);
  }
  /** One capture path for photos, sequences and (via setOutput) video: PNG of `crop` at w×h, effects on, no UI. */
  function capture(crop: { x: number; y: number; w: number; h: number }, w: number, h: number, photo: PhotoView, type = 'image/png', quality?: number): Promise<Blob | null> {
    const gl = renderer.getContext(), max = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), 4096);
    const out = document.createElement('canvas'); out.width = w; out.height = h; const ctx = out.getContext('2d')!;
    const ratio = renderer.getPixelRatio(), cw = canvas.clientWidth, ch = canvas.clientHeight, aspect = camera.aspect;
    for (const t of tiles(w, h, max)) { renderCrop(crop, w, h, photo.focalMm, t); ctx.drawImage(canvas, 0, 0, t.w, t.h, t.x, t.y, t.w, t.h); }
    camera.clearViewOffset(); camera.aspect = aspect; camera.updateProjectionMatrix();
    renderer.setPixelRatio(ratio); renderer.setSize(cw, ch, false);
    return new Promise(done => out.toBlob(done, type, quality));
  }
  /** Distance from the camera to whatever is under a screen point (NDC), for click-to-focus and autofocus. */
  const ray = new THREE.Raycaster();
  function distanceAt(ndcX: number, ndcY: number) {
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hit = ray.intersectObjects([...chunks.values()].map(c => c.root), true)[0];
    return hit?.distance;
  }
  /** Generation inspector: what is under a screen point (walks up to the nearest `userData.inspect` tag). */
  function pick(ndcX: number, ndcY: number) {
    ray.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const roots = [...[...chunks.values()].map(c => c.root), ...[...animals.values()].map(a => a.rig.root), ...hares.list().map(h => h.root), wolf.root];
    for (const hit of ray.intersectObjects(roots, true)) {
      const keys = hit.object.userData.keys as string[] | undefined;
      if (keys && hit.batchId !== undefined) return { type: 'entity', key: keys[hit.batchId], point: hit.point.clone() };
      let o: THREE.Object3D | null = hit.object; while (o && !o.userData.inspect) o = o.parent;
      if (o?.visible !== false && o) return { ...(o.userData.inspect as { type: string; key: string }), point: hit.point.clone() };
    }
  }
  /** Inspector lookup by key: the scene object plus whatever generated/drives it (entity, brain, hare). */
  function lookup(key: string) {
    if (key === 'player') return { object: wolf.root, brain: wolf.brain };
    const a = animals.get(key); if (a) return { object: a.rig.root, brain: a.rig.brain, entity: a.entity, audible: audibleAnimals.find(x => x.key === key) };
    const h = hares.list().find(x => `hare:${x.id}` === key); if (h) return { object: h.root, hare: h };
    if (key.startsWith('chunk:')) { const c = chunks.get(key.slice(6)); return c && { object: c.root.children[0] }; }
    for (const c of chunks.values()) { const e = c.entities.find(x => x.key === key); if (e) return { object: c.objects.get(key), entity: e }; }
  }
  /** Set (or clear with undefined) a genome and re-apply it to every live rig it covers. */
  function setAppearance(key: string, g: Genome | undefined) {
    if (g) looks.set(key, g); else looks.delete(key);
    if (key === `player:${current.id}`) applyGenome(wolf.root, g ?? defaultLook());
    for (const [k, a] of animals) { const l = lookOf(k, 'deer'); if (key === k || key === 'species:deer') applyGenome(a.rig.root, l ?? defaultLook()); }
  }
  /** Mass (kg) of anything by inspector key; traced, so the inspector shows density x volume. */
  function massOf(key: string) { const l = lookup(key); if (!l) return undefined; return key === 'player' ? rigMass(wolf.root, planOf()) : l.brain && l.object ? rigMass(l.object, 'cervid') : l.entity ? entityMass(l.entity) : l.object && l.hare ? rigMass(l.object, 'leporid') : undefined; }
  return { set worldTime(t: number | undefined) { worldTime = t; }, onBeforeRender: (f: (time: number, photo: boolean) => void) => { beforeRender.push(f); }, scene, pick, lookup, setAppearance, massOf, wolfMass: WOLF_MASS, playerMass: () => rigMass(wolf.root, planOf()), appearanceOf: (key: string) => looks.get(key), get playerLookKey() { return `player:${current.id}`; }, sync, draw, forageWolf, hares, camera, setPlayable, get playable() { return current; }, invalidate: () => { revision = -Infinity; }, post, photoreal, capture, setOutput: (o: typeof output) => { output = o; }, canvas, distanceAt, snapshotSources, get playerBrain() { return wolf.brain; }, clock: () => clock, darkness: () => darkness, audibleAnimals: () => audibleAnimals,
    entities: () => [...chunks.values()].flatMap(c => c.entities),
    /** The saved record for a key (undefined for generated objects), e.g. for the inspector's why. */
    recordOf: (key: string) => activeContext?.records[key],
    stats: () => ({ chunks: chunks.size, entities: [...chunks.values()].reduce((n, c) => n + c.entities.length, 0), triangles: renderer.info.render.triangles }),
  };
}
