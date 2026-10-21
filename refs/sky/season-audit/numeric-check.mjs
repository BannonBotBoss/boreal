import fs from 'node:fs';
const raw=JSON.parse(fs.readFileSync('refs/sky/season-audit/observations.json','utf8'));
const R=Math.PI/180;
function reference(day,hour){const g=2*Math.PI/365*(day-1);const d=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);return Math.asin(Math.sin(49.5*R)*Math.sin(d)+Math.cos(49.5*R)*Math.cos(d)*Math.cos(15*(hour-12)*R))/R;}
const rows=raw.observations.map(o=>({frame:o.frame,day:o.day,solarHour:o.hour,renderElevation:o.renderSun.elevation,noaaElevation:reference(o.day,o.hour),absoluteError:Math.abs(o.renderSun.elevation-reference(o.day,o.hour))}));
fs.writeFileSync('refs/sky/season-audit/numbers.json',JSON.stringify({source:'https://gml.noaa.gov/grad/solcalc/solareqns.PDF',method:'NOAA declination at noon, spherical solar altitude at 49.5 N; hour treated as local solar time per game contract; not Kenora civil time',rows},null,2));console.log(rows);
