// Studio dressing for the static pages: the sound toggle, the lab bench
// states (seals and waiting letters), and the Master's welcome letter.

import { ledger } from './engine/ledger.js';
import { mountSoundToggle } from './engine/sound.js';
import { PROCESSES, commissionsFor } from './content/commissions.js';

mountSoundToggle();

// On the landing page, a returning apprentice sees their standing.
const heroNote = document.querySelector('.hero-note');
if (heroNote && ledger.get().began) {
  const seals = ledger.sealCount();
  const line = document.createElement('p');
  line.className = 'hero-standing';
  line.innerHTML = `Apprenticed to this studio. <a href="ledger/">${seals} of 9 seals earned; the ledger is kept here.</a>`;
  heroNote.after(line);
}

const cards = document.querySelectorAll('.cards .card');
if (cards.length) {
  hangPrints();
  decorateBenches();
  if (!ledger.onboarded()) welcomeLetter();
}

// Wrap each card's contents so the spatial transforms never fight the
// reveal transforms, then angle every print toward the centre of its row.
function hangPrints() {
  for (const card of cards) {
    const inner = document.createElement('span');
    inner.className = 'card-inner';
    while (card.firstChild) inner.appendChild(card.firstChild);
    card.appendChild(inner);
  }
  layoutArc();
  addEventListener('resize', layoutArc);
}

function layoutArc() {
  document.querySelectorAll('.cards').forEach((row) => {
    const r = row.getBoundingClientRect();
    if (!r.width) return;
    [...row.querySelectorAll('.card')].forEach((card, i) => {
      const cr = card.getBoundingClientRect();
      const nx = ((cr.left + cr.width / 2) - (r.left + r.width / 2)) / (r.width / 2);
      const inner = card.querySelector('.card-inner');
      inner.style.setProperty('--ry', (nx * -6).toFixed(2) + 'deg');
      inner.style.setProperty('--rz', (((i % 3) - 1) * 0.5).toFixed(2) + 'deg');
    });
  });
}

function decorateBenches() {
  for (const card of cards) {
    const id = (card.getAttribute('href') || '').replace(/\//g, '');
    if (!PROCESSES[id]) continue;
    const inner = card.querySelector('.card-inner') || card;
    if (ledger.hasSeal(id)) {
      const seal = document.createElement('span');
      seal.className = 'seal mini';
      seal.style.setProperty('--seal', PROCESSES[id].seal);
      seal.textContent = PROCESSES[id].name[0];
      seal.title = 'Sealed by the Master';
      inner.appendChild(seal);
    }
    const open = commissionsFor(id).filter((c) => !ledger.fulfilled(c.id)).length;
    const status = document.createElement('div');
    status.className = 'card-status' + (open ? '' : ' done');
    status.textContent = open
      ? (open === 1 ? 'A letter waits' : `${open} letters wait`)
      : 'All letters answered';
    inner.querySelector('.card-body').appendChild(status);
  }
}

function welcomeLetter() {
  const o = document.createElement('div');
  o.className = 'letters-overlay welcome';
  o.innerHTML = `
    <div class="letters-sheaf">
      <article class="letter">
        <div class="letter-from">The Master of the studio</div>
        <p>So you are the new apprentice. Good; the last one ran off with a
        tintypist. The rules of this house are few. Work in dim light. Coat
        what you mean to print. Take only the sun you need, then wash.</p>
        <p>Nine benches wait, each with its own chemistry, and letters arrive
        from people who want things made. Bring me a print worth keeping and I
        will press the studio's seal beside it in your ledger.</p>
        <div class="letter-goal">Everything you make stays in this room. Nothing is sent anywhere.</div>
      </article>
      <button class="btn" data-apron>Take up the apron</button>
    </div>`;
  document.body.appendChild(o);
  o.querySelector('[data-apron]').addEventListener('click', () => {
    ledger.setOnboarded();
    o.remove();
  });
}
