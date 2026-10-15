import './style.css';
import { buildScene } from './render/buildScene';
import { availableActions, consumeForage, createContext, friendCount, interact, parseContext, type Player } from './core/events';
import { catalog } from './core/catalog';
import type { Entity } from './core/world';
import { AudioLibrary } from './audio';
import { BorealSound } from './audio/borealSound';
import { wolfSpeak } from './audio/wolfVoice';
import { playerSpeed, pounceSpeed } from './core/playerTuning';
import { HARE } from './animals/hare';
const sfx = new BorealSound();
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
let pendingRegen = false, playAs = localStorage.getItem('boreal.player.v1') ?? 'wolf', pendingPlay = playAs !== 'wolf';
pauseMenu.addPanel({ id: 'render', title: 'Render settings', build: settingsPanel(RENDER_SETTINGS, renderStore, () => { pendingRegen = true; }) });
pauseMenu.addPanel({ id: 'player', title: 'Player', build: playerPanel(() => playAs, id => { playAs = id; pendingPlay = true; try { localStorage.setItem('boreal.player.v1', id); } catch { /* storage blocked */ } }) });
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
function frame(time: number) {
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
      const brain = view.playerBrain, speed = -dz * playerSpeed(modes.mode) * view.playable.speedScale;
      const jump = (keys.has(' ') || buttons[2]) && brain.jumpCooldown === 0 && brain.energy > 10 && !playerAction;
      if(!autonomous || playerAction) brain.decide({x:player.x,y:0,z:player.z},1/30,{
        motion:jump?'jump':speed<-.01?'back':speed>.01?(modes.mode==='run'||modes.mode==='sprint'?'run':'walk'):'idle',
        heading:yaw-dx*2.2/30,speed:jump?pounceSpeed(speed):speed});
      const pose = autonomous && !playerAction ? autonomousWolfStep(brain,{x:player.x,z:player.z,heading:yaw},1/30,modes.stamina,view.entities()) : steerWolf({ x: player.x, z: player.z, heading: brain.heading }, 0, Math.sign(brain.speed), 1 / 30, Math.abs(brain.speed));
      if(!autonomous && brain.motion==='idle') brain.problem='recover';
      if(autonomous && brain.meal) view.forageWolf(brain.meal.key);
      brain.expend(1/30,Math.hypot(pose.x-player.x,pose.z-player.z));
      player.x = pose.x; player.z = pose.z; yaw = pose.heading; player.heading = yaw;
      simTime += 1 / 30; accumulator -= 1 / 30;
    }
    hub.sample(simTime);
  } else accumulator = 0;
  view.sync(player.x, player.z, altitude, context, revision, pv && { x: pv.cam.x, z: pv.cam.z });
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
  drawFrame(pv);
  sfx.update({ dt, halted: paused || dialog.open || document.hidden || (!!pv && pv.frozen !== false), x: player.x, z: player.z, yaw, darkness: view.darkness(), wolf: view.playerBrain, animals: view.audibleAnimals(), mode: modes.mode, exhausted: modes.exhausted });
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
