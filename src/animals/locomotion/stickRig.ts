/**
 * Neutral test quadruped: capsules and cylinders built from a LegLayout, with the same bone chain as the real rigs
 * (girdle → upper → lower → foot → paw, rotation.x per joint) plus a sideways swing at the top. Debug view and LOD stand-in;
 * no species data of its own. Group tree: root (position, heading) → tilt (pitch, roll) → body + legs.
 */
import * as THREE from 'three';
import { limbOf } from '../../core/animalBehavior';
import type { LegLayout, LegPose } from './signals';

export interface StickRig { root: THREE.Group; tilt: THREE.Group; /** debug layers */ body: THREE.Object3D[]; legs: THREE.Object3D[]; apply(pose: LegPose, at: { x: number; z: number; heading: number }): void }

export function createStickRig(layout: LegLayout, color = 0x8a7a66): StickRig {
  const skin = new THREE.MeshStandardMaterial({ color, roughness: .8 }), dark = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: .9 });
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const seg = (len: number, r: number, m = skin) => { const g = new THREE.CylinderGeometry(r, r * .8, Math.max(1e-3, len), 10); g.translate(0, -len / 2, 0); const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; return mesh; };
  const hipY = layout.legs.hip, front = (layout.hips[0][1] + layout.hips[2][1]) / 2, hind = (layout.hips[1][1] + layout.hips[3][1]) / 2;
  const wheel = Math.abs(hind - front), r = hipY * .17;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(r, wheel, 6, 14), skin); torso.rotation.x = Math.PI / 2; torso.position.set(0, hipY + r * .4, (front + hind) / 2); torso.castShadow = true; tilt.add(torso);
  const neck = seg(hipY * .45, r * .45); neck.position.set(0, hipY + r * .9, front - r * .3); neck.rotation.x = 2.2; tilt.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(r * .75, 14, 10), skin); head.scale.set(.8, .8, 1.4); head.position.set(0, hipY + r * .9 + hipY * .45 * Math.cos(2.2) * -1, front - r * .3 - hipY * .45 * Math.sin(2.2)); head.castShadow = true; tilt.add(head);
  const tail = seg(hipY * .6, r * .25); tail.position.set(0, hipY + r * .6, hind + r * .9); tail.rotation.x = -2.3; tilt.add(tail);
  const chains = layout.hips.map(([x, z], i) => {
    const L = limbOf(layout.legs, i), S = L.girdle ?? 0, M = L.foot ?? 0;
    const abd = new THREE.Group(); abd.position.set(x, L.hip + S, z); tilt.add(abd);
    const gird = new THREE.Group(); abd.add(gird); if (S) gird.add(seg(S, r * .5));
    const upper = new THREE.Group(); upper.position.y = -S; gird.add(upper); upper.add(seg(L.upper, r * .42));
    const lower = new THREE.Group(); lower.position.y = -L.upper; upper.add(lower); lower.add(seg(L.lower, r * .28));
    const foot = new THREE.Group(); foot.position.y = -L.lower; lower.add(foot); if (M) foot.add(seg(M, r * .2));
    const paw = new THREE.Group(); paw.position.y = -M; foot.add(paw);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(r * .5, r * .18, r * .75), dark); pad.position.set(0, r * .09, -r * .2); pad.castShadow = true; paw.add(pad);
    return { abd, gird, upper, lower, foot, paw };
  });
  return {
    root, tilt, body: [torso, neck, head, tail], legs: chains.map(c => c.abd),
    apply(p, at) {
      root.position.set(at.x, p.height, at.z); root.rotation.y = at.heading; tilt.rotation.set(p.pitch, 0, p.roll);
      chains.forEach((c, i) => { c.abd.rotation.z = p.abduct[i]; c.gird.rotation.x = p.girdles[i]; c.upper.rotation.x = p.legs[i]; c.lower.rotation.x = p.knees[i]; c.foot.rotation.x = p.wrists[i]; c.paw.rotation.x = p.paws[i]; });
    },
  };
}
