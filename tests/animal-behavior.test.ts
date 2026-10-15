import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimalBrain,gaitPose,withinEarshot,ANIMAL_DEFAULT_ENERGY} from '../src/core/animalBehavior';
import {createDeerRig} from '../src/render/animalRig';
import {depressionFormation,neighbours,MAX_DEPTH_STEP,surfaceDetail} from '../src/core/surface';
import {disposeObject} from '../src/render/geometry';
const origin={x:0,y:0,z:0};
test('earshot includes animals behind the player and energy is initialized before mesh generation', async()=>{
 const {generateChunk}=await import('../src/core/world');
 assert.ok(withinEarshot(origin,{x:0,y:0,z:39}));assert.ok(withinEarshot(origin,{x:0,y:0,z:-39}));
 assert.ok(!withinEarshot(origin,{x:40.01,y:0,z:0}));assert.equal(new AnimalBrain(7).energy,ANIMAL_DEFAULT_ENERGY);
 for(const e of generateChunk(0,0).filter(e=>e.kind==='deer'))assert.equal(e.energy,ANIMAL_DEFAULT_ENERGY);
});
test('head sensing uses near/middle/far radii and solves threat, hunger, fatigue and obstacle problems',()=>{
 const brain=new AnimalBrain(1);
 brain.sense(origin,[{key:'wolf',x:0,y:0,z:-5,kind:'threat'}]);brain.decide(origin,.03);assert.equal(brain.motion,'run');assert.equal(brain.problem,'escape');assert.ok(-Math.cos(brain.heading)>0);
 brain.sense(origin,[{key:'wolf',x:0,y:0,z:-1,kind:'threat'}]);brain.decide(origin,.03);assert.equal(brain.motion,'back');
 brain.alarm=0;brain.sense(origin,[{key:'food',x:5,y:0,z:0,kind:'food'}]);brain.energy=50;brain.decide(origin,.03);assert.equal(brain.problem,'feed');assert.equal(brain.motion,'walk');
 brain.energy=10;brain.decide(origin,.03);assert.equal(brain.problem,'recover');assert.equal(brain.motion,'idle');
 brain.energy=100;brain.heading=0;brain.sense(origin,[{key:'log',x:0,y:0,z:-1,kind:'obstacle',low:true}]);brain.decide(origin,.03);assert.equal(brain.motion,'jump');
 brain.sense(origin,[{key:'far',x:23,y:0,z:0,kind:'animal'},{key:'outside',x:25,y:0,z:0,kind:'animal'}]);assert.equal(brain.far.length,1);
});
test('energy costs actual distance, run costs more, exhaustion clamps, resting recovers',()=>{
 const idle=new AnimalBrain(1),walk=new AnimalBrain(1),run=new AnimalBrain(1);walk.motion='walk';run.motion='run';
 idle.expend(10,0);walk.expend(10,10);run.expend(10,10);assert.ok(idle.energy>walk.energy&&walk.energy>run.energy);
 run.expend(1,10000);assert.equal(run.energy,0);run.motion='idle';run.problem='recover';run.expend(1,0);assert.ok(run.energy>0);
 const a=new AnimalBrain(1),b=new AnimalBrain(1);a.motion=b.motion='walk';a.expend(1,2);for(let i=0;i<30;i++)b.expend(1/30,2/30);assert.ok(Math.abs(a.energy-b.energy)<1e-9);
});
test('coordinated gaits reverse backing, jumping lifts and lands, tail remains attached and settles',()=>{
 assert.ok(gaitPose('jump',0,.4).bob>0);assert.ok(Math.abs(gaitPose('jump',0,.85).bob)<1e-8);
 const rig=createDeerRig(1,0),parts=rig.root.userData.rig,rest=parts.tail.position.clone();
 assert.equal(parts.sensor.parent,parts.head);assert.equal(parts.sensor.userData.brain,rig.brain);assert.equal(parts.legs.length,4);
 rig.brain.motion='run';rig.brain.phase=.2;rig.animate(.1);assert.ok(Math.abs(parts.tail.rotation.y)<=.09);assert.ok(parts.tail.position.equals(rest));
 rig.brain.motion='idle';for(let i=0;i<60;i++)rig.animate(1/60);assert.ok(Math.abs(parts.tail.rotation.y)<1e-5);disposeObject(rig.root);
});
test('terrain forms connected clusters of at most twelve cells, favours middle lengths, limits neighbour depths',()=>{
 let middle=0,extremes=0;
 for(let x=-15;x<15;x++)for(let z=-15;z<15;z++) {
  const cells=depressionFormation(x,z);assert.ok(cells.length>=1&&cells.length<=12);
  if(cells.length>=4&&cells.length<=9)middle++;else extremes++;
  for(let i=1;i<cells.length;i++)assert.ok(cells.slice(0,i).some(c=>neighbours(c).some(([x,z,h])=>x===cells[i].x&&z===cells[i].z&&h===cells[i].half)));
  for(const c of cells)for(const n of cells)if(neighbours(c).some(([x,z,h])=>n.x===x&&n.z===z&&n.half===h)) assert.ok(Math.abs(c.depth-n.depth)<=MAX_DEPTH_STEP+1e-9);
 }
 assert.ok(middle>extremes);assert.ok(Math.abs(surfaceDetail(12-1e-7,5)-surfaceDetail(12+1e-7,5))<1e-5);
});
test('hungry animals walk to forage, eat for FEED_DURATION, then report the meal',async()=>{
 const {FEED_DURATION}=await import('../src/core/animalBehavior');
 const brain=new AnimalBrain(3);brain.energy=40;
 const patch={key:'forage:test',x:.5,y:0,z:0,kind:'food' as const};
 brain.sense(origin,[{...patch,x:6}]);brain.decide(origin,.1);assert.equal(brain.motion,'walk');assert.equal(brain.meal,undefined);
 brain.sense(origin,[patch]);let t=0;
 while(!brain.meal&&t<FEED_DURATION+1){brain.decide(origin,.1);t+=.1;assert.equal(brain.speed,0);}
 assert.equal((brain as AnimalBrain).meal?.key,'forage:test');assert.ok(t>=FEED_DURATION-1e-9);
 brain.sense(origin,[]);brain.decide(origin,.1);assert.equal(brain.meal,undefined);assert.equal(brain.feedTime,0);
});
test('consuming forage removes the patch, raises animal energy and survives a save round-trip',async()=>{
 const {generateChunk}=await import('../src/core/world');
 const {createContext,consumeForage,parseContext,restoreEntities,interact}=await import('../src/core/events');
 const {FORAGE_ENERGY}=await import('../src/core/animalBehavior');
 const chunk=generateChunk(0,0);
 assert.ok(chunk.filter(e=>e.kind==='forage').length>=1);
 const plant=chunk.find(e=>e.kind==='forage')!,anyDeer=[0,1,2,3,4,5].flatMap(i=>generateChunk(i,i)).find(e=>e.kind==='deer')!,deer={...anyDeer,x:plant.x+.5,z:plant.z,energy:40};
 const empty=createContext();
 assert.equal(consumeForage(empty,deer,plant),empty,'autonomous feeding cannot create persistent records');
 assert.deepEqual(empty.records,{});
 const remembered=interact(empty,{x:deer.x,z:deer.z,abilities:['speak']},deer,'speak');
 const next=parseContext(JSON.stringify(consumeForage(remembered,deer,plant)));
 assert.equal(next.records[plant.key].removed,true);assert.equal(next.records[deer.key].entity.energy,40+FORAGE_ENERGY);
 const restored=restoreEntities(generateChunk(0,0),next,{minX:0,minZ:0,maxX:40,maxZ:40});
 assert.ok(!restored.some(e=>e.key===plant.key));
 assert.throws(()=>consumeForage(next,deer,plant));
 const legacy=structuredClone(next);legacy.records[deer.key].relationship=null;delete legacy.records[deer.key].playerInteracted;
 assert.ok(!parseContext(JSON.stringify(legacy)).records[deer.key],'legacy autonomous-only animal records are dropped');
 assert.ok(parseContext(JSON.stringify(next)).records[deer.key],'player-interacted animals remain saved');
});
test('a threat leaving the 24 m sensing edge is remembered briefly, then the animal feeds again',async()=>{
 const {THREAT_MEMORY}=await import('../src/core/animalBehavior');
 const brain=new AnimalBrain(5);brain.energy=50;
 const food={key:'f',x:.3,y:0,z:0,kind:'food' as const};
 brain.sense(origin,[{key:'wolf',x:0,y:0,z:-23.9,kind:'threat'},food]);brain.decide(origin,.033);assert.equal(brain.problem,'escape');
 brain.sense(origin,[food]);brain.decide(origin,.033);assert.equal(brain.problem,'escape');
 for(let t=0;t<THREAT_MEMORY;t+=.1)brain.decide(origin,.1);
 brain.decide(origin,.1);assert.equal(brain.problem,'feed');
});

const SPEEDS={deer:{walk:[.65,.8,1],run:[3],back:[.65,.7]},wolf:{walk:[.35,.8,2],run:[4,7],back:[.35,.8,2,4]}} as const;
test('IK gait for deer and wolf at every game speed: feet reach targets, stance feet planted, joints bend the right way',async()=>{
 const {quadrupedPose,limbOf,bendsForward,DEER_LEGS,WOLF_LEGS}=await import('../src/core/animalBehavior');
 for(const [animal,legs] of [['deer',DEER_LEGS],['wolf',WOLF_LEGS]] as const) {
  // Forward kinematics of the whole chain: girdle (shoulder blade) → upper → lower → foot bone → paw sole.
  const fk=(pose:ReturnType<typeof quadrupedPose>,i:number)=>{
   const L=limbOf(legs,i),A1=pose.legs[i]+pose.girdles[i],A2=A1+pose.knees[i],A3=A2+pose.wrists[i],J=pose.joints[i],M=L.foot??0;
   const carpus={z:J.z-Math.sin(A1)*L.upper-Math.sin(A2)*L.lower,y:J.y-Math.cos(A1)*L.upper-Math.cos(A2)*L.lower};
   return {carpus,foot:{z:carpus.z-Math.sin(A3)*M,y:carpus.y-Math.cos(A3)*M},A3};};
  const cases:[string,number][]=[['idle',0],...Object.entries(SPEEDS[animal]).flatMap(([m,vs])=>(vs as readonly number[]).map((v:number)=>[m,v] as [string,number]))];
  for(const [motion,speed] of cases) for(let k=0;k<60;k++) {
   const phase=k/60,pose=quadrupedPose(motion as any,phase,0,legs,speed);
   pose.legs.forEach((_,i)=>{const L=limbOf(legs,i),f=fk(pose,i),t=pose.feet[i],S=L.girdle??0,g=pose.girdles[i],J=pose.joints[i];
    const where=`${animal} ${motion}@${speed} leg ${i} phase ${phase}`;
    assert.ok(Math.abs(f.foot.z-t.z)<1e-6&&Math.abs(f.foot.y-t.y)<1e-6,`${where} misses target`);
    assert.ok(Math.abs(J.z+S*Math.sin(g))<1e-9&&Math.abs(J.y-(L.hip+pose.bob+S-S*Math.cos(g)))<1e-9,`${where}: joint is on the shoulder-blade arc`);
    assert.ok(f.foot.y>-1e-6&&f.carpus.y>-1e-6,`${where}: below ground`);
    assert.ok(bendsForward(legs,i)?pose.knees[i]<=1e-9:pose.knees[i]>=-1e-9,`${where}: middle joint bends the wrong way`);
    // The paw bone cancels everything above it, so the sole stays level.
    const total=(L.foot?f.A3:pose.legs[i]+pose.knees[i])+pose.paws[i];
    assert.ok(Math.abs(total)<1e-9,`${where}: paw not level`);});
  }
  for(let k=0;k<=20;k++){const j=quadrupedPose('jump',0,k/20*.85,legs,0);if(k===0||k===20)j.feet.forEach(f=>assert.ok(Math.abs(f.y)<1e-6,'jump starts and lands on the ground'));}
 }
});
test('wolf limbs: front shoulder→upper arm→forearm→wrist/paw with the elbow back; rear hip→thigh→stifle (forward)→hock (back)→paw',async()=>{
 const {quadrupedPose,WOLF_LEGS,limbOf,bendsForward}=await import('../src/core/animalBehavior');
 const p=quadrupedPose('idle',0,0,WOLF_LEGS,0);
 for(const i of [0,2]) { assert.ok(!bendsForward(WOLF_LEGS,i)&&p.knees[i]>0,'elbow points back'); assert.ok(p.girdles[i]>.3,'shoulder blade tilted'); }
 for(const i of [1,3]) { assert.ok(bendsForward(WOLF_LEGS,i)&&p.knees[i]<0,'stifle points forward'); assert.ok(p.wrists[i]>0.3,'hock bends back: paw ahead of the hock'); assert.equal(limbOf(WOLF_LEGS,i).girdle,undefined); }
 const walk=quadrupedPose('walk',.3,0,WOLF_LEGS,.8); assert.ok(Math.abs(walk.girdles[0]-p.girdles[0])>.01,'shoulder blade swings with the stride');
 // Swing folds the foot bone: more hock/carpus flexion while the paw is lifted than planted.
 const swing=[0,1,2,3].map(i=>quadrupedPose('walk',0,0,WOLF_LEGS,.8).feet[i].y>0);
 assert.ok(swing.some(Boolean)&&swing.some(x=>!x));
});
test('no foot sliding: a stance foot moves back exactly as far as the body moves forward',async()=>{
 const {AnimalBrain,footTarget,gaitFor,WOLF_LEGS}=await import('../src/core/animalBehavior');
 for(const [motion,speed] of [['walk',.8],['run',4],['run',7]] as const) {
  const b=new AnimalBrain(1);b.legs=WOLF_LEGS;b.motion=motion;b.phase=.02;const dt=1/120,dist=speed*dt;
  const g=gaitFor(motion,speed,WOLF_LEGS)!;const before=footTarget(g,motion,b.phase,1);b.expend(dt,dist);const after=footTarget(g,motion,b.phase,1);
  assert.equal(before.y,0);assert.ok(Math.abs((after.z-before.z)-dist)<1e-9,`${motion}@${speed}`);
 }
});
test('gait follows dynamic similarity: walk, trot, gallop by Froude number; stride grows with speed and leg length',async()=>{
 const {gaitFor,DEER_LEGS,WOLF_LEGS}=await import('../src/core/animalBehavior');
 assert.equal(gaitFor('walk',.8,DEER_LEGS)!.name,'walk');assert.equal(gaitFor('run',3,DEER_LEGS)!.name,'trot');
 assert.equal(gaitFor('walk',2,WOLF_LEGS)!.name,'trot');assert.equal(gaitFor('run',7,WOLF_LEGS)!.name,'gallop');
 assert.equal(gaitFor('back',4,WOLF_LEGS)!.name,'walk');
 const fr=(v:number,h:number)=>v*v/(9.81*h);
 assert.ok(Math.abs(gaitFor('walk',.8,DEER_LEGS)!.cycle-2.3*1.1*fr(.8,1.1)**.3)<1e-9,'unclamped stride matches 2.3·h·Fr^0.3');
 assert.ok(gaitFor('walk',1,DEER_LEGS)!.cycle>gaitFor('walk',.65,DEER_LEGS)!.cycle);
 assert.equal(gaitFor('idle',0,DEER_LEGS),null);
});
test('gallop has a suspension phase with all four feet off the ground and lifts the body then',async()=>{
 const {quadrupedPose,WOLF_LEGS}=await import('../src/core/animalBehavior');
 let airborne=0;for(let k=0;k<100;k++){const p=quadrupedPose('run',k/100,0,WOLF_LEGS,7);if(p.feet.every(f=>f.y>1e-6)){airborne++;assert.ok(p.bob>0);}}
 assert.ok(airborne>=10&&airborne<=50,`suspension ${airborne}%`);
 const {DEER_LEGS,limbOf}=await import('../src/core/animalBehavior');
 const mid=quadrupedPose('jump',0,.5,DEER_LEGS,0);assert.ok(mid.feet.every(f=>f.y>.3),'legs tucked off the ground mid-jump');
 for(const legs of [DEER_LEGS,WOLF_LEGS]) for(let k=0;k<=20;k++){const p=quadrupedPose('jump',0,k/20*.85,legs,0);
  p.feet.forEach((f,i)=>{const L=limbOf(legs,i);assert.ok(Math.hypot(f.z,f.y-(L.hip+p.bob))<=L.upper+L.lower+(L.foot??0)+(L.girdle??0),'jump tuck within leg reach');});}
});
