// GET /api/visitas — números para la página /visitas.

const { PREFIX, pipeline, hoy, diasAtras } = require('./_redis');

const DIAS = 31; // alcanza para el mes en curso y la gráfica de 30 días

module.exports = async function (req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Usá GET' });
  }

  const fecha = hoy();
  const fechas = [];
  for (let i = DIAS - 1; i >= 0; i--) fechas.push(diasAtras(fecha, i));

  try {
    const [total, inicio, valores] = await pipeline([
      ['GET', PREFIX + 'total'],
      ['GET', PREFIX + 'inicio'],
      ['MGET'].concat(fechas.map(function (f) { return PREFIX + 'd:' + f; })),
    ]);

    const dias = fechas.map(function (f, i) { return { fecha: f, visitas: Number(valores[i]) || 0 }; });
    const suma = function (lista) { return lista.reduce(function (a, d) { return a + d.visitas; }, 0); };
    const mes = fecha.slice(0, 7);

    return res.status(200).json({
      fecha: fecha,
      inicio: inicio || null,
      hoy: dias[dias.length - 1].visitas,
      ayer: dias[dias.length - 2].visitas,
      semana: suma(dias.slice(-7)),
      mes: suma(dias.filter(function (d) { return d.fecha.slice(0, 7) === mes; })),
      total: Number(total) || 0,
      dias: dias.slice(-30),
    });
  } catch (e) {
    console.error('visitas:', e.message);
    return res.status(e.code === 'sin-base' ? 503 : 502).json({ error: e.code || 'error' });
  }
};
