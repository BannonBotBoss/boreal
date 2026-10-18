/** Page entry (Grok Bot): `?view=globe` opens the planet globe (src/world/globe), anything else starts the game (main.ts). */
if (new URLSearchParams(location.search).get('view') === 'globe') void import('./globeView').then(m => m.startGlobe());
else if (new URLSearchParams(location.search).get('view') === 'farlayer') void import('./farLayerDemo').then(m => m.startFarLayerDemo()); // dev: far-layer proof
else void import('../../main');
