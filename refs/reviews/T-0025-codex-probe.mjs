import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const source=readFileSync('refs/water/littoral-audit/measure.mjs','utf8').replace(/\r\n/g,'\n');
const start=source.indexOf('const clamp01');const end=source.indexOf('const results');
const moduleSource='const decodePng=x=>x;\n'+source.slice(start,end).replace('function measureLittoralFrame','export function measureLittoralFrame');
const {measureLittoralFrame}=await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64'));
const make=(stripe)=>({w:1280,h:720,bpp:3,rows:Array.from({length:720},(_,y)=>{const r=new Uint8Array(1280*3);for(let x=0;x<1280;x++)r.set(stripe&&y%40>=8&&(Math.floor(x/4)+Math.floor(y/40))%2===0?[70,130,50]:[40,100,150],x*3);return r})});
const result={target:'agy/littoral-plants 01c4bbb',method:'Unmodified scoring functions extracted from submitted measure.mjs; only PNG decoding replaced with an in-memory RGB fixture. Full-frame vertical four-pixel green/blue stripes offset four pixels and interrupted by eight blue rows every forty rows contain no plants, shore, depth zonation, or natural scene.',flatBlueControl:measureLittoralFrame(make(false)),knownMismatchStripes:measureLittoralFrame(make(true))};
mkdirSync('refs/reviews/T-0025-codex',{recursive:true});writeFileSync('refs/reviews/T-0025-codex/adversarial.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
