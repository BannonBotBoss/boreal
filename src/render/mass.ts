/** Mass of anything in the world from its generator's dimensions and composition (Grok Bot). See core/mass.ts. */
import * as THREE from 'three';
import type { Entity } from '../core/world';
import { catalog } from '../core/catalog';
import { massOf, ellipsoid, frustum, regionVolumes } from '../core/mass';
import { rockDiameter, rockRecipe } from '../core/rocks';
import { ROCK_SHAPES } from './rocks';
import { treeMass } from './trees';
import { baseProfile } from './appearance';

export function entityMass(e: Entity): number {
  if (e.kind === 'spruce') return treeMass(e);
  if (e.kind === 'rock') {
    const r = rockRecipe(e.seed), [a, b, c] = ROCK_SHAPES[r.shape], k = Math.max(a, b, c), d = rockDiameter(e) / 2;
    return massOf('rock', [{ region: r.grey < .4 ? 'basalt' : r.grey < .55 ? 'granite' : 'gneiss', volume: ellipsoid(d * a / k, d * b / k, d * c / k) }]);
  }
  const s = e.scale ** 3;
  if (e.kind === 'log') return massOf('log', [{ region: 'body', volume: frustum(.43, .32, 4.4) * s }]);
  if (e.kind === 'plant' || e.kind === 'forage') return massOf('plant', [{ region: 'body', volume: 7 * ellipsoid(.22, .13, .17) * s }]);
  // visitor figure: its generated ellipsoids (geometry.ts) as regions
  return massOf(catalog[e.kind].material, [{ region: 'torso', volume: ellipsoid(.38, .65, .23) * s }, { region: 'head', volume: ellipsoid(.25, .3, .25) * s },
    { region: 'legs', volume: 2 * frustum(.12, .09, .8) * s }]);
}
/** Animal mass from its live rig: region volumes from the generated geometry (rig-local) x the root's current scale. */
export function rigMass(root: THREE.Object3D, plan: string) {
  const { min, size, points } = baseProfile(root), s = root.scale, k = s.x * s.y * s.z;
  return massOf(plan, regionVolumes(points, min, size).map(p => ({ region: p.region, volume: p.volume * k })));
}
