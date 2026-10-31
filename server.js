// Fleet Files v1 server: Express + SQLite (sql.js, persisted to data/fleet.db)
const express = require('express');
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const PORT = process.env.PORT || 8080;
const ACCESS_CODE = process.env.FLEET_ACCESS_CODE || 'fleet2026';
const ADMIN_CODE = process.env.FLEET_ADMIN_CODE || 'admin-anchorpoint';
const DB_FILE = process.env.DB_FILE || path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'fleet.db');

(async () => {
  const SQL = await initSqlJs();
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  const save = () => { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, Buffer.from(db.export())); fs.renameSync(tmp, DB_FILE); };
  db.run('PRAGMA foreign_keys=ON');
  db.exec(`
  CREATE TABLE IF NOT EXISTS equipment(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, unit TEXT, type TEXT, make TEXT, model TEXT, year INTEGER, vin TEXT, meter REAL, meter_unit TEXT DEFAULT 'hours', status TEXT DEFAULT 'in service', location TEXT, photo TEXT, is_example INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS notes(id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, author TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT);
  CREATE TABLE IF NOT EXISTS service_records(id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, date TEXT NOT NULL, meter REAL, work_done TEXT NOT NULL, parts_used TEXT, cost REAL, performed_by TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS parts_v2(id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, name TEXT NOT NULL, part_number TEXT, manufacturer TEXT, qty REAL, reorder_level REAL, bin TEXT, supplier TEXT, price REAL, url TEXT, notes TEXT, photo TEXT, is_example INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
  DROP TABLE IF EXISTS parts;
  `);
  const all = (sql, p = []) => { const s = db.prepare(sql); s.bind(p); const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); return r; };
  const get = (sql, p) => all(sql, p)[0];
  const run = (sql, p = []) => { db.run(sql, p); const id = get('SELECT last_insert_rowid() id').id; save(); return id; };
  const now = () => new Date().toISOString();

  if (!get('SELECT COUNT(*) c FROM equipment').c && !fs.existsSync(DB_FILE + '.seeded')) {
    const ex = [
      ['EXAMPLE – Service Truck', 'EX-101', 'truck', 'Example Make', 'Example Model', 2019, 'EXAMPLE-VIN-0001', 84210, 'miles', 'in service', 'Main shop yard'],
      ['EXAMPLE – Wheel Loader', 'EX-202', 'loader', 'Example Make', 'Example Model', 2015, 'EXAMPLE-SN-0002', 6120, 'hours', 'in shop', 'Shop bay 2'],
      ['EXAMPLE – Excavator', 'EX-303', 'excavator', 'Example Make', 'Example Model', 2018, 'EXAMPLE-SN-0003', 4480, 'hours', 'in service', 'Back lot'],
      ['EXAMPLE – Diesel Generator', 'EX-404', 'generator', 'Example Make', 'Example Model', 2020, 'EXAMPLE-SN-0004', 2310, 'hours', 'down', 'Job site'],
      ['EXAMPLE – Dump Truck', 'EX-505', 'dump truck', 'Example Make', 'Example Model', 2017, 'EXAMPLE-VIN-0005', 152300, 'miles', 'in service', 'Main shop yard'],
    ];
    for (const e of ex) {
      const id = run('INSERT INTO equipment(name,unit,type,make,model,year,vin,meter,meter_unit,status,location,is_example,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?,?)', [...e, now(), now()]);
      run('INSERT INTO notes(equipment_id,author,body,created_at) VALUES(?,?,?,?)', [id, 'Example User', 'This is an EXAMPLE note. Delete this equipment when you add real units.', now()]);
      run('INSERT INTO service_records(equipment_id,date,meter,work_done,parts_used,cost,performed_by,created_at) VALUES(?,?,?,?,?,?,?,?)', [id, '2026-09-15', e[7], 'EXAMPLE: oil & filter change, grease all fittings', 'EXAMPLE: oil filter, 15W-40 oil', 185, 'Example Mechanic', now()]);
    }
    fs.writeFileSync(DB_FILE + '.seeded', now());
  }

  if (!fs.existsSync(DB_FILE + '.parts-seeded')) {
    const P = {
      truck: [['EXAMPLE Oil Filter', 'EX-OF-100', 'Example Brand', 2, 2, 'Shelf A1', 'Example Supplier', 12.5], ['EXAMPLE Air Filter', 'EX-AF-200', 'Example Brand', 4, 1, 'Shelf A2', 'Example Supplier', 34]],
      'dump truck': [['EXAMPLE Fuel Filter', 'EX-FF-300', 'Example Brand', 1, 2, 'Shelf B1', 'Example Supplier', 28], ['EXAMPLE Brake Chamber', 'EX-BC-310', 'Example Brand', 2, 1, 'Bin B4', 'Example Supplier', 89.99], ['EXAMPLE Wiper Blade', 'EX-WB-320', 'Example Brand', 6, 2, 'Bin B5', 'Example Supplier', 15]],
      loader: [['EXAMPLE Hydraulic Filter', 'EX-HF-400', 'Example Brand', 0, 1, 'Shelf C1', 'Example Supplier', 64], ['EXAMPLE Bucket Tooth', 'EX-BT-410', 'Example Brand', 8, 4, 'Yard rack', 'Example Supplier', 22]],
      excavator: [['EXAMPLE Track Pin', 'EX-TP-500', 'Example Brand', 3, 2, 'Bin D2', 'Example Supplier', 45], ['EXAMPLE Engine Oil Filter', 'EX-OF-510', 'Example Brand', 5, 2, 'Shelf D1', 'Example Supplier', 18.75]],
      generator: [['EXAMPLE Spin-on Oil Filter', 'EX-OF-600', 'Example Brand', 1, 1, 'Shelf E1', 'Example Supplier', 14], ['EXAMPLE Fan Belt', 'EX-FB-610', 'Example Brand', 2, 1, 'Peg wall E', 'Example Supplier', 26.4]],
    };
    for (const e of all('SELECT id,type FROM equipment WHERE is_example=1'))
      for (const p of (P[e.type] || [])) {
        db.run('INSERT INTO parts_v2(equipment_id,name,part_number,manufacturer,qty,reorder_level,bin,supplier,price,notes,is_example,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)', [e.id, ...p, 'EXAMPLE part – delete when you add real parts.', now(), now()]);
      }
    save(); fs.writeFileSync(DB_FILE + '.parts-seeded', now());
  }

  // ---- Procedures (v4): checklists, inspections, documents. Additive only. ----
  db.exec(`
  CREATE TABLE IF NOT EXISTS checklists(id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, name TEXT NOT NULL, items TEXT NOT NULL DEFAULT '[]', is_example INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
  CREATE TABLE IF NOT EXISTS inspections(id INTEGER PRIMARY KEY AUTOINCREMENT, checklist_id INTEGER NOT NULL REFERENCES checklists(id) ON DELETE CASCADE, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, checklist_name TEXT, performed_by TEXT, date TEXT, meter REAL, results TEXT NOT NULL DEFAULT '[]', pass_count INTEGER, fail_count INTEGER, notes TEXT, created_at TEXT);
  CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY AUTOINCREMENT, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, title TEXT NOT NULL, filename TEXT, stored_name TEXT NOT NULL, mime TEXT, size INTEGER, uploaded_by TEXT, created_at TEXT, updated_at TEXT);
  `);
  const DOCS_DIR = path.join(path.dirname(DB_FILE), 'docs');
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const MAX_DOC = 25 * 1024 * 1024;
  if (!fs.existsSync(DB_FILE + '.procedures-seeded')) {
    const items = ['Walk-around: no leaks, damage, or loose parts', 'Engine oil level OK', 'Coolant level OK', 'Hydraulic / fuel levels OK', 'Tires / tracks and wheels OK', 'Lights, horn, and backup alarm work', 'Brakes and steering work', 'Seat belt, mirrors, and fire extinguisher OK'];
    for (const e of all('SELECT id FROM equipment WHERE is_example=1'))
      db.run('INSERT INTO checklists(equipment_id,name,items,is_example,created_at,updated_at) VALUES(?,?,?,1,?,?)', [e.id, 'EXAMPLE – Daily Pre-Op Inspection', JSON.stringify(items), now(), now()]);
    save(); fs.writeFileSync(DB_FILE + '.procedures-seeded', now());
  }

  // ---- Loose shop parts (v7): not tied to any machine. Additive only. ----
  db.exec(`CREATE TABLE IF NOT EXISTS loose_parts(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, part_number TEXT, manufacturer TEXT, category TEXT, qty REAL, reorder_level REAL, bin TEXT, fits TEXT, supplier TEXT, notes TEXT, photo TEXT, is_example INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);`);
  if (!fs.existsSync(DB_FILE + '.loose-seeded')) {
    for (const p of [
      ['EXAMPLE Grease Cartridge', 'EX-GR-14', 'Example Brand', 'Fluids', 12, 6, 'Shelf F1', 'Most machines', 'Example Supplier'],
      ['EXAMPLE V-Belt', 'EX-VB-A42', 'Example Brand', 'Belts', 1, 2, 'Peg wall B', 'Generators, compressors', 'Example Supplier'],
      ['EXAMPLE Hydraulic Hose 1/2" x 36"', 'EX-HH-0836', 'Example Brand', 'Hydraulic', 3, 1, 'Hose rack', 'Loader, excavator', 'Example Supplier'],
      ['EXAMPLE Grade 8 Bolt Kit', 'EX-BK-G8', 'Example Brand', 'Hardware', 0, 1, 'Bin H3', '', 'Example Supplier'],
    ]) db.run('INSERT INTO loose_parts(name,part_number,manufacturer,category,qty,reorder_level,bin,fits,supplier,notes,is_example,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?)', [...p, 'EXAMPLE part – delete when you add real parts.', now(), now()]);
    save(); fs.writeFileSync(DB_FILE + '.loose-seeded', now());
  }

  // ---- Editable lists (v8): equipment types + shop-part categories. Additive only. ----
  db.exec(`CREATE TABLE IF NOT EXISTS lists(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, value TEXT NOT NULL, pos INTEGER DEFAULT 0, created_at TEXT);`);
  const LISTS = { type: { table: 'equipment', col: 'type', seed: ['truck', 'dump truck', 'trailer', 'loader', 'excavator', 'dozer', 'generator', 'other'] },
    category: { table: 'loose_parts', col: 'category', seed: ['Filters', 'Belts', 'Hydraulic', 'Electrical', 'Hardware', 'Fluids', 'Tires', 'Engine', 'Other'] },
    // v9: status + stock. `role` keeps a built-in meaning (status color / automatic stock label) through renames.
    status: { table: 'equipment', col: 'status', required: true, seed: ['in service', 'in shop', 'down'], roles: { 'in service': 'ok', 'in shop': 'shop', 'down': 'down' } },
    stock: { table: 'loose_parts', col: 'stock', seed: ['In stock', 'Low stock', 'Out of stock'], roles: { 'In stock': 'in', 'Low stock': 'low', 'Out of stock': 'out' } },
    // v10: To Do List
    todo_status: { table: 'todos', col: 'status', required: true, seed: ['Open', 'In progress', 'Done'], roles: { 'Open': 'open', 'In progress': 'doing', 'Done': 'done' } },
    priority: { table: 'todos', col: 'priority', required: true, seed: ['High', 'Normal', 'Low'], roles: { 'High': 'high', 'Normal': 'normal', 'Low': 'low' } } };
  db.exec(`CREATE TABLE IF NOT EXISTS todos(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, notes TEXT, status TEXT, priority TEXT, equipment_id INTEGER, due_date TEXT, author TEXT, done_at TEXT, created_at TEXT, updated_at TEXT);`);
  // additive columns (ADD COLUMN only, never drops): lists.role, loose_parts.stock (blank = automatic from qty)
  const hasCol = (t, c) => all(`PRAGMA table_info(${t})`).some(r => r.name === c);
  if (!hasCol('lists', 'role')) db.exec('ALTER TABLE lists ADD COLUMN role TEXT');
  if (!hasCol('loose_parts', 'stock')) db.exec('ALTER TABLE loose_parts ADD COLUMN stock TEXT');
  const listVals = k => all('SELECT value FROM lists WHERE kind=? ORDER BY pos, id', [k]).map(r => r.value);
  const findVal = (k, v) => get('SELECT * FROM lists WHERE kind=? AND value=? COLLATE NOCASE', [k, v]);
  const addVal = (k, v) => { v = String(v || '').trim(); if (!v || findVal(k, v)) return false;
    db.run('INSERT INTO lists(kind,value,pos,created_at) VALUES(?,?,?,?)', [k, v, (get('SELECT MAX(pos) m FROM lists WHERE kind=?', [k]).m ?? -1) + 1, now()]); return true; };
  if (!fs.existsSync(DB_FILE + '.lists-seeded')) {
    for (const k of ['type', 'category']) { const L = LISTS[k];
      for (const v of L.seed) addVal(k, v);
      for (const r of all(`SELECT DISTINCT ${L.col} v FROM ${L.table} WHERE ${L.col} IS NOT NULL AND TRIM(${L.col})<>''`)) addVal(k, r.v);
    }
    save(); fs.writeFileSync(DB_FILE + '.lists-seeded', now());
  }
  if (!fs.existsSync(DB_FILE + '.lists2-seeded')) { // v9: seed status + stock once, leaves type/category untouched
    for (const k of ['status', 'stock']) { const L = LISTS[k];
      for (const v of L.seed) { addVal(k, v); db.run('UPDATE lists SET role=? WHERE kind=? AND value=? AND role IS NULL', [L.roles[v], k, v]); }
      for (const r of all(`SELECT DISTINCT ${L.col} v FROM ${L.table} WHERE ${L.col} IS NOT NULL AND TRIM(${L.col})<>''`)) addVal(k, r.v);
    }
    save(); fs.writeFileSync(DB_FILE + '.lists2-seeded', now());
  }
  if (!fs.existsSync(DB_FILE + '.lists3-seeded')) { // v10: to-do status + priority, seeded once
    for (const k of ['todo_status', 'priority']) { const L = LISTS[k];
      for (const v of L.seed) { addVal(k, v); db.run('UPDATE lists SET role=? WHERE kind=? AND value=? AND role IS NULL', [L.roles[v], k, v]); } }
    save(); fs.writeFileSync(DB_FILE + '.lists3-seeded', now());
  }

  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use(express.static(path.join(__dirname, 'public'), { setHeaders: (res, p) => { if (p.endsWith('sw.js')) res.set('Cache-Control', 'no-cache'); } }));

  const auth = (req, res, next) => (req.get('x-access-code') || req.query.code) === ACCESS_CODE ? next() : res.status(401).json({ error: 'Invalid access code' });
  const admin = (req, res, next) => req.get('x-admin-code') === ADMIN_CODE ? next() : res.status(403).json({ error: 'Admin code required' });
  const api = express.Router(); api.use(auth);

  api.get('/check', (req, res) => res.json({ ok: true }));
  api.post('/admin-check', admin, (req, res) => res.json({ ok: true }));
  const LIST = `SELECT e.id,e.name,e.unit,e.type,e.make,e.model,e.year,e.vin,e.meter,e.meter_unit,e.status,e.location,e.is_example,e.updated_at,
    (e.photo IS NOT NULL AND e.photo<>'') has_photo, (SELECT MAX(date) FROM service_records s WHERE s.equipment_id=e.id) last_service,
    (SELECT COUNT(*) FROM notes n WHERE n.equipment_id=e.id) note_count, (SELECT COUNT(*) FROM parts_v2 p WHERE p.equipment_id=e.id AND p.qty IS NOT NULL AND p.reorder_level IS NOT NULL AND p.qty<=p.reorder_level) low_parts FROM equipment e`;
  api.get('/equipment', (req, res) => res.json(all(LIST + ' ORDER BY e.is_example, e.name COLLATE NOCASE')));
  api.get('/equipment/:id', (req, res) => {
    const e = get('SELECT e.*, (SELECT MAX(date) FROM service_records s WHERE s.equipment_id=e.id) last_service FROM equipment e WHERE id=?', [+req.params.id]);
    e ? res.json(e) : res.status(404).json({ error: 'Not found' });
  });
  const F = ['name', 'unit', 'type', 'make', 'model', 'year', 'vin', 'meter', 'meter_unit', 'status', 'location', 'photo'];
  const vals = b => F.map(f => b[f] === '' || b[f] === undefined ? null : b[f]);
  api.get('/equipment/:id/photo', (req, res) => {
    const r = get('SELECT photo FROM equipment WHERE id=?', [+req.params.id]);
    const m = r && r.photo && /^data:(image\/[a-z+]+);base64,(.*)$/.exec(r.photo);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]).set('Cache-Control', 'private, max-age=60').send(Buffer.from(m[2], 'base64'));
  });
  api.post('/equipment', (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Name is required' });
    addVal('type', req.body.type); addVal('status', req.body.status);
    const id = run(`INSERT INTO equipment(${F},created_at,updated_at) VALUES(${F.map(() => '?')},?,?)`, [...vals(req.body), now(), now()]);
    res.status(201).json({ id });
  });
  api.put('/equipment/:id', (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Name is required' });
    addVal('type', req.body.type); addVal('status', req.body.status);
    run(`UPDATE equipment SET ${F.map(f => f + '=?')},updated_at=? WHERE id=?`, [...vals(req.body), now(), +req.params.id]);
    res.json({ ok: true });
  });
  api.delete('/equipment/:id', admin, (req, res) => {
    const docs = all('SELECT stored_name FROM documents WHERE equipment_id=?', [+req.params.id]);
    run('DELETE FROM equipment WHERE id=?', [+req.params.id]);
    run('UPDATE todos SET equipment_id=NULL WHERE equipment_id=?', [+req.params.id]); // keep the to-dos, just unlink
    for (const d of docs) fs.rm(path.join(path.dirname(DB_FILE), 'docs', path.basename(d.stored_name)), { force: true }, () => {});
    res.json({ ok: true });
  });

  api.get('/equipment/:id/notes', (req, res) => res.json(all('SELECT * FROM notes WHERE equipment_id=? ORDER BY created_at DESC, id DESC', [+req.params.id])));
  api.post('/equipment/:id/notes', (req, res) => {
    const { author, body } = req.body;
    if (!author || !body) return res.status(400).json({ error: 'Name and note text required' });
    res.status(201).json({ id: run('INSERT INTO notes(equipment_id,author,body,created_at) VALUES(?,?,?,?)', [+req.params.id, author, body, now()]) });
  });
  api.delete('/notes/:id', admin, (req, res) => { run('DELETE FROM notes WHERE id=?', [+req.params.id]); res.json({ ok: true }); });

  api.get('/equipment/:id/service', (req, res) => res.json(all('SELECT * FROM service_records WHERE equipment_id=? ORDER BY date DESC, id DESC', [+req.params.id])));
  api.post('/equipment/:id/service', (req, res) => {
    const b = req.body;
    if (!b.date || !b.work_done) return res.status(400).json({ error: 'Date and work done required' });
    res.status(201).json({ id: run('INSERT INTO service_records(equipment_id,date,meter,work_done,parts_used,cost,performed_by,created_at) VALUES(?,?,?,?,?,?,?,?)',
      [+req.params.id, b.date, b.meter || null, b.work_done, b.parts_used || null, b.cost || null, b.performed_by || null, now()]) });
  });
  api.delete('/service/:id', admin, (req, res) => { run('DELETE FROM service_records WHERE id=?', [+req.params.id]); res.json({ ok: true }); });

  const PF = ['name', 'part_number', 'manufacturer', 'qty', 'reorder_level', 'bin', 'supplier', 'price', 'url', 'notes', 'photo'];
  const pvals = b => PF.map(f => b[f] === '' || b[f] === undefined ? null : b[f]);
  const okUrl = u => !u || /^https?:\/\//i.test(u);
  api.get('/equipment/:id/parts', (req, res) => res.json(all(`SELECT id,equipment_id,${PF.filter(f => f !== 'photo')},is_example,updated_at,(photo IS NOT NULL AND photo<>'') has_photo FROM parts_v2 WHERE equipment_id=? ORDER BY name COLLATE NOCASE`, [+req.params.id])));
  // all parts (no photos) with their machine, for the main search
  api.get('/parts', (req, res) => res.json(all(`SELECT p.id,p.equipment_id,${PF.filter(f => f !== 'photo').map(f => 'p.' + f)},p.is_example,e.name equipment_name,e.unit equipment_unit
    FROM parts_v2 p JOIN equipment e ON e.id=p.equipment_id ORDER BY p.name COLLATE NOCASE`)));
  api.get('/parts/:id', (req, res) => { const p = get('SELECT * FROM parts_v2 WHERE id=?', [+req.params.id]); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); });
  api.get('/parts/:id/photo', (req, res) => {
    const r = get('SELECT photo FROM parts_v2 WHERE id=?', [+req.params.id]);
    const m = r && r.photo && /^data:(image\/[a-z+]+);base64,(.*)$/.exec(r.photo);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]).set('Cache-Control', 'private, max-age=60').send(Buffer.from(m[2], 'base64'));
  });
  api.post('/equipment/:id/parts', (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Part name is required' });
    if (!okUrl(req.body.url)) return res.status(400).json({ error: 'Link must start with http:// or https://' });
    res.status(201).json({ id: run(`INSERT INTO parts_v2(equipment_id,${PF},created_at,updated_at) VALUES(?,${PF.map(() => '?')},?,?)`, [+req.params.id, ...pvals(req.body), now(), now()]) });
  });
  api.put('/parts/:id', (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Part name is required' });
    if (!okUrl(req.body.url)) return res.status(400).json({ error: 'Link must start with http:// or https://' });
    run(`UPDATE parts_v2 SET ${PF.map(f => f + '=?')},updated_at=? WHERE id=?`, [...pvals(req.body), now(), +req.params.id]);
    res.json({ ok: true });
  });
  api.delete('/parts/:id', (req, res) => { run('DELETE FROM parts_v2 WHERE id=?', [+req.params.id]); res.json({ ok: true }); });
  // ---- Editable lists ----
  const kindOk = (req, res, next) => LISTS[req.params.kind] ? next() : res.status(404).json({ error: 'Unknown list' });
  api.get('/lists', (req, res) => { const roles = {};
    for (const r of all("SELECT kind,value,role FROM lists WHERE role IS NOT NULL")) (roles[r.kind] = roles[r.kind] || {})[r.value] = r.role;
    res.json({ type: listVals('type'), category: listVals('category'), status: listVals('status'), stock: listVals('stock'), todo_status: listVals('todo_status'), priority: listVals('priority'), roles }); });
  api.get('/lists/:kind/usage', kindOk, (req, res) => { const L = LISTS[req.params.kind];
    res.json({ count: get(`SELECT COUNT(*) c FROM ${L.table} WHERE ${L.col}=? COLLATE NOCASE`, [String(req.query.value || '')]).c }); });
  api.post('/lists/:kind', kindOk, (req, res) => { const v = String(req.body.value || '').trim(); if (!v) return res.status(400).json({ error: 'Enter a name' });
    if (!addVal(req.params.kind, v)) return res.status(400).json({ error: `“${v}” is already in the list` }); save(); res.status(201).json({ ok: true }); });
  api.put('/lists/:kind', kindOk, (req, res) => { // rename; updates every record using the old value
    const k = req.params.kind, L = LISTS[k], from = String(req.body.from || ''), to = String(req.body.to || '').trim();
    const row = findVal(k, from); if (!row) return res.status(404).json({ error: 'Not found' }); if (!to) return res.status(400).json({ error: 'Enter a name' });
    const other = findVal(k, to);
    if (other && other.id !== row.id) db.run('DELETE FROM lists WHERE id=?', [row.id]); else db.run('UPDATE lists SET value=? WHERE id=?', [to, row.id]);
    db.run(`UPDATE ${L.table} SET ${L.col}=?, updated_at=? WHERE ${L.col}=? COLLATE NOCASE`, [other ? other.value : to, now(), from]);
    save(); res.json({ ok: true, merged: !!(other && other.id !== row.id) }); });
  api.put('/lists/:kind/order', kindOk, (req, res) => { (Array.isArray(req.body.values) ? req.body.values : []).forEach((v, i) => db.run('UPDATE lists SET pos=? WHERE kind=? AND value=?', [i, req.params.kind, v])); save(); res.json({ ok: true }); });
  api.delete('/lists/:kind', kindOk, admin, (req, res) => { // records using it are moved to `replace` (or blank)
    const k = req.params.kind, L = LISTS[k], v = String(req.query.value || '');
    if (!findVal(k, v)) return res.status(404).json({ error: 'Not found' });
    let rep = String(req.query.replace || '').trim() || null;
    if (L.required) { const rest = listVals(k).filter(x => x.toLowerCase() !== v.toLowerCase());
      if (!rest.length) return res.status(400).json({ error: 'Keep at least one ' + (k === 'priority' ? 'priority' : 'status') }); if (!rep) rep = rest[0]; }
    if (rep && rep.toLowerCase() === v.toLowerCase()) return res.status(400).json({ error: 'Pick a different replacement' });
    db.run('DELETE FROM lists WHERE kind=? AND value=? COLLATE NOCASE', [k, v]);
    db.run(`UPDATE ${L.table} SET ${L.col}=?, updated_at=? WHERE ${L.col}=? COLLATE NOCASE`, [rep, now(), v]);
    if (rep) addVal(k, rep); save(); res.json({ ok: true }); });

  // ---- To Do List (v10) ----
  const roleOf = (k, r) => (get('SELECT value FROM lists WHERE kind=? AND role=?', [k, r]) || {}).value;
  const TQ = `SELECT t.*, e.name equipment_name, e.unit equipment_unit FROM todos t LEFT JOIN equipment e ON e.id=t.equipment_id`;
  const tvals = b => { const s = String(b.status || '').trim() || roleOf('todo_status', 'open') || listVals('todo_status')[0] || 'Open';
    const p = String(b.priority || '').trim() || roleOf('priority', 'normal') || listVals('priority')[0] || 'Normal';
    addVal('todo_status', s); addVal('priority', p);
    return { title: String(b.title || '').trim(), notes: b.notes || null, status: s, priority: p, equipment_id: b.equipment_id ? +b.equipment_id : null, due_date: b.due_date || null }; };
  const doneAt = (s, prev) => (roleOf('todo_status', 'done') || '').toLowerCase() === s.toLowerCase() ? (prev || now()) : null;
  api.get('/todos', (req, res) => res.json(all(TQ + ' ORDER BY t.created_at DESC')));
  api.get('/todos/:id', (req, res) => { const t = get(TQ + ' WHERE t.id=?', [+req.params.id]); t ? res.json(t) : res.status(404).json({ error: 'Not found' }); });
  api.post('/todos', (req, res) => { const v = tvals(req.body); if (!v.title) return res.status(400).json({ error: 'Title is required' });
    res.status(201).json({ id: run('INSERT INTO todos(title,notes,status,priority,equipment_id,due_date,author,done_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [v.title, v.notes, v.status, v.priority, v.equipment_id, v.due_date, String(req.body.author || '').trim() || null, doneAt(v.status), now(), now()]) }); });
  api.put('/todos/:id', (req, res) => { const t = get('SELECT * FROM todos WHERE id=?', [+req.params.id]); if (!t) return res.status(404).json({ error: 'Not found' });
    const v = tvals(req.body); if (!v.title) return res.status(400).json({ error: 'Title is required' });
    run('UPDATE todos SET title=?,notes=?,status=?,priority=?,equipment_id=?,due_date=?,done_at=?,updated_at=? WHERE id=?', [v.title, v.notes, v.status, v.priority, v.equipment_id, v.due_date, doneAt(v.status, t.done_at), now(), t.id]); res.json({ ok: true }); });
  api.put('/todos/:id/done', (req, res) => { const t = get('SELECT * FROM todos WHERE id=?', [+req.params.id]); if (!t) return res.status(404).json({ error: 'Not found' });
    const s = req.body.done ? (roleOf('todo_status', 'done') || 'Done') : (roleOf('todo_status', 'open') || listVals('todo_status')[0] || 'Open'); addVal('todo_status', s);
    run('UPDATE todos SET status=?,done_at=?,updated_at=? WHERE id=?', [s, req.body.done ? now() : null, now(), t.id]); res.json({ ok: true, status: s }); });
  api.delete('/todos/:id', admin, (req, res) => { run('DELETE FROM todos WHERE id=?', [+req.params.id]); res.json({ ok: true }); });

  // ---- Loose shop parts ----
  const LF = ['name', 'part_number', 'manufacturer', 'category', 'stock', 'qty', 'reorder_level', 'bin', 'fits', 'supplier', 'notes', 'photo'];
  const lvals = b => LF.map(f => b[f] === '' || b[f] === undefined ? null : b[f]);
  api.get('/loose', (req, res) => res.json(all(`SELECT id,${LF.filter(f => f !== 'photo')},is_example,updated_at,(photo IS NOT NULL AND photo<>'') has_photo FROM loose_parts ORDER BY is_example, name COLLATE NOCASE`)));
  api.get('/loose/:id', (req, res) => { const p = get('SELECT * FROM loose_parts WHERE id=?', [+req.params.id]); p ? res.json(p) : res.status(404).json({ error: 'Not found' }); });
  api.get('/loose/:id/photo', (req, res) => {
    const r = get('SELECT photo FROM loose_parts WHERE id=?', [+req.params.id]);
    const m = r && r.photo && /^data:(image\/[a-z+]+);base64,(.*)$/.exec(r.photo);
    if (!m) return res.status(404).end();
    res.set('Content-Type', m[1]).set('Cache-Control', 'private, max-age=60').send(Buffer.from(m[2], 'base64'));
  });
  api.post('/loose', (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Part name is required' });
    addVal('category', req.body.category); addVal('stock', req.body.stock);
    res.status(201).json({ id: run(`INSERT INTO loose_parts(${LF},created_at,updated_at) VALUES(${LF.map(() => '?')},?,?)`, [...lvals(req.body), now(), now()]) });
  });
  api.put('/loose/:id', (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Part name is required' });
    addVal('category', req.body.category); addVal('stock', req.body.stock);
    run(`UPDATE loose_parts SET ${LF.map(f => f + '=?')},updated_at=? WHERE id=?`, [...lvals(req.body), now(), +req.params.id]); res.json({ ok: true });
  });
  api.post('/loose/:id/qty', (req, res) => {
    const d = Number(req.body.delta) || 0;
    run('UPDATE loose_parts SET qty=MAX(0,COALESCE(qty,0)+?),updated_at=? WHERE id=?', [d, now(), +req.params.id]);
    const p = get('SELECT qty FROM loose_parts WHERE id=?', [+req.params.id]); p ? res.json(p) : res.status(404).json({ error: 'Not found' });
  });
  api.delete('/loose/:id', admin, (req, res) => { run('DELETE FROM loose_parts WHERE id=?', [+req.params.id]); res.json({ ok: true }); });
  // Photo only update (equipment)
  api.put('/equipment/:id/photo', (req, res) => { run('UPDATE equipment SET photo=?,updated_at=? WHERE id=?', [req.body.photo || null, now(), +req.params.id]); res.json({ ok: true }); });

  // ---- Procedures: checklists ----
  const cleanItems = a => (Array.isArray(a) ? a : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 200);
  const ckOut = c => c && { ...c, items: JSON.parse(c.items || '[]') };
  api.get('/equipment/:id/checklists', (req, res) => res.json(all(`SELECT c.*, (SELECT COUNT(*) FROM inspections i WHERE i.checklist_id=c.id) inspection_count,
    (SELECT MAX(created_at) FROM inspections i WHERE i.checklist_id=c.id) last_done FROM checklists c WHERE equipment_id=? ORDER BY c.is_example, c.name COLLATE NOCASE`, [+req.params.id]).map(ckOut)));
  api.get('/checklists/:id', (req, res) => { const c = ckOut(get('SELECT * FROM checklists WHERE id=?', [+req.params.id])); c ? res.json(c) : res.status(404).json({ error: 'Not found' }); });
  api.post('/equipment/:id/checklists', (req, res) => {
    const name = String(req.body.name || '').trim(); if (!name) return res.status(400).json({ error: 'Checklist name is required' });
    if (!get('SELECT id FROM equipment WHERE id=?', [+req.params.id])) return res.status(404).json({ error: 'Not found' });
    res.status(201).json({ id: run('INSERT INTO checklists(equipment_id,name,items,created_at,updated_at) VALUES(?,?,?,?,?)', [+req.params.id, name, JSON.stringify(cleanItems(req.body.items)), now(), now()]) });
  });
  api.put('/checklists/:id', (req, res) => {
    const name = String(req.body.name || '').trim(); if (!name) return res.status(400).json({ error: 'Checklist name is required' });
    run('UPDATE checklists SET name=?,items=?,updated_at=? WHERE id=?', [name, JSON.stringify(cleanItems(req.body.items)), now(), +req.params.id]); res.json({ ok: true });
  });
  api.delete('/checklists/:id', admin, (req, res) => { run('DELETE FROM checklists WHERE id=?', [+req.params.id]); res.json({ ok: true }); });
  // inspections (completed runs of a checklist)
  const inOut = r => r && { ...r, results: JSON.parse(r.results || '[]') };
  api.get('/checklists/:id/inspections', (req, res) => res.json(all('SELECT * FROM inspections WHERE checklist_id=? ORDER BY created_at DESC, id DESC', [+req.params.id]).map(inOut)));
  api.post('/checklists/:id/inspections', (req, res) => {
    const c = get('SELECT * FROM checklists WHERE id=?', [+req.params.id]); if (!c) return res.status(404).json({ error: 'Not found' });
    const b = req.body, results = (Array.isArray(b.results) ? b.results : []).map(r => ({ item: String(r.item || ''), result: r.result === 'fail' ? 'fail' : r.result === 'pass' ? 'pass' : 'skip', note: String(r.note || '').trim() }));
    if (!b.performed_by) return res.status(400).json({ error: 'Your name is required' });
    if (!results.length) return res.status(400).json({ error: 'No items checked' });
    res.status(201).json({ id: run('INSERT INTO inspections(checklist_id,equipment_id,checklist_name,performed_by,date,meter,results,pass_count,fail_count,notes,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      [c.id, c.equipment_id, c.name, String(b.performed_by), b.date || now().slice(0, 10), b.meter === '' || b.meter == null ? null : +b.meter, JSON.stringify(results),
        results.filter(r => r.result === 'pass').length, results.filter(r => r.result === 'fail').length, b.notes || null, now()]) });
  });
  api.delete('/inspections/:id', admin, (req, res) => { run('DELETE FROM inspections WHERE id=?', [+req.params.id]); res.json({ ok: true }); });

  // ---- Procedures: manuals & documents (files on disk in DATA_DIR/docs, random names) ----
  const SAFE_INLINE = /^(application\/pdf|image\/(png|jpeg|gif|webp|heic|heif)|text\/plain)$/;
  const docPath = n => path.join(DOCS_DIR, path.basename(n));
  api.get('/equipment/:id/docs', (req, res) => res.json(all('SELECT id,equipment_id,title,filename,mime,size,uploaded_by,created_at,updated_at FROM documents WHERE equipment_id=? ORDER BY title COLLATE NOCASE', [+req.params.id])));
  api.post('/equipment/:id/docs', express.raw({ type: () => true, limit: MAX_DOC }), (req, res) => {
    const title = String(req.query.title || '').trim(), filename = path.basename(String(req.query.filename || 'file')).slice(0, 200);
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ error: 'No file received' });
    if (!get('SELECT id FROM equipment WHERE id=?', [+req.params.id])) return res.status(404).json({ error: 'Not found' });
    const mime = String(req.query.type || 'application/octet-stream').split(';')[0].trim().toLowerCase();
    const ext = (path.extname(filename).toLowerCase().match(/^\.[a-z0-9]{1,8}$/) || [''])[0];
    const stored = require('crypto').randomBytes(24).toString('hex') + ext;
    fs.writeFileSync(docPath(stored), req.body);
    res.status(201).json({ id: run('INSERT INTO documents(equipment_id,title,filename,stored_name,mime,size,uploaded_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',
      [+req.params.id, title, filename, stored, mime, req.body.length, String(req.query.by || '') || null, now(), now()]) });
  });
  api.get('/docs/:id/file', (req, res) => {
    const d = get('SELECT * FROM documents WHERE id=?', [+req.params.id]);
    if (!d || !fs.existsSync(docPath(d.stored_name))) return res.status(404).json({ error: 'Not found' });
    const inline = SAFE_INLINE.test(d.mime || '');
    res.set('Content-Type', inline ? d.mime : 'application/octet-stream').set('X-Content-Type-Options', 'nosniff').set('Cache-Control', 'private, no-store')
      .set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(d.filename || 'file')}`).set('Content-Length', String(fs.statSync(docPath(d.stored_name)).size));
    fs.createReadStream(docPath(d.stored_name)).pipe(res);
  });
  api.put('/docs/:id', (req, res) => {
    const title = String(req.body.title || '').trim(); if (!title) return res.status(400).json({ error: 'Title is required' });
    run('UPDATE documents SET title=?,updated_at=? WHERE id=?', [title, now(), +req.params.id]); res.json({ ok: true });
  });
  api.delete('/docs/:id', admin, (req, res) => {
    const d = get('SELECT stored_name FROM documents WHERE id=?', [+req.params.id]);
    run('DELETE FROM documents WHERE id=?', [+req.params.id]);
    if (d) fs.rm(docPath(d.stored_name), { force: true }, () => {});
    res.json({ ok: true });
  });

  app.use('/api', api);
  app.use((err, req, res, next) => err && err.type === 'entity.too.large' ? res.status(413).json({ error: 'File is too big (max 25 MB)' }) : next(err));
  app.listen(PORT, () => console.log(`Fleet Files on :${PORT}`));
})();
