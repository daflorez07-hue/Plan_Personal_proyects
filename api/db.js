// Derrotero · base de datos de documentos sobre Postgres (Neon, plan gratuito).
// La conexión llega por la variable DATABASE_URL (o POSTGRES_URL) que crea la
// integración de Neon en Vercel. Ninguna credencial vive en el código.
const guard = require('./_guard');

const COLLS = ['config', 'tasks', 'kpis', 'kpi_events', 'decisions', 'habits', 'habit_logs', 'blocks', 'lab', 'agenda', 'audit', 'backups'];
const LIVE = COLLS.filter((c) => c !== 'backups');
const ID_RE = /^[A-Za-z0-9_.:-]{1,80}$/;
const MAX_DOC = 900 * 1024;

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
let sql = null;
let ready = null;

function db() {
  if (!sql) {
    const { neon } = require('@neondatabase/serverless');
    sql = neon(url);
  }
  if (!ready) {
    ready = (async () => {
      await sql.query('create sequence if not exists derrotero_seq');
      await sql.query(`create table if not exists derrotero_docs (
        coll text not null,
        id text not null,
        data jsonb,
        deleted boolean not null default false,
        seq bigint not null default nextval('derrotero_seq'),
        updated_at timestamptz not null default now(),
        primary key (coll, id))`);
      await sql.query('create index if not exists derrotero_docs_seq on derrotero_docs (seq)');
    })().catch((e) => { ready = null; throw e; });
  }
  return ready.then(() => sql);
}

async function rev(q) {
  const r = await q.query('select coalesce(max(seq), 0)::text as rev from derrotero_docs');
  return r[0].rev;
}

function validColl(c) { return COLLS.indexOf(c) >= 0; }

async function upsert(q, coll, id, data) {
  await q.query(
    `insert into derrotero_docs (coll, id, data, deleted, seq, updated_at)
     values ($1, $2, $3::jsonb, false, nextval('derrotero_seq'), now())
     on conflict (coll, id) do update set data = excluded.data, deleted = false, seq = nextval('derrotero_seq'), updated_at = now()`,
    [coll, id, JSON.stringify(data)]
  );
}

module.exports = async function handler(req, res) {
  if (!guard(req, res)) return;
  if (!url) { res.status(200).json({ configured: false }); return; }
  let q;
  try { q = await db(); } catch (e) {
    console.error('db init', e);
    res.status(503).json({ configured: true, error: 'db_unavailable' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const op = req.query.op || 'status';
      if (op === 'status') { res.status(200).json({ configured: true, rev: await rev(q) }); return; }
      if (op === 'rev') { res.status(200).json({ rev: await rev(q) }); return; }
      if (op === 'all') {
        const r0 = await rev(q);
        // La bitácora pesa: solo los últimos 62 días (un documento por día).
        const rows = await q.query(
          `select coll, id, data from derrotero_docs
           where not deleted and coll = any($1::text[])
             and (coll <> 'audit' or id >= to_char((now() at time zone 'America/Bogota')::date - 62, 'YYYY-MM-DD'))`,
          [LIVE]
        );
        const docs = {};
        LIVE.forEach((c) => { docs[c] = {}; });
        rows.forEach((r) => { docs[r.coll][r.id] = r.data; });
        res.status(200).json({ rev: r0, docs });
        return;
      }
      if (op === 'list') {
        const coll = req.query.coll;
        if (!validColl(coll)) { res.status(400).json({ error: 'bad_coll' }); return; }
        const rows = await q.query('select id, data from derrotero_docs where coll = $1 and not deleted order by id desc limit 100', [coll]);
        res.status(200).json({ docs: rows });
        return;
      }
      if (op === 'get') {
        const coll = req.query.coll; const id = req.query.id;
        if (!validColl(coll) || !ID_RE.test(id || '')) { res.status(400).json({ error: 'bad_ref' }); return; }
        const rows = await q.query('select data from derrotero_docs where coll = $1 and id = $2 and not deleted', [coll, id]);
        res.status(200).json(rows.length ? { exists: true, data: rows[0].data } : { exists: false });
        return;
      }
      res.status(400).json({ error: 'bad_op' });
      return;
    }
    if (req.method === 'POST') {
      if (!/application\/json/.test(req.headers['content-type'] || '')) { res.status(415).json({ error: 'json_only' }); return; }
      const body = req.body || {};
      const ops = body.op === 'batch' ? body.ops : [body];
      if (!Array.isArray(ops) || !ops.length || ops.length > 500) { res.status(400).json({ error: 'bad_batch' }); return; }
      for (const o of ops) {
        if (!o || !validColl(o.coll) || !ID_RE.test(o.id || '') || (o.op !== 'set' && o.op !== 'del')) { res.status(400).json({ error: 'bad_op' }); return; }
        if (o.op === 'set') {
          if (!o.data || typeof o.data !== 'object') { res.status(400).json({ error: 'bad_data' }); return; }
          if (JSON.stringify(o.data).length > MAX_DOC) { res.status(413).json({ error: 'too_large' }); return; }
        }
      }
      for (const o of ops) {
        if (o.op === 'set') await upsert(q, o.coll, o.id, o.data);
        else await q.query(`update derrotero_docs set data = null, deleted = true, seq = nextval('derrotero_seq'), updated_at = now() where coll = $1 and id = $2`, [o.coll, o.id]);
      }
      res.status(200).json({ ok: true, rev: await rev(q) });
      return;
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'method' });
  } catch (e) {
    console.error('db', e);
    res.status(500).json({ error: 'server' });
  }
};
