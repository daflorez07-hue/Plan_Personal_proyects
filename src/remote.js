/* Derrotero · cliente de la base de datos en Vercel (/api/db sobre Postgres).
 * Expone la misma forma que usa store.js con la base del artefacto:
 * collection(c).onSnapshot · collection(c).get · doc(path).set/delete/get · batch(ops).
 * Los cambios de otros dispositivos llegan por sondeo liviano (número de revisión cada 12 s). */
(function (root) {
  'use strict';
  var API = '/api/db';
  var POLL_MS = 12000;

  function call(method, qs, body, timeoutMs) {
    var ctl = root.AbortController ? new AbortController() : null;
    var timer = ctl && timeoutMs ? setTimeout(function () { ctl.abort(); }, timeoutMs) : null;
    var opts = { method: method, headers: { 'X-Derrotero': '1' }, credentials: 'same-origin', cache: 'no-store' };
    if (ctl) opts.signal = ctl.signal;
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(API + (qs ? '?' + qs : ''), opts).then(function (r) {
      if (timer) clearTimeout(timer);
      var ct = r.headers.get('content-type') || '';
      if (ct.indexOf('application/json') < 0) { var e0 = new Error('auth'); e0.code = 'auth'; throw e0; }
      return r.json().then(function (j) {
        if (!r.ok) {
          var e = new Error(j.error || 'http ' + r.status);
          e.code = r.status === 413 ? 'quota_exceeded' : r.status === 400 ? 'bad_request' : 'network';
          throw e;
        }
        return j;
      });
    }, function (err) {
      if (timer) clearTimeout(timer);
      var e = new Error(String(err && err.message || err)); e.code = 'network'; throw e;
    });
  }

  function makeDb(initialRev) {
    var docs = null, rev = initialRev, pending = 0, gen = 0, dirty = false, listeners = [], errorFns = [];
    var timer = null;

    function snapFor(l) {
      var m = (docs && docs[l.coll]) || {};
      var ids = Object.keys(m);
      if (l.order) ids.sort(function (a, b) { var x = String((m[a] || {})[l.order.f] || a), y = String((m[b] || {})[l.order.f] || b); return l.order.dir === 'desc' ? y.localeCompare(x) : x.localeCompare(y); });
      if (l.limit) ids = ids.slice(0, l.limit);
      return { docs: ids.map(function (id) { return { id: id, data: function () { return m[id]; } }; }) };
    }
    function dispatch() { listeners.forEach(function (l) { try { l.cb(snapFor(l)); } catch (e) { console.error(e); } }); }
    function fail(e) { errorFns.forEach(function (fn) { try { fn(e); } catch (x) { } }); }

    function pull(force) {
      if (pending) { dirty = true; return Promise.resolve(); }
      var g = gen;
      return call('GET', 'op=rev', null, 8000).then(function (r) {
        if (!force && docs && r.rev === rev) return;
        return call('GET', 'op=all', null, 15000).then(function (a) {
          if (pending || g !== gen) { dirty = true; return; }
          rev = a.rev; docs = a.docs; dispatch();
        });
      }).catch(function (e) { fail(e); });
    }

    function afterWrite() {
      pending--;
      if (!pending && dirty) { dirty = false; pull(true); }
    }
    function write(body) {
      pending++; gen++;
      return call('POST', '', body, 20000).then(function (r) { afterWrite(); return r; }, function (e) { afterWrite(); dirty = true; throw e; });
    }

    function start() {
      if (timer) return;
      timer = setInterval(function () { if (!document.hidden) pull(false); }, POLL_MS);
      document.addEventListener('visibilitychange', function () { if (!document.hidden) pull(false); });
      root.addEventListener('focus', function () { pull(false); });
      pull(true);
    }

    function query(coll) {
      var l = { coll: coll, order: null, limit: 0 };
      var q = {
        orderBy: function (f, dir) { l.order = { f: f, dir: dir || 'asc' }; return q; },
        limit: function (n) { l.limit = n; return q; },
        onSnapshot: function (cb, err) {
          l.cb = cb; listeners.push(l);
          if (err) errorFns.push(err);
          if (docs) cb(snapFor(l));
          start();
          return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
        },
        get: function () {
          return call('GET', 'op=list&coll=' + encodeURIComponent(coll), null, 15000).then(function (r) {
            return { docs: r.docs.map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) };
          });
        }
      };
      return q;
    }

    function ref(path) {
      var p = path.split('/'); var coll = p[0], id = p[1];
      return {
        set: function (data) { return write({ op: 'set', coll: coll, id: id, data: data }); },
        delete: function () { return write({ op: 'del', coll: coll, id: id }); },
        get: function () {
          return call('GET', 'op=get&coll=' + encodeURIComponent(coll) + '&id=' + encodeURIComponent(id), null, 10000)
            .then(function (r) { return { exists: !!r.exists, data: function () { return r.data; } }; });
        }
      };
    }

    return {
      kind: 'vercel',
      collection: query,
      doc: ref,
      batch: function (ops) {
        var chunks = []; for (var i = 0; i < ops.length; i += 200) chunks.push(ops.slice(i, i + 200));
        return chunks.reduce(function (p, c) { return p.then(function () { return write({ op: 'batch', ops: c }); }); }, Promise.resolve());
      },
      refresh: function () { return pull(true); }
    };
  }

  /** Resuelve si hay base de datos en el servidor. Nunca lanza: devuelve { db } o { reason }. */
  function connect() {
    if (!root.fetch || location.protocol === 'file:') return Promise.resolve({ reason: 'file' });
    return call('GET', 'op=status', null, 8000).then(function (r) {
      if (!r.configured) return { reason: 'nodb' };
      return { db: makeDb(r.rev) };
    }, function (e) { return { reason: e.code === 'auth' ? 'auth' : 'offline' }; });
  }

  /** Calendario personal leído en el servidor (dirección iCal secreta en variable de entorno). */
  function calendar(fresh) {
    if (!root.fetch || location.protocol === 'file:') return Promise.resolve({ configured: false, events: [] });
    return fetch('/api/calendar' + (fresh ? '?fresh=1' : ''), { headers: { 'X-Derrotero': '1' }, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (!r.ok || ct.indexOf('application/json') < 0) throw new Error('http');
        return r.json();
      });
  }

  root.DR = { connect: connect, calendar: calendar };
})(window);
