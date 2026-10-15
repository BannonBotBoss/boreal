import './style.css';
import { buildScene } from './render/buildScene';
import { availableActions, consumeForage, createContext, friendCount, interact, parseContext, type Player } from './core/events';
import { catalog } from './core/catalog';
import type { Entity } from './core/world';
import { AudioLibrary } from './audio';
import { BorealSound } from './audio/borealSound';
import { createMusic } from './audio/music';
import { MUSIC_SAFETY, MUSIC_SETTINGS } from './audio/musicSettings';
import { wolfSpeak } from './audio/wolfVoice';
import { playerSpeed, pounceSpeed } from './core/playerTuning';
import { HARE } from './animals/hare';
const sfx = new BorealSound();
const music = createMusic(() => sfx.musicInput(), on => { sfx.builtInMusic = on; });
import { clampLookPitch, springLookPitch, DEFAULT_PITCH, RIDER_HEIGHT } from './render/math';
import { steerWolf } from './core/locomotion';
import { createWolfModes, stepWolfModes, modeSpeed } from './core/wolfModes';
import { ANIMAL_DEFAULT_ENERGY, FORAGE_ENERGY } from './core/animalBehavior';
import { autonomousWolfStep } from './core/autonomy';
import { createSnapshotHub } from './core/snapshot';
import { createPhotoMode } from './photo/photoMode';
import { createPauseMenu } from './ui/pauseMenu';
import { shaderClock } from './render/shaderClock';
import { RENDER_SETTINGS, createSettingsStore } from './core/renderSettings';
import { settingsPanel } from './ui/settingsPanel';
import { playerPanel } from './ui/playerPanel';
import type { PhotoView } from './render/buildScene';
import { createInspector } from './ui/inspector';
import { createHandles } from './ui/shapeTools';
import { setThunk } from './ui/haptics';
import { accelLimit, approach, gravity } from './proc/physics';
import { GROUND, SAVE_KEY_GROUND, addDeposit, column, deerDroppingsKg, footing, loadGround, saveGround, tickGround } from './core/ground';
import { appearancePanel, restoreLooks } from './ui/appearancePanel';
import { runJobs } from './core/interest';
import { SAVE_KEY_WEATHER, drag as airDrag, loadWeather, saveWeather, updateWeather, weatherAt, windAt } from './core/weather';
import { SAVE_KEY_DELTAS, loadDeltas, prune, record, saveDeltas } from './core/deltas';
import { DAY_OF_YEAR, START_HOUR, REAL_SECONDS_PER_GAME_HOUR } from './core/timeOfDay';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('world'), status = element('status'), actionButton = element<HTMLButtonElement>('act');
const dialog = element<HTMLDialogElement>('info'), audio = new AudioLibrary();
const SAVE_KEY = 'boreal.events.v1';
let context = createContext(), saveBlocked = false;
let noticeTimer: ReturnType<typeof setTimeout>;
function notice(message: string) {
  const node = element('notice'); node.textContent = message; node.style.display = 'block';
  clearTimeout(noticeTimer); noticeTimer = setTimeout(() => node.style.display = 'none', 6000);
}
try {
  const saved = localStorage.getItem(SAVE_KEY); if (saved) context = parseContext(saved);
} catch (error) { saveBlocked = true; notice(`Save unavailable: ${String(error)}. Interactions are disabled to protect it.`); }
const player: Player = { x: 0, z: 0, heading: -.35, abilities: ['speak', 'gather', 'move'] };
let altitude = RIDER_HEIGHT, yaw = -.35, pitch = DEFAULT_PITCH, revision = 0, paused = false, target: Entity | undefined;
let pushFrom: Entity | undefined;
let playerAction: 'speak' | 'gather' | 'move' | undefined, actionStarted = 0;
let lookYaw = 0;
let modes = createWolfModes(), focusTarget: Entity | undefined;
let autonomous = false;
function setAutonomous(enabled: boolean) {
  autonomous=enabled;
  element('autonomous').textContent=enabled?'Autonomous: On':'Autonomous: Off';
  element('autonomous').setAttribute('aria-pressed',String(enabled));
  if(view) {view.playerBrain.heading=yaw;view.playerBrain.feedTime=0;view.playerBrain.meal=undefined;}
}
element('autonomous').onclick=()=>setAutonomous(!autonomous);
let view: ReturnType<typeof buildScene>;
// Only animals already remembered through player interaction may update the save.
const onForage = (animal: Entity, plant: Entity) => {
  try {
    const next = consumeForage(context, animal, plant);
    if (next === context) return Math.min(100, (animal.energy ?? ANIMAL_DEFAULT_ENERGY) + FORAGE_ENERGY);
    if (saveBlocked) return undefined;
    localStorage.setItem(SAVE_KEY, JSON.stringify(next));
    context = next; return next.records[animal.key].entity.energy;
  } catch { return undefined; }
};
try { view = buildScene(canvas, onForage); } catch (error) {
  status.textContent = '3D unavailable. Open this page in a browser with WebGL2 enabled.';
  throw error;
}
function perform() {
  if(autonomous) setAutonomous(false);
  if (!target || paused || dialog.open || saveBlocked) return;
  if (playerAction) return;
  const action = availableActions(player, target, context)[0]; if (!action || action === 'forage') return;
  try {
    const next = interact(context, player, target, action);
    localStorage.setItem(SAVE_KEY, JSON.stringify(next)); // Commit before visible rewards.
    context = next; revision++;
    pushFrom = action === 'move' ? structuredClone(target) : undefined;
    playerAction = action; actionStarted = simTime;
    audio.play(action === 'move' ? 'stone-roll' : action === 'speak' ? 'friend-chime' : 'gather-rustle');
    sfx.action(action, target);
    if (action === 'speak') { const t = target, a = view.audibleAnimals().find(x => x.key === t.key); wolfSpeak(sfx, t, { darkness: view.darkness(), animal: a }); }
    notice(action === 'move' ? 'Stone pushed with your snout. Its new position is remembered.' : action === 'speak' ? 'Relationship remembered in the events context.' : 'Herb gathered. Its removal is remembered.');
  } catch (error) { notice(`Interaction not committed: ${String(error)}`); }
}
function togglePause() { paused = !paused; if (!paused) applyPending(); element('pause').textContent = paused ? 'Resume' : 'Pause'; pauseMenu.show(paused); sfx.pauseCue(); }
const pauseMenu = createPauseMenu({ resume: () => { if (paused) togglePause(); }, photo: () => enterPhoto() });
// Rewind history: every system registers its own snapshot source; photo mode never touches systems directly.
const hub = createSnapshotHub(600); // 60 s at 10 Hz
for (const [key, source] of Object.entries(view.snapshotSources)) hub.register(key, source);
hub.register('player', {
  capture: () => [player.x, player.z, yaw, simTime, shaderClock.time, actionStarted],
  restore: (s: number[]) => { [player.x, player.z, yaw, simTime, shaderClock.time, actionStarted] = s; player.heading = yaw; },
});
const drawFrame = (pv?: PhotoView) => view.draw(player.x, player.z, altitude, yaw, simTime, target, pitch, Math.abs(view.playerBrain.speed) > .01, playerAction, simTime - actionStarted, lookYaw, modes.mode, focusTarget, pushFrom, pv);
const photo = createPhotoMode({ view, hub, simTime: () => simTime, notice, draw: pv => drawFrame(pv), onExit: () => { clearInput(); accumulator = 0; document.body.classList.remove('photo-mode'); } });
// Pause-menu panels. Anything that rebuilds the world or swaps the body waits until resume.
const renderStore = createSettingsStore(RENDER_SETTINGS);
if (new URLSearchParams(location.search).has('stages')) renderStore.set('world.stagedTerrain', true); // dev/bench: ?stages=1
let pendingRegen = false, playAs = localStorage.getItem('boreal.player.v1') ?? 'wolf', pendingPlay = playAs !== 'wolf';
pauseMenu.addPanel({ id: 'render', title: 'Render settings', build: settingsPanel(RENDER_SETTINGS, renderStore, () => { pendingRegen = true; }) });
const musicStore = createSettingsStore(MUSIC_SETTINGS, 'boreal.music.v1');
pauseMenu.addPanel({ id: 'music', title: 'Music', build: () => { const form = settingsPanel(MUSIC_SETTINGS, musicStore, () => {})() as HTMLElement;
  const warn = document.createElement('p'); warn.className = 'note'; warn.textContent = MUSIC_SAFETY; form.prepend(warn);
  const skip = document.createElement('button'); skip.type = 'button'; skip.textContent = 'Next track'; skip.onclick = () => music.skip(); form.append(skip);
  const hint = document.createElement('p'); hint.className = 'note'; hint.textContent = 'Playlist: put audio files in public/music and list them in public/music/manifest.json (mood: day | night | storm | any). Gameplay sounds duck the music; a limiter caps its peaks; N toggles music, - / = changes music volume.'; form.append(hint);
  return form; } });
pauseMenu.addPanel({ id: 'player', title: 'Player', build: playerPanel(() => playAs, id => { playAs = id; pendingPlay = true; try { localStorage.setItem('boreal.player.v1', id); } catch { /* storage blocked */ } }) });
setThunk(s => sfx.playAt('ui-pause', undefined, .5 * s, .55, false)); // low thunk on the existing sound bus
let playerMass = view.playerMass(), ground = { cost: 1, absorb: 1, sink: 0 };
loadGround(localStorage.getItem(SAVE_KEY_GROUND));
setInterval(() => { playerMass = view.playerMass(); // follows Play-as + appearance edits
  ground = footing(column(player.x, player.z), playerMass, 'canid', gravity());
  for (const a of view.audibleAnimals()) if (a.x !== undefined && a.z !== undefined && /deer/.test(a.key)) { const kg = deerDroppingsKg(view.massOf(a.key) ?? 0, 12 * GROUND.speed / 86400);
    if (kg > 0) record({ kind: 'droppings', x: a.x, z: a.z, t: GROUND.years, m: kg }, 3); } // residue reaches the ground when the delta expires
  if (Math.abs(view.playerBrain.speed) > .3 && ground.sink > .002) record({ kind: 'footprint', x: player.x, z: player.z, t: GROUND.years, m: ground.sink });
  prune();
  try { localStorage.setItem(SAVE_KEY_GROUND, saveGround()); localStorage.setItem(SAVE_KEY_WEATHER, saveWeather()); localStorage.setItem(SAVE_KEY_DELTAS, saveDeltas()); } catch { /* storage blocked */ } }, 1000);
loadWeather(localStorage.getItem(SAVE_KEY_WEATHER)); loadDeltas(localStorage.getItem(SAVE_KEY_DELTAS));
const handles = createHandles(view.camera, canvas, view.scene);
const inspector = createInspector(view, canvas, handles);
restoreLooks((k, g) => view.setAppearance(k, g));
pauseMenu.addPanel({ id: 'appearance', title: 'Appearance', build: appearancePanel(() => view.playerLookKey, (k, g) => view.setAppearance(k, g), undefined, { root: () => view.lookup('player')?.object, handles }) });
pauseMenu.addPanel({ id: 'inspector', title: 'Generation inspector (I)', build: () => { if (paused) togglePause(); inspector.toggle(true); return document.createElement('div'); } });
function applyPending() {
  if (pendingRegen) { view.invalidate(); pendingRegen = false; }
  if (pendingPlay) { const p = view.setPlayable(playAs); player.abilities = [...p.actions]; altitude = p.cameraHeight; pendingPlay = false; }
}
applyPending();
function enterPhoto() { if (paused) togglePause(); clearInput(); document.body.classList.add('photo-mode'); photo.enter(); }
actionButton.onclick = perform;
element('pause').onclick = togglePause;
element('photo-btn').onclick = () => enterPhoto();
element('home').onclick = () => { setAutonomous(false); player.x = 0; player.z = 0; altitude = view.playable.cameraHeight; yaw = -.35; player.heading = yaw; lookYaw = 0; pitch = DEFAULT_PITCH; };
element('help').onclick = () => dialog.showModal();
element('close').onclick = () => dialog.close();
element('sound').onclick = async () => {
  if (audio.enabled) audio.enabled = false;
  else try { await audio.enable(); audio.play('friend-chime'); } catch { notice('Audio could not start in this browser.'); }
  element('sound').textContent = audio.enabled ? 'Sound on' : 'Sound off';
};
element('export').onclick = () => {
  const blob = new Blob([JSON.stringify(context, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'boreal-events.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const keys = new Set<string>();
let drag: { id: number; x: number; y: number } | undefined;
const canControl = () => !paused && !dialog.open && !document.hidden && !photo.active;
function clearInput() {
  keys.clear();
  if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
  drag = undefined; canvas.style.cursor = 'grab';
}
addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.matches('input,textarea,select'))) return;
  if (dialog.open) return;
  if (!event.repeat && event.key.toLowerCase() === 'i' && !event.ctrlKey) { inspector.toggle(); if (!photo.active) clearInput(); return; }
  if (photo.active) { if (!event.repeat && (event.key === 'Escape' || event.key.toLowerCase() === 'p')) void photo.exit(); return; } // photo mode has its own keys
  if (!event.repeat && event.key.toLowerCase() === 'p') { enterPhoto(); return; }
  if (event.code === 'Space') event.preventDefault();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) event.preventDefault();
  keys.add(event.key.toLowerCase());
  if (!event.repeat && event.key.toLowerCase() === 'e') perform();
  if (!event.repeat && event.key === 'Escape') { togglePause(); clearInput(); }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', clearInput);
dialog.addEventListener('close', clearInput);
canvas.tabIndex = 0;
canvas.style.cursor = 'grab';
canvas.style.touchAction = 'none';
canvas.addEventListener('contextmenu', event => event.preventDefault());
canvas.addEventListener('pointerdown', event => {
  if (!canControl() || ![0, 2].includes(event.button)) return;
  event.preventDefault(); canvas.focus({ preventScroll: true });
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
  canvas.setPointerCapture(event.pointerId); canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  if (canControl()) {
    lookYaw -= (event.clientX - drag.x) * .006;
    pitch = clampLookPitch(pitch + (event.clientY - drag.y) * .004);
  }
  drag.x = event.clientX; drag.y = event.clientY;
});
canvas.addEventListener('pointerup', clearInput);
canvas.addEventListener('pointercancel', clearInput);
canvas.addEventListener('lostpointercapture', () => { drag = undefined; canvas.style.cursor = 'grab'; });
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); paused = true; notice('Graphics context lost. Your committed events are saved; reload to restore the view.'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());
let lastPhotoView: PhotoView | undefined;
let hadPad = false, previousButtons: boolean[] = [], lastTime = 0, simTime = 0, accumulator = 0;
const deadzone = (v: number) => Math.abs(v) < .18 ? 0 : Math.sign(v) * (Math.abs(v) - .18) / .82;
function frame(time: number) { const frameStart = performance.now();
  const dt = Math.min((time - lastTime) / 1000 || 0, .05); lastTime = time;
  const pad = [...navigator.getGamepads()].find(p => p?.connected && p.mapping === 'standard');
  if (hadPad && !pad) { paused = true; element('pause').textContent = 'Resume'; notice('Controller disconnected. Reconnect and press Menu to resume.'); }
  hadPad = !!pad;
  const buttons = pad?.buttons.map(b => b.pressed) ?? [];
  const pressed = (i: number) => buttons[i] && !previousButtons[i];
  if (pressed(9)) { if (photo.active) void photo.exit(); else togglePause(); }
  if (pressed(1) && dialog.open) dialog.close();
  if (pressed(0)) {
    if (dialog.open) dialog.close();
    else { void audio.enable().catch(() => {}); perform(); }
  }
  previousButtons = buttons;
  // A live photo sequence keeps the world running (no player input) while photo mode renders it.
  const active = !paused && !dialog.open && !document.hidden && (!photo.active || photo.simulating);
  const pv = photo.active ? (photo.reviewing ? lastPhotoView : lastPhotoView = photo.update(dt)) : undefined;
  if (!pv || pv.frozen === false) shaderClock.time += dt;
  let dx = 0, dz = 0;
  if (active) {
    dx = Number(keys.has('d')) - Number(keys.has('a')) + deadzone(pad?.axes[0] ?? 0);
    dz = Number(keys.has('s')) - Number(keys.has('w')) + deadzone(pad?.axes[1] ?? 0);
    if(autonomous && (Math.abs(dx)>.01 || Math.abs(dz)>.01)) setAutonomous(false);
    const lookInput = Number(keys.has('arrowright')) - Number(keys.has('arrowleft')) + deadzone(pad?.axes[2] ?? 0);
    lookYaw -= lookInput * dt;
    if (!drag && Math.abs(lookInput) < .01) lookYaw *= Math.exp(-5 * dt);
    const verticalLook = Number(keys.has('arrowdown')) - Number(keys.has('arrowup')) + deadzone(pad?.axes[3] ?? 0);
    pitch = springLookPitch(pitch, verticalLook, dt, drag && Math.abs(verticalLook) < .01 ? pitch : undefined);
    if (playerAction || photo.active) { dx = 0; dz = 0; }
    const length = Math.max(1, Math.hypot(dx, dz)); dx /= length; dz /= length;
    accumulator += dt;
    while (accumulator >= 1 / 30) {
      modes = autonomous ? stepWolfModes(modes,0,view.playerBrain.motion==='run'?1:0,Math.abs(view.playerBrain.speed)>.01,1/30) : stepWolfModes(modes, Math.max(pad?.buttons[6]?.value ?? 0, Number(keys.has('c'))), Math.max(pad?.buttons[7]?.value ?? 0, Number(keys.has('shift'))), Math.abs(dz) > .01, 1 / 30);
      const brain = view.playerBrain, prevSpeed = brain.speed, speed = -dz * playerSpeed(modes.mode) * view.playable.speedScale;
      const jump = (keys.has(' ') || buttons[2]) && brain.jumpCooldown === 0 && brain.energy > 10 && !playerAction;
      if(!autonomous || playerAction) brain.decide({x:player.x,y:0,z:player.z},1/30,{
        motion:jump?'jump':speed<-.01?'back':speed>.01?(modes.mode==='run'||modes.mode==='sprint'?'run':'walk'):'idle',
        heading:yaw-dx*2.2/30,speed:jump?pounceSpeed(speed):speed});
      // Inertia: walking/running speed changes are capped at force/mass (heavier = slower); jumps are impulses.
      if(!autonomous && brain.motion!=='jump') brain.speed=approach(prevSpeed,brain.speed,accelLimit(playerMass,view.wolfMass),1/30);
      { // wind drag through the shared field: relative air velocity on the frontal area (∝ m^(2/3), 0.15 m² for a 40 kg wolf [verify])
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), F = airDrag({ x: fx * brain.speed, z: fz * brain.speed }, windAt(player.x, .6, player.z), .15 * (playerMass / 40) ** (2 / 3));
        brain.speed += (F.x * fx + F.z * fz) / playerMass / 30; }
      const pose = autonomous && !playerAction ? autonomousWolfStep(brain,{x:player.x,z:player.z,heading:yaw},1/30,modes.stamina,view.entities()) : steerWolf({ x: player.x, z: player.z, heading: brain.heading }, 0, Math.sign(brain.speed), 1 / 30, Math.abs(brain.speed));
      if(!autonomous && brain.motion==='idle') brain.problem='recover';
      if(autonomous && brain.meal) view.forageWolf(brain.meal.key);
      brain.expend(1/30,Math.hypot(pose.x-player.x,pose.z-player.z)*ground.cost); // soft ground costs more (Bekker compaction)
      tickGround(12/30); // 1 real s = 12 game s (timeOfDay REAL_SECONDS_PER_GAME_HOUR 300)
      player.x = pose.x; player.z = pose.z; yaw = pose.heading; player.heading = yaw;
      simTime += 1 / 30; accumulator -= 1 / 30;
    }
    hub.sample(simTime);
  } else accumulator = 0;
  view.sync(player.x, player.z, altitude, context, revision, pv && { x: pv.cam.x, z: pv.cam.z });
  runJobs(); // chunk instantiation etc., time-budgeted (core/interest)
  { const h = (START_HOUR + simTime / REAL_SECONDS_PER_GAME_HOUR); updateWeather(active ? dt : 0, 3600 / REAL_SECONDS_PER_GAME_HOUR, DAY_OF_YEAR + Math.floor(h / 24), h % 24); }
  if (modes.mode !== 'super-stealth') focusTarget = undefined;
  else {
    const candidates = view.entities().filter(e => ['deer', 'person'].includes(e.kind) && Math.hypot(e.x - player.x, e.z - player.z) < 30);
    if (focusTarget && !candidates.some(e => e.key === focusTarget!.key)) focusTarget = undefined;
    focusTarget ??= candidates.filter(e => {
      const dx = e.x - player.x, dz = e.z - player.z, distance = Math.hypot(dx, dz);
      return distance > .1 && (-Math.sin(yaw + lookYaw) * dx - Math.cos(yaw + lookYaw) * dz) / distance > .4;
    }).sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
  }
  target = view.entities().filter(e => availableActions(player, e, context).length).sort((a, b) => Math.hypot(player.x - a.x, player.z - a.z) - Math.hypot(player.x - b.x, player.z - b.z))[0];
  const action = target && availableActions(player, target, context)[0];
  element('target').textContent = target ? catalog[target.kind].title : 'Explore';
  const actionLabel = action ? `${pad ? 'A / E' : 'E / click'} · ${action}` : 'Approach an individual';
  if (actionButton.textContent !== actionLabel) actionButton.textContent = actionLabel;
  actionButton.disabled = !action || paused || saveBlocked || !!playerAction;
  if (playerAction && simTime - actionStarted > 1.2) { playerAction = undefined; pushFrom = undefined; }
  const drawStart = performance.now(); drawFrame(pv); view.photoreal.INFO.drawMs = performance.now() - drawStart; view.photoreal.after(performance.now() - frameStart); inspector.update(); handles.update();
  music.update(view.darkness(), Math.min(1, weatherAt(player.x, player.z).rainMmH / 2)); // 'storm' above ~0.6 mm/h
  sfx.update({ dt, halted: paused || dialog.open || document.hidden || (!!pv && pv.frozen !== false), x: player.x, z: player.z, yaw, darkness: view.darkness(), wolf: view.playerBrain, animals: view.audibleAnimals(), mode: modes.mode, exhausted: modes.exhausted, mass: playerMass, refMass: view.wolfMass, groundAbsorb: ground.absorb });
  if (active) for (const ev of view.hares.update(dt, { x: player.x, z: player.z, mode: modes.mode, moving: Math.abs(view.playerBrain.speed) > .01, pouncing: view.playerBrain.motion === 'jump' })) {
    sfx.hare(ev.type, ev);
    if (ev.type === 'caught') {
      view.playerBrain.energy = Math.min(100, view.playerBrain.energy + HARE.energy);
      modes = { ...modes, stamina: Math.min(modes.maxStamina ?? 100, modes.stamina + HARE.stamina) };
      notice(`Caught a snowshoe hare! +${HARE.energy} energy, +${HARE.stamina} stamina.`);
    }
  }
  const stats = view.stats();
  const animal = view.audibleAnimals().find(a => a.key === target?.key);
  const animalStatus = animal ? ` · ${animal.motion}/${animal.problem} · Energy ${Math.round(animal.energy)}` : '';
  if (target?.kind === 'deer') element('target').textContent = catalog[target.kind].title + animalStatus;
  document.body.classList.toggle('night', view.darkness() > .5);
  status.innerText = `${photo.active ? 'PHOTO · ' : paused ? 'PAUSED · ' : ''}${autonomous ? 'AUTONOMOUS · ' : ''}${view.clock()} · ${modes.mode.toUpperCase()} · Stamina ${Math.round(modes.stamina)}/100 · Energy ${Math.round(view.playerBrain.energy)}/100\n${focusTarget ? 'Focus: ' + catalog[focusTarget.kind].title : modes.mode === 'super-stealth' ? 'Face an individual within 30 m to focus' : modes.exhausted ? 'Recover to 20 stamina; release triggers' : 'RT run · LT stealth'}\n${Object.keys(context.records).length} remembered · ${friendCount(context)} friends · ${context.inventory.herb} herbs`;
  element('device').textContent = pad ? 'X jump · LS steer / forward · RS look · RT run · LT stealth · both: first trigger decides · A interact' : 'Space jump · W/S move · A/D steer · Shift run · C stealth · combine in order · mouse/arrows look · E interact';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ?bench=1: per-tier and per-feature cost after streaming settles (logs `BENCH ...` lines to the console).
if (new URLSearchParams(location.search).has('bench')) void (async () => {
  const { GOVERNOR, MANUAL, LADDER } = await import('./core/quality'), { queued } = await import('./core/interest'), { TREE_FX } = await import('./render/trees');
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms)), raf = () => new Promise(r => requestAnimationFrame(r));
  window.addEventListener('error', e => console.log(`BENCH error ${e.message} ${e.error?.stack}`)); window.addEventListener('unhandledrejection', e => console.log(`BENCH reject ${e.reason?.stack ?? e.reason}`));
  const settle = async () => { const t = performance.now(); let quiet = 0; while (performance.now() - t < 40000 && quiet < 60) { await raf(); quiet = queued() ? 0 : quiet + 1; } await wait(3000); };
  const M = MANUAL as Record<string, number>;
  const sample = async (label: string) => { await settle(); const ws: number[] = [], gs: number[] = [], cpu: number[] = [], drw: number[] = [], spikes: Record<string, number> = {}, t = performance.now(); let last = performance.now();
    while (performance.now() - t < 4000) { await raf(); const n = performance.now(); ws.push(n - last); last = n; if (GOVERNOR.gpuMs !== undefined) gs.push(GOVERNOR.gpuMs); cpu.push(view.photoreal.INFO.workMs); drw.push(view.photoreal.INFO.drawMs);
      for (const [k, v] of Object.entries(view.photoreal.COST)) spikes[k] = Math.max(spikes[k] ?? 0, v); }
    const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : NaN, p95 = [...ws].sort((x, y) => x - y)[Math.floor(ws.length * .95)];
    console.log(`BENCH ${label} gpu=${avg(gs).toFixed(2)}ms frame=${avg(ws).toFixed(2)}ms fps=${(1000 / avg(ws)).toFixed(0)} cpu=${avg(cpu).toFixed(1)}ms(draw ${avg(drw).toFixed(1)}) p95=${p95?.toFixed(1)}ms calls=${view.photoreal.INFO.calls} tris=${view.photoreal.INFO.tris} maxCpu=${JSON.stringify(Object.fromEntries(Object.entries(spikes).map(([k, v]) => [k, +v.toFixed(2)])))}`); };
  GOVERNOR.auto = false; GOVERNOR.capTier = 0; const rr = view.photoreal.renderer; if (rr) rr.info.autoReset = false; // count every pass
  await wait(3000); console.log(`BENCH gpu-string ${GOVERNOR.gpu}`);
  for (let i = 0; i < LADDER.length; i++) { GOVERNOR.tier = i; await sample(`tier-${LADDER[i].name}`); }
  GOVERNOR.tier = 0;
  TREE_FX.barkOff = true; await sample('ultra-without-bark'); TREE_FX.barkOff = false;
  for (const k of ['ssao', 'shadows', 'pcss', 'contact', 'rays', 'gi', 'ibl', 'clouds']) { M[k] = 0; await sample(`ultra-without-${k}`); delete M[k]; }
  console.log('BENCH done');
})();
