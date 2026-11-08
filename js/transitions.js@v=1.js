(() => {
  'use strict';

  /* In-place page changes. A click on a link to another page of the site
     fetches that page and swaps in its body, instead of loading the whole
     document again. The new page's scripts do not run; js/app.js re-wires
     the shared behaviour through window.__site. Where the browser can, the
     swap runs as a View Transition: the page cross-fades, the header stays
     still and the red dot travels to the next heading (css/app.css).
     Any failure hands over to an ordinary navigation, so the site works
     the same with this script broken or turned off. */

  const html = document.documentElement;
  const supported = 'fetch' in window
    && typeof window.history.pushState === 'function'
    && typeof DOMParser === 'function'
    && typeof AbortController === 'function';
  if (!supported) return;

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const site = () => window.__site || {};

  // url.href -> raw HTML string. Keeps repeat and back-and-forward visits instant.
  const cache = new Map();
  let navToken = 0;          // guards against overlapping navigations
  let current = location.href;

  /* --------------------------------------------------------------------- */
  /* Scroll positions. Each history entry keeps the place where the reader
     left it, so Back returns to that place and not to the top. */
  const canRestore = 'scrollRestoration' in history;
  if (canRestore) history.scrollRestoration = 'manual';
  // a reload keeps the browser's own restoring
  window.addEventListener('pagehide', () => { if (canRestore) history.scrollRestoration = 'auto'; });
  window.addEventListener('pageshow', () => { if (canRestore) history.scrollRestoration = 'manual'; });

  // Each entry carries a key; the places live in memory under that key and
  // are written at the moment the reader leaves, so no timer can miss one.
  const places = new Map();
  const newKey = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  let currentKey = (history.state && history.state.key) || newKey();
  try { history.replaceState({ ...(history.state || {}), turbo: true, key: currentKey }, ''); } catch (_) {}

  // Remember the place on the entry that is showing. The copy in
  // history.state outlives a reload; the copy in memory serves Back.
  const rememberPlace = (persist) => {
    places.set(currentKey, window.scrollY);
    if (!persist) return;
    try { history.replaceState({ ...(history.state || {}), turbo: true, key: currentKey, scrollY: window.scrollY }, ''); } catch (_) {}
  };

  /* --------------------------------------------------------------------- */
  /* Eligibility */
  const sameOrigin = (url) => url.origin === location.origin;
  const samePage = (a, b) => a.pathname === b.pathname && a.search === b.search;

  const isHtmlPath = (url) => {
    const seg = url.pathname.split('/').pop();
    return seg === '' || /\.html?$/i.test(seg) || !seg.includes('.');
  };

  function eligible(a, e) {
    if (e.defaultPrevented || e.button !== 0) return false;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
    if (!a || !a.href) return false;
    const target = (a.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return false;
    if (a.hasAttribute('download')) return false;
    if (/\b(external|nofollow-turbo)\b/.test(a.getAttribute('rel') || '')) return false;
    if (a.hasAttribute('data-no-turbo')) return false;

    let url;
    try { url = new URL(a.href, location.href); } catch (_) { return false; }
    if (!/^https?:$/.test(url.protocol)) return false;
    if (!sameOrigin(url)) return false;
    if (!isHtmlPath(url)) return false;
    // A link to a place on this page: the browser jumps there itself.
    if (samePage(url, location) && url.hash) return false;
    return url;
  }

  /* --------------------------------------------------------------------- */
  /* Fetch and parse */
  async function load(href, signal) {
    let text = cache.get(href);
    if (text == null) {
      const res = await fetch(href, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'turbo' },
        signal,
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!/text\/html/i.test(res.headers.get('content-type') || '')) throw new Error('not html');
      text = await res.text();
      cache.set(href, text);
    }
    return new DOMParser().parseFromString(text, 'text/html');
  }

  /* --------------------------------------------------------------------- */
  /* Stylesheets. The new page's stylesheets load switched off
     (media="not all"), so they cannot touch the page still showing; the
     swap switches them on and drops the ones the new page does not use. */
  function stageStyles(doc, baseHref) {
    const resolve = (l) => { try { return new URL(l.getAttribute('href'), baseHref).href; } catch (_) { return null; } };
    const want = [];
    doc.head.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => { const h = resolve(l); if (h) want.push(h); });

    const have = new Map();
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((l) => have.set(l.href, l));

    const added = [];
    const pending = [];
    want.forEach((href) => {
      if (have.has(href)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.media = 'not all';
      link.href = href;
      pending.push(new Promise((done) => {
        link.addEventListener('load', done, { once: true });
        link.addEventListener('error', done, { once: true });
        setTimeout(done, 2500);
      }));
      document.head.appendChild(link);
      added.push(link);
    });
    const stale = [];
    have.forEach((link, href) => { if (!want.includes(href)) stale.push(link); });

    return {
      ready: Promise.all(pending),
      commit() { added.forEach((l) => l.removeAttribute('media')); stale.forEach((l) => l.remove()); },
      cancel() { added.forEach((l) => l.remove()); },
    };
  }

  /* --------------------------------------------------------------------- */
  /* Body swap. Body attributes are mirrored, then all children replaced. */
  function swapBody(doc) {
    const newBody = document.importNode(doc.body, true);

    // Mirror body attributes (data-page, data-lang, class, …).
    const incoming = new Set();
    Array.from(newBody.attributes).forEach((attr) => {
      incoming.add(attr.name);
      if (document.body.getAttribute(attr.name) !== attr.value) document.body.setAttribute(attr.name, attr.value);
    });
    Array.from(document.body.attributes).forEach((attr) => {
      if (!incoming.has(attr.name)) document.body.removeAttribute(attr.name);
    });

    Array.from(document.body.childNodes).forEach((n) => n.remove());
    Array.from(newBody.childNodes).forEach((n) => document.body.appendChild(n));
  }

  /* --------------------------------------------------------------------- */
  /* Scroll to the saved place, to the targeted anchor, or to the top. */
  function restoreScroll(url, scrollY) {
    if (typeof scrollY === 'number') { window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' }); return; }
    if (url.hash) {
      const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (el) { el.scrollIntoView({ behavior: 'instant' }); return; }
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  /* After a Back or Forward swap the page still moves. A Sea of Love face
     may load again and reflow the text, and the browser's scroll anchoring
     then follows its anchor; pictures without a size reflow the page as
     they decode; and WebKit scrolls once more on its own. Hold the restored
     place until the fonts and the pictures have loaded (at most 1.5 s), and
     let go as soon as the reader scrolls. */
  function holdScroll(y) {
    if (typeof y !== 'number') return;
    const start = performance.now();
    let reader = false;
    let settledAt = 0;
    const stopHolding = () => { reader = true; };
    const kinds = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    kinds.forEach((k) => window.addEventListener(k, stopHolding, { passive: true }));
    const pictures = Array.from(document.querySelectorAll('main img'));
    const check = () => {
      const now = performance.now();
      const fontsDone = !document.fonts || document.fonts.status === 'loaded';
      if (!settledAt && fontsDone && pictures.every((img) => img.complete)) settledAt = now;
      if (reader || now - start > 1500 || (settledAt && now - settledAt > 200)) {
        kinds.forEach((k) => window.removeEventListener(k, stopHolding));
        return;
      }
      if (Math.abs(window.scrollY - y) > 1) window.scrollTo({ top: y, left: 0, behavior: 'instant' });
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }

  /* The keyboard and the screen reader start on the new page's heading, as
     they would after a full load, and not on the link that went away. */
  function focusHeading() {
    const h1 = document.querySelector('main h1');
    if (!h1) return;
    if (!h1.hasAttribute('tabindex')) h1.setAttribute('tabindex', '-1');
    try { h1.focus({ preventScroll: true }); } catch (_) {}
  }

  /* --------------------------------------------------------------------- */
  /* Motion: a View Transition where the browser has one, a short fade of
     <main> where it does not, and no motion when the person asked for
     reduced motion. */
  const OUT = [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }];
  const IN = [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }];

  function fade(el, frames, ms) {
    if (!el || typeof el.animate !== 'function') return Promise.resolve();
    try {
      return el.animate(frames, { duration: ms, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }).finished
        .then((a) => { try { a.cancel(); } catch (_) {} }, () => {});
    } catch (_) { return Promise.resolve(); }
  }

  async function swap(update) {
    if (RM.matches) { update(); return; }
    if (typeof document.startViewTransition === 'function') {
      const t = document.startViewTransition(update);
      t.ready.catch(() => {});
      t.finished.catch(() => {});
      await t.updateCallbackDone;
      return;
    }
    await fade(document.querySelector('main'), OUT, 150);
    update();
    fade(document.querySelector('main'), IN, 220);
  }

  /* --------------------------------------------------------------------- */
  let aborter = null;

  async function navigate(url, { push = true, scrollY = null } = {}) {
    const href = url.href;
    const token = ++navToken;
    if (aborter) aborter.abort();
    aborter = new AbortController();

    html.classList.add('is-navigating');
    let staged = null;
    let committed = false;
    try {
      const doc = await load(href, aborter.signal);
      if (token !== navToken) return;

      staged = stageStyles(doc, href);
      await staged.ready;
      if (token !== navToken) { staged.cancel(); return; }

      if (push) {
        rememberPlace(true);
        currentKey = newKey();
        history.pushState({ turbo: true, key: currentKey }, '', href);
      }
      current = location.href;

      await swap(() => {
        const stop = site().stop; if (typeof stop === 'function') stop();
        if (doc.title) document.title = doc.title;
        const lang = doc.documentElement.getAttribute('lang');
        if (lang) html.setAttribute('lang', lang);
        staged.commit();
        committed = true;
        swapBody(doc);
        restoreScroll(url, scrollY);
        const start = site().start; if (typeof start === 'function') start();
      });

      focusHeading();
      holdScroll(scrollY);
      document.dispatchEvent(new CustomEvent('turbo:load'));
    } catch (err) {
      if (staged && !committed) staged.cancel();
      if (err && err.name === 'AbortError') return;
      // Anything unexpected: hand off to a real navigation.
      window.location.assign(href);
      return;
    } finally {
      if (token === navToken) html.classList.remove('is-navigating');
    }
  }

  /* --------------------------------------------------------------------- */
  /* Wiring (bound once for the lifetime of the tab). */
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const url = eligible(a, e);
    if (!url) return;
    e.preventDefault();
    // The page that is showing: nothing to do.
    if (url.href === location.href) return;
    navigate(url);
  });

  window.addEventListener('popstate', (e) => {
    if (location.href === current) return;
    const was = new URL(current);
    current = location.href;
    // Only the anchor changed: the browser has already moved there.
    if (samePage(new URL(location.href), was)) return;
    // The page being left still shows: remember where the reader was on it.
    rememberPlace(false);
    const state = e.state || {};
    currentKey = state.key || newKey();
    let y = places.has(currentKey) ? places.get(currentKey) : state.scrollY;
    if (typeof y !== 'number') y = null;
    navigate(new URL(location.href), { push: false, scrollY: y });
  });

  // Warm the cache when a pointer or the keyboard reaches a link, so the
  // click feels instant.
  let prefetchAborter = null;
  const prefetch = (a) => {
    let url = null;
    try { url = a && a.href ? new URL(a.href, location.href) : null; } catch (_) { url = null; }
    if (!url || !sameOrigin(url) || !isHtmlPath(url)) return;
    if (cache.has(url.href) || url.href === location.href) return;
    if (prefetchAborter) prefetchAborter.abort();
    prefetchAborter = new AbortController();
    load(url.href, prefetchAborter.signal).catch(() => {});
  };
  const intent = (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a) prefetch(a);
  };
  document.addEventListener('pointerenter', intent, true);
  document.addEventListener('focusin', intent);
})();
