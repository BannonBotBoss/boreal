// node refs/forest-edge/edge-gap.mjs : sky seen through the LOW band of a lake's far shore (waterline up to ~25 % of the
// treeline height), and through its mirror image in the water under it. Metric: share of pixels in the band that are
// sky-coloured: luminance above half the sky's (q95 of a sky box) AND blue >= green (lit foliage, green or autumn, has g > b).
// A closed edge wall (edge trees with branches to the ground, shrubs, saplings: Harper et al. 2015) scores ~0.
// Calibration: known matches = closed real lake edges; known mismatch = a real band where sky shows between spruce spires
// (taiga photo, horizon band). Decodes JPEG/PNG in headless Edge (canvas), pattern of refs/water/shore-audit/measure-photos.mjs.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { acquire, track, release } from '../../tools/bench-lock.mjs';
const name = 'claude: forest edge gap', sleep = ms => new Promise(r => setTimeout(r, ms)), R = 'refs/water/reference/real/';
// [file, band [x0,y0,x1,y1], sky box, kind]
const C = [
  [R + 'A_small_lake_in_Algonquin_Provincial_Park.jpg', [0, 545, 1050, 630], [350, 60, 850, 120], 'match: closed real edge'],
  [R + 'Lakeshore_in_southern_Finland_in_the_summer_2008_forest_and_.jpg', [200, 400, 700, 490], [0, 150, 300, 300], 'match: closed real edge'],
  [R + 'Small_lake_in_the_depths_of_the_ta_ga.jpg', [0, 400, 1280, 470], [0, 50, 500, 150], 'match: open taiga, low band'],
  [R + 'Small_lake_in_the_depths_of_the_ta_ga.jpg', [0, 200, 1280, 260], [0, 50, 500, 150], 'mismatch: sky between spruce spires'],
  [R + 'A_small_lake_in_Algonquin_Provincial_Park.jpg', [100, 700, 400, 790], [350, 60, 850, 120], 'match: mirror of a closed edge'],
  [R + 'Lakeshore_in_southern_Finland_in_the_summer_2008_forest_and_.jpg', [400, 560, 600, 700], [0, 150, 300, 300], 'match: mirror of a closed edge'],
  [R + 'Small_lake_in_the_depths_of_the_ta_ga.jpg', [720, 500, 880, 580], [0, 50, 500, 150], 'match: mirror of open taiga'],
  ['refs/water/shore-audit/noon-0.png', [250, 185, 1270, 245], [240, 100, 330, 140], 'GAME main far shore, low band'],
  ['C:/dev/boreal-claude-water-optics/refs/water/optics-after2/noon-0.png', [300, 262, 1200, 285], [240, 100, 330, 140], 'GAME T-0023 93d6f2c mirror of the far shore'],
];
if (!await acquire(name, { waitMs: 5 * 60 * 1000 })) throw Error('GPU busy');
let ws;
try {
  const p = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--disable-extensions', '--no-first-run', '--remote-debugging-port=9473', '--user-data-dir=C:/dev/boreal-claude-edge', 'about:blank'], { stdio: 'ignore' }); track(p.pid);
  let tabs; for (let i = 0; i < 40; i++) { try { tabs = await (await fetch('http://127.0.0.1:9473/json')).json(); break; } catch { await sleep(500); } }
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id) { pending.get(d.id)?.(d.result); pending.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise(r => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const out = [];
  for (const [f, band, sky, kind] of C) {
    const mime = f.endsWith('.png') ? 'image/png' : 'image/jpeg', b64 = readFileSync(resolve(f)).toString('base64');
    const r = await cdp('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise(res=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const g=c.getContext('2d');g.drawImage(im,0,0);
      const lin=v=>{v/=255;return v>.04045?((v+.055)/1.055)**2.4:v/12.92};const blue=(d,i)=>d[i+2]>=d[i+1],L=(d,i)=>.2126*lin(d[i])+.7152*lin(d[i+1])+.0722*lin(d[i+2]);
      const px=([x0,y0,x1,y1])=>{const d=g.getImageData(x0,y0,x1-x0,y1-y0).data,o=[];for(let i=0;i<d.length;i+=4)o.push(blue(d,i)?L(d,i):0);return o;};
      const s=px(${JSON.stringify(sky)}).sort((a,b)=>a-b),skyL=s[Math.floor(s.length*.95)],b=px(${JSON.stringify(band)});
      res({size:[im.width,im.height],skyL:+skyL.toFixed(4),skyShare:+(b.filter(v=>v>skyL*.5).length/b.length).toFixed(4)});};im.src='data:${mime};base64,${b64}';})` });
    out.push({ file: f, band, sky, kind, ...r.result.value });
  }
  writeFileSync(resolve('refs/forest-edge/edge-gap.json'), JSON.stringify(out, null, 1));
  for (const o of out) console.log(o.skyShare, o.kind, o.file);
} finally { ws?.close(); release(name); }
