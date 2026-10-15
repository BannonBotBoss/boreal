import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { rockRecipe, rockDiameter, pushContact, PUSH_DISTANCE, SNOUT_REACH } from '../src/core/rocks';
import { generateChunk, heightAt, type Entity } from '../src/core/world';
import { createContext, interact, parseContext, restoreEntities, availableActions } from '../src/core/events';
import { generateGeometry, disposeObject } from '../src/render/geometry';
const stone = (seed: number): Entity => ({ key: 'test-rock', kind:'rock', seed, generatorVersion:1, x:0,z:0,rotation:1,scale:1 });
const smallSeed = Array.from({length:100},(_,i)=>i).find(i=>rockDiameter(stone(i))===.17)!;
test('nine shapes and nine weighted sizes are generated deterministically',()=>{
 const recipes=Array.from({length:10000},(_,i)=>rockRecipe(i));
 assert.equal(new Set(recipes.map(r=>r.shape)).size,9);
 assert.equal(new Set(recipes.map(r=>r.size)).size,9);
 assert.ok(recipes.filter(r=>r.size<3).length > recipes.filter(r=>r.size>=6).length*2);
 assert.deepEqual(generateChunk(-1,2),generateChunk(-1,2));
});
test('all six snout sectors roll away by the snout stroke and survive save/reload across chunks',()=>{
 for(let sector=0;sector<6;sector++) {
  const angle=sector*Math.PI/3,e=stone(smallSeed);
  const player={x:Math.cos(angle)*(SNOUT_REACH+.13),z:Math.sin(angle)*(SNOUT_REACH+.13),heading:Math.PI/2-angle,abilities:['move'] as const};
  const p={...player,abilities:[...player.abilities]};
  const contact=pushContact(p,e)!; assert.equal(contact.sector,sector);
  const ctx=parseContext(JSON.stringify(interact(createContext(),p,e,'move'))),moved=ctx.records[e.key].entity;
  assert.ok(Math.abs(Math.hypot(moved.x,moved.z)-PUSH_DISTANCE)<1e-9);
  assert.ok(moved.x*Math.cos(angle)+moved.z*Math.sin(angle)<0);
  assert.equal(restoreEntities([e],ctx,{minX:-1,minZ:-1,maxX:1,maxZ:1}).filter(r=>r.key===e.key).length,1);
  assert.ok(!pushContact({...p,heading:p.heading+Math.PI},e));
 }
 const big=stone(Array.from({length:100},(_,i)=>i).find(i=>rockDiameter(stone(i))>.22)!);
 assert.deepEqual(availableActions({x:0,z:.5,heading:0,abilities:['move']},big,createContext()),[]);
});
test('rocks stay below wolf size and sit on terrain in every orientation and LOD',()=>{
 for(let seed=0;seed<90;seed++) for(const detail of [0,1,2]) {
  const e={...stone(seed),x:10,z:-8,rollX:seed*.4,rollZ:seed*.7};
  const group=generateGeometry(e,detail);group.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(group, true),size=box.getSize(new THREE.Vector3());
  assert.ok(Math.max(size.x,size.y,size.z)<=.50001);
  const mesh=group.children[0] as THREE.Mesh,p=mesh.geometry.attributes.position,v=new THREE.Vector3();let min=Infinity;
  for(let i=0;i<p.count;i++) {v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld); min=Math.min(min,v.y+heightAt(e.x,e.z)-heightAt(e.x+v.x,e.z+v.z));}
  if (rockDiameter(e) <= .22) assert.ok(Math.abs(min)<1e-6);
  else assert.ok(Math.abs((box.min.y + box.max.y) / 2) < 1e-6);
  disposeObject(group);
 }
});

