// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Turbolinks-style client-side navigation (js/transitions.js). Internal link
 * clicks swap the page body in place instead of doing a full document reload.
 * We tag the live document with a sentinel and assert it survives navigation —
 * a real reload would wipe it.
 */

const sentinel = () => window['__noReload'] === true;
const stamp = () => { window['__noReload'] = true; };

test.describe('turbo navigation', () => {
  test('nav clicks swap pages without a full reload', async ({ page }) => {
    const errors = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await page.evaluate(stamp);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'home');

    // Home -> Writing
    await page.locator('nav[aria-label="Primary"] a', { hasText: 'Writing' }).click();
    await expect(page).toHaveURL(/\/blog\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'blog');
    await expect(page.locator('h1.display')).toContainText('Writing');
    await expect(page).toHaveTitle(/Writing/);
    expect(await page.evaluate(sentinel), 'no full reload occurred').toBe(true);

    // blog.css is pulled in on demand for the writing section
    await expect
      .poll(() => page.evaluate(() =>
        [...document.styleSheets].some((s) => (s.href || '').includes('blog.css'))))
      .toBe(true);

    // Writing -> a post (relative ../ links resolve against the new URL)
    await page.locator('.post-list .post-row').first().click();
    await expect(page).toHaveURL(/\/blog\/.+\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'blog-post');
    await expect(page.locator('h1.post-title')).toBeVisible();
    expect(await page.evaluate(sentinel)).toBe(true);

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('back / forward restore pages via history', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(stamp);

    await page.locator('nav[aria-label="Primary"] a', { hasText: 'Résumé' }).click();
    await expect(page).toHaveURL(/\/resume\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'resume');

    await page.goBack();
    await expect(page).toHaveURL(/\/$|\/index\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'home');
    expect(await page.evaluate(sentinel), 'back stayed within the SPA').toBe(true);

    await page.goForward();
    await expect(page).toHaveURL(/\/resume\.html$/);
    await expect(page.locator('body')).toHaveAttribute('data-page', 'resume');
    expect(await page.evaluate(sentinel)).toBe(true);
  });

  test('keeps the background canvas node alive across a swap', async ({ page }) => {
    await page.goto('/');
    // Tag the live canvas; if the node survives the swap the tag is still there.
    await page.evaluate(() => { const c = document.getElementById('bg'); if (c) c['__kept'] = true; });

    await page.locator('nav[aria-label="Primary"] a', { hasText: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact\.html$/);

    const kept = await page.evaluate(() => {
      const c = document.getElementById('bg');
      return !!(c && c['__kept']);
    });
    expect(kept, 'the same #bg node was preserved across navigation').toBe(true);
  });

  test('the language switch still does a real navigation', async ({ page }) => {
    // Cross-tree links work either way, but assert RU loads correctly.
    await page.goto('/');
    await page.locator('.lang a', { hasText: 'RU' }).click();
    await expect(page).toHaveURL(/\/ru-ru\/index\.html$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('h1.display')).toContainText('Привет');
  });
});
