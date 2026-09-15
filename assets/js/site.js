/* ==========================================================================
   site.js — chrome and scroll choreography.
   No dependencies. Everything degrades to plain readable text without JS.
   ========================================================================== */

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------------ loader */
window.addEventListener('load', () => {
  const l = document.querySelector('.loader');
  if (l) setTimeout(() => { l.dataset.done = '1'; }, 260);
});

/* ---------------------------------------------------------------- nav ---- */
(function nav() {
  const bar = document.querySelector('.nav');
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (!bar) return;

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const open = links.dataset.open === 'true';
      links.dataset.open = String(!open);
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.textContent = open ? 'Menu' : 'Close';
    });
    links.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        links.dataset.open = 'false';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = 'Menu';
      }
    });
  }

  /* Hide the bar on the way down, show it on the way up. */
  let last = window.scrollY;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const down = y > last && y > 220;
    bar.dataset.hidden = String(down && links?.dataset.open !== 'true');
    last = y;
  }, { passive: true });
})();

/* --------------------------------------------------- block rise-in ------- */
(function rise() {
  const items = document.querySelectorAll('.rise');
  if (!items.length) return;
  if (REDUCED || !('IntersectionObserver' in window)) {
    items.forEach((el) => { el.dataset.in = '1'; });
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const delay = Number(entry.target.dataset.delay || 0);
      setTimeout(() => { entry.target.dataset.in = '1'; }, delay);
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });
  items.forEach((el) => io.observe(el));
})();

/* ------------------------------- word-by-word headline reveal on scroll --- */
(function words() {
  const blocks = document.querySelectorAll('.reveal-words');
  if (!blocks.length) return;

  /* Wrap every word in a span so each can be lit independently. */
  blocks.forEach((block) => {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    texts.forEach((node) => {
      if (!node.nodeValue.trim()) return;
      const frag = document.createDocumentFragment();
      node.nodeValue.split(/(\s+)/).forEach((chunk) => {
        if (!chunk.trim()) { frag.appendChild(document.createTextNode(chunk)); return; }
        const span = document.createElement('span');
        span.className = 'w';
        span.textContent = chunk;
        frag.appendChild(span);
      });
      node.parentNode.replaceChild(frag, node);
    });
  });

  if (REDUCED) {
    document.querySelectorAll('.reveal-words .w').forEach((w) => { w.dataset.lit = '1'; });
    return;
  }

  const tracked = [...blocks].map((el) => ({ el, words: [...el.querySelectorAll('.w')] }));

  function paint() {
    const vh = window.innerHeight;
    for (const { el, words } of tracked) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      /* Progress runs from the block entering the lower third to clearing the upper third. */
      const start = vh * 0.88;
      const end = vh * 0.28;
      const p = (start - r.top) / Math.max(1, (start - end) + r.height * 0.6);
      const lit = Math.round(Math.max(0, Math.min(1, p)) * words.length);
      for (let i = 0; i < words.length; i++) {
        const on = i < lit ? '1' : '0';
        if (words[i].dataset.lit !== on) words[i].dataset.lit = on;
      }
    }
  }

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { paint(); ticking = false; });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  paint();
})();

/* --------------------------------------------- project list from JSON ---- */
(function projects() {
  const mount = document.getElementById('proj-list');
  if (!mount) return;

  fetch('assets/data/projects.json')
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((items) => {
      mount.innerHTML = '';
      items.forEach((p, i) => {
        const a = document.createElement('a');
        a.className = 'proj rise';
        a.href = p.url;
        a.target = '_blank';
        a.rel = 'noopener';
        a.innerHTML = `
          <div class="proj-row">
            <span class="idx">${String(i + 1).padStart(2, '0')}</span>
            <div>
              <h3>${esc(p.name)}</h3>
              <div class="proj-tags">${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
            </div>
            <p class="desc">${esc(p.description)}</p>
            <span class="arrow" aria-hidden="true">↗</span>
          </div>`;
        mount.appendChild(a);
      });
      /* Newly-created nodes need the rise observer applied. */
      if (REDUCED || !('IntersectionObserver' in window)) {
        mount.querySelectorAll('.rise').forEach((el) => { el.dataset.in = '1'; });
        return;
      }
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.dataset.in = '1';
          io.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });
      mount.querySelectorAll('.rise').forEach((el) => io.observe(el));
    })
    .catch(() => {
      mount.innerHTML = '<p class="body-col">Project list unavailable. ' +
        'See <a class="link-u" href="https://github.com/hyperscaleailabs?tab=repositories">github.com/hyperscaleailabs</a>.</p>';
    });
})();

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ------------------------------------------------- current year in footer */
document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});
