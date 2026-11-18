// Ayudas compartidas del contador de visitas.
// Los archivos de /api que empiezan con "_" no se publican como rutas.
//
// Los números se guardan en una base Redis conectada al proyecto desde
// Vercel (Storage). Sirve cualquiera de las dos formas que da Vercel:
//   - Upstash: variables *_KV_REST_API_URL / *_KV_REST_API_TOKEN (API REST)
//   - Redis común: una variable con una dirección redis:// o rediss://
// El nombre o prefijo de las variables da igual: se buscan solas.

const net = require('net');
const tls = require('tls');

const PREFIX = 'amter:';
const TZ = 'America/Montevideo';

function credenciales() {
  const env = process.env;
  const claves = Object.keys(env).sort();

  const kRest = claves.find(function (k) { return /(^|_)(KV_REST_API_URL|REDIS_REST_URL)$/.test(k) && env[k]; });
  if (kRest) {
    const token = env[kRest.replace(/URL$/, 'TOKEN')];
    if (token) return { tipo: 'rest', url: env[kRest].replace(/\/+$/, ''), token: token };
  }

  const kTcp = claves.find(function (k) { return /^rediss?:\/\//i.test(env[k] || ''); });
  if (kTcp) return { tipo: 'tcp', url: env[kTcp] };

  return null;
}

function errorSinBase() {
  const otra = Object.keys(process.env).some(function (k) {
    return /^(postgres(ql)?|mongodb(\+srv)?|mysql|libsql):\/\//i.test(process.env[k] || '');
  });
  const e = new Error(otra ? 'La base conectada no es Redis' : 'Falta conectar la base de datos en Vercel');
  e.code = otra ? 'base-no-redis' : 'sin-base';
  return e;
}

// Manda varios comandos juntos y devuelve un resultado por comando.
async function pipeline(comandos) {
  const c = credenciales();
  if (!c) throw errorSinBase();
  return c.tipo === 'rest' ? pipelineRest(c, comandos) : pipelineTcp(c, comandos);
}

async function pipelineRest(c, comandos) {
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

/* ---------- Conexión redis:// directa (sin dependencias) ---------- */

function codificar(args) {
  let s = '*' + args.length + '\r\n';
  args.forEach(function (a) {
    const v = String(a);
    s += '$' + Buffer.byteLength(v) + '\r\n' + v + '\r\n';
  });
  return s;
}

// Lee una respuesta RESP desde "pos". Devuelve [valor, nuevaPos] o null si falta.
function leer(buf, pos) {
  const fin = buf.indexOf('\r\n', pos);
  if (fin < 0) return null;
  const tipo = String.fromCharCode(buf[pos]);
  const linea = buf.toString('utf8', pos + 1, fin);
  const sig = fin + 2;
  if (tipo === '+') return [linea, sig];
  if (tipo === '-') return [{ error: linea }, sig];
  if (tipo === ':') return [Number(linea), sig];
  if (tipo === '$') {
    const n = Number(linea);
    if (n < 0) return [null, sig];
    if (buf.length < sig + n + 2) return null;
    return [buf.toString('utf8', sig, sig + n), sig + n + 2];
  }
  if (tipo === '*') {
    const n = Number(linea);
    if (n < 0) return [null, sig];
    const lista = [];
    let p = sig;
    for (let i = 0; i < n; i++) {
      const r = leer(buf, p);
      if (!r) return null;
      lista.push(r[0]);
      p = r[1];
    }
    return [lista, p];
  }
  throw new Error('Respuesta de Redis inesperada');
}

function pipelineTcp(c, comandos) {
  const u = new URL(c.url);
  const previos = [];
  const clave = decodeURIComponent(u.password || '');
  const usuario = decodeURIComponent(u.username || '');
  if (clave) previos.push(usuario ? ['AUTH', usuario, clave] : ['AUTH', clave]);
  const db = Number((u.pathname || '').slice(1)) || 0;
  if (db) previos.push(['SELECT', db]);
  const todos = previos.concat(comandos);

  return new Promise(function (resolve, reject) {
    const opciones = { host: u.hostname, port: Number(u.port) || 6379 };
    const seguro = u.protocol === 'rediss:';
    if (seguro) opciones.servername = u.hostname;
    const sock = seguro ? tls.connect(opciones) : net.connect(opciones);
    let buf = Buffer.alloc(0);
    let terminado = false;

    function terminar(err, val) {
      if (terminado) return;
      terminado = true;
      sock.destroy();
      if (err) reject(err); else resolve(val);
    }

    sock.setTimeout(8000, function () { terminar(new Error('Redis no respondió a tiempo')); });
    sock.on('error', terminar);
    sock.on('close', function () { terminar(new Error('Redis cerró la conexión')); });
    sock.on(seguro ? 'secureConnect' : 'connect', function () {
      sock.write(todos.map(codificar).join(''));
    });
    sock.on('data', function (chunk) {
      buf = Buffer.concat([buf, chunk]);
      const res = [];
      let p = 0;
      try {
        while (res.length < todos.length) {
          const r = leer(buf, p);
          if (!r) return; // falta llegar más
          res.push(r[0]);
          p = r[1];
        }
      } catch (e) { return terminar(e); }
      try {
        const propios = res.slice(previos.length).map(function (x) {
          if (x && x.error) throw new Error(x.error);
          return x;
        });
        res.slice(0, previos.length).forEach(function (x) { if (x && x.error) throw new Error(x.error); });
        terminar(null, propios);
      } catch (e) { terminar(e); }
    });
  });
}

/* ---------- Fechas ---------- */

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
  if (!c) return '';
  return (c.token || c.url).slice(-12);
}

module.exports = { PREFIX, pipeline, hoy, diasAtras, sal };
