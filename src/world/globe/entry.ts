/** Page entry (Grok Bot): `?view=globe` opens the planet globe (src/world/globe), anything else starts the game (main.ts). */
import { bareStart } from './startView';
/** A failed boot import (e.g. "Failed to fetch dynamically imported module") says so on the boot splash instead of leaving it on "Starting…". */
const bootFailed = (e: unknown) => { console.error('boot', e); const s = document.querySelector('#loading .loading-step'); if (s) s.textContent = `Boreal could not start (${e instanceof Error ? e.message : String(e)}). Reload the page to try again.`; };
{ const s = bareStart(location.search); if (s) history.replaceState(history.state, '', s + location.hash); } // bare load -> the globe start (startView.ts), before any module reads the query
if (new URLSearchParams(location.search).get('view') === 'globe') void import('./globeView').then(m => m.startGlobe()).then(() => import('../../input/padRouter')).then(m => m.startStandaloneRouter()).catch(bootFailed); // + gamepad (Grok Bot)
else if (new URLSearchParams(location.search).get('view') === 'farlayer') void import('./farLayerDemo').then(m => m.startFarLayerDemo()).catch(bootFailed); // dev: far-layer proof
else if (new URLSearchParams(location.search).has('tree')) void import('../../render/trees/viewer').catch(bootFailed); // dev: procedural tree viewer (?tree=1, trees M1/M2; needs the #hud element it creates)
else void import('../../main').catch(bootFailed);
