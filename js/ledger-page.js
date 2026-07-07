// The Apprentice's Ledger page: seals earned, letters answered, prints kept.

import { ledger } from './engine/ledger.js';
import { mountSoundToggle } from './engine/sound.js';
import { PROCESSES, COMMISSIONS } from './content/commissions.js';

mountSoundToggle();

const VERDICT_WORDS = {
  fine: 'a fine print',
  fair: 'a fair print',
  pale: 'underexposed',
  over: 'overexposed',
  thin: 'thinly coated',
};

const state = ledger.get();
const el = (s) => document.querySelector(s);

// ---- the apprenticeship line ------------------------------------------
const line = el('.apprentice-line');
if (state.began) {
  const d = new Date(state.began);
  line.textContent = `Apprenticed to the studio since ${d.toLocaleDateString(undefined,
    { year: 'numeric', month: 'long', day: 'numeric' })}. ` +
    `${state.prints.length} print${state.prints.length === 1 ? '' : 's'} pressed, ` +
    `${ledger.sealCount()} of 9 seals earned.`;
} else {
  line.textContent = 'No apprenticeship has begun. The benches are waiting in the lab.';
}

// ---- seals --------------------------------------------------------------
const sealsEl = el('.seal-row');
for (const [id, p] of Object.entries(PROCESSES)) {
  const slot = document.createElement('div');
  slot.className = 'seal-slot';
  const earned = ledger.hasSeal(id);
  slot.innerHTML = `
    <span class="seal ${earned ? 'earned' : 'ghost'}" style="--seal:${p.seal}">${p.name[0]}</span>
    <small>${p.name}</small>`;
  sealsEl.appendChild(slot);
}

// ---- commissions ---------------------------------------------------------
const comEl = el('.commission-list');
for (const c of COMMISSIONS) {
  const done = ledger.fulfilled(c.id);
  const row = document.createElement('div');
  row.className = 'commission-row' + (done ? ' done' : '');
  row.innerHTML = `
    <a href="../lab/${c.process}/">${PROCESSES[c.process].name}</a>
    <span class="commission-goal">${c.from}: ${c.goal}</span>
    <span class="commission-state">${done ? 'Fulfilled' : 'Waiting'}</span>`;
  comEl.appendChild(row);
}

// ---- the album -----------------------------------------------------------
const album = el('.album');
function renderAlbum() {
  const prints = ledger.get().prints;
  album.innerHTML = '';
  if (!prints.length) {
    album.innerHTML = '<p class="album-empty">Nothing pressed yet. ' +
      'Go and make something the sun will remember.</p>';
    return;
  }
  for (const p of prints) {
    const proc = PROCESSES[p.process] || { name: p.process };
    const d = new Date(p.ts);
    const fig = document.createElement('figure');
    fig.className = 'album-print';
    fig.innerHTML = `
      <img src="${p.thumb}" alt="${proc.name}, ${VERDICT_WORDS[p.verdict] || p.verdict}">
      <figcaption>
        <span class="album-name">${proc.name}</span>
        <span class="album-verdict">${VERDICT_WORDS[p.verdict] || p.verdict}</span>
        <span class="album-date">${d.toLocaleDateString()}</span>
      </figcaption>
      <button class="album-remove" title="Remove from the ledger">Remove</button>`;
    fig.querySelector('.album-remove').addEventListener('click', () => {
      ledger.removePrint(p.ts);
      renderAlbum();
    });
    album.appendChild(fig);
  }
}
renderAlbum();
