import * as THREE from 'three';
import { AnimalBrain, quadrupedPose, DEER_LEGS } from '../core/animalBehavior';
import { DEER_HIP_XZ } from '../core/waterWake';
export { DEER_LEGS };
export function createDeerRig(seed:number,detail:number) {
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const brown=new THREE.MeshStandardMaterial({color:0xa28055,flatShading:true,roughness:1});
  const pale=new THREE.MeshStandardMaterial({color:0xc4ab7a,flatShading:true,roughness:1});
  const dark=new THREE.MeshStandardMaterial({color:0x3b2f25,flatShading:true,roughness:1});
  const part=(parent:THREE.Object3D,x:number,y:number,z:number,sx:number,sy:number,sz:number,mat=brown)=>{
    const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(1,detail===0?1:0),mat);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;
  };
  part(body,0,1.3,0,.55,.65,1.05);part(body,0,1.95,-.85,.3,.7,.34);
  const head=new THREE.Group();head.position.set(0,2.4,-1.05);body.add(head);
  part(head,0,0,0,.32,.34,.5);part(head,0,-.12,-.35,.23,.2,.25,pale);
  for(const side of [-1,1]) {part(head,side*.4,.25,.15,.14,.32,.16);if(detail<2)part(head,side*.24,.58,.1,.045,.43,.04,pale);}
  const brain=new AnimalBrain(seed),sensor=new THREE.Object3D();sensor.name='head-sensor';sensor.userData.brain=brain;head.add(sensor);
  const legs:THREE.Group[]=[],knees:THREE.Group[]=[];
  for(const [x, z] of DEER_HIP_XZ) {
    const hip=new THREE.Group();hip.position.set(x,1.1,z);root.add(hip);legs.push(hip);
    // Segments overlap at the joints so no gaps open when the knee bends.
    part(hip,0,-DEER_LEGS.upper/2,0,.09,DEER_LEGS.upper/2+.05,.1);
    const knee=new THREE.Group();knee.position.y=-DEER_LEGS.upper;hip.add(knee);knees.push(knee);
    part(knee,0,0,0,.08,.08,.08);part(knee,0,-DEER_LEGS.lower/2,0,.07,DEER_LEGS.lower/2+.03,.08);
    part(knee,0,-DEER_LEGS.lower+.05,-.02,.075,.05,.1,dark);
  }
  const tail=new THREE.Group();tail.position.set(0,1.45,.92);body.add(tail);part(tail,0,0,.13,.1,.11,.2,pale);
  root.userData.rig={brain,sensor,head,tail,legs,knees};
  let tailAngle=0;
  return {root,brain,sensor,animate(dt:number) {
    const pose=quadrupedPose(brain.motion,brain.phase,brain.jumpTime,DEER_LEGS,brain.gaitSpeed);
    legs.forEach((leg,i)=>{leg.rotation.x=pose.legs[i];knees[i].rotation.x=pose.knees[i];});
    body.position.y=pose.bob; legs.forEach(leg=>leg.position.y=DEER_LEGS.hip+pose.bob);
    // Posture from src/core/deerHerd.ts: head down to graze, up and scanning when vigilant, raised and still when alert.
    const posture=root.userData.posture as string|undefined;
    const headDown=posture==='graze'||posture==='eat'||(!posture&&brain.problem==='feed'&&brain.motion==='idle')?.6:posture==='alert'?-.3:posture==='scan'?-.18:0;
    head.rotation.x+=(headDown-head.rotation.x)*(1-Math.exp(-5*dt));
    const look=posture==='scan'?Math.sin(brain.time*1.3+brain.seed)*.5:0;head.rotation.y+=(look-head.rotation.y)*(1-Math.exp(-4*dt));
    if(posture==='alert'||posture==='flee') tailAngle=0, tail.rotation.x=-.9; else tail.rotation.x*=Math.exp(-3*dt);
    const target=brain.motion==='idle'?0:Math.sin(brain.phase*Math.PI*2)*.09;
    tailAngle+=(target-tailAngle)*(1-Math.exp(-12*dt));tail.rotation.y=tailAngle;
    tail.position.set(0,1.45,.92);
  }};
}
