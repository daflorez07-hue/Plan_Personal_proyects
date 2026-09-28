// Servidor local que imita el despliegue de Vercel: sirve dist/web y las funciones de /api.
// Uso: node build.js && PG_TEST_URL=postgres://… node test/dev-server.js [puerto]
// Con PG_TEST_URL usa un Postgres local en lugar de Neon (mismo SQL). Con CAL_FIXTURE,
// la dirección https://calendario.prueba/… devuelve ese archivo .ics (para pruebas).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const PORT = +(process.argv[2] || process.env.PORT || 4173);

if (process.env.PG_TEST_URL) {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.PG_TEST_URL });
  const fake = { neon: () => ({ query: (t, p) => pool.query(t, p).then((r) => r.rows) }) };
  const orig = Module._load;
  Module._load = function (req, ...rest) { return req === '@neondatabase/serverless' ? fake : orig.call(this, req, ...rest); };
  process.env.DATABASE_URL = process.env.PG_TEST_URL;
}
if (process.env.CAL_FIXTURE) {
  const text = fs.readFileSync(process.env.CAL_FIXTURE, 'utf8');
  const realFetch = global.fetch;
  global.fetch = (u, o) => String(u).startsWith('https://calendario.prueba/')
    ? Promise.resolve(new Response(text, { status: 200, headers: { 'content-type': 'text/calendar' } }))
    : realFetch(u, o);
  process.env.CALENDAR_ICS_URL = process.env.CALENDAR_ICS_URL || 'https://calendario.prueba/secreto.ics';
}

const handlers = { '/api/db': require('../api/db.js'), '/api/calendar': require('../api/calendar.js') };

http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const h = handlers[u.pathname];
  if (h) {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', async () => {
      const query = Object.fromEntries(u.searchParams);
      let body = null; try { body = raw ? JSON.parse(raw) : null; } catch (e) { body = null; }
      const out = { code: 200, headers: { 'content-type': 'application/json; charset=utf-8' } };
      const r = {
        setHeader: (k, v) => { out.headers[k.toLowerCase()] = v; },
        status: (c) => { out.code = c; return r; },
        json: (b) => { res.writeHead(out.code, out.headers); res.end(JSON.stringify(b)); return r; }
      };
      try { await h({ method: req.method, headers: req.headers, query, body }, r); }
      catch (e) { console.error(e); res.writeHead(500); res.end('{}'); }
    });
    return;
  }
  const file = path.join(ROOT, 'dist/web', u.pathname === '/' ? 'index.html' : u.pathname);
  if (!file.startsWith(path.join(ROOT, 'dist/web')) || !fs.existsSync(file)) { res.writeHead(404); res.end('no'); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log('Derrotero local en http://localhost:' + PORT));
