// The atelier's presence server: one Durable Object per room. It relays
// where apprentices stand, short chat lines, the recipes of specimen
// prints hung on the shared drying line, and coated papers handed between
// partners. Chat is never stored. The line keeps 14 recipes for 24 hours,
// or, in a class room (code starting "class-"), 80 recipes for 14 days so
// the teacher can review them. No image of any kind is accepted: a print is
// a handful of numbers, a coating is a list of brush points, and each
// browser redraws them from the drawer's specimen plate.

const ORIGINS = [
  'https://binyoun.github.io',
  'http://localhost:8123',
  'http://127.0.0.1:8123',
];
const PROCESSES = ['cyanotype', 'vandyke', 'platinum', 'saltprint', 'albumen', 'daguerreotype', 'tintype', 'anthotype', 'lumen'];
const TIERS = ['thin', 'pale', 'fine', 'over', 'fair'];
const MAX_PEOPLE = 40;
const DAY = 24 * 60 * 60 * 1000;
const isClass = (room) => /^class-/.test(room || '');
const lineMax = (room) => (isClass(room) ? 80 : 14);
const lineTtl = (room) => (isClass(room) ? 14 * DAY : DAY);
const COATABLE = ['cyanotype', 'vandyke', 'platinum', 'saltprint', 'albumen'];
const MAX_POINTS = 1500;
const INK = /^#[0-9a-f]{6}$/i;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Content-Type': 'application/json',
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const m = url.pathname.match(/^\/room\/([a-z0-9-]{1,24})\/(ws|count|line)$/);
    if (!m) return new Response('The atelier server. Nothing to see here.', { status: 404 });
    if (origin && !ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
    const stub = env.ATELIER.get(env.ATELIER.idFromName(m[1]));
    if (m[2] !== 'ws') {
      const r = await stub.fetch(`https://room/${m[2]}?room=${m[1]}`);
      return new Response(await r.text(), { headers: cors(origin) });
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const fwd = new Request(req);
    fwd.headers.set('X-Room', m[1]);
    return stub.fetch(fwd);
  },
};

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, n);

// A short list of words the studio will not repeat, in English and
// Vietnamese, matched as whole words and starred out. Not a moderator,
// just a floor; visitors can also hide anyone from their own view.
const BLOCK = [
  'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bullshit', 'cunt', 'bitch', 'bastard',
  'dick', 'cock', 'pussy', 'asshole', 'slut', 'whore', 'porn', 'rape', 'nigger', 'nigga',
  'faggot', 'fag', 'retard', 'kys',
  'địt', 'đụ', 'lồn', 'cặc', 'buồi', 'đéo', 'đĩ', 'vãi lồn', 'đm', 'dm', 'dmm', 'đmm', 'vcl', 'vkl', 'clgt', 'cc', 'đcm', 'dcm',
];
const BLOCK_RE = new RegExp(`(?<![\\p{L}\\p{N}])(${BLOCK.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const tidy = (s) => s.replace(BLOCK_RE, (w) => '*'.repeat([...w].length));
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

  async roomCode() {
    if (!this.room) this.room = (await this.state.storage.get('room')) || '';
    return this.room;
  }

  async line() {
    const now = Date.now();
    const ttl = lineTtl(await this.roomCode());
    return ((await this.state.storage.get('line')) || []).filter((i) => now - i.ts < ttl);
  }

  async fetch(req) {
    const url = new URL(req.url);
    const room = url.searchParams.get('room') || req.headers.get('X-Room') || '';
    if (room && room !== (await this.roomCode())) {
      this.room = room;
      await this.state.storage.put('room', room);
    }
    if (url.pathname === '/count') return new Response(JSON.stringify({ n: this.people().length }));
    if (url.pathname === '/line') {
      // the teacher's view: everything on the line, and who is in the room now
      const people = this.people().map((p) => ({ name: p.name, ink: p.ink, a: p.a }));
      return new Response(JSON.stringify({ room: await this.roomCode(), people, line: await this.line() }));
    }
    if (this.state.getWebSockets().length >= MAX_PEOPLE) return new Response('The atelier is full', { status: 503 });
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ id: crypto.randomUUID().slice(0, 8) });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 40000) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t !== 'handoff' && raw.length > 600) return;
    const a = ws.deserializeAttachment() || {};
    const now = Date.now();

    if (m.t === 'hello' && !a.name) {
      a.name = tidy(clean(m.name, 24)) || 'Apprentice';
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
      if (now - (a.lastPos || 0) < 150) return;
      a.lastPos = now;
      a.x = num(m.x, -24, 24);
      a.z = num(m.z, -9, 9);
      a.r = num(m.r, -100, 100);
      a.a = PROCESSES.includes(m.a) ? m.a : '';
      ws.serializeAttachment(a);
      this.broadcast({ t: 'pos', id: a.id, x: a.x, z: a.z, r: a.r, a: a.a }, ws);
    } else if (m.t === 'chat') {
      if (now - (a.lastChat || 0) < 1200) return;
      const text = tidy(clean(m.text, 140));
      if (!text) return;
      a.lastChat = now;
      ws.serializeAttachment(a);
      this.broadcast({ t: 'chat', id: a.id, name: a.name, text }, ws);
    } else if (m.t === 'hang') {
      if (now - (a.lastHang || 0) < 15000) return;
      if (!PROCESSES.includes(m.process) || !TIERS.includes(m.tier)) return;
      if (!Number.isInteger(m.seed) || m.seed < 0 || m.seed > 2147483646) return;
      a.lastHang = now;
      ws.serializeAttachment(a);
      // only these numbers are kept; anything else in the message is dropped
      const item = {
        by: a.id,
        name: a.name,
        process: m.process,
        tier: m.tier,
        seed: m.seed,
        exposure: num(m.exposure, 0, 3),
        adj: num(m.adj, 0.5, 1.6),
        contrast: num(m.contrast, 0.6, 1.6),
        tone: num(m.tone, -1, 1),
        ts: now,
      };
      // a print made by two people carries both names; the partner's name
      // comes from the server's own record, never from the message
      const partner = m.with && this.byId(m.with);
      if (partner) item.name = `${a.name} & ${partner.deserializeAttachment().name}`;
      const items = await this.line();
      items.unshift(item);
      await this.state.storage.put('line', items.slice(0, lineMax(await this.roomCode())));
      this.broadcast({ t: 'hang', item });
    } else if (m.t === 'handoff') {
      // a coated sheet passed to one partner: brush points, normalised 0..1
      if (now - (a.lastHandoff || 0) < 5000) return;
      const to = this.byId(m.to);
      if (!to || to === ws || !COATABLE.includes(m.process)) return;
      if (!Number.isInteger(m.seed) || m.seed < 0 || m.seed > 2147483646) return;
      if (!Array.isArray(m.points) || !m.points.length || m.points.length > MAX_POINTS * 3) return;
      const points = m.points.map((v) => num(v, 0, 1));
      a.lastHandoff = now;
      ws.serializeAttachment(a);
      to.send(JSON.stringify({ t: 'handoff', from: a.id, name: a.name, process: m.process, seed: m.seed, points }));
    } else if (m.t === 'pairdone') {
      // the partner who exposed tells the one who coated how it turned out
      const to = this.byId(m.to);
      if (!to || to === ws || !COATABLE.includes(m.process) || !TIERS.includes(m.tier)) return;
      to.send(JSON.stringify({ t: 'pairdone', from: a.id, name: a.name, process: m.process, tier: m.tier }));
    }
  }

  byId(id) {
    if (typeof id !== 'string') return null;
    for (const ws of this.state.getWebSockets()) {
      const x = ws.deserializeAttachment();
      if (x && x.id === id && x.name && !x.gone) return ws;
    }
    return null;
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
