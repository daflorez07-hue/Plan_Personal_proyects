// Defensa común de las funciones. El sitio vive detrás de la protección de Vercel
// (Vercel Authentication): solo el dueño de la cuenta llega hasta aquí.
// Además se exige un encabezado propio para que otro sitio no pueda enviar
// peticiones con la sesión del navegador (obliga a CORS preflight, que no se permite).
module.exports = function guard(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.headers['x-derrotero'] !== '1') {
    res.status(403).json({ error: 'forbidden' });
    return false;
  }
  return true;
};
