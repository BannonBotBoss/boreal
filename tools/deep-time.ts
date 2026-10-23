// Review page for core/deepTime (T-0060): the dial, the stage it points at, and the cited milestones. ?t=<years from now> opens at an offset.
import { MILESTONES, deepTimeAt, dialToYears, formatYears, nearestMilestone, yearsToDial } from '../src/core/deepTime';
const $ = (id: string) => document.getElementById(id)!, dial = $('dial') as HTMLInputElement, card = $('card'), ms = $('ms');
const start = Number(new URLSearchParams(location.search).get('t')); if (Number.isFinite(start) && start !== 0) dial.value = String(yearsToDial(start));
ms.innerHTML = MILESTONES.map(m => `<tr data-id="${m.id}"><td>${formatYears(m.yr)}</td><td>${m.label}</td><td class="src">${m.src}</td><td><button data-yr="${m.yr}">go</button></td></tr>`).join('');
function draw() {
  const y = dialToYears(Number(dial.value)), d = deepTimeAt(y), near = nearestMilestone(y);
  card.innerHTML = `<b>${d.label}</b> &middot; ${d.title}<p>${d.sees}</p><p>${d.extrapolated ? 'Sun: not modelled (the Gough fit ends with the main sequence)' : `Sun ${(d.luminosity * 100).toFixed(1)} % of today &middot; ${d.solarConstant.toFixed(0)} W/m&sup2; &middot; zero-greenhouse temperature ${Number.isNaN(d.equilibriumK) ? 'n/a (no planet)' : d.equilibriumK.toFixed(1) + ' K'}`} &middot; embodiable: ${d.embody}</p><small>nearest milestone: ${near.label}</small>`;
  for (const r of Array.from(ms.querySelectorAll('tr'))) r.classList.toggle('on', (r as HTMLElement).dataset.id === near.id);
}
dial.addEventListener('input', draw); ms.addEventListener('click', e => { const b = (e.target as HTMLElement).closest('button'); if (b) { dial.value = String(yearsToDial(Number(b.dataset.yr))); draw(); } });
draw();
