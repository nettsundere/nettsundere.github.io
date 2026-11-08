// @ts-check
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

/**
 * Sea of Love sets every letter and digit on every page, in every language:
 * text, headings, navigation, labels, dates and code. The one exception is a
 * specimen that shows another font on the fonts post; such an element names
 * that font first in its own style, and this check leaves it alone.
 *
 * Punctuation and symbols are left out, so the check is about the font that
 * a reader sees, not about the font's coverage of rare signs.
 *
 * Only Chromium tells which font drew a piece of text (through the DevTools
 * protocol), so this check runs there.
 */

const ROOT = path.join(__dirname, '..', '..');
/** Fonts that the fonts post shows in its specimens. */
const SPECIMEN_FONTS = /^\s*"?(Lords|Lords Connected|Neftyanochka)"?\s*(,|$)/;

function pages() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.posix.join(dir, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', 'tests', 'test-results', 'playwright-report', '.git'].includes(e.name)) walk(rel);
      } else if (e.name.endsWith('.html') && !['ru-ru.html', 'zh-cn.html'].includes(rel)) {
        out.push('/' + rel.replace(/^\.\//, ''));
      }
    }
  };
  walk('.');
  return out.sort();
}

test.skip(({ browserName }) => browserName !== 'chromium', 'only Chromium reports the font that drew the text');

for (const page of pages()) {
  test(`${page} — every letter is set in Sea of Love`, async ({ page: p }) => {
    await p.goto(page);
    await p.evaluate(() => document.fonts.ready);
    // A probe per element that holds text of its own, with only its letters
    // and digits, styled as the element is.
    const probes = await p.evaluate((specimen) => {
      const re = new RegExp(specimen);
      const WORD = /[\p{L}\p{N}]/u;
      const picked = [];
      for (const el of document.querySelectorAll('body *')) {
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
        if (!el.getClientRects().length) continue;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || re.test(style.fontFamily)) continue;
        const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
        const letters = [...own].filter((c) => WORD.test(c)).join('');
        if (!letters) continue;
        const probe = document.createElement('span');
        probe.textContent = letters;
        probe.dataset.fontProbe = String(picked.length);
        el.appendChild(probe);
        picked.push(`${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : ''} “${letters.slice(0, 24)}”`);
      }
      return picked;
    }, SPECIMEN_FONTS.source);
    expect(probes.length, 'the page has text').toBeGreaterThan(0);

    const cdp = await p.context().newCDPSession(p);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-font-probe]' });
    const strays = [];
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      const others = fonts.filter((f) => !/^Sea ?of ?Love/i.test(f.familyName) && f.glyphCount > 0);
      if (others.length) {
        const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
        const i = Number(attributes[attributes.indexOf('data-font-probe') + 1]);
        strays.push(`${probes[i]}: ${others.map((f) => `${f.familyName} (${f.glyphCount})`).join(', ')}`);
      }
    }
    expect(strays, `text set in another font:\n${strays.join('\n')}`).toEqual([]);
  });
}
