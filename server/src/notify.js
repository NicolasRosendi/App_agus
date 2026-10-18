import { db, id, save } from './db.js';

export function notify(userId, text, link = null) {
  db().notifications.unshift({ id: id('n'), userId, text, link, at: Date.now(), read: false });
  db().notifications.length = Math.min(db().notifications.length, 2000);
  save();
}
