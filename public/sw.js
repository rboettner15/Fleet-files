const CACHE='fleet-files-v9';
const SHELL=['/','/index.html','/app.js','/style.css','/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png','/photos/hero.jpg','/photos/pit-mobile.webp','/photos/pit-desktop.webp','/photos/credits.json','/photos/truck.jpg','/photos/dump-truck.jpg','/photos/trailer.jpg','/photos/loader.jpg','/photos/excavator.jpg','/photos/dozer.jpg','/photos/generator.jpg','/photos/other.jpg','/fonts/oxanium-latin-600-normal.woff2','/fonts/oxanium-latin-700-normal.woff2',];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.pathname.startsWith('/api/docs/'))return; // documents: always straight from the network, never cached
  if(u.pathname.startsWith('/api/')){ // network first, fall back to cached data for offline viewing
    e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));}return res;}).catch(()=>caches.match(r).then(m=>m||new Response(JSON.stringify({error:'offline'}),{status:503,headers:{'Content-Type':'application/json'}}))));
    return;}
  e.respondWith(caches.match(r).then(m=>{const f=fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open(CACHE).then(x=>x.put(r,c));}return res;}).catch(()=>m);return m||f;}));
});
