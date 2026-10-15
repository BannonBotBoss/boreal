import type { AnimalBrain } from './animalBehavior';
import { heightAt, type Entity } from './world';
import { steerWolf, type WolfPose } from './locomotion';
import { LEVEL, BLOCK } from './tuning';

export function autonomousWolfStep(brain: AnimalBrain, pose: WolfPose, dt: number, stamina: number, objects: Entity[]): WolfPose {
  brain.decide({x:pose.x-Math.sin(pose.heading)*.8,y:heightAt(pose.x,pose.z)+.7,z:pose.z-Math.cos(pose.heading)*.8},dt);
  if(brain.problem==='explore') {
    brain.motion=brain.energy>25&&stamina>20?'run':'walk';
    brain.speed=brain.motion==='run'?4:1;
  }
  const next=steerWolf({...pose,heading:brain.heading},0,Math.sign(brain.speed),dt,Math.abs(brain.speed));
  const probe=steerWolf({...pose,heading:brain.heading},0,Math.sign(brain.speed),.25,Math.abs(brain.speed));
  const blocked=heightAt(probe.x,probe.z)<LEVEL.wolfWater || Math.abs(heightAt(probe.x,probe.z)-heightAt(pose.x,pose.z))>BLOCK.wolf.step
    || objects.some(e=>(e.kind==='spruce'||e.kind==='person')&&Math.hypot(e.x-probe.x,e.z-probe.z)<BLOCK.wolf.trunk);
  if(blocked) {brain.heading+=dt*2;brain.speed=0;brain.motion='idle';brain.problem='avoid';return {...pose,heading:brain.heading};}
  return next;
}
