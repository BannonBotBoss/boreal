/**
 * Senses halo: a translucent ring floating level around the player wolf's head, with each live sense cue from the
 * Wolf senses HUD (ui/senses) as a pulsing beacon at the bearing it comes from. Three draw calls: ring + sound discs + scent rings.
 * Unlit (MeshBasic, no fog) so it reads the same by day and by night.
 */
import * as THREE from 'three';
import { HALO, cueBeacons, beaconBearing, ringOffset, haloFade, easeSpeed, type Beacon } from '../core/senseBeacons';
import type { SoundCue, ScentHit } from '../core/senses';

const SOUND = new THREE.Color(0x6fc8ff), SCENT = new THREE.Color(0xff9a3c); // sound: the HUD's blue cue; scent: amber (Matthew's mock-up)
/** Flat disc, bright core fading to black at the rim: with additive blending that is a soft glow. */
function glowDisc(r: number, seg = 24) {
  const pos = [0, 0, 0], col = [1, 1, 1], idx: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r * .42, 0, s * r * .42, c * r, 0, s * r); col.push(1, 1, 1, 0, 0, 0);
    const j = 1 + i * 2, k = 1 + ((i + 1) % seg) * 2; idx.push(0, k, j, j, k, k + 1, j, k + 1, j + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); return g;
}
export function createSensesHalo(scene: THREE.Scene) {
  const basic = (o: THREE.MeshBasicMaterialParameters) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, ...o });
  const root = new THREE.Group(); root.name = 'senses-halo';
  const ringMat = basic({ color: 0xffffff, opacity: .32 }), scentMat = basic({ opacity: .9 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(HALO.radius, .016, 8, 72).rotateX(Math.PI / 2), ringMat);
  const sound = new THREE.InstancedMesh(glowDisc(.19), basic({ vertexColors: true, blending: THREE.AdditiveBlending }), HALO.maxBeacons);
  const scent = new THREE.InstancedMesh(new THREE.TorusGeometry(.06, .013, 6, 24).rotateX(Math.PI / 2), scentMat, HALO.maxBeacons);
  for (const m of [sound, scent]) { m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, SOUND); }
  ring.renderOrder = sound.renderOrder = scent.renderOrder = 2; root.add(ring, sound, scent); scene.add(root);
  const beacons: Beacon[] = [], at = { x: 0, z: 0 }, m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  let enabled = true, lastWolf: THREE.Object3D | undefined, sensor: THREE.Object3D = root, lastT = 0, lastX = 0, lastZ = 0, speed = 0; const head = new THREE.Vector3();
  return {
    get enabled() { return enabled; }, set enabled(v: boolean) { enabled = v; },
    /** Per drawn frame, after the wolf is posed (render/buildScene onBeforeRender): centred on its head-sensor, level, turned with its yaw. */
    update(wolf: THREE.Object3D | undefined, time: number, darkness: number, sounds: readonly SoundCue[], scents: readonly ScentHit[], hidden: boolean) {
      root.visible = enabled && !hidden && !!wolf; if (!wolf || !root.visible) return;
      if (wolf !== lastWolf) { lastWolf = wolf; sensor = wolf.getObjectByName('head-sensor') ?? wolf; } // playable swaps replace the rig
      sensor.getWorldPosition(head); const heading = wolf.rotation.y;
      speed = easeSpeed(speed, Math.hypot(head.x - lastX, head.z - lastZ), Math.min(.25, time - lastT)); lastT = time; lastX = head.x; lastZ = head.z;
      const fade = haloFade(speed); root.visible = fade > .01; if (!root.visible) return; // fades away as the wolf travels faster
      root.position.set(head.x, head.y + .04, head.z); root.rotation.set(0, heading, 0); // level ring that turns with the wolf
      ringMat.opacity = (.32 - .1 * darkness) * fade; scentMat.opacity = .9 * fade; // unlit: a little quieter at night so it never outshines the wolf
      const n = cueBeacons(sounds, scents, head, beacons); let ns = 0, nc = 0;
      for (let i = 0; i < n; i++) {
        const b = beacons[i], k = b.strength, pulse = 1 + .18 * Math.sin(time * 5.5 + i * 1.7);
        ringOffset(beaconBearing(b, head, heading), HALO.radius, at); p.set(at.x, 0, at.z);
        const mesh = b.kind === 'sound' ? sound : scent, j = b.kind === 'sound' ? ns++ : nc++;
        s.setScalar((.55 + .45 * k) * pulse * (1 + .7 * b.fresh)); m.compose(p, q, s); mesh.setMatrixAt(j, m);
        mesh.setColorAt(j, c.copy(b.kind === 'sound' ? SOUND : SCENT).multiplyScalar(b.kind === 'sound' ? (.7 + 1.1 * k) * fade : .45 + .55 * k));
      }
      sound.count = ns; scent.count = nc;
      for (const mesh of [sound, scent]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
    },
  };
}
