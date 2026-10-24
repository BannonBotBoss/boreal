/** Page entry (Grok Bot): `?view=globe` opens the planet globe (src/world/globe), anything else starts the game (main.ts). */
import { bareStart } from './startView';
{ const s = bareStart(location.search); if (s) history.replaceState(history.state, '', s + location.hash); } // bare load -> the globe start (startView.ts), before any module reads the query
if (new URLSearchParams(location.search).get('view') === 'globe') void import('./globeView').then(m => m.startGlobe()).then(() => import('../../input/padRouter')).then(m => m.startStandaloneRouter()); // + gamepad (Grok Bot)
else if (new URLSearchParams(location.search).get('view') === 'farlayer') void import('./farLayerDemo').then(m => m.startFarLayerDemo()); // dev: far-layer proof
else if (new URLSearchParams(location.search).has('tree')) void import('../../render/trees/viewer'); // dev: procedural tree viewer (?tree=1, trees M1/M2; needs the #hud element it creates)
else void import('../../main');
