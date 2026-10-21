import './style.css';
import { createSensesHUD } from './ui/senses';
import { buildScene } from './render/buildScene';
import { availableActions, consumeForage, createContext, friendCount, interact, parseContext, solidContact, type Player } from './core/events';
import { CONTACTS } from './core/contactBus';
import { catalog } from './core/catalog';
import type { Entity } from './core/world';
import { BorealSound } from './audio/borealSound';
import { createMusic } from './audio/music';
import { MUSIC_SAFETY, MUSIC_SETTINGS } from './audio/musicSettings';
import { VOLUME_SETTINGS } from './audio/mixer';
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
import { shaderClock } from './render/shaderClock';
import { TIMESCALE } from './core/timescale';
import { drawBetween, type DrawState } from './core/drawLerp';
import { WALK_PROBE, installWalkProbe } from './dev/walkProbe';
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
import { createLoading } from './ui/loading';
import { settle, startup } from './render/startup';
import { createMenu } from './ui/menu';
import { globeUrl } from './world/globe/handoff';
import { createInPage } from './world/globe/inpage';
import { ageYears, lifespanWarning } from './core/lifespan';
import { CLOCK, loadClock, worldSec, pauseClock, resumeClock, saveClock } from './core/worldClock';
import { STAGES } from './core/stages/elevation';
import { dryStart } from './core/stages/surfaceAt';
import { DAY, dayAt, hourAt, initDay, REAL_SECONDS_PER_GAME_HOUR } from './core/timeOfDay';
import { createChronometer } from './ui/chronometer';
import { controlsPanel } from './ui/controls';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = element<HTMLCanvasElement>('world'), status = element('status'), actionButton = element<HTMLButtonElement>('act');
const dialog = element<HTMLDialogElement>('info');
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
// T-0006: every solid-solid contact (core/contactBus) runs the pure solidContact transaction. Chunk build/dispose edges
// are render lifetime ("became known", see Contact.source), so solidContact is idempotent and writes only records that
// already exist: generated logs never enter the save. No revision++ here (that would rebuild every chunk and re-fire).
const contactsLog = new URLSearchParams(location.search).get('contacts') === '1';
if (contactsLog) (window as unknown as { contacts: typeof CONTACTS }).contacts = CONTACTS; // console: contacts.touching()
CONTACTS.onContact(c => {
  if (contactsLog) console.log(`[contacts] begin ${c.a} | ${c.b} (${c.source}) at ${c.at.map(v => v.toFixed(2)).join(',')} n ${c.normal.map(v => v.toFixed(2)).join(',')}`);
  if (saveBlocked || !(Object.hasOwn(context.records, c.a) || Object.hasOwn(context.records, c.b))) return; // generated-only: nothing to write
  try {
    const next = solidContact(context, c); if (next === context) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(next)); context = next; // commit before exposing
  } catch { /* storage blocked: keep the previous context */ }
});
if (contactsLog) CONTACTS.onSeparate((a, b, source) => console.log(`[contacts] end ${a} | ${b} (${source})`));
const sensesHUD = createSensesHUD(view, sfx, () => context);
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
    sfx.action(action, target); // (the old synth beeps on a second AudioContext doubled every action and ignored mute/volume)
    if (action === 'speak') { const t = target, a = view.audibleAnimals().find(x => x.key === t.key); wolfSpeak(sfx, t, { darkness: view.darkness(), animal: a }); }
    notice(action === 'move' ? 'Stone pushed with your snout. Its new position is remembered.' : action === 'speak' ? 'Relationship remembered in the events context.' : 'Herb gathered. Its removal is remembered.');
  } catch (error) { notice(`Interaction not committed: ${String(error)}`); }
}
// ONE menu (ui/menu) for start and pause. The world clock freezes while the menu is open (Matthew): age/growth/seasons
// hold, the renderer holds a frozen frame, and resume continues from that exact snapshot.
function togglePause() { if (menu.open) { if (menu.mode === 'pause') menu.close(); return; } chrono.close(); paused = true; pauseClock(); element('pause').textContent = 'Resume'; menu.show('pause'); sfx.pauseCue(); }
function saveAll() { try { localStorage.setItem(CLOCK.key, saveClock()); localStorage.setItem(SAVE_KEY_GROUND, saveGround()); localStorage.setItem(SAVE_KEY_WEATHER, saveWeather()); localStorage.setItem(SAVE_KEY_DELTAS, saveDeltas()); if (!saveBlocked) localStorage.setItem(SAVE_KEY, JSON.stringify(context)); } catch { /* storage blocked */ } }
const menu = createMenu({
  hasSave: () => [SAVE_KEY, SAVE_KEY_DELTAS, SAVE_KEY_GROUND].some(k => { try { return !!localStorage.getItem(k); } catch { return false; } }),
  seed: () => STAGES.seed, staged: () => STAGES.on, music: () => musicPanel(), graphics: () => renderPanel() as HTMLElement, save: saveAll,
  newWorld: o => { // fresh world: forget the per-world saves (settings, music and the probe stay)
    for (const k of [SAVE_KEY, SAVE_KEY_DELTAS, SAVE_KEY_GROUND, SAVE_KEY_WEATHER, 'boreal.player.born']) try { localStorage.removeItem(k); } catch { /* blocked */ }
    try { localStorage.setItem('boreal.seed.v1', String(o.seed)); } catch { /* blocked */ } renderStore.set('world.stagedTerrain.v2', o.staged); location.reload(); },
  warning: () => { const born = Number(localStorage.getItem('boreal.player.born') ?? worldSec()); const p = view.playable;
    return lifespanWarning(p.id, ageYears(p.id, born, worldSec()), p.label); },
  quitToMenu: () => { paused = false; element('pause').textContent = 'Pause'; }, // clock stays frozen: start page keeps it paused
  close: mode => { resumeClock(); if (mode === 'pause') { paused = false; applyPending(); element('pause').textContent = 'Pause'; sfx.pauseCue(); } else lookYaw = 0; clearInput(); canvas.focus({ preventScroll: true }); },
});
const menuOpen = () => menu.open && menu.mode === 'start'; // start page: camera drift, no game input
// Rewind history: every system registers its own snapshot source; photo mode never touches systems directly.
const hub = createSnapshotHub(600); // 60 s at 10 Hz
for (const [key, source] of Object.entries(view.snapshotSources)) hub.register(key, source);
hub.register('player', {
  capture: () => [player.x, player.z, yaw, simTime, shaderClock.time, actionStarted],
  restore: (s: number[]) => { [player.x, player.z, yaw, simTime, shaderClock.time, actionStarted] = s; player.heading = yaw; },
});
let drawFrom: DrawState | undefined; // the player before the last fixed step (core/drawLerp); undefined = draw the latest step
const drawFrame = (pv?: PhotoView) => {
  const d = drawBetween(drawFrom, { x: player.x, z: player.z, yaw, sim: simTime }, accumulator * 30); view.playerBrain.drawAlpha = d.alpha;
  return view.draw(d.x, d.z, altitude, d.yaw, d.sim, target, pitch, Math.abs(view.playerBrain.speed) > .01, playerAction, Math.max(0, d.sim - actionStarted), lookYaw, modes.mode, focusTarget, pushFrom, pv);
};
const photo = createPhotoMode({ view, hub, simTime: () => simTime, notice, draw: pv => drawFrame(pv), onExit: () => { clearInput(); accumulator = 0; document.body.classList.remove('photo-mode'); } });
// Pause-menu panels. Anything that rebuilds the world or swaps the body waits until resume.
{ const sd = Number(localStorage.getItem('boreal.seed.v1')); if (sd > 0) STAGES.seed = sd; } // seed chosen in the start menu
const renderStore = createSettingsStore(RENDER_SETTINGS);
{ const st = new URLSearchParams(location.search).get('stages'); if (st !== null) renderStore.set('world.stagedTerrain.v2', st !== '0' && st !== 'off'); } // staged terrain is the default; ?stages=0 turns it off (persisted, like the setting), ?stages=1 back on
{ const at = new URLSearchParams(location.search).get('at')?.split(',').map(Number); if (at && at.length >= 2 && at.every(Number.isFinite)) { player.x = at[0]; player.z = at[1]; if (at.length > 2) { yaw = at[2]; player.heading = yaw; } } } // dev/screenshots: ?at=x,z[,yaw]
if (STAGES.on && !new URLSearchParams(location.search).has('at')) [player.x, player.z] = dryStart(player.x, player.z); // the fixed default start can fall in a staged lake: nearest dry land
let pendingRegen = false, playAs = localStorage.getItem('boreal.player.v1') ?? 'wolf', pendingPlay = playAs !== 'wolf';
const renderPanel = settingsPanel(RENDER_SETTINGS, renderStore, () => { pendingRegen = true; });
const musicStore = createSettingsStore(MUSIC_SETTINGS, 'boreal.music.v1');
const musicPanel = () => { const form = settingsPanel(MUSIC_SETTINGS, musicStore, () => {})() as HTMLElement;
  form.prepend(settingsPanel(VOLUME_SETTINGS, sfx.volumeStore, () => {})()); // Sound volume per bus (audio/mixer)
  const warn = document.createElement('p'); warn.className = 'note'; warn.textContent = MUSIC_SAFETY; form.prepend(warn);
  const skip = document.createElement('button'); skip.type = 'button'; skip.textContent = 'Next track'; skip.onclick = () => music.skip(); form.append(skip);
  const hint = document.createElement('p'); hint.className = 'note'; hint.textContent = 'Playlist: put audio files in public/music and list them in public/music/manifest.json (mood: day | night | storm | any). Gameplay sounds duck the music; a limiter caps its peaks; N toggles music, - / = changes music volume.'; form.append(hint);
  return form; };
menu.addPanel({ id: 'controls', title: 'Controls', build: controlsPanel }); // every key and button (ui/controls BINDINGS)
menu.addPanel({ id: 'player', title: 'Player', build: playerPanel(() => playAs, id => { playAs = id; pendingPlay = true; try { localStorage.setItem('boreal.player.v1', id); } catch { /* storage blocked */ } }) });
setThunk(s => sfx.playAt('ui-pause', undefined, .5 * s, .55, false)); // low thunk on the existing sound bus
let playerMass = view.playerMass(), ground = { cost: 1, absorb: 1, sink: 0 };
const walkProbe = WALK_PROBE ? installWalkProbe(() => view.lookup('player')?.object, view.camera, sfx as never) : undefined;
loadGround(localStorage.getItem(SAVE_KEY_GROUND));
setInterval(() => { try { localStorage.setItem(CLOCK.key, saveClock()); } catch { /* blocked */ }
  if (paused || menu.open) return; // menu freezes the world clock; no sim work while open
  playerMass = view.playerMass(); // follows Play-as + appearance edits
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
menu.addPanel({ id: 'appearance', title: 'Appearance', build: appearancePanel(() => view.playerLookKey, (k, g) => view.setAppearance(k, g), undefined, { root: () => view.lookup('player')?.object, handles }) });
menu.addPanel({ id: 'photo', title: 'Photo mode (P)', build: () => { enterPhoto(); return document.createElement('div'); } });
menu.addPanel({ id: 'inspector', title: 'Generation inspector (I)', build: () => { if (paused) menu.close(); inspector.toggle(true); return document.createElement('div'); } });
menu.addPanel({ id: 'globe', title: 'Planet view (Shift+G)', build: () => { toGlobe(); return document.createElement('div'); } });
function toGlobe() { if (!STAGES.on) { notice('The planet view needs staged terrain (Graphics).'); return; } if (inpage?.ascend()) return; saveAll(); location.search = globeUrl(location.search, player.x, player.z, yaw + lookYaw); } // up to the globe at this spot and heading; it hands back through ?at=x,z,yaw (world/globe/handoff)
function applyPending() {
  if (pendingRegen) { view.invalidate(); pendingRegen = false; }
  if (pendingPlay) { const p = view.setPlayable(playAs); player.abilities = [...p.actions]; altitude = p.cameraHeight; pendingPlay = false; }
}
applyPending();
const inpage = createInPage(view, { player: () => ({ x: player.x, z: player.z, yaw: yaw + lookYaw }), place: (x, z, y) => { player.x = x; player.z = z; yaw = y; player.heading = y; lookYaw = 0; }, save: saveAll }); // ?transition=inpage: world/globe/inpage (null = the reload path)
function enterPhoto() { if (paused) menu.close(); clearInput(); document.body.classList.add('photo-mode'); photo.enter(); }
actionButton.onclick = perform;
element('pause').onclick = togglePause;
element('photo-btn').onclick = () => enterPhoto();
element('home').onclick = () => { setAutonomous(false); player.x = 0; player.z = 0; altitude = view.playable.cameraHeight; yaw = -.35; player.heading = yaw; lookYaw = 0; pitch = DEFAULT_PITCH; };
element('help').onclick = () => dialog.showModal();
element('close').onclick = () => dialog.close();
const soundLabel = () => { element('sound').textContent = sfx.muted ? 'Sound off' : 'Sound on'; };
element('sound').onclick = async () => { // mutes the real mix (master bus); M does the same
  try { await sfx.start(); sfx.setMuted(!sfx.muted); } catch { notice('Audio could not start in this browser.'); }
  soundLabel();
};
soundLabel();
element('export').onclick = () => {
  const blob = new Blob([JSON.stringify(context, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'boreal-events.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
const keys = new Set<string>();
let drag: { id: number; x: number; y: number } | undefined;
const canControl = () => !menuOpen() && !paused && !dialog.open && !document.hidden && !photo.active && !inpage?.blocksGame();
function clearInput() {
  keys.clear();
  if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
  drag = undefined; canvas.style.cursor = 'grab';
}
addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.matches('input,textarea,select'))) return;
  if (dialog.open) return;
  if (menu.open) return;
  if (inpage?.ownsInput()) return; // in-page globe/band: only the active scene's keymap is live
  if (!event.repeat && event.key.toLowerCase() === 'i' && !event.ctrlKey) { inspector.toggle(); if (!photo.active) clearInput(); return; }
  if (photo.active) { if (!event.repeat && (event.key === 'Escape' || event.key.toLowerCase() === 'p')) void photo.exit(); return; } // photo mode has its own keys
  if (!event.repeat && event.key.toLowerCase() === 'p') { enterPhoto(); return; }
  if (!event.repeat && event.key === 'G' && event.shiftKey) { toGlobe(); return; } // Shift+G: planet view (plain g growls)
  if (!event.repeat && event.key.toLowerCase() === 't' && !event.ctrlKey) { chrono.toggle(); clearInput(); return; } // T: chronometer (time of day)
  if (chrono.open && event.key === 'Escape') { chrono.close(); clearInput(); return; }
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
canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); inpage?.dispose(); paused = true; notice('Graphics context lost. Your committed events are saved; reload to restore the view.'); });
canvas.addEventListener('webglcontextrestored', () => location.reload());
let lastPhotoView: PhotoView | undefined;
let hadPad = false, previousButtons: boolean[] = [], lastTime = 0, accumulator = 0;
const clock0 = loadClock(localStorage.getItem(CLOCK.key));
initDay(location.search, localStorage.getItem(DAY.key), clock0.worldSec); // the chronometer's saved dial; ?hour=HH sets it exactly
const chrono = createChronometer(worldSec); // T / gamepad View: set the time of day (ui/chronometer)
let simTime = clock0.worldSec, lastWorld = worldSec(); // sim and clock fields share the world clock (frozen with the menu)
try { if (!localStorage.getItem('boreal.player.born')) localStorage.setItem('boreal.player.born', String(clock0.worldSec)); } catch { /* blocked */ }
if (clock0.offlineSec > 0) tickGround(12 * clock0.offlineSec); // time away between quits ages the ground/deltas
const deadzone = (v: number) => Math.abs(v) < .18 ? 0 : Math.sign(v) * (Math.abs(v) - .18) / .82;
function frame(time: number) { const frameStart = performance.now();
  const dt = Math.min((time - lastTime) / 1000 || 0, .05); lastTime = time;
  const sdt = dt * TIMESCALE; // ?timescale (T-0002): sim, animals, gaits, shader effects; look, input, audio, UI and the world clock stay on real time
  const pad = [...navigator.getGamepads()].find(p => p?.connected && p.mapping === 'standard');
  if (hadPad && !pad) { paused = true; pauseClock(); element('pause').textContent = 'Resume'; if (!menu.open) menu.show('pause'); notice('Controller disconnected. Reconnect and press Menu to resume.'); }
  hadPad = !!pad;
  const buttons = pad?.buttons.map(b => b.pressed) ?? [];
  const pressed = (i: number) => buttons[i] && !previousButtons[i];
  if (menu.open) previousButtons = buttons; // the menu reads the pad itself; clock is frozen, frame is held
  else if (pressed(9)) { if (photo.active) void photo.exit(); else togglePause(); }
  else if (pressed(8) && !photo.active && !dialog.open && !inpage?.blocksGame()) chrono.toggle(); // View: chronometer
  if (chrono.open && pressed(1)) chrono.close();
  if (!menuOpen() && pressed(1) && dialog.open) dialog.close();
  if (!menuOpen() && pressed(0)) {
    if (dialog.open) dialog.close();
    else { void sfx.start().catch(() => {}); perform(); }
  }
  previousButtons = buttons;
  // A live photo sequence keeps the world running (no player input) while photo mode renders it.
  const active0 = !menuOpen() && !paused && !dialog.open && !document.hidden && (!photo.active || photo.simulating) && !inpage?.blocksGame(); // in-page globe/band: sim frozen, world clock runs
  const active = active0; // the world clock (pauseClock/resumeClock around the menu) freezes age and every clock field
  const pv = photo.active ? (photo.reviewing ? lastPhotoView : lastPhotoView = photo.update(dt)) : undefined;
  if (!pv || pv.frozen === false) shaderClock.time += sdt;
  let dx = 0, dz = 0;
  const free = !chrono.open; // chronometer open: arrows, d-pad and left stick scrub the hour instead of moving the wolf
  chrono.update(dt, menu.open ? 0 : Number(keys.has('arrowright')) - Number(keys.has('arrowleft')) + Number(!!buttons[15]) - Number(!!buttons[14]) + deadzone(pad?.axes[0] ?? 0));
  if (active) {
    if (free) dx = Number(keys.has('d')) - Number(keys.has('a')) + deadzone(pad?.axes[0] ?? 0);
    if (free) dz = Number(keys.has('s')) - Number(keys.has('w')) + deadzone(pad?.axes[1] ?? 0);
    if(autonomous && (Math.abs(dx)>.01 || Math.abs(dz)>.01)) setAutonomous(false);
    const lookInput = (free ? Number(keys.has('arrowright')) - Number(keys.has('arrowleft')) : 0) + deadzone(pad?.axes[2] ?? 0);
    lookYaw -= lookInput * dt;
    if (!drag && Math.abs(lookInput) < .01) lookYaw *= Math.exp(-5 * dt);
    const verticalLook = (free ? Number(keys.has('arrowdown')) - Number(keys.has('arrowup')) : 0) + deadzone(pad?.axes[3] ?? 0);
    pitch = springLookPitch(pitch, verticalLook, dt, drag && Math.abs(verticalLook) < .01 ? pitch : undefined);
    if (playerAction || photo.active) { dx = 0; dz = 0; }
    const length = Math.max(1, Math.hypot(dx, dz)); dx /= length; dz /= length;
    accumulator += sdt;
    while (accumulator >= 1 / 30) {
      drawFrom = { x: player.x, z: player.z, yaw, sim: simTime };
      modes = autonomous ? stepWolfModes(modes,0,view.playerBrain.motion==='run'?1:0,Math.abs(view.playerBrain.speed)>.01,1/30) : stepWolfModes(modes, Math.max(pad?.buttons[6]?.value ?? 0, Number(keys.has('c'))), Math.max(pad?.buttons[7]?.value ?? 0, Number(keys.has('shift'))), Math.abs(dz) > .01, 1 / 30);
      const brain = view.playerBrain, prevSpeed = brain.speed, speed = -dz * playerSpeed(modes.mode) * view.playable.speedScale;
      const jump = free && (keys.has(' ') || buttons[2]) && brain.jumpCooldown === 0 && brain.energy > 10 && !playerAction;
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
      brain.expend(1/30,Math.hypot(pose.x-player.x,pose.z-player.z),ground.cost); // soft ground costs more energy (Bekker compaction); the legs follow the real distance
      player.x = pose.x; player.z = pose.z; yaw = pose.heading; player.heading = yaw;
      simTime += 1 / 30; accumulator -= 1 / 30;
    }
    hub.sample(simTime);
  } else { accumulator = 0; drawFrom = undefined; }
  view.sync(player.x, player.z, altitude, context, revision, pv && { x: pv.cam.x, z: pv.cam.z });
  runJobs(inpage?.jobBudgetMs()); // chunk instantiation etc., time-budgeted (core/interest); more while the in-page descent waits for the patch
  { const wNow = worldSec(), wDt = Math.max(0, wNow - lastWorld); lastWorld = wNow; view.worldTime = wNow; // 'clock' fields follow worldSec (frozen while the menu is open)
    tickGround(12 * wDt); // 1 real s = 12 game s (timeOfDay REAL_SECONDS_PER_GAME_HOUR 300)
    updateWeather(Math.min(wDt, .25), 3600 / REAL_SECONDS_PER_GAME_HOUR, dayAt(wNow), hourAt(wNow)); } // hour and date include the chronometer's dial
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
  // Menu open: hold the last frame (clock frozen; no age/growth/render). Playing: draw every frame.
  const drawStart = performance.now(); if (!menu.open) { if (inpage) inpage.frame(() => drawFrame(pv)); else drawFrame(pv); } view.photoreal.INFO.drawMs = performance.now() - drawStart; if (!menu.open) view.photoreal.after(performance.now() - frameStart); // menu frames must not teach the governor (or lift the probe cap)
  walkProbe?.(simTime, view.playerBrain, ground.cost);
  inspector.update(); handles.update(); // (were inside the comment above since 168da74)
  music.update(view.darkness(), Math.min(1, weatherAt(player.x, player.z).rainMmH / 2)); // 'storm' above ~0.6 mm/h
  sfx.update({ dt, halted: paused || dialog.open || document.hidden || (!!pv && pv.frozen !== false) || !!inpage?.blocksGame(), x: player.x, z: player.z, yaw, darkness: view.darkness(), wolf: view.playerBrain, animals: view.audibleAnimals(), mode: modes.mode, exhausted: modes.exhausted, mass: playerMass, refMass: view.wolfMass, groundAbsorb: ground.absorb });
  if (active) for (const ev of view.hares.update(sdt, { x: player.x, z: player.z, mode: modes.mode, moving: Math.abs(view.playerBrain.speed) > .01, pouncing: view.playerBrain.motion === 'jump' })) {
    sfx.hare(ev.type, ev);
    if (ev.type === 'caught') {
      view.playerBrain.energy = Math.min(100, view.playerBrain.energy + HARE.energy);
      modes = { ...modes, stamina: Math.min(modes.maxStamina ?? 100, modes.stamina + HARE.stamina) };
      notice(`Caught a snowshoe hare! +${HARE.energy} energy, +${HARE.stamina} stamina.`);
    }
  }
  sensesHUD.update(dt, menu.open || paused || photo.active || dialog.open || document.hidden || !!inpage?.blocksGame());
  const stats = view.stats();
  const animal = view.audibleAnimals().find(a => a.key === target?.key);
  const animalStatus = animal ? ` · ${animal.motion}/${animal.problem} · Energy ${Math.round(animal.energy)}` : '';
  if (target?.kind === 'deer') element('target').textContent = catalog[target.kind].title + animalStatus;
  document.body.classList.toggle('night', view.darkness() > .5);
  status.innerText = `${photo.active ? 'PHOTO · ' : paused ? 'PAUSED · ' : ''}${autonomous ? 'AUTONOMOUS · ' : ''}${view.clock()} · ${modes.mode.toUpperCase()} · Stamina ${Math.round(modes.stamina)}/100 · Energy ${Math.round(view.playerBrain.energy)}/100\n${focusTarget ? 'Focus: ' + catalog[focusTarget.kind].title : modes.mode === 'super-stealth' ? 'Face an individual within 30 m to focus' : modes.exhausted ? 'Recover to 20 stamina; release triggers' : 'RT run · LT stealth'}\n${Object.keys(context.records).length} remembered · ${friendCount(context)} friends · ${context.inventory.herb} herbs`;
  element('device').textContent = pad ? 'X jump · LS steer / forward · RS look · RT run · LT stealth · both: first trigger decides · A interact · View clock' : 'Space jump · W/S move · A/D steer · Shift run · C stealth · combine in order · mouse/arrows look · E interact · T clock';
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
{ const q = new URLSearchParams(location.search), loading = createLoading(); // startup: warm-up + resource probe behind the loading screen
  void startup(view, loading, { reprobe: q.has('reprobe'), skipProbe: q.has('bench') }).catch(e => console.warn('startup', e)).then(() => inpage?.prewarm().then(r => console.log('INPAGE prewarm ' + JSON.stringify(r)))).catch(e => console.warn('inpage prewarm', e)).finally(() => { void loading.finish(); if (!q.has('bench') && !q.has('nomenu')) { pauseClock(); menu.show('start'); } }); }

// ?bench=1: per-tier and per-feature cost after streaming settles (logs `BENCH ...` lines to the console).
if (new URLSearchParams(location.search).has('bench')) void (async () => {
  const { GOVERNOR, MANUAL, LADDER } = await import('./core/quality'), { TREE_FX } = await import('./render/trees');
  const wait = (ms: number) => new Promise(r => setTimeout(r, ms)), raf = () => new Promise(r => requestAnimationFrame(r));
  window.addEventListener('error', e => console.log(`BENCH error ${e.message} ${e.error?.stack}`)); window.addEventListener('unhandledrejection', e => console.log(`BENCH reject ${e.reason?.stack ?? e.reason}`));
  const M = MANUAL as Record<string, number>;
  // background compiles (photoreal warm + route compiles, 2-30 ms links/first uses) land in the sample otherwise (the 28 ms
  // "Medium" of the 2026-10-18 bench): wait for 2 s with none queued (two route rescans), at most 60 s
  const compiled = async () => { const t = performance.now(); let quiet = performance.now(); while (performance.now() - t < 60000 && performance.now() - quiet < 2000) { await raf(); if (view.photoreal.compiling) quiet = performance.now(); } };
  const sample = async (label: string) => { await settle(); await wait(3000); await compiled(); const ws: number[] = [], gs: number[] = [], cpu: number[] = [], drw: number[] = [], spikes: Record<string, number> = {}, t = performance.now(); let last = performance.now();
    while (performance.now() - t < 4000) { await raf(); const n = performance.now(); ws.push(n - last); last = n; if (GOVERNOR.gpuMs !== undefined) gs.push(GOVERNOR.gpuMs); cpu.push(view.photoreal.INFO.workMs); drw.push(view.photoreal.INFO.drawMs);
      for (const [k, v] of Object.entries(view.photoreal.COST)) spikes[k] = Math.max(spikes[k] ?? 0, v); }
    const avg = (a: number[]) => a.length ? a.reduce((p, c) => p + c, 0) / a.length : NaN, p95 = [...ws].sort((x, y) => x - y)[Math.floor(ws.length * .95)];
    console.log(`BENCH ${label} gpu=${avg(gs).toFixed(2)}ms frame=${avg(ws).toFixed(2)}ms fps=${(1000 / avg(ws)).toFixed(0)} cpu=${avg(cpu).toFixed(1)}ms(draw ${avg(drw).toFixed(1)}) p95=${p95?.toFixed(1)}ms calls=${view.photoreal.INFO.calls} tris=${view.photoreal.INFO.tris} maxCpu=${JSON.stringify(Object.fromEntries(Object.entries(spikes).map(([k, v]) => [k, +v.toFixed(2)])))}`); };
  GOVERNOR.auto = false; GOVERNOR.capTier = 0; GOVERNOR.probeCap = 0; const rr = view.photoreal.renderer; if (rr) rr.info.autoReset = false; // count every pass
  await wait(3000); console.log(`BENCH gpu-string ${GOVERNOR.gpu}`);
  for (let i = 0; i < LADDER.length; i++) { GOVERNOR.tier = i; await sample(`tier-${LADDER[i].name}`); }
  GOVERNOR.tier = 0;
  TREE_FX.barkOff = true; await sample('ultra-without-bark'); TREE_FX.barkOff = false;
  for (const k of ['ssao', 'shadows', 'pcss', 'contact', 'rays', 'gi', 'ibl', 'clouds']) { M[k] = 0; await sample(`ultra-without-${k}`); delete M[k]; }
  console.log('BENCH done');
})();
