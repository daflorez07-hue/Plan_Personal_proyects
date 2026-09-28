// Prueba la función /api/db contra un Postgres real (el mismo SQL que corre en Neon).
// Se ejecuta solo si hay PG_TEST_URL, p. ej.: PG_TEST_URL=postgres://tester@localhost:54329/postgres
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const URL_ = process.env.PG_TEST_URL;

test('api/db sobre Postgres real', { skip: !URL_ && 'sin PG_TEST_URL' }, async () => {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: URL_ });
  await pool.query('drop table if exists derrotero_docs; drop sequence if exists derrotero_seq');
  // Adaptador con la misma interfaz que @neondatabase/serverless: neon(url).query(text, params) → filas
  const fake = { neon: () => ({ query: (text, params) => pool.query(text, params).then((r) => r.rows) }) };
  const origLoad = Module._load;
  Module._load = function (req, ...rest) { return req === '@neondatabase/serverless' ? fake : origLoad.call(this, req, ...rest); };
  process.env.DATABASE_URL = URL_;
  delete require.cache[require.resolve('../api/db.js')];
  const handler = require('../api/db.js');

  async function call(method, query, body) {
    const r = { code: 0, body: null, headers: {} };
    r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; };
    await handler({ method, query: query || {}, body, headers: { 'x-derrotero': '1', 'content-type': 'application/json' } }, r);
    return r;
  }
  try {
    let r = await call('GET', { op: 'status' });
    assert.equal(r.body.configured, true); assert.equal(r.body.rev, '0');
    r = await call('POST', {}, { op: 'set', coll: 'tasks', id: 't01', data: { id: 't01', title: 'Uno', status: 'pendiente' } });
    assert.equal(r.code, 200);
    const rev1 = r.body.rev;
    r = await call('POST', {}, { op: 'batch', ops: [
      { op: 'set', coll: 'tasks', id: 't02', data: { id: 't02', title: 'Dos' } },
      { op: 'set', coll: 'config', id: 'main', data: { planStart: '2026-09-25' } },
      { op: 'set', coll: 'audit', id: '2026-09-28', data: { day: '2026-09-28', entries: [] } },
      { op: 'set', coll: 'audit', id: '2020-01-01', data: { day: '2020-01-01', entries: [] } },
      { op: 'set', coll: 'tasks', id: 't01', data: { id: 't01', title: 'Uno editado' } }
    ] });
    assert.ok(BigInt(r.body.rev) > BigInt(rev1));
    r = await call('GET', { op: 'all' });
    assert.equal(r.body.docs.tasks.t01.title, 'Uno editado');
    assert.equal(r.body.docs.config.main.planStart, '2026-09-25');
    assert.ok(r.body.docs.audit['2026-09-28']);
    assert.ok(!r.body.docs.audit['2020-01-01'], 'la bitácora vieja no viaja al cliente');
    assert.ok(!('backups' in r.body.docs));
    const revBefore = r.body.rev;
    r = await call('POST', {}, { op: 'del', coll: 'tasks', id: 't02' });
    assert.ok(BigInt(r.body.rev) > BigInt(revBefore), 'borrar también cambia la revisión');
    r = await call('GET', { op: 'all' });
    assert.ok(!r.body.docs.tasks.t02);
    r = await call('POST', {}, { op: 'set', coll: 'backups', id: '2026-09-28', data: { day: '2026-09-28', data: {} } });
    r = await call('GET', { op: 'get', coll: 'backups', id: '2026-09-28' });
    assert.equal(r.body.exists, true);
    r = await call('GET', { op: 'list', coll: 'backups' });
    assert.equal(r.body.docs.length, 1);
    // validaciones
    r = await call('POST', {}, { op: 'set', coll: 'otra', id: 'x', data: {} }); assert.equal(r.code, 400);
    r = await call('POST', {}, { op: 'set', coll: 'tasks', id: '../x', data: {} }); assert.equal(r.code, 400);
    r = await call('POST', {}, { op: 'set', coll: 'tasks', id: 'big', data: { s: 'x'.repeat(1000 * 1024) } }); assert.equal(r.code, 413);
    r = await call('PUT', {}, {}); assert.equal(r.code, 405);
  } finally {
    Module._load = origLoad;
    delete process.env.DATABASE_URL;
    await pool.end();
  }
});
