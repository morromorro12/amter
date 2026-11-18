// POST /api/visita — suma una visita.
// La página principal lo llama una sola vez por día en cada celular o compu.

const crypto = require('crypto');
const { PREFIX, pipeline, hoy, sal } = require('./_redis');

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|facebookexternalhit/i;
// Tope por conexión y por día, para que nadie pueda inflar el número a propósito.
const MAX_POR_IP = 30;

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Usá POST' });
  }

  const ua = req.headers['user-agent'] || '';
  if (!ua || BOTS.test(ua)) return res.status(204).end();

  const fecha = hoy();
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (req.socket && req.socket.remoteAddress) || '';
  // Solo se guarda una huella anónima de la conexión, y se borra a los 2 días.
  const huella = crypto.createHash('sha256').update(sal() + '|' + fecha + '|' + ip).digest('hex').slice(0, 16);
  const claveIp = PREFIX + 'ip:' + fecha + ':' + huella;

  try {
    const [usos] = await pipeline([['INCR', claveIp], ['EXPIRE', claveIp, 172800]]);
    if (usos > MAX_POR_IP) return res.status(204).end();

    await pipeline([
      ['INCR', PREFIX + 'total'],
      ['INCR', PREFIX + 'd:' + fecha],
      ['SET', PREFIX + 'inicio', fecha, 'NX'],
    ]);
    return res.status(204).end();
  } catch (e) {
    console.error('visita:', e.message);
    return res.status(e.code === 'sin-base' ? 503 : 502).json({ error: e.code || 'error' });
  }
};
