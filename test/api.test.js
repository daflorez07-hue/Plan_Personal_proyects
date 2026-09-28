// Pruebas de las funciones de Vercel: guardia, base sin configurar y lectura del calendario.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function fakeRes() {
  const r = { code: 0, body: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = (c) => { r.code = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
}

test('guardia: sin encabezado propio se rechaza', async () => {
  delete require.cache[require.resolve('../api/db.js')];
  const db = require('../api/db.js');
  const res = fakeRes();
  await db({ method: 'GET', headers: {}, query: {} }, res);
  assert.equal(res.code, 403);
});

test('base de datos sin configurar responde configured:false', async () => {
  delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;
  delete require.cache[require.resolve('../api/db.js')];
  const db = require('../api/db.js');
  const res = fakeRes();
  await db({ method: 'GET', headers: { 'x-derrotero': '1' }, query: { op: 'status' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.configured, false);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('calendario: sin dirección configurada', async () => {
  delete process.env.CALENDAR_ICS_URL;
  delete require.cache[require.resolve('../api/calendar.js')];
  const cal = require('../api/calendar.js');
  const res = fakeRes();
  await cal({ method: 'GET', headers: { 'x-derrotero': '1' }, query: {} }, res);
  assert.deepEqual(res.body, { configured: false, events: [] });
});

test('calendario: expande repeticiones, excepciones y husos horarios', () => {
  const ical = require('node-ical');
  const { expand } = require('../api/calendar.js');
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'calendario.ics'), 'utf8');
  const ev = expand(ical, text, 0, new Date('2026-09-01'), new Date('2026-12-31'));
  const byTitle = (t) => ev.filter((e) => e.title === t);
  assert.deepEqual(byTitle('Reunión con cliente').map((e) => e.date + ' ' + e.time), ['2026-09-29 15:00']);
  assert.deepEqual(byTitle('Llamada UTC').map((e) => e.time), ['08:00']);
  assert.deepEqual(byTitle('Día completo').map((e) => [e.date, e.allDay, e.endDate]), [['2026-10-02', true, '2026-10-02']]);
  assert.deepEqual(byTitle('Ticket alto semanal').map((e) => e.date), ['2026-09-28', '2026-10-12', '2026-10-19']);
  assert.ok(ev.every((e) => !('description' in e) && !('location' in e)));
});

test('calendario: lee la dirección del servidor y no la expone', async () => {
  const text = fs.readFileSync(path.join(__dirname, 'fixtures', 'calendario.ics'), 'utf8');
  const srv = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/calendar' }); res.end(text); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const { port } = srv.address();
  // El servidor de prueba es http local; la función exige https, así que se prueba el rechazo.
  process.env.CALENDAR_ICS_URL = 'http://127.0.0.1:' + port + '/secreto.ics';
  delete require.cache[require.resolve('../api/calendar.js')];
  const cal = require('../api/calendar.js');
  const res = fakeRes();
  await cal({ method: 'GET', headers: { 'x-derrotero': '1' }, query: {} }, res);
  srv.close();
  assert.equal(res.body.configured, false);
  assert.ok(!JSON.stringify(res.body).includes('secreto'));
  delete process.env.CALENDAR_ICS_URL;
});
