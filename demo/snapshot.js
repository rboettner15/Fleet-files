// Renders the demo once and saves the first screen as static HTML (used by build-demo.py). Run with playwright.
const {chromium}=require('/tmp/pw/node_modules/playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await (await b.newContext({viewport:{width:393,height:852}})).newPage();
await p.goto('file://'+__dirname+'/FleetFiles-Demo.html');await p.waitForSelector('.card');await p.waitForTimeout(300);
const h=await p.evaluate(()=>{document.querySelectorAll('#app img').forEach(i=>{i.removeAttribute('onerror');i.removeAttribute('loading');const c=document.createElement('canvas'),r=240/Math.max(i.naturalWidth,i.naturalHeight);c.width=i.naturalWidth*r;c.height=i.naturalHeight*r;c.getContext('2d').drawImage(i,0,0,c.width,c.height);i.src=c.toDataURL('image/jpeg',0.7);});document.querySelectorAll('.ffstatic-note').forEach(n=>n.remove());return document.querySelector('#title').innerHTML+'<!--SPLIT-->'+document.querySelector('#demobar').outerHTML+'<!--SPLIT-->'+document.querySelector('#app').innerHTML});
fs.writeFileSync(__dirname+'/.static.html',h);await b.close();console.log('static',h.length)})();
