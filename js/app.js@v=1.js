(() => {
  'use strict';

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const TOUCH = matchMedia('(hover: none), (pointer: coarse)');

  const reducedMotion = () => RM.matches;
  const isTouch = () => TOUCH.matches;

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  /* Per-page lifecycle. start() wires the page up; stop() tears everything
     back down so the page can be re-initialised after a turbo navigation
     without leaking window listeners or stacking requestAnimationFrame loops.
     All listeners bind to controller.signal; all loops/created nodes register
     a cleanup. */
  let controller = null;
  let cleanups = [];
  const onCleanup = (fn) => cleanups.push(fn);

  const onReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  /* --------------------------------------------------------------------- */
  /* Parallax on portrait */
  function parallax(signal) {
    const target = document.querySelector('.portrait-frame img');
    if (!target) return;
    let y = 0, ticking = false, idleTimer;
    const apply = () => {
      const scroll = window.scrollY || 0;
      const rect = target.getBoundingClientRect();
      const vh = window.innerHeight;
      if (rect.bottom < 0 || rect.top > vh) { ticking = false; return; }
      y = Math.max(-40, Math.min(40, scroll * 0.08));
      target.style.transform = `translate3d(0, ${y}px, 0)`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) { requestAnimationFrame(apply); ticking = true; }
      target.style.willChange = 'transform';
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { target.style.willChange = 'auto'; }, 200);
    };
    window.addEventListener('scroll', onScroll, { passive: true, signal });
    onCleanup(() => clearTimeout(idleTimer));
    apply();
  }

  /* --------------------------------------------------------------------- */
  /* Square cursor follower */
  function cursor(signal) {
    const el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);

    const target = { x: 0, y: 0 };
    const pos = { x: 0, y: 0 };
    let seen = false, raf = 0;

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.22;
      pos.y += (target.y - pos.y) * 0.22;
      el.style.transform = `translate3d(${pos.x - 6}px, ${pos.y - 6}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!seen) {
        seen = true;
        pos.x = target.x; pos.y = target.y;
        el.classList.add('is-visible');
        raf = requestAnimationFrame(tick);
      }
    }, { passive: true, signal });

    const hoverable = 'a, button, .magnetic';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest && e.target.closest(hoverable)) el.classList.add('is-hover');
    }, { signal });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest && e.target.closest(hoverable)) el.classList.remove('is-hover');
    }, { signal });

    onCleanup(() => { cancelAnimationFrame(raf); el.remove(); });
  }

  /* --------------------------------------------------------------------- */
  /* Magnetic links */
  function magnetic(signal) {
    const links = document.querySelectorAll('a.magnetic');
    if (!links.length) return;
    const STRENGTH = 0.18;
    const PAD = 40;
    links.forEach((a) => {
      a.style.transition = 'transform 280ms cubic-bezier(.2,.7,.2,1)';
      const onMove = (e) => {
        const r = a.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        if (Math.abs(dx) > r.width / 2 + PAD || Math.abs(dy) > r.height / 2 + PAD) {
          a.style.transform = '';
          return;
        }
        a.style.transform = `translate3d(${dx * STRENGTH}px, ${dy * STRENGTH}px, 0)`;
      };
      const onLeave = () => { a.style.transform = ''; };
      a.addEventListener('pointermove', onMove, { signal });
      a.addEventListener('pointerleave', onLeave, { signal });
    });
  }

  /* --------------------------------------------------------------------- */
  /* One red square — launches from the VK. glyph, weaves to cursor, becomes cursor bg */
  function scrollDot(signal) {
    if (isTouch()) return;
    const sources = document.querySelectorAll('.display .dot, .post-title .dot');
    sources.forEach((s) => { s.style.visibility = 'hidden'; });

    const SIZE = 16;
    const dot = document.createElement('div');
    dot.className = 'scroll-dot';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.width = SIZE + 'px';
    dot.style.height = SIZE + 'px';
    document.body.appendChild(dot);

    const source = document.querySelector('.display .dot');
    let originX = window.innerWidth * 0.05, originY = 40;
    if (source) {
      const range = document.createRange();
      range.selectNodeContents(source);
      const rr = range.getBoundingClientRect();
      const cs = getComputedStyle(source);
      const fs = parseFloat(cs.fontSize);
      const lhPx = parseFloat(cs.lineHeight);
      const lhRatio = isNaN(lhPx) ? 1.2 : lhPx / fs;
      const halfLeading = (lhRatio - 1) * fs / 2;

      let baselineY = rr.top + fs * 0.76 + halfLeading;
      let capH = fs * 0.72;
      try {
        const ctx = document.createElement('canvas').getContext('2d');
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = ctx.measureText('M');
        if (m.fontBoundingBoxAscent) baselineY = rr.top + m.fontBoundingBoxAscent + halfLeading;
        if (m.actualBoundingBoxAscent) capH = m.actualBoundingBoxAscent;
      } catch (_) {}

      originX = rr.left + rr.width / 2;
      originY = baselineY - SIZE / 2;
    }
    const pos = { x: originX, y: originY };
    let cx = originX, cy = originY;
    let gotCursor = false;
    let startT = 0;
    let rafId = 0;

    const render = (x, y, op) => {
      dot.style.opacity = op;
      dot.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;
    };

    render(pos.x, pos.y, 1);

    window.addEventListener('pointermove', (e) => {
      cx = e.clientX; cy = e.clientY;
      if (!gotCursor) { gotCursor = true; startT = performance.now(); }
    }, { passive: true, signal });

    const tick = (t) => {
      if (!gotCursor) {
        render(pos.x, pos.y, 1);
      } else {
        const elapsed = (t - startT) / 1000;
        const dx = cx - pos.x, dy = cy - pos.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (elapsed < 1.6) {
          pos.x += dx * 0.06;
          pos.y += dy * 0.06;
          const nx = -dy / dist, ny = dx / dist;
          const amp = 80 * Math.exp(-elapsed * 1.1);
          const wave = Math.sin(elapsed * 8) * amp;
          const k = Math.min(1, elapsed / 1.4);
          render(pos.x + nx * wave, pos.y + ny * wave, 1 - 0.5 * k);
        } else {
          pos.x += dx * 0.22;
          pos.y += dy * 0.22;
          render(pos.x, pos.y, 0.5);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    onCleanup(() => { cancelAnimationFrame(rafId); dot.remove(); });
  }

  /* --------------------------------------------------------------------- */
  /* Lifecycle. cursor() is defined but, like the original, left unwired. */
  function start() {
    if (controller) return;
    controller = new AbortController();
    cleanups = [];
    const signal = controller.signal;
    if (!reducedMotion()) parallax(signal);
    if (!reducedMotion() && !isTouch()) magnetic(signal);
    if (!reducedMotion()) scrollDot(signal);
  }

  function stop() {
    if (controller) { controller.abort(); controller = null; }
    cleanups.forEach((fn) => { try { fn(); } catch (_) {} });
    cleanups = [];
  }

  window.__site = { start, stop };
  onReady(start);
})();
