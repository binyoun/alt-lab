// The atelier's presence server: one Durable Object per room. It relays
// where apprentices stand, short chat lines, and specimen prints hung on
// the shared drying line. Chat is never stored. The line keeps at most
// 14 prints, each for 24 hours. No photograph of a visitor ever arrives
// here; the client only sends prints made from the drawer's specimen.

const ORIGINS = [
  'https://binyoun.github.io',
  'http://localhost:8123',
  'http://127.0.0.1:8123',
];
const PROCESSES = ['cyanotype', 'vandyke', 'platinum', 'saltprint', 'albumen', 'daguerreotype', 'tintype', 'anthotype', 'lumen'];
const TIERS = ['thin', 'pale', 'fine', 'over', 'fair'];
const MAX_PEOPLE = 40;
const LINE_MAX = 14;
const LINE_TTL = 24 * 60 * 60 * 1000;
const THUMB_MAX = 90000; // characters of base64 JPEG
const INK = /^#[0-9a-f]{6}$/i;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Content-Type': 'application/json',
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const m = url.pathname.match(/^\/room\/([a-z0-9-]{1,24})\/(ws|count)$/);
    if (!m) return new Response('The atelier server. Nothing to see here.', { status: 404 });
    if (origin && !ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
    const stub = env.ATELIER.get(env.ATELIER.idFromName(m[1]));
    if (m[2] === 'count') {
      const r = await stub.fetch('https://room/count');
      return new Response(await r.text(), { headers: cors(origin) });
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    return stub.fetch(req);
  },
};

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);
const num = (v, lo, hi) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : 0);

export class Atelier {
  constructor(state) {
    this.state = state;
  }

  people() {
    return this.state.getWebSockets().map((ws) => ws.deserializeAttachment()).filter((a) => a && a.name && !a.gone);
  }

  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (!a || !a.name || a.gone) continue;
      try { ws.send(data); } catch (e) { /* closing */ }
    }
  }

  async line() {
    const now = Date.now();
    const items = ((await this.state.storage.get('line')) || []).filter((i) => now - i.ts < LINE_TTL);
    return items;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/count') return new Response(JSON.stringify({ n: this.people().length }));
    if (this.state.getWebSockets().length >= MAX_PEOPLE) return new Response('The atelier is full', { status: 503 });
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ id: crypto.randomUUID().slice(0, 8) });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > THUMB_MAX + 400) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    const a = ws.deserializeAttachment() || {};
    const now = Date.now();

    if (m.t === 'hello' && !a.name) {
      a.name = clean(m.name, 24) || 'Apprentice';
      a.ink = INK.test(m.ink) ? m.ink : '#274a86';
      a.x = 0; a.z = 3.5; a.r = Math.PI; a.a = '';
      ws.serializeAttachment(a);
      const peers = this.people().filter((p) => p.id !== a.id);
      ws.send(JSON.stringify({ t: 'welcome', id: a.id, peers, line: await this.line() }));
      this.broadcast({ t: 'join', id: a.id, name: a.name, ink: a.ink, x: a.x, z: a.z, r: a.r }, ws);
      return;
    }
    if (!a.name) return;

    if (m.t === 'pos') {
      a.x = num(m.x, -24, 24);
      a.z = num(m.z, -9, 9);
      a.r = num(m.r, -100, 100);
      a.a = PROCESSES.includes(m.a) ? m.a : '';
      ws.serializeAttachment(a);
      this.broadcast({ t: 'pos', id: a.id, x: a.x, z: a.z, r: a.r, a: a.a }, ws);
    } else if (m.t === 'chat') {
      if (now - (a.lastChat || 0) < 1200) return;
      const text = clean(m.text, 140);
      if (!text) return;
      a.lastChat = now;
      ws.serializeAttachment(a);
      this.broadcast({ t: 'chat', id: a.id, name: a.name, text }, ws);
    } else if (m.t === 'hang') {
      if (now - (a.lastHang || 0) < 15000) return;
      if (!PROCESSES.includes(m.process) || !TIERS.includes(m.tier)) return;
      if (typeof m.thumb !== 'string' || !m.thumb.startsWith('data:image/jpeg;base64,') || m.thumb.length > THUMB_MAX) return;
      a.lastHang = now;
      ws.serializeAttachment(a);
      const item = { by: a.id, name: a.name, process: m.process, tier: m.tier, thumb: m.thumb, ts: now };
      const items = await this.line();
      items.unshift(item);
      await this.state.storage.put('line', items.slice(0, LINE_MAX));
      this.broadcast({ t: 'hang', item });
    }
  }

  webSocketClose(ws) {
    this.leave(ws);
  }

  webSocketError(ws) {
    this.leave(ws);
  }

  leave(ws) {
    const a = ws.deserializeAttachment();
    if (a && a.name && !a.gone) {
      a.gone = true;
      ws.serializeAttachment(a);
      this.broadcast({ t: 'leave', id: a.id }, ws);
    }
  }
}
