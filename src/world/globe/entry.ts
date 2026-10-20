/** Page entry (Grok Bot): `?view=globe` opens the planet globe (src/world/globe), anything else starts the game (main.ts). */
if (new URLSearchParams(location.search).get('view') === 'globe') void import('./globeView').then(m => m.startGlobe());
else if (new URLSearchParams(location.search).get('view') === 'farlayer') void import('./farLayerDemo').then(m => m.startFarLayerDemo()); // dev: far-layer proof
else if (new URLSearchParams(location.search).has('tree')) void import('../../render/trees/viewer'); // dev: procedural tree viewer (?tree=1, trees M1/M2; needs the #hud element it creates)
else void import('../../main');
