// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Every content page on the site. One e2e UI test per page is generated
 * from this table. The redirect page (ru-ru.html) is covered separately
 * in redirect.spec.js.
 */
const PAGES = [
  {
    name: 'home (en)',
    path: '/',
    lang: 'en',
    dataPage: 'home',
    titleContains: 'Vladimir Kiselev',
    h1: 'Hello',
    activeNav: 'Index',
  },
  {
    name: 'résumé (en)',
    path: '/resume.html',
    lang: 'en',
    dataPage: 'resume',
    titleContains: 'Vladimir Kiselev',
    h1: 'Résumé',
    activeNav: 'Résumé',
  },
  {
    name: 'contact (en)',
    path: '/contact.html',
    lang: 'en',
    dataPage: 'contact',
    titleContains: 'Contact',
    h1: 'Write',
    activeNav: 'Contact',
  },
  {
    name: 'home (ru)',
    path: '/ru-ru/index.html',
    lang: 'ru',
    dataPage: 'home',
    titleContains: 'Владимир Киселев',
    h1: 'Привет',
    activeNav: 'Главная',
  },
  {
    name: 'résumé (ru)',
    path: '/ru-ru/rezyume.html',
    lang: 'ru',
    dataPage: 'resume',
    titleContains: 'Резюме',
    h1: 'Резюме',
    activeNav: 'Резюме',
  },
  {
    name: 'contact (ru)',
    path: '/ru-ru/kontakty.html',
    lang: 'ru',
    dataPage: 'contact',
    titleContains: 'Контакты',
    h1: 'Пишите',
    activeNav: 'Контакты',
  },
];

for (const page of PAGES) {
  test.describe(`page: ${page.name} (${page.path})`, () => {
    test('loads with 200 and correct document metadata', async ({ page: p }) => {
      const response = await p.goto(page.path);
      expect(response, 'navigation response').not.toBeNull();
      expect(response.status(), 'HTTP status').toBe(200);

      await expect(p).toHaveTitle(new RegExp(page.titleContains));
      await expect(p.locator('html')).toHaveAttribute('lang', page.lang);
      await expect(p.locator('body')).toHaveAttribute('data-page', page.dataPage);
      await expect(p.locator('body')).toHaveAttribute('data-lang', page.lang);
    });

    test('renders the main heading', async ({ page: p }) => {
      await p.goto(page.path);
      const h1 = p.locator('h1.display');
      await expect(h1).toBeVisible();
      await expect(h1).toContainText(page.h1);
    });

    test('shows primary navigation with the current page active', async ({ page: p }) => {
      await p.goto(page.path);
      const nav = p.locator('nav[aria-label="Primary"]');
      await expect(nav).toBeVisible();
      await expect(nav.locator('.is-active', { hasText: page.activeNav })).toBeVisible();
    });

    test('loads without console or page errors', async ({ page: p }) => {
      const errors = [];
      p.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
      });
      p.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

      await p.goto(page.path);
      await p.waitForLoadState('networkidle');
      expect(errors, errors.join('\n')).toEqual([]);
    });
  });
}
