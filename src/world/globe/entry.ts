/** Page entry (Grok Bot): `?view=globe` opens the planet globe (src/world/globe), anything else starts the game (main.ts). */
if (new URLSearchParams(location.search).get('view') === 'globe') void import('./globeView').then(m => m.startGlobe());
else void import('../../main');
