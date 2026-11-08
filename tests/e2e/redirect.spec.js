// @ts-check
const { test, expect } = require('@playwright/test');

// ru-ru.html is a meta-refresh redirect to the Russian home page.
test.describe('page: ru-ru.html (redirect)', () => {
  test('redirects to the Russian home page', async ({ page }) => {
    await page.goto('/ru-ru.html');
    await page.waitForURL('**/ru-ru/index.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.locator('h1.display')).toContainText('Привет');
  });
});

// zh-cn.html is a meta-refresh redirect to the Chinese home page.
test.describe('page: zh-cn.html (redirect)', () => {
  test('redirects to the Chinese home page', async ({ page }) => {
    await page.goto('/zh-cn.html');
    await page.waitForURL('**/zh-cn/index.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('h1.display')).toContainText('你好');
  });
});
