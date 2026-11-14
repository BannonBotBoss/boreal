import './senses.css';
import { Vector3 } from 'three';
import type { buildScene } from '../render/buildScene';
import type { BorealSound } from '../audio/borealSound';
import { playerRemembered } from '../core/events';
import type { EventContext } from '../core/events';
import { windAt } from '../core/weather';
import { deltaSources } from '../core/traces';
import { WOLF_AGENT } from '../core/species';
import { NEEDS_SPECIES, WOLF_NEEDS } from '../core/needs/species';
import { sensesTitle } from '../render/playables';
import { see, type SightBody, type SightHit } from '../core/needs/senses';
import { createSoundCues, smell, bearingTo, cueSoundEntry, soundCaption, SENSES, type ScentSource, type ScentHit } from '../core/senses';
import {
  SENSE_GLYPH, bubbleLook, createSenseStream, demoSenseSignals,
  signalFromScent, signalFromSight, signalFromSound,
} from '../core/sensePictures';

// Scent potency of a nearby body. The picture does not use the kind.
const potency: Record<string, number> = { deer: 1, hare: .7, person: .85, forage: .8, plant: .55, log: .3 };
const visualKind: Record<string, boolean> = { deer: true, hare: true, person: true };

export function createSensesHUD(view: ReturnType<typeof buildScene>, audio: BorealSound, memory: () => EventContext) {
  const root = document.createElement('details'); root.className = 'wolf-senses'; root.open = true;
  root.innerHTML = `<summary></summary><div class="sense-panel"><div class="sense-hearing"><div class="sense-compass" role="img" aria-label="Sound directions relative to your view"><span class="sense-ear" aria-hidden="true">◉</span><div class="sense-arrows"></div></div></div><div class="sense-stream" aria-label="Sense pictures. A more solid picture is a stronger signal."></div></div>`;
  const summary = root.querySelector('summary')!;
  document.body.append(root);
  summary.replaceChildren(document.createTextNode(sensesTitle(view.playable.label)));
  const el = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const arrows = el('.sense-arrows'), streamEl = el('.sense-stream');
  const cues = createSoundCues(), stream = createSenseStream(), nose = new Vector3(), forward = new Vector3();
  const nodes = new Map<number, HTMLDivElement>();
  const demo = demoSenseSignals(new URLSearchParams(location.search).get('sensepic'));
  let tick = 0, demoOnce = false, lastHits: readonly ScentHit[] = [], lastSeen: readonly SightHit[] = [];
  let needs = WOLF_NEEDS;
  audio.onSpatialCue = (id, at, level) => { if (!root.hidden) cues.add(id, at, level); };
  const speedOf = (key: string, kind: string) => {
    if (kind === 'hare') return Math.abs(view.hares.list().find(h => h.id === Number(key.slice(5)))?.sim.speed ?? 0);
    if (kind === 'deer') return Math.abs(view.lookup(key)?.brain?.speed ?? 0);
    if (kind === 'person') return Math.abs(view.visitorOf(key)?.speed ?? 0);
    return 0;
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
  const offerLive = (heading: number, sounds: { x: number; z: number; level: number; age: number; id: string }[]) => {
    sounds.forEach((c, i) => {
      const signal = signalFromSound(cueSoundEntry(c, bearingTo(nose, c, heading)), `hearing:${i}`);
      if (signal) stream.offer(signal);
    });
    lastHits.forEach((h, i) => {
      const scent = signalFromScent(h, `scent:${i}`);
      if (scent) stream.offer(scent);
    });
    lastSeen.forEach((s, i) => {
      const sight = signalFromSight(`sight:${i}`, s.sight, s.bearing);
      if (sight) stream.offer(sight);
    });
  };
  return {
    update(dt: number, hidden: boolean) {
      root.hidden = hidden;
      if (hidden) { cues.clear(); stream.clear(); lastHits = []; lastSeen = []; paint(); return; }
      const step = Math.max(0, dt);
      cues.step(step); stream.step(step); tick += step;
      if (tick >= SENSES.updateSeconds) {
        tick = 0;
        summary.replaceChildren(document.createTextNode(sensesTitle(view.playable.label)));
        needs = NEEDS_SPECIES[view.playable.id] ?? WOLF_NEEDS;
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
          const embodied = view.livingHere().embodied;
          const allEntities = view.entities();
          const sources: ScentSource[] = allEntities.filter(e => potency[e.kind] && e.key !== embodied && Math.hypot(e.x - nose.x, e.z - nose.z) < SENSES.range).map(e => ({
            key: e.key, kind: e.kind, x: e.x, z: e.z, potency: potency[e.kind],
            remembered: playerRemembered(context.records[e.key]), friend: context.records[e.key]?.relationship === 'friend',
          }));
          const visualRange = needs.senses.sight.rangeM.v;
          const visualBodies: SightBody[] = allEntities
            .filter(e => visualKind[e.kind] && e.key !== embodied && Math.hypot(e.x - nose.x, e.z - nose.z) < visualRange)
            .map(e => ({ key: e.key, kind: e.kind, x: e.x, z: e.z, speed: speedOf(e.key, e.kind) }));
          for (const h of view.hares.list()) if (h.sim.alive && !h.embodied) {
            const key = `hare:${h.id}`;
            sources.push({ key, kind: 'hare', x: h.x, z: h.z, potency: potency.hare });
            if (Math.hypot(h.x - nose.x, h.z - nose.z) < visualRange) {
              visualBodies.push({ key, kind: 'hare', x: h.x, z: h.z, speed: Math.abs(h.sim.speed) });
            }
          }
          // Bodies keep the HUD range. A mark, carcass or dropping uses the wolf nose (Mech 1970, 2.4 km) inside deltaSources.
          const traces = deltaSources(nose.x, nose.z, WOLF_AGENT.senses.scent.range);
          sources.push(...traces);
          for (const t of traces) if (t.kind === 'carcass' && Math.hypot(t.x - nose.x, t.z - nose.z) < visualRange) {
            visualBodies.push({ key: t.key, kind: t.kind, x: t.x, z: t.z, speed: 0 });
          }
          const wind = windAt(nose.x, .8, nose.z);
          lastHits = smell(nose, sources, wind, heading);
          lastSeen = see(needs, { x: nose.x, z: nose.z, heading }, visualBodies, { daylight: 1 - view.darkness(), wind });
          if (demo.replace) {
            if (!(demo.once && demoOnce)) { demoOnce = true; for (const s of demo.signals) stream.offer(s); }
          } else offerLive(heading, sounds);
        }
      }
      paint();
    },
    /** The same live cues the panel shows, for the 3D senses halo (render/sensesHalo). */
    sounds: () => cues.list(),
    scents: () => lastHits,
    sights: () => lastSeen,
  };
}
