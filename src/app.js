/* Derrotero · controlador: eventos, render, agenda por voz, recordatorios y exportaciones. */
(function (root) {
  'use strict';
  var DL = root.DL, DS = root.DS, DU = root.DU, S = DS.S, U = DU.U, esc = DU.esc, ic = DU.ic;
  var $ = function (s) { return document.querySelector(s); };
  var ROUTES = Object.keys(DU.views);

  var el = {};
  var pendingRender = false, rafId = 0, bootedOnce = false;
  var bases = {};            // versión y texto al empezar a editar una nota (H-11)
  var sample = null, downloads = null, rec = null, audioCtx = null;
  var shown = loadShown();

  // ───────────── render ─────────────
  function typing() {
    var a = document.activeElement;
    if (!a || !el.main.contains(a)) return false;
    if (a.tagName === 'TEXTAREA' || a.tagName === 'SELECT') return true;
    return a.tagName === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test(a.type);
  }

  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(function () { rafId = 0; render(false); });
  }

  function render(force) {
    if (!force && typing()) { pendingRender = true; renderChrome(); return; }
    pendingRender = false;
    var a = document.activeElement; var focusId = a && a.id && el.main.contains(a) ? a.id : null;
    var selS = null, selE = null;
    try { if (focusId) { selS = a.selectionStart; selE = a.selectionEnd; } } catch (e) { }
    el.main.innerHTML = mainHtml();
    renderChrome();
    hideTip();
    if (U.route === 'hoy' && root.DDash) { lastVertical = root.DDash.isVertical(); root.DDash.mount(); }
    if (focusId) {
      var n = document.getElementById(focusId);
      if (n) { n.focus({ preventScroll: true }); try { if (selS != null) n.setSelectionRange(selS, selE); } catch (e) { } }
    }
  }

  function mainHtml() {
    if (S.mode === 'loading' || (S.mode === 'db' && !S.loaded.config)) return '<p class="empty">Cargando el plan…</p>';
    if (S.mode === 'db' && S.empty) {
      var saved = DS.localSaved();
      return '<header class="page-head"><p class="kicker">Primera vez</p><h1>La base de datos está <span class="senal">vacía</span></h1><p class="bajada">' +
        (saved ? 'Este navegador tiene el plan con tus cambios (' + Object.keys(saved.tasks).length + ' actividades). Súbelo para verlo en todos tus dispositivos, o empieza desde el plan base.' : 'Carga el plan base: 29 actividades, 6 indicadores, 7 hábitos, la semana tipo y el laboratorio.') + '</p></header>' +
        (S.canWrite ? '<div class="row">' + (saved ? '<button class="btn llama" data-act="load-seed" data-src="local">Subir lo de este navegador</button><button class="btn alt" data-act="load-seed">Empezar desde el plan base</button>' : '<button class="btn llama" data-act="load-seed">Cargar el plan base</button>') + '</div>' : '<p class="empty">Solo el dueño del plan puede cargarlo.</p>') + (U.seedMsg ? '<p class="hint">' + esc(U.seedMsg) + '</p>' : '');
    }
    if (!DS.ready()) return '<p class="empty">Cargando el plan…</p>';
    var banners = '';
    if (S.mode === 'local') {
      if (S.localReason === 'nodb' && !root.claude) banners += '<div class="banner warn"><span><b>Base de datos sin conectar.</b> Lo que registres queda solo en este navegador. <a href="#ajustes" data-route="ajustes">Cómo conectarla</a></span></div>';
      else if (S.localReason === 'offline' || S.localReason === 'auth') banners += '<div class="banner warn"><span><b>Sin conexión con el servidor.</b> Trabajas en modo local; recarga la página cuando vuelva la conexión.</span></div>';
      else banners += '<div class="banner warn"><span><b>Modo local.</b> Esta vista no tiene conexión con la base de datos del plan: los cambios quedan solo en este navegador.</span></div>';
    }
    if (!S.canWrite) banners += '<div class="banner info"><span><b>Solo lectura.</b> Puedes ver el plan; los cambios los hace el dueño.</span></div>';
    return banners + DU.views[U.route]();
  }

  function renderChrome() {
    el.nav.innerHTML = DU.navHtml();
    el.tabbar.innerHTML = DU.tabbarHtml();
    el.conn.innerHTML = DU.connHtml();
    el.stamp.innerHTML = DU.stampHtml();
    el.sheet.innerHTML = U.more ? '<div class="sheet-bg" data-act="more"></div><div class="sheet" role="dialog" aria-label="Más secciones"><nav class="nav">' + DU.navHtml() + '</nav></div>' : '';
    var urgent = S.mode !== 'loading' && DS.ready() ? DS.agenda().filter(function (a) { var s = DL.agendaState(a, Date.now()); return s === 'por recordar' || s === 'en curso'; }).length : 0;
    document.title = (urgent ? '(' + urgent + ') ' : '') + 'Derrotero · ' + DU.TITLES[U.route];
  }

  function renderToasts() {
    el.toasts.innerHTML = U.toasts.map(function (t) {
      return '<div class="toast ' + (t.kind || '') + '" role="' + (t.kind === 'remind' || t.kind === 'bad' ? 'alert' : 'status') + '">' +
        (t.kicker ? '<span class="kicker">' + esc(t.kicker) + '</span>' : '') + '<b>' + esc(t.title) + '</b>' + (t.text ? '<span>' + esc(t.text) + '</span>' : '') +
        '<div class="row">' + (t.actions || []).map(function (a) {
          return a.href ? '<a class="btn alt sm" href="' + esc(a.href) + '" target="_blank" rel="noopener">' + esc(a.label) + '</a>'
            : '<button class="btn ' + (a.primary ? 'llama' : 'alt') + ' sm" data-act="' + a.act + '" data-id="' + esc(a.id || '') + '" data-mode="' + esc(a.mode || '') + '" data-t="' + t.id + '">' + esc(a.label) + '</button>';
        }).join('') + '<button class="btn alt sm" data-act="toast-close" data-t="' + t.id + '">Cerrar</button></div></div>';
    }).join('');
  }

  var toastSeq = 0;
  function toast(t) {
    t.id = ++toastSeq;
    U.toasts.push(t);
    if (U.toasts.length > 4) U.toasts.shift();
    renderToasts();
    if (!t.sticky) setTimeout(function () { closeToast(t.id); }, 7000);
    return t.id;
  }
  function closeToast(id) { U.toasts = U.toasts.filter(function (t) { return t.id !== +id; }); renderToasts(); }

  function navigate(route, opts) {
    if (ROUTES.indexOf(route) < 0) route = 'hoy';
    if (route === 'hoy' && U.route !== 'hoy') U.roadPlayed = false;
    U.route = route; U.more = false; U.exportMsg = '';
    if (opts && opts.tview) U.tview = opts.tview;
    try { if (location.hash !== '#' + route) history.replaceState(null, '', '#' + route); } catch (e) { }
    render(true);
    if (!(opts && opts.keepScroll)) window.scrollTo(0, 0);
  }

  // ───────────── dominio: pequeñas operaciones ─────────────
  function task(id) { return S.d.tasks[id]; }
  function today() { return DS.today(); }

  function setAgenda(id, patch, field) {
    var a = S.d.agenda[id]; if (!a) return;
    var next = Object.assign({}, a, patch, { updatedAt: Date.now() });
    DL.diffFields(a, next, Object.keys(patch)).forEach(function (d) { DS.audit('agenda', id, a.title, field || d.field, d.before, d.after); });
    DS.put('agenda', id, next);
  }

  function moveTask(id, dir) {
    var t = task(id); if (!t) return;
    var list = DL.sortTasks(DS.tasks().filter(function (x) { return x.phase === t.phase; }));
    var i = list.findIndex(function (x) { return x.id === id; }); var j = i + dir;
    if (j < 0 || j >= list.length) return;
    applyOrder(DL.reorder(DS.tasks(), t.phase, id, list[j].id, dir > 0));
  }
  function applyOrder(orders) {
    orders.forEach(function (o) { var t = task(o.id); if (t && t.order !== o.order) DS.updateTask(o.id, { order: o.order }, { silent: true }); });
  }

  function toggleHabit(id) {
    var td = today(); var hb = S.d.habits[id]; if (!hb) return;
    var doc = DS.clone(S.d.habit_logs[id]) || { habitId: id, dates: {} };
    doc.dates = doc.dates || {};
    var was = !!doc.dates[td];
    if (was) delete doc.dates[td]; else doc.dates[td] = true;
    DS.audit('hábito', id, hb.title, 'cumplido ' + DL.fmtDate(td), was ? 'sí' : 'no', was ? 'no' : 'sí');
    DS.put('habit_logs', id, doc);
  }

  function setMode(id, mode) {
    var cfg = DS.clone(DS.config()); var f = cfg.fronts[id]; var before = f.mode;
    f.mode = mode; DS.saveConfig({ fronts: cfg.fronts }, f.name, 'modo', before, mode);
  }

  // ───────────── agenda por voz ─────────────
  function doParse(text) {
    text = String(text || '').trim();
    if (!text) { U.micMsg = 'Escribe o dicta una actividad primero.'; render(true); return; }
    var p = DL.parseAgenda(text, Date.now());
    if (!p.title) p.title = text.charAt(0).toUpperCase() + text.slice(1);
    U.draft = Object.assign(p, { source: 'local', raw: text });
    U.aiMsg = '';
    if (U.route !== 'agenda') navigate('agenda'); else render(true);
    var d = document.getElementById('draft'); if (d) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function saveDraft() {
    var d = U.draft; if (!d) return;
    if (!String(d.title || '').trim()) { U.aiMsg = 'Escribe qué vas a hacer.'; render(true); return; }
    if (!DL.isDateStr(d.date)) { U.aiMsg = 'La fecha no es válida.'; render(true); return; }
    var id = DS.newId('a');
    var item = {
      id: id, title: d.title.trim().slice(0, 160), date: d.date, time: d.time || '', durationMin: +d.durationMin || 30,
      remindMin: +d.remindMin || 0, front: d.front || '', note: d.raw && d.raw !== d.title ? 'Dictado: ' + d.raw : '',
      done: false, doneAt: 0, createdAt: Date.now(), updatedAt: Date.now(), source: d.source === 'claude' ? 'voz+claude' : d.source === 'task' ? 'actividad' : 'voz', taskId: d.taskId || ''
    };
    DS.put('agenda', id, item);
    DS.audit('agenda', id, item.title, 'creada', '', DL.fmtDate(item.date) + (item.time ? ' ' + DL.fmtTime(item.time) : ''));
    U.draft = null; U.capText = ''; U.micMsg = '';
    var ta = document.getElementById('cap-text'); if (ta) ta.value = '';
    var top = document.getElementById('top-cap'); if (top) top.value = '';
    render(true);
    toast({ kind: 'ok', kicker: 'Agendado', title: item.title, text: DL.fmtDate(item.date, { weekday: true }) + (item.time ? ' · ' + DL.fmtTime(item.time) + ' · aviso ' + (item.remindMin ? item.remindMin + ' min antes' : 'a la hora') : ' · todo el día'), actions: [{ label: 'Google Calendar', href: DL.googleCalendarUrl(item) }] });
    tick();
  }

  async function aiParse() {
    if (!sample || !U.draft) return;
    U.parsingAI = true; U.aiMsg = ''; render(true);
    var td = today();
    var prompt = 'Eres el intérprete de la agenda de una aplicación personal en español de Colombia.\n' +
      'Hoy es ' + DL.fmtDateLong(td) + ' (' + td + ') y son las ' + DL.nowTimeBogota() + ' en Bogotá (UTC-5).\n' +
      'Convierte la frase en un objeto JSON con exactamente estas claves:\n' +
      '- title: la actividad, empezando con verbo, sin fecha, hora ni recordatorio (máximo 120 caracteres)\n' +
      '- date: YYYY-MM-DD\n- time: HH:MM en 24 horas, o "" si es de todo el día\n' +
      '- durationMin: número (30 si no se dice)\n- remindMin: minutos de aviso antes (15 si hay hora y no se dice; 0 si es de todo el día)\n' +
      '- front: uno de ' + DS.fronts().map(function (f) { return '"' + f.name + '"'; }).join(', ') + ' o ""\n' +
      '- assumptions: lista corta en español de lo que supusiste porque la frase no lo decía\n' +
      'Frase: """' + U.draft.raw + '"""\nResponde solo el JSON.';
    try {
      var r = await sample.json(prompt, { modelTier: 'quick' });
      if (!r || typeof r !== 'object') throw { code: 'invalid_json' };
      var d = U.draft;
      if (typeof r.title === 'string' && r.title.trim()) d.title = r.title.trim().slice(0, 160);
      if (DL.isDateStr(r.date)) d.date = r.date;
      if (typeof r.time === 'string' && (/^\d{2}:\d{2}$/.test(r.time) || r.time === '')) d.time = r.time;
      if (+r.durationMin > 0) d.durationMin = Math.round(+r.durationMin);
      if (r.remindMin != null && +r.remindMin >= 0) d.remindMin = Math.round(+r.remindMin);
      if (typeof r.front === 'string' && (r.front === '' || DS.fronts().some(function (f) { return f.name === r.front; }))) d.front = r.front;
      d.assumptions = Array.isArray(r.assumptions) ? r.assumptions.filter(function (x) { return typeof x === 'string'; }).slice(0, 4) : [];
      d.source = 'claude';
    } catch (e) {
      var code = e && e.code;
      U.aiMsg = code === 'not_granted' ? 'No se dio permiso para usar Claude. La interpretación del dispositivo sigue disponible.'
        : code === 'rate_limited' ? 'Claude está recibiendo muchas solicitudes. Intenta en un minuto o ajusta los campos a mano.'
          : code === 'cancelled' ? '' : 'Claude no pudo interpretar la frase. Ajusta los campos a mano.';
      if (code === 'not_granted') U.aiAvailable = false;
    }
    U.parsingAI = false; render(true);
  }

  function startMic() {
    if (U.listening && rec) { try { rec.stop(); } catch (e) { } return; }
    var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
    var fallback = 'El micrófono no está disponible en esta vista. Toca el micrófono del teclado de tu celular (o Win + H en Windows, Fn dos veces en Mac) y dicta en el cuadro: la frase se interpreta igual.';
    if (!SR) { U.micMsg = fallback; render(true); focusCapture(); return; }
    try {
      rec = new SR(); rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
      rec.onresult = function (e) {
        var txt = ''; for (var i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
        U.capText = txt; var ta = document.getElementById('cap-text'); if (ta) ta.value = txt;
      };
      rec.onerror = function (e) {
        U.listening = false;
        U.micMsg = e.error === 'no-speech' ? 'No escuché nada. Toca el micrófono e intenta de nuevo.' : e.error === 'aborted' ? '' : fallback;
        render(true); if (e.error !== 'no-speech') focusCapture();
      };
      rec.onend = function () {
        var was = U.listening; U.listening = false;
        if (was && U.capText.trim()) doParse(U.capText); else render(true);
      };
      rec.start(); U.listening = true; U.micMsg = 'Escuchando… di la actividad con fecha, hora y cuándo quieres el aviso.'; render(true);
    } catch (e) { U.listening = false; U.micMsg = fallback; render(true); focusCapture(); }
  }

  function focusCapture() {
    var ta = document.getElementById('cap-text');
    if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  // ───────────── recordatorios ─────────────
  function loadShown() { try { return JSON.parse(localStorage.getItem('derrotero-shown') || '{}'); } catch (e) { return {}; } }
  function saveShown() {
    var cut = Date.now() - 3 * 86400000;
    Object.keys(shown).forEach(function (k) { if (shown[k] < cut) delete shown[k]; });
    try { localStorage.setItem('derrotero-shown', JSON.stringify(shown)); } catch (e) { }
  }

  function beep() {
    if (!audioCtx) return;
    try {
      [0, .18].forEach(function (dt, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = i ? 880 : 660; o.type = 'sine';
        g.gain.setValueAtTime(.0001, audioCtx.currentTime + dt); g.gain.exponentialRampToValueAtTime(.15, audioCtx.currentTime + dt + .02);
        g.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + dt + .16);
        o.connect(g).connect(audioCtx.destination); o.start(audioCtx.currentTime + dt); o.stop(audioCtx.currentTime + dt + .18);
      });
    } catch (e) { }
  }

  function tick() {
    if (S.mode === 'loading' || !DS.ready() || S.empty) return;
    var now = Date.now();
    var due = DL.dueReminders(DS.agenda(), now, shown);
    due.forEach(function (r) {
      shown[r.key] = now;
      U.toasts = U.toasts.filter(function (x) { return x.itemId !== r.item.id; });
      var a = r.item; var t = DL.agendaTimes(a);
      var when = a.time ? DL.fmtTime(a.time) : 'hoy';
      if (r.kind === 'recordar') {
        toast({ kind: 'remind', sticky: true, itemId: a.id, kicker: 'Recordatorio · ' + when, title: a.title, text: now < t.start ? 'Empieza en ' + Math.max(1, Math.round((t.start - now) / 60000)) + ' min.' : 'Ya empezó.', actions: [{ label: 'Hecha', act: 'ag-done', id: a.id, primary: true }, { label: '+15 min', act: 'ag-snooze', id: a.id, mode: '15m' }, { label: '+1 hora', act: 'ag-snooze', id: a.id, mode: '1h' }] });
        notify('Recordatorio: ' + a.title, (a.time ? 'A las ' + when : 'Hoy') + (a.front ? ' · ' + a.front : ''), r.key);
      } else {
        toast({ kind: 'bad', sticky: true, itemId: a.id, kicker: 'Se venció', title: a.title, text: 'Pasó la hora sin marcarse como hecha.', actions: [{ label: 'La hice', act: 'ag-done', id: a.id, primary: true }, { label: 'Pasar a mañana', act: 'ag-snooze', id: a.id, mode: 'manana' }] });
        notify('Se venció: ' + a.title, 'Márcala como hecha o reprográmala.', r.key);
      }
      beep();
    });
    if (due.length) saveShown();
    renderChrome();
  }

  function notify(title, body, tag) {
    try { if (root.Notification && Notification.permission === 'granted') new Notification(title, { body: body, tag: tag }); } catch (e) { }
  }

  async function askNotif() {
    try {
      var p = await Notification.requestPermission();
      U.notif = p === 'granted' ? 'granted' : 'denied';
    } catch (e) { U.notif = 'denied'; }
    if (U.notif === 'denied') toast({ title: 'Los avisos del sistema no están permitidos en esta vista', text: 'Los recordatorios siguen saliendo en pantalla con la app abierta. Para avisos con la app cerrada, exporta la agenda a tu calendario.' });
    render(true);
  }

  // ───────────── archivos ─────────────
  async function saveFile(filename, data) {
    if (downloads) {
      try { await downloads.save({ filename: filename, data: data }); return 'Listo: ' + filename + '.'; }
      catch (e) {
        var c = e && e.code;
        return c === 'declined' ? 'Descarga cancelada.' : c === 'rate_limited' ? 'Ya hay una descarga pendiente de confirmar.' : 'No se pudo descargar (' + (c || 'error') + ').';
      }
    }
    try {
      var blob = data instanceof Blob ? data : new Blob([data]);
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      return 'Descargado: ' + filename + '.';
    } catch (e) { return 'Este navegador no permitió la descarga.'; }
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
  }

  function icsZip(filename, icsText) {
    return DL.makeZip([{ name: filename, text: icsText }]);
  }

  async function exportAgenda() {
    var now = Date.now();
    var items = DS.agenda().filter(function (a) { return !a.done && DL.agendaTimes(a).end > now; });
    if (!items.length) { U.exportMsg = 'No hay actividades futuras para exportar.'; render(true); return; }
    U.exportMsg = await saveFile('agenda-derrotero-' + today() + '.zip', icsZip('agenda-derrotero.ics', DL.agendaIcs(DL.sortAgenda(items), now)));
    render(true);
  }

  function pdfSummary(text) {
    var J = root.jspdf && root.jspdf.jsPDF;
    if (!J) return null;
    var doc = new J({ unit: 'pt', format: 'letter' });
    var x = 56, y = 64, W = 500, H = 792;
    doc.setFillColor(234, 99, 43); doc.rect(x, y - 20, 36, 3, 'F');
    text.split('\n').forEach(function (line, i) {
      var head = i === 0 || (/^[A-ZÁÉÍÓÚÑ ]{4,}/.test(line) && line === line.toUpperCase());
      doc.setFont('helvetica', head ? 'bold' : 'normal');
      doc.setFontSize(i === 0 ? 16 : head ? 11 : 10);
      doc.setTextColor(head && i > 0 ? 14 : 12, head && i > 0 ? 79 : 15, head && i > 0 ? 82 : 20);
      var parts = doc.splitTextToSize(line || ' ', W);
      parts.forEach(function (p) {
        if (y > H - 56) { doc.addPage(); y = 64; }
        doc.text(p, x, y); y += i === 0 ? 22 : head ? 17 : 14;
      });
      if (head && i > 0) y += 2;
    });
    return doc.output('arraybuffer');
  }

  function announceInbox(added) {
    if (!added || !added.length) return;
    toast({ kicker: 'Registrado por Claude', title: added.length === 1 ? 'Un pendiente nuevo de la conversación' : added.length + ' pendientes nuevos de la conversación', text: added.map(function (t) { return '· ' + t.title; }).join('\n') });
  }

  // ───────────── clics ─────────────
  var ACT = {
    'more': function () { U.more = !U.more; renderChrome(); },
    'cycle': function (b) {
      var t = task(b.dataset.id); if (!t) return;
      var ns = DL.nextStatus(t.status);
      if (!ns) { U.confirm[t.id] = 'unblock'; render(true); return; }
      DS.updateTask(t.id, { status: ns }); render(true);
    },
    'unblock': function (b) { delete U.confirm[b.dataset.id]; DS.updateTask(b.dataset.id, { status: b.dataset.to }); render(true); },
    'confirm-cancel': function (b) { delete U.confirm[b.dataset.id]; render(true); },
    'open-task': function (b) { U.open[b.dataset.id] = !U.open[b.dataset.id]; render(true); },
    'goto-task': function (b) {
      var id = b.dataset.id; U.tview = 'etapas'; U.open[id] = true;
      U.tf = { front: 'todos', status: 'todos', owner: 'todos', q: '', hideDone: false, onlyOverdue: false };
      navigate('actividades');
      var r = document.getElementById('task-' + id); if (r) r.scrollIntoView({ block: 'center' });
    },
    'block': function (b) {
      var id = b.dataset.id; var ta = document.getElementById('tb-' + id); var cause = ta ? ta.value.trim() : '';
      var v = DL.validateStatusChange(task(id), 'bloqueada', cause);
      if (!v.ok) { var m = document.getElementById('tb-msg-' + id); if (m) m.textContent = v.error; if (ta) ta.focus(); return; }
      delete U.confirm[id]; DS.updateTask(id, { status: 'bloqueada', blockCause: cause }); render(true);
    },
    'move': function (b) { moveTask(b.dataset.id, +b.dataset.dir); render(true); },
    'task-del-ask': function (b) { U.confirm[b.dataset.id] = 'delete'; render(true); },
    'task-del': function (b) { delete U.confirm[b.dataset.id]; delete U.open[b.dataset.id]; DS.deleteTask(b.dataset.id); render(true); },
    'task-to-agenda': function (b) {
      var t = task(b.dataset.id); var td = today();
      U.draft = { title: t.title, date: t.due && t.due >= td ? t.due : td, time: '', durationMin: 30, remindMin: 0, front: t.front, assumptions: ['Sin hora: queda de todo el día, con aviso a las 8:00 a. m. Ponle hora si la tiene.'], source: 'task', taskId: t.id, raw: '' };
      navigate('agenda'); var d = document.getElementById('draft'); if (d) d.scrollIntoView({ block: 'center' });
    },
    'tf-front': function (b) { U.tf.front = b.dataset.v; render(true); },
    'tview': function (b) { U.tview = b.dataset.v; render(true); },
    'kpi': function (b) { DS.bumpKpi(b.dataset.k, +b.dataset.d); render(true); },
    'kpi-open': function (b) { U.kpiOpen[b.dataset.k] = !U.kpiOpen[b.dataset.k]; render(true); },
    'habit-toggle': function (b) { toggleHabit(b.dataset.id); render(true); },
    'mode': function (b) {
      var fr = DS.fronts(); var f = fr.filter(function (x) { return x.id === b.dataset.id; })[0];
      if (f.mode === b.dataset.v) return;
      var r = DL.checkModeChange(fr, f.id, b.dataset.v);
      if (!r.ok) { U.modeWarn = { id: f.id, name: f.name, current: r.current }; render(true); var w = document.getElementById('mode-warn'); if (w) w.scrollIntoView({ block: 'center' }); return; }
      U.modeWarn = null; setMode(f.id, b.dataset.v); render(true);
    },
    'mode-swap': function (b) { var w = U.modeWarn; if (!w) return; setMode(b.dataset.out, 'explorar'); setMode(w.id, 'construir'); U.modeWarn = null; render(true); },
    'mode-cancel': function () { U.modeWarn = null; render(true); },
    'lab-decide': function (b) {
      var p = DS.clone(S.d.lab[b.dataset.id]); var before = p.decision || '';
      p.decision = p.decision === b.dataset.v ? '' : b.dataset.v; p.decidedAt = p.decision ? today() : '';
      DS.audit('laboratorio', p.id, p.name, 'decisión', before, p.decision); DS.put('lab', p.id, p); render(true);
    },
    'week-new': function () { U.weekEdit = { day: 1, start: '17:00', end: '18:00', cat: 'personal' }; render(true); var t = document.getElementById('bk-title'); if (t) t.focus(); },
    'week-edit': function (b) { U.weekEdit = DS.clone(S.d.blocks[b.dataset.id]); render(true); var t = document.getElementById('bk-title'); if (t) { t.focus(); t.scrollIntoView({ block: 'center' }); } },
    'week-close': function () { U.weekEdit = null; render(true); },
    'week-del': function (b) { var bl = S.d.blocks[b.dataset.id]; DS.audit('semana tipo', bl.id, bl.title, 'eliminado', bl.title, ''); DS.remove('blocks', bl.id); U.weekEdit = null; render(true); },
    'week-export': async function () {
      var ics = DL.weekIcs(DS.list('blocks'), today(), Date.now());
      U.exportMsg = await saveFile('semana-tipo-derrotero.zip', icsZip('semana-tipo.ics', ics)); render(true);
    },
    'ag-view': function (b) { U.agView = b.dataset.v; render(true); },
    'month': function (b) {
      var d = +b.dataset.d; var base = U.agMonth || today().slice(0, 7);
      if (d === 0) { U.agMonth = null; U.agDay = today(); }
      else { var y = +base.slice(0, 4), m = +base.slice(5, 7) + d; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } U.agMonth = y + '-' + DL.pad(m); }
      render(true);
    },
    'day': function (b) { U.agDay = b.dataset.d; render(true); },
    'toggle-done': function () { U.showDone = !U.showDone; render(true); },
    'ag-done': function (b) {
      var id = b.dataset.id; if (!S.d.agenda[id]) return;
      setAgenda(id, { done: true, doneAt: Date.now() }, 'hecha');
      if (b.dataset.t) closeToast(b.dataset.t);
      render(true);
    },
    'ag-undo': function (b) { setAgenda(b.dataset.id, { done: false, doneAt: 0 }, 'reabierta'); render(true); },
    'ag-open': function (b) { U.agOpen[b.dataset.id] = !U.agOpen[b.dataset.id]; render(true); },
    'ag-snooze': function (b) {
      var a = S.d.agenda[b.dataset.id]; if (!a) return;
      var p = DL.postpone(a, b.dataset.mode, Date.now());
      setAgenda(a.id, p, 'pospuesta');
      if (b.dataset.t) closeToast(b.dataset.t);
      toast({ kicker: 'Pospuesta', title: a.title, text: DL.fmtDate(p.date, { weekday: true, year: false }) + (p.time ? ' · ' + DL.fmtTime(p.time) : '') });
      render(true);
    },
    'ag-ics': async function (b) {
      var a = S.d.agenda[b.dataset.id];
      U.exportMsg = await saveFile('actividad-' + a.date + '.zip', icsZip('actividad.ics', DL.agendaIcs([a], Date.now())));
      toast({ title: U.exportMsg });
    },
    'ag-del-ask': function (b) { U.agConfirm[b.dataset.id] = true; render(true); },
    'ag-del-cancel': function (b) { delete U.agConfirm[b.dataset.id]; render(true); },
    'ag-del': function (b) { var a = S.d.agenda[b.dataset.id]; DS.audit('agenda', a.id, a.title, 'eliminada', a.title, ''); DS.remove('agenda', a.id); delete U.agConfirm[a.id]; render(true); },
    'ag-export': exportAgenda,
    'ag-copy-ics': async function () {
      var ok = await copyText(DL.agendaIcs(DL.sortAgenda(DS.agenda().filter(function (a) { return !a.done; })), Date.now()));
      U.exportMsg = ok ? 'Copiado. Pégalo en un archivo con extensión .ics para importarlo.' : 'Este visor no permitió copiar. Usa "Exportar agenda".'; render(true);
    },
    'notif': askNotif,
    'mic': function () { startMic(); },
    'parse': function () { var ta = document.getElementById('cap-text'); U.capText = ta ? ta.value : U.capText; doParse(U.capText); },
    'example': function (b) { U.capText = b.dataset.text; var ta = document.getElementById('cap-text'); if (ta) ta.value = U.capText; doParse(U.capText); },
    'draft-save': saveDraft,
    'draft-ai': aiParse,
    'draft-cancel': function () { U.draft = null; U.aiMsg = ''; render(true); },
    'go-capture': function () { if (U.route !== 'agenda') navigate('agenda'); setTimeout(focusCapture, 30); },
    'top-parse': function () { var i = document.getElementById('top-cap'); U.capText = i.value; doParse(i.value); },
    'top-mic': function () { if (U.route !== 'agenda') navigate('agenda'); startMic(); },
    'sum-copy': async function () {
      var ok = await copyText(DU.summaryText());
      if (!ok) { var pre = document.getElementById('summary'); var r = document.createRange(); r.selectNodeContents(pre); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
      U.exportMsg = ok ? 'Resumen copiado.' : 'El texto quedó seleccionado: cópialo con Ctrl + C o el menú del celular.'; render(true);
    },
    'sum-md': async function () { U.exportMsg = await saveFile('resumen-semanal-' + today() + '.md', DU.summaryText()); render(true); },
    'sum-pdf': async function () {
      var buf = pdfSummary(DU.summaryText());
      U.exportMsg = buf ? await saveFile('resumen-semanal-' + today() + '.pdf', buf) : 'La librería de PDF no cargó. Descarga el .md o copia el texto.';
      render(true);
    },
    'audit-f': function (b) { U.auditEntity = b.dataset.v; render(true); },
    'export-json': async function () { U.exportMsg = await saveFile('derrotero-' + today() + '.json', JSON.stringify(DS.snapshotAll(), null, 2)); render(true); },
    'backups': async function () { U.backups = await DS.listBackups(); render(true); },
    'backup-dl': async function (b) {
      var bk = (U.backups || []).filter(function (x) { return x.day === b.dataset.d; })[0];
      if (bk) { U.exportMsg = await saveFile('derrotero-respaldo-' + bk.day + '.json', JSON.stringify(bk.data, null, 2)); render(true); }
    },
    'reset-local': function () { DS.resetLocal(); U.exportMsg = 'Plan base restaurado en este navegador.'; render(true); },
    'load-seed': async function (b) {
      U.seedMsg = 'Cargando…'; render(true);
      await DS.loadSeedIntoDb(b.dataset.src === 'local');
      U.seedMsg = ''; announceInbox(DS.applyInbox()); render(true);
    },
    'goto-day': function (b) { var d = b.dataset.d; U.agView = 'mes'; U.agMonth = d.slice(0, 7); U.agDay = d; navigate('agenda'); },
    'cal-refresh': async function () { toast({ title: 'Leyendo el calendario…' }); await DS.loadCalendar(true); render(true); toast({ title: S.cal.status === 'ok' ? 'Calendario al día: ' + S.cal.events.length + ' eventos.' : 'El calendario no está conectado o no respondió.' }); },
    'toast-close': function (b) { closeToast(b.dataset.t); },
    'conflict': function (b) {
      var key = b.dataset.k; var c = U.conflict[key]; if (!c) return;
      var text = b.dataset.v === 'mine' ? c.mine : b.dataset.v === 'merge' ? c.theirs + '\n\n— versión de esta sesión —\n' + c.mine : c.theirs;
      delete U.conflict[key]; delete bases[key];
      var parts = key.split(':');
      if (parts[0] === 'task') DS.updateTask(parts[1], { note: text });
      render(true);
    }
  };

  // ───────────── ayudas emergentes de los gráficos ─────────────
  var tipFor = null, lastPointer = 'mouse', lastVertical = null;
  function showTip(t, x, y) {
    if (!el.tip) return;
    tipFor = t;
    el.tip.textContent = t.getAttribute('data-tip');
    el.tip.hidden = false;
    if (x == null) { var r = t.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
    var w = el.tip.offsetWidth, h = el.tip.offsetHeight;
    var left = Math.max(8, Math.min(root.innerWidth - w - 8, x - w / 2));
    var top = y - h - 14; if (top < 8) top = y + 18;
    el.tip.style.left = left + 'px'; el.tip.style.top = top + 'px';
  }
  function hideTip() { tipFor = null; if (el.tip) el.tip.hidden = true; }
  document.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; });
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t, e.clientX, e.clientY); else if (tipFor) hideTip();
  });
  document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('focusout', function () { hideTip(); });
  root.addEventListener('scroll', function () { if (tipFor) hideTip(); }, true);
  root.addEventListener('resize', function () {
    hideTip();
    if (U.route === 'hoy' && root.DDash && lastVertical !== null && root.DDash.isVertical() !== lastVertical) render(false);
  });

  document.addEventListener('click', function (e) {
    if (!audioCtx && (root.AudioContext || root.webkitAudioContext)) { try { audioCtx = new (root.AudioContext || root.webkitAudioContext)(); } catch (x) { } }
    // En pantallas táctiles el primer toque sobre un gráfico muestra el detalle; el segundo abre.
    var tp = e.target.closest && e.target.closest('[data-tip]');
    if (tp && lastPointer === 'touch' && tipFor !== tp && tp.tagName !== 'BUTTON' && tp.tagName !== 'A') { e.preventDefault(); showTip(tp); return; }
    if (!tp && tipFor) hideTip();
    var r = e.target.closest('[data-route]');
    if (r) { e.preventDefault(); navigate(r.dataset.route, { tview: r.dataset.tview }); return; }
    var b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    var fn = ACT[b.dataset.act];
    if (!fn) return;
    if (b.tagName === 'BUTTON' || b.tagName === 'A' || b.classList.contains('sheet-bg')) e.preventDefault();
    fn(b, e);
  });

  // ───────────── cambios en campos ─────────────
  function noteFocus(key, version, text) { if (!bases[key]) bases[key] = { version: version, text: text || '' }; }

  document.addEventListener('focusin', function (e) {
    var t = e.target;
    if (t.dataset.taskNote) { var tk = task(t.dataset.taskNote); if (tk) noteFocus('task:' + tk.id, tk.version, tk.note); }
  });
  document.addEventListener('focusout', function () { setTimeout(function () { if (pendingRender && !typing()) render(false); }, 0); });

  function saveNote(key, current, mine, write) {
    var base = bases[key]; delete bases[key];
    if (base && (current || '') !== base.text && (current || '') !== mine) { U.conflict[key] = { mine: mine, theirs: current || '' }; render(true); return; }
    if ((current || '') !== mine) write(mine);
  }

  document.addEventListener('change', function (e) {
    var t = e.target; var ds = t.dataset;
    if (ds.tf) { U.tf[ds.tf] = t.type === 'checkbox' ? t.checked : t.value; render(true); return; }
    if (ds.taskNote) { var tk = task(ds.taskNote); if (tk) saveNote('task:' + tk.id, tk.note, t.value, function (v) { DS.updateTask(tk.id, { note: v }); }); return; }
    if (ds.tfield) {
      var id = ds.id; var f = ds.tfield; var v = t.value; var patch = {};
      if (f === 'title' && !v.trim()) { t.value = task(id).title; return; }
      patch[f] = f === 'title' ? v.trim().slice(0, 160) : f === 'owner' ? (v.trim() || 'Tú') : v;
      if (f === 'phase') patch.order = DL.nextOrder(DS.tasks(), v);
      DS.updateTask(id, patch); render(true); return;
    }
    if (ds.tstatus) {
      var tt = task(ds.tstatus); var ns = t.value;
      if (ns === 'bloqueada') {
        if (!String(tt.blockCause || '').trim()) { U.confirm[tt.id] = 'block'; render(true); var ta = document.getElementById('tb-' + tt.id); if (ta) ta.focus(); return; }
      }
      delete U.confirm[tt.id]; DS.updateTask(tt.id, { status: ns }); render(true); return;
    }
    if (ds.tblock) { var tb = task(ds.tblock); if (tb && tb.status === 'bloqueada' && t.value.trim()) DS.updateTask(tb.id, { blockCause: t.value.trim() }); return; }
    if (ds.ag) {
      var a = S.d.agenda[ds.ag]; if (!a) return; var val = t.value; var pa = {};
      if (ds.f === 'title' && !val.trim()) { t.value = a.title; return; }
      if (ds.f === 'date' && !DL.isDateStr(val)) { t.value = a.date; return; }
      pa[ds.f] = /Min$/.test(ds.f) ? +val : ds.f === 'title' ? val.trim().slice(0, 160) : val;
      setAgenda(a.id, pa); render(true); return;
    }
    if (ds.draft) {
      if (!U.draft) return;
      U.draft[ds.draft] = /Min$/.test(ds.draft) ? +t.value : t.value;
      render(true); return;
    }
    if (ds.lab) {
      var lp = DS.clone(S.d.lab[ds.lab]); var lb = lp[ds.f] || '';
      lp[ds.f] = t.value.trim(); DS.audit('laboratorio', lp.id, lp.name, ds.f, lb, lp[ds.f]); DS.put('lab', lp.id, lp); render(true); return;
    }
    if (ds.cfg) { changeConfig(ds.cfg.split('|'), t); return; }
  });

  function changeConfig(p, input) {
    var kind = p[0], id = p[1], f = p[2], v = input.value.trim();
    var cfg = DS.clone(DS.config());
    if (kind === 'phase') {
      if ((f === 'start' || f === 'end') && !DL.isDateStr(v)) { input.value = cfg.phases[id][f]; return; }
      if (!v) { input.value = cfg.phases[id][f]; return; }
      var b = cfg.phases[id][f]; cfg.phases[id][f] = v; DS.saveConfig({ phases: cfg.phases }, 'Etapa ' + cfg.phases[id].title, f, b, v);
    } else if (kind === 'front') {
      var fr = cfg.fronts[id]; var old = fr[f];
      if (f === 'name') {
        if (!v || DS.fronts().some(function (x) { return x.name === v && x.id !== id; })) { input.value = old; return; }
        DS.tasks().filter(function (t) { return t.front === old; }).forEach(function (t) { DS.updateTask(t.id, { front: v }, { silent: true }); });
        DS.agenda().filter(function (a) { return a.front === old; }).forEach(function (a) { DS.put('agenda', a.id, Object.assign({}, a, { front: v })); });
        DS.list('habits').filter(function (h) { return h.front === old; }).forEach(function (h) { DS.put('habits', h.id, Object.assign({}, h, { front: v })); });
      }
      fr[f] = v; DS.saveConfig({ fronts: cfg.fronts }, 'Frente ' + fr.name, f, old, v);
    } else if (kind === 'kpi') {
      var k = cfg.kpis.filter(function (x) { return x.key === id; })[0]; var ob = k[f];
      if (f === 'target') { var n = Math.round(+v); if (!(n >= 1)) { input.value = ob; return; } v = n; }
      if (f === 'due' && !DL.isDateStr(v)) { input.value = ob; return; }
      if (!v) { input.value = ob; return; }
      k[f] = v; DS.saveConfig({ kpis: cfg.kpis }, 'Indicador ' + k.label, f, ob, v);
    }
    render(true);
  }

  var qTimer = null;
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'cap-text') { U.capText = t.value; return; }
    if (t.dataset.tf === 'q') { clearTimeout(qTimer); qTimer = setTimeout(function () { U.tf.q = t.value; render(true); }, 180); }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && (e.target.id === 'cap-text' || e.target.id === 'top-cap')) {
      e.preventDefault(); U.capText = e.target.value; doParse(e.target.value);
    }
    if (e.key === 'Escape' && U.more) { U.more = false; renderChrome(); }
    if (e.key === 'Escape') hideTip();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.dataset.act && e.target.tagName !== 'BUTTON') {
      e.preventDefault(); var fn = ACT[e.target.dataset.act]; if (fn) fn(e.target, e);
    }
  });

  // ───────────── formularios ─────────────
  document.addEventListener('submit', function (e) {
    var f = e.target; var kind = f.dataset.form; if (!kind) return;
    e.preventDefault();
    if (!S.canWrite) return;
    var fd = new FormData(f); var g = function (k) { return String(fd.get(k) || '').trim(); };
    if (kind === 'add-task') {
      if (!g('title')) return;
      var id = DS.addTask({ title: g('title'), phase: g('phase'), front: g('front'), owner: g('owner'), due: g('due') });
      f.reset(); U.open[id] = false; render(true);
      toast({ kicker: 'Actividad agregada', title: g('title') || 'Nueva actividad' });
    } else if (kind === 'add-habit') {
      var hid = DS.newId('h'); var n = DS.list('habits').length + 1;
      DS.put('habits', hid, { id: hid, title: g('title'), freq: g('freq'), target: Math.max(1, +g('target') || 1), days: g('freq') === 'diario' ? [1, 2, 3, 4, 5] : [], when: g('when'), front: '', order: n });
      DS.audit('hábito', hid, g('title'), 'creado', '', g('freq')); f.reset(); render(true);
    } else if (kind === 'block') {
      var b = U.weekEdit; var st = g('start'), en = g('end');
      if (!g('title') || !st || !en || en <= st) { var m = document.getElementById('bk-msg'); if (m) m.textContent = 'Revisa el título y que la hora de fin sea posterior a la de inicio.'; return; }
      var bid = b.id || DS.newId('b');
      var blk = { id: bid, title: g('title'), day: +g('day'), start: st, end: en, cat: g('cat'), note: g('note') };
      DS.audit('semana tipo', bid, blk.title, b.id ? 'editado' : 'creado', b.id ? S.d.blocks[bid].start + '–' + S.d.blocks[bid].end : '', st + '–' + en);
      DS.put('blocks', bid, blk); U.weekEdit = null; render(true);
    } else if (kind === 'mode-review') {
      var q = DL.quarterOf(today()); var modes = {};
      DS.fronts().forEach(function (x) { modes[x.name] = x.mode; });
      var rid = DS.newId('d');
      DS.put('decisions', rid, { id: rid, kind: 'modos', quarter: q, modes: modes, option: 'Revisión trimestral de modos', justification: g('note'), date: today(), at: Date.now(), actor: S.meId || 'app' });
      DS.saveConfig({ modeReview: { quarter: q, date: today(), note: g('note'), updatedAt: Date.now() } }, 'Revisión trimestral ' + q, 'modos', '', JSON.stringify(modes));
      f.reset(); render(true); toast({ kicker: 'Revisión trimestral registrada', title: DL.quarterLabel(q) });
    } else if (kind === 'add-lab') {
      var lid = DS.newId('l');
      DS.put('lab', lid, { id: lid, name: g('name'), description: g('description'), quarter: g('quarter'), exitCriterion: '', decision: '', decisionNote: '', decidedAt: '' });
      DS.audit('laboratorio', lid, g('name'), 'creado', '', g('quarter')); f.reset(); render(true);
    } else if (kind === 'add-front') {
      var cfg = DS.clone(DS.config()); var name = g('name');
      if (!name || DS.fronts().some(function (x) { return x.name === name; })) return;
      var fid = 'f' + Date.now().toString(36);
      cfg.fronts[fid] = { id: fid, name: name, mode: 'explorar', order: DS.fronts().length + 1, scope: '' };
      DS.saveConfig({ fronts: cfg.fronts }, 'Frente ' + name, 'creado', '', name); f.reset(); render(true);
    } else if (kind === 'add-kpi') {
      var c2 = DS.clone(DS.config()); var key = 'k' + Date.now().toString(36);
      if (!DL.isDateStr(g('due'))) return;
      c2.kpis.push({ key: key, label: g('label'), target: Math.max(1, Math.round(+g('target') || 1)), due: g('due'), order: c2.kpis.length + 1 });
      DS.saveConfig({ kpis: c2.kpis }, 'Indicador ' + g('label'), 'creado', '', g('target'));
      f.reset(); render(true);
    }
  });

  // ───────────── arrastrar para ordenar (RF-02) ─────────────
  var drag = null;
  document.addEventListener('dragstart', function (e) {
    var r = e.target.closest && e.target.closest('.trow[draggable="true"]'); if (!r) return;
    drag = { id: r.dataset.task, phase: r.dataset.phase };
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag.id); } catch (x) { }
  });
  document.addEventListener('dragover', function (e) {
    if (!drag) return; var r = e.target.closest && e.target.closest('.trow');
    if (!r || r.dataset.phase !== drag.phase || r.dataset.task === drag.id) return;
    e.preventDefault();
    document.querySelectorAll('.drag-over').forEach(function (n) { n.classList.remove('drag-over'); });
    r.classList.add('drag-over');
  });
  document.addEventListener('drop', function (e) {
    if (!drag) return; var r = e.target.closest && e.target.closest('.trow');
    if (r && r.dataset.phase === drag.phase && r.dataset.task !== drag.id) {
      e.preventDefault();
      var rect = r.getBoundingClientRect(); var after = e.clientY > rect.top + rect.height / 2;
      applyOrder(DL.reorder(DS.tasks(), drag.phase, drag.id, r.dataset.task, after));
      render(true);
    }
    drag = null;
  });
  document.addEventListener('dragend', function () { drag = null; document.querySelectorAll('.drag-over').forEach(function (n) { n.classList.remove('drag-over'); }); });

  window.addEventListener('hashchange', function () { var r = location.hash.slice(1); if (ROUTES.indexOf(r) >= 0 && r !== U.route) navigate(r); });

  // ───────────── arranque ─────────────
  function boot() {
    el = { main: $('#main'), nav: $('#nav'), tabbar: $('#tabbar'), conn: $('#conn'), stamp: $('#stamp'), toasts: $('#toasts'), sheet: $('#sheet') };
    el.tip = document.createElement('div'); el.tip.className = 'tip'; el.tip.setAttribute('role', 'tooltip'); el.tip.hidden = true; document.body.appendChild(el.tip);
    var h = (location.hash || '').slice(1); if (ROUTES.indexOf(h) >= 0) U.route = h;
    U.notif = root.Notification ? (Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'default') : 'unsupported';
    DS.onChange(function (kind) {
      if (kind && kind.toast) { toast({ kind: 'bad', title: kind.toast }); return; }
      if (kind === 'readonly') toast({ title: 'Esta cuenta no puede editar el plan', text: 'La vista quedó en solo lectura.' });
      if (!bootedOnce && DS.ready() && !S.empty) {
        bootedOnce = true;
        setTimeout(function () {
          announceInbox(DS.applyInbox());
          tick(); DS.dailyBackup();
        }, 1500);
      }
      scheduleRender();
    });
    render(true);
    DS.init();
    if (root.claude && typeof root.claude.use === 'function') {
      root.claude.use('sample').then(function (s) { sample = s; U.aiAvailable = !!s; scheduleRender(); }).catch(function () { });
      root.claude.use('downloads').then(function (d) { downloads = d; }).catch(function () { });
    }
    DS.loadCalendar(false);
    setInterval(function () { DS.loadCalendar(false); }, 10 * 60000);
    setInterval(tick, 15000);
    setInterval(function () { if (U.route === 'hoy' || U.route === 'agenda') render(false); else renderChrome(); }, 60000);
  }

  boot();
})(window);
