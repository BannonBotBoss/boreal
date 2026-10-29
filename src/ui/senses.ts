import './senses.css';
import { Vector3 } from 'three';
import type { buildScene } from '../render/buildScene';
import type { BorealSound } from '../audio/borealSound';
import { playerRemembered } from '../core/events';
import type { EventContext } from '../core/events';
import { windAt } from '../core/weather';
import { deltaSources } from '../core/traces';
import { WOLF_AGENT } from '../core/species';
import { WOLF_NEEDS } from '../core/needs/species';
import { perceive } from '../core/needs/senses';
import { createSoundCues, smell, bearingTo, cueSoundEntry, soundCaption, SENSES, type ScentSource, type ScentHit } from '../core/senses';
import {
  SENSE_GLYPH, bubbleLook, createSenseStream, demoSenseSignals,
  signalFromScent, signalFromSight, signalFromSound,
} from '../core/sensePictures';

// Scent potency of a nearby body. The picture does not use the kind.
const potency: Record<string, number> = { deer: 1, hare: .7, person: .85, forage: .8, plant: .55, log: .3 };

export function createSensesHUD(view: ReturnType<typeof buildScene>, audio: BorealSound, memory: () => EventContext) {
  const root = document.createElement('details'); root.className = 'wolf-senses'; root.open = true;
  root.innerHTML = `<summary>Wolf senses</summary><div class="sense-panel"><div class="sense-hearing"><div class="sense-compass" role="img" aria-label="Sound directions relative to your view"><span class="sense-ear" aria-hidden="true">◉</span><div class="sense-arrows"></div></div></div><div class="sense-stream" aria-label="Sense pictures. A more solid picture is a stronger signal."></div></div>`;
  document.body.append(root);
  const el = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const arrows = el('.sense-arrows'), streamEl = el('.sense-stream');
  const cues = createSoundCues(), stream = createSenseStream(), nose = new Vector3(), forward = new Vector3();
  const nodes = new Map<number, HTMLDivElement>();
  const demo = demoSenseSignals(new URLSearchParams(location.search).get('sensepic'));
  let tick = 0, demoOnce = false, lastHits: readonly ScentHit[] = [];
  audio.onSpatialCue = (id, at, level) => { if (!root.hidden) cues.add(id, at, level); };
  const speedOf = (key: string) => {
    if (!key.startsWith('hare:')) return 0;
    const id = Number(key.slice(5));
    return view.hares.list().find(h => h.id === id)?.sim.speed ?? 0;
  };
  const paint = () => {
    const live = new Set<number>();
    for (const b of stream.list()) {
      const look = bubbleLook(b);
      if (!look) continue;
      live.add(b.id);
      let node = nodes.get(b.id);
      if (!node) {
        node = document.createElement('div');
        node.className = `sense-bubble sense-bubble-${b.kind}`;
        node.innerHTML = SENSE_GLYPH[b.kind];
        node.setAttribute('aria-hidden', 'true');
        streamEl.append(node);
        nodes.set(b.id, node);
      }
      const travel = look.ahead >= 0 ? 96 : 48;
      node.style.opacity = look.opacity.toFixed(3);
      node.style.transform = `translate3d(${(look.side * 72).toFixed(1)}px, ${(-look.rise * travel).toFixed(1)}px, 0) rotate(${look.tilt.toFixed(3)}rad)`;
    }
    for (const [id, node] of nodes) if (!live.has(id)) { node.remove(); nodes.delete(id); }
  };
  const offerLive = (heading: number, wind: { x: number; z: number }, sounds: { x: number; z: number; level: number; age: number; id: string }[]) => {
    sounds.forEach((c, i) => {
      const signal = signalFromSound(cueSoundEntry(c, bearingTo(nose, c, heading)), `hearing:${i}`);
      if (signal) stream.offer(signal);
    });
    const daylight = 1 - view.darkness();
    lastHits.forEach((h, i) => {
      const scent = signalFromScent(h, `scent:${i}`);
      if (scent) stream.offer(scent);
      const seen = perceive(WOLF_NEEDS, { x: nose.x, z: nose.z, heading }, { x: h.x, z: h.z, speed: speedOf(h.key) }, { daylight, wind });
      if (seen.sight < SENSES.threshold) return;
      const sight = signalFromSight(`sight:${i}`, seen.sight, seen.bearing);
      if (sight) stream.offer(sight);
    });
  };
  return {
    update(dt: number, hidden: boolean) {
      root.hidden = hidden;
      if (hidden) { cues.clear(); stream.clear(); lastHits = []; paint(); return; }
      const step = Math.max(0, dt);
      cues.step(step); stream.step(step); tick += step;
      if (tick >= SENSES.updateSeconds) {
        tick = 0;
        const wolf = view.lookup('player')?.object;
        if (wolf) {
          (wolf.getObjectByName('head-sensor') ?? wolf).getWorldPosition(nose);
          view.camera.getWorldDirection(forward);
          const heading = Math.atan2(-forward.x, -forward.z);
          const sounds = cues.list().filter(c => Math.hypot(c.x - nose.x, c.z - nose.z) <= SENSES.range);
          arrows.replaceChildren();
          for (const c of sounds) {
            const a = bearingTo(nose, c, heading), marker = document.createElement('span');
            marker.className = 'sense-cue'; marker.style.setProperty('--bearing', `${a}rad`);
            marker.style.opacity = String(.2 + .8 * (1 - c.age / SENSES.cueLife));
            marker.setAttribute('aria-label', soundCaption(cueSoundEntry(c, a)));
            arrows.append(marker);
          }
          const context = memory();
          const sources: ScentSource[] = view.entities().filter(e => potency[e.kind] && Math.hypot(e.x - nose.x, e.z - nose.z) < SENSES.range).map(e => ({
            key: e.key, kind: e.kind, x: e.x, z: e.z, potency: potency[e.kind],
            remembered: playerRemembered(context.records[e.key]), friend: context.records[e.key]?.relationship === 'friend',
          }));
          for (const h of view.hares.list()) if (h.root.visible) sources.push({ key: `hare:${h.id}`, kind: 'hare', x: h.x, z: h.z, potency: potency.hare });
          // Bodies keep the HUD range. A mark, carcass or dropping uses the wolf nose (Mech 1970, 2.4 km) inside deltaSources.
          sources.push(...deltaSources(nose.x, nose.z, WOLF_AGENT.senses.scent.range));
          const wind = windAt(nose.x, .8, nose.z);
          lastHits = smell(nose, sources, wind, heading);
          if (demo.replace) {
            if (!(demo.once && demoOnce)) { demoOnce = true; for (const s of demo.signals) stream.offer(s); }
          } else offerLive(heading, wind, sounds);
        }
      }
      paint();
    },
    /** The same live cues the panel shows, for the 3D senses halo (render/sensesHalo). */
    sounds: () => cues.list(),
    scents: () => lastHits,
  };
}
