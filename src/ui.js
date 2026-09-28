/* Derrotero · vistas. Cada vista devuelve HTML; app.js maneja eventos y render. */
(function (root) {
  'use strict';
  var DL = root.DL, DS = root.DS, S = DS.S;

  var U = {
    route: 'hoy',
    tf: { front: 'todos', status: 'todos', owner: 'todos', q: '', hideDone: false, onlyOverdue: false },
    tview: 'etapas', open: {}, confirm: {}, conflict: {},
    agView: 'lista', agMonth: null, agDay: null, agOpen: {}, agConfirm: {}, showDone: false,
    draft: null, capText: '', listening: false, micMsg: '', parsingAI: false, aiMsg: '', aiAvailable: false,
    toasts: [], more: false, capSheet: false, modeWarn: null, kpiOpen: {}, weekEdit: null, labOpen: {},
    auditEntity: 'todos', backups: null, notif: 'unknown', exportMsg: '', seedMsg: ''
  };

  // ───── utilidades ─────
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function ro() { return S.canWrite ? '' : ' disabled'; }
  function today() { return DS.today(); }
  function sel(a, b) { return a === b ? ' selected' : ''; }
  function pressed(b) { return ' aria-pressed="' + (b ? 'true' : 'false') + '"'; }

  var P = {
    hoy: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    agenda: '<rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M8 14h3v3H8z"/>',
    actividades: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 5l1.5 1.5L7 4M3 11l1.5 1.5L7 10M3 17l1.5 1.5L7 16"/>',
    control: '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>',
    indicadores: '<path d="M3 20h18"/><path d="M6 16v-4M11 16V8M16 16v-6M21 16V5"/>',
    habitos: '<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/><path d="M9 12l2 2 4-4"/>',
    semana: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 9v11M15 9v11"/>',
    frentes: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>',
    laboratorio: '<path d="M9 3h6M10 3v6l-6 11h16L14 9V3"/><path d="M7 15h10"/>',
    resumen: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h7"/>',
    bitacora: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ajustes: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="1"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    drag: '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    trash: '<path d="M4 7h16M10 7V4h4v3M6 7l1 14h10l1-14"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/>',
    more: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    sparkle: '<path d="M4 12h6M14 12h6M12 4v6M12 14v6"/>'
  };
  function ic(name, cls) { return '<svg class="' + (cls || 'ic') + '" viewBox="0 0 24 24" aria-hidden="true">' + (P[name] || '') + '</svg>'; }

  var NAV = [
    { label: 'General', items: [['hoy', 'Hoy'], ['agenda', 'Agenda']] },
    { label: 'Plan', items: [['actividades', 'Actividades'], ['control', 'Puntos de control'], ['indicadores', 'Indicadores']] },
    { label: 'Ritmo', items: [['habitos', 'Hábitos'], ['semana', 'Semana tipo'], ['frentes', 'Frentes por modo'], ['laboratorio', 'Laboratorio']] },
    { label: 'Revisión', items: [['resumen', 'Resumen semanal'], ['bitacora', 'Bitácora'], ['ajustes', 'Ajustes']] }
  ];
  var TITLES = { hoy: 'Hoy', agenda: 'Agenda', actividades: 'Actividades', control: 'Puntos de control', indicadores: 'Indicadores', habitos: 'Hábitos', semana: 'Semana tipo', frentes: 'Frentes por modo', laboratorio: 'Laboratorio', resumen: 'Resumen semanal', bitacora: 'Bitácora', ajustes: 'Ajustes' };

  function counts() {
    var t = today(); var now = Date.now();
    var od = DL.overdueList(DS.tasks(), t).length;
    var agAlert = DS.agenda().filter(function (a) { var s = DL.agendaState(a, now); return s === 'vencida' || s === 'por recordar' || s === 'en curso'; }).length;
    return { actividades: od, agenda: agAlert };
  }

  function navHtml() {
    var c = counts();
    return NAV.map(function (g) {
      return '<div class="nav-group"><div class="nav-label">' + g.label + '</div>' + g.items.map(function (it) {
        var n = c[it[0]];
        return '<a href="#' + it[0] + '" data-route="' + it[0] + '"' + (U.route === it[0] ? ' aria-current="page"' : '') + '>' + ic(it[0]) + '<span>' + it[1] + '</span>' +
          (n ? '<span class="badge" title="' + (it[0] === 'agenda' ? 'Para atender ahora' : 'Vencidas') + '">' + n + '</span>' : '') + '</a>';
      }).join('') + '</div>';
    }).join('');
  }

  function tabbarHtml() {
    var c = counts();
    var tabs = [['hoy', 'Hoy'], ['agenda', 'Agenda'], ['actividades', 'Plan'], ['control', 'Control']];
    var inMore = ['hoy', 'agenda', 'actividades', 'control'].indexOf(U.route) < 0;
    return tabs.map(function (t) {
      var n = c[t[0]];
      return '<a href="#' + t[0] + '" data-route="' + t[0] + '"' + (U.route === t[0] ? ' aria-current="page"' : '') + '>' + ic(t[0]) + '<span>' + t[1] + '</span>' + (n ? '<span class="badge">' + n + '</span>' : '') + '</a>';
    }).join('') + '<button type="button" data-act="more"' + (inMore ? ' aria-current="page"' : '') + '>' + ic('more') + '<span>Más</span></button>';
  }

  function connHtml() {
    if (S.mode === 'db') return '<span class="mono">Base de datos</span><strong><span class="dot"></span>En vivo, compartida</strong>' + (S.canWrite ? '' : '<span class="mono">Solo lectura</span>');
    if (S.mode === 'local') return '<span class="mono">Base de datos</span><strong><span class="dot off"></span>Modo local</strong>';
    return '<span class="mono">Base de datos</span><strong>Conectando…</strong>';
  }

  function stampHtml() {
    var t = today();
    return '<b>' + DL.DIAS_CORTO[DL.weekday(t)] + ' ' + DL.fmtDate(t) + '</b>' + DL.fmtTime(DL.nowTimeBogota()) + ' · Bogotá';
  }

  // ───── piezas comunes ─────
  function statusClass(s) { return s === 'en curso' ? 'curso' : s; }
  function statusBtn(t) {
    var icon = t.status === 'hecha' ? ic('check') : t.status === 'bloqueada' ? ic('lock') : '';
    var label = t.status === 'bloqueada' ? 'Bloqueada: pedir confirmación para cambiar' : 'Estado: ' + t.status + '. Toca para avanzar';
    return '<button type="button" class="st-btn ' + statusClass(t.status) + '" data-act="cycle" data-id="' + t.id + '" aria-label="' + esc(label) + '" title="' + esc(t.status) + '"' + ro() + '>' + icon + '</button>';
  }
  function pill(text, cls) { return '<span class="pill ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function frontOptions(selv, withAll) {
    return (withAll ? '<option value="">Sin frente</option>' : '') + DS.fronts().map(function (f) { return '<option' + sel(f.name, selv) + '>' + esc(f.name) + '</option>'; }).join('');
  }
  function phaseOptions(selv) { return DS.phases().map(function (p) { return '<option value="' + p.id + '"' + sel(p.id, selv) + '>' + esc(p.title) + '</option>'; }).join(''); }
  function dueHtml(t, td) {
    if (!t.due) return '<span class="tenue">sin fecha</span>';
    if (DL.isOverdue(t, td)) return '<span class="bad">vencida · ' + DL.fmtDate(t.due, { year: false }) + '</span>';
    return DL.fmtDate(t.due, { year: t.due.slice(0, 4) !== td.slice(0, 4) });
  }

  function countdown(a, now) {
    var tm = DL.agendaTimes(a); var st = DL.agendaState(a, now);
    function span(ms) {
      var m = Math.round(Math.abs(ms) / 60000);
      if (m < 60) return m + ' min';
      var h = Math.round(m / 60); if (h < 36) return h + ' h';
      return Math.round(h / 24) + ' días';
    }
    if (st === 'hecha') return 'hecha';
    if (st === 'vencida') return 'venció hace ' + span(now - tm.end);
    if (st === 'en curso') return tm.timed ? 'en curso · termina ' + DL.fmtTime(DL.nowTimeBogota(tm.end)) : 'vence hoy a medianoche';
    if (st === 'por recordar') return 'empieza en ' + span(tm.start - now);
    return 'en ' + span(tm.start - now);
  }
  var AG_PILL = { 'programada': '', 'por recordar': 'recordar', 'en curso': 'curso', 'vencida': 'vencida', 'hecha': 'hecha' };

  function aItem(a, opts) {
    var now = Date.now(); var st = DL.agendaState(a, now); var open = U.agOpen[a.id];
    var remTxt = a.time ? (a.remindMin ? 'aviso ' + (a.remindMin >= 60 ? (a.remindMin / 60) + ' h' : a.remindMin + ' min') + ' antes' : 'sin aviso previo') : 'aviso a las 8:00 a. m.';
    var h = '<div class="aitem' + (a.done ? ' done' : '') + '" id="ag-' + a.id + '">' +
      '<div class="when">' + (a.time ? DL.fmtTime(a.time) : 'Todo el día') + (opts && opts.showDate ? '<small>' + DL.fmtDate(a.date, { weekday: true, year: false }) + '</small>' : '') + '</div>' +
      '<div class="what"><b>' + esc(a.title) + '</b><div class="row">' + pill(st, AG_PILL[st]) +
      '<span class="mono tenue" style="font-size:12px">' + esc(countdown(a, now)) + (a.done ? '' : ' · ' + remTxt) + '</span>' +
      (a.front ? '<span class="front-tag">' + esc(a.front) + '</span>' : '') + '</div></div>' +
      '<div class="acts">' +
      (a.done ? '<button class="btn alt sm" data-act="ag-undo" data-id="' + a.id + '"' + ro() + '>Reabrir</button>'
        : '<button class="btn petrol sm" data-act="ag-done" data-id="' + a.id + '"' + ro() + '>' + ic('check') + 'Hecha</button>') +
      '<button class="btn alt sm" data-act="ag-open" data-id="' + a.id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + (open ? 'Cerrar' : 'Más') + '</button>' +
      '</div>';
    if (open) h += agMore(a);
    return h + '</div>';
  }

  function agMore(a) {
    var id = a.id; var confirm = U.agConfirm[id];
    return '<div class="more">' +
      '<div class="form-grid">' +
      '<label class="field" style="grid-column:1/-1"><span>Actividad</span><input class="in" id="age-title-' + id + '" data-ag="' + id + '" data-f="title" value="' + esc(a.title) + '" maxlength="160"' + ro() + '></label>' +
      '<label class="field"><span>Fecha</span><input class="in" type="date" id="age-date-' + id + '" data-ag="' + id + '" data-f="date" value="' + esc(a.date) + '"' + ro() + '></label>' +
      '<label class="field"><span>Hora (vacía = todo el día)</span><input class="in" type="time" id="age-time-' + id + '" data-ag="' + id + '" data-f="time" value="' + esc(a.time) + '"' + ro() + '></label>' +
      '<label class="field"><span>Duración</span><select class="in" id="age-dur-' + id + '" data-ag="' + id + '" data-f="durationMin"' + ro() + '>' + durOptions(a.durationMin) + '</select></label>' +
      '<label class="field"><span>Recordar</span><select class="in" id="age-rem-' + id + '" data-ag="' + id + '" data-f="remindMin"' + ro() + '>' + remOptions(a.remindMin) + '</select></label>' +
      '<label class="field"><span>Frente</span><select class="in" id="age-front-' + id + '" data-ag="' + id + '" data-f="front"' + ro() + '>' + frontOptions(a.front, true) + '</select></label>' +
      '</div>' +
      '<label class="field"><span>Nota</span><textarea class="in" id="age-note-' + id + '" data-ag="' + id + '" data-f="note" rows="2"' + ro() + '>' + esc(a.note || '') + '</textarea></label>' +
      '<div class="row">' +
      (a.done ? '' : '<span class="flabel">Posponer</span><button class="btn alt sm" data-act="ag-snooze" data-mode="15m" data-id="' + id + '"' + ro() + '>15 min</button><button class="btn alt sm" data-act="ag-snooze" data-mode="1h" data-id="' + id + '"' + ro() + '>1 hora</button><button class="btn alt sm" data-act="ag-snooze" data-mode="manana" data-id="' + id + '"' + ro() + '>Mañana</button>') +
      '</div>' +
      '<div class="row"><span class="flabel">Llevar al calendario del celular</span>' +
      '<a class="btn alt sm" href="' + esc(DL.googleCalendarUrl(a)) + '" target="_blank" rel="noopener">' + ic('ext') + 'Google Calendar</a>' +
      '<a class="btn alt sm" href="' + esc(DL.outlookUrl(a)) + '" target="_blank" rel="noopener">' + ic('ext') + 'Outlook</a>' +
      '<button class="btn alt sm" data-act="ag-ics" data-id="' + id + '">' + ic('download') + '.ics con alarma</button></div>' +
      (confirm ? '<div class="inline-confirm"><b>¿Eliminar "' + esc(a.title) + '" de la agenda?</b><div class="row"><button class="btn danger sm" data-act="ag-del" data-id="' + id + '">Eliminar</button><button class="btn alt sm" data-act="ag-del-cancel" data-id="' + id + '">Cancelar</button></div></div>'
        : '<div><button class="link" data-act="ag-del-ask" data-id="' + id + '"' + ro() + '>Eliminar de la agenda</button></div>') +
      '</div>';
  }

  function durOptions(v) { return [[15, '15 min'], [30, '30 min'], [45, '45 min'], [60, '1 hora'], [90, '1 h 30'], [120, '2 horas'], [180, '3 horas'], [240, '4 horas']].map(function (o) { return '<option value="' + o[0] + '"' + sel(o[0], +v) + '>' + o[1] + '</option>'; }).join(''); }
  function remOptions(v) { return [[0, 'A la hora'], [5, '5 min antes'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes'], [120, '2 horas antes'], [1440, '1 día antes']].map(function (o) { return '<option value="' + o[0] + '"' + sel(o[0], +v) + '>' + o[1] + '</option>'; }).join(''); }

  // ───── HOY ─────
  function vHoy() {
    var td = today(); var ts = DS.tasks(); var p = DL.progress(ts);
    var od = DL.overdueList(ts, td); var up = DL.upcoming(ts, td, 7);
    var cps = DS.checkpoints(); var first = cps[0];
    var dTo = first ? DL.diffDays(first.windowStart, td) : 0;
    var now = Date.now();
    var ag = DL.sortAgenda(DS.agenda().filter(function (a) { return a.date === td || (!a.done && DL.agendaState(a, now) === 'vencida'); }));
    var h = '<header class="page-head">' +
      '<p class="kicker">Plan de David · sep 2026 – jun 2027</p>' +
      '<h1>El <span class="senal">derrotero</span>, paso a paso</h1>' +
      '<p class="bajada">Qué hacer esta semana, qué va tarde y si el plan llega con evidencia a la decisión de marzo de 2027.</p></header>';
    h += '<section class="stats plano" aria-label="Resumen">' +
      '<div class="stat"><span class="label">Avance total</span><span class="fig">' + p.pct + '<small>%</small></span><div class="bar" role="progressbar" aria-valuenow="' + p.pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + p.pct + '%"></i></div><span class="foot">' + p.done + ' de ' + p.total + ' actividades hechas</span></div>' +
      '<div class="stat' + (od.length ? ' alarm' : '') + '"><span class="label">Vencidas</span><span class="fig">' + od.length + '</span><span class="foot">' + (od.length ? '<a href="#actividades" data-route="actividades" data-tview="vencidas">Ver y reprogramar</a>' : 'Nada con fecha pasada') + '</span></div>' +
      '<div class="stat"><span class="label">Próximos 7 días</span><span class="fig">' + up.length + '</span><span class="foot">actividades con fecha hasta el ' + DL.fmtDate(DL.addDays(td, 7), { year: false }) + '</span></div>' +
      '<div class="stat"><span class="label">' + (first ? 'Revisión 1 con IKM' : 'Revisión') + '</span><span class="fig">' + (dTo > 0 ? dTo : 0) + '<small> días</small></span><span class="foot">' + (first ? DL.fmtDate(first.windowStart, { year: false }) + ' – ' + DL.fmtDate(first.windowEnd) : '') + '</span></div>' +
      '</section>';

    // columna izquierda
    var left = '<section class="card"><div class="sec-head"><div><p class="kicker">Agenda de hoy</p><h2 class="sec">' + esc(DL.fmtDateLong(td)) + '</h2></div>' +
      '<button class="btn llama" data-act="go-capture">' + ic('mic') + 'Dictar actividad</button></div>' +
      (ag.length ? '<div class="ag-day">' + ag.map(function (a) { return aItem(a, { showDate: a.date !== td }); }).join('') + '</div>'
        : '<p class="empty">No tienes nada agendado hoy. Dicta una actividad y queda con recordatorio.</p>') + '</section>';
    left += '<section class="card"><div class="sec-head"><div><p class="kicker">Lo que viene</p><h2 class="sec">Próximos 7 días</h2></div><a class="link" href="#actividades" data-route="actividades" data-tview="semana">Ver todo</a></div>' +
      (up.length ? '<div class="list-plain">' + up.map(function (t) { return taskLi(t, td); }).join('') + '</div>' : '<p class="empty">Nada vence en los próximos 7 días.</p>') + '</section>';
    if (od.length) left += '<section class="card"><div class="sec-head"><div><p class="kicker">Atención</p><h2 class="sec">Vencidas</h2></div></div><div class="list-plain">' + od.map(function (t) { return taskLi(t, td); }).join('') + '</div></section>';

    // columna derecha
    var right = '<section class="card"><div class="sec-head"><div><p class="kicker">Puntos de control con IKM</p><h2 class="sec">Veredictos</h2></div><a class="link" href="#control" data-route="control">Evaluar</a></div><div>' +
      cps.map(function (cp) {
        var v = DL.verdict(cp.criteria, cp.id);
        var cls = { ok: 'hecha', partial: 'warn', bad: 'vencida', none: '' }[v.tone];
        return '<div class="cp-mini"><div><b>' + esc(cp.title) + '</b><div class="mono tenue" style="font-size:12px">' + DL.fmtDate(cp.windowStart, { year: false }) + ' – ' + DL.fmtDate(cp.windowEnd) + '</div></div>' + pill(v.label, cls) + '</div>';
      }).join('') + '</div>' + cpAlertsHtml(cps, td, true) + '</section>';
    var defs = DS.kpiDefs(); var vals = DS.kpiValues();
    right += '<section class="card"><div class="sec-head"><div><p class="kicker">Indicadores</p><h2 class="sec">Contra la meta</h2></div><a class="link" href="#indicadores" data-route="indicadores">Registrar</a></div><div class="stack">' +
      defs.map(function (d) {
        var v = vals[d.key] || 0; var pct = Math.min(100, Math.round(v / (d.target || 1) * 100));
        return '<div class="kpi-mini"><div class="row"><span>' + esc(d.label) + '</span><b class="num">' + v + ' <span class="tenue mono" style="font-size:12px">/ ' + d.target + '</span></b></div><div class="bar"><i style="width:' + pct + '%"></i></div></div>';
      }).join('') + '</div></section>';
    var habits = DS.list('habits').sort(function (a, b) { return a.order - b.order; });
    right += '<section class="card"><div class="sec-head"><div><p class="kicker">Hábitos</p><h2 class="sec">Este periodo</h2></div><a class="link" href="#habitos" data-route="habitos">Ver rachas</a></div><div class="list-plain">' +
      habits.map(function (hb) {
        var logs = (S.d.habit_logs[hb.id] || {}).dates || {}; var st = DL.habitStatus(hb, logs, td);
        return '<div class="li"><label class="check"><input type="checkbox" data-act="habit-toggle" data-id="' + hb.id + '"' + (logs[td] ? ' checked' : '') + ro() + '><span class="sr">Marcar hoy</span></label><span>' + esc(hb.title) + '<br><span class="tenue" style="font-size:13px">' + esc(hb.when) + '</span></span><span class="pill ' + (st.done ? 'hecha' : '') + '">' + st.count + '/' + st.target + '</span></div>';
      }).join('') + '</div></section>';

    return h + '<div class="split"><div class="stack">' + left + '</div><div class="stack">' + right + '</div></div>';
  }

  function taskLi(t, td) {
    return '<div class="li">' + statusBtn(t) + '<span><button class="link" style="color:var(--tinta);text-decoration:none;font-weight:500;text-align:left" data-act="goto-task" data-id="' + t.id + '">' + esc(t.title) + '</button><br><span class="front-tag">' + esc(t.front) + '</span> <span class="tenue" style="font-size:13px">· ' + esc(t.owner) + '</span></span><span class="d' + (DL.isOverdue(t, td) ? ' bad' : '') + '">' + (DL.isOverdue(t, td) ? 'vencida · ' : '') + DL.fmtDate(t.due, { year: false }) + '</span></div>';
  }

  function cpAlertsHtml(cps, td, compact) {
    var out = [];
    cps.forEach(function (cp) {
      DL.checkpointAlerts(cp, td).forEach(function (a) { if (!compact || a.tone !== 'info') out.push('<div class="banner ' + (a.tone === 'bad' ? 'bad' : a.tone === 'info' ? 'info' : 'warn') + '"><span>' + (compact ? '<b>' + esc(cp.title.split(' · ')[0]) + ':</b> ' : '') + esc(a.text) + '</span></div>'); });
    });
    return out.length ? '<div class="stack" style="gap:8px">' + out.join('') + '</div>' : '';
  }

  // ───── AGENDA ─────
  function captureHtml() {
    var ex = ['Mañana a las 3 de la tarde reunión con Cristian, recuérdame 30 minutos antes', 'El lunes a las 5 llamar a dos headhunters', 'Revisar el portafolio el viernes en la tarde', 'En 20 minutos publicar el post de LinkedIn'];
    var h = '<section class="capture plano" id="capture">' +
      '<div><p class="kicker">Agenda por voz</p><h2>Dilo y queda <span class="senal">agendado</span></h2></div>' +
      '<div class="capture-input"><label class="sr" for="cap-text">Actividad dictada o escrita</label>' +
      '<textarea id="cap-text" rows="2" placeholder="Ej.: mañana a las 3 de la tarde reunión con Cristian, recuérdame 30 minutos antes"' + ro() + '>' + esc(U.capText) + '</textarea>' +
      '<button type="button" class="mic' + (U.listening ? ' on' : '') + '" data-act="mic" aria-label="' + (U.listening ? 'Detener dictado' : 'Dictar con el micrófono') + '" aria-pressed="' + U.listening + '"' + ro() + '>' + ic('mic') + '</button>' +
      '<button type="button" class="btn llama" data-act="parse"' + ro() + '>Interpretar</button></div>' +
      '<p class="hint" id="mic-msg" aria-live="polite">' + esc(U.micMsg || 'Toca el micrófono o usa el dictado del teclado de tu celular. La frase se convierte en actividad con fecha, hora y recordatorio.') + '</p>' +
      '<div class="chips" aria-label="Frases de ejemplo">' + ex.map(function (e) { return '<button type="button" class="chip" data-act="example" data-text="' + esc(e) + '"' + ro() + '>' + esc(e) + '</button>'; }).join('') + '</div>';
    if (U.draft) h += draftHtml();
    return h + '</section>';
  }

  function draftHtml() {
    var d = U.draft;
    return '<div class="draft" id="draft"><div class="row between"><p class="kicker">Revisa antes de guardar</p>' + (d.source === 'claude' ? pill('Interpretado por Claude', 'curso') : pill('Interpretado en el dispositivo')) + '</div>' +
      '<div class="form-grid">' +
      '<label class="field" style="grid-column:1/-1"><span>Actividad</span><input class="in" id="d-title" data-draft="title" value="' + esc(d.title) + '" maxlength="160" placeholder="Qué vas a hacer"></label>' +
      '<label class="field"><span>Fecha</span><input class="in" type="date" id="d-date" data-draft="date" value="' + esc(d.date) + '"></label>' +
      '<label class="field"><span>Hora (vacía = todo el día)</span><input class="in" type="time" id="d-time" data-draft="time" value="' + esc(d.time) + '"></label>' +
      '<label class="field"><span>Duración</span><select class="in" id="d-dur" data-draft="durationMin">' + durOptions(d.durationMin) + '</select></label>' +
      '<label class="field"><span>Recordar</span><select class="in" id="d-rem" data-draft="remindMin">' + remOptions(d.remindMin) + '</select></label>' +
      '<label class="field"><span>Frente</span><select class="in" id="d-front" data-draft="front">' + frontOptions(d.front, true) + '</select></label>' +
      '</div>' +
      '<p class="sub">' + esc(DL.fmtDateLong(d.date)) + (d.time ? ' · ' + DL.fmtTime(d.time) : ' · todo el día') + (d.time ? (d.remindMin ? ' · te aviso ' + (d.remindMin >= 60 ? d.remindMin / 60 + ' h' : d.remindMin + ' min') + ' antes' : ' · aviso a la hora') : ' · aviso a las 8:00 a. m.') + '</p>' +
      (d.assumptions && d.assumptions.length ? '<div class="assume">' + d.assumptions.map(function (a) { return '<span>Supuesto: ' + esc(a) + '</span>'; }).join('') + '</div>' : '') +
      (U.aiMsg ? '<p class="hint">' + esc(U.aiMsg) + '</p>' : '') +
      '<div class="row"><button class="btn petrol" data-act="draft-save">' + ic('check') + 'Guardar en la agenda</button>' +
      (U.aiAvailable ? '<button class="btn alt" data-act="draft-ai"' + (U.parsingAI ? ' disabled' : '') + '>' + (U.parsingAI ? 'Claude está interpretando…' : 'Interpretar con Claude') + '</button>' : '') +
      '<button class="btn alt" data-act="draft-cancel">Descartar</button></div></div>';
  }

  function vAgenda() {
    var td = today(); var now = Date.now();
    var items = DL.sortAgenda(DS.agenda());
    var venc = items.filter(function (a) { return DL.agendaState(a, now) === 'vencida'; });
    var open = items.filter(function (a) { return !a.done && DL.agendaState(a, now) !== 'vencida'; });
    var done = items.filter(function (a) { return a.done; }).reverse().slice(0, 20);
    var h = '<header class="page-head row"><div class="stack" style="gap:12px"><p class="kicker">Agenda · recordatorios · vencimientos</p><h1>Tu <span class="senal">agenda</span></h1>' +
      '<p class="bajada">Lo que dictas queda en el calendario, te avisa antes de empezar y se marca vencido si pasa sin hacerse.</p></div>' +
      '<div class="row">' + notifControl() + '</div></header>';
    h += captureHtml();
    h += '<div class="tabs" role="tablist">' +
      '<button role="tab" data-act="ag-view" data-v="lista" aria-selected="' + (U.agView === 'lista') + '">Lista<span class="count">' + open.length + '</span></button>' +
      '<button role="tab" data-act="ag-view" data-v="mes" aria-selected="' + (U.agView === 'mes') + '">Mes</button>' +
      '<button role="tab" data-act="ag-view" data-v="vencidas" aria-selected="' + (U.agView === 'vencidas') + '">Vencidas<span class="count">' + venc.length + '</span></button></div>';
    if (U.agView === 'mes') h += monthHtml(td);
    else if (U.agView === 'vencidas') {
      h += venc.length ? '<div class="ag-day"><div class="ag-day-h bad"><h3>Vencidas sin hacer</h3><span class="mono tenue">' + venc.length + '</span></div>' + venc.map(function (a) { return aItem(a, { showDate: true }); }).join('') + '</div>'
        : '<p class="empty">Nada vencido. Todo lo que pasó quedó hecho.</p>';
    } else {
      if (venc.length) h += '<div class="banner bad">' + venc.length + (venc.length === 1 ? ' actividad venció' : ' actividades vencieron') + ' sin marcarse como hechas. <button class="link" data-act="ag-view" data-v="vencidas">Revisarlas</button></div>';
      var groups = {};
      open.forEach(function (a) { (groups[a.date] = groups[a.date] || []).push(a); });
      var days = Object.keys(groups).sort();
      h += days.length ? days.map(function (d) {
        return '<div class="ag-day"><div class="ag-day-h"><h3>' + esc(cap(DL.relDay(d, td))) + '</h3><span class="mono tenue">' + DL.fmtDate(d, { weekday: true }) + '</span></div>' + groups[d].map(function (a) { return aItem(a); }).join('') + '</div>';
      }).join('') : '<p class="empty">No hay nada pendiente en la agenda. Dicta la próxima actividad arriba.</p>';
      if (done.length) {
        h += '<div><button class="link" data-act="toggle-done">' + (U.showDone ? 'Ocultar' : 'Ver') + ' las ' + done.length + ' últimas hechas</button></div>';
        if (U.showDone) h += '<div class="ag-day">' + done.map(function (a) { return aItem(a, { showDate: true }); }).join('') + '</div>';
      }
    }
    h += '<section class="card hondo"><div class="sec-head"><div><p class="kicker">Recordatorios fuera de la app</p><h2 class="sec">Llévala a tu calendario</h2></div></div>' +
      '<p class="muted">Con la app abierta, Derrotero te avisa en pantalla. Para que el celular te recuerde aunque la app esté cerrada, exporta la agenda: cada actividad lleva su alarma. Abre el .zip y toca el archivo .ics, o usa el botón de Google Calendar u Outlook de cada actividad.</p>' +
      '<div class="row"><button class="btn petrol" data-act="ag-export">' + ic('download') + 'Exportar agenda (.ics con alarmas)</button><button class="btn alt" data-act="ag-copy-ics">' + ic('copy') + 'Copiar .ics</button></div>' +
      (U.exportMsg ? '<p class="hint" aria-live="polite">' + esc(U.exportMsg) + '</p>' : '') + '</section>';
    return h;
  }

  function notifControl() {
    if (U.notif === 'granted') return pill('Avisos del sistema activos', 'hecha');
    if (U.notif === 'unsupported' || U.notif === 'denied') return '<span class="hint">Avisos en pantalla con la app abierta</span>';
    return '<button class="btn alt" data-act="notif">' + ic('bell') + 'Activar avisos del sistema</button>';
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function monthHtml(td) {
    var base = U.agMonth || td.slice(0, 7);
    var y = +base.slice(0, 4), m = +base.slice(5, 7);
    var first = base + '-01'; var last = base + '-' + DL.pad(DL.lastDayOfMonth(y, m));
    var start = DL.mondayOf(first); var end = DL.addDays(DL.mondayOf(last), 6);
    var now = Date.now();
    var byDay = {};
    DS.agenda().forEach(function (a) { (byDay[a.date] = byDay[a.date] || []).push({ a: a }); });
    DS.tasks().forEach(function (t) { if (t.due && t.status !== 'hecha') (byDay[t.due] = byDay[t.due] || []).push({ t: t }); });
    var selDay = U.agDay || td;
    var h = '<div class="row between"><div class="row"><button class="btn alt sm" data-act="month" data-d="-1" aria-label="Mes anterior">‹</button><h2 class="sec" style="min-width:12ch;text-align:center">' + DL.MESES[m - 1] + ' ' + y + '</h2><button class="btn alt sm" data-act="month" data-d="1" aria-label="Mes siguiente">›</button></div><button class="btn alt sm" data-act="month" data-d="0">Hoy</button></div>';
    h += '<div class="month" role="grid">' + ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(function (d) { return '<div class="dow">' + d + '</div>'; }).join('');
    for (var d = start; d <= end; d = DL.addDays(d, 1)) {
      var evs = (byDay[d] || []);
      evs.sort(function (x, z) { return (x.a ? (x.a.time || '00') : '99').localeCompare(z.a ? (z.a.time || '00') : '99'); });
      h += '<button class="cell' + (d.slice(0, 7) !== base ? ' out' : '') + (d === td ? ' today' : '') + '" data-act="day" data-d="' + d + '"' + pressed(d === selDay) + ' aria-label="' + DL.fmtDateLong(d) + ', ' + evs.length + ' elementos"><span class="d">' + (+d.slice(8)) + '</span>' +
        evs.slice(0, 3).map(function (e) {
          if (e.a) { var st = DL.agendaState(e.a, now); return '<span class="ev' + (st === 'vencida' ? ' bad' : '') + (e.a.done ? ' done' : '') + '">' + (e.a.time ? e.a.time + ' ' : '') + esc(e.a.title) + '</span>'; }
          return '<span class="ev task' + (DL.isOverdue(e.t, td) ? ' bad' : '') + '">' + esc(e.t.title) + '</span>';
        }).join('') + (evs.length > 3 ? '<span class="mono tenue" style="font-size:11px">+' + (evs.length - 3) + ' más</span>' : '') +
        '<span class="dots">' + evs.slice(0, 5).map(function (e) { return '<i class="' + (e.t ? 'task' : '') + ((e.a && DL.agendaState(e.a, now) === 'vencida') || (e.t && DL.isOverdue(e.t, td)) ? ' bad' : '') + '"></i>'; }).join('') + '</span></button>';
    }
    h += '</div>';
    var list = byDay[selDay] || [];
    h += '<div class="ag-day"><div class="ag-day-h"><h3>' + esc(cap(DL.relDay(selDay, td))) + '</h3><span class="mono tenue">' + DL.fmtDate(selDay, { weekday: true }) + '</span></div>' +
      (list.length ? list.map(function (e) {
        if (e.a) return aItem(e.a);
        return '<div class="aitem task-due"><div class="when">Vence</div><div class="what"><b>' + esc(e.t.title) + '</b><div class="row">' + pill(e.t.status, statusClass(e.t.status)) + '<span class="front-tag">' + esc(e.t.front) + '</span><span class="tenue" style="font-size:13px">' + esc(e.t.owner) + '</span></div></div><div class="acts"><button class="btn alt sm" data-act="goto-task" data-id="' + e.t.id + '">Abrir</button></div></div>';
      }).join('') : '<p class="empty">Nada este día.</p>') + '</div>';
    return h;
  }

  // ───── ACTIVIDADES ─────
  function vActividades() {
    var td = today(); var all = DS.tasks(); var f = U.tf;
    var od = DL.overdueList(all, td); var up = DL.upcoming(all, td, 7);
    var owners = Array.from(new Set(all.map(function (t) { return t.owner; }))).sort();
    var h = '<header class="page-head"><p class="kicker">Plan base · ' + all.length + ' actividades</p><h1>Las <span class="senal">actividades</span> del plan</h1>' +
      '<p class="bajada">Toca el círculo para avanzar el estado. Arrastra dentro de una etapa para cambiar el orden. Toca el título para ver notas y detalle.</p></header>';
    h += '<div class="tabs" role="tablist">' +
      '<button role="tab" data-act="tview" data-v="etapas" aria-selected="' + (U.tview === 'etapas') + '">Por etapa</button>' +
      '<button role="tab" data-act="tview" data-v="semana" aria-selected="' + (U.tview === 'semana') + '">Próximos 7 días<span class="count">' + up.length + '</span></button>' +
      '<button role="tab" data-act="tview" data-v="vencidas" aria-selected="' + (U.tview === 'vencidas') + '">Vencidas<span class="count">' + od.length + '</span></button></div>';
    h += '<div class="card hondo" style="gap:12px"><div class="form-grid">' +
      '<label class="field" style="grid-column:span 2"><span>Buscar</span><input class="in" id="tf-q" data-tf="q" type="search" value="' + esc(f.q) + '" placeholder="Texto de la actividad, nota o responsable"></label>' +
      '<label class="field"><span>Estado</span><select class="in" id="tf-status" data-tf="status"><option value="todos">Todos</option>' + DL.STATUSES.map(function (s) { return '<option' + sel(s, f.status) + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Responsable</span><select class="in" id="tf-owner" data-tf="owner"><option value="todos">Todos</option>' + owners.map(function (o) { return '<option' + sel(o, f.owner) + '>' + esc(o) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="chips" role="group" aria-label="Filtrar por frente"><button class="chip" data-act="tf-front" data-v="todos"' + pressed(f.front === 'todos') + '>Todos</button>' +
      DS.fronts().map(function (fr) { return '<button class="chip" data-act="tf-front" data-v="' + esc(fr.name) + '"' + pressed(f.front === fr.name) + '>' + esc(fr.name) + '</button>'; }).join('') + '</div>' +
      '<div class="row"><label class="check"><input type="checkbox" id="tf-hide" data-tf="hideDone"' + (f.hideDone ? ' checked' : '') + '>Ocultar hechas</label><label class="check"><input type="checkbox" id="tf-od" data-tf="onlyOverdue"' + (f.onlyOverdue ? ' checked' : '') + '>Solo vencidas</label></div></div>';

    var filtered = DL.filterTasks(all, f, td);
    if (U.tview === 'semana' || U.tview === 'vencidas') {
      var lst = U.tview === 'semana' ? DL.upcoming(filtered, td, 7) : DL.overdueList(filtered, td);
      h += '<div class="phase"><div class="phase-head"><h3>' + (U.tview === 'semana' ? 'Del ' + DL.fmtDate(td, { year: false }) + ' al ' + DL.fmtDate(DL.addDays(td, 7)) : 'Vencidas al ' + DL.fmtDate(td)) + '</h3><span class="mono tenue">' + lst.length + '</span></div>' +
        (lst.length ? lst.map(function (t) { return trow(t, td, false); }).join('') : '<p class="empty">' + (U.tview === 'semana' ? 'Nada vence en los próximos 7 días.' : 'No hay actividades vencidas.') + '</p>') + '</div>';
    } else {
      DS.phases().forEach(function (ph) {
        var inPh = all.filter(function (t) { return t.phase === ph.id; });
        var shown = DL.sortTasks(filtered.filter(function (t) { return t.phase === ph.id; }));
        var pp = DL.progress(inPh);
        if (!shown.length && (f.q || f.front !== 'todos' || f.status !== 'todos' || f.owner !== 'todos' || f.onlyOverdue)) return;
        h += '<section class="phase" data-phase="' + ph.id + '"><div class="phase-head"><div><h3>' + esc(ph.title) + '</h3><span class="mono tenue" style="font-size:12px">' + DL.fmtDate(ph.start, { year: false }) + ' – ' + DL.fmtDate(ph.end) + '</span></div>' +
          '<div class="row"><span class="mono" style="font-size:13px">' + pp.done + '/' + pp.total + ' hechas</span><div class="bar petrol"><i style="width:' + pp.pct + '%"></i></div></div></div>' +
          (shown.length ? shown.map(function (t) { return trow(t, td, true); }).join('') : '<p class="empty">Todo lo de esta etapa está oculto por los filtros.</p>') + '</section>';
      });
    }
    h += addTaskForm();
    return h;
  }

  function trow(t, td, draggable) {
    var open = U.open[t.id]; var od = DL.isOverdue(t, td);
    var h = '<div class="trow' + (t.status === 'hecha' ? ' done' : '') + (od ? ' overdue' : '') + '" id="task-' + t.id + '" data-task="' + t.id + '" data-phase="' + t.phase + '"' + (draggable && S.canWrite ? ' draggable="true"' : '') + '>' +
      '<span class="handle" aria-hidden="true">' + (draggable ? ic('drag') : '') + '</span>' + statusBtn(t) +
      '<div><button class="title-btn" data-act="open-task" data-id="' + t.id + '" aria-expanded="' + (open ? 'true' : 'false') + '">' + esc(t.title) + '</button>' +
      '<div class="meta-m"><span class="front-tag">' + esc(t.front) + '</span><span>' + esc(t.owner) + '</span><span>' + dueHtml(t, td) + '</span>' + (t.status === 'bloqueada' ? '<span class="bad">bloqueada</span>' : '') + '</div></div>' +
      '<span class="front-tag">' + esc(t.front) + '</span><span class="owner">' + esc(t.owner) + (t.status === 'bloqueada' ? ' ' + pill('bloqueada', 'bloqueada') : t.status === 'en curso' ? ' ' + pill('en curso', 'curso') : '') + '</span><span class="due' + (od ? ' bad' : '') + '">' + dueHtml(t, td) + '</span>';
    var c = U.confirm[t.id];
    if (c === 'unblock') {
      h += '<div class="inline-confirm" role="alert"><b>Esta actividad está bloqueada.</b><span>Causa: ' + esc(t.blockCause || 'sin causa escrita') + '</span><span>¿La desbloqueas? El cambio queda en la bitácora.</span>' +
        '<div class="row"><button class="btn petrol sm" data-act="unblock" data-id="' + t.id + '" data-to="en curso">Pasar a en curso</button><button class="btn alt sm" data-act="unblock" data-id="' + t.id + '" data-to="pendiente">Pasar a pendiente</button><button class="btn alt sm" data-act="confirm-cancel" data-id="' + t.id + '">Dejarla bloqueada</button></div></div>';
    }
    if (open) h += taskDetail(t);
    return h + '</div>';
  }

  function taskDetail(t) {
    var c = U.confirm[t.id]; var conflict = U.conflict['task:' + t.id];
    var blockOpen = t.status === 'bloqueada' || c === 'block';
    var h = '<div class="tdetail">';
    if (conflict) h += conflictHtml('task:' + t.id, conflict);
    h += '<label class="field"><span>Notas</span><textarea class="in" id="tn-' + t.id + '" data-task-note="' + t.id + '" rows="3"' + ro() + '>' + esc(t.note || '') + '</textarea></label>' +
      '<div class="form-grid">' +
      '<label class="field" style="grid-column:1/-1"><span>Título</span><input class="in" id="tt-' + t.id + '" data-tfield="title" data-id="' + t.id + '" value="' + esc(t.title) + '" maxlength="160"' + ro() + '></label>' +
      '<label class="field"><span>Estado</span><select class="in" id="ts-' + t.id + '" data-tstatus="' + t.id + '"' + ro() + '>' + DL.STATUSES.map(function (s) { return '<option' + sel(s, c === 'block' ? 'bloqueada' : t.status) + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Responsable</span><input class="in" id="to-' + t.id + '" data-tfield="owner" data-id="' + t.id + '" value="' + esc(t.owner) + '"' + ro() + '></label>' +
      '<label class="field"><span>Fecha</span><input class="in" type="date" id="td-' + t.id + '" data-tfield="due" data-id="' + t.id + '" value="' + esc(t.due) + '"' + ro() + '></label>' +
      '<label class="field"><span>Frente</span><select class="in" id="tfr-' + t.id + '" data-tfield="front" data-id="' + t.id + '"' + ro() + '>' + frontOptions(t.front) + '</select></label>' +
      '<label class="field"><span>Etapa</span><select class="in" id="tp-' + t.id + '" data-tfield="phase" data-id="' + t.id + '"' + ro() + '>' + phaseOptions(t.phase) + '</select></label></div>';
    if (blockOpen) {
      h += '<label class="field"><span>Causa del bloqueo (obligatoria)</span><textarea class="in" id="tb-' + t.id + '" data-tblock="' + t.id + '" rows="2" placeholder="Qué o quién lo bloquea"' + ro() + '>' + esc(t.blockCause || '') + '</textarea></label>';
      if (c === 'block') h += '<div class="row"><button class="btn danger sm" data-act="block" data-id="' + t.id + '">Marcar como bloqueada</button><button class="btn alt sm" data-act="confirm-cancel" data-id="' + t.id + '">Cancelar</button><span class="hint" id="tb-msg-' + t.id + '"></span></div>';
    }
    h += '<div class="row between"><div class="row"><button class="btn alt sm" data-act="move" data-dir="-1" data-id="' + t.id + '"' + ro() + '>' + ic('up') + 'Subir</button><button class="btn alt sm" data-act="move" data-dir="1" data-id="' + t.id + '"' + ro() + '>' + ic('down') + 'Bajar</button>' +
      '<button class="btn alt sm" data-act="task-to-agenda" data-id="' + t.id + '"' + ro() + '>' + ic('agenda') + 'Agendar</button></div>';
    if (c === 'delete') h += '<div class="row"><span>¿Eliminar esta actividad?</span><button class="btn danger sm" data-act="task-del" data-id="' + t.id + '">Eliminar</button><button class="btn alt sm" data-act="confirm-cancel" data-id="' + t.id + '">Cancelar</button></div>';
    else h += '<button class="link" data-act="task-del-ask" data-id="' + t.id + '"' + ro() + '>Eliminar actividad</button>';
    return h + '</div></div>';
  }

  function conflictHtml(key, c) {
    return '<div class="banner warn" style="display:grid;gap:8px"><b>Otra sesión cambió este texto mientras lo editabas.</b>' +
      '<span>Tu versión: «' + esc(c.mine.slice(0, 240)) + (c.mine.length > 240 ? '…' : '') + '»</span><span>Versión guardada: «' + esc(c.theirs.slice(0, 240)) + (c.theirs.length > 240 ? '…' : '') + '»</span>' +
      '<div class="row"><button class="btn sm" data-act="conflict" data-k="' + key + '" data-v="mine">Guardar la mía</button><button class="btn alt sm" data-act="conflict" data-k="' + key + '" data-v="merge">Unir ambas</button><button class="btn alt sm" data-act="conflict" data-k="' + key + '" data-v="theirs">Quedarme con la guardada</button></div></div>';
  }

  function addTaskForm() {
    return '<section class="card"><div><p class="kicker">Planear</p><h2 class="sec">Agregar actividad</h2></div>' +
      '<form id="add-task" class="form-grid" data-form="add-task">' +
      '<label class="field" style="grid-column:1/-1"><span>Actividad</span><input class="in" id="nt-title" name="title" maxlength="160" required placeholder="Verbo + resultado concreto"' + ro() + '></label>' +
      '<label class="field"><span>Etapa</span><select class="in" id="nt-phase" name="phase"' + ro() + '>' + phaseOptions(phaseForToday()) + '</select></label>' +
      '<label class="field"><span>Frente</span><select class="in" id="nt-front" name="front"' + ro() + '>' + frontOptions('') + '</select></label>' +
      '<label class="field"><span>Responsable</span><input class="in" id="nt-owner" name="owner" value="Tú"' + ro() + '></label>' +
      '<label class="field"><span>Fecha</span><input class="in" id="nt-due" name="due" type="date"' + ro() + '></label>' +
      '<div><button class="btn" type="submit"' + ro() + '>' + ic('plus') + 'Agregar</button></div></form></section>';
  }

  function phaseForToday() {
    var td = today(); var ph = DS.phases();
    for (var i = 0; i < ph.length; i++) if (td >= ph[i].start && td <= ph[i].end) return ph[i].id;
    return ph.length ? ph[0].id : '';
  }

  // ───── PUNTOS DE CONTROL ─────
  function vControl() {
    var td = today(); var cps = DS.checkpoints();
    var h = '<header class="page-head"><p class="kicker">Decisión central del plan</p><h1>Seguir en IKM con <span class="senal">evidencia</span></h1>' +
      '<p class="bajada">Tres condiciones: comisiones pagadas, más ventas y deuda cubierta. Tres de tres: quedarse tiene sentido. Menos de tres en enero activa la búsqueda de empleo; en marzo, el plan de salida.</p></header>';
    h += '<div class="grid g2">' + cps.map(function (cp) { return cpCard(cp, td); }).join('') + '</div>';
    var decs = DS.list('decisions').filter(function (d) { return d.kind !== 'modos'; }).sort(function (a, b) { return b.at - a.at; });
    h += '<section class="card"><div><p class="kicker">Historial</p><h2 class="sec">Decisiones registradas</h2></div>' +
      (decs.length ? '<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Punto de control</th><th>Veredicto calculado</th><th>Decisión</th><th>Justificación</th></tr></thead><tbody>' +
        decs.map(function (d) { return '<tr><td class="mono">' + DL.fmtDate(d.date) + '</td><td>' + esc(d.checkpointTitle || d.checkpointId) + '</td><td>' + esc(d.verdict || '') + '</td><td><b>' + esc(d.option) + '</b></td><td>' + esc(d.justification) + '</td></tr>'; }).join('') + '</tbody></table></div>'
        : '<p class="empty">Todavía no hay decisiones. Se registran al cerrar cada punto de control.</p>') + '</section>';
    return h;
  }

  function cpCard(cp, td) {
    var v = DL.verdict(cp.criteria, cp.id); var d = DL.diffDays(cp.windowStart, td);
    var conflict = U.conflict['cp:' + cp.id];
    var h = '<section class="card plano" id="cp-' + cp.id + '"><div class="sec-head"><div><p class="kicker">' + DL.fmtDate(cp.windowStart, { year: false }) + ' – ' + DL.fmtDate(cp.windowEnd) + '</p><h2 class="sec">' + esc(cp.title) + '</h2></div>' +
      pill(d > 0 ? 'faltan ' + d + ' días' : td <= cp.windowEnd ? 'ventana abierta' : 'ventana cerrada', d > 0 ? '' : td <= cp.windowEnd ? 'llama' : '') + '</div>';
    h += cpAlertsHtml([cp], td, false);
    DL.CRITERIA.forEach(function (k) {
      var c = cp.criteria[k] || {}; var val = c.value || 'pendiente';
      h += '<div class="crit"><div class="row between"><b>' + esc(c.label || k) + '</b><div class="seg" role="group" aria-label="' + esc(c.label || k) + '">' +
        [['si', 'Sí'], ['parcial', 'Parcial'], ['no', 'No']].map(function (o) { return '<button class="' + o[0] + '" data-act="crit" data-cp="' + cp.id + '" data-k="' + k + '" data-v="' + o[0] + '"' + pressed(val === o[0]) + ro() + '>' + o[1] + '</button>'; }).join('') + '</div></div>' +
        '<label class="field"><span>Criterio medible</span><input class="in" id="cm-' + cp.id + '-' + k + '" data-crit="' + cp.id + '|' + k + '|measurable" value="' + esc(c.measurable || '') + '" placeholder="' + (k === 'ventas' ? 'Ej.: ventas nuevas de IKM ≥ la cifra que tú definas' : k === 'deuda' ? 'Ej.: monto y fecha en que se cubre la deuda' : 'Ej.: comisiones del periodo pagadas al 100 %') + '"' + ro() + '></label>' +
        '<div class="form-grid"><label class="field"><span>Evidencia</span><input class="in" id="ce-' + cp.id + '-' + k + '" data-crit="' + cp.id + '|' + k + '|evidence" value="' + esc(c.evidence || '') + '" placeholder="Qué lo demuestra"' + ro() + '></label>' +
        '<label class="field"><span>Enlace</span><input class="in" type="url" id="cl-' + cp.id + '-' + k + '" data-crit="' + cp.id + '|' + k + '|link" value="' + esc(c.link || '') + '" placeholder="https://"' + ro() + '></label></div>' +
        (c.link && /^https:\/\//.test(c.link) ? '<a href="' + esc(c.link) + '" target="_blank" rel="noopener" style="font-size:13.5px">Abrir evidencia</a>' : '') + '</div>';
    });
    h += '<div class="verdict ' + v.tone + '" aria-live="polite"><span class="kicker" style="color:inherit">Veredicto calculado · ' + v.yes + ' de 3 en sí</span><strong>' + esc(v.label) + '</strong><span>' + esc(v.detail) + '</span></div>';
    if (conflict) h += conflictHtml('cp:' + cp.id, conflict);
    h += '<label class="field"><span>Notas del punto de control</span><textarea class="in" id="cpn-' + cp.id + '" data-cp-note="' + cp.id + '" rows="3"' + ro() + '>' + esc(cp.note || '') + '</textarea></label>';
    h += '<form class="stack" data-form="decision" data-cp="' + cp.id + '" style="gap:12px;border-top:1px solid var(--filete);padding-top:16px"><p class="kicker">Registrar la decisión (la tomas tú)</p><div class="form-grid">' +
      '<label class="field"><span>Decisión</span><select class="in" name="option" id="dec-opt-' + cp.id + '"' + ro() + '>' +
      ['Me quedo en IKM', 'Activo la búsqueda de empleo', 'Ejecuto el plan de salida', 'Quedo como consultor asociado de IKM', 'Aplazo con fecha nueva'].map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Fecha</span><input class="in" type="date" name="date" id="dec-date-' + cp.id + '" value="' + td + '"' + ro() + '></label></div>' +
      '<label class="field"><span>Justificación</span><textarea class="in" name="justification" id="dec-j-' + cp.id + '" rows="2" required placeholder="Por qué, con qué evidencia"' + ro() + '></textarea></label>' +
      '<div><button class="btn petrol" type="submit"' + ro() + '>Registrar decisión</button></div></form>';
    return h + '</section>';
  }

  // ───── INDICADORES ─────
  function vIndicadores() {
    var defs = DS.kpiDefs(); var vals = DS.kpiValues(); var ev = DS.list('kpi_events');
    var h = '<header class="page-head"><p class="kicker">Medir</p><h1>Indicadores con <span class="senal">tendencia</span></h1>' +
      '<p class="bajada">Cada toque en + o − queda como movimiento fechado. La gráfica muestra el valor en el tiempo contra la meta.</p></header>';
    h += '<div class="kpis">' + defs.map(function (d) {
      var v = vals[d.key] || 0; var pct = Math.min(100, Math.round(v / (d.target || 1) * 100));
      var mine = ev.filter(function (e) { return e.kpi === d.key; }).sort(function (a, b) { return b.at - a.at; });
      var open = U.kpiOpen[d.key];
      return '<article class="kpi" id="kpi-' + d.key + '"><span class="label">' + esc(d.label) + '</span>' +
        '<div class="val"><b class="num" id="kv-' + d.key + '">' + v + '</b><span>de ' + d.target + '</span></div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div><span class="meta">Meta ' + DL.fmtDate(d.due) + ' · ' + pct + ' %</span>' +
        kpiChart(d, mine.slice().reverse()) +
        '<div class="ctrl"><button class="btn alt" data-act="kpi" data-k="' + d.key + '" data-d="-1" aria-label="Restar uno a ' + esc(d.label) + '"' + (v <= 0 ? ' disabled' : ro()) + '>−</button><button class="btn" data-act="kpi" data-k="' + d.key + '" data-d="1" aria-label="Sumar uno a ' + esc(d.label) + '"' + ro() + '>+</button></div>' +
        '<button class="link" data-act="kpi-open" data-k="' + d.key + '" aria-expanded="' + !!open + '">' + (open ? 'Ocultar' : 'Ver') + ' movimientos (' + mine.length + ')</button>' +
        (open ? (mine.length ? '<div class="list-plain">' + mine.slice(0, 30).map(function (e) { return '<div class="li"><span class="d">' + DL.fmtDate(e.date, { year: false }) + '</span><span>' + (e.delta > 0 ? '+' : '') + e.delta + '</span><b class="num">' + e.value + '</b></div>'; }).join('') + '</div>' : '<p class="hint">Sin movimientos todavía.</p>') : '') +
        '</article>';
    }).join('') + '</div>';
    return h;
  }

  function kpiChart(def, events) {
    var cfg = DS.config(); var start = cfg.planStart; var end = def.due > start ? def.due : cfg.planEnd;
    var td = today();
    var W = 300, H = 118, L = 6, R = 40, T = 12, B = 22;
    var series = DL.kpiSeries(events, def.key, start);
    var maxV = Math.max(def.target, series.reduce(function (m, p) { return Math.max(m, p.value); }, 0), 1);
    var span = Math.max(1, DL.diffDays(end, start));
    function x(d) { var n = Math.max(0, Math.min(span, DL.diffDays(d, start))); return L + (W - L - R) * n / span; }
    function y(v) { return T + (H - T - B) * (1 - v / maxV); }
    var lastX = x(td < end ? td : end);
    var path = 'M' + x(start).toFixed(1) + ' ' + y(0).toFixed(1); var cur = 0;
    series.slice(1).forEach(function (p) { path += ' H' + x(p.date).toFixed(1) + ' V' + y(p.value).toFixed(1); cur = p.value; });
    path += ' H' + lastX.toFixed(1);
    var area = path + ' V' + y(0).toFixed(1) + ' Z';
    var ty = y(def.target);
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Tendencia de ' + esc(def.label) + ': ' + cur + ' de ' + def.target + '">' +
      '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#E6DCCB"/>' +
      '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + ty + '" y2="' + ty + '" stroke="#00655E" stroke-dasharray="4 4"/>' +
      '<text x="' + (W - R + 4) + '" y="' + (ty + 3) + '">meta ' + def.target + '</text>' +
      '<path d="' + area + '" fill="#FBE7D6"/>' +
      '<path d="' + path + '" fill="none" stroke="#EA632B" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="' + lastX + '" cy="' + y(cur) + '" r="4" fill="#EA632B" stroke="#FCF6EC" stroke-width="2"/>' +
      (Math.abs(y(cur) - ty) > 10 ? '<text class="endlabel" x="' + Math.min(lastX + 7, W - R + 4) + '" y="' + (y(cur) + 4) + '">' + cur + '</text>' : '') +
      '<text x="' + L + '" y="' + (H - 6) + '">' + DL.fmtDate(start, { year: false }) + '</text>' +
      '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + DL.fmtDate(end) + '</text></svg>';
  }

  // ───── HÁBITOS ─────
  function vHabitos() {
    var td = today(); var habits = DS.list('habits').sort(function (a, b) { return a.order - b.order; });
    var FREQ = { diario: 'Diario', semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' };
    var h = '<header class="page-head"><p class="kicker">Constancia</p><h1>Hábitos con <span class="senal">racha</span></h1><p class="bajada">Marca el día en que cumpliste. La racha cuenta periodos seguidos cumplidos según la frecuencia de cada hábito.</p></header>';
    h += '<div class="grid g2">' + habits.map(function (hb) {
      var logs = (S.d.habit_logs[hb.id] || {}).dates || {};
      var st = DL.habitStatus(hb, logs, td); var streak = DL.habitStreak(hb, logs, td);
      var ticks = ''; for (var i = 20; i >= 0; i--) { var d = DL.addDays(td, -i); var sch = DL.isScheduledDay(hb, d); ticks += '<i class="' + (logs[d] ? 'on' : '') + (sch ? '' : ' off') + (i === 0 ? ' today' : '') + '" title="' + DL.fmtDate(d, { weekday: true, year: false }) + (logs[d] ? ' · cumplido' : '') + '"></i>'; }
      return '<article class="card habit"><div class="habit-top"><div><p class="kicker">' + FREQ[hb.freq] + (hb.target > 1 ? ' · ' + hb.target + ' veces' : '') + (hb.front ? ' · ' + esc(hb.front) : '') + '</p><h3 class="card-t">' + esc(hb.title) + '</h3><p class="sub">' + esc(hb.when) + '</p></div>' +
        '<div class="streak num">' + streak + '<small>racha</small></div></div>' +
        '<div class="row between"><span>' + pill(st.count + ' de ' + st.target + ' en el periodo', st.done ? 'hecha' : '') + '</span>' +
        '<button class="btn ' + (logs[td] ? 'alt' : 'petrol') + ' sm" data-act="habit-toggle" data-id="' + hb.id + '"' + ro() + '>' + (logs[td] ? 'Desmarcar hoy' : ic('check') + 'Cumplí hoy') + '</button></div>' +
        '<div><span class="flabel">Últimos 21 días</span><div class="ticks" style="margin-top:6px">' + ticks + '</div></div></article>';
    }).join('') + '</div>';
    h += '<section class="card"><div><p class="kicker">Planear</p><h2 class="sec">Agregar hábito</h2></div><form class="form-grid" data-form="add-habit">' +
      '<label class="field" style="grid-column:span 2"><span>Hábito</span><input class="in" name="title" id="nh-title" required maxlength="80"' + ro() + '></label>' +
      '<label class="field"><span>Frecuencia</span><select class="in" name="freq" id="nh-freq"' + ro() + '><option value="diario">Diario</option><option value="semanal">Semanal</option><option value="quincenal">Quincenal</option><option value="mensual">Mensual</option></select></label>' +
      '<label class="field"><span>Veces por periodo</span><input class="in" type="number" min="1" max="7" value="1" name="target" id="nh-target"' + ro() + '></label>' +
      '<label class="field"><span>Cuándo</span><input class="in" name="when" id="nh-when" placeholder="Ej.: lunes a las 6:00 a. m."' + ro() + '></label>' +
      '<div><button class="btn" type="submit"' + ro() + '>' + ic('plus') + 'Agregar</button></div></form></section>';
    return h;
  }

  // ───── SEMANA TIPO ─────
  var CATS = { personal: 'Bloque personal', ikm: 'IKM', salud: 'Salud', familia: 'Familia', libre: 'Ventana libre', creativo: 'Creativo' };
  function vSemana() {
    var blocks = DS.list('blocks');
    var H0 = 5, H1 = 21, PX = 44;
    var order = [1, 2, 3, 4, 5, 6, 0];
    var h = '<header class="page-head"><p class="kicker">Horario real · lunes a domingo</p><h1>La semana <span class="senal">tipo</span></h1><p class="bajada">Gimnasio a las 5:00 a. m., IKM de 8:00 a. m. a 5:00 p. m. y los bloques personales en las ventanas libres. Toca un bloque para editarlo.</p></header>';
    h += '<div class="row between"><div class="legend">' + Object.keys(CATS).filter(function (k) { return k !== 'creativo'; }).map(function (k) { return '<span><i class="blk ' + k + '" style="position:static;display:inline-block;padding:0"></i>' + CATS[k] + '</span>'; }).join('') + '</div>' +
      '<div class="row"><button class="btn petrol sm" data-act="week-export">' + ic('download') + 'Exportar al calendario (.ics)</button><button class="btn alt sm" data-act="week-new"' + ro() + '>' + ic('plus') + 'Nuevo bloque</button></div></div>';
    if (U.exportMsg && U.route === 'semana') h += '<p class="hint">' + esc(U.exportMsg) + '</p>';
    if (U.weekEdit) h += blockForm();
    h += '<div class="week-wrap"><div class="week"><div class="wh" style="border-left:0"></div>' + order.map(function (d) { return '<div class="wh">' + DL.DIAS_CORTO[d] + '</div>'; }).join('');
    var hours = '<div class="hours" style="height:' + (H1 - H0) * PX + 'px">';
    for (var hr = H0; hr < H1; hr++) hours += '<span class="hlabel" style="top:' + ((hr - H0) * PX + 8) + 'px">' + (hr <= 12 ? hr : hr - 12) + (hr < 12 ? ' am' : ' pm') + '</span>';
    h += hours + '</div>';
    order.forEach(function (d) {
      var col = '<div class="col" style="height:' + (H1 - H0) * PX + 'px">';
      for (var hr = H0; hr < H1; hr++) col += '<span class="hl" style="top:' + ((hr - H0) * PX) + 'px"></span>';
      var mine = blocks.filter(function (b) { return b.day === d; }).sort(function (a, b) { return a.start.localeCompare(b.start); });
      // IKM 8–5 como fondo continuo (lunes a viernes)
      if (d >= 1 && d <= 5) col += '<span class="blk" style="top:' + (3 * PX) + 'px;height:' + (9 * PX) + 'px;background:rgba(213,234,231,.35);border-color:rgba(0,101,94,.25);left:0;right:0;border-radius:0" aria-hidden="true"></span>';
      mine.forEach(function (b) {
        var s = toMin(b.start), e = toMin(b.end);
        var top = (s - H0 * 60) / 60 * PX, ht = Math.max(18, (e - s) / 60 * PX - 2);
        col += '<button class="blk ' + (b.cat || 'personal') + '" style="top:' + top + 'px;height:' + ht + 'px" data-act="week-edit" data-id="' + b.id + '" title="' + esc(b.title + ' · ' + DL.fmtTime(b.start) + ' – ' + DL.fmtTime(b.end) + (b.note ? ' · ' + b.note : '')) + '"><b>' + esc(b.title) + '</b>' + (ht > 30 ? '<span>' + b.start + '–' + b.end + '</span>' : '') + '</button>';
      });
      h += col + '</div>';
    });
    h += '</div></div><p class="hint">Fondo verde claro: jornada IKM de 8:00 a. m. a 5:00 p. m. (horario flexible). Comité financiero: una vez al mes, 4 horas; día por confirmar. Los bloques marcados como supuesto lo dicen en su nota.</p>';
    return h;
  }
  function toMin(t) { var p = t.split(':'); return +p[0] * 60 + +p[1]; }

  function blockForm() {
    var b = U.weekEdit;
    return '<form class="card hondo" data-form="block"><div class="row between"><h2 class="sec">' + (b.id ? 'Editar bloque' : 'Nuevo bloque') + '</h2><button type="button" class="btn alt sm" data-act="week-close">Cerrar</button></div><div class="form-grid">' +
      '<label class="field" style="grid-column:1/-1"><span>Título</span><input class="in" name="title" id="bk-title" value="' + esc(b.title || '') + '" required maxlength="80"' + ro() + '></label>' +
      '<label class="field"><span>Día</span><select class="in" name="day" id="bk-day"' + ro() + '>' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<option value="' + d + '"' + sel(d, +b.day) + '>' + DL.DIAS[d] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Inicio</span><input class="in" type="time" name="start" id="bk-start" value="' + esc(b.start || '17:00') + '" required' + ro() + '></label>' +
      '<label class="field"><span>Fin</span><input class="in" type="time" name="end" id="bk-end" value="' + esc(b.end || '18:00') + '" required' + ro() + '></label>' +
      '<label class="field"><span>Categoría</span><select class="in" name="cat" id="bk-cat"' + ro() + '>' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + sel(k, b.cat || 'personal') + '>' + CATS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field" style="grid-column:1/-1"><span>Nota</span><input class="in" name="note" id="bk-note" value="' + esc(b.note || '') + '"' + ro() + '></label></div>' +
      '<p class="hint" id="bk-msg"></p><div class="row"><button class="btn" type="submit"' + ro() + '>Guardar bloque</button>' + (b.id ? '<button type="button" class="btn alt" data-act="week-del" data-id="' + b.id + '"' + ro() + '>' + ic('trash') + 'Eliminar</button>' : '') + '</div></form>';
  }

  // ───── FRENTES ─────
  var MODO_TXT = { operar: 'Ya existe y produce; solo se revisa.', construir: 'Máximo dos a la vez; reciben las mejores horas.', explorar: 'Avanza por hitos.', laboratorio: 'Un proyecto por trimestre, con decisión al final.' };
  function vFrentes() {
    var td = today(); var fr = DS.fronts(); var ts = DS.tasks();
    var cfg = DS.config(); var mr = cfg.modeReview || {};
    var q = DL.quarterOf(td);
    var h = '<header class="page-head"><p class="kicker">Regla de gestión</p><h1>Frentes por <span class="senal">modo</span></h1><p class="bajada">Operar, construir, explorar o laboratorio. Solo dos frentes reciben las mejores horas a la vez.</p></header>';
    h += '<div class="grid g2">' + ['operar', 'construir', 'explorar', 'laboratorio'].map(function (m) {
      var list = fr.filter(function (f) { return f.mode === m; });
      return '<div class="card' + (m === 'construir' ? ' plano' : ' hondo') + '"><div class="row between"><div><p class="kicker">' + m + (m === 'construir' ? ' · ' + list.length + ' de ' + DL.MAX_CONSTRUIR : '') + '</p><p class="sub">' + MODO_TXT[m] + '</p></div></div>' +
        '<div class="chips">' + (list.length ? list.map(function (f) { return '<span class="chip">' + esc(f.name) + '</span>'; }).join('') : '<span class="tenue">Ninguno</span>') + '</div></div>';
    }).join('') + '</div>';
    if (U.modeWarn) {
      var w = U.modeWarn;
      h += '<div class="inline-confirm" role="alert" id="mode-warn"><b>Máximo dos frentes en Construir (RN-03).</b><span>Para que ' + esc(w.name) + ' entre a Construir, elige cuál sale. El que sale pasa a Explorar.</span><div class="row">' +
        w.current.map(function (c) { return '<button class="btn sm" data-act="mode-swap" data-out="' + c.id + '">Sale ' + esc(c.name) + '</button>'; }).join('') + '<button class="btn alt sm" data-act="mode-cancel">Cancelar</button></div></div>';
    }
    h += '<div class="table-wrap"><table><thead><tr><th>Frente</th><th>Alcance</th><th>Avance</th><th>Modo</th></tr></thead><tbody>' + fr.map(function (f) {
      var mine = ts.filter(function (t) { return t.front === f.name; }); var p = DL.progress(mine);
      return '<tr><td><b>' + esc(f.name) + '</b></td><td class="muted" style="min-width:220px">' + esc(f.scope || '') + '</td><td class="mono">' + p.done + '/' + p.total + '</td><td><div class="seg" role="group" aria-label="Modo de ' + esc(f.name) + '">' +
        DL.MODOS.map(function (m) { return '<button class="neutral" data-act="mode" data-id="' + f.id + '" data-v="' + m + '"' + pressed(f.mode === m) + ro() + '>' + m.charAt(0).toUpperCase() + m.slice(1) + '</button>'; }).join('') + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
    var needs = !mr.quarter || mr.quarter !== q;
    h += '<section class="card"><div class="sec-head"><div><p class="kicker">Revisión trimestral · ' + DL.quarterLabel(q) + '</p><h2 class="sec">Qué entra y qué sale de Construir</h2></div>' + (needs ? pill('Pendiente este trimestre', 'warn') : pill('Hecha el ' + DL.fmtDate(mr.date), 'hecha')) + '</div>' +
      '<p class="muted">Al cierre de cada trimestre (' + DL.fmtDate(DL.quarterEnd(q)) + '), revisa los modos y registra la decisión. Queda con la foto de los modos en la bitácora.</p>' +
      '<form class="stack" data-form="mode-review" style="gap:12px"><label class="field"><span>Conclusión de la revisión</span><textarea class="in" name="note" id="mr-note" rows="2" required placeholder="Qué frente entra, cuál sale y por qué"' + ro() + '></textarea></label><div><button class="btn petrol" type="submit"' + ro() + '>Registrar revisión trimestral</button></div></form>' +
      (mr.note ? '<p class="sub">Última: ' + esc(mr.note) + '</p>' : '') + '</section>';
    return h;
  }

  // ───── LABORATORIO ─────
  function vLab() {
    var td = today(); var q = DL.quarterOf(td);
    var labs = DS.list('lab').sort(function (a, b) { return a.quarter.localeCompare(b.quarter); });
    var h = '<header class="page-head"><p class="kicker">Proyectos de gusto · uno por trimestre</p><h1>El <span class="senal">laboratorio</span></h1><p class="bajada">Cada proyecto tiene un criterio de salida y termina con una decisión registrada: sigue, se pausa o se vuelve negocio.</p></header>';
    h += '<div class="grid g2">' + labs.map(function (p) {
      var active = p.quarter === q; var needs = DL.labNeedsDecision(p, td);
      return '<article class="card' + (active ? ' plano' : '') + '"><div class="sec-head"><div><p class="kicker">' + DL.quarterLabel(p.quarter) + '</p><h2 class="sec">' + esc(p.name) + '</h2><p class="sub">' + esc(p.description || '') + '</p></div>' +
        (active ? pill('Trimestre en curso', 'llama') : p.decision ? pill(p.decision, 'hecha') : needs ? pill('Falta decisión', 'vencida') : pill(td < p.quarter ? 'Próximo' : 'Programado')) + '</div>' +
        (needs ? '<div class="banner bad">El trimestre cerró el ' + DL.fmtDate(DL.quarterEnd(p.quarter)) + ' sin decisión registrada.</div>' : '') +
        (!p.exitCriterion ? '<div class="banner warn">Falta el criterio de salida: define qué tiene que pasar para decidir.</div>' : '') +
        '<div class="form-grid"><label class="field"><span>Trimestre</span><select class="in" id="lq-' + p.id + '" data-lab="' + p.id + '" data-f="quarter"' + ro() + '>' + quarterOptions(p.quarter) + '</select></label></div>' +
        '<label class="field"><span>Criterio de salida</span><input class="in" id="lx-' + p.id + '" data-lab="' + p.id + '" data-f="exitCriterion" value="' + esc(p.exitCriterion || '') + '" placeholder="Ej.: 30 corredores la usan dos semanas seguidas"' + ro() + '></label>' +
        '<div class="stack" style="gap:8px"><span class="flabel">Decisión al cierre</span><div class="seg" role="group" aria-label="Decisión de ' + esc(p.name) + '">' +
        ['Sigue', 'Se pausa', 'Se vuelve negocio'].map(function (o) { return '<button class="neutral" data-act="lab-decide" data-id="' + p.id + '" data-v="' + o + '"' + pressed(p.decision === o) + ro() + '>' + o + '</button>'; }).join('') + '</div>' +
        '<label class="field"><span>Por qué</span><input class="in" id="ln-' + p.id + '" data-lab="' + p.id + '" data-f="decisionNote" value="' + esc(p.decisionNote || '') + '"' + ro() + '></label>' +
        (p.decidedAt ? '<span class="hint">Decidido el ' + DL.fmtDate(p.decidedAt) + '</span>' : '') + '</div></article>';
    }).join('') + '</div>';
    h += '<section class="card"><div><p class="kicker">Nuevo experimento</p><h2 class="sec">Agregar proyecto</h2></div><form class="form-grid" data-form="add-lab">' +
      '<label class="field"><span>Nombre</span><input class="in" name="name" id="nl-name" required maxlength="60"' + ro() + '></label>' +
      '<label class="field"><span>Descripción</span><input class="in" name="description" id="nl-desc" maxlength="120"' + ro() + '></label>' +
      '<label class="field"><span>Trimestre</span><select class="in" name="quarter" id="nl-q"' + ro() + '>' + quarterOptions(q) + '</select></label>' +
      '<div><button class="btn" type="submit"' + ro() + '>' + ic('plus') + 'Agregar</button></div></form></section>';
    return h;
  }
  function quarterOptions(v) {
    var out = []; ['2026-T3', '2026-T4', '2027-T1', '2027-T2', '2027-T3', '2027-T4'].forEach(function (q) { out.push('<option value="' + q + '"' + sel(q, v) + '>' + DL.quarterLabel(q) + '</option>'); });
    return out.join('');
  }

  // ───── RESUMEN ─────
  function summaryText() {
    var td = today();
    return DL.weeklySummary({
      tasks: DS.tasks(), kpiDefs: DS.kpiDefs(), kpiValues: DS.kpiValues(), checkpoints: DS.checkpoints(),
      habits: DS.list('habits').sort(function (a, b) { return a.order - b.order; }),
      habitLogs: Object.keys(S.d.habit_logs).reduce(function (m, k) { m[k] = (S.d.habit_logs[k] || {}).dates || {}; return m; }, {}),
      agenda: DS.agenda()
    }, td);
  }
  function vResumen() {
    var h = '<header class="page-head row"><div class="stack" style="gap:12px"><p class="kicker">Viernes · 2:00 p. m. · 45 minutos</p><h1>Resumen <span class="senal">semanal</span></h1><p class="bajada">Vencidas, completadas en la semana, indicadores y los próximos 7 días, listo para leer, copiar o guardar.</p></div>' +
      '<div class="row"><button class="btn" data-act="sum-copy">' + ic('copy') + 'Copiar</button><button class="btn alt" data-act="sum-md">' + ic('download') + '.md</button><button class="btn alt" data-act="sum-pdf">' + ic('download') + 'PDF</button></div></header>';
    if (U.exportMsg && U.route === 'resumen') h += '<p class="hint" aria-live="polite">' + esc(U.exportMsg) + '</p>';
    return h + '<pre class="summary" id="summary">' + esc(summaryText()) + '</pre>';
  }

  // ───── BITÁCORA ─────
  function vBitacora() {
    var entries = [];
    Object.keys(S.d.audit).forEach(function (d) { (S.d.audit[d].entries || []).forEach(function (e) { entries.push(e); }); });
    entries.sort(function (a, b) { return b.at - a.at; });
    var kinds = Array.from(new Set(entries.map(function (e) { return e.entity; }))).sort();
    if (U.auditEntity !== 'todos') entries = entries.filter(function (e) { return e.entity === U.auditEntity; });
    var unknown = Array.from(new Set(entries.map(function (e) { return e.actor; }))).filter(function (a) { return a && a.indexOf('u_') === 0 && !(a in S.names); });
    if (unknown.length) DS.names(unknown).then(function () { DS.emit('names'); });
    var h = '<header class="page-head"><p class="kicker">Evidencia para marzo</p><h1>La <span class="senal">bitácora</span></h1><p class="bajada">Quién cambió qué, cuándo, con el valor anterior y el nuevo. Últimos 62 días.</p></header>';
    h += '<div class="chips"><button class="chip" data-act="audit-f" data-v="todos"' + pressed(U.auditEntity === 'todos') + '>Todo</button>' + kinds.map(function (k) { return '<button class="chip" data-act="audit-f" data-v="' + esc(k) + '"' + pressed(U.auditEntity === k) + '>' + esc(k) + '</button>'; }).join('') + '</div>';
    if (!entries.length) return h + '<p class="empty">Aún no hay cambios registrados. Cada cambio de estado, fecha, nota o indicador aparecerá aquí.</p>';
    h += '<div class="table-wrap"><table><thead><tr><th>Cuándo</th><th>Qué</th><th>Campo</th><th>Antes → después</th><th>Quién</th></tr></thead><tbody>' +
      entries.slice(0, 400).map(function (e) {
        var d = new Date(e.at); var date = DL.todayBogota(e.at); var time = DL.nowTimeBogota(e.at);
        return '<tr><td class="mono">' + DL.fmtDate(date, { year: false }) + '<br>' + DL.fmtTime(time) + '</td><td><span class="front-tag">' + esc(e.entity) + '</span><br>' + esc(e.label) + '</td><td>' + esc(e.field) + '</td>' +
          '<td><div class="diff">' + (e.before !== '' ? '<del>' + esc(String(e.before).slice(0, 160)) + '</del>' : '') + (e.after !== '' ? '<ins>' + esc(String(e.after).slice(0, 160)) + '</ins>' : '') + '</div></td><td>' + esc(actorName(e.actor)) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    return h;
  }
  function actorName(a) {
    if (!a || a === 'app') return 'App';
    if (a === 'claude') return 'Claude';
    if (a === 'emilia') return 'Emilia';
    if (a === S.meId) return 'Tú';
    return S.names[a] || 'Colaborador';
  }

  // ───── AJUSTES ─────
  function vAjustes() {
    var cfg = DS.config();
    var h = '<header class="page-head"><p class="kicker">Configuración editable</p><h1><span class="senal">Ajustes</span> del plan</h1><p class="bajada">Etapas, frentes, metas y ventanas de revisión viven en la base de datos: se cambian aquí, sin programar.</p></header>';
    h += '<section class="card"><div><p class="kicker">Etapas</p><h2 class="sec">Fechas de cada etapa</h2></div>' + (cfg.phaseDatesNote ? '<p class="hint">' + esc(cfg.phaseDatesNote) + '</p>' : '') +
      '<div class="table-wrap"><table><thead><tr><th>Título</th><th>Inicio</th><th>Fin</th></tr></thead><tbody>' +
      DS.phases().map(function (p) { return '<tr><td><input class="in" id="ph-t-' + p.id + '" data-cfg="phase|' + p.id + '|title" value="' + esc(p.title) + '"' + ro() + '></td><td><input class="in" type="date" id="ph-s-' + p.id + '" data-cfg="phase|' + p.id + '|start" value="' + p.start + '"' + ro() + '></td><td><input class="in" type="date" id="ph-e-' + p.id + '" data-cfg="phase|' + p.id + '|end" value="' + p.end + '"' + ro() + '></td></tr>'; }).join('') + '</tbody></table></div></section>';
    h += '<section class="card"><div><p class="kicker">Frentes</p><h2 class="sec">Nombres y alcance</h2></div><p class="hint">Al renombrar un frente, sus actividades se actualizan.</p><div class="table-wrap"><table><thead><tr><th>Nombre</th><th>Alcance</th></tr></thead><tbody>' +
      DS.fronts().map(function (f) { return '<tr><td><input class="in" id="fr-n-' + f.id + '" data-cfg="front|' + f.id + '|name" value="' + esc(f.name) + '"' + ro() + '></td><td><input class="in" id="fr-s-' + f.id + '" data-cfg="front|' + f.id + '|scope" value="' + esc(f.scope || '') + '"' + ro() + '></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<form class="row" data-form="add-front"><label class="sr" for="nf-name">Nuevo frente</label><input class="in" style="max-width:280px" id="nf-name" name="name" placeholder="Nuevo frente" required' + ro() + '><button class="btn alt" type="submit"' + ro() + '>' + ic('plus') + 'Agregar frente</button></form></section>';
    h += '<section class="card"><div><p class="kicker">Indicadores</p><h2 class="sec">Metas y plazos</h2></div><div class="table-wrap"><table><thead><tr><th>Indicador</th><th>Meta</th><th>Plazo</th></tr></thead><tbody>' +
      DS.kpiDefs().map(function (k) { return '<tr><td><input class="in" id="kp-l-' + k.key + '" data-cfg="kpi|' + k.key + '|label" value="' + esc(k.label) + '"' + ro() + '></td><td><input class="in" style="width:96px" type="number" min="1" id="kp-t-' + k.key + '" data-cfg="kpi|' + k.key + '|target" value="' + k.target + '"' + ro() + '></td><td><input class="in" type="date" id="kp-d-' + k.key + '" data-cfg="kpi|' + k.key + '|due" value="' + k.due + '"' + ro() + '></td></tr>'; }).join('') + '</tbody></table></div>' +
      '<form class="row" data-form="add-kpi"><label class="sr" for="nk-label">Nuevo indicador</label><input class="in" style="max-width:280px" id="nk-label" name="label" placeholder="Nuevo indicador" required' + ro() + '><input class="in" style="max-width:110px" type="number" min="1" name="target" id="nk-target" placeholder="Meta" required' + ro() + '><input class="in" style="max-width:170px" type="date" name="due" id="nk-due" required' + ro() + '><button class="btn alt" type="submit"' + ro() + '>' + ic('plus') + 'Agregar</button></form></section>';
    h += '<section class="card"><div><p class="kicker">Puntos de control</p><h2 class="sec">Ventanas de revisión</h2></div><div class="table-wrap"><table><thead><tr><th>Título</th><th>Desde</th><th>Hasta</th></tr></thead><tbody>' +
      DS.checkpoints().map(function (c) { return '<tr><td><input class="in" id="cw-t-' + c.id + '" data-cfg="cp|' + c.id + '|title" value="' + esc(c.title) + '"' + ro() + '></td><td><input class="in" type="date" id="cw-s-' + c.id + '" data-cfg="cp|' + c.id + '|windowStart" value="' + c.windowStart + '"' + ro() + '></td><td><input class="in" type="date" id="cw-e-' + c.id + '" data-cfg="cp|' + c.id + '|windowEnd" value="' + c.windowEnd + '"' + ro() + '></td></tr>'; }).join('') + '</tbody></table></div></section>';
    h += '<section class="card hondo"><div><p class="kicker">Datos</p><h2 class="sec">Respaldo y exportación</h2></div>' +
      '<p class="muted">' + (S.mode === 'db' ? 'La app guarda un respaldo diario dentro de la base de datos y conserva los últimos 14 días.' : 'Estás en modo local: los datos viven solo en este navegador.') + '</p>' +
      '<div class="row"><button class="btn petrol" data-act="export-json">' + ic('download') + 'Exportar todo a JSON</button>' + (S.mode === 'db' ? '<button class="btn alt" data-act="backups">Ver respaldos diarios</button>' : '<button class="btn alt" data-act="reset-local">Volver al plan base</button>') + '</div>' +
      (U.exportMsg && U.route === 'ajustes' ? '<p class="hint">' + esc(U.exportMsg) + '</p>' : '') +
      (U.backups ? (U.backups.length ? '<div class="list-plain">' + U.backups.map(function (b) { return '<div class="li"><span class="d">' + DL.fmtDate(b.day) + '</span><span>Respaldo completo</span><button class="btn alt sm" data-act="backup-dl" data-d="' + b.day + '">' + ic('download') + 'JSON</button></div>'; }).join('') + '</div>' : '<p class="hint">Aún no hay respaldos. El primero se crea hoy.</p>') : '') + '</section>';
    h += '<section class="card"><div><p class="kicker">Acceso para Claude y Emilia</p><h2 class="sec">Cómo leen y escriben el plan</h2></div>' +
      '<p class="muted">Claude lee y actualiza este plan directamente sobre la base de datos del artefacto (colecciones <span class="mono">tasks</span>, <span class="mono">agenda</span>, <span class="mono">kpis</span>, <span class="mono">kpi_events</span>, <span class="mono">checkpoints</span>, <span class="mono">habits</span>). Pídele en una conversación: "marca t04 como hecha" o "agenda el martes a las 5 la reunión con mi esposa". Los cambios de Claude quedan en la bitácora como "Claude".</p>' +
      '<p class="muted">Colaboradores: comparte la app como Lector (solo lectura) a tu esposa o a Cristian. Solo tú y los editores pueden cambiar datos.</p></section>';
    return h;
  }

  root.DU = {
    U: U, esc: esc, ic: ic, NAV: NAV, TITLES: TITLES, navHtml: navHtml, tabbarHtml: tabbarHtml, connHtml: connHtml, stampHtml: stampHtml,
    captureHtml: captureHtml, summaryText: summaryText,
    views: { hoy: vHoy, agenda: vAgenda, actividades: vActividades, control: vControl, indicadores: vIndicadores, habitos: vHabitos, semana: vSemana, frentes: vFrentes, laboratorio: vLab, resumen: vResumen, bitacora: vBitacora, ajustes: vAjustes }
  };
})(window);
