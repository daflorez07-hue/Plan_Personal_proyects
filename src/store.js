/* Derrotero · estado y persistencia.
 * Con la capacidad `db` del artefacto: base de documentos compartida y en vivo.
 * Sin ella (archivo local, vista previa): modo local con localStorage. */
(function (root) {
  'use strict';
  var DL = root.DL;
  var COLLS = ['config', 'tasks', 'kpis', 'kpi_events', 'decisions', 'habits', 'habit_logs', 'blocks', 'lab', 'agenda', 'audit'];
  var LOCAL_KEY = 'derrotero-local-v1';

  var S = {
    mode: 'loading',        // loading · db · local
    backend: '',            // artefacto · vercel
    offline: false,
    localReason: '',
    canWrite: true,
    meId: null,
    user: null,
    names: {},
    loaded: {},
    empty: false,
    d: {},                  // colección → { id: doc }
    listeners: []
  };
  COLLS.forEach(function (c) { S.d[c] = {}; });

  var db = null;
  var chains = {};

  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function now() { return Date.now(); }
  function today() { return DL.todayBogota(); }

  function emit(kind) { S.listeners.forEach(function (fn) { try { fn(kind); } catch (e) { console.error(e); } }); }
  function onChange(fn) { S.listeners.push(fn); }

  // ───── lectura práctica ─────
  function config() { return S.d.config.main || null; }
  function list(coll) { return Object.keys(S.d[coll] || {}).map(function (k) { return S.d[coll][k]; }); }
  function tasks() { return list('tasks'); }
  function phases() { var c = config(); return c ? Object.values(c.phases).sort(function (a, b) { return a.order - b.order; }) : []; }
  function fronts() { var c = config(); return c ? Object.values(c.fronts).sort(function (a, b) { return a.order - b.order; }) : []; }
  function kpiDefs() { var c = config(); return c ? c.kpis.slice().sort(function (a, b) { return a.order - b.order; }) : []; }
  function kpiValues() { return (S.d.kpis.main && S.d.kpis.main.values) || {}; }
  function agenda() { return list('agenda'); }

  // ───── arranque ─────
  function seedDocs(seed) {
    var out = { config: { main: seed.config }, kpis: { main: seed.kpis } };
    ['tasks', 'habits', 'blocks', 'lab'].forEach(function (c) { out[c] = clone(seed[c]); });
    return out;
  }

  function startLocal(reason) {
    S.mode = 'local';
    S.localReason = reason || '';
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { saved = null; }
    var base = saved || seedDocs(root.DERROTERO_SEED);
    COLLS.forEach(function (c) { S.d[c] = base[c] || {}; S.loaded[c] = true; });
    emit('all');
  }

  function persistLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(S.d)); } catch (e) { /* almacenamiento bloqueado: el estado vive en memoria */ }
  }

  async function init() {
    var use = root.claude && typeof root.claude.use === 'function';
    if (use) {
      try { db = await root.claude.use('db'); } catch (e) { db = null; }
      if (!db) { startLocal('nodb'); return; }
      S.backend = 'artefacto';
      subscribe();
      initUser();
      return;
    }
    // Fuera del artefacto: base de datos propia en Vercel (Postgres) si está conectada.
    var r = root.DR ? await root.DR.connect() : { reason: 'file' };
    if (!r.db) { startLocal(r.reason); return; }
    db = r.db;
    S.backend = 'vercel';
    S.meId = 'owner';
    subscribe();
  }

  var lastNetToast = 0;
  function subscribe() {
    S.mode = 'db';
    COLLS.forEach(function (c) {
      var q = c === 'audit' ? db.collection('audit').orderBy('day', 'desc').limit(62) : db.collection(c);
      q.onSnapshot(function (snap) {
        var m = {};
        snap.docs.forEach(function (d) { m[d.id] = d.data(); });
        S.d[c] = m;
        S.loaded[c] = true;
        S.offline = false;
        if (c === 'config') S.empty = !m.main;
        emit(c);
      }, function (err) {
        console.warn('db', c, err);
        if (err && err.code === 'revoked') { S.canWrite = false; emit('all'); }
        if (err && (err.code === 'network' || err.code === 'auth') && Date.now() - lastNetToast > 60000) {
          lastNetToast = Date.now(); S.offline = true;
          emit({ toast: err.code === 'auth' ? 'La sesión de Vercel venció. Recarga la página para volver a entrar.' : 'Sin conexión con la base de datos. Los cambios se reintentan al volver la conexión.' });
        }
      });
    });
  }

  async function initUser() {
    try {
      var user = await root.claude.use('user');
      if (!user) return;
      S.user = user;
      S.meId = await user.id();
      var can = await user.can('data.write');
      if (can === false) { S.canWrite = false; emit('all'); }
    } catch (e) { /* sin identidad: se usa "app" como autor */ }
  }

  function ready() {
    if (S.mode === 'local') return true;
    return S.mode === 'db' && ['config', 'tasks', 'kpis'].every(function (c) { return S.loaded[c]; });
  }

  // ───── escritura ─────
  function handleWriteError(e) {
    var code = e && e.code;
    if (code === 'invalid_argument' && S.mode === 'db') {
      S.canWrite = false;
      emit('readonly');
    } else if (code === 'quota_exceeded') {
      emit({ toast: 'La base de datos llegó a su límite de documentos. Borra movimientos o elementos viejos de la agenda para seguir guardando.' });
    } else {
      emit({ toast: 'No se pudo guardar el cambio. Revisa la conexión e inténtalo de nuevo.' });
    }
  }

  function enqueue(path, fn) {
    var run = function () { return fn().catch(function (e) { handleWriteError(e); }); };
    chains[path] = (chains[path] || Promise.resolve()).then(run, run);
    return chains[path];
  }

  function put(coll, id, doc) {
    if (!S.canWrite) return Promise.resolve();
    S.d[coll] = Object.assign({}, S.d[coll]);
    S.d[coll][id] = doc;
    if (S.mode === 'local') { persistLocal(); emit(coll); return Promise.resolve(); }
    emit(coll);
    var path = coll + '/' + id;
    return enqueue(path, function () { return db.doc(path).set(clone(doc)); });
  }

  function remove(coll, id) {
    if (!S.canWrite) return Promise.resolve();
    S.d[coll] = Object.assign({}, S.d[coll]);
    delete S.d[coll][id];
    if (S.mode === 'local') { persistLocal(); emit(coll); return Promise.resolve(); }
    emit(coll);
    var path = coll + '/' + id;
    return enqueue(path, function () { return db.doc(path).delete(); });
  }

  function newId(prefix) { return prefix + now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ───── bitácora (H-02, RF-06): un documento por día ─────
  var auditBuf = []; var auditTimer = null;
  function audit(entity, entityId, label, field, before, after, actor) {
    auditBuf.push({
      at: now(), entity: entity, entityId: entityId, label: String(label || '').slice(0, 160), field: field,
      before: typeof before === 'object' ? JSON.stringify(before) : String(before == null ? '' : before).slice(0, 400),
      after: typeof after === 'object' ? JSON.stringify(after) : String(after == null ? '' : after).slice(0, 400),
      actor: actor || S.meId || 'app'
    });
    clearTimeout(auditTimer);
    auditTimer = setTimeout(flushAudit, 700);
  }
  function flushAudit() {
    if (!auditBuf.length) return;
    var day = today();
    var cur = S.d.audit[day] || { day: day, entries: [] };
    var entries = (cur.entries || []).concat(auditBuf).slice(-1200);
    auditBuf = [];
    put('audit', day, { day: day, entries: entries });
  }

  // ───── operaciones de dominio ─────
  var TASK_FIELDS = ['title', 'phase', 'front', 'owner', 'due', 'status', 'note', 'blockCause'];

  function updateTask(id, patch, opts) {
    var t = S.d.tasks[id]; if (!t) return;
    var next = Object.assign({}, t, patch, { version: (t.version || 0) + 1, updatedAt: now() });
    if (patch.status === 'hecha' && t.status !== 'hecha') next.doneAt = today();
    if (patch.status && patch.status !== 'hecha') next.doneAt = '';
    if (patch.status && patch.status !== 'bloqueada' && !('blockCause' in patch)) next.blockCause = t.blockCause || '';
    if (!(opts && opts.silent)) {
      DL.diffFields(t, next, TASK_FIELDS).forEach(function (d) { audit('actividad', id, t.title, d.field, d.before, d.after); });
    }
    return put('tasks', id, next);
  }

  function addTask(data) {
    var all = tasks();
    var id = newId('t');
    var t = {
      id: id, title: data.title.trim().slice(0, 160), phase: data.phase, order: DL.nextOrder(all, data.phase),
      front: data.front, owner: (data.owner || 'Tú').trim() || 'Tú', due: data.due || '', status: 'pendiente',
      note: '', blockCause: '', doneAt: '', version: 1, updatedAt: now()
    };
    audit('actividad', id, t.title, 'creada', '', t.title);
    put('tasks', id, t);
    return id;
  }

  function deleteTask(id) {
    var t = S.d.tasks[id]; if (!t) return;
    audit('actividad', id, t.title, 'eliminada', t.title, '');
    remove('tasks', id);
  }

  // indicadores: pantalla optimista, escritura agrupada a los 600 ms, un movimiento fechado por ráfaga
  var kpiPending = {}; var kpiTimer = null;
  function bumpKpi(key, delta) {
    var vals = Object.assign({}, kpiValues());
    var r = DL.applyKpiDelta(vals[key] || 0, delta);
    if (!r.applied) return false;
    vals[key] = r.value;
    S.d.kpis = Object.assign({}, S.d.kpis, { main: { values: vals, updatedAt: now() } });
    kpiPending[key] = (kpiPending[key] || 0) + r.applied;
    emit('kpis');
    clearTimeout(kpiTimer);
    kpiTimer = setTimeout(flushKpis, 600);
    return true;
  }
  function flushKpis() {
    var vals = kpiValues();
    var defs = kpiDefs();
    Object.keys(kpiPending).forEach(function (key) {
      var delta = kpiPending[key];
      if (!delta) return;
      var id = newId('k');
      var def = defs.filter(function (d) { return d.key === key; })[0];
      put('kpi_events', id, { id: id, kpi: key, delta: delta, value: vals[key], date: today(), at: now(), actor: S.meId || 'app' });
      audit('indicador', key, def ? def.label : key, 'valor', vals[key] - delta, vals[key]);
    });
    kpiPending = {};
    put('kpis', 'main', { values: Object.assign({}, vals), updatedAt: now() });
  }

  function saveConfig(patch, label, field, before, after) {
    var c = Object.assign({}, config(), patch);
    if (label) audit('configuración', 'main', label, field, before, after);
    return put('config', 'main', c);
  }

  function snapshotAll() {
    var out = {};
    COLLS.forEach(function (c) { out[c] = clone(S.d[c]); });
    out.exportedAt = new Date().toISOString();
    out.app = 'Derrotero';
    return out;
  }

  function localSaved() {
    try { var v = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); return v && v.tasks && Object.keys(v.tasks).length ? v : null; } catch (e) { return null; }
  }

  /** Carga el plan base, o lo que había en este navegador (fromLocal), en la base vacía. */
  async function loadSeedIntoDb(fromLocal) {
    var src = fromLocal ? localSaved() : null;
    var docs = src || seedDocs(root.DERROTERO_SEED);
    var ops = [];
    COLLS.forEach(function (c) {
      if (!docs[c]) return;
      S.d[c] = Object.assign({}, S.d[c]);
      Object.keys(docs[c]).forEach(function (id) { S.d[c][id] = docs[c][id]; ops.push({ op: 'set', coll: c, id: id, data: clone(docs[c][id]) }); });
    });
    S.empty = false;
    S.seeding = true;
    emit('all');
    try {
      if (db && db.batch) { try { await db.batch(ops); } catch (e) { handleWriteError(e); } }
      else for (var i = 0; i < ops.length; i++) await put(ops[i].coll, ops[i].id, ops[i].data);
    } finally { S.seeding = false; }
  }

  // respaldo diario (RNF): un documento por día, se conservan 14
  async function dailyBackup() {
    if (S.mode !== 'db' || !S.canWrite || S.empty) return;
    var day = today();
    try {
      var ref = db.doc('backups/' + day);
      var snap = await ref.get();
      if (!snap.exists) {
        var data = snapshotAll(); delete data.audit;
        await ref.set({ day: day, at: now(), data: data });
      }
      var all = await db.collection('backups').orderBy('day', 'desc').get();
      all.docs.slice(14).forEach(function (d) { db.doc('backups/' + d.id).delete().catch(function () {}); });
    } catch (e) { /* el respaldo nunca bloquea la app */ }
  }

  async function listBackups() {
    if (S.mode !== 'db') return [];
    try {
      var all = await db.collection('backups').orderBy('day', 'desc').get();
      return all.docs.map(function (d) { return d.data(); });
    } catch (e) { return []; }
  }

  async function names(ids) {
    if (!S.user || !ids.length) return;
    try {
      var ps = await S.user.profiles(ids);
      ids.forEach(function (id) { if (ps[id]) S.names[id] = ps[id].name || ''; });
    } catch (e) { /* sin nombres */ }
  }

  function resetLocal() {
    try { localStorage.removeItem(LOCAL_KEY); } catch (e) { }
    startLocal(S.localReason);
  }

  // ───── pendientes registrados por Claude (una sola vez por pendiente) ─────
  function phaseFor(date) {
    var ph = phases(); var d = date || today();
    for (var i = 0; i < ph.length; i++) if (d >= ph[i].start && d <= ph[i].end) return ph[i].id;
    return ph.length ? (d < ph[0].start ? ph[0].id : ph[ph.length - 1].id) : '';
  }
  function applyInbox() {
    var inbox = root.DERROTERO_INBOX || []; var cfg = config();
    if (!cfg || !S.canWrite || S.empty || S.seeding || !inbox.length) return [];
    var done = (cfg.inboxApplied || []).slice(); var added = [];
    var names = fronts().map(function (f) { return f.name; });
    inbox.forEach(function (it) {
      if (done.indexOf(it.id) >= 0) return;
      done.push(it.id);
      if (S.d.tasks[it.id]) return;
      var phase = phaseFor(it.due);
      var t = {
        id: it.id, title: it.title, phase: phase, order: DL.nextOrder(tasks(), phase),
        front: names.indexOf(it.front) >= 0 ? it.front : (names[0] || ''), owner: it.owner || 'Tú', due: it.due || '',
        status: 'pendiente', note: it.note || '', blockCause: '', doneAt: '', version: 1, updatedAt: now()
      };
      put('tasks', it.id, t);
      audit('actividad', it.id, t.title, 'creada', '', t.title, 'claude');
      added.push(t);
    });
    if (done.length !== (cfg.inboxApplied || []).length) put('config', 'main', Object.assign({}, config(), { inboxApplied: done }));
    return added;
  }

  // ───── calendario personal (solo lectura) ─────
  S.cal = { status: 'off', events: [], fetchedAt: 0, calendars: 0, errors: [] };
  function calendarEvents() { return S.cal.events || []; }
  async function loadCalendar(fresh) {
    if (!root.DR || (root.claude && typeof root.claude.use === 'function')) return;
    if (S.cal.status === 'off') S.cal.status = 'loading';
    try {
      var r = await root.DR.calendar(fresh);
      if (!r.configured) S.cal = { status: 'off', events: [], fetchedAt: 0, calendars: 0, errors: [] };
      else S.cal = { status: r.errors && r.errors.length && !r.events.length ? 'error' : 'ok', events: r.events || [], fetchedAt: r.fetchedAt, calendars: r.calendars, errors: r.errors || [] };
    } catch (e) {
      S.cal = Object.assign({}, S.cal, { status: S.cal.events.length ? 'ok' : 'unreachable' });
    }
    emit('cal');
  }

  root.DS = {
    S: S, init: init, ready: ready, onChange: onChange, emit: emit,
    config: config, list: list, tasks: tasks, phases: phases, fronts: fronts, kpiDefs: kpiDefs, kpiValues: kpiValues,
    agenda: agenda,
    put: put, remove: remove, newId: newId, audit: audit, flushAudit: flushAudit,
    updateTask: updateTask, addTask: addTask, deleteTask: deleteTask, bumpKpi: bumpKpi, saveConfig: saveConfig,
    snapshotAll: snapshotAll, loadSeedIntoDb: loadSeedIntoDb, dailyBackup: dailyBackup, listBackups: listBackups,
    names: names, resetLocal: resetLocal, clone: clone, today: today, localSaved: localSaved,
    loadCalendar: loadCalendar, calendar: calendarEvents, applyInbox: applyInbox
  };
})(window);
