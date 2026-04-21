(() => {
  'use strict';

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const TOUCH = matchMedia('(hover: none), (pointer: coarse)');
  const RD = matchMedia('(prefers-reduced-data: reduce)');

  const reducedMotion = () => RM.matches;
  const isTouch = () => TOUCH.matches;
  const lowEnd = () => (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
    || (navigator.deviceMemory && navigator.deviceMemory <= 1);

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  const onReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  /* --------------------------------------------------------------------- */
  /* Scroll reveals */
  function scrollReveal() {
    const els = document.querySelectorAll('[data-reveal]');
    if (!els.length || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    els.forEach((el) => io.observe(el));
  }

  /* --------------------------------------------------------------------- */
  /* Parallax on portrait */
  function parallax() {
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
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
  }

  /* --------------------------------------------------------------------- */
  /* Canvas halftone dot grid */
  function initCanvas() {
    if (RD.matches || lowEnd()) return;
    const canvas = document.getElementById('bg');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) { canvas.remove(); return; }

    const DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    const GAP = 28;
    const BASE_R = 1.6;
    const MOUSE_RADIUS = 180;
    const mouse = { x: -9999, y: -9999 };
    let W = 0, H = 0, cols = 0, rows = 0, running = true, lastDraw = 0;

    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.floor(W * DPR);
      canvas.height = Math.floor(H * DPR);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      cols = Math.ceil(W / GAP) + 1;
      rows = Math.ceil(H / GAP) + 1;
    };

    const draw = (t) => {
      if (!running) return;
      // Aim ~30fps cap
      if (t - lastDraw < 33) { requestAnimationFrame(draw); return; }
      lastDraw = t;
      ctx.clearRect(0, 0, W, H);
      const tt = t * 0.001;
      for (let iy = 0; iy < rows; iy++) {
        const y = iy * GAP;
        for (let ix = 0; ix < cols; ix++) {
          const x = ix * GAP;
          const dx = x - mouse.x, dy = y - mouse.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const mouseFactor = d < MOUSE_RADIUS ? (1 - d / MOUSE_RADIUS) : 0;
          const wave = 0.35 * Math.sin(tt * 0.7 + ix * 0.18 + iy * 0.22);
          const r = BASE_R * (0.6 + 0.7 * mouseFactor) + wave;
          if (r <= 0.05) continue;
          // Red accent region drifting
          const regionX = W * (0.5 + 0.35 * Math.sin(tt * 0.2));
          const regionY = H * (0.4 + 0.3 * Math.cos(tt * 0.17));
          const rdx = x - regionX, rdy = y - regionY;
          const inRegion = (rdx * rdx + rdy * rdy) < 9000;
          ctx.fillStyle = inRegion ? 'rgba(227,0,15,0.9)' : 'rgba(10,10,10,0.9)';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    window.addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      running = document.visibilityState !== 'hidden';
      if (running) requestAnimationFrame(draw);
    });
    requestAnimationFrame(draw);
  }

  /* --------------------------------------------------------------------- */
  /* Square cursor follower */
  function cursor() {
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
    }, { passive: true });

    const hoverable = 'a, button, .magnetic';
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest && e.target.closest(hoverable)) el.classList.add('is-hover');
    });
    document.addEventListener('pointerout', (e) => {
      if (e.target.closest && e.target.closest(hoverable)) el.classList.remove('is-hover');
    });
  }

  /* --------------------------------------------------------------------- */
  /* Magnetic links */
  function magnetic() {
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
      a.addEventListener('pointermove', onMove);
      a.addEventListener('pointerleave', onLeave);
    });
  }

  /* --------------------------------------------------------------------- */
  /* One red square — launches from the VK. glyph, weaves to cursor, becomes cursor bg */
  function scrollDot() {
    if (isTouch()) return;
    const sources = document.querySelectorAll('.display .dot');
    sources.forEach((s) => { s.style.visibility = 'hidden'; });

    const SIZE = 16;
    const dot = document.createElement('div');
    dot.className = 'scroll-dot';
    dot.setAttribute('aria-hidden', 'true');
    dot.style.width = SIZE + 'px';
    dot.style.height = SIZE + 'px';
    document.body.appendChild(dot);

    const source = sources[0];
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

    const render = (x, y, op) => {
      dot.style.opacity = op;
      dot.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;
    };

    render(pos.x, pos.y, 1);

    window.addEventListener('pointermove', (e) => {
      cx = e.clientX; cy = e.clientY;
      if (!gotCursor) { gotCursor = true; startT = performance.now(); }
    }, { passive: true });

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
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* --------------------------------------------------------------------- */
  onReady(() => {
    scrollReveal();
    if (!reducedMotion()) parallax();
    if (!reducedMotion()) initCanvas();
    if (!reducedMotion() && !isTouch()) magnetic();
    if (!reducedMotion()) scrollDot();
  });
})();
