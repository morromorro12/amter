// Ayudas compartidas del contador de visitas.
// Los archivos de /api que empiezan con "_" no se publican como rutas.
//
// Los números se guardan en una base Upstash Redis conectada al proyecto
// desde Vercel (Storage). Vercel agrega solas las variables de entorno.

const PREFIX = 'amter:';
const TZ = 'America/Montevideo';

function credenciales() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null;
}

// Manda varios comandos juntos en un solo pedido.
async function pipeline(comandos) {
  const c = credenciales();
  if (!c) {
    const e = new Error('Falta conectar la base de datos en Vercel');
    e.code = 'sin-base';
    throw e;
  }
  const r = await fetch(c.url + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + c.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(comandos),
  });
  if (!r.ok) throw new Error('Redis respondió ' + r.status);
  const data = await r.json();
  return data.map(function (x) {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

// Fecha de hoy en Uruguay, como "2026-11-18".
function hoy() {
  const partes = {};
  new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date())
    .forEach(function (p) { partes[p.type] = p.value; });
  return partes.year + '-' + partes.month + '-' + partes.day;
}

// Resta días a una fecha "AAAA-MM-DD".
function diasAtras(fecha, n) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

function sal() {
  const c = credenciales();
  return c ? c.token.slice(-12) : '';
}

module.exports = { PREFIX, pipeline, hoy, diasAtras, sal };
