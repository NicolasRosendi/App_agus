import express from 'express';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { load } from './db.js';
import { UPLOAD_DIR } from './upload.js';
import auth from './routes/auth.js';
import users from './routes/users.js';
import feed from './routes/feed.js';
import map from './routes/map.js';
import meets from './routes/meets.js';
import routing from './routes/routing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');
const PORT = process.env.PORT || 4000;

load();
const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));
app.use('/api/auth', auth);
app.use('/api/users', users);
app.use('/api/feed', feed);
app.use('/api/map', map);
app.use('/api/meets', meets);
app.use('/api/route', routing);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint no encontrado' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Archivo muy pesado (máx 60MB)' : 'Error interno' });
});

app.listen(PORT, () => console.log(`[velox] online en :${PORT}`));
