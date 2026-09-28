// Derrotero · estado de las conexiones, sin datos: solo si responden y cuántos eventos hay.
// Queda detrás de la protección de Vercel como el resto del sitio.
const cal = require('./calendar.js');

module.exports = async function health(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const dbConfigured = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  let calendar;
  try {
    const r = await cal.collect(true);
    const today = new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86400000 - 5 * 3600000).toISOString().slice(0, 10);
    calendar = r.configured
      ? { configured: true, calendars: r.calendars, ok: !r.errors.length, errors: r.errors.map((e) => e.error), events: r.events.length, today: r.events.filter((e) => e.date === today).length, next7: r.events.filter((e) => e.date >= today && e.date <= in7).length }
      : { configured: false };
  } catch (e) {
    calendar = { configured: true, ok: false, errors: [String(e && e.message || e).slice(0, 60)] };
  }
  res.status(200).json({ app: 'derrotero', db: { configured: dbConfigured }, calendar });
};
