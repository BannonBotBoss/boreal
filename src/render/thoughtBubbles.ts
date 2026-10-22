/**
 * Thought bubbles over the embodied animal's head (T-0036). Draws what core/needs/thoughts schedules: one sprite per live
 * thought, an icon per need (drop = water, meat = energy, moon = rest), semi-transparent, floating up and fading to 0; the
 * critical style is a red-ringed alert that pulses. Anchored at the rig's 'head-sensor' like render/sensesHalo. When the camera
 * is at the head (first person), the bubbles float in the upper view instead so they stay visible. Unlit, no fog, on top.
 */
import * as THREE from 'three';
import { ICON, thoughtLook, type Thought, type ThoughtStyle } from '../core/needs/thoughts';
import type { NeedId } from '../core/needs/template';
function iconCanvas(need: NeedId, style: ThoughtStyle) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!, col = ICON[need].color;
  g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.fillStyle = style === 'alert' ? 'rgba(120,10,10,.55)' : 'rgba(20,28,40,.45)'; g.fill();
  g.lineWidth = style === 'alert' ? 9 : 4; g.strokeStyle = style === 'alert' ? '#ff4a3c' : 'rgba(255,255,255,.75)'; g.stroke();
  g.fillStyle = col; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
  if (need === 'water') { g.beginPath(); g.moveTo(64, 22); g.bezierCurveTo(64, 22, 96, 62, 96, 78); g.arc(64, 78, 32, 0, Math.PI); g.bezierCurveTo(32, 62, 64, 22, 64, 22); g.fill(); g.stroke(); }
  else if (need === 'energy') { g.beginPath(); g.ellipse(72, 56, 28, 22, -.6, 0, Math.PI * 2); g.fill(); g.stroke(); g.fillStyle = '#f4ead8'; g.fillRect(36, 74, 26, 9); g.beginPath(); g.arc(36, 74, 7, 0, Math.PI * 2); g.arc(36, 84, 7, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.arc(64, 64, 32, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(80, 54, 28, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText('z', 84, 44); g.fillText('z', 96, 30); }
  if (style === 'alert') { g.fillStyle = '#ff4a3c'; g.font = 'bold 40px sans-serif'; g.fillText('!', 98, 112); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createThoughtBubbles(scene: THREE.Scene) {
  const tex = new Map<string, THREE.Texture>(), root = new THREE.Group(); root.name = 'thought-bubbles'; scene.add(root);
  const live: { th: Thought; sprite: THREE.Sprite }[] = [], head = new THREE.Vector3(), fwd = new THREE.Vector3();
  let lastWolf: THREE.Object3D | undefined, sensor: THREE.Object3D | undefined;
  const texture = (n: NeedId, s: ThoughtStyle) => { const k = n + s; if (!tex.has(k)) tex.set(k, iconCanvas(n, s)); return tex.get(k)!; };
  return {
    add(ths: Thought[]) { for (const th of ths) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture(th.need, th.style), transparent: true, depthWrite: false, depthTest: false, fog: false, opacity: 0 }));
      sprite.renderOrder = 4; root.add(sprite); live.push({ th, sprite }); } },
    count: () => live.length,
    /** Per drawn frame: t = real seconds (same clock as thoughtTick). */
    update(wolf: THREE.Object3D | undefined, camera: THREE.Camera, t: number, hidden: boolean) {
      root.visible = !hidden && !!wolf; if (!wolf) return;
      if (wolf !== lastWolf) { lastWolf = wolf; sensor = wolf.getObjectByName('head-sensor') ?? wolf; }
      sensor!.getWorldPosition(head);
      const firstPerson = camera.position.distanceTo(head) < .9; if (firstPerson) camera.getWorldDirection(fwd);
      for (let i = live.length - 1; i >= 0; i--) {
        const { th, sprite } = live[i], look = thoughtLook(th, t);
        if (!look) { root.remove(sprite); sprite.material.dispose(); live.splice(i, 1); continue; }
        const size = .34 * look.scale; sprite.material.opacity = look.alpha;
        if (firstPerson) { sprite.position.copy(camera.position).addScaledVector(fwd, 1.6); sprite.position.y += .32 + look.rise * .5; sprite.scale.setScalar(size * .6); }
        else { sprite.position.set(head.x, head.y + .38 + look.rise, head.z); sprite.scale.setScalar(size); }
      }
    },
  };
}
