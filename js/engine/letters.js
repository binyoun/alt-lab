// Letters are read one at a time, like opening the post: the first
// unanswered one on top, then the next, with a way back.

import { ledger } from './ledger.js';

export function readLetters(container, letters, { onTurn } = {}) {
  let i = Math.max(0, letters.findIndex((c) => !ledger.fulfilled(c.id)));
  container.innerHTML = '';
  if (!letters.length) return;
  const slot = document.createElement('div');
  const nav = document.createElement('div');
  nav.className = 'letter-nav';
  nav.innerHTML = `
    <button class="btn ghost" data-prev>Previous</button>
    <span class="letter-count"></span>
    <button class="btn ghost" data-next>Next letter</button>`;
  container.append(slot, nav);

  function show() {
    const c = letters[i];
    const done = ledger.fulfilled(c.id);
    slot.innerHTML = `
      <article class="letter${done ? ' done' : ''}">
        <div class="letter-from">${c.from}, ${c.year}</div>
        <p>${c.letter}</p>
        <div class="letter-goal">${c.goal}</div>
        ${done ? '<div class="letter-stamp">Fulfilled</div>' : ''}
      </article>`;
    nav.hidden = letters.length < 2;
    nav.querySelector('.letter-count').textContent = `Letter ${i + 1} of ${letters.length}`;
    nav.querySelector('[data-prev]').disabled = i === 0;
    nav.querySelector('[data-next]').disabled = i === letters.length - 1;
  }
  nav.querySelector('[data-prev]').addEventListener('click', () => { if (i > 0) { i--; show(); if (onTurn) onTurn(); } });
  nav.querySelector('[data-next]').addEventListener('click', () => { if (i < letters.length - 1) { i++; show(); if (onTurn) onTurn(); } });
  show();
}
