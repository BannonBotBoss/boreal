import test from 'node:test';
import assert from 'node:assert/strict';
import { AnimalBrain } from '../src/core/animalBehavior';
import { autonomousWolfStep } from '../src/core/autonomy';
import type { Entity } from '../src/core/world';
test('autonomous wolf runs without input, walks on low stamina and stops to recover',()=>{
 const b=new AnimalBrain(1);b.energy=95;
 const pose={x:0,z:0,heading:0};
 const next=autonomousWolfStep(b,pose,1/30,100,[]);assert.equal(b.motion,'run');assert.ok(Math.hypot(next.x,next.z)>0);
 autonomousWolfStep(b,pose,1/30,10,[]);assert.equal(b.motion,'walk');
 b.energy=0;const rest=autonomousWolfStep(b,pose,1/30,100,[]);assert.equal(b.problem,'recover');assert.equal(rest.x,0);assert.equal(rest.z,0);
});
test('autonomous wolf refuses a blocked route',()=>{
 const b=new AnimalBrain(1);b.energy=95;
 const tree:Entity={key:'tree',kind:'spruce',seed:1,generatorVersion:1,x:0,z:-1,rotation:0,scale:1};
 const next=autonomousWolfStep(b,{x:0,z:0,heading:0},1/30,100,[tree]);
 assert.equal(next.x,0);assert.equal(next.z,0);assert.equal(b.problem,'avoid');assert.notEqual(next.heading,0);
});
