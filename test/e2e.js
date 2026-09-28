// Pruebas de extremo a extremo (criterios de aceptación 1–3, 5, 6 y 8) sobre dist/derrotero.local.html en modo local.
// Uso: node build.js && NODE_PATH=$(npm root -g) node test/e2e.js
const { chromium } = require('playwright');
const path = require('path');
const assert = require('assert/strict');
const url = 'file://' + path.resolve(__dirname, '../dist/derrotero.local.html');
const SHOTS = process.env.SHOTS;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-09-25T10:00:00-05:00'));
  await page.route(/fonts\.(googleapis|gstatic)|cdnjs/, (r) => r.abort());
  await page.goto(url);
  const ok = (name) => console.log('ok -', name);

  // 1. semilla
  await page.waitForSelector('.dash');
  const stats = await page.textContent('.dash');
  assert.match(stats, /10\s*%/); assert.match(stats, /3\/29 hechas/);
  assert.ok(await page.locator('svg.road-svg #walker').count() === 1, 'quien camina está en el camino');
  assert.ok(await page.locator('svg.road-svg .rd-hit').count() >= 10, 'hitos del plan sobre el camino');
  if (SHOTS) await page.screenshot({ path: SHOTS + '/hoy-desktop.png', fullPage: true });
  await page.click('.side [data-route="actividades"]');
  assert.equal(await page.locator('.trow').count(), 29);
  ok('criterio 1: 29 actividades, 3 hechas, 10 %');

  // 2. ciclo de estado + bitácora
  await page.click('#task-t04 .st-btn');
  assert.match(await page.textContent('#task-t04'), /en curso/);
  await page.waitForTimeout(900);
  await page.click('.side [data-route="bitacora"]');
  const log = await page.textContent('main');
  assert.match(log, /pendiente/); assert.match(log, /en curso/);
  ok('criterio 2: pendiente → en curso queda en la bitácora');

  // 3. bloqueada protegida
  await page.click('.side [data-route="actividades"]');
  await page.click('#task-t05 .title-btn');
  await page.selectOption('#ts-t05', 'bloqueada');
  await page.click('[data-act="block"][data-id="t05"]');
  assert.match(await page.textContent('#tb-msg-t05'), /causa/);
  await page.fill('#tb-t05', 'Espera la agenda de IKM');
  await page.click('[data-act="block"][data-id="t05"]');
  await page.click('#task-t05 .st-btn');
  assert.match(await page.textContent('#task-t05 .inline-confirm'), /bloqueada/);
  assert.equal(await page.getAttribute('#task-t05 .st-btn', 'title'), 'bloqueada');
  await page.click('#task-t05 [data-act="confirm-cancel"]');
  ok('criterio 3: bloqueada exige causa y confirmación');

  // 5. indicador con movimiento fechado
  await page.click('.side [data-route="indicadores"]');
  await page.click('[data-act="kpi"][data-k="fundadores"][data-d="1"]');
  await page.waitForTimeout(900);
  assert.equal(await page.textContent('#kv-fundadores'), '1');
  const events = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('derrotero-local-v1')).kpi_events));
  assert.equal(events.length, 1); assert.equal(events[0].date, '2026-09-25'); assert.equal(events[0].value, 1);
  await page.click('[data-act="kpi"][data-k="fundadores"][data-d="-1"]');
  await page.click('[data-act="kpi"][data-k="fundadores"][data-d="-1"]').catch(() => {});
  assert.equal(await page.textContent('#kv-fundadores'), '0');
  ok('criterio 5: movimiento fechado y RN-05');

  // 6. RN-03
  await page.click('.side [data-route="frentes"]');
  await page.click('[data-act="mode"][data-id="empleo"][data-v="construir"]');
  assert.match(await page.textContent('#mode-warn'), /Máximo dos frentes/);
  await page.click('[data-act="mode-swap"][data-out="linkedin"]');
  const cfg = await page.evaluate(() => JSON.parse(localStorage.getItem('derrotero-local-v1')).config.main.fronts);
  assert.equal(cfg.empleo.mode, 'construir'); assert.equal(cfg.linkedin.mode, 'explorar');
  ok('criterio 6: advertencia RN-03 y cambio de frente');

  // agenda por voz (texto dictado)
  await page.click('.side [data-route="agenda"]');
  await page.fill('#cap-text', 'hoy a las 10:20 llamar a Cristian, recuérdame 15 minutos antes');
  await page.click('[data-act="parse"]');
  assert.equal(await page.inputValue('#d-time'), '10:20');
  assert.equal(await page.inputValue('#d-title'), 'Llamar a Cristian');
  await page.click('[data-act="draft-save"]');
  assert.match(await page.textContent('main'), /Llamar a Cristian/);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/agenda-desktop.png', fullPage: true });
  // recordatorio: a las 10:06 debe salir el aviso
  await page.clock.setFixedTime(new Date('2026-09-25T10:06:00-05:00'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => document.querySelector('.toast.remind'), null, { timeout: 20000 });
  assert.match(await page.textContent('.toast.remind'), /Llamar a Cristian/);
  // vencimiento: a las 10:55 ya pasó la hora (30 min)
  await page.clock.setFixedTime(new Date('2026-09-25T10:55:00-05:00'));
  await page.waitForFunction(() => document.querySelector('.toast.bad'), null, { timeout: 20000 });
  ok('agenda: frase → actividad, recordatorio y vencimiento');

  // 8. 360 px sin desplazamiento horizontal
  await page.setViewportSize({ width: 360, height: 780 });
  for (const r of ['hoy', 'agenda', 'actividades', 'indicadores', 'habitos', 'semana', 'frentes', 'laboratorio', 'resumen', 'bitacora', 'ajustes']) {
    await page.evaluate((r) => { location.hash = r; }, r);
    await page.waitForTimeout(120);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 0, r + ' desborda ' + over + 'px');
    if (SHOTS && (r === 'hoy' || r === 'agenda' || r === 'actividades')) await page.screenshot({ path: SHOTS + '/' + r + '-360.png', fullPage: true });
  }
  ok('criterio 8: 360 px sin desplazamiento horizontal');

  assert.deepEqual(errors, []);
  ok('sin errores de JavaScript');
  await browser.close();
})().catch((e) => { console.error('FALLA:', e.message); process.exit(1); });
