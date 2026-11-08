// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Chinese text renders in Sea of Love, the site's font, on every Chinese
 * page — including the fonts post, whose own stylesheet sets Latin faces
 * that have no Chinese characters. Without this, a browser quietly falls
 * back to a system font and the page looks right at a glance.
 *
 * Only Chromium tells which font drew a piece of text (through the DevTools
 * protocol), so this check runs there.
 */

const SLUGS = [
  '08-06-2015-on-reducing-changelog-merge-conflicts',
  '25-11-2015-the-implementation-of-min-and-max-operations-for-floating-point-types',
  '11-04-2017-a-text-is-not-that-important',
  '19-05-2018-how-to-downgrade-the-npm-version',
  '12-02-2019-its-time-to-let-the-develop-branch-go',
  '02-06-2019-funny-approaches-to-the-computer-security',
  '22-03-2020-on-selling-an-idea-to-change-something-in-a-project-you-are-working-on',
  '01-10-2021-the-peculiarities-of-json',
  '19-10-2021-the-peculiarities-of-the-yaml',
  '25-11-2021-on-how-to-measure-the-developer-productivity',
  '28-06-2026-what-do-i-do-when-the-llm-comes',
  '10-10-2026-a-couple-of-fonts',
];
const PAGES = [
  '/zh-cn/index.html',
  '/zh-cn/resume.html',
  '/zh-cn/contact.html',
  '/zh-cn/blog.html',
  ...SLUGS.map((s) => `/zh-cn/blog/${s}.html`),
];

test.skip(({ browserName }) => browserName !== 'chromium', 'only Chromium reports the font that drew the text');

for (const path of PAGES) {
  test(`${path} — Chinese text renders in Sea of Love`, async ({ page }) => {
    await page.goto(path);
    await page.evaluate(() => document.fonts.ready);
    // For each element that holds Chinese of its own, add a probe that holds
    // only its Chinese characters, so the fonts reported are the ones that
    // drew the Chinese and not the Latin around it.
    const probes = await page.evaluate(() => {
      const HAN = /\p{Script=Han}/u;
      const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      const picked = [];
      for (const el of document.querySelectorAll('body *')) {
        if (['SCRIPT', 'STYLE', 'TITLE'].includes(el.tagName)) continue;
        if (!el.getClientRects().length) continue;
        const han = [...own(el)].filter((c) => HAN.test(c)).join('');
        if (!han) continue;
        const probe = document.createElement('span');
        probe.textContent = han;
        probe.dataset.hanProbe = String(picked.length);
        el.appendChild(probe);
        picked.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').join('.') : ''));
      }
      return picked;
    });
    expect(probes.length, 'the page has Chinese text').toBeGreaterThan(0);

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
    const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector: '[data-han-probe]' });
    expect(nodeIds.length).toBe(probes.length);
    const strays = [];
    for (const nodeId of nodeIds) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
      const others = fonts.filter((f) => !/^Sea ?of ?Love/i.test(f.familyName) && f.glyphCount > 0);
      if (others.length) {
        const { attributes } = await cdp.send('DOM.getAttributes', { nodeId });
        const i = Number(attributes[attributes.indexOf('data-han-probe') + 1]);
        strays.push(`${probes[i]}: ${others.map((f) => `${f.familyName} (${f.glyphCount})`).join(', ')}`);
      }
    }
    expect(strays, `Chinese drawn by another font:\n${strays.join('\n')}`).toEqual([]);
  });
}
