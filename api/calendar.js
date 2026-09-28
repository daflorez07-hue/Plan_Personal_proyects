// Derrotero · lectura del calendario personal (Google Calendar u Outlook) por su
// dirección secreta en formato iCal. La dirección vive solo en la variable de
// entorno CALENDAR_ICS_URL de Vercel (varias separadas por coma); nunca llega al navegador.
// Solo se devuelven título, fecha y hora: ni descripciones, ni invitados, ni lugares.
const guard = require('./_guard');

const TZ_OFFSET_MS = -5 * 3600 * 1000; // Bogotá, sin horario de verano
const MAX_BYTES = 6 * 1024 * 1024;
const MAX_EVENTS = 2000;
let cache = { at: 0, body: null };

function sources() {
  return String(process.env.CALENDAR_ICS_URL || '')
    .split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
    .map((s) => s.replace(/^webcal:\/\//i, 'https://'))
    .filter((s) => /^https:\/\//i.test(s));
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function bogota(ms) {
  const d = new Date(ms + TZ_OFFSET_MS);
  return { date: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), time: pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) };
}
// Los eventos de día completo llegan como fecha local del servidor: se leen sus campos locales.
function dayOnly(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

async function fetchText(u) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(u, { signal: ctl.signal, headers: { accept: 'text/calendar, text/plain, */*', 'user-agent': 'Mozilla/5.0 (compatible; Derrotero/2.0; +calendario personal)' } });
    if (!r.ok) throw new Error('http ' + r.status);
    const text = await r.text();
    if (text.length > MAX_BYTES) throw new Error('too_large');
    if (!/BEGIN:VCALENDAR/.test(text)) throw new Error('not_ical');
    return text;
  } finally { clearTimeout(timer); }
}

function expand(ical, text, calIndex, from, to) {
  const data = ical.sync.parseICS(text);
  const out = [];
  Object.keys(data).forEach((k) => {
    const ev = data[k];
    if (!ev || ev.type !== 'VEVENT' || !ev.start) return;
    if (String(ev.status || '').toUpperCase() === 'CANCELLED') return;
    let inst;
    try { inst = ical.expandRecurringEvent(ev, { from, to, expandOngoing: true }); } catch (e) { return; }
    inst.forEach((i) => {
      const title = String((i.summary && (i.summary.val || i.summary)) || ev.summary || 'Evento').slice(0, 160);
      const full = !!i.isFullDay;
      const s = i.start instanceof Date ? i.start : new Date(i.start);
      const e = i.end ? (i.end instanceof Date ? i.end : new Date(i.end)) : null;
      let date, time = '', endDate, endTime = '';
      if (full) {
        date = dayOnly(s);
        endDate = e ? dayOnly(new Date(e.getTime() - 1)) : date; // DTEND de día completo es exclusivo
      } else {
        const b = bogota(s.getTime()); date = b.date; time = b.time;
        const be = bogota((e || s).getTime()); endDate = be.date; endTime = be.time;
      }
      out.push({ id: 'c' + calIndex + '-' + String(ev.uid || k).slice(0, 60) + '-' + date + (time ? 'T' + time : ''), title, date, time, endDate, endTime, allDay: full, cal: calIndex });
    });
  });
  return out;
}

/** Lee y expande todos los calendarios configurados. Guarda 5 minutos en memoria. */
async function collect(fresh) {
  const urls = sources();
  if (!urls.length) return { configured: false, events: [] };
  if (!fresh && cache.body && Date.now() - cache.at < 5 * 60 * 1000) return cache.body;
  const ical = require('node-ical');
  const now = Date.now();
  const from = new Date(now - 45 * 86400000);
  const to = new Date(now + 300 * 86400000);
  const events = []; const errors = [];
  await Promise.all(urls.map(async (u, i) => {
    try { events.push.apply(events, expand(ical, await fetchText(u), i, from, to)); }
    catch (e) { errors.push({ cal: i, error: String(e && e.message || e).slice(0, 60) }); }
  }));
  events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const body = { configured: true, calendars: urls.length, errors, fetchedAt: now, events: events.slice(0, MAX_EVENTS) };
  if (!errors.length) cache = { at: now, body };
  return body;
}

module.exports = async function handler(req, res) {
  if (!guard(req, res)) return;
  res.status(200).json(await collect(req.query && req.query.fresh === '1'));
};
module.exports.expand = expand;
module.exports.collect = collect;
