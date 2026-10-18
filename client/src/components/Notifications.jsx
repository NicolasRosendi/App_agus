import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';
import { useInterval } from '../lib/useInterval.js';
import Icon from './Icon.jsx';
import { Sheet } from './ui.jsx';

export default function Notifications() {
  const [data, setData] = useState({ notifications: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const load = () => api('/users/notifications').then(setData).catch(() => {});
  useEffect(() => { load(); }, []);
  useInterval(load, 20000);

  const show = () => {
    setOpen(true);
    if (data.unread) api('/users/notifications/read', { method: 'POST' }).then(() => setData((d) => ({ ...d, unread: 0 })));
  };

  return (
    <>
      <button className="icon-btn notif-btn" onClick={show} aria-label="Notificaciones">
        <Icon name="bell" />
        {data.unread > 0 && <span className="notif-count">{data.unread}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Transmisiones">
        {data.notifications.length === 0 && <div className="empty">Sin señales entrantes.</div>}
        <div className="stack">
          {data.notifications.map((n) => (
            <button key={n.id} className={`notif ${n.read ? '' : 'new'}`} onClick={() => { if (n.link) { setOpen(false); nav(n.link); } }}>
              <span className="mono dim">[{timeAgo(n.at)}]</span> {n.text}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
