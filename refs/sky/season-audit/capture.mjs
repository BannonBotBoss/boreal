// Run from repository root: node refs/sky/season-audit/capture.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';
const name='codex: sky audit', out=resolve('refs/sky/season-audit');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
if(!await acquire(name,{waitMs:1000})) throw Error('GPU busy');
let ws;
try {
 const p=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--disable-extensions','--no-first-run','--disable-gpu-vsync','--disable-frame-rate-limit','--remote-debugging-port=9467',`--user-data-dir=${resolve('work/edge-profile')}`,'about:blank'],{stdio:'ignore'}); track(p.pid);
 let tabs; for(let i=0;i<40;i++){try{tabs=await(await fetch('http://127.0.0.1:9467/json')).json();break;}catch{await sleep(500);}}
 ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){pending.get(d.id)?.(d.result);pending.delete(d.id);}if(d.method==='Runtime.exceptionThrown')errors.push(d.params);};
 const cdp=(method,params={})=>new Promise((r,j)=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}));setTimeout(()=>{if(pending.delete(n))j(Error(method+' timeout'));},20000).unref();});
 const ev=async expression=>{const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result?.value;};
 await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
 await cdp('Page.navigate',{url:'http://127.0.0.1:5173/?nomenu&bench&hour=12'});
 let ready=false;for(let i=0;i<90;i++){await sleep(1000);if(await ev("document.readyState==='complete' && !document.getElementById('loading')")){ready=true;break;}}
 if(!ready)throw Error('not ready: '+await ev('location.href'));await sleep(3000);
 await ev(`(async()=>{window.auditClock=await import('/src/core/timeOfDay.ts');window.auditWeather=await import('/src/core/weather.ts'); const c=document.querySelector('canvas');window.auditChunks=[];window.auditRecorder=new MediaRecorder(c.captureStream(15),{mimeType:'video/webm'});auditRecorder.ondataavailable=e=>auditChunks.push(e.data);auditRecorder.start();})()`);
 const observations=[];
 for(let i=0;i<6;i++){
  if(i===3)await ev('auditClock.DAY.offset+=128*24');
  await sleep(1000);
  const s=await cdp('Page.captureScreenshot',{format:'png'});writeFileSync(`${out}/frame-${i}.png`,Buffer.from(s.data,'base64'));
  observations.push(await ev(`({frame:${i},wallMs:performance.now(),day:auditWeather.WEATHER.day,hour:auditWeather.WEATHER.hour,renderSun:auditClock.sunPosition(auditWeather.WEATHER.hour),datedSun:auditClock.sunPosition(auditWeather.WEATHER.hour,auditWeather.WEATHER.day),status:document.getElementById('status')?.textContent})`));
 }
 const video=await ev(`new Promise(r=>{auditRecorder.onstop=()=>{const f=new FileReader();f.onload=()=>r(f.result.split(',')[1]);f.readAsDataURL(new Blob(auditChunks,{type:'video/webm'}));};auditRecorder.stop();})`);
 writeFileSync(`${out}/recording.webm`,Buffer.from(video,'base64'));writeFileSync(`${out}/observations.json`,JSON.stringify({url:'http://127.0.0.1:5173/?nomenu&bench&hour=12',observations,errors},null,2));console.log(JSON.stringify(observations));
}finally{ws?.close();release(name);}
