import './senses.css';
import { Vector3 } from 'three';
import type { buildScene } from '../render/buildScene';
import type { BorealSound } from '../audio/borealSound';
import { playerRemembered, type EventContext } from '../core/events';
import { windAt } from '../core/weather';
import { near as nearbyDeltas } from '../core/deltas';
import { createSoundCues, smell, bearingTo, SENSES, type ScentSource, type ScentHit } from '../core/senses';

// Small procedural pictograms: shared vocabulary, not stored animal meshes or portraits.
const drawings: Record<string, [string, string]> = {
  deer: ['Deer', '<path d="M17 29h30l5-15 7 2-3 15-8 4-3 18h-4l-1-17H25l-4 17h-4l2-20-7-3zm37-15-3-9m4 9 6-9m-9 3-5-3m12 3 4-2"/>'],
  hare: ['Hare', '<ellipse cx="30" cy="37" rx="19" ry="13"/><circle cx="49" cy="28" r="10"/><ellipse cx="46" cy="12" rx="4" ry="12"/><ellipse cx="55" cy="13" rx="3" ry="12"/><circle cx="10" cy="35" r="5"/><path d="M22 48h31"/>'],
  person: ['Person', '<circle cx="32" cy="13" r="8"/><path d="M24 25h16l9 20-5 2-7-13 3 23h-6l-2-16-2 16h-6l3-23-7 13-5-2z"/>'],
  forage: ['Berries', '<path d="M33 49V17M33 30Q8 12 13 36Q23 42 33 30M33 25Q56 9 53 30Q45 36 33 25" fill="#a9c989"/><g fill="#a8b6ef"><circle cx="26" cy="41" r="6"/><circle cx="39" cy="42" r="6"/><circle cx="33" cy="50" r="6"/></g>'],
  plant: ['Herbs', '<path d="M32 56V12M31 25Q6 6 12 28Q22 36 31 25M33 37Q57 16 55 39Q45 49 33 37M31 47Q8 31 13 48Q23 56 31 47" fill="#a9c989"/>'],
  log: ['Wood', '<path d="M13 20h38v27H13z" fill="#a98c65"/><ellipse cx="13" cy="34" rx="9" ry="14" fill="#d6bd8f"/><ellipse cx="13" cy="34" rx="4" ry="8" fill="none"/><path d="m27 24 14 3m-17 8 22 3m-17 5h14"/>'],
  scent: ['Scent mark', '<path d="M22 51q-13-12 0-24t0-20m13 44q-13-12 0-24t0-20m13 44q-13-12 0-24t0-20" fill="none"/>'],
  carcass: ['Remains', '<path d="M18 20q-15-14-16 0 0 8 12 8l31 20q1 12 10 11 13-3 0-15L24 24q4-16-6-4" transform="translate(5 -3) scale(.9)"/>'],
  droppings: ['Animal trace', '<ellipse cx="22" cy="40" rx="9" ry="6"/><ellipse cx="40" cy="35" rx="8" ry="6"/><ellipse cx="37" cy="49" rx="7" ry="5"/>'],
};
const images = Object.fromEntries(Object.entries(drawings).map(([k, [, d]]) => [k, 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="#e2e9cd" stroke="#e2e9cd" stroke-width="2" stroke-linejoin="round">${d}</svg>`)]));
const potency: Record<string, number> = { deer: 1, hare: .7, person: .85, forage: .8, plant: .55, log: .3 };
function direction(a: number) {
  return ['ahead', 'front-right', 'right', 'behind-right', 'behind', 'behind-left', 'left', 'front-left'][(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
const soundNames: Record<string, string> = { 'deer-snort': 'Deer snort', 'deer-hooves': 'Hooves', 'paw-walk': 'Footsteps', 'paw-run': 'Running', 'hare-squeak': 'Hare', 'hare-hop': 'Hopping', 'stone-roll': 'Rolling stone', 'visitor-steps': 'Footsteps', 'herb-pluck': 'Leaves', loon: 'Loon', owl: 'Owl', raven: 'Raven', woodpecker: 'Woodpecker', chew: 'Chewing', land: 'Landing' };
export function createSensesHUD(view: ReturnType<typeof buildScene>, audio: BorealSound, memory: () => EventContext) {
  const root = document.createElement('details'); root.className = 'wolf-senses'; root.open = true;
  root.innerHTML = `<summary>Wolf senses</summary><div class="sense-panel"><div class="sense-hearing"><div class="sense-compass" role="img" aria-label="Sound directions relative to your view"><span class="sense-ear">◉</span><div class="sense-arrows"></div></div><div class="sense-caption"><strong>Listening</strong><span class="sense-heard">Quiet nearby</span></div></div><div class="sense-smell"><label for="scent-level">Scent <span class="sense-percent">0%</span></label><meter id="scent-level" min="0" max="1" value="0"></meter><div class="sense-direction">No scent picked up</div><div class="sense-thoughts" aria-label="The wolf's scent thoughts"></div></div></div>`;
  document.body.append(root);
  const el = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const arrows = el('.sense-arrows'), heard = el('.sense-heard'), meter = el<HTMLMeterElement>('meter'), percent = el('.sense-percent'), scentDirection = el('.sense-direction'), thoughts = el('.sense-thoughts');
  const cues = createSoundCues(), nose = new Vector3(), forward = new Vector3();
  let tick = 0, lastThoughts = '', lastHits: readonly ScentHit[] = [];
  audio.onSpatialCue = (id, at, level) => { if (!root.hidden) cues.add(id, at, level); };
  return {
    update(dt: number, hidden: boolean) {
      root.hidden = hidden;
      if (hidden) { cues.clear(); lastHits = []; return; }
      cues.step(dt); tick += dt;
      if (tick < SENSES.updateSeconds) return; tick = 0;
      const wolf = view.lookup('player')?.object;
      if (!wolf) return;
      (wolf.getObjectByName('head-sensor') ?? wolf).getWorldPosition(nose);
      view.camera.getWorldDirection(forward);
      const heading = Math.atan2(-forward.x, -forward.z);
      arrows.replaceChildren();
      const sounds = cues.list().filter(c => Math.hypot(c.x - nose.x, c.z - nose.z) <= SENSES.range);
      for (const c of sounds) {
        const a = bearingTo(nose, c, heading), marker = document.createElement('span');
        marker.className = 'sense-cue'; marker.style.setProperty('--bearing', `${a}rad`);
        marker.style.opacity = String(.2 + .8 * (1 - c.age / SENSES.cueLife));
        marker.title = `${soundNames[c.id] ?? c.id.replaceAll('-', ' ')} · ${direction(a)}`;
        marker.setAttribute('aria-label', marker.title); arrows.append(marker);
      }
      const recent = sounds[sounds.length - 1];
      heard.textContent = recent ? `${soundNames[recent.id] ?? recent.id.replaceAll('-', ' ')} · ${direction(bearingTo(nose, recent, heading))}` : 'Quiet nearby';
      const context = memory();
      const sources: ScentSource[] = view.entities().filter(e => potency[e.kind] && Math.hypot(e.x - nose.x, e.z - nose.z) < SENSES.range).map(e => ({
        key: e.key, kind: e.kind, x: e.x, z: e.z, potency: potency[e.kind],
        remembered: playerRemembered(context.records[e.key]), friend: context.records[e.key]?.relationship === 'friend',
      }));
      for (const h of view.hares.list()) if (h.root.visible) sources.push({ key: `hare:${h.id}`, kind: 'hare', x: h.x, z: h.z, potency: potency.hare });
      for (const d of nearbyDeltas(nose.x, nose.z, SENSES.range)) if (['scent', 'carcass', 'droppings'].includes(d.kind)) sources.push({
        key: `trace:${d.kind}:${d.x}:${d.z}`, kind: d.kind, x: d.x, z: d.z, potency: Math.min(1, d.m) * d.strength,
      });
      const hits = smell(nose, sources, windAt(nose.x, .8, nose.z), heading), first = hits[0], level = first?.level ?? 0; lastHits = hits;
      meter.value = level; percent.textContent = `${Math.round(level * 100)}%`;
      scentDirection.textContent = first ? `${direction(first.bearing)} · ${level > .65 ? 'strong' : level > .25 ? 'distinct' : 'faint'} scent` : 'No scent picked up';
      const signature = hits.map(h => `${h.key}:${h.remembered}:${h.friend}`).join('|');
      if (signature !== lastThoughts) {
        lastThoughts = signature; thoughts.replaceChildren();
        for (const h of hits) {
          const card = document.createElement('div'); card.className = 'sense-thought';
          const img = document.createElement('img'); img.src = images[h.kind] ?? images.scent; img.alt = drawings[h.kind]?.[0] ?? 'Scent';
          const label = document.createElement('span'); label.textContent = img.alt;
          const state = document.createElement('small'); state.textContent = h.friend ? 'Known friend' : h.remembered ? 'Remembered' : 'Unfamiliar';
          card.append(img, label, state); thoughts.append(card);
        }
      }
    },
    /** The same live cues the panel shows, for the 3D senses halo (render/sensesHalo). */
    sounds: () => cues.list(),
    scents: () => lastHits,
  };
}
