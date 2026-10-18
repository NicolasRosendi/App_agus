// Store JSON en disco: suficiente para la demo (en Render el disco es efímero,
// así que en cada deploy se vuelve a sembrar). Reemplazable por Postgres/Mongo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let state;
let saveTimer;

export function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return state;
    } catch {
      console.warn('[db] db.json corrupto, re-sembrando');
    }
  }
  state = seed();
  flush();
  return state;
}

export function db() {
  return state;
}

export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 250);
}

function flush() {
  fs.writeFileSync(DB_FILE, JSON.stringify(state));
}

export function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}
