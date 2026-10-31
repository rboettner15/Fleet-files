// Safe storage: works even where localStorage/sessionStorage are blocked or throw (e.g. iOS Quick Look); falls back to memory.
function safeStore(name){let s=null;try{s=window[name];s.setItem('__ff_t','1');s.removeItem('__ff_t');}catch(e){s=null;}
  const m={};const api={removeItem(k){delete m[k];try{if(s)s.removeItem(k);}catch(e){}},persistent:!!s};
  return new Proxy(api,{get(t,k){if(k in api)return api[k];if(typeof k!=='string')return undefined;if(k in m)return m[k];
      try{if(s){const v=s.getItem(k);if(v!==null){m[k]=v;return v;}}}catch(e){}return undefined;},
    set(t,k,v){m[k]=String(v);try{if(s)s.setItem(k,String(v));}catch(e){}return true;}});}
const LS=safeStore('localStorage'),SS=safeStore('sessionStorage');
'use strict';
const TYPES=['truck','dump truck','trailer','loader','excavator','dozer','generator','other'];
const STATUSES=['in service','in shop','down'];
const $=s=>document.querySelector(s), app=$('#app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get code(){return LS.ff_code},set code(v){LS.ff_code=v},get name(){return LS.ff_name||''},set name(v){LS.ff_name=v}};
const state={q:'',type:'all',status:'all',tab:'notes'};
const typeImg=t=>window.FF_PHOTOS?window.FF_PHOTOS[(TYPES.includes(t)?t:'other').replace(' ','-')]:'/photos/'+(TYPES.includes(t)?t:'other').replace(' ','-')+'.jpg';
const fmtDate=d=>d?new Date(d.length===10?d+'T12:00:00':d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'—';
const fmtTime=d=>new Date(d).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});
const sc=s=>(s||'').replace(/ /g,'-');
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(t._t);t._t=setTimeout(()=>t.hidden=true,2200);}

// ---------- DEMO MODE (all data local to this device) ----------
const DEMO_KEY='ff_demo_db';
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
  if(path==='/check')return{ok:true};
  if(path==='/equipment'&&m==='GET')return d.equipment.map(e=>({...e,photo:undefined,photo_src:e.photo,has_photo:!!e.photo,last_service:lastSvc(e.id),note_count:d.notes.filter(n=>n.equipment_id===e.id).length,low_parts:d.parts.filter(p=>p.equipment_id===e.id&&low(p)).length})).sort((p,q)=>p.is_example-q.is_example||p.name.localeCompare(q.name));
  if(path==='/equipment'&&m==='POST'){if(!b.name)throw new Error('Name is required');const e=num({...clean(b),id:nid(),is_example:0,created_at:now,updated_at:now},['meter','year']);d.equipment.push(e);demoSave(d);return{id:e.id};}
  if(x=path.match(/^\/equipment\/(\d+)$/)){const id=+x[1],i=d.equipment.findIndex(e=>e.id===id);if(i<0)throw new Error('Not found');
    if(m==='GET')return{...d.equipment[i],last_service:lastSvc(id)};
    if(m==='PUT'){if(!b.name)throw new Error('Name is required');d.equipment[i]=num({...d.equipment[i],...clean(b),id,updated_at:now},['meter','year']);demoSave(d);return{ok:true};}
    if(m==='DELETE'){d.equipment.splice(i,1);['notes','service','parts'].forEach(k=>d[k]=d[k].filter(r=>r.equipment_id!==id));demoSave(d);return{ok:true};}}
  if(x=path.match(/^\/equipment\/(\d+)\/photo$/)){const e=d.equipment.find(e=>e.id===+x[1]);e.photo=b.photo||null;e.updated_at=now;demoSave(d);return{ok:true};}
  if(x=path.match(/^\/equipment\/(\d+)\/(notes|service|parts)$/)){const id=+x[1],k=x[2];
    if(m==='GET'){if(k==='notes')return d.notes.filter(n=>n.equipment_id===id).sort((p,q)=>q.created_at.localeCompare(p.created_at));
      if(k==='service')return d.service.filter(n=>n.equipment_id===id).sort((p,q)=>q.date.localeCompare(p.date)||q.id-p.id);
      return d.parts.filter(n=>n.equipment_id===id).map(p=>({...p,photo:undefined,photo_src:p.photo,has_photo:!!p.photo})).sort((p,q)=>p.name.localeCompare(q.name));}
    if(k==='notes'){if(!b.author||!b.body)throw new Error('Name and note text required');d.notes.push({id:nid(),equipment_id:id,author:b.author,body:b.body,created_at:now});}
    if(k==='service'){if(!b.date||!b.work_done)throw new Error('Date and work done required');d.service.push(num({...clean(b),id:nid(),equipment_id:id,created_at:now},['meter','cost']));}
    if(k==='parts'){if(!b.name)throw new Error('Part name is required');d.parts.push(num({...clean(b),id:nid(),equipment_id:id,is_example:0,created_at:now,updated_at:now},['qty','reorder_level','price']));}
    demoSave(d);return{id:d.next-1};}
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
  m?detail(+m[1]):list();
}

let cache=[];
async function list(){
  header('Fleet Files',false);
  app.innerHTML=`<input class="search" id="q" type="search" placeholder="🔍  Search name, unit #, make, VIN…" value="${esc(state.q)}">
   <div class="chips" id="tc"></div><div class="chips" id="sc"></div><div id="list"><div class="empty">Loading…</div></div>
   <button class="btn primary fab" id="add">＋ Add Equipment</button>`;
  const chips=(el,arr,key)=>{el.innerHTML=['all',...arr].map(v=>`<button class="chip ${state[key]===v?'on':''}" data-v="${v}">${v==='all'?(key==='type'?'All types':'All status'):v}</button>`).join('');
    el.onclick=e=>{const b=e.target.closest('.chip');if(!b)return;state[key]=b.dataset.v;chips(el,arr,key);draw();};};
  chips($('#tc'),TYPES,'type');chips($('#sc'),STATUSES,'status');
  $('#q').oninput=e=>{state.q=e.target.value;draw();};
  $('#add').onclick=()=>editForm();
  try{cache=await api('/equipment');}catch(e){$('#list').innerHTML=`<div class="empty">${esc(e.message)}</div>`;return;}
  draw();
}
function draw(){
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
  header(e.unit?'#'+e.unit:'Equipment',true);
  const kv=(k,v)=>`<div class="kv"><b>${k}</b><span>${esc(v??'—')||'—'}</span></div>`;
  app.innerHTML=`<button class="hero-wrap" id="heroBtn" aria-label="Change photo"><img class="hero" src="${e.photo||typeImg(e.type)}" alt=""><span class="hero-cta">📷 ${e.photo?'Change Photo':'Add Photo'}</span>${e.photo?'':'<span class="hero-def">Stock photo – tap to add this unit’s photo</span>'}</button>
   ${e.is_example?'<div class="item" style="border:2px solid #5b4bd6"><b>EXAMPLE item.</b> Delete it once you add your real equipment (Edit → Delete).</div>':''}
   <h2 style="margin:4px 0">${esc(e.name)}</h2>
   <div style="margin-bottom:10px"><span class="badge b-${sc(e.status)}">${esc(e.status)}</span> <span class="mini">· Last service ${fmtDate(e.last_service)}</span></div>
   <div class="row" style="margin-bottom:10px">${STATUSES.map(s=>`<button class="btn ${e.status===s?'primary':''}" data-s="${s}" style="padding:0 6px;font-size:14px">${s}</button>`).join('')}</div>
   <div class="grid">${kv('Type',e.type)}${kv('Unit / ID',e.unit)}${kv('Make',e.make)}${kv('Model',e.model)}${kv('Year',e.year)}${kv(e.meter_unit==='miles'?'Mileage':'Hours',e.meter!=null?Number(e.meter).toLocaleString()+' '+(e.meter_unit||''):null)}${kv('VIN / Serial',e.vin)}${kv('Location',e.location)}</div>
   <button class="btn block" id="edit" style="margin-top:10px">✎ Edit Details</button>
   <div class="tabs">${['notes','service','parts'].map(t=>`<button class="tab ${state.tab===t?'on':''}" data-t="${t}">${t==='parts'?'Parts':t==='service'?'Service':'Notes'}</button>`).join('')}</div>
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
  const isNew=!e;e=e||{status:'in service',type:'truck',meter_unit:'hours'};
  const opt=(arr,v)=>arr.map(o=>`<option ${o===v?'selected':''}>${o}</option>`).join('');
  let photo=e.photo||null;
  modal(`<h2>${isNew?'Add Equipment':'Edit Equipment'}</h2>
   <label>Name *</label><input id="f_name" value="${esc(e.name)}" placeholder="e.g. Blue Service Truck">
   <div class="row"><div><label>Unit / ID #</label><input id="f_unit" value="${esc(e.unit)}"></div><div><label>Type</label><select id="f_type">${opt(TYPES,e.type)}</select></div></div>
   <label>Status</label><select id="f_status">${opt(STATUSES,e.status)}</select>
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
  $('#s').onclick=async()=>{const b={};['name','unit','type','status','make','model','year','vin','meter','meter_unit','location'].forEach(k=>b[k]=$('#f_'+k).value.trim());b.photo=photo;
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
async function credits(){const c=window.FF_CREDITS||await fetch('/photos/credits.json').then(r=>r.json()).catch(()=>({}));
  modal(`<h2>Photo Credits</h2><p class="mini">Photos from Wikimedia Commons, used under their licenses (unmodified except resizing/cropping).</p>${Object.entries(c).map(([k,v])=>`<div class="item"><b style="text-transform:capitalize">${esc(k.replace('-',' '))}</b><div class="mini">${esc(v.author)} · ${esc(v.license)}</div><a href="${esc(v.page)}" target="_blank" rel="noopener" style="color:var(--yellow);word-break:break-all;font-size:14px">${esc(v.page)}</a></div>`).join('')}<button class="btn block" id="x">Close</button>`);$('#x').onclick=close;}
try{if('serviceWorker' in navigator&&location.protocol!=='file:'&&!window.FF_STANDALONE)navigator.serviceWorker.register('/sw.js').catch(function(){});}catch(e){}
route();
window.FF_STARTED=true;document.querySelectorAll('.ffstatic-note').forEach(n=>n.remove());
