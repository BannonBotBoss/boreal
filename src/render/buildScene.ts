import * as THREE from 'three';
import { generateGeometry, disposeObject } from './geometry';
import { CHUNK_SIZE, generateChunk, heightAt, type Entity } from '../core/world';
import { restoreEntities, type EventContext } from '../core/events';
import { positionCamera, terrainGeometry } from './math';
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
import { formatHour, gameHour, START_HOUR } from '../core/timeOfDay';
import { LEVEL, BLOCK } from '../core/tuning';
import { stepForward } from '../proc/math';
import type { SnapshotSource } from '../core/snapshot';
import { createPost } from './post';
import { tiles } from '../photo/frame';
import { applyGenome } from './appearance';
import { entityMass, rigMass } from './mass';
import { RIG_BODY_PLAN } from '../core/materials';
import { body, step, collide, gravity, type Body } from '../proc/physics';
import { defaultGenome as defaultLook, type Genome } from '../core/genome';

/** Scene entry point: assembles generated terrain, streamed objects, light and camera. */
/** Commits an animal eating a forage patch; returns the animal's new energy, or undefined if not committed. */
/** Photo mode: a free camera and an optional sun-hour override; the world is drawn frozen. */
export interface PhotoView { cam: { x: number; y: number; z: number; yaw: number; pitch: number; roll: number; fov: number }; hour?: number; focalMm: number; /** false while a live sequence lets the world run */ frozen?: boolean }
export type ForageHandler = (animal: Entity, plant: Entity) => number | undefined;
export function buildScene(canvas: HTMLCanvasElement, onForage?: ForageHandler) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  const BASE_RATIO = Math.min(devicePixelRatio, 1.5);
  renderer.setPixelRatio(BASE_RATIO);
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
  const post = createPost(renderer, scene, camera);
  const chunks = new Map<string, { root: THREE.Group; entities: Entity[]; objects: Map<string, THREE.LOD> }>();
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
  const halo = new THREE.Mesh(new THREE.RingGeometry(1.6, 1.85, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a1, side: THREE.DoubleSide, transparent: true, opacity: .7, depthWrite: false }));
  halo.rotation.x = -Math.PI / 2; halo.visible = false; scene.add(halo);
  let centerKey = '', radius = -1, revision = -1;
  function createChunk(cx: number, cz: number, context: EventContext) {
    const root = new THREE.Group(), objects = new Map<string, THREE.LOD>();
    const geometry = terrainGeometry(cx, cz);
    const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    ground.userData.inspect = { type: 'terrain', key: `chunk:${cx}:${cz}` }; root.add(ground);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE), new THREE.MeshStandardMaterial({ color: 0x578d91, roughness: .32, metalness: .1 }));
    water.rotation.x = -Math.PI / 2; water.position.set((cx + .5) * CHUNK_SIZE, LEVEL.waterSurface, (cz + .5) * CHUNK_SIZE); root.add(water);
    const entities = structuredClone(restoreEntities(applyPopulation(generateChunk(cx, cz), cx, cz), context, { minX: cx * CHUNK_SIZE, minZ: cz * CHUNK_SIZE, maxX: (cx + 1) * CHUNK_SIZE, maxZ: (cz + 1) * CHUNK_SIZE })).filter(e => !eatenForage.has(e.key));
    for (const entity of entities) {
      if (catalog[entity.kind].objectType === 'animal') {
        const previous = animals.get(entity.key);
        if (previous) { entity.x = previous.entity.x; entity.z = previous.entity.z; entity.rotation = previous.entity.rotation; entity.energy = previous.rig.brain.energy; previous.entity = entity; }
        else { const rig = createDeerRig(entity.seed, 0); rig.root.scale.setScalar(entity.scale); rig.brain.heading = entity.rotation; rig.brain.energy = entity.energy ?? ANIMAL_DEFAULT_ENERGY; rig.root.userData.inspect = { type: 'deer', key: entity.key }; const g = lookOf(entity.key, 'deer'); if (g) applyGenome(rig.root, g); scene.add(rig.root); animals.set(entity.key, {rig, entity}); }
        continue;
      }
      const lod = new THREE.LOD();
      for (let detail = 0; detail < 3; detail++) lod.addLevel(generateGeometry(entity, detail), (entity.kind === 'rock' ? [0, 10, 24] : [0, 55, 115])[detail] * RENDER.lod[entity.kind === 'rock' ? 'rocks' : entity.kind === 'spruce' ? 'trees' : 'props'], .12);
      if (entity.kind === 'rock') lod.addLevel(new THREE.Group(), 45 * RENDER.lod.rocks, .12);
      lod.position.set(entity.x, heightAt(entity.x, entity.z), entity.z); lod.userData.inspect = { type: 'entity', key: entity.key }; root.add(lod); objects.set(entity.key, lod);
    }
    scene.add(root); return { root, entities, objects };
  }
  /** `also`: a second streaming centre (the photo-mode camera); the player's own chunks always stay loaded. */
  function sync(x: number, z: number, altitude: number, context: EventContext, eventRevision: number, also?: { x: number; z: number }) {
    activeContext = context;
    const cx = Math.floor(x / CHUNK_SIZE), cz = Math.floor(z / CHUNK_SIZE), nextRadius = altitude > 85 ? 3 : 2;
    const ax = also ? Math.floor(also.x / CHUNK_SIZE) : cx, az = also ? Math.floor(also.z / CHUNK_SIZE) : cz;
    if (centerKey === `${cx}:${cz}:${ax}:${az}` && radius === nextRadius && revision === eventRevision) return;
    const changed = revision !== eventRevision;
    centerKey = `${cx}:${cz}:${ax}:${az}`; radius = nextRadius; revision = eventRevision;
    const needed = new Set<string>();
    for (const [ox, oz] of [[cx, cz], [ax, az]]) for (let a = ox - radius; a <= ox + radius; a++) for (let b = oz - radius; b <= oz + radius; b++) needed.add(`${a}:${b}`);
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
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (output) { if (canvas.width !== output.w || canvas.height !== output.h) { renderer.setPixelRatio(1); renderer.setSize(output.w, output.h, false); } }
    else if (renderer.getPixelRatio() !== BASE_RATIO || canvas.width !== Math.floor(width * BASE_RATIO) || canvas.height !== Math.floor(height * BASE_RATIO)) {
      renderer.setPixelRatio(BASE_RATIO); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
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
    simulateAnimals(dt, x, z, frozen);
    const hour = photo?.hour ?? gameHour(time, startHour); clock = formatHour(hour);
    darkness = sky.update(hour, time, camera, wolf.root.position).light.night;
    if (output) { const s = output.w / output.crop.w; camera.aspect = output.w / output.h; camera.setViewOffset(width * s, height * s, output.crop.x * s, output.crop.y * s, output.w, output.h); }
    else if (camera.view?.enabled) { camera.clearViewOffset(); camera.aspect = width / height; camera.updateProjectionMatrix(); }
    post.render(!!photo, photo?.focalMm ?? 0);
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
  return { scene, pick, lookup, setAppearance, massOf, wolfMass: WOLF_MASS, playerMass: () => rigMass(wolf.root, planOf()), appearanceOf: (key: string) => looks.get(key), get playerLookKey() { return `player:${current.id}`; }, sync, draw, forageWolf, hares, camera, setPlayable, get playable() { return current; }, invalidate: () => { revision = -Infinity; }, post, capture, setOutput: (o: typeof output) => { output = o; }, canvas, distanceAt, snapshotSources, get playerBrain() { return wolf.brain; }, clock: () => clock, darkness: () => darkness, audibleAnimals: () => audibleAnimals,
    entities: () => [...chunks.values()].flatMap(c => c.entities),
    stats: () => ({ chunks: chunks.size, entities: [...chunks.values()].reduce((n, c) => n + c.entities.length, 0), triangles: renderer.info.render.triangles }),
  };
}
