// The quiet motion layer: reveals on scroll, a breath of parallax in the
// history figures. Does nothing at all when the visitor prefers reduced
// motion or when scripting is unavailable.

(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('motion');

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const el = e.target;
        el.classList.add('in');
        io.unobserve(el);
        if (el.classList.contains('card')) {
          // hand the card over to its fast hover transitions once revealed
          setTimeout(() => {
            el.style.transitionDelay = '';
            el.classList.add('settled');
          }, 900);
        }
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });

  document.querySelectorAll('.family, .card, .chapter, .teaser, .prose > *')
    .forEach((el) => io.observe(el));
  document.querySelectorAll('.cards').forEach((grid) => {
    [...grid.children].forEach((card, i) => {
      card.style.transitionDelay = (i * 70) + 'ms';
    });
  });

  // History figures drift a few pixels against the scroll.
  const figs = [...document.querySelectorAll('.chapter figure img')];
  if (figs.length) {
    let ticking = false;
    const drift = () => {
      const vh = window.innerHeight;
      for (const img of figs) {
        const r = img.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) continue;
        const p = (r.top + r.height / 2 - vh / 2) / vh;
        img.style.transform = `translateY(${(-p * 22).toFixed(1)}px) scale(1.07)`;
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(drift); ticking = true; }
    }, { passive: true });
    drift();
  }
})();
