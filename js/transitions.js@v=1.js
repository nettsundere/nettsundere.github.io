(() => {
  'use strict';

  /* Turbolinks-style client-side navigation. Internal link clicks are
     intercepted, the destination is fetched, and only the page body is
     swapped in — with a short crossfade on <main> — instead of a full
     document reload. Any failure falls back to a normal browser navigation,
     so the site still works with JS disabled or broken. */

  const html = document.documentElement;
  const supported = 'fetch' in window
    && typeof window.history.pushState === 'function'
    && typeof DOMParser === 'function'
    && typeof AbortController === 'function';
  if (!supported) return;

  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const site = () => window.__site || {};

  // url.href -> raw HTML string. Keeps repeat / back-forward visits instant.
  const cache = new Map();
  let navToken = 0;          // guards against overlapping navigations
  let current = location.href;

  /* --------------------------------------------------------------------- */
  /* Eligibility */
  const sameOrigin = (url) => url.origin === location.origin;

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
    // Pure in-page anchor — let the browser handle the hash jump.
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return false;
    return url;
  }

  /* --------------------------------------------------------------------- */
  /* Fetch + parse */
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
  /* Head reconciliation: title, <html lang>, and stylesheets. */
  function syncHead(doc, baseHref) {
    if (doc.title) document.title = doc.title;
    const lang = doc.documentElement.getAttribute('lang');
    if (lang) html.setAttribute('lang', lang);

    const resolve = (l) => { try { return new URL(l.getAttribute('href'), baseHref).href; } catch (_) { return null; } };
    const want = new Set();
    doc.head.querySelectorAll('link[rel="stylesheet"][href]').forEach((l) => { const h = resolve(l); if (h) want.add(h); });

    const have = new Map();
    document.head.querySelectorAll('link[rel="stylesheet"]').forEach((l) => have.set(l.href, l));

    const pending = [];
    want.forEach((href) => {
      if (have.has(href)) return;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      pending.push(new Promise((resolve) => {
        link.addEventListener('load', resolve, { once: true });
        link.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 1500);
      }));
      document.head.appendChild(link);
    });
    have.forEach((link, href) => { if (!want.has(href)) link.remove(); });
    return Promise.all(pending);
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
  /* Animation helpers */
  const animate = () => !RM.matches && typeof Element.prototype.animate === 'function';

  function fade(el, from, to, ms) {
    if (!el || !animate()) return Promise.resolve();
    try {
      return el.animate([from, to], { duration: ms, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' }).finished
        .catch(() => {});
    } catch (_) { return Promise.resolve(); }
  }

  const OUT = [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }];
  const IN = [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }];

  /* --------------------------------------------------------------------- */
  /* Restore scroll to top or to the targeted hash. */
  function restoreScroll(url) {
    if (url.hash) {
      const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (el) { el.scrollIntoView(); return; }
    }
    window.scrollTo(0, 0);
  }

  /* --------------------------------------------------------------------- */
  let aborter = null;

  async function navigate(url, { push = true } = {}) {
    const href = url.href;
    const token = ++navToken;
    if (aborter) aborter.abort();
    aborter = new AbortController();

    html.classList.add('is-navigating');
    try {
      const doc = await load(href, aborter.signal);
      if (token !== navToken) return; // superseded by a newer click

      const main = document.querySelector('main');
      await fade(main, OUT[0], OUT[1], 150);
      if (token !== navToken) return;

      if (push) history.pushState({ turbo: true }, '', href);

      const stop = site().stop; if (typeof stop === 'function') stop();
      await syncHead(doc, href);
      swapBody(doc);
      restoreScroll(url);
      const start = site().start; if (typeof start === 'function') start();

      current = location.href;
      document.dispatchEvent(new CustomEvent('turbo:load'));

      await fade(document.querySelector('main'), IN[0], IN[1], 220);
    } catch (err) {
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
    // Same document path with no hash → ignore (already here).
    if (url.href === location.href) { e.preventDefault(); return; }
    e.preventDefault();
    navigate(url);
  });

  window.addEventListener('popstate', () => {
    if (location.href === current) return;
    navigate(new URL(location.href), { push: false });
  });

  // Warm the cache on hover/touch-intent so the click feels instant.
  let prefetchAborter = null;
  const prefetch = (a) => {
    const url = a && a.href && (() => { try { return new URL(a.href, location.href); } catch (_) { return null; } })();
    if (!url || !sameOrigin(url) || !isHtmlPath(url)) return;
    if (cache.has(url.href) || url.href === location.href) return;
    if (prefetchAborter) prefetchAborter.abort();
    prefetchAborter = new AbortController();
    load(url.href, prefetchAborter.signal).catch(() => {});
  };
  document.addEventListener('pointerenter', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a) prefetch(a);
  }, true);
})();
