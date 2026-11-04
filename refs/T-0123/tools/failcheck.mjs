import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 800 }); await p.setRequestInterception(true);
p.on('request', r => /\/src\/main\.ts/.test(r.url()) ? r.abort() : r.continue());
await p.goto(process.argv[2], { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 3000));
console.log(await p.evaluate(() => document.querySelector('#loading .loading-step')?.textContent + ' | ' + getComputedStyle(document.getElementById('loading')).position));
await p.screenshot({ path: process.argv[3], type: 'jpeg', quality: 70 }); await b.close();
