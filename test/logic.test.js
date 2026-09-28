const test = require('node:test');
const assert = require('node:assert/strict');
const DL = require('../src/logic.js');
const seed = require('../data/seed.json');

// Viernes 25 sep 2026, 10:00 a. m. en Bogotá
const NOW = Date.parse('2026-09-25T10:00:00-05:00');
const TODAY = '2026-09-25';
const tasks = Object.values(seed.tasks);

test('fechas en Bogotá', () => {
  assert.equal(DL.todayBogota(Date.parse('2026-09-26T03:00:00Z')), '2026-09-25'); // 10 p. m. en Bogotá
  assert.equal(DL.todayBogota(Date.parse('2026-09-26T05:00:00Z')), '2026-09-26');
  assert.equal(DL.weekday(TODAY), 5);
  assert.equal(DL.fmtDate('2026-10-02'), '2 oct 2026');
  assert.equal(DL.fmtTime('15:30'), '3:30 p. m.');
  assert.equal(DL.fmtTime('00:05'), '12:05 a. m.');
  assert.equal(DL.fmtCOP(45000000), '$45.000.000');
  assert.equal(DL.mondayOf(TODAY), '2026-09-21');
});

test('criterio 1: semilla con 29 actividades, 3 hechas, 10 %', () => {
  assert.equal(tasks.length, 29);
  const p = DL.progress(tasks);
  assert.equal(p.done, 3);
  assert.equal(p.pct, 10);
  // al 25 sep 2026 nada está vencido; al 3 oct vencen las de fecha 2 oct
  assert.equal(DL.overdueList(tasks, TODAY).length, 0);
  assert.equal(DL.overdueList(tasks, '2026-10-03').length, 5);
});

test('RN-01: vencida solo si la fecha es anterior a hoy y no está hecha', () => {
  assert.equal(DL.isOverdue({ due: '2026-09-24', status: 'pendiente' }, TODAY), true);
  assert.equal(DL.isOverdue({ due: '2026-09-25', status: 'pendiente' }, TODAY), false);
  assert.equal(DL.isOverdue({ due: '2026-09-24', status: 'hecha' }, TODAY), false);
  assert.equal(DL.isOverdue({ due: '', status: 'pendiente' }, TODAY), false);
});

test('criterios 2 y 3: ciclo rápido y bloqueada protegida (H-04)', () => {
  assert.equal(DL.nextStatus('pendiente'), 'en curso');
  assert.equal(DL.nextStatus('en curso'), 'hecha');
  assert.equal(DL.nextStatus('hecha'), 'pendiente');
  assert.equal(DL.nextStatus('bloqueada'), null);
  assert.equal(DL.validateStatusChange({}, 'bloqueada', '').ok, false);
  assert.equal(DL.validateStatusChange({}, 'bloqueada', 'Espera firma del contador').ok, true);
});

test('agenda: ejemplo de sesión con cliente', () => {
  const now = Date.parse('2026-09-28T20:13:00Z');
  const r = DL.parseAgenda('El jueves a las 10 primera sesión de entendimiento con cliente, recuérdame 30 minutos antes', now);
  assert.equal(r.title, 'Primera sesión de entendimiento con cliente');
  assert.equal(r.date, '2026-10-01');
  assert.equal(r.time, '10:00');
  assert.equal(r.remindMin, 30);
});

test('criterio 5 y RN-05: indicadores nunca bajan de cero', () => {
  assert.deepEqual(DL.applyKpiDelta(0, -1), { value: 0, applied: 0 });
  assert.deepEqual(DL.applyKpiDelta(2, 3), { value: 5, applied: 3 });
  const series = DL.kpiSeries([{ kpi: 'fundadores', delta: 1, value: 1, date: '2026-10-01', at: 1 }], 'fundadores', '2026-09-25');
  assert.equal(series.length, 2);
  assert.equal(series[1].value, 1);
});

test('criterio 6: RN-03 máximo dos frentes en construir', () => {
  const fronts = Object.values(seed.config.fronts);
  const r = DL.checkModeChange(fronts, 'empleo', 'construir');
  assert.equal(r.ok, false);
  assert.equal(r.current.length, 2);
  assert.equal(DL.checkModeChange(fronts, 'linkedin', 'construir').ok, true);
  assert.equal(DL.checkModeChange(fronts, 'empleo', 'explorar').ok, true);
});

test('reordenar dentro de una etapa', () => {
  const r = DL.reorder(tasks, 'inmediato', 't10', 't04', false);
  assert.equal(r.find(x => x.id === 't10').order, 4);
  assert.equal(r.find(x => x.id === 't04').order, 5);
  assert.equal(r.length, 10);
});

test('hábitos: periodo y racha', () => {
  const daily = { freq: 'diario', target: 1, days: [1, 2, 3, 4, 5] };
  const logs = { '2026-09-21': true, '2026-09-22': true, '2026-09-23': true, '2026-09-24': true, '2026-09-18': true, '2026-09-25': true };
  assert.equal(DL.habitStreak(daily, logs, TODAY), 6); // salta sábado y domingo
  const weekly = { freq: 'semanal', target: 2 };
  assert.equal(DL.habitStatus(weekly, { '2026-09-23': true }, TODAY).done, false);
  assert.equal(DL.habitStatus(weekly, { '2026-09-23': true, '2026-09-25': true }, TODAY).done, true);
  assert.equal(DL.periodKey('quincenal', '2026-09-16'), '2026-09-Q2');
});

test('RN-04: laboratorio sin decisión al cerrar el trimestre', () => {
  assert.equal(DL.labNeedsDecision({ quarter: '2027-T1' }, '2027-04-01'), true);
  assert.equal(DL.labNeedsDecision({ quarter: '2027-T1', decision: 'sigue' }, '2027-04-01'), false);
  assert.equal(DL.quarterEnd('2027-T1'), '2027-03-31');
});

test('agenda: frases dictadas', () => {
  let p = DL.parseAgenda('Mañana a las 3 de la tarde reunión con Cristian, recuérdame 30 minutos antes', NOW);
  assert.equal(p.date, '2026-09-26');
  assert.equal(p.time, '15:00');
  assert.equal(p.remindMin, 30);
  assert.equal(p.title, 'Reunión con Cristian');
  assert.equal(p.front, 'Negocio propio');

  p = DL.parseAgenda('Agrégame el lunes a las 10:30 llamar al contador', NOW);
  assert.equal(p.date, '2026-09-28');
  assert.equal(p.time, '10:30');
  assert.equal(p.title, 'Llamar al contador');

  p = DL.parseAgenda('llamar al headhunter en 20 minutos', NOW);
  assert.equal(p.date, TODAY);
  assert.equal(p.time, '10:20');
  assert.equal(p.front, 'Empleo');

  p = DL.parseAgenda('El 15 de octubre visitar predio en Supatá en la mañana', NOW);
  assert.equal(p.date, '2026-10-15');
  assert.equal(p.time, '09:00');
  assert.equal(p.front, 'Finca');
  assert.ok(p.assumptions.length >= 1);

  p = DL.parseAgenda('publicar post de LinkedIn a las 12 del mediodía por media hora', NOW);
  assert.equal(p.time, '12:00');
  assert.equal(p.durationMin, 30);
  assert.equal(p.front, 'LinkedIn');

  p = DL.parseAgenda('pagar la administración el viernes', NOW);
  assert.equal(p.date, '2026-10-02'); // hoy es viernes: el siguiente
  assert.equal(p.time, '');
  assert.equal(p.title, 'Pagar la administración');

  p = DL.parseAgenda('revisar portafolio a las 8 y media de la noche', NOW);
  assert.equal(p.time, '20:30');
  assert.equal(p.front, 'Activos');

  p = DL.parseAgenda('comité a las 4', NOW);
  assert.equal(p.time, '16:00');
  assert.ok(p.assumptions.some(a => /p\. m\./.test(a)));

  p = DL.parseAgenda('enviar oferta a las 9', NOW); // 9 a. m. ya pasó → mañana
  assert.equal(p.date, '2026-09-26');
  assert.equal(p.time, '09:00');

  p = DL.parseAgenda('cita médica 5/11 a las 7 am', NOW);
  assert.equal(p.title, 'Cita médica');
  assert.equal(p.date, '2026-11-05');
  assert.equal(p.time, '07:00');
});

test('agenda: estados, recordatorio y vencimiento', () => {
  const it = { id: 'a1', title: 'Llamada', date: TODAY, time: '11:00', durationMin: 30, remindMin: 15 };
  assert.equal(DL.agendaState(it, Date.parse('2026-09-25T10:00:00-05:00')), 'programada');
  assert.equal(DL.agendaState(it, Date.parse('2026-09-25T10:50:00-05:00')), 'por recordar');
  assert.equal(DL.agendaState(it, Date.parse('2026-09-25T11:10:00-05:00')), 'en curso');
  assert.equal(DL.agendaState(it, Date.parse('2026-09-25T11:31:00-05:00')), 'vencida');
  assert.equal(DL.agendaState({ ...it, done: true }, Date.parse('2026-09-25T12:00:00-05:00')), 'hecha');
  const r = DL.dueReminders([it], Date.parse('2026-09-25T10:46:00-05:00'), {});
  assert.equal(r.length, 1);
  assert.equal(r[0].kind, 'recordar');
  assert.equal(DL.dueReminders([it], Date.parse('2026-09-25T10:46:00-05:00'), { [r[0].key]: 1 }).length, 0);
  const v = DL.dueReminders([it], Date.parse('2026-09-25T11:40:00-05:00'), {});
  assert.equal(v[0].kind, 'vencida');
  const allDay = { id: 'a2', title: 'Pagar', date: TODAY, time: '', remindMin: 0 };
  assert.equal(DL.agendaState(allDay, Date.parse('2026-09-25T23:00:00-05:00')), 'en curso');
  assert.equal(DL.agendaState(allDay, Date.parse('2026-09-26T00:01:00-05:00')), 'vencida');
  assert.deepEqual(DL.postpone(it, '1h', Date.parse('2026-09-25T10:00:00-05:00')), { date: TODAY, time: '12:00' });
});

test('calendario: .ics con alarma y enlace de Google', () => {
  const it = { id: 'a1', title: 'Reunión, con Cristian', date: '2026-09-26', time: '15:00', durationMin: 60, remindMin: 30, front: 'Negocio propio' };
  const ics = DL.agendaIcs([it], NOW);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /DTSTART:20260926T200000Z/);
  assert.match(ics, /DTEND:20260926T210000Z/);
  assert.match(ics, /TRIGGER:-PT30M/);
  assert.match(ics, /SUMMARY:Reunión\\, con Cristian/);
  const url = DL.googleCalendarUrl(it);
  assert.match(url, /dates=20260926T200000Z\/20260926T210000Z/);
  const week = DL.weekIcs([{ id: 'b1', day: 1, start: '17:00', end: '18:00', title: 'Ticket alto' }], TODAY, NOW);
  assert.match(week, /RRULE:FREQ=WEEKLY;BYDAY=MO/);
  assert.match(week, /DTSTART:20260928T220000Z/);
});

test('zip mínimo válido', () => {
  const z = DL.makeZip([{ name: 'a.ics', text: 'hola' }]);
  assert.equal(z[0], 0x50); assert.equal(z[1], 0x4b);
  assert.equal(DL.crc32(Buffer.from('hola')), require('node:zlib').crc32('hola'));
});

test('resumen semanal', () => {
  const s = {
    tasks,
    kpiDefs: seed.config.kpis,
    kpiValues: seed.kpis.values,
    habits: Object.values(seed.habits),
    habitLogs: {},
    agenda: [{ id: 'a', title: 'Llamar a Cristian', date: '2026-09-26', time: '15:00' }]
  };
  const txt = DL.weeklySummary(s, TODAY);
  assert.match(txt, /AVANCE: 10 %/);
  assert.match(txt, /COMPLETADAS ESTA SEMANA \(3\)/);
  assert.match(txt, /Llamar a Cristian \[agenda\]/);
  assert.doesNotMatch(txt, /PUNTOS DE CONTROL/);
});
