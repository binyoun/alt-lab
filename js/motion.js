// The quiet motion layer: reveals on scroll, a breath of parallax in the
// history figures. Does nothing at all when the visitor prefers reduced
// motion or when scripting is unavailable.

(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('motion');

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
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

  // The hung prints follow the pointer: the whole wall leans a few degrees.
  if (matchMedia('(hover: hover)').matches) {
    const rows = [...document.querySelectorAll('.cards')];
    if (rows.length) {
      let tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
      const settle = () => {
        cx += (tx - cx) * 0.07;
        cy += (ty - cy) * 0.07;
        for (const row of rows) {
          row.style.transform = `rotateY(${cx.toFixed(3)}deg) rotateX(${cy.toFixed(3)}deg)`;
        }
        if (Math.abs(tx - cx) > 0.005 || Math.abs(ty - cy) > 0.005) {
          raf = requestAnimationFrame(settle);
        } else raf = null;
      };
      addEventListener('pointermove', (e) => {
        tx = ((e.clientX / innerWidth) - 0.5) * 6;
        ty = -((e.clientY / innerHeight) - 0.5) * 3.5;
        if (!raf) raf = requestAnimationFrame(settle);
      }, { passive: true });
    }
  }

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
