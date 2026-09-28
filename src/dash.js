/* Derrotero · tablero de Hoy: el camino del plan (quién camina, por dónde va, qué viene)
 * y los indicadores gráficos de avance y cumplimiento de metas. */
(function (root) {
  'use strict';
  var DL = root.DL, DS = root.DS, DU = root.DU, S = DS.S, U = DU.U, esc = DU.esc, ic = DU.ic;

  // Paleta de la marca: identidad (categórica, orden fijo) y estado (reservada).
  var C = {
    plan: '#008C82', recordatorio: '#EA632B', calendario: '#4B5FB0', ocre: '#AE7A14',
    tinta: '#0C0F14', media: '#4A443C', tenue: '#6E675E', gris: '#8C857A', filete: '#E6DCCB', hondo: '#F5EDE0', papel: '#FCF6EC',
    ok: '#2F6B3C', warn: '#7E560C', bad: '#A32E1E', llama100: '#FBE7D6', llama200: '#F6C8A4'
  };
  var CATS = [C.recordatorio, C.plan, C.calendario, C.ocre];

  function n1(v) { return Math.round(v * 10) / 10; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function tip(text) { return ' data-tip="' + esc(text) + '"'; }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }

  // ───────────────────────── geometría del camino ─────────────────────────
  // Camino en zigzag (como un mapa de juego): filas rectas con ondulación suave y curvas en U.
  var geomCache = {};
  function roadGeom(vertical) {
    var key = vertical ? 'v' : 'h';
    if (geomCache[key]) return geomCache[key];
    var g = vertical ? { W: 360, rows: 7, G: 118, top: 104, mx: 20, bottom: 70 } : { W: 1000, rows: 3, G: 132, top: 104, mx: 30, bottom: 70 };
    var r = g.G / 2, xL = g.mx + r, xR = g.W - g.mx - r;
    var pts = [];
    for (var row = 0; row < g.rows; row++) {
      var y = g.top + row * g.G; var ltr = row % 2 === 0;
      var x0 = row === 0 ? g.mx : (ltr ? xL : xR);
      var x1 = row === g.rows - 1 ? (ltr ? g.W - g.mx : g.mx) : (ltr ? xR : xL);
      var n = Math.max(2, Math.round(Math.abs(x1 - x0) / 4));
      for (var i = row === 0 ? 0 : 1; i <= n; i++) {
        var u = i / n; var x = x0 + (x1 - x0) * u;
        pts.push([x, y + (vertical ? 5 : 8) * Math.sin(Math.PI * u) * Math.sin(2 * Math.PI * (vertical ? 1 : 1.5) * u + row * 1.3)]);
      }
      if (row < g.rows - 1) {
        var steps = 36;
        for (var k = 1; k < steps; k++) {
          var a = -Math.PI / 2 + Math.PI * k / steps;
          pts.push([x1 + Math.cos(a) * r * (ltr ? 1 : -1), y + r + Math.sin(a) * r]);
        }
      }
    }
    var len = [0];
    for (var j = 1; j < pts.length; j++) len.push(len[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]));
    g.pts = pts; g.len = len; g.total = len[len.length - 1];
    g.H = g.top + (g.rows - 1) * g.G + g.bottom;
    g.d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
    geomCache[key] = g;
    return g;
  }

  /** Punto del camino a la distancia s: posición, dirección y normal derecha (y hacia abajo). */
  function at(g, s) {
    s = clamp(s, 0, g.total);
    var lo = 0, hi = g.len.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (g.len[mid] <= s) lo = mid; else hi = mid; }
    var a = g.pts[lo], b = g.pts[hi]; var seg = (g.len[hi] - g.len[lo]) || 1; var t = (s - g.len[lo]) / seg;
    var dx = (b[0] - a[0]) / seg, dy = (b[1] - a[1]) / seg;
    return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, dx: dx, dy: dy, nx: -dy, ny: dx };
  }

  /** Lado derecho del camino, salvo que se salga del lienzo (curvas exteriores): ahí usa el izquierdo. */
  function side(g, p, reach) {
    var x = p.x + p.nx * reach, y = p.y + p.ny * reach;
    return (x < 6 || x > g.W - 6 || y < 6 || y > g.H - 6) ? -1 : 1;
  }

  function planSpan() {
    var cfg = DS.config() || {};
    var start = cfg.planStart || '2026-09-25', end = cfg.planEnd || '2027-06-30';
    return { start: start, end: end, days: Math.max(1, DL.diffDays(end, start)) };
  }
  function sOf(g, span, date) { return g.total * clamp(DL.diffDays(date, span.start) / span.days, 0, 1); }

  function isVertical() {
    var m = document.getElementById('main');
    var w = m ? m.clientWidth : root.innerWidth;
    return (w || root.innerWidth) < 760;
  }

  // ───────────────────────── datos que recorren el camino ─────────────────────────
  var STATUS_COLOR = { hecha: C.ok, 'en curso': C.plan, bloqueada: C.warn, pendiente: C.papel, vencida: C.bad };
  function taskState(t, td) { return DL.isOverdue(t, td) ? 'vencida' : t.status; }
  function worst(states) {
    var order = ['vencida', 'bloqueada', 'en curso', 'pendiente', 'hecha'];
    for (var i = 0; i < order.length; i++) if (states.indexOf(order[i]) >= 0) return order[i];
    return 'pendiente';
  }
  function groupBy(list, key) { var m = {}; list.forEach(function (x) { var k = key(x); if (k) (m[k] = m[k] || []).push(x); }); return m; }

  function roadHtml() {
    var vertical = isVertical();
    var g = roadGeom(vertical); var span = planSpan();
    var td = DS.today(); var now = Date.now();
    var sNow = sOf(g, span, td);
    var tasks = DS.tasks(); var agenda = DS.agenda(); var cal = DS.calendar();
    var inPlan = function (d) { return d && d >= span.start && d <= span.end; };
    var h = '';

    // capas del camino
    h += '<path d="' + g.d + '" fill="none" stroke="' + C.filete + '" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>';
    h += '<path d="' + g.d + '" fill="none" stroke="' + C.hondo + '" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>';
    h += '<path class="road-done" d="' + g.d + '" fill="none" stroke="' + C.llama100 + '" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="' + n1(sNow) + ' ' + Math.ceil(g.total + 40) + '"/>';
    h += '<path d="' + g.d + '" fill="none" stroke="' + C.gris + '" stroke-width="1.5" stroke-dasharray="3 9" stroke-linecap="round" opacity=".7"/>';
    h += '<path class="road-done" d="' + g.d + '" fill="none" stroke="' + C.recordatorio + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="' + n1(sNow) + ' ' + Math.ceil(g.total + 40) + '"/>';

    // meses: marca transversal + rótulo a la izquierda del sentido de la marcha
    var pWalk = at(g, sNow), pS = at(g, 0), pE = at(g, g.total);
    var m0 = span.start.slice(0, 7) + '-01';
    for (var m = m0; m <= span.end; m = DL.addDays(m.slice(0, 8) + DL.pad(DL.lastDayOfMonth(+m.slice(0, 4), +m.slice(5, 7))), 1)) {
      if (m < span.start) continue;
      var p = at(g, sOf(g, span, m)); var mi = +m.slice(5, 7) - 1;
      var lab = DL.MESES_CORTO[mi].replace('.', '').toUpperCase() + (mi === 0 ? ' ' + m.slice(2, 4) : '');
      h += '<line x1="' + n1(p.x - p.nx * 13) + '" y1="' + n1(p.y - p.ny * 13) + '" x2="' + n1(p.x + p.nx * 13) + '" y2="' + n1(p.y + p.ny * 13) + '" stroke="' + C.papel + '" stroke-width="2"/>';
      var lsd = side(g, { x: p.x, y: p.y, nx: -p.nx, ny: -p.ny }, 36) === 1 ? -1 : 1;
      var lx = p.x + lsd * p.nx * 25, ly = p.y + lsd * p.ny * 25;
      var crowded = [pWalk, pS, pE].some(function (q) { return Math.hypot(q.x - p.x, q.y - p.y) < 64; });
      if (!crowded) h += '<text class="rd-month" x="' + n1(lx) + '" y="' + n1(ly + 3.5) + '" text-anchor="middle">' + lab + '</text>';
    }

    // eventos del calendario: "horizonte" de barras a la derecha, largo según cuántos hay ese día
    var byCal = groupBy(cal.filter(function (e) { return inPlan(e.date); }), function (e) { return e.date; });
    Object.keys(byCal).forEach(function (d) {
      var evs = byCal[d]; var p = at(g, sOf(g, span, d)); var n = evs.length;
      var l0 = 31, l1 = 31 + 4 + 4 * Math.min(n, 5);
      var sd = side(g, p, l1 + 4); p = { x: p.x, y: p.y, nx: p.nx * sd, ny: p.ny * sd };
      var txt = plural(n, 'evento', 'eventos') + ' del calendario · ' + DL.fmtDate(d, { weekday: true, year: false }) + '\n' + evs.slice(0, 5).map(function (e) { return '· ' + (e.time ? DL.fmtTime(e.time) + ' ' : '') + e.title; }).join('\n') + (n > 5 ? '\n+' + (n - 5) + ' más' : '');
      h += '<g class="rd-hit" data-act="goto-day" data-d="' + d + '"' + tip(txt) + ' tabindex="0" role="button" aria-label="' + esc(plural(n, 'evento', 'eventos') + ' del calendario el ' + DL.fmtDate(d)) + '">' +
        '<line x1="' + n1(p.x + p.nx * l0) + '" y1="' + n1(p.y + p.ny * l0) + '" x2="' + n1(p.x + p.nx * l1) + '" y2="' + n1(p.y + p.ny * l1) + '" stroke="' + C.calendario + '" stroke-width="3.2" stroke-linecap="round" opacity="' + (d < td ? '.35' : '.95') + '"/>' +
        '<line x1="' + n1(p.x + p.nx * l0) + '" y1="' + n1(p.y + p.ny * l0) + '" x2="' + n1(p.x + p.nx * (l1 + 4)) + '" y2="' + n1(p.y + p.ny * (l1 + 4)) + '" stroke="transparent" stroke-width="10"/></g>';
    });

    // recordatorios dictados: banderín a la izquierda con su poste
    var byAg = groupBy(agenda.filter(function (a) { return inPlan(a.date); }), function (a) { return a.date; });
    Object.keys(byAg).forEach(function (d) {
      var items = DL.sortAgenda(byAg[d]); var p = at(g, sOf(g, span, d)); var n = items.length;
      var venc = items.some(function (a) { return DL.agendaState(a, now) === 'vencida'; });
      var allDone = items.every(function (a) { return a.done; });
      var fill = venc ? C.bad : C.recordatorio;
      var sd = side(g, p, 30); p = { x: p.x, y: p.y, nx: p.nx * sd, ny: p.ny * sd };
      var cx = p.x + p.nx * 21, cy = p.y + p.ny * 21;
      var txt = plural(n, 'recordatorio', 'recordatorios') + ' · ' + DL.fmtDate(d, { weekday: true, year: false }) + '\n' + items.slice(0, 5).map(function (a) { return '· ' + (a.time ? DL.fmtTime(a.time) + ' ' : '') + a.title + ' (' + DL.agendaState(a, now) + ')'; }).join('\n');
      h += '<g class="rd-hit" data-act="goto-day" data-d="' + d + '"' + tip(txt) + ' tabindex="0" role="button" aria-label="' + esc(plural(n, 'recordatorio', 'recordatorios') + ' el ' + DL.fmtDate(d)) + '" opacity="' + (allDone ? '.45' : '1') + '">' +
        '<line x1="' + n1(p.x + p.nx * 13) + '" y1="' + n1(p.y + p.ny * 13) + '" x2="' + n1(cx) + '" y2="' + n1(cy) + '" stroke="' + fill + '" stroke-width="1.5"/>' +
        '<rect x="' + n1(cx - 6.5) + '" y="' + n1(cy - 6.5) + '" width="13" height="13" rx="2" transform="rotate(45 ' + n1(cx) + ' ' + n1(cy) + ')" fill="' + fill + '" stroke="' + C.papel + '" stroke-width="2"/>' +
        (n > 1 ? '<text class="rd-num light" x="' + n1(cx) + '" y="' + n1(cy + 3.5) + '" text-anchor="middle">' + n + '</text>' : '') + '</g>';
    });

    // actividades del plan: hitos sobre el camino, color según estado
    var byTask = groupBy(tasks.filter(function (t) { return inPlan(t.due); }), function (t) { return t.due; });
    Object.keys(byTask).sort().forEach(function (d) {
      var list = byTask[d]; var p = at(g, sOf(g, span, d)); var n = list.length;
      var st = worst(list.map(function (t) { return taskState(t, td); }));
      var fill = STATUS_COLOR[st]; var light = st !== 'pendiente';
      var r = n > 1 ? 9.5 : 7.5;
      var txt = plural(n, 'actividad', 'actividades') + ' del plan · ' + DL.fmtDate(d, { weekday: true, year: false }) + '\n' + DL.sortTasks(list).slice(0, 6).map(function (t) { return '· ' + t.title + ' (' + taskState(t, td) + ')'; }).join('\n') + (n > 6 ? '\n+' + (n - 6) + ' más' : '');
      h += '<g class="rd-hit" data-act="goto-task" data-id="' + list[0].id + '"' + tip(txt) + ' tabindex="0" role="button" aria-label="' + esc(plural(n, 'actividad', 'actividades') + ' con fecha ' + DL.fmtDate(d) + ', ' + st) + '">' +
        '<circle cx="' + n1(p.x) + '" cy="' + n1(p.y) + '" r="' + (r + 5) + '" fill="transparent"/>' +
        '<circle cx="' + n1(p.x) + '" cy="' + n1(p.y) + '" r="' + r + '" fill="' + fill + '" stroke="' + (light ? C.papel : C.tinta) + '" stroke-width="2"/>' +
        (n > 1 ? '<text class="rd-num' + (light ? ' light' : '') + '" x="' + n1(p.x) + '" y="' + n1(p.y + 3.5) + '" text-anchor="middle">' + n + '</text>'
          : st === 'hecha' ? '<path d="M' + n1(p.x - 3.5) + ' ' + n1(p.y + .3) + 'l2.4 2.4 4.6-5" fill="none" stroke="' + C.papel + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' : '') + '</g>';
    });

    // inicio y meta
    var p0 = at(g, 0), p1 = at(g, g.total);
    h += '<g class="rd-flag"><circle cx="' + n1(p0.x) + '" cy="' + n1(p0.y) + '" r="5" fill="' + C.tinta + '"/></g>';
    h += '<g class="rd-flag"><line x1="' + n1(p1.x) + '" y1="' + n1(p1.y) + '" x2="' + n1(p1.x) + '" y2="' + n1(p1.y - 34) + '" stroke="' + C.tinta + '" stroke-width="2"/>' +
      '<path d="M' + n1(p1.x) + ' ' + n1(p1.y - 34) + 'h-18l5 6-5 6h18z" fill="' + C.recordatorio + '"/>' +
      '<text class="rd-month strong" x="' + n1(p1.x - 4) + '" y="' + n1(p1.y + 30) + '" text-anchor="end">META · ' + DL.fmtDate(span.end).toUpperCase() + '</text></g>';

    // pendientes sin fecha: globos que lleva quien camina
    var undated = tasks.filter(function (t) { return !t.due && t.status !== 'hecha'; }).map(function (t) { return { id: t.id, title: t.title, kind: 'actividad' }; })
      .concat(agenda.filter(function (a) { return !a.date && !a.done; }).map(function (a) { return { id: a.id, title: a.title, kind: 'recordatorio' }; }));

    var pw = at(g, sNow);
    h += walkerHtml(pw, td, undated, g.W);

    var aria = 'Camino del plan del ' + DL.fmtDate(span.start) + ' al ' + DL.fmtDate(span.end) + '. Hoy vas en el ' + Math.round(sNow / g.total * 100) + ' % del recorrido.';
    var svg = '<svg class="road-svg' + (vertical ? ' vertical' : '') + '" viewBox="0 0 ' + g.W + ' ' + g.H + '" role="img" aria-label="' + esc(aria) + '" data-snow="' + n1(sNow) + '" data-v="' + (vertical ? 1 : 0) + '">' + h + '</svg>';

    var counts = {
      plan: tasks.filter(function (t) { return inPlan(t.due); }).length,
      rec: agenda.filter(function (a) { return !a.done && a.date >= td; }).length,
      cal: cal.filter(function (e) { return e.date >= td && e.date <= DL.addDays(td, 90); }).length,
      undated: undated.length
    };
    var legend = '<div class="rd-legend">' +
      '<span' + tip('Actividades del plan con fecha, sobre el camino. El color dice su estado: verde hecha, petróleo en curso, blanco pendiente, rojo vencida, ocre bloqueada.') + '><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="6.5" fill="' + C.papel + '" stroke="' + C.tinta + '" stroke-width="2"/></svg>Plan <b>' + counts.plan + '</b></span>' +
      '<span' + tip('Lo que dictas en la agenda de la app, junto al camino.') + '><svg viewBox="0 0 20 20"><rect x="4.5" y="4.5" width="11" height="11" rx="2" transform="rotate(45 10 10)" fill="' + C.recordatorio + '"/></svg>Recordatorios <b>' + counts.rec + '</b></span>' +
      '<span' + tip(S.cal.status === 'ok' ? 'Eventos de tu calendario, al borde del camino. El largo de la barra es cuántos hay ese día.' : 'Conecta tu calendario en Ajustes para verlo aquí.') + '><svg viewBox="0 0 20 20"><line x1="10" y1="4" x2="10" y2="16" stroke="' + C.calendario + '" stroke-width="3.2" stroke-linecap="round"/></svg>Calendario <b>' + (S.cal.status === 'ok' ? counts.cal : '—') + '</b>' + (S.cal.status === 'ok' ? '<small>próx. 90 días</small>' : '') + '</span>' +
      '<span' + tip('Pendientes sin fecha: viajan en los globos de quien camina.') + '><svg viewBox="0 0 20 20"><ellipse cx="10" cy="8" rx="5" ry="6" fill="' + C.plan + '"/><path d="M10 14v4" stroke="' + C.tenue + '"/></svg>Sin fecha <b>' + counts.undated + '</b></span>' +
      '</div>';
    return { svg: svg, legend: legend, pct: Math.round(sNow / g.total * 100) };
  }

  function tagX(x, W) { return clamp(x, 50, W - 50); }
  function walkerHtml(p, td, undated, W) {
    var flip = p.dx < -0.2;
    var h = '<g id="walker" class="walker" transform="translate(' + n1(p.x) + ' ' + n1(p.y) + ')' + (flip ? ' scale(-1 1)' : '') + '"><g transform="scale(1.45)">';
    // globos (pendientes sin fecha)
    var shown = undated.slice(0, 5);
    shown.forEach(function (u, i) {
      var bx = -16 - i * 10, by = -70 - (i % 2) * 12;
      h += '<g class="balloon" style="animation-delay:' + (i * .45) + 's"' + tip('Sin fecha · ' + u.kind + '\n' + u.title) + '>' +
        '<path d="M5 -24 Q' + n1(bx / 2) + ' ' + n1(by / 2) + ' ' + bx + ' ' + (by + 9) + '" fill="none" stroke="' + C.tenue + '" stroke-width="1"/>' +
        '<ellipse cx="' + bx + '" cy="' + by + '" rx="6.5" ry="8" fill="' + CATS[i % CATS.length] + '" stroke="' + C.papel + '" stroke-width="1.5"/></g>';
    });
    if (undated.length > 5) h += '<text class="rd-num" x="-70" y="-78" text-anchor="middle">+' + (undated.length - 5) + '</text>';
    // persona caminando: piernas y brazos se balancean mientras avanza
    h += '<g class="body">' +
      '<line class="leg a" x1="0" y1="-13" x2="0" y2="0" stroke="' + C.tinta + '" stroke-width="3" stroke-linecap="round"/>' +
      '<line class="leg b" x1="0" y1="-13" x2="0" y2="0" stroke="' + C.tinta + '" stroke-width="3" stroke-linecap="round"/>' +
      '<rect x="-7.5" y="-26" width="6" height="10" rx="2" fill="' + C.recordatorio + '"/>' +
      '<line x1="0" y1="-26" x2="0" y2="-13" stroke="' + C.tinta + '" stroke-width="3.2" stroke-linecap="round"/>' +
      '<line class="arm a" x1="0" y1="-24" x2="0" y2="-15" stroke="' + C.tinta + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<line class="arm b" x1="0" y1="-24" x2="0" y2="-15" stroke="' + C.tinta + '" stroke-width="2.4" stroke-linecap="round"/>' +
      '<circle cx="0.5" cy="-31" r="4.6" fill="' + C.tinta + '"/></g>';
    h += '</g></g>';
    // rótulo de hoy (fuera del grupo para que nunca se voltee)
    h += '<g id="walker-tag" class="walker-tag" transform="translate(' + n1(tagX(p.x, W)) + ' ' + n1(p.y) + ')"><rect x="-46" y="-78" width="92" height="17" rx="3" fill="' + C.tinta + '"/><text x="0" y="-66" text-anchor="middle">HOY · ' + DL.fmtDate(td, { year: false }).toUpperCase() + '</text></g>';
    return h;
  }

  // Animación: quien camina sale del inicio y llega hasta hoy (solo al entrar a la vista).
  var anim = null;
  function placeWalker(svg, s, walking) {
    var g = roadGeom(svg.dataset.v === '1');
    var p = at(g, s);
    var w = svg.querySelector('#walker'), t = svg.querySelector('#walker-tag');
    if (w) { w.setAttribute('transform', 'translate(' + n1(p.x) + ' ' + n1(p.y) + ')' + (p.dx < -0.2 ? ' scale(-1 1)' : '')); w.classList.toggle('walking', !!walking); }
    if (t) t.setAttribute('transform', 'translate(' + n1(tagX(p.x, g.W)) + ' ' + n1(p.y) + ')');
    svg.querySelectorAll('.road-done').forEach(function (d) { d.setAttribute('stroke-dasharray', n1(s) + ' ' + Math.ceil(g.total + 40)); });
  }
  function frame(t) {
    var svg = document.querySelector('svg.road-svg');
    if (!svg || !anim) { anim = null; return; }
    var k = Math.min(1, (t - anim.t0) / anim.dur); var e = 1 - Math.pow(1 - k, 3);
    anim.s = +svg.dataset.snow * e;
    placeWalker(svg, anim.s, k < 1);
    if (k < 1) requestAnimationFrame(frame); else anim = null;
  }
  function mount() {
    var svg = document.querySelector('svg.road-svg'); if (!svg) return;
    var reduce = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (anim) { placeWalker(svg, anim.s || 0, true); return; }
    if (U.roadPlayed || reduce) return;
    U.roadPlayed = true;
    placeWalker(svg, 0, true);
    anim = { t0: performance.now() + 250, dur: 2200, s: 0 };
    requestAnimationFrame(frame);
  }

  // ───────────────────────── piezas gráficas ─────────────────────────
  function arc(cx, cy, r, a0, a1) {
    var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    return 'M' + n1(x0) + ' ' + n1(y0) + 'A' + r + ' ' + r + ' 0 ' + (a1 - a0 > Math.PI ? 1 : 0) + ' 1 ' + n1(x1) + ' ' + n1(y1);
  }
  function ring(cx, cy, r, w, pct, color, track) {
    var c = 2 * Math.PI * r; var v = clamp(pct, 0, 100) / 100 * c;
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + (track || C.filete) + '" stroke-width="' + w + '"/>' +
      (pct > 0 ? '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round" stroke-dasharray="' + n1(Math.max(0.01, v)) + ' ' + n1(c) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')"/>' : '');
  }
  function paceChip(ahead, text) {
    return '<span class="pace ' + (ahead ? 'ok' : 'warn') + '">' + (ahead ? '<svg viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7"/></svg>' : '<svg viewBox="0 0 16 16"><path d="M8 3v6M8 12.5v.5"/></svg>') + text + '</span>';
  }
  function tile(cls, kicker, title, body, link) {
    return '<section class="tile ' + cls + '"><div class="tile-h"><div><p class="kicker">' + kicker + '</p>' + (title ? '<h2 class="sec">' + title + '</h2>' : '') + '</div>' + (link || '') + '</div>' + body + '</section>';
  }

  // Avance contra tiempo: anillo exterior = tiempo del plan; interior = actividades hechas.
  function tAvance(td) {
    var span = planSpan(); var p = DL.progress(DS.tasks());
    var timePct = Math.round(clamp(DL.diffDays(td, span.start) / span.days, 0, 1) * 100);
    var ahead = p.pct >= timePct;
    var svg = '<svg class="ring-lg" viewBox="0 0 150 150" role="img" aria-label="' + p.pct + ' % de actividades hechas; ' + timePct + ' % del tiempo del plan">' +
      '<g' + tip('Tiempo del plan transcurrido: ' + timePct + ' %') + '>' + ring(75, 75, 64, 9, timePct, C.gris) + '</g>' +
      '<g' + tip('Actividades hechas: ' + p.done + ' de ' + p.total + ' (' + p.pct + ' %)') + '>' + ring(75, 75, 49, 13, p.pct, C.recordatorio) + '</g>' +
      '<text class="big" x="75" y="80" text-anchor="middle">' + p.pct + '<tspan dx="1" class="unit">%</tspan></text>' +
      '<text class="cap" x="75" y="98" text-anchor="middle">HECHO</text></svg>';
    var body = '<div class="ring-row">' + svg + '<div class="ring-leg">' +
      '<span' + tip('Actividades hechas') + '><i style="background:' + C.recordatorio + '"></i><b>' + p.done + '/' + p.total + '</b> hechas</span>' +
      '<span' + tip('Tiempo del plan transcurrido') + '><i style="background:' + C.gris + '"></i><b>' + timePct + ' %</b> tiempo</span>' +
      paceChip(ahead, ahead ? 'Vas adelante' : 'Vas ' + (timePct - p.pct) + ' pts atrás') + '</div></div>';
    return tile('w1', 'Avance vs. tiempo', '', body);
  }

  // Estado de las actividades: barra apilada con separación de 2 px.
  function tEstado(td) {
    var ts = DS.tasks();
    var k = { hecha: 0, 'en curso': 0, pendiente: 0, vencida: 0, bloqueada: 0 };
    ts.forEach(function (t) { k[taskState(t, td)]++; });
    var order = [['hecha', C.ok, 'Hechas'], ['en curso', C.plan, 'En curso'], ['pendiente', C.gris, 'Pendientes'], ['vencida', C.bad, 'Vencidas'], ['bloqueada', C.warn, 'Bloqueadas']];
    var total = ts.length || 1; var W = 300, x = 0; var segs = order.filter(function (o) { return k[o[0]]; });
    var gap = 2; var usable = W - gap * Math.max(0, segs.length - 1);
    var bar = '<svg class="stackbar" viewBox="0 0 300 22" preserveAspectRatio="none" role="img" aria-label="Estado de ' + ts.length + ' actividades">' +
      segs.map(function (o) {
        var w = Math.max(3, usable * k[o[0]] / total); var r = '<rect x="' + n1(x) + '" y="0" width="' + n1(w) + '" height="22" rx="4" fill="' + o[1] + '"' + tip(o[2] + ': ' + k[o[0]]) + '/>'; x += w + gap; return r;
      }).join('') + '</svg>';
    var leg = '<div class="st-leg">' + order.map(function (o) {
      return '<span class="' + (k[o[0]] ? '' : 'zero') + '"><i style="background:' + o[1] + '"></i><b>' + k[o[0]] + '</b>' + o[2] + '</span>';
    }).join('') + '</div>';
    return tile('w1', 'Actividades del plan', '', bar + leg, '<a class="link" href="#actividades" data-route="actividades">Ver</a>');
  }

  // Hoy en una línea de tiempo: semana tipo de fondo, recordatorios y calendario encima.
  function tDia(td) {
    var H0 = 5, H1 = 22, W = 320, L = 4, R = 4;
    function x(t) { var p = t.split(':'); var hrs = +p[0] + (+p[1] || 0) / 60; return L + (W - L - R) * clamp((hrs - H0) / (H1 - H0), 0, 1); }
    var wd = DL.weekday(td); var now = Date.now();
    var blocks = DS.list('blocks').filter(function (b) { return b.day === wd; });
    var ag = DS.agenda().filter(function (a) { return a.date === td; });
    var cal = DS.calendar().filter(function (e) { return e.date === td; });
    var s = '';
    for (var hr = 6; hr <= 21; hr += 3) s += '<line x1="' + n1(x(hr + ':00')) + '" x2="' + n1(x(hr + ':00')) + '" y1="4" y2="74" stroke="' + C.filete + '"/><text class="axis" x="' + n1(x(hr + ':00')) + '" y="88" text-anchor="middle">' + (hr <= 12 ? hr : hr - 12) + (hr < 12 ? 'a' : 'p') + '</text>';
    blocks.forEach(function (b) { s += '<rect x="' + n1(x(b.start)) + '" y="6" width="' + n1(Math.max(2, x(b.end) - x(b.start) - 1)) + '" height="16" rx="3" fill="' + C.hondo + '" stroke="' + C.filete + '"' + tip('Semana tipo · ' + DL.fmtTime(b.start) + '–' + DL.fmtTime(b.end) + '\n' + b.title) + '/>'; });
    function endOf(t, min) { var p = t.split(':'); var m = +p[0] * 60 + (+p[1] || 0) + (min || 30); return DL.pad(Math.min(23, Math.floor(m / 60))) + ':' + DL.pad(m % 60); }
    ag.filter(function (a) { return a.time; }).forEach(function (a) {
      var st = DL.agendaState(a, now);
      s += '<rect x="' + n1(x(a.time)) + '" y="28" width="' + n1(Math.max(5, x(endOf(a.time, a.durationMin)) - x(a.time) - 1)) + '" height="18" rx="4" fill="' + (st === 'vencida' ? C.bad : C.recordatorio) + '" opacity="' + (a.done ? '.4' : '1') + '"' + tip('Recordatorio · ' + DL.fmtTime(a.time) + '\n' + a.title + ' (' + st + ')') + '/>';
    });
    cal.filter(function (e) { return e.time; }).forEach(function (e) {
      s += '<rect x="' + n1(x(e.time)) + '" y="50" width="' + n1(Math.max(5, x(e.endDate === td && e.endTime ? e.endTime : endOf(e.time, 60)) - x(e.time) - 1)) + '" height="18" rx="4" fill="' + C.calendario + '"' + tip('Calendario · ' + DL.fmtTime(e.time) + (e.endTime ? '–' + DL.fmtTime(e.endTime) : '') + '\n' + e.title) + '/>';
    });
    var nowT = DL.nowTimeBogota(now);
    s += '<line x1="' + n1(x(nowT)) + '" x2="' + n1(x(nowT)) + '" y1="0" y2="76" stroke="' + C.tinta + '" stroke-width="2"/><circle cx="' + n1(x(nowT)) + '" cy="2" r="3" fill="' + C.tinta + '"/>';
    var allDay = ag.filter(function (a) { return !a.time; }).length + cal.filter(function (e) { return !e.time; }).length;
    var svg = '<svg class="day" viewBox="0 0 320 94" role="img" aria-label="Hoy: ' + ag.length + ' recordatorios y ' + cal.length + ' eventos del calendario">' + s + '</svg>';
    var leg = '<div class="mini-leg"><span><i style="background:' + C.recordatorio + '"></i>' + ag.length + ' recordatorios</span><span><i style="background:' + C.calendario + '"></i>' + cal.length + ' calendario</span>' + (allDay ? '<span>' + allDay + ' todo el día</span>' : '') + '</div>';
    return tile('w1', 'Hoy · ' + DL.DIAS_CORTO[wd] + ' ' + DL.fmtDate(td, { year: false }), '', svg + leg, '<a class="link" href="#agenda" data-route="agenda">Agenda</a>');
  }

  // Próximos 7 días: columnas apiladas (plan, recordatorios, calendario).
  function tSemana(td) {
    var ts = DS.tasks(), ag = DS.agenda(), cal = DS.calendar();
    var days = []; for (var i = 0; i < 7; i++) days.push(DL.addDays(td, i));
    var data = days.map(function (d) {
      return {
        d: d,
        plan: ts.filter(function (t) { return t.due === d && t.status !== 'hecha'; }),
        rec: ag.filter(function (a) { return a.date === d && !a.done; }),
        cal: cal.filter(function (e) { return e.date === d; })
      };
    });
    var max = Math.max(3, data.reduce(function (m, x) { return Math.max(m, x.plan.length + x.rec.length + x.cal.length); }, 0));
    var W = 320, H = 118, B = 22, T = 14, cw = W / 7, bw = Math.min(26, cw - 14);
    var s = '<line x1="0" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '" stroke="' + C.filete + '"/>';
    data.forEach(function (x, i) {
      var cx = cw * i + cw / 2; var y = H - B; var unit = (H - B - T) / max;
      [['plan', C.plan, 'Plan'], ['rec', C.recordatorio, 'Recordatorios'], ['cal', C.calendario, 'Calendario']].forEach(function (k) {
        var n = x[k[0]].length; if (!n) return;
        var hgt = n * unit - 2; y -= hgt;
        s += '<rect x="' + n1(cx - bw / 2) + '" y="' + n1(y) + '" width="' + n1(bw) + '" height="' + n1(Math.max(2, hgt)) + '" rx="3" fill="' + k[1] + '"' + tip(k[2] + ' · ' + DL.fmtDate(x.d, { weekday: true, year: false }) + '\n' + x[k[0]].slice(0, 5).map(function (o) { return '· ' + (o.time ? DL.fmtTime(o.time) + ' ' : '') + o.title; }).join('\n') + (n > 5 ? '\n+' + (n - 5) + ' más' : '')) + '/>';
        y -= 2;
      });
      var tot = x.plan.length + x.rec.length + x.cal.length;
      if (tot) s += '<text class="axis strong" x="' + n1(cx) + '" y="' + n1(y - 3) + '" text-anchor="middle">' + tot + '</text>';
      s += '<text class="axis' + (i === 0 ? ' strong' : '') + '" x="' + n1(cx) + '" y="' + (H - 6) + '" text-anchor="middle">' + (i === 0 ? 'HOY' : DL.DIAS_CORTO[DL.weekday(x.d)].toUpperCase().slice(0, 3)) + '</text>';
    });
    var svg = '<svg class="week7" viewBox="0 0 320 118" role="img" aria-label="Carga de los próximos 7 días">' + s + '</svg>';
    var leg = '<div class="mini-leg"><span><i style="background:' + C.plan + '"></i>Plan</span><span><i style="background:' + C.recordatorio + '"></i>Recordatorios</span><span><i style="background:' + C.calendario + '"></i>Calendario</span></div>';
    return tile('w1', 'Próximos 7 días', '', svg + leg);
  }

  // Metas: medidores de media luna con la marca de dónde deberías ir a esta fecha.
  function tMetas(td) {
    var defs = DS.kpiDefs(); var vals = DS.kpiValues(); var span = planSpan();
    var cells = defs.map(function (d) {
      var v = vals[d.key] || 0; var pct = clamp(v / (d.target || 1), 0, 1);
      var pace = clamp(DL.diffDays(td, span.start) / Math.max(1, DL.diffDays(d.due, span.start)), 0, 1);
      var expected = Math.floor(pace * d.target + 1e-9);
      var ahead = v >= expected; var done = v >= d.target;
      var cx = 70, cy = 66, r = 52, a0 = Math.PI, a1 = 2 * Math.PI;
      var av = a0 + (a1 - a0) * pct; var ap = a0 + (a1 - a0) * pace;
      var svg = '<svg viewBox="0 0 140 80" role="img" aria-label="' + esc(d.label + ': ' + v + ' de ' + d.target) + '">' +
        '<path d="' + arc(cx, cy, r, a0, a1) + '" fill="none" stroke="' + C.filete + '" stroke-width="11" stroke-linecap="round"/>' +
        (pct > 0 ? '<path d="' + arc(cx, cy, r, a0, Math.max(a0 + 0.02, av)) + '" fill="none" stroke="' + (done ? C.ok : C.recordatorio) + '" stroke-width="11" stroke-linecap="round"/>' : '') +
        '<line x1="' + n1(cx + (r - 10) * Math.cos(ap)) + '" y1="' + n1(cy + (r - 10) * Math.sin(ap)) + '" x2="' + n1(cx + (r + 10) * Math.cos(ap)) + '" y2="' + n1(cy + (r + 10) * Math.sin(ap)) + '" stroke="' + C.tinta + '" stroke-width="2"' + tip('A esta fecha deberías ir en ' + Math.round(pace * d.target * 10) / 10 + ' de ' + d.target) + '/>' +
        '<text class="big" x="' + cx + '" y="' + (cy - 4) + '" text-anchor="middle">' + v + '</text>' +
        '<text class="cap" x="' + cx + '" y="' + (cy + 11) + '" text-anchor="middle">DE ' + d.target + '</text></svg>';
      return '<a class="gauge" href="#indicadores" data-route="indicadores"' + tip(d.label + '\n' + v + ' de ' + d.target + ' · meta ' + DL.fmtDate(d.due) + '\nRitmo esperado hoy: ' + Math.round(pace * d.target * 10) / 10) + '>' + svg +
        '<span class="g-label">' + esc(d.label) + '</span>' + (done ? paceChip(true, 'Cumplida') : paceChip(ahead, ahead ? 'A ritmo' : 'Atrás')) + '</a>';
    }).join('');
    return tile('w2', 'Cumplimiento de metas', '', '<div class="gauges">' + cells + '</div><p class="tile-note"><svg viewBox="0 0 16 16"><line x1="8" y1="2" x2="8" y2="14" stroke="' + C.tinta + '" stroke-width="2"/></svg>Dónde deberías ir hoy para llegar a la meta a tiempo</p>', '<a class="link" href="#indicadores" data-route="indicadores">Registrar</a>');
  }

  // Frentes: barra de avance por frente (hechas / total).
  function tFrentes(td) {
    var fr = DS.fronts(); var ts = DS.tasks();
    var rows = fr.map(function (f) {
      var mine = ts.filter(function (t) { return t.front === f.name; }); var p = DL.progress(mine);
      var od = mine.filter(function (t) { return DL.isOverdue(t, td); }).length;
      return '<div class="fbar"' + tip(f.name + ' · modo ' + f.mode + '\n' + p.done + ' de ' + p.total + ' hechas' + (od ? ' · ' + od + ' vencidas' : '')) + '><span class="f-name">' + esc(f.name) + '</span>' +
        '<span class="f-track">' + (p.total ? '<i style="width:' + Math.max(p.pct ? 4 : 0, p.pct) + '%"></i>' : '') + (od ? '<em style="width:' + Math.round(od / p.total * 100) + '%"></em>' : '') + '</span>' +
        '<span class="f-num">' + p.done + '/' + p.total + '</span></div>';
    }).join('');
    return tile('w2', 'Avance por frente', '', '<div class="fbars">' + rows + '</div>', '<a class="link" href="#frentes" data-route="frentes">Frentes</a>');
  }

  // Hábitos: anillo del periodo por hábito; tocarlo marca hoy.
  function tHabitos(td) {
    var habits = DS.list('habits').sort(function (a, b) { return a.order - b.order; });
    var cells = habits.map(function (hb) {
      var logs = (S.d.habit_logs[hb.id] || {}).dates || {}; var st = DL.habitStatus(hb, logs, td); var streak = DL.habitStreak(hb, logs, td);
      var pct = Math.round(clamp(st.count / (st.target || 1), 0, 1) * 100);
      return '<button class="hring' + (logs[td] ? ' on' : '') + '" data-act="habit-toggle" data-id="' + hb.id + '" aria-pressed="' + !!logs[td] + '"' + (S.canWrite ? '' : ' disabled') + tip(hb.title + '\n' + st.count + ' de ' + st.target + ' en el periodo · racha ' + streak + '\n' + (logs[td] ? 'Hoy: cumplido (toca para desmarcar)' : 'Toca para marcar hoy')) + '>' +
        '<svg viewBox="0 0 64 64" aria-hidden="true">' + ring(32, 32, 25, 7, pct, st.done ? C.ok : C.plan) +
        (st.done ? '<path d="M24 32.5l5.5 5.5L41 26.5" fill="none" stroke="' + C.ok + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' : '<text x="32" y="37" text-anchor="middle" class="h-num">' + st.count + '/' + st.target + '</text>') + '</svg>' +
        '<span class="h-name">' + esc(hb.title) + '</span>' + (streak ? '<span class="h-streak">' + streak + '×</span>' : '') + '</button>';
    }).join('');
    return tile('w2', 'Hábitos del periodo', '', '<div class="hrings">' + cells + '</div>', '<a class="link" href="#habitos" data-route="habitos">Rachas</a>');
  }

  // Agenda de hoy: lo único con texto, porque ahí se marca hecho.
  function tAgendaHoy(td) {
    var now = Date.now();
    var ag = DL.sortAgenda(DS.agenda().filter(function (a) { return a.date === td || (!a.done && DL.agendaState(a, now) === 'vencida'); }));
    var body = ag.length ? '<div class="ag-day">' + ag.map(function (a) { return DU.aItem(a, { showDate: a.date !== td }); }).join('') + '</div>'
      : '<p class="empty">Nada agendado hoy.</p>';
    return tile('w2', 'Para marcar hoy', '', body, '<button class="btn llama sm" data-act="go-capture">' + ic('mic') + 'Dictar</button>');
  }

  function vHoy() {
    var td = DS.today();
    var road = roadHtml();
    var h = '<header class="page-head dash-head"><p class="kicker">' + DL.DIAS[DL.weekday(td)] + ' ' + DL.fmtDate(td) + ' · recorrido ' + road.pct + ' %</p>' +
      '<h1>El <span class="senal">derrotero</span></h1></header>';
    h += '<section class="card road-card" aria-label="Camino del plan">' + road.svg + road.legend + '</section>';
    h += '<div class="dash">' + tAvance(td) + tEstado(td) + tDia(td) + tSemana(td) + tMetas(td) + tFrentes(td) + tHabitos(td) + tAgendaHoy(td) + '</div>';
    return h;
  }

  DU.views.hoy = vHoy;
  root.DDash = { mount: mount, isVertical: isVertical, roadGeom: roadGeom, at: at };
})(window);
