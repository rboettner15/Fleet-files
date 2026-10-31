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
    const id = run(`INSERT INTO equipment(${F},created_at,updated_at) VALUES(${F.map(() => '?')},?,?)`, [...vals(req.body), now(), now()]);
    res.status(201).json({ id });
  });
  api.put('/equipment/:id', (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Name is required' });
    run(`UPDATE equipment SET ${F.map(f => f + '=?')},updated_at=? WHERE id=?`, [...vals(req.body), now(), +req.params.id]);
    res.json({ ok: true });
  });
  api.delete('/equipment/:id', admin, (req, res) => { run('DELETE FROM equipment WHERE id=?', [+req.params.id]); res.json({ ok: true }); });

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
  // Photo only update (equipment)
  api.put('/equipment/:id/photo', (req, res) => { run('UPDATE equipment SET photo=?,updated_at=? WHERE id=?', [req.body.photo || null, now(), +req.params.id]); res.json({ ok: true }); });

  app.use('/api', api);
  app.listen(PORT, () => console.log(`Fleet Files on :${PORT}`));
})();
