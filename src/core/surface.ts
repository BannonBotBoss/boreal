import { hash, random } from './random';
export const FORMATION_SPACING = 12;
export const MAX_FORMATION_CELLS = 12;
export const MAX_DEPTH_STEP = .025;
export interface DepressionCell { x: number; z: number; half: number; depth: number }
export function neighbours(c: DepressionCell) {
  return c.half === 0
    ? [[c.x,c.z,1],[c.x-1,c.z,1],[c.x,c.z-1,1]]
    : [[c.x,c.z,0],[c.x+1,c.z,0],[c.x,c.z+1,0]];
}
export function cellCenter(c: DepressionCell) { const t = c.half === 0 ? 1/3 : 2/3; return {x:c.x+t,z:c.z+t}; }
const cache = new Map<string, DepressionCell[]>();
export function depressionFormation(px: number, pz: number): DepressionCell[] {
  const key = `${px}:${pz}`;
  const old = cache.get(key); if(old) return old;
  const rng = random(hash(`depressions-v1:1400:${key}`));
  // Triangular distribution favours the middle of the inclusive 1..12 range.
  const count = Math.min(12, 1 + Math.floor((rng()+rng())*.5*12));
  const cells: DepressionCell[] = [{x:px*12+5,z:pz*12+5,half:0,depth:.07+rng()*.025}];
  while(cells.length<count) {
    const frontier = cells.flatMap(parent => neighbours(parent).filter(([x,z,half]) =>
      x>=px*12+1 && x<px*12+11 && z>=pz*12+1 && z<pz*12+11 && !cells.some(c=>c.x===x&&c.z===z&&c.half===half)
    ).map(([x,z,half])=>({parent,x,z,half})));
    if(!frontier.length) break;
    // Randomly select among all three free sides; revisiting parents allows branches.
    const choice=frontier[Math.floor(rng()*frontier.length)];
    const adjacent=cells.filter(c=>neighbours(c).some(([x,z,h])=>x===choice.x&&z===choice.z&&h===choice.half));
    const low=Math.max(cells[0].depth-MAX_DEPTH_STEP/2,...adjacent.map(c=>c.depth-MAX_DEPTH_STEP));
    const high=Math.min(cells[0].depth+MAX_DEPTH_STEP/2,...adjacent.map(c=>c.depth+MAX_DEPTH_STEP));
    cells.push({x:choice.x,z:choice.z,half:choice.half,depth:low+rng()*(high-low)});
  }
  if(cache.size>=256) cache.delete(cache.keys().next().value!);
  cache.set(key,cells);return cells;
}
function segmentDepth(x:number,z:number,a:DepressionCell,b:DepressionCell) {
  const p=cellCenter(a),q=cellCenter(b),dx=q.x-p.x,dz=q.z-p.z;
  const t=Math.max(0,Math.min(1,((x-p.x)*dx+(z-p.z)*dz)/(dx*dx+dz*dz||1)));
  const d=Math.hypot(x-p.x-t*dx,z-p.z-t*dz);
  const u=Math.max(0,1-d/.55); const falloff=u*u*(3-2*u);
  return (a.depth+(b.depth-a.depth)*t)*falloff;
}
const segmentCache = new WeakMap<DepressionCell[], [DepressionCell,DepressionCell][]>();
export function surfaceDetail(x:number,z:number) {
  const px=Math.floor(x/12),pz=Math.floor(z/12),cells=depressionFormation(px,pz);
  let depression=0;
  let segments=segmentCache.get(cells);
  if(!segments) {
    segments=cells.flatMap((c,i)=>[[c,c] as [DepressionCell,DepressionCell],...cells.slice(i+1).filter(n=>neighbours(c).some(([nx,nz,h])=>nx===n.x&&nz===n.z&&h===n.half)).map(n=>[c,n] as [DepressionCell,DepressionCell])]);
    segmentCache.set(cells,segments);
  }
  for(const [a,b] of segments) {
    if(x<Math.min(a.x,b.x)-.55||x>Math.max(a.x,b.x)+1.55||z<Math.min(a.z,b.z)-.55||z>Math.max(a.z,b.z)+1.55)continue;
    depression=Math.max(depression,segmentDepth(x,z,a,b));
  }
  const bumps=.045*Math.sin(x*2.1+Math.sin(z*.8))*Math.sin(z*1.7+x*.3);
  return bumps-depression;
}
