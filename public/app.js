// Safe storage: works even where localStorage/sessionStorage are blocked or throw (e.g. iOS Quick Look); falls back to memory.
function safeStore(name){let s=null;try{s=window[name];s.setItem('__ff_t','1');s.removeItem('__ff_t');}catch(e){s=null;}
  const m={};const api={removeItem(k){delete m[k];try{if(s)s.removeItem(k);}catch(e){}},persistent:!!s};
  return new Proxy(api,{get(t,k){if(k in api)return api[k];if(typeof k!=='string')return undefined;if(k in m)return m[k];
      try{if(s){const v=s.getItem(k);if(v!==null){m[k]=v;return v;}}}catch(e){}return undefined;},
    set(t,k,v){m[k]=String(v);try{if(s)s.setItem(k,String(v));}catch(e){}return true;}});}
const LS=safeStore('localStorage'),SS=safeStore('sessionStorage');
'use strict';
const TYPES=['truck','dump truck','trailer','loader','excavator','dozer','generator','other'];
const CATS=['Filters','Belts','Hydraulic','Electrical','Hardware','Fluids','Tires','Engine','Other'];
const STATUSES=['in service','in shop','down'];
const $=s=>document.querySelector(s), app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get code(){return LS.ff_code},set code(v){LS.ff_code=v},get name(){return LS.ff_name||''},set name(v){LS.ff_name=v}};
const state={q:'',type:'all',status:'all',tab:'notes'};
const typeImg=t=>window.FF_PHOTOS?window.FF_PHOTOS[(TYPES.includes(t)?t:'other').replace(' ','-')]:'/photos/'+(TYPES.includes(t)?t:'other').replace(' ','-')+'.jpg';
const fmtDate=d=>d?new Date(d.length===10?d+'T12:00:00':d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
const fmtTime=d=>new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
// status color follows the list role (so renaming keeps the color); custom statuses are blue
const sc=s=>{const r=((LISTS.roles||{}).status||{})[s];return r==='ok'?'in-service':r==='shop'?'in-shop':r==='down'?'down':'custom';};
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,2200);}

// ---------- DEMO MODE (all data local to this device) ----------
const DEMO_KEY='ff_demo_db';
const DEMO_LOOSE=[{name:'EXAMPLE Grease Cartridge',part_number:'EX-GR-14',manufacturer:'Example Brand',category:'Fluids',qty:12,reorder_level:6,bin:'Shelf F1',fits:'Most machines',supplier:'Example Supplier'},
 {name:'EXAMPLE V-Belt',part_number:'EX-VB-A42',manufacturer:'Example Brand',category:'Belts',qty:1,reorder_level:2,bin:'Peg wall B',fits:'Generators, compressors',supplier:'Example Supplier'},
 {name:'EXAMPLE Hydraulic Hose 1/2" x 36"',part_number:'EX-HH-0836',manufacturer:'Example Brand',category:'Hydraulic',qty:3,reorder_level:1,bin:'Hose rack',fits:'Loader, excavator',supplier:'Example Supplier'},
 {name:'EXAMPLE Grade 8 Bolt Kit',part_number:'EX-BK-G8',manufacturer:'Example Brand',category:'Hardware',qty:0,reorder_level:1,bin:'Bin H3',fits:null,supplier:'Example Supplier'}];
const DEMO_CHECK=['Walk-around: no leaks, damage, or loose parts','Engine oil level OK','Coolant level OK','Hydraulic / fuel levels OK','Tires / tracks and wheels OK','Lights, horn, and backup alarm work','Brakes and steering work','Seat belt, mirrors, and fire extinguisher OK'];
const isDemo=()=>LS.ff_demo==='1'||!!window.FF_STANDALONE;
async function demoSeed(){return window.FF_SEED?JSON.parse(JSON.stringify(window.FF_SEED)):fetch('/demo-seed.json').then(r=>r.json());}
async function demoDb(){let d=LS[DEMO_KEY];if(d)return JSON.parse(d);const s=await demoSeed();s.next=1000;LS[DEMO_KEY]=JSON.stringify(s);return s;}
function demoSave(d){try{LS[DEMO_KEY]=JSON.stringify(d);}catch(e){throw new Error('Phone storage is full – try a smaller photo or Reset demo');}}
async function demoReset(){LS.removeItem(DEMO_KEY);await demoDb();}
async function demoApi(path,opt){
  const d=await demoDb(),m=(opt.method||'GET'),b=opt.body||{},now=new Date().toISOString(),nid=()=>d.next++;
  const clean=o=>{const r={};for(const k in o)r[k]=o[k]===''||o[k]===undefined?null:o[k];return r;};
  const num=(o,ks)=>{ks.forEach(k=>{if(o[k]!=null)o[k]=Number(o[k]);});return o;};
  const lastSvc=id=>d.service.filter(s=>s.equipment_id===id).map(s=>s.date).sort().pop()||null;
  const low=p=>p.qty!=null&&p.reorder_level!=null&&Number(p.qty)<=Number(p.reorder_level);
  let x;
  if(!d.checklists){d.checklists=[];d.inspections=[];d.equipment.filter(e=>e.is_example).forEach(e=>d.checklists.push({id:nid(),equipment_id:e.id,name:'EXAMPLE – Daily Pre-Op Inspection',items:DEMO_CHECK.slice(),is_example:1,created_at:now,updated_at:now}));demoSave(d);}
  if(path==='/check')return{ok:true};
  if(!d.loose){d.loose=DEMO_LOOSE.map(p=>({...p,id:nid(),notes:'EXAMPLE part – delete when you add real parts.',photo:null,is_example:1,created_at:now,updated_at:now}));demoSave(d);}
  if(!d.lists){d.lists={type:TYPES.slice(),category:CATS.slice()};
    const seen=(k,v)=>{if(v&&!d.lists[k].some(o=>o.toLowerCase()===String(v).toLowerCase()))d.lists[k].push(v);};
    d.equipment.forEach(e=>seen('type',e.type));(d.loose||[]).forEach(p=>seen('category',p.category));demoSave(d);}
  if(!d.lists.status){d.lists.status=STATUSES.slice();d.lists.stock=STOCKS.slice();d.lists.roles={status:{'in service':'ok','in shop':'shop','down':'down'},stock:{'In stock':'in','Low stock':'low','Out of stock':'out'}};
    d.equipment.forEach(e=>{if(e.status&&!d.lists.status.some(o=>o.toLowerCase()===e.status.toLowerCase()))d.lists.status.push(e.status);});demoSave(d);}
  {const L=d.lists,has=(k,v)=>L[k].find(o=>o.toLowerCase()===String(v).trim().toLowerCase()),add=(k,v)=>{v=String(v||'').trim();if(v&&!has(k,v)){L[k].push(v);return true;}return false;};
   const rec=k=>k==='type'||k==='status'?[d.equipment,k]:[d.loose||[],k],R=L.roles;
   if((m==='POST'||m==='PUT')&&/^\/equipment(\/\d+)?$/.test(path)){add('type',b.type);add('status',b.status);}
   if((m==='POST'||m==='PUT')&&/^\/loose(\/\d+)?$/.test(path)){add('category',b.category);add('stock',b.stock);}
   if(path==='/lists')return{type:L.type.slice(),category:L.category.slice(),status:L.status.slice(),stock:L.stock.slice(),roles:JSON.parse(JSON.stringify(R))};
   if(x=path.match(/^\/lists\/(type|category|status|stock)(\/usage|\/order)?(?:\?(.*))?$/)){const k=x[1],q=new URLSearchParams(x[3]||''),[arr,col]=rec(k);
     const uses=v=>arr.filter(r=>r[col]&&r[col].toLowerCase()===String(v).toLowerCase());
     if(x[2]==='/usage')return{count:uses(q.get('value')||'').length};
     if(x[2]==='/order'){const vs=(b.values||[]).filter(v=>L[k].includes(v));L[k]=vs.concat(L[k].filter(v=>!vs.includes(v)));demoSave(d);return{ok:true};}
     if(m==='POST'){const v=String(b.value||'').trim();if(!v)throw new Error('Enter a name');if(!add(k,v))throw new Error(`“${v}” is already in the list`);demoSave(d);return{ok:true};}
     if(m==='PUT'){const from=b.from,to=String(b.to||'').trim(),i=L[k].indexOf(from);if(i<0)throw new Error('Not found');if(!to)throw new Error('Enter a name');
       const o=has(k,to),merged=!!(o&&o!==from);if(merged)L[k].splice(i,1);else L[k][i]=to;if(R[k]&&R[k][from]){if(!merged)R[k][to]=R[k][from];delete R[k][from];}uses(from).forEach(r=>{r[col]=merged?o:to;r.updated_at=now;});demoSave(d);return{ok:true,merged};}
     if(m==='DELETE'){const v=q.get('value'),i=L[k].findIndex(o=>o.toLowerCase()===String(v).toLowerCase());let rep=(q.get('replace')||'').trim()||null;if(i<0)throw new Error('Not found');
       if(k==='status'){if(L.status.length<2)throw new Error('Keep at least one status');if(!rep)rep=L.status.find((o,j)=>j!==i);}
       if(R[k])delete R[k][L[k][i]];L[k].splice(i,1);uses(v).forEach(r=>{r[col]=rep;r.updated_at=now;});if(rep)add(k,rep);demoSave(d);return{ok:true};}}}
  if(x=path.match(/^\/equipment\/(\d+)\/checklists$/)){const id=+x[1];
    if(m==='GET')return d.checklists.filter(c=>c.equipment_id===id).map(c=>{const ins=d.inspections.filter(i=>i.checklist_id===c.id);return{...c,inspection_count:ins.length,last_done:ins.map(i=>i.created_at).sort().pop()||null};}).sort((p,q)=>p.is_example-q.is_example||p.name.localeCompare(q.name));
    if(!b.name)throw new Error('Checklist name is required');const c={id:nid(),equipment_id:id,name:b.name,items:b.items||[],is_example:0,created_at:now,updated_at:now};d.checklists.push(c);demoSave(d);return{id:c.id};}
  if(x=path.match(/^\/checklists\/(\d+)$/)){const id=+x[1],i=d.checklists.findIndex(c=>c.id===id);if(i<0)throw new Error('Not found');
    if(m==='GET')return d.checklists[i];
    if(m==='PUT'){if(!b.name)throw new Error('Checklist name is required');Object.assign(d.checklists[i],{name:b.name,items:b.items||[],updated_at:now});demoSave(d);return{ok:true};}
    if(m==='DELETE'){d.checklists.splice(i,1);d.inspections=d.inspections.filter(r=>r.checklist_id!==id);demoSave(d);return{ok:true};}}
  if(x=path.match(/^\/checklists\/(\d+)\/inspections$/)){const id=+x[1],c=d.checklists.find(c=>c.id===id);if(!c)throw new Error('Not found');
    if(m==='GET')return d.inspections.filter(r=>r.checklist_id===id).sort((p,q)=>q.created_at.localeCompare(p.created_at));
    const r={id:nid(),checklist_id:id,equipment_id:c.equipment_id,checklist_name:c.name,performed_by:b.performed_by,date:b.date,meter:b.meter===''||b.meter==null?null:+b.meter,results:b.results,pass_count:b.results.filter(r=>r.result==='pass').length,fail_count:b.results.filter(r=>r.result==='fail').length,notes:b.notes||null,created_at:now};
    d.inspections.push(r);demoSave(d);return{id:r.id};}
  if(x=path.match(/^\/inspections\/(\d+)$/)){d.inspections=d.inspections.filter(r=>r.id!==+x[1]);demoSave(d);return{ok:true};}
  if(path.match(/^\/equipment\/(\d+)\/docs$/))return[];
  if(path==='/equipment'&&m==='GET')return d.equipment.map(e=>({...e,photo:undefined,photo_src:e.photo,has_photo:!!e.photo,last_service:lastSvc(e.id),note_count:d.notes.filter(n=>n.equipment_id===e.id).length,low_parts:d.parts.filter(p=>p.equipment_id===e.id&&low(p)).length})).sort((p,q)=>p.is_example-q.is_example||p.name.localeCompare(q.name));
  if(path==='/equipment'&&m==='POST'){if(!b.name)throw new Error('Name is required');const e=num({...clean(b),id:nid(),is_example:0,created_at:now,updated_at:now},['meter','year']);d.equipment.push(e);demoSave(d);return{id:e.id};}
  if(x=path.match(/^\/equipment\/(\d+)$/)){const id=+x[1],i=d.equipment.findIndex(e=>e.id===id);if(i<0)throw new Error('Not found');
    if(m==='GET')return{...d.equipment[i],last_service:lastSvc(id)};
    if(m==='PUT'){if(!b.name)throw new Error('Name is required');d.equipment[i]=num({...d.equipment[i],...clean(b),id,updated_at:now},['meter','year']);demoSave(d);return{ok:true};}
    if(m==='DELETE'){d.equipment.splice(i,1);['notes','service','parts','checklists','inspections'].forEach(k=>d[k]=(d[k]||[]).filter(r=>r.equipment_id!==id));demoSave(d);return{ok:true};}}
  if(x=path.match(/^\/equipment\/(\d+)\/photo$/)){const e=d.equipment.find(e=>e.id===+x[1]);e.photo=b.photo||null;e.updated_at=now;demoSave(d);return{ok:true};}
  if(x=path.match(/^\/equipment\/(\d+)\/(notes|service|parts)$/)){const id=+x[1],k=x[2];
    if(m==='GET'){if(k==='notes')return d.notes.filter(n=>n.equipment_id===id).sort((p,q)=>q.created_at.localeCompare(p.created_at));
      if(k==='service')return d.service.filter(n=>n.equipment_id===id).sort((p,q)=>q.date.localeCompare(p.date)||q.id-p.id);
      return d.parts.filter(n=>n.equipment_id===id).map(p=>({...p,photo:undefined,photo_src:p.photo,has_photo:!!p.photo})).sort((p,q)=>p.name.localeCompare(q.name));}
    if(k==='notes'){if(!b.author||!b.body)throw new Error('Name and note text required');d.notes.push({id:nid(),equipment_id:id,author:b.author,body:b.body,created_at:now});}
    if(k==='service'){if(!b.date||!b.work_done)throw new Error('Date and work done required');d.service.push(num({...clean(b),id:nid(),equipment_id:id,created_at:now},['meter','cost']));}
    if(k==='parts'){if(!b.name)throw new Error('Part name is required');d.parts.push(num({...clean(b),id:nid(),equipment_id:id,is_example:0,created_at:now,updated_at:now},['qty','reorder_level','price']));}
    demoSave(d);return{id:d.next-1};}
  if(path==='/loose'){if(m==='GET')return d.loose.map(p=>({...p,photo:undefined,photo_src:p.photo,has_photo:!!p.photo})).sort((p,q)=>p.is_example-q.is_example||p.name.localeCompare(q.name));
    if(!b.name)throw new Error('Part name is required');const p=num({...clean(b),id:nid(),is_example:0,created_at:now,updated_at:now},['qty','reorder_level']);d.loose.push(p);demoSave(d);return{id:p.id};}
  if(x=path.match(/^\/loose\/(\d+)(\/qty)?$/)){const id=+x[1],i=d.loose.findIndex(p=>p.id===id);if(i<0)throw new Error('Not found');const p=d.loose[i];
    if(x[2]){p.qty=Math.max(0,(Number(p.qty)||0)+(Number(b.delta)||0));p.updated_at=now;demoSave(d);return{qty:p.qty};}
    if(m==='GET')return p;
    if(m==='PUT'){if(!b.name)throw new Error('Part name is required');d.loose[i]=num({...p,...clean(b),id,updated_at:now},['qty','reorder_level']);demoSave(d);return{ok:true};}
    if(m==='DELETE'){d.loose.splice(i,1);demoSave(d);return{ok:true};}}
  if(path==='/parts'&&m==='GET')return d.parts.map(p=>{const e=d.equipment.find(e=>e.id===p.equipment_id)||{};return{...p,photo:undefined,equipment_name:e.name,equipment_unit:e.unit};}).sort((p,q)=>p.name.localeCompare(q.name));
  if(x=path.match(/^\/parts\/(\d+)$/)){const id=+x[1],i=d.parts.findIndex(p=>p.id===id);if(i<0)throw new Error('Not found');
    if(m==='GET')return d.parts[i];
    if(m==='PUT'){if(!b.name)throw new Error('Part name is required');d.parts[i]=num({...d.parts[i],...clean(b),id,updated_at:now},['qty','reorder_level','price']);demoSave(d);return{ok:true};}
    if(m==='DELETE'){d.parts.splice(i,1);demoSave(d);return{ok:true};}}
  throw new Error('Not available in demo');
}
function demoBanner(){let bn=$('#demobar');if(!isDemo()){if(bn)bn.remove();return;}
  if(!bn){bn=document.createElement('div');bn.id='demobar';$('#top').after(bn);}
  bn.innerHTML=`<span>DEMO MODE · ${LS.persistent?'saved on this device only':'changes not saved (preview mode)'}</span><button id="dreset">Reset demo</button>${window.FF_STANDALONE?'':'<button id="dexit">Exit</button>'}`;
  $('#dreset').onclick=resetDemo;if($('#dexit'))$('#dexit').onclick=exitDemo;}
function resetDemo(){modal(`<h2>Reset demo?</h2><p>All demo changes on this device will be erased and the EXAMPLE data restored.</p><div class="row" style="margin-top:12px"><button class="btn" id="x">Cancel</button><button class="btn danger" id="y">Reset Demo</button></div>`);
  $('#x').onclick=close;$('#y').onclick=async()=>{await demoReset();close();toast('Demo reset');location.hash='';route();};}
function exitDemo(){LS.removeItem('ff_demo');close();demoBanner();location.hash='';route();}
async function startDemo(){LS.ff_demo='1';if(!store.name)store.name='Demo User';await demoDb();route();}

async function api(path,opt={}){
  if(isDemo())return demoApi(path,opt);
  const h={'Content-Type':'application/json','x-access-code':store.code||''};
  if(opt.admin)h['x-admin-code']=opt.admin;
  const r=await fetch('/api'+path,{method:opt.method||'GET',headers:h,body:opt.body?JSON.stringify(opt.body):undefined});
  const offline=r.status===503; $('#offline').hidden=!offline;
  const j=await r.json().catch(()=>({}));
  if(r.status===401){store.code='';route();throw new Error('Access code needed');}
  if(!r.ok)throw new Error(offline?'You are offline – changes need a connection':(j.error||'Error'));
  return j;
}
const WM='<span class="wm"><span class="wm-mark">▰</span>FLEET<span class="wm-y">FILES</span></span>';
function header(title,back){const t=$('#title');if(title==='Fleet Files')t.innerHTML=WM;else t.textContent=title;$('#back').hidden=!back;}
$('#back').onclick=()=>history.length>1?history.back():(location.hash='');
$('#menu').onclick=settings;
window.addEventListener('hashchange',route);

function login(){
  header('Fleet Files');document.body.classList.add('login-bg');$('#menu').hidden=true;
  app.innerHTML=`<div class="login"><div class="login-wm">FLEET<span class="wm-y">FILES</span></div><div class="login-tag">Shop equipment · Service · Parts</div>
  <p class="mini">Enter the company access code and your name. Your name is shown on notes you leave.</p>
  <label for="c">Company access code</label><input id="c" autocomplete="off" autocapitalize="off">
  <label for="n">Your name</label><input id="n" value="${esc(store.name)}" autocomplete="name">
  <div class="err" id="e"></div><button class="btn primary block" id="go" style="margin-top:6px">Open Fleet Files</button>
  <button class="btn block demo-btn" id="demo" style="margin-top:12px">▶ Try Demo</button><div class="mini" style="margin-top:6px">Demo uses example data only and saves nothing to the company database.</div></div>`;
  $('#demo').onclick=startDemo;
  $('#go').onclick=async()=>{const c=$('#c').value.trim(),n=$('#n').value.trim();
    if(!c||!n)return $('#e').textContent='Please fill in both boxes.';
    const r=await fetch('/api/check',{headers:{'x-access-code':c}}).catch(()=>null);
    if(!r||!r.ok)return $('#e').textContent=r?'That access code is not right.':'No connection.';
    store.code=c;store.name=n;$('#menu').hidden=false;route();};
}

function route(){
  demoBanner();
  if(isDemo()&&!store.name)store.name='Demo User';
  if(!isDemo()&&(!store.code||!store.name))return login();
  $('#menu').hidden=false;document.body.classList.remove('login-bg');
  const m=location.hash.match(/^#\/eq\/(\d+)/);
  m?detail(+m[1]):location.hash==='#/parts'?partsPage():list();
}

let cache=[];
async function list(){
  header('Fleet Files',false);
  app.innerHTML=SEG('eq')+`<input class="search" id="q" type="search" placeholder="🔍  Search name, unit #, make, VIN…" value="${esc(state.q)}">
   <div class="chips" id="tc"></div><div class="chips" id="sc"></div><div id="list"><div class="empty">Loading…</div></div>
   <button class="btn primary fab" id="add">＋ Add Equipment</button>`;
  const chips=(el,arr,key)=>{el.innerHTML=['all',...arr].map(v=>`<button class="chip ${state[key]===v?'on':''}" data-v="${esc(v)}">${v==='all'?(key==='type'?'All types':'All status'):esc(v)}</button>`).join('')+editChip(key);
    el.onclick=e=>{if(e.target.closest('[data-edit]'))return listEditor(key,list);const b=e.target.closest('.chip');if(!b)return;state[key]=b.dataset.v;chips(el,LISTS[key],key);draw();};};
  await loadLists();if(!$('#tc'))return;chips($('#tc'),LISTS.type,'type');if(state.status!=='all'&&!LISTS.status.includes(state.status))state.status='all';chips($('#sc'),LISTS.status,'status');
  let qt;$('#q').oninput=e=>{state.q=e.target.value;clearTimeout(qt);qt=setTimeout(draw,150);};
  $('#add').onclick=()=>editForm();
  try{cache=await api('/equipment');}catch(e){$('#list').innerHTML=`<div class="empty">${esc(e.message)}</div>`;return;}
  draw();
}
function draw(){
  if(!$('#list'))return;
  const q=state.q.toLowerCase();
  const rows=cache.filter(e=>(state.type==='all'||e.type===state.type)&&(state.status==='all'||e.status===state.status)&&
    (!q||[e.name,e.unit,e.make,e.model,e.vin,e.location,e.type].join(' ').toLowerCase().includes(q)));
  $('#list').innerHTML=rows.length?`<div class="mini">${rows.length} of ${cache.length} units</div>`+rows.map(e=>`
   <button class="card s-${sc(e.status)}" onclick="location.hash='#/eq/${e.id}'">
    <div class="thumb"><img loading="lazy" src="${e.photo_src?e.photo_src:e.has_photo?`/api/equipment/${e.id}/photo?code=${encodeURIComponent(store.code)}&v=${encodeURIComponent(e.updated_at)}`:typeImg(e.type)}" alt="" onerror="this.src='${typeImg(e.type)}'"></div>
    <div class="main"><div class="name">${esc(e.name)}</div>
     <div class="sub">${esc([e.unit&&('#'+e.unit),e.year,e.make,e.model].filter(Boolean).join(' · '))}</div>
     <div class="sub"><span class="badge b-${sc(e.status)}">${esc(e.status)}</span>${e.is_example?'<span class="badge b-ex">Example</span>':''}${e.low_parts?`<span class="badge b-low">${e.low_parts} low part${e.low_parts>1?'s':''}</span>`:''}</div>
     <div class="sub">🔧 Last service: ${fmtDate(e.last_service)}</div></div></button>`).join('')
   :`<div class="empty">${cache.length?'No equipment matches.':'No equipment yet. Tap “Add Equipment”.'}</div>`;
}

async function detail(id){
  header('Equipment',true);app.innerHTML='<div class="empty">Loading…</div>';
  let e;try{e=await api('/equipment/'+id);}catch(err){app.innerHTML=`<div class="empty">${esc(err.message)}</div>`;return;}
  await loadLists();
  header(e.unit?'#'+e.unit:'Equipment',true);
  const kv=(k,v)=>`<div class="kv"><b>${k}</b><span>${esc(v??'—')||'—'}</span></div>`;
  app.innerHTML=`<button class="hero-wrap" id="heroBtn" aria-label="Change photo"><img class="hero" src="${e.photo||typeImg(e.type)}" alt=""><span class="hero-cta">📷 ${e.photo?'Change Photo':'Add Photo'}</span>${e.photo?'':'<span class="hero-def">Stock photo – tap to add this unit’s photo</span>'}</button>
   ${e.is_example?'<div class="item" style="border:2px solid #5b4bd6"><b>EXAMPLE item.</b> Delete it once you add your real equipment (Edit → Delete).</div>':''}
   <h2 style="margin:4px 0">${esc(e.name)}</h2>
   <div style="margin-bottom:10px"><span class="badge b-${sc(e.status)}">${esc(e.status)}</span> <span class="mini">· Last service ${fmtDate(e.last_service)}</span></div>
   <div class="row strow" style="margin-bottom:10px">${LISTS.status.map(s=>`<button class="btn ${e.status===s?'primary':''}" data-s="${esc(s)}" style="padding:0 6px;font-size:14px">${esc(s)}</button>`).join('')}</div>
   <div class="grid">${kv('Type',e.type)}${kv('Unit / ID',e.unit)}${kv('Make',e.make)}${kv('Model',e.model)}${kv('Year',e.year)}${kv(e.meter_unit==='miles'?'Mileage':'Hours',e.meter!=null?Number(e.meter).toLocaleString()+' '+(e.meter_unit||''):null)}${kv('VIN / Serial',e.vin)}${kv('Location',e.location)}</div>
   <button class="btn block" id="edit" style="margin-top:10px">✎ Edit Details</button>
   <div class="tabs">${['notes','service','parts','procedures'].map(t=>`<button class="tab ${state.tab===t?'on':''}" data-t="${t}">${t==='parts'?'Parts':t==='service'?'Service':t==='procedures'?'Procedures':'Notes'}</button>`).join('')}</div>
   <div id="tabbody"></div>`;
  app.querySelectorAll('[data-s]').forEach(b=>b.onclick=async()=>{try{await api('/equipment/'+id,{method:'PUT',body:{...e,status:b.dataset.s}});toast('Status: '+b.dataset.s);detail(id);}catch(x){toast(x.message);}});
  $('#edit').onclick=()=>editForm(e);
  $('#heroBtn').onclick=()=>photoSheet(e);
  app.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{state.tab=b.dataset.t;app.querySelectorAll('.tab').forEach(x=>x.classList.toggle('on',x===b));tab(e);});
  tab(e);
}
async function tab(e){
  const tb=$('#tabbody');
  if(state.tab==='parts')return partsTab(e);
  if(state.tab==='procedures')return procTab(e);
  if(state.tab==='notes'){
    tb.innerHTML=`<textarea id="nb" placeholder="Write a note about this unit…"></textarea><div class="mini" style="margin:4px 0 8px">Posting as <b>${esc(store.name)}</b></div>
     <button class="btn primary block" id="post">Post Note</button><div id="nl"><div class="empty">Loading…</div></div>`;
    $('#post').onclick=async()=>{const body=$('#nb').value.trim();if(!body)return toast('Type a note first');
      try{await api(`/equipment/${e.id}/notes`,{method:'POST',body:{author:store.name,body}});toast('Note posted');tab(e);}catch(x){toast(x.message);}};
    const ns=await api(`/equipment/${e.id}/notes`).catch(()=>[]);
    $('#nl').innerHTML=ns.length?ns.map(n=>`<div class="item"><div class="meta"><b>${esc(n.author)}</b><span>${fmtTime(n.created_at)}</span></div><div class="body">${esc(n.body)}</div></div>`).join(''):'<div class="empty">No notes yet.</div>';
    return;}
  tb.innerHTML=`<button class="btn primary block" id="addsvc">＋ Add Service Record</button><div id="sl"><div class="empty">Loading…</div></div>`;
  $('#addsvc').onclick=()=>serviceForm(e);
  const ss=await api(`/equipment/${e.id}/service`).catch(()=>[]);
  $('#sl').innerHTML=ss.length?ss.map(s=>`<div class="item"><div class="meta"><b>${fmtDate(s.date)}</b><span>${s.meter!=null?Number(s.meter).toLocaleString()+' '+(e.meter_unit||''):''}</span></div>
    <div class="body"><b>${esc(s.work_done)}</b></div>${s.parts_used?`<div class="mini">Parts: ${esc(s.parts_used)}</div>`:''}
    <div class="mini">${s.performed_by?'By '+esc(s.performed_by):''}${s.cost!=null?' · $'+Number(s.cost).toFixed(2):''}</div></div>`).join(''):'<div class="empty">No service records yet.</div>';
}

function modal(html){const m=$('#modal');m.innerHTML=`<div class="sheet">${html}</div>`;m.hidden=false;m.onclick=ev=>{if(ev.target===m)close();};return m;}
function close(){$('#modal').hidden=true;$('#modal').innerHTML='';}

function serviceForm(e){
  const today=new Date().toLocaleDateString('en-CA');
  modal(`<h2>Add Service Record</h2><div class="mini">${esc(e.name)}</div>
   <label>Date</label><input id="d" type="date" value="${today}">
   <label>${e.meter_unit==='miles'?'Mileage':'Hours'} at service</label><input id="m" type="number" inputmode="decimal" value="${e.meter??''}">
   <label>Work done</label><textarea id="w" placeholder="e.g. Oil change, replaced fuel filter"></textarea>
   <label>Parts used</label><input id="p" placeholder="e.g. 2x fuel filter, 15 qt oil">
   <label>Cost ($)</label><input id="c" type="number" inputmode="decimal" step="0.01">
   <label>Done by</label><input id="b" value="${esc(store.name)}">
   <div class="row" style="margin-top:16px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Save</button></div>`);
  $('#x').onclick=close;
  $('#s').onclick=async()=>{const body={date:$('#d').value,meter:$('#m').value,work_done:$('#w').value.trim(),parts_used:$('#p').value.trim(),cost:$('#c').value,performed_by:$('#b').value.trim()};
    if(!body.work_done)return toast('Describe the work done');
    try{await api(`/equipment/${e.id}/service`,{method:'POST',body});close();toast('Service saved');state.tab='service';detail(e.id);}catch(x){toast(x.message);}};
}

function shrink(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,1280/Math.max(i.width,i.height));const c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',0.72));};i.onerror=rej;i.src=r.result;};r.readAsDataURL(file);});}

function editForm(e){
  const isNew=!e;e=e||{status:LISTS.status[0]||'in service',type:'truck',meter_unit:'hours'};
  const opt=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('');
  let photo=e.photo||null;
  modal(`<h2>${isNew?'Add Equipment':'Edit Equipment'}</h2>
   <label>Name *</label><input id="f_name" value="${esc(e.name)}" placeholder="e.g. Blue Service Truck">
   <div class="row"><div><label>Unit / ID #</label><input id="f_unit" value="${esc(e.unit)}"></div>${pickField('f_type','Type','type',e.type)}</div>
   ${pickField('f_status','Status','status',e.status)}
   <div class="row"><div><label>Make</label><input id="f_make" value="${esc(e.make)}"></div><div><label>Model</label><input id="f_model" value="${esc(e.model)}"></div></div>
   <div class="row"><div><label>Year</label><input id="f_year" type="number" inputmode="numeric" value="${esc(e.year)}"></div><div><label>VIN / Serial</label><input id="f_vin" value="${esc(e.vin)}" autocapitalize="characters"></div></div>
   <div class="row"><div><label>Hours / Miles</label><input id="f_meter" type="number" inputmode="decimal" value="${esc(e.meter)}"></div><div><label>Unit</label><select id="f_meter_unit">${opt(['hours','miles'],e.meter_unit)}</select></div></div>
   <label>Location</label><input id="f_location" value="${esc(e.location)}" placeholder="e.g. Shop bay 1">
   <label>Photo</label><img id="pv" class="hero" style="max-height:160px;${photo?'':'display:none'}" src="${photo||''}">
   <div class="row"><label class="btn" style="margin:0;color:var(--text)">📷 ${photo?'Change':'Add'} Photo<input id="f_photo" type="file" accept="image/*" hidden></label>
   <button class="btn" id="rmp" ${photo?'':'hidden'}>Remove</button></div>
   <div class="row" style="margin-top:18px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Save</button></div>
   ${isNew?'':'<button class="btn danger block" id="del" style="margin-top:22px">🗑 Delete Equipment</button><div class="mini" style="text-align:center;margin-top:6px">Requires the admin code</div>'}`);
  $('#f_photo').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{photo=await shrink(f);$('#pv').src=photo;$('#pv').style.display='';$('#rmp').hidden=false;}catch{toast('Could not read photo');}};
  $('#rmp').onclick=()=>{photo=null;$('#pv').style.display='none';$('#rmp').hidden=true;};
  $('#x').onclick=close;
  $('#s').onclick=async()=>{const b={};['name','unit','make','model','year','vin','meter','meter_unit','location'].forEach(k=>b[k]=$('#f_'+k).value.trim());b.type=pickVal('f_type');b.status=pickVal('f_status')||LISTS.status[0];b.photo=photo;
    if(!b.name)return toast('Name is required');
    try{if(isNew){const r=await api('/equipment',{method:'POST',body:b});close();toast('Equipment added');location.hash='#/eq/'+r.id;}
      else{await api('/equipment/'+e.id,{method:'PUT',body:b});close();toast('Saved');detail(e.id);}}catch(x){toast(x.message);}};
  if(!isNew)$('#del').onclick=()=>confirmDelete(e);
}
function confirmDelete(e){
  modal(`<h2>Delete “${esc(e.name)}”?</h2><p>This permanently removes the equipment and all of its notes and service records. This cannot be undone.</p>
   <label>Admin code${isDemo()?' (demo: type anything)':''}</label><input id="ac" type="password" autocomplete="off" value="${esc(SS.ff_admin||'')}">
   <div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="btn" id="x">Cancel</button><button class="btn danger" id="y">Delete</button></div>`);
  $('#x').onclick=close;
  $('#y').onclick=async()=>{const a=$('#ac').value.trim();if(!a)return $('#er').textContent='Enter the admin code.';
    try{await api('/equipment/'+e.id,{method:'DELETE',admin:a});SS.ff_admin=a;close();toast('Deleted');location.hash='';list();}catch(x){$('#er').textContent=x.message==='Admin code required'?'Wrong admin code.':x.message;}};
}
function settings(){
  modal(`<h2>Settings</h2><label>Your name (shown on notes)</label><input id="nm" value="${esc(store.name)}">
   <button class="btn primary block" id="sv" style="margin-top:12px">Save Name</button>
   <button class="btn block" id="lo" style="margin-top:10px">Sign Out</button>
   <button class="btn block" id="cr" style="margin-top:10px">Photo Credits</button><p class="mini" style="margin-top:16px">Fleet Files v1 · Install: iPhone Safari → Share → Add to Home Screen. Android Chrome → ⋮ → Install app.</p>
   <button class="btn block" id="x" style="margin-top:6px">Close</button>`);
  $('#sv').onclick=()=>{const n=$('#nm').value.trim();if(n){store.name=n;toast('Name saved');close();}};
  $('#cr').onclick=credits;
  if(isDemo()){$('#lo').textContent=window.FF_STANDALONE?'Reset Demo':'Exit Demo';$('#lo').onclick=()=>window.FF_STANDALONE?resetDemo():exitDemo();}else
  $('#lo').onclick=()=>{LS.removeItem('ff_code');close();route();};
  $('#x').onclick=close;
}

// ---------- Equipment photo sheet ----------
function photoSheet(e){
  modal(`<h2>Equipment Photo</h2><div class="mini">${esc(e.name)}</div>
   <img class="hero" style="margin-top:10px;max-height:200px" src="${e.photo||typeImg(e.type)}" alt="">
   <label class="btn primary block" style="margin:10px 0 0;color:#111">📷 Take or Choose Photo<input id="ph" type="file" accept="image/*" hidden></label>
   <div class="mini" style="text-align:center;margin:6px 0">On iPhone you can take a new photo or pick one from your library.</div>
   ${e.photo?'<button class="btn block" id="rm">Remove Photo (use stock photo)</button>':''}
   <button class="btn block" id="x" style="margin-top:10px">Cancel</button>`);
  $('#x').onclick=close;
  $('#ph').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{const photo=await shrink(f);await api(`/equipment/${e.id}/photo`,{method:'PUT',body:{photo}});close();toast('Photo updated');detail(e.id);}catch(x){toast(x.message||'Could not read photo');}};
  if(e.photo)$('#rm').onclick=async()=>{try{await api(`/equipment/${e.id}/photo`,{method:'PUT',body:{photo:null}});close();toast('Photo removed');detail(e.id);}catch(x){toast(x.message);}};
}

// ---------- Parts ----------
const money=v=>v==null||v===''?'':'$'+Number(v).toFixed(2);
const isLow=p=>p.qty!=null&&p.reorder_level!=null&&Number(p.qty)<=Number(p.reorder_level);
async function partsTab(e){
  const tb=$('#tabbody');
  tb.innerHTML=`<button class="btn primary block" id="addp">＋ Add Part</button>
   <input id="pq" type="search" placeholder="🔍  Search parts, part #, brand, bin…" style="margin-top:10px" value="${esc(state.pq||'')}">
   <div id="pl"><div class="empty">Loading…</div></div>`;
  $('#addp').onclick=()=>partForm(e);
  let parts=await api(`/equipment/${e.id}/parts`).catch(()=>[]);
  const drawP=()=>{const q=(state.pq||'').toLowerCase();
    const rows=parts.filter(p=>!q||[p.name,p.part_number,p.manufacturer,p.bin,p.supplier,p.notes].join(' ').toLowerCase().includes(q));
    const low=parts.filter(isLow).length;
    $('#pl').innerHTML=(low?`<div class="lowbar">⚠ ${low} part${low>1?'s':''} at or below reorder level</div>`:'')+
     (rows.length?rows.map(p=>`<button class="pcard ${isLow(p)?'low':''}" data-id="${p.id}">
       <div class="thumb">${p.photo_src?`<img src="${p.photo_src}" alt="">`:p.has_photo?`<img loading="lazy" src="/api/parts/${p.id}/photo?code=${encodeURIComponent(store.code)}&v=${encodeURIComponent(p.updated_at)}" alt="">`:'🔩'}</div>
       <div class="main"><div class="name">${esc(p.name)}</div>
        <div class="sub">${esc([p.part_number&&('#'+p.part_number),p.manufacturer].filter(Boolean).join(' · '))}</div>
        <div class="sub">${p.bin?'📍 '+esc(p.bin):''} ${p.price!=null?' · '+money(p.price):''}</div></div>
       <div class="qty"><b>${p.qty??'–'}</b><span>on hand</span>${isLow(p)?'<em>LOW</em>':''}</div></button>`).join('')
     :`<div class="empty">${parts.length?'No parts match.':'No parts yet. Tap “Add Part”.'}</div>`);
    $('#pl').querySelectorAll('.pcard').forEach(b=>b.onclick=()=>partView(e,+b.dataset.id));};
  $('#pq').oninput=ev=>{state.pq=ev.target.value;drawP();};
  drawP();
  if(state.hl){const el=$(`#pl .pcard[data-id="${state.hl}"]`);state.hl=null;if(el){el.classList.add('hl');el.scrollIntoView({block:'center'});setTimeout(()=>el.classList.remove('hl'),2600);}}
}
async function partView(e,id){
  let p;try{p=await api('/parts/'+id);}catch(x){return toast(x.message);}
  const kv=(k,v)=>v==null||v===''?'':`<div class="kv"><b>${k}</b><span>${v}</span></div>`;
  modal(`${p.photo?`<img class="hero" src="${p.photo}" alt="" style="max-height:220px">`:''}
   <h2>${esc(p.name)}</h2>${isLow(p)?'<div class="lowbar">⚠ Low stock – at or below reorder level</div>':''}
   <div class="grid" style="margin-top:8px">${kv('Part #',esc(p.part_number))}${kv('Brand',esc(p.manufacturer))}${kv('On hand',esc(p.qty))}${kv('Reorder at',esc(p.reorder_level))}${kv('Location / bin',esc(p.bin))}${kv('Supplier',esc(p.supplier))}${kv('Price',money(p.price))}</div>
   ${p.url?`<a class="btn block" style="margin-top:10px;text-decoration:none" href="${esc(p.url)}" target="_blank" rel="noopener">🔗 Open Supplier Link</a>`:''}
   ${p.notes?`<div class="item"><div class="body">${esc(p.notes)}</div></div>`:''}
   <div class="row" style="margin-top:12px"><button class="btn" id="x">Close</button><button class="btn primary" id="ed">✎ Edit</button></div>`);
  $('#x').onclick=close;$('#ed').onclick=()=>partForm(e,p);
}
function partForm(e,p){
  const isNew=!p;p=p||{};let photo=p.photo||null;
  const f=(id,lab,type='text',extra='')=>`<div><label for="p_${id}">${lab}</label><input id="p_${id}" type="${type}" ${extra} value="${esc(p[id])}"></div>`;
  modal(`<h2>${isNew?'Add Part':'Edit Part'}</h2><div class="mini">${esc(e.name)}</div>
   ${f('name','Part name *','text','placeholder="e.g. Oil filter"')}
   <div class="row">${f('part_number','Part #')}${f('manufacturer','Brand / Mfr')}</div>
   <div class="row">${f('qty','Qty on hand','number','inputmode="decimal"')}${f('reorder_level','Reorder at','number','inputmode="decimal"')}</div>
   <div class="row">${f('bin','Location / bin')}${f('price','Price ($)','number','inputmode="decimal" step="0.01"')}</div>
   ${f('supplier','Supplier')}
   ${f('url','Supplier link (optional)','url','placeholder="https://…" autocapitalize="off"')}
   <label for="p_notes">Notes</label><textarea id="p_notes">${esc(p.notes)}</textarea>
   <label>Photo (optional)</label><img id="ppv" class="hero" style="max-height:160px;${photo?'':'display:none'}" src="${photo||''}">
   <div class="row"><label class="btn" style="margin:0;color:var(--text)">📷 ${photo?'Change':'Add'} Photo<input id="p_photo" type="file" accept="image/*" hidden></label><button class="btn" id="prm" ${photo?'':'hidden'}>Remove</button></div>
   <div class="row" style="margin-top:18px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Save Part</button></div>
   ${isNew?'':'<button class="btn danger block" id="del" style="margin-top:22px">🗑 Delete Part</button>'}`);
  $('#p_photo').onchange=async ev=>{const fl=ev.target.files[0];if(!fl)return;try{photo=await shrink(fl);$('#ppv').src=photo;$('#ppv').style.display='';$('#prm').hidden=false;}catch{toast('Could not read photo');}};
  $('#prm').onclick=()=>{photo=null;$('#ppv').style.display='none';$('#prm').hidden=true;};
  $('#x').onclick=close;
  $('#s').onclick=async()=>{const b={photo};['name','part_number','manufacturer','qty','reorder_level','bin','price','supplier','url','notes'].forEach(k=>b[k]=$('#p_'+k).value.trim());
    if(!b.name)return toast('Part name is required');
    if(b.url&&!/^https?:\/\//i.test(b.url))b.url='https://'+b.url;
    try{if(isNew)await api(`/equipment/${e.id}/parts`,{method:'POST',body:b});else await api('/parts/'+p.id,{method:'PUT',body:b});close();toast(isNew?'Part added':'Part saved');state.tab='parts';tab(e);}catch(x){toast(x.message);}};
  if(!isNew)$('#del').onclick=()=>{
    modal(`<h2>Delete “${esc(p.name)}”?</h2><p>This removes the part from ${esc(e.name)}. This cannot be undone.</p>
     <div class="row" style="margin-top:12px"><button class="btn" id="x">Cancel</button><button class="btn danger" id="y">Delete Part</button></div>`);
    $('#x').onclick=close;
    $('#y').onclick=async()=>{try{await api('/parts/'+p.id,{method:'DELETE'});close();toast('Part deleted');tab(e);}catch(x){toast(x.message);}};};
}
// ---------- Procedures: inspection checklists + manuals ----------
const fmtSize=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
const docIcon=d=>/pdf/.test(d.mime||'')?'📕':/^image\//.test(d.mime||'')?'🖼':'📄';
const docUrl=d=>`/api/docs/${d.id}/file?code=${encodeURIComponent(store.code||'')}`;
function adminConfirm(title,text,btn,fn){
  modal(`<h2>${title}</h2><p>${text}</p>
   <label>Admin code${isDemo()?' (demo: type anything)':''}</label><input id="ac" type="password" autocomplete="off" value="${esc(SS.ff_admin||'')}">
   <div class="err" id="er"></div><div class="row" style="margin-top:12px"><button class="btn" id="x">Cancel</button><button class="btn danger" id="y">${btn}</button></div>`);
  $('#x').onclick=close;
  $('#y').onclick=async()=>{const a=$('#ac').value.trim();if(!a)return $('#er').textContent='Enter the admin code.';
    try{await fn(a);SS.ff_admin=a;}catch(x){$('#er').textContent=x.message==='Admin code required'?'Wrong admin code.':x.message;}};
}
async function procTab(e){
  const tb=$('#tabbody');
  tb.innerHTML=`<div class="sec-h">✅ Inspection Checklists</div>
   <div id="cl"><div class="empty">Loading…</div></div>
   <button class="btn primary block" id="addc">＋ New Checklist</button>
   <div class="sec-h" style="margin-top:26px">📘 Manuals &amp; Documents</div>
   <div id="dl"><div class="empty">Loading…</div></div>
   ${isDemo()?'<div class="item mini">Uploading manuals is turned off in the demo. In the real app, tap “Upload Manual” to add a PDF or photo (up to 25 MB).</div>':
   '<label class="btn primary block" id="upl" style="color:#111">⬆ Upload Manual / Document<input id="docf" type="file" accept=".pdf,image/*,.doc,.docx,.xls,.xlsx,.txt,.csv,.ppt,.pptx" hidden></label>'}`;
  $('#addc').onclick=()=>checklistForm(e);
  if($('#docf'))$('#docf').onchange=ev=>{const f=ev.target.files[0];ev.target.value='';if(f)uploadForm(e,f);};
  const [cs,ds]=await Promise.all([api(`/equipment/${e.id}/checklists`).catch(()=>[]),api(`/equipment/${e.id}/docs`).catch(()=>[])]);
  $('#cl').innerHTML=cs.length?cs.map(c=>`<button class="pcard ck" data-id="${c.id}"><div class="thumb">📋</div><div class="main"><div class="name">${esc(c.name)}</div>
    <div class="sub">${c.items.length} item${c.items.length===1?'':'s'} · ${c.last_done?'Last done '+fmtDate(c.last_done):'Not done yet'}</div></div><div class="chev">›</div></button>`).join('')
    :'<div class="empty">No checklists yet. Tap “New Checklist”.</div>';
  $('#cl').querySelectorAll('.ck').forEach(b=>b.onclick=()=>checklistView(e,cs.find(c=>c.id===+b.dataset.id)));
  $('#dl').innerHTML=ds.length?ds.map(d=>`<button class="pcard dc" data-id="${d.id}"><div class="thumb">${docIcon(d)}</div><div class="main"><div class="name">${esc(d.title)}</div>
    <div class="sub">${esc(d.filename||'')} · ${fmtSize(d.size||0)}</div><div class="sub">Added ${fmtDate(d.created_at)}${d.uploaded_by?' by '+esc(d.uploaded_by):''}</div></div><div class="chev">›</div></button>`).join('')
    :(isDemo()?'':'<div class="empty">No manuals yet.</div>');
  $('#dl').querySelectorAll('.dc').forEach(b=>b.onclick=()=>docSheet(e,ds.find(d=>d.id===+b.dataset.id)));
}
function backToProc(e){close();state.tab='procedures';tab(e);}
async function checklistView(e,c){
  modal(`<h2>${esc(c.name)}</h2><div class="mini">${esc(e.name)} · ${c.items.length} items</div>
   <button class="btn primary block" id="run" style="margin-top:12px">▶ Start Inspection</button>
   <div class="row" style="margin-top:10px"><button class="btn" id="x">Close</button><button class="btn" id="ed">✎ Edit List</button></div>
   <div class="sec-h" style="margin-top:20px">Past Inspections</div><div id="hl"><div class="empty">Loading…</div></div>`);
  $('#x').onclick=close;$('#ed').onclick=()=>checklistForm(e,c);$('#run').onclick=()=>runInspection(e,c);
  const hs=await api(`/checklists/${c.id}/inspections`).catch(()=>[]);
  if(!$('#hl'))return;
  $('#hl').innerHTML=hs.length?hs.map(h=>`<button class="pcard hi ${h.fail_count?'low':'ok'}" data-id="${h.id}"><div class="main"><div class="name">${fmtDate(h.date)}</div>
    <div class="sub">By ${esc(h.performed_by||'—')} · ${fmtTime(h.created_at)}</div></div>
    <div class="qty">${h.fail_count?`<em>${h.fail_count} FAIL</em>`:'<b class="pass">✓</b><span>all pass</span>'}</div></button>`).join(''):'<div class="empty">No inspections yet.</div>';
  $('#hl').querySelectorAll('.hi').forEach(b=>b.onclick=()=>inspectionView(e,c,hs.find(h=>h.id===+b.dataset.id)));
}
function inspectionView(e,c,h){
  modal(`<h2>${esc(h.checklist_name||c.name)}</h2><div class="mini">${fmtDate(h.date)} · by <b>${esc(h.performed_by||'—')}</b>${h.meter!=null?' · '+Number(h.meter).toLocaleString()+' '+esc(e.meter_unit||''):''}</div>
   <div class="insp-sum ${h.fail_count?'bad':'good'}">${h.pass_count} pass · ${h.fail_count} fail</div>
   ${h.results.map(r=>`<div class="ires ${r.result}"><span class="pf">${r.result==='pass'?'✓ PASS':r.result==='fail'?'✗ FAIL':'– SKIP'}</span><div><div>${esc(r.item)}</div>${r.note?`<div class="mini">📝 ${esc(r.note)}</div>`:''}</div></div>`).join('')}
   ${h.notes?`<div class="item"><div class="body">${esc(h.notes)}</div></div>`:''}
   <button class="btn block" id="bk" style="margin-top:12px">‹ Back</button>
   <button class="linkbtn" id="del" style="margin-top:10px;width:100%">Delete this inspection record</button>`);
  $('#bk').onclick=()=>checklistView(e,c);
  $('#del').onclick=()=>adminConfirm('Delete inspection record?','This removes the inspection from '+fmtDate(h.date)+'. This cannot be undone.','Delete',async a=>{await api('/inspections/'+h.id,{method:'DELETE',admin:a});toast('Deleted');checklistView(e,c);});
}
function checklistForm(e,c){
  const isNew=!c;c=c||{name:'',items:[]};
  modal(`<h2>${isNew?'New Checklist':'Edit Checklist'}</h2><div class="mini">${esc(e.name)}</div>
   <label for="cn">Checklist name *</label><input id="cn" value="${esc(c.name)}" placeholder="e.g. Daily Pre-Op Inspection">
   <label for="ci">Items to check – one per line</label><textarea id="ci" rows="9" placeholder="Engine oil level OK&#10;Tires OK&#10;Lights work">${esc(c.items.join('\n'))}</textarea>
   <div class="mini">Each line becomes one Pass / Fail item.</div>
   <div class="row" style="margin-top:16px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Save</button></div>
   ${isNew?'':'<button class="btn danger block" id="del" style="margin-top:22px">🗑 Delete Checklist</button>'}`);
  $('#x').onclick=isNew?close:()=>checklistView(e,c);
  $('#s').onclick=async()=>{const name=$('#cn').value.trim(),items=$('#ci').value.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!name)return toast('Give the checklist a name');if(!items.length)return toast('Add at least one item');
    try{if(isNew)await api(`/equipment/${e.id}/checklists`,{method:'POST',body:{name,items}});else await api('/checklists/'+c.id,{method:'PUT',body:{name,items}});toast('Checklist saved');backToProc(e);}catch(x){toast(x.message);}};
  if(!isNew)$('#del').onclick=()=>adminConfirm(`Delete “${esc(c.name)}”?`,'This removes the checklist and all of its past inspection records. This cannot be undone.','Delete',async a=>{await api('/checklists/'+c.id,{method:'DELETE',admin:a});toast('Checklist deleted');backToProc(e);});
}
function runInspection(e,c){
  const res=c.items.map(item=>({item,result:null,note:''}));
  modal(`<h2>${esc(c.name)}</h2><div class="mini">${esc(e.name)} · Inspector <b>${esc(store.name)}</b></div>
   <div class="row" style="margin-top:6px"><div><label for="idt">Date</label><input id="idt" type="date" value="${new Date().toLocaleDateString('en-CA')}"></div>
    <div><label for="imt">${e.meter_unit==='miles'?'Mileage':'Hours'}</label><input id="imt" type="number" inputmode="decimal" value="${e.meter??''}"></div></div>
   <div class="iprog" id="ipg"></div>
   ${res.map((r,i)=>`<div class="icheck" id="ic${i}"><div class="itxt">${i+1}. ${esc(r.item)}</div>
     <div class="row"><button class="btn pfb" data-i="${i}" data-r="pass">✓ Pass</button><button class="btn pfb" data-i="${i}" data-r="fail">✗ Fail</button></div>
     <input class="inote" data-i="${i}" placeholder="Note (optional)"></div>`).join('')}
   <label for="ino">Overall notes (optional)</label><textarea id="ino"></textarea>
   <div class="row" style="margin-top:16px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Save Inspection</button></div>`);
  const prog=()=>{const n=res.filter(r=>r.result).length,f=res.filter(r=>r.result==='fail').length;$('#ipg').innerHTML=`<b>${n} of ${res.length}</b> checked${f?` · <span style="color:var(--red)">${f} fail</span>`:''}`;};prog();
  $('#modal').querySelectorAll('.pfb').forEach(b=>b.onclick=()=>{const i=+b.dataset.i;res[i].result=b.dataset.r;
    const box=$('#ic'+i);box.className='icheck '+b.dataset.r;box.querySelectorAll('.pfb').forEach(x=>x.classList.toggle('on',x===b));prog();});
  $('#modal').querySelectorAll('.inote').forEach(n=>n.oninput=()=>res[+n.dataset.i].note=n.value);
  $('#x').onclick=()=>checklistView(e,c);
  $('#s').onclick=async()=>{const miss=res.findIndex(r=>!r.result);
    if(miss>=0){toast('Mark every item Pass or Fail');$('#ic'+miss).scrollIntoView({behavior:'smooth',block:'center'});return;}
    try{await api(`/checklists/${c.id}/inspections`,{method:'POST',body:{performed_by:store.name,date:$('#idt').value,meter:$('#imt').value,notes:$('#ino').value.trim(),results:res}});
      toast('Inspection saved');checklistView(e,c);tab(e);}catch(x){toast(x.message);}};
}
function uploadForm(e,f){
  const MAX=25*1024*1024;
  if(f.size>MAX)return toast('That file is too big (max 25 MB)');
  modal(`<h2>Upload Document</h2><div class="mini">${esc(f.name)} · ${fmtSize(f.size)}</div>
   <label for="dt">Title *</label><input id="dt" value="${esc(f.name.replace(/\.[^.]+$/,''))}" placeholder="e.g. Operator's Manual">
   <div class="err" id="er"></div>
   <div class="row" style="margin-top:16px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Upload</button></div>`);
  $('#x').onclick=close;
  $('#s').onclick=async()=>{const title=$('#dt').value.trim();if(!title)return $('#er').textContent='Enter a title.';
    const s=$('#s');s.disabled=true;s.textContent='Uploading…';
    try{const q=new URLSearchParams({title,filename:f.name,type:f.type||'application/octet-stream',by:store.name});
      const r=await fetch(`/api/equipment/${e.id}/docs?`+q,{method:'POST',headers:{'x-access-code':store.code||'','Content-Type':'application/octet-stream'},body:f});
      const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(r.status===413?'File is too big (max 25 MB)':j.error||'Upload failed – check your connection');
      toast('Uploaded');backToProc(e);}catch(x){s.disabled=false;s.textContent='Upload';$('#er').textContent=x.message;}};
}
function docSheet(e,d){
  modal(`<div style="font-size:44px;text-align:center">${docIcon(d)}</div><h2 style="text-align:center">${esc(d.title)}</h2>
   <div class="mini" style="text-align:center">${esc(d.filename||'')} · ${fmtSize(d.size||0)} · ${fmtDate(d.created_at)}</div>
   <a class="btn primary block" id="op" style="margin-top:14px;text-decoration:none" href="${docUrl(d)}" target="_blank" rel="noopener">📖 Open</a>
   <button class="btn block" id="rn" style="margin-top:10px">✎ Rename</button>
   <button class="btn block" id="x" style="margin-top:10px">Close</button>
   <button class="btn danger block" id="del" style="margin-top:22px">🗑 Delete</button>`);
  $('#x').onclick=close;
  $('#rn').onclick=()=>{modal(`<h2>Rename</h2><label for="dt">Title</label><input id="dt" value="${esc(d.title)}"><div class="row" style="margin-top:16px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Save</button></div>`);
    $('#x').onclick=()=>docSheet(e,d);
    $('#s').onclick=async()=>{const title=$('#dt').value.trim();if(!title)return toast('Enter a title');try{await api('/docs/'+d.id,{method:'PUT',body:{title}});toast('Renamed');backToProc(e);}catch(x){toast(x.message);}};};
  $('#del').onclick=()=>adminConfirm(`Delete “${esc(d.title)}”?`,'This permanently removes the file. This cannot be undone.','Delete',async a=>{await api('/docs/'+d.id,{method:'DELETE',admin:a});toast('Deleted');backToProc(e);});
}
// ---------- Shop Parts page (loose parts not tied to a machine) ----------
const SEG=on=>`<div class="seg"><button class="${on==='eq'?'on':''}" onclick="location.hash=''">🚜 Equipment</button><button class="${on==='parts'?'on':''}" onclick="location.hash='#/parts'">🔩 Parts</button></div>`;
let loose=[],machParts=[];
async function partsPage(){
  header('Fleet Files',false);
  state.lq=state.lq||'';state.lcat=state.lcat||'all';state.lstock=state.lstock||'all';
  app.innerHTML=SEG('parts')+`<input class="search" id="lq" type="search" placeholder="🔍  Search any part, part #, brand, bin…" value="${esc(state.lq)}">
   <div class="chips" id="lc"></div><div class="chips" id="ls"></div><div id="list"><div class="empty">Loading…</div></div>
   <button class="btn primary fab" id="add">＋ Add Part</button>`;
  $('#add').onclick=()=>looseForm();
  let qt;$('#lq').oninput=e=>{state.lq=e.target.value;clearTimeout(qt);qt=setTimeout(drawLoose,150);};
  $('#ls').onclick=e=>{if(e.target.closest('[data-edit]'))return listEditor('stock',partsPage);const b=e.target.closest('.chip');if(!b)return;state.lstock=b.dataset.v;drawLoose();};
  $('#lc').onclick=e=>{if(e.target.closest('[data-edit]'))return listEditor('category',partsPage);const b=e.target.closest('.chip');if(!b)return;state.lcat=b.dataset.v;drawLoose();};
  api('/parts').then(p=>{machParts=p;if(state.lq)drawLoose();}).catch(()=>{});
  await loadLists();
  try{loose=await api('/loose');}catch(e){$('#list').innerHTML=`<div class="empty">${esc(e.message)}</div>`;return;}
  drawLoose();
}
const partHit=(p,q)=>[p.name,p.part_number,p.manufacturer,p.supplier,p.bin,p.notes,p.category,p.fits].join(' ').toLowerCase().includes(q);
function drawLoose(){
  if(!$('#lc'))return;
  const q=state.lq.toLowerCase();
  const cats=LISTS.category.slice();loose.forEach(p=>{if(p.category&&!cats.includes(p.category))cats.push(p.category);});
  $('#lc').innerHTML=['all',...cats].map(v=>`<button class="chip ${state.lcat===v?'on':''}" data-v="${esc(v)}">${v==='all'?'All categories':esc(v)}</button>`).join('')+editChip('category');
  if(state.lstock!=='all'&&!LISTS.stock.includes(state.lstock))state.lstock='all';
  const stk=LISTS.stock.slice();loose.forEach(p=>{if(p.stock&&!stk.includes(p.stock))stk.push(p.stock);});
  $('#ls').innerHTML=['all',...stk].map(v=>`<button class="chip ${state.lstock===v?'on':''}" data-v="${esc(v)}">${v==='all'?'All stock':esc(v)}</button>`).join('')+editChip('stock');
  const rows=loose.filter(p=>(state.lcat==='all'||p.category===state.lcat)&&(state.lstock==='all'||effStock(p)===state.lstock)&&(!q||partHit(p,q)));
  const thumb=p=>p.photo_src?`<img src="${p.photo_src}" alt="">`:p.has_photo?`<img loading="lazy" src="/api/loose/${p.id}/photo?code=${encodeURIComponent(store.code||'')}&v=${encodeURIComponent(p.updated_at)}" alt="">`:'🔩';
  let h=(q?`<div class="sec-h">🧰 Shop Parts (${rows.length})</div>`:`<div class="mini">${rows.length} of ${loose.length} shop parts${loose.filter(isLow).length?` · <b style="color:var(--orange)">${loose.filter(isLow).length} low</b>`:''}</div>`)+
   (rows.length?rows.map(p=>`<button class="pcard lp ${isLow(p)?'low':''}" data-id="${p.id}"><div class="thumb">${thumb(p)}</div>
    <div class="main"><div class="name">${esc(p.name)}</div>
     <div class="sub">${esc([p.part_number&&('#'+p.part_number),p.manufacturer].filter(Boolean).join(' · '))}</div>
     <div class="sub">${p.category?`<span class="badge b-cat">${esc(p.category)}</span>`:''}${p.stock?`<span class="badge b-stk">${esc(p.stock)}</span>`:''}${p.is_example?'<span class="badge b-ex">Example</span>':''}${p.bin?' 📍 '+esc(p.bin):''}</div></div>
    <div class="qty"><b>${p.qty??'–'}</b><span>on hand</span>${isLow(p)?'<em>LOW</em>':''}</div></button>`).join('')
   :`<div class="empty">${loose.length?'No shop parts match.':'No shop parts yet. Tap “Add Part”.'}</div>`);
  if(q){const mp=machParts.filter(p=>partHit(p,q)).slice(0,50);
    h+=`<div class="sec-h" style="margin-top:18px">🚜 On Equipment (${mp.length})</div>`+(mp.length?mp.map(p=>`
     <button class="pcard sp ${isLow(p)?'low':''}" data-id="${p.id}" data-eq="${p.equipment_id}"><div class="main"><div class="name">${esc(p.name)}</div>
      <div class="sub">${p.part_number?'#'+esc(p.part_number):'No part #'}${p.manufacturer?' · '+esc(p.manufacturer):''}</div>
      <div class="sub">🚜 ${esc(p.equipment_name||'')}${p.equipment_unit?' · #'+esc(p.equipment_unit):''}</div></div>
      <div class="qty"><b>${p.qty??'–'}</b><span>on hand</span>${isLow(p)?'<em>LOW</em>':''}</div></button>`).join(''):'<div class="empty" style="padding:12px">No machine parts match.</div>');}
  $('#list').innerHTML=h;
  $('#list').querySelectorAll('.lp').forEach(b=>b.onclick=()=>looseView(+b.dataset.id));
  $('#list').querySelectorAll('.sp').forEach(b=>b.onclick=()=>{state.tab='parts';state.pq='';state.hl=+b.dataset.id;location.hash='#/eq/'+b.dataset.eq;});
}
async function looseView(id){
  let p;try{p=await api('/loose/'+id);}catch(x){return toast(x.message);}
  const kv=(k,v)=>v==null||v===''?'':`<div class="kv"><b>${k}</b><span>${v}</span></div>`;
  modal(`${p.photo?`<img class="hero" src="${p.photo}" alt="" style="max-height:220px">`:''}
   <h2>${esc(p.name)}</h2>${p.is_example?'<div class="mini">EXAMPLE part – delete it when you add real parts.</div>':''}
   <div id="lowb">${isLow(p)?'<div class="lowbar">⚠ Low stock – at or below reorder level</div>':''}</div>
   <div class="qtybox"><button class="btn qbtn" id="qm" aria-label="One less">−</button><div><b id="qv">${p.qty??0}</b><span>on hand</span></div><button class="btn qbtn" id="qp" aria-label="One more">＋</button></div>
   <div class="grid" style="margin-top:8px">${kv('Part #',esc(p.part_number))}${kv('Brand',esc(p.manufacturer))}${kv('Category',esc(p.category))}${kv('Stock',esc(effStock(p))+(p.stock?'':' (auto)'))}${kv('Reorder at',esc(p.reorder_level))}${kv('Location / bin',esc(p.bin))}${kv('Supplier',esc(p.supplier))}</div>
   ${p.fits?`<div class="item"><div class="mini">Fits</div><div class="body">${esc(p.fits)}</div></div>`:''}
   ${p.notes?`<div class="item"><div class="body">${esc(p.notes)}</div></div>`:''}
   <div class="row" style="margin-top:12px"><button class="btn" id="x">Close</button><button class="btn primary" id="ed">✎ Edit</button></div>`);
  const bump=async dl=>{try{const r=await api(`/loose/${p.id}/qty`,{method:'POST',body:{delta:dl}});p.qty=r.qty;$('#qv').textContent=r.qty;
    $('#lowb').innerHTML=isLow(p)?'<div class="lowbar">⚠ Low stock – at or below reorder level</div>':'';const l=loose.find(x=>x.id===p.id);if(l){l.qty=r.qty;drawLoose();}}catch(x){toast(x.message);}};
  $('#qm').onclick=()=>bump(-1);$('#qp').onclick=()=>bump(1);
  $('#x').onclick=close;$('#ed').onclick=()=>looseForm(p);
}
function looseForm(p){
  const isNew=!p;p=p||{};let photo=p.photo||null;
  const f=(id,lab,type='text',extra='')=>`<div><label for="l_${id}">${lab}</label><input id="l_${id}" type="${type}" ${extra} value="${esc(p[id])}"></div>`;
  modal(`<h2>${isNew?'Add Shop Part':'Edit Shop Part'}</h2>
   ${f('name','Part name *','text','placeholder="e.g. V-belt A42"')}
   <div class="row">${f('part_number','Part #')}${f('manufacturer','Brand')}</div>
   <div class="row">${pickField('l_category','Category','category',p.category)}${pickField('l_stock','Stock status','stock',p.stock)}</div>
   <div class="row">${f('qty','Qty on hand','number','inputmode="decimal"')}${f('reorder_level','Low at','number','inputmode="decimal"')}</div>
   ${f('bin','Location / bin')}
   ${f('fits','Fits which machines (optional)','text','placeholder="e.g. Loader, excavator"')}
   ${f('supplier','Supplier')}
   <label for="l_notes">Notes</label><textarea id="l_notes">${esc(p.notes)}</textarea>
   <label>Photo (optional)</label><img id="lpv" class="hero" style="max-height:160px;${photo?'':'display:none'}" src="${photo||''}">
   <div class="row"><label class="btn" style="margin:0;color:var(--text)">📷 ${photo?'Change':'Add'} Photo<input id="l_photo" type="file" accept="image/*" hidden></label><button class="btn" id="lrm" ${photo?'':'hidden'}>Remove</button></div>
   <div class="row" style="margin-top:18px"><button class="btn" id="x">Cancel</button><button class="btn primary" id="s">Save Part</button></div>
   ${isNew?'':'<button class="btn danger block" id="del" style="margin-top:22px">🗑 Delete Part</button>'}`);
  $('#l_photo').onchange=async ev=>{const fl=ev.target.files[0];if(!fl)return;try{photo=await shrink(fl);$('#lpv').src=photo;$('#lpv').style.display='';$('#lrm').hidden=false;}catch{toast('Could not read photo');}};
  $('#lrm').onclick=()=>{photo=null;$('#lpv').style.display='none';$('#lrm').hidden=true;};
  $('#x').onclick=isNew?close:()=>looseView(p.id);
  $('#s').onclick=async()=>{const b={photo};b.category=pickVal('l_category');b.stock=pickVal('l_stock');['name','part_number','manufacturer','qty','reorder_level','bin','fits','supplier','notes'].forEach(k=>b[k]=$('#l_'+k).value.trim());
    if(!b.name)return toast('Part name is required');
    try{if(isNew)await api('/loose',{method:'POST',body:b});else await api('/loose/'+p.id,{method:'PUT',body:b});close();toast(isNew?'Part added':'Part saved');partsPage();}catch(x){toast(x.message);}};
  if(!isNew)$('#del').onclick=()=>adminConfirm(`Delete “${esc(p.name)}”?`,'This permanently removes this shop part. This cannot be undone.','Delete Part',async a=>{await api('/loose/'+p.id,{method:'DELETE',admin:a});close();toast('Part deleted');partsPage();});
}
// ---------- Editable lists (equipment types, shop-part categories) ----------
const STOCKS=['In stock','Low stock','Out of stock'];
const LISTS={type:TYPES.slice(),category:CATS.slice(),status:STATUSES.slice(),stock:STOCKS.slice(),
  roles:{status:{'in service':'ok','in shop':'shop','down':'down'},stock:{'In stock':'in','Low stock':'low','Out of stock':'out'}}};
// a shop part's stock label: the one picked on the part, or automatic from qty (In / Low / Out roles)
const roleVal=(k,r)=>Object.entries((LISTS.roles||{})[k]||{}).find(([v,x])=>x===r&&LISTS[k].includes(v))?.[0]||'';
const autoStock=p=>p.qty==null||p.qty===''?'':Number(p.qty)<=0?roleVal('stock','out'):isLow(p)?roleVal('stock','low'):roleVal('stock','in');
const effStock=p=>p.stock||autoStock(p);
const LNAME={type:['type','types','machine','machines'],category:['category','categories','shop part','shop parts'],status:['status','statuses','machine','machines'],stock:['stock status','stock statuses','shop part','shop parts']};
async function loadLists(){try{const l=await api('/lists');if(l&&l.type){Object.assign(LISTS,l);LISTS.roles=l.roles||{};}}catch(e){}}
const editChip=kind=>`<button class="chip chip-edit" data-edit="${kind}" aria-label="Edit ${LNAME[kind][1]}">✎ Edit</button>`;
// <select> of the list + "New…" which reveals a text box
function pickField(id,label,kind,val){const vs=LISTS[kind].slice();if(val&&!vs.some(v=>v.toLowerCase()===String(val).toLowerCase()))vs.push(val);
  return `<div><label for="${id}">${label}</label><select id="${id}" onchange="document.getElementById('${id}_new').hidden=this.value!=='__new'">
   ${kind==='category'||kind==='stock'?`<option value="" ${!val?'selected':''}>${kind==='stock'?'Automatic (from qty)':'— none —'}</option>`:''}${vs.map(v=>`<option value="${esc(v)}" ${v===val?'selected':''}>${esc(v)}</option>`).join('')}<option value="__new">＋ New ${LNAME[kind][0]}…</option></select>
   <input id="${id}_new" hidden placeholder="Type a new ${LNAME[kind][0]}" style="margin-top:6px"></div>`;}
const pickVal=id=>{const s=$('#'+id);return s.value==='__new'?$('#'+id+'_new').value.trim():s.value;};
async function listEditor(kind,after){
  await loadLists();const [one,many,thing,things]=LNAME[kind];
  const draw=()=>{const vs=LISTS[kind];
    modal(`<h2>Edit ${many}</h2><div class="mini">Rename by typing in a box (saves when you leave it). Renaming updates every ${thing} using it.</div>
     <div id="lerows">${vs.map((v,i)=>`<div class="lerow"><input class="lein" data-i="${i}" value="${esc(v)}" aria-label="${esc(v)}">
      <button class="btn lebtn" data-up="${i}" ${i?'':'disabled'} aria-label="Move up">↑</button><button class="btn lebtn" data-dn="${i}" ${i<vs.length-1?'':'disabled'} aria-label="Move down">↓</button>
      <button class="btn lebtn danger" data-del="${i}" aria-label="Delete ${esc(v)}">🗑</button></div>`).join('')||'<div class="empty">No '+many+' yet.</div>'}</div>
     <label for="lenew">Add a new ${one}</label><div class="row"><input id="lenew" placeholder="e.g. ${({type:'skid steer',category:'Lights',status:'waiting on parts',stock:'On order'})[kind]}" style="flex:2"><button class="btn primary" id="leadd">＋ Add</button></div>
     <button class="btn block" id="x" style="margin-top:16px">Done</button>`);
    $('#x').onclick=()=>{close();after();};
    $('#leadd').onclick=async()=>{const v=$('#lenew').value.trim();if(!v)return toast('Type a name first');
      try{await api('/lists/'+kind,{method:'POST',body:{value:v}});await loadLists();toast('Added');draw();}catch(x){toast(x.message);}};
    $('#modal').querySelectorAll('.lein').forEach(inp=>inp.onchange=async()=>{const from=vs[+inp.dataset.i],to=inp.value.trim();if(!to||to===from){inp.value=from;return;}
      try{const r=await api('/lists/'+kind,{method:'PUT',body:{from,to}});await loadLists();toast(r.merged?`Merged into “${to}”`:'Renamed');draw();}catch(x){toast(x.message);inp.value=from;}});
    const move=async(i,j)=>{const a=vs.slice();[a[i],a[j]]=[a[j],a[i]];try{await api(`/lists/${kind}/order`,{method:'PUT',body:{values:a}});LISTS[kind]=a;draw();}catch(x){toast(x.message);}};
    $('#modal').querySelectorAll('[data-up]').forEach(b=>b.onclick=()=>move(+b.dataset.up,+b.dataset.up-1));
    $('#modal').querySelectorAll('[data-dn]').forEach(b=>b.onclick=()=>move(+b.dataset.dn,+b.dataset.dn+1));
    $('#modal').querySelectorAll('[data-del]').forEach(b=>b.onclick=async()=>{const v=vs[+b.dataset.del];
      let n=0;try{n=(await api(`/lists/${kind}/usage?value=`+encodeURIComponent(v))).count;}catch(x){}
      if(kind==='status'&&LISTS.status.length<2)return toast('Keep at least one status');
      const rest=LISTS[kind].filter(t=>t.toLowerCase()!==v.toLowerCase());
      const repl=kind==='type'?(rest.find(t=>t.toLowerCase()==='other')||''):kind==='status'?(rest.find(t=>LISTS.roles.status?.[t]==='ok')||rest[0]):'';
      const to=kind==='stock'?'Automatic (from qty)':repl?`“${esc(repl)}”`:'blank (no '+one+')';
      const auto=kind==='stock'&&LISTS.roles.stock?.[v]?` Parts on Automatic won’t get the “${esc(v)}” label any more (the orange LOW warning still shows).`:'';
      const msg=(n?`<b>${n} ${n===1?thing:things}</b> use “${esc(v)}”. They’ll be set to ${to}.`:`No ${things} use “${esc(v)}”.`)+auto;
      adminConfirm(`Delete “${esc(v)}”?`,msg,'Delete',async a=>{await api(`/lists/${kind}?value=${encodeURIComponent(v)}&replace=${encodeURIComponent(repl)}`,{method:'DELETE',admin:a});
        if(kind==='type'&&state.type===v)state.type='all';if(kind==='category'&&state.lcat===v)state.lcat='all';if(kind==='status'&&state.status===v)state.status='all';if(kind==='stock'&&state.lstock===v)state.lstock='all';await loadLists();toast('Deleted');draw();});});
  };draw();
}
async function credits(){const c=window.FF_CREDITS||await fetch('/photos/credits.json').then(r=>r.json()).catch(()=>({}));
  modal(`<h2>Photo Credits</h2><p class="mini">Photos from Wikimedia Commons, used under their licenses (unmodified except resizing/cropping).</p>${Object.entries(c).map(([k,v])=>`<div class="item"><b style="text-transform:capitalize">${esc(k.replace('-',' '))}</b><div class="mini">${esc(v.author)} · ${esc(v.license)}</div><a href="${esc(v.page)}" target="_blank" rel="noopener" style="color:var(--yellow);word-break:break-all;font-size:14px">${esc(v.page)}</a></div>`).join('')}<button class="btn block" id="x">Close</button>`);$('#x').onclick=close;}
try{if('serviceWorker' in navigator&&location.protocol!=='file:'&&!window.FF_STANDALONE)navigator.serviceWorker.register('/sw.js').catch(function(){});}catch(e){}
route();
window.FF_STARTED=true;document.querySelectorAll('.ffstatic-note').forEach(n=>n.remove());
