const express = require('express');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
// En hosting (Railway, etc.) apuntar DATA_FILE al volumen persistente, ej: /data/data.json
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');

// Credenciales del personal del club — definirlas por variable de entorno en producción
const ADMIN_USER = process.env.ADMIN_USER || 'club';
const ADMIN_PASS = process.env.ADMIN_PASS || 'cambiame';

function requiereClave(req, res, next) {
  const auth = req.headers.authorization || '';
  const decoded = Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString();
  const idx = decoded.indexOf(':');
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (idx > 0 && user === ADMIN_USER && pass === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Estacionamiento Club"');
  res.status(401).send('Acceso restringido al personal del club');
}

app.use(express.json());

// las vistas de administración y acceso piden usuario y contraseña
app.use((req, res, next) => {
  if (req.path === '/admin.html' || req.path === '/acceso.html') return requiereClave(req, res, next);
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ---------- persistencia simple en archivo JSON ----------
function load() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'EST-' + s;
}

// ---------- datos de ejemplo la primera vez ----------
function seed() {
  const nombres = ['Juan Pérez', 'María González', 'Carlos López', 'Ana Martínez', 'Diego Fernández',
    'Laura Rodríguez', 'Pablo Sánchez', 'Sofía Romero', 'Martín Díaz', 'Lucía Torres',
    'Federico Ruiz', 'Valentina Castro', 'Nicolás Molina', 'Camila Ortiz', 'Sebastián Silva',
    'Julieta Núñez', 'Andrés Rojas', 'Florencia Vega', 'Gonzalo Herrera', 'Agustina Ríos'];

  function patente() {
    const L = () => 'ABCDEFGHJKLMNPRSTUVWXYZ'[Math.floor(Math.random() * 23)];
    const N = () => Math.floor(Math.random() * 10);
    return Math.random() < 0.7
      ? `A${L()}${N()}${N()}${N()}${L()}${L()}`   // formato AB123CD
      : `${L()}${L()}${L()}${N()}${N()}${N()}`;   // formato ABC123
  }

  const matches = [
    { id: 1, rival: 'Deportivo Norte', fecha: '2026-07-26T16:00', precio: 4000, cupo: 200 },
    { id: 2, rival: 'Atlético del Sur', fecha: '2026-08-02T15:30', precio: 4000, cupo: 200 }
  ];

  const reservations = [];
  let rid = 1;
  // partido 1: bastante vendido, con gente ya ingresada (para probar la vista de acceso)
  for (let i = 0; i < 158; i++) {
    reservations.push({
      id: rid++,
      code: genCode(),
      matchId: 1,
      nombre: nombres[i % nombres.length],
      patente: patente(),
      tipo: Math.random() < 0.9 ? 'auto' : 'moto',
      telefono: '11-' + (4000 + i) + '-' + (1000 + i),
      pago: 'confirmado',
      createdAt: new Date(Date.now() - Math.random() * 4 * 86400000).toISOString(),
      checkinAt: i < 62 ? new Date().toISOString() : null
    });
  }
  // partido 2: recién arranca la venta
  for (let i = 0; i < 41; i++) {
    reservations.push({
      id: rid++,
      code: genCode(),
      matchId: 2,
      nombre: nombres[(i + 7) % nombres.length],
      patente: patente(),
      tipo: 'auto',
      telefono: '11-' + (5000 + i) + '-' + (2000 + i),
      pago: i < 35 ? 'confirmado' : 'pendiente',
      createdAt: new Date(Date.now() - Math.random() * 2 * 86400000).toISOString(),
      checkinAt: null
    });
  }

  save({
    nextMatchId: 3,
    nextResId: rid,
    config: { alias: 'CLUB.ESTACIONA.MP', titular: 'Club Atlético Ejemplo' },
    matches,
    reservations
  });
}

if (!fs.existsSync(DATA_FILE)) seed();

// ---------- helpers ----------
function matchStats(db, m) {
  const rs = db.reservations.filter(r => r.matchId === m.id);
  const pagados = rs.filter(r => r.pago === 'confirmado').length;
  return {
    ...m,
    reservas: rs.length,
    ingresados: rs.filter(r => r.checkinAt).length,
    disponibles: m.cupo - rs.length,
    porVerificar: rs.length - pagados,
    recaudacion: pagados * m.precio
  };
}

// ---------- API ----------
app.get('/api/config', (req, res) => {
  res.json(load().config);
});

app.put('/api/config', requiereClave, (req, res) => {
  const { alias, titular } = req.body;
  const db = load();
  if (alias) db.config.alias = String(alias).trim();
  if (titular !== undefined) db.config.titular = String(titular).trim();
  save(db);
  res.json(db.config);
});

app.get('/api/matches', (req, res) => {
  const db = load();
  res.json(db.matches.map(m => matchStats(db, m)));
});

app.post('/api/matches', requiereClave, (req, res) => {
  const { rival, fecha, precio, cupo } = req.body;
  if (!rival || !fecha) return res.status(400).json({ error: 'Faltan datos del partido' });
  const db = load();
  const m = {
    id: db.nextMatchId++,
    rival: String(rival).trim(),
    fecha,
    precio: Number(precio) || 0,
    cupo: Number(cupo) || 200
  };
  db.matches.push(m);
  save(db);
  res.json(matchStats(db, m));
});

app.get('/api/matches/:id/reservations', requiereClave, (req, res) => {
  const db = load();
  const id = Number(req.params.id);
  res.json(db.reservations.filter(r => r.matchId === id));
});

app.get('/api/matches/:id/search', requiereClave, (req, res) => {
  const db = load();
  const id = Number(req.params.id);
  const q = String(req.query.q || '').trim().toUpperCase();
  if (!q) return res.json([]);
  const results = db.reservations.filter(r =>
    r.matchId === id && (
      r.code.toUpperCase().includes(q) ||
      r.patente.toUpperCase().includes(q) ||
      r.nombre.toUpperCase().includes(q)
    )
  );
  res.json(results.slice(0, 15));
});

app.post('/api/reserve', (req, res) => {
  const { matchId, nombre, patente, tipo, telefono } = req.body;
  if (!matchId || !nombre || !patente) return res.status(400).json({ error: 'Completá nombre y patente' });

  const db = load();
  const m = db.matches.find(x => x.id === Number(matchId));
  if (!m) return res.status(404).json({ error: 'Partido no encontrado' });

  const rs = db.reservations.filter(r => r.matchId === m.id);
  if (rs.length >= m.cupo) return res.status(409).json({ error: 'Cupo agotado para este partido' });

  const pat = String(patente).trim().toUpperCase().replace(/\s+/g, '');
  if (rs.some(r => r.patente === pat)) {
    return res.status(409).json({ error: 'Ya existe una reserva con esa patente para este partido' });
  }

  const r = {
    id: db.nextResId++,
    code: genCode(),
    matchId: m.id,
    nombre: String(nombre).trim(),
    patente: pat,
    tipo: tipo === 'moto' ? 'moto' : 'auto',
    telefono: String(telefono || '').trim(),
    pago: 'pendiente',
    createdAt: new Date().toISOString(),
    checkinAt: null
  };
  db.reservations.push(r);
  save(db);
  res.json({ ...r, precio: m.precio, rival: m.rival, fecha: m.fecha, alias: db.config.alias });
});

app.post('/api/reservations/:code/confirmar-pago', requiereClave, (req, res) => {
  const db = load();
  const r = db.reservations.find(x => x.code === String(req.params.code).trim().toUpperCase());
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
  r.pago = 'confirmado';
  save(db);
  res.json(r);
});

app.post('/api/checkin', requiereClave, (req, res) => {
  const { code } = req.body;
  const db = load();
  const r = db.reservations.find(x => x.code === String(code).trim().toUpperCase());
  if (!r) return res.status(404).json({ error: 'Reserva no encontrada' });
  if (r.checkinAt) {
    return res.status(409).json({ error: 'YA_INGRESO', checkinAt: r.checkinAt, reserva: r });
  }
  r.checkinAt = new Date().toISOString();
  save(db);
  res.json(r);
});

app.get('/api/qr/:code', async (req, res) => {
  try {
    const png = await QRCode.toBuffer(req.params.code, { width: 280, margin: 1 });
    res.type('png').send(png);
  } catch (e) {
    res.status(500).end();
  }
});

app.listen(PORT, () => {
  console.log(`Estacionamiento Club corriendo en http://localhost:${PORT}`);
});
