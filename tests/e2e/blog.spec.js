// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Blog posts. Ordered oldest -> newest, the same order used to wire the
 * prev (Older) / next (Newer) links between posts. Most were migrated from
 * Medium; posts listed in ORIGINAL were written natively for this site.
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
];

/** Posts written natively for this site — they carry no Medium attribution. */
const ORIGINAL = new Set(['28-06-2026-what-do-i-do-when-the-llm-comes']);

/**
 * In-body "See also" cross-references between posts: source slug -> target
 * slug. Each is rendered as a ".post-related" paragraph linking to a sibling
 * post in the same language directory.
 */
const RELATED = {
  '25-11-2021-on-how-to-measure-the-developer-productivity':
    '28-06-2026-what-do-i-do-when-the-llm-comes',
};

const LANGS = [
  { lang: 'en', base: '/blog', activeNav: 'Writing', back: 'All writing' },
  { lang: 'ru', base: '/ru-ru/blog', activeNav: 'Блог', back: 'Весь блог' },
];

for (const L of LANGS) {
  test.describe(`writing index (${L.lang})`, () => {
    test('lists every post, each linking to a post page', async ({ page }) => {
      const res = await page.goto(`${L.base}.html`);
      expect(res?.status()).toBe(200);
      const rows = page.locator('.post-list .post-row');
      await expect(rows).toHaveCount(SLUGS.length);
      // newest first
      await expect(rows.first()).toHaveAttribute(
        'href',
        new RegExp(`${SLUGS[SLUGS.length - 1]}\\.html$`)
      );
      await expect(rows.last()).toHaveAttribute(
        'href',
        new RegExp(`${SLUGS[0]}\\.html$`)
      );
    });
  });

  test.describe(`blog posts (${L.lang})`, () => {
    for (let i = 0; i < SLUGS.length; i++) {
      const slug = SLUGS[i];
      const url = `${L.base}/${slug}.html`;

      test(`${slug} — loads, attributes Medium, navigates`, async ({ page }) => {
        const errors = [];
        page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
        page.on('pageerror', (e) => errors.push(e.message));

        const res = await page.goto(url);
        expect(res?.status(), 'HTTP status').toBe(200);

        await expect(page.locator('html')).toHaveAttribute('lang', L.lang);
        await expect(page.locator('body')).toHaveAttribute('data-page', 'blog-post');
        await expect(page.locator('h1.post-title')).toBeVisible();

        // current nav item is active
        const nav = page.locator('nav[aria-label="Primary"]');
        await expect(nav.locator('.is-active', { hasText: L.activeNav })).toBeVisible();

        // Medium attribution link is present and points at medium.com
        // (only for posts migrated from Medium; native posts have none)
        const medium = page.locator('.medium-note a');
        if (ORIGINAL.has(slug)) {
          await expect(medium).toHaveCount(0);
        } else {
          await expect(medium).toHaveCount(1);
          await expect(medium).toHaveAttribute('href', /medium\.com/);
        }

        // prev (Older) / next (Newer) wiring
        const prev = page.locator('.post-nav a.prev');
        const next = page.locator('.post-nav a.next');
        await expect(prev).toHaveCount(i > 0 ? 1 : 0);
        await expect(next).toHaveCount(i < SLUGS.length - 1 ? 1 : 0);
        if (i > 0) {
          await expect(prev).toHaveAttribute('href', new RegExp(`${SLUGS[i - 1]}\\.html$`));
        }
        if (i < SLUGS.length - 1) {
          await expect(next).toHaveAttribute('href', new RegExp(`${SLUGS[i + 1]}\\.html$`));
        }

        // in-body "See also" cross-reference, when this post has one
        const related = page.locator('.post-related a');
        if (RELATED[slug]) {
          await expect(related).toHaveCount(1);
          await expect(related).toHaveAttribute(
            'href',
            new RegExp(`${RELATED[slug]}\\.html$`)
          );
        } else {
          await expect(related).toHaveCount(0);
        }

        // back to the index
        await expect(page.locator('.back-link', { hasText: L.back })).toBeVisible();

        await page.waitForLoadState('networkidle');
        expect(errors, errors.join('\n')).toEqual([]);
      });
    }
  });

  test.describe(`cross-references (${L.lang})`, () => {
    for (const [from, to] of Object.entries(RELATED)) {
      test(`${from} — "See also" link resolves to ${to}`, async ({ page }) => {
        await page.goto(`${L.base}/${from}.html`);
        const related = page.locator('.post-related a');
        const href = await related.getAttribute('href');
        expect(href).toMatch(new RegExp(`${to}\\.html$`));
        // the link is relative within the same language dir — it must resolve
        // and load (turbo nav, so wait on the URL rather than a full load)
        await related.click();
        await page.waitForURL(new RegExp(`${L.base}/${to}\\.html$`));
        await expect(page.locator('h1.post-title')).toBeVisible();
      });
    }
  });
}
