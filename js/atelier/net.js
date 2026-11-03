// Presence: one WebSocket to the atelier server (server/ in this repo, a
// Cloudflare Durable Object per room). Only names, apron colours, where
// people stand, short chat lines and specimen prints travel. Photographs
// never do. Without a server the atelier simply stays quiet.

import { SERVER } from './config.js';

export function serverUrl() {
  const q = new URLSearchParams(location.search).get('server');
  return q || SERVER;
}

export function roomCode() {
  const raw = new URLSearchParams(location.search).get('room') || 'commons';
  // short, so "<room>-<atelier>" stays within the server's 24 characters
  return raw.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 10) || 'commons';
}

export async function peekCount(room) {
  const base = serverUrl();
  if (!base) return null;
  try {
    const r = await fetch(base.replace(/^ws/, 'http') + `/room/${room}/count`);
    if (!r.ok) return null;
    return (await r.json()).n;
  } catch (e) {
    return null;
  }
}

export function connect({ room, name, ink, on }) {
  const base = serverUrl();
  let ws = null;
  let closed = false;
  let tries = 0;
  let me = null;
  let lastPos = '';

  const api = {
    get online() { return !!(ws && ws.readyState === 1 && me); },
    get id() { return me; },
    pos(x, z, r, a) {
      const msg = { t: 'pos', x: +x.toFixed(2), z: +z.toFixed(2), r: +r.toFixed(2), a: a || '' };
      const key = JSON.stringify(msg);
      if (key === lastPos) return;
      lastPos = key;
      send(msg);
    },
    chat(text) { send({ t: 'chat', text }); },
    hang(item) { send({ t: 'hang', ...item }); },
    handoff(sheet) { send({ t: 'handoff', ...sheet }); },
    pairdone(to, process, tier) { send({ t: 'pairdone', to, process, tier }); },
    close() { closed = true; if (ws) ws.close(); },
  };

  function send(msg) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
  }

  function open() {
    if (!base || closed) return;
    try {
      ws = new WebSocket(`${base}/room/${room}/ws`);
    } catch (e) {
      on.status && on.status('offline');
      return;
    }
    ws.addEventListener('open', () => {
      tries = 0;
      lastPos = '';
      send({ t: 'hello', name, ink });
    });
    ws.addEventListener('message', (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch (err) { return; }
      if (m.t === 'welcome') {
        me = m.id;
        on.status && on.status('online');
      }
      const fn = on[m.t];
      if (fn) fn(m);
    });
    ws.addEventListener('close', () => {
      me = null;
      if (closed) return;
      on.status && on.status('offline');
      const wait = Math.min(30000, 1000 * 2 ** tries++);
      setTimeout(open, wait);
    });
  }

  if (base) open();
  else on.status && on.status('solo');
  return api;
}
