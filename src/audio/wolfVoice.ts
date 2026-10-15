/**
 * The wolf talks (Grok Bot). Short friendly lines picked by context, shown as a subtitle bubble and voiced with
 * pre-generated ElevenLabs clips in public/sounds/voice/<id>.mp3 (voice: Adam). Plays through BorealSound so it
 * respects mute and volume. Lines are edited here; regenerate audio with /workspace/boreal-sfx/voice/tts.sh.
 */
import type { BorealSound } from './borealSound';

export const LINES: Record<string, string> = {
  'first-1': "Hello there. I'm new around here.",
  'first-2': "Hi. Don't worry, I just want to say hello.",
  'calm-1': 'Good to see you again.',
  'calm-2': "Where's the rest of your herd?",
  'calm-3': 'The browse looks good by the river today.',
  'calm-4': "Quiet day in the forest, isn't it?",
  'night-1': 'Nice evening. The loons are loud tonight.',
  'night-2': 'Stay close to the trees tonight, friend.',
  'fear-1': "Easy. I won't hurt you.",
  'fear-2': "Whoa, slow down. I'm only talking.",
  'fear-3': "It's alright. Breathe. I'm a friend.",
  'tired-1': "You look tired. Rest a while, I'll keep watch.",
  'person-1': 'Hello, traveller. The forest is calm today.',
};
const MET_KEY = 'boreal.voice.met.v1';
let last = '';
export interface SpeakContext { darkness: number; animal?: { problem: string; energy: number }; posture?: string }

export function chooseLine(target: { key: string; kind: string }, ctx: SpeakContext, met: boolean) {
  const pick = (prefix: string) => { const ids = Object.keys(LINES).filter(k => k.startsWith(prefix) && k !== last); return ids[Math.floor(Math.random() * ids.length)] ?? `${prefix}-1`; };
  if (target.kind === 'person') return 'person-1';
  if (ctx.animal?.problem === 'escape' || ctx.posture === 'alert' || ctx.posture === 'flee') return pick('fear');
  if (!met) return pick('first');
  if (ctx.animal && ctx.animal.energy < 25) return 'tired-1';
  if (ctx.darkness > .5 && Math.random() < .6) return pick('night');
  return pick('calm');
}

let bubble: HTMLDivElement | undefined, hideTimer: ReturnType<typeof setTimeout> | undefined;
function show(text: string, seconds: number) {
  if (!bubble) {
    bubble = document.createElement('div'); bubble.id = 'wolf-speech';
    Object.assign(bubble.style, { position: 'fixed', left: '50%', bottom: '22%', transform: 'translateX(-50%)', maxWidth: '60vw',
      padding: '10px 16px', borderRadius: '14px', background: 'rgba(20,24,22,.78)', color: '#f4efe2', font: '600 18px/1.35 system-ui, sans-serif',
      textAlign: 'center', pointerEvents: 'none', transition: 'opacity .25s', opacity: '0', zIndex: '20', boxShadow: '0 4px 18px rgba(0,0,0,.3)' });
    document.body.appendChild(bubble);
  }
  bubble.textContent = `🐺 “${text}”`; bubble.style.opacity = '1';
  clearTimeout(hideTimer); hideTimer = setTimeout(() => { if (bubble) bubble.style.opacity = '0'; }, seconds * 1000);
}

/** Call after a successful 'speak' to a deer or visitor. */
export function wolfSpeak(sfx: BorealSound, target: { key: string; kind: string; x: number; z: number }, ctx: SpeakContext) {
  let met: string[] = []; try { met = JSON.parse(localStorage.getItem(MET_KEY) ?? '[]'); } catch { /* ignore */ }
  const id = chooseLine(target, ctx, met.includes(target.key)); last = id;
  if (!met.includes(target.key)) { met.push(target.key); try { localStorage.setItem(MET_KEY, JSON.stringify(met.slice(-500))); } catch { /* ignore */ } }
  const text = LINES[id]; show(text, Math.max(2.5, text.length / 14));
  void sfx.playVoice(id).then(duration => {
    // Deer reaction once the wolf finishes: a nervous deer snorts; a calm one just flicks its tail (rig) and listens.
    if (target.kind === 'deer' && id.startsWith('fear')) setTimeout(() => sfx.playAt('deer-snort', target, .5), (duration ?? 1.5) * 1000 + 200);
  });
}
