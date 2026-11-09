/**
 * Boreal Universe — separate app. Reuses select Boreal modules via `@boreal/*`
 * (currently proc/rng). Time + expanding space live here.
 */
import { TimeEngine } from './core/timeEngine';
import {
  mintUniverseSeed,
  normalizeUniverseSeed,
  readUniverseSeed,
  writeUniverseSeed,
} from './core/universeSeed';
import { createMenu } from './ui/menu';
import { SpaceView } from './world/spaceView';

const canvas = document.querySelector<HTMLCanvasElement>('#world')!;
const readout = document.querySelector('#readout')!;
const playBtn = document.querySelector<HTMLButtonElement>('#play-btn')!;
const axesBtn = document.querySelector<HTMLButtonElement>('#axes-btn')!;
const menuBtn = document.querySelector<HTMLButtonElement>('#menu-btn')!;
const boot = document.querySelector('#boot')!;

const engine = new TimeEngine();
const view = new SpaceView(canvas);

function generateUniverse(o?: { seed?: number }) {
  const seed = normalizeUniverseSeed(o?.seed ?? 0) || mintUniverseSeed();
  writeUniverseSeed(seed);
  engine.reset(seed);
  view.setSeed(seed);
  engine.play();
  syncPlay();
}

const menu = createMenu({
  universeSeed: () => readUniverseSeed() || engine.seed,
  generateUniverse,
  close: () => { /* clock stays as-is; Generate already started play */ },
});

function syncPlay() {
  playBtn.textContent = engine.playing ? 'Pause' : 'Play';
}

playBtn.addEventListener('click', () => {
  if (!engine.seed) generateUniverse({});
  else {
    engine.toggle();
    syncPlay();
  }
});

axesBtn.addEventListener('click', () => {
  const next = !view.axesVisible();
  view.setAxesVisible(next);
  axesBtn.setAttribute('aria-pressed', String(next));
});

menuBtn.addEventListener('click', () => menu.show());

function frame(now: number) {
  const wasPlaying = engine.playing;
  const snap = engine.step(now);
  if (wasPlaying !== snap.playing) syncPlay();
  view.apply(snap);
  view.render();
  readout.innerHTML = engine.readout(snap);
  requestAnimationFrame(frame);
}

boot.classList.add('fade');
setTimeout(() => boot.remove(), 900);

const existing = readUniverseSeed();
if (existing) {
  engine.reset(existing);
  view.setSeed(existing);
} else {
  // Cold start: show menu so Generate universe is the first action.
  menu.show();
}

syncPlay();
requestAnimationFrame(frame);
