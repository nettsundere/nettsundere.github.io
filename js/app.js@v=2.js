(() => {
  'use strict';

  /* What the pages need from a script is small: the motion is CSS, and the
     content reads without JavaScript. js/transitions.js calls stop() before
     it swaps a page in place and start() after, so whatever start() wires up
     is bound to the page that is showing. */

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  let controller = null;

  const onReady = (fn) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };

  /* A code block that is wider than its column scrolls sideways. Give it a
     place in the tab order, so a keyboard can scroll it too. */
  function scrollableCode(signal) {
    const blocks = document.querySelectorAll('.post-body pre');
    if (!blocks.length) return;
    const mark = () => blocks.forEach((pre) => {
      if (pre.scrollWidth > pre.clientWidth + 1) pre.setAttribute('tabindex', '0');
      else pre.removeAttribute('tabindex');
    });
    mark();
    // the widths move once Sea of Love has loaded
    if (document.fonts) document.fonts.ready.then(() => { if (!signal.aborted) mark(); });
    let timer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(mark, 150);
    }, { passive: true, signal });
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  }

  function start() {
    if (controller) return;
    controller = new AbortController();
    scrollableCode(controller.signal);
  }

  function stop() {
    if (controller) { controller.abort(); controller = null; }
  }

  window.__site = { start, stop };
  onReady(start);
})();
