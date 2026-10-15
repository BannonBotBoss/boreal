export const MATURITY_SECONDS = 30 * 60;
export function wolfGrowth(activeSeconds: number) {
  const progress=Math.max(0,Math.min(1,Number.isFinite(activeSeconds)?activeSeconds/MATURITY_SECONDS:0));
  return {progress,stage:progress<.25?'Puppy':progress<.75?'Young wolf':'Adult wolf',
    scale:.4+.85*progress,maxStamina:15+105*progress};
}
export function parseGrowth(saved: string | null) {
  if(saved===null)return 0;
  try {const value=JSON.parse(saved);return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(MATURITY_SECONDS,value)):0;} catch{return 0;}
}
