// The class line: everything one atelier room has hung on its shared line,
// redrawn from recipes, plus who is in the room right now.

import { serverUrl } from './atelier/net.js';
import { renderRecipe } from './engine/sample.js';
import { PROCESSES } from './content/commissions.js';
import { BENCHES } from './atelier/places.js';

const $ = (s) => document.querySelector(s);
const form = $('.room-form');
const input = form.querySelector('input');
const params = new URLSearchParams(location.search);
input.value = params.get('room') || '';

const configs = {};
const drawn = new Map(); // key -> canvas, so refreshes do not redraw
let items = [];

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const room = clean(input.value);
  if (!room) return;
  history.replaceState(null, '', `?room=${room}`);
  load();
});

function clean(v) {
  return v.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 10);
}

async function load() {
  const room = clean(input.value);
  if (!room) return;
  const enter = $('[data-enter]');
  enter.href = `../?room=${room}`;
  enter.hidden = false;
  // every atelier on the square is its own room, and so is the square
  let rooms;
  try {
    rooms = await Promise.all(['street', ...BENCHES.map((b) => b.id)].map(async (at) => {
      const r = await fetch(serverUrl().replace(/^ws/, 'http') + `/room/${room}-${at}/line`);
      return { at, ...(await r.json()) };
    }));
  } catch (e) {
    $('.grid').innerHTML = '<p class="none">The atelier server could not be reached.</p>';
    return;
  }
  showPeople(rooms.flatMap((r) => r.people.map((p) => ({ ...p, at: r.at }))));
  items = rooms.flatMap((r) => r.line).sort((a, b) => b.ts - a.ts);
  await showLine(items);
  $('.updated').textContent = `Last updated ${new Date().toLocaleTimeString()}.`;
}

function showPeople(people) {
  const ul = $('.people');
  ul.innerHTML = '';
  if (!people.length) {
    ul.innerHTML = '<li class="empty">Nobody is in this room right now.</li>';
    return;
  }
  for (const p of people) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.ink;
    const name = document.createElement('span');
    name.textContent = p.name;
    li.append(dot, name);
    const s = document.createElement('small');
    const b = BENCHES.find((x) => x.id === p.at);
    s.textContent = b ? `${b.atelier}${p.a ? ', at the bench' : ''}` : 'in the square';
    li.append(s);
    ul.append(li);
  }
}

async function showLine(list) {
  const grid = $('.grid');
  $('[data-csv]').disabled = !list.length;
  if (!list.length) {
    grid.innerHTML = '<p class="none">Nothing hangs on this line yet.</p>';
    $('.tally').textContent = '';
    return;
  }
  // per apprentice: how many prints, how many judged fine
  const by = new Map();
  for (const it of list) {
    const t = by.get(it.name) || { n: 0, fine: 0 };
    t.n++;
    if (it.tier === 'fine') t.fine++;
    by.set(it.name, t);
  }
  $('.tally').innerHTML = [...by.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([name, t]) => `<b>${esc(name)}</b> ${t.n} print${t.n === 1 ? '' : 's'}${t.fine ? `, ${t.fine} fine` : ''}`)
    .join(' · ');

  grid.innerHTML = '';
  for (const it of list) {
    const fig = document.createElement('figure');
    const key = `${it.ts}-${it.by}`;
    let c = drawn.get(key);
    if (!c) {
      try {
        if (!configs[it.process]) configs[it.process] = (await import(`./processes/${it.process}.js`)).default;
        c = renderRecipe(configs[it.process], it);
        drawn.set(key, c);
      } catch (e) {
        continue;
      }
    }
    const cap = document.createElement('figcaption');
    const proc = (PROCESSES[it.process] || {}).name || it.process;
    cap.innerHTML = `${esc(it.name)}<small>${esc(proc)}, judged <span class="tier-${it.tier}">${it.tier}</span> · ${when(it.ts)}</small>`;
    fig.append(c, cap);
    grid.append(fig);
  }
}

function when(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function esc(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('[data-csv]').addEventListener('click', () => {
  const rows = [['name', 'process', 'verdict', 'time']];
  for (const it of items) rows.push([it.name, it.process, it.tier, new Date(it.ts).toISOString()]);
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `alt-lab-line-${clean(input.value)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

if (input.value) load();
setInterval(() => { if (input.value && !document.hidden) load(); }, 20000);
