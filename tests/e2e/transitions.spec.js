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

  test('the language switch still does a real navigation', async ({ page }) => {
    // Cross-tree links work either way, but assert RU loads correctly.
    await page.goto('/');
    await page.locator('.lang a', { hasText: 'RU' }).click();
    await expect(page).toHaveURL(/\/ru-ru\/index\.html$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('h1.display')).toContainText('Привет');
  });

  test('the language switch reaches the Chinese pages and back', async ({ page }) => {
    await page.goto('/');
    await page.locator('.lang a', { hasText: '中文' }).click();
    await expect(page).toHaveURL(/\/zh-cn\/index\.html$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('body')).toHaveAttribute('data-lang', 'zh');
    await expect(page.locator('h1.display')).toContainText('你好');

    // within the Chinese tree, nav links swap pages in place
    await page.evaluate(stamp);
    await page.locator('nav[aria-label="Primary"] a', { hasText: '文章' }).click();
    await expect(page).toHaveURL(/\/zh-cn\/blog\.html$/);
    await expect(page.locator('h1.display')).toContainText('文章');
    expect(await page.evaluate(sentinel), 'no full reload occurred').toBe(true);

    await page.locator('.lang a', { hasText: 'RU' }).click();
    await expect(page).toHaveURL(/\/ru-ru\/blog\.html$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('after an in-place swap the new heading has the focus', async ({ page }) => {
    // the keyboard and the screen reader continue from the new page's
    // heading, not from the link that went away
    await page.goto('/');
    await page.evaluate(stamp);
    await page.locator('nav[aria-label="Primary"] a', { hasText: 'Contact' }).click();
    await expect(page).toHaveURL(/\/contact\.html$/);
    await expect(page.locator('main h1')).toBeFocused();
    expect(await page.evaluate(sentinel)).toBe(true);
  });

  test('back and forward return the reader to the place they left', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 700 });
    await page.goto('/blog.html');
    await page.evaluate(stamp);
    const row = page.locator('.post-list .post-row').nth(6);
    await row.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400); // the place is saved once scrolling stops
    const left = await page.evaluate(() => Math.round(window.scrollY));
    expect(left, 'the index is scrolled').toBeGreaterThan(300);

    await row.click();
    await expect(page).toHaveURL(/\/blog\/.+\.html$/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(5);
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(400);

    await page.goBack();
    await expect(page).toHaveURL(/\/blog\.html$/);
    // within two pixels: sub-pixel layout may round the place either way
    const near = (y) => page.evaluate((y) => Math.abs(window.scrollY - y) <= 2, y);
    await expect.poll(() => near(left)).toBe(true);

    await page.goForward();
    await expect(page).toHaveURL(/\/blog\/.+\.html$/);
    await expect.poll(() => near(500)).toBe(true);
    expect(await page.evaluate(sentinel), 'history stayed within the page').toBe(true);
  });
});
