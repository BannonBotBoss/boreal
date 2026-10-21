// node refs/water/shore-audit/measure-photos.mjs : decode the JPEG references in headless Edge (canvas) and measure the same
// statistic as measure.mjs: relative luminance of the water band under the far shore / the treeline it mirrors.
// Calibration of the T-0023 mirror metric: real photos (known nature) vs the game frame noon-0.png.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquire, track, release } from '../../../tools/bench-lock.mjs';
const name = 'claude: water photo measure', dir = resolve('refs/water/reference/real'), sleep = ms => new Promise(r => setTimeout(r, ms));
// boxes [x0,y0,x1,y1] in the 1280-wide thumbnails: treeline above the shore, and the water directly under it (its mirror)
const B = {
  'A_small_lake_in_Algonquin_Provincial_Park.jpg': { treeline: [100, 450, 400, 600], water_under: [100, 700, 400, 790] },
  'Lakeshore_in_southern_Finland_in_the_summer_2008_forest_and_.jpg': { treeline: [300, 380, 560, 480], water_under: [400, 560, 600, 700] },
  'Small_lake_in_the_depths_of_the_ta_ga.jpg': { treeline: [560, 280, 880, 420], water_under: [720, 500, 880, 580] },
  'Lake_of_Two_Rivers_Algonquin_Park.jpg': null, 'Peace_at_Mizzy_Lake_Trail_ALgonquin_Park.jpg': null };
if (!await acquire(name, { waitMs: 5 * 60 * 1000 })) throw Error('GPU busy');
let ws;
try {
  const p = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-extensions', '--no-first-run', '--remote-debugging-port=9472', '--user-data-dir=C:/dev/boreal-claude-edge', 'about:blank'], { stdio: 'ignore' }); track(p.pid);
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://127.0.0.1:9472/json')).json(); break; } catch { await sleep(500); } }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const out = {};
  for (const [f, boxes] of Object.entries(B)) { if (!boxes) continue;
    const b64 = readFileSync(`${dir}/${f}`).toString('base64');
    const r = await cdp('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise(res=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
      const lum=v=>{v/=255;return v>.04045?((v+.055)/1.055)**2.4:v/12.92};const boxes=${JSON.stringify(boxes)};const o={size:[im.width,im.height]};
      for(const k in boxes){const [x0,y0,x1,y1]=boxes[k];const d=g.getImageData(x0,y0,x1-x0,y1-y0).data;let s=[0,0,0],n=0;for(let i=0;i<d.length;i+=4){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];n++;}
        const m=s.map(v=>v/n),L=.2126*lum(m[0])+.7152*lum(m[1])+.0722*lum(m[2]);o[k]={rgb:m.map(v=>+v.toFixed(1)),relLum:+L.toFixed(4)};}
      o.ratio=+(o.water_under.relLum/o.treeline.relLum).toFixed(3);res(o);};im.src='data:image/jpeg;base64,${b64}';})` });
    out[f] = r.result.value; }
  const game = JSON.parse(readFileSync(resolve('refs/water/shore-audit/measure.json'), 'utf8'))['noon-0.png'];
  out['GAME noon-0.png'] = { treeline: game.far_treeline, water_under: game.water_far, ratio: +(game.water_far.relLum / game.far_treeline.relLum).toFixed(3) };
  writeFileSync(resolve('refs/water/shore-audit/mirror-ratio.json'), JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(v.ratio, k);
} finally { ws?.close(); release(name); }
