/* Derrotero · lógica de negocio pura (sin DOM, sin red).
 * Se usa igual en el navegador (window.DL) y en las pruebas de Node (require).
 * Zona horaria: America/Bogota, UTC−5 fijo (Colombia no usa horario de verano). */
(function (root) {
  'use strict';

  var TZ_OFFSET_MIN = -300; // America/Bogota
  var DAY = 86400000;

  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

  var STATUSES = ['pendiente', 'en curso', 'hecha', 'bloqueada'];
  var MODOS = ['operar', 'construir', 'explorar', 'laboratorio'];
  var MAX_CONSTRUIR = 2;

  // ───────────────────────── fechas en Bogotá ─────────────────────────

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** 'YYYY-MM-DD' de hoy en Bogotá. */
  function todayBogota(now) {
    var t = (now == null ? Date.now() : now) + TZ_OFFSET_MIN * 60000;
    return new Date(t).toISOString().slice(0, 10);
  }

  /** 'HH:MM' de ahora en Bogotá. */
  function nowTimeBogota(now) {
    var t = (now == null ? Date.now() : now) + TZ_OFFSET_MIN * 60000;
    return new Date(t).toISOString().slice(11, 16);
  }

  /** Instante absoluto (ms) de una fecha y hora locales de Bogotá. */
  function bogotaEpoch(date, time) {
    return Date.parse(date + 'T' + (time || '00:00') + ':00-05:00');
  }

  function parseDate(s) {
    var p = String(s).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }

  function toDateStr(d) { return d.toISOString().slice(0, 10); }

  function isDateStr(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseDate(s)); }

  function addDays(date, n) { return toDateStr(new Date(parseDate(date).getTime() + n * DAY)); }

  function diffDays(a, b) { return Math.round((parseDate(a) - parseDate(b)) / DAY); }

  /** 0 = domingo … 6 = sábado */
  function weekday(date) { return parseDate(date).getUTCDay(); }

  /** Lunes de la semana de la fecha. */
  function mondayOf(date) { var w = weekday(date); return addDays(date, w === 0 ? -6 : 1 - w); }

  function isoWeekKey(date) {
    var d = parseDate(date);
    var day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    var wk = Math.ceil(((d - y0) / DAY + 1) / 7);
    return d.getUTCFullYear() + '-S' + pad(wk);
  }

  function lastDayOfMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function fmtDate(date, opts) {
    if (!isDateStr(date)) return '';
    var d = parseDate(date);
    var s = d.getUTCDate() + ' ' + MESES_CORTO[d.getUTCMonth()];
    if (!opts || opts.year !== false) s += ' ' + d.getUTCFullYear();
    if (opts && opts.weekday) s = DIAS_CORTO[d.getUTCDay()] + ' ' + s;
    return s;
  }

  function fmtDateLong(date) {
    if (!isDateStr(date)) return '';
    var d = parseDate(date);
    return DIAS[d.getUTCDay()] + ' ' + d.getUTCDate() + ' de ' + MESES[d.getUTCMonth()] + ' de ' + d.getUTCFullYear();
  }

  /** '15:30' → '3:30 p. m.' (formato colombiano) */
  function fmtTime(time) {
    if (!time) return '';
    var p = time.split(':'); var h = +p[0]; var m = p[1];
    var suf = h < 12 ? 'a. m.' : 'p. m.';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + m + ' ' + suf;
  }

  function fmtCOP(n) {
    return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function fmtNum(n) { return String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  function relDay(date, today) {
    var n = diffDays(date, today);
    if (n === 0) return 'hoy';
    if (n === 1) return 'mañana';
    if (n === -1) return 'ayer';
    if (n > 1 && n < 7) return DIAS[weekday(date)];
    if (n < 0) return 'hace ' + (-n) + ' días';
    return 'en ' + n + ' días';
  }

  function quarterOf(date) {
    var d = parseDate(date); var q = Math.floor(d.getUTCMonth() / 3) + 1;
    return d.getUTCFullYear() + '-T' + q;
  }

  function quarterEnd(q) {
    var y = +q.slice(0, 4); var n = +q.slice(-1); var m = n * 3;
    return y + '-' + pad(m) + '-' + pad(lastDayOfMonth(y, m));
  }

  function quarterLabel(q) {
    var n = +q.slice(-1); var y = q.slice(0, 4);
    var r = ['ene – mar', 'abr – jun', 'jul – sep', 'oct – dic'][n - 1];
    return 'T' + n + ' ' + y + ' · ' + r;
  }

  // ───────────────────────── actividades ─────────────────────────

  /** RN-01: vencida = fecha anterior a hoy (Bogotá) y no hecha. */
  function isOverdue(task, today) {
    return !!task && isDateStr(task.due) && task.status !== 'hecha' && task.due < today;
  }

  /** Ciclo rápido. Devuelve null cuando la actividad está bloqueada (H-04: requiere confirmación). */
  function nextStatus(status) {
    if (status === 'bloqueada') return null;
    if (status === 'pendiente') return 'en curso';
    if (status === 'en curso') return 'hecha';
    return 'pendiente';
  }

  /** Valida un cambio de estado. Bloquear exige la causa. */
  function validateStatusChange(task, next, cause) {
    if (STATUSES.indexOf(next) < 0) return { ok: false, error: 'Estado desconocido.' };
    if (next === 'bloqueada' && !String(cause || task.blockCause || '').trim()) {
      return { ok: false, error: 'Escribe la causa del bloqueo antes de marcarla como bloqueada.' };
    }
    return { ok: true };
  }

  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      var o = (a.order || 0) - (b.order || 0);
      if (o) return o;
      return String(a.due || '9999').localeCompare(String(b.due || '9999'));
    });
  }

  function progress(tasks) {
    var total = tasks.length;
    var done = tasks.filter(function (t) { return t.status === 'hecha'; }).length;
    return { total: total, done: done, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  function nextOrder(tasks, phase) {
    var max = 0;
    tasks.forEach(function (t) { if (t.phase === phase && (t.order || 0) > max) max = t.order || 0; });
    return max + 1;
  }

  /** Reordena dentro de una etapa: devuelve [{id, order}] con órdenes 1..n. */
  function reorder(tasks, phase, draggedId, targetId, after) {
    var list = sortTasks(tasks.filter(function (t) { return t.phase === phase; }));
    var dragged = list.filter(function (t) { return t.id === draggedId; })[0];
    if (!dragged) return [];
    list = list.filter(function (t) { return t.id !== draggedId; });
    var idx = list.findIndex(function (t) { return t.id === targetId; });
    if (idx < 0) idx = list.length; else if (after) idx += 1;
    list.splice(idx, 0, dragged);
    return list.map(function (t, i) { return { id: t.id, order: i + 1 }; });
  }

  function upcoming(tasks, today, days) {
    var end = addDays(today, days == null ? 7 : days);
    return sortByDue(tasks.filter(function (t) {
      return t.status !== 'hecha' && isDateStr(t.due) && t.due >= today && t.due <= end;
    }));
  }

  function overdueList(tasks, today) {
    return sortByDue(tasks.filter(function (t) { return isOverdue(t, today); }));
  }

  function sortByDue(list) {
    return list.slice().sort(function (a, b) { return String(a.due).localeCompare(String(b.due)); });
  }

  function filterTasks(tasks, f, today) {
    var q = (f.q || '').trim().toLowerCase();
    return tasks.filter(function (t) {
      if (f.front && f.front !== 'todos' && t.front !== f.front) return false;
      if (f.status && f.status !== 'todos' && t.status !== f.status) return false;
      if (f.owner && f.owner !== 'todos' && t.owner !== f.owner) return false;
      if (f.hideDone && t.status === 'hecha') return false;
      if (f.onlyOverdue && !isOverdue(t, today)) return false;
      if (q && (t.title + ' ' + (t.note || '') + ' ' + (t.owner || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  // ───────────────────────── indicadores ─────────────────────────

  /** RN-05: nunca por debajo de cero. */
  function clampKpi(v) { v = Math.round(Number(v) || 0); return v < 0 ? 0 : v; }

  function applyKpiDelta(current, delta) {
    var next = clampKpi((current || 0) + delta);
    return { value: next, applied: next - (current || 0) };
  }

  /** Serie en el tiempo a partir de movimientos fechados: [{date, value}] */
  function kpiSeries(events, key, start) {
    var ev = events.filter(function (e) { return e.kpi === key; })
      .sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    var pts = [{ date: start, value: 0 }];
    ev.forEach(function (e) { pts.push({ date: e.date, value: e.value }); });
    return pts;
  }

  // ───────────────────────── frentes por modo ─────────────────────────

  /** RN-03: devuelve {ok} o {ok:false, current:[frentes en construir]} */
  function checkModeChange(fronts, frontId, nextMode) {
    if (nextMode !== 'construir') return { ok: true };
    var current = fronts.filter(function (f) { return f.mode === 'construir' && f.id !== frontId; });
    if (current.length >= MAX_CONSTRUIR) return { ok: false, current: current };
    return { ok: true };
  }

  // ───────────────────────── hábitos ─────────────────────────

  /** Clave del periodo al que pertenece una fecha según la frecuencia. */
  function periodKey(freq, date) {
    if (freq === 'diario') return date;
    if (freq === 'semanal') return isoWeekKey(date);
    if (freq === 'quincenal') return date.slice(0, 7) + (+date.slice(8, 10) <= 15 ? '-Q1' : '-Q2');
    if (freq === 'mensual') return date.slice(0, 7);
    return date;
  }

  function prevPeriodDate(freq, date) {
    if (freq === 'diario') return addDays(date, -1);
    if (freq === 'semanal') return addDays(mondayOf(date), -1);
    if (freq === 'quincenal') {
      var d = +date.slice(8, 10);
      return d > 15 ? date.slice(0, 7) + '-15' : addDays(date.slice(0, 7) + '-01', -1);
    }
    if (freq === 'mensual') return addDays(date.slice(0, 7) + '-01', -1);
    return addDays(date, -1);
  }

  function isScheduledDay(habit, date) {
    if (habit.freq !== 'diario' || !habit.days || !habit.days.length) return true;
    return habit.days.indexOf(weekday(date)) >= 0;
  }

  function periodCount(habit, logs, date) {
    var key = periodKey(habit.freq, date);
    return Object.keys(logs || {}).filter(function (d) { return logs[d] && periodKey(habit.freq, d) === key; }).length;
  }

  /** Racha: periodos consecutivos cumplidos. El periodo en curso cuenta si ya se cumplió. */
  function habitStreak(habit, logs, today) {
    var target = habit.target || 1;
    var streak = 0; var date = today; var guard = 0;
    if (periodCount(habit, logs, date) >= target) streak = 1;
    date = prevPeriodDate(habit.freq, date);
    while (guard++ < 400) {
      if (habit.freq === 'diario' && !isScheduledDay(habit, date)) { date = addDays(date, -1); continue; }
      if (periodCount(habit, logs, date) >= target) { streak++; date = prevPeriodDate(habit.freq, date); } else break;
    }
    return streak;
  }

  function habitStatus(habit, logs, today) {
    var target = habit.target || 1;
    var count = periodCount(habit, logs, today);
    return { count: count, target: target, done: count >= target, scheduledToday: isScheduledDay(habit, today) };
  }

  // ───────────────────────── laboratorio ─────────────────────────

  /** RN-04: el proyecto cuyo trimestre cerró sin decisión registrada. */
  function labNeedsDecision(p, today) {
    return !!p.quarter && today > quarterEnd(p.quarter) && !p.decision;
  }

  // ───────────────────────── agenda: lenguaje natural ─────────────────────────

  var NUM_WORDS = {
    'un': 1, 'una': 1, 'uno': 1, 'dos': 2, 'tres': 3, 'cuatro': 4, 'cinco': 5, 'seis': 6, 'siete': 7,
    'ocho': 8, 'nueve': 9, 'diez': 10, 'once': 11, 'doce': 12, 'quince': 15, 'veinte': 20,
    'treinta': 30, 'cuarenta y cinco': 45, 'cuarenta': 40, 'sesenta': 60, 'noventa': 90
  };
  var NUM_RE = '(\\d{1,3}|cuarenta y cinco|un[oa]?|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|sesenta|noventa)';
  var NUM_NC = '(?:' + NUM_RE.slice(1, -1) + ')';
  var WEEKDAYS_RE = '(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)';
  var WD_INDEX = { 'domingo': 0, 'lunes': 1, 'martes': 2, 'miercoles': 3, 'miércoles': 3, 'jueves': 4, 'viernes': 5, 'sabado': 6, 'sábado': 6 };
  var MONTH_RE = '(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)';

  function num(w) {
    if (w == null) return null;
    w = String(w).toLowerCase().trim();
    if (/^\d+$/.test(w)) return +w;
    return NUM_WORDS.hasOwnProperty(w) ? NUM_WORDS[w] : null;
  }

  function unitToMin(n, unit) {
    unit = unit.toLowerCase();
    if (/^h/.test(unit)) return n * 60;
    if (/^d/.test(unit)) return n * 1440;
    if (/^sem/.test(unit)) return n * 10080;
    return n;
  }

  var FRONT_KEYWORDS = [
    ['LinkedIn', /linked ?in|publicaci[oó]n|post\b|comentarios?/i],
    ['Empleo', /headhunter|cazatalentos|entrevista|empleo|hoja de vida|reclutador/i],
    ['Finca', /finca|predio|altaverde|supat[aá]|silvania|san francisco/i],
    ['Laboratorio', /zonal|berry|laboratorio/i],
    ['Activos', /apartamento|rentas? cortas?|portafolio|acciones|inmobiliari/i],
    ['IKM', /\bikm\b|comit[eé]|comisiones/i],
    ['Negocio propio', /cristian|suscripci[oó]n|fundador|ticket alto|cliente|oferta|sas\b|contador|abogado/i]
  ];

  function guessFront(text) {
    for (var i = 0; i < FRONT_KEYWORDS.length; i++) if (FRONT_KEYWORDS[i][1].test(text)) return FRONT_KEYWORDS[i][0];
    return '';
  }

  /**
   * Interpreta una frase dictada o escrita en español.
   * Devuelve {title, date, time, durationMin, remindMin, front, assumptions[]}.
   * Todo lo que el parser deduce sin que la frase lo diga queda en `assumptions`.
   */
  function parseAgenda(text, now) {
    now = now == null ? Date.now() : now;
    var today = todayBogota(now);
    var nowT = nowTimeBogota(now);
    var src = ' ' + String(text || '').replace(/\s+/g, ' ').trim() + ' ';
    var work = src;
    var out = { title: '', date: '', time: '', durationMin: 30, remindMin: null, front: '', assumptions: [] };
    var period = null; // mañana/tarde/noche como franja del día
    var explicitMeridiem = null;

    function take(re, fn) {
      var m = re.exec(work);
      if (!m) return false;
      var r = fn(m);
      if (r === false) return false;
      work = work.slice(0, m.index) + ' ' + work.slice(m.index + m[0].length);
      return true;
    }

    // 1. recordatorio: "recuérdame 30 minutos antes", "avísame media hora antes", "con 1 día de anticipación"
    take(new RegExp('\\s(?:y\\s+)?(?:(?:recu[eé]rdame(?:lo)?|av[ií]same|notif[ií]came|con recordatorio|recordatorio)\\s+(?:de\\s+|con\\s+)?)?(?:con\\s+)?(media|' + NUM_NC + ')\\s+(horas?|h|minutos?|mins?|d[ií]as?)\\s+(?:antes|de anticipaci[oó]n)', 'i'), function (m) {
      out.remindMin = m[1].toLowerCase() === 'media' ? 30 : unitToMin(num(m[1]), m[2]);
    });
    take(/\s(?:y\s+)?(?:recu[eé]rdame|av[ií]same)\s+media hora antes/i, function () { out.remindMin = 30; });

    // 2. duración: "por 2 horas", "durante 45 minutos", "por media hora"
    take(new RegExp('\\s(?:por|durante)\\s+(media hora|' + NUM_NC + '\\s+(?:horas?|minutos?|mins?))', 'i'), function (m) {
      var s = m[1].toLowerCase();
      if (s === 'media hora') { out.durationMin = 30; return; }
      var mm = new RegExp(NUM_RE + '\\s+(horas?|minutos?|mins?)', 'i').exec(s);
      out.durationMin = unitToMin(num(mm[1]), mm[2]);
    });

    // 3. relativo: "en 20 minutos", "dentro de 2 horas", "en 3 días", "en una semana"
    take(new RegExp('\\s(?:en|dentro de)\\s+(media hora|' + NUM_NC + '\\s+(?:horas?|minutos?|mins?|d[ií]as?|semanas?))', 'i'), function (m) {
      var s = m[1].toLowerCase();
      var mins;
      if (s === 'media hora') mins = 30;
      else { var mm = new RegExp(NUM_RE + '\\s+(horas?|minutos?|mins?|d[ií]as?|semanas?)', 'i').exec(s); mins = unitToMin(num(mm[1]), mm[2]); }
      if (mins < 1440) {
        var t = now + mins * 60000;
        out.date = todayBogota(t); out.time = nowTimeBogota(t);
      } else {
        out.date = addDays(today, Math.round(mins / 1440));
      }
    });

    // 4. hora explícita: "a las 3 de la tarde", "a las 10:30", "a las 8 y media", "a la una", "15:00", "3 pm"
    var HOUR_WORDS = '(\\d{1,2}|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce)';
    var MERID = '(a\\.?\\s?m\\.?|p\\.?\\s?m\\.?|de la ma[ñn]ana|de la tarde|de la noche|del mediod[ií]a|en punto)?';
    var gotTime = take(new RegExp('\\s(?:a\\s+las?|a eso de las?|tipo|sobre las?)\\s+' + HOUR_WORDS + '(?::(\\d{2})|\\s+y\\s+(media|cuarto|' + NUM_NC + '))?\\s*' + MERID + '(?=[\\s,.;]|$)', 'i'), function (m) {
      var h = num(m[1]); var min = 0;
      if (m[2]) min = +m[2];
      else if (m[3]) min = m[3].toLowerCase() === 'media' ? 30 : m[3].toLowerCase() === 'cuarto' ? 15 : num(m[3]) || 0;
      if (h == null || h > 23 || min > 59) return false;
      setHour(h, min, m[4]);
    });
    if (!gotTime) gotTime = take(new RegExp('\\s(\\d{1,2}):(\\d{2})\\s*' + MERID + '(?=[\\s,.;]|$)', 'i'), function (m) {
      var h = +m[1]; var min = +m[2]; if (h > 23 || min > 59) return false; setHour(h, min, m[3]);
    });
    if (!gotTime) gotTime = take(/\s(\d{1,2})\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?=[\s,.;]|$)/i, function (m) {
      var h = +m[1]; if (h > 12) return false; setHour(h, 0, m[2]);
    });

    function setHour(h, min, mer) {
      mer = (mer || '').toLowerCase().replace(/\s|\./g, '');
      if (/^pm$|tarde|noche/.test(mer)) { explicitMeridiem = 'pm'; if (h < 12) h += 12; }
      else if (/^am$|manana|mañana/.test(mer)) { explicitMeridiem = 'am'; if (h === 12) h = 0; }
      else if (/mediod/.test(mer)) { explicitMeridiem = 'pm'; }
      else if (h >= 1 && h <= 6) { h += 12; out.assumptions.push('Sin a. m. / p. m.: asumí ' + fmtTime(pad(h) + ':' + pad(min))); }
      out.time = pad(h) + ':' + pad(min);
    }

    // 5. franja del día: "en la mañana", "por la tarde", "en la noche", "al mediodía", "esta tarde", "esta noche"
    take(/\s(esta|en la|por la|de la)\s+(ma[ñn]ana|tarde|noche)(?=[\s,.;]|$)/i, function (m) {
      var w = m[2].toLowerCase().replace('manana', 'mañana');
      if (m[1].toLowerCase() === 'esta' && !out.date) out.date = today;
      period = w;
    });
    take(/\s(?:al|a|el)\s+mediod[ií]a(?=[\s,.;]|$)/i, function () { period = 'mediodía'; });

    // 6. fecha
    take(/\spasado ma[ñn]ana(?=[\s,.;]|$)/i, function () { out.date = addDays(today, 2); });
    take(/\sma[ñn]ana(?=[\s,.;]|$)/i, function () { out.date = addDays(today, 1); });
    take(/\shoy(?=[\s,.;]|$)/i, function () { out.date = today; });
    take(new RegExp('\\s(?:(el|este|esta)\\s+)?(?:(pr[oó]ximo)\\s+)?' + WEEKDAYS_RE + '(?:\\s+(pr[oó]ximo|que viene))?(?=[\\s,.;]|$)', 'i'), function (m) {
      var target = WD_INDEX[m[3].toLowerCase()];
      var cur = weekday(today);
      var delta = (target - cur + 7) % 7;
      var isEste = m[1] && /^est/i.test(m[1]);
      if (delta === 0 && !isEste) delta = 7; // "el viernes" dicho un viernes = el de la otra semana
      out.date = addDays(today, delta);
    });
    take(new RegExp('\\s(?:el\\s+)?(\\d{1,2}|' + NUM_NC + ')\\s+de\\s+' + MONTH_RE + '(?:\\s+(?:de|del)\\s+(\\d{4}))?(?=[\\s,.;]|$)', 'i'), function (m) {
      var d = num(m[1]); var mo = MESES.indexOf(m[2].toLowerCase().replace('setiembre', 'septiembre')) + 1;
      var y = m[3] ? +m[3] : +today.slice(0, 4);
      if (!d || d > lastDayOfMonth(y, mo)) return false;
      var ds = y + '-' + pad(mo) + '-' + pad(d);
      if (!m[3] && ds < today) ds = (y + 1) + '-' + pad(mo) + '-' + pad(d);
      out.date = ds;
    });
    take(/\s(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?=[\s,.;]|$)/, function (m) {
      var d = +m[1]; var mo = +m[2]; var y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +today.slice(0, 4);
      if (mo < 1 || mo > 12 || d < 1 || d > lastDayOfMonth(y, mo)) return false;
      var ds = y + '-' + pad(mo) + '-' + pad(d);
      if (!m[3] && ds < today) ds = (y + 1) + '-' + pad(mo) + '-' + pad(d);
      out.date = ds;
    });
    take(/\sel\s+(\d{1,2})(?=[\s,.;]|$)/i, function (m) {
      var d = +m[1]; var y = +today.slice(0, 4); var mo = +today.slice(5, 7);
      if (d < 1 || d > 31) return false;
      if (d < +today.slice(8, 10)) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
      if (d > lastDayOfMonth(y, mo)) return false;
      out.date = y + '-' + pad(mo) + '-' + pad(d);
    });

    // franja sin hora exacta
    if (!out.time && period) {
      var map = { 'mañana': '09:00', 'mediodía': '12:00', 'tarde': '15:00', 'noche': '19:00' };
      out.time = map[period];
      out.assumptions.push('"' + period + '" sin hora exacta: asumí ' + fmtTime(out.time));
    } else if (out.time && period && !explicitMeridiem) {
      var h = +out.time.slice(0, 2);
      if ((period === 'tarde' || period === 'noche') && h < 12) out.time = pad(h + 12) + out.time.slice(2);
      if (period === 'mañana' && h >= 12 && h < 19) out.time = pad(h - 12) + out.time.slice(2);
      out.assumptions = out.assumptions.filter(function (a) { return a.indexOf('Sin a. m.') !== 0; });
    }

    // fecha por defecto
    if (!out.date) {
      if (out.time) {
        if (out.time > nowT) out.date = today;
        else { out.date = addDays(today, 1); out.assumptions.push('Esa hora ya pasó hoy: la puse para mañana.'); }
      } else {
        out.date = today;
        out.assumptions.push('Sin fecha: la puse para hoy.');
      }
    }
    if (out.remindMin == null) out.remindMin = out.time ? 15 : 0;

    // 7. título: lo que queda sin fechas, horas ni muletillas
    var t = work.replace(/\s+/g, ' ').trim();
    var FILLER = /^(?:(?:por favor|oye|claude|derrotero|emilia)[,\s]+)?(?:agr[eé]ga(?:me|r)?|a[ñn]ade|a[ñn]adir|agenda(?:r|me)?|pon(?:me|er)?|programa(?:r|me)?|crea(?:r)?|anota(?:r)?|recu[eé]rdame|recordar|tengo|hay|nueva actividad|actividad|recordatorio)\b[\s:,]*/i;
    for (var i = 0; i < 4; i++) {
      var before = t;
      t = t.replace(FILLER, '').replace(/^(?:que|de|para|el|la|en|a|y|un|una)\s+/i, '');
      if (t === before) break;
    }
    t = t.replace(/(?:\s+(?:el|la|a|de|para|y|en|que|con|las|los))+\s*$/i, '');
    t = t.replace(/\s+([,.;:])/g, '$1').replace(/^[\s,.;:]+|[\s,.;:]+$/g, '').replace(/\s{2,}/g, ' ');
    out.title = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
    out.front = guessFront(src);
    return out;
  }

  // ───────────────────────── agenda: estados y recordatorios ─────────────────────────

  function agendaTimes(item) {
    var timed = !!item.time;
    var start = bogotaEpoch(item.date, timed ? item.time : '08:00');
    var end = timed ? start + (item.durationMin || 30) * 60000 : bogotaEpoch(item.date, '23:59') + 59000;
    var remindAt = start - (item.remindMin || 0) * 60000;
    return { start: start, end: end, remindAt: remindAt, timed: timed };
  }

  /** hecha · vencida · en curso · por recordar · programada */
  function agendaState(item, now) {
    if (item.done) return 'hecha';
    var t = agendaTimes(item);
    if (now >= t.end) return 'vencida';
    if (now >= t.start) return 'en curso';
    if (now >= t.remindAt) return 'por recordar';
    return 'programada';
  }

  function sortAgenda(list) {
    return list.slice().sort(function (a, b) { return agendaTimes(a).start - agendaTimes(b).start; });
  }

  /** Recordatorios que deben dispararse ahora y no se han mostrado. */
  function dueReminders(items, now, shown) {
    shown = shown || {};
    var out = [];
    items.forEach(function (it) {
      if (it.done) return;
      var t = agendaTimes(it);
      var keyR = it.id + '@' + t.remindAt;
      var keyV = it.id + '@v' + t.end;
      if (now >= t.remindAt && now < t.end && !shown[keyR]) out.push({ kind: 'recordar', item: it, key: keyR });
      else if (now >= t.end && now - t.end < 12 * 3600000 && !shown[keyV]) out.push({ kind: 'vencida', item: it, key: keyV });
    });
    return out;
  }

  /** Posponer: mueve el inicio. `mode` = '15m' | '1h' | 'manana' */
  function postpone(item, mode, now) {
    var t = agendaTimes(item);
    if (mode === 'manana') return { date: addDays(item.date < todayBogota(now) ? todayBogota(now) : item.date, 1), time: item.time };
    var base = Math.max(t.start, now);
    var next = base + (mode === '1h' ? 60 : 15) * 60000;
    return { date: todayBogota(next), time: nowTimeBogota(next) };
  }

  // ───────────────────────── calendario (.ics y enlaces) ─────────────────────────

  function icsEscape(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }

  function icsFold(line) {
    var out = []; var s = line;
    while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
    out.push(s);
    return out.join('\r\n');
  }

  function utcStamp(ms) { return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }

  function eventToIcs(item, stamp) {
    var t = agendaTimes(item);
    var lines = ['BEGIN:VEVENT', 'UID:' + item.id + '@derrotero', 'DTSTAMP:' + utcStamp(stamp)];
    if (t.timed) {
      lines.push('DTSTART:' + utcStamp(t.start), 'DTEND:' + utcStamp(t.end));
    } else {
      lines.push('DTSTART;VALUE=DATE:' + item.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(item.date, 1).replace(/-/g, ''));
    }
    lines.push('SUMMARY:' + icsEscape(item.title));
    if (item.front || item.note) lines.push('DESCRIPTION:' + icsEscape([item.front ? 'Frente: ' + item.front : '', item.note || ''].filter(Boolean).join('\n')));
    var trig = t.timed ? (item.remindMin || 0) : 0;
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEscape(item.title),
      t.timed ? 'TRIGGER:-PT' + trig + 'M' : 'TRIGGER;VALUE=DATE-TIME:' + utcStamp(t.remindAt), 'END:VALARM', 'END:VEVENT');
    return lines;
  }

  var BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

  function blockToIcs(b, today, stamp) {
    var delta = (b.day - weekday(today) + 7) % 7;
    var date = addDays(today, delta);
    return ['BEGIN:VEVENT', 'UID:' + b.id + '@derrotero-semana', 'DTSTAMP:' + utcStamp(stamp),
      'DTSTART:' + utcStamp(bogotaEpoch(date, b.start)), 'DTEND:' + utcStamp(bogotaEpoch(date, b.end)),
      'RRULE:FREQ=WEEKLY;BYDAY=' + BYDAY[b.day], 'SUMMARY:' + icsEscape(b.title),
      b.note ? 'DESCRIPTION:' + icsEscape(b.note) : null, 'END:VEVENT'].filter(Boolean);
  }

  function buildIcs(name, eventLines) {
    var lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Derrotero//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEscape(name), 'X-WR-TIMEZONE:America/Bogota'];
    eventLines.forEach(function (l) { lines = lines.concat(l); });
    lines.push('END:VCALENDAR');
    return lines.map(icsFold).join('\r\n') + '\r\n';
  }

  function agendaIcs(items, now) {
    return buildIcs('Derrotero · agenda', items.map(function (i) { return eventToIcs(i, now); }));
  }

  function weekIcs(blocks, today, now) {
    return buildIcs('Derrotero · semana tipo', blocks.map(function (b) { return blockToIcs(b, today, now); }));
  }

  function googleCalendarUrl(item) {
    var t = agendaTimes(item);
    var dates = t.timed ? utcStamp(t.start) + '/' + utcStamp(t.end)
      : item.date.replace(/-/g, '') + '/' + addDays(item.date, 1).replace(/-/g, '');
    var details = [item.front ? 'Frente: ' + item.front : '', item.remindMin ? 'Recordar ' + item.remindMin + ' min antes' : '', 'Creado en Derrotero'].filter(Boolean).join('\n');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(item.title) +
      '&dates=' + dates + '&ctz=America%2FBogota&details=' + encodeURIComponent(details);
  }

  function outlookUrl(item) {
    var t = agendaTimes(item);
    var s = new Date(t.start).toISOString(); var e = new Date(t.end).toISOString();
    return 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' +
      encodeURIComponent(item.title) + '&startdt=' + encodeURIComponent(s) + '&enddt=' + encodeURIComponent(e) +
      (t.timed ? '' : '&allday=true') + '&body=' + encodeURIComponent('Creado en Derrotero');
  }

  // ───────────────────────── resumen semanal ─────────────────────────

  function weeklySummary(s, today) {
    var mon = mondayOf(today); var sun = addDays(mon, 6);
    var tasks = s.tasks; var p = progress(tasks);
    var L = [];
    L.push('RESUMEN SEMANAL · DERROTERO');
    L.push('Semana del ' + fmtDate(mon, { year: false }) + ' al ' + fmtDate(sun) + ' · generado el ' + fmtDateLong(today));
    L.push('');
    L.push('AVANCE: ' + p.pct + ' % · ' + p.done + ' de ' + p.total + ' actividades hechas');
    var od = overdueList(tasks, today);
    L.push('');
    L.push('VENCIDAS (' + od.length + ')');
    if (!od.length) L.push('  Ninguna.');
    od.forEach(function (t) { L.push('  · ' + t.title + ' — ' + t.owner + ' — vencía el ' + fmtDate(t.due)); });
    var done = tasks.filter(function (t) { return t.status === 'hecha' && t.doneAt && t.doneAt >= mon && t.doneAt <= sun; });
    L.push('');
    L.push('COMPLETADAS ESTA SEMANA (' + done.length + ')');
    if (!done.length) L.push('  Ninguna.');
    done.forEach(function (t) { L.push('  · ' + t.title); });
    L.push('');
    L.push('INDICADORES');
    (s.kpiDefs || []).forEach(function (k) {
      var v = (s.kpiValues || {})[k.key] || 0;
      L.push('  · ' + k.label + ': ' + v + ' de ' + k.target + ' (meta ' + fmtDate(k.due) + ')');
    });
    var up = upcoming(tasks, today, 7);
    var ag = sortAgenda((s.agenda || []).filter(function (a) { return !a.done && a.date >= today && a.date <= addDays(today, 7); }));
    L.push('');
    L.push('PRÓXIMOS 7 DÍAS');
    if (!up.length && !ag.length) L.push('  Nada programado.');
    up.forEach(function (t) { L.push('  · ' + fmtDate(t.due, { year: false, weekday: true }) + ' — ' + t.title + ' (' + t.owner + ')'); });
    ag.forEach(function (a) { L.push('  · ' + fmtDate(a.date, { year: false, weekday: true }) + (a.time ? ' ' + fmtTime(a.time) : '') + ' — ' + a.title + ' [agenda]'); });
    if (s.habits && s.habits.length) {
      L.push('');
      L.push('HÁBITOS');
      s.habits.forEach(function (h) {
        var st = habitStatus(h, (s.habitLogs || {})[h.id] || {}, today);
        L.push('  · ' + h.title + ': ' + st.count + ' de ' + st.target + ' en el periodo · racha ' + habitStreak(h, (s.habitLogs || {})[h.id] || {}, today));
      });
    }
    return L.join('\n');
  }

  // ───────────────────────── bitácora ─────────────────────────

  function diffFields(before, after, fields) {
    var out = [];
    fields.forEach(function (f) {
      var a = before ? before[f] : undefined; var b = after ? after[f] : undefined;
      if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field: f, before: a == null ? '' : a, after: b == null ? '' : b });
    });
    return out;
  }

  // ───────────────────────── zip mínimo (almacenado) ─────────────────────────

  var CRC_TABLE = null;
  function crc32(bytes) {
    if (!CRC_TABLE) {
      CRC_TABLE = [];
      for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_TABLE[n] = c >>> 0; }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(s) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s);
    return Uint8Array.from(Buffer.from(s, 'utf8'));
  }

  /** files: [{name, text}] → Uint8Array de un .zip sin compresión. */
  function makeZip(files) {
    var parts = []; var central = []; var offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = utf8(f.name); var data = utf8(f.text); var crc = crc32(data);
      var local = [].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(Uint8Array.from(local), name, data);
      central.push(Uint8Array.from([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset))), name);
      offset += local.length + name.length + data.length;
    });
    var cdSize = central.reduce(function (s, p) { return s + p.length; }, 0);
    var end = Uint8Array.from([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(cdSize), u32(offset), u16(0)));
    var all = parts.concat(central, [end]);
    var total = all.reduce(function (s, p) { return s + p.length; }, 0);
    var out = new Uint8Array(total); var pos = 0;
    all.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  var DL = {
    TZ_OFFSET_MIN: TZ_OFFSET_MIN, MESES: MESES, MESES_CORTO: MESES_CORTO, DIAS: DIAS, DIAS_CORTO: DIAS_CORTO,
    STATUSES: STATUSES, MODOS: MODOS, MAX_CONSTRUIR: MAX_CONSTRUIR,
    pad: pad, todayBogota: todayBogota, nowTimeBogota: nowTimeBogota, bogotaEpoch: bogotaEpoch, isDateStr: isDateStr,
    addDays: addDays, diffDays: diffDays, weekday: weekday, mondayOf: mondayOf, isoWeekKey: isoWeekKey,
    fmtDate: fmtDate, fmtDateLong: fmtDateLong, fmtTime: fmtTime, fmtCOP: fmtCOP, fmtNum: fmtNum, relDay: relDay,
    quarterOf: quarterOf, quarterEnd: quarterEnd, quarterLabel: quarterLabel, lastDayOfMonth: lastDayOfMonth,
    isOverdue: isOverdue, nextStatus: nextStatus, validateStatusChange: validateStatusChange, sortTasks: sortTasks,
    progress: progress, nextOrder: nextOrder, reorder: reorder, upcoming: upcoming, overdueList: overdueList, filterTasks: filterTasks,
    clampKpi: clampKpi, applyKpiDelta: applyKpiDelta, kpiSeries: kpiSeries,
    checkModeChange: checkModeChange,
    periodKey: periodKey, habitStreak: habitStreak, habitStatus: habitStatus, isScheduledDay: isScheduledDay,
    labNeedsDecision: labNeedsDecision,
    parseAgenda: parseAgenda, guessFront: guessFront, agendaTimes: agendaTimes, agendaState: agendaState, sortAgenda: sortAgenda,
    dueReminders: dueReminders, postpone: postpone,
    agendaIcs: agendaIcs, weekIcs: weekIcs, googleCalendarUrl: googleCalendarUrl, outlookUrl: outlookUrl,
    weeklySummary: weeklySummary, diffFields: diffFields, makeZip: makeZip, crc32: crc32
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DL;
  else root.DL = DL;
})(this);
