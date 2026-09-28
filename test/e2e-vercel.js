// Extremo a extremo del despliegue en Vercel: base Postgres, calendario, tablero y dos dispositivos.
// Uso: node build.js && PG_TEST_URL=postgres://… NODE_PATH=$(npm root -g) node test/e2e-vercel.js
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const SHOTS = process.env.SHOTS;
const PORT = 4173;
const URL_ = 'http://localhost:' + PORT + '/';

(async () => {
  const pool = new Pool({ connectionString: process.env.PG_TEST_URL });
  await pool.query('drop table if exists derrotero_docs; drop sequence if exists derrotero_seq');
  const srv = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(PORT)], {
    env: Object.assign({}, process.env, { CAL_FIXTURE: path.join(__dirname, 'fixtures', 'calendario-rico.ics') }), stdio: ['ignore', 'pipe', 'inherit']
  });
  await new Promise((r) => srv.stdout.once('data', r));
  const ok = (n) => console.log('ok -', n);
  const browser = await chromium.launch();
  const errors = [];
  async function device(viewport) {
    const ctx = await browser.newContext({ viewport });
    await ctx.clock.install({ time: new Date('2026-09-28T15:13:00-05:00') });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)|cdnjs/, (r) => r.abort());
    return page;
  }
  try {
    const a = await device({ width: 1440, height: 900 });
    await a.goto(URL_);
    await a.waitForSelector('text=La base de datos está vacía');
    await a.click('[data-act="load-seed"]');
    await a.waitForSelector('.dash');
    await a.waitForSelector('.toast >> text=Registrado por Claude', { timeout: 8000 });
    await a.waitForTimeout(1500);
    const n = await pool.query("select count(*)::int as n from derrotero_docs where coll = 'tasks' and not deleted");
    assert.equal(n.rows[0].n, 34);
    const cfg = await pool.query("select data->'inboxApplied' as ia from derrotero_docs where coll = 'config' and id = 'main'");
    assert.equal(cfg.rows[0].ia.length, 5);
    await a.evaluate(() => document.querySelectorAll('[data-act="toast-close"]').forEach((b) => b.click()));
    assert.match(await a.textContent('#conn'), /Postgres · en línea/);
    ok('base vacía → plan base + 5 pendientes de la conversación en Postgres (34), una sola vez');

    await a.waitForFunction(() => /Conectado/.test(document.querySelector('#conn').textContent), null, { timeout: 10000 });
    await a.waitForFunction(() => document.querySelectorAll('svg.road-svg line[stroke="#4B5FB0"]').length > 20, null, { timeout: 10000 });
    assert.match(await a.textContent('.rd-legend'), /Calendario \d+/);
    ok('calendario conectado: eventos sobre el camino');

    await a.waitForTimeout(3200);
    if (SHOTS) await a.screenshot({ path: SHOTS + '/vercel-hoy-desktop.png', fullPage: true });
    const hit = a.locator('svg.road-svg g.rd-hit[data-act="goto-task"]').nth(6);
    await hit.hover();
    await a.waitForSelector('.tip:not([hidden])');
    assert.match(await a.textContent('.tip'), /actividad/);
    ok('ayuda emergente sobre los hitos del camino');

    await a.fill('#top-cap', 'El jueves a las 10 primera sesión de entendimiento con cliente');
    await a.click('[data-act="top-parse"]');
    await a.waitForSelector('#draft');
    assert.equal(await a.inputValue('#d-title'), 'Primera sesión de entendimiento con cliente');
    await a.click('[data-act="draft-save"]');
    await a.waitForFunction(async () => true);
    await a.waitForTimeout(1500);
    const ag = await pool.query("select data from derrotero_docs where coll = 'agenda' and not deleted");
    assert.equal(ag.rows.length, 1);
    assert.equal(ag.rows[0].data.date, '2026-10-01');
    ok('dictado → guardado en Postgres');

    const b = await device({ width: 390, height: 844 });
    await b.goto(URL_ + '#agenda');
    await b.waitForSelector('text=Primera sesión de entendimiento con cliente');
    ok('otro dispositivo ve lo dictado');

    await b.evaluate(() => { location.hash = 'hoy'; });
    await b.waitForSelector('svg.road-svg.vertical');
    await b.waitForTimeout(3000);
    if (SHOTS) await b.screenshot({ path: SHOTS + '/vercel-hoy-390.png', fullPage: true });
    await b.click('.hring[data-id="h2"]');
    await a.evaluate(() => { location.hash = 'hoy'; });
    await a.waitForFunction(() => document.querySelector('.hring[data-id="h2"]') && document.querySelector('.hring[data-id="h2"]').classList.contains('on'), null, { timeout: 30000 });
    ok('cambio en el celular llega al computador (sondeo)');

    for (const r of ['hoy', 'agenda', 'actividades', 'indicadores', 'habitos', 'semana', 'frentes', 'laboratorio', 'resumen', 'bitacora', 'ajustes']) {
      await b.evaluate((r) => { location.hash = r; }, r);
      await b.waitForTimeout(150);
      const over = await b.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(over <= 0, r + ' desborda ' + over + 'px en 390');
    }
    if (SHOTS) { await b.evaluate(() => { location.hash = 'ajustes'; }); await b.waitForTimeout(200); await b.screenshot({ path: SHOTS + '/vercel-ajustes-390.png', fullPage: true }); }
    ok('390 px sin desplazamiento horizontal');

    await a.evaluate(() => { location.hash = 'agenda'; });
    await a.click('[data-act="ag-view"][data-v="mes"]');
    assert.ok(await a.locator('.month .ev.cal').count() > 3);
    if (SHOTS) await a.screenshot({ path: SHOTS + '/vercel-agenda-mes.png', fullPage: true });
    ok('agenda en mes con eventos del calendario');

    await a.reload();
    await a.waitForFunction(() => /Postgres/.test(document.querySelector('#conn').textContent) && document.querySelector('main .ag-day'));
    assert.deepEqual(errors, []);
    ok('sin errores de JavaScript');
  } finally {
    await browser.close();
    srv.kill();
    await pool.end();
  }
})().catch((e) => { console.error('FALLA:', e.message); process.exit(1); });
