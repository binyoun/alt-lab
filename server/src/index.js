// The atelier's presence server: one Durable Object per room. It relays
// where apprentices stand, short chat lines, the recipes of specimen
// prints hung on the shared drying line, and coated papers handed between
// partners, the Photo 101 Club Hall's group-photo timer, and its photo walk
// board (plans to shoot together; a card's contact goes only to people who
// join it, and cards expire after their date). Chat is never stored. The line keeps 14 recipes for 24 hours,
// or, in a class room (code starting "class-"), 80 recipes for 14 days so
// the teacher can review them. No image of any kind is accepted: a print is
// a handful of numbers, a coating is a list of brush points, and each
// browser redraws them from the drawer's specimen plate.

const ORIGINS = [
  'https://binyoun.github.io',
  'http://localhost:8123',
  'http://127.0.0.1:8123',
  'http://localhost:8124', // the Photo 101 hub, served locally
];
const PROCESSES = ['cyanotype', 'vandyke', 'platinum', 'saltprint', 'albumen', 'daguerreotype', 'tintype', 'anthotype', 'lumen'];
const TIERS = ['thin', 'pale', 'fine', 'over', 'fair'];
const MAX_PEOPLE = 40;
// Photo 101 Commons rooms hold more: their browsers take moves in batches
const MAX_BATCHED = 100;
const isBig = (room) => /^p101-/.test(room || '');
const TICK = 100; // ms between batched move updates
const DAY = 24 * 60 * 60 * 1000;
const isClass = (room) => /^class-/.test(room || '');
const lineMax = (room) => (isClass(room) ? 80 : 14);
const lineTtl = (room) => (isClass(room) ? 14 * DAY : DAY);
const COATABLE = ['cyanotype', 'vandyke', 'platinum', 'saltprint', 'albumen'];
const MAX_POINTS = 1500;
const INK = /^#[0-9a-f]{6}$/i;
// the Photo 101 photo walk board
const WALK_TAGS = ['street', 'portrait', 'night', 'architecture', 'nature', 'food', 'documentary', 'film', 'macro', 'events'];
const WALK_CITIES = ['saigon', 'hanoi', 'online'];
const WALK_MAX = 60;
const PHONE = /\+?\d[\d\s().-]{7,}\d/; // no phone numbers on a public board
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// the camera a Photo 101 Commons visitor carries as their head
const CAMS = ['phone', 'compact', 'dslr', 'mirrorless', 'bridge', 'film', 'instant', 'tlr'];

const cors = (origin) => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Content-Type': 'application/json',
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const m = url.pathname.match(/^\/room\/([a-z0-9-]{1,24})\/(ws|count|line|walks)$/);
    if (!m) return new Response('The atelier server. Nothing to see here.', { status: 404 });
    if (origin && !ORIGINS.includes(origin)) return new Response('Forbidden', { status: 403 });
    const stub = env.ATELIER.get(env.ATELIER.idFromName(m[1]));
    if (m[2] !== 'ws') {
      const q = new URLSearchParams({ room: m[1], key: url.searchParams.get('key') || '', del: url.searchParams.get('del') || '' });
      const r = await stub.fetch(`https://room/${m[2]}?${q}`);
      return new Response(await r.text(), { status: r.status, headers: cors(origin) });
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
  constructor(state, env) {
    this.state = state;
    this.env = env || {};
    // attachments kept in memory, so a broadcast does not decode every socket's
    this.atts = new Map();
    this.moves = new Map();
    this.tick = null;
  }

  att(ws) {
    let a = this.atts.get(ws);
    if (!a) {
      a = ws.deserializeAttachment();
      if (a) this.atts.set(ws, a);
    }
    return a;
  }

  keep(ws, a) {
    ws.serializeAttachment(a);
    this.atts.set(ws, a);
  }

  people() {
    return this.state.getWebSockets().map((ws) => this.att(ws)).filter((a) => a && a.name && !a.gone);
  }

  broadcast(msg, except) {
    const data = JSON.stringify(msg);
    for (const ws of this.state.getWebSockets()) {
      if (ws === except) continue;
      const a = this.att(ws);
      if (!a || !a.name || a.gone) continue;
      try { ws.send(data); } catch (e) { /* closing */ }
    }
  }

  // Moves for batching browsers go out together every TICK ms: one message
  // per person per tick instead of one per person per move.
  queueMove(move) {
    this.moves.set(move.id, move);
    if (!this.tick) this.tick = setTimeout(() => this.flushMoves(), TICK);
  }

  flushMoves() {
    this.tick = null;
    if (!this.moves.size) return;
    const list = [...this.moves.values()];
    this.moves.clear();
    const all = JSON.stringify({ t: 'poses', list });
    for (const ws of this.state.getWebSockets()) {
      const a = this.att(ws);
      if (!a || !a.name || a.gone || !a.batch) continue;
      // nobody needs their own move back
      const data = list.some((m) => m.id === a.id) ? JSON.stringify({ t: 'poses', list: list.filter((m) => m.id !== a.id) }) : all;
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
    if (url.pathname === '/walks') {
      // the teacher's view of the walk board, contacts included; &del=<id> removes a card
      if (!this.env.TEACHER_KEY || url.searchParams.get('key') !== this.env.TEACHER_KEY) return new Response(JSON.stringify({ error: 'key' }), { status: 403 });
      const del = url.searchParams.get('del');
      let walks = await this.walks();
      let notes = await this.notes();
      if (del) {
        walks = walks.filter((w) => w.id !== del);
        notes = notes.filter((n) => n.id !== del);
        await this.state.storage.put('walks', walks);
        await this.state.storage.put('notes', notes);
        this.broadcast({ t: 'walkdel', id: del });
        this.broadcast({ t: 'notedel', id: del });
      }
      const strip = ({ token, ...x }) => x;
      return new Response(JSON.stringify({ walks: walks.map(strip), notes: notes.map(strip) }, null, 2));
    }
    if (url.pathname === '/line') {
      // the teacher's view: everything on the line, and who is in the room now
      const people = this.people().map((p) => ({ name: p.name, ink: p.ink, a: p.a }));
      return new Response(JSON.stringify({ room: await this.roomCode(), people, line: await this.line() }));
    }
    if (this.state.getWebSockets().length >= (isBig(await this.roomCode()) ? MAX_BATCHED : MAX_PEOPLE)) return new Response('The atelier is full', { status: 503 });
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ id: crypto.randomUUID().slice(0, 8) });
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 40000) return;
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.t !== 'handoff' && raw.length > (m.t === 'walk' ? 1400 : 600)) return;
    const a = this.att(ws) || {};
    const now = Date.now();

    if (m.t === 'hello' && !a.name) {
      a.name = tidy(clean(m.name, 24)) || 'Apprentice';
      a.ink = INK.test(m.ink) ? m.ink : '#274a86';
      if (CAMS.includes(m.cam)) a.cam = m.cam;
      a.batch = m.batch === true;
      a.x = 0; a.z = 3.5; a.r = Math.PI; a.a = '';
      this.keep(ws, a);
      const peers = this.people().filter((p) => p.id !== a.id);
      ws.send(JSON.stringify({ t: 'welcome', id: a.id, peers, line: await this.line(), walks: (await this.walks()).map(this.publicWalk), notes: (await this.notes()).map(this.publicWalk), walkCode: !!this.env.BOARD_CODE }));
      this.broadcast({ t: 'join', id: a.id, name: a.name, ink: a.ink, cam: a.cam, x: a.x, z: a.z, r: a.r }, ws);
      return;
    }
    if (!a.name) return;

    if (m.t === 'pos') {
      if (now - (a.lastPos || 0) < 150) return;
      a.lastPos = now;
      a.x = num(m.x, -60, 60); // the country is wider than the square
      a.z = num(m.z, -60, 60);
      a.r = num(m.r, -100, 100);
      a.a = typeof m.a === 'string' && /^[a-z0-9-]{0,24}$/.test(m.a) ? m.a : ''; // what they are at: a bench, a room
      this.keep(ws, a);
      const move = { t: 'pos', id: a.id, x: a.x, z: a.z, r: a.r, a: a.a };
      // older browsers get each move at once; batching ones every tick
      const data = JSON.stringify(move);
      for (const other of this.state.getWebSockets()) {
        if (other === ws) continue;
        const o = this.att(other);
        if (!o || !o.name || o.gone || o.batch) continue;
        try { other.send(data); } catch (e) { /* closing */ }
      }
      this.queueMove(move);
    } else if (m.t === 'chat') {
      if (now - (a.lastChat || 0) < 1200) return;
      const text = tidy(clean(m.text, 140));
      if (!text) return;
      a.lastChat = now;
      this.keep(ws, a);
      this.broadcast({ t: 'chat', id: a.id, name: a.name, text }, ws);
    } else if (m.t === 'hang') {
      if (now - (a.lastHang || 0) < 15000) return;
      if (!PROCESSES.includes(m.process) || !TIERS.includes(m.tier)) return;
      if (!Number.isInteger(m.seed) || m.seed < 0 || m.seed > 2147483646) return;
      a.lastHang = now;
      this.keep(ws, a);
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
      this.keep(ws, a);
      to.send(JSON.stringify({ t: 'handoff', from: a.id, name: a.name, process: m.process, seed: m.seed, points }));
    } else if (m.t === 'walk' || m.t === 'walkjoin' || m.t === 'walkdel' || m.t === 'note' || m.t === 'notedel') {
      await this.walkMessage(ws, a, m, now);
    } else if (m.t === 'look') {
      // a new camera from the Commons camera shop
      if (now - (a.lastLook || 0) < 1000 || !CAMS.includes(m.cam)) return;
      a.lastLook = now;
      a.cam = m.cam;
      this.keep(ws, a);
      this.broadcast({ t: 'look', id: a.id, cam: a.cam }, ws);
    } else if (m.t === 'snap') {
      // the Photo 101 Club Hall's self-timer: everyone in the room gets the
      // same countdown, and each browser takes the group photo itself. No
      // picture ever reaches the server. One timer at a time per room.
      if (now - (a.lastSnap || 0) < 10000 || now < (this.snapUntil || 0)) return;
      a.lastSnap = now;
      this.keep(ws, a);
      this.snapUntil = now + 7000;
      this.broadcast({ t: 'snap', id: a.id, name: a.name, in: 6000 });
    } else if (m.t === 'pairdone') {
      // the partner who exposed tells the one who coated how it turned out
      const to = this.byId(m.to);
      if (!to || to === ws || !COATABLE.includes(m.process) || !TIERS.includes(m.tier)) return;
      to.send(JSON.stringify({ t: 'pairdone', from: a.id, name: a.name, process: m.process, tier: m.tier }));
    }
  }

  // ---- the photo walk board ----
  async walks() {
    const now = Date.now();
    const all = (await this.state.storage.get('walks')) || [];
    const live = all.filter((w) => now < w.expires);
    if (live.length !== all.length) await this.state.storage.put('walks', live);
    return live;
  }

  publicWalk({ contact, kind, token, ...w }) {
    return w;
  }

  // sticky notes on the Meeting Point's ideas wall: a week each
  async notes() {
    const now = Date.now();
    const all = (await this.state.storage.get('notes')) || [];
    const live = all.filter((n) => now - n.ts < 7 * DAY);
    if (live.length !== all.length) await this.state.storage.put('notes', live);
    return live;
  }

  async walkMessage(ws, a, m, now) {
    const err = (why) => ws.send(JSON.stringify({ t: 'walkerr', why }));
    if (m.t !== 'walkdel' && this.env.BOARD_CODE && String(m.code || '').trim().toLowerCase() !== this.env.BOARD_CODE.toLowerCase()) return err('code');
    if (m.t === 'note' || m.t === 'notedel') {
      let notes = await this.notes();
      if (m.t === 'notedel') {
        const n = notes.find((x) => x.id === m.id);
        if (!n || n.token !== m.token) return;
        await this.state.storage.put('notes', notes.filter((x) => x !== n));
        this.broadcast({ t: 'notedel', id: n.id });
        return;
      }
      if (now - (a.lastNote || 0) < 20000) return err('slow');
      const text = tidy(clean(m.text, 100));
      if (!text) return err('form');
      if (PHONE.test(text)) return err('phone');
      if (typeof m.token !== 'string' || !/^[a-z0-9]{8,32}$/.test(m.token)) return err('form');
      a.lastNote = now;
      this.keep(ws, a);
      const note = { id: crypto.randomUUID().slice(0, 8), name: a.name, ink: a.ink, text, token: m.token, ts: now };
      notes.unshift(note);
      notes = notes.slice(0, 40);
      await this.state.storage.put('notes', notes);
      this.broadcast({ t: 'noteadd', note: this.publicWalk(note) });
      ws.send(JSON.stringify({ t: 'notemine', id: note.id }));
      return;
    }
    const walks = await this.walks();
    if (m.t === 'walk') {
      if (now - (a.lastWalk || 0) < 30000) return err('slow');
      const tags = Array.isArray(m.tags) ? [...new Set(m.tags.filter((t) => WALK_TAGS.includes(t)))].slice(0, 3) : [];
      if (!tags.length || !WALK_CITIES.includes(m.city)) return err('form');
      const area = tidy(clean(m.area, 30));
      const when = tidy(clean(m.when, 30));
      const note = tidy(clean(m.note, 160));
      const contact = clean(m.contact, 40);
      const kind = m.kind === 'instagram' ? 'instagram' : 'teams';
      if (!contact || [area, when, note, contact].some((t) => PHONE.test(t))) return err('phone');
      if (m.city !== 'online' && m.safe !== true) return err('safe');
      if (typeof m.token !== 'string' || !/^[a-z0-9]{8,32}$/.test(m.token)) return err('form');
      const date = DATE.test(m.date || '') ? m.date : '';
      // a card lasts until the day after its date, or two weeks if it has none
      const expires = date ? Date.parse(date + 'T00:00:00+07:00') + 2 * DAY : now + 14 * DAY;
      if (expires < now || expires > now + 120 * DAY) return err('date');
      if (walks.filter((w) => w.token === m.token).length >= 3) return err('many');
      a.lastWalk = now;
      this.keep(ws, a);
      const card = { id: crypto.randomUUID().slice(0, 8), name: a.name, ink: a.ink, tags, city: m.city, area, date, when, note, contact, kind, token: m.token, joined: [], ts: now, expires };
      walks.unshift(card);
      await this.state.storage.put('walks', walks.slice(0, WALK_MAX));
      this.broadcast({ t: 'walkadd', card: this.publicWalk(card) });
      ws.send(JSON.stringify({ t: 'walkmine', id: card.id }));
    } else if (m.t === 'walkjoin') {
      const card = walks.find((w) => w.id === m.id);
      if (!card) return err('gone');
      if (!card.joined.includes(a.name) && card.joined.length < 12) {
        card.joined.push(a.name);
        await this.state.storage.put('walks', walks);
        this.broadcast({ t: 'walkjoin', id: card.id, name: a.name });
      }
      // only the person who joins learns how to reach the poster
      ws.send(JSON.stringify({ t: 'walkcontact', id: card.id, contact: card.contact, kind: card.kind }));
    } else if (m.t === 'walkdel') {
      const card = walks.find((w) => w.id === m.id);
      if (!card || card.token !== m.token) return;
      await this.state.storage.put('walks', walks.filter((w) => w !== card));
      this.broadcast({ t: 'walkdel', id: card.id });
    }
  }

  byId(id) {
    if (typeof id !== 'string') return null;
    for (const ws of this.state.getWebSockets()) {
      const x = this.att(ws);
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
    const a = this.att(ws);
    if (a && a.name && !a.gone) {
      a.gone = true;
      this.keep(ws, a);
      this.broadcast({ t: 'leave', id: a.id }, ws);
    }
  }
}
